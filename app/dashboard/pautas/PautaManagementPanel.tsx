'use client'

import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  addClientsToPautaV8Action,
  changePautaLifecycleAction,
  createAndDistributePautaDemandsAction,
  distributeExistingPautaDemandsAction,
  removePautaClientsBatchAction,
  removePautaDemandsBatchAction,
  updatePautaSettingsAction,
} from '@/lib/actions'

function list(value: unknown) {
  return Array.isArray(value) ? value : []
}

function dateValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : ''
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(String(value).slice(0, 10) + 'T12:00:00')
    .toLocaleDateString('pt-BR')
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    open: 'Aberta',
    closed: 'Concluída',
    archived: 'Arquivada',
    not_started: 'Não iniciada',
    in_progress: 'Em andamento',
    waiting: 'Aguardando',
    blocked: 'Bloqueada',
    in_review: 'Em revisão',
    awaiting_approval: 'Aguardando aprovação',
    approved: 'Aprovada',
    scheduled: 'Programada',
    delivered: 'Entregue',
    done: 'Concluída',
  }

  return labels[String(value || '')] || String(value || '—')
}

function eventLabel(value?: string | null) {
  const labels: Record<string, string> = {
    pauta_created: 'Pauta criada',
    settings_updated: 'Configurações atualizadas',
    client_added: 'Cliente adicionado',
    client_removed: 'Cliente retirado',
    client_target_date_set: 'Data-meta definida',
    client_target_date_updated: 'Data-meta atualizada',
    demand_created: 'Demanda criada',
    demand_created_multiboard: 'Demanda criada e distribuída',
    demand_distributed: 'Demanda distribuída',
    assignment_created: 'Distribuição criada',
    demand_detached: 'Demanda retirada',
    assignment_moved: 'Demanda movimentada em Quadro',
    lifecycle_close: 'Pauta concluída',
    lifecycle_reopen: 'Pauta reaberta',
    lifecycle_archive: 'Pauta arquivada',
  }

  return labels[String(value || '')] || String(value || 'Atualização')
}

function jsonSummary(value: unknown) {
  if (!value || typeof value !== 'object') return ''

  const entries = Object.entries(
    value as Record<string, unknown>,
  )

  if (!entries.length) return ''

  return entries
    .slice(0, 5)
    .map(
      ([key, next]) =>
        `${key}: ${String(next ?? '—')}`,
    )
    .join(' · ')
}

function assignmentComplete(value?: string | null) {
  return [
    'done',
    'delivered',
    'approved',
  ].includes(
    String(value || ''),
  )
}

