
'use client'

// AMPY-V17-A22.1 — IDENTIDADE GLOBAL DA EQUIPE

// AMPY-V17-A22.1C — DEMANDAS SEMÂNTICAS

import Link from 'next/link'
import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import TeamMemberIdentity from '@/components/ui/TeamMemberIdentity'
import {
  createDemandFromDemandasAction,
  deleteWorkItemAction,
  updateWorkItemStatusAction,
} from '@/lib/actions'

const STATUS: Record<
  string,
  {
    label: string
    className: string
  }
> = {
  not_started: {
    label: 'Não iniciada',
    className: 'bmut',
  },
  in_progress: {
    label: 'Em andamento',
    className: 'bblue',
  },
  waiting: {
    label: 'Aguardando',
    className: 'bwarn',
  },
  blocked: {
    label: 'Bloqueada',
    className: 'berr',
  },
  in_review: {
    label: 'Em revisão',
    className: 'bwarn',
  },
  awaiting_approval: {
    label: 'Ag. aprovação',
    className: 'bpurp',
  },
  approved: {
    label: 'Aprovada',
    className: 'bok',
  },
  scheduled: {
    label: 'Programada',
    className: 'bblue',
  },
  delivered: {
    label: 'Entregue',
    className: 'bok',
  },
  done: {
    label: 'Concluída',
    className: 'bok',
  },
  cancelled: {
    label: 'Cancelada',
    className: 'bmut',
  },
  archived: {
    label: 'Arquivada',
    className: 'bmut',
  },
}

const PROCESS_LABEL: Record<
  string,
  string
> = {
  quadro: 'Quadro',
  kanban: 'Quadro',
  projeto: 'Projeto',
  ambos: 'Quadro + Projeto',
  avulsa: 'Extra',
}

const PRIORITY_LABEL: Record<
  string,
  string
> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
}

const PRIORITY_WEIGHT: Record<
  string,
  number
> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
}

const CLOSED = [
  'done',
  'delivered',
  'approved',
  'cancelled',
  'archived',
]

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10)
}

function plusDays(days: number) {
  const date = new Date()

  date.setDate(
    date.getDate() + days,
  )

  return date
    .toISOString()
    .slice(0, 10)
}

function fmtDate(
  date?: string | null,
) {
  if (!date) return '—'

  return new Date(
    String(date).slice(0, 10) +
      'T12:00:00',
  ).toLocaleDateString('pt-BR')
}

function fmtShort(
  date?: string | null,
) {
  if (!date) return '--/--'

  return new Date(
    String(date).slice(0, 10) +
      'T12:00:00',
  ).toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
    },
  )
}

function processMatches(
  item: any,
  selected: string,
) {
  const value =
    String(
      item?.destino ||
      'quadro',
    )

  if (selected === 'all') {
    return true
  }

  if (selected === 'pauta') {
    return Boolean(
      item?.pauta_id,
    )
  }

  if (selected === 'quadro') {
    return (
      !item?.pauta_id &&
      [
        'quadro',
        'kanban',
        'ambos',
      ].includes(value)
    )
  }

  if (selected === 'projeto') {
    return [
      'projeto',
      'ambos',
    ].includes(value)
  }

  return value === selected
}

function demandOriginLabel(
  item: any,
) {
  if (item?.pauta_id) {
    return 'Pauta'
  }

  return (
    PROCESS_LABEL[
      item?.destino
    ] ||
    'Quadro'
  )
}

function automaticTitle(
  clientName: string,
  start: string,
  final: string,
) {
  if (
    !clientName ||
    !start ||
    !final
  ) {
    return (
      'O título será gerado ' +
      'automaticamente'
    )
  }

  return (
    clientName.toUpperCase() +
    ' - ' +
    fmtShort(start) +
    ' - ' +
    fmtShort(final)
  )
}

function encodeRouteValue(
  value: unknown,
) {
  return encodeURIComponent(
    String(value || ''),
  )
}

function isProjectDemand(
  item: any,
) {
  return [
    'projeto',
    'ambos',
  ].includes(
    String(
      item?.destino || '',
    ),
  )
}

