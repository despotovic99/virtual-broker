import type { DocumentTypeDefinition } from './market-pack.js';

/** Vrste dokumenata koje postoje na oba tržišta. Paket tržišta dodaje svoje. */
export const COMMON_DOCUMENT_TYPES: readonly DocumentTypeDefinition[] = [
  { code: 'RESERVATION', title: { sr: 'Rezervacioni ugovor', en: 'Reservation agreement' }, scopes: ['PURCHASE'] },
  { code: 'CONTRACT_DRAFT', title: { sr: 'Nacrt ugovora', en: 'Draft contract' }, scopes: ['PURCHASE'] },
  { code: 'CONTRACT_SIGNED', title: { sr: 'Potpisan ugovor', en: 'Signed contract' }, scopes: ['PURCHASE'] },
  { code: 'POWER_OF_ATTORNEY', title: { sr: 'Punomoćje', en: 'Power of attorney' }, scopes: ['PURCHASE'] },
  { code: 'LEGAL_OPINION', title: { sr: 'Pravno mišljenje', en: 'Legal opinion' }, scopes: ['PURCHASE'] },
  { code: 'ID_DOCUMENT', title: { sr: 'Lični dokument kupca', en: 'Buyer ID document' }, scopes: ['PURCHASE'] },
  { code: 'PAYMENT_PROOF', title: { sr: 'Dokaz o uplati', en: 'Proof of payment' }, scopes: ['PURCHASE'] },
  { code: 'HANDOVER_RECORD', title: { sr: 'Zapisnik o primopredaji', en: 'Handover record' }, scopes: ['PURCHASE'] },
  { code: 'REPORT_PHOTO', title: { sr: 'Fotografija iz izveštaja', en: 'Report photo' }, scopes: ['REPORT'] },
  { code: 'REPORT_PDF', title: { sr: 'Izveštaj inženjera', en: 'Engineer report' }, scopes: ['REPORT'] },
  {
    code: 'DEVELOPER_FINANCIALS',
    title: { sr: 'Finansijski izveštaj investitora', en: 'Developer financial statements' },
    scopes: ['DEVELOPER'],
  },
  { code: 'OTHER', title: { sr: 'Ostalo', en: 'Other' }, scopes: ['PURCHASE', 'PROJECT', 'DEVELOPER', 'REPORT'] },
];
