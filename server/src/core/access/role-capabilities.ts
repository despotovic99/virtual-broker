import { Capability as C } from './capability.enum.js';
import { ASSIGNABLE_ROLES, Role, type AssignableRole } from './role.enum.js';

/**
 * Jedino mesto gde se vezuje uloga za capability. Korisnik sa više uloga
 * ima uniju capability svih svojih uloga.
 *
 * Razdvajanje dužnosti: SUPER_ADMIN samo administrira sistem i ne odlučuje
 * o predmetima (ne potvrđuje uslove, faze ni isplate).
 */
export const ROLE_CAPABILITIES: Readonly<Record<Role, readonly C[]>> = {
  [Role.SuperAdmin]: [C.UsersRead, C.UsersCreate, C.UsersUpdate, C.LegalTeamsManage, C.AuditRead, C.CatalogRead],

  [Role.Admin]: [
    C.UsersRead,
    C.UsersCreate,
    C.UsersUpdate,
    C.LegalTeamsManage,
    C.AuditRead,
    C.CatalogRead,
    C.ChecksRead,
    C.PurchasesRead,
    C.PaymentsRead,
    C.EscrowInstructionsApprove,
    C.ConstructionRead,
  ],

  [Role.Analyst]: [
    C.CatalogRead,
    C.CatalogManage,
    C.BankAccountsVerify,
    C.ChecksRead,
    C.ChecksManage,
    C.RequestsTriage,
    C.PurchasesRead,
    C.PaymentsRead,
    C.PaymentConditionsConfirm,
    C.ConstructionRead,
    C.DocumentsUpload,
    C.MessagesWrite,
  ],

  [Role.Coordinator]: [
    C.CatalogRead,
    C.ChecksRead,
    C.RequestsTriage,
    C.PurchasesRead,
    C.PurchasesManage,
    C.PurchasesAssignLawyer,
    C.PurchaseStepsComplete,
    C.MessagesWrite,
    C.DocumentsUpload,
    C.PaymentsRead,
    C.PaymentsPlan,
    C.PaymentsRecord,
    C.ConstructionRead,
    C.DefectsManage,
    C.CostsCalculate,
  ],

  [Role.Lawyer]: [
    C.CatalogRead,
    C.ChecksRead,
    C.ChecksManage,
    C.RequestsAnswerLegal,
    C.PurchasesRead,
    C.PurchaseStepsComplete,
    C.TasksWork,
    C.MessagesWrite,
    C.DocumentsUpload,
    C.PowerOfAttorneyManage,
    C.LegalOpinionsSign,
    C.PaymentsRead,
    C.PaymentConditionsConfirm,
    C.ConstructionRead,
    C.CostsCalculate,
  ],

  [Role.Engineer]: [
    C.CatalogRead,
    C.PurchasesRead,
    C.TasksWork,
    C.DocumentsUpload,
    C.PaymentConditionsConfirm,
    C.ConstructionRead,
    C.ConstructionReport,
    C.HandoverManage,
    C.DefectsManage,
  ],

  [Role.EscrowAgent]: [C.PurchasesRead, C.PaymentsRead, C.EscrowExecute],

  [Role.Buyer]: [
    C.CatalogRead,
    C.ChecksRead,
    C.RequestsCreate,
    C.BuyerProfileManage,
    C.CostsCalculate,
    C.PurchasesRead,
    C.MessagesWrite,
    C.DocumentsUpload,
    C.PowerOfAttorneyManage,
    C.PaymentsRead,
    C.PaymentsRecord,
    C.ConstructionRead,
    C.DefectsManage,
  ],

  // Faza 2 (portal investitora). U MVP-u investitor nema ekrane.
  [Role.Investor]: [],
};

/**
 * Koje uloge korisnik sa datom ulogom sme da dodeli drugom korisniku.
 * SUPER_ADMIN nije u tipu AssignableRole, pa ga nijedna uloga ne može dodeliti.
 */
export const ROLE_CAN_ASSIGN: Readonly<Record<Role, readonly AssignableRole[]>> = {
  [Role.SuperAdmin]: ASSIGNABLE_ROLES,
  [Role.Admin]: [Role.Analyst, Role.Coordinator, Role.Lawyer, Role.Engineer, Role.EscrowAgent, Role.Buyer],
  [Role.Analyst]: [],
  [Role.Coordinator]: [],
  [Role.Lawyer]: [],
  [Role.Engineer]: [],
  [Role.EscrowAgent]: [],
  [Role.Buyer]: [],
  [Role.Investor]: [],
};

export function capabilitiesFor(roles: readonly Role[]): C[] {
  const result = new Set<C>();
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role]) result.add(capability);
  }
  return [...result].sort();
}

/** Da li korisnik sa `actorRoles` sme da dodeli sve uloge iz `requested`. */
export function canAssignRoles(actorRoles: readonly Role[], requested: readonly Role[]): boolean {
  const allowed = new Set<Role>(actorRoles.flatMap((role) => ROLE_CAN_ASSIGN[role]));
  return requested.length > 0 && requested.every((role) => role !== Role.SuperAdmin && allowed.has(role));
}
