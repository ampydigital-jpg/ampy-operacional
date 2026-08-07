
'use client'

import Link from 'next/link'

// AMPY-V17-A23-1-5B-REFINO-SEGURO

// AMPY-V17-A23.1.4-LAYOUT-CANONICO

// AMPY-V17-A23.1 — TAGS E CORES DAS DEMANDAS

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react'

import {
  createBoardAction,
  createBoardColumnAction,
  createPautaDemandAction,
  changePautaLifecycleAction,
  deleteBoardAction,
  deleteBoardColumnAction,
  deleteWorkItemAction,
  moveBoardCardAction,
  moveWorkItemBoardAssignmentAction,
  setWorkItemBoardAssignmentCompletionAction,
  removeWorkItemBoardAssignmentAction,
  setWorkItemCompletionAction,
  reorderBoardColumnsAction,
  updateBoardAction,
  updateBoardColumnAction,
} from '@/lib/actions'
import { saveBoardPeriodDemandWithTagAction } from '@/lib/work-item-card-tag-actions'
import CycleAgendaPanel from './CycleAgendaPanel'
import OpenPautaModal from './OpenPautaModal'
import PautaManagementPanel from '../pautas/PautaManagementPanel'

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

const CARD_TAG_COLORS = [
  { key: 'slate', label: 'Cinza', hex: '#64748B' },
  { key: 'blue', label: 'Azul', hex: '#2563EB' },
  { key: 'purple', label: 'Roxo', hex: '#7C3AED' },
  { key: 'yellow', label: 'Amarelo', hex: '#CA8A04' },
  { key: 'red', label: 'Vermelho', hex: '#DC2626' },
  { key: 'green', label: 'Verde', hex: '#16A34A' },
] as const

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
}

function dateValue(
  value?: string | null,
) {
  return value
    ? String(value).slice(0, 10)
    : ''
}

function formatDateShort(
  value?: string | null,
) {
  if (!value) return '--/--'

  return new Date(
    String(value).slice(0, 10) +
      'T12:00:00',
  ).toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
    },
  )
}

function formatAgendaTagDate(
  value?: string | null,
) {
  if (!value) {
    return 'Agendada'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Agendada'
  }

  const parts =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        timeZone:
          'America/Sao_Paulo',
        day:
          '2-digit',
        month:
          '2-digit',
        hour:
          '2-digit',
        minute:
          '2-digit',
        hour12:
          false,
      },
    ).formatToParts(date)

  const readPart =
    (
      type:
        | 'day'
        | 'month'
        | 'hour'
        | 'minute',
    ) =>
      parts.find(
        (part) =>
          part.type === type,
      )?.value || ''

  const day =
    readPart('day')

  const month =
    readPart('month')

  const hour =
    readPart('hour')

  const minute =
    readPart('minute')

  if (
    !day ||
    !month ||
    !hour
  ) {
    return 'Agendada'
  }

  return (
    day +
    '/' +
    month +
    ' · ' +
    hour +
    'h' +
    (
      minute &&
      minute !== '00'
        ? minute
        : ''
    )
  )
}

function agendaTagText(
  requirement: any,
) {
  const status =
    String(
      requirement?.status ||
      'pending',
    )

  if (
    status === 'completed'
  ) {
    return 'Realizada'
  }

  if (
    status === 'confirmed' ||
    status === 'scheduled'
  ) {
    return formatAgendaTagDate(
      requirement
        ?.calendar_event
        ?.starts_at ||
      requirement
        ?.scheduled_at ||
      null,
    )
  }

  if (
    status === 'cancelled'
  ) {
    return 'Cancelada'
  }

  return 'Pendente'
}

function formatPautaReference(
  value?: string | null,
) {
  if (!value) {
    return 'Sem referência'
  }

  const date =
    new Date(
      String(value).slice(0, 10) +
        'T12:00:00',
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Sem referência'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      month: 'short',
      year: 'numeric',
    },
  )
    .format(date)
    .replace('.', '')
    .toUpperCase()
}

function formatDateFull(
  value?: string | null,
) {
  if (!value) return '--/--/----'

  return new Date(
    String(value).slice(0, 10) +
      'T12:00:00',
  ).toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  )
}

function formatPeriodTitle(
  clientName: string,
  start: string,
  end: string,
) {
  if (!clientName || !start || !end) {
    return 'O título será gerado automaticamente'
  }

  return (
    clientName.toUpperCase() +
    ' - ' +
    formatDateShort(start) +
    ' - ' +
    formatDateShort(end)
  )
}

function deadlineState(
  value?: string | null,
) {
  const deadline = dateValue(value)

  if (!deadline) return 'missing'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(
    deadline + 'T12:00:00',
  )
  target.setHours(0, 0, 0, 0)

  const difference = Math.ceil(
    (
      target.getTime() -
      today.getTime()
    ) /
      86400000,
  )

  if (difference < 0) return 'overdue'
  if (difference === 0) return 'today'
  if (difference <= 3) return 'soon'

  return 'normal'
}

function cardTone(item: any) {
  const finalState =
    deadlineState(
      item.final_deadline,
    )

  const status =
    String(
      item.status ||
      'not_started',
    )

  if (
    [
      'done',
      'delivered',
      'approved',
    ].includes(status)
  ) {
    return 'success'
  }

  if (
    finalState === 'overdue' ||
    [
      'blocked',
      'cancelled',
    ].includes(status)
  ) {
    return 'danger'
  }

  if (
    finalState === 'today' ||
    finalState === 'soon' ||
    [
      'waiting',
      'awaiting_approval',
      'in_review',
    ].includes(status)
  ) {
    return 'warning'
  }

  if (
    [
      'in_progress',
      'scheduled',
    ].includes(status)
  ) {
    return 'info'
  }

  return 'neutral'
}