function isExtraDemand(
  item: any,
) {
  return (
    String(
      item?.destino || '',
    ) === 'avulsa'
  )
}

function demandOriginHref(
  item: any,
) {
  const assignments = Array.isArray(item?.assignments)
    ? item.assignments.filter((assignment: any) => assignment?.assignment_status !== 'removed')
    : []

  if (assignments.length > 0) {
    const assignment = assignments[0]
    return (
      '/dashboard/quadro?board=' +
      encodeRouteValue(assignment.board_id) +
      '&item=' +
      encodeRouteValue(item.id)
    )
  }

  if (item?.pauta_id && item?.board_id) {
    return (
      '/dashboard/pautas?board=' +
      encodeRouteValue(item.board_id) +
      '&pauta=' +
      encodeRouteValue(item.pauta_id) +
      '&item=' +
      encodeRouteValue(item.id)
    )
  }

  if (item?.board_id) {
    return (
      '/dashboard/quadro?board=' +
      encodeRouteValue(item.board_id) +
      '&item=' +
      encodeRouteValue(item.id)
    )
  }

  if (isProjectDemand(item)) {
    return (
      '/dashboard/projetos?project=' +
      encodeRouteValue(item.id) +
      '&item=' +
      encodeRouteValue(item.id)
    )
  }

  return '/dashboard/demandas/' + encodeRouteValue(item?.id)
}

function behaviorStatusClass(
  behavior?: string | null,
) {
  if (behavior === 'done') {
    return 'bok'
  }

  if (behavior === 'blocked') {
    return 'berr'
  }

  if (behavior === 'pending') {
    return 'bwarn'
  }

  if (behavior === 'active') {
    return 'bblue'
  }

  return 'bmut'
}

function operationalStatusClass(
  value?: string | null,
) {
  const status =
    String(value || '')

  if (
    [
      'done',
      'delivered',
      'approved',
    ].includes(status)
  ) {
    return 'bok'
  }

  if (
    [
      'blocked',
      'cancelled',
    ].includes(status)
  ) {
    return 'berr'
  }

  if (
    [
      'pending',
      'not_started',
      'waiting',
      'awaiting_approval',
    ].includes(status)
  ) {
    return 'bwarn'
  }

  if (
    [
      'active',
      'in_progress',
      'scheduled',
      'in_review',
    ].includes(status)
  ) {
    return 'bblue'
  }

  return 'bmut'
}

function demandContextStatus(
  item: any,
) {
  const assignments = Array.isArray(item?.assignments)
    ? item.assignments.filter((assignment: any) => assignment?.assignment_status !== 'removed')
    : []

  if (assignments.length > 0) {
    const completed = assignments.filter((assignment: any) =>
      ['done', 'delivered', 'approved'].includes(String(assignment.operational_status)),
    ).length
    const first = assignments[0]

    return {
      label: assignments.length > 1
        ? completed + '/' + assignments.length + ' Quadros'
        : (first.board?.name || 'Quadro') + ' · ' + (first.board_column?.name || 'Sem coluna'),
      className: operationalStatusClass(item.status),
      color: first.board_column?.color || first.board?.color || null,
    }
  }

  if (item?.board_id) {
    return {
      label: item.board_column?.name || 'Sem coluna',
      className: operationalStatusClass(item.board_column?.operational_status),
      color: item.board_column?.color || null,
    }
  }

  if (isProjectDemand(item)) {
    return {
      label: item.project_status?.name || 'Planejado',
      className: behaviorStatusClass(item.project_status?.behavior),
      color: item.project_status?.color || null,
    }
  }

  const config = STATUS[item?.status] || STATUS.not_started
  return { label: config.label, className: config.className, color: null }
}

