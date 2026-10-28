/**
 * Šta neko sme da radi u sistemu. Svaki endpoint koji nije javan traži
 * jednu ili više capability (`@RequireCapabilities`), a koja uloga ima koju
 * capability piše u `role-capabilities.ts`.
 *
 * Capability kaže DA LI neko sme da radi nešto. KOJE podatke sme da vidi
 * (svoje kupovine, tržište, dodeljeni predmeti) proverava servis.
 *
 * Nova capability: dodati vrednost ovde (format `oblast:radnja`), dodeliti je
 * ulogama u `role-capabilities.ts` i istu vrednost dodati u
 * `client/src/core/auth/capabilities.ts`.
 */
export enum Capability {
  // Administracija
  UsersRead = 'users:read',
  UsersCreate = 'users:create',
  UsersUpdate = 'users:update',
  LegalTeamsManage = 'legal-teams:manage',
  AuditRead = 'audit:read',

  // Katalog: investitori, projekti, stanovi (unosi naš tim; F-32, F-04)
  CatalogRead = 'catalog:read',
  CatalogManage = 'catalog:manage',
  BankAccountsVerify = 'bank-accounts:verify',

  // Provere i semafor (F-05 – F-08)
  ChecksRead = 'checks:read',
  ChecksManage = 'checks:manage',

  // Zahtevi kupca (F-35)
  RequestsCreate = 'requests:create',
  RequestsTriage = 'requests:triage',
  RequestsAnswerLegal = 'requests:answer-legal',

  // Profil kupca, troškovi i pravne provere (F-03, F-09 – F-11)
  BuyerProfileManage = 'buyer-profile:manage',
  CostsCalculate = 'costs:calculate',

  // Kupovine (F-01, F-13, F-24)
  PurchasesRead = 'purchases:read',
  PurchasesManage = 'purchases:manage',
  PurchasesAssignLawyer = 'purchases:assign-lawyer',
  PurchaseStepsComplete = 'purchase-steps:complete',
  TasksWork = 'tasks:work',
  MessagesWrite = 'messages:write',
  DocumentsUpload = 'documents:upload',
  PowerOfAttorneyManage = 'power-of-attorney:manage',
  LegalOpinionsSign = 'legal-opinions:sign',

  // Novac (F-14 – F-16)
  PaymentsRead = 'payments:read',
  PaymentsPlan = 'payments:plan',
  PaymentConditionsConfirm = 'payment-conditions:confirm',
  PaymentsRecord = 'payments:record',
  EscrowInstructionsApprove = 'escrow-instructions:approve',
  EscrowExecute = 'escrow:execute',

  // Gradnja, primopredaja, upis (F-17 – F-22)
  ConstructionRead = 'construction:read',
  ConstructionReport = 'construction:report',
  HandoverManage = 'handover:manage',
  DefectsManage = 'defects:manage',
}

export const ALL_CAPABILITIES: readonly Capability[] = Object.values(Capability);
