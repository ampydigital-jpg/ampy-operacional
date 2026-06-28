import { createClient } from '@/lib/supabase/server'

const SETORES = ['Planejamento','Captação','Edição','Design','Org. Feed','Programação','Tráfego','Gestão','Todos']

const statusColor: Record<string, string> = {
  not_started: 'var(--t4)', in_progress: 'var(--blue)', waiting: 'var(--warn)',
  blocked: 'var(--err)', awaiting_approval: 'var(--purple)', done: 'var(--ok)',
}

export default async function MeuDiaPage({ searchParams }: { searchParams: { setor?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const setor = searchParams.setor || 'Todos'

  let query = supabase.from('work_items')
    .select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg), responsible:profiles(full_name, avatar_initials)')
    .or(`final_deadline.eq.${todayStr},internal_deadline.eq.${todayStr}`)
    .not('status', 'in', '(done,cancelled,archived)')
    .order('priority', { ascending: false })

  if (setor !== 'Todos') query = query.eq('type', setor)

  const { data: todayDemands } = await query

  const { data: todayEvents } = await supabase
    .from('calendar_events')
    .select('*, client:clients(name)')
    .gte('starts_at', `${todayStr}T00:00:00`)
    .lte('starts_at', `${todayStr}T23:59:59`)
    .order('starts_at')

  const priorityConfig: Record<string, any> = {
    urgent: { label: 'Urgente', color: 'var(--err)', bg: 'var(--err-bg)', br: 'var(--err-br)' },
    high: { label: 'Alta', color: 'var(--warn)', bg: 'var(--warn-bg)', br: 'var(--warn-br)' },
    normal: { label: 'Normal', color: 'var(--t3)', bg: 'var(--s2)', br: 'var(--b1)' },
    low: { label: 'Baixa', color: 'var(--t4)', bg: 'var(--s2)', br: 'var(--b1)' },
  }

  const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Meu dia</div>
        <div className="tb-sub">{dateStr}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Entregas hoje</div><div className="metric-val" style={{ color: (todayDemands?.length ?? 0) > 0 ? 'var(--warn)' : 'var(--w)' }}>{todayDemands?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--warn)' }} />Com prazo hoje</div></div>
          <div className="metric"><div className="metric-lbl">Eventos</div><div className="metric-val">{todayEvents?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--blue)' }} />Agendados</div></div>
          <div className="metric"><div className="metric-lbl">Urgentes</div><div className="metric-val" style={{ color: (todayDemands?.filter(d => d.priority === 'urgent').length ?? 0) > 0 ? 'var(--err)' : 'var(--w)' }}>{todayDemands?.filter(d => d.priority === 'urgent').length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--err)' }} />Prioridade máxima</div></div>
          <div className="metric"><div className="metric-lbl">Bloqueadas</div><div className="metric-val" style={{ color: (todayDemands?.filter(d => d.status === 'blocked').length ?? 0) > 0 ? 'var(--err)' : 'var(--w)' }}>{todayDemands?.filter(d => d.status === 'blocked').length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--err)' }} />Precisam de ação</div></div>
        </div>

        {/* Filtro por setor */}
        <div className="filters">
          {SETORES.map(s => (
            <a key={s} href={`/dashboard/meu-dia?setor=${s}`} className={`fb ${setor === s ? 'on' : ''}`}>{s}</a>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '14px' }}>
          <div>
            <div className="sh"><div className="stitle">Demandas do dia</div><div className="ssub">{todayDemands?.length ?? 0} itens</div></div>
            {!todayDemands || todayDemands.length === 0 ? (
              <div className="empty"><i className="ti ti-sun" style={{ color: 'var(--ok)' }} /><div className="empty-title" style={{ color: 'var(--ok)' }}>Dia livre!</div><div className="empty-sub">Nenhuma entrega com prazo hoje{setor !== 'Todos' ? ` em ${setor}` : ''}.</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {todayDemands.map((d: any) => {
                  const pr = priorityConfig[d.priority] || priorityConfig.normal
                  return (
                    <div key={d.id} style={{ background: 'var(--s1)', border: `0.5px solid ${d.priority === 'urgent' ? 'var(--err-br)' : 'var(--b1)'}`, borderRadius: 'var(--rc)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '4px', height: '100%', minHeight: '40px', background: pr.color, borderRadius: '2px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#DDD', marginBottom: '3px' }}>{d.title}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', color: 'var(--t4)' }}>{d.client?.name || 'Interno'}</span>
                          <span style={{ fontSize: '10px', color: 'var(--t3)' }}>·</span>
                          <span style={{ fontSize: '10px', color: 'var(--t4)' }}>{d.type}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <span className="badge" style={{ background: pr.bg, color: pr.color, border: `0.5px solid ${pr.br}` }}>{pr.label}</span>
                        <span style={{ fontSize: '10px', color: statusColor[d.status] || 'var(--t3)' }}>{d.status?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div className="sh"><div className="stitle">Agenda de hoje</div></div>
            {!todayEvents || todayEvents.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'var(--s1)', borderRadius: 'var(--rc)', border: '0.5px solid var(--b1)', fontSize: '11px', color: 'var(--t4)' }}>Nenhum evento hoje</div>
            ) : (
              <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', overflow: 'hidden' }}>
                {todayEvents.sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at)).map((ev: any) => {
                  const dt = new Date(ev.starts_at)
                  const typeColors: Record<string, string> = { meeting: 'var(--blue)', capture_external: 'var(--warn)', capture_studio: '#F97316', delivery: 'var(--ok)', internal: 'var(--t3)', commercial: 'var(--purple)' }
                  const c = typeColors[ev.type] || 'var(--blue)'
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderBottom: '0.5px solid #141414', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)', minWidth: '40px' }}>
                        {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ width: '3px', background: c, borderRadius: '2px', minHeight: '36px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#CCC' }}>{ev.title}</div>
                        <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{ev.client?.name || 'Interno'}</div>
                        {ev.location && <div style={{ fontSize: '10px', color: 'var(--blue)', marginTop: '2px' }}>{ev.location}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
