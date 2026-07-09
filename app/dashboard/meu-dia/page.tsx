import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DashboardCharts from '../DashboardCharts'
import { addDateKeyDays, dateKeyInAmpyTimezone } from '@/lib/date'
import { countBy, formatDateLong, isDone, isLate, isOpen, loadOperationData, statusName, summarizeEvents, summarizeItems, typeName } from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const closed = ['archived', 'cancelled']

export default async function DiaPage() {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const tomorrowKey = addDateKeyDays(todayKey, 1)

  const source = await loadOperationData(supabase, { eventStartKey: todayKey, eventEndKey: tomorrowKey })
  const demands = source.demands.filter((item: any) => !closed.includes(String(item.status)))
  const events = source.events
  const open = demands.filter(isOpen)

  const dueToday = open.filter((item: any) => item.final_deadline === todayKey || item.internal_deadline === todayKey)
  const late = open.filter((item: any) => isLate(item, todayKey))
  const urgent = open.filter((item: any) => item.priority === 'urgent' || item.priority === 'high')
  const doneToday = demands.filter((item: any) => isDone(item) && String(item.closed_at || item.updated_at || '').slice(0, 10) === todayKey)

  const statusData = countBy([...dueToday, ...late, ...urgent], (item: any) => statusName(item.status)).slice(0, 6)
  const sectorData = countBy(dueToday.length ? dueToday : open, (item: any) => typeName(item.type)).slice(0, 6)
  const criticalQueue = [...late, ...urgent, ...dueToday]
    .filter((item, index, list) => list.findIndex((entry) => entry.id === item.id) === index)
    .sort((a: any, b: any) => {
      const pa = a.priority === 'urgent' ? 0 : a.priority === 'high' ? 1 : 2
      const pb = b.priority === 'urgent' ? 0 : b.priority === 'high' ? 1 : 2
      return pa - pb || String(a.final_deadline || a.internal_deadline || '').localeCompare(String(b.final_deadline || b.internal_deadline || ''))
    })

  return (
    <DashboardCharts
      variant="day"
      eyebrow="Dashboard diário"
      title="Dia"
      periodLabel={formatDateLong(todayKey)}
      description="Leitura visual do dia: demandas, agenda, atrasos, prioridades e entregas."
      metrics={[
        { label: 'Demandas do dia', value: dueToday.length, hint: 'prazo interno/final', tone: 'blue', icon: 'ti-calendar-check' },
        { label: 'Agendas', value: events.length, hint: 'eventos do dia', tone: 'green', icon: 'ti-calendar-event' },
        { label: 'Atrasos', value: late.length, hint: 'ainda abertos', tone: late.length ? 'red' : 'green', icon: 'ti-alert-triangle' },
        { label: 'Prioridade', value: urgent.length, hint: 'alta ou urgente', tone: urgent.length ? 'yellow' : 'neutral', icon: 'ti-flag' },
        { label: 'Entregue hoje', value: doneToday.length, hint: 'concluídas no dia', tone: 'green', icon: 'ti-circle-check' },
      ]}
      donut={{ title: 'Status do dia', description: 'Composição de demandas do dia, atrasos e prioridades.', data: statusData, nameKey: 'name', valueKey: 'value', centerValue: dueToday.length + late.length + urgent.length, centerLabel: 'itens' }}
      secondaryDonut={{ title: 'Carga por setor', description: 'Distribuição visual por tipo de atividade.', data: sectorData, nameKey: 'name', valueKey: 'value', centerValue: sectorData.reduce((sum, item) => sum + item.value, 0), centerLabel: 'demandas' }}
      featured={[
        { title: 'Fila crítica', subtitle: 'Atrasos, prioridades e entregas que precisam de atenção.', items: summarizeItems(criticalQueue, 6) },
        { title: 'Agenda do dia', subtitle: 'Recorte dos eventos com horário e vínculo operacional.', items: summarizeEvents(events, 6) },
      ]}
      summaries={[
        { title: 'Demandas do dia', subtitle: 'Prazos internos ou finais para hoje.', items: summarizeItems(dueToday, 6) },
        { title: 'Atrasadas', subtitle: 'Demandas abertas fora do prazo.', items: summarizeItems(late, 6) },
        { title: 'Prioridades', subtitle: 'Itens marcados como alta ou urgente.', items: summarizeItems(urgent, 6) },
        { title: 'Entregues hoje', subtitle: 'Concluídas ou entregues no dia.', items: summarizeItems(doneToday, 6) },
      ]}
    />
  )
}
