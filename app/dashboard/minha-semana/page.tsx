import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { dateKeyInAmpyTimezone } from '@/lib/date'
import { addDays, countBy, demandTouchesRange, formatDateShort, getDemandDate, isDone, isLate, isOpen, loadOperationData, priorityWeight, startOfWeek, statusName, summarizeEvents, summarizeItems, typeName, ymd } from '../dashboard-data'

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

  const source = await loadOperationData(supabase, { eventStartKey: startKey, eventEndKey: endKey })
  const demands = source.demands.filter((item: any) => !['archived', 'cancelled'].includes(String(item.status)))
  const events = source.events
  const open = demands.filter(isOpen)
  const weekDemands = demands.filter((item: any) => demandTouchesRange(item, startKey, endKey))
  const weekOpen = weekDemands.filter(isOpen)
  const weekDone = weekDemands.filter(isDone)
  const late = open.filter((item: any) => isLate(item, todayKey))
  const priority = weekOpen.filter((item: any) => ['urgent', 'high'].includes(String(item.priority)))

  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const trend = days.map((day) => {
    const key = ymd(day)
    return {
      dia: formatDateShort(key),
      demandas: weekDemands.filter((item: any) => item.final_deadline === key).length,
      eventos: events.filter((event: any) => String(event.starts_at || '').slice(0, 10) === key).length,
      entregas: weekDemands.filter((item: any) => isDone(item) && (item.final_deadline === key)).length,
    }
  })

  const statusData = countBy(weekDemands, (item: any) => statusName(item.status))
  const responsibleData = countBy(weekOpen, (item: any) => item.responsible?.full_name || 'Sem responsável').slice(0, 8)
  const sectorData = countBy(weekDemands, (item: any) => typeName(item.type)).slice(0, 6)
  const deliveryPct = weekDemands.length ? Math.round((weekDone.length / weekDemands.length) * 100) : 0
  const weekQueue = [...weekOpen].sort((a: any, b: any) => {
    const dateCompare = String(getDemandDate(a) || '9999').localeCompare(String(getDemandDate(b) || '9999'))
    if (dateCompare !== 0) return dateCompare
    return priorityWeight(b.priority) - priorityWeight(a.priority)
  })
  const priorityQueue = [...priority, ...late]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .sort((a: any, b: any) => priorityWeight(b.priority) - priorityWeight(a.priority) || String(getDemandDate(a) || '9999').localeCompare(String(getDemandDate(b) || '9999')))

  return (
    <DashboardCharts
      variant="week"
      eyebrow="Dashboard semanal"
      title="Semana"
      periodLabel={`${formatDateShort(startKey)} – ${formatDateShort(ymd(addDays(end, -1)))}`}
      description="Leitura gráfica das demandas, prioridades e agendas distribuídas no intervalo semanal."
      metrics={[
        { label: 'Demandas semana', value: weekDemands.length, hint: 'prazo ou criação no intervalo', tone: 'blue', icon: 'ti-calendar-week' },
        { label: 'Entregas', value: weekDone.length, hint: 'concluídas/entregues', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Atrasos', value: late.length, hint: 'abertos acumulados', tone: 'red', icon: 'ti-alert-triangle' },
        { label: 'Agendas', value: events.length, hint: 'agenda da semana', tone: 'blue', icon: 'ti-calendar-event' },
        { label: 'Prioridades', value: priority.length, hint: 'alta ou urgente', tone: 'yellow', icon: 'ti-flag' },
      ]}
      progress={{ title: 'Progresso semanal', description: 'Conclusão das demandas previstas na semana.', value: deliveryPct, done: weekDone.length, total: weekDemands.length, remainingLabel: `${Math.max(0, weekDemands.length - weekDone.length)} demanda(s) ainda abertas na semana` }}
      featured={[
        { title: 'Resumo da semana', subtitle: 'Demandas abertas mais relevantes', items: summarizeItems(weekQueue, 6) },
        { title: 'Agenda da semana', subtitle: 'Agendas ordenadas por horário', items: summarizeEvents(events, 6) },
      ]}
      primaryChart={{
        title: 'Distribuição da semana',
        description: 'Demandas, agendas e entregas por dia.',
        type: 'bar',
        data: trend,
        xKey: 'dia',
        series: [
          { key: 'demandas', name: 'Demandas', color: '#2563EB' },
          { key: 'eventos', name: 'Agendas', color: '#2563EB' },
          { key: 'entregas', name: 'Entregas', color: '#16A34A' },
        ],
        height: 210,
        span: 2,
      }}
      bars={{ title: 'Carga por responsável', description: 'Demandas abertas na semana.', data: responsibleData, labelKey: 'name', valueKey: 'value' }}
      donut={{ title: 'Status da semana', description: 'Composição das demandas do intervalo.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: weekDemands.length, centerLabel: 'demandas' }}
      secondaryChart={{ title: 'Demandas por setor', description: 'Tipos de atividades previstas.', type: 'bar', data: sectorData, xKey: 'name', series: [{ key: 'value', name: 'Demandas', color: '#2563EB' }], height: 180 }}
      summaries={[
        { title: 'Prioridades da semana', subtitle: 'Atrasos e demandas de alta prioridade', items: summarizeItems(priorityQueue, 6) },
      ]}
    />
  )
}