export default function BoardWorkspace({
  boards = [],
  activeBoardId = '',
  pautas = [],
  activePautaKey = '',
  activePauta = null,
  pautaManagement = null,
  showArchived = false,
  distributionBoards = [],
  distributionColumns = [],
  initialItemId = '',
  columns = [],
  demands = [],
  clients = [],
  profiles = [],
  clientServices = [],
  canManage = false,
  loadErrors = [],
  workspaceMode = 'boards',
}: any) {
  const [items, setItems] = useState<any[]>(
    Array.isArray(demands)
      ? demands
      : [],
  )

  const [
    boardColumns,
    setBoardColumns,
  ] = useState<any[]>(
    Array.isArray(columns)
      ? columns
      : [],
  )

  const [query, setQuery] = useState('')
  const [clientId, setClientId] =
    useState('all')
  const [
    responsibleId,
    setResponsibleId,
  ] = useState('all')

  const [
    dragCardId,
    setDragCardId,
  ] = useState<string | null>(null)

  const [
    dragColumnId,
    setDragColumnId,
  ] = useState<string | null>(null)

  const [
    demandModal,
    setDemandModal,
  ] = useState<
    'create' | 'edit' | null
  >(null)

  const [editing, setEditing] =
    useState<any | null>(null)

  const [detailItem, setDetailItem] =
    useState<any | null>(null)

  const [
    selectedColumnId,
    setSelectedColumnId,
  ] = useState('')

  const [
    formClient,
    setFormClient,
  ] = useState('')

  const [
    formStart,
    setFormStart,
  ] = useState('')

  const [
    formEnd,
    setFormEnd,
  ] = useState('')

  const [
    boardCreateOpen,
    setBoardCreateOpen,
  ] = useState(false)

  const [
    deleteColumn,
    setDeleteColumn,
  ] = useState<any | null>(null)

  const [
    personalizeColumn,
    setPersonalizeColumn,
  ] = useState<any | null>(null)

  const [
    personalizeColor,
    setPersonalizeColor,
  ] = useState('#64748B')

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    pautaModalOpen,
    setPautaModalOpen,
  ] = useState(false)

  const [
    pautaManagementOpen,
    setPautaManagementOpen,
  ] = useState(false)

  const [
    cycleAgendaItem,
    setCycleAgendaItem,
  ] = useState<any | null>(
    null,
  )

  const [
    columnSorts,
    setColumnSorts,
  ] = useState<
    Record<
      string,
      | 'manual'
      | 'deadline_asc'
      | 'deadline_desc'
    >
  >({})

  const deepLinkHandled =
    useRef('')

  const isPautaWorkspace =
    workspaceMode === 'pautas'

  const workspaceBasePath: string =
    isPautaWorkspace
      ? '/dashboard/pautas'
      : '/dashboard/quadro'

  const activeBoard =
    boards.find(
      (board: any) =>
        board.id === activeBoardId,
    ) || null

  const readOnlyPautaView =
    activePautaKey === 'all'

  const missingPautaView =
    isPautaWorkspace &&
    !activePauta &&
    !readOnlyPautaView

  useEffect(() => {
    setPautaModalOpen(false)
    setPautaManagementOpen(false)
  }, [
    activeBoardId,
    activePautaKey,
  ])

  const activePautaEditable =
    Boolean(activePauta) &&
    ['draft', 'open'].includes(
      String(
        activePauta?.lifecycle_status || '',
      ),
    )

  const pautaMemberClientIds =
    useMemo(
      () =>
        new Set(
          (
            Array.isArray(
              pautaManagement?.members,
            )
              ? pautaManagement.members
              : []
          )
            .filter(
              (member: any) =>
                member.membership_status === 'active',
            )
            .map(
              (member: any) =>
                String(
                  member.client?.id || '',
                ),
            )
            .filter(Boolean),
        ),
      [pautaManagement],
    )

  const demandClientOptions =
    useMemo(
      () =>
        isPautaWorkspace &&
        activePauta
          ? clients.filter(
              (client: any) =>
                pautaMemberClientIds.has(
                  String(client.id),
                ),
            )
          : clients,
      [
        activePauta,
        clients,
        isPautaWorkspace,
        pautaMemberClientIds,
      ],
    )

  const selectedClient =
    demandClientOptions.find(
      (client: any) =>
        client.id === formClient,
    ) || null

  useEffect(() => {
    if (
      !initialItemId ||
      deepLinkHandled.current ===
        initialItemId
    ) {
      return
    }

    const linkedItem =
      items.find(
        (item: any) =>
          item.id === initialItemId,
      )

    deepLinkHandled.current =
      initialItemId

    if (!linkedItem) {
      return
    }

    setEditing(linkedItem)

    setSelectedColumnId(
      linkedItem.board_column_id ||
        '',
    )

    setFormClient(
      linkedItem.client_id || '',
    )

    setFormStart(
      dateValue(
        linkedItem.internal_deadline,
      ),
    )

    setFormEnd(
      dateValue(
        linkedItem.final_deadline,
      ),
    )

    setError('')
    setDemandModal('edit')

    window.setTimeout(() => {
      document
        .getElementById(
          'work-item-' +
            initialItemId,
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        })
    }, 0)
  }, [
    initialItemId,
    items,
  ])

  const filtered = useMemo(() => {
    const normalizeSearch =
      (
        value: unknown,
      ) =>
        String(
          value || '',
        )
          .normalize(
            'NFD',
          )
          .replace(
            /[\u0300-\u036f]/g,
            '',
          )
          .toLowerCase()

    const term =
      normalizeSearch(
        query.trim(),
      )

    return items.filter((item: any) => {
      const matchesSearch =
        !term ||
        normalizeSearch(
          item.title,
        ).includes(term) ||
        normalizeSearch(
          item.client?.name,
        ).includes(term)

      return (
        matchesSearch &&
        (
          clientId === 'all' ||
          item.client_id === clientId
        ) &&
        (
          responsibleId === 'all' ||
          item.responsible_id ===
            responsibleId
        )
      )
    })
  }, [
    items,
    query,
    clientId,
    responsibleId,
  ])

  const activeServices =
    formClient
      ? clientServices.filter(
          (service: any) =>
            service.client_id ===
              formClient &&
            service.status === 'active',
        )
      : []

  // V9.2C-P0.1 — CONCLUÍDOS PERMANECEM VISÍVEIS NA COLUNA
  function cardsInColumn(
    columnId: string,
  ) {
    const list =
      filtered.filter(
        (item: any) =>
          item.board_column_id ===
            columnId &&
          !item
            .assignment_completed_at &&
          !item.completed_at,
      )

    const mode =
      columnSorts[columnId] ||
      'manual'

    if (mode === 'manual') {
      return list
    }

    return [...list].sort(
      (a: any, b: any) => {
        const dateA =
          String(
            a.final_deadline ||
              '',
          )

        const dateB =
          String(
            b.final_deadline ||
              '',
          )

        if (!dateA && !dateB) {
          return 0
        }

        if (!dateA) return 1
        if (!dateB) return -1

        return mode ===
          'deadline_desc'
          ? dateB.localeCompare(
              dateA,
            )
          : dateA.localeCompare(
              dateB,
            )
      },
    )
  }

  function openCreateDemand(
    columnId: string,
  ) {
    if (readOnlyPautaView) {
      setError(
        'Selecione uma Pauta específica antes de criar uma demanda.',
      )
      return
    }

    if (
      isPautaWorkspace &&
      !activePauta
    ) {
      setError(
        'Selecione uma Pauta específica antes de criar uma demanda.',
      )
      return
    }

    if (
      isPautaWorkspace &&
      activePauta &&
      !activePautaEditable
    ) {
      setError(
        'Esta Pauta está concluída ou arquivada e não pode receber novas demandas.',
      )
      return
    }

    setEditing(null)
    setSelectedColumnId(columnId)
    setFormClient('')
    setFormStart('')
    setFormEnd('')
    setError('')
    setDemandModal('create')
  }

  function openDemandDetail(item: any) {
    setDetailItem(item)
    setError('')
  }

  function openEditDemand(item: any) {
    setDetailItem(null)
    setEditing(item)
    setSelectedColumnId(
      item.board_column_id || '',
    )
    setFormClient(
      item.client_id || '',
    )
    setFormStart(
      dateValue(
        item.internal_deadline,
      ),
    )
    setFormEnd(
      dateValue(item.final_deadline),
    )
    setError('')
    setDemandModal('edit')
  }

  async function submitDemand(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!activeBoard) {
      setError(
        'Selecione um Quadro.',
      )
      return
    }

    setLoading(true)
    setError('')

    const formData =
      new FormData(event.currentTarget)

    formData.set(
      'board_id',
      activeBoard.id,
    )

    formData.set(
      'board_column_id',
      selectedColumnId,
    )

    const creatingInsidePauta =
      demandModal === 'create' &&
      isPautaWorkspace &&
      Boolean(activePauta)

    let result: any

    if (creatingInsidePauta) {
      formData.set(
        'pauta_id',
        activePauta.id,
      )

      result =
        await createPautaDemandAction(
          formData,
        )
    } else {
      result =
        await saveBoardPeriodDemandWithTagAction(
          demandModal === 'edit' && editing
            ? 'edit'
            : 'create',
          editing?.id || null,
          formData,
        )
    }

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível salvar a demanda.',
      )
      setLoading(false)
      return
    }

    if (
      'warning' in result &&
      result.warning
    ) {
      alert(result.warning)
    }

    window.location.reload()
  }

  async function archiveDemand(
    item: any = editing,
  ) {
    if (!item) return

    const confirmed = confirm(
      'Arquivar esta demanda?',
    )

    if (!confirmed) return

    setLoading(true)
    setError('')

    const result =
      await deleteWorkItemAction(
        item.id,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao arquivar demanda.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function moveCard(
    cardId: string | null,
    columnId: string,
  ) {
    if (
      !cardId ||
      readOnlyPautaView
    ) {
      return
    }

    const targetColumn =
      boardColumns.find(
        (column: any) =>
          column.id === columnId,
      )

    if (!targetColumn) return

    const previous = items

    setItems((current) =>
      current.map((item) =>
        item.id === cardId
          ? {
              ...item,
              board_column_id:
                columnId,
              status:
                [
                  'done',
                  'delivered',
                  'approved',
                ].includes(
                  String(
                    targetColumn
                      .operational_status ||
                    '',
                  ),
                )
                  ? item.status
                  : targetColumn
                      .operational_status,
            }
          : item,
      ),
    )

    const movingItem =
      items.find((item: any) => item.id === cardId)

    const result = movingItem?.assignment_id
      ? await moveWorkItemBoardAssignmentAction(
          movingItem.assignment_id,
          columnId,
        )
      : await moveBoardCardAction(
          cardId,
          columnId,
        )

    if ('error' in result) {
      setItems(previous)
      alert(result.error)
    }

    setDragCardId(null)
  }

  // V9.1 — CONCLUSÃO NO CARD E ARQUIVO DE PAUTA
  async function markCardCompleted(
    item: any,
  ) {
    if (!item?.id) return

    const confirmed =
      window.confirm(
        'Marcar este card como concluído?\n\n' +
          'Ele sairá deste Quadro operacional e continuará rastreável em Demandas, histórico e dashboards.',
      )

    if (!confirmed) return

    setLoading(true)
    setError('')

    const result =
      item.assignment_id
        ? await setWorkItemBoardAssignmentCompletionAction(
            item.assignment_id,
            true,
            '',
          )
        : await setWorkItemCompletionAction(
            item.id,
            true,
            true,
            '',
          )

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível concluir o card.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function changeActivePautaLifecycle() {
    if (
      !activePauta ||
      !canManage
    ) {
      const message =
        'A Pauta ativa não está disponível para esta ação.'

      setError(message)
      window.alert(message)
      return
    }

    const archived =
      activePauta.lifecycle_status ===
      'archived'

    const confirmed =
      window.confirm(
        archived
          ? (
              'Reabrir a Pauta "' +
              String(
                activePauta.name ||
                'selecionada',
              ) +
              '"? Ela voltará para a lista de Pautas ativas.'
            )
          : (
              'Arquivar a Pauta "' +
              String(
                activePauta.name ||
                'selecionada',
              ) +
              '"? Ela sairá da lista ativa, mas poderá ser reaberta depois. Nenhum card ou histórico será apagado.'
            ),
      )

    if (!confirmed) {
      return
    }

    setLoading(true)
    setError('')

    const result =
      await changePautaLifecycleAction(
        activePauta.id,
        archived
          ? 'reopen'
          : 'archive',
        archived
          ? 'REABRIR PAUTA'
          : 'ARQUIVAR PAUTA',
      )

    if ('error' in result) {
      const message =
        result.error ||
        'Não foi possível alterar a Pauta.'

      setError(message)
      window.alert(message)
      setLoading(false)
      return
    }

    window.location.href =
      workspaceBasePath +
      '?board=' +
      activeBoardId +
      (
        archived
          ? '&pauta=' +
            encodeURIComponent(
              activePauta.id,
            )
          : ''
      )
  }

  async function submitBoard(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const formData =
      new FormData(event.currentTarget)

    formData.set(
      'status',
      'active',
    )
    formData.set(
      'description',
      '',
    )

    const result =
      await createBoardAction(formData)

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao criar Quadro.',
      )
      setLoading(false)
      return
    }

    if (
      'id' in result &&
      result.id
    ) {
      window.location.href =
        workspaceBasePath + '?board=' +
        result.id
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
    formData.set(
      'status',
      'active',
    )

    setLoading(true)
    setError('')

    const result =
      await updateBoardAction(
        activeBoard.id,
        formData,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao atualizar Quadro.',
      )
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

    if (
      !nextName ||
      nextName === activeBoard.name
    ) {
      return
    }

    await saveBoard(
      nextName,
      activeBoard.color ||
        '#2563EB',
    )
  }

  async function removeBoard() {
    if (!activeBoard) return

    const confirmed = confirm(
      'Excluir o Quadro "' +
        activeBoard.name +
        '"?\n\nAs demandas não serão apagadas.',
    )

    if (!confirmed) return

    setLoading(true)
    setError('')

    const result =
      await deleteBoardAction(
        activeBoard.id,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao excluir Quadro.',
      )
      setLoading(false)
      return
    }

    window.location.href =
      workspaceBasePath
  }

  async function createColumn() {
    if (!activeBoard) return

    const name = prompt(
      'Nome da nova coluna:',
    )?.trim()

    if (!name) return

    const formData = new FormData()

    formData.set(
      'board_id',
      activeBoard.id,
    )
    formData.set('name', name)
    formData.set(
      'color',
      '#64748B',
    )
    formData.set(
      'operational_status',
      'not_started',
    )

    setLoading(true)
    setError('')

    const result =
      await createBoardColumnAction(
        formData,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao criar coluna.',
      )
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
    }>,
  ) {
    const formData = new FormData()

    formData.set(
      'name',
      patch.name ?? column.name,
    )
    formData.set(
      'color',
      patch.color ?? column.color,
    )

    formData.set(
      'operational_status',
      column.operational_status ||
        'not_started',
    )

    setLoading(true)
    setError('')

    const result =
      await updateBoardColumnAction(
        column.id,
        formData,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao editar coluna.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function renameColumn(
    column: any,
  ) {
    const nextName = prompt(
      'Novo nome da coluna:',
      column.name,
    )?.trim()

    if (
      !nextName ||
      nextName === column.name
    ) {
      return
    }

    await updateColumn(
      column,
      { name: nextName },
    )
  }

  function openPersonalizeColumn(
    column: any,
  ) {
    setPersonalizeColumn(column)
    setPersonalizeColor(
      column.color || '#64748B',
    )
    setError('')
  }

  async function submitPersonalizeColumn(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!personalizeColumn) return

    await updateColumn(
      personalizeColumn,
      {
        color: personalizeColor,
      },
    )
  }

  async function persistColumnOrder(
    next: any[],
  ) {
    const previous = boardColumns

    setBoardColumns(next)

    const result =
      await reorderBoardColumnsAction(
        activeBoardId,
        next.map(
          (column) => column.id,
        ),
      )

    if ('error' in result) {
      setBoardColumns(previous)
      alert(result.error)
    }
  }

  async function dropColumn(
    targetColumnId: string,
  ) {
    if (
      !dragColumnId ||
      dragColumnId === targetColumnId
    ) {
      setDragColumnId(null)
      return
    }

    const sourceIndex =
      boardColumns.findIndex(
        (column) =>
          column.id === dragColumnId,
      )

    const targetIndex =
      boardColumns.findIndex(
        (column) =>
          column.id ===
          targetColumnId,
      )

    if (
      sourceIndex < 0 ||
      targetIndex < 0
    ) {
      return
    }

    const next = [...boardColumns]

    const [moved] =
      next.splice(sourceIndex, 1)

    next.splice(
      targetIndex,
      0,
      moved,
    )

    setDragColumnId(null)

    await persistColumnOrder(next)
  }

  async function confirmDeleteColumn(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!deleteColumn) return

    const formData =
      new FormData(event.currentTarget)

    const targetColumnId =
      String(
        formData.get(
          'target_column_id',
        ) || '',
      ) || null

    setLoading(true)
    setError('')

    const result =
      await deleteBoardColumnAction(
        deleteColumn.id,
        targetColumnId,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao excluir coluna.',
      )
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function removeFromCurrentBoard(
    item: any,
  ) {
    const assignmentId =
      String(
        item?.assignment_id ||
        '',
      ).trim()

    if (!assignmentId) {
      alert(
        'Esta demanda não possui uma associação ativa removível neste Quadro.',
      )

      return
    }

    const confirmed =
      window.confirm(
        'Remover esta demanda deste Quadro?\n\n' +
        'A demanda continuará existindo em Demandas, na Pauta e nos demais Quadros vinculados.',
      )

    if (!confirmed) {
      return
    }

    const note =
      window.prompt(
        'Motivo da remoção (opcional):',
        '',
      ) || ''

    setLoading(true)
    setError('')

    const result =
      await removeWorkItemBoardAssignmentAction(
        assignmentId,
        note,
      )

    if ('error' in result) {
      alert(
        result.error ||
          'Não foi possível remover a demanda deste Quadro.',
      )

      setLoading(false)

      return
    }

    setDetailItem(null)

    window.location.reload()
  }

  function allowDrop(
    event: DragEvent<HTMLElement>,
  ) {
    event.preventDefault()
  }

  return (
    <div className="page-wrap ops-page board-a14-page board-a15-page">
      <div className="topbar">
        <div>
          <div className="tb-title">
            {isPautaWorkspace ? 'Pautas' : 'Quadros'}
          </div>
          <div className="tb-sub">
            {isPautaWorkspace
              ? 'Operação mensal, Magic Number e programação.'
              : 'Quadros livres com colunas e demandas configuráveis.'}
          </div>
        </div>

        <div className="sbox">
          <i className="ti ti-search" />
          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Buscar demanda ou cliente."
          />
        </div>
      </div>

      <div className="board-a14-toolbar">
        {!isPautaWorkspace && (
          <div className="board-a14-selector">
            <span>Quadro ativo</span>

            <select
              className="fi compact"
              value={activeBoardId}
              onChange={(event) => {
                window.location.href =
                  workspaceBasePath + '?board=' +
                  event.target.value
              }}
            >
              {!boards.length && (
                <option value="">
                  Nenhum Quadro cadastrado
                </option>
              )}

              {boards.map(
                (board: any) => (
                  <option
                    key={board.id}
                    value={board.id}
                  >
                    {board.name}
                  </option>
                ),
              )}
            </select>
          </div>
        )}

        {isPautaWorkspace && (
          <div className="board-pauta-selector">
            <span>
              {showArchived
                ? 'Pautas arquivadas'
                : 'Pauta ativa'}
            </span>

            <select
              className="fi compact"
              value={activePautaKey}
              onChange={(event) => {
                const next =
                  event.target.value

                window.location.href =
                  workspaceBasePath + '?board=' +
                  activeBoardId +
                  '&pauta=' +
                  encodeURIComponent(
                    next,
                  ) +
                  (
                    showArchived
                      ? '&archived=1'
                      : ''
                  )
              }}
            >
              {pautas.map(
                (pauta: any) => (
                  <option
                    key={pauta.id}
                    value={pauta.id}
                  >
                    {pauta.name}
                  </option>
                ),
              )}

              {pautas.length === 0 && (
                <option value="">
                  {showArchived
                    ? 'Nenhuma Pauta arquivada'
                    : 'Nenhuma Pauta ativa'}
                </option>
              )}

              {!showArchived &&
                pautas.length > 0 && (
                <option value="all">
                  Todas as Pautas
                </option>
              )}
            </select>
          </div>
        )}

        <select
          className="fi compact"
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

          {clients.map(
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
          className="fi compact"
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

          {profiles.map(
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

        {isPautaWorkspace && (
          <details className="board-a14-menu">
            <summary
              className="board-a14-icon board-v9-pauta-menu-trigger"
              title="Opções da Pauta"
              aria-label="Opções da Pauta"
            >
              <i className="ti ti-dots-vertical" />
            </summary>

            <div className="board-a14-menu-popover">
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    showArchived
                      ? workspaceBasePath +
                        '?board=' +
                        activeBoardId
                      : workspaceBasePath +
                        '?board=' +
                        activeBoardId +
                        '&archived=1'
                }}
              >
                <i
                  className={
                    showArchived
                      ? 'ti ti-arrow-back-up'
                      : 'ti ti-archive'
                  }
                />

                {showArchived
                  ? 'Voltar às Pautas ativas'
                  : 'Ver Pautas arquivadas'}
              </button>

              {canManage &&
                activePauta && (
                <button
                  className={
                    activePauta.lifecycle_status ===
                    'archived'
                      ? ''
                      : 'danger-option'
                  }
                  type="button"
                  onClick={() =>
                    void changeActivePautaLifecycle()
                  }
                  disabled={loading}
                >
                  <i
                    className={
                      activePauta.lifecycle_status ===
                      'archived'
                        ? 'ti ti-refresh'
                        : 'ti ti-archive'
                    }
                  />

                  {activePauta.lifecycle_status ===
                  'archived'
                    ? 'Reabrir Pauta'
                    : 'Arquivar Pauta'}
                </button>
              )}
            </div>
          </details>
        )}

        {canManage && !isPautaWorkspace && (
          <button
            className="bsec board-a14-new-board-button"
            type="button"
            title="Novo Quadro"
            onClick={() => {
              setError('')
              setBoardCreateOpen(true)
            }}
          >
            <i className="ti ti-plus" />
            Novo Quadro
          </button>
        )}

        {canManage &&
          !isPautaWorkspace &&
          activeBoard && (
            <details className="board-a14-menu">
              <summary
                className="board-a14-icon"
                title="Opções do Quadro"
              >
                <i className="ti ti-dots" />
              </summary>

              <div className="board-a14-menu-popover">
                <button
                  type="button"
                  onClick={renameBoard}
                >
                  <i className="ti ti-edit" />
                  Renomear
                </button>

                <div className="board-a14-menu-label">
                  Cor da borda
                </div>

                <div className="board-a14-palette">
                  {BOARD_COLORS.map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        className={
                          activeBoard.color ===
                          color
                            ? 'board-a14-swatch selected'
                            : 'board-a14-swatch'
                        }
                        style={{
                          backgroundColor:
                            color,
                        }}
                        onClick={() =>
                          saveBoard(
                            activeBoard.name,
                            color,
                          )
                        }
                      />
                    ),
                  )}
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
              activeBoard.color ||
              '#2563EB',
          }}
        >
          <div className="board-pauta-heading-copy">
            {!isPautaWorkspace && (
              <strong>
                {activeBoard.name}
              </strong>
            )}

            <span>
              {boardColumns.length}
              {' '}coluna(s) •{' '}
              {filtered.length}
              {' '}demanda(s)
            </span>

            {activePauta && (
              <div className="board-pauta-summary">
                <span className="board-pauta-summary-name">
                  <i className="ti ti-calendar-stats" />

                  {activePauta.name}
                </span>

                <span>
                  Magic Number:{' '}
                  <strong>
                    {formatDateFull(
                      activePauta.magic_number_date,
                    )}
                  </strong>
                </span>

                <span>
                  Programado até:{' '}
                  <strong>
                    {formatDateFull(
                      activePauta.scheduled_until_date,
                    )}
                  </strong>
                </span>
              </div>
            )}

            {isPautaWorkspace && readOnlyPautaView && (
              <div className="board-pauta-summary readonly">
                <span>
                  <i className="ti ti-eye" />

                  Consulta de todas as Pautas
                </span>

                <small>
                  Selecione uma Pauta específica para mover ou editar cards.
                </small>
              </div>
            )}
          </div>

          <div className="board-pauta-heading-actions">
            {isPautaWorkspace && activePauta && pautaManagement && (
              <button
                className="bsec pauta-management-open"
                type="button"
                onClick={() =>
                  setPautaManagementOpen(true)
                }
              >
                <i className="ti ti-settings-cog" />
                {canManage
                  ? 'Gerenciar Pauta'
                  : 'Detalhes da Pauta'}
              </button>
            )}

            {activePauta && (
              <Link
                className="bsec board-pauta-agenda-link"
                href={
                  '/dashboard/agenda?period=month&start=' +
                  String(
                    activePauta.magic_number_date ||
                    activePauta.reference_month,
                  ).slice(0, 7) +
                  '-01&pauta=' +
                  activePauta.id
                }
              >
                <i className="ti ti-calendar-event" />
                Ver na Agenda
              </Link>
            )}

            {canManage && (
              <>
                {isPautaWorkspace &&
                  !showArchived && (
                <button
                  className="bpri board-pauta-open-button"
                  type="button"
                  onClick={() =>
                    setPautaModalOpen(
                      true,
                    )
                  }
                >
                  <i className="ti ti-calendar-plus" />
                  Abrir nova Pauta
                </button>
                )}

                {!isPautaWorkspace && (
                  <button
                    className="bsec"
                    type="button"
                    onClick={createColumn}
                  >
                    <i className="ti ti-column-insert-right" />
                    Nova coluna
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {loadErrors.length > 0 && (
        <div className="notice notice-err">
          <i className="ti ti-alert-circle" />
          <span>
            {loadErrors.join(' • ')}
          </span>
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
            Crie o primeiro Quadro para iniciar.
          </div>
        </div>
      ) : missingPautaView ? (
        <div className="empty">
          <i
            className={
              showArchived
                ? 'ti ti-archive-off'
                : 'ti ti-calendar-off'
            }
          />

          <div className="empty-title">
            {showArchived
              ? 'Nenhuma Pauta arquivada'
              : 'Nenhuma Pauta ativa'}
          </div>

          <div className="empty-sub">
            {showArchived
              ? 'As Pautas arquivadas aparecerão aqui.'
              : 'Abra uma Pauta para iniciar a operação mensal.'}
          </div>
        </div>
      ) : (
        <div
          className="board-a14-canvas"
          style={{
            borderColor:
              activeBoard.color ||
              '#2563EB',
          }}
        >
          {boardColumns.map(
            (column: any) => {
              const columnItems =
                cardsInColumn(
                  column.id,
                )

              return (
                <section
                  className="board-a14-column"
                  key={column.id}
                  style={{
                    borderTopColor:
                      column.color ||
                      '#64748B',
                  }}
                >
                  <header
                    className="board-a14-column-head"
                    onDragOver={allowDrop}
                    onDrop={() =>
                      dropColumn(
                        column.id,
                      )
                    }
                  >
                    <button
                      className="board-a14-column-grip"
                      type="button"
                      title="Arrastar coluna"
                      draggable={canManage}
                      onDragStart={(
                        event,
                      ) => {
                        event.stopPropagation()
                        setDragColumnId(
                          column.id,
                        )
                      }}
                      onDragEnd={() =>
                        setDragColumnId(
                          null,
                        )
                      }
                    >
                      <i className="ti ti-grip-vertical" />
                    </button>

                    <div className="board-a14-column-title">
                      <span
                        style={{
                          backgroundColor:
                            column.color ||
                            '#64748B',
                        }}
                      />

                      <div>
                        <strong>
                          {column.name}
                        </strong>
                        <small>
                          {
                            columnItems.length
                          }{' '}
                          card(s)
                        </small>
                      </div>
                    </div>

                    <select
                      className="board-a23-column-sort"
                      value={
                        columnSorts[
                          column.id
                        ] || 'manual'
                      }
                      title="Ordenar cards desta coluna"
                      aria-label={
                        'Ordenar cards da coluna ' +
                        column.name
                      }
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                      onChange={(event) =>
                        setColumnSorts(
                          (current) => ({
                            ...current,
                            [column.id]:
                              event.target
                                .value as
                                | 'manual'
                                | 'deadline_asc'
                                | 'deadline_desc',
                          }),
                        )
                      }
                    >
                      <option value="manual">
                        &#8212;
                      </option>
                      <option value="deadline_asc">
                        &#8593;
                      </option>
                      <option value="deadline_desc">
                        &#8595;
                      </option>
                    </select>

                    {!isPautaWorkspace &&
                      !readOnlyPautaView && (
                      <button
                        className="board-a14-column-icon"
                        type="button"
                        title="Nova demanda nesta coluna"
                        onClick={() =>
                          openCreateDemand(
                            column.id,
                          )
                        }
                      >
                        <i className="ti ti-plus" />
                      </button>
                    )}

                    {canManage && (
                      <details className="board-a14-column-menu board-a15-column-menu">
                        <summary
                          className="board-a14-column-icon"
                          title="Opções da coluna"
                        >
                          <i className="ti ti-dots-vertical" />
                        </summary>

                        <div className="board-a14-column-popover board-a15-column-popover">
                          <button
                            type="button"
                            onClick={() =>
                              renameColumn(
                                column,
                              )
                            }
                          >
                            <i className="ti ti-edit" />
                            Renomear
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openPersonalizeColumn(
                                column,
                              )
                            }
                          >
                            <i className="ti ti-palette" />
                            Personalizar
                          </button>

                          <button
                            className="danger-option"
                            type="button"
                            disabled={
                              boardColumns.length <=
                              1
                            }
                            onClick={() =>
                              setDeleteColumn(
                                column,
                              )
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
                    onDragOver={allowDrop}
                    onDrop={() =>
                      moveCard(
                        dragCardId,
                        column.id,
                      )
                    }
                  >
                    {columnItems.map(
                      (item: any) => {
                        const finalState =
                          deadlineState(
                            item.final_deadline,
                          )

                        const scheduleRequirements =
                          Array.isArray(
                            item.schedule_requirements,
                          )
                            ? item.schedule_requirements
                            : []

                        const alignmentRequirement =
                          scheduleRequirements.find(
                            (
                              requirement: any,
                            ) =>
                              requirement
                                .requirement_type ===
                              'alignment_meeting',
                          ) || null

                        const captureRequirement =
                          scheduleRequirements.find(
                            (
                              requirement: any,
                            ) =>
                              requirement
                                .requirement_type ===
                              'capture',
                          ) || null

                        const quickLinks = [
                          {
                            key: 'PLAN',
                            label:
                              'Planejamento',
                            href:
                              item.drive_link,
                          },

                          {
                            key: 'BRIEF',
                            label:
                              'Briefing',
                            href:
                              item.briefing_link,
                          },

                          {
                            key: 'MOOD',
                            label:
                              'Moodboard',
                            href:
                              item.moodboard_link,
                          },

                          {
                            key: 'REF',
                            label:
                              'Referência',
                            href:
                              item.reference_link,
                          },
                        ].filter(
                          (link) =>
                            Boolean(
                              link.href,
                            ),
                        )

                        const frontContext = [
                          item.pauta
                            ? {
                                key:
                                  'pauta',

                                label:
                                  'PAUTA · ' +
                                  formatPautaReference(
                                    item
                                      .pauta
                                      .reference_month,
                                  ),

                                href:
                                  null,
                              }
                            : null,

                          item.is_pauta_card
                            ? {
                                key:
                                  'monthly',

                                label:
                                  'CARD MENSAL',

                                href:
                                  null,
                              }
                            : null,

                          ...quickLinks.map(
                            (link) => ({
                              key:
                                link.key,

                              label:
                                link.key,

                              href:
                                link.href,

                              title:
                                link.label,
                            }),
                          ),
                        ].filter(
                          Boolean,
                        ) as any[]

                        return (
                          <article
                            key={item.id}
                            className="board-a14-card board-a15-card"
                            id={
                              'work-item-' +
                              item.id
                            }
                            data-work-item-id={
                              item.id
                            }
                            data-tone={cardTone(
                              item,
                            )}
                            data-read-only={
                              readOnlyPautaView
                                ? 'true'
                                : 'false'
                            }
                            draggable={
                              !readOnlyPautaView
                            }
                            onDragStart={(
                              event,
                            ) => {
                              if (
                                readOnlyPautaView
                              ) {
                                event.preventDefault()
                                return
                              }

                              event.stopPropagation()
                              setDragCardId(
                                item.id,
                              )
                            }}
                            onDragEnd={() =>
                              setDragCardId(
                                null,
                              )
                            }
                            role="button"
                            tabIndex={0}
                            onClick={() => openDemandDetail(item)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openDemandDetail(item)
                              }
                            }}
                          >
                            <div
                              className="board-v93-front-grid"
                              data-count={
                                frontContext.length
                              }
                            >
                              {frontContext.length >
                              0 ? (
                                frontContext.map(
                                  (
                                    chip:
                                      any,
                                  ) =>
                                    chip.href ? (
                                      <a
                                        key={
                                          chip.key
                                        }
                                        className="board-v93-front-chip link"
                                        href={
                                          chip.href
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        title={
                                          'Abrir ' +
                                          (
                                            chip.title ||
                                            chip.label
                                          )
                                        }
                                        onClick={(
                                          event,
                                        ) =>
                                          event.stopPropagation()
                                        }
                                        onMouseDown={(
                                          event,
                                        ) =>
                                          event.stopPropagation()
                                        }
                                      >
                                        {
                                          chip.label
                                        }

                                        <i className="ti ti-external-link" />
                                      </a>
                                    ) : (
                                      <span
                                        key={
                                          chip.key
                                        }
                                        className={
                                          'board-v93-front-chip ' +
                                          chip.key
                                        }
                                      >
                                        {
                                          chip.label
                                        }
                                      </span>
                                    ),
                                )
                              ) : (
                                <span className="board-v93-front-chip missing">
                                  SEM LINKS
                                </span>
                              )}
                            </div>

                            <h3>
                              {item.title}
                            </h3>

                            {scheduleRequirements.length >
                              0 && (
                              <div
                                className="board-cycle-agenda-tags"
                                onClick={(
                                  event,
                                ) =>
                                  event.stopPropagation()
                                }
                                onMouseDown={(
                                  event,
                                ) =>
                                  event.stopPropagation()
                                }
                              >
                                {alignmentRequirement && (
                                  <button
                                    type="button"
                                    className="board-cycle-agenda-tag"
                                    data-status={
                                      alignmentRequirement.status ||
                                      'pending'
                                    }
                                    title="Abrir agenda da reunião"
                                    onClick={() =>
                                      setCycleAgendaItem(
                                        item,
                                      )
                                    }
                                  >
                                    <strong>
                                      REU
                                    </strong>

                                    <span>
                                      {agendaTagText(
                                        alignmentRequirement,
                                      )}
                                    </span>
                                  </button>
                                )}

                                {captureRequirement && (
                                  <button
                                    type="button"
                                    className="board-cycle-agenda-tag"
                                    data-status={
                                      captureRequirement.status ||
                                      'pending'
                                    }
                                    title="Abrir agenda da captação"
                                    onClick={() =>
                                      setCycleAgendaItem(
                                        item,
                                      )
                                    }
                                  >
                                    <strong>
                                      CAP
                                    </strong>

                                    <span>
                                      {agendaTagText(
                                        captureRequirement,
                                      )}
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="board-a15-card-responsible">
                              <div className="board-v9-card-responsible-copy">
                                <i className="ti ti-user" />

                                <span>
                                  {item.responsible?.display_name ||
                                    item.responsible?.full_name ||
                                    'Sem responsável'}

                                  {item.card_tag ? (
                                    <span
                                      className={
                                        'board-a23-card-tag tag-' +
                                        String(
                                          item.card_tag_color ||
                                          'slate',
                                        )
                                      }
                                      title={item.card_tag}
                                    >
                                      {item.card_tag}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            </div>

                          </article>
                        )
                      },
                    )}

                    {!columnItems.length && (
                      <div className="board-a14-column-empty">
                        Solte um card aqui
                      </div>
                    )}
                  </div>
                </section>
              )
            },
          )}

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

      {detailItem && (
        <div className="modal-ov" onClick={() => setDetailItem(null)}>
          <div
            className="modal context-modal-wide work-item-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">Detalhes da demanda</div>
                <div className="modal-sub">
                  As ações ficam disponíveis somente dentro do card aberto.
                </div>
              </div>
              <button className="mclose" type="button" onClick={() => setDetailItem(null)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="modal-body work-item-detail-body">
              <div className="work-item-detail-title">
                <span>{detailItem.client?.name || 'Interno Ampy'}</span>
                <h2>{detailItem.title}</h2>
              </div>

              <div className="work-item-detail-grid">
                <div><span>Pauta</span><strong>{detailItem.pauta?.name || 'Não vinculada'}</strong></div>
                <div><span>Coluna</span><strong>{boardColumns.find((column: any) => column.id === detailItem.board_column_id)?.name || 'Sem coluna'}</strong></div>
                <div><span>Início</span><strong>{formatDateFull(detailItem.internal_deadline)}</strong></div>
                <div><span>Data final</span><strong>{formatDateFull(detailItem.final_deadline)}</strong></div>
                <div><span>Prioridade</span><strong>{PRIORITY_LABEL[detailItem.priority] || 'Normal'}</strong></div>
                <div><span>Responsável</span><strong>{detailItem.responsible?.display_name || detailItem.responsible?.full_name || 'Sem responsável'}</strong></div>
              </div>

              {detailItem.description && (
                <div className="work-item-detail-notes work-item-detail-direction">
                  <span>
                    Direcionamento
                  </span>

                  <p>
                    {
                      detailItem
                        .description
                    }
                  </p>
                </div>
              )}

              {(detailItem.drive_link ||
                detailItem.briefing_link ||
                detailItem.moodboard_link ||
                detailItem.reference_link) && (
                <div className="work-item-detail-links">
                  <span>
                    Links e referências
                  </span>

                  <div className="work-item-detail-link-grid">
                    {detailItem.drive_link && (
                      <a
                        href={
                          detailItem
                            .drive_link
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>
                          Planejamento
                        </strong>

                        <small>
                          Abrir documento
                        </small>

                        <i className="ti ti-external-link" />
                      </a>
                    )}

                    {detailItem.briefing_link && (
                      <a
                        href={
                          detailItem
                            .briefing_link
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>
                          Briefing
                        </strong>

                        <small>
                          Abrir documento
                        </small>

                        <i className="ti ti-external-link" />
                      </a>
                    )}

                    {detailItem.moodboard_link && (
                      <a
                        href={
                          detailItem
                            .moodboard_link
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>
                          Moodboard
                        </strong>

                        <small>
                          Abrir referência
                        </small>

                        <i className="ti ti-external-link" />
                      </a>
                    )}

                    {detailItem.reference_link && (
                      <a
                        href={
                          detailItem
                            .reference_link
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>
                          Referência
                        </strong>

                        <small>
                          Abrir documento
                        </small>

                        <i className="ti ti-external-link" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {detailItem.notes && (
                <div className="work-item-detail-notes">
                  <span>
                    Observações
                  </span>

                  <p>
                    {detailItem.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-foot work-item-detail-actions">
              {!readOnlyPautaView && !detailItem.is_pauta_card && (
                <button
                  className="bsec danger-button"
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    const item = detailItem
                    setDetailItem(null)
                    void archiveDemand(item)
                  }}
                >
                  <i className="ti ti-archive" />
                  Arquivar
                </button>
              )}

              {!readOnlyPautaView && (
                <button
                  className="work-item-complete-action"
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    const item = detailItem
                    setDetailItem(null)
                    void markCardCompleted(item)
                  }}
                >
                  <i className="ti ti-circle-check" />
                  Marcar como Concluído
                </button>
              )}

              {!readOnlyPautaView && (
                <button
                  className="bsec"
                  type="button"
                  onClick={() => {
                    const item = detailItem
                    setDetailItem(null)
                    openEditDemand(item)
                  }}
                >
                  <i className="ti ti-pencil" />
                  Editar
                </button>
              )}

              {!readOnlyPautaView &&
                !isPautaWorkspace &&
                detailItem.assignment_id && (
                <button
                  className="bsec danger-button"
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void removeFromCurrentBoard(
                      detailItem,
                    )
                  }
                >
                  <i className="ti ti-unlink" />
                  Remover deste Quadro
                </button>
              )}

              <button className="bsec" type="button" onClick={() => setDetailItem(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {demandModal && (
        <div
          className="modal-ov"
          onClick={() =>
            setDemandModal(null)
          }
        >
          <div
            className="modal context-modal-wide"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {demandModal === 'edit'
                    ? 'Editar demanda'
                    : 'Nova demanda'}
                </div>

                <div className="modal-sub">
                  Título, direcionamento, links e execução da demanda.
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() =>
                  setDemandModal(null)
                }
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={submitDemand}>
              <div className="modal-body">
                <input
                  type="hidden"
                  name="board_id"
                  value={activeBoardId}
                />


              <div className="board-a23-title-tag-row">
                <div className="fg board-v93-title-field">
                  <label className="fl">
                    Título *
                  </label>

                  <input
                    key={
                      editing?.id ||
                      [
                        formClient,
                        formStart,
                        formEnd,
                      ].join('-')
                    }
                    className="fi"
                    name="title"
                    required
                    defaultValue={
                      editing?.title ||
                      formatPeriodTitle(
                        selectedClient
                          ?.name ||
                          '',
                        formStart,
                        formEnd,
                      )
                    }
                    placeholder="Ex.: Criativos campanha Primavera"
                  />

                  <small className="board-v93-field-help">
                    O sistema sugere um título, mas ele pode ser editado.
                  </small>
                </div>

                <div className="board-a23-tag-panel">
                  <div className="fg board-a23-tag-field">
                    <label
                      className="fl"
                      htmlFor="card_tag"
                    >
                      Tag do card
                    </label>

                    <input
                      className="fi"
                      id="card_tag"
                      name="card_tag"
                      autoComplete="off"
                      maxLength={16}
                      defaultValue={
                        editing?.card_tag ||
                        ''
                      }
                      placeholder="Ex.: SEM PLAN"
                    />

                    <small className="board-a23-tag-help">
                      Opcional · máximo de 16 caracteres
                    </small>
                  </div>

                  <div className="fg board-a23-tag-color-field">
                    <label className="fl">
                      Cor da tag
                    </label>

                    <div className="board-a23-tag-palette">
                      {CARD_TAG_COLORS.map(
                        (color) => (
                          <label
                            className="board-a23-tag-color-option"
                            key={color.key}
                            title={color.label}
                          >
                            <input
                              type="radio"
                              name="card_tag_color"
                              value={color.key}
                              defaultChecked={
                                String(
                                  editing?.card_tag_color ||
                                  'slate',
                                ) ===
                                color.key
                              }
                            />

                            <span
                              style={{
                                backgroundColor:
                                  color.hex,
                              }}
                            />
                          </label>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>

                <div className="fg">
                  <label className="fl">
                    Coluna *
                  </label>

                  <select
                    className="fi"
                    name="board_column_id"
                    required
                    value={
                      selectedColumnId
                    }
                    onChange={(event) =>
                      setSelectedColumnId(
                        event.target.value,
                      )
                    }
                  >
                    <option
                      value=""
                      disabled
                    >
                      Escolha a coluna
                    </option>

                    {boardColumns.map(
                      (column: any) => (
                        <option
                          key={column.id}
                          value={column.id}
                        >
                          {column.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Cliente *
                    </label>

                    <select
                      className="fi"
                      name="client_id"
                      required
                      value={formClient}
                      onChange={(event) =>
                        setFormClient(
                          event.target.value,
                        )
                      }
                    >
                      <option
                        value=""
                        disabled
                      >
                        Selecione o cliente
                      </option>

                      {demandClientOptions.map(
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
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Serviço
                    </label>

                    <select
                      className="fi"
                      name="client_service_id"
                      required={
                        Boolean(
                          isPautaWorkspace &&
                          activePauta &&
                          demandModal === 'create',
                        )
                      }
                      defaultValue={
                        editing
                          ?.client_service_id ||
                        ''
                      }
                    >
                      <option value="">
                        {isPautaWorkspace &&
                        activePauta &&
                        demandModal === 'create'
                          ? 'Selecione o serviço ativo'
                          : 'Sem serviço específico'}
                      </option>

                      {activeServices.map(
                        (service: any) => (
                          <option
                            key={service.id}
                            value={service.id}
                          >
                            {service.service
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
                      Início *
                    </label>

                    <input
                      className="fi"
                      type="date"
                      name="internal_deadline"
                      required
                      value={formStart}
                      onChange={(event) =>
                        setFormStart(
                          event.target.value,
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
                      value={formEnd}
                      onChange={(event) =>
                        setFormEnd(
                          event.target.value,
                        )
                      }
                    />
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
                        editing
                          ?.responsible_id ||
                        ''
                      }
                    >
                      <option
                        value=""
                        disabled
                      >
                        Selecione o responsável
                      </option>

                      {profiles.map(
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

                  <div className="fg">
                    <label className="fl">
                      Prioridade *
                    </label>

                    <select
                      className="fi"
                      name="priority"
                      required
                      defaultValue={
                        editing?.priority ||
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

                <div className="fg">
                  <label className="fl">
                    Direcionamento
                  </label>

                  <textarea
                    className="fi"
                    name="description"
                    rows={3}
                    placeholder="Explique o que precisa ser feito, o objetivo, o entregável e as informações obrigatórias."
                    defaultValue={
                      editing
                        ?.description ||
                      ''
                    }
                  />
                </div>

                <div className="board-v93-links-form">
                  <div className="fg">
                    <label className="fl">
                      Planejamento
                    </label>

                    <input
                      className="fi"
                      type="url"
                      name="drive_link"
                      placeholder="Link do planejamento"
                      defaultValue={
                        editing
                          ?.drive_link ||
                        ''
                      }
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Briefing
                    </label>

                    <input
                      className="fi"
                      type="url"
                      name="briefing_link"
                      placeholder="Link do briefing"
                      defaultValue={
                        editing
                          ?.briefing_link ||
                        ''
                      }
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Moodboard
                    </label>

                    <input
                      className="fi"
                      type="url"
                      name="moodboard_link"
                      placeholder="Link do moodboard"
                      defaultValue={
                        editing
                          ?.moodboard_link ||
                        ''
                      }
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Referência
                    </label>

                    <input
                      className="fi"
                      type="url"
                      name="reference_link"
                      placeholder="Documento ou material de referência"
                      defaultValue={
                        editing
                          ?.reference_link ||
                        ''
                      }
                    />
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">
                    Observações
                  </label>

                  <textarea
                    className="fi"
                    name="notes"
                    rows={2}
                    placeholder="Complementos e cuidados para a execução."
                    defaultValue={
                      editing?.notes ||
                      ''
                    }
                  />
                </div>

                {error && (
                  <div className="notice notice-err">
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                {editing &&
                  !editing.is_pauta_card && (
                  <button
                    className="bsec danger-button"
                    type="button"
                    onClick={() =>
                      void archiveDemand()
                    }
                    disabled={loading}
                  >
                    Arquivar
                  </button>
                )}

                {editing &&
                  !editing.is_pauta_card && (
                  <button
                    className="work-item-complete-action"
                    type="button"
                    onClick={() =>
                      void markCardCompleted(
                        editing,
                      )
                    }
                    disabled={loading}
                  >
                    <i className="ti ti-circle-check" />
                    Marcar como Concluído
                  </button>
                )}

                {editing?.is_pauta_card && (
                  <span
                    className="badge bmut"
                    title="Card mensal gerenciado pela Pauta"
                  >
                    Card mensal da Pauta
                  </span>
                )}

                <button
                  className="bsec"
                  type="button"
                  onClick={() =>
                    setDemandModal(null)
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
                    : editing
                      ? 'Salvar demanda'
                      : 'Criar demanda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CycleAgendaPanel
        item={cycleAgendaItem}
        activeBoardId={
          activeBoardId
        }
        activePautaKey={
          activePautaKey
        }
        onClose={() =>
          setCycleAgendaItem(null)
        }
      />

      {isPautaWorkspace && activePauta && pautaManagement && (
        <PautaManagementPanel
          open={pautaManagementOpen}
          onClose={() =>
            setPautaManagementOpen(false)
          }
          snapshot={pautaManagement}
          pautaCards={items}
          clients={clients}
          profiles={profiles}
          clientServices={clientServices}
          distributionBoards={distributionBoards}
          distributionColumns={distributionColumns}
          pautaColumns={boardColumns}
          canManage={canManage}
        />
      )}

      {isPautaWorkspace && (
        <OpenPautaModal
          open={pautaModalOpen}
          boardId={activeBoardId}
          clients={clients}
          clientServices={clientServices}
          onClose={() =>
            setPautaModalOpen(false)
          }
        />
      )}

      {personalizeColumn && (
        <div
          className="modal-ov"
          onClick={() =>
            setPersonalizeColumn(
              null,
            )
          }
        >
          <div
            className="modal board-a15-personalize-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  Personalizar coluna
                </div>
                <div className="modal-sub">
                  {personalizeColumn.name}
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() =>
                  setPersonalizeColumn(
                    null,
                  )
                }
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form
              onSubmit={
                submitPersonalizeColumn
              }
            >
              <div className="modal-body">
                <div className="fg">
                  <label className="fl">
                    Cor da coluna
                  </label>

                  <div className="board-a15-personalize-palette">
                    {COLUMN_COLORS.map(
                      (color) => (
                        <button
                          key={color}
                          type="button"
                          className={
                            personalizeColor ===
                            color
                              ? 'board-a15-personalize-swatch selected'
                              : 'board-a15-personalize-swatch'
                          }
                          style={{
                            backgroundColor:
                              color,
                          }}
                          onClick={() =>
                            setPersonalizeColor(
                              color,
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                </div>

                <div
                  className="board-a15-color-preview"
                  style={{
                    borderTopColor:
                      personalizeColor,
                  }}
                >
                  <span
                    style={{
                      backgroundColor:
                        personalizeColor,
                    }}
                  />
                  <strong>
                    {
                      personalizeColumn.name
                    }
                  </strong>
                </div>
              </div>

              <div className="modal-foot">
                <button
                  className="bsec"
                  type="button"
                  onClick={() =>
                    setPersonalizeColumn(
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
                  Salvar personalização
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {boardCreateOpen && (
        <div
          className="modal-ov"
          onClick={() =>
            setBoardCreateOpen(false)
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  Novo Quadro
                </div>
                <div className="modal-sub">
                  O novo Quadro receberá colunas editáveis.
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() =>
                  setBoardCreateOpen(
                    false,
                  )
                }
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={submitBoard}>
              <div className="modal-body">
                <div className="fg">
                  <label className="fl">
                    Nome *
                  </label>

                  <input
                    className="fi"
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </div>

                <div className="fg">
                  <label className="fl">
                    Cor da borda
                  </label>

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
                  onClick={() =>
                    setBoardCreateOpen(
                      false,
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
                    ? 'Criando...'
                    : 'Criar Quadro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteColumn && (
        <div
          className="modal-ov"
          onClick={() =>
            setDeleteColumn(null)
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
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
                onClick={() =>
                  setDeleteColumn(null)
                }
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form
              onSubmit={
                confirmDeleteColumn
              }
            >
              <div className="modal-body">
                <div className="notice notice-warn">
                  <span>
                    Coluna:{' '}
                    <b>
                      {deleteColumn.name}
                    </b>
                    {' • '}
                    {
                      cardsInColumn(
                        deleteColumn.id,
                      ).length
                    }{' '}
                    card(s)
                  </span>
                </div>

                {cardsInColumn(
                  deleteColumn.id,
                ).length > 0 && (
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
                      <option
                        value=""
                        disabled
                      >
                        Escolha a coluna de destino
                      </option>

                      {boardColumns
                        .filter(
                          (column) =>
                            column.id !==
                            deleteColumn.id,
                        )
                        .map(
                          (column) => (
                            <option
                              key={
                                column.id
                              }
                              value={
                                column.id
                              }
                            >
                              {
                                column.name
                              }
                            </option>
                          ),
                        )}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                <button
                  className="bsec"
                  type="button"
                  onClick={() =>
                    setDeleteColumn(
                      null,
                    )
                  }
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
