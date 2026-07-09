export const DONE_STATUSES = ['done', 'delivered', 'approved']
export const CLOSED_STATUSES = ['done', 'delivered', 'approved', 'cancelled', 'archived']
export const OPEN_STATUSES = ['not_started', 'in_progress', 'waiting', 'blocked', 'in_review', 'awaiting_approval', 'scheduled']

export const statusLabels: Record<string, string> = {
  not_started: 'Pendente',
  in_progress: 'Andamento',
  waiting: 'Aguardando',
  blocked: 'Bloqueada',
  in_review: 'Revisão',
  awaiting_approval: 'Aprovação',
  approved: 'Aprovada',
  scheduled: 'Programada',
  delivered: 'Entregue',
  done: 'Concluída',
  cancelled: 'Cancelada',
  archived: 'Arquivada',
}

export const typeLabels: Record<string, string> = {
  planning: 'Planejamento',
  capture: 'Captação',
  editing: 'Edição',
  design: 'Design',
  feed: 'Organização Feed',
  scheduling: 'Programação',
  traffic: 'Tráfego',
  social: 'Social Media',
  audiovisual: 'Audiovisual',
  internal: 'Interno',
}

export function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00`)
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  copy.setHours(12, 0, 0, 0)
  return copy
}

export function startOfWeek(date: Date) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7))
  copy.setHours(12, 0, 0, 0)
  return copy
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0)
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 12, 0, 0, 0)
}

export function formatDateLong(key: string) {
  return dateFromKey(key).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateShort(key: string) {
  return dateFromKey(key).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function formatMonth(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function getDemandDate(item: any) {
  return item.final_deadline || item.internal_deadline || null
}

export function getDemandDates(item: any) {
  return [item.internal_deadline, item.final_deadline].filter(Boolean) as string[]
}

export function isDone(item: any) {
  return DONE_STATUSES.includes(String(item.status || ''))
}

export function isOpen(item: any) {
  return !CLOSED_STATUSES.includes(String(item.status || ''))
}

export function isLate(item: any, todayKey: string) {
  const date = getDemandDate(item)
  return Boolean(isOpen(item) && date && date < todayKey)
}

export function isInDateRange(key: string | null | undefined, startKey: string, endKey: string) {
  return Boolean(key && key >= startKey && key < endKey)
}

export function demandTouchesRange(item: any, startKey: string, endKey: string) {
  const dates = getDemandDates(item)
  if (dates.some((date) => isInDateRange(date, startKey, endKey))) return true
  const created = String(item.created_at || '').slice(0, 10)
  return isInDateRange(created, startKey, endKey)
}

export function typeName(type?: string | null) {
  return typeLabels[String(type || '')] || String(type || 'Operação')
}

export function statusName(status?: string | null) {
  return statusLabels[String(status || '')] || String(status || 'Sem status')
}

export function priorityWeight(priority?: string | null) {
  return ({ urgent: 4, high: 3, normal: 2, low: 1 } as Record<string, number>)[String(priority || 'normal')] || 2
}

export function countBy<T>(items: T[], getter: (item: T) => string) {
  const map = new Map<string, number>()
  items.forEach((item) => {
    const key = getter(item) || 'Sem classificação'
    map.set(key, (map.get(key) || 0) + 1)
  })
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function rangeDays(start: Date, total: number) {
  return Array.from({ length: total }, (_, index) => addDays(start, index))
}

export function eventDateKey(event: any) {
  return String(event.starts_at || '').slice(0, 10)
}

export function localHour(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export function summarizeItems(items: any[], limit = 5) {
  return items.slice(0, limit).map((item) => ({
    label: item.title || 'Sem título',
    value: item.final_deadline || item.internal_deadline ? formatDateShort(item.final_deadline || item.internal_deadline) : 'sem prazo',
    meta: `${item.client?.name || 'Interno Ampy'} · ${item.responsible?.full_name || 'sem responsável'}`,
    tone: item.status === 'blocked' ? 'red' : item.priority === 'urgent' ? 'red' : item.priority === 'high' ? 'yellow' : 'blue',
  }))
}

export function summarizeEvents(events: any[], limit = 5) {
  return events.slice(0, limit).map((event) => ({
    label: event.title || 'Evento sem título',
    value: event.all_day ? 'dia inteiro' : localHour(event.starts_at) || 'sem hora',
    meta: `${event.client?.name || event.work_item?.title || 'Interno Ampy'} · ${event.responsible?.full_name || 'sem responsável'}`,
    tone: event.type === 'delivery' ? 'green' : event.type === 'capture_external' || event.type === 'capture_studio' ? 'yellow' : 'blue',
  }))
}

export function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export async function loadOperationData(supabase: any, options: { eventStartKey?: string; eventEndKey?: string; demandLimit?: number; eventLimit?: number } = {}) {
  const demandLimit = options.demandLimit || 1800
  const eventLimit = options.eventLimit || 900

  let eventsQuery = supabase
    .from('calendar_events')
    .select('id,title,type,client_id,work_item_id,responsible_id,starts_at,ends_at,all_day,color,created_at,updated_at')
    .order('starts_at', { ascending: true })
    .limit(eventLimit)

  if (options.eventStartKey) eventsQuery = eventsQuery.gte('starts_at', `${options.eventStartKey}T00:00:00-03:00`)
  if (options.eventEndKey) eventsQuery = eventsQuery.lt('starts_at', `${options.eventEndKey}T00:00:00-03:00`)

  const [clientsResult, profilesResult, demandsResult, eventsResult] = await Promise.all([
    supabase.from('clients').select('id,name,status,segment,city,avatar_initials,avatar_color,avatar_bg').limit(2500),
    supabase.from('profiles').select('id,full_name,role,is_active,avatar_initials').limit(500),
    supabase
      .from('work_items')
      .select('id,title,type,status,priority,destino,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,created_at,updated_at,closed_at')
      .limit(demandLimit),
    eventsQuery,
  ])

  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const rawDemands = demandsResult.data || []
  const rawEvents = eventsResult.data || []
  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)

  const demands = rawDemands.map((item: any) => ({
    ...item,
    client: item.client_id ? clientsById.get(item.client_id) || null : null,
    responsible: item.responsible_id ? profilesById.get(item.responsible_id) || null : null,
  }))
  const demandsById = mapById(demands)
  const events = rawEvents.map((event: any) => ({
    ...event,
    client: event.client_id ? clientsById.get(event.client_id) || null : null,
    responsible: event.responsible_id ? profilesById.get(event.responsible_id) || null : null,
    work_item: event.work_item_id ? demandsById.get(event.work_item_id) || null : null,
  }))

  const loadErrors = [
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Equipe: ${profilesResult.error.message}` : null,
    demandsResult.error ? `Demandas: ${demandsResult.error.message}` : null,
    eventsResult.error ? `Agenda: ${eventsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return {
    clients,
    activeClientsCount: clients.filter((client: any) => client.status === 'active').length,
    profiles,
    demands,
    events,
    loadErrors,
  }
}
