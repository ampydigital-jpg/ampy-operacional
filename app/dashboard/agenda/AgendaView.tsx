'use client'
import { useState } from 'react'
import { createCalendarEventAction } from '@/lib/actions'

// Feriados nacionais oficiais (fixos)
const FERIADOS_NACIONAIS: Record<string, string> = {
  '01/01': 'Ano Novo',
  '21/04': 'Tiradentes',
  '01/05': 'Dia do Trabalho',
  '07/09': 'Independência do Brasil',
  '12/10': 'N. Sra. Aparecida',
  '02/11': 'Finados',
  '15/11': 'Proclamação da República',
  '20/11': 'Consciência Negra',
  '25/12': 'Natal',
  '24/12': 'Véspera de Natal',
  '31/12': 'Réveillon',
}

// Datas comemorativas de marketing — fontes: Reportei, mLabs, Serasa Experian
const DATAS_MARKETING: Record<string, string> = {
  '14/02': 'Dia da Amizade',
  '08/03': 'Dia Intl. da Mulher',
  '15/03': 'Dia do Consumidor',
  '12/06': 'Dia dos Namorados',
  '15/06': 'Dia dos Namorados (SC)',
  '10/07': 'Dia da Pizza',
  '13/07': 'Dia do Rock',
  '20/07': 'Dia do Amigo',
  '15/09': 'Dia do Cliente',
  '05/10': 'Dia do Professor',
  '15/10': 'Dia do Professor (oficial)',
  '31/10': 'Halloween',
  '05/11': 'Dia do Designer Gráfico',
  '27/11': 'Black Friday',
  '01/12': 'Dia do Diretor de Arte',
}

// Datas móveis calculadas
function getFeriadosMoveis(year: number): Record<string, string> {
  const a = year % 19, b = Math.floor(year/100), c = year % 100
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25)
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30
  const i = Math.floor(c/4), k = c % 4, l = (32+2*e+2*i-h-k) % 7
  const m = Math.floor((a+11*h+22*l)/451)
  const month = Math.floor((h+l-7*m+114)/31)
  const day = ((h+l-7*m+114) % 31) + 1
  const pascoa = new Date(year, month-1, day)
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  const add = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r }

  // Dia das Mães (2º domingo de maio)
  const maio1 = new Date(year, 4, 1)
  const diasAteDom = (7 - maio1.getDay()) % 7
  const diasMaes = new Date(year, 4, 1 + diasAteDom + 7)

  // Dia dos Pais (2º domingo de agosto)
  const ago1 = new Date(year, 7, 1)
  const diasAtedomAgo = (7 - ago1.getDay()) % 7
  const diasPais = new Date(year, 7, 1 + diasAtedomAgo + 7)

  return {
    [fmt(add(pascoa, -48))]: 'Segunda de Carnaval',
    [fmt(add(pascoa, -47))]: 'Terça de Carnaval',
    [fmt(add(pascoa, -46))]: 'Quarta de Cinzas',
    [fmt(add(pascoa, -2))]: 'Sexta-feira Santa',
    [fmt(pascoa)]: 'Páscoa',
    [fmt(add(pascoa, 60))]: 'Corpus Christi',
    [fmt(diasMaes)]: 'Dia das Mães',
    [fmt(diasPais)]: 'Dia dos Pais',
  }
}

const EVENT_TYPES = [
  { value: 'meeting', label: 'Reunião', color: '#3B82F6', bg: '#0A1628' },
  { value: 'capture_external', label: 'Captação Externa', color: '#F59E0B', bg: '#1C1200' },
  { value: 'capture_studio', label: 'Captação Estúdio', color: '#F97316', bg: '#1C0E05' },
  { value: 'delivery', label: 'Entrega', color: '#22C55E', bg: '#052E16' },
  { value: 'internal', label: 'Interno', color: '#555', bg: '#1A1A1A' },
  { value: 'commercial', label: 'Comercial', color: '#8B5CF6', bg: '#0D0A1F' },
]