export default function PautaManagementPanel({
  open,
  onClose,
  snapshot,
  pautaCards = [],
  clients = [],
  profiles = [],
  clientServices = [],
  distributionBoards = [],
  distributionColumns = [],
  pautaColumns = [],
  canManage = false,
}: any) {
  const pauta = snapshot?.pauta || null
  const members = list(snapshot?.members)
  const extraDemands = list(snapshot?.extra_demands)
  const events = list(snapshot?.events)
  const dependencies =
    snapshot?.dependency_summary || {}

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member: any) =>
          member.membership_status === 'active',
      ),
    [members],
  )

  const activeMemberClientIds = useMemo(
    () =>
      new Set(
        activeMembers
          .map((member: any) =>
            String(member.client?.id || ''),
          )
          .filter(Boolean),
      ),
    [activeMembers],
  )

  const eligibleClients = useMemo(
    () =>
      list(clients).filter(
        (client: any) =>
          client.status === 'active' &&
          !activeMemberClientIds.has(
            String(client.id),
          ),
      ),
    [clients, activeMemberClientIds],
  )

  const operationalDemands = useMemo(() => {
    const byId = new Map<string, any>()

    for (const item of list(pautaCards)) {
      if (!item?.id) continue

      byId.set(
        String(item.id),
        {
          ...item,
          demand_kind: 'main',
        },
      )
    }

    for (const item of extraDemands) {
      if (!item?.id) continue

      byId.set(
        String(item.id),
        {
          ...item,
          demand_kind: 'extra',
        },
      )
    }

    return Array.from(byId.values())
  }, [
    pautaCards,
    extraDemands,
  ])

  const demandsByClient =
    useMemo(
      () => {
        const result =
          new Map<
            string,
            any[]
          >()

        for (
          const item
          of operationalDemands
        ) {
          const id =
            String(
              item.client_id ||
              item.client
                ?.id ||
              '',
            )

          if (!id) {
            continue
          }

          const current =
            result.get(
              id,
            ) || []

          current.push(
            item,
          )

          result.set(
            id,
            current,
          )
        }

        return result
      },
      [
        operationalDemands,
      ],
    )

  const pautaColumnsById =
    useMemo(
      () =>
        new Map(
          list(
            pautaColumns,
          ).map(
            (
              column:
                any,
            ) => [
              String(
                column.id,
              ),
              column,
            ],
          ),
        ),
      [
        pautaColumns,
      ],
    )

  const unifiedClientRows =
    useMemo(
      () =>
        activeMembers.map(
          (
            member:
              any,
          ) => {
            const clientId =
              String(
                member.client
                  ?.id ||
                '',
              )

            return {
              member,

              client:
                member.client,

              clientId,

              demands:
                demandsByClient
                  .get(
                    clientId,
                  ) || [],
            }
          },
        ),
      [
        activeMembers,
        demandsByClient,
      ],
    )

  function demandLocationChips(
    item: any,
  ) {
    const chips:
      Array<{
        key: string
        label: string
        tone?: string
      }> = []

    const pautaColumn =
      item.board_column_id
        ? pautaColumnsById.get(
            String(
              item.board_column_id,
            ),
          )
        : null

    if (pautaColumn) {
      chips.push({
        key:
          'pauta-' +
          item.id,

        label:
          'Pauta · ' +
          String(
            pautaColumn
              ?.name ||
            'Sem etapa',
          ),

        tone:
          'pauta',
      })
    }

    for (
      const assignment
      of list(
        item.assignments,
      )
    ) {
      chips.push({
        key:
          String(
            assignment.id,
          ),

        label:
          String(
            assignment
              .board_name ||
            assignment
              .board
              ?.name ||
            'Quadro',
          ) +
          ' · ' +
          String(
            assignment
              .board_column_name ||
            assignment
              .board_column
              ?.name ||
            'Sem coluna',
          ),

        tone:
          assignmentComplete(
            assignment
              .operational_status,
          )
            ? 'done'
            : 'active',
      })
    }

    if (
      chips.length ===
      0
    ) {
      chips.push({
        key:
          'pending-' +
          item.id,

        label:
          'Ainda não distribuída',

        tone:
          'pending',
      })
    }

    return chips
  }

  const extraDemandIds = useMemo(
    () =>
      new Set(
        extraDemands
          .map((item: any) =>
            String(item?.id || ''),
          )
          .filter(Boolean),
      ),
    [extraDemands],
  )

  const [tab, setTab] =
    useState<
      'overview' |
      'clients' |
      'history'
    >('overview')

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [notice, setNotice] =
    useState('')

  const [
    selectedMemberIds,
    setSelectedMemberIds,
  ] = useState<string[]>([])

  const [
    selectedDemandIds,
    setSelectedDemandIds,
  ] = useState<string[]>([])

  const [
    selectedNewClientIds,
    setSelectedNewClientIds,
  ] = useState<string[]>([])

  const [
    addClientsConfirmation,
    setAddClientsConfirmation,
  ] = useState('')

  const [
    removeClientsConfirmation,
    setRemoveClientsConfirmation,
  ] = useState('')

  const [
    removeDemandsConfirmation,
    setRemoveDemandsConfirmation,
  ] = useState('')

  const [
    distributionConfirmation,
    setDistributionConfirmation,
  ] = useState('')

  const [
    createConfirmation,
    setCreateConfirmation,
  ] = useState('')

  const [
    addClientsOpen,
    setAddClientsOpen,
  ] = useState(false)

  const [
    removeClientsOpen,
    setRemoveClientsOpen,
  ] = useState(false)

  const [
    removeDemandsOpen,
    setRemoveDemandsOpen,
  ] = useState(false)

  const [
    demandOpen,
    setDemandOpen,
  ] = useState(false)

  const [
    demandClientIds,
    setDemandClientIds,
  ] = useState<string[]>([])

  const [
    serviceByClient,
    setServiceByClient,
  ] = useState<
    Record<string, string>
  >({})

  const [
    selectedTargets,
    setSelectedTargets,
  ] = useState<
    Record<
      string,
      {
        columnId: string
        required: boolean
      }
    >
  >({})

  const [
    existingDistributionOpen,
    setExistingDistributionOpen,
  ] = useState(false)

  const [
    existingTargets,
    setExistingTargets,
  ] = useState<
    Record<
      string,
      {
        columnId: string
        required: boolean
      }
    >
  >({})

  const [
    distributionError,
    setDistributionError,
  ] = useState('')

  const [
    distributionNotice,
    setDistributionNotice,
  ] = useState('')

  const editable = [
    'draft',
    'open',
  ].includes(
    String(
      pauta?.lifecycle_status || '',
    ),
  )

  const selectedExtraDemandIds =
    selectedDemandIds.filter(
      (id) =>
        extraDemandIds.has(id),
    )

  const selectedMainDemandCount =
    selectedDemandIds.length -
    selectedExtraDemandIds.length

  const selectedDistributionTargets =
    Object.entries(
      existingTargets,
    )

  const incompleteDistributionTargets =
    selectedDistributionTargets.filter(
      ([boardId, config]) => {
        const availableColumns =
          list(
            distributionColumns,
          ).filter(
            (column: any) =>
              String(
                column.board_id,
              ) ===
              String(boardId),
          )

        return (
          !config.columnId ||
          !availableColumns.some(
            (column: any) =>
              String(column.id) ===
              String(
                config.columnId,
              ),
          )
        )
      },
    )

  const distributionConfirmationValid =
    distributionConfirmation.trim() ===
    'DISTRIBUIR DEMANDAS'

  const canSubmitDistribution =
    selectedDemandIds.length > 0 &&
    selectedDistributionTargets.length > 0 &&
    incompleteDistributionTargets.length === 0 &&
    distributionConfirmationValid &&
    !loading

  if (!open || !pauta) {
    return null
  }

  function reload() {
    window.location.reload()
  }

  function beginAction() {
    setLoading(true)
    setError('')
    setNotice('')
  }

  function failAction(message: string) {
    setError(message)
    setLoading(false)
  }

  function failDistribution(
    message: string,
  ) {
    setDistributionError(message)
    setDistributionNotice('')
    setLoading(false)
  }

  async function saveSettings(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    beginAction()

    const result =
      await updatePautaSettingsAction(
        pauta.id,
        new FormData(
          event.currentTarget,
        ),
      )

    if ('error' in result) {
      return failAction(
        result.error ||
        'Não foi possível atualizar a Pauta.',
      )
    }

    setNotice(
      'Configurações atualizadas.',
    )

    reload()
  }

  async function addClients() {
    const targetDate =
      dateValue(
        pauta.scheduled_until_date,
      )

    const rows =
      selectedNewClientIds.map(
        (clientId) => ({
          clientId,
          targetDate,
        }),
      )

    beginAction()

    const result =
      await addClientsToPautaV8Action(
        pauta.id,
        rows,
        addClientsConfirmation,
      )

    if ('error' in result) {
      return failAction(
        result.error ||
        'Não foi possível adicionar os clientes.',
      )
    }

    reload()
  }

  async function removeClients() {
    const clientIds =
      activeMembers
        .filter(
          (member: any) =>
            selectedMemberIds.includes(
              String(
                member.member_id,
              ),
            ),
        )
        .map((member: any) =>
          String(
            member.client?.id || '',
          ),
        )
        .filter(Boolean)

    beginAction()

    const result =
      await removePautaClientsBatchAction(
        pauta.id,
        clientIds,
        removeClientsConfirmation,
      )

    if ('error' in result) {
      return failAction(
        result.error ||
        'Não foi possível retirar os clientes.',
      )
    }

    reload()
  }

  async function removeDemands() {
    if (
      selectedMainDemandCount > 0
    ) {
      return failAction(
        'Cards mensais devem ser retirados removendo o cliente da Pauta. A ação Remover aceita somente demandas adicionais.',
      )
    }

    beginAction()

    const result =
      await removePautaDemandsBatchAction(
        pauta.id,
        selectedExtraDemandIds,
        removeDemandsConfirmation,
      )

    if ('error' in result) {
      return failAction(
        result.error ||
        'Não foi possível retirar as demandas.',
      )
    }

    reload()
  }

  async function distributeExistingDemands(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setDistributionError('')
    setDistributionNotice('')

    if (
      selectedDistributionTargets.length ===
      0
    ) {
      return failDistribution(
        'Selecione pelo menos um Quadro de destino.',
      )
    }

    if (
      incompleteDistributionTargets.length >
      0
    ) {
      const [boardId] =
        incompleteDistributionTargets[0]

      const board =
        list(
          distributionBoards,
        ).find(
          (item: any) =>
            String(item.id) ===
            String(boardId),
        )

      return failDistribution(
        'Selecione a coluna do Quadro ' +
          String(
            board?.name ||
            'selecionado',
          ) +
          '.',
      )
    }

    if (
      !distributionConfirmationValid
    ) {
      return failDistribution(
        'Digite exatamente DISTRIBUIR DEMANDAS.',
      )
    }

    const targets =
      selectedDistributionTargets.map(
        ([boardId, config]) => ({
          boardId,
          boardColumnId:
            config.columnId,
          isRequired:
            config.required,
        }),
      )

    beginAction()

    const result =
      await distributeExistingPautaDemandsAction(
        {
          pautaId: pauta.id,
          workItemIds:
            selectedDemandIds,
          targets,
          confirmation:
            distributionConfirmation,
        },
      )

    if ('error' in result) {
      return failDistribution(
        result.error ||
        'Não foi possível enviar as demandas aos Quadros.',
      )
    }

    const payload =
      'data' in result &&
      result.data &&
      typeof result.data ===
        'object'
        ? result.data as
            Record<string, unknown>
        : {}

    const processed =
      Number(
        payload
          .assignments_processed ||
        0,
      )

    setDistributionNotice(
      processed +
        ' associação(ões) processada(s) com sucesso.',
    )
    setDistributionError('')
    setLoading(false)

    window.setTimeout(
      reload,
      1200,
    )
  }

  async function createDemands(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const form =
      new FormData(
        event.currentTarget,
      )

    const responsibleId =
      String(
        form.get(
          'responsible_id',
        ) || '',
      )

    const internalDeadline =
      String(
        form.get(
          'internal_deadline',
        ) || '',
      )

    const finalDeadline =
      String(
        form.get(
          'final_deadline',
        ) || '',
      )

    const priority =
      String(
        form.get('priority') ||
        'normal',
      )

    const driveLink =
      String(
        form.get(
          'drive_link',
        ) || '',
      )

    const notes =
      String(
        form.get('notes') || '',
      )

    const cardTag =
      String(
        form.get(
          'card_tag',
        ) || '',
      )

    const cardTagColor =
      String(
        form.get(
          'card_tag_color',
        ) || 'slate',
      )

    const rows =
      demandClientIds.map(
        (clientId) => ({
          clientId,
          clientServiceId:
            serviceByClient[
              clientId
            ] || '',
          responsibleId,
          internalDeadline,
          finalDeadline,
          priority,
          driveLink,
          notes,
          cardTag,
          cardTagColor,
        }),
      )

    const targets =
      Object.entries(
        selectedTargets,
      )
        .filter(
          ([, config]) =>
            config.columnId,
        )
        .map(
          ([boardId, config]) => ({
            boardId,
            boardColumnId:
              config.columnId,
            isRequired:
              config.required,
          }),
        )

    beginAction()

    const result =
      await createAndDistributePautaDemandsAction(
        {
          pautaId: pauta.id,
          rows,
          targets,
          confirmation:
            createConfirmation,
        },
      )

    if ('error' in result) {
      return failAction(
        result.error ||
        'Não foi possível criar e distribuir as demandas.',
      )
    }

    reload()
  }

  function toggleUnifiedClient(
    row: any,
  ) {
    const memberId =
      String(
        row.member
          ?.member_id ||
        '',
      )

    const demandIds =
      list(
        row.demands,
      )
        .map(
          (
            item:
              any,
          ) =>
            String(
              item.id ||
              '',
            ),
        )
        .filter(
          Boolean,
        )

    const selected =
      selectedMemberIds.includes(
        memberId,
      )

    setSelectedMemberIds(
      (
        current,
      ) =>
        selected
          ? current.filter(
              (id) =>
                id !==
                memberId,
            )
          : Array.from(
              new Set([
                ...current,
                memberId,
              ]),
            ),
    )

    setSelectedDemandIds(
      (
        current,
      ) =>
        selected
          ? current.filter(
              (id) =>
                !demandIds.includes(
                  id,
                ),
            )
          : Array.from(
              new Set([
                ...current,
                ...demandIds,
              ]),
            ),
    )
  }

  function selectAllUnified() {
    const allMemberIds =
      unifiedClientRows
        .map(
          (
            row:
              any,
          ) =>
            String(
              row.member
                ?.member_id ||
              '',
            ),
        )
        .filter(
          Boolean,
        )

    const allDemandIds =
      unifiedClientRows
        .flatMap(
          (
            row:
              any,
          ) =>
            list(
              row.demands,
            ).map(
              (
                item:
                  any,
              ) =>
                String(
                  item.id ||
                  '',
                ),
            ),
        )
        .filter(
          Boolean,
        )

    const allSelected =
      allMemberIds.length >
        0 &&
      allMemberIds.every(
        (id) =>
          selectedMemberIds.includes(
            id,
          ),
      )

    setSelectedMemberIds(
      allSelected
        ? []
        : allMemberIds,
    )

    setSelectedDemandIds(
      allSelected
        ? []
        : Array.from(
            new Set(
              allDemandIds,
            ),
          ),
    )
  }

  function toggleAll(
    current: string[],
    all: string[],
    setter:
      (value: string[]) => void,
  ) {
    setter(
      current.length === all.length
        ? []
        : all,
    )
  }

  return (
    <div
      className="pauta-management-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !loading
        ) {
          onClose()
        }
      }}
    >
      <section
        className="pauta-management-panel pauta-v8-panel"
        role="dialog"
        aria-modal="true"
      >
        <header className="pauta-management-header">
          <div>
            <span>Gestão da Pauta</span>

            <h2>{pauta.name}</h2>

            <p>
              {formatDate(
                pauta.reference_month,
              )}
              {' · '}
              {activeMembers.length}
              {' cliente(s)'}
            </p>
          </div>

          <div className="pauta-management-header-actions">
            <span className="badge bmut">
              {statusLabel(
                pauta.lifecycle_status,
              )}
            </span>

            <button
              className="mclose"
              type="button"
              onClick={onClose}
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </header>

        <nav className="pauta-management-tabs">
          <button
            type="button"
            data-active={
              tab === 'overview'
            }
            onClick={() =>
              setTab('overview')
            }
          >
            Visão geral
          </button>

          <button
            type="button"
            data-active={
              tab === 'clients'
            }
            onClick={() =>
              setTab('clients')
            }
          >
            Clientes e demandas
          </button>

          <button
            type="button"
            data-active={
              tab === 'history'
            }
            onClick={() =>
              setTab('history')
            }
          >
            Histórico
          </button>
        </nav>

        <div className="pauta-management-body">
          {error && (
            <div className="notice notice-err">
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="notice notice-ok">
              <span>{notice}</span>
            </div>
          )}

          {!canManage && (
            <div className="notice notice-warn">
              <span>
                Consulta liberada. Alterações estruturais exigem Acesso Total.
              </span>
            </div>
          )}

          {tab === 'overview' && (
            <div className="pauta-management-grid">
              <form
                className="pauta-management-card"
                onSubmit={saveSettings}
              >
                <div className="pauta-management-card-head">
                  <div>
                    <span>
                      Configurações
                    </span>

                    <strong>
                      Referência e metas
                    </strong>
                  </div>
                </div>

                <label className="fg">
                  <span className="fl">
                    Nome
                  </span>

                  <input
                    className="fi"
                    name="name"
                    defaultValue={
                      pauta.name || ''
                    }
                    required
                    disabled={
                      !canManage ||
                      !editable
                    }
                  />
                </label>

                <div className="frow">
                  <label className="fg">
                    <span className="fl">
                      Magic Number
                    </span>

                    <input
                      className="fi"
                      type="date"
                      name="magic_number_date"
                      defaultValue={
                        dateValue(
                          pauta.magic_number_date,
                        )
                      }
                      required
                      disabled={
                        !canManage ||
                        !editable
                      }
                    />
                  </label>

                  <label className="fg">
                    <span className="fl">
                      Programado até
                    </span>

                    <input
                      className="fi"
                      type="date"
                      name="scheduled_until_date"
                      defaultValue={
                        dateValue(
                          pauta.scheduled_until_date,
                        )
                      }
                      required
                      disabled={
                        !canManage ||
                        !editable
                      }
                    />
                  </label>
                </div>

                {canManage &&
                  editable && (
                  <button
                    className="bpri"
                    disabled={loading}
                  >
                    Salvar configurações
                  </button>
                )}
              </form>

              <article className="pauta-management-card">
                <div className="pauta-management-card-head">
                  <div>
                    <span>Progresso</span>

                    <strong>
                      Operação multiquadro
                    </strong>
                  </div>
                </div>

                <div className="pauta-management-stats">
                  <div>
                    <strong>
                      {Number(
                        dependencies
                          .active_members ||
                        activeMembers.length,
                      )}
                    </strong>

                    <span>clientes</span>
                  </div>

                  <div>
                    <strong>
                      {
                        operationalDemands.length
                      }
                    </strong>

                    <span>demandas</span>
                  </div>

                  <div>
                    <strong>
                      {Number(
                        dependencies
                          .active_assignments ||
                        0,
                      )}
                    </strong>

                    <span>
                      distribuições
                    </span>
                  </div>

                  <div>
                    <strong>
                      {Number(
                        dependencies
                          .pending_required_assignments ||
                        0,
                      )}
                    </strong>

                    <span>pendentes</span>
                  </div>
                </div>
              </article>

              <article className="pauta-management-card pauta-lifecycle-card">
                <div className="pauta-management-card-head">
                  <div>
                    <span>
                      Ciclo de vida
                    </span>

                    <strong>
                      Concluir, reabrir ou arquivar
                    </strong>
                  </div>
                </div>

                <div className="pauta-lifecycle-actions">
                  {canManage &&
                    pauta.lifecycle_status ===
                      'open' && (
                    <button
                      className="bpri"
                      type="button"
                      onClick={async () => {
                        const phrase =
                          prompt(
                            'Digite CONCLUIR PAUTA',
                          ) || ''

                        beginAction()

                        const result =
                          await changePautaLifecycleAction(
                            pauta.id,
                            'close',
                            phrase,
                          )

                        if (
                          'error' in
                          result
                        ) {
                          return failAction(
                            result.error ||
                            'Não foi possível concluir.',
                          )
                        }

                        reload()
                      }}
                    >
                      Concluir Pauta
                    </button>
                  )}

                  {canManage &&
                    [
                      'closed',
                      'archived',
                    ].includes(
                      pauta.lifecycle_status,
                    ) && (
                    <button
                      className="bpri"
                      type="button"
                      onClick={async () => {
                        const phrase =
                          prompt(
                            'Digite REABRIR PAUTA',
                          ) || ''

                        beginAction()

                        const result =
                          await changePautaLifecycleAction(
                            pauta.id,
                            'reopen',
                            phrase,
                          )

                        if (
                          'error' in
                          result
                        ) {
                          return failAction(
                            result.error ||
                            'Não foi possível reabrir.',
                          )
                        }

                        reload()
                      }}
                    >
                      Reabrir Pauta
                    </button>
                  )}

                  {canManage &&
                    pauta.lifecycle_status !==
                      'archived' && (
                    <button
                      className="bsec"
                      type="button"
                      onClick={async () => {
                        const phrase =
                          prompt(
                            'Digite ARQUIVAR PAUTA',
                          ) || ''

                        beginAction()

                        const result =
                          await changePautaLifecycleAction(
                            pauta.id,
                            'archive',
                            phrase,
                          )

                        if (
                          'error' in
                          result
                        ) {
                          return failAction(
                            result.error ||
                            'Não foi possível arquivar.',
                          )
                        }

                        reload()
                      }}
                    >
                      Arquivar
                    </button>
                  )}
                </div>
              </article>
            </div>
          )}

          {tab === 'clients' && (
            <div className="pauta-v8-clients-layout">
              <section className="pauta-management-card pauta-v93-unified">
                <div className="pauta-v93-unified-head">
                  <div>
                    <span>
                      Clientes e demandas
                    </span>

                    <strong>
                      {
                        activeMembers.length
                      } cliente(s)
                      {' · '}
                      {
                        operationalDemands.length
                      } demanda(s)
                    </strong>
                  </div>

                  {canManage &&
                    editable && (
                    <div className="pauta-v93-toolbar">
                      <button
                        className="bsec"
                        type="button"
                        onClick={
                          selectAllUnified
                        }
                      >
                        Selecionar todos
                      </button>

                      <button
                        className="bsec danger-button"
                        type="button"
                        disabled={
                          !selectedMemberIds.length ||
                          loading
                        }
                        onClick={() =>
                          setRemoveClientsOpen(
                            true,
                          )
                        }
                      >
                        Remover da Pauta
                      </button>

                      <button
                        className="bpri"
                        type="button"
                        onClick={() =>
                          setDemandOpen(
                            (
                              current,
                            ) =>
                              !current,
                          )
                        }
                      >
                        Adicionar demanda
                      </button>

                      <button
                        className="bsec"
                        type="button"
                        disabled={
                          !selectedDemandIds.length ||
                          loading
                        }
                        onClick={() => {
                          setDistributionError(
                            '',
                          )

                          setDistributionNotice(
                            '',
                          )

                          setExistingDistributionOpen(
                            true,
                          )
                        }}
                      >
                        Adicionar aos Quadros
                      </button>
                    </div>
                  )}
                </div>

                <div className="pauta-v93-unified-list">
                  {unifiedClientRows.map(
                    (
                      row:
                        any,
                    ) => {
                      const memberId =
                        String(
                          row.member
                            ?.member_id ||
                          '',
                        )

                      return (
                        <article
                          className="pauta-v93-client-row"
                          key={
                            row.clientId
                          }
                        >
                          <label className="pauta-v93-client-select">
                            <input
                              type="checkbox"
                              checked={
                                selectedMemberIds.includes(
                                  memberId,
                                )
                              }
                              onChange={() =>
                                toggleUnifiedClient(
                                  row,
                                )
                              }
                            />

                            <span>
                              {
                                row.client
                                  ?.name ||
                                'Cliente'
                              }
                            </span>
                          </label>

                          <div className="pauta-v93-client-demands">
                            {list(
                              row.demands,
                            ).map(
                              (
                                item:
                                  any,
                              ) => {
                                const chips =
                                  demandLocationChips(
                                    item,
                                  )

                                return (
                                  <div
                                    className="pauta-v93-demand-line"
                                    key={
                                      item.id
                                    }
                                  >
                                    <div className="pauta-v93-demand-copy">
                                      <strong>
                                        {
                                          item.title
                                        }
                                      </strong>

                                      <span>
                                        {
                                          item.demand_kind ===
                                          'main'
                                            ? 'Card mensal'
                                            : 'Demanda adicional'
                                        }
                                      </span>
                                    </div>

                                    <div className="pauta-v93-status-chips">
                                      {chips
                                        .slice(
                                          0,
                                          3,
                                        )
                                        .map(
                                          (
                                            chip,
                                          ) => (
                                            <span
                                              key={
                                                chip.key
                                              }
                                              data-tone={
                                                chip.tone
                                              }
                                            >
                                              {
                                                chip.label
                                              }
                                            </span>
                                          ),
                                        )}

                                      {chips.length >
                                        3 && (
                                        <span data-tone="more">
                                          +
                                          {
                                            chips.length -
                                            3
                                          }
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              },
                            )}

                            {!list(
                              row.demands,
                            ).length && (
                              <span className="pauta-v93-no-demand">
                                Sem demanda ativa vinculada.
                              </span>
                            )}
                          </div>
                        </article>
                      )
                    },
                  )}

                  {eligibleClients.length >
                    0 && (
                    <div className="pauta-v93-available-block">
                      <div className="pauta-v93-available-head">
                        <div>
                          <span>
                            Disponíveis para adicionar
                          </span>

                          <strong>
                            {
                              eligibleClients.length
                            } cliente(s)
                          </strong>
                        </div>

                        {canManage &&
                          editable &&
                          selectedNewClientIds.length >
                            0 && (
                          <button
                            className="bpri"
                            type="button"
                            onClick={() =>
                              setAddClientsOpen(
                                true,
                              )
                            }
                          >
                            Adicionar à Pauta
                          </button>
                        )}
                      </div>

                      {eligibleClients.map(
                        (
                          client:
                            any,
                        ) => (
                          <label
                            className="pauta-v93-available-row"
                            key={
                              client.id
                            }
                          >
                            <input
                              type="checkbox"
                              checked={
                                selectedNewClientIds.includes(
                                  String(
                                    client.id,
                                  ),
                                )
                              }
                              onChange={() =>
                                setSelectedNewClientIds(
                                  (
                                    current,
                                  ) =>
                                    current.includes(
                                      String(
                                        client.id,
                                      ),
                                    )
                                      ? current.filter(
                                          (
                                            id,
                                          ) =>
                                            id !==
                                            String(
                                              client.id,
                                            ),
                                        )
                                      : [
                                          ...current,
                                          String(
                                            client.id,
                                          ),
                                        ],
                                )
                              }
                            />

                            <div>
                              <strong>
                                {
                                  client.name
                                }
                              </strong>

                              <span>
                                Ainda não participa desta Pauta
                              </span>
                            </div>
                          </label>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </section>
              <section className="pauta-management-card pauta-v93-legacy pauta-v93-legacy-clients">
                <div className="pauta-v8-section-head">
                  <div>
                    <span>Clientes</span>

                    <strong>
                      {activeMembers.length}
                      {' participante(s)'}
                    </strong>
                  </div>

                  {canManage &&
                    editable && (
                    <div className="pauta-v8-actions">
                      <button
                        className="bsec"
                        type="button"
                        onClick={() =>
                          toggleAll(
                            selectedMemberIds,
                            activeMembers.map(
                              (
                                member: any,
                              ) =>
                                String(
                                  member.member_id,
                                ),
                            ),
                            setSelectedMemberIds,
                          )
                        }
                      >
                        Selecionar todos
                      </button>

                      <button
                        className="bsec danger-button"
                        type="button"
                        disabled={
                          !selectedMemberIds.length ||
                          loading
                        }
                        onClick={() =>
                          setRemoveClientsOpen(
                            true,
                          )
                        }
                      >
                        Remover selecionados
                      </button>
                    </div>
                  )}
                </div>

                {removeClientsOpen &&
                  selectedMemberIds.length >
                    0 && (
                  <div className="pauta-v92c-confirm-panel">
                    <div>
                      <strong>
                        Retirar clientes da Pauta
                      </strong>

                      <span>
                        As demandas e o histórico serão preservados.
                      </span>
                    </div>

                    <label className="fg">
                      <span className="fl">
                        Digite RETIRAR CLIENTES
                      </span>

                      <input
                        className="fi"
                        value={
                          removeClientsConfirmation
                        }
                        onChange={(
                          event,
                        ) =>
                          setRemoveClientsConfirmation(
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    <div className="pauta-v92c-confirm-actions">
                      <button
                        className="bsec"
                        type="button"
                        onClick={() => {
                          setRemoveClientsOpen(
                            false,
                          )
                          setRemoveClientsConfirmation(
                            '',
                          )
                        }}
                      >
                        Cancelar
                      </button>

                      <button
                        className="bsec danger-button"
                        type="button"
                        disabled={loading}
                        onClick={
                          removeClients
                        }
                      >
                        Confirmar remoção
                      </button>
                    </div>
                  </div>
                )}

                <div className="pauta-v8-table">
                  {activeMembers.map(
                    (member: any) => (
                      <article
                        className="pauta-v8-row"
                        key={
                          member.member_id
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(
                            String(
                              member.member_id,
                            ),
                          )}
                          onChange={() =>
                            setSelectedMemberIds(
                              (current) =>
                                current.includes(
                                  String(
                                    member.member_id,
                                  ),
                                )
                                  ? current.filter(
                                      (id) =>
                                        id !==
                                        String(
                                          member.member_id,
                                        ),
                                    )
                                  : [
                                      ...current,
                                      String(
                                        member.member_id,
                                      ),
                                    ],
                            )
                          }
                        />

                        <div className="pauta-v8-grow">
                          <strong>
                            {member.client
                              ?.name ||
                              'Cliente'}
                          </strong>

                          <span>
                            {statusLabel(
                              member
                                .main_work_item
                                ?.status,
                            )}
                            {' · '}
                            Participa desta Pauta
                          </span>
                        </div>

                        <span className="badge bmut">
                          Vinculado
                        </span>
                      </article>
                    ),
                  )}

                  {!activeMembers.length && (
                    <div className="empty">
                      Nenhum cliente ativo nesta Pauta.
                    </div>
                  )}
                </div>
              </section>

              {canManage &&
                editable && (
                <section className="pauta-management-card pauta-v93-legacy pauta-v93-legacy-complete">
                  <div className="pauta-v8-section-head">
                    <div>
                      <span>
                        Completar Pauta
                      </span>

                      <strong>
                        Adicionar clientes faltantes
                      </strong>
                    </div>

                    <button
                      className="bsec"
                      type="button"
                      onClick={() =>
                        toggleAll(
                          selectedNewClientIds,
                          eligibleClients.map(
                            (client: any) =>
                              String(
                                client.id,
                              ),
                          ),
                          setSelectedNewClientIds,
                        )
                      }
                    >
                      Selecionar todos
                    </button>
                  </div>

                  <div className="pauta-v8-table">
                    {eligibleClients.map(
                      (client: any) => (
                        <article
                          className="pauta-v8-row"
                          key={client.id}
                        >
                          <input
                            type="checkbox"
                            checked={selectedNewClientIds.includes(
                              String(
                                client.id,
                              ),
                            )}
                            onChange={() =>
                              setSelectedNewClientIds(
                                (
                                  current,
                                ) =>
                                  current.includes(
                                    String(
                                      client.id,
                                    ),
                                  )
                                    ? current.filter(
                                        (id) =>
                                          id !==
                                          String(
                                            client.id,
                                          ),
                                      )
                                    : [
                                        ...current,
                                        String(
                                          client.id,
                                        ),
                                      ],
                              )
                            }
                          />

                          <div className="pauta-v8-grow">
                            <strong>
                              {client.name}
                            </strong>

                            <span>
                              Entrará com o prazo geral Programado até
                              {' '}
                              {formatDate(
                                pauta.scheduled_until_date,
                              )}
                            </span>
                          </div>
                        </article>
                      ),
                    )}

                    {!eligibleClients.length && (
                      <div className="empty">
                        Todos os clientes ativos já participam.
                      </div>
                    )}
                  </div>

                  {selectedNewClientIds.length >
                    0 && (
                    <div className="pauta-v92c-section-foot">
                      <button
                        className="bpri"
                        type="button"
                        onClick={() =>
                          setAddClientsOpen(
                            true,
                          )
                        }
                      >
                        Adicionar selecionados
                      </button>
                    </div>
                  )}

                  {addClientsOpen &&
                    selectedNewClientIds.length >
                      0 && (
                    <div className="pauta-v92c-confirm-panel">
                      <div>
                        <strong>
                          Adicionar clientes
                        </strong>

                        <span>
                          Será criado ou vinculado um card mensal por cliente, sem duplicação.
                        </span>
                      </div>

                      <label className="fg">
                        <span className="fl">
                          Digite ADICIONAR CLIENTES
                        </span>

                        <input
                          className="fi"
                          value={
                            addClientsConfirmation
                          }
                          onChange={(
                            event,
                          ) =>
                            setAddClientsConfirmation(
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <div className="pauta-v92c-confirm-actions">
                        <button
                          className="bsec"
                          type="button"
                          onClick={() => {
                            setAddClientsOpen(
                              false,
                            )
                            setAddClientsConfirmation(
                              '',
                            )
                          }}
                        >
                          Cancelar
                        </button>

                        <button
                          className="bpri"
                          type="button"
                          disabled={loading}
                          onClick={
                            addClients
                          }
                        >
                          Confirmar inclusão
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="pauta-management-card pauta-v93-legacy pauta-v93-legacy-demands">
                <div className="pauta-v8-section-head">
                  <div>
                    <span>
                      Demandas da Pauta
                    </span>

                    <strong>
                      {
                        operationalDemands.length
                      }
                      {' demanda(s)'}
                    </strong>
                  </div>

                  {canManage &&
                    editable && (
                    <div className="pauta-v8-actions">
                      <button
                        className="bpri"
                        type="button"
                        onClick={() =>
                          setDemandOpen(
                            (current) =>
                              !current,
                          )
                        }
                      >
                        Adicionar demanda
                      </button>

                      <button
                        className="bsec"
                        type="button"
                        onClick={() =>
                          toggleAll(
                            selectedDemandIds,
                            operationalDemands.map(
                              (
                                item: any,
                              ) =>
                                String(
                                  item.id,
                                ),
                            ),
                            setSelectedDemandIds,
                          )
                        }
                      >
                        Selecionar todos
                      </button>

                      <button
                        className="bsec"
                        type="button"
                        disabled={
                          !selectedDemandIds.length ||
                          loading
                        }
                        onClick={() => {
                          setDistributionError(
                            '',
                          )
                          setDistributionNotice(
                            '',
                          )
                          setExistingDistributionOpen(
                            (current) =>
                              !current,
                          )
                        }}
                      >
                        Subir nos Quadros
                      </button>

                      <button
                        className="bsec danger-button"
                        type="button"
                        disabled={
                          !selectedExtraDemandIds.length ||
                          selectedMainDemandCount >
                            0 ||
                          loading
                        }
                        title={
                          selectedMainDemandCount >
                          0
                            ? 'Cards mensais são retirados ao remover o cliente da Pauta.'
                            : 'Remover demandas adicionais selecionadas'
                        }
                        onClick={() =>
                          setRemoveDemandsOpen(
                            true,
                          )
                        }
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>

                {selectedMainDemandCount >
                  0 && (
                  <div className="notice notice-info pauta-v92c-selection-note">
                    <span>
                      {selectedMainDemandCount}
                      {' card(s) mensal(is) selecionado(s). Eles podem ser distribuídos aos Quadros, mas só saem da Pauta pela remoção do cliente.'}
                    </span>
                  </div>
                )}

                {removeDemandsOpen &&
                  selectedExtraDemandIds.length >
                    0 &&
                  selectedMainDemandCount ===
                    0 && (
                  <div className="pauta-v92c-confirm-panel">
                    <div>
                      <strong>
                        Retirar demandas adicionais
                      </strong>

                      <span>
                        A demanda canônica e o histórico serão preservados.
                      </span>
                    </div>

                    <label className="fg">
                      <span className="fl">
                        Digite RETIRAR DEMANDAS
                      </span>

                      <input
                        className="fi"
                        value={
                          removeDemandsConfirmation
                        }
                        onChange={(
                          event,
                        ) =>
                          setRemoveDemandsConfirmation(
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    <div className="pauta-v92c-confirm-actions">
                      <button
                        className="bsec"
                        type="button"
                        onClick={() => {
                          setRemoveDemandsOpen(
                            false,
                          )
                          setRemoveDemandsConfirmation(
                            '',
                          )
                        }}
                      >
                        Cancelar
                      </button>

                      <button
                        className="bsec danger-button"
                        type="button"
                        disabled={loading}
                        onClick={
                          removeDemands
                        }
                      >
                        Confirmar remoção
                      </button>
                    </div>
                  </div>
                )}

                <div className="pauta-v8-table">
                  {operationalDemands.map(
                    (item: any) => {
                      const assignments =
                        list(
                          item.assignments,
                        )

                      const complete =
                        assignments.filter(
                          (
                            assignment: any,
                          ) =>
                            assignmentComplete(
                              assignment.operational_status,
                            ),
                        ).length

                      return (
                        <article
                          className="pauta-v8-row"
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDemandIds.includes(
                              String(
                                item.id,
                              ),
                            )}
                            onChange={() =>
                              setSelectedDemandIds(
                                (
                                  current,
                                ) =>
                                  current.includes(
                                    String(
                                      item.id,
                                    ),
                                  )
                                    ? current.filter(
                                        (id) =>
                                          id !==
                                          String(
                                            item.id,
                                          ),
                                      )
                                    : [
                                        ...current,
                                        String(
                                          item.id,
                                        ),
                                      ],
                              )
                            }
                          />

                          <div className="pauta-v8-grow">
                            <div className="pauta-v92c-demand-title">
                              <strong>
                                {item.title}
                              </strong>

                              <span
                                className="badge bmut pauta-v92c-kind"
                                data-kind={
                                  item.demand_kind
                                }
                              >
                                {item.demand_kind ===
                                'main'
                                  ? 'Card mensal'
                                  : 'Adicional'}
                              </span>
                            </div>

                            <span>
                              {item.client_name ||
                                item.client
                                  ?.name ||
                                'Cliente'}
                              {' · '}
                              {assignments.length
                                ? `${complete}/${assignments.length} Quadros concluídos`
                                : 'Ainda não distribuída'}
                            </span>

                            <div className="pauta-v8-assignment-chips">
                              {assignments.map(
                                (
                                  assignment: any,
                                ) => (
                                  <span
                                    key={
                                      assignment.id
                                    }
                                  >
                                    {assignment.board_name ||
                                      assignment
                                        .board
                                        ?.name ||
                                      'Quadro'}
                                    {': '}
                                    {assignment.board_column_name ||
                                      assignment
                                        .board_column
                                        ?.name ||
                                      'Sem coluna'}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>

                          <span className="badge bmut">
                            {statusLabel(
                              item.status,
                            )}
                          </span>
                        </article>
                      )
                    },
                  )}

                  {!operationalDemands.length && (
                    <div className="empty">
                      Nenhuma demanda vinculada à Pauta.
                    </div>
                  )}
                </div>

                {existingDistributionOpen &&
                  selectedDemandIds.length >
                    0 &&
                  canManage &&
                  editable && (
                  <form
                    className="pauta-v9-distribute-existing"
                    onSubmit={
                      distributeExistingDemands
                    }
                  >
                    <div className="pauta-v8-subhead">
                      <strong>
                        Subir{' '}
                        {
                          selectedDemandIds.length
                        }{' '}
                        demanda(s) nos Quadros
                      </strong>

                      <button
                        className="mclose"
                        type="button"
                        onClick={() => {
                          setExistingDistributionOpen(
                            false,
                          )
                          setDistributionConfirmation(
                            '',
                          )
                          setDistributionError(
                            '',
                          )
                          setDistributionNotice(
                            '',
                          )
                        }}
                      >
                        <i className="ti ti-x" />
                      </button>
                    </div>

                    <div className="notice notice-info">
                      <span>
                        Cada demanda continuará única. O sistema criará apenas associações nos Quadros selecionados e evitará duplicações.
                      </span>
                    </div>

                    {distributionError && (
                      <div className="notice notice-err">
                        <i className="ti ti-alert-circle" />
                        <span>
                          {distributionError}
                        </span>
                      </div>
                    )}

                    {distributionNotice && (
                      <div className="notice notice-ok">
                        <i className="ti ti-circle-check" />
                        <span>
                          {distributionNotice}
                        </span>
                      </div>
                    )}

                    <div className="pauta-v9-target-grid">
                      {list(
                        distributionBoards,
                      ).map(
                        (board: any) => {
                          const config =
                            existingTargets[
                              board.id
                            ]

                          const columns =
                            list(
                              distributionColumns,
                            ).filter(
                              (
                                column: any,
                              ) =>
                                column.board_id ===
                                board.id,
                            )

                          return (
                            <div
                              className="pauta-v8-target"
                              key={
                                board.id
                              }
                            >
                              <label>
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    config,
                                  )}
                                  disabled={
                                    columns.length ===
                                    0
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    setExistingTargets(
                                      (
                                        current,
                                      ) => {
                                        const next =
                                          {
                                            ...current,
                                          }

                                        if (
                                          event
                                            .target
                                            .checked
                                        ) {
                                          next[
                                            board.id
                                          ] = {
                                            columnId:
                                              '',
                                            required:
                                              true,
                                          }
                                        } else {
                                          delete next[
                                            board.id
                                          ]
                                        }

                                        return next
                                      },
                                    )
                                  }
                                />

                                {board.name}

                                {!columns.length &&
                                  ' — sem colunas'}
                              </label>

                              {config && (
                                <>
                                  <select
                                    className="fi"
                                    value={
                                      config.columnId
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      setExistingTargets(
                                        (
                                          current,
                                        ) => ({
                                          ...current,
                                          [
                                            board.id
                                          ]: {
                                            ...current[
                                              board.id
                                            ],
                                            columnId:
                                              event
                                                .target
                                                .value,
                                          },
                                        }),
                                      )
                                    }
                                    required
                                  >
                                    <option value="">
                                      Selecione a coluna
                                    </option>

                                    {columns.map(
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

                                  {!config.columnId && (
                                    <div className="notice notice-warn">
                                      <span>
                                        Selecione a coluna do Quadro{' '}
                                        {board.name}.
                                      </span>
                                    </div>
                                  )}

                                  <label className="pauta-v8-required">
                                    <input
                                      type="checkbox"
                                      checked={
                                        config.required
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        setExistingTargets(
                                          (
                                            current,
                                          ) => ({
                                            ...current,
                                            [
                                              board.id
                                            ]: {
                                              ...current[
                                                board.id
                                              ],
                                              required:
                                                event
                                                  .target
                                                  .checked,
                                            },
                                          }),
                                        )
                                      }
                                    />

                                    Obrigatório
                                  </label>
                                </>
                              )}
                            </div>
                          )
                        },
                      )}
                    </div>

                    <label className="fg">
                      <span className="fl">
                        Digite DISTRIBUIR DEMANDAS
                      </span>

                      <input
                        className="fi"
                        value={
                          distributionConfirmation
                        }
                        onChange={(
                          event,
                        ) =>
                          setDistributionConfirmation(
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    <button
                      className="bpri"
                      disabled={
                        !canSubmitDistribution
                      }
                    >
                      Subir nos Quadros
                    </button>
                  </form>
                )}
              </section>

              {demandOpen &&
                canManage &&
                editable && (
                <form
                  className="pauta-management-card pauta-v8-create"
                  onSubmit={
                    createDemands
                  }
                >
                  <div className="pauta-v8-section-head">
                    <div>
                      <span>
                        Nova demanda
                      </span>

                      <strong>
                        Criar uma demanda canônica por cliente
                      </strong>
                    </div>

                    <button
                      className="mclose"
                      type="button"
                      onClick={() => {
                        setDemandOpen(
                          false,
                        )
                        setCreateConfirmation(
                          '',
                        )
                      }}
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>

                  <div className="notice notice-warn">
                    <span>
                      A demanda será criada uma vez e distribuída aos Quadros selecionados, sem duplicação.
                    </span>
                  </div>

                  <div className="pauta-v8-create-grid">
                    <section>
                      <div className="pauta-v8-subhead">
                        <strong>
                          1. Clientes
                        </strong>

                        <button
                          className="bsec"
                          type="button"
                          onClick={() =>
                            toggleAll(
                              demandClientIds,
                              activeMembers
                                .map(
                                  (
                                    member: any,
                                  ) =>
                                    String(
                                      member
                                        .client
                                        ?.id ||
                                      '',
                                    ),
                                )
                                .filter(
                                  Boolean,
                                ),
                              setDemandClientIds,
                            )
                          }
                        >
                          Selecionar todos
                        </button>
                      </div>

                      {activeMembers.map(
                        (
                          member: any,
                        ) => {
                          const clientId =
                            String(
                              member.client
                                ?.id || '',
                            )

                          const services =
                            list(
                              clientServices,
                            ).filter(
                              (
                                service: any,
                              ) =>
                                service.client_id ===
                                  clientId &&
                                service.status ===
                                  'active',
                            )

                          return (
                            <div
                              className="pauta-v8-client-service"
                              key={
                                member.member_id
                              }
                            >
                              <label>
                                <input
                                  type="checkbox"
                                  checked={demandClientIds.includes(
                                    clientId,
                                  )}
                                  onChange={() =>
                                    setDemandClientIds(
                                      (
                                        current,
                                      ) =>
                                        current.includes(
                                          clientId,
                                        )
                                          ? current.filter(
                                              (
                                                id,
                                              ) =>
                                                id !==
                                                clientId,
                                            )
                                          : [
                                              ...current,
                                              clientId,
                                            ],
                                    )
                                  }
                                />

                                {' '}
                                {
                                  member.client
                                    ?.name
                                }
                              </label>

                              {demandClientIds.includes(
                                clientId,
                              ) && (
                                <select
                                  className="fi"
                                  value={
                                    serviceByClient[
                                      clientId
                                    ] || ''
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    setServiceByClient(
                                      (
                                        current,
                                      ) => ({
                                        ...current,
                                        [
                                          clientId
                                        ]:
                                          event
                                            .target
                                            .value,
                                      }),
                                    )
                                  }
                                  required
                                >
                                  <option value="">
                                    Selecione o serviço
                                  </option>

                                  {services.map(
                                    (
                                      service: any,
                                    ) => (
                                      <option
                                        key={
                                          service.id
                                        }
                                        value={
                                          service.id
                                        }
                                      >
                                        {service
                                          .service
                                          ?.name ||
                                          'Serviço'}
                                      </option>
                                    ),
                                  )}
                                </select>
                              )}
                            </div>
                          )
                        },
                      )}
                    </section>

                    <section>
                      <div className="pauta-v8-subhead">
                        <strong>
                          2. Quadros de destino
                        </strong>
                      </div>

                      {list(
                        distributionBoards,
                      ).map(
                        (board: any) => {
                          const config =
                            selectedTargets[
                              board.id
                            ]

                          const columns =
                            list(
                              distributionColumns,
                            ).filter(
                              (
                                column: any,
                              ) =>
                                column.board_id ===
                                board.id,
                            )

                          return (
                            <div
                              className="pauta-v8-target"
                              key={
                                board.id
                              }
                            >
                              <label>
                                <input
                                  type="checkbox"
                                  checked={Boolean(
                                    config,
                                  )}
                                  disabled={
                                    columns.length ===
                                    0
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    setSelectedTargets(
                                      (
                                        current,
                                      ) => {
                                        const next =
                                          {
                                            ...current,
                                          }

                                        if (
                                          event
                                            .target
                                            .checked
                                        ) {
                                          next[
                                            board.id
                                          ] = {
                                            columnId:
                                              String(
                                                columns[
                                                  0
                                                ]
                                                  ?.id ||
                                                '',
                                              ),
                                            required:
                                              true,
                                          }
                                        } else {
                                          delete next[
                                            board.id
                                          ]
                                        }

                                        return next
                                      },
                                    )
                                  }
                                />

                                {' '}
                                {board.name}

                                {!columns.length &&
                                  ' — sem colunas'}
                              </label>

                              {config && (
                                <>
                                  <select
                                    className="fi"
                                    value={
                                      config.columnId
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      setSelectedTargets(
                                        (
                                          current,
                                        ) => ({
                                          ...current,
                                          [
                                            board.id
                                          ]: {
                                            ...current[
                                              board.id
                                            ],
                                            columnId:
                                              event
                                                .target
                                                .value,
                                          },
                                        }),
                                      )
                                    }
                                    required
                                  >
                                    {columns.map(
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

                                  <label className="pauta-v8-required">
                                    <input
                                      type="checkbox"
                                      checked={
                                        config.required
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        setSelectedTargets(
                                          (
                                            current,
                                          ) => ({
                                            ...current,
                                            [
                                              board.id
                                            ]: {
                                              ...current[
                                                board.id
                                              ],
                                              required:
                                                event
                                                  .target
                                                  .checked,
                                            },
                                          }),
                                        )
                                      }
                                    />

                                    Obrigatório
                                  </label>
                                </>
                              )}
                            </div>
                          )
                        },
                      )}
                    </section>
                  </div>

                  <div className="frow">
                    <label className="fg">
                      <span className="fl">
                        Início
                      </span>

                      <input
                        className="fi"
                        type="date"
                        name="internal_deadline"
                        defaultValue={
                          dateValue(
                            pauta.magic_number_date,
                          )
                        }
                        required
                      />
                    </label>

                    <label className="fg">
                      <span className="fl">
                        Final
                      </span>

                      <input
                        className="fi"
                        type="date"
                        name="final_deadline"
                        defaultValue={
                          dateValue(
                            pauta.scheduled_until_date,
                          )
                        }
                        required
                      />
                    </label>
                  </div>

                  <div className="frow">
                    <label className="fg">
                      <span className="fl">
                        Responsável
                      </span>

                      <select
                        className="fi"
                        name="responsible_id"
                        required
                      >
                        <option value="">
                          Selecione
                        </option>

                        {list(
                          profiles,
                        ).map(
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
                    </label>

                    <label className="fg">
                      <span className="fl">
                        Prioridade
                      </span>

                      <select
                        className="fi"
                        name="priority"
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
                    </label>
                  </div>

                  <div className="frow">
                    <label className="fg">
                      <span className="fl">
                        Tag
                      </span>

                      <input
                        className="fi"
                        name="card_tag"
                        maxLength={16}
                      />
                    </label>

                    <label className="fg">
                      <span className="fl">
                        Cor
                      </span>

                      <select
                        className="fi"
                        name="card_tag_color"
                        defaultValue="slate"
                      >
                        <option value="slate">
                          Cinza
                        </option>

                        <option value="blue">
                          Azul
                        </option>

                        <option value="purple">
                          Roxo
                        </option>

                        <option value="yellow">
                          Amarelo
                        </option>

                        <option value="red">
                          Vermelho
                        </option>

                        <option value="green">
                          Verde
                        </option>
                      </select>
                    </label>
                  </div>

                  <label className="fg">
                    <span className="fl">
                      Link do Drive
                    </span>

                    <input
                      className="fi"
                      type="url"
                      name="drive_link"
                    />
                  </label>

                  <label className="fg">
                    <span className="fl">
                      Observação
                    </span>

                    <textarea
                      className="fi"
                      name="notes"
                      rows={3}
                    />
                  </label>

                  <label className="fg">
                    <span className="fl">
                      Digite CRIAR E DISTRIBUIR
                    </span>

                    <input
                      className="fi"
                      value={
                        createConfirmation
                      }
                      onChange={(
                        event,
                      ) =>
                        setCreateConfirmation(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <button
                    className="bpri"
                    disabled={
                      loading ||
                      !demandClientIds.length ||
                      !Object.keys(
                        selectedTargets,
                      ).length
                    }
                  >
                    Criar e distribuir
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === 'history' && (
            <section className="pauta-management-card">
              <div className="pauta-v8-section-head">
                <div>
                  <span>Auditoria</span>

                  <strong>
                    {events.length}
                    {' evento(s)'}
                  </strong>
                </div>
              </div>

              <div className="pauta-event-list pauta-v8-history">
                {events.map(
                  (event: any) => (
                    <article
                      key={event.id}
                    >
                      <i className="ti ti-point-filled" />

                      <div>
                        <strong>
                          {eventLabel(
                            event.action,
                          )}
                        </strong>

                        <span>
                          {formatDateTime(
                            event.created_at,
                          )}
                          {' · '}
                          {event.actor
                            ?.display_name ||
                            event.actor
                              ?.full_name ||
                            'Sistema'}
                        </span>

                        {jsonSummary(
                          event.old_values,
                        ) && (
                          <small>
                            Antes:{' '}
                            {jsonSummary(
                              event.old_values,
                            )}
                          </small>
                        )}

                        {jsonSummary(
                          event.new_values,
                        ) && (
                          <small>
                            Depois:{' '}
                            {jsonSummary(
                              event.new_values,
                            )}
                          </small>
                        )}
                      </div>
                    </article>
                  ),
                )}

                {!events.length && (
                  <div className="empty">
                    Nenhum evento registrado.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}
