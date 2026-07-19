'use client'

// AMPY-V17-A19.1 — AGENDA RECORRENTE

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createCalendarEventAction, deleteCalendarEventAction, moveCalendarEventAction, updateCalendarEventAction } from '@/lib/actions'
import { getCalendarReferences } from '@/lib/calendar/calendar-data'
import { dateKeyInAmpyTimezone } from '@/lib/date'

const EVENT_TYPES = [
  [
    'reu_a',
    'REU A',
    'Reunião de alinhamento',
    '#6D28D9',
  ],
  [
    'reu_c',
    'REU C',
    'Reunião comercial',
    '#9333EA',
  ],
  [
    'cap_e',
    'CAP E',
    'Captação externa',
    '#C026D3',
  ],
  [
    'cap_s',
    'CAP S',
    'Captação em estúdio',
    '#DB2777',
  ],
  [
    'out_a',
    'OUT A',
    'Outro alinhamento',
    '#64748B',
  ],
] as const

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
function eventStyle(event: any) {
  if (event.all_day) return {}
  const start = Math.max(minutesFromDate(event.starts_at), startHour * 60)
  const end = Math.min(minutesFromDate(event.ends_at), endHour * 60)
  const top = ((start - startHour * 60) / 60) * hourHeight
  const height = Math.max(34, ((Math.max(end, start + 30) - start) / 60) * hourHeight - 4)
  return { top: `${top}px`, height: `${height}px` }
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

  const [
    selectedType,
    setSelectedType,
  ] = useState('reu_a')

  const [
    selectedClientId,
    setSelectedClientId,
  ] = useState('')

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

  const automaticTitle =
    selectedTypeData[1] +
    ' - ' +
    (
      selectedClient?.name ||
      'AMPY'
    )

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
    setRecurrenceMode('none')
    setAutoRecurrence(false)
    setRecurrenceUntil('')
    setSeriesScope('single')
    setError('')
    setShowModal(true)
  }

  function openEdit(
    event: any,
  ) {
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

    setRecurrenceMode(
      event.auto_recurrence
        ? 'every_4_weeks'
        : 'none',
    )

    setAutoRecurrence(
      Boolean(
        event.auto_recurrence,
      ),
    )

    setRecurrenceUntil(
      event.recurrence_until ||
      '',
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
    setShowModal(false); window.location.reload()
  }
  async function move(eventId: string, date: string) {
    const result = await moveCalendarEventAction(eventId, date)
    if ('error' in result) alert(result.error); else window.location.reload()
  }

  function renderEventButton(event: any, compact = false) {
    const [, label, color] = eventType(event.type)
    return <button
      className={compact ? 'calendar-event' : 'timeline-event'}
      key={event.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('event-id', event.id)}
      onClick={(e) => { e.stopPropagation(); openEdit(event) }}
      style={{ borderLeftColor: color, ...(compact ? {} : eventStyle(event)) }}
      title={`${event.title} · ${label}`}
    >
      <span>{event.all_day ? 'Dia inteiro' : localTime(event.starts_at)}</span>
      <b>{event.title}</b>
      {!compact && <small>{event.client?.name || event.work_item?.title || label}</small>}
    </button>
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
        <select className="fi compact" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">Todos os tipos</option>{EVENT_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
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
                  const dayRefs = refsVisible.filter((ref) => ref.date === key)
                  return <div className="timeline-day" key={key} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('event-id'); if (id) move(id, key) }}>
                    <div className="timeline-all-day">
                      {dayRefs.map((ref) => <span key={ref.id} className={`range-ref ${ref.kind === 'opportunity' ? 'opportunity' : 'holiday'}`}>{ref.kind === 'opportunity' ? '✦' : '●'} {ref.title}</span>)}
                      {allDayEvents.map((event: any) => renderEventButton(event, true))}
                    </div>
                    {hours.map((hour) => <button type="button" className="timeline-slot" key={`${key}-${hour}`} style={{ height: `${hourHeight}px` }} onClick={() => openCreate(key, `${String(hour).padStart(2,'0')}:00`)} aria-label={`Criar agenda em ${key} às ${hour}h`} />)}
                    {timedEvents.map((event: any) => renderEventButton(event))}
                  </div>
                })}
              </div>
            </div>
          </div>}
        </section>
        <aside className="agenda-side">
          <div className="side-card"><div className="stitle">Próximas agendas</div>{filteredEvents.slice(0, 8).map((event: any) => <button key={event.id} className="next-event" onClick={() => openEdit(event)}><span>{localTime(event.starts_at)}</span><div><b>{event.title}</b><small>{event.client?.name || event.responsible?.full_name || 'Interno Ampy'}</small></div></button>)}{filteredEvents.length === 0 && <div className="range-empty">Nenhuma agenda no período.</div>}</div>
          <div className="side-card"><div className="stitle">Legenda</div>{EVENT_TYPES.map(([id, label, color]) => <div className="legend-row" key={id}><i style={{ background: color }} /> {label}</div>)}</div>
        </aside>
      </div>
    </div>
    {showModal && <div className="modal-ov" onClick={() => setShowModal(false)}><div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><div><div className="modal-title">{editing ? 'Editar agenda' : 'Nova agenda'}</div><div className="modal-sub">Agenda cria blocos de execução. O prazo de demanda não é alterado ao mover a agenda.</div></div><button className="mclose" onClick={() => setShowModal(false)}><i className="ti ti-x" /></button></div>

<form onSubmit={submit}>
              <div className="modal-head">
                <div>
                  <h2>
                    {editing
                      ? 'Editar agenda'
                      : 'Nova agenda'}
                  </h2>

                  <p>
                    O título é criado automaticamente pelo tipo e pelo cliente.
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

                <div className="agenda-a19-title-preview">
                  <span>
                    Título automático
                  </span>

                  <strong>
                    {automaticTitle}
                  </strong>
                </div>

                <div className="frow">
                  <div className="fg">
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

                <div className="frow">
                  <div className="fg">
                    <label className="fl">
                      Cliente
                    </label>

                    <select
                      className="fi"
                      name="client_id"
                      value={selectedClientId}
                      onChange={(event) => {
                        const nextId =
                          event.target.value

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
                      }}
                    >
                      <option value="">
                        Interno — Ampy
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
                  </div>

                  <div className="fg">
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
                          next ===
                            'every_4_weeks',
                        )
                      }}
                    >
                      <option value="none">
                        Não recorrente
                      </option>

                      <option value="every_4_weeks">
                        A cada 4 semanas
                      </option>
                    </select>
                  </div>
                </div>

                {!editing &&
                  recurrenceMode ===
                    'every_4_weeks' && (
                    <div className="agenda-a19-recurrence-box">
                      <label className="agenda-a19-check agenda-a19-check-strong">
                        <input
                          type="checkbox"
                          name="auto_recurrence"
                          checked={
                            autoRecurrence
                          }
                          onChange={(
                            event,
                          ) =>
                            setAutoRecurrence(
                              event.target
                                .checked,
                            )
                          }
                        />

                        <span>
                          Criar as próximas agendas automaticamente
                        </span>
                      </label>

                      <p>
                        Será criada uma ocorrência a cada 28 dias.
                      </p>

                      {selectedContractEnd ? (
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

                          <div className="agenda-a19-contract-end">
                            <span>
                              Termina no fim do contrato
                            </span>

                            <strong>
                              {formatDate(
                                selectedContractEnd,
                              )}
                            </strong>
                          </div>
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
                            required={
                              autoRecurrence
                            }
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
                            Obrigatório para agenda interna ou cliente sem fim de contrato.
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

              <div className="modal-foot">
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
