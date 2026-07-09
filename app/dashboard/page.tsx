import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from './DashboardCharts'
import { addDateKeyDays, dateKeyInAmpyTimezone } from '@/lib/date'
import { countBy, DONE_STATUSES, formatDateLong, formatDateShort, getDemandDate, isDone, isLate, isOpen, startOfMonth, startOfWeek, addDays, ymd, typeName, statusName, summarizeItems } from './dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const now = new Date(`${todayKey}T12:00:00`)
  const last30Key = addDateKeyDays(todayKey, -30)
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)
  const monthStart = startOfMonth(now)
  const monthStartKey = ymd(monthStart)
  const monthEndKey = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1, 12))

  const [{ count: activeClients }, { data: demandsRaw }, { data: eventsRaw }] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('work_items')
      .select('id,title,type,status,priority,destino,client_id,responsible_id,internal_deadline,final_deadline,created_at,updated_at,closed_at,client:clients(name),responsible:profiles(full_name)')
      .not('status', 'in', '(archived,cancelled)')
      .limit(1000),
    supabase
      .from('calendar_events')
      .select('id,title,type,starts_at,ends_at,all_day,client:clients(name),responsible:profiles(full_name),work_item:work_items(id,title)')
      .gte('starts_at', `${last30Key}T00:00:00`)
      .limit(500),
  ])

  const demands = demandsRaw || []
  const events = eventsRaw || []
  const open = demands.filter(isOpen)
  const done = demands.filter(isDone)
  const inProgress = demands.filter((item: any) => item.status === 'in_progress')
  const pending = demands.filter((item: any) => ['not_started', 'waiting', 'awaiting_approval', 'scheduled'].includes(String(item.status)))
  const late = demands.filter((item: any) => isLate(item, todayKey))
  const monthDemands = demands.filter((item: any) => {
    const date = getDemandDate(item) || String(item.created_at || '').slice(0, 10)
    return date >= monthStartKey && date < monthEndKey
  })
  const monthDone = monthDemands.filter(isDone)
  const deliveryPct = monthDemands.length ? Math.round((monthDone.length / monthDemands.length) * 100) : 0
  const weekDemands = open.filter((item: any) => {
    const date = getDemandDate(item)
    return date && date >= ymd(weekStart) && date < ymd(weekEnd)
  })
  const dayDemands = open.filter((item: any) => item.final_deadline === todayKey || item.internal_deadline === todayKey)
  const todayEvents = events.filter((event: any) => String(event.starts_at || '').slice(0, 10) === todayKey)

  const last30Days = Array.from({ length: 30 }, (_, index) => {
    const key = addDateKeyDays(last30Key, index + 1)
    return {
      date: formatDateShort(key),
      criadas: demands.filter((item: any) => String(item.created_at || '').slice(0, 10) === key).length,
      concluidas: demands.filter((item: any) => DONE_STATUSES.includes(String(item.status)) && String(item.closed_at || item.updated_at || '').slice(0, 10) === key).length,
    }
  })

  const sectorData = countBy(demands.filter((item: any) => String(item.created_at || '').slice(0, 10) >= last30Key), (item: any) => typeName(item.type)).slice(0, 7)
  const statusData = countBy(demands, (item: any) => statusName(item.status)).slice(0, 7)

  return (
    <DashboardCharts
      eyebrow="Dashboards"
      title="Painel de Controle"
      periodLabel={formatDateLong(todayKey)}
      description="Visão geral da operação Ampy a partir de Demandas e Agenda."
      metrics={[
        { label: 'Clientes ativos', value: activeClients || 0, hint: 'em operação', tone: 'blue', icon: 'ti-users' },
        { label: 'Entregas', value: done.length, hint: 'concluídas/entregues', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Andamento', value: inProgress.length, hint: 'em execução', tone: 'blue', icon: 'ti-progress' },
        { label: 'Atraso', value: late.length, hint: 'fora do prazo', tone: 'red', icon: 'ti-alert-triangle' },
        { label: 'Pendente', value: pending.length, hint: 'aguardando início', tone: 'yellow', icon: 'ti-hourglass' },
      ]}
      primaryChart={{
        title: 'Demandas Últ. 30d',
        description: 'Volume diário de demandas criadas e concluídas.',
        type: 'bar',
        data: last30Days,
        xKey: 'date',
        series: [
          { key: 'criadas', name: 'Criadas', color: '#2563EB' },
          { key: 'concluidas', name: 'Concluídas', color: '#16A34A' },
        ],
        height: 280,
      }}
      progress={{
        title: '% Entrega do mês',
        description: 'Demandas do mês com prazo ou criação em aberto.',
        value: deliveryPct,
        done: monthDone.length,
        total: monthDemands.length,
        remainingLabel: `${Math.max(0, monthDemands.length - monthDone.length)} demanda(s) ainda faltam no mês`,
      }}
      bars={{ title: 'Demandas por Setor', description: 'Distribuição por tipo de atividade.', data: sectorData, labelKey: 'name', valueKey: 'value' }}
      donut={{ title: 'Status da operação', description: 'Composição atual das demandas.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: demands.length, centerLabel: 'demandas' }}
      summaries={[
        { title: 'Semana', subtitle: 'Demandas da semana de forma resumida', items: summarizeItems(weekDemands, 6) },
        { title: 'Dia', subtitle: `${dayDemands.length} demanda(s) e ${todayEvents.length} evento(s)`, items: [
          { label: 'Demandas do dia', value: dayDemands.length, meta: 'Prazos internos ou finais para hoje', tone: 'blue' },
          { label: 'Eventos do dia', value: todayEvents.length, meta: 'Agenda cadastrada para hoje', tone: 'green' },
          { label: 'Atrasos abertos', value: late.length, meta: 'Demandas abertas fora do prazo', tone: late.length ? 'red' : 'green' },
        ] },
      ]}
    />
  )
}
