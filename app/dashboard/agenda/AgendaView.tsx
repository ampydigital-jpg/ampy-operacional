'use client'

// AMPY-V17-A24-AGENDA-DINAMICA
// AMPY-V17-A24.1-INTERACAO-VISUAL

// AMPY-V17-A19.1 — AGENDA RECORRENTE
// AMPY-V17-A19.3 — TIPOS, RECORRÊNCIA E TOPO DA AGENDA
// AMPY-V17-A19.4 — RECORRÊNCIA AUTOMÁTICA
// AMPY-V17-A19.5 — CONFIRMAÇÃO, CORES E CONTATO PERSONALIZADO
// AMPY-V17-A19.6 — REFINO VISUAL DO MODAL DA AGENDA

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import {
  createCalendarEventAction,
  deleteCalendarEventAction,
  moveCalendarEventAction,
  resizeCalendarEventAction,
  toggleCalendarEventConfirmationAction,
  updateCalendarEventAction,
} from '@/lib/actions'
import { getCalendarReferences } from '@/lib/calendar/calendar-data'
import { dateKeyInAmpyTimezone } from '@/lib/date'


const EVENT_TYPES = [
  [
    'reu_a',
    'REU A',
    'Reunião de alinhamento',
    '#BBF7D0',
    '#14532D',
  ],
  [
    'reu_c',
    'REU C',
    'Reunião comercial',
    '#16A34A',
    '#FFFFFF',
  ],
  [
    'cap_e',
    'CAP E',
    'Captação externa',
    '#1D4ED8',
    '#FFFFFF',
  ],
  [
    'cap_s',
    'CAP S',
    'Captação em estúdio',
    '#BFDBFE',
    '#1E3A8A',
  ],
  [
    'out_a',
    'OUT A',
    'Outro alinhamento',
    '#CBD5E1',
    '#334155',
  ],
] as const

const UNCONFIRMED_COLOR =
  '#FECACA'

const UNCONFIRMED_TEXT_COLOR =
  '#991B1B'

const DRAG_START_THRESHOLD =
  6

const RECURRENCE_OPTIONS = [
  ['none', 'Não recorrente', 0],
  ['every_week', 'Semanal', 7],
  ['every_2_weeks', 'A cada 2 semanas', 14],
  ['every_4_weeks', 'A cada 4 semanas', 28],
] as const

function recurrenceModeFromRule(
  recurrenceRule?: string | null,
  autoRecurrence?: boolean,
) {
  if (!autoRecurrence) {
    return 'none'
  }

  const rule =
    String(recurrenceRule || '')

  if (
    rule.includes('INTERVAL=1') ||
    (
      rule.includes('FREQ=WEEKLY') &&
      !rule.includes('INTERVAL=')
    )
  ) {
    return 'every_week'
  }

  if (rule.includes('INTERVAL=2')) {
    return 'every_2_weeks'
  }

  return 'every_4_weeks'
}

function recurrenceDays(
  mode: string,
) {
  return (
    RECURRENCE_OPTIONS.find(
      ([id]) => id === mode,
    )?.[2] || 0
  )
}

const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const startHour = 7
const endHour = 22
const hourHeight = 58
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x }
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 12)
const localTime = (date: string) => new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const isDate = (date: string, value: string) => dateKeyInAmpyTimezone(date) === value
const timeValue = (date?: string) => date ? new Date(date).toTimeString().slice(0, 5) : '09:00'

