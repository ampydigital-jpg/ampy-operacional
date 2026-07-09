import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { ampyDayStart, dateKeyInAmpyTimezone } from '@/lib/date'
import { addDays, countBy, formatDateShort, getDemandDate, isDone, isLate, isOpen, startOfWeek, statusName, summarizeItems, typeName, ymd } from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SemanaPage({ searchParams }: { searchParams?: { start?: string } }) {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const anchor = searchParams?.start ? new Date(`${searchParams.start}T12:00:00`) : new Date(`${todayKey}T12:00:00`)
  const start = startOfWeek(anchor)
  const end = addDays(start, 7)
  const startKey = ymd(start)
  const endKey = ymd(end)

  const [{ data: demandsRaw }, { data: eventsRaw }] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,type,status,priority,destino,client_id,responsible_id,internal_deadline,final_deadline,created_at,updated_at,closed_at,client:clients(name),responsible:profiles(full_name)')
      .not('status', 'in', '(archived,cancelled)')
      .limit(1000),
    supabase
      .from('calendar_events')
      .select('id,title,type,starts_at,ends_at,all_day,client:clients(name),responsible:profiles(full_name),work_item:work_items(id,title)')
      .gte('starts_at', ampyDayStart(startKey))
      .lt('starts_at', ampyDayStart(endKey))
      .order('starts_at')
      .limit(500),
  ])

  const demands = demandsRaw || []
  const events = eventsRaw || []
  const open = demands.filter(isOpen)
  const weekDemands = demands.filter((item: any) => {
    const dates = [item.internal_deadline, item.final_deadline].filter(Boolean)
    return dates.some((date) => date >= startKey && date < endKey)
  })
  const weekOpen = weekDemands.filter(isOpen)
  const weekDone = weekDemands.filter(isDone)
  const late = open.filter((item: any) => isLate(item, todayKey))
  const priority = weekOpen.filter((item: any) => ['urgent', 'high'].includes(String(item.priority)))

  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const trend = days.map((day) => {
    const key = ymd(day)
    return {
      dia: formatDateShort(key),
      demandas: weekDemands.filter((item: any) => item.internal_deadline === key || item.final_deadline === key).length,
      eventos: events.filter((event: any) => String(event.starts_at || '').slice(0, 10) === key).length,
      entregas: weekDemands.filter((item: any) => isDone(item) && (item.internal_deadline === key || item.final_deadline === key)).length,
    }
  })

  const statusData = countBy(weekDemands, (item: any) => statusName(item.status))
  const responsibleData = countBy(weekOpen, (item: any) => item.responsible?.full_name || 'Sem responsável').slice(0, 8)
  const sectorData = countBy(weekDemands, (item: any) => typeName(item.type)).slice(0, 6)
  const deliveryPct = weekDemands.length ? Math.round((weekDone.length / weekDemands.length) * 100) : 0

  return (
    <DashboardCharts
      eyebrow="Dashboard semanal"
      title="Semana"
      periodLabel={`${formatDateShort(startKey)} – ${formatDateShort(ymd(addDays(end, -1)))}`}
      description="Leitura gráfica das demandas e eventos distribuídos no intervalo semanal."
      metrics={[
        { label: 'Demandas semana', value: weekDemands.length, hint: 'prazo no intervalo', tone: 'blue', icon: 'ti-calendar-week' },
        { label: 'Entregas', value: weekDone.length, hint: 'previstas/concluídas', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Atrasos', value: late.length, hint: 'abertos acumulados', tone: late.length ? 'red' : 'green', icon: 'ti-alert-triangle' },
        { label: 'Eventos', value: events.length, hint: 'agenda da semana', tone: 'blue', icon: 'ti-calendar-event' },
        { label: 'Prioridades', value: priority.length, hint: 'alta ou urgente', tone: priority.length ? 'yellow' : 'neutral', icon: 'ti-flag' },
      ]}
      primaryChart={{
        title: 'Distribuição da semana',
        description: 'Demandas, eventos e entregas por dia.',
        type: 'bar',
        data: trend,
        xKey: 'dia',
        series: [
          { key: 'demandas', name: 'Demandas', color: '#2563EB' },
          { key: 'eventos', name: 'Eventos', color: '#EAB308' },
          { key: 'entregas', name: 'Entregas', color: '#16A34A' },
        ],
        height: 280,
      }}
      progress={{ title: 'Progresso semanal', description: 'Conclusão das demandas previstas na semana.', value: deliveryPct, done: weekDone.length, total: weekDemands.length, remainingLabel: `${Math.max(0, weekDemands.length - weekDone.length)} demanda(s) ainda abertas na semana` }}
      donut={{ title: 'Status da semana', description: 'Composição das demandas do intervalo.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: weekDemands.length, centerLabel: 'demandas' }}
      bars={{ title: 'Carga por responsável', description: 'Demandas abertas na semana.', data: responsibleData, labelKey: 'name', valueKey: 'value' }}
      secondaryChart={{ title: 'Demandas por setor', description: 'Tipos de atividades previstas.', type: 'bar', data: sectorData, xKey: 'name', series: [{ key: 'value', name: 'Demandas', color: '#DC2626' }], height: 220 }}
      summaries={[
        { title: 'Resumo da semana', subtitle: 'Demandas abertas mais relevantes', items: summarizeItems(weekOpen.sort((a: any, b: any) => String(getDemandDate(a) || '').localeCompare(String(getDemandDate(b) || ''))), 6) },
        { title: 'Agenda da semana', subtitle: 'Primeiros eventos do período', items: events.slice(0, 6).map((event: any) => ({ label: event.title, value: formatDateShort(String(event.starts_at || '').slice(0, 10)), meta: `${event.client?.name || 'Interno Ampy'} · ${event.responsible?.full_name || 'sem responsável'}`, tone: 'blue' })) },
      ]}
    />
  )
}
