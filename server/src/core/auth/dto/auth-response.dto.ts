import type { Capability } from '../../access/capability.enum.js';
import type { UserResponseDto } from '../../users/dto/user-response.dto.js';

export interface MeResponseDto {
  user: UserResponseDto;
  capabilities: Capability[];
}

/** Odgovor na login i refresh. Refresh token ide samo u HttpOnly cookie, nikad u telo. */
export interface AuthResponseDto extends MeResponseDto {
  accessToken: string;
  /** Koliko sekundi važi access token. */
  expiresIn: number;
}
