export const AMPY_TIME_ZONE = 'America/Sao_Paulo'

function parts(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMPY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const read = (type: string) => values.find((entry) => entry.type === type)?.value || ''
  return { year: read('year'), month: read('month'), day: read('day') }
}

export function dateKeyInAmpyTimezone(value: Date | string = new Date()) {
  const { year, month, day } = parts(value)
  return `${year}-${month}-${day}`
}

export function addDateKeyDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const anchor = new Date(Date.UTC(year, month - 1, day, 12))
  anchor.setUTCDate(anchor.getUTCDate() + days)
  return `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, '0')}-${String(anchor.getUTCDate()).padStart(2, '0')}`
}

export function ampyDayStart(dateKey: string) {
  return `${dateKey}T00:00:00-03:00`
}

export function ampyLocalDateTimeToIso(dateKey: string, time = '09:00', allDay = false, endOfDay = false) {
  const clock = allDay ? (endOfDay ? '23:59:59.999' : '00:00:00') : `${time || '09:00'}:00`
  return new Date(`${dateKey}T${clock}-03:00`).toISOString()
}
