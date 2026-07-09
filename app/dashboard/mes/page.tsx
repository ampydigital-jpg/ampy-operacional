import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { dateKeyInAmpyTimezone } from '@/lib/date'
import { addDays, countBy, demandTouchesRange, formatMonth, getDemandDate, isDone, isLate, isOpen, loadOperationData, startOfMonth, statusName, summarizeEvents, summarizeItems, typeName, ymd } from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MesPage({ searchParams }: { searchParams?: { month?: string } }) {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const anchor = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? new Date(`${searchParams.month}-01T12:00:00`) : new Date(`${todayKey}T12:00:00`)
  const start = startOfMonth(anchor)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1, 12)
  const startKey = ymd(start)
  const endKey = ymd(end)

  const source = await loadOperationData(supabase, { eventStartKey: startKey, eventEndKey: endKey })
  const demands = source.demands.filter((item: any) => !['archived', 'cancelled'].includes(String(item.status)))
  const events = source.events
  const monthDemands = demands.filter((item: any) => demandTouchesRange(item, startKey, endKey))
  const monthOpen = monthDemands.filter(isOpen)
  const monthDone = monthDemands.filter(isDone)
  const late = demands.filter((item: any) => isLate(item, todayKey))
  const pending = monthDemands.filter((item: any) => ['not_started', 'waiting', 'awaiting_approval', 'scheduled'].includes(String(item.status)))
  const deliveryPct = monthDemands.length ? Math.round((monthDone.length / monthDemands.length) * 100) : 0

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
      entregas: inRange.filter(isDone).length,
      atrasos: inRange.filter((item: any) => isLate(item, todayKey)).length,
    }
  })

  const statusData = countBy(monthDemands, (item: any) => statusName(item.status))
  const clientData = countBy(monthDemands, (item: any) => item.client?.name || 'Interno Ampy').slice(0, 8)
  const sectorData = countBy(monthDemands, (item: any) => typeName(item.type)).slice(0, 7)
  const relevantOpen = monthOpen.sort((a: any, b: any) => String(getDemandDate(a) || '9999').localeCompare(String(getDemandDate(b) || '9999')))

  return (
    <DashboardCharts
      variant="month"
      eyebrow="Dashboard mensal"
      title="Mês"
      periodLabel={formatMonth(start)}
      description="Visão mensal de entregas, pendências, atrasos e distribuição da operação."
      metrics={[
        { label: 'Demandas mês', value: monthDemands.length, hint: 'prazo ou criação no mês', tone: 'blue', icon: 'ti-calendar-month' },
        { label: 'Entregas', value: monthDone.length, hint: 'concluídas/entregues', tone: 'green', icon: 'ti-circle-check' },
        { label: 'Pendentes', value: pending.length, hint: 'ainda sem execução', tone: pending.length ? 'yellow' : 'neutral', icon: 'ti-hourglass' },
        { label: 'Atrasos', value: late.length, hint: 'abertos acumulados', tone: late.length ? 'red' : 'green', icon: 'ti-alert-triangle' },
        { label: 'Eventos', value: events.length, hint: 'agenda do mês', tone: 'blue', icon: 'ti-calendar-event' },
      ]}
      progress={{ title: '% Entrega mensal', description: 'Quanto já foi entregue no mês.', value: deliveryPct, done: monthDone.length, total: monthDemands.length, remainingLabel: `${Math.max(0, monthDemands.length - monthDone.length)} demanda(s) ainda faltam no mês` }}
      primaryChart={{
        title: 'Evolução do mês',
        description: 'Demandas, entregas e atrasos por semana.',
        type: 'bar',
        data: weekly,
        xKey: 'semana',
        series: [
          { key: 'demandas', name: 'Demandas', color: '#2563EB' },
          { key: 'entregas', name: 'Entregas', color: '#16A34A' },
          { key: 'atrasos', name: 'Atrasos', color: '#DC2626' },
        ],
        height: 250,
        span: 2,
      }}
      donut={{ title: 'Status do mês', description: 'Distribuição de status das demandas mensais.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: monthDemands.length, centerLabel: 'demandas' }}
      bars={{ title: 'Demandas por cliente', description: 'Clientes com maior volume no mês.', data: clientData, labelKey: 'name', valueKey: 'value' }}
      secondaryChart={{ title: 'Demandas por setor', description: 'Volume mensal por tipo de atividade.', type: 'bar', data: sectorData, xKey: 'name', series: [{ key: 'value', name: 'Demandas', color: '#EAB308' }], height: 200 }}
      summaries={[
        { title: 'Pendências do mês', subtitle: 'Demandas abertas com maior prioridade', items: summarizeItems(relevantOpen, 6) },
        { title: 'Eventos do mês', subtitle: 'Próximos eventos registrados', items: summarizeEvents(events, 6) },
        { title: 'Foco do mês', subtitle: 'Atrasos e demandas de alta prioridade', items: summarizeItems([...late, ...monthOpen.filter((item: any) => ['urgent', 'high'].includes(String(item.priority)))].filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index), 6) },
      ]}
    />
  )
}
