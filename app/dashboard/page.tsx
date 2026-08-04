import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from './DashboardCharts'
import { addDateKeyDays, dateKeyInAmpyTimezone } from '@/lib/date'
import {
  addDays,
  assignmentIsDone,
  completionDateKey,
  countBy,
  demandTouchesRange,
  eventCompletionDateKey,
  formatDateLong,
  formatDateShort,
  getDemandDate,
  isDone,
  isEventDone,
  isLate,
  isOpen,
  loadOperationData,
  startOfMonth,
  startOfWeek,
  statusName,
  summarizeEvents,
  summarizeItems,
  ymd,
} from './dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const now = new Date(`${todayKey}T12:00:00`)
  const last30Key = addDateKeyDays(todayKey, -30)
  const next30Key = addDateKeyDays(todayKey, 30)
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)
  const weekStartKey = ymd(weekStart)
  const weekEndKey = ymd(weekEnd)
  const monthStart = startOfMonth(now)
  const monthStartKey = ymd(monthStart)
  const monthEndKey = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1, 12))

  const source = await loadOperationData(supabase, {
    eventStartKey: last30Key,
    eventEndKey: next30Key,
  })

  const demands = source.demands.filter((item: any) =>
    !item.is_pauta_card && !['archived', 'cancelled'].includes(String(item.status)),
  )
  const events = source.events
  const assignments = source.assignments
  const open = demands.filter(isOpen)
  const done = demands.filter(isDone)
  const inProgress = demands.filter((item: any) => item.status === 'in_progress')
  const pending = demands.filter((item: any) =>
    ['not_started', 'waiting', 'awaiting_approval', 'scheduled'].includes(String(item.status)),
  )
  const late = demands.filter((item: any) => isLate(item, todayKey))
  const completedEvents = events.filter(isEventDone)
  const completedAssignments = assignments.filter(assignmentIsDone)

  const monthDemands = demands.filter((item: any) => demandTouchesRange(item, monthStartKey, monthEndKey))
  const monthDone = monthDemands.filter(isDone)
  const deliveryPct = monthDemands.length
    ? Math.round((monthDone.length / monthDemands.length) * 100)
    : 0
  const weekDemands = open.filter((item: any) => demandTouchesRange(item, weekStartKey, weekEndKey))
  const dayDemands = open.filter((item: any) => item.final_deadline === todayKey)
  const todayEvents = events.filter((event: any) => String(event.starts_at || '').slice(0, 10) === todayKey)
  const weekEvents = events.filter((event: any) => {
    const key = String(event.starts_at || '').slice(0, 10)
    return key >= weekStartKey && key < weekEndKey
  })

  const last30Days = Array.from({ length: 30 }, (_, index) => {
    const key = addDateKeyDays(last30Key, index + 1)
    return {
      date: formatDateShort(key),
      criadas: demands.filter((item: any) => String(item.created_at || '').slice(0, 10) === key).length,
      concluidas: demands.filter((item: any) => completionDateKey(item) === key).length,
      agendas: events.filter((event: any) => eventCompletionDateKey(event) === key).length,
    }
  })

  const sectorData = countBy(
    assignments,
    (assignment: any) => assignment.board?.name || 'Quadro sem nome',
  ).slice(0, 8)
  const statusData = countBy(demands, (item: any) => statusName(item.status)).slice(0, 7)
  const weekQueue = [...late, ...weekDemands]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .sort((a: any, b: any) => String(getDemandDate(a) || '').localeCompare(String(getDemandDate(b) || '')))
  const dayQueue = [...late, ...dayDemands]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .sort((a: any, b: any) => String(getDemandDate(a) || '').localeCompare(String(getDemandDate(b) || '')))

  return (
    <DashboardCharts
      variant="control"
      eyebrow="Dashboards"
      title="Painel de Controle"
      periodLabel={formatDateLong(todayKey)}
      description="Fonte única: Demandas, etapas dos Quadros e Agenda, usando a data real de conclusão."
      metrics={[
        { label: 'Clientes ativos', value: source.activeClientsCount, hint: 'em operação', tone: 'blue', icon: 'ti-users' },
        { label: 'Demandas concluídas', value: done.length, hint: 'sem cards mensais de referência', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Etapas concluídas', value: completedAssignments.length, hint: `${assignments.length} distribuição(ões)`, tone: 'green', icon: 'ti-layout-kanban' },
        { label: 'Agendas concluídas', value: completedEvents.length, hint: `${events.length} no período`, tone: 'green', icon: 'ti-calendar-check' },
        { label: 'Atrasos', value: late.length, hint: 'demandas abertas fora do prazo', tone: 'red', icon: 'ti-alert-triangle' },
      ]}
      progress={{
        title: '% Entrega do mês',
        description: 'Demandas previstas no mês que já foram concluídas.',
        value: deliveryPct,
        done: monthDone.length,
        total: monthDemands.length,
        remainingLabel: `${Math.max(0, monthDemands.length - monthDone.length)} demanda(s) ainda faltam no mês`,
      }}
      featured={[
        { title: 'Semana', subtitle: `${weekDemands.length} demanda(s) e ${weekEvents.length} agenda(s)`, items: summarizeItems(weekQueue, 5) },
        { title: 'Dia', subtitle: `${dayDemands.length} demanda(s) e ${todayEvents.length} agenda(s)`, items: summarizeItems(dayQueue, 5).concat(summarizeEvents(todayEvents, 2)).slice(0, 5) },
      ]}
      primaryChart={{
        title: 'Execução real — últimos 30 dias',
        description: 'Criações, demandas concluídas e agendas realizadas pela data efetiva.',
        type: 'bar',
        data: last30Days,
        xKey: 'date',
        series: [
          { key: 'criadas', name: 'Criadas', color: '#2563EB' },
          { key: 'concluidas', name: 'Demandas concluídas', color: '#16A34A' },
          { key: 'agendas', name: 'Agendas concluídas', color: '#0891B2' },
        ],
        height: 210,
        span: 1,
      }}
      donut={{ title: 'Status da operação', description: 'Demandas canônicas, sem cards mensais.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: demands.length, centerLabel: 'demandas' }}
      bars={{ title: 'Etapas por setor', description: 'Distribuições ativas por Quadro/setor.', data: sectorData, labelKey: 'name', valueKey: 'value' }}
      summaries={[
        { title: 'Agenda próxima', subtitle: 'Agendas do período', items: summarizeEvents(events.slice(0, 6), 6) },
        { title: 'Fila crítica', subtitle: 'Atrasos e prioridades abertas', items: summarizeItems([...late, ...open.filter((item: any) => ['urgent', 'high'].includes(String(item.priority)))].filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index), 6) },
        { title: 'Operação aberta', subtitle: `${inProgress.length} em andamento · ${pending.length} pendente(s)`, items: summarizeItems(open.sort((a: any, b: any) => String(getDemandDate(a) || '9999').localeCompare(String(getDemandDate(b) || '9999'))), 6) },
      ]}
    />
  )
}
