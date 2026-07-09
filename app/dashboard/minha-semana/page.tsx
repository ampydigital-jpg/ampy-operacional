import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { dateKeyInAmpyTimezone } from '@/lib/date'
import { addDays, countBy, demandTouchesRange, formatDateShort, getDemandDate, isDone, isLate, isOpen, loadOperationData, startOfWeek, statusName, summarizeEvents, summarizeItems, typeName, ymd } from '../dashboard-data'

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
      demandas: weekDemands.filter((item: any) => item.internal_deadline === key || item.final_deadline === key || String(item.created_at || '').slice(0, 10) === key).length,
      eventos: events.filter((event: any) => String(event.starts_at || '').slice(0, 10) === key).length,
      entregas: weekDemands.filter((item: any) => isDone(item) && (item.internal_deadline === key || item.final_deadline === key || String(item.closed_at || item.updated_at || '').slice(0, 10) === key)).length,
    }
  })

  const statusData = countBy(weekDemands, (item: any) => statusName(item.status))
  const responsibleData = countBy(weekOpen, (item: any) => item.responsible?.full_name || 'Sem responsável').slice(0, 8)
  const sectorData = countBy(weekDemands, (item: any) => typeName(item.type)).slice(0, 6)
  const deliveryPct = weekDemands.length ? Math.round((weekDone.length / weekDemands.length) * 100) : 0
  const weekQueue = weekOpen.sort((a: any, b: any) => String(getDemandDate(a) || '').localeCompare(String(getDemandDate(b) || '')))

  return (
    <DashboardCharts
      variant="week"
      eyebrow="Dashboard semanal"
      title="Semana"
      periodLabel={`${formatDateShort(startKey)} – ${formatDateShort(ymd(addDays(end, -1)))}`}
      description="Leitura gráfica das demandas e eventos distribuídos no intervalo semanal."
      metrics={[
        { label: 'Demandas semana', value: weekDemands.length, hint: 'prazo ou criação no intervalo', tone: 'blue', icon: 'ti-calendar-week' },
        { label: 'Entregas', value: weekDone.length, hint: 'concluídas/entregues', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Atrasos', value: late.length, hint: 'abertos acumulados', tone: late.length ? 'red' : 'green', icon: 'ti-alert-triangle' },
        { label: 'Eventos', value: events.length, hint: 'agenda da semana', tone: 'blue', icon: 'ti-calendar-event' },
        { label: 'Prioridades', value: priority.length, hint: 'alta ou urgente', tone: priority.length ? 'yellow' : 'neutral', icon: 'ti-flag' },
      ]}
      progress={{ title: 'Progresso semanal', description: 'Conclusão das demandas previstas na semana.', value: deliveryPct, done: weekDone.length, total: weekDemands.length, remainingLabel: `${Math.max(0, weekDemands.length - weekDone.length)} demanda(s) ainda abertas na semana` }}
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
        height: 250,
        span: 2,
      }}
      donut={{ title: 'Status da semana', description: 'Composição das demandas do intervalo.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: weekDemands.length, centerLabel: 'demandas' }}
      bars={{ title: 'Carga por responsável', description: 'Demandas abertas na semana.', data: responsibleData, labelKey: 'name', valueKey: 'value' }}
      secondaryChart={{ title: 'Demandas por setor', description: 'Tipos de atividades previstas.', type: 'bar', data: sectorData, xKey: 'name', series: [{ key: 'value', name: 'Demandas', color: '#DC2626' }], height: 200 }}
      summaries={[
        { title: 'Resumo da semana', subtitle: 'Demandas abertas mais relevantes', items: summarizeItems(weekQueue, 6) },
        { title: 'Agenda da semana', subtitle: 'Primeiros eventos do período', items: summarizeEvents(events, 6) },
      ]}
    />
  )
}
