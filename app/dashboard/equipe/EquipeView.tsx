'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createTeamMemberAction,
  resetTeamMemberPasswordAction,
  updateTeamMemberAction,
} from '@/lib/team-access-actions'

const AREAS = [
  ['gestao_operacional', 'Gestão Operacional'],
  ['gestao_administrativa', 'Gestão Administrativa'],
  ['captacao', 'Captação'],
  ['edicao', 'Edição'],
  ['operacoes', 'Operações'],
  ['planejamento', 'Planejamento'],
  ['design', 'Design'],
  ['performance', 'Performance'],
] as const

const ACCESS_TYPES = [
  ['total', 'Acesso Total'],
  ['operacional', 'Acesso Operacional'],
] as const

type TeamMember = {
  id: string
  profile_id: string | null
  full_name: string
  email: string
  job_title: string
  access_type: string
  operational_area: string
  avatar_initials: string | null
  avatar_color: string | null
  avatar_bg: string | null
  is_active: boolean
  receives_internal_alerts: boolean
  must_change_password: boolean
  last_password_change_at: string | null
  last_access_change_at: string | null
  auth_status: {
    email_confirmed: boolean
    last_sign_in_at: string | null
    banned: boolean
  }
}

function areaLabel(value: string) {
  return (
    AREAS.find(([id]) => id === value)?.[1] ||
    value ||
    'Não definida'
  )
}

function accessLabel(value: string) {
  return value === 'total'
    ? 'Acesso Total'
    : 'Acesso Operacional'
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Nunca'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Nunca'
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const numbers = '23456789'
  const symbols = '@#_-!'
  const all = upper + lower + numbers + symbols
  const bytes = new Uint32Array(20)

  crypto.getRandomValues(bytes)

  const generated = Array.from(bytes)
    .map((number) => all[number % all.length])
    .join('')

  return (
    upper[bytes[0] % upper.length] +
    lower[bytes[1] % lower.length] +
    numbers[bytes[2] % numbers.length] +
    symbols[bytes[3] % symbols.length] +
    generated.slice(4)
  )
}

