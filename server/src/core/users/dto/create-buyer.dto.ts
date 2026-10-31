import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, ValidateNested } from 'class-validator';
import { REGISTRATION_LANGUAGES } from '../../auth/dto/register.dto.js';
import { UpdateBuyerProfileDto } from '../../costs/dto/costs.dto.js';

/**
 * Nalog kupca koji pravi tim (koordinator ili admin) pri otvaranju kupovine
 * bez zahteva. Uloga je uvek samo BUYER, bez tržišta. Početnu lozinku tim
 * predaje kupcu lično.
 */
export class CreateBuyerDto {
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

  /** Profil kupca (prvi stan, državljanstvo, finansiranje…); može i kasnije. */
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBuyerProfileDto)
  profile?: UpdateBuyerProfileDto;
}
