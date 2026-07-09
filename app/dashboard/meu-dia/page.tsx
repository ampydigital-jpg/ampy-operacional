import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { addDateKeyDays, ampyDayStart, dateKeyInAmpyTimezone } from '@/lib/date'
import { countBy, formatDateLong, formatDateShort, getDemandDate, isDone, isLate, isOpen, statusName, summarizeItems, typeName } from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DiaPage() {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const tomorrowKey = addDateKeyDays(todayKey, 1)

  const [{ data: demandsRaw }, { data: eventsRaw }, { data: stepsRaw }] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,type,status,priority,destino,client_id,responsible_id,internal_deadline,final_deadline,created_at,updated_at,closed_at,client:clients(name),responsible:profiles(full_name)')
      .not('status', 'in', '(archived,cancelled)')
      .limit(1000),
    supabase
      .from('calendar_events')
      .select('id,title,type,starts_at,ends_at,all_day,client:clients(name),responsible:profiles(full_name),work_item:work_items(id,title)')
      .gte('starts_at', ampyDayStart(todayKey))
      .lt('starts_at', ampyDayStart(tomorrowKey))
      .order('starts_at')
      .limit(300),
    supabase
      .from('project_steps')
      .select('id,title,start_date,end_date,status,work_item:work_items(id,title,client:clients(name)),responsible:profiles(full_name)')
      .or(`start_date.eq.${todayKey},end_date.eq.${todayKey}`)
      .neq('status', 'done')
      .order('position')
      .limit(200),
  ])

  const demands = demandsRaw || []
  const events = eventsRaw || []
  const steps = stepsRaw || []
  const open = demands.filter(isOpen)
  const dueToday = open.filter((item: any) => item.final_deadline === todayKey || item.internal_deadline === todayKey)
  const late = open.filter((item: any) => isLate(item, todayKey))
  const urgent = open.filter((item: any) => item.priority === 'urgent' || item.priority === 'high')
  const doneToday = demands.filter((item: any) => isDone(item) && String(item.closed_at || item.updated_at || '').slice(0, 10) === todayKey)

  const hourly = Array.from({ length: 12 }, (_, index) => {
    const hour = index + 8
    return {
      hora: `${String(hour).padStart(2, '0')}h`,
      eventos: events.filter((event: any) => Number(String(event.starts_at || '').slice(11, 13)) === hour).length,
    }
  })

  const statusData = countBy([...dueToday, ...late], (item: any) => statusName(item.status))
  const responsibleData = countBy(dueToday, (item: any) => item.responsible?.full_name || 'Sem responsável').slice(0, 7)
  const sectorData = countBy(dueToday, (item: any) => typeName(item.type)).slice(0, 6)
  const priorityQueue = [...late, ...dueToday, ...urgent]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .sort((a: any, b: any) => String(getDemandDate(a) || '').localeCompare(String(getDemandDate(b) || '')))

  return (
    <DashboardCharts
      eyebrow="Dashboard diário"
      title="Dia"
      periodLabel={formatDateLong(todayKey)}
      description="Representação visual das demandas, agenda e prioridades do dia."
      metrics={[
        { label: 'Demandas do dia', value: dueToday.length, hint: 'prazo interno/final', tone: 'blue', icon: 'ti-calendar-check' },
        { label: 'Eventos', value: events.length, hint: 'agenda de hoje', tone: 'green', icon: 'ti-calendar-event' },
        { label: 'Atrasadas', value: late.length, hint: 'ainda abertas', tone: late.length ? 'red' : 'green', icon: 'ti-alert-triangle' },
        { label: 'Prioridade', value: urgent.length, hint: 'alta ou urgente', tone: urgent.length ? 'yellow' : 'neutral', icon: 'ti-flag' },
        { label: 'Entregues hoje', value: doneToday.length, hint: 'concluídas no dia', tone: 'green', icon: 'ti-circle-check' },
      ]}
      primaryChart={{
        title: 'Agenda por horário',
        description: 'Eventos distribuídos ao longo do dia.',
        type: 'bar',
        data: hourly,
        xKey: 'hora',
        series: [{ key: 'eventos', name: 'Eventos', color: '#2563EB' }],
        height: 260,
      }}
      donut={{ title: 'Status do dia', description: 'Demandas do dia e atrasadas abertas.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: dueToday.length + late.length, centerLabel: 'itens' }}
      bars={{ title: 'Carga por responsável', description: 'Demandas com prazo hoje.', data: responsibleData, labelKey: 'name', valueKey: 'value' }}
      secondaryChart={{
        title: 'Setores do dia',
        description: 'Distribuição por tipo de demanda.',
        type: 'bar',
        data: sectorData,
        xKey: 'name',
        series: [{ key: 'value', name: 'Demandas', color: '#16A34A' }],
        height: 220,
      }}
      summaries={[
        { title: 'Fila crítica', subtitle: 'Atrasos, entregas do dia e prioridades', items: summarizeItems(priorityQueue, 6) },
        { title: 'Cronograma', subtitle: 'Etapas com início ou fim hoje', items: steps.slice(0, 6).map((step: any) => ({ label: step.title, value: step.end_date ? formatDateShort(step.end_date) : 'hoje', meta: `${step.work_item?.title || 'Demanda'} · ${step.responsible?.full_name || 'sem responsável'}`, tone: 'blue' })) },
      ]}
    />
  )
}