export default function EquipeView({
  members,
  loadError,
}: {
  members: TeamMember[]
  loadError?: string | null
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [accessFilter, setAccessFilter] = useState('all')
  const [modal, setModal] = useState<
    'new' | 'edit' | 'password' | null
  >(null)
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(loadError || '')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return members.filter((member) => {
      const matchesSearch =
        !term ||
        [
          member.full_name,
          member.email,
          member.job_title,
          areaLabel(member.operational_area),
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(term),
        )

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && member.is_active) ||
        (statusFilter === 'inactive' && !member.is_active)

      const matchesAccess =
        accessFilter === 'all' ||
        member.access_type === accessFilter

      return matchesSearch && matchesStatus && matchesAccess
    })
  }, [members, query, statusFilter, accessFilter])

  const activeCount = members.filter((member) => member.is_active).length
  const totalCount = members.filter(
    (member) => member.access_type === 'total' && member.is_active,
  ).length
  const operationalCount = members.filter(
    (member) =>
      member.access_type !== 'total' && member.is_active,
  ).length
  const pendingPasswordCount = members.filter(
    (member) =>
      member.is_active && member.must_change_password,
  ).length

  function openNew() {
    setSelected(null)
    setTemporaryPassword(generatePassword())
    setError('')
    setMessage('')
    setModal('new')
  }

  function openEdit(member: TeamMember) {
    setSelected(member)
    setError('')
    setMessage('')
    setModal('edit')
  }

  function openPassword(member: TeamMember) {
    setSelected(member)
    setTemporaryPassword(generatePassword())
    setError('')
    setMessage('')
    setModal('password')
  }

  function closeModal() {
    if (loading) {
      return
    }

    setModal(null)
    setSelected(null)
    setTemporaryPassword('')
    setError('')
  }

  async function runAction(
    action: (formData: FormData) => Promise<any>,
    formData: FormData,
    successMessage: string,
  ) {
    setLoading(true)
    setError('')
    setMessage('')

    const result = await action(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setMessage(successMessage)
    setLoading(false)
    setModal(null)
    setSelected(null)
    router.refresh()
  }

  return (
    <div className="team-access-page">
      <header className="team-access-header">
        <div>
          <span className="eyebrow">EQUIPE E ACESSOS</span>
          <h1>Equipe</h1>
          <p>
            Cadastre pessoas, defina o nível de acesso e controle
            senhas temporárias diretamente pelo sistema.
          </p>
        </div>

        <button className="bpri" onClick={openNew}>
          <i className="ti ti-user-plus" />
          Novo acesso
        </button>
      </header>

      <section className="team-access-stats">
        <Stat label="Membros" value={members.length} detail="cadastrados" />
        <Stat label="Ativos" value={activeCount} detail="liberados" />
        <Stat label="Acesso Total" value={totalCount} detail="gestores" />
        <Stat
          label="Operacional"
          value={operationalCount}
          detail="execução"
        />
        <Stat
          label="Senha temporária"
          value={pendingPasswordCount}
          detail="troca pendente"
          warning={pendingPasswordCount > 0}
        />
      </section>

      <section className="team-access-toolbar">
        <div className="sbox">
          <i className="ti ti-search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, e-mail, função ou área..."
          />
        </div>

        <select
          className="fi"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="active">Somente ativos</option>
          <option value="inactive">Somente inativos</option>
        </select>

        <select
          className="fi"
          value={accessFilter}
          onChange={(event) => setAccessFilter(event.target.value)}
        >
          <option value="all">Todos os acessos</option>
          <option value="total">Acesso Total</option>
          <option value="operacional">Acesso Operacional</option>
        </select>
      </section>

      {error && !modal ? (
        <div className="notice notice-err">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="notice notice-ok">
          <i className="ti ti-circle-check" />
          <span>{message}</span>
        </div>
      ) : null}

      <section className="team-access-table-wrap">
        <table className="team-access-table">
          <thead>
            <tr>
              <th>Integrante</th>
              <th>Função e área</th>
              <th>Acesso</th>
              <th>Status</th>
              <th>Último acesso</th>
              <th>Senha</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="team-person">
                    <span
                      className="team-avatar"
                      style={{
                        color: member.avatar_color || '#FFFFFF',
                        background: member.avatar_bg || '#3A3D43',
                      }}
                    >
                      {member.avatar_initials ||
                        member.full_name.slice(0, 2).toUpperCase()}
                    </span>

                    <div>
                      <b>{member.full_name}</b>
                      <small>{member.email}</small>
                    </div>
                  </div>
                </td>

                <td>
                  <b className="team-cell-title">{member.job_title}</b>
                  <small>{areaLabel(member.operational_area)}</small>
                </td>

                <td>
                  <span
                    className={
                      'team-access-badge ' +
                      (member.access_type === 'total'
                        ? 'total'
                        : 'operational')
                    }
                  >
                    {accessLabel(member.access_type)}
                  </span>
                </td>

                <td>
                  <span
                    className={
                      'team-status-badge ' +
                      (member.is_active ? 'active' : 'inactive')
                    }
                  >
                    {member.is_active ? 'Ativo' : 'Inativo'}
                  </span>

                  {member.auth_status.banned ? (
                    <small className="team-danger-note">
                      bloqueado no Auth
                    </small>
                  ) : null}
                </td>

                <td>
                  <b className="team-cell-title">
                    {formatDateTime(member.auth_status.last_sign_in_at)}
                  </b>
                  <small>
                    {member.auth_status.email_confirmed
                      ? 'E-mail confirmado'
                      : 'E-mail não confirmado'}
                  </small>
                </td>

                <td>
                  <span
                    className={
                      'team-password-badge ' +
                      (member.must_change_password
                        ? 'pending'
                        : 'regular')
                    }
                  >
                    {member.must_change_password
                      ? 'Troca pendente'
                      : 'Regular'}
                  </span>
                  <small>
                    {formatDateTime(member.last_password_change_at)}
                  </small>
                </td>

                <td>
                  <div className="team-row-actions">
                    <button
                      className="icon-action"
                      title="Editar acesso"
                      onClick={() => openEdit(member)}
                    >
                      <i className="ti ti-edit" />
                    </button>

                    <button
                      className="icon-action"
                      title="Redefinir senha"
                      onClick={() => openPassword(member)}
                    >
                      <i className="ti ti-key" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filtered.length ? (
          <div className="empty-state">
            <i className="ti ti-users-off" />
            <b>Nenhum integrante encontrado</b>
            <span>Ajuste os filtros ou cadastre um novo acesso.</span>
          </div>
        ) : null}
      </section>

      {modal === 'new' ? (
        <AccessModal title="Novo acesso" onClose={closeModal}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              runAction(
                createTeamMemberAction,
                new FormData(event.currentTarget),
                'Acesso criado com sucesso.',
              )
            }}
          >
            <MemberFields
              temporaryPassword={temporaryPassword}
              setTemporaryPassword={setTemporaryPassword}
              showPassword
            />

            <ModalFeedback error={error} />

            <ModalFooter
              loading={loading}
              onCancel={closeModal}
              submitLabel="Criar acesso"
            />
          </form>
        </AccessModal>
      ) : null}

      {modal === 'edit' && selected ? (
        <AccessModal title="Editar acesso" onClose={closeModal}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              runAction(
                updateTeamMemberAction,
                new FormData(event.currentTarget),
                'Acesso atualizado com sucesso.',
              )
            }}
          >
            <input type="hidden" name="member_id" value={selected.id} />

            <MemberFields member={selected} />

            <ModalFeedback error={error} />

            <ModalFooter
              loading={loading}
              onCancel={closeModal}
              submitLabel="Salvar alterações"
            />
          </form>
        </AccessModal>
      ) : null}

      {modal === 'password' && selected ? (
        <AccessModal title="Redefinir senha" onClose={closeModal}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              runAction(
                resetTeamMemberPasswordAction,
                new FormData(event.currentTarget),
                'Senha temporária redefinida.',
              )
            }}
          >
            <input type="hidden" name="member_id" value={selected.id} />

            <div className="team-password-target">
              <b>{selected.full_name}</b>
              <span>{selected.email}</span>
            </div>

            <PasswordField
              value={temporaryPassword}
              setValue={setTemporaryPassword}
            />

            <div className="notice notice-warn">
              <i className="ti ti-alert-triangle" />
              <span>
                A senha não será exibida novamente. Envie-a somente ao
                integrante correspondente.
              </span>
            </div>

            <ModalFeedback error={error} />

            <ModalFooter
              loading={loading}
              onCancel={closeModal}
              submitLabel="Redefinir senha"
            />
          </form>
        </AccessModal>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string
  value: number
  detail: string
  warning?: boolean
}) {
  return (
    <article className={warning ? 'warning' : ''}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </article>
  )
}

