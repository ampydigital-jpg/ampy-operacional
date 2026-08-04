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
  updatePautaMemberTargetDateAction,
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
  const entries = Object.entries(value as Record<string, unknown>)
  if (!entries.length) return ''
  return entries
    .slice(0, 5)
    .map(([key, next]) => `${key}: ${String(next ?? '—')}`)
    .join(' · ')
}

export default function PautaManagementPanel({
  open,
  onClose,
  snapshot,
  clients = [],
  profiles = [],
  clientServices = [],
  distributionBoards = [],
  distributionColumns = [],
  canManage = false,
}: any) {
  const pauta = snapshot?.pauta || null
  const members = list(snapshot?.members)
  const demands = list(snapshot?.extra_demands)
  const events = list(snapshot?.events)
  const dependencies = snapshot?.dependency_summary || {}

  const activeMembers = useMemo(
    () => members.filter((member: any) => member.membership_status === 'active'),
    [members],
  )

  const activeMemberClientIds = useMemo(
    () => new Set(activeMembers.map((member: any) => String(member.client?.id || '')).filter(Boolean)),
    [activeMembers],
  )

  const eligibleClients = useMemo(
    () => list(clients).filter((client: any) =>
      client.status === 'active' && !activeMemberClientIds.has(String(client.id))),
    [clients, activeMemberClientIds],
  )

  const [tab, setTab] = useState<'overview' | 'clients' | 'history'>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [selectedDemandIds, setSelectedDemandIds] = useState<string[]>([])
  const [selectedNewClientIds, setSelectedNewClientIds] = useState<string[]>([])
  const [newTargetDates, setNewTargetDates] = useState<Record<string, string>>({})
  const [memberTargetDates, setMemberTargetDates] = useState<Record<string, string>>({})
  const [confirmation, setConfirmation] = useState('')
  const [demandOpen, setDemandOpen] = useState(false)
  const [demandClientIds, setDemandClientIds] = useState<string[]>([])
  const [serviceByClient, setServiceByClient] = useState<Record<string, string>>({})
  const [selectedTargets, setSelectedTargets] = useState<Record<string, { columnId: string; required: boolean }>>({})
  const [existingDistributionOpen, setExistingDistributionOpen] = useState(false)
  const [existingTargets, setExistingTargets] = useState<Record<string, { columnId: string; required: boolean }>>({})

  const editable = ['draft', 'open'].includes(String(pauta?.lifecycle_status || ''))

  if (!open || !pauta) return null

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

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    beginAction()
    const result = await updatePautaSettingsAction(pauta.id, new FormData(event.currentTarget))
    if ('error' in result) return failAction(result.error || 'Não foi possível atualizar a Pauta.')
    setNotice('Configurações atualizadas.')
    reload()
  }

  async function saveTargetDate(member: any) {
    const target = memberTargetDates[member.member_id] || dateValue(member.target_date || member.main_work_item?.final_deadline)
    beginAction()
    const result = await updatePautaMemberTargetDateAction(member.member_id, target)
    if ('error' in result) return failAction(result.error || 'Não foi possível alterar a data-meta.')
    reload()
  }

  async function addClients() {
    const rows = selectedNewClientIds.map((clientId) => ({
      clientId,
      targetDate: newTargetDates[clientId] || dateValue(pauta.scheduled_until_date),
    }))
    beginAction()
    const result = await addClientsToPautaV8Action(pauta.id, rows, confirmation)
    if ('error' in result) return failAction(result.error || 'Não foi possível adicionar os clientes.')
    reload()
  }

  async function removeClients() {
    const clientIds = activeMembers
      .filter((member: any) => selectedMemberIds.includes(String(member.member_id)))
      .map((member: any) => String(member.client?.id || ''))
      .filter(Boolean)
    beginAction()
    const result = await removePautaClientsBatchAction(pauta.id, clientIds, confirmation)
    if ('error' in result) return failAction(result.error || 'Não foi possível retirar os clientes.')
    reload()
  }

  async function removeDemands() {
    beginAction()
    const result = await removePautaDemandsBatchAction(pauta.id, selectedDemandIds, confirmation)
    if ('error' in result) return failAction(result.error || 'Não foi possível retirar as demandas.')
    reload()
  }

  async function distributeExistingDemands(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const targets = Object.entries(existingTargets)
      .filter(([, config]) => config.columnId)
      .map(([boardId, config]) => ({
        boardId,
        boardColumnId: config.columnId,
        isRequired: config.required,
      }))

    beginAction()

    const result = await distributeExistingPautaDemandsAction({
      pautaId: pauta.id,
      workItemIds: selectedDemandIds,
      targets,
      confirmation,
    })

    if ('error' in result) {
      return failAction(
        result.error ||
          'Não foi possível enviar as demandas aos Quadros.',
      )
    }

    reload()
  }

  async function createDemands(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const responsibleId = String(form.get('responsible_id') || '')
    const internalDeadline = String(form.get('internal_deadline') || '')
    const finalDeadline = String(form.get('final_deadline') || '')
    const priority = String(form.get('priority') || 'normal')
    const driveLink = String(form.get('drive_link') || '')
    const notes = String(form.get('notes') || '')
    const cardTag = String(form.get('card_tag') || '')
    const cardTagColor = String(form.get('card_tag_color') || 'slate')

    const rows = demandClientIds.map((clientId) => ({
      clientId,
      clientServiceId: serviceByClient[clientId] || '',
      responsibleId,
      internalDeadline,
      finalDeadline,
      priority,
      driveLink,
      notes,
      cardTag,
      cardTagColor,
    }))

    const targets = Object.entries(selectedTargets)
      .filter(([, config]) => config.columnId)
      .map(([boardId, config]) => ({
        boardId,
        boardColumnId: config.columnId,
        isRequired: config.required,
      }))

    beginAction()
    const result = await createAndDistributePautaDemandsAction({
      pautaId: pauta.id,
      rows,
      targets,
      confirmation,
    })
    if ('error' in result) return failAction(result.error || 'Não foi possível criar e distribuir as demandas.')
    reload()
  }

  function toggleAll(current: string[], all: string[], setter: any) {
    setter(current.length === all.length ? [] : all)
  }

  return (
    <div className="pauta-management-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose()
    }}>
      <section className="pauta-management-panel pauta-v8-panel" role="dialog" aria-modal="true">
        <header className="pauta-management-header">
          <div>
            <span>Gestão da Pauta</span>
            <h2>{pauta.name}</h2>
            <p>{formatDate(pauta.reference_month)} · {activeMembers.length} cliente(s)</p>
          </div>
          <div className="pauta-management-header-actions">
            <span className="badge bmut">{statusLabel(pauta.lifecycle_status)}</span>
            <button className="mclose" type="button" onClick={onClose}><i className="ti ti-x" /></button>
          </div>
        </header>

        <nav className="pauta-management-tabs">
          <button type="button" data-active={tab === 'overview'} onClick={() => setTab('overview')}>Visão geral</button>
          <button type="button" data-active={tab === 'clients'} onClick={() => setTab('clients')}>Clientes e demandas</button>
          <button type="button" data-active={tab === 'history'} onClick={() => setTab('history')}>Histórico</button>
        </nav>

        <div className="pauta-management-body">
          {error && <div className="notice notice-err"><span>{error}</span></div>}
          {notice && <div className="notice notice-ok"><span>{notice}</span></div>}
          {!canManage && <div className="notice notice-warn"><span>Consulta liberada. Alterações estruturais exigem Acesso Total.</span></div>}

          {tab === 'overview' && (
            <div className="pauta-management-grid">
              <form className="pauta-management-card" onSubmit={saveSettings}>
                <div className="pauta-management-card-head"><div><span>Configurações</span><strong>Referência e metas</strong></div></div>
                <label className="fg"><span className="fl">Nome</span><input className="fi" name="name" defaultValue={pauta.name || ''} required disabled={!canManage || !editable} /></label>
                <div className="frow">
                  <label className="fg"><span className="fl">Magic Number</span><input className="fi" type="date" name="magic_number_date" defaultValue={dateValue(pauta.magic_number_date)} required disabled={!canManage || !editable} /></label>
                  <label className="fg"><span className="fl">Programado até</span><input className="fi" type="date" name="scheduled_until_date" defaultValue={dateValue(pauta.scheduled_until_date)} required disabled={!canManage || !editable} /></label>
                </div>
                {canManage && editable && <button className="bpri" disabled={loading}>Salvar configurações</button>}
              </form>

              <article className="pauta-management-card">
                <div className="pauta-management-card-head"><div><span>Progresso</span><strong>Operação multiquadro</strong></div></div>
                <div className="pauta-management-stats">
                  <div><strong>{Number(dependencies.active_members || activeMembers.length)}</strong><span>clientes</span></div>
                  <div><strong>{demands.length}</strong><span>demandas</span></div>
                  <div><strong>{Number(dependencies.active_assignments || 0)}</strong><span>distribuições</span></div>
                  <div><strong>{Number(dependencies.pending_required_assignments || 0)}</strong><span>pendentes</span></div>
                </div>
              </article>

              <article className="pauta-management-card pauta-lifecycle-card">
                <div className="pauta-management-card-head"><div><span>Ciclo de vida</span><strong>Concluir, reabrir ou arquivar</strong></div></div>
                <div className="pauta-lifecycle-actions">
                  {canManage && pauta.lifecycle_status === 'open' && <button className="bpri" type="button" onClick={async () => {
                    const phrase = prompt('Digite CONCLUIR PAUTA') || ''
                    beginAction()
                    const result = await changePautaLifecycleAction(pauta.id, 'close', phrase)
                    if ('error' in result) return failAction(result.error || 'Não foi possível concluir.')
                    reload()
                  }}>Concluir Pauta</button>}
                  {canManage && ['closed', 'archived'].includes(pauta.lifecycle_status) && <button className="bpri" type="button" onClick={async () => {
                    const phrase = prompt('Digite REABRIR PAUTA') || ''
                    beginAction()
                    const result = await changePautaLifecycleAction(pauta.id, 'reopen', phrase)
                    if ('error' in result) return failAction(result.error || 'Não foi possível reabrir.')
                    reload()
                  }}>Reabrir Pauta</button>}
                  {canManage && pauta.lifecycle_status !== 'archived' && <button className="bsec" type="button" onClick={async () => {
                    const phrase = prompt('Digite ARQUIVAR PAUTA') || ''
                    beginAction()
                    const result = await changePautaLifecycleAction(pauta.id, 'archive', phrase)
                    if ('error' in result) return failAction(result.error || 'Não foi possível arquivar.')
                    reload()
                  }}>Arquivar</button>}
                </div>
              </article>
            </div>
          )}

          {tab === 'clients' && (
            <div className="pauta-v8-clients-layout">
              <section className="pauta-management-card">
                <div className="pauta-v8-section-head">
                  <div><span>Clientes</span><strong>{activeMembers.length} participante(s)</strong></div>
                  {canManage && editable && <div className="pauta-v8-actions">
                    <button className="bsec" type="button" onClick={() => toggleAll(selectedMemberIds, activeMembers.map((m: any) => String(m.member_id)), setSelectedMemberIds)}>Selecionar todos</button>
                    <button className="bsec danger-button" type="button" disabled={!selectedMemberIds.length || loading} onClick={removeClients}>Remover selecionados</button>
                  </div>}
                </div>

                {canManage && selectedMemberIds.length > 0 && <label className="fg pauta-v8-confirm"><span className="fl">Digite RETIRAR CLIENTES</span><input className="fi" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}

                <div className="pauta-v8-table">
                  {activeMembers.map((member: any) => (
                    <article className="pauta-v8-row" key={member.member_id}>
                      <input type="checkbox" checked={selectedMemberIds.includes(String(member.member_id))} onChange={() => setSelectedMemberIds((current) => current.includes(String(member.member_id)) ? current.filter((id) => id !== String(member.member_id)) : [...current, String(member.member_id)])} />
                      <div className="pauta-v8-grow"><strong>{member.client?.name || 'Cliente'}</strong><span>{statusLabel(member.main_work_item?.status)} · Magic Number {formatDate(member.main_work_item?.internal_deadline)}</span></div>
                      <input className="fi pauta-v8-date" type="date" value={memberTargetDates[member.member_id] ?? dateValue(member.target_date || member.main_work_item?.final_deadline)} onChange={(event) => setMemberTargetDates((current) => ({ ...current, [member.member_id]: event.target.value }))} disabled={!canManage || !editable} />
                      {canManage && editable && <button className="bsec" type="button" onClick={() => saveTargetDate(member)}>Salvar data</button>}
                    </article>
                  ))}
                </div>
              </section>

              {canManage && editable && (
                <section className="pauta-management-card">
                  <div className="pauta-v8-section-head"><div><span>Completar Pauta</span><strong>Adicionar clientes faltantes</strong></div><button className="bsec" type="button" onClick={() => toggleAll(selectedNewClientIds, eligibleClients.map((c: any) => String(c.id)), setSelectedNewClientIds)}>Selecionar todos</button></div>
                  <div className="pauta-v8-table">
                    {eligibleClients.map((client: any) => (
                      <article className="pauta-v8-row" key={client.id}>
                        <input type="checkbox" checked={selectedNewClientIds.includes(String(client.id))} onChange={() => setSelectedNewClientIds((current) => current.includes(String(client.id)) ? current.filter((id) => id !== String(client.id)) : [...current, String(client.id)])} />
                        <div className="pauta-v8-grow"><strong>{client.name}</strong><span>Data sugerida: Programado até</span></div>
                        <input className="fi pauta-v8-date" type="date" value={newTargetDates[client.id] || dateValue(pauta.scheduled_until_date)} onChange={(event) => setNewTargetDates((current) => ({ ...current, [client.id]: event.target.value }))} />
                      </article>
                    ))}
                    {!eligibleClients.length && <div className="empty">Todos os clientes ativos já participam.</div>}
                  </div>
                  {selectedNewClientIds.length > 0 && <><label className="fg"><span className="fl">Digite ADICIONAR CLIENTES</span><input className="fi" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="bpri" type="button" disabled={loading} onClick={addClients}>Adicionar à Pauta</button></>}
                </section>
              )}

              <section className="pauta-management-card">
                <div className="pauta-v8-section-head">
                  <div><span>Demandas adicionais</span><strong>{demands.length} demanda(s)</strong></div>
                  {canManage && editable && <div className="pauta-v8-actions"><button className="bpri" type="button" onClick={() => setDemandOpen((current) => !current)}>Adicionar demanda</button><button className="bsec" type="button" onClick={() => toggleAll(selectedDemandIds, demands.map((d: any) => String(d.id)), setSelectedDemandIds)}>Selecionar todos</button><button className="bsec" type="button" disabled={!selectedDemandIds.length || loading} onClick={() => setExistingDistributionOpen((current) => !current)}>Subir nos Quadros</button><button className="bsec danger-button" type="button" disabled={!selectedDemandIds.length} onClick={removeDemands}>Remover</button></div>}
                </div>

                {selectedDemandIds.length > 0 && <label className="fg pauta-v8-confirm"><span className="fl">Digite RETIRAR DEMANDAS</span><input className="fi" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}

                <div className="pauta-v8-table">
                  {demands.map((item: any) => {
                    const assignments = list(item.assignments)
                    const complete = assignments.filter((assignment: any) => ['done', 'delivered', 'approved'].includes(String(assignment.operational_status))).length
                    return <article className="pauta-v8-row" key={item.id}>
                      <input type="checkbox" checked={selectedDemandIds.includes(String(item.id))} onChange={() => setSelectedDemandIds((current) => current.includes(String(item.id)) ? current.filter((id) => id !== String(item.id)) : [...current, String(item.id)])} />
                      <div className="pauta-v8-grow"><strong>{item.title}</strong><span>{item.client_name || 'Cliente'} · {complete}/{assignments.length} Quadros concluídos</span><div className="pauta-v8-assignment-chips">{assignments.map((assignment: any) => <span key={assignment.id}>{assignment.board_name}: {assignment.board_column_name}</span>)}</div></div>
                      <span className="badge bmut">{statusLabel(item.status)}</span>
                    </article>
                  })}
                  {!demands.length && <div className="empty">Nenhuma demanda adicional.</div>}
                </div>

                {existingDistributionOpen && selectedDemandIds.length > 0 && canManage && editable && (
                  <form className="pauta-v9-distribute-existing" onSubmit={distributeExistingDemands}>
                    <div className="pauta-v8-subhead">
                      <strong>Subir {selectedDemandIds.length} demanda(s) nos Quadros</strong>
                      <button className="mclose" type="button" onClick={() => setExistingDistributionOpen(false)}><i className="ti ti-x" /></button>
                    </div>

                    <div className="notice notice-info">
                      <span>Será criado apenas um card simples com o nome da demanda em cada Quadro selecionado. A demanda original continua única.</span>
                    </div>

                    <div className="pauta-v9-target-grid">
                      {list(distributionBoards).map((board: any) => {
                        const config = existingTargets[board.id]
                        const columns = list(distributionColumns).filter((column: any) => column.board_id === board.id)

                        return (
                          <div className="pauta-v8-target" key={board.id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={Boolean(config)}
                                onChange={(event) => setExistingTargets((current) => {
                                  const next = { ...current }
                                  if (event.target.checked) {
                                    next[board.id] = {
                                      columnId: String(columns[0]?.id || ''),
                                      required: true,
                                    }
                                  } else {
                                    delete next[board.id]
                                  }
                                  return next
                                })}
                              />
                              {board.name}
                            </label>

                            {config && (
                              <>
                                <select
                                  className="fi"
                                  value={config.columnId}
                                  onChange={(event) => setExistingTargets((current) => ({
                                    ...current,
                                    [board.id]: {
                                      ...current[board.id],
                                      columnId: event.target.value,
                                    },
                                  }))}
                                  required
                                >
                                  {columns.map((column: any) => (
                                    <option key={column.id} value={column.id}>{column.name}</option>
                                  ))}
                                </select>

                                <label className="pauta-v8-required">
                                  <input
                                    type="checkbox"
                                    checked={config.required}
                                    onChange={(event) => setExistingTargets((current) => ({
                                      ...current,
                                      [board.id]: {
                                        ...current[board.id],
                                        required: event.target.checked,
                                      },
                                    }))}
                                  />
                                  Obrigatório
                                </label>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <label className="fg">
                      <span className="fl">Digite DISTRIBUIR DEMANDAS</span>
                      <input className="fi" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                    </label>

                    <button className="bpri" disabled={loading || !Object.keys(existingTargets).length}>
                      Subir cards simples
                    </button>
                  </form>
                )}
              </section>

              {demandOpen && canManage && editable && (
                <form className="pauta-management-card pauta-v8-create" onSubmit={createDemands}>
                  <div className="pauta-v8-section-head"><div><span>Nova demanda</span><strong>Criar uma demanda canônica por cliente</strong></div><button className="mclose" type="button" onClick={() => setDemandOpen(false)}><i className="ti ti-x" /></button></div>
                  <div className="notice notice-warn"><span>A demanda será criada uma vez e distribuída aos Quadros selecionados, sem duplicação.</span></div>

                  <div className="pauta-v8-create-grid">
                    <section>
                      <div className="pauta-v8-subhead"><strong>1. Clientes</strong><button className="bsec" type="button" onClick={() => toggleAll(demandClientIds, activeMembers.map((m: any) => String(m.client?.id || '')).filter(Boolean), setDemandClientIds)}>Selecionar todos</button></div>
                      {activeMembers.map((member: any) => {
                        const clientId = String(member.client?.id || '')
                        const services = list(clientServices).filter((service: any) => service.client_id === clientId && service.status === 'active')
                        return <div className="pauta-v8-client-service" key={member.member_id}><label><input type="checkbox" checked={demandClientIds.includes(clientId)} onChange={() => setDemandClientIds((current) => current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId])} /> {member.client?.name}</label>{demandClientIds.includes(clientId) && <select className="fi" value={serviceByClient[clientId] || ''} onChange={(event) => setServiceByClient((current) => ({ ...current, [clientId]: event.target.value }))} required><option value="">Selecione o serviço</option>{services.map((service: any) => <option key={service.id} value={service.id}>{service.service?.name || 'Serviço'}</option>)}</select>}</div>
                      })}
                    </section>

                    <section>
                      <div className="pauta-v8-subhead"><strong>2. Quadros de destino</strong></div>
                      {list(distributionBoards).map((board: any) => {
                        const config = selectedTargets[board.id]
                        const columns = list(distributionColumns).filter((column: any) => column.board_id === board.id)
                        return <div className="pauta-v8-target" key={board.id}><label><input type="checkbox" checked={Boolean(config)} onChange={(event) => setSelectedTargets((current) => { const next = { ...current }; if (event.target.checked) next[board.id] = { columnId: String(columns[0]?.id || ''), required: true }; else delete next[board.id]; return next })} /> {board.name}</label>{config && <><select className="fi" value={config.columnId} onChange={(event) => setSelectedTargets((current) => ({ ...current, [board.id]: { ...current[board.id], columnId: event.target.value } }))} required>{columns.map((column: any) => <option key={column.id} value={column.id}>{column.name}</option>)}</select><label className="pauta-v8-required"><input type="checkbox" checked={config.required} onChange={(event) => setSelectedTargets((current) => ({ ...current, [board.id]: { ...current[board.id], required: event.target.checked } }))} /> Obrigatório</label></>}</div>
                      })}
                    </section>
                  </div>

                  <div className="frow"><label className="fg"><span className="fl">Início</span><input className="fi" type="date" name="internal_deadline" defaultValue={dateValue(pauta.magic_number_date)} required /></label><label className="fg"><span className="fl">Final</span><input className="fi" type="date" name="final_deadline" defaultValue={dateValue(pauta.scheduled_until_date)} required /></label></div>
                  <div className="frow"><label className="fg"><span className="fl">Responsável</span><select className="fi" name="responsible_id" required><option value="">Selecione</option>{list(profiles).map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label><label className="fg"><span className="fl">Prioridade</span><select className="fi" name="priority" defaultValue="normal"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label></div>
                  <div className="frow"><label className="fg"><span className="fl">Tag</span><input className="fi" name="card_tag" maxLength={16} /></label><label className="fg"><span className="fl">Cor</span><select className="fi" name="card_tag_color" defaultValue="slate"><option value="slate">Cinza</option><option value="blue">Azul</option><option value="purple">Roxo</option><option value="yellow">Amarelo</option><option value="red">Vermelho</option><option value="green">Verde</option></select></label></div>
                  <label className="fg"><span className="fl">Link do Drive</span><input className="fi" type="url" name="drive_link" /></label>
                  <label className="fg"><span className="fl">Observação</span><textarea className="fi" name="notes" rows={3} /></label>
                  <label className="fg"><span className="fl">Digite CRIAR E DISTRIBUIR</span><input className="fi" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
                  <button className="bpri" disabled={loading || !demandClientIds.length || !Object.keys(selectedTargets).length}>Criar e distribuir</button>
                </form>
              )}
            </div>
          )}

          {tab === 'history' && (
            <section className="pauta-management-card">
              <div className="pauta-v8-section-head"><div><span>Auditoria</span><strong>{events.length} evento(s)</strong></div></div>
              <div className="pauta-event-list pauta-v8-history">
                {events.map((event: any) => <article key={event.id}><i className="ti ti-point-filled" /><div><strong>{eventLabel(event.action)}</strong><span>{formatDateTime(event.created_at)} · {event.actor?.display_name || event.actor?.full_name || 'Sistema'}</span>{jsonSummary(event.old_values) && <small>Antes: {jsonSummary(event.old_values)}</small>}{jsonSummary(event.new_values) && <small>Depois: {jsonSummary(event.new_values)}</small>}</div></article>)}
                {!events.length && <div className="empty">Nenhum evento registrado.</div>}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}
