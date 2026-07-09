import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { addDateKeyDays, ampyDayStart, dateKeyInAmpyTimezone } from '@/lib/date'

const CLOSED = ['done', 'cancelled', 'archived']
const today = () => dateKeyInAmpyTimezone()
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtDate = (date?: string | null) => date ? new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR') : 'sem prazo'
const isOpen = (item: any) => !CLOSED.includes(item.status)
const relevantDate = (item: any) => item.final_deadline || item.internal_deadline || ''

function uniqueById(items: any[]) {
  const map = new Map<string, any>()
  items.forEach((item) => item?.id && map.set(item.id, item))
  return Array.from(map.values())
}

export default async function MeuDiaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const date = today()
  const tomorrow = addDateKeyDays(date, 1)

  const [{ data: demandsRaw }, { data: events }, { data: steps }, { data: profile }] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,type,status,priority,client_id,responsible_id,internal_deadline,final_deadline,client:clients(name),responsible:profiles(full_name,avatar_initials)')
      .not('status', 'in', '(done,cancelled,archived)')
      .limit(500),
    supabase
      .from('calendar_events')
      .select('id,title,type,starts_at,ends_at,all_day,client:clients(name),work_item:work_items(id,title),responsible:profiles(full_name)')
      .gte('starts_at', ampyDayStart(date))
      .lt('starts_at', ampyDayStart(tomorrow))
      .order('starts_at'),
    supabase
      .from('project_steps')
      .select('id,title,start_date,end_date,status,responsible_id,work_item:work_items(id,title,client:clients(name))')
      .or(`start_date.eq.${date},end_date.eq.${date}`)
      .neq('status', 'done')
      .order('position'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const canSeeAll = ['admin', 'gestor'].includes(String(profile?.role || ''))
  const baseDemands = (demandsRaw || []).filter((item: any) => canSeeAll || item.responsible_id === user.id)
  const dueToday = baseDemands.filter((item: any) => isOpen(item) && (item.final_deadline === date || item.internal_deadline === date))
  const late = baseDemands.filter((item: any) => isOpen(item) && relevantDate(item) && relevantDate(item) < date)
  const urgent = baseDemands.filter((item: any) => isOpen(item) && item.priority === 'urgent')
  const priorityList = uniqueById([
    ...late.map((item: any) => ({ ...item, kind: 'Atrasada' })),
    ...dueToday.map((item: any) => ({ ...item, kind: 'Hoje' })),
    ...urgent.map((item: any) => ({ ...item, kind: 'Urgente' })),
  ]).sort((a, b) => relevantDate(a).localeCompare(relevantDate(b)) || ({ urgent: 0, high: 1, normal: 2, low: 3 } as any)[a.priority] - ({ urgent: 0, high: 1, normal: 2, low: 3 } as any)[b.priority])

  const visibleEvents = (events || []).filter((event: any) => canSeeAll || event.responsible_id === user.id)
  const visibleSteps = (steps || []).filter((step: any) => canSeeAll || step.responsible_id === user.id)

  return <div className="page-wrap ops-page today-page">
    <div className="topbar">
      <div className="tb-title">Meu dia</div>
      <div className="tb-sub">{dateLabel(date)}</div>
      <Link className="bsec" href={`/dashboard/demandas?due=today&sort=priority_desc`}>Ver demandas de hoje</Link>
    </div>
    <div className="pad" style={{ overflowY: 'auto', flex: 1 }}>
      <div className="metrics ops-metrics">
        <Metric label="Vencem hoje" value={dueToday.length} hint="Prazo interno ou final" color="var(--warn)" />
        <Metric label="Atrasadas" value={late.length} hint="Abertas e fora do prazo" color="var(--err)" />
        <Metric label="Urgentes" value={urgent.length} hint="Prioridade máxima" color="var(--err)" />
        <Metric label="Eventos" value={visibleEvents.length} hint="Agenda de hoje" color="var(--blue)" />
      </div>

      <div className="today-grid">
        <Section title="Prioridades e prazos" count={priorityList.length}>
          {priorityList.map((item: any) => <Link className="work-link" href={`/dashboard/demandas/${item.id}`} key={`${item.kind}-${item.id}`}>
            <span className={`work-kind ${item.kind === 'Atrasada' ? 'late' : item.kind === 'Urgente' ? 'urgent' : ''}`}>{item.kind}</span>
            <div><b>{item.title}</b><small>{item.client?.name || 'Interno Ampy'} · prazo {fmtDate(relevantDate(item))} · {item.responsible?.full_name || 'sem responsável'}</small></div>
          </Link>)}
        </Section>

        <Section title="Etapas do cronograma" count={visibleSteps.length}>
          {visibleSteps.map((step: any) => <Link className="work-link" href={`/dashboard/demandas/${step.work_item?.id}`} key={step.id}>
            <span className="work-kind">Etapa</span>
            <div><b>{step.title}</b><small>{step.work_item?.title} · {step.work_item?.client?.name || 'Interno Ampy'}</small></div>
          </Link>)}
        </Section>

        <Section title="Agenda de hoje" count={visibleEvents.length}>
          {visibleEvents.map((event: any) => <div className="work-link" key={event.id}>
            <span className="work-kind">{event.all_day ? 'Dia todo' : new Date(event.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <div><b>{event.title}</b><small>{event.client?.name || 'Interno Ampy'}{event.work_item?.title ? ` · ${event.work_item.title}` : ''}</small></div>
          </div>)}
        </Section>
      </div>
    </div>
  </div>
}

function Metric({ label, value, hint, color }: { label: string; value: number; hint: string; color: string }) {
  return <div className="metric"><div className="metric-lbl">{label}</div><div className="metric-val" style={{ color: value ? color : 'var(--w)' }}>{value}</div><div className="metric-inf"><span className="dot" style={{ background: color }} />{hint}</div></div>
}
function Section({ title, count, children }: { title: string; count: number; children: any }) {
  return <section className="today-section"><div className="sh"><div className="stitle">{title}</div><div className="ssub">{count} itens</div></div><div className="today-stack">{count ? children : <div className="empty-inline">Nenhum item.</div>}</div></section>
}
