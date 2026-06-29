import { createClient } from '@/lib/supabase/server'

export default async function MeuDiaPage({ searchParams }: { searchParams: { setor?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]
  const setor = searchParams.setor || 'Todos'

  const SETORES = ['Planejamento','Captação','Edição','Design','Org. Feed','Programação','Tráfego','Gestão','Todos']

  // Demandas com vencimento hoje
  let qDemandas = supabase.from('work_items')
    .select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg), responsible:profiles(full_name, avatar_initials)')
    .or(`final_deadline.eq.${hojeStr},internal_deadline.eq.${hojeStr}`)
    .not('status', 'in', '(done,cancelled,archived)')
    .order('priority', { ascending: false })
  if (setor !== 'Todos') qDemandas = qDemandas.eq('type', setor)

  // Etapas de projeto com vencimento hoje
  const { data: etapasHoje } = await supabase.from('project_steps')
    .select('*, work_item:work_items(title, client:clients(name)), responsible:profiles(full_name, avatar_initials)')
    .eq('end_date', hojeStr)
    .not('status', 'in', '(done)')

  // Eventos da agenda hoje
  const { data: eventosHoje } = await supabase.from('calendar_events')
    .select('*, client:clients(name)')
    .gte('starts_at', `${hojeStr}T00:00:00`)
    .lte('starts_at', `${hojeStr}T23:59:59`)
    .order('starts_at')

  const { data: demandas } = await qDemandas

  const dateStr = hoje.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })
  const priorColor: Record<string,string> = { urgent:'var(--err)', high:'var(--warn)', normal:'var(--t3)', low:'var(--t4)' }
  const tipoEventoCor: Record<string,string> = { meeting:'var(--blue)', capture_external:'var(--warn)', capture_studio:'#F97316', delivery:'var(--ok)', internal:'var(--t3)', commercial:'var(--purple)' }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Meu dia</div>
        <div className="tb-sub">{dateStr}</div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Demandas hoje</div><div className="metric-val" style={{color:(demandas?.length??0)>0?'var(--warn)':'var(--w)'}}>{demandas?.length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--warn)'}}/>Com prazo hoje</div></div>
          <div className="metric"><div className="metric-lbl">Etapas hoje</div><div className="metric-val" style={{color:(etapasHoje?.length??0)>0?'var(--warn)':'var(--w)'}}>{etapasHoje?.length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--blue)'}}/>De projetos</div></div>
          <div className="metric"><div className="metric-lbl">Eventos</div><div className="metric-val">{eventosHoje?.length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--purple)'}}/>Agendados</div></div>
          <div className="metric"><div className="metric-lbl">Urgentes</div><div className="metric-val" style={{color:(demandas?.filter(d=>d.priority==='urgent').length??0)>0?'var(--err)':'var(--w)'}}>{demandas?.filter(d=>d.priority==='urgent').length??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--err)'}}/>Prioridade máxima</div></div>
        </div>

        {/* Filtro por setor */}
        <div className="filters">
          {SETORES.map(s => (
            <a key={s} href={`/dashboard/meu-dia?setor=${s}`} className={`fb ${setor===s?'on':''}`}>{s}</a>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 300px', gap:'14px'}}>
          {/* Demandas */}
          <div>
            <div className="sh"><div className="stitle">Demandas do dia</div><div className="ssub">{demandas?.length??0} itens</div></div>
            {!demandas||demandas.length===0 ? (
              <div style={{padding:'32px',textAlign:'center',background:'var(--s1)',borderRadius:'var(--rc)',border:'0.5px solid var(--b1)'}}>
                <i className="ti ti-sun" style={{fontSize:'28px',color:'var(--ok)',display:'block',marginBottom:'8px'}}/>
                <div style={{fontSize:'12px',color:'var(--ok)',fontWeight:500}}>Sem demandas hoje{setor!=='Todos'?` em ${setor}`:''}</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {demandas.map((d:any) => (
                  <div key={d.id} style={{background:'var(--s1)',border:`0.5px solid ${d.priority==='urgent'?'var(--err-br)':'var(--b1)'}`,borderRadius:'var(--rc)',padding:'12px 14px',display:'flex',alignItems:'center',gap:'10px'}}>
                    <div style={{width:'4px',minHeight:'40px',background:priorColor[d.priority],borderRadius:'2px',flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'11px',fontWeight:600,color:'#DDD'}}>{d.title}</div>
                      <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{d.client?.name||'Interno'} · {d.type}</div>
                    </div>
                    <span style={{fontSize:'9px',fontWeight:600,padding:'2px 8px',borderRadius:'4px',background:'var(--s2)',color:priorColor[d.priority]}}>{d.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Etapas de projeto */}
          <div>
            <div className="sh"><div className="stitle">Etapas de projeto</div><div className="ssub">{etapasHoje?.length??0} itens</div></div>
            {!etapasHoje||etapasHoje.length===0 ? (
              <div style={{padding:'32px',textAlign:'center',background:'var(--s1)',borderRadius:'var(--rc)',border:'0.5px solid var(--b1)',fontSize:'11px',color:'var(--t4)'}}>Nenhuma etapa vence hoje</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {etapasHoje.map((e:any) => (
                  <div key={e.id} style={{background:'var(--s1)',border:'0.5px solid var(--purple-br)',borderRadius:'var(--rc)',padding:'12px 14px',display:'flex',alignItems:'center',gap:'10px'}}>
                    <div style={{width:'4px',minHeight:'40px',background:'var(--purple)',borderRadius:'2px',flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'11px',fontWeight:600,color:'#DDD'}}>{e.title}</div>
                      <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{e.work_item?.title} · {e.work_item?.client?.name||'Interno'}</div>
                    </div>
                    <span className="badge bpurp">Projeto</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agenda do dia */}
          <div>
            <div className="sh"><div className="stitle">Agenda de hoje</div></div>
            {!eventosHoje||eventosHoje.length===0 ? (
              <div style={{padding:'24px',textAlign:'center',background:'var(--s1)',borderRadius:'var(--rc)',border:'0.5px solid var(--b1)',fontSize:'11px',color:'var(--t4)'}}>Nenhum evento hoje</div>
            ) : (
              <div style={{background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',overflow:'hidden'}}>
                {eventosHoje.map((ev:any) => {
                  const dt = new Date(ev.starts_at)
                  const cor = tipoEventoCor[ev.type]||'var(--blue)'
                  return (
                    <div key={ev.id} style={{display:'flex',gap:'10px',padding:'12px 14px',borderBottom:'0.5px solid #141414',alignItems:'flex-start'}}>
                      <div style={{fontSize:'11px',fontWeight:600,color:'var(--t2)',minWidth:'40px'}}>{dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                      <div style={{width:'3px',background:cor,borderRadius:'2px',minHeight:'36px',flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:'11px',fontWeight:600,color:'#CCC'}}>{ev.title}</div>
                        <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{ev.client?.name||'Interno'}</div>
                        {ev.location&&<div style={{fontSize:'10px',color:'var(--blue)',marginTop:'2px'}}>{ev.location}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
