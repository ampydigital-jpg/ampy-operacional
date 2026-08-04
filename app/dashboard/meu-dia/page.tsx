import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { addDateKeyDays, dateKeyInAmpyTimezone } from '@/lib/date'
import {
  assignmentCompletionDateKey,
  countBy,
  completionDateKey,
  eventCompletionDateKey,
  formatDateLong,
  isLate,
  isOpen,
  loadOperationData,
  statusName,
  summarizeEvents,
  summarizeItems,
} from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DiaPage() {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const tomorrowKey = addDateKeyDays(todayKey, 1)
  const source = await loadOperationData(supabase, { eventStartKey: todayKey, eventEndKey: tomorrowKey })
  const demands = source.demands.filter((item: any) =>
    !item.is_pauta_card && !['archived', 'cancelled'].includes(String(item.status)),
  )
  const events = source.events
  const open = demands.filter(isOpen)
  const dueToday = open.filter((item: any) => item.final_deadline === todayKey)
  const late = open.filter((item: any) => isLate(item, todayKey))
  const urgent = open.filter((item: any) => ['urgent', 'high'].includes(String(item.priority)))
  const doneToday = demands.filter((item: any) => completionDateKey(item) === todayKey)
  const eventsDoneToday = events.filter((event: any) => eventCompletionDateKey(event) === todayKey)
  const assignmentsDoneToday = source.assignments.filter((assignment: any) => assignmentCompletionDateKey(assignment) === todayKey)
  const statusData = countBy([...dueToday, ...late, ...urgent], (item: any) => statusName(item.status)).slice(0, 6)
  const sectorData = countBy(
    assignmentsDoneToday.length ? assignmentsDoneToday : source.assignments,
    (assignment: any) => assignment.board?.name || 'Quadro sem nome',
  ).slice(0, 6)
  const criticalQueue = [...late, ...urgent, ...dueToday]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)

  return (
    <DashboardCharts
      variant="day"
      eyebrow="Dashboard diário"
      title="Dia"
      periodLabel={formatDateLong(todayKey)}
      description="Demandas, etapas setoriais e agendas com conclusão registrada no dia real."
      metrics={[
        { label: 'Demandas do dia', value: dueToday.length, hint: 'prazo final hoje', tone: 'blue', icon: 'ti-calendar-check' },
        { label: 'Agendas do dia', value: events.length, hint: `${eventsDoneToday.length} concluída(s)`, tone: eventsDoneToday.length ? 'green' : 'blue', icon: 'ti-calendar-event' },
        { label: 'Atrasos', value: late.length, hint: 'ainda abertos', tone: 'red', icon: 'ti-alert-triangle' },
        { label: 'Etapas concluídas', value: assignmentsDoneToday.length, hint: 'nos Quadros hoje', tone: 'green', icon: 'ti-layout-kanban' },
        { label: 'Demandas concluídas', value: doneToday.length, hint: 'conclusão real hoje', tone: 'green', icon: 'ti-circle-check' },
      ]}
      donut={{ title: 'Status do dia', description: 'Demandas de hoje, atrasos e prioridades.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: dueToday.length + late.length + urgent.length, centerLabel: 'itens' }}
      secondaryDonut={{ title: 'Execução por setor', description: 'Etapas concluídas hoje ou carga ativa por Quadro.', data: sectorData, nameKey: 'name', valueKey: 'value', centerValue: sectorData.reduce((sum, item) => sum + item.value, 0), centerLabel: 'etapas' }}
      featured={[
        { title: 'Fila crítica', subtitle: 'Atrasos, prioridades e demandas do dia.', items: summarizeItems(criticalQueue, 6) },
        { title: 'Agenda do dia', subtitle: `${eventsDoneToday.length}/${events.length} concluída(s)`, items: summarizeEvents(events, 6) },
      ]}
      summaries={[
        { title: 'Demandas do dia', subtitle: 'Prazo final para hoje.', items: summarizeItems(dueToday, 6) },
        { title: 'Atrasadas', subtitle: 'Demandas abertas fora do prazo.', items: summarizeItems(late, 6) },
        { title: 'Concluídas hoje', subtitle: 'Registradas com data e responsável.', items: summarizeItems(doneToday, 6) },
        { title: 'Agendas concluídas', subtitle: 'Realizadas hoje.', items: summarizeEvents(eventsDoneToday, 6) },
      ]}
    />
  )
}
