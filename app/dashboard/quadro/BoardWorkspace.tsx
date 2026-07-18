'use client'

import {
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react'
import {
  createBoardAction,
  createBoardColumnAction,
  createBoardColumnDemandAction,
  deleteBoardAction,
  deleteBoardColumnAction,
  deleteWorkItemAction,
  moveBoardCardAction,
  reorderBoardColumnsAction,
  updateBoardAction,
  updateBoardColumnAction,
  updateBoardColumnDemandAction,
} from '@/lib/actions'

const BOARD_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#0891B2',
  '#16A34A',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#64748B',
] as const

const COLUMN_COLORS = [
  '#64748B',
  '#2563EB',
  '#0891B2',
  '#7C3AED',
  '#16A34A',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
] as const

const STATUS_OPTIONS = [
  ['not_started', 'Não iniciada'],
  ['in_progress', 'Em andamento'],
  ['waiting', 'Aguardando'],
  ['blocked', 'Bloqueada'],
  ['in_review', 'Em revisão'],
  ['awaiting_approval', 'Ag. aprovação'],
  ['approved', 'Aprovada'],
  ['scheduled', 'Programada'],
  ['delivered', 'Entregue'],
  ['done', 'Concluída'],
] as const

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

function dateValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

function formatDate(value?: string | null) {
  return value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`)
        .toLocaleDateString('pt-BR')
    : 'Sem prazo'
}

function cardTone(item: any) {
  const status = String(item.status || '')
  const deadline = dateValue(
    item.final_deadline || item.internal_deadline,
  )
  const today = new Date().toISOString().slice(0, 10)

  if (['done', 'delivered', 'approved'].includes(status)) {
    return 'success'
  }

  if (
    (deadline && deadline < today) ||
    ['blocked', 'cancelled'].includes(status)
  ) {
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
  columns = [],
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
  const [boardColumns, setBoardColumns] = useState<any[]>(
    Array.isArray(columns) ? columns : [],
  )
  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState('all')
  const [responsibleId, setResponsibleId] = useState('all')
  const [dragCardId, setDragCardId] =
    useState<string | null>(null)
  const [dragColumnId, setDragColumnId] =
    useState<string | null>(null)
  const [demandModal, setDemandModal] = useState<
    'create' | 'edit' | null
  >(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [selectedColumnId, setSelectedColumnId] =
    useState('')
  const [formClient, setFormClient] = useState('')
  const [boardCreateOpen, setBoardCreateOpen] =
    useState(false)
  const [deleteColumn, setDeleteColumn] =
    useState<any | null>(null)
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

  function cardsInColumn(columnId: string) {
    return filtered.filter(
      (item: any) => item.board_column_id === columnId,
    )
  }

  function openCreateDemand(columnId: string) {
    setEditing(null)
    setSelectedColumnId(columnId)
    setFormClient('')
    setError('')
    setDemandModal('create')
  }

  function openEditDemand(item: any) {
    setEditing(item)
    setSelectedColumnId(item.board_column_id || '')
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
        ? await updateBoardColumnDemandAction(
            editing.id,
            formData,
          )
        : await createBoardColumnDemandAction(formData)

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível salvar a demanda.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function archiveDemand() {
    if (!editing) return

    if (!confirm('Arquivar esta demanda?')) return

    setLoading(true)

    const result = await deleteWorkItemAction(editing.id)

    if ('error' in result) {
      setError(result.error || 'Erro ao arquivar demanda.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function moveCard(
    cardId: string | null,
    columnId: string,
  ) {
    if (!cardId) return

    const targetColumn = boardColumns.find(
      (column) => column.id === columnId,
    )

    if (!targetColumn) return

    const previous = items

    setItems((current) =>
      current.map((item) =>
        item.id === cardId
          ? {
              ...item,
              board_column_id: columnId,
              status: targetColumn.operational_status,
            }
          : item,
      ),
    )

    const result = await moveBoardCardAction(
      cardId,
      columnId,
    )

    if ('error' in result) {
      setItems(previous)
      alert(result.error)
    }

    setDragCardId(null)
  }

  async function submitBoard(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    formData.set('status', 'active')
    formData.set('description', '')

    const result = await createBoardAction(formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao criar Quadro.')
      setLoading(false)
      return
    }

    if ('id' in result && result.id) {
      window.location.href =
        `/dashboard/quadro?board=${result.id}`
      return
    }

    window.location.reload()
  }

  async function saveBoard(
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
      setError(result.error || 'Erro ao atualizar Quadro.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function renameBoard() {
    if (!activeBoard) return

    const nextName = prompt(
      'Novo nome do Quadro:',
      activeBoard.name,
    )?.trim()

    if (!nextName || nextName === activeBoard.name) return

    await saveBoard(
      nextName,
      activeBoard.color || '#2563EB',
    )
  }

  async function removeBoard() {
    if (!activeBoard) return

    const confirmed = confirm(
      `Excluir o Quadro "${activeBoard.name}"?\n\n` +
        'As demandas não serão apagadas.',
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

  async function createColumn() {
    if (!activeBoard) return

    const name = prompt('Nome da nova coluna:')?.trim()

    if (!name) return

    const formData = new FormData()
    formData.set('board_id', activeBoard.id)
    formData.set('name', name)
    formData.set('color', '#64748B')
    formData.set('operational_status', 'not_started')

    setLoading(true)
    setError('')

    const result = await createBoardColumnAction(formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao criar coluna.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function updateColumn(
    column: any,
    patch: Partial<{
      name: string
      color: string
      operational_status: string
    }>,
  ) {
    const formData = new FormData()
    formData.set('name', patch.name ?? column.name)
    formData.set('color', patch.color ?? column.color)
    formData.set(
      'operational_status',
      patch.operational_status ??
        column.operational_status,
    )

    setLoading(true)
    setError('')

    const result = await updateBoardColumnAction(
      column.id,
      formData,
    )

    if ('error' in result) {
      setError(result.error || 'Erro ao editar coluna.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function renameColumn(column: any) {
    const nextName = prompt(
      'Novo nome da coluna:',
      column.name,
    )?.trim()

    if (!nextName || nextName === column.name) return

    await updateColumn(column, { name: nextName })
  }

  async function persistColumnOrder(next: any[]) {
    const previous = boardColumns
    setBoardColumns(next)

    const result = await reorderBoardColumnsAction(
      activeBoardId,
      next.map((column) => column.id),
    )

    if ('error' in result) {
      setBoardColumns(previous)
      alert(result.error)
    }
  }

  async function moveColumn(
    columnId: string,
    direction: -1 | 1,
  ) {
    const index = boardColumns.findIndex(
      (column) => column.id === columnId,
    )
    const target = index + direction

    if (index < 0 || target < 0 || target >= boardColumns.length) {
      return
    }

    const next = [...boardColumns]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)

    await persistColumnOrder(next)
  }

  async function dropColumn(targetColumnId: string) {
    if (!dragColumnId || dragColumnId === targetColumnId) {
      setDragColumnId(null)
      return
    }

    const sourceIndex = boardColumns.findIndex(
      (column) => column.id === dragColumnId,
    )
    const targetIndex = boardColumns.findIndex(
      (column) => column.id === targetColumnId,
    )

    if (sourceIndex < 0 || targetIndex < 0) return

    const next = [...boardColumns]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)

    setDragColumnId(null)
    await persistColumnOrder(next)
  }

  async function confirmDeleteColumn(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!deleteColumn) return

    const formData = new FormData(event.currentTarget)
    const targetColumnId =
      String(formData.get('target_column_id') || '') ||
      null

    setLoading(true)
    setError('')

    const result = await deleteBoardColumnAction(
      deleteColumn.id,
      targetColumnId,
    )

    if ('error' in result) {
      setError(result.error || 'Erro ao excluir coluna.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  return (
    <div className="page-wrap ops-page board-a14-page">
      <div className="topbar">
        <div>
          <div className="tb-title">Quadro</div>
          <div className="tb-sub">
            Quadros e colunas configuráveis por fluxo operacional.
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
      </div>

      <div className="board-a14-toolbar">
        <div className="board-a14-selector">
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
          <button
            className="board-a14-icon"
            type="button"
            title="Novo Quadro"
            onClick={() => {
              setError('')
              setBoardCreateOpen(true)
            }}
          >
            <i className="ti ti-plus" />
          </button>
        )}

        {canManage && activeBoard && (
          <details className="board-a14-menu">
            <summary
              className="board-a14-icon"
              title="Opções do Quadro"
            >
              <i className="ti ti-dots" />
            </summary>

            <div className="board-a14-menu-popover">
              <button type="button" onClick={renameBoard}>
                <i className="ti ti-edit" />
                Renomear
              </button>

              <div className="board-a14-menu-label">
                Cor da borda
              </div>

              <div className="board-a14-palette">
                {BOARD_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={
                      activeBoard.color === color
                        ? 'board-a14-swatch selected'
                        : 'board-a14-swatch'
                    }
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      saveBoard(activeBoard.name, color)
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

      {activeBoard && (
        <div
          className="board-a14-heading"
          style={{
            borderLeftColor:
              activeBoard.color || '#2563EB',
          }}
        >
          <div>
            <strong>{activeBoard.name}</strong>
            <span>
              {boardColumns.length} coluna(s) • {filtered.length}{' '}
              demanda(s)
            </span>
          </div>

          {canManage && (
            <button
              className="bsec"
              type="button"
              onClick={createColumn}
            >
              <i className="ti ti-column-insert-right" />
              Nova coluna
            </button>
          )}
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
            Crie o primeiro Quadro para iniciar a operação.
          </div>
        </div>
      ) : (
        <div
          className="board-a14-canvas"
          style={{
            borderColor:
              activeBoard.color || '#2563EB',
          }}
        >
          {boardColumns.map((column: any, index: number) => {
            const columnItems = cardsInColumn(column.id)

            return (
              <section
                className="board-a14-column"
                key={column.id}
                style={{
                  borderTopColor:
                    column.color || '#64748B',
                }}
              >
                <header
                  className="board-a14-column-head"
                  onDragOver={(event) =>
                    event.preventDefault()
                  }
                  onDrop={() => dropColumn(column.id)}
                >
                  <button
                    className="board-a14-column-grip"
                    type="button"
                    title="Arrastar coluna"
                    draggable={canManage}
                    onDragStart={(event) => {
                      event.stopPropagation()
                      setDragColumnId(column.id)
                    }}
                    onDragEnd={() => setDragColumnId(null)}
                  >
                    <i className="ti ti-grip-vertical" />
                  </button>

                  <div className="board-a14-column-title">
                    <span
                      style={{
                        backgroundColor:
                          column.color || '#64748B',
                      }}
                    />
                    <div>
                      <strong>{column.name}</strong>
                      <small>{columnItems.length} card(s)</small>
                    </div>
                  </div>

                  <button
                    className="board-a14-column-icon"
                    type="button"
                    title="Nova demanda nesta coluna"
                    onClick={() =>
                      openCreateDemand(column.id)
                    }
                  >
                    <i className="ti ti-plus" />
                  </button>

                  {canManage && (
                    <details className="board-a14-column-menu">
                      <summary
                        className="board-a14-column-icon"
                        title="Editar coluna"
                      >
                        <i className="ti ti-dots-vertical" />
                      </summary>

                      <div className="board-a14-column-popover">
                        <button
                          type="button"
                          onClick={() => renameColumn(column)}
                        >
                          <i className="ti ti-edit" />
                          Renomear
                        </button>

                        <div className="board-a14-menu-label">
                          Cor da coluna
                        </div>

                        <div className="board-a14-palette">
                          {COLUMN_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={
                                column.color === color
                                  ? 'board-a14-swatch selected'
                                  : 'board-a14-swatch'
                              }
                              style={{
                                backgroundColor: color,
                              }}
                              onClick={() =>
                                updateColumn(column, { color })
                              }
                            />
                          ))}
                        </div>

                        <label className="board-a14-status-field">
                          <span>Status operacional</span>
                          <select
                            className="fi compact"
                            value={column.operational_status}
                            onChange={(event) =>
                              updateColumn(column, {
                                operational_status:
                                  event.target.value,
                              })
                            }
                          >
                            {STATUS_OPTIONS.map(
                              ([value, label]) => (
                                <option
                                  key={value}
                                  value={value}
                                >
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>

                        <div className="board-a14-order-actions">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              moveColumn(column.id, -1)
                            }
                          >
                            <i className="ti ti-arrow-left" />
                            Esquerda
                          </button>

                          <button
                            type="button"
                            disabled={
                              index ===
                              boardColumns.length - 1
                            }
                            onClick={() =>
                              moveColumn(column.id, 1)
                            }
                          >
                            Direita
                            <i className="ti ti-arrow-right" />
                          </button>
                        </div>

                        <button
                          className="danger-option"
                          type="button"
                          disabled={boardColumns.length <= 1}
                          onClick={() =>
                            setDeleteColumn(column)
                          }
                        >
                          <i className="ti ti-trash" />
                          Excluir coluna
                        </button>
                      </div>
                    </details>
                  )}
                </header>

                <div
                  className="board-a14-column-scroll"
                  onDragOver={(event) =>
                    event.preventDefault()
                  }
                  onDrop={() =>
                    moveCard(dragCardId, column.id)
                  }
                >
                  {columnItems.map((item: any) => (
                    <article
                      key={item.id}
                      className="board-a14-card"
                      data-tone={cardTone(item)}
                      draggable
                      onDragStart={(event) => {
                        event.stopPropagation()
                        setDragCardId(item.id)
                      }}
                      onDragEnd={() => setDragCardId(null)}
                      onClick={() => openEditDemand(item)}
                    >
                      <div className="board-a14-card-top">
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

                      <div className="board-a14-card-meta">
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
                    <div className="board-a14-column-empty">
                      Solte um card aqui
                    </div>
                  )}
                </div>
              </section>
            )
          })}

          {canManage && (
            <button
              className="board-a14-add-column"
              type="button"
              onClick={createColumn}
            >
              <i className="ti ti-plus" />
              Adicionar coluna
            </button>
          )}
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
                    ? 'Editar demanda'
                    : 'Nova demanda'}
                </div>
                <div className="modal-sub">
                  O card permanece sincronizado com Demandas.
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
                    <label className="fl">Coluna *</label>
                    <select
                      className="fi"
                      name="board_column_id"
                      required
                      value={selectedColumnId}
                      onChange={(event) =>
                        setSelectedColumnId(
                          event.target.value,
                        )
                      }
                    >
                      {boardColumns.map((column) => (
                        <option
                          key={column.id}
                          value={column.id}
                        >
                          {column.name}
                        </option>
                      ))}
                    </select>
                  </div>

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
                </div>

                <div className="frow">
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
                </div>

                <div className="frow">
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
                </div>

                <div className="frow">
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

      {boardCreateOpen && (
        <div
          className="modal-ov"
          onClick={() => setBoardCreateOpen(false)}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">Novo Quadro</div>
                <div className="modal-sub">
                  O novo Quadro receberá colunas iniciais
                  editáveis.
                </div>
              </div>
              <button
                className="mclose"
                type="button"
                onClick={() => setBoardCreateOpen(false)}
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
                  />
                </div>

                <div className="fg">
                  <label className="fl">Cor da borda</label>
                  <input
                    className="fi context-color-input"
                    type="color"
                    name="color"
                    defaultValue="#2563EB"
                  />
                </div>
              </div>

              <div className="modal-foot">
                <button
                  className="bsec"
                  type="button"
                  onClick={() => setBoardCreateOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="bpri"
                  disabled={loading}
                >
                  {loading ? 'Criando...' : 'Criar Quadro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteColumn && (
        <div
          className="modal-ov"
          onClick={() => setDeleteColumn(null)}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  Excluir coluna
                </div>
                <div className="modal-sub">
                  Os cards nunca serão apagados.
                </div>
              </div>
              <button
                className="mclose"
                type="button"
                onClick={() => setDeleteColumn(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={confirmDeleteColumn}>
              <div className="modal-body">
                <div className="notice notice-warn">
                  <span>
                    Coluna: <b>{deleteColumn.name}</b> •{' '}
                    {cardsInColumn(deleteColumn.id).length}{' '}
                    card(s)
                  </span>
                </div>

                {cardsInColumn(deleteColumn.id).length > 0 && (
                  <div className="fg">
                    <label className="fl">
                      Mover cards para *
                    </label>
                    <select
                      className="fi"
                      name="target_column_id"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Escolha a coluna de destino
                      </option>
                      {boardColumns
                        .filter(
                          (column) =>
                            column.id !== deleteColumn.id,
                        )
                        .map((column) => (
                          <option
                            key={column.id}
                            value={column.id}
                          >
                            {column.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                <button
                  className="bsec"
                  type="button"
                  onClick={() => setDeleteColumn(null)}
                >
                  Cancelar
                </button>
                <button
                  className="bpri danger-button"
                  disabled={loading}
                >
                  Excluir coluna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
