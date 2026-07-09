import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { addDateKeyDays, dateKeyInAmpyTimezone } from '@/lib/date'
import { countBy, formatDateLong, getDemandDate, isDone, isLate, isOpen, loadOperationData, statusName, summarizeEvents, summarizeItems, typeName } from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DiaPage() {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const tomorrowKey = addDateKeyDays(todayKey, 1)

  const source = await loadOperationData(supabase, { eventStartKey: todayKey, eventEndKey: tomorrowKey })
  const demands = source.demands.filter((item: any) => !['archived', 'cancelled'].includes(String(item.status)))
  const events = source.events
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
      demandas: dueToday.filter((item: any) => String(getDemandDate(item) || '') === todayKey).length,
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
      variant="day"
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
        series: [
          { key: 'eventos', name: 'Eventos', color: '#2563EB' },
          { key: 'demandas', name: 'Demandas', color: '#EAB308' },
        ],
        height: 250,
        span: 2,
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
        height: 200,
      }}
      summaries={[
        { title: 'Fila crítica', subtitle: 'Atrasos, entregas do dia e prioridades', items: summarizeItems(priorityQueue, 6) },
        { title: 'Agenda do dia', subtitle: 'Eventos ordenados por horário', items: summarizeEvents(events, 6) },
      ]}
    />
  )
}
