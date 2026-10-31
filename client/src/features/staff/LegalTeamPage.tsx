import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../core/api/http.ts'
import { useAuth } from '../../core/auth/AuthContext.tsx'
import { useI18n } from '../../core/i18n/I18nContext.tsx'
import { AuditTrail } from '../../ui/AuditTrail.tsx'
import { Button, Card, ErrorBox, ErrorState, Field, FormSection, Loading, Page, StatusBadge, Tag } from '../../ui/components.tsx'
import { DataTable, type Column } from '../../ui/DataTable.tsx'
import { Icon } from '../../ui/icons.tsx'
import { ConfirmDialog, FormModal } from '../../ui/Modal.tsx'
import { useAsync } from '../../ui/useAsync.ts'
import { useClientPagination } from '../../ui/usePagination.ts'
import { staffApi } from './api.ts'
import { TeamLanguages } from './LegalTeamsPage.tsx'
import { ActiveBadge, PICK_PAGE, useStaffT } from './shared.tsx'
import type { LegalTeam, LegalTeamMember, LegalTeamRole } from './types.ts'

const TEAM_ROLES: LegalTeamRole[] = ['LEAD', 'LAWYER', 'ASSOCIATE']

type Dialog = { kind: 'role' | 'license' | 'remove'; member: LegalTeamMember } | { kind: 'add' } | null

/**
 * Detalj pravnog tima (`/admin/legal-teams/:id`): podaci i članovi. Server
 * nema GET /legal-teams/:id, pa se tim uzima iz spiska timova.
 */
export function LegalTeamPage() {
  const { id = '' } = useParams()
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const { can } = useAuth()
  const teams = useAsync(() => staffApi.legalTeams(), [])
  const team = teams.data?.find((item) => item.id === id)

  if (teams.loading && !teams.data) return <Loading />
  if (!team)
    return (
      <ErrorState
        error={teams.error ?? new ApiError(404, 'NOT_FOUND', st('teams.notFound'))}
        onRetry={teams.reload}
        backTo={{ to: '/admin/legal-teams', label: st('teams.title') }}
      />
    )

  return (
    <Page
      title={team.name}
      crumbs={[{ label: st('teams.title'), to: '/admin/legal-teams' }, { label: team.name }]}
      meta={
        <>
          <ActiveBadge active={team.active} />
          <Tag>{t(`market.${team.market}`)}</Tag>
        </>
      }
      actions={
        <>
          <Link className="btn" to="/admin/legal-teams">
            {t('common.back')}
          </Link>
          <Link className="btn btn--primary" to={`/admin/legal-teams/${team.id}/edit`}>
            <Icon name="edit" size={15} />
            {t('common.edit')}
          </Link>
        </>
      }
    >
      <div className="layout-aside">
        <div className="layout-aside__main">
          <Card title={t('common.details')}>
            <dl className="dl">
              <dt>{t('common.market')}</dt>
              <dd>{t(`market.${team.market}`)}</dd>
              <dt>{st('teams.languagesShort')}</dt>
              <dd>
                <TeamLanguages languages={team.languages} />
              </dd>
              <dt>{st('teams.conflicts')}</dt>
              <dd className="num">{team.conflictDeveloperIds.length}</dd>
              <dt>{st('created')}</dt>
              <dd className="mono">{formatDate(team.createdAt)}</dd>
            </dl>
          </Card>
          <Members team={team} onChanged={teams.reload} />
        </div>
        {can('audit:read') && (
          <aside className="layout-aside__side">
            <AuditTrail entityId={team.id} />
          </aside>
        )}
      </div>
    </Page>
  )
}

