'use client'

import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  createProjectAction,
  createProjectStepAction,
  deleteProjectStepAction,
  deleteWorkItemAction,
  updateContextWorkItemAction,
  updateProjectStepAction,
  updateProjectStepStatusAction,
} from '@/lib/actions'

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  waiting: 'Aguardando',
  blocked: 'Bloqueada',
  in_review: 'Em revisão',
  awaiting_approval: 'Ag. aprovação',
  approved: 'Aprovada',
  scheduled: 'Programada',
  delivered: 'Entregue',
  done: 'Concluída',
  cancelled: 'Cancelada',
  archived: 'Arquivada',
}

const STATUS_BADGE: Record<string, string> = {
  done: 'bok',
  delivered: 'bok',
  approved: 'bok',
  not_started: 'bwarn',
  waiting: 'bwarn',
  awaiting_approval: 'bwarn',
  scheduled: 'bwarn',
  blocked: 'berr',
  cancelled: 'berr',
  in_progress: 'bblue',
  in_review: 'bblue',
  archived: 'bmut',
}

const TYPES = [
  'Planejamento',
  'Captação',
  'Edição',
  'Design',
  'Organização de Feed',
  'Programação',
  'Tráfego',
  'Reunião',
  'Relatório',
  'Interno',
]

function dateValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

