import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { dateKeyInAmpyTimezone } from '@/lib/date'
import {
  addDays,
  assignmentCompletionDateKey,
  countBy,
  completionDateKey,
  demandTouchesRange,
  eventCompletionDateKey,
  formatDateShort,
  getDemandDate,
  isDone,
  isLate,
  isOpen,
  loadOperationData,
  priorityWeight,
  startOfWeek,
  statusName,
  summarizeEvents,
  summarizeItems,
  ymd,
} from '../dashboard-data'

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
  const demands = source.demands.filter((item: any) =>
    !item.is_pauta_card && !['archived', 'cancelled'].includes(String(item.status)),
  )
  const events = source.events
  const open = demands.filter(isOpen)
  const weekDemands = demands.filter((item: any) => demandTouchesRange(item, startKey, endKey))
  const weekOpen = weekDemands.filter(isOpen)
  const weekDone = weekDemands.filter(isDone)
  const late = open.filter((item: any) => isLate(item, todayKey))
  const priority = weekOpen.filter((item: any) => ['urgent', 'high'].includes(String(item.priority)))
  const weekWorkIds = new Set(weekDemands.map((item: any) => item.id))
  const weekAssignments = source.assignments.filter((assignment: any) => weekWorkIds.has(assignment.work_item_id))
  const assignmentsDone = source.assignments.filter((assignment: any) => {
    const key = assignmentCompletionDateKey(assignment)
    return Boolean(key && key >= startKey && key < endKey)
  })
  const eventsDone = events.filter((event: any) => {
    const key = eventCompletionDateKey(event)
    return Boolean(key && key >= startKey && key < endKey)
  })

  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const trend = days.map((day) => {
    const key = ymd(day)
    return {
      dia: formatDateShort(key),
      demandas: weekDemands.filter((item: any) => item.final_deadline === key).length,
      agendas: events.filter((event: any) => String(event.starts_at || '').slice(0, 10) === key).length,
      entregas: demands.filter((item: any) => completionDateKey(item) === key).length,
      realizadas: events.filter((event: any) => eventCompletionDateKey(event) === key).length,
    }
  })

  const statusData = countBy(weekDemands, (item: any) => statusName(item.status))
  const responsibleData = countBy(weekOpen, (item: any) => item.responsible?.display_name || item.responsible?.full_name || 'Sem responsável').slice(0, 8)
  const sectorData = countBy(weekAssignments, (assignment: any) => assignment.board?.name || 'Quadro sem nome').slice(0, 8)
  const deliveryPct = weekDemands.length ? Math.round((weekDone.length / weekDemands.length) * 100) : 0
  const weekQueue = [...weekOpen].sort((a: any, b: any) => {
    const dateCompare = String(getDemandDate(a) || '9999').localeCompare(String(getDemandDate(b) || '9999'))
    if (dateCompare !== 0) return dateCompare
    return priorityWeight(b.priority) - priorityWeight(a.priority)
  })
  const priorityQueue = [...priority, ...late]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .sort((a: any, b: any) => priorityWeight(b.priority) - priorityWeight(a.priority))

  return (
    <DashboardCharts
      variant="week"
      eyebrow="Dashboard semanal"
      title="Semana"
      periodLabel={`${formatDateShort(startKey)} – ${formatDateShort(ymd(addDays(end, -1)))}`}
      description="Demandas, Quadros e Agenda pela execução real da semana."
      metrics={[
        { label: 'Demandas previstas', value: weekDemands.length, hint: 'prazo no intervalo', tone: 'blue', icon: 'ti-calendar-week' },
        { label: 'Demandas concluídas', value: weekDone.length, hint: 'previstas e concluídas', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Etapas concluídas', value: assignmentsDone.length, hint: `${weekAssignments.length} etapa(s) prevista(s)`, tone: 'green', icon: 'ti-layout-kanban' },
        { label: 'Agendas concluídas', value: eventsDone.length, hint: `${events.length} agenda(s)`, tone: 'green', icon: 'ti-calendar-check' },
        { label: 'Atrasos', value: late.length, hint: 'abertos acumulados', tone: 'red', icon: 'ti-alert-triangle' },
      ]}
      progress={{ title: 'Progresso semanal', description: 'Demandas previstas na semana que já foram concluídas.', value: deliveryPct, done: weekDone.length, total: weekDemands.length, remainingLabel: `${Math.max(0, weekDemands.length - weekDone.length)} demanda(s) ainda abertas` }}
      featured={[
        { title: 'Resumo da semana', subtitle: 'Demandas abertas mais relevantes', items: summarizeItems(weekQueue, 6) },
        { title: 'Agenda da semana', subtitle: `${eventsDone.length}/${events.length} concluída(s)`, items: summarizeEvents(events, 6) },
      ]}
      primaryChart={{
        title: 'Distribuição da semana',
        description: 'Planejado e concluído pela data efetiva.',
        type: 'bar',
        data: trend,
        xKey: 'dia',
        series: [
          { key: 'demandas', name: 'Demandas previstas', color: '#2563EB' },
          { key: 'agendas', name: 'Agendas', color: '#0891B2' },
          { key: 'entregas', name: 'Demandas concluídas', color: '#16A34A' },
          { key: 'realizadas', name: 'Agendas concluídas', color: '#15803D' },
        ],
        height: 220,
        span: 2,
      }}
      bars={{ title: 'Carga por responsável', description: 'Demandas abertas previstas na semana.', data: responsibleData, labelKey: 'name', valueKey: 'value' }}
      donut={{ title: 'Status da semana', description: 'Demandas canônicas do intervalo.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: weekDemands.length, centerLabel: 'demandas' }}
      secondaryChart={{ title: 'Etapas por setor', description: 'Distribuições nos Quadros para as demandas da semana.', type: 'bar', data: sectorData, xKey: 'name', series: [{ key: 'value', name: 'Etapas', color: '#2563EB' }], height: 180 }}
      summaries={[
        { title: 'Prioridades da semana', subtitle: 'Atrasos e demandas de alta prioridade', items: summarizeItems(priorityQueue, 6) },
        { title: 'Agendas realizadas', subtitle: 'Conclusão com data e responsável', items: summarizeEvents(eventsDone, 6) },
      ]}
    />
  )
}
