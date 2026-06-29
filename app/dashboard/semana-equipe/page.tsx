import { createClient } from '@/lib/supabase/server'

export default async function SemanaEquipePage() {
  const supabase = createClient()
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (now.getDay()===0?6:now.getDay()-1))
  monday.setHours(0,0,0,0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate()+4)
  friday.setHours(23,59,59,999)

  const mondayStr = monday.toISOString().split('T')[0]
  const fridayStr = friday.toISOString().split('T')[0]

  const [
    { data: profiles },
    { data: demandas },
    { data: etapas },
    { data: eventos },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_initials, avatar_color, avatar_bg').eq('is_active', true).order('full_name'),
    supabase.from('work_items')
      .select('*, client:clients(name), responsible:profiles(id, full_name, avatar_initials)')
      .not('status','in','(done,cancelled,archived)')
      .gte('final_deadline', mondayStr)
      .lte('final_deadline', fridayStr),
    supabase.from('project_steps')
      .select('*, work_item:work_items(title, client:clients(name)), responsible:profiles(id, full_name, avatar_initials)')
      .not('status','eq','done')
      .gte('end_date', mondayStr)
      .lte('end_date', fridayStr),
    supabase.from('calendar_events')
      .select('*, client:clients(name), responsible:profiles(id, full_name)')
      .gte('starts_at', monday.toISOString())
      .lte('starts_at', friday.toISOString())
      .order('starts_at'),
  ])

  const dias = ['Seg','Ter','Qua','Qui','Sex']
  const dates = Array.from({length:5},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d })
  const hoje = new Date()

  const tipoCor: Record<string,string> = { Planejamento:'#06B6D4', Captação:'#F59E0B', Edição:'#F97316', Design:'#8B5CF6', 'Org. Feed':'#10B981', Programação:'#3B82F6', Tráfego:'#3B82F6', Interno:'#555' }
  const eventoCor: Record<string,string> = { meeting:'var(--blue)', capture_external:'var(--warn)', capture_studio:'#F97316', delivery:'var(--ok)', internal:'var(--t3)', commercial:'var(--purple)' }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Semana da equipe</div>
        <div className="tb-sub">{monday.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} — {friday.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Membros</div><div className="metric-val">{profiles?.length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--ok)'}}/>Ativos</div></div>
          <div className="metric"><div className="metric-lbl">Demandas</div><div className="metric-val">{demandas?.length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--warn)'}}/>Com prazo esta semana</div></div>
          <div className="metric"><div className="metric-lbl">Etapas</div><div className="metric-val">{etapas?.length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--purple)'}}/>De projetos</div></div>
          <div className="metric"><div className="metric-lbl">Eventos</div><div className="metric-val">{eventos?.length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--blue)'}}/>Agendados</div></div>
        </div>

        {/* Visão por pessoa */}
        {profiles?.map((p:any) => {
          const pDemandas = demandas?.filter(d=>d.responsible?.id===p.id)||[]
          const pEtapas = etapas?.filter(e=>e.responsible?.id===p.id)||[]
          const pEventos = eventos?.filter(ev=>ev.responsible?.id===p.id)||[]
          if (pDemandas.length===0&&pEtapas.length===0&&pEventos.length===0) return null
          return (
            <div key={p.id} style={{marginBottom:'20px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                <div style={{width:'32px',height:'32px',borderRadius:'8px',background:p.avatar_bg||'var(--s2)',color:p.avatar_color||'var(--t2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700}}>{p.avatar_initials}</div>
                <div style={{fontSize:'13px',fontWeight:600,color:'var(--w)'}}>{p.full_name}</div>
                <div style={{fontSize:'10px',color:'var(--t4)'}}>{pDemandas.length} demanda(s) · {pEtapas.length} etapa(s) · {pEventos.length} evento(s)</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
                {dates.map((date,di)=>{
                  const dateStr = date.toISOString().split('T')[0]
                  const isToday = date.toDateString()===hoje.toDateString()
                  const dayDemandas = pDemandas.filter(d=>d.final_deadline===dateStr)
                  const dayEtapas = pEtapas.filter(e=>e.end_date===dateStr)
                  const dayEventos = pEventos.filter(ev=>ev.starts_at.startsWith(dateStr))
                  return (
                    <div key={di} style={{background:'var(--s1)',border:`0.5px solid ${isToday?'var(--b3)':'var(--b1)'}`,borderRadius:'var(--rc)',overflow:'hidden'}}>
                      <div style={{padding:'8px 10px',borderBottom:'0.5px solid #161616',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontSize:'9px',fontWeight:600,color:isToday?'var(--t2)':'var(--t4)',textTransform:'uppercase'}}>{dias[di]}</span>
                        <span style={{fontSize:'14px',fontWeight:700,color:isToday?'var(--w)':'var(--t4)'}}>{date.getDate()}</span>
                      </div>
                      <div style={{padding:'6px'}}>
                        {dayDemandas.map(d=>(
                          <div key={d.id} style={{padding:'5px 7px',borderRadius:'6px',background:'var(--s2)',marginBottom:'4px',borderLeft:`2px solid ${tipoCor[d.type]||'var(--t3)'}`}}>
                            <div style={{fontSize:'9px',fontWeight:600,color:'#CCC',lineHeight:1.3}}>{d.title.length>28?d.title.slice(0,28)+'…':d.title}</div>
                            <div style={{fontSize:'8px',color:'var(--t4)',marginTop:'2px'}}>{d.client?.name||'Interno'}</div>
                          </div>
                        ))}
                        {dayEtapas.map(e=>(
                          <div key={e.id} style={{padding:'5px 7px',borderRadius:'6px',background:'var(--purple-bg)',marginBottom:'4px',borderLeft:'2px solid var(--purple)'}}>
                            <div style={{fontSize:'9px',fontWeight:600,color:'var(--purple)',lineHeight:1.3}}>{e.title.length>28?e.title.slice(0,28)+'…':e.title}</div>
                            <div style={{fontSize:'8px',color:'var(--t4)',marginTop:'2px'}}>Etapa · {e.work_item?.client?.name||'Interno'}</div>
                          </div>
                        ))}
                        {dayEventos.map(ev=>(
                          <div key={ev.id} style={{padding:'5px 7px',borderRadius:'6px',background:'var(--blue-bg)',marginBottom:'4px',borderLeft:`2px solid ${eventoCor[ev.type]||'var(--blue)'}`}}>
                            <div style={{fontSize:'9px',fontWeight:600,color:'var(--blue)',lineHeight:1.3}}>{new Date(ev.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} {ev.title.length>18?ev.title.slice(0,18)+'…':ev.title}</div>
                          </div>
                        ))}
                        {dayDemandas.length===0&&dayEtapas.length===0&&dayEventos.length===0&&(
                          <div style={{fontSize:'9px',color:'var(--t4)',textAlign:'center',padding:'8px 0'}}>—</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {demandas?.length===0&&etapas?.length===0&&eventos?.length===0&&(
          <div className="empty"><i className="ti ti-calendar-week"/><div className="empty-title">Semana tranquila</div><div className="empty-sub">Nenhuma demanda, etapa ou evento com prazo esta semana.</div></div>
        )}
      </div>
    </div>
  )
}
