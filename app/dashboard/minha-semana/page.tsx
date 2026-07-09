import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ampyDayStart, dateKeyInAmpyTimezone } from '@/lib/date'

function monday(date: Date) { const d = new Date(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(12, 0, 0, 0); return d }
function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function ymd(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
const eventDateKey = (value: string) => dateKeyInAmpyTimezone(value)
const CLOSED = ['done', 'cancelled', 'archived']
const isOpen = (item: any) => !CLOSED.includes(item.status)
const relevantDates = (item: any) => [item.internal_deadline, item.final_deadline].filter(Boolean)

export default async function MinhaSemanaPage({ searchParams }: { searchParams: { start?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const anchor = searchParams.start ? new Date(`${searchParams.start}T12:00:00`) : new Date()
  const start = monday(anchor)
  const end = addDays(start, 7)
  const startKey = ymd(start)
  const endKey = ymd(end)
  const todayKey = ymd(new Date())

  const [{ data: demandsRaw }, { data: events }, { data: profile }] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,type,status,priority,client_id,responsible_id,internal_deadline,final_deadline,client:clients(name),responsible:profiles(full_name)')
      .not('status', 'in', '(done,cancelled,archived)')
      .limit(500),
    supabase
      .from('calendar_events')
      .select('id,title,type,starts_at,ends_at,all_day,responsible_id,client:clients(name),work_item:work_items(id,title)')
      .gte('starts_at', ampyDayStart(startKey))
      .lt('starts_at', ampyDayStart(endKey))
      .order('starts_at'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const canSeeAll = ['admin', 'gestor'].includes(String(profile?.role || ''))
  const demands = (demandsRaw || []).filter((item: any) => (canSeeAll || item.responsible_id === user.id) && isOpen(item))
  const visibleEvents = (events || []).filter((event: any) => canSeeAll || event.responsible_id === user.id)
  const lateOpen = demands.filter((item: any) => relevantDates(item).some((date) => date < todayKey))
  const weekDemands = demands.filter((item: any) => relevantDates(item).some((date) => date >= startKey && date < endKey))

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const nav = (n: number) => `/dashboard/minha-semana?start=${ymd(addDays(start, n * 7))}`

  return <div className="page-wrap ops-page week-page">
    <div className="topbar">
      <div className="tb-title">Minha semana</div>
      <div className="tb-sub">{start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {addDays(end, -1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <Link className="bsec" href="/dashboard/demandas?due=next7&sort=deadline_asc">Ver demandas da semana</Link>
      <Link className="bico" href={nav(-1)}><i className="ti ti-chevron-left" /></Link>
      <Link className="bico" href={nav(1)}><i className="ti ti-chevron-right" /></Link>
    </div>

    <div className="pad" style={{ overflowY: 'auto', flex: 1 }}>
      <div className="week-summary">
        <div><b>{weekDemands.length}</b><span>Demandas na semana</span></div>
        <div><b>{visibleEvents.length}</b><span>Eventos</span></div>
        <div><b>{lateOpen.length}</b><span>Atrasadas abertas</span></div>
      </div>

      {lateOpen.length > 0 && <section className="week-alert"><div className="sh"><div className="stitle">Atrasadas abertas</div><div className="ssub">{lateOpen.length} itens</div></div><div className="today-stack">{lateOpen.slice(0, 8).map((item: any) => <Link className="work-link" href={`/dashboard/demandas/${item.id}`} key={item.id}><span className="work-kind late">Atrasada</span><div><b>{item.title}</b><small>{item.client?.name || 'Interno Ampy'} · {item.responsible?.full_name || 'sem responsável'}</small></div></Link>)}</div></section>}

      <div className="week-grid">
        {days.map((day) => {
          const key = ymd(day)
          const dayDemands = weekDemands.filter((item: any) => relevantDates(item).includes(key))
          const dayEvents = visibleEvents.filter((item: any) => eventDateKey(item.starts_at) === key)
          const isToday = key === todayKey
          return <section className={`week-day ${isToday ? 'today' : ''}`} key={key}>
            <header><b>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</b><span>{day.getDate()}</span></header>
            {dayEvents.map((event: any) => <div className="week-event" key={event.id}><small>{event.all_day ? 'Dia todo' : new Date(event.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small><b>{event.title}</b><span>{event.client?.name || 'Interno Ampy'}</span></div>)}
            {dayDemands.sort((a: any, b: any) => ({ urgent: 0, high: 1, normal: 2, low: 3 } as any)[a.priority] - ({ urgent: 0, high: 1, normal: 2, low: 3 } as any)[b.priority]).map((item: any) => <Link className={`week-demand priority-${item.priority}`} href={`/dashboard/demandas/${item.id}`} key={item.id}><b>{item.title}</b><span>{item.client?.name || 'Interno Ampy'} · {item.final_deadline === key ? 'prazo final' : 'prazo interno'}</span></Link>)}
            {!dayEvents.length && !dayDemands.length && <div className="range-empty">Sem itens</div>}
          </section>
        })}
      </div>
    </div>
  </div>
}
