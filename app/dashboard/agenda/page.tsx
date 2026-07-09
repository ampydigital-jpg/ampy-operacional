import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import AgendaView from './AgendaView'
import { ampyDayStart } from '@/lib/date'

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date()
  return new Date(`${value}T12:00:00`)
}
function ymd(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
function addDays(date: Date, days: number) { const copy = new Date(date); copy.setDate(copy.getDate()+days); return copy }
function monday(date: Date) { const copy = new Date(date); const delta = (copy.getDay()+6)%7; copy.setDate(copy.getDate()-delta); return copy }
function mapById(items: any[] | null | undefined) { return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item])) }

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AgendaPage({ searchParams }: { searchParams: { period?: string; start?: string } }) {
  noStore()
  const allowed = ['day','7','14','28','month']
  const period = allowed.includes(searchParams.period || '') ? (searchParams.period || '7') : '7'
  const anchor = parseDate(searchParams.start)
  const start = period === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12) : period === 'day' ? anchor : monday(anchor)
  const end = period === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth()+1, 1, 12) : addDays(start, period === 'day' ? 1 : Number(period))
  const supabase = createClient()

  const [eventsResult, clientsResult, profilesResult, demandsResult] = await Promise.all([
    supabase
      .from('calendar_events')
      .select('id,title,type,client_id,work_item_id,responsible_id,starts_at,ends_at,all_day,color,recurrence_rule,location,notes,confirmed,drive_link,created_at,updated_at')
      .gte('starts_at', ampyDayStart(ymd(start)))
      .lt('starts_at', ampyDayStart(ymd(end)))
      .order('starts_at'),
    supabase
      .from('clients')
      .select('id,name,avatar_initials,avatar_color,avatar_bg,status')
      .eq('status','active')
      .order('name'),
    supabase
      .from('profiles')
      .select('id,full_name,avatar_initials,role,is_active')
      .eq('is_active',true)
      .order('full_name'),
    supabase
      .from('work_items')
      .select('id,title,client_id,status,destino')
      .not('status','in','(archived,cancelled,done)')
      .order('title')
      .limit(300),
  ])

  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const demands = demandsResult.data || []
  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const demandsById = mapById(demands)

  const events = (eventsResult.data || []).map((event: any) => ({
    ...event,
    client: event.client_id ? clientsById.get(event.client_id) || null : null,
    responsible: event.responsible_id ? profilesById.get(event.responsible_id) || null : null,
    work_item: event.work_item_id ? demandsById.get(event.work_item_id) || null : null,
  }))

  const loadErrors = [
    eventsResult.error ? `Eventos: ${eventsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Equipe: ${profilesResult.error.message}` : null,
    demandsResult.error ? `Demandas: ${demandsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <AgendaView events={events} clients={clients} profiles={profiles} demands={demands} period={period} start={ymd(start)} end={ymd(end)} loadErrors={loadErrors} />
}
