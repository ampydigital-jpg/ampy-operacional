import { createClient } from '@/lib/supabase/server'

export default async function MinhaSemanaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const [{ data: myDemands }, { data: myEvents }] = await Promise.all([
    supabase.from('work_items').select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg)').eq('responsible_id', user?.id || '').not('status', 'in', '(done,cancelled,archived)').order('final_deadline', { ascending: true }).limit(50),
    supabase.from('calendar_events').select('*, client:clients(name)').eq('responsible_id', user?.id || '').gte('starts_at', monday.toISOString()).lte('starts_at', friday.toISOString()).order('starts_at'),
  ])

  const days = ['Seg','Ter','Qua','Qui','Sex']
  const today = now.getDay() === 0 ? 7 : now.getDay()

  const demandsByDay: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  myDemands?.forEach(d => {
    if (d.final_deadline) {
      const day = new Date(d.final_deadline + 'T00:00:00').getDay()
      const adjustedDay = day === 0 ? 7 : day
      if (adjustedDay >= 1 && adjustedDay <= 5) demandsByDay[adjustedDay].push(d)
    }
  })

  const todayDemands = myDemands?.filter(d => {
    if (!d.final_deadline) return false
    const dl = new Date(d.final_deadline + 'T00:00:00')
    return dl.toDateString() === now.toDateString()
  }) || []

  const typeColor: Record<string, string> = { Planejamento: '#26C6DA', Captação: 'var(--amber)', Edição: '#FF7043', Design: 'var(--purple)', 'Org. Feed': '#66BB6A', Programação: 'var(--blue)', Tráfego: 'var(--blue)', Relatório: 'var(--t3)', Interno: 'var(--t3)' }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Minha semana</div>
        <div className="tb-sub">{monday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {friday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Minhas demandas</div><div className="metric-val">{myDemands?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--blue)' }} />Abertas</div></div>
          <div className="metric"><div className="metric-lbl">Hoje</div><div className="metric-val">{todayDemands.length}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--amber)' }} />Com prazo hoje</div></div>
          <div className="metric"><div className="metric-lbl">Eventos</div><div className="metric-val">{myEvents?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Esta semana</div></div>
          <div className="metric"><div className="metric-lbl">Atrasadas</div><div className="metric-val" style={{ color: (myDemands?.filter(d => d.final_deadline && d.final_deadline < now.toISOString().split('T')[0]).length ?? 0) > 0 ? 'var(--red)' : 'var(--w)' }}>{myDemands?.filter(d => d.final_deadline && d.final_deadline < now.toISOString().split('T')[0]).length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--red)' }} />Com atraso</div></div>
        </div>

        <div className="sh"><div className="stitle">Visão da semana</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {days.map((day, i) => {
            const dayNum = i + 1
            const date = new Date(monday)
            date.setDate(monday.getDate() + i)
            const isToday = dayNum === today
            const dayItems = demandsByDay[dayNum] || []
            return (
              <div key={day} style={{ background: 'var(--s1)', border: `0.5px solid ${isToday ? 'var(--b2)' : 'var(--b1)'}`, borderRadius: 'var(--rc)', overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', borderBottom: '0.5px solid #161616', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: isToday ? 'var(--t2)' : 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1px' }}>{day}</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: isToday ? 'var(--w)' : 'var(--t4)', lineHeight: 1 }}>{date.getDate()}</div>
                  </div>
                  <div style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'var(--s2)', color: 'var(--t4)' }}>{dayItems.length}</div>
                </div>
                <div style={{ padding: '7px' }}>
                  {dayItems.length === 0 ? <div style={{ fontSize: '10px', color: 'var(--t4)', textAlign: 'center', padding: '8px 0' }}>—</div> : dayItems.slice(0, 3).map(d => (
                    <div key={d.id} style={{ padding: '6px 8px', borderRadius: '6px', background: 'var(--s2)', marginBottom: '4px', borderLeft: `2px solid ${typeColor[d.type] || 'var(--t3)'}` }}>
                      <div style={{ fontSize: '10px', fontWeight: 500, color: '#CCC', lineHeight: 1.3 }}>{d.title}</div>
                      <div style={{ fontSize: '9px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'}</div>
                    </div>
                  ))}
                  {dayItems.length > 3 && <div style={{ fontSize: '9px', color: 'var(--t4)', textAlign: 'center' }}>+{dayItems.length - 3} mais</div>}
                </div>
              </div>
            )
          })}
        </div>

        {myEvents && myEvents.length > 0 && (
          <>
            <div className="sh"><div className="stitle">Minha agenda da semana</div></div>
            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', overflow: 'hidden' }}>
              {myEvents.map((ev: any) => {
                const dt = new Date(ev.starts_at)
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderBottom: '0.5px solid #141414' }}>
                    <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--t4)', minWidth: '40px' }}>{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ width: '3px', borderRadius: '2px', minHeight: '30px', background: ev.type === 'capture' ? 'var(--amber)' : ev.type === 'meeting' ? 'var(--blue)' : 'var(--t3)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#CCC' }}>{ev.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} · {ev.client?.name || 'Interno'}</div>
                      {ev.location && <div style={{ fontSize: '10px', color: 'var(--blue)', marginTop: '2px' }}>{ev.location}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