function fmtDate(value?: string | null) {
  return value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`)
        .toLocaleDateString('pt-BR')
    : 'Sem prazo'
}

function stepDone(step: any) {
  return ['done', 'delivered', 'approved'].includes(
    String(step?.status || ''),
  )
}

export default function ProjectsWorkspace({
  demands = [],
  clients = [],
  profiles = [],
  loadErrors = [],
}: any) {
  const safeDemands = Array.isArray(demands)
    ? demands.filter(Boolean)
    : []
  const safeClients = Array.isArray(clients)
    ? clients.filter(Boolean)
    : []
  const safeProfiles = Array.isArray(profiles)
    ? profiles.filter(Boolean)
    : []

  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState('all')
  const [responsibleId, setResponsibleId] = useState('all')
  const [status, setStatus] = useState('all')
  const [projectModal, setProjectModal] = useState<
    'create' | 'edit' | null
  >(null)
  const [stepModal, setStepModal] = useState<
    'create' | 'edit' | null
  >(null)
  const [editingProject, setEditingProject] =
    useState<any | null>(null)
  const [editingStep, setEditingStep] =
    useState<any | null>(null)
  const [stepProject, setStepProject] =
    useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()

    return safeDemands.filter((item: any) => {
      const matchesSearch =
        !term ||
        String(item.title || '').toLowerCase().includes(term) ||
        String(item.client?.name || '')
          .toLowerCase()
          .includes(term)

      return (
        matchesSearch &&
        (clientId === 'all' || item.client_id === clientId) &&
        (responsibleId === 'all' ||
          item.responsible_id === responsibleId) &&
        (status === 'all' || item.status === status)
      )
    })
  }, [
    safeDemands,
    query,
    clientId,
    responsibleId,
    status,
  ])

  function newProject() {
    setEditingProject(null)
    setError('')
    setProjectModal('create')
  }

  function editProject(project: any) {
    setEditingProject(project)
    setError('')
    setProjectModal('edit')
  }

  async function submitProject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)

    const result =
      projectModal === 'edit' && editingProject
        ? await updateContextWorkItemAction(
            editingProject.id,
            formData,
          )
        : await createProjectAction(formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao salvar projeto.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function archiveProject() {
    if (!editingProject) return

    if (
      !confirm(
        'Arquivar este projeto? Ele sairá das visões operacionais.',
      )
    ) {
      return
    }

    setLoading(true)

    const result = await deleteWorkItemAction(
      editingProject.id,
    )

    if ('error' in result) {
      setError(result.error || 'Erro ao arquivar projeto.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  function newStep(project: any) {
    setStepProject(project)
    setEditingStep(null)
    setError('')
    setStepModal('create')
  }

  function editStep(project: any, step: any) {
    setStepProject(project)
    setEditingStep(step)
    setError('')
    setStepModal('edit')
  }

  async function submitStep(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!stepProject) return

    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)

    const result =
      stepModal === 'edit' && editingStep
        ? await updateProjectStepAction(
            editingStep.id,
            stepProject.id,
            formData,
          )
        : await createProjectStepAction(formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao salvar etapa.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function changeStepStatus(
    projectId: string,
    stepId: string,
    nextStatus: string,
  ) {
    const result = await updateProjectStepStatusAction(
      stepId,
      projectId,
      nextStatus,
    )

    if ('error' in result) {
      alert(result.error)
      return
    }

    window.location.reload()
  }

  async function removeStep(
    projectId: string,
    stepId: string,
  ) {
    if (!confirm('Excluir esta etapa do projeto?')) return

    const result = await deleteProjectStepAction(
      stepId,
      projectId,
    )

    if ('error' in result) {
      alert(result.error)
      return
    }

    window.location.reload()
  }

  return (
    <div className="page-wrap ops-page projects-page">
      <div className="topbar">
        <div>
          <div className="tb-title">Projetos</div>
          <div className="tb-sub">
            Crie, edite e organize projetos diretamente nesta aba.
          </div>
        </div>

        <div className="sbox">
          <i className="ti ti-search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar projeto ou cliente."
          />
        </div>

        <button
          className="bpri"
          type="button"
          onClick={newProject}
        >
          <i className="ti ti-plus" />
          Novo projeto
        </button>
      </div>

      <div className="board-toolbar">
        <select
          className="fi compact"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        >
          <option value="all">Todos os clientes</option>
          {safeClients.map((client: any) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <select
          className="fi compact"
          value={responsibleId}
          onChange={(event) =>
            setResponsibleId(event.target.value)
          }
        >
          <option value="all">Todos os responsáveis</option>
          {safeProfiles.map((profile: any) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </select>

        <select
          className="fi compact"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {loadErrors.length > 0 && (
        <div className="notice notice-err">
          <i className="ti ti-alert-circle" />
          <span>{loadErrors.join(' • ')}</span>
        </div>
      )}

      {!visible.length ? (
        <div className="empty">
          <i className="ti ti-route" />
          <div className="empty-title">
            Nenhum projeto encontrado
          </div>
          <div className="empty-sub">
            Use “Novo projeto” para cadastrar diretamente nesta
            tela.
          </div>
        </div>
      ) : (
        <div className="project-list project-list-dense">
          {visible.map((item: any) => {
            const steps = Array.isArray(item.steps)
              ? item.steps
              : []
            const completed = steps.filter(stepDone).length
            const progress = steps.length
              ? Math.round((completed / steps.length) * 100)
              : 0

            return (
              <article
                className="project-card context-project-card"
                key={item.id}
              >
                <div className="project-head">
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.client?.name || 'Interno Ampy'}
                      {' • '}
                      {item.type || 'Projeto'}
                    </p>
                  </div>

                  <span
                    className={`badge ${
                      STATUS_BADGE[item.status] || 'bmut'
                    }`}
                  >
                    {STATUS_LABEL[item.status] || item.status}
                  </span>
                </div>

                <div className="context-project-meta">
                  <span>
                    <i className="ti ti-user" />
                    {item.responsible?.full_name ||
                      'Sem responsável'}
                  </span>
                  <span>
                    <i className="ti ti-calendar" />
                    {fmtDate(item.final_deadline)}
                  </span>
                  <span>
                    <i className="ti ti-flag" />
                    {item.priority || 'normal'}
                  </span>
                </div>

                <div className="project-progress">
                  <div>
                    <span>
                      {completed}/{steps.length} etapa(s)
                    </span>
                    <b>{progress}%</b>
                  </div>
                  <div className="project-progress-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="context-step-list">
                  {steps.map((step: any) => (
                    <div
                      className="context-step-row"
                      key={step.id}
                    >
                      <button
                        className="context-step-main"
                        type="button"
                        onClick={() => editStep(item, step)}
                      >
                        <b>{step.title}</b>
                        <span>
                          {step.responsible?.full_name ||
                            'Sem responsável'}
                          {' • '}
                          {fmtDate(step.end_date)}
                        </span>
                      </button>

                      <select
                        className="fi compact"
                        value={step.status}
                        onChange={(event) =>
                          changeStepStatus(
                            item.id,
                            step.id,
                            event.target.value,
                          )
                        }
                      >
                        <option value="not_started">
                          Não iniciada
                        </option>
                        <option value="in_progress">
                          Em andamento
                        </option>
                        <option value="waiting">
                          Aguardando
                        </option>
                        <option value="blocked">
                          Bloqueada
                        </option>
                        <option value="done">
                          Concluída
                        </option>
                      </select>

                      <button
                        className="icon-button danger-button"
                        type="button"
                        title="Excluir etapa"
                        onClick={() =>
                          removeStep(item.id, step.id)
                        }
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  ))}

                  {!steps.length && (
                    <div className="empty-inline">
                      Nenhuma etapa cadastrada.
                    </div>
                  )}
                </div>

                <div className="project-actions">
                  <button
                    className="bsec"
                    type="button"
                    onClick={() => editProject(item)}
                  >
                    <i className="ti ti-edit" />
                    Editar projeto
                  </button>

                  <button
                    className="bpri"
                    type="button"
                    onClick={() => newStep(item)}
                  >
                    <i className="ti ti-plus" />
                    Nova etapa
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {projectModal && (
        <div
          className="modal-ov"
          onClick={() => setProjectModal(null)}
        >
          <div
            className="modal context-modal-wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {projectModal === 'edit'
                    ? 'Editar projeto'
                    : 'Novo projeto'}
                </div>
                <div className="modal-sub">
                  O projeto também aparecerá na listagem geral de
                  Demandas.
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() => setProjectModal(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={submitProject}>
              <div className="modal-body">
                <input
                  type="hidden"
                  name="context"
                  value="project"
                />

                <div className="fg">
                  <label className="fl">Título *</label>
                  <input
                    className="fi"
                    name="title"
                    required
                    defaultValue={
                      editingProject?.title || ''
                    }
                  />
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Cliente</label>
                    <select
                      className="fi"
                      name="client_id"
                      defaultValue={
                        editingProject?.client_id || ''
                      }
                    >
                      <option value="">Interno Ampy</option>
                      {safeClients.map((client: any) => (
                        <option
                          key={client.id}
                          value={client.id}
                        >
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">Responsável</label>
                    <select
                      className="fi"
                      name="responsible_id"
                      defaultValue={
                        editingProject?.responsible_id || ''
                      }
                    >
                      <option value="">Definir depois</option>
                      {safeProfiles.map((profile: any) => (
                        <option
                          key={profile.id}
                          value={profile.id}
                        >
                          {profile.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Tipo</label>
                    <select
                      className="fi"
                      name="type"
                      defaultValue={
                        editingProject?.type || 'Planejamento'
                      }
                    >
                      {TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">Status</label>
                    <select
                      className="fi"
                      name="status"
                      defaultValue={
                        editingProject?.status || 'not_started'
                      }
                    >
                      {Object.entries(STATUS_LABEL).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">Prioridade</label>
                    <select
                      className="fi"
                      name="priority"
                      defaultValue={
                        editingProject?.priority || 'normal'
                      }
                    >
                      <option value="low">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Data inicial
                    </label>
                    <input
                      className="fi"
                      type="date"
                      name="internal_deadline"
                      defaultValue={dateValue(
                        editingProject?.internal_deadline,
                      )}
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">Prazo final</label>
                    <input
                      className="fi"
                      type="date"
                      name="final_deadline"
                      defaultValue={dateValue(
                        editingProject?.final_deadline,
                      )}
                    />
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">Descrição</label>
                  <textarea
                    className="fi"
                    name="description"
                    defaultValue={
                      editingProject?.description || ''
                    }
                  />
                </div>

                <div className="fg">
                  <label className="fl">Link do Drive</label>
                  <input
                    className="fi"
                    type="url"
                    name="drive_link"
                    defaultValue={
                      editingProject?.drive_link || ''
                    }
                  />
                </div>

                <div className="fg">
                  <label className="fl">Observações</label>
                  <textarea
                    className="fi"
                    name="notes"
                    defaultValue={editingProject?.notes || ''}
                  />
                </div>

                {error && (
                  <div className="notice notice-err">
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                {editingProject && (
                  <button
                    className="bsec danger-button"
                    type="button"
                    onClick={archiveProject}
                    disabled={loading}
                  >
                    Arquivar projeto
                  </button>
                )}

                <button
                  className="bsec"
                  type="button"
                  onClick={() => setProjectModal(null)}
                >
                  Cancelar
                </button>

                <button
                  className="bpri"
                  disabled={loading}
                >
                  {loading
                    ? 'Salvando...'
                    : editingProject
                      ? 'Salvar projeto'
                      : 'Criar projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stepModal && stepProject && (
        <div
          className="modal-ov"
          onClick={() => setStepModal(null)}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {stepModal === 'edit'
                    ? 'Editar etapa'
                    : 'Nova etapa'}
                </div>
                <div className="modal-sub">
                  Projeto: {stepProject.title}
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() => setStepModal(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={submitStep}>
              <div className="modal-body">
                <input
                  type="hidden"
                  name="work_item_id"
                  value={stepProject.id}
                />

                <div className="fg">
                  <label className="fl">Título *</label>
                  <input
                    className="fi"
                    name="title"
                    required
                    defaultValue={editingStep?.title || ''}
                  />
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Responsável</label>
                    <select
                      className="fi"
                      name="responsible_id"
                      defaultValue={
                        editingStep?.responsible_id || ''
                      }
                    >
                      <option value="">Definir depois</option>
                      {safeProfiles.map((profile: any) => (
                        <option
                          key={profile.id}
                          value={profile.id}
                        >
                          {profile.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">Status</label>
                    <select
                      className="fi"
                      name="status"
                      defaultValue={
                        editingStep?.status || 'not_started'
                      }
                    >
                      <option value="not_started">
                        Não iniciada
                      </option>
                      <option value="in_progress">
                        Em andamento
                      </option>
                      <option value="waiting">
                        Aguardando
                      </option>
                      <option value="blocked">
                        Bloqueada
                      </option>
                      <option value="done">
                        Concluída
                      </option>
                    </select>
                  </div>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Início</label>
                    <input
                      className="fi"
                      type="date"
                      name="start_date"
                      defaultValue={dateValue(
                        editingStep?.start_date,
                      )}
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">Fim</label>
                    <input
                      className="fi"
                      type="date"
                      name="end_date"
                      defaultValue={dateValue(
                        editingStep?.end_date,
                      )}
                    />
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">Observações</label>
                  <textarea
                    className="fi"
                    name="notes"
                    defaultValue={editingStep?.notes || ''}
                  />
                </div>

                {error && (
                  <div className="notice notice-err">
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                <button
                  className="bsec"
                  type="button"
                  onClick={() => setStepModal(null)}
                >
                  Cancelar
                </button>

                <button
                  className="bpri"
                  disabled={loading}
                >
                  {loading
                    ? 'Salvando...'
                    : editingStep
                      ? 'Salvar etapa'
                      : 'Criar etapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