function Members({ team, onChanged }: { team: LegalTeam; onChanged: () => void }) {
  const st = useStaffT()
  const { t, formatDate } = useI18n()
  const { rows, pagination } = useClientPagination(team.members)
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const member = dialog && dialog.kind !== 'add' ? dialog.member : null

  const columns: Column<LegalTeamMember>[] = [
    {
      key: 'lawyer',
      header: st('teams.lawyer'),
      cell: (item) => (
        <span className="cell-title">
          <strong>
            {item.firstName} {item.lastName}
          </strong>
          <span className="meta">{item.email}</span>
        </span>
      ),
    },
    { key: 'role', header: st('teams.teamRole'), cell: (item) => st(`teamRole.${item.teamRole}`) },
    { key: 'license', header: st('teams.license'), mono: true, cell: (item) => item.licenseNumber ?? '—' },
    {
      key: 'verified',
      header: st('teams.licenseStatus'),
      cell: (item) =>
        item.licenseVerifiedAt ? (
          <span className="cell-title">
            <StatusBadge text={st('teams.licenseVerified')} tone="ok" icon="check" />
            <span className="meta">{formatDate(item.licenseVerifiedAt)}</span>
          </span>
        ) : (
          <StatusBadge text={st('teams.licenseNotVerified')} tone="warn" icon="clock" />
        ),
    },
  ]

  return (
    <>
      <DataTable
        title={st('teams.members')}
        caption={st('teams.members')}
        columns={columns}
        rows={rows}
        rowKey={(item) => item.userId}
        pagination={pagination}
        empty={st('teams.noMembers')}
        actions={
          <Button size="sm" variant="primary" icon="plus" onClick={() => setDialog({ kind: 'add' })}>
            {st('teams.addMember')}
          </Button>
        }
        rowActions={(item) => (
          <span className="row-actions">
            <Button size="sm" variant="quiet" icon="edit" onClick={() => setDialog({ kind: 'role', member: item })}>
              {st('teams.changeRole')}
            </Button>
            {!item.licenseVerifiedAt && (
              <Button size="sm" onClick={() => setDialog({ kind: 'license', member: item })}>
                {st('teams.verifyLicense')}
              </Button>
            )}
            <Button size="sm" variant="danger" icon="trash" onClick={() => setDialog({ kind: 'remove', member: item })}>
              {t('common.remove')}
            </Button>
          </span>
        )}
      />

      <AddMemberModal open={dialog?.kind === 'add'} onClose={close} team={team} onAdded={onChanged} />
      <RoleModal open={dialog?.kind === 'role'} onClose={close} teamId={team.id} member={member} onSaved={onChanged} />
      <ConfirmDialog
        open={dialog?.kind === 'license'}
        onClose={close}
        title={st('teams.verifyLicense')}
        text={
          member ? (
            <>
              {st('teams.verifyLicenseConfirm', { name: `${member.firstName} ${member.lastName}`, license: member.licenseNumber ?? '—' })}{' '}
              {st('form.member.verifyNote')}
            </>
          ) : undefined
        }
        confirmLabel={st('teams.verifyLicense')}
        onConfirm={async () => {
          if (!member) return
          await staffApi.upsertMember(team.id, member.userId, {
            teamRole: member.teamRole,
            licenseNumber: member.licenseNumber ?? undefined,
            licenseVerified: true,
          })
          onChanged()
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        onClose={close}
        danger
        title={st('teams.removeMember')}
        text={member ? st('teams.removeConfirm', { name: `${member.firstName} ${member.lastName}`, team: team.name }) : undefined}
        confirmLabel={t('common.remove')}
        onConfirm={async () => {
          if (!member) return
          await staffApi.removeMember(team.id, member.userId)
          onChanged()
        }}
      />
    </>
  )
}

/** Promena uloge člana u timu; broj licence ostaje isti. */
function RoleModal({
  open,
  onClose,
  teamId,
  member,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  teamId: string
  member: LegalTeamMember | null
  onSaved: () => void
}) {
  const st = useStaffT()
  const [teamRole, setTeamRole] = useState<LegalTeamRole>('LAWYER')
  const currentRole = member?.teamRole

  useEffect(() => {
    if (open && currentRole) setTeamRole(currentRole)
  }, [open, currentRole])

  return (
    <FormModal
      open={open}
      onClose={onClose}
      size="sm"
      title={st('teams.changeRole')}
      description={member ? st('form.member.roleDescription', { name: `${member.firstName} ${member.lastName}` }) : undefined}
      disabledReason={teamRole === currentRole ? st('teams.roleUnchanged') : null}
      onSubmit={async () => {
        if (!member) return
        await staffApi.upsertMember(teamId, member.userId, { teamRole, licenseNumber: member.licenseNumber ?? undefined })
        onSaved()
      }}
    >
      <Field label={st('teams.teamRole')} required info={st('form.member.roleInfo')}>
        <select value={teamRole} onChange={(event) => setTeamRole(event.target.value as LegalTeamRole)}>
          {TEAM_ROLES.map((role) => (
            <option key={role} value={role}>
              {st(`teamRole.${role}`)}
            </option>
          ))}
        </select>
      </Field>
    </FormModal>
  )
}

/** Dodavanje člana: advokat (aktivan, uloga LAWYER) na tržištu tima. */
function AddMemberModal({ open, onClose, team, onAdded }: { open: boolean; onClose: () => void; team: LegalTeam; onAdded: () => void }) {
  const st = useStaffT()
  const { t } = useI18n()
  const lawyers = useAsync(
    () => (open ? staffApi.users({ role: 'LAWYER', market: team.market, ...PICK_PAGE }) : Promise.resolve(null)),
    [open, team.market],
  )
  const [userId, setUserId] = useState('')
  const [teamRole, setTeamRole] = useState<LegalTeamRole>('LAWYER')
  const [licenseNumber, setLicenseNumber] = useState('')
  const memberIds = new Set(team.members.map((item) => item.userId))
  const candidates = (lawyers.data?.items ?? []).filter((user) => user.isActive && !memberIds.has(user.id))

  useEffect(() => {
    if (!open) return
    setUserId('')
    setTeamRole('LAWYER')
    setLicenseNumber('')
  }, [open])

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={st('teams.addMember')}
      description={`${team.name} · ${st('form.member.description')}`}
      size="lg"
      submitLabel={st('teams.addMember')}
      dirty={Boolean(userId || licenseNumber)}
      disabledReason={userId ? null : st('requiredFields')}
      onSubmit={async () => {
        await staffApi.upsertMember(team.id, userId, { teamRole, licenseNumber: licenseNumber.trim() || undefined })
        onAdded()
      }}
    >
      <FormSection title={st('form.member.section')} columns={2}>
        <Field label={st('teams.lawyer')} required info={st('form.member.lawyerInfo')} wide>
          <select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">—</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} · {user.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label={st('teams.teamRole')} required info={st('form.member.roleInfo')}>
          <select value={teamRole} onChange={(event) => setTeamRole(event.target.value as LegalTeamRole)}>
            {TEAM_ROLES.map((role) => (
              <option key={role} value={role}>
                {st(`teamRole.${role}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={st('teams.license')} info={st('form.member.licenseInfo')} hint={t('common.optional')}>
          <input className="mono" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} maxLength={64} autoComplete="off" />
        </Field>
      </FormSection>
      <ErrorBox error={lawyers.error} onRetry={lawyers.reload} />
    </FormModal>
  )
}
