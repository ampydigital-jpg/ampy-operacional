'use client'

import {
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react'
import {
  createBoardAction,
  createBoardDemandAction,
  deleteBoardAction,
  deleteWorkItemAction,
  updateBoardAction,
  updateContextWorkItemAction,
  updateWorkItemStatusAction,
} from '@/lib/actions'

const COLUMNS = [
  ['not_started', 'Não iniciada'],
  ['in_progress', 'Em andamento'],
  ['waiting', 'Aguardando'],
  ['blocked', 'Bloqueada'],
  ['in_review', 'Em revisão'],
  ['awaiting_approval', 'Ag. aprovação'],
  ['scheduled', 'Programada'],
  ['delivered', 'Entregue'],
  ['done', 'Concluída'],
]

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

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
}

const BOARD_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#0891B2',
  '#16A34A',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#475467',
] as const

function dateValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

function formatDate(value?: string | null) {
  return value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`)
        .toLocaleDateString('pt-BR')
    : 'Sem prazo'
}

function tone(item: any) {
  const status = String(item.status || '')
  const deadline = dateValue(
    item.final_deadline || item.internal_deadline,
  )
  const today = new Date().toISOString().slice(0, 10)

  if (['done', 'delivered', 'approved'].includes(status)) {
    return 'success'
  }

  if (deadline && deadline < today) return 'danger'

  if (['blocked', 'cancelled'].includes(status)) {
    return 'danger'
  }

  if (
    [
      'not_started',
      'waiting',
      'awaiting_approval',
      'scheduled',
    ].includes(status)
  ) {
    return 'warning'
  }

  return 'default'
}

export default function BoardWorkspace({
  boards = [],
  activeBoardId = '',
  demands = [],
  clients = [],
  profiles = [],
  clientServices = [],
  canManage = false,
  loadErrors = [],
}: any) {
  const [items, setItems] = useState<any[]>(
    Array.isArray(demands) ? demands : [],
  )
  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState('all')
  const [responsibleId, setResponsibleId] = useState('all')
  const [dragId, setDragId] = useState<string | null>(null)
  const [demandModal, setDemandModal] = useState<
    'create' | 'edit' | null
  >(null)
  const [boardModal, setBoardModal] = useState<
    'create' | 'edit' | null
  >(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [formClient, setFormClient] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeBoard =
    boards.find((board: any) => board.id === activeBoardId) ||
    null

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return items.filter((item: any) => {
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
          item.responsible_id === responsibleId)
      )
    })
  }, [items, query, clientId, responsibleId])

  const activeServices = formClient
    ? clientServices.filter(
        (service: any) =>
          service.client_id === formClient &&
          service.status === 'active',
      )
    : []

  function openCreateDemand() {
    if (!activeBoard) {
      setError('Crie ou selecione um Quadro antes.')
      return
    }

    setEditing(null)
    setFormClient('')
    setError('')
    setDemandModal('create')
  }

  function openEditDemand(item: any) {
    setEditing(item)
    setFormClient(item.client_id || '')
    setError('')
    setDemandModal('edit')
  }

  async function submitDemand(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)

    const result =
      demandModal === 'edit' && editing
        ? await updateContextWorkItemAction(
            editing.id,
            formData,
          )
        : await createBoardDemandAction(formData)

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível salvar a demanda do Quadro.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function archiveDemand() {
    if (!editing) return

    if (
      !confirm(
        'Arquivar esta demanda? Ela sairá das visões operacionais.',
      )
    ) {
      return
    }

    setLoading(true)

    const result = await deleteWorkItemAction(editing.id)

    if ('error' in result) {
      setError(result.error || 'Erro ao arquivar demanda.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function moveStatus(
    id: string | null,
    status: string,
  ) {
    if (!id) return

    const previous = items
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    )

    const result = await updateWorkItemStatusAction(
      id,
      status,
    )

    if ('error' in result) {
      setItems(previous)
      alert(result.error)
    }

    setDragId(null)
  }

  function allowDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
  }

  async function submitBoard(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)

    const result =
      boardModal === 'edit' && activeBoard
        ? await updateBoardAction(activeBoard.id, formData)
        : await createBoardAction(formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao salvar Quadro.')
      setLoading(false)
      return
    }

    if (
      boardModal === 'create' &&
      'id' in result &&
      result.id
    ) {
      window.location.href = `/dashboard/quadro?board=${result.id}`
      return
    }

    window.location.reload()
  }

  async function saveCompactBoardUpdate(
    name: string,
    color: string,
  ) {
    if (!activeBoard) return

    const formData = new FormData()

    formData.set('name', name)
    formData.set(
      'description',
      activeBoard.description || '',
    )
    formData.set('color', color)
    formData.set('status', 'active')

    setLoading(true)
    setError('')

    const result = await updateBoardAction(
      activeBoard.id,
      formData,
    )

    if ('error' in result) {
      setError(
        result.error || 'Erro ao atualizar Quadro.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function renameBoard() {
    if (!activeBoard) return

    const nextName = window
      .prompt(
        'Novo nome do Quadro:',
        activeBoard.name,
      )
      ?.trim()

    if (
      !nextName ||
      nextName === activeBoard.name
    ) {
      return
    }

    await saveCompactBoardUpdate(
      nextName,
      activeBoard.color || '#2563EB',
    )
  }

  async function changeBoardColor(
    color: string,
  ) {
    if (!activeBoard) return

    await saveCompactBoardUpdate(
      activeBoard.name,
      color,
    )
  }

  async function removeBoard() {
    if (!activeBoard) return

    const confirmed = confirm(
      `Excluir o Quadro "${activeBoard.name}"?\n\nAs demandas não serão apagadas. Somente o vínculo com este Quadro será removido.`,
    )

    if (!confirmed) return

    setLoading(true)
    setError('')

    const result = await deleteBoardAction(activeBoard.id)

    if ('error' in result) {
      setError(result.error || 'Erro ao excluir Quadro.')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard/quadro'
  }

  return (
    <div className="page-wrap ops-page contextual-board-page">
      <div className="topbar">
        <div>
          <div className="tb-title">Quadro</div>
          <div className="tb-sub">
            Criação e edição acontecem dentro do Quadro ativo.
          </div>
        </div>

        <div className="sbox">
          <i className="ti ti-search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar demanda ou cliente."
          />
        </div>

        <button
          className="bpri"
          type="button"
          onClick={openCreateDemand}
          disabled={!activeBoard}
        >
          <i className="ti ti-plus" />
          Nova demanda
        </button>
      </div>

      <div className="board-context-toolbar">
        <div className="board-context-selector">
          <span>Quadro ativo</span>
          <select
            className="fi compact"
            value={activeBoardId}
            onChange={(event) => {
              window.location.href =
                `/dashboard/quadro?board=${event.target.value}`
            }}
          >
            {!boards.length && (
              <option value="">Nenhum Quadro cadastrado</option>
            )}
            {boards.map((board: any) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>

        <select
          className="fi compact"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        >
          <option value="all">Todos os clientes</option>
          {clients.map((client: any) => (
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
          {profiles.map((profile: any) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </select>

        {canManage && (
          <div className="board-context-actions">
            <button
              className="bsec"
              type="button"
              onClick={() => {
                setError('')
                setBoardModal('create')
              }}
            >
              <i className="ti ti-layout-kanban-add" />
              Novo Quadro
            </button>

            <button
              className="bsec"
              type="button"
              disabled={!activeBoard}
              onClick={() => {
                setError('')
                setBoardModal('edit')
              }}
            >
              <i className="ti ti-edit" />
              Editar Quadro
            </button>

            <button
              className="bsec danger-button"
              type="button"
              disabled={!activeBoard || loading}
              onClick={removeBoard}
            >
              <i className="ti ti-trash" />
              Excluir Quadro
            </button>
          </div>
        )}
      </div>

      {activeBoard && (
        <div
          className="board-context-heading"
          style={{
            borderLeftColor: activeBoard.color || '#2563EB',
          }}
        >
          <div>
            <strong>{activeBoard.name}</strong>
            <span>
              {activeBoard.description ||
                'Sem descrição operacional.'}
            </span>
          </div>
          <div className="board-jira-heading-actions">
            <span className="badge bblue">
              {filtered.length} demanda(s)
            </span>

            {canManage && (
              <button
                className="board-jira-icon"
                type="button"
                title="Novo Quadro"
                aria-label="Novo Quadro"
                onClick={() => {
                  setError('')
                  setBoardModal('create')
                }}
              >
                <i className="ti ti-plus" />
              </button>
            )}

            {canManage && (
              <details className="board-jira-menu">
                <summary
                  className="board-jira-icon"
                  title="Opções do Quadro"
                  aria-label="Opções do Quadro"
                >
                  <i className="ti ti-dots" />
                </summary>

                <div className="board-jira-menu-popover">
                  <button
                    type="button"
                    onClick={renameBoard}
                  >
                    <i className="ti ti-edit" />
                    Renomear
                  </button>

                  <div className="board-jira-color-title">
                    Cor da borda
                  </div>

                  <div className="board-jira-color-grid">
                    {BOARD_COLORS.map((color) => (
                      <button
                        key={color}
                        className={
                          activeBoard?.color === color
                            ? 'board-jira-swatch selected'
                            : 'board-jira-swatch'
                        }
                        type="button"
                        title={`Usar cor ${color}`}
                        aria-label={`Usar cor ${color}`}
                        style={{
                          backgroundColor: color,
                        }}
                        onClick={() =>
                          changeBoardColor(color)
                        }
                      />
                    ))}
                  </div>

                  <button
                    className="danger-option"
                    type="button"
                    onClick={removeBoard}
                  >
                    <i className="ti ti-trash" />
                    Excluir Quadro
                  </button>
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {loadErrors.length > 0 && (
        <div className="notice notice-err">
          <i className="ti ti-alert-circle" />
          <span>{loadErrors.join(' • ')}</span>
        </div>
      )}

      {error && (
        <div className="notice notice-err">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
        </div>
      )}

      {!activeBoard ? (
        <div className="empty">
          <i className="ti ti-layout-kanban" />
          <div className="empty-title">
            Nenhum Quadro ativo
          </div>
          <div className="empty-sub">
            Um usuário com Acesso Total precisa criar o primeiro
            Quadro.
          </div>
        </div>
      ) : (
        <div
          className="context-kanban"
          style={{
            borderTopColor:
              activeBoard?.color || '#2563EB',
          }}
        >
          {COLUMNS.map(([status, label]) => {
            const columnItems = filtered.filter(
              (item: any) => item.status === status,
            )

            return (
              <div
                className="context-kanban-column"
                key={status}
                onDragOver={allowDrop}
                onDrop={() => moveStatus(dragId, status)}
              >
                <div className="context-kanban-head">
                  <span>{label}</span>
                  <b>{columnItems.length}</b>
                </div>

                <div className="context-kanban-list">
                  {columnItems.map((item: any) => (
                    <article
                      key={item.id}
                      className="context-kanban-card"
                      data-tone={tone(item)}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      onClick={() => openEditDemand(item)}
                    >
                      <div className="context-card-top">
                        <span
                          className={`priority-dot ${item.priority}`}
                        />
                        <span>
                          {PRIORITY_LABEL[item.priority] ||
                            'Normal'}
                        </span>
                      </div>

                      <h3>{item.title}</h3>

                      <p>
                        {item.client?.name || 'Interno Ampy'}
                        {' • '}
                        {item.type || 'Demanda'}
                      </p>

                      <div className="context-card-meta">
                        <span>
                          <i className="ti ti-user" />
                          {item.responsible?.full_name ||
                            'Sem responsável'}
                        </span>
                        <span>
                          <i className="ti ti-calendar" />
                          {formatDate(
                            item.final_deadline ||
                              item.internal_deadline,
                          )}
                        </span>
                      </div>
                    </article>
                  ))}

                  {!columnItems.length && (
                    <div className="context-kanban-empty">
                      Solte um card aqui
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {demandModal && (
        <div
          className="modal-ov"
          onClick={() => setDemandModal(null)}
        >
          <div
            className="modal context-modal-wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {demandModal === 'edit'
                    ? 'Editar demanda do Quadro'
                    : 'Nova demanda no Quadro'}
                </div>
                <div className="modal-sub">
                  O registro também aparecerá na listagem geral de
                  Demandas.
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() => setDemandModal(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={submitDemand}>
              <div className="modal-body">
                <input
                  type="hidden"
                  name="context"
                  value="board"
                />

                <div className="fg">
                  <label className="fl">Título *</label>
                  <input
                    className="fi"
                    name="title"
                    required
                    defaultValue={editing?.title || ''}
                  />
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Quadro *</label>
                    <select
                      className="fi"
                      name="board_id"
                      required
                      defaultValue={
                        editing?.board_id || activeBoardId
                      }
                    >
                      {boards.map((board: any) => (
                        <option key={board.id} value={board.id}>
                          {board.name}
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
                        editing?.status || 'not_started'
                      }
                    >
                      {COLUMNS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Cliente</label>
                    <select
                      className="fi"
                      name="client_id"
                      value={formClient}
                      onChange={(event) =>
                        setFormClient(event.target.value)
                      }
                    >
                      <option value="">Interno Ampy</option>
                      {clients.map((client: any) => (
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
                    <label className="fl">Serviço</label>
                    <select
                      className="fi"
                      name="client_service_id"
                      defaultValue={
                        editing?.client_service_id || ''
                      }
                    >
                      <option value="">
                        Sem serviço específico
                      </option>
                      {activeServices.map((service: any) => (
                        <option
                          key={service.id}
                          value={service.id}
                        >
                          {service.service?.name || 'Serviço'}
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
                        editing?.type || 'Planejamento'
                      }
                    >
                      {TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">Responsável</label>
                    <select
                      className="fi"
                      name="responsible_id"
                      defaultValue={
                        editing?.responsible_id || ''
                      }
                    >
                      <option value="">Definir depois</option>
                      {profiles.map((profile: any) => (
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
                    <label className="fl">Prioridade</label>
                    <select
                      className="fi"
                      name="priority"
                      defaultValue={
                        editing?.priority || 'normal'
                      }
                    >
                      <option value="low">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Prazo interno
                    </label>
                    <input
                      className="fi"
                      type="date"
                      name="internal_deadline"
                      defaultValue={dateValue(
                        editing?.internal_deadline,
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
                        editing?.final_deadline,
                      )}
                    />
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">Descrição</label>
                  <textarea
                    className="fi"
                    name="description"
                    defaultValue={editing?.description || ''}
                  />
                </div>

                <div className="fg">
                  <label className="fl">Link do Drive</label>
                  <input
                    className="fi"
                    type="url"
                    name="drive_link"
                    defaultValue={editing?.drive_link || ''}
                  />
                </div>

                <div className="fg">
                  <label className="fl">Observações</label>
                  <textarea
                    className="fi"
                    name="notes"
                    defaultValue={editing?.notes || ''}
                  />
                </div>

                {editing?.status === 'blocked' && (
                  <div className="fg">
                    <label className="fl">
                      Motivo do bloqueio
                    </label>
                    <textarea
                      className="fi"
                      name="blocked_reason"
                      defaultValue={
                        editing?.blocked_reason || ''
                      }
                    />
                  </div>
                )}

                {error && (
                  <div className="notice notice-err">
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                {editing && (
                  <button
                    className="bsec danger-button"
                    type="button"
                    onClick={archiveDemand}
                    disabled={loading}
                  >
                    Arquivar
                  </button>
                )}

                <button
                  className="bsec"
                  type="button"
                  onClick={() => setDemandModal(null)}
                >
                  Cancelar
                </button>

                <button
                  className="bpri"
                  disabled={loading}
                >
                  {loading
                    ? 'Salvando...'
                    : editing
                      ? 'Salvar demanda'
                      : 'Criar demanda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {boardModal && (
        <div
          className="modal-ov"
          onClick={() => setBoardModal(null)}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {boardModal === 'edit'
                    ? 'Editar Quadro'
                    : 'Novo Quadro'}
                </div>
                <div className="modal-sub">
                  Nome, descrição, cor e situação operacional.
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() => setBoardModal(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={submitBoard}>
              <div className="modal-body">
                <div className="fg">
                  <label className="fl">Nome *</label>
                  <input
                    className="fi"
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={
                      boardModal === 'edit'
                        ? activeBoard?.name || ''
                        : ''
                    }
                  />
                </div>

                <div className="fg">
                  <label className="fl">Descrição</label>
                  <textarea
                    className="fi"
                    name="description"
                    defaultValue={
                      boardModal === 'edit'
                        ? activeBoard?.description || ''
                        : ''
                    }
                  />
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Cor</label>
                    <input
                      className="fi context-color-input"
                      type="color"
                      name="color"
                      defaultValue={
                        boardModal === 'edit'
                          ? activeBoard?.color || '#2563EB'
                          : '#2563EB'
                      }
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">Status</label>
                    <select
                      className="fi"
                      name="status"
                      defaultValue={
                        boardModal === 'edit'
                          ? activeBoard?.status || 'active'
                          : 'active'
                      }
                    >
                      <option value="active">Ativo</option>
                      <option value="archived">
                        Arquivado
                      </option>
                    </select>
                  </div>
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
                  onClick={() => setBoardModal(null)}
                >
                  Cancelar
                </button>

                <button
                  className="bpri"
                  disabled={loading}
                >
                  {loading
                    ? 'Salvando...'
                    : boardModal === 'edit'
                      ? 'Salvar Quadro'
                      : 'Criar Quadro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