// AMPY-V17-A23.1.2.1B-EXTRA-CANONICO
export default function DemandasView({
  demands = [],
  clients = [],
  profiles = [],
  clientServices = [],
  boards = [],
  boardColumns = [],
  pautas = [],
  pautaCards = [],
  initialCreateContext = null,
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

  const safeBoards =
    Array.isArray(boards)
      ? boards.filter(Boolean)
      : []

  const safeColumns =
    Array.isArray(boardColumns)
      ? boardColumns.filter(Boolean)
      : []

  const safePautas =
    Array.isArray(pautas)
      ? pautas.filter(Boolean)
      : []

  const safePautaCards =
    Array.isArray(pautaCards)
      ? pautaCards.filter(Boolean)
      : []

  const safeCustomBoards =
    safeBoards.filter(
      (board: any) =>
        board.board_kind ===
        'custom',
    )

  const safeLoadErrors =
    Array.isArray(loadErrors)
      ? loadErrors.filter(Boolean)
      : []

  const initialFormKind = 'avulsa' as const

  const [items, setItems] =
    useState(safeDemands)

  const [open, setOpen] =
    useState(
      Boolean(
        initialCreateContext
          ?.open,
      ),
    )

  const [search, setSearch] =
    useState('')

  const [status, setStatus] =
    useState('all')

  const [process, setProcess] =
    useState('all')

  const [clientId, setClientId] =
    useState('all')

  const [
    responsibleId,
    setResponsibleId,
  ] = useState('all')

  const [priority, setPriority] =
    useState('all')

  const [deadline, setDeadline] =
    useState('all')

  const [sort, setSort] =
    useState('deadline_asc')

  const [
    formKind,
    setFormKind,
  ] = useState<
    'pauta' |
    'quadro' |
    'avulsa'
  >(
    initialFormKind,
  )

  const [
    formPauta,
    setFormPauta,
  ] = useState(
    String(
      initialCreateContext
        ?.pautaId ||
      '',
    ),
  )

  const [formClient, setFormClient] =
    useState('')

  const [formBoard, setFormBoard] =
    useState(
      String(
        initialCreateContext
          ?.boardId ||
        '',
      ),
    )

  const [formColumn, setFormColumn] =
    useState(
      String(
        initialCreateContext
          ?.columnId ||
        '',
      ),
    )

  const [formStart, setFormStart] =
    useState('')

  const [formFinal, setFormFinal] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const selectedClient =
    safeClients.find(
      (client: any) =>
        client.id === formClient,
    ) || null

  const selectedPauta =
    safePautas.find(
      (pauta: any) =>
        pauta.id === formPauta,
    ) || null

  const resolvedFormBoard =
    formKind === 'pauta'
      ? selectedPauta
          ?.board_id || ''
      : formBoard

  const pautaClientIds =
    new Set(
      safePautaCards
        .filter(
          (item: any) =>
            item.pauta_id ===
              formPauta &&
            item.is_pauta_card ===
              true,
        )
        .map(
          (item: any) =>
            item.client_id,
        )
        .filter(Boolean),
    )

  const formClients =
    formKind === 'pauta'
      ? safeClients.filter(
          (client: any) =>
            pautaClientIds.has(
              client.id,
            ),
        )
      : safeClients

  const activeServices =
    formClient
      ? safeClientServices.filter(
          (item: any) =>
            item.client_id ===
              formClient &&
            item.status === 'active',
        )
      : []

  const activeColumns =
    resolvedFormBoard
      ? safeColumns.filter(
          (column: any) =>
            column.board_id ===
            resolvedFormBoard,
        )
      : []

  const filtered = useMemo(() => {
    const now = today()
    const next7 = plusDays(7)

    const list = items.filter(
      (item: any) => {
        const itemDeadline =
          item.final_deadline || ''

        const isLate = Boolean(
          itemDeadline &&
            itemDeadline < now &&
            !CLOSED.includes(
              String(item.status),
            ),
        )

        const isOpen =
          !CLOSED.includes(
            String(item.status),
          )

        const term =
          search
            .trim()
            .toLowerCase()

        const matchesSearch =
          !term ||
          String(item.title || '')
            .toLowerCase()
            .includes(term) ||
          String(
            item.client?.name || '',
          )
            .toLowerCase()
            .includes(term) ||
          String(
            item.board?.name || '',
          )
            .toLowerCase()
            .includes(term) ||
          String(
            item.board_column
              ?.name || '',
          )
            .toLowerCase()
            .includes(term)

        const matchesStatus =
          status === 'all' ||
          (
            status === 'open' &&
            isOpen
          ) ||
          item.status === status ||
          (
            status === 'late' &&
            isLate
          )

        const matchesDeadline =
          deadline === 'all' ||
          (
            deadline === 'today' &&
            item.final_deadline ===
              now
          ) ||
          (
            deadline === 'late' &&
            isLate
          ) ||
          (
            deadline ===
              'next7' &&
            itemDeadline &&
            itemDeadline >= now &&
            itemDeadline <= next7
          ) ||
          (
            deadline ===
              'no_final' &&
            !item.final_deadline
          )

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDeadline &&
          processMatches(
            item,
            process,
          ) &&
          (
            clientId === 'all' ||
            item.client_id ===
              clientId
          ) &&
          (
            responsibleId ===
              'all' ||
            item.responsible_id ===
              responsibleId
          ) &&
          (
            priority === 'all' ||
            item.priority ===
              priority
          )
        )
      },
    )

    return [...list].sort(
      (a: any, b: any) => {
        const dateA =
          a.final_deadline ||
          '9999-12-31'

        const dateB =
          b.final_deadline ||
          '9999-12-31'

        if (sort === 'az') {
          return String(
            a.title || '',
          ).localeCompare(
            String(b.title || ''),
            'pt-BR',
          )
        }

        if (sort === 'za') {
          return String(
            b.title || '',
          ).localeCompare(
            String(a.title || ''),
            'pt-BR',
          )
        }

        if (
          sort ===
          'deadline_desc'
        ) {
          return dateB.localeCompare(
            dateA,
          )
        }

        if (
          sort ===
          'priority_desc'
        ) {
          return (
            (
              PRIORITY_WEIGHT[
                b.priority
              ] || 0
            ) -
              (
                PRIORITY_WEIGHT[
                  a.priority
                ] || 0
              ) ||
            dateA.localeCompare(
              dateB,
            )
          )
        }

        if (
          sort ===
          'priority_asc'
        ) {
          return (
            (
              PRIORITY_WEIGHT[
                a.priority
              ] || 0
            ) -
              (
                PRIORITY_WEIGHT[
                  b.priority
                ] || 0
              ) ||
            dateA.localeCompare(
              dateB,
            )
          )
        }

        if (sort === 'recent') {
          return String(
            b.created_at || '',
          ).localeCompare(
            String(
              a.created_at || '',
            ),
          )
        }

        if (sort === 'oldest') {
          return String(
            a.created_at || '',
          ).localeCompare(
            String(
              b.created_at || '',
            ),
          )
        }

        if (sort === 'status') {
          return String(
            a.status || '',
          ).localeCompare(
            String(
              b.status || '',
            ),
            'pt-BR',
          )
        }

        return dateA.localeCompare(
          dateB,
        )
      },
    )
  }, [
    items,
    search,
    status,
    process,
    clientId,
    responsibleId,
    priority,
    deadline,
    sort,
  ])

  function openDemandModal() {
    setFormKind('avulsa')
    setFormPauta('')
    setFormClient('')
    setFormBoard('')
    setFormColumn('')
    setFormStart('')
    setFormFinal('')
    setError('')
    setOpen(true)
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const formData =
      new FormData(
        event.currentTarget,
      )

    formData.set(
      'demand_kind',
      formKind,
    )

    const result =
      await createDemandFromDemandasAction(
        formData,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Erro ao criar demanda.',
      )
      setLoading(false)
      return
    }

    window.location.href =
      '/dashboard/demandas'
  }

  async function archive(
    id: string,
  ) {
    const confirmed = confirm(
      'Arquivar esta demanda? ' +
        'Ela sairá das visões ' +
        'operacionais sem apagar ' +
        'o histórico.',
    )

    if (!confirmed) return

    const result =
      await deleteWorkItemAction(
        id,
      )

    if ('error' in result) {
      alert(result.error)
      return
    }

    setItems((current) =>
      current.filter(
        (item: any) =>
          item.id !== id,
      ),
    )
  }

  async function quickStatus(
    id: string,
    next: string,
  ) {
    const previous = items

    setItems((current) =>
      current.map((item: any) =>
        item.id === id
          ? {
              ...item,
              status: next,
            }
          : item,
      ),
    )

    const result =
      await updateWorkItemStatusAction(
        id,
        next,
      )

    if ('error' in result) {
      setItems(previous)
      alert(result.error)
    }
  }

  return (
    <div className="page-wrap ops-page demandas-a16-page">
      <div className="topbar">
        <div>
          <div className="tb-title">
            Demandas
          </div>

          <div className="tb-sub">
            Pautas, Quadros, Extras e Projetos
            na mesma operação.
          </div>
        </div>

        <div className="topbar-actions">
          <div className="sbox">
            <i className="ti ti-search" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Buscar demanda, cliente, Pauta, Quadro ou coluna..."
            />
          </div>

          <button
            className="bpri"
            type="button"
            onClick={openDemandModal}
          >
            <i className="ti ti-plus" />
            Nova demanda
          </button>
        </div>
      </div>

      <div className="demandas-a16-statuses">
        {[
          ['all', 'Todas'],
          ['open', 'Abertas'],
          [
            'in_progress',
            'Em andamento',
          ],
          ['blocked', 'Bloqueadas'],
          [
            'awaiting_approval',
            'Ag. aprovação',
          ],
          ['late', 'Atrasadas'],
          ['done', 'Concluídas'],
        ].map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              className={
                status === key
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setStatus(key)
              }
            >
              {label}
            </button>
          ),
        )}
      </div>

      <div className="demandas-a16-filters">
        <select
          className="fi compact"
          value={process}
          onChange={(event) =>
            setProcess(
              event.target.value,
            )
          }
        >
          <option value="all">
            Todas as origens
          </option>
          <option value="pauta">
            Pauta
          </option>
          <option value="quadro">
            Quadro
          </option>
          <option value="projeto">
            Projeto
          </option>
          <option value="avulsa">
            Extra
          </option>
        </select>

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

          {safeProfiles.map(
            (profile: any) => (
              <option
                key={profile.id}
                value={profile.id}
              >
                {profile.display_name || profile.full_name}
              </option>
            ),
          )}
        </select>

        <select
          className="fi compact"
          value={priority}
          onChange={(event) =>
            setPriority(
              event.target.value,
            )
          }
        >
          <option value="all">
            Todas as prioridades
          </option>
          <option value="urgent">
            Urgente
          </option>
          <option value="high">
            Alta
          </option>
          <option value="normal">
            Normal
          </option>
          <option value="low">
            Baixa
          </option>
        </select>

        <select
          className="fi compact"
          value={deadline}
          onChange={(event) =>
            setDeadline(
              event.target.value,
            )
          }
        >
          <option value="all">
            Todos os prazos finais
          </option>
          <option value="today">
            Final hoje
          </option>
          <option value="late">
            Atrasadas
          </option>
          <option value="next7">
            Final nos próximos 7 dias
          </option>
          <option value="no_final">
            Sem prazo final
          </option>
        </select>

        <select
          className="fi compact"
          value={sort}
          onChange={(event) =>
            setSort(
              event.target.value,
            )
          }
        >
          <option value="deadline_asc">
            Final: menor → maior
          </option>
          <option value="deadline_desc">
            Final: maior → menor
          </option>
          <option value="priority_desc">
            Prioridade: maior → menor
          </option>
          <option value="priority_asc">
            Prioridade: menor → maior
          </option>
          <option value="az">
            A–Z
          </option>
          <option value="za">
            Z–A
          </option>
          <option value="recent">
            Mais recentes
          </option>
          <option value="oldest">
            Mais antigas
          </option>
          <option value="status">
            Status
          </option>
        </select>
      </div>

      {safeLoadErrors.length > 0 && (
        <div className="notice notice-err">
          <i className="ti ti-alert-circle" />
          <span>
            {safeLoadErrors.join(
              ' | ',
            )}
          </span>
        </div>
      )}

      <div className="demandas-a16-count">
        {filtered.length}
        {' '}demanda(s) encontrada(s)
      </div>

      {!filtered.length ? (
        <div className="empty">
          <i className="ti ti-list-check" />

          <div className="empty-title">
            Nenhuma demanda encontrada
          </div>

          <div className="empty-sub">
            Crie uma demanda de Quadro
            ou um Extra. Projetos são
            criados na aba Projetos.
          </div>
        </div>
      ) : (
        <div className="demandas-a16-table-wrap">
          <table className="demandas-a16-table">
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Cliente / serviço</th>
                <th>Origem</th>
                <th>Quadro / coluna</th>
                <th>Início</th>
                <th>Final</th>
                <th>Responsável</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filtered.map(
                (item: any) => {
                  const isLate = Boolean(
                    item.final_deadline &&
                      item.final_deadline <
                        today() &&
                      !CLOSED.includes(
                        String(
                          item.status,
                        ),
                      ),
                  )

                  const statusCfg =
                    STATUS[item.status] ||
                    STATUS.not_started

                  const contextStatus =
                    demandContextStatus(
                      item,
                    )

                  const extraDemand =
                    isExtraDemand(item)

                  return (
                    <tr
                      key={item.id}
                      id={
                        'demanda-' +
                        item.id
                      }
                    >
                      <td>
                        <Link
                          className="demandas-a16-title"
                          href={
                            demandOriginHref(
                              item,
                            )
                          }
                        >
                          {item.title}
                        </Link>

                        <small>
                          {item.type ||
                            'Operação'}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {item.client?.name ||
                            'Interno Ampy'}
                        </strong>

                        <small>
                          {item
                            .client_service
                            ?.service?.name ||
                            'Sem serviço'}
                        </small>
                      </td>

                      <td>
                        <span className="demandas-a16-origin">
                          {demandOriginLabel(
                            item,
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="demandas-a23-origin-links">
                          {item.pauta_id &&
                            item.board_id && (
                            <div>
                              <Link
                                className="demandas-a16-context-link"
                                href={
                                  '/dashboard/pautas?board=' +
                                  encodeRouteValue(
                                    item.board_id,
                                  ) +
                                  '&pauta=' +
                                  encodeRouteValue(
                                    item.pauta_id,
                                  ) +
                                  '&item=' +
                                  encodeRouteValue(
                                    item.id,
                                  )
                                }
                              >
                                {item.pauta
                                  ?.name ||
                                  'Abrir Pauta'}
                              </Link>

                              <small>
                                {item
                                  .board_column
                                  ?.name ||
                                  'Sem coluna'}
                              </small>
                            </div>
                          )}

                          {item.board_id &&
                            !item.pauta_id && (
                            <div>
                              <Link
                                className="demandas-a16-context-link"
                                href={
                                  '/dashboard/quadro?board=' +
                                  encodeRouteValue(
                                    item.board_id,
                                  ) +
                                  '&item=' +
                                  encodeRouteValue(
                                    item.id,
                                  )
                                }
                              >
                                {item.board
                                  ?.name ||
                                  'Abrir Quadro'}
                              </Link>

                              <small>
                                {item
                                  .board_column
                                  ?.name ||
                                  'Sem coluna'}
                              </small>
                            </div>
                          )}

                          {isProjectDemand(
                            item,
                          ) && (
                            <Link
                              className="demandas-a16-context-link"
                              href={
                                '/dashboard/projetos?project=' +
                                encodeRouteValue(
                                  item.id,
                                ) +
                                '&item=' +
                                encodeRouteValue(
                                  item.id,
                                )
                              }
                            >
                              Abrir Projeto
                            </Link>
                          )}

                          {extraDemand && (
                            <span>Extra</span>
                          )}

                          {!item.board_id &&
                            !isProjectDemand(
                              item,
                            ) &&
                            !extraDemand && (
                              <span>
                                Sem origem
                              </span>
                            )}
                        </div>
                      </td>

                      <td>
                        {fmtDate(
                          item.internal_deadline,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            isLate
                              ? 'demandas-a16-final late'
                              : !item.final_deadline
                                ? 'demandas-a16-final missing'
                                : 'demandas-a16-final'
                          }
                        >
                          {fmtDate(
                            item.final_deadline,
                          )}
                        </span>
                      </td>

                      <td>
                        <TeamMemberIdentity member={item.responsible} />
                      </td>

                      <td>
                        <span
                          className={
                            'demandas-a16-priority ' +
                            (
                              item.priority ||
                              'normal'
                            )
                          }
                        >
                          {PRIORITY_LABEL[
                            item.priority
                          ] ||
                            'Normal'}
                        </span>
                      </td>

                      <td>
                        {extraDemand ? (
                          <select
                            className={
                              'demandas-a16-status ' +
                              statusCfg.className
                            }
                            value={
                              item.status
                            }
                            onChange={(
                              event,
                            ) =>
                              quickStatus(
                                item.id,
                                event.target
                                  .value,
                              )
                            }
                          >
                            {Object.entries(
                              STATUS,
                            ).map(
                              ([
                                key,
                                config,
                              ]) => (
                                <option
                                  key={key}
                                  value={key}
                                >
                                  {
                                    config.label
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <span
                            className={
                              'demandas-a23-context-status ' +
                              contextStatus.className
                            }
                            style={
                              contextStatus.color
                                ? {
                                    color:
                                      contextStatus.color,
                                    borderColor:
                                      contextStatus.color,
                                  }
                                : undefined
                            }
                            title={
                              item.board_id
                                ? 'Status derivado da coluna do Quadro'
                                : 'Status derivado da etapa atual do Projeto'
                            }
                          >
                            {
                              contextStatus.label
                            }
                          </span>
                        )}
                      </td>

                      <td>
                        {item.is_pauta_card ? (
                          <span
                            className="badge bmut"
                            title="Card mensal gerenciado pela Pauta"
                          >
                            Pauta
                          </span>
                        ) : (
                          <button
                            className="icon-btn danger"
                            type="button"
                            title="Arquivar"
                            onClick={() =>
                              archive(item.id)
                            }
                          >
                            <i className="ti ti-archive" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                },
              )}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div
          className="modal-ov"
          onClick={() =>
            setOpen(false)
          }
        >
          <div
            className="modal context-modal-wide demandas-a16-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  Nova demanda
                </div>

                <div className="modal-sub">
                  Registre um Extra sem alterar
                  a estrutura de Pautas ou Quadros.
                </div>
              </div>

              <button
                className="mclose"
                type="button"
                onClick={() =>
                  setOpen(false)
                }
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={submit}>
              <div className="modal-body">
                <input
                  type="hidden"
                  name="demand_kind"
                  value="avulsa"
                />

                <div className="notice notice-info">
                  <i className="ti ti-info-circle" />
                  <span>
                    Demandas cria somente Extras. Demandas de Pauta e de Quadro devem nascer no contexto operacional correto.
                  </span>
                </div>

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
                    placeholder="Informe a atividade extra"
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
                      value={formClient}
                      onChange={(event) =>
                        setFormClient(
                          event.target
                            .value,
                        )
                      }
                    >
                      <option
                        value=""
                      >
                        Interno Ampy
                      </option>

                      {formClients.map(
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
                      disabled={
                        !formClient
                      }
                      defaultValue=""
                    >
                      <option value="">
                        {formClient
                          ? 'Sem serviço específico'
                          : 'Selecione o cliente primeiro'}
                      </option>

                      {activeServices.map(
                        (
                          item: any,
                        ) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item.service
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
                      defaultValue=""
                    >
                      <option
                        value=""
                        disabled
                      >
                        Selecione o responsável
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
                            {profile.display_name || profile.full_name}
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
                      defaultValue="normal"
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
                      value={formStart}
                      onChange={(event) =>
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
                      value={formFinal}
                      onChange={(event) =>
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
                    placeholder="Contexto, orientação ou informação necessária para executar a atividade."
                  />
                </div>

                {error && (
                  <div className="notice notice-err">
                    <i className="ti ti-alert-circle" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="bsec"
                  onClick={() =>
                    setOpen(false)
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
                    : 'Criar demanda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
