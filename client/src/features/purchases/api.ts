import { api, query, upload } from '../../core/api/http.ts'
import type {
  Defect,
  DocumentItem,
  EngineerReport,
  Handover,
  Installment,
  LegalOpinion,
  MyLegalTeam,
  OpinionConclusion,
  PaymentPlan,
  PoaScope,
  PowerOfAttorney,
  PurchaseDetail,
  PurchaseList,
  PurchaseMessage,
  PurchaseStatus,
  PurchaseTask,
  StaffMember,
  TaskStatus,
  ConstructionPhase,
  DefectSeverity,
} from './types.ts'

export interface AssignmentsInput {
  legalTeamId?: string | null
  lawyerId?: string | null
  engineerId?: string | null
  escrowAgentId?: string | null
  coordinatorId?: string | null
}

export interface InstallmentInput {
  label: string
  amount: number
  phaseCode?: string
  dueDate?: string
}

export const purchasesApi = {
  list: (params: { status?: PurchaseStatus | ''; limit?: number; offset?: number }) =>
    api<PurchaseList>(`/purchases${query(params)}`),
  detail: (id: string) => api<PurchaseDetail>(`/purchases/${id}`),
  create: (body: { requestId?: string; buyerId?: string; unitId: string }) =>
    api<PurchaseDetail>('/purchases', { method: 'POST', body }),
  assign: (id: string, body: AssignmentsInput) => api<PurchaseDetail>(`/purchases/${id}/assignments`, { method: 'PATCH', body }),
  completeStep: (id: string, code: string, note?: string) =>
    api<PurchaseDetail>(`/purchases/${id}/steps/${encodeURIComponent(code)}/complete`, { method: 'POST', body: note ? { note } : {} }),
  skipStep: (id: string, code: string, reason: string) =>
    api<PurchaseDetail>(`/purchases/${id}/steps/${encodeURIComponent(code)}/skip`, { method: 'POST', body: { reason } }),
  block: (id: string, reason: string) => api<PurchaseDetail>(`/purchases/${id}/block`, { method: 'POST', body: { reason } }),
  unblock: (id: string) => api<PurchaseDetail>(`/purchases/${id}/unblock`, { method: 'POST' }),
  cancel: (id: string) => api<PurchaseDetail>(`/purchases/${id}/cancel`, { method: 'POST' }),

  tasks: (id: string) => api<PurchaseTask[]>(`/purchases/${id}/tasks`),
  createTask: (id: string, body: { type: string; title: string; assigneeUserId: string; dueAt?: string }) =>
    api<PurchaseTask>(`/purchases/${id}/tasks`, { method: 'POST', body }),
  myTasks: () => api<PurchaseTask[]>('/tasks/mine'),
  updateTask: (taskId: string, body: { status: TaskStatus; waitingReason?: string; result?: string; documentId?: string }) =>
    api<PurchaseTask>(`/tasks/${taskId}`, { method: 'PATCH', body }),

  messages: (id: string) => api<PurchaseMessage[]>(`/purchases/${id}/messages`),
  sendMessage: (id: string, body: { body: string; internal?: boolean }) =>
    api<PurchaseMessage>(`/purchases/${id}/messages`, { method: 'POST', body }),

  documents: (purchaseId: string) => api<DocumentItem[]>(`/documents${query({ purchaseId })}`),
  reportDocuments: (projectId: string, reportId: string) => api<DocumentItem[]>(`/documents${query({ projectId, reportId })}`),
  uploadDocument: (purchaseId: string, typeCode: string, file: File) => {
    const form = new FormData()
    form.append('scope', 'PURCHASE')
    form.append('purchaseId', purchaseId)
    form.append('typeCode', typeCode)
    form.append('file', file)
    return upload<DocumentItem>('/documents', form)
  },

  powersOfAttorney: (id: string) => api<PowerOfAttorney[]>(`/purchases/${id}/powers-of-attorney`),
  createPowerOfAttorney: (id: string, body: { documentId: string; scope: PoaScope[]; validUntil?: string }) =>
    api<PowerOfAttorney>(`/purchases/${id}/powers-of-attorney`, { method: 'POST', body }),
  revokePowerOfAttorney: (poaId: string) => api<void>(`/powers-of-attorney/${poaId}/revoke`, { method: 'POST' }),
  opinions: (id: string) => api<LegalOpinion[]>(`/purchases/${id}/legal-opinions`),
  createOpinion: (id: string, body: { conclusion: OpinionConclusion; reasoning: string; conditions?: string; documentId: string }) =>
    api<LegalOpinion>(`/purchases/${id}/legal-opinions`, { method: 'POST', body }),
  myLegalTeams: () => api<MyLegalTeam[]>('/legal-teams/mine'),

  plan: (id: string) => api<PaymentPlan>(`/purchases/${id}/installments`),
  replacePlan: (id: string, installments: InstallmentInput[]) =>
    api<PaymentPlan>(`/purchases/${id}/installments`, { method: 'PUT', body: { installments } }),
  confirmCondition: (installmentId: string, code: string, body: { evidenceDocumentId?: string; note?: string }) =>
    api<Installment>(`/installments/${installmentId}/conditions/${encodeURIComponent(code)}/confirm`, { method: 'POST', body }),
  recordPayment: (installmentId: string, proofDocumentId?: string) =>
    api<Installment>(`/installments/${installmentId}/paid`, { method: 'POST', body: proofDocumentId ? { proofDocumentId } : {} }),

  construction: (projectId: string) => api<{ projectId: string; phases: ConstructionPhase[] }>(`/projects/${projectId}/construction`),
  reports: (projectId: string) => api<EngineerReport[]>(`/projects/${projectId}/reports`),

  handover: (id: string) => api<{ handover: Handover | null; defects: Defect[] }>(`/purchases/${id}/handover`),
  recordHandover: (id: string, body: { inspectedAt: string; contractArea: number; measuredArea: number; notes?: string }) =>
    api<Handover>(`/purchases/${id}/handover`, { method: 'POST', body }),
  handOverKeys: (id: string) => api<Handover>(`/purchases/${id}/handover/keys`, { method: 'PATCH' }),
  createDefect: (id: string, body: { description: string; severity: DefectSeverity; dueDate?: string }) =>
    api<Defect>(`/purchases/${id}/defects`, { method: 'POST', body }),
  updateDefect: (defectId: string, status: 'FIXED' | 'CONFIRMED') =>
    api<Defect>(`/defects/${defectId}`, { method: 'PATCH', body: { status } }),

  availableTeams: (market: string, developerId: string) =>
    api<AvailableTeam[]>(`/legal-teams/available${query({ market, developerId })}`),

  staff: (role: 'COORDINATOR' | 'ENGINEER' | 'ESCROW_AGENT' | 'LAWYER', market: string) =>
    api<StaffMember[]>(`/users/staff${query({ role, market })}`),
}

/** Pravni tim bez sukoba interesa sa investitorom, za dodelu na kupovini. */
export interface AvailableTeam {
  id: string
  name: string
  languages: string[]
  lawyers: { userId: string; firstName: string; lastName: string; teamRole: 'LEAD' | 'LAWYER' | 'ASSOCIATE' }[]
}
