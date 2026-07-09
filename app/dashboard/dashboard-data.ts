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

export function summarizeItems(items: any[], limit = 5) {
  return items.slice(0, limit).map((item) => ({
    label: item.title || 'Sem título',
    value: item.final_deadline || item.internal_deadline ? formatDateShort(item.final_deadline || item.internal_deadline) : 'sem prazo',
    meta: `${item.client?.name || 'Interno Ampy'} · ${item.responsible?.full_name || 'sem responsável'}`,
    tone: item.status === 'blocked' ? 'red' : item.priority === 'urgent' ? 'red' : item.priority === 'high' ? 'yellow' : 'blue',
  }))
}