const EVENT_COLORS = ['#3B82F6','#F59E0B','#22C55E','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899','#10B981','#6366F1']
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function AgendaView({ events, clients, profiles, year: initYear, month: initMonth, periodo }: any) {
  const [year, setYear] = useState<number>(initYear)
  const [month, setMonth] = useState<number>(initMonth)
  const [modal, setModal] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedColor, setSelectedColor] = useState('#3B82F6')
  const [filtros, setFiltros] = useState({ nacionais: true, marketing: true, eventos: true })

  const feriadosMoveis = getFeriadosMoveis(year)
  const allNacionais = { ...FERIADOS_NACIONAIS, ...feriadosMoveis }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y: number) => y - 1) }
    else setMonth((m: number) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y: number) => y + 1) }
    else setMonth((m: number) => m + 1)
  }

  const primeiroDia = new Date(year, month, 1).getDay()
  const diasNoMes = new Date(year, month + 1, 0).getDate()
  const diasNoMesAnt = new Date(year, month, 0).getDate()
  const hoje = new Date()

  const eventosPorDia: Record<string, any[]> = {}
  events.forEach((ev: any) => {
    const d = ev.starts_at.split('T')[0]
    if (!eventosPorDia[d]) eventosPorDia[d] = []
    eventosPorDia[d].push(ev)
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('color', selectedColor)
    const result = await createCalendarEventAction(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  const cells: { day: number; current: boolean; dateStr: string }[] = []
  for (let i = primeiroDia - 1; i >= 0; i--) cells.push({ day: diasNoMesAnt - i, current: false, dateStr: '' })
  for (let d = 1; d <= diasNoMes; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, current: true, dateStr })
  }
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - diasNoMes - primeiroDia + 1, current: false, dateStr: '' })

  const proximosEventos = events.filter((ev: any) => new Date(ev.starts_at) >= new Date()).slice(0, 6)

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Agenda</div>
        <div className="tb-sub">{MESES[month]} {year}</div>
        
        <div style={{display:"flex",gap:"5px",marginRight:"4px"}}>
          {[["7","7d"],["14","14d"],["28","28d"],["30","Mês"]].map(([v,l]) => (
            <a key={v} href={`/dashboard/agenda?periodo=${v}`} className={`fb ${periodo===v?"on":""}`} style={{height:"32px",display:"flex",alignItems:"center",padding:"0 12px",textDecoration:"none"}}>{l}</a>
          ))}
        </div>
        <div className="bico" onClick={prevMonth}><i className="ti ti-chevron-left" /></div>
        <div className="bico" onClick={nextMonth}><i className="ti ti-chevron-right" /></div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{fontSize:'12px'}} /> Novo evento</button>
      </div>

      <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
        {/* FILTROS */}
        <div style={{display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap'}}>
          {[
            { key:'nacionais', label:'🇧🇷 Feriados nacionais', cor:'var(--err)', bg:'var(--err-bg)', br:'var(--err-br)' },
            { key:'marketing', label:'📅 Datas de marketing', cor:'var(--warn)', bg:'var(--warn-bg)', br:'var(--warn-br)' },
            { key:'eventos', label:'📌 Eventos da equipe', cor:'var(--blue)', bg:'var(--blue-bg)', br:'var(--blue-br)' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltros(prev => ({...prev, [f.key]: !prev[f.key as keyof typeof prev]}))}
              style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 14px',borderRadius:'20px',border:`0.5px solid ${filtros[f.key as keyof typeof filtros] ? f.br : 'var(--b1)'}`,background:filtros[f.key as keyof typeof filtros]?f.bg:'transparent',color:filtros[f.key as keyof typeof filtros]?f.cor:'var(--t4)',fontSize:'11px',cursor:'pointer',fontFamily:'Poppins,sans-serif'}}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 260px', gap:'12px'}}>
          {/* CALENDÁRIO */}
          <div className="cal-grid">
            <div className="cal-head">{DIAS.map(d => <div key={d} className="cal-dn">{d}</div>)}</div>
            <div className="cal-body">
              {cells.map((cell, i) => {
                const isToday = cell.current && cell.day === hoje.getDate() && month === hoje.getMonth() && year === hoje.getFullYear()
                const dayEvs = cell.dateStr && filtros.eventos ? (eventosPorDia[cell.dateStr] || []) : []
                const dayKey = `${String(cell.day).padStart(2,'0')}/${String(month+1).padStart(2,'0')}`
                const feriado = cell.current && filtros.nacionais ? allNacionais[dayKey] : null
                const marketing = cell.current && filtros.marketing ? DATAS_MARKETING[dayKey] : null
                return (
                  <div key={i} className={`cal-cell ${!cell.current?'om':''} ${isToday?'today':''}`}
                    onClick={() => { if (cell.current) { setSelectedDay(cell.dateStr); setModal(true) } }}>
                    <div className="cal-num">{cell.day}</div>
                    {feriado && <div className="cal-holiday" title={feriado}>🇧🇷 {feriado}</div>}
                    {marketing && !feriado && <div className="cal-holiday-minor" title={marketing}>📅 {marketing}</div>}
                    {dayEvs.slice(0, 2).map((ev: any) => {
                      const et = EVENT_TYPES.find(t => t.value === ev.type) || EVENT_TYPES[0]
                      const hora = new Date(ev.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
                      return (
                        <div key={ev.id} className="cal-ev" style={{background:et.bg,color:et.color,border:`0.5px solid ${et.color}40`,padding:'2px 5px',borderRadius:'4px',marginBottom:'2px'}} title={ev.title}>
                          <div style={{fontSize:'8px',opacity:0.8,fontWeight:500}}>{hora}</div>
                          <div style={{fontSize:'9px',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.title}</div>
                        </div>
                      )
                    })}
                    {dayEvs.length > 2 && <div style={{fontSize:'9px',color:'var(--t4)'}}>+{dayEvs.length-2}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* LATERAL */}
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',padding:'14px'}}>
              <div style={{fontSize:'9px',fontWeight:700,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'10px'}}>Próximos eventos</div>
              {proximosEventos.length === 0
                ? <div style={{fontSize:'11px',color:'var(--t4)',textAlign:'center',padding:'16px 0'}}>Nenhum evento próximo</div>
                : proximosEventos.map((ev: any) => {
                  const dt = new Date(ev.starts_at)
                  const et = EVENT_TYPES.find(t => t.value === ev.type) || EVENT_TYPES[0]
                  return (
                    <div key={ev.id} style={{display:'flex',gap:'10px',padding:'8px 0',borderBottom:'0.5px solid #141414',alignItems:'flex-start'}}>
                      <div style={{fontSize:'10px',fontWeight:600,color:'var(--t4)',minWidth:'36px'}}>{dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                      <div style={{width:'3px',borderRadius:'2px',minHeight:'30px',background:et.color,flexShrink:0}} />
                      <div>
                        <div style={{fontSize:'11px',fontWeight:500,color:'#CCC'}}>{ev.title}</div>
                        <div style={{fontSize:'9px',color:'var(--t4)',marginTop:'2px'}}>{dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} · {et.label}</div>
                      </div>
                    </div>
                  )
                })}
            </div>

            <div style={{background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',padding:'14px'}}>
              <div style={{fontSize:'9px',fontWeight:700,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'10px'}}>Tipos de evento</div>
              {EVENT_TYPES.map(et => (
                <div key={et.value} style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 0',fontSize:'11px'}}>
                  <div style={{width:'10px',height:'10px',borderRadius:'3px',background:et.bg,border:`0.5px solid ${et.color}`}} />
                  <span style={{color:'var(--t2)'}}>{et.label}</span>
                </div>
              ))}
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
                <div className="fg"><label className="fl">Título *</label><input className="fi" name="title" placeholder="Ex: Reunião mensal, Captação..." required /></div>
                <div className="frow">
                  <div className="fg">
                    <label className="fl">Tipo</label>
                    <select className="fi" name="type" onChange={e => { const et = EVENT_TYPES.find(t => t.value === e.target.value); if(et) setSelectedColor(et.color) }}>
                      {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
                    </select>
                  </div>
                  <div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id"><option value="">Interno — Ampy</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Data *</label><input className="fi" name="date" type="date" defaultValue={selectedDay||''} required /></div>
                  <div className="fg"><label className="fl">Horário *</label><input className="fi" name="time" type="time" defaultValue="09:00" required /></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Duração</label><select className="fi" name="duration"><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="180">3 horas</option></select></div>
                  <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                </div>
                <div className="fg">
                  <label className="fl">Cor do evento</label>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'4px'}}>
                    {EVENT_COLORS.map(c => (
                      <div key={c} onClick={() => setSelectedColor(c)} style={{width:'24px',height:'24px',borderRadius:'50%',background:c,cursor:'pointer',border:selectedColor===c?'2px solid #fff':'2px solid transparent',transition:'all .1s'}} />
                    ))}
                  </div>
                </div>
                <div className="fg"><label className="fl">Local / link</label><input className="fi" name="location" placeholder="Endereço ou link da reunião..." /></div>
                <div className="fg"><label className="fl">Observações</label><textarea className="fi" name="notes" /></div>
                {error && <div style={{padding:'8px 12px',background:'var(--err-bg)',border:'0.5px solid var(--err-br)',borderRadius:'var(--r)',color:'var(--err)',fontSize:'11px'}}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading?'Salvando...':'Criar evento'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
