
'use client'

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  addClientsToPautaAction,
  changePautaLifecycleAction,
  detachPautaDemandAction,
  previewPautaClientAdditionsAction,
  removePautaClientAction,
  updatePautaSettingsAction,
} from '@/lib/actions'

type ConfirmationState = {
  kind:
    | 'remove-client'
    | 'detach-demand'
    | 'lifecycle'
  title: string
  description: string
  phrase: string
  clientId?: string
  workItemId?: string
  lifecycleAction?:
    | 'close'
    | 'reopen'
    | 'archive'
}

function list(value: unknown) {
  return Array.isArray(value)
    ? value
    : []
}

function dateValue(
  value?: string | null,
) {
  return value
    ? String(value).slice(0, 10)
    : ''
}

function formatDate(
  value?: string | null,
) {
  if (!value) return '—'

  return new Date(
    String(value).slice(0, 10) +
      'T12:00:00',
  ).toLocaleDateString('pt-BR')
}

function formatDateTime(
  value?: string | null,
) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return date.toLocaleString(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  )
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    open: 'Aberta',
    closed: 'Concluída',
    archived: 'Arquivada',
    active: 'Ativo',
    removed: 'Retirado',
    not_started: 'Não iniciada',
    in_progress: 'Em andamento',
    waiting: 'Aguardando',
    blocked: 'Bloqueada',
    in_review: 'Em revisão',
    awaiting_approval: 'Aguardando aprovação',
    scheduled: 'Programada',
    done: 'Concluída',
    delivered: 'Entregue',
    approved: 'Aprovada',
  }

  return labels[String(value || '')] ||
    String(value || '—')
}

function eventLabel(value?: string | null) {
  const labels: Record<string, string> = {
    pauta_created: 'Pauta criada',
    settings_updated: 'Configurações atualizadas',
    client_added: 'Cliente adicionado',
    client_removed: 'Cliente retirado',
    demand_created: 'Demanda criada',
    demand_detached: 'Demanda retirada',
    pauta_closed: 'Pauta concluída',
    pauta_reopened: 'Pauta reaberta',
    pauta_archived: 'Pauta arquivada',
    pauta_deleted: 'Pauta excluída',
  }

  return labels[String(value || '')] ||
    String(value || 'Atualização')
}

function classificationLabel(
  value?: string | null,
) {
  const labels: Record<string, string> = {
    ALREADY_IN_PAUTA: 'Já participa',
    LEGACY_CARD_AVAILABLE: 'Possui card legado',
    MULTIPLE_LEGACY_CARDS: 'Vários cards legados',
    NO_ACTIVE_SERVICE: 'Sem serviço ativo',
    NO_LEGACY_CARD: 'Pronto para adicionar',
    INACTIVE_CLIENT: 'Cliente inativo',
  }

  return labels[String(value || '')] ||
    String(value || 'Não analisado')
}

