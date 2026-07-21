
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
  destino:
    | string
    | null
    | undefined,
  selected: string,
) {
  const value =
    String(destino || 'quadro')

  if (selected === 'all') {
    return true
  }

  if (selected === 'quadro') {
    return [
      'quadro',
      'kanban',
      'ambos',
    ].includes(value)
  }

  if (selected === 'projeto') {
    return [
      'projeto',
      'ambos',
    ].includes(value)
  }

  return value === selected
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

export default function DemandasView({
  demands = [],
  clients = [],
  profiles = [],
  clientServices = [],
  boards = [],
  boardColumns = [],
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

  const safeLoadErrors =
    Array.isArray(loadErrors)
      ? loadErrors.filter(Boolean)
      : []

  const [items, setItems] =
    useState(safeDemands)

  const [open, setOpen] =
    useState(false)

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

  const [formKind, setFormKind] =
    useState<
      'quadro' | 'avulsa'
    >('quadro')

  const [formClient, setFormClient] =
    useState('')

  const [formBoard, setFormBoard] =
    useState('')

  const [formColumn, setFormColumn] =
    useState('')

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
    formBoard
      ? safeColumns.filter(
          (column: any) =>
            column.board_id ===
            formBoard,
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
            item.destino,
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
    setFormKind('quadro')
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

    window.location.reload()
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
            Quadro, Extras e Projetos
            em uma visão operacional.
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
              placeholder="Buscar demanda, cliente, Quadro ou coluna..."
            />
          </div>

          <button
            className="bpri"
            type="button"
            onClick={openDemandModal}
          >
            <i className="ti ti-plus" />
            Nova Demanda
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

                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="demandas-a16-title"
                          href={
                            '/dashboard/demandas/' +
                            item.id
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
                          {PROCESS_LABEL[
                            item.destino
                          ] ||
                            'Quadro'}
                        </span>
                      </td>

                      <td>
                        {item.destino ===
                          'projeto' ||
                        item.destino ===
                          'ambos' ? (
                          <Link
                            className="demandas-a16-context-link"
                            href="/dashboard/projetos"
                          >
                            Abrir Projetos
                          </Link>
                        ) : item.destino ===
                            'avulsa' ? (
                          <span>Extra</span>
                        ) : (
                          <div>
                            <strong>
                              {item.board
                                ?.name ||
                                'Sem Quadro'}
                            </strong>

                            <small>
                              {item
                                .board_column
                                ?.name ||
                                'Sem coluna'}
                            </small>
                          </div>
                        )}
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
                        <select
                          className={
                            'demandas-a16-status ' +
                            statusCfg.className
                          }
                          value={item.status}
                          onChange={(event) =>
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
                      </td>

                      <td>
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
                  Nova Demanda
                </div>

                <div className="modal-sub">
                  Crie no Quadro ou
                  registre um Extra.
                  Projetos permanecem na
                  aba Projetos.
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
                <div className="fg">
                  <label className="fl">
                    Tipo de demanda *
                  </label>

                  <div className="demandas-a16-kind">
                    <button
                      type="button"
                      className={
                        formKind ===
                        'quadro'
                          ? 'active'
                          : ''
                      }
                      onClick={() => {
                        setFormKind(
                          'quadro',
                        )
                        setError('')
                      }}
                    >
                      <i className="ti ti-layout-kanban" />
                      Quadro
                    </button>

                    <button
                      type="button"
                      className={
                        formKind ===
                        'avulsa'
                          ? 'active'
                          : ''
                      }
                      onClick={() => {
                        setFormKind(
                          'avulsa',
                        )
                        setFormBoard('')
                        setFormColumn('')
                        setError('')
                      }}
                    >
                      <i className="ti ti-bolt" />
                      Extra
                    </button>
                  </div>

                  <input
                    type="hidden"
                    name="demand_kind"
                    value={formKind}
                  />
                </div>

                {formKind ===
                'quadro' ? (
                  <>
                    <div className="frow">
                      <div className="fg">
                        <label className="fl">
                          Quadro *
                        </label>

                        <select
                          className="fi"
                          name="board_id"
                          required
                          value={formBoard}
                          onChange={(
                            event,
                          ) => {
                            setFormBoard(
                              event.target
                                .value,
                            )
                            setFormColumn('')
                          }}
                        >
                          <option
                            value=""
                            disabled
                          >
                            Selecione o Quadro
                          </option>

                          {safeBoards.map(
                            (
                              board: any,
                            ) => (
                              <option
                                key={
                                  board.id
                                }
                                value={
                                  board.id
                                }
                              >
                                {
                                  board.name
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="fg">
                        <label className="fl">
                          Coluna *
                        </label>

                        <select
                          className="fi"
                          name="board_column_id"
                          required
                          disabled={
                            !formBoard
                          }
                          value={formColumn}
                          onChange={(
                            event,
                          ) =>
                            setFormColumn(
                              event.target
                                .value,
                            )
                          }
                        >
                          <option
                            value=""
                            disabled
                          >
                            {formBoard
                              ? 'Selecione a coluna'
                              : 'Selecione o Quadro primeiro'}
                          </option>

                          {activeColumns.map(
                            (
                              column: any,
                            ) => (
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
                    </div>

                    <div className="demandas-a16-title-preview">
                      <span>
                        Título automático
                      </span>

                      <strong>
                        {automaticTitle(
                          selectedClient
                            ?.name || '',
                          formStart,
                          formFinal,
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
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
                )}

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Cliente
                      {formKind ===
                      'quadro'
                        ? ' *'
                        : ''}
                    </label>

                    <select
                      className="fi"
                      name="client_id"
                      required={
                        formKind ===
                        'quadro'
                      }
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
                        disabled={
                          formKind ===
                          'quadro'
                        }
                      >
                        {formKind ===
                        'quadro'
                          ? 'Selecione o cliente'
                          : 'Interno Ampy'}
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
