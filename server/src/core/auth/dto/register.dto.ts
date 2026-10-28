import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export const REGISTRATION_LANGUAGES = ['sr', 'en'] as const;

/** Samostalna registracija kupca. Uloga je uvek BUYER; tržište se bira kroz zahtev ili kupovinu. */
export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(12, 128)
  password: string;

  @IsString()
  @Length(1, 100)
  firstName: string;

  @IsString()
  @Length(1, 100)
  lastName: string;

  @IsOptional()
  @IsIn([...REGISTRATION_LANGUAGES])
  language: (typeof REGISTRATION_LANGUAGES)[number] = 'sr';
}

/** Isti odgovor bez obzira na to da li je nalog napravljen (nema enumeracije naloga). */
export interface RegisterResponseDto {
  status: 'ACCEPTED';
  message: string;
}