export default function PautaManagementPanel({
  open,
  onClose,
  snapshot,
  clients = [],
  canManage = false,
}: any) {
  const pauta = snapshot?.pauta || null
  const members = list(snapshot?.members)
  const extraDemands =
    list(snapshot?.extra_demands)
  const events = list(snapshot?.events)
  const legacyCandidates =
    list(snapshot?.legacy_candidates)
  const dependencies =
    snapshot?.dependency_summary || {}

  const [tab, setTab] =
    useState<'overview' | 'clients' | 'history'>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedClientIds, setSelectedClientIds] =
    useState<string[]>([])
  const [preview, setPreview] =
    useState<any | null>(null)
  const [addConfirmation, setAddConfirmation] =
    useState('')
  const [confirmation, setConfirmation] =
    useState<ConfirmationState | null>(null)
  const [confirmationValue, setConfirmationValue] =
    useState('')

  const activeMembers = useMemo(
    () =>
      members.filter(
        (member: any) =>
          member.membership_status === 'active',
      ),
    [members],
  )

  const activeMemberIds = useMemo(
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
          !activeMemberIds.has(
            String(client.id),
          ),
      ),
    [clients, activeMemberIds],
  )

  const editable =
    ['draft', 'open'].includes(
      String(pauta?.lifecycle_status || ''),
    )

  const blockingPreview =
    list(preview?.clients).some(
      (client: any) =>
        [
          'LEGACY_CARD_AVAILABLE',
          'MULTIPLE_LEGACY_CARDS',
          'INACTIVE_CLIENT',
          'ALREADY_IN_PAUTA',
        ].includes(
          String(client.classification || ''),
        ),
    )

  useEffect(() => {
    if (!open) return

    setTab('overview')
    setError('')
    setNotice('')
    setSelectedClientIds([])
    setPreview(null)
    setAddConfirmation('')
    setConfirmation(null)
    setConfirmationValue('')
  }, [open, pauta?.id])

  useEffect(() => {
    if (!open) return

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) {
        onClose()
      }
    }

    window.addEventListener('keydown', keydown)

    return () => {
      document.body.style.overflow =
        previousOverflow
      window.removeEventListener(
        'keydown',
        keydown,
      )
    }
  }, [open, loading, onClose])

  if (!open || !pauta) return null

  function reloadCurrent() {
    window.location.reload()
  }

  async function saveSettings(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    const result =
      await updatePautaSettingsAction(
        pauta.id,
        new FormData(event.currentTarget),
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível atualizar a Pauta.',
      )
      setLoading(false)
      return
    }

    setNotice('Configurações atualizadas.')
    reloadCurrent()
  }

  function toggleClient(clientId: string) {
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId],
    )
    setPreview(null)
    setAddConfirmation('')
  }

  async function previewClients() {
    setLoading(true)
    setError('')
    setNotice('')

    const result =
      await previewPautaClientAdditionsAction(
        pauta.id,
        selectedClientIds,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível analisar os clientes.',
      )
      setLoading(false)
      return
    }

    setPreview(result.data)
    setLoading(false)
  }

  async function addClients() {
    setLoading(true)
    setError('')
    setNotice('')

    const result =
      await addClientsToPautaAction(
        pauta.id,
        selectedClientIds,
        addConfirmation,
      )

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível adicionar os clientes.',
      )
      setLoading(false)
      return
    }

    setNotice('Clientes adicionados à Pauta.')
    reloadCurrent()
  }

  function askConfirmation(
    next: ConfirmationState,
  ) {
    setConfirmation(next)
    setConfirmationValue('')
    setError('')
  }

  async function executeConfirmation() {
    if (!confirmation) return

    setLoading(true)
    setError('')
    setNotice('')

    let result: any

    if (confirmation.kind === 'remove-client') {
      result = await removePautaClientAction(
        pauta.id,
        String(confirmation.clientId || ''),
        confirmationValue,
      )
    } else if (confirmation.kind === 'detach-demand') {
      result = await detachPautaDemandAction(
        pauta.id,
        String(confirmation.workItemId || ''),
        confirmationValue,
      )
    } else {
      result = await changePautaLifecycleAction(
        pauta.id,
        confirmation.lifecycleAction || 'close',
        confirmationValue,
      )
    }

    if ('error' in result) {
      setError(
        result.error ||
          'Não foi possível concluir a ação.',
      )
      setLoading(false)
      return
    }

    reloadCurrent()
  }

  return (
    <div
      className="pauta-management-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !loading
        ) {
          onClose()
        }
      }}
    >
      <section
        className="pauta-management-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pauta-management-title"
      >
        <header className="pauta-management-header">
          <div>
            <span>Gestão segura da Pauta</span>
            <h2 id="pauta-management-title">
              {pauta.name}
            </h2>
            <p>
              {formatDate(pauta.reference_month)} ·{' '}
              {activeMembers.length} cliente(s) ativo(s)
            </p>
          </div>

          <div className="pauta-management-header-actions">
            <span
              className="badge bmut"
              data-lifecycle={pauta.lifecycle_status}
            >
              {statusLabel(pauta.lifecycle_status)}
            </span>

            <button
              className="mclose"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </header>

        <nav className="pauta-management-tabs">
          <button
            type="button"
            data-active={tab === 'overview'}
            onClick={() => setTab('overview')}
          >
            Visão geral
          </button>
          <button
            type="button"
            data-active={tab === 'clients'}
            onClick={() => setTab('clients')}
          >
            Clientes e demandas
          </button>
          <button
            type="button"
            data-active={tab === 'history'}
            onClick={() => setTab('history')}
          >
            Histórico
          </button>
        </nav>

        <div className="pauta-management-body">
          {error && (
            <div className="notice notice-err">
              <i className="ti ti-alert-circle" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="notice notice-ok">
              <i className="ti ti-circle-check" />
              <span>{notice}</span>
            </div>
          )}

          {!canManage && (
            <div className="notice notice-warn">
              <i className="ti ti-lock" />
              <span>
                Acesso operacional: consulta liberada. Alterações estruturais exigem Acesso Total.
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
                    <span>Configurações</span>
                    <strong>Referência e metas</strong>
                  </div>
                  <i className="ti ti-adjustments" />
                </div>

                <label className="fg">
                  <span className="fl">Nome</span>
                  <input
                    className="fi"
                    name="name"
                    defaultValue={pauta.name || ''}
                    minLength={3}
                    maxLength={120}
                    required
                    disabled={!canManage || loading}
                  />
                </label>

                <div className="frow">
                  <label className="fg">
                    <span className="fl">Magic Number</span>
                    <input
                      className="fi"
                      type="date"
                      name="magic_number_date"
                      defaultValue={dateValue(
                        pauta.magic_number_date,
                      )}
                      required
                      disabled={!canManage || loading}
                    />
                  </label>

                  <label className="fg">
                    <span className="fl">Programado até</span>
                    <input
                      className="fi"
                      type="date"
                      name="scheduled_until_date"
                      defaultValue={dateValue(
                        pauta.scheduled_until_date,
                      )}
                      required
                      disabled={!canManage || loading}
                    />
                  </label>
                </div>

                {canManage && editable && (
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
                    <span>Dependências</span>
                    <strong>Segurança operacional</strong>
                  </div>
                  <i className="ti ti-shield-check" />
                </div>

                <div className="pauta-management-stats">
                  <div>
                    <strong>{Number(dependencies.active_members || 0)}</strong>
                    <span>participações</span>
                  </div>
                  <div>
                    <strong>{Number(dependencies.main_cards || 0) + Number(dependencies.extra_demands || 0)}</strong>
                    <span>demandas</span>
                  </div>
                  <div>
                    <strong>{Number(dependencies.calendar_events || 0)}</strong>
                    <span>agendas</span>
                  </div>
                  <div>
                    <strong>{legacyCandidates.length}</strong>
                    <span>legados candidatos</span>
                  </div>
                </div>

                <div className="notice notice-warn pauta-legacy-readonly">
                  <i className="ti ti-history" />
                  <span>
                    Os cards legados estão apenas identificados. A adoção continua bloqueada até revisão do mapping explícito.
                  </span>
                </div>
              </article>

              <article className="pauta-management-card pauta-lifecycle-card">
                <div className="pauta-management-card-head">
                  <div>
                    <span>Ciclo de vida</span>
                    <strong>Ações estruturais</strong>
                  </div>
                  <i className="ti ti-route" />
                </div>

                <div className="pauta-lifecycle-actions">
                  {canManage && pauta.lifecycle_status === 'open' && (
                    <button
                      className="bpri"
                      type="button"
                      onClick={() => askConfirmation({
                        kind: 'lifecycle',
                        title: 'Concluir Pauta',
                        description: 'O banco validará clientes, programação e dependências antes de concluir.',
                        phrase: 'CONCLUIR PAUTA',
                        lifecycleAction: 'close',
                      })}
                    >
                      Concluir Pauta
                    </button>
                  )}

                  {canManage && pauta.lifecycle_status === 'closed' && (
                    <button
                      className="bpri"
                      type="button"
                      onClick={() => askConfirmation({
                        kind: 'lifecycle',
                        title: 'Reabrir Pauta',
                        description: 'A Pauta voltará ao estado aberto para novas operações.',
                        phrase: 'REABRIR PAUTA',
                        lifecycleAction: 'reopen',
                      })}
                    >
                      Reabrir Pauta
                    </button>
                  )}

                  {canManage && pauta.lifecycle_status !== 'archived' && (
                    <button
                      className="bsec"
                      type="button"
                      onClick={() => askConfirmation({
                        kind: 'lifecycle',
                        title: 'Arquivar Pauta',
                        description: 'A Pauta sairá da operação ativa, preservando todo o histórico.',
                        phrase: 'ARQUIVAR PAUTA',
                        lifecycleAction: 'archive',
                      })}
                    >
                      Arquivar
                    </button>
                  )}
                </div>
              </article>
            </div>
          )}

          {tab === 'clients' && (
            <div className="pauta-management-client-layout">
              <section className="pauta-management-card">
                <div className="pauta-management-card-head">
                  <div>
                    <span>Participantes</span>
                    <strong>{activeMembers.length} cliente(s)</strong>
                  </div>
                  <i className="ti ti-users" />
                </div>

                <div className="pauta-member-list">
                  {activeMembers.map((member: any) => (
                    <article
                      className="pauta-member-row"
                      key={member.member_id}
                    >
                      <div>
                        <strong>
                          {member.client?.name || 'Cliente'}
                        </strong>
                        <span>
                          {statusLabel(
                            member.main_work_item?.status,
                          )} · final{' '}
                          {formatDate(
                            member.main_work_item?.final_deadline,
                          )}
                        </span>
                      </div>

                      {canManage && editable && (
                        <button
                          className="bsec danger-button"
                          type="button"
                          onClick={() => askConfirmation({
                            kind: 'remove-client',
                            title: 'Retirar cliente da Pauta',
                            description: 'As demandas serão preservadas fora da Pauta. O histórico não será apagado.',
                            phrase: 'RETIRAR CLIENTE',
                            clientId: member.client?.id,
                          })}
                        >
                          Retirar
                        </button>
                      )}
                    </article>
                  ))}

                  {activeMembers.length === 0 && (
                    <div className="empty">
                      Nenhum cliente ativo nesta Pauta.
                    </div>
                  )}
                </div>
              </section>

              <section className="pauta-management-card">
                <div className="pauta-management-card-head">
                  <div>
                    <span>Demandas adicionais</span>
                    <strong>{extraDemands.length} demanda(s)</strong>
                  </div>
                  <i className="ti ti-list-details" />
                </div>

                <div className="pauta-member-list">
                  {extraDemands.map((item: any) => (
                    <article
                      className="pauta-member-row"
                      key={item.id}
                    >
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {statusLabel(item.status)} · final{' '}
                          {formatDate(item.final_deadline)}
                        </span>
                      </div>

                      {canManage && editable && (
                        <button
                          className="bsec danger-button"
                          type="button"
                          onClick={() => askConfirmation({
                            kind: 'detach-demand',
                            title: 'Retirar demanda da Pauta',
                            description: 'A demanda será preservada como Extra e deixará de pertencer à Pauta.',
                            phrase: 'RETIRAR DEMANDA',
                            workItemId: item.id,
                          })}
                        >
                          Retirar
                        </button>
                      )}
                    </article>
                  ))}

                  {extraDemands.length === 0 && (
                    <div className="empty">
                      Nenhuma demanda adicional.
                    </div>
                  )}
                </div>
              </section>

              {canManage && editable && (
                <section className="pauta-management-card pauta-add-clients-card">
                  <div className="pauta-management-card-head">
                    <div>
                      <span>Completar a mesma Pauta</span>
                      <strong>Adicionar clientes faltantes</strong>
                    </div>
                    <i className="ti ti-user-plus" />
                  </div>

                  <div className="pauta-add-client-list">
                    {eligibleClients.map((client: any) => (
                      <label key={client.id}>
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(
                            String(client.id),
                          )}
                          onChange={() =>
                            toggleClient(String(client.id))
                          }
                        />
                        <span>{client.name}</span>
                      </label>
                    ))}

                    {eligibleClients.length === 0 && (
                      <div className="empty">
                        Todos os clientes ativos já participam da Pauta.
                      </div>
                    )}
                  </div>

                  <button
                    className="bsec"
                    type="button"
                    disabled={
                      loading ||
                      selectedClientIds.length === 0
                    }
                    onClick={previewClients}
                  >
                    Analisar seleção
                  </button>

                  {preview && (
                    <div className="pauta-add-preview">
                      {list(preview.clients).map((client: any) => (
                        <div
                          key={client.client_id}
                          data-classification={client.classification}
                        >
                          <strong>{client.client_name}</strong>
                          <span>
                            {classificationLabel(
                              client.classification,
                            )}
                          </span>
                        </div>
                      ))}

                      {blockingPreview ? (
                        <div className="notice notice-warn">
                          <i className="ti ti-alert-triangle" />
                          <span>
                            Há cards legados ou clientes bloqueados. Eles não serão duplicados; revise a adoção posteriormente.
                          </span>
                        </div>
                      ) : (
                        <>
                          <label className="fg">
                            <span className="fl">
                              Digite ADICIONAR CLIENTES
                            </span>
                            <input
                              className="fi"
                              value={addConfirmation}
                              onChange={(event) =>
                                setAddConfirmation(
                                  event.target.value,
                                )
                              }
                              autoComplete="off"
                            />
                          </label>

                          <button
                            className="bpri"
                            type="button"
                            disabled={
                              loading ||
                              addConfirmation !==
                                'ADICIONAR CLIENTES'
                            }
                            onClick={addClients}
                          >
                            Adicionar à Pauta
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {tab === 'history' && (
            <section className="pauta-management-card">
              <div className="pauta-management-card-head">
                <div>
                  <span>Auditoria</span>
                  <strong>{events.length} evento(s)</strong>
                </div>
                <i className="ti ti-history" />
              </div>

              <div className="pauta-event-list">
                {events.map((event: any) => (
                  <article key={event.id}>
                    <i className="ti ti-point-filled" />
                    <div>
                      <strong>{eventLabel(event.action)}</strong>
                      <span>{formatDateTime(event.created_at)}</span>
                    </div>
                  </article>
                ))}

                {events.length === 0 && (
                  <div className="empty">
                    Nenhum evento registrado.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </section>

      {confirmation && (
        <div className="pauta-confirm-overlay">
          <section className="pauta-confirm-box">
            <div className="modal-head">
              <div>
                <div className="modal-title">
                  {confirmation.title}
                </div>
                <div className="modal-sub">
                  {confirmation.description}
                </div>
              </div>
              <button
                className="mclose"
                type="button"
                disabled={loading}
                onClick={() => setConfirmation(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="modal-body">
              <label className="fg">
                <span className="fl">
                  Digite {confirmation.phrase}
                </span>
                <input
                  className="fi"
                  value={confirmationValue}
                  onChange={(event) =>
                    setConfirmationValue(
                      event.target.value,
                    )
                  }
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="modal-foot">
              <button
                className="bsec"
                type="button"
                disabled={loading}
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </button>
              <button
                className="bpri"
                type="button"
                disabled={
                  loading ||
                  confirmationValue !==
                    confirmation.phrase
                }
                onClick={executeConfirmation}
              >
                {loading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