function MemberFields({
  member,
  temporaryPassword = '',
  setTemporaryPassword,
  showPassword = false,
}: {
  member?: TeamMember
  temporaryPassword?: string
  setTemporaryPassword?: (value: string) => void
  showPassword?: boolean
}) {
  return (
    <div className="team-access-form">
      <div className="frow">
        <div className="fg">
          <label className="fl">Nome *</label>
          <input
            className="fi"
            name="full_name"
            required
            defaultValue={member?.full_name || ''}
          />
        </div>

        <div className="fg">
          <label className="fl">E-mail *</label>
          <input
            className="fi"
            name="email"
            type="email"
            required={!member}
            disabled={Boolean(member)}
            defaultValue={member?.email || ''}
          />
        </div>
      </div>

      <div className="frow">
        <div className="fg">
          <label className="fl">Função *</label>
          <input
            className="fi"
            name="job_title"
            required
            defaultValue={member?.job_title || ''}
            placeholder="Ex.: Designer"
          />
        </div>

        <div className="fg">
          <label className="fl">Área *</label>
          <select
            className="fi"
            name="operational_area"
            required
            defaultValue={member?.operational_area || 'operacoes'}
          >
            {AREAS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="frow">
        <div className="fg">
          <label className="fl">Tipo de acesso *</label>
          <select
            className="fi"
            name="access_type"
            required
            defaultValue={member?.access_type || 'operacional'}
          >
            {ACCESS_TYPES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="fg">
          <label className="fl">Status *</label>
          <select
            className="fi"
            name="is_active"
            required
            defaultValue={
              member ? String(member.is_active) : 'true'
            }
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
      </div>

      <div className="fg">
        <label className="team-check">
          <input
            type="hidden"
            name="receives_internal_alerts"
            value="false"
          />
          <input
            type="checkbox"
            name="receives_internal_alerts"
            value="true"
            defaultChecked={
              member?.receives_internal_alerts ?? true
            }
          />
          <span>Receber avisos internos</span>
        </label>
      </div>

      {showPassword && setTemporaryPassword ? (
        <PasswordField
          value={temporaryPassword}
          setValue={setTemporaryPassword}
        />
      ) : null}
    </div>
  )
}

function PasswordField({
  value,
  setValue,
}: {
  value: string
  setValue: (value: string) => void
}) {
  return (
    <div className="fg">
      <label className="fl">Senha temporária *</label>

      <div className="team-password-field">
        <input
          className="fi"
          name="temporary_password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          minLength={12}
        />

        <button
          type="button"
          className="bsec"
          onClick={() => setValue(generatePassword())}
        >
          Gerar
        </button>

        <button
          type="button"
          className="bsec"
          onClick={() => navigator.clipboard.writeText(value)}
        >
          Copiar
        </button>
      </div>

      <small className="field-help">
        Mínimo de 12 caracteres, com letra maiúscula, minúscula,
        número e caractere especial.
      </small>
    </div>
  )
}

function AccessModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="modal-ov" onClick={onClose}>
      <div
        className="modal modal-wide team-access-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-sub">
              Administração restrita a usuários com Acesso Total.
            </div>
          </div>

          <button className="mclose" onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}

function ModalFeedback({ error }: { error: string }) {
  return error ? (
    <div className="notice notice-err">
      <i className="ti ti-alert-circle" />
      <span>{error}</span>
    </div>
  ) : null
}

function ModalFooter({
  loading,
  onCancel,
  submitLabel,
}: {
  loading: boolean
  onCancel: () => void
  submitLabel: string
}) {
  return (
    <div className="modal-foot">
      <button type="button" className="bsec" onClick={onCancel}>
        Cancelar
      </button>
      <button className="bpri" disabled={loading}>
        {loading ? 'Salvando...' : submitLabel}
      </button>
    </div>
  )
}
