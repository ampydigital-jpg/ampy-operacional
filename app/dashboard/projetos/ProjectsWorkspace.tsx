'use client'

// AMPY-V17-A18 — STATUS PERSONALIZADOS POR PROJETO

import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  createProjectStepDynamicAction,
  createProjectStepStatusAction,
  createStandardProjectAction,
  deleteProjectStepDynamicAction,
  deleteProjectStepStatusDefinitionAction,
  deleteWorkItemAction,
  moveProjectStepStatusAction,
  updateProjectStepDynamicAction,
  updateProjectStepStatusDefinitionAction,
  updateProjectStepStatusDynamicAction,
  updateStandardProjectAction,
} from '@/lib/actions'

const BEHAVIOR_LABEL: Record<string, string> = {
  pending: 'Pendente',
  active: 'Em execução',
  blocked: 'Bloqueado',
  done: 'Finalizado',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

function dateValue(
  value?: string | null,
) {
  return value
    ? String(value).slice(0, 10)
    : ''
}

function fmtDate(
  value?: string | null,
) {
  return value
    ? new Date(
        `${String(value).slice(0, 10)}T12:00:00`,
      ).toLocaleDateString('pt-BR')
    : '—'
}

function rgba(
  hex: string,
  alpha: number,
) {
  const normalized = String(hex || '')
    .replace('#', '')
    .trim()

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(100, 116, 139, ${alpha})`
  }

  const number = Number.parseInt(
    normalized,
    16,
  )

  const red = (number >> 16) & 255
  const green = (number >> 8) & 255
  const blue = number & 255

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function statusForStep(
  step: any,
  statuses: any[],
) {
  return (
    step?.status_definition ||
    statuses.find(
      (status: any) =>
        status.id === step?.status_id,
    ) ||
    null
  )
}

function stepDone(
  step: any,
  statuses: any[],
) {
  const status =
    statusForStep(
      step,
      statuses,
    )

  if (status?.behavior) {
    return status.behavior === 'done'
  }

  return [
    'done',
    'delivered',
    'approved',
  ].includes(
    String(step?.status || ''),
  )
}

function derivedProjectState(
  steps: any[],
  statuses: any[],
) {
  if (!steps.length) {
    return {
      label: 'Planejado',
      className: 'bmut',
    }
  }

  const statusDefinitions =
    steps.map(
      (step: any) =>
        statusForStep(
          step,
          statuses,
        ),
    )

  if (
    statusDefinitions.length > 0 &&
    statusDefinitions.every(
      (status: any) =>
        status?.behavior === 'done',
    )
  ) {
    return {
      label: 'Concluído',
      className: 'bok',
    }
  }

  if (
    statusDefinitions.some(
      (status: any) =>
        status?.behavior === 'blocked',
    )
  ) {
    return {
      label: 'Atenção',
      className: 'berr',
    }
  }

  return {
    label: 'Em andamento',
    className: 'bblue',
  }
}

export default function ProjectsWorkspace({
  demands = [],
  clients = [],
  profiles = [],
  clientServices = [],
  loadErrors = [],
}: any) {
  const safeDemands =
    Array.isArray(demands)
      ? demands.filter(Boolean)
      : []

  const safeClients =
    Array.isArray(clients)
      ? clients.filter(Boolean)
      : []

  const safeProfiles =
    Array.isArray(profiles)
      ? profiles.filter(Boolean)
      : []

  const safeClientServices =
    Array.isArray(clientServices)
      ? clientServices.filter(Boolean)
      : []

  const [query, setQuery] =
    useState('')

  const [
    clientId,
    setClientId,
  ] = useState('all')

  const [
    responsibleId,
    setResponsibleId,
  ] = useState('all')

  const [
    projectModal,
    setProjectModal,
  ] = useState<
    'create' | 'edit' | null
  >(null)

  const [
    stepModal,
    setStepModal,
  ] = useState<
    'create' | 'edit' | null
  >(null)

  const [
    statusModal,
    setStatusModal,
  ] = useState(false)

  const [
    editingProject,
    setEditingProject,
  ] = useState<any>(null)

  const [
    editingStep,
    setEditingStep,
  ] = useState<any>(null)

  const [
    stepProject,
    setStepProject,
  ] = useState<any>(null)

  const [
    statusProject,
    setStatusProject,
  ] = useState<any>(null)

  const [
    formClient,
    setFormClient,
  ] = useState('')

  const [
    formService,
    setFormService,
  ] = useState('')

  const [
    formStart,
    setFormStart,
  ] = useState('')

  const [
    formFinal,
    setFormFinal,
  ] = useState('')

  const [
    replacementByStatus,
    setReplacementByStatus,
  ] = useState<
    Record<string, string>
  >({})

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const activeServices =
    formClient
      ? safeClientServices.filter(
          (item: any) =>
            item.client_id ===
              formClient &&
            item.status === 'active',
        )
      : []

  const visible = useMemo(
    () => {
      const term =
        query
          .trim()
          .toLowerCase()

      return safeDemands.filter(
        (item: any) => {
          const matchesSearch =
            !term ||
            String(
              item.title || '',
            )
              .toLowerCase()
              .includes(term) ||
            String(
              item.client?.name || '',
            )
              .toLowerCase()
              .includes(term)

          return (
            matchesSearch &&
            (
              clientId === 'all' ||
              item.client_id ===
                clientId
            ) &&
            (
              responsibleId === 'all' ||
              item.responsible_id ===
                responsibleId
            )
          )
        },
      )
    },
    [
      safeDemands,
      query,
      clientId,
      responsibleId,
    ],
  )

  function closeProjectModal() {
    setProjectModal(null)
    setEditingProject(null)
    setError('')
  }

  function newProject() {
    setEditingProject(null)
    setFormClient('')
    setFormService('')
    setFormStart('')
    setFormFinal('')
    setError('')
    setProjectModal('create')
  }

  function editProject(
    project: any,
  ) {
    setEditingProject(project)

    setFormClient(
      project.client_id || '',
    )

    setFormService(
      project.client_service_id ||
        '',
    )

    setFormStart(
      dateValue(
        project.internal_deadline,
      ),
    )

    setFormFinal(
      dateValue(
        project.final_deadline,
      ),
    )

    setError('')
    setProjectModal('edit')
  }

  async function submitProject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData =
      new FormData(
        event.currentTarget,
      )

    const result =
      projectModal === 'edit' &&
      editingProject
        ? await updateStandardProjectAction(
            editingProject.id,
            formData,
          )
        : await createStandardProjectAction(
            formData,
          )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao salvar projeto.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function archiveProject() {
    if (!editingProject) {
      return
    }

    if (
      !confirm(
        'Arquivar este projeto? Ele sairá das visões operacionais.',
      )
    ) {
      return
    }

    setLoading(true)

    const result =
      await deleteWorkItemAction(
        editingProject.id,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao arquivar projeto.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  function newStep(
    project: any,
  ) {
    setStepProject(project)
    setEditingStep(null)
    setError('')
    setStepModal('create')
  }

  function editStep(
    project: any,
    step: any,
  ) {
    setStepProject(project)
    setEditingStep(step)
    setError('')
    setStepModal('edit')
  }

  async function submitStep(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!stepProject) {
      return
    }

    setLoading(true)
    setError('')

    const formData =
      new FormData(
        event.currentTarget,
      )

    const result =
      stepModal === 'edit' &&
      editingStep
        ? await updateProjectStepDynamicAction(
            editingStep.id,
            stepProject.id,
            formData,
          )
        : await createProjectStepDynamicAction(
            formData,
          )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao salvar etapa.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function changeStepStatus(
    projectId: string,
    stepId: string,
    statusId: string,
  ) {
    const result =
      await updateProjectStepStatusDynamicAction(
        stepId,
        projectId,
        statusId,
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
    if (
      !confirm(
        'Excluir esta etapa do projeto?',
      )
    ) {
      return
    }

    const result =
      await deleteProjectStepDynamicAction(
        stepId,
        projectId,
      )

    if ('error' in result) {
      alert(result.error)
      return
    }

    window.location.reload()
  }

  function openStatuses(
    project: any,
  ) {
    setStatusProject(project)
    setReplacementByStatus({})
    setError('')
    setStatusModal(true)
  }

  async function createStatus(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!statusProject) {
      return
    }

    setLoading(true)
    setError('')

    const formData =
      new FormData(
        event.currentTarget,
      )

    const result =
      await createProjectStepStatusAction(
        statusProject.id,
        formData,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao criar status.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function updateStatus(
    event: FormEvent<HTMLFormElement>,
    statusId: string,
  ) {
    event.preventDefault()

    if (!statusProject) {
      return
    }

    setLoading(true)
    setError('')

    const formData =
      new FormData(
        event.currentTarget,
      )

    const result =
      await updateProjectStepStatusDefinitionAction(
        statusId,
        statusProject.id,
        formData,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao atualizar status.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function moveStatus(
    statusId: string,
    direction: 'up' | 'down',
  ) {
    if (!statusProject) {
      return
    }

    const result =
      await moveProjectStepStatusAction(
        statusId,
        statusProject.id,
        direction,
      )

    if ('error' in result) {
      alert(result.error)
      return
    }

    window.location.reload()
  }

  async function deleteStatus(
    statusId: string,
  ) {
    if (!statusProject) {
      return
    }

    if (
      !confirm(
        'Excluir este status? Etapas vinculadas serão transferidas para o status escolhido.',
      )
    ) {
      return
    }

    const result =
      await deleteProjectStepStatusDefinitionAction(
        statusId,
        statusProject.id,
        replacementByStatus[
          statusId
        ] || '',
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao excluir status.',
      )
      return
    }

    window.location.reload()
  }

  return (
    <div className="projects-v18-page">
      <div className="topbar">
        <div>
          <div className="tb-title">
            Projetos
          </div>

          <div className="tb-sub">
            Projetos com cronograma,
            etapas e status
            personalizados.
          </div>
        </div>

        <div className="topbar-actions">
          <label className="sbox">
            <i className="ti ti-search" />

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Buscar projeto ou cliente."
            />
          </label>

          <button
            className="bpri"
            type="button"
            onClick={newProject}
          >
            <i className="ti ti-plus" />
            Novo projeto
          </button>
        </div>
      </div>

      <div className="projects-v18-filters">
        <select
          className="fi"
          value={clientId}
          onChange={(event) =>
            setClientId(
              event.target.value,
            )
          }
        >
          <option value="all">
            Todos os clientes
          </option>

          {safeClients.map(
            (client: any) => (
              <option
                key={client.id}
                value={client.id}
              >
                {client.name}
              </option>
            ),
          )}
        </select>

        <select
          className="fi"
          value={responsibleId}
          onChange={(event) =>
            setResponsibleId(
              event.target.value,
            )
          }
        >
          <option value="all">
            Todos os responsáveis
          </option>

          {safeProfiles.map(
            (profile: any) => (
              <option
                key={profile.id}
                value={profile.id}
              >
                {profile.full_name}
              </option>
            ),
          )}
        </select>
      </div>

      {loadErrors.length > 0 && (
        <div className="notice notice-err projects-v18-notice">
          <span>
            {loadErrors.join(' • ')}
          </span>
        </div>
      )}

      {!visible.length ? (
        <div className="empty-state projects-v18-empty">
          <strong>
            Nenhum projeto encontrado
          </strong>

          <span>
            Use “Novo projeto” para
            cadastrar diretamente
            nesta tela.
          </span>
        </div>
      ) : (
        <div className="projects-v18-list">
          {visible.map(
            (item: any) => {
              const steps =
                Array.isArray(
                  item.steps,
                )
                  ? item.steps
                  : []

              const statuses =
                Array.isArray(
                  item.step_statuses,
                )
                  ? item.step_statuses
                  : []

              const completed =
                steps.filter(
                  (step: any) =>
                    stepDone(
                      step,
                      statuses,
                    ),
                ).length

              const progress =
                steps.length
                  ? Math.round(
                      (
                        completed /
                        steps.length
                      ) * 100,
                    )
                  : 0

              const projectState =
                derivedProjectState(
                  steps,
                  statuses,
                )

              const countByStatus =
                steps.reduce(
                  (
                    accumulator:
                      Record<
                        string,
                        number
                      >,
                    step: any,
                  ) => {
                    const key =
                      String(
                        step.status_id ||
                          '',
                      )

                    if (key) {
                      accumulator[key] =
                        (
                          accumulator[
                            key
                          ] || 0
                        ) + 1
                    }

                    return accumulator
                  },
                  {},
                )

              return (
                <article
                  className="projects-v18-card"
                  key={item.id}
                >
                  <div className="projects-v18-card-head">
                    <div>
                      <h3>
                        {item.title}
                      </h3>

                      <p>
                        {item.client
                          ?.name ||
                          'Interno Ampy'}

                        {' • '}

                        {item
                          .client_service
                          ?.service
                          ?.name ||
                          'Projeto'}
                      </p>
                    </div>

                    <span
                      className={`badge ${projectState.className}`}
                    >
                      {
                        projectState.label
                      }
                    </span>
                  </div>

                  <div className="projects-v18-meta">
                    <span>
                      <i className="ti ti-user" />
                      {item.responsible
                        ?.full_name ||
                        'Sem responsável'}
                    </span>

                    <span>
                      <i className="ti ti-calendar-event" />
                      {fmtDate(
                        item.internal_deadline,
                      )}
                      {' → '}
                      {fmtDate(
                        item.final_deadline,
                      )}
                    </span>

                    <span>
                      <i className="ti ti-flag" />
                      {PRIORITY_LABEL[
                        item.priority
                      ] ||
                        item.priority ||
                        'Normal'}
                    </span>
                  </div>

                  <div className="projects-v18-progress">
                    <div className="projects-v18-progress-label">
                      <span>
                        {completed}/
                        {steps.length}{' '}
                        etapa(s)
                      </span>

                      <strong>
                        {progress}%
                      </strong>
                    </div>

                    <div className="projects-v18-progress-track">
                      <span
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="projects-v18-statusbar">
                    <div className="projects-v18-statuschips">
                      {statuses.map(
                        (status: any) => (
                          <span
                            key={
                              status.id
                            }
                            className="projects-v18-statuschip"
                            style={{
                              color:
                                status.color,
                              borderColor:
                                rgba(
                                  status.color,
                                  0.38,
                                ),
                              background:
                                rgba(
                                  status.color,
                                  0.09,
                                ),
                            }}
                          >
                            <span
                              className="projects-v18-dot"
                              style={{
                                background:
                                  status.color,
                              }}
                            />

                            {status.name}

                            <strong>
                              {countByStatus[
                                status.id
                              ] || 0}
                            </strong>
                          </span>
                        ),
                      )}
                    </div>

                    <button
                      className="projects-v18-manage-status"
                      type="button"
                      onClick={() =>
                        openStatuses(item)
                      }
                    >
                      <i className="ti ti-adjustments" />
                      Status das etapas
                    </button>
                  </div>

                  <div className="projects-v18-steps">
                    {steps.map(
                      (step: any) => {
                        const status =
                          statusForStep(
                            step,
                            statuses,
                          )

                        return (
                          <div
                            className="projects-v18-step"
                            key={
                              step.id
                            }
                            style={{
                              borderLeftColor:
                                status
                                  ?.color ||
                                '#64748B',
                            }}
                          >
                            <button
                              className="projects-v18-step-main"
                              type="button"
                              onClick={() =>
                                editStep(
                                  item,
                                  step,
                                )
                              }
                            >
                              <strong>
                                {
                                  step.title
                                }
                              </strong>

                              <span>
                                <i className="ti ti-user" />
                                {step
                                  .responsible
                                  ?.full_name ||
                                  'Sem responsável'}
                              </span>

                              <span className="projects-v18-step-dates">
                                <i className="ti ti-calendar" />

                                Início{' '}
                                <b>
                                  {fmtDate(
                                    step.start_date,
                                  )}
                                </b>

                                <span>
                                  →
                                </span>

                                Final{' '}
                                <b>
                                  {fmtDate(
                                    step.end_date,
                                  )}
                                </b>
                              </span>
                            </button>

                            <div className="projects-v18-step-actions">
                              <select
                                className="projects-v18-step-status"
                                value={
                                  step.status_id ||
                                  ''
                                }
                                onChange={(
                                  event,
                                ) =>
                                  changeStepStatus(
                                    item.id,
                                    step.id,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                style={{
                                  color:
                                    status
                                      ?.color ||
                                    '#64748B',
                                  borderColor:
                                    rgba(
                                      status
                                        ?.color ||
                                        '#64748B',
                                      0.42,
                                    ),
                                  background:
                                    rgba(
                                      status
                                        ?.color ||
                                        '#64748B',
                                      0.08,
                                    ),
                                }}
                              >
                                {statuses.map(
                                  (
                                    option: any,
                                  ) => (
                                    <option
                                      key={
                                        option.id
                                      }
                                      value={
                                        option.id
                                      }
                                    >
                                      {
                                        option.name
                                      }
                                    </option>
                                  ),
                                )}
                              </select>

                              <button
                                className="icon-btn"
                                type="button"
                                title="Editar etapa"
                                onClick={() =>
                                  editStep(
                                    item,
                                    step,
                                  )
                                }
                              >
                                <i className="ti ti-pencil" />
                              </button>

                              <button
                                className="icon-btn danger-button"
                                type="button"
                                title="Excluir etapa"
                                onClick={() =>
                                  removeStep(
                                    item.id,
                                    step.id,
                                  )
                                }
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </div>
                        )
                      },
                    )}

                    {!steps.length && (
                      <div className="projects-v18-no-steps">
                        Nenhuma etapa
                        cadastrada. Crie a
                        primeira etapa para
                        iniciar o cronograma.
                      </div>
                    )}
                  </div>

                  <div className="projects-v18-card-foot">
                    <button
                      className="bsec"
                      type="button"
                      onClick={() =>
                        editProject(item)
                      }
                    >
                      <i className="ti ti-pencil" />
                      Editar projeto
                    </button>

                    <button
                      className="bpri"
                      type="button"
                      onClick={() =>
                        newStep(item)
                      }
                    >
                      <i className="ti ti-plus" />
                      Nova etapa
                    </button>
                  </div>
                </article>
              )
            },
          )}
        </div>
      )}

      {projectModal && (
        <div
          className="modal-ov"
          onClick={closeProjectModal}
        >
          <div
            className="modal projects-v18-project-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {projectModal ===
                  'edit'
                    ? 'Editar projeto'
                    : 'Novo projeto'}
                </div>

                <div className="modal-sub">
                  O andamento será
                  calculado pelas etapas
                  do cronograma.
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={
                  closeProjectModal
                }
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form
              onSubmit={
                submitProject
              }
            >
              <div className="modal-body">
                <input
                  type="hidden"
                  name="status"
                  value={
                    editingProject
                      ?.status ||
                    'not_started'
                  }
                />

                <div className="fg">
                  <label className="fl">
                    Título *
                  </label>

                  <input
                    className="fi"
                    name="title"
                    required
                    minLength={2}
                    maxLength={180}
                    defaultValue={
                      editingProject
                        ?.title || ''
                    }
                    placeholder="Nome do projeto"
                  />
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Cliente
                    </label>

                    <select
                      className="fi"
                      name="client_id"
                      value={
                        formClient
                      }
                      onChange={(
                        event,
                      ) => {
                        setFormClient(
                          event.target
                            .value,
                        )
                        setFormService(
                          '',
                        )
                      }}
                    >
                      <option value="">
                        Interno Ampy
                      </option>

                      {safeClients.map(
                        (
                          client: any,
                        ) => (
                          <option
                            key={
                              client.id
                            }
                            value={
                              client.id
                            }
                          >
                            {
                              client.name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Serviço
                    </label>

                    <select
                      className="fi"
                      name="client_service_id"
                      value={
                        formService
                      }
                      disabled={
                        !formClient
                      }
                      onChange={(
                        event,
                      ) =>
                        setFormService(
                          event.target
                            .value,
                        )
                      }
                    >
                      <option value="">
                        {formClient
                          ? 'Sem serviço específico'
                          : 'Selecione o cliente primeiro'}
                      </option>

                      {activeServices.map(
                        (item: any) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item
                              .service
                              ?.name ||
                              'Serviço'}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Responsável *
                    </label>

                    <select
                      className="fi"
                      name="responsible_id"
                      required
                      defaultValue={
                        editingProject
                          ?.responsible_id ||
                        ''
                      }
                    >
                      <option
                        value=""
                        disabled
                      >
                        Selecione o
                        responsável
                      </option>

                      {safeProfiles.map(
                        (
                          profile: any,
                        ) => (
                          <option
                            key={
                              profile.id
                            }
                            value={
                              profile.id
                            }
                          >
                            {
                              profile.full_name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Prioridade *
                    </label>

                    <select
                      className="fi"
                      name="priority"
                      required
                      defaultValue={
                        editingProject
                          ?.priority ||
                        'normal'
                      }
                    >
                      <option value="low">
                        Baixa
                      </option>

                      <option value="normal">
                        Normal
                      </option>

                      <option value="high">
                        Alta
                      </option>

                      <option value="urgent">
                        Urgente
                      </option>
                    </select>
                  </div>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Início *
                    </label>

                    <input
                      className="fi"
                      type="date"
                      name="internal_deadline"
                      required
                      value={
                        formStart
                      }
                      onChange={(
                        event,
                      ) =>
                        setFormStart(
                          event.target
                            .value,
                        )
                      }
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Final *
                    </label>

                    <input
                      className="fi"
                      type="date"
                      name="final_deadline"
                      required
                      min={
                        formStart ||
                        undefined
                      }
                      value={
                        formFinal
                      }
                      onChange={(
                        event,
                      ) =>
                        setFormFinal(
                          event.target
                            .value,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">
                    Link do Drive
                  </label>

                  <input
                    className="fi"
                    type="url"
                    name="drive_link"
                    defaultValue={
                      editingProject
                        ?.drive_link ||
                      ''
                    }
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div className="fg">
                  <label className="fl">
                    Observação
                  </label>

                  <textarea
                    className="fi"
                    name="notes"
                    rows={4}
                    defaultValue={
                      editingProject
                        ?.notes ||
                      editingProject
                        ?.description ||
                      ''
                    }
                    placeholder="Contexto, entregáveis e orientações do projeto."
                  />
                </div>

                {error && (
                  <div className="notice notice-err">
                    <span>
                      {error}
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                {editingProject && (
                  <button
                    className="bsec danger-button"
                    type="button"
                    onClick={
                      archiveProject
                    }
                    disabled={
                      loading
                    }
                  >
                    Arquivar projeto
                  </button>
                )}

                <button
                  className="bsec"
                  type="button"
                  onClick={
                    closeProjectModal
                  }
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

      {stepModal &&
        stepProject && (
          <div
            className="modal-ov"
            onClick={() =>
              setStepModal(null)
            }
          >
            <div
              className="modal projects-v18-step-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-head">
                <div>
                  <div className="modal-title">
                    {stepModal ===
                    'edit'
                      ? 'Editar etapa'
                      : 'Nova etapa'}
                  </div>

                  <div className="modal-sub">
                    Projeto:{' '}
                    {
                      stepProject.title
                    }
                  </div>
                </div>

                <button
                  className="mclose"
                  type="button"
                  onClick={() =>
                    setStepModal(
                      null,
                    )
                  }
                >
                  <i className="ti ti-x" />
                </button>
              </div>

              <form
                onSubmit={
                  submitStep
                }
              >
                <div className="modal-body">
                  <input
                    type="hidden"
                    name="work_item_id"
                    value={
                      stepProject.id
                    }
                  />

                  <div className="fg">
                    <label className="fl">
                      Título *
                    </label>

                    <input
                      className="fi"
                      name="title"
                      required
                      minLength={2}
                      maxLength={140}
                      defaultValue={
                        editingStep
                          ?.title || ''
                      }
                      placeholder="Nome da etapa"
                    />
                  </div>

                  <div className="frow">
                    <div className="fg">
                      <label className="fl">
                        Responsável
                      </label>

                      <select
                        className="fi"
                        name="responsible_id"
                        defaultValue={
                          editingStep
                            ?.responsible_id ||
                          ''
                        }
                      >
                        <option value="">
                          Definir depois
                        </option>

                        {safeProfiles.map(
                          (
                            profile: any,
                          ) => (
                            <option
                              key={
                                profile.id
                              }
                              value={
                                profile.id
                              }
                            >
                              {
                                profile.full_name
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="fg">
                      <label className="fl">
                        Status *
                      </label>

                      <select
                        className="fi"
                        name="status_id"
                        required
                        defaultValue={
                          editingStep
                            ?.status_id ||
                          stepProject
                            .step_statuses
                            ?.[0]?.id ||
                          ''
                        }
                      >
                        {(
                          stepProject.step_statuses ||
                          []
                        ).map(
                          (
                            status: any,
                          ) => (
                            <option
                              key={
                                status.id
                              }
                              value={
                                status.id
                              }
                            >
                              {
                                status.name
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="frow">
                    <div className="fg">
                      <label className="fl">
                        Início *
                      </label>

                      <input
                        className="fi"
                        type="date"
                        name="start_date"
                        required
                        defaultValue={dateValue(
                          editingStep
                            ?.start_date,
                        )}
                      />
                    </div>

                    <div className="fg">
                      <label className="fl">
                        Final *
                      </label>

                      <input
                        className="fi"
                        type="date"
                        name="end_date"
                        required
                        defaultValue={dateValue(
                          editingStep
                            ?.end_date,
                        )}
                      />
                    </div>
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Observação
                    </label>

                    <textarea
                      className="fi"
                      name="notes"
                      rows={4}
                      defaultValue={
                        editingStep
                          ?.notes || ''
                      }
                      placeholder="Orientações e informações da etapa."
                    />
                  </div>

                  {error && (
                    <div className="notice notice-err">
                      <span>
                        {error}
                      </span>
                    </div>
                  )}
                </div>

                <div className="modal-foot">
                  <button
                    className="bsec"
                    type="button"
                    onClick={() =>
                      setStepModal(
                        null,
                      )
                    }
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

      {statusModal &&
        statusProject && (
          <div
            className="modal-ov"
            onClick={() =>
              setStatusModal(false)
            }
          >
            <div
              className="modal projects-v18-status-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-head">
                <div>
                  <div className="modal-title">
                    Status das etapas
                  </div>

                  <div className="modal-sub">
                    Projeto:{' '}
                    {
                      statusProject.title
                    }
                  </div>
                </div>

                <button
                  className="mclose"
                  type="button"
                  onClick={() =>
                    setStatusModal(
                      false,
                    )
                  }
                >
                  <i className="ti ti-x" />
                </button>
              </div>

              <div className="modal-body">
                <form
                  className="projects-v18-status-create"
                  onSubmit={
                    createStatus
                  }
                >
                  <div className="projects-v18-status-create-title">
                    Criar status
                  </div>

                  <input
                    className="fi"
                    name="name"
                    required
                    maxLength={48}
                    placeholder="Ex.: Revisão interna"
                  />

                  <input
                    className="projects-v18-color-input"
                    type="color"
                    name="color"
                    defaultValue="#7C3AED"
                    title="Cor do status"
                  />

                  <select
                    className="fi"
                    name="behavior"
                    defaultValue="pending"
                  >
                    {Object.entries(
                      BEHAVIOR_LABEL,
                    ).map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>

                  <button
                    className="bpri"
                    disabled={loading}
                  >
                    <i className="ti ti-plus" />
                    Criar
                  </button>
                </form>

                <div className="projects-v18-behavior-help">
                  <strong>
                    Comportamento
                    técnico
                  </strong>

                  <span>
                    O nome e a cor são
                    livres. O comportamento
                    serve apenas para
                    progresso, alertas e
                    conclusão automática.
                  </span>
                </div>

                <div className="projects-v18-status-manager">
                  {(
                    statusProject.step_statuses ||
                    []
                  ).map(
                    (
                      status: any,
                      index: number,
                    ) => {
                      const usage =
                        (
                          statusProject.steps ||
                          []
                        ).filter(
                          (
                            step: any,
                          ) =>
                            step.status_id ===
                            status.id,
                        ).length

                      const alternatives =
                        (
                          statusProject.step_statuses ||
                          []
                        ).filter(
                          (
                            option: any,
                          ) =>
                            option.id !==
                            status.id,
                        )

                      return (
                        <form
                          className="projects-v18-status-row"
                          key={
                            status.id
                          }
                          onSubmit={(
                            event,
                          ) =>
                            updateStatus(
                              event,
                              status.id,
                            )
                          }
                        >
                          <div className="projects-v18-status-order">
                            <button
                              className="icon-btn"
                              type="button"
                              disabled={
                                index === 0
                              }
                              title="Mover para cima"
                              onClick={() =>
                                moveStatus(
                                  status.id,
                                  'up',
                                )
                              }
                            >
                              <i className="ti ti-chevron-up" />
                            </button>

                            <button
                              className="icon-btn"
                              type="button"
                              disabled={
                                index ===
                                (
                                  statusProject.step_statuses ||
                                  []
                                ).length -
                                  1
                              }
                              title="Mover para baixo"
                              onClick={() =>
                                moveStatus(
                                  status.id,
                                  'down',
                                )
                              }
                            >
                              <i className="ti ti-chevron-down" />
                            </button>
                          </div>

                          <input
                            className="projects-v18-color-input"
                            type="color"
                            name="color"
                            defaultValue={
                              status.color
                            }
                            title="Cor do status"
                          />

                          <input
                            className="fi"
                            name="name"
                            required
                            maxLength={48}
                            defaultValue={
                              status.name
                            }
                          />

                          <select
                            className="fi"
                            name="behavior"
                            defaultValue={
                              status.behavior
                            }
                          >
                            {Object.entries(
                              BEHAVIOR_LABEL,
                            ).map(
                              ([
                                value,
                                label,
                              ]) => (
                                <option
                                  key={
                                    value
                                  }
                                  value={
                                    value
                                  }
                                >
                                  {label}
                                </option>
                              ),
                            )}
                          </select>

                          <span
                            className="projects-v18-status-usage"
                            style={{
                              color:
                                status.color,
                              background:
                                rgba(
                                  status.color,
                                  0.09,
                                ),
                            }}
                          >
                            {usage}{' '}
                            etapa(s)
                          </span>

                          <button
                            className="bsec"
                            disabled={
                              loading
                            }
                          >
                            Salvar
                          </button>

                          <select
                            className="fi projects-v18-replacement"
                            value={
                              replacementByStatus[
                                status.id
                              ] || ''
                            }
                            onChange={(
                              event,
                            ) =>
                              setReplacementByStatus(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [
                                    status.id
                                  ]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                            disabled={
                              usage === 0
                            }
                            title="Destino das etapas ao excluir"
                          >
                            <option value="">
                              {usage > 0
                                ? 'Transferir para...'
                                : 'Sem etapas vinculadas'}
                            </option>

                            {alternatives.map(
                              (
                                option: any,
                              ) => (
                                <option
                                  key={
                                    option.id
                                  }
                                  value={
                                    option.id
                                  }
                                >
                                  {
                                    option.name
                                  }
                                </option>
                              ),
                            )}
                          </select>

                          <button
                            className="icon-btn danger-button"
                            type="button"
                            title="Excluir status"
                            onClick={() =>
                              deleteStatus(
                                status.id,
                              )
                            }
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </form>
                      )
                    },
                  )}
                </div>

                {error && (
                  <div className="notice notice-err">
                    <span>
                      {error}
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                <button
                  className="bpri"
                  type="button"
                  onClick={() =>
                    setStatusModal(
                      false,
                    )
                  }
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
