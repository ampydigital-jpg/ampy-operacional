'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CLOSED_STATUSES = ['done', 'delivered', 'cancelled', 'archived', 'approved']

const CATEGORY_LABEL: Record<string, string> = {
  approval: 'Aprovação',
  adjustment: 'Ajuste',
  demand: 'Demanda',
  planning: 'Planejamento',
  agenda: 'Agenda',
  client: 'Cliente',
  project: 'Projeto',
  board: 'Quadro',
  communication: 'Comunicação',
  manual: 'Aviso',
  operational: 'Operacional',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  read: 'Lido',
  archived: 'Arquivado',
  deleted: 'Apagado',
  done: 'Resolvido',
  pending: 'Pendente',
  info: 'Informativo',
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}

function periodLabel(value: string) {
  if (!value) return 'Sem período'
  const [year, month] = String(value).slice(0, 7).split('-')
  return `${month}/${year}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function compareDateOnly(value: string) {
  const key = String(value || '').slice(0, 10)
  if (!key) return 0
  return key.localeCompare(todayKey())
}

function daysUntil(value: string) {
  if (!value) return null
  const today = new Date(`${todayKey()}T12:00:00`)
  const target = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(target.getTime())) return null
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function priorityTone(priority: string) {
  if (priority === 'urgent') return { bg: '#7F1D1D', color: '#FFFFFF', border: '#7F1D1D' }
  if (priority === 'high') return { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5' }
  if (priority === 'medium') return { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D' }
  return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
}

function categoryTone(category: string) {
  if (category === 'adjustment') return { bg: '#FEF2F2', color: '#991B1B' }
  if (category === 'demand') return { bg: '#EFF6FF', color: '#1D4ED8' }
  if (category === 'planning') return { bg: '#F5F3FF', color: '#6D28D9' }
  if (category === 'agenda') return { bg: '#ECFEFF', color: '#0E7490' }
  if (category === 'client') return { bg: '#FFF7ED', color: '#C2410C' }
  if (category === 'project') return { bg: '#EEF2FF', color: '#4338CA' }
  if (category === 'board') return { bg: '#F0FDFA', color: '#0F766E' }
  if (category === 'communication') return { bg: '#FDF2F8', color: '#BE185D' }
  if (category === 'manual') return { bg: '#F8FAFC', color: '#475569' }
  return { bg: '#ECFDF5', color: '#166534' }
}

function isOpenWorkItem(status: string) {
  return !CLOSED_STATUSES.includes(String(status || '').toLowerCase())
}

function manualMessage(item: any) {
  return item.content || item.message || item.text || item.body || 'Aviso interno registrado.'
}

function demandHref(item: any) {
  const destino = String(item?.destino || '').toLowerCase()

  if (destino.includes('projeto')) return '/dashboard/projetos'
  if (destino.includes('quadro') || destino.includes('kanban')) return '/dashboard/quadro'
  return '/dashboard/demandas'
}

function cleanStatus(row: any, itemById: Map<any, any>) {
  const status = String(row.status || 'active')
  const item = row.feed_board_item_id ? itemById.get(row.feed_board_item_id) : null

  if (row.deleted_at || status === 'deleted') return 'deleted'
  if (row.archived_at || status === 'archived') return 'archived'

  if (item) {
    if (row.category === 'adjustment' && item.approval_status !== 'changes_requested') return 'done'
    if (row.category === 'approval' && item.approval_status === 'approved') return 'done'
    if (row.category === 'planning' && item.approval_status === 'approved') return 'done'
  }

  if (status === 'read' && row.read_at) return 'read'
  if (status === 'done' || row.completed_at) return 'done'
  return 'active'
}

function normalizeCanonicalAviso(row: any, clientById: Map<any, any>, itemById: Map<any, any>) {
  const status = cleanStatus(row, itemById)

  return {
    id: row.id,
    dbId: row.id,
    dedupe_key: row.dedupe_key,
    metadata: row.metadata || {},
    hidden: Boolean(row?.metadata?.purged || row?.metadata?.purged_at),
    source_table: row.source_table || null,
    feed_board_item_id: row.feed_board_item_id || null,
    canonical: true,
    category: row.category || 'operational',
    priority: row.priority || 'medium',
    status,
    title: row.title || 'Aviso operacional',
    message: row.message || 'Aviso registrado.',
    client: row.client_id ? clientById.get(row.client_id)?.name || 'Cliente não identificado' : (row.metadata?.client_name || 'Equipe Ampy'),
    date: row.due_at || row.reminder_at || row.updated_at || row.created_at,
    created_at: row.created_at,
    read_at: row.read_at,
    archived_at: row.archived_at,
    deleted_at: row.deleted_at,
    completed_at: row.completed_at,
    href: row.source_url || '/dashboard/avisos',
    action_label: row.action_label || 'Abrir origem',
    source: row,
  }
}

function generatedBase(input: any) {
  return {
    canonical: false,
    dbId: null,
    read_at: null,
    archived_at: null,
    deleted_at: null,
    completed_at: null,
    status: 'active',
    priority: 'medium',
    category: 'operational',
    source_module: null,
    source_table: null,
    source_id: null,
    source_url: '/dashboard/avisos',
    action_label: 'Abrir origem',
    metadata: {},
    ...input,
  }
}

function buildGeneratedAlerts({ manualAvisos, boards, items, events, workItems, clients }: any) {
  const alerts: any[] = []
  const boardById = new Map((boards || []).map((board: any) => [board.id, board]))
  const itemById = new Map((items || []).map((item: any) => [item.id, item]))

  for (const item of manualAvisos || []) {
    alerts.push(generatedBase({
      id: `manual-${item.id}`,
      dedupe_key: `manual-chat-${item.id}`,
      category: 'manual',
      priority: 'low',
      title: 'Aviso interno',
      message: manualMessage(item),
      client: 'Equipe Ampy',
      date: item.created_at,
      source_module: 'communication',
      source_table: 'chat_messages',
      source_id: item.id,
      source_url: '/dashboard/avisos',
      action_label: 'Abrir avisos',
    }))
  }

  for (const event of events || []) {
    const board: any = boardById.get(event.board_id)
    const item: any = itemById.get(event.item_id)
    const eventType = String(event.event_type || '').toLowerCase()

    if (['client_item_changes_requested', 'client_item_approved', 'internal_item_resent'].includes(eventType)) {
      continue
    }

    const message = String(event.message || '')
    const lower = message.toLowerCase()

    let category = 'approval'
    let priority = 'medium'
    let actionLabel = 'Abrir aprovação'

    if (lower.includes('ajuste') || lower.includes('solicit')) {
      category = 'adjustment'
      priority = 'high'
    } else if (lower.includes('data') || lower.includes('horário') || lower.includes('horario') || lower.includes('link') || lower.includes('legenda') || lower.includes('program')) {
      category = 'planning'
      priority = 'medium'
    } else if (lower.includes('aprovou') || lower.includes('aprovado')) {
      category = 'approval'
      priority = 'low'
    }

    alerts.push(generatedBase({
      id: `event-${event.id}`,
      dedupe_key: `feed-event-${event.id}`,
      category,
      priority,
      status: category === 'adjustment' ? 'active' : 'read',
      title: board?.title || 'Aprovação',
      message: item?.title ? `${message} · ${item.title}` : message || 'Atualização registrada na aprovação.',
      client: board?.client?.name || 'Cliente não identificado',
      date: event.created_at,
      source_module: 'approval',
      source_table: 'feed_board_events',
      source_id: event.id,
      source_url: board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
      action_label: actionLabel,
      client_id: board?.client_id || null,
      feed_board_id: board?.id || null,
      feed_board_item_id: item?.id || null,
      feed_board_event_id: event.id,
    }))
  }

  for (const item of items || []) {
    const board: any = boardById.get(item.board_id)
    const boardStatus = String(board?.status || '')

    if (item.approval_status === 'changes_requested') {
      alerts.push(generatedBase({
        id: `approval-change-${item.id}`,
        dedupe_key: `approval-change-${item.id}`,
        category: 'adjustment',
        priority: 'high',
        status: 'active',
        title: board?.title || 'Aprovação com ajuste',
        message: `Cliente solicitou ajuste em "${item.title || 'item da aprovação'}".${item.client_feedback ? ` Comentário: ${item.client_feedback}` : ''}`,
        client: board?.client?.name || 'Cliente não identificado',
        date: item.updated_at || board?.updated_at,
        source_module: 'approval',
        source_table: 'feed_board_items',
        source_id: item.id,
        source_url: board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
        action_label: 'Abrir aprovação',
        client_id: board?.client_id || null,
        feed_board_id: board?.id || null,
        feed_board_item_id: item.id,
      }))
    }

    if ((!item.approval_status || item.approval_status === 'pending') && ['in_progress', 'sent'].includes(boardStatus)) {
      alerts.push(generatedBase({
        id: `approval-pending-${item.id}`,
        dedupe_key: `approval-pending-${item.id}`,
        category: 'approval',
        priority: 'medium',
        status: 'active',
        title: board?.title || 'Aprovação pendente',
        message: `Post "${item.title || 'sem título'}" ainda aguarda aprovação do cliente.`,
        client: board?.client?.name || 'Cliente não identificado',
        date: item.updated_at || board?.updated_at,
        source_module: 'approval',
        source_table: 'feed_board_items',
        source_id: item.id,
        source_url: board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
        action_label: 'Abrir aprovação',
        client_id: board?.client_id || null,
        feed_board_id: board?.id || null,
        feed_board_item_id: item.id,
      }))
    }

    if ((item.scheduled_date || item.scheduled_time) && item.approval_status !== 'approved') {
      alerts.push(generatedBase({
        id: `planning-${item.id}`,
        dedupe_key: `approval-planning-${item.id}`,
        category: 'planning',
        priority: 'medium',
        status: 'active',
        title: board?.title || 'Planejamento de aprovação',
        message: `Post "${item.title || 'sem título'}" tem programação ${formatDate(item.scheduled_date)} ${item.scheduled_time || ''} e ainda não está aprovado.`,
        client: board?.client?.name || 'Cliente não identificado',
        date: item.updated_at || board?.updated_at,
        source_module: 'approval',
        source_table: 'feed_board_items',
        source_id: item.id,
        source_url: board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
        action_label: 'Abrir aprovação',
        client_id: board?.client_id || null,
        feed_board_id: board?.id || null,
        feed_board_item_id: item.id,
      }))
    }
  }

  for (const item of workItems || []) {
    if (!isOpenWorkItem(item.status)) continue

    const due = item.final_deadline || item.internal_deadline
    const dateCompare = compareDateOnly(due)
    const href = demandHref(item)
    const sourceModule = href.includes('projetos') ? 'project' : href.includes('quadro') ? 'board' : 'demand'

    if (due && dateCompare < 0) {
      alerts.push(generatedBase({
        id: `demand-overdue-${item.id}`,
        dedupe_key: `demand-overdue-${item.id}`,
        category: 'demand',
        priority: 'high',
        title: item.title || 'Demanda atrasada',
        message: `Demanda atrasada desde ${formatDate(due)}.`,
        client: item.client?.name || 'Interna',
        date: due,
        source_module: sourceModule,
        source_table: 'work_items',
        source_id: item.id,
        source_url: href,
        action_label: 'Abrir demanda',
        client_id: item.client_id || null,
        work_item_id: item.id,
      }))
    }

    if (due && dateCompare === 0) {
      alerts.push(generatedBase({
        id: `demand-today-${item.id}`,
        dedupe_key: `demand-today-${item.id}`,
        category: 'demand',
        priority: 'medium',
        title: item.title || 'Demanda vencendo hoje',
        message: 'Demanda vence hoje e precisa de acompanhamento.',
        client: item.client?.name || 'Interna',
        date: due,
        source_module: sourceModule,
        source_table: 'work_items',
        source_id: item.id,
        source_url: href,
        action_label: 'Abrir demanda',
        client_id: item.client_id || null,
        work_item_id: item.id,
      }))
    }

    if (String(item.priority || '').toLowerCase().includes('high') || String(item.priority || '').toLowerCase().includes('alta') || String(item.priority || '').toLowerCase().includes('urgent')) {
      alerts.push(generatedBase({
        id: `demand-priority-${item.id}`,
        dedupe_key: `demand-priority-${item.id}`,
        category: 'demand',
        priority: 'high',
        title: item.title || 'Demanda prioritária',
        message: 'Demanda marcada como prioridade alta.',
        client: item.client?.name || 'Interna',
        date: item.updated_at || item.created_at,
        source_module: sourceModule,
        source_table: 'work_items',
        source_id: item.id,
        source_url: href,
        action_label: 'Abrir demanda',
        client_id: item.client_id || null,
        work_item_id: item.id,
      }))
    }

    if (item.status === 'blocked' || item.blocked_reason) {
      alerts.push(generatedBase({
        id: `demand-blocked-${item.id}`,
        dedupe_key: `demand-blocked-${item.id}`,
        category: 'demand',
        priority: 'high',
        title: item.title || 'Demanda bloqueada',
        message: item.blocked_reason || 'Demanda bloqueada e precisa de ação.',
        client: item.client?.name || 'Interna',
        date: item.updated_at || item.created_at,
        source_module: sourceModule,
        source_table: 'work_items',
        source_id: item.id,
        source_url: href,
        action_label: 'Abrir demanda',
        client_id: item.client_id || null,
        work_item_id: item.id,
      }))
    }
  }

  for (const client of clients || []) {
    const end = client.contract_end || client.contract_end_date || client.end_date
    const remaining = daysUntil(end)

    if (remaining !== null && remaining >= 0 && remaining <= 30 && String(client.status || '').toLowerCase() !== 'inactive') {
      alerts.push(generatedBase({
        id: `client-contract-${client.id}`,
        dedupe_key: `client-contract-${client.id}-${String(end).slice(0, 10)}`,
        category: 'client',
        priority: remaining <= 7 ? 'high' : 'medium',
        title: 'Contrato próximo do fim',
        message: `Contrato de ${client.name || 'cliente'} termina em ${remaining} dia(s). Verificar renovação, reunião ou próximos passos.`,
        client: client.name || 'Cliente',
        date: end,
        source_module: 'client',
        source_table: 'clients',
        source_id: client.id,
        source_url: '/dashboard/clientes',
        action_label: 'Abrir clientes',
        client_id: client.id,
      }))
    }
  }

  return alerts
    .filter((alert) => alert.message)
    .sort((a, b) => {
      const pa = a.priority === 'urgent' ? 4 : a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1
      const pb = b.priority === 'urgent' ? 4 : b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1
      if (pb !== pa) return pb - pa
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    })
    .slice(0, 300)
}

function alertSourceKey(alert: any) {
  const source = alert?.source || {}
  const category = String(alert?.category || source?.category || '')
  const sourceTable = alert?.source_table || source?.source_table || ''
  const sourceId = alert?.source_id || source?.source_id || ''
  const itemId = alert?.feed_board_item_id || source?.feed_board_item_id || ''

  if (category && itemId) return `${category}:feed_board_item:${itemId}`
  if (category && sourceTable && sourceId) return `${category}:${sourceTable}:${sourceId}`
  return ''
}

function alertContentKey(alert: any) {
  const category = String(alert?.category || alert?.source?.category || '').trim().toLowerCase()
  const title = String(alert?.title || '').trim().toLowerCase()
  const message = String(alert?.message || '').trim().toLowerCase()
  const client = String(alert?.client_id || alert?.client?.id || alert?.client || '').trim().toLowerCase()

  if (!title && !message) return ''

  return [category, client, title, message].join(':')
}

function avisoPayload(alert: any) {
  return {
    title: alert.title,
    message: alert.message,
    category: alert.category || 'operational',
    priority: alert.priority || 'medium',
    status: alert.status === 'read' ? 'read' : 'active',
    source_module: alert.source_module || null,
    source_table: alert.source_table || null,
    source_id: alert.source_id || null,
    dedupe_key: alert.dedupe_key || null,
    client_id: alert.client_id || null,
    work_item_id: alert.work_item_id || null,
    feed_board_id: alert.feed_board_id || null,
    feed_board_item_id: alert.feed_board_item_id || null,
    feed_board_event_id: alert.feed_board_event_id || null,
    source_url: alert.source_url || alert.href || '/dashboard/avisos',
    action_label: alert.action_label || 'Abrir origem',
    due_at: alert.category === 'planning' || alert.category === 'demand' || alert.category === 'client' ? alert.date || null : null,
    reminder_at: null,
    is_auto: true,
    metadata: {
      client_name: alert.client || null,
      generated_id: alert.id,
    },
  }
}

export default function AvisosView({
  currentProfile,
  canonicalAvisos = [],
  manualAvisos = [],
  boards = [],
  items = [],
  events = [],
  workItems = [],
  clients = [],
  loadErrors = [],
}: any) {
  const supabase = useMemo(() => createClient(), [])
  const [scope, setScope] = useState('active')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [rows, setRows] = useState<any[]>(canonicalAvisos || [])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const clientById = useMemo(() => new Map((clients || []).map((client: any) => [client.id, client])), [clients])
  const itemById = useMemo(() => new Map((items || []).map((item: any) => [item.id, item])), [items])

  const generatedAlerts = useMemo(
    () => buildGeneratedAlerts({ manualAvisos, boards, items, events, workItems, clients }),
    [manualAvisos, boards, items, events, workItems, clients]
  )

  const canonicalAlerts = useMemo(
    () => (rows || []).map((row: any) => normalizeCanonicalAviso(row, clientById, itemById)),
    [rows, clientById, itemById]
  )

  async function reloadAvisos() {
    const { data } = await supabase
      .from('avisos')
      .select('*,metadata')
      .order('updated_at', { ascending: false })
      .limit(1000)

    if (data) {
      setRows(data)
      window.dispatchEvent(new Event('avisos:changed'))
    }
  }

  // A tela de Avisos deve usar a tabela public.avisos como fonte de verdade.
  // Não sincronizar generatedAlerts aqui, porque isso reativa avisos apagados/limpos.
  useEffect(() => {
    return
  }, [])

  const alerts = useMemo(() => {
    const visibleCanonical = (canonicalAlerts || []).filter((alert: any) => !alert.hidden)

    const sorted = [...visibleCanonical].sort((a: any, b: any) => {
      const pa = a.priority === 'urgent' ? 4 : a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1
      const pb = b.priority === 'urgent' ? 4 : b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1

      if (pb !== pa) return pb - pa

      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    })

    const seen = new Set()

    return sorted.filter((alert: any) => {
      const stableKey =
        alert.dedupe_key ||
        alertSourceKey(alert) ||
        alertContentKey(alert) ||
        String(alert.id || '')

      if (stableKey) {
        if (seen.has(stableKey)) return false
        seen.add(stableKey)
      }

      return true
    })
  }, [canonicalAlerts])

  const counts = useMemo(() => {
    const active = alerts.filter((alert: any) => !['archived', 'deleted', 'done'].includes(alert.status))
    return {
      active: active.length,
      unread: active.filter((alert: any) => !alert.read_at && alert.status !== 'read').length,
      high: active.filter((alert: any) => ['urgent', 'high'].includes(alert.priority)).length,
      approval: active.filter((alert: any) => alert.category === 'approval').length,
      adjustment: active.filter((alert: any) => alert.category === 'adjustment').length,
      demand: active.filter((alert: any) => alert.category === 'demand').length,
      planning: active.filter((alert: any) => alert.category === 'planning').length,
      archived: alerts.filter((alert: any) => alert.status === 'archived').length,
      deleted: alerts.filter((alert: any) => alert.status === 'deleted').length,
      done: alerts.filter((alert: any) => alert.status === 'done').length,
    }
  }, [alerts])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()

    return alerts.filter((alert: any) => {
      const isActive = !['archived', 'deleted', 'done'].includes(alert.status)
      const isUnread = isActive && !alert.read_at && alert.status !== 'read'

      const matchesScope =
        (scope === 'active' && isActive) ||
        (scope === 'unread' && isUnread) ||
        (scope === 'high' && isActive && ['urgent', 'high'].includes(alert.priority)) ||
        (scope === 'archived' && alert.status === 'archived') ||
        (scope === 'deleted' && alert.status === 'deleted') ||
        (scope === 'done' && alert.status === 'done') ||
        (isActive && alert.category === scope)

      const matchesQuery =
        !term ||
        [alert.title, alert.message, alert.client, alert.category, alert.priority]
          .some((value) => String(value || '').toLowerCase().includes(term))

      return matchesScope && matchesQuery
    })
  }, [alerts, scope, query])


  const selectedVisible = useMemo(() => {
    return visible.filter((alert: any) => selectedIds.includes(String(alert.id)))
  }, [visible, selectedIds])

  useEffect(() => {
    setSelectedIds([])
  }, [scope, query])

  function toggleAvisoSelection(id: any, checked: boolean) {
    const key = String(id)

    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, key]))
      return current.filter((item) => item !== key)
    })
  }

  function selectVisibleAvisos() {
    setSelectedIds(visible.map((alert: any) => String(alert.id)))
  }

  function clearSelectedAvisos() {
    setSelectedIds([])
  }

  async function markSelectedRead() {
    const targets = selectedVisible.filter((alert: any) => !alert.read_at && !['archived', 'deleted', 'done'].includes(alert.status))

    if (targets.length === 0) {
      setNotice('Nenhum aviso selecionado para marcar como lido.')
      return
    }

    setBusyId('selected-read')
    setNotice('')

    try {
      const ids: string[] = []

      for (const alert of targets) {
        const id = await persistGenerated(alert)
        if (id) ids.push(id)
      }

      if (ids.length > 0) {
        const { error } = await supabase
          .from('avisos')
          .update({
            status: 'read',
            read_at: new Date().toISOString(),
          })
          .in('id', ids)

        if (error) throw error
      }

      setSelectedIds([])
      setNotice('Avisos selecionados marcados como lidos.')
      await reloadAvisos()
    } catch (err: any) {
      setNotice(err?.message || 'Erro ao marcar avisos selecionados como lidos.')
    } finally {
      setBusyId('')
    }
  }

  async function deleteSelectedAvisos() {
    const targets = selectedVisible.filter((alert: any) => alert.status !== 'deleted')

    if (targets.length === 0) {
      setNotice(scope === 'deleted' ? 'Avisos apagados já estão na lixeira. Use Limpar apagados.' : 'Nenhum aviso selecionado para apagar.')
      return
    }

    const ok = window.confirm(`Apagar ${targets.length} aviso(s) selecionado(s)? Eles irão para Apagados.`)
    if (!ok) return

    setBusyId('selected-delete')
    setNotice('')

    try {
      const ids: string[] = []

      for (const alert of targets) {
        const id = await persistGenerated(alert)
        if (id) ids.push(id)
      }

      if (ids.length > 0) {
        const { error } = await supabase
          .from('avisos')
          .update({
            status: 'deleted',
            deleted_at: new Date().toISOString(),
          })
          .in('id', ids)

        if (error) throw error
      }

      setSelectedIds([])
      setNotice('Avisos selecionados apagados.')
      await reloadAvisos()
    } catch (err: any) {
      setNotice(err?.message || 'Erro ao apagar avisos selecionados.')
    } finally {
      setBusyId('')
    }
  }

  function isClosedCanonicalAviso(row: any) {
    if (!row) return false

    const metadata = row.metadata || {}
    const status = String(row.status || '').toLowerCase()

    return Boolean(
      metadata.purged ||
      metadata.purged_at ||
      ['deleted', 'archived', 'done'].includes(status)
    )
  }

  function sameAvisoIdentity(row: any, alert: any) {
    if (!row || !alert) return false

    const rowDedupe = String(row.dedupe_key || '')
    const alertDedupe = String(alert.dedupe_key || '')

    if (rowDedupe && alertDedupe && rowDedupe === alertDedupe) return true

    const rowSource = alertSourceKey(row)
    const alertSource = alertSourceKey(alert)

    if (rowSource && alertSource && rowSource === alertSource) return true

    const rowContent = alertContentKey(row)
    const alertContent = alertContentKey(alert)

    if (rowContent && alertContent && rowContent === alertContent) return true

    return false
  }

  async function persistGenerated(alert: any) {
    if (alert.dbId) return alert.dbId

    const payload = avisoPayload(alert)
    const { data, error } = await supabase
      .from('avisos')
      .upsert(payload, { onConflict: 'dedupe_key' })
      .select('id,metadata')
      .single()

    if (error) throw error

    await reloadAvisos()
    return data?.id
  }

  async function updateAviso(alert: any, patch: any, label: string) {
    setBusyId(alert.id)
    setNotice('')

    try {
      const id = await persistGenerated(alert)

      const { error } = await supabase
        .from('avisos')
        .update(patch)
        .eq('id', id)

      if (error) throw error

      setNotice(label)
      await reloadAvisos()
    } catch (err: any) {
      setNotice(err?.message || 'Erro ao atualizar aviso.')
    } finally {
      setBusyId('')
    }
  }

  function markRead(alert: any) {
    return updateAviso(alert, {
      status: 'read',
      read_at: new Date().toISOString(),
    }, 'Aviso marcado como lido.')
  }

  function archiveAviso(alert: any) {
    return updateAviso(alert, {
      status: 'archived',
      archived_at: new Date().toISOString(),
      read_at: alert.read_at || new Date().toISOString(),
    }, 'Aviso arquivado.')
  }

  function deleteAviso(alert: any) {
    return updateAviso(alert, {
      status: 'deleted',
      deleted_at: new Date().toISOString(),
    }, 'Aviso apagado.')
  }

  function restoreAviso(alert: any) {
    return updateAviso(alert, {
      status: 'active',
      archived_at: null,
      deleted_at: null,
      completed_at: null,
    }, 'Aviso restaurado.')
  }

  function doneAviso(alert: any) {
    return updateAviso(alert, {
      status: 'done',
      completed_at: new Date().toISOString(),
      read_at: alert.read_at || new Date().toISOString(),
    }, 'Aviso resolvido.')
  }

  async function markAllRead() {
    setBusyId('all-read')
    setNotice('')

    try {
      const active = visible.filter((alert: any) => !alert.read_at && !['archived', 'deleted', 'done'].includes(alert.status))
      const ids: string[] = []

      for (const alert of active) {
        const id = await persistGenerated(alert)
        if (id) ids.push(id)
      }

      if (ids.length > 0) {
        const { error } = await supabase
          .from('avisos')
          .update({ status: 'read', read_at: new Date().toISOString() })
          .in('id', ids)

        if (error) throw error
      }

      setNotice('Avisos visíveis marcados como lidos.')
      await reloadAvisos()
    } catch (err: any) {
      setNotice(err?.message || 'Erro ao marcar avisos como lidos.')
    } finally {
      setBusyId('')
    }
  }


  async function deleteVisibleAvisos() {
    const deletable = visible.filter((alert: any) => !['archived', 'deleted', 'done'].includes(alert.status))

    if (deletable.length === 0) {
      setNotice('Nenhum aviso visível para apagar.')
      return
    }

    const ok = window.confirm(`Apagar ${deletable.length} aviso(s) visível(is)? Eles sairão da fila ativa e irão para Apagados.`)
    if (!ok) return

    setBusyId('delete-visible')
    setNotice('')

    try {
      const ids: string[] = []

      for (const alert of deletable) {
        const id = await persistGenerated(alert)
        if (id) ids.push(id)
      }

      if (ids.length > 0) {
        const { error } = await supabase
          .from('avisos')
          .update({
            status: 'deleted',
            deleted_at: new Date().toISOString(),
          })
          .in('id', ids)

        if (error) throw error
      }

      setNotice('Avisos visíveis apagados.')
      await reloadAvisos()
    } catch (err: any) {
      setNotice(err?.message || 'Erro ao apagar avisos visíveis.')
    } finally {
      setBusyId('')
    }
  }

  async function purgeDeletedAvisos() {
    const ok = window.confirm('Remover todos os avisos apagados da lixeira? Eles ficarão ocultos e não poderão ser reativados automaticamente.')
    if (!ok) return

    setBusyId('purge-deleted')
    setNotice('')

    try {
      const { error } = await supabase
        .from('avisos')
        .update({
          metadata: {
            purged: true,
            purged_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'deleted')

      if (error) throw error

      setRows((current: any[]) => current.map((row: any) => {
        if (String(row.status || '').toLowerCase() !== 'deleted') return row

        return {
          ...row,
          metadata: {
            ...(row.metadata || {}),
            purged: true,
            purged_at: new Date().toISOString(),
          },
        }
      }))

      setNotice('Avisos apagados foram removidos da lixeira.')
      setScope('deleted')
      setSelectedIds([])
      await reloadAvisos()
    } catch (err: any) {
      setNotice(err?.message || 'Erro ao limpar avisos apagados.')
    } finally {
      setBusyId('')
    }
  }

  const filters = [
    ['active', 'Ativos', counts.active],
    ['unread', 'Não lidos', counts.unread],
    ['high', 'Alta prioridade', counts.high],
    ['adjustment', 'Ajustes', counts.adjustment],
    ['approval', 'Aprovações', counts.approval],
    ['demand', 'Demandas', counts.demand],
    ['planning', 'Planejamento', counts.planning],
    ['done', 'Resolvidos', counts.done],
    ['archived', 'Arquivados', counts.archived],
    ['deleted', 'Apagados', counts.deleted],
  ]

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div>
          <div className="tb-title">Avisos</div>
          <div className="tb-sub">Central operacional integrada a aprovações, demandas, clientes, agenda, projetos e quadro.</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          
          
          
          <div style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 800 }}>
            {currentProfile?.full_name || 'Equipe Ampy'}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loadErrors.length > 0 && (
          <div className="notice notice-err" style={{ marginBottom: 14 }}>
            <i className="ti ti-alert-circle" />
            <span>{loadErrors.join(' | ')}</span>
          </div>
        )}

        {notice && (
          <div className="notice" style={{ marginBottom: 14 }}>
            <i className="ti ti-info-circle" />
            <span>{notice}</span>
          </div>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
          <div className="metric"><div className="metric-lbl">Ativos</div><div className="metric-val">{counts.active}</div></div>
          <div className="metric"><div className="metric-lbl">Não lidos</div><div className="metric-val">{counts.unread}</div></div>
          <div className="metric"><div className="metric-lbl">Alta prioridade</div><div className="metric-val">{counts.high}</div></div>
          <div className="metric"><div className="metric-lbl">Ajustes</div><div className="metric-val">{counts.adjustment}</div></div>
          <div className="metric"><div className="metric-lbl">Demandas</div><div className="metric-val">{counts.demand}</div></div>
          <div className="metric"><div className="metric-lbl">Arquivados</div><div className="metric-val">{counts.archived}</div></div>
        </section>

        <div className="sh" style={{ marginBottom: 14 }}>
          <div>
            <div className="stitle">Fila de avisos operacionais</div>
            <div className="ssub">Priorize ajustes de cliente, prazos, bloqueios, aprovações pendentes e lembretes de operação.</div>
          </div>

          <div className="sbox" style={{ minWidth: 300 }}>
            <i className="ti ti-search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aviso, cliente, demanda ou origem..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {filters.map(([value, label, count]: any) => (
            <button key={value} className={`fb ${scope === value ? 'on' : ''}`} onClick={() => setScope(value)}>
              {label} <span style={{ opacity: .7 }}>({count})</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="bsec" onClick={selectVisibleAvisos} disabled={visible.length === 0}>
              Selecionar visíveis
            </button>
            <button type="button" className="bsec" onClick={clearSelectedAvisos} disabled={selectedIds.length === 0}>
              Limpar seleção
            </button>
            <span style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 800 }}>
              {selectedIds.length} selecionado(s)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && scope !== 'deleted' && (
              <>
                <button type="button" className="bsec" onClick={markSelectedRead} disabled={busyId === 'selected-read'}>
                  {busyId === 'selected-read' ? 'Marcando...' : 'Marcar como lido'}
                </button>
                <button type="button" className="bsec danger-action" onClick={deleteSelectedAvisos} disabled={busyId === 'selected-delete'}>
                  {busyId === 'selected-delete' ? 'Apagando...' : 'Apagar selecionados'}
                </button>
              </>
            )}

            {scope === 'deleted' && counts.deleted > 0 && (
              <button type="button" className="bsec danger-action" onClick={purgeDeletedAvisos} disabled={busyId === 'purge-deleted'}>
                {busyId === 'purge-deleted' ? 'Limpando...' : 'Limpar apagados'}
              </button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <i className="ti ti-bell" />
            <div className="empty-title">Nenhum aviso encontrado</div>
            <div className="empty-sub">Não há avisos para o filtro selecionado.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {visible.map((alert: any) => {
              const priority = priorityTone(alert.priority)
              const category = categoryTone(alert.category)
              const muted = ['archived', 'deleted', 'done'].includes(alert.status)
              const unread = !alert.read_at && !muted && alert.status !== 'read'

              return (
                <article key={alert.id} style={{ background: unread ? '#FFFFFF' : 'var(--s1)', border: unread ? '1px solid #2563EB' : '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14, display: 'grid', gridTemplateColumns: '42px 160px minmax(0, 1fr) 135px 310px', gap: 14, alignItems: 'center', opacity: muted ? .72 : 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(alert.id))}
                      onChange={(event) => toggleAvisoSelection(alert.id, event.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </label>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <span style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '6px 9px', background: category.bg, color: category.color, fontSize: 11, fontWeight: 900 }}>
                      {CATEGORY_LABEL[alert.category] || alert.category}
                    </span>

                    <span style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '6px 9px', background: priority.bg, color: priority.color, border: `1px solid ${priority.border}`, fontSize: 11, fontWeight: 900 }}>
                      {PRIORITY_LABEL[alert.priority] || alert.priority}
                    </span>

                    <span style={{ fontSize: 10, color: unread ? '#2563EB' : 'var(--t4)', fontWeight: 900 }}>
                      {unread ? 'NÃO LIDO' : STATUS_LABEL[alert.status] || alert.status}
                    </span>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 950, color: 'var(--t1)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.4 }}>
                      {alert.message}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--t4)' }}>
                      {alert.client}
                    </div>
                  </div>

                  <div style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 800 }}>
                    {formatDateTime(alert.date)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                    {alert.href ? (
                      <Link className="bsec" href={alert.href}>{alert.action_label || 'Abrir'}</Link>
                    ) : (
                      <span className="badge bmut">Sem ação</span>
                    )}

                    {!['archived', 'deleted', 'done'].includes(alert.status) && (
                      <>
                        <button type="button" className="bsec" onClick={() => markRead(alert)} disabled={busyId === alert.id}>Lido</button>
                        <button type="button" className="bsec" onClick={() => doneAviso(alert)} disabled={busyId === alert.id}>Resolver</button>
                        <button type="button" className="bsec" onClick={() => archiveAviso(alert)} disabled={busyId === alert.id}>Arquivar</button>
                        <button type="button" className="bsec danger-action" onClick={() => deleteAviso(alert)} disabled={busyId === alert.id}>Apagar</button>
                      </>
                    )}

                    {['archived', 'deleted', 'done'].includes(alert.status) && (
                      <button type="button" className="bsec" onClick={() => restoreAviso(alert)} disabled={busyId === alert.id}>Restaurar</button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