function periodLabel(period: string, start: Date) {
  if (period === 'month') return `${monthNames[start.getMonth()]} ${start.getFullYear()}`
  if (period === 'day') return start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${addDays(start, Number(period)-1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
}
function navigate(period: string, start: Date, direction: number) {
  const step = period === 'month' ? new Date(start.getFullYear(), start.getMonth()+direction, 1, 12) : addDays(start, direction * (period === 'day' ? 1 : Number(period)))
  return `/dashboard/agenda?period=${period}&start=${ymd(step)}`
}
function eventType(
  type: string,
) {
  return (
    EVENT_TYPES.find(
      ([id]) => id === type,
    ) || [
      type || 'legacy',
      'LEGADO',
      'Agenda existente',
      '#64748B',
      '#FFFFFF',
    ]
  )
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return 'Sem data'
  }

  const clean =
    String(value).slice(0, 10)

  const parts =
    clean.split('-')

  if (parts.length !== 3) {
    return clean
  }

  return (
    parts[2] +
    '/' +
    parts[1] +
    '/' +
    parts[0]
  )
}
function minutesFromDate(value: string) { const date = new Date(value); return date.getHours() * 60 + date.getMinutes() }
function addHour(time: string) {
  const [h, m] = time.split(':').map(Number)
  const next = Math.min(h + 1, 23)
  return `${String(next).padStart(2,'0')}:${String(m || 0).padStart(2,'0')}`
}
type TimedEventLayout = {
  leftPercent: number
  widthPercent: number
}

function eventMinutes(value: string) {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

function layoutTimedEvents(events: any[]) {
  const sorted = [...events].sort((first: any, second: any) => {
    const startDiff = eventMinutes(first.starts_at) - eventMinutes(second.starts_at)
    if (startDiff !== 0) return startDiff
    return eventMinutes(first.ends_at) - eventMinutes(second.ends_at)
  })

  const layouts = new Map<string, TimedEventLayout>()
  let cluster: any[] = []
  let clusterEnd = -1

  const flush = () => {
    if (!cluster.length) return

    const columnEnds: number[] = []
    const placements: Array<{ id: string; column: number }> = []

    for (const event of cluster) {
      const start = eventMinutes(event.starts_at)
      const end = Math.max(start + 15, eventMinutes(event.ends_at))
      let column = columnEnds.findIndex((value) => value <= start)

      if (column < 0) {
        column = columnEnds.length
        columnEnds.push(end)
      } else {
        columnEnds[column] = end
      }

      placements.push({ id: event.id, column })
    }

    const totalColumns = Math.max(1, columnEnds.length)

    for (const placement of placements) {
      layouts.set(placement.id, {
        leftPercent: (placement.column * 100) / totalColumns,
        widthPercent: 100 / totalColumns,
      })
    }
  }

  for (const event of sorted) {
    const start = eventMinutes(event.starts_at)
    const end = Math.max(start + 15, eventMinutes(event.ends_at))

    if (cluster.length && start >= clusterEnd) {
      flush()
      cluster = []
      clusterEnd = -1
    }

    cluster.push(event)
    clusterEnd = Math.max(clusterEnd, end)
  }

  flush()
  return layouts
}

function eventStyle(
  event: any,
  layout?: TimedEventLayout,
) {
  if (event.all_day) return {}

  const start = Math.max(
    eventMinutes(event.starts_at),
    startHour * 60,
  )

  const end = Math.min(
    eventMinutes(event.ends_at),
    endHour * 60,
  )

  const top =
    ((start - startHour * 60) / 60) * hourHeight

  const height = Math.max(
    34,
    ((Math.max(end, start + 30) - start) / 60) * hourHeight - 4,
  )

  const leftPercent = layout?.leftPercent || 0
  const widthPercent = layout?.widthPercent || 100

  return {
    top: top + 'px',
    height: height + 'px',
    left: 'calc(' + leftPercent + '% + 4px)',
    right: 'auto',
    width: 'calc(' + widthPercent + '% - 8px)',
  }
}

function timelineDropTime(
  event: React.DragEvent<HTMLDivElement>,
) {
  const rectangle =
    event.currentTarget.getBoundingClientRect()

  const maximum =
    (endHour - startHour) * hourHeight

  const offset = Math.max(
    0,
    Math.min(
      maximum,
      event.clientY - rectangle.top,
    ),
  )

  const rawMinutes =
    startHour * 60 +
    (offset / hourHeight) * 60

  const snapped = Math.max(
    startHour * 60,
    Math.min(
      endHour * 60 - 15,
      Math.round(rawMinutes / 15) * 15,
    ),
  )

  const hour = Math.floor(snapped / 60)
  const minute = snapped % 60

  return (
    String(hour).padStart(2, '0') +
    ':' +
    String(minute).padStart(2, '0')
  )
}

function handleTimelineDragOver(
  event: React.DragEvent<HTMLDivElement>,
) {
  event.preventDefault()

  const wrapper =
    event.currentTarget.closest('.timeline-wrap') as HTMLElement | null

  if (!wrapper) return

  const rectangle = wrapper.getBoundingClientRect()
  const edge = 70

  if (event.clientY < rectangle.top + edge) {
    wrapper.scrollBy({ top: -24, behavior: 'auto' })
  } else if (event.clientY > rectangle.bottom - edge) {
    wrapper.scrollBy({ top: 24, behavior: 'auto' })
  }
}


export default function AgendaView({ events, clients, profiles, demands, period, start, end, loadErrors = [] }: any) {
  const safeEvents = Array.isArray(events) ? events.filter(Boolean) : []
  const safeClients = Array.isArray(clients) ? clients.filter(Boolean) : []
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : []
  const safeDemands = Array.isArray(demands) ? demands.filter(Boolean) : []
  const safeLoadErrors = Array.isArray(loadErrors) ? loadErrors.filter(Boolean) : []

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [draft, setDraft] = useState({ date: start, startTime: '09:00', endTime: '10:00' })
  const [clientFilter, setClientFilter] = useState('all')
  const [profileFilter, setProfileFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [demandFilter, setDemandFilter] = useState('all')
  const [showHoliday, setShowHoliday] = useState(true)
  const [showOpportunities, setShowOpportunities] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const suppressEventClickRef = useRef(false)

  const [
    selectedType,
    setSelectedType,
  ] = useState('reu_a')

  const [
    selectedClientId,
    setSelectedClientId,
  ] = useState('')

  const [
    contactMode,
    setContactMode,
  ] = useState<
    'client' |
    'custom' |
    'internal'
  >('internal')

  const [
    customName,
    setCustomName,
  ] = useState('')

  const [
    recurrenceEndMode,
    setRecurrenceEndMode,
  ] = useState<
    'contract' |
    'manual'
  >('manual')

  const [
    recurrenceMode,
    setRecurrenceMode,
  ] = useState('none')

  const [
    autoRecurrence,
    setAutoRecurrence,
  ] = useState(false)

  const [
    recurrenceUntil,
    setRecurrenceUntil,
  ] = useState('')

  const [
    seriesScope,
    setSeriesScope,
  ] = useState<
    'single' | 'future'
  >('single')

  const selectedClient =
    safeClients.find(
      (client: any) =>
        client.id ===
        selectedClientId,
    ) || null

  const selectedContractEnd =
    selectedClient
      ?.fim_contrato ||
    selectedClient
      ?.ended_at ||
    ''

  const selectedTypeData =
    eventType(selectedType)

  const titleTarget =
    contactMode === 'client'
      ? selectedClient?.name
      : contactMode === 'custom'
        ? customName
        : 'AMPY'

  const automaticTitle =
    selectedTypeData[1] +
    ' - ' +
    (
      String(
        titleTarget || 'AMPY',
      ).trim() ||
      'AMPY'
    ).toUpperCase()

  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  const refs = getCalendarReferences(startDate.getFullYear()).concat(endDate.getFullYear() === startDate.getFullYear() ? [] : getCalendarReferences(endDate.getFullYear()))
  const filteredEvents = useMemo(() => safeEvents.filter((event: any) =>
    (clientFilter === 'all' || event.client_id === clientFilter) &&
    (profileFilter === 'all' || event.responsible_id === profileFilter) &&
    (typeFilter === 'all' || event.type === typeFilter) &&
    (demandFilter === 'all' || event.work_item_id === demandFilter)
  ), [safeEvents, clientFilter, profileFilter, typeFilter, demandFilter])
  const refsVisible = refs.filter((ref) => (ref.kind === 'opportunity' ? showOpportunities : showHoliday) && ref.date >= start && ref.date < end)
  const isMonth = period === 'month'
  const isLongRange = period === '14' || period === '28'

  const monthCells = useMemo(() => {
    if (!isMonth) return []
    const first = startOfMonth(startDate)
    const startGrid = addDays(first, -first.getDay())
    const cells = []
    for (let i = 0; i < 42; i++) { const date = addDays(startGrid, i); cells.push({ date, key: ymd(date), current: date.getMonth() === first.getMonth() }) }
    return cells
  }, [isMonth, start])
  const rangeDays = useMemo(() => { const output = []; for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) output.push(new Date(d)); return output }, [start, end])
  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, index) => startHour + index), [])


  function openCreate(
    date = start,
    startTime = '09:00',
  ) {
    setEditing(null)

    setDraft({
      date,
      startTime,

      endTime:
        addHour(startTime),
    })

    setSelectedType('reu_a')
    setSelectedClientId('')
    setContactMode('internal')
    setCustomName('')
    setRecurrenceMode('none')
    setAutoRecurrence(false)
    setRecurrenceUntil('')
    setRecurrenceEndMode('manual')
    setSeriesScope('single')
    setError('')
    setShowModal(true)
  }


  function openEdit(
    event: any,
  ) {
    const eventClient =
      safeClients.find(
        (client: any) =>
          client.id ===
          event.client_id,
      ) || null

    const contractEnd =
      eventClient
        ?.fim_contrato ||
      eventClient
        ?.ended_at ||
      ''

    const eventUntil =
      String(
        event.recurrence_until ||
        '',
      ).slice(0, 10)

    setEditing(event)

    setDraft({
      date:
        dateKeyInAmpyTimezone(
          event.starts_at,
        ),

      startTime:
        timeValue(
          event.starts_at,
        ),

      endTime:
        timeValue(
          event.ends_at,
        ),
    })

    setSelectedType(
      EVENT_TYPES.some(
        ([id]) =>
          id === event.type,
      )
        ? event.type
        : 'out_a',
    )

    setSelectedClientId(
      event.client_id || '',
    )

    setContactMode(
      event.client_id
        ? 'client'
        : event.custom_name
          ? 'custom'
          : 'internal',
    )

    setCustomName(
      event.custom_name || '',
    )

    setRecurrenceMode(
      recurrenceModeFromRule(
        event.recurrence_rule,
        event.auto_recurrence,
      ),
    )

    setAutoRecurrence(
      Boolean(
        event.auto_recurrence,
      ),
    )

    setRecurrenceUntil(
      eventUntil,
    )

    setRecurrenceEndMode(
      contractEnd &&
      eventUntil ===
        String(
          contractEnd,
        ).slice(0, 10)
        ? 'contract'
        : 'manual',
    )

    setSeriesScope('single')
    setError('')
    setShowModal(true)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    const fd = new FormData(event.currentTarget)
    const result = editing ? await updateCalendarEventAction(editing.id, fd) : await createCalendarEventAction(fd)
    if ('error' in result) { setError(result.error || 'Erro ao salvar agenda'); setLoading(false); return }
    setLoading(false); setShowModal(false); window.location.reload()
  }
  async function remove() {
    if (!editing) {
      return
    }

    const message =
      editing.series_id &&
      seriesScope === 'future'
        ? 'Excluir esta agenda e todas as próximas da série?'
        : 'Excluir esta agenda?'

    if (!confirm(message)) {
      return
    }

    const result =
      await deleteCalendarEventAction(
        editing.id,
        seriesScope,
      )

    if ('error' in result) {
      setError(
        result.error ||
        'Erro inesperado.',
      )

      return
    }

    setShowModal(false)
    window.location.reload()
  }


  async function toggleConfirmation() {
    if (!editing) {
      return
    }

    setLoading(true)
    setError('')

    const nextConfirmed =
      !Boolean(
        editing.confirmed,
      )

    const result =
      await toggleCalendarEventConfirmationAction(
        editing.id,
        nextConfirmed,
      )

    if ('error' in result) {
      setError(
        result.error ||
        'Erro ao alterar a confirmação.',
      )

      setLoading(false)
      return
    }

    setLoading(false)
    setShowModal(false)
    window.location.reload()
  }

  async function move(
    eventId: string,
    date: string,
    time?: string,
  ) {
    const result =
      await moveCalendarEventAction(
        eventId,
        date,
        time,
      )

    if ('error' in result) {
      alert(result.error)
      return
    }

    window.location.reload()
  }

  async function resizeEvent(
    eventId: string,
    nextEndAt: string,
  ) {
    const result =
      await resizeCalendarEventAction(
        eventId,
        nextEndAt,
      )

    if ('error' in result) {
      alert(result.error)
    }

    window.location.reload()
  }

  function beginMove(
    pointerEvent: React.PointerEvent<HTMLButtonElement>,
    event: any,
  ) {
    if (pointerEvent.button !== 0) {
      return
    }

    if (
      pointerEvent.pointerType === 'mouse' &&
      pointerEvent.buttons !== 1
    ) {
      return
    }

    const target =
      pointerEvent.target as HTMLElement

    if (
      target.closest(
        '.timeline-resize-handle',
      )
    ) {
      return
    }

    const eventElement =
      pointerEvent.currentTarget

    const wrapper =
      eventElement.closest(
        '.timeline-wrap',
      ) as HTMLElement | null

    const pointerId =
      pointerEvent.pointerId

    const pointerStartX =
      pointerEvent.clientX

    const pointerStartY =
      pointerEvent.clientY

    const scrollStartLeft =
      wrapper?.scrollLeft || 0

    const scrollStartTop =
      wrapper?.scrollTop || 0

    const originalTransform =
      eventElement.style.transform

    let started = false
    let lastClientX = pointerStartX
    let lastClientY = pointerStartY

    suppressEventClickRef.current = false

    const removeListeners = () => {
      window.removeEventListener(
        'pointermove',
        handleMove,
      )

      window.removeEventListener(
        'pointerup',
        handleUp,
      )

      window.removeEventListener(
        'pointercancel',
        handleCancel,
      )
    }

    const resetClickGuard = () => {
      window.setTimeout(
        () => {
          suppressEventClickRef.current =
            false
        },
        120,
      )
    }

    const handleMove = (
      nativeEvent: PointerEvent,
    ) => {
      if (
        nativeEvent.pointerId !==
        pointerId
      ) {
        return
      }

      lastClientX =
        nativeEvent.clientX

      lastClientY =
        nativeEvent.clientY

      const deltaX =
        nativeEvent.clientX -
        pointerStartX

      const deltaY =
        nativeEvent.clientY -
        pointerStartY

      if (!started) {
        if (
          Math.hypot(
            deltaX,
            deltaY,
          ) <
          DRAG_START_THRESHOLD
        ) {
          return
        }

        started = true
        suppressEventClickRef.current = true

        eventElement.classList.add(
          'is-dragging',
        )

        document.body.classList.add(
          'agenda-is-dragging',
        )
      }

      nativeEvent.preventDefault()

      if (wrapper) {
        const rectangle =
          wrapper.getBoundingClientRect()

        const edge = 72

        let scrollTop = 0
        let scrollLeft = 0

        if (
          nativeEvent.clientY <
          rectangle.top + edge
        ) {
          scrollTop = -28
        } else if (
          nativeEvent.clientY >
          rectangle.bottom - edge
        ) {
          scrollTop = 28
        }

        if (
          nativeEvent.clientX <
          rectangle.left + edge
        ) {
          scrollLeft = -28
        } else if (
          nativeEvent.clientX >
          rectangle.right - edge
        ) {
          scrollLeft = 28
        }

        if (
          scrollTop ||
          scrollLeft
        ) {
          wrapper.scrollBy({
            top: scrollTop,
            left: scrollLeft,
            behavior: 'auto',
          })
        }
      }

      const scrollDeltaX =
        wrapper
          ? wrapper.scrollLeft -
            scrollStartLeft
          : 0

      const scrollDeltaY =
        wrapper
          ? wrapper.scrollTop -
            scrollStartTop
          : 0

      eventElement.style.transform =
        'translate3d(' +
        (
          deltaX +
          scrollDeltaX
        ) +
        'px, ' +
        (
          deltaY +
          scrollDeltaY
        ) +
        'px, 0)'
    }

    const finish = (
      nativeEvent: PointerEvent,
      cancelled: boolean,
    ) => {
      if (
        nativeEvent.pointerId !==
        pointerId
      ) {
        return
      }

      removeListeners()

      if (!started) {
        return
      }

      const clientX =
        Number.isFinite(
          nativeEvent.clientX,
        )
          ? nativeEvent.clientX
          : lastClientX

      const clientY =
        Number.isFinite(
          nativeEvent.clientY,
        )
          ? nativeEvent.clientY
          : lastClientY

      const previousPointerEvents =
        eventElement.style.pointerEvents

      eventElement.style.pointerEvents =
        'none'

      const dropTarget =
        document.elementFromPoint(
          clientX,
          clientY,
        ) as HTMLElement | null

      eventElement.style.pointerEvents =
        previousPointerEvents

      const dayElement =
        dropTarget?.closest(
          '.timeline-day',
        ) as HTMLElement | null

      eventElement.style.transform =
        originalTransform

      eventElement.classList.remove(
        'is-dragging',
      )

      document.body.classList.remove(
        'agenda-is-dragging',
      )

      resetClickGuard()

      if (
        cancelled ||
        !dayElement ||
        !dayElement.dataset.date
      ) {
        return
      }

      const rectangle =
        dayElement.getBoundingClientRect()

      const maximum =
        (
          endHour -
          startHour
        ) *
        hourHeight

      const offset =
        Math.max(
          0,
          Math.min(
            maximum,
            clientY -
              rectangle.top,
          ),
        )

      const rawMinutes =
        startHour * 60 +
        (
          offset /
          hourHeight
        ) *
        60

      const snapped =
        Math.max(
          startHour * 60,
          Math.min(
            endHour * 60 - 15,
            Math.round(
              rawMinutes / 15,
            ) * 15,
          ),
        )

      const hour =
        Math.floor(
          snapped / 60,
        )

      const minute =
        snapped % 60

      const nextTime =
        String(hour).padStart(
          2,
          '0',
        ) +
        ':' +
        String(minute).padStart(
          2,
          '0',
        )

      void move(
        event.id,
        dayElement.dataset.date,
        nextTime,
      )
    }

    const handleUp = (
      nativeEvent: PointerEvent,
    ) => {
      finish(
        nativeEvent,
        false,
      )
    }

    const handleCancel = (
      nativeEvent: PointerEvent,
    ) => {
      finish(
        nativeEvent,
        true,
      )
    }

    window.addEventListener(
      'pointermove',
      handleMove,
    )

    window.addEventListener(
      'pointerup',
      handleUp,
    )

    window.addEventListener(
      'pointercancel',
      handleCancel,
    )
  }

  function beginResize(
    pointerEvent: React.PointerEvent<HTMLSpanElement>,
    event: any,
  ) {
    pointerEvent.preventDefault()
    pointerEvent.stopPropagation()

    const eventElement =
      pointerEvent.currentTarget.closest('.timeline-event') as HTMLElement | null

    if (!eventElement) return

    const pointerStart = pointerEvent.clientY
    const startDate = new Date(event.starts_at)
    const endDate = new Date(event.ends_at)
    const originalMinutes = Math.max(
      15,
      Math.round((endDate.getTime() - startDate.getTime()) / 60000),
    )
    const originalHeight = eventElement.getBoundingClientRect().height

    const handleMove = (nativeEvent: PointerEvent) => {
      const deltaPixels = nativeEvent.clientY - pointerStart
      const deltaMinutes = Math.round(
        ((deltaPixels / hourHeight) * 60) / 15,
      ) * 15
      const nextMinutes = Math.max(15, originalMinutes + deltaMinutes)
      const nextHeight = Math.max(
        34,
        (nextMinutes / 60) * hourHeight - 4,
      )

      eventElement.style.height = nextHeight + 'px'
      eventElement.classList.add('is-resizing')
    }

    const handleUp = (nativeEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)

      const deltaPixels = nativeEvent.clientY - pointerStart
      const deltaMinutes = Math.round(
        ((deltaPixels / hourHeight) * 60) / 15,
      ) * 15
      const nextMinutes = Math.max(15, originalMinutes + deltaMinutes)
      const nextEnd = new Date(
        startDate.getTime() + nextMinutes * 60000,
      )

      eventElement.style.height = originalHeight + 'px'
      eventElement.classList.remove('is-resizing')
      void resizeEvent(event.id, nextEnd.toISOString())
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function renderEventButton(
    event: any,
    compact = false,
    layout?: TimedEventLayout,
  ) {
    const [
      ,
      ,
      label,
      typeColor,
      typeTextColor,
    ] = eventType(
      event.type,
    )

    const backgroundColor =
      event.confirmed
        ? typeColor
        : UNCONFIRMED_COLOR

    const foregroundColor =
      event.confirmed
        ? typeTextColor
        : UNCONFIRMED_TEXT_COLOR

    const accentColor =
      event.confirmed
        ? typeColor
        : '#EF4444'

    const className =
      (
        compact
          ? 'calendar-event'
          : 'timeline-event'
      ) +
      (
        event.confirmed
          ? ' is-confirmed'
          : ' is-pending'
      )

    return (
      <button
        type="button"
        className={className}
        key={event.id}
        draggable={compact}
        onDragStart={(dragEvent) => {
          if (!compact) {
            dragEvent.preventDefault()
            return
          }

          suppressEventClickRef.current =
            true

          dragEvent.dataTransfer.effectAllowed =
            'move'

          dragEvent.dataTransfer.setData(
            'event-id',
            event.id,
          )
        }}
        onDragEnd={() => {
          window.setTimeout(
            () => {
              suppressEventClickRef.current =
                false
            },
            120,
          )
        }}
        onPointerDown={
          compact
            ? undefined
            : (pointerEvent) =>
                beginMove(
                  pointerEvent,
                  event,
                )
        }
        onClick={(clickEvent) => {
          clickEvent.stopPropagation()

          if (
            suppressEventClickRef.current
          ) {
            clickEvent.preventDefault()
            return
          }

          openEdit(event)
        }}
        style={
          {
            '--agenda-event-background':
              backgroundColor,

            '--agenda-event-color':
              foregroundColor,

            '--agenda-event-accent':
              accentColor,

            ...(compact
              ? {}
              : eventStyle(
                  event,
                  layout,
                )),
          } as React.CSSProperties & {
            '--agenda-event-background': string
            '--agenda-event-color': string
            '--agenda-event-accent': string
          }
        }
        title={
          event.title +
          ' · ' +
          label +
          ' · ' +
          (
            event.confirmed
              ? 'Confirmada'
              : 'Aguardando confirmação'
          )
        }
      >
        <span className="agenda-event-time">
          {event.all_day
            ? 'Dia inteiro'
            : localTime(
                event.starts_at,
              )}
        </span>

        <span className="agenda-event-title">
          {event.title}
        </span>

        {!compact && (
          <small className="agenda-event-meta">
            {event.client?.name ||
              event.custom_name ||
              event.work_item?.title ||
              label}
          </small>
        )}

        {!compact && (
          <span
            className="timeline-resize-handle"
            role="separator"
            aria-label="Redimensionar agenda"
            onPointerDown={(pointerEvent) =>
              beginResize(
                pointerEvent,
                event,
              )
            }
          />
        )}
      </button>
    )
  }

  return <div className="page-wrap ops-page">
    <div className="topbar">
      <div className="tb-title">Agenda</div>
      <div className="tb-sub">{periodLabel(period, startDate)}</div>
      <div className="agenda-periods">{[['day','Dia'],['7','7d'],['14','14d'],['28','28d'],['month','Mês']].map(([key, label]) => <Link key={key} href={`/dashboard/agenda?period=${key}&start=${start}`} className={`fb ${period === key ? 'on' : ''}`}>{label}</Link>)}</div>
      <Link href={navigate(period, startDate, -1)} className="bico"><i className="ti ti-chevron-left" /></Link>
      <Link href={navigate(period, startDate, 1)} className="bico"><i className="ti ti-chevron-right" /></Link>
      <button className="bpri" onClick={() => openCreate()}><i className="ti ti-plus" /> Nova agenda</button>
    </div>
    <div className="agenda-content">
      <div className="agenda-filters">
        <select className="fi compact" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}><option value="all">Todos os clientes</option>{safeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        <select className="fi compact" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}><option value="all">Toda equipe</option>{safeProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
        <select className="fi compact" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">Todos os tipos</option>{EVENT_TYPES.map(([id, code, label]) => <option key={id} value={id}>{code} — {label}</option>)}</select>
        <select className="fi compact" value={demandFilter} onChange={(e) => setDemandFilter(e.target.value)}><option value="all">Todas demandas</option>{safeDemands.map((demand: any) => <option key={demand.id} value={demand.id}>{demand.title}</option>)}</select>
        <button className={`fb ${showHoliday ? 'on' : ''}`} onClick={() => setShowHoliday(!showHoliday)}>Feriados</button>
        <button className={`fb ${showOpportunities ? 'on' : ''}`} onClick={() => setShowOpportunities(!showOpportunities)}>Datas de marketing</button>
      </div>
      {safeLoadErrors.length > 0 && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{safeLoadErrors.join(' | ')}</span></div>}
      <div className={isMonth ? 'agenda-layout' : 'agenda-layout range-layout'}>
        <section className="calendar-shell">
          {isMonth ? <>
            <div className="calendar-weekdays">{dayNames.map((name) => <div key={name}>{name}</div>)}</div>
            <div className="calendar-month-grid">{monthCells.map(({ date, key, current }) => {
              const dayEvents = filteredEvents.filter((event: any) => isDate(event.starts_at, key))
              const dayRefs = refsVisible.filter((ref) => ref.date === key)
              const today = key === ymd(new Date())
              return <div className={`calendar-cell ${current ? '' : 'muted'} ${today ? 'today' : ''}`} key={key} onClick={() => current && openCreate(key)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('event-id'); if (id) move(id, key) }}>
                <div className="calendar-day-number">{date.getDate()}</div>
                {dayRefs.slice(0, 2).map((ref) => <div key={ref.id} className={`calendar-ref ${ref.kind === 'opportunity' ? 'opportunity' : 'holiday'}`} title={`${ref.title} · ${ref.sourceLabel}`}>{ref.kind === 'opportunity' ? '✦' : '●'} {ref.title}</div>)}
                {dayEvents.slice(0, 3).map((event: any) => renderEventButton(event, true))}
                {dayEvents.length > 3 && <div className="calendar-more">+{dayEvents.length - 3} agendas</div>}
              </div>
            })}</div>
          </> : isLongRange ? <div className={`agenda-range-grid agenda-range-${period}`}>
            {rangeDays.map((day) => {
              const key = ymd(day)
              const dayEvents = filteredEvents.filter((event: any) => isDate(event.starts_at, key))
              const dayRefs = refsVisible.filter((ref) => ref.date === key)
              return <button type="button" className="agenda-range-day" key={key} onClick={() => openCreate(key)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('event-id'); if (id) move(id, key) }}>
                <div className="agenda-range-head"><span>{dayNames[day.getDay()]}</span><b>{day.getDate()}</b></div>
                <div className="agenda-range-list">
                  {dayRefs.slice(0, 2).map((ref) => <div key={ref.id} className={`range-ref ${ref.kind === 'opportunity' ? 'opportunity' : 'holiday'}`}>{ref.kind === 'opportunity' ? '✦' : '●'} {ref.title}</div>)}
                  {dayEvents.slice(0, 5).map((event: any) => renderEventButton(event, true))}
                  {dayEvents.length === 0 && dayRefs.length === 0 && <div className="range-empty compact">Livre</div>}
                  {dayEvents.length > 5 && <div className="calendar-more">+{dayEvents.length - 5} agendas</div>}
                </div>
              </button>
            })}
          </div> : <div className="timeline-wrap">
            <div className="timeline-head" style={{ gridTemplateColumns: `72px repeat(${rangeDays.length}, minmax(${period === 'day' ? '560px' : '190px'}, 1fr))` }}><div className="timeline-corner">Horário</div>{rangeDays.map((day) => <div className="timeline-day-head" key={ymd(day)}><b>{dayNames[day.getDay()]}</b><span>{day.getDate()}</span></div>)}</div>
            <div className="timeline-body" style={{ height: `${(endHour - startHour) * hourHeight}px` }}>
              <div className="timeline-hours">{hours.map((hour) => <div className="timeline-hour" key={hour} style={{ height: `${hourHeight}px` }}>{String(hour).padStart(2,'0')}:00</div>)}</div>
              <div className="timeline-days" style={{ gridTemplateColumns: `repeat(${rangeDays.length}, minmax(${period === 'day' ? '560px' : '190px'}, 1fr))` }}>
                {rangeDays.map((day) => {
                  const key = ymd(day)
                  const dayEvents = filteredEvents.filter((event: any) => isDate(event.starts_at, key))
                  const timedEvents = dayEvents.filter((event: any) => !event.all_day)
                  const allDayEvents = dayEvents.filter((event: any) => event.all_day)
                  const timedLayout = layoutTimedEvents(timedEvents)
                  const dayRefs = refsVisible.filter((ref) => ref.date === key)
                  return <div
                    className="timeline-day"
                    data-date={key}
                    key={key}
                    onDragOver={handleTimelineDragOver}
                    onDrop={(dropEvent) => {
                      dropEvent.preventDefault()
                      const id = dropEvent.dataTransfer.getData('event-id')
                      if (id) {
                        move(
                          id,
                          key,
                          timelineDropTime(dropEvent),
                        )
                      }
                    }}
                  >
                    <div className="timeline-all-day">
                      {dayRefs.map((ref) => <span key={ref.id} className={`range-ref ${ref.kind === 'opportunity' ? 'opportunity' : 'holiday'}`}>{ref.kind === 'opportunity' ? '✦' : '●'} {ref.title}</span>)}
                      {allDayEvents.map((event: any) => renderEventButton(event, true))}
                    </div>
                    {hours.map((hour) => <button type="button" className="timeline-slot" key={`${key}-${hour}`} style={{ height: `${hourHeight}px` }} onClick={() => openCreate(key, `${String(hour).padStart(2,'0')}:00`)} aria-label={`Criar agenda em ${key} às ${hour}h`} />)}
                    {timedEvents.map((event: any) =>
                      renderEventButton(
                        event,
                        false,
                        timedLayout.get(event.id),
                      ),
                    )}
                  </div>
                })}
              </div>
            </div>
          </div>}
        </section>
        <aside className="agenda-side">
          <div className="side-card"><div className="stitle">Próximas agendas</div>{filteredEvents.slice(0, 8).map((event: any) => <button key={event.id} className="next-event" onClick={() => openEdit(event)}><span>{localTime(event.starts_at)}</span><div><b>{event.title}</b><small>{event.client?.name || event.custom_name || event.responsible?.full_name || 'Interno Ampy'}</small></div></button>)}{filteredEvents.length === 0 && <div className="range-empty">Nenhuma agenda no período.</div>}</div>
          <div className="side-card"><div className="stitle">Legenda</div><div className="legend-row agenda-pending-legend"><i style={{ background: UNCONFIRMED_COLOR }} /> Aguardando confirmação</div>{EVENT_TYPES.map(([id, code, label, color]) => <div className="legend-row" key={id}><i style={{ background: color }} /> {code} — {label}</div>)}</div>
        </aside>
      </div>
    </div>
    {showModal && <div className="modal-ov" onClick={() => setShowModal(false)}><div className="modal modal-wide agenda-a19-modal" onClick={(e) => e.stopPropagation()}>


<form className="agenda-a19-form" onSubmit={submit}>
              <div className="modal-head">
                <div>
                  <h2>
                    {editing
                      ? 'Editar agenda'
                      : 'Nova agenda'}
                  </h2>

                  <p>
                    O título é criado automaticamente pelo tipo e pelo vínculo selecionado.
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() =>
                    setShowModal(false)
                  }
                >
                  <i className="ti ti-x" />
                </button>
              </div>

              <div className="modal-body agenda-a19-modal-body">
                <input
                  type="hidden"
                  name="title"
                  value={automaticTitle}
                />


                <div className="agenda-a19-top-grid">
                  <div className="agenda-a19-title-preview">
                    <span>
                      Título automático
                    </span>

                    <strong>
                      {automaticTitle}
                    </strong>
                  </div>

                  <div className="fg agenda-a19-top-type">
                    <label className="fl">
                      Tipo *
                    </label>

                    <select
                      className="fi"
                      name="type"
                      required
                      value={selectedType}
                      onChange={(event) =>
                        setSelectedType(
                          event.target.value,
                        )
                      }
                    >
                      {EVENT_TYPES.map(
                        ([
                          id,
                          code,
                          label,
                        ]) => (
                          <option
                            key={id}
                            value={id}
                          >
                            {code} — {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>



                <div className="agenda-a19-link-shell">
                  <div className="fg agenda-a19-link-field">
                    <label className="fl">
                      Vínculo
                    </label>

                    <div className="agenda-a19-link-options agenda-a19-link-segmented">
                      <label
                        className={
                          contactMode ===
                          'client'
                            ? 'active'
                            : ''
                        }
                      >
                        <input
                          type="radio"
                          name="contact_mode"
                          value="client"
                          checked={
                            contactMode ===
                            'client'
                          }
                          onChange={() => {
                            setContactMode(
                              'client',
                            )

                            if (
                              selectedContractEnd
                            ) {
                              setRecurrenceEndMode(
                                'contract',
                              )

                              setRecurrenceUntil(
                                selectedContractEnd,
                              )
                            }
                          }}
                        />

                        <i className="ti ti-building-store" />

                        <span>
                          Cliente
                        </span>
                      </label>

                      <label
                        className={
                          contactMode ===
                          'custom'
                            ? 'active'
                            : ''
                        }
                      >
                        <input
                          type="radio"
                          name="contact_mode"
                          value="custom"
                          checked={
                            contactMode ===
                            'custom'
                          }
                          onChange={() => {
                            setContactMode(
                              'custom',
                            )

                            setSelectedClientId(
                              '',
                            )

                            setRecurrenceEndMode(
                              'manual',
                            )

                            setRecurrenceUntil(
                              '',
                            )
                          }}
                        />

                        <i className="ti ti-user-plus" />

                        <span>
                          Nome personalizado
                        </span>
                      </label>

                      <label
                        className={
                          contactMode ===
                          'internal'
                            ? 'active'
                            : ''
                        }
                      >
                        <input
                          type="radio"
                          name="contact_mode"
                          value="internal"
                          checked={
                            contactMode ===
                            'internal'
                          }
                          onChange={() => {
                            setContactMode(
                              'internal',
                            )

                            setSelectedClientId(
                              '',
                            )

                            setCustomName('')
                            setRecurrenceEndMode(
                              'manual',
                            )

                            setRecurrenceUntil(
                              '',
                            )
                          }}
                        />

                        <i className="ti ti-home" />

                        <span>
                          Interno Ampy
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="frow agenda-a19-contact-row">
                    <div className="fg">
                      <label className="fl">
                        {contactMode ===
                        'client'
                          ? 'Cliente'
                          : contactMode ===
                              'custom'
                            ? 'Nome personalizado'
                            : 'Identificação'}
                      </label>

                      {contactMode ===
                        'client' && (
                        <select
                          className="fi"
                          name="client_id"
                          required
                          value={
                            selectedClientId
                          }
                          onChange={(event) => {
                            const nextId =
                              event.target
                                .value

                            setSelectedClientId(
                              nextId,
                            )

                            const nextClient =
                              safeClients.find(
                                (
                                  client: any,
                                ) =>
                                  client.id ===
                                  nextId,
                              )

                            const nextEnd =
                              nextClient
                                ?.fim_contrato ||
                              nextClient
                                ?.ended_at ||
                              ''

                            setRecurrenceUntil(
                              nextEnd,
                            )

                            setRecurrenceEndMode(
                              nextEnd
                                ? 'contract'
                                : 'manual',
                            )
                          }}
                        >
                          <option value="">
                            Selecione o cliente
                          </option>

                          {safeClients.map(
                            (
                              client: any,
                            ) => (
                              <option
                                key={
                                  client.id
                                }
                                value={
                                  client.id
                                }
                              >
                                {client.name}
                              </option>
                            ),
                          )}
                        </select>
                      )}

                      {contactMode ===
                        'custom' && (
                        <input
                          className="fi"
                          name="custom_name"
                          required
                          value={customName}
                          onChange={(event) =>
                            setCustomName(
                              event.target
                                .value,
                            )
                          }
                          placeholder="Nome do lead, parceiro ou contato"
                          maxLength={120}
                        />
                      )}

                      {contactMode ===
                        'internal' && (
                        <div className="agenda-a19-internal-hint">
                          <i className="ti ti-home" />

                          <span>
                            AMPY
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="fg">
                      <label className="fl">
                        Responsável
                      </label>

                      <select
                        className="fi"
                        name="responsible_id"
                        defaultValue={
                          editing
                            ?.responsible_id ||
                          ''
                        }
                      >
                        <option value="">
                          Definir depois
                        </option>

                        {safeProfiles.map(
                          (
                            profile: any,
                          ) => (
                            <option
                              key={
                                profile.id
                              }
                              value={
                                profile.id
                              }
                            >
                              {
                                profile.full_name
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="fg agenda-a19-demand-row">
                  <label className="fl">
                    Demanda vinculada
                  </label>

                  <select
                    className="fi"
                    name="work_item_id"
                    defaultValue={
                      editing
                        ?.work_item_id ||
                      ''
                    }
                  >
                    <option value="">
                      Não vincular
                    </option>

                    {safeDemands.map(
                      (
                        demand: any,
                      ) => (
                        <option
                          key={
                            demand.id
                          }
                          value={
                            demand.id
                          }
                        >
                          {demand.title}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <label className="agenda-a19-check">
                  <input
                    type="checkbox"
                    name="all_day"
                    defaultChecked={
                      Boolean(
                        editing?.all_day,
                      )
                    }
                  />

                  <span>
                    Agenda de dia inteiro
                  </span>
                </label>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Início
                    </label>

                    <input
                      className="fi"
                      type="date"
                      name="start_date"
                      required
                      defaultValue={
                        draft.date
                      }
                    />

                    <input
                      className="fi"
                      type="time"
                      name="start_time"
                      required
                      defaultValue={
                        draft.startTime
                      }
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Término
                    </label>

                    <input
                      className="fi"
                      type="date"
                      name="end_date"
                      required
                      defaultValue={
                        draft.date
                      }
                    />

                    <input
                      className="fi"
                      type="time"
                      name="end_time"
                      required
                      defaultValue={
                        draft.endTime
                      }
                    />
                  </div>
                </div>

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Local
                    </label>

                    <input
                      className="fi"
                      name="location"
                      defaultValue={
                        editing?.location ||
                        ''
                      }
                      placeholder="Local, endereço ou link"
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">
                      Recorrência
                    </label>

                    <select
                      className="fi"
                      name="recurrence_mode"
                      value={recurrenceMode}
                      disabled={
                        Boolean(editing)
                      }
                      onChange={(event) => {
                        const next =
                          event.target.value

                        setRecurrenceMode(
                          next,
                        )

                        setAutoRecurrence(
                          next !== 'none',
                        )
                      }}
                    >
                      {RECURRENCE_OPTIONS.map(
                        ([id, label]) => (
                          <option
                            key={id}
                            value={id}
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>


                {!editing &&
                  recurrenceMode !==
                    'none' && (
                    <div className="agenda-a19-recurrence-box">
                      <input
                        type="hidden"
                        name="auto_recurrence"
                        value="on"
                      />

                      <div className="agenda-a19-auto-active">
                        <i className="ti ti-repeat" />

                        <div>
                          <strong>
                            Recorrência automática ativada
                          </strong>

                          <span>
                            As próximas agendas serão criadas conforme o intervalo selecionado.
                          </span>
                        </div>
                      </div>

                      <p>
                        Será criada uma ocorrência a cada{' '}
                        {recurrenceDays(
                          recurrenceMode,
                        )}{' '}
                        dias.
                      </p>

                      {selectedContractEnd && (
                        <div className="agenda-a19-contract-end">
                          <span>
                            Data final do contrato
                          </span>

                          <strong>
                            {formatDate(
                              selectedContractEnd,
                            )}
                          </strong>
                        </div>
                      )}

                      <div className="agenda-a19-recurrence-end-options">
                        {selectedContractEnd && (
                          <label
                            className={
                              recurrenceEndMode ===
                              'contract'
                                ? 'active'
                                : ''
                            }
                          >
                            <input
                              type="radio"
                              name="recurrence_end_mode"
                              value="contract"
                              checked={
                                recurrenceEndMode ===
                                'contract'
                              }
                              onChange={() => {
                                setRecurrenceEndMode(
                                  'contract',
                                )

                                setRecurrenceUntil(
                                  selectedContractEnd,
                                )
                              }}
                            />

                            Usar fim do contrato
                          </label>
                        )}

                        <label
                          className={
                            recurrenceEndMode ===
                            'manual'
                              ? 'active'
                              : ''
                          }
                        >
                          <input
                            type="radio"
                            name="recurrence_end_mode"
                            value="manual"
                            checked={
                              recurrenceEndMode ===
                              'manual'
                            }
                            onChange={() =>
                              setRecurrenceEndMode(
                                'manual',
                              )
                            }
                          />

                          Escolher data manual
                        </label>
                      </div>

                      {recurrenceEndMode ===
                        'contract' &&
                      selectedContractEnd ? (
                        <>
                          <input
                            type="hidden"
                            name="use_contract_end"
                            value="on"
                          />

                          <input
                            type="hidden"
                            name="recurrence_until"
                            value={
                              selectedContractEnd
                            }
                          />
                        </>
                      ) : (
                        <div className="fg">
                          <label className="fl">
                            Repetir até *
                          </label>

                          <input
                            className="fi"
                            type="date"
                            name="recurrence_until"
                            required
                            min={
                              draft.date
                            }
                            value={
                              recurrenceUntil
                            }
                            onChange={(
                              event,
                            ) =>
                              setRecurrenceUntil(
                                event.target
                                  .value,
                              )
                            }
                          />

                          <small>
                            Esta data vale apenas para esta série e não altera o contrato.
                          </small>
                        </div>
                      )}
                    </div>
                  )}

                {editing?.series_id && (
                  <div className="agenda-a19-series-scope">
                    <strong>
                      Esta agenda pertence a uma série
                    </strong>

                    <label>
                      <input
                        type="radio"
                        name="series_scope"
                        value="single"
                        checked={
                          seriesScope ===
                          'single'
                        }
                        onChange={() =>
                          setSeriesScope(
                            'single',
                          )
                        }
                      />

                      Somente esta agenda
                    </label>

                    <label>
                      <input
                        type="radio"
                        name="series_scope"
                        value="future"
                        checked={
                          seriesScope ===
                          'future'
                        }
                        onChange={() =>
                          setSeriesScope(
                            'future',
                          )
                        }
                      />

                      Esta e as próximas
                    </label>
                  </div>
                )}

                <div className="fg">
                  <label className="fl">
                    Link Drive
                  </label>

                  <input
                    className="fi"
                    type="url"
                    name="drive_link"
                    defaultValue={
                      editing
                        ?.drive_link ||
                      ''
                    }
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div className="fg">
                  <label className="fl">
                    Observações
                  </label>

                  <textarea
                    className="fi"
                    name="notes"
                    rows={4}
                    defaultValue={
                      editing?.notes ||
                      ''
                    }
                  />
                </div>

                {error && (
                  <div className="notice notice-err">
                    <i className="ti ti-alert-circle" />

                    <span>
                      {error}
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-foot agenda-a19-modal-foot">
                {editing && (
                  <button
                    type="button"
                    className={
                      editing.confirmed
                        ? 'bsec agenda-unconfirm-button'
                        : 'bpri agenda-confirm-button'
                    }
                    onClick={
                      toggleConfirmation
                    }
                    disabled={loading}
                  >
                    <i
                      className={
                        editing.confirmed
                          ? 'ti ti-circle-x'
                          : 'ti ti-circle-check'
                      }
                    />

                    {editing.confirmed
                      ? 'Desconfirmar agenda'
                      : 'Confirmar agenda'}
                  </button>
                )}
                {editing && (
                  <button
                    type="button"
                    className="bsec danger-button"
                    onClick={remove}
                  >
                    Excluir
                  </button>
                )}

                <button
                  type="button"
                  className="bsec"
                  onClick={() =>
                    setShowModal(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  className="bpri"
                  disabled={loading}
                >
                  {loading
                    ? 'Salvando...'
                    : editing
                      ? 'Salvar agenda'
                      : 'Criar agenda'}
                </button>
              </div>
            </form>
    </div></div>}
  </div>
}
