import { ApiErrorCode } from '../../common/errors/api-error-code.js';
import { ApiError } from '../../common/errors/api-error.js';

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** Fajl koji je primio multer (memorijsko skladište). */
export interface UploadedFileData {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export interface ValidatedFile {
  buffer: Buffer;
  fileName: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
}

/**
 * Tip fajla se određuje iz sadržaja (magic bytes), ne iz imena ni iz
 * Content-Type koji šalje klijent. Dozvoljeni su samo PDF, JPG i PNG.
 */
export function validateUploadedFile(file: UploadedFileData | undefined): ValidatedFile {
  if (!file || file.size === 0 || file.size > MAX_DOCUMENT_BYTES || file.buffer.length !== file.size) {
    throw new ApiError(ApiErrorCode.DocumentInvalidFile);
  }
  const mimeType = detectMimeType(file.buffer);
  if (!mimeType) throw new ApiError(ApiErrorCode.DocumentInvalidFile);
  return { buffer: file.buffer, fileName: sanitizeFileName(file.originalname, mimeType), mimeType };
}

function detectMimeType(buffer: Buffer): ValidatedFile['mimeType'] | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  return null;
}

const EXTENSIONS: Record<ValidatedFile['mimeType'], string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** Ime fajla samo za prikaz: bez putanje i kontrolnih znakova, sa ispravnom ekstenzijom. */
function sanitizeFileName(original: string, mimeType: ValidatedFile['mimeType']): string {
  const base = original.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex -- namerno uklanjamo kontrolne znakove iz imena fajla
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '')
    .trim()
    .slice(0, 200);
  const withoutExtension = cleaned.replace(/\.[^.]*$/, '') || 'dokument';
  return `${withoutExtension}${EXTENSIONS[mimeType]}`;
}
