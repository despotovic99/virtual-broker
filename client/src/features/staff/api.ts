import { api, download, query, upload, type Page, type PageParams } from '../../core/api/http.ts'
import type { MarketCode, Role } from '../../core/auth/capabilities.ts'
import type {
  AdminUser,
  AnswerScope,
  AuditEvent,
  BankAccount,
  BuyerRequest,
  CheckHistoryItem,
  Construction,
  Developer,
  DocumentItem,
  EngineerReport,
  EscrowInstruction,
  LegalTeam,
  LegalTeamRole,
  Project,
  ProjectDetail,
  ProjectSemaphore,
  ProjectStatus,
  ReportVerdict,
  RequestStatus,
  SemaphoreResult,
  Unit,
  UnitStatus,
  UserList,
} from './types.ts'

/** Pozivi back-office API-ja (sve pod /api). */
export const staffApi = {
  // Zahtevi (F-35)
  queue: (params: { status?: RequestStatus | ''; market?: MarketCode | '' } & PageParams) =>
    api<Page<BuyerRequest>>(`/requests/queue${query({ ...params })}`),
  legalQueue: (page: PageParams) => api<Page<BuyerRequest>>(`/requests/legal-queue${query({ ...page })}`),
  request: (id: string) => api<BuyerRequest>(`/requests/${id}`),
  takeRequest: (id: string) => api<BuyerRequest>(`/requests/${id}/take`, { method: 'POST' }),
  linkRequest: (id: string, body: { developerId?: string; projectId?: string; unitId?: string }) =>
    api<BuyerRequest>(`/requests/${id}/link`, { method: 'PATCH', body }),
  forwardRequest: (id: string, legalTeamId: string) =>
    api<BuyerRequest>(`/requests/${id}/forward`, { method: 'POST', body: { legalTeamId } }),
  answerRequest: (id: string, answer: string) => api<BuyerRequest>(`/requests/${id}/answer`, { method: 'POST', body: { answer } }),
  legalAnswerRequest: (id: string, answer: string, answerScope: AnswerScope) =>
    api<BuyerRequest>(`/requests/${id}/legal-answer`, { method: 'POST', body: { answer, answerScope } }),
  closeRequest: (id: string) => api<BuyerRequest>(`/requests/${id}/close`, { method: 'POST' }),

  // Katalog (F-04, F-32)
  developers: (params: { market?: MarketCode | ''; search?: string } & PageParams) =>
    api<Page<Developer>>(`/catalog/developers${query({ ...params })}`),
  createDeveloper: (body: {
    market: MarketCode
    name: string
    registrationNumber: string
    taxNumber?: string
    address?: string
    website?: string
  }) => api<Developer>('/catalog/developers', { method: 'POST', body }),
  updateDeveloper: (id: string, body: { name?: string; taxNumber?: string; address?: string; website?: string }) =>
    api<Developer>(`/catalog/developers/${id}`, { method: 'PATCH', body }),
  bankAccounts: (developerId: string) => api<BankAccount[]>(`/catalog/developers/${developerId}/bank-accounts`),
  addBankAccount: (developerId: string, body: { iban: string; bankName: string; holderName: string }) =>
    api<BankAccount>(`/catalog/developers/${developerId}/bank-accounts`, { method: 'POST', body }),
  verifyBankAccount: (id: string, note: string) =>
    api<BankAccount>(`/catalog/bank-accounts/${id}/verify`, { method: 'POST', body: { note } }),
  projects: (params: { market?: MarketCode | ''; city?: string; developerId?: string; limit?: number; offset?: number }) =>
    api<Page<Project>>(`/catalog/projects${query(params)}`),
  project: (id: string) => api<ProjectDetail>(`/catalog/projects/${id}`),
  createProject: (body: {
    developerId: string
    name: string
    city: string
    address: string
    parcelReference?: string
    description?: string
    expectedCompletion?: string
  }) => api<Project>('/catalog/projects', { method: 'POST', body }),
  updateProject: (
    id: string,
    body: {
      name?: string
      city?: string
      address?: string
      parcelReference?: string
      description?: string
      expectedCompletion?: string
      status?: ProjectStatus
    },
  ) => api<Project>(`/catalog/projects/${id}`, { method: 'PATCH', body }),
  createUnit: (projectId: string, body: { label: string; floor?: number; rooms?: number; area: number; price: number }) =>
    api<Unit>(`/catalog/projects/${projectId}/units`, { method: 'POST', body }),
  updateUnit: (
    id: string,
    body: { label?: string; floor?: number; rooms?: number; area?: number; price?: number; status?: UnitStatus },
  ) => api<Unit>(`/catalog/units/${id}`, { method: 'PATCH', body }),

  // Provere i semafor (F-05 – F-08)
  runChecks: (target: { developerId?: string; projectId?: string }) =>
    api<SemaphoreResult>('/checks/run', { method: 'POST', body: target }),
  recordCheck: (body: {
    developerId?: string
    projectId?: string
    definitionCode: string
    status: string
    summary: string
    documentId?: string
  }) => api<CheckHistoryItem>('/checks', { method: 'POST', body }),
  checkHistory: (target: { developerId?: string; projectId?: string }, page: PageParams) =>
    api<Page<CheckHistoryItem>>(`/checks/history${query({ ...target, ...page })}`),
  developerSemaphore: (id: string) => api<SemaphoreResult>(`/checks/developers/${id}/semaphore`),
  projectSemaphore: (id: string) => api<ProjectSemaphore>(`/checks/projects/${id}/semaphore`),

  // Dokumenta (F-02)
  documents: (owner: { projectId?: string; developerId?: string; reportId?: string }, page: PageParams) =>
    api<Page<DocumentItem>>(`/documents${query({ ...owner, ...page })}`),
  uploadDocument: (
    owner: { scope: 'PROJECT'; projectId: string } | { scope: 'DEVELOPER'; developerId: string },
    typeCode: string,
    file: File,
  ) => {
    const form = new FormData()
    form.set('scope', owner.scope)
    if (owner.scope === 'PROJECT') form.set('projectId', owner.projectId)
    else form.set('developerId', owner.developerId)
    form.set('typeCode', typeCode)
    form.set('file', file)
    return upload<DocumentItem>('/documents', form)
  },
  downloadDocument: (document: DocumentItem) => download(`/documents/${document.id}/content`, document.fileName),

  // Gradnja (F-17, F-18)
  construction: (projectId: string) => api<Construction>(`/projects/${projectId}/construction`),
  updatePlan: (projectId: string, phases: { phaseCode: string; plannedDate: string | null }[]) =>
    api<Construction>(`/projects/${projectId}/construction/plan`, { method: 'PUT', body: { phases } }),
  reports: (projectId: string, page: PageParams) => api<Page<EngineerReport>>(`/projects/${projectId}/reports${query({ ...page })}`),
  /** Izveštaj sa prilozima u jednom zahtevu (izveštaj i fajlovi nastaju zajedno ili nijedno). */
  createReport: (projectId: string, body: { phaseCode?: string; visitDate: string; summary: string; verdict: ReportVerdict }, files: File[] = []) => {
    const form = new FormData()
    if (body.phaseCode) form.set('phaseCode', body.phaseCode)
    form.set('visitDate', body.visitDate)
    form.set('summary', body.summary)
    form.set('verdict', body.verdict)
    for (const file of files) form.append('files', file)
    return upload<EngineerReport>(`/projects/${projectId}/reports`, form)
  },
  addReportFile: (reportId: string, file: File) => {
    const form = new FormData()
    form.set('file', file)
    return upload<DocumentItem>(`/reports/${reportId}/files`, form)
  },

  // Escrow (F-15)
  escrowInstructions: (page: PageParams) => api<Page<EscrowInstruction>>(`/escrow/instructions${query({ ...page })}`),
  approveInstruction: (id: string) => api<EscrowInstruction>(`/escrow/instructions/${id}/approve`, { method: 'POST' }),
  executeInstruction: (id: string) => api<EscrowInstruction>(`/escrow/instructions/${id}/execute`, { method: 'POST' }),
  returnInstruction: (id: string, reason: string) =>
    api<EscrowInstruction>(`/escrow/instructions/${id}/return`, { method: 'POST', body: { reason } }),

  // Administracija
  users: (params: { role?: Role | ''; market?: MarketCode | ''; search?: string; limit?: number; offset?: number }) =>
    api<UserList>(`/users${query(params)}`),
  user: (id: string) => api<AdminUser>(`/users/${id}`),
  createUser: (body: {
    email: string
    password: string
    firstName: string
    lastName: string
    roles: Role[]
    markets: MarketCode[]
  }) => api<AdminUser>('/users', { method: 'POST', body }),
  updateUser: (
    id: string,
    body: { firstName?: string; lastName?: string; roles?: Role[]; markets?: MarketCode[]; isActive?: boolean },
  ) => api<AdminUser>(`/users/${id}`, { method: 'PATCH', body }),
  legalTeams: () => api<LegalTeam[]>('/legal-teams'),
  availableTeams: (market: MarketCode, developerId?: string | null) =>
    api<{ id: string; name: string; languages: string[] }[]>(`/legal-teams/available${query({ market, developerId })}`),
  developer: (id: string) => api<Developer>(`/catalog/developers/${id}`),
  createLegalTeam: (body: { market: MarketCode; name: string; languages: string[]; conflictDeveloperIds: string[] }) =>
    api<LegalTeam>('/legal-teams', { method: 'POST', body }),
  updateLegalTeam: (id: string, body: { name?: string; languages?: string[]; conflictDeveloperIds?: string[]; active?: boolean }) =>
    api<LegalTeam>(`/legal-teams/${id}`, { method: 'PATCH', body }),
  upsertMember: (
    teamId: string,
    userId: string,
    body: { teamRole: LegalTeamRole; licenseNumber?: string; licenseVerified?: boolean },
  ) => api<LegalTeam>(`/legal-teams/${teamId}/members/${userId}`, { method: 'PUT', body }),
  removeMember: (teamId: string, userId: string) =>
    api<LegalTeam>(`/legal-teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  audit: (params: { entityType?: string; entityId?: string } & PageParams) => api<Page<AuditEvent>>(`/audit${query({ ...params })}`),
}
