import { createClient } from '@/lib/supabase/server'

export default async function SemanaEquipePage() {
  const supabase = createClient()
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
  monday.setHours(0,0,0,0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23,59,59,999)

  const [{ data: profiles }, { data: allDemands }, { data: allEvents }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_initials, avatar_color, avatar_bg').eq('is_active', true).order('full_name'),
    supabase.from('work_items').select('*, client:clients(name), responsible:profiles(id, full_name, avatar_initials)').not('status', 'in', '(done,cancelled,archived)').gte('final_deadline', monday.toISOString().split('T')[0]).lte('final_deadline', friday.toISOString().split('T')[0]),
    supabase.from('calendar_events').select('*, client:clients(name), responsible:profiles(id, full_name)').gte('starts_at', monday.toISOString()).lte('starts_at', friday.toISOString()).order('starts_at'),
  ])

  const days = ['Seg','Ter','Qua','Qui','Sex']
  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
  const today = new Date()

  const typeColor: Record<string, string> = {
    Planejamento:'#06B6D4', Captação:'#F59E0B', Edição:'#F97316', Design:'#8B5CF6',
    'Org. Feed':'#10B981', Programação:'#3B82F6', Tráfego:'#3B82F6', Interno:'#555'
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Semana da equipe</div>
        <div className="tb-sub">{monday.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })} — {friday.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Membros</div><div className="metric-val">{profiles?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--ok)' }} />Ativos</div></div>
          <div className="metric"><div className="metric-lbl">Demandas semana</div><div className="metric-val">{allDemands?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--warn)' }} />Com prazo esta semana</div></div>
          <div className="metric"><div className="metric-lbl">Eventos semana</div><div className="metric-val">{allEvents?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--blue)' }} />Agendados</div></div>
          <div className="metric"><div className="metric-lbl">Urgentes</div><div className="metric-val" style={{ color: (allDemands?.filter(d => d.priority === 'urgent').length ?? 0) > 0 ? 'var(--err)' : 'var(--w)' }}>{allDemands?.filter(d => d.priority === 'urgent').length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--err)' }} />Esta semana</div></div>
        </div>

        {/* Visão por pessoa */}
        {profiles?.map((p: any) => {
          const personDemands = allDemands?.filter(d => d.responsible?.id === p.id) || []
          const personEvents = allEvents?.filter(e => e.responsible?.id === p.id) || []
          if (personDemands.length === 0 && personEvents.length === 0) return null
          return (
            <div key={p.id} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: p.avatar_bg || 'var(--s2)', color: p.avatar_color || 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>{p.avatar_initials}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--w)' }}>{p.full_name}</div>
                <div style={{ fontSize: '10px', color: 'var(--t4)' }}>{personDemands.length} demanda(s) · {personEvents.length} evento(s)</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
                {dates.map((date, di) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const isToday = date.toDateString() === today.toDateString()
                  const dayDemands = personDemands.filter(d => d.final_deadline === dateStr)
                  const dayEvents = personEvents.filter(e => e.starts_at.startsWith(dateStr))
                  return (
                    <div key={di} style={{ background: 'var(--s1)', border: `0.5px solid ${isToday ? 'var(--b3)' : 'var(--b1)'}`, borderRadius: 'var(--rc)', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', fontWeight: 600, color: isToday ? 'var(--t2)' : 'var(--t4)', textTransform: 'uppercase' }}>{days[di]}</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: isToday ? 'var(--w)' : 'var(--t4)' }}>{date.getDate()}</span>
                      </div>
                      <div style={{ padding: '6px' }}>
                        {dayDemands.map(d => (
                          <div key={d.id} style={{ padding: '5px 7px', borderRadius: '6px', background: 'var(--s2)', marginBottom: '4px', borderLeft: `2px solid ${typeColor[d.type] || 'var(--t3)'}` }}>
                            <div style={{ fontSize: '9px', fontWeight: 600, color: '#CCC', lineHeight: 1.3 }}>{d.title.length > 30 ? d.title.slice(0,30)+'…' : d.title}</div>
                            <div style={{ fontSize: '8px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'}</div>
                          </div>
                        ))}
                        {dayEvents.map(ev => (
                          <div key={ev.id} style={{ padding: '5px 7px', borderRadius: '6px', background: 'var(--blue-bg)', marginBottom: '4px', borderLeft: '2px solid var(--blue)' }}>
                            <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--blue)', lineHeight: 1.3 }}>
                              {new Date(ev.starts_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })} {ev.title.length > 20 ? ev.title.slice(0,20)+'…' : ev.title}
                            </div>
                          </div>
                        ))}
                        {dayDemands.length === 0 && dayEvents.length === 0 && (
                          <div style={{ fontSize: '9px', color: 'var(--t4)', textAlign: 'center', padding: '8px 0' }}>—</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {allDemands?.length === 0 && allEvents?.length === 0 && (
          <div className="empty"><i className="ti ti-calendar-week" /><div className="empty-title">Semana sem demandas</div><div className="empty-sub">Nenhuma demanda ou evento com prazo esta semana.</div></div>
        )}
      </div>
    </div>
  )
}
