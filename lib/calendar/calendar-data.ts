export type CalendarReferenceKind = 'holiday' | 'opportunity'

export type CalendarReference = {
  id: string
  kind: CalendarReferenceKind
  date: string
  title: string
  sourceLabel: string
}

const fixedBrazilHolidays = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Consciência Negra'],
  ['12-25', 'Natal'],
] as const

const fixedOpportunities = [
  ['01-15', 'Volta às aulas'],
  ['03-08', 'Dia Internacional da Mulher'],
  ['03-15', 'Dia do Consumidor'],
  ['04-01', 'Campanhas de outono'],
  ['05-12', 'Dia das Mães'],
  ['06-12', 'Dia dos Namorados'],
  ['06-24', 'São João / Festa Junina'],
  ['08-11', 'Dia dos Pais'],
  ['09-15', 'Dia do Cliente'],
  ['10-12', 'Dia das Crianças'],
  ['11-29', 'Black Friday'],
  ['12-24', 'Natal / campanhas de fim de ano'],
] as const

function formatDate(year: number, mmdd: string) {
  return `${year}-${mmdd}`
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function easterDate(year: number) {
  // Algoritmo de Meeus/Jones/Butcher para calendário gregoriano.
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day, 12)
}

export function getCalendarReferences(year: number): CalendarReference[] {
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear()
  const easter = easterDate(safeYear)

  const movableHolidays: CalendarReference[] = [
    { id: `holiday-${safeYear}-carnaval`, kind: 'holiday', date: toDateKey(addDays(easter, -47)), title: 'Carnaval', sourceLabel: 'Feriado nacional/ponto facultativo' },
    { id: `holiday-${safeYear}-sexta-santa`, kind: 'holiday', date: toDateKey(addDays(easter, -2)), title: 'Sexta-feira Santa', sourceLabel: 'Feriado nacional' },
    { id: `holiday-${safeYear}-pascoa`, kind: 'holiday', date: toDateKey(easter), title: 'Páscoa', sourceLabel: 'Data comemorativa' },
    { id: `holiday-${safeYear}-corpus-christi`, kind: 'holiday', date: toDateKey(addDays(easter, 60)), title: 'Corpus Christi', sourceLabel: 'Feriado/ponto facultativo' },
  ]

  const holidays: CalendarReference[] = fixedBrazilHolidays.map(([date, title]) => ({
    id: `holiday-${safeYear}-${date}`,
    kind: 'holiday',
    date: formatDate(safeYear, date),
    title,
    sourceLabel: 'Feriado Brasil',
  }))

  const opportunities: CalendarReference[] = fixedOpportunities.map(([date, title]) => ({
    id: `opportunity-${safeYear}-${date}`,
    kind: 'opportunity',
    date: formatDate(safeYear, date),
    title,
    sourceLabel: 'Oportunidade Social Media',
  }))

  return [...holidays, ...movableHolidays, ...opportunities].sort((a, b) => a.date.localeCompare(b.date))
}
