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
  formatMonth,
  getDemandDate,
  isDone,
  isLate,
  isOpen,
  loadOperationData,
  priorityWeight,
  startOfMonth,
  statusName,
  summarizeEvents,
  summarizeItems,
  ymd,
} from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MesPage({ searchParams }: { searchParams?: { month?: string } }) {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const anchor = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month)
    ? new Date(`${searchParams.month}-01T12:00:00`)
    : new Date(`${todayKey}T12:00:00`)
  const start = startOfMonth(anchor)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1, 12)
  const startKey = ymd(start)
  const endKey = ymd(end)

  const source = await loadOperationData(supabase, { eventStartKey: startKey, eventEndKey: endKey })
  const demands = source.demands.filter((item: any) =>
    !item.is_pauta_card && !['archived', 'cancelled'].includes(String(item.status)),
  )
  const events = source.events
  const monthDemands = demands.filter((item: any) => demandTouchesRange(item, startKey, endKey))
  const monthOpen = monthDemands.filter(isOpen)
  const monthDone = monthDemands.filter(isDone)
  const late = demands.filter((item: any) => isLate(item, todayKey))
  const pending = monthDemands.filter((item: any) => ['not_started', 'waiting', 'awaiting_approval', 'scheduled'].includes(String(item.status)))
  const priority = monthOpen.filter((item: any) => ['urgent', 'high'].includes(String(item.priority)))
  const deliveryPct = monthDemands.length ? Math.round((monthDone.length / monthDemands.length) * 100) : 0
  const monthWorkIds = new Set(monthDemands.map((item: any) => item.id))
  const monthAssignments = source.assignments.filter((assignment: any) => monthWorkIds.has(assignment.work_item_id))
  const assignmentsCompletedInMonth = source.assignments.filter((assignment: any) => {
    const key = assignmentCompletionDateKey(assignment)
    return Boolean(key && key >= startKey && key < endKey)
  })
  const eventsCompletedInMonth = events.filter((event: any) => {
    const key = eventCompletionDateKey(event)
    return Boolean(key && key >= startKey && key < endKey)
  })

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000)
  const weekly = Array.from({ length: Math.ceil(totalDays / 7) }, (_, index) => {
    const a = addDays(start, index * 7)
    const b = addDays(start, Math.min(totalDays, (index + 1) * 7))
    const aKey = ymd(a)
    const bKey = ymd(b)
    const inRange = monthDemands.filter((item: any) => demandTouchesRange(item, aKey, bKey))
    return {
      semana: `S${index + 1}`,
      demandas: inRange.length,
      entregas: demands.filter((item: any) => {
        const key = completionDateKey(item)
        return Boolean(key && key >= aKey && key < bKey)
      }).length,
      agendas: events.filter((event: any) => {
        const key = eventCompletionDateKey(event)
        return Boolean(key && key >= aKey && key < bKey)
      }).length,
      atrasos: inRange.filter((item: any) => isLate(item, todayKey)).length,
    }
  })

  const statusData = countBy(monthDemands, (item: any) => statusName(item.status))
  const clientData = countBy(monthDemands, (item: any) => item.client?.name || 'Interno Ampy').slice(0, 8)
  const sectorData = countBy(monthAssignments, (assignment: any) => assignment.board?.name || 'Quadro sem nome').slice(0, 8)
  const relevantOpen = [...monthOpen].sort((a: any, b: any) => String(getDemandDate(a) || '9999').localeCompare(String(getDemandDate(b) || '9999')) || priorityWeight(b.priority) - priorityWeight(a.priority))
  const focusMonth = [...late, ...priority, ...pending]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .sort((a: any, b: any) => priorityWeight(b.priority) - priorityWeight(a.priority))

  return (
    <DashboardCharts
      variant="month"
      eyebrow="Dashboard mensal"
      title="Mês"
      periodLabel={formatMonth(start)}
      description="Entregas, etapas e agendas pela conclusão real, sem duplicar cards mensais."
      metrics={[
        { label: 'Demandas previstas', value: monthDemands.length, hint: 'prazo no mês', tone: 'blue', icon: 'ti-calendar-month' },
        { label: 'Demandas concluídas', value: monthDone.length, hint: 'previstas já entregues', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Etapas concluídas', value: assignmentsCompletedInMonth.length, hint: `${monthAssignments.length} etapa(s) prevista(s)`, tone: 'green', icon: 'ti-layout-kanban' },
        { label: 'Agendas concluídas', value: eventsCompletedInMonth.length, hint: `${events.length} agenda(s) no mês`, tone: 'green', icon: 'ti-calendar-check' },
        { label: 'Atrasos', value: late.length, hint: 'abertos acumulados', tone: 'red', icon: 'ti-alert-triangle' },
      ]}
      progress={{ title: '% Entrega mensal', description: 'Demandas previstas no mês que foram concluídas.', value: deliveryPct, done: monthDone.length, total: monthDemands.length, remainingLabel: `${Math.max(0, monthDemands.length - monthDone.length)} demanda(s) ainda faltam no mês` }}
      featured={[
        { title: 'Pendências do mês', subtitle: 'Demandas abertas mais relevantes', items: summarizeItems(relevantOpen, 6) },
        { title: 'Agenda do mês', subtitle: `${eventsCompletedInMonth.length}/${events.length} concluída(s)`, items: summarizeEvents(events, 6) },
      ]}
      primaryChart={{
        title: 'Evolução do mês',
        description: 'Planejamento e execução real por semana.',
        type: 'bar',
        data: weekly,
        xKey: 'semana',
        series: [
          { key: 'demandas', name: 'Demandas previstas', color: '#2563EB' },
          { key: 'entregas', name: 'Demandas concluídas', color: '#16A34A' },
          { key: 'agendas', name: 'Agendas concluídas', color: '#0891B2' },
          { key: 'atrasos', name: 'Atrasos', color: '#DC2626' },
        ],
        height: 220,
        span: 1,
      }}
      bars={{ title: 'Demandas por cliente', description: 'Volume previsto no mês.', data: clientData, labelKey: 'name', valueKey: 'value' }}
      donut={{ title: 'Status do mês', description: 'Demandas canônicas do período.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: monthDemands.length, centerLabel: 'demandas' }}
      secondaryChart={{ title: 'Etapas por setor', description: 'Distribuição das demandas nos Quadros.', type: 'bar', data: sectorData, xKey: 'name', series: [{ key: 'value', name: 'Etapas', color: '#2563EB' }], height: 180 }}
      summaries={[
        { title: 'Foco do mês', subtitle: 'Atrasos, prioridades e pendências', items: summarizeItems(focusMonth, 6) },
        { title: 'Agendas realizadas', subtitle: 'Conclusão com data e responsável', items: summarizeEvents(eventsCompletedInMonth, 6) },
      ]}
    />
  )
}
