import { HttpStatus } from '@nestjs/common';

/**
 * Katalog svih grešaka koje smeju da izađu van API-ja. Klijent dobija
 * `code` (stabilan, za logiku na klijentu), `statusCode` i `message`.
 *
 * Nova greška: dodati kod ovde i u API_ERRORS, sa statusom i porukom koja
 * objašnjava poslovnu situaciju. Poruka nikad ne sadrži interne detalje
 * (SQL, stack, nazive tabela, tekst sistemske greške).
 */
export enum ApiErrorCode {
  // Generičke
  InternalError = 'INTERNAL_ERROR',
  InvalidRequest = 'INVALID_REQUEST',
  ValidationFailed = 'VALIDATION_FAILED',
  PayloadTooLarge = 'PAYLOAD_TOO_LARGE',
  NotFound = 'NOT_FOUND',
  Unauthenticated = 'UNAUTHENTICATED',
  Forbidden = 'FORBIDDEN',
  TooManyRequests = 'TOO_MANY_REQUESTS',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE',

  // Prijava
  AuthInvalidCredentials = 'AUTH_INVALID_CREDENTIALS',
  AuthSessionExpired = 'AUTH_SESSION_EXPIRED',

  // Korisnici
  UserEmailTaken = 'USER_EMAIL_TAKEN',
  UserRoleNotAssignable = 'USER_ROLE_NOT_ASSIGNABLE',
  UserMarketsRequired = 'USER_MARKETS_REQUIRED',
  MarketNotAllowed = 'MARKET_NOT_ALLOWED',

  // Zahtevi i provere
  RequestQuotaExceeded = 'REQUEST_QUOTA_EXCEEDED',

  // Katalog
  UnitNotAvailable = 'UNIT_NOT_AVAILABLE',
  DeveloperDuplicate = 'DEVELOPER_DUPLICATE',
  UnitLabelTaken = 'UNIT_LABEL_TAKEN',
  BankAccountSameVerifier = 'BANK_ACCOUNT_SAME_VERIFIER',

  // Pravni timovi
  LegalTeamMemberInvalid = 'LEGAL_TEAM_MEMBER_INVALID',
  CannotChangeOwnAccess = 'CANNOT_CHANGE_OWN_ACCESS',

  // Kupovina
  InvalidStateTransition = 'INVALID_STATE_TRANSITION',
  PurchaseStepNotReady = 'PURCHASE_STEP_NOT_READY',
  PurchaseHardBlocked = 'PURCHASE_HARD_BLOCKED',
  LegalTeamNotAvailable = 'LEGAL_TEAM_NOT_AVAILABLE',
  PowerOfAttorneyRequired = 'POWER_OF_ATTORNEY_REQUIRED',
  LegalOpinionRequired = 'LEGAL_OPINION_REQUIRED',

  // Dokumenta
  DocumentInvalidFile = 'DOCUMENT_INVALID_FILE',
  DocumentTypeNotAllowed = 'DOCUMENT_TYPE_NOT_ALLOWED',

  // Novac
  PaymentConditionsNotMet = 'PAYMENT_CONDITIONS_NOT_MET',
  BankAccountNotVerified = 'BANK_ACCOUNT_NOT_VERIFIED',
  EscrowNotUsed = 'ESCROW_NOT_USED',
  EscrowSameApprover = 'ESCROW_SAME_APPROVER',
}

export interface ApiErrorDefinition {
  status: HttpStatus;
  message: string;
}

