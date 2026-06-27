'use client'
import { useState } from 'react'
import { createCalendarEventAction } from '@/lib/actions'

// Feriados nacionais fixos (dia/mês)
const FERIADOS_FIXOS: Record<string, string> = {
  '01/01': 'Confraternização Universal',
  '21/04': 'Tiradentes',
  '01/05': 'Dia do Trabalho',
  '07/09': 'Independência do Brasil',
  '12/10': 'Nossa Sra. Aparecida',
  '02/11': 'Finados',
  '15/11': 'Proclamação da República',
  '25/12': 'Natal',
  '24/12': 'Véspera de Natal',
  '31/12': 'Véspera de Ano Novo',
  '20/11': 'Consciência Negra',
}

// Feriados móveis por ano
function getFeriadosMoveis(year: number): Record<string, string> {
  // Cálculo da Páscoa (algoritmo de Butcher)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  const pascoa = new Date(year, month - 1, day)

  function fmt(d: Date) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}` }
  function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

  return {
    [fmt(addDays(pascoa, -48))]: 'Segunda-feira de Carnaval',
    [fmt(addDays(pascoa, -47))]: 'Terça-feira de Carnaval',
    [fmt(addDays(pascoa, -46))]: 'Quarta-feira de Cinzas',
    [fmt(addDays(pascoa, -2))]: 'Sexta-feira Santa',
    [fmt(pascoa)]: 'Páscoa',
    [fmt(addDays(pascoa, 60))]: 'Corpus Christi',
  }
}

const eventColors: Record<string, { bg: string; color: string }> = {
  meeting: { bg: 'var(--bbg)', color: 'var(--blue)' },
  capture: { bg: 'var(--abg)', color: 'var(--amber)' },
  recording: { bg: 'var(--abg)', color: 'var(--amber)' },
  delivery: { bg: 'var(--gbg)', color: 'var(--green)' },
  internal: { bg: 'var(--s2)', color: 'var(--t3)' },
  commercial: { bg: 'var(--pbg)', color: 'var(--purple)' },
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function AgendaView({ events, clients, profiles, year: initYear, month: initMonth }: any) {
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  const [modal, setModal] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const feriadosMoveis = getFeriadosMoveis(year)
  const allFeriados = { ...FERIADOS_FIXOS, ...feriadosMoveis }

  function prevMonth() { if (month === 0) { setMonth(11); setYear((y: number) => y - 1) } else setMonth((m: number) => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear((y: number) => y + 1) } else setMonth((m: number) => m + 1) }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const today = new Date()

  const eventsByDay: Record<string, any[]> = {}
  events.forEach((ev: any) => {
    const d = ev.starts_at.split('T')[0]
    if (!eventsByDay[d]) eventsByDay[d] = []
    eventsByDay[d].push(ev)
  })

  const upcomingEvents = events.filter((ev: any) => new Date(ev.starts_at) >= new Date()).slice(0, 6)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createCalendarEventAction(new FormData(e.currentTarget))
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  const cells: { day: number; currentMonth: boolean; dateStr: string }[] = []
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, currentMonth: false, dateStr: '' })
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, currentMonth: true, dateStr })
  }
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, currentMonth: false, dateStr: '' })

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Agenda</div>
        <div className="tb-sub">{MONTHS[month]} {year}</div>
        <div className="bico" onClick={prevMonth}><i className="ti ti-chevron-left" /></div>
        <div className="bico" onClick={nextMonth}><i className="ti ti-chevron-right" /></div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Novo evento</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '12px' }}>
          <div className="cal-grid">
            <div className="cal-head">{DAYS.map(d => <div key={d} className="cal-dn">{d}</div>)}</div>
            <div className="cal-body">
              {cells.map((cell, i) => {
                const isToday = cell.currentMonth && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const dayEvs = cell.dateStr ? (eventsByDay[cell.dateStr] || []) : []
                const dayKey = `${String(cell.day).padStart(2,'0')}/${String(month+1).padStart(2,'0')}`
                const feriado = cell.currentMonth ? allFeriados[dayKey] : null
                return (
                  <div key={i} className={`cal-cell ${!cell.currentMonth ? 'om' : ''} ${isToday ? 'today' : ''}`} onClick={() => { if (cell.currentMonth) { setSelectedDay(cell.dateStr); setModal(true) } }}>
                    <div className="cal-num">{cell.day}</div>
                    {feriado && <div className="cal-holiday" title={feriado}>🇧🇷 {feriado}</div>}
                    {dayEvs.slice(0, 2).map((ev: any) => {
                      const ec = eventColors[ev.type] || eventColors.meeting
                      return <div key={ev.id} className="cal-ev" style={{ background: ec.bg, color: ec.color }} title={ev.title}>{ev.title}</div>
                    })}
                    {dayEvs.length > 2 && <div style={{ fontSize: '9px', color: 'var(--t4)' }}>+{dayEvs.length - 2} mais</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Próximos eventos</div>
              {upcomingEvents.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--t4)', textAlign: 'center', padding: '16px 0' }}>Nenhum evento próximo</div>
              ) : upcomingEvents.map((ev: any) => {
                const ec = eventColors[ev.type] || eventColors.meeting
                const dt = new Date(ev.starts_at)
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid #141414' }}>
                    <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--t4)', minWidth: '36px' }}>{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div style={{ width: '3px', borderRadius: '2px', minHeight: '30px', background: ec.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#CCC' }}>{ev.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {ev.client?.name || 'Interno'}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Legenda</div>
              {Object.entries(eventColors).map(([type, c]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '11px', color: 'var(--t2)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: c.bg, border: `0.5px solid ${c.color}` }} />
                  {type === 'meeting' ? 'Reunião' : type === 'capture' ? 'Captação' : type === 'recording' ? 'Gravação' : type === 'delivery' ? 'Entrega' : type === 'internal' ? 'Interno' : 'Comercial'}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '11px', color: 'var(--red)' }}>
                <div>🇧🇷</div> Feriados nacionais
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Novo evento</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="fg"><label className="fl">Título *</label><input className="fi" name="title" placeholder="Ex: Reunião mensal, Captação produto..." required /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Tipo</label><select className="fi" name="type"><option value="meeting">Reunião</option><option value="capture">Captação</option><option value="recording">Gravação</option><option value="delivery">Entrega</option><option value="internal">Interno</option><option value="commercial">Comercial</option></select></div>
                  <div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id"><option value="">Interno — Ampy</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Data *</label><input className="fi" name="date" type="date" defaultValue={selectedDay || ''} required /></div>
                  <div className="fg"><label className="fl">Horário *</label><input className="fi" name="time" type="time" defaultValue="09:00" required /></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Duração (minutos)</label><select className="fi" name="duration"><option value="30">30 min</option><option value="45">45 min</option><option value="60" selected>1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="180">3 horas</option></select></div>
                  <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                </div>
                <div className="fg"><label className="fl">Local / link</label><input className="fi" name="location" placeholder="Endereço ou link da reunião..." /></div>
                <div className="fg"><label className="fl">Observações</label><textarea className="fi" name="notes" placeholder="Detalhes do evento..." /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--rbg)', border: '0.5px solid var(--rbr)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '11px' }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Criar evento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
