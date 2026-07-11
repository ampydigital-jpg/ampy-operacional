'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const CLOSED_STATUSES = ['done', 'delivered', 'cancelled', 'archived']

const CATEGORY_LABEL: Record<string, string> = {
  approval: 'AprovaÃ§Ã£o',
  adjustment: 'Ajuste',
  demand: 'Demanda',
  planning: 'Planejamento',
  manual: 'Aviso',
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'MÃ©dia',
  low: 'Baixa',
}

function formatDateTime(value: string) {
  if (!value) return 'â€”'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'â€”' : date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: string) {
  if (!value) return 'â€”'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? 'â€”' : date.toLocaleDateString('pt-BR')
}

function periodLabel(value: string) {
  if (!value) return 'Sem perÃ­odo'
  const [year, month] = String(value).slice(0, 7).split('-')
  return `${month}/${year}`
}

function priorityTone(priority: string) {
  if (priority === 'high') return { bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5' }
  if (priority === 'medium') return { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D' }
  return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
}

function categoryTone(category: string) {
  if (category === 'adjustment') return { bg: '#FEF2F2', color: '#991B1B' }
  if (category === 'demand') return { bg: '#EFF6FF', color: '#1D4ED8' }
  if (category === 'planning') return { bg: '#F5F3FF', color: '#6D28D9' }
  if (category === 'manual') return { bg: '#F8FAFC', color: '#475569' }
  return { bg: '#ECFDF5', color: '#166534' }
}

function isOpenWorkItem(status: string) {
  return !CLOSED_STATUSES.includes(String(status || ''))
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function compareDateOnly(value: string) {
  const key = String(value || '').slice(0, 10)
  if (!key) return 0
  return key.localeCompare(todayKey())
}

function manualMessage(item: any) {
  return item.content || item.message || item.text || item.body || 'Aviso interno registrado.'
}

function buildAlerts({ manualAvisos, boards, items, events, workItems }: any) {
  const alerts: any[] = []
  const boardById = new Map((boards || []).map((board: any) => [board.id, board]))
  const itemById = new Map((items || []).map((item: any) => [item.id, item]))

  for (const item of manualAvisos || []) {
    alerts.push({
      id: `manual-${item.id}`,
      category: 'manual',
      priority: 'low',
      status: 'info',
      title: 'Aviso interno',
      message: manualMessage(item),
      client: 'Equipe Ampy',
      date: item.created_at,
      href: '/dashboard/avisos',
    })
  }

  for (const event of events || []) {
    const board: any = boardById.get(event.board_id)
    const item: any = itemById.get(event.item_id)
    const message = String(event.message || '')
    const lower = message.toLowerCase()

    let category = 'approval'
    let priority = 'medium'

    if (lower.includes('ajuste') || lower.includes('solicit')) {
      category = 'adjustment'
      priority = 'high'
    } else if (lower.includes('data') || lower.includes('horÃ¡rio') || lower.includes('horario') || lower.includes('link') || lower.includes('legenda') || lower.includes('program')) {
      category = 'planning'
      priority = 'medium'
    } else if (lower.includes('aprovou') || lower.includes('aprovado')) {
      category = 'approval'
      priority = 'low'
    }

    alerts.push({
      id: `event-${event.id}`,
      category,
      priority,
      status: category === 'adjustment' ? 'pending' : 'info',
      title: board?.title || 'AprovaÃ§Ã£o',
      message: item?.title ? `${message} Â· ${item.title}` : message || 'AtualizaÃ§Ã£o registrada na aprovaÃ§Ã£o.',
      client: board?.client?.name || 'Cliente nÃ£o identificado',
      date: event.created_at,
      href: board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
    })
  }

  for (const item of items || []) {
    const board: any = boardById.get(item.board_id)
    const boardStatus = String(board?.status || '')

    if (item.approval_status === 'changes_requested') {
      alerts.push({
        id: `approval-change-${item.id}`,
        category: 'adjustment',
        priority: 'high',
        status: 'pending',
        title: board?.title || 'AprovaÃ§Ã£o com ajuste',
        message: `Cliente solicitou ajuste em "${item.title || 'item da aprovaÃ§Ã£o'}".${item.client_feedback ? ` ComentÃ¡rio: ${item.client_feedback}` : ''}`,
        client: board?.client?.name || 'Cliente nÃ£o identificado',
        date: item.updated_at || board?.updated_at,
        href: board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
      })
    }

    if ((!item.approval_status || item.approval_status === 'pending') && ['in_progress', 'sent'].includes(boardStatus)) {
      alerts.push({
        id: `approval-pending-${item.id}`,
        category: 'approval',
        priority: 'medium',
        status: 'pending',
        title: board?.title || 'AprovaÃ§Ã£o pendente',
        message: `Item "${item.title || 'sem tÃ­tulo'}" ainda aguarda aprovaÃ§Ã£o do cliente.`,
        client: board?.client?.name || 'Cliente nÃ£o identificado',
        date: item.updated_at || board?.updated_at,
        href: board?.share_token ? `/aprovar/${board.share_token}` : board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
      })
    }

    if ((item.scheduled_date || item.scheduled_time) && item.approval_status !== 'approved') {
      alerts.push({
        id: `planning-${item.id}`,
        category: 'planning',
        priority: 'medium',
        status: 'pending',
        title: board?.title || 'Planejamento de aprovaÃ§Ã£o',
        message: `Post "${item.title || 'sem tÃ­tulo'}" tem programaÃ§Ã£o ${formatDate(item.scheduled_date)} ${item.scheduled_time || ''} e ainda nÃ£o estÃ¡ aprovado.`,
        client: board?.client?.name || 'Cliente nÃ£o identificado',
        date: item.updated_at || board?.updated_at,
        href: board?.id ? `/dashboard/feed-preview/${board.id}` : '/dashboard/feed-preview',
      })
    }
  }

  for (const board of boards || []) {
    if (board.status === 'changes_requested') {
      alerts.push({
        id: `board-changes-${board.id}`,
        category: 'adjustment',
        priority: 'high',
        status: 'pending',
        title: board.title || 'AprovaÃ§Ã£o com ajustes',
        message: `Documento ${periodLabel(board.period_month)} possui ajustes solicitados pelo cliente.`,
        client: board.client?.name || 'Cliente nÃ£o identificado',
        date: board.last_client_action_at || board.updated_at,
        href: `/dashboard/feed-preview/${board.id}`,
      })
    }

    if (board.status === 'approved') {
      alerts.push({
        id: `board-approved-${board.id}`,
        category: 'approval',
        priority: 'low',
        status: 'done',
        title: board.title || 'AprovaÃ§Ã£o concluÃ­da',
        message: `Documento ${periodLabel(board.period_month)} aprovado pelo cliente.`,
        client: board.client?.name || 'Cliente nÃ£o identificado',
        date: board.last_client_action_at || board.updated_at,
        href: `/dashboard/feed-preview/${board.id}`,
      })
    }
  }

  for (const item of workItems || []) {
    if (!isOpenWorkItem(item.status)) continue

    const due = item.final_deadline || item.internal_deadline
    const dateCompare = compareDateOnly(due)

    if (due && dateCompare < 0) {
      alerts.push({
        id: `demand-overdue-${item.id}`,
        category: 'demand',
        priority: 'high',
        status: 'pending',
        title: item.title || 'Demanda atrasada',
        message: `Demanda atrasada desde ${formatDate(due)}.`,
        client: item.client?.name || 'Interna',
        date: due,
        href: '/dashboard/demandas',
      })
    }

    if (due && dateCompare === 0) {
      alerts.push({
        id: `demand-today-${item.id}`,
        category: 'demand',
        priority: 'medium',
        status: 'pending',
        title: item.title || 'Demanda vencendo hoje',
        message: 'Demanda vence hoje e precisa de acompanhamento.',
        client: item.client?.name || 'Interna',
        date: due,
        href: '/dashboard/demandas',
      })
    }

    if (String(item.priority || '').toLowerCase().includes('high') || String(item.priority || '').toLowerCase().includes('alta') || String(item.priority || '').toLowerCase().includes('urgent')) {
      alerts.push({
        id: `demand-priority-${item.id}`,
        category: 'demand',
        priority: 'high',
        status: 'pending',
        title: item.title || 'Demanda prioritÃ¡ria',
        message: 'Demanda marcada como prioridade alta.',
        client: item.client?.name || 'Interna',
        date: item.updated_at || item.created_at,
        href: '/dashboard/demandas',
      })
    }

    if (item.status === 'blocked' || item.blocked_reason) {
      alerts.push({
        id: `demand-blocked-${item.id}`,
        category: 'demand',
        priority: 'high',
        status: 'pending',
        title: item.title || 'Demanda bloqueada',
        message: item.blocked_reason || 'Demanda bloqueada e precisa de aÃ§Ã£o.',
        client: item.client?.name || 'Interna',
        date: item.updated_at || item.created_at,
        href: '/dashboard/demandas',
      })
    }
  }

  return alerts
    .filter((alert) => alert.message)
    .sort((a, b) => {
      const pa = a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1
      const pb = b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1
      if (pb !== pa) return pb - pa
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    })
    .slice(0, 300)
}

export default function AvisosView({
  currentProfile,
  manualAvisos = [],
  boards = [],
  items = [],
  events = [],
  workItems = [],
  loadErrors = [],
}: any) {
  const [scope, setScope] = useState('all')
  const [query, setQuery] = useState('')

  const alerts = useMemo(() => buildAlerts({ manualAvisos, boards, items, events, workItems }), [manualAvisos, boards, items, events, workItems])

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      high: alerts.filter((alert) => alert.priority === 'high').length,
      approval: alerts.filter((alert) => alert.category === 'approval').length,
      adjustment: alerts.filter((alert) => alert.category === 'adjustment').length,
      demand: alerts.filter((alert) => alert.category === 'demand').length,
      planning: alerts.filter((alert) => alert.category === 'planning').length,
      pending: alerts.filter((alert) => alert.status === 'pending').length,
    }
  }, [alerts])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()

    return alerts.filter((alert) => {
      const matchesScope =
        scope === 'all' ||
        (scope === 'high' && alert.priority === 'high') ||
        (scope === 'pending' && alert.status === 'pending') ||
        alert.category === scope

      const matchesQuery =
        !term ||
        [alert.title, alert.message, alert.client, alert.category]
          .some((value) => String(value || '').toLowerCase().includes(term))

      return matchesScope && matchesQuery
    })
  }, [alerts, scope, query])

  const filters = [
    ['all', 'Todos', counts.all],
    ['high', 'Alta prioridade', counts.high],
    ['pending', 'Pendentes', counts.pending],
    ['adjustment', 'Ajustes', counts.adjustment],
    ['approval', 'AprovaÃ§Ãµes', counts.approval],
    ['demand', 'Demandas', counts.demand],
    ['planning', 'Planejamento', counts.planning],
  ]

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div>
          <div className="tb-title">Avisos</div>
          <div className="tb-sub">Central operacional com aprovaÃ§Ãµes, ajustes, demandas e planejamento.</div>
        </div>

        <div style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 800 }}>
          {currentProfile?.full_name || 'Equipe Ampy'}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loadErrors.length > 0 && (
          <div className="notice notice-err" style={{ marginBottom: 14 }}>
            <i className="ti ti-alert-circle" />
            <span>{loadErrors.join(' | ')}</span>
          </div>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
          <div className="metric"><div className="metric-lbl">Total</div><div className="metric-val">{counts.all}</div></div>
          <div className="metric"><div className="metric-lbl">Alta prioridade</div><div className="metric-val">{counts.high}</div></div>
          <div className="metric"><div className="metric-lbl">Ajustes</div><div className="metric-val">{counts.adjustment}</div></div>
          <div className="metric"><div className="metric-lbl">Demandas</div><div className="metric-val">{counts.demand}</div></div>
          <div className="metric"><div className="metric-lbl">Planejamento</div><div className="metric-val">{counts.planning}</div></div>
        </section>

        <div className="sh" style={{ marginBottom: 14 }}>
          <div>
            <div className="stitle">Alertas operacionais</div>
            <div className="ssub">Priorize ajustes do cliente, atrasos, bloqueios e aprovaÃ§Ãµes pendentes.</div>
          </div>

          <div className="sbox" style={{ minWidth: 300 }}>
            <i className="ti ti-search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aviso, cliente ou demanda..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {filters.map(([value, label, count]: any) => (
            <button key={value} className={`fb ${scope === value ? 'on' : ''}`} onClick={() => setScope(value)}>
              {label} <span style={{ opacity: .7 }}>({count})</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <i className="ti ti-bell" />
            <div className="empty-title">Nenhum aviso encontrado</div>
            <div className="empty-sub">NÃ£o hÃ¡ alertas para o filtro selecionado.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {visible.map((alert: any) => {
              const priority = priorityTone(alert.priority)
              const category = categoryTone(alert.category)

              return (
                <article key={alert.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14, display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 130px 120px', gap: 14, alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '6px 9px', background: category.bg, color: category.color, fontSize: 11, fontWeight: 900 }}>
                      {CATEGORY_LABEL[alert.category] || alert.category}
                    </span>

                    <span style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '6px 9px', background: priority.bg, color: priority.color, border: `1px solid ${priority.border}`, fontSize: 11, fontWeight: 900 }}>
                      {PRIORITY_LABEL[alert.priority] || alert.priority}
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {alert.href ? (
                      <Link className="bsec" href={alert.href}>Abrir</Link>
                    ) : (
                      <span className="badge bmut">Sem aÃ§Ã£o</span>
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