export const API_ERRORS: Readonly<Record<ApiErrorCode, ApiErrorDefinition>> = {
  [ApiErrorCode.InternalError]: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Došlo je do greške. Pokušajte ponovo.',
  },
  [ApiErrorCode.InvalidRequest]: { status: HttpStatus.BAD_REQUEST, message: 'Zahtev nije ispravan.' },
  [ApiErrorCode.ValidationFailed]: { status: HttpStatus.BAD_REQUEST, message: 'Neki podaci nisu ispravni.' },
  [ApiErrorCode.PayloadTooLarge]: { status: HttpStatus.PAYLOAD_TOO_LARGE, message: 'Zahtev je prevelik.' },
  [ApiErrorCode.NotFound]: { status: HttpStatus.NOT_FOUND, message: 'Traženi podatak ne postoji.' },
  [ApiErrorCode.Unauthenticated]: { status: HttpStatus.UNAUTHORIZED, message: 'Potrebna je prijava.' },
  [ApiErrorCode.Forbidden]: { status: HttpStatus.FORBIDDEN, message: 'Nemate pravo pristupa.' },
  [ApiErrorCode.TooManyRequests]: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Previše pokušaja. Pokušajte ponovo kasnije.',
  },
  [ApiErrorCode.ServiceUnavailable]: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Servis trenutno nije dostupan.',
  },
  [ApiErrorCode.AuthInvalidCredentials]: { status: HttpStatus.UNAUTHORIZED, message: 'Pogrešan email ili lozinka.' },
  [ApiErrorCode.AuthSessionExpired]: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Sesija je istekla. Prijavite se ponovo.',
  },
  [ApiErrorCode.UserEmailTaken]: { status: HttpStatus.CONFLICT, message: 'Korisnik sa ovim email-om već postoji.' },
  [ApiErrorCode.UserRoleNotAssignable]: {
    status: HttpStatus.FORBIDDEN,
    message: 'Nemate pravo da dodelite ove uloge.',
  },
  [ApiErrorCode.UserMarketsRequired]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Za izabrane uloge potrebno je izabrati bar jedno tržište.',
  },
  [ApiErrorCode.MarketNotAllowed]: { status: HttpStatus.FORBIDDEN, message: 'Nemate pristup ovom tržištu.' },
  [ApiErrorCode.RequestQuotaExceeded]: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Iskoristili ste besplatne provere za ovaj mesec.',
  },
  [ApiErrorCode.UnitNotAvailable]: { status: HttpStatus.CONFLICT, message: 'Stan trenutno nije dostupan.' },
  [ApiErrorCode.DeveloperDuplicate]: {
    status: HttpStatus.CONFLICT,
    message: 'Investitor sa ovim matičnim (HE) brojem već postoji na ovom tržištu.',
  },
  [ApiErrorCode.UnitLabelTaken]: { status: HttpStatus.CONFLICT, message: 'Stan sa ovom oznakom već postoji u projektu.' },
  [ApiErrorCode.BankAccountSameVerifier]: {
    status: HttpStatus.CONFLICT,
    message: 'Račun mora da proveri druga osoba, ne ona koja ga je unela (princip četiri oka).',
  },
  [ApiErrorCode.LegalTeamMemberInvalid]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Član tima mora biti aktivan advokat na tržištu tima.',
  },
  [ApiErrorCode.CannotChangeOwnAccess]: {
    status: HttpStatus.FORBIDDEN,
    message: 'Ne možete menjati sopstvene uloge, tržišta ni status naloga.',
  },
  [ApiErrorCode.InvalidStateTransition]: {
    status: HttpStatus.CONFLICT,
    message: 'Ova radnja nije moguća u trenutnom stanju.',
  },
  [ApiErrorCode.PurchaseStepNotReady]: {
    status: HttpStatus.CONFLICT,
    message: 'Ovaj korak ne može da se završi dok prethodni koraci nisu završeni.',
  },
  [ApiErrorCode.PurchaseHardBlocked]: {
    status: HttpStatus.CONFLICT,
    message: 'Kupovina nije moguća zbog utvrđenog rizika. Koordinator će vam objasniti razlog.',
  },
  [ApiErrorCode.LegalTeamNotAvailable]: {
    status: HttpStatus.CONFLICT,
    message: 'Trenutno nema dostupnog pravnog tima za ovu kupovinu.',
  },
  [ApiErrorCode.PowerOfAttorneyRequired]: {
    status: HttpStatus.CONFLICT,
    message: 'Za ovaj posao potrebno je važeće punomoćje.',
  },
  [ApiErrorCode.LegalOpinionRequired]: {
    status: HttpStatus.CONFLICT,
    message: 'Pre potpisa ugovora potrebno je pravno mišljenje advokata.',
  },
  [ApiErrorCode.DocumentInvalidFile]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Dozvoljeni su samo PDF, JPG i PNG fajlovi do 20 MB.',
  },
  [ApiErrorCode.DocumentTypeNotAllowed]: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Ova vrsta dokumenta ne postoji na ovom tržištu.',
  },
  [ApiErrorCode.PaymentConditionsNotMet]: {
    status: HttpStatus.CONFLICT,
    message: 'Uplata je zaključana dok nisu ispunjeni svi uslovi.',
  },
  [ApiErrorCode.BankAccountNotVerified]: {
    status: HttpStatus.CONFLICT,
    message: 'Račun primaoca još nije proveren.',
  },
  [ApiErrorCode.EscrowNotUsed]: { status: HttpStatus.CONFLICT, message: 'Na ovom tržištu se ne koristi escrow.' },
  [ApiErrorCode.EscrowSameApprover]: {
    status: HttpStatus.CONFLICT,
    message: 'Instrukciju mora da odobri druga osoba (princip četiri oka).',
  },
};
