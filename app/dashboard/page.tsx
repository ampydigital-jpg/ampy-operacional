import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const in3 = new Date(Date.now() + 3*86400000).toISOString().split('T')[0]

  const [
    { count: activeClients },
    { count: openDemands },
    { count: lateDemands },
    { count: blockers },
    { count: pendingApprovals },
    { data: todayDemands },
    { data: soonDemands },
  ] = await Promise.all([
    supabase.from('clients').select('*',{count:'exact',head:true}).eq('status','active'),
    supabase.from('work_items').select('*',{count:'exact',head:true}).not('status','in','(done,cancelled,archived)'),
    supabase.from('work_items').select('*',{count:'exact',head:true}).lt('final_deadline',today).not('status','in','(done,cancelled,archived)'),
    supabase.from('blockers').select('*',{count:'exact',head:true}).eq('status','open'),
    supabase.from('approvals').select('*',{count:'exact',head:true}).eq('status','pending'),
    supabase.from('work_items').select('*,client:clients(name,avatar_initials,avatar_color,avatar_bg),responsible:profiles(full_name,avatar_initials)').eq('final_deadline',today).not('status','in','(done,cancelled,archived)').limit(8),
    supabase.from('work_items').select('*,client:clients(name)').gt('final_deadline',today).lte('final_deadline',in3).not('status','in','(done,cancelled,archived)').order('final_deadline').limit(5),
  ])

  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const priorityColor: Record<string,string> = { urgent:'var(--err)', high:'var(--warn)', normal:'var(--t3)', low:'var(--t4)' }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Dashboard</div>
        <div className="tb-sub">{dateStr}</div>
        <Link href="/dashboard/demandas" className="bsec">Ver todas demandas</Link>
        <Link href="/dashboard/demandas" className="bpri"><i className="ti ti-plus" style={{fontSize:'12px'}}/> Nova demanda</Link>
      </div>
      <div className="pad" style={{overflowY:'auto',flex:1}}>
        {(lateDemands??0)>0 && (
          <div className="notice notice-err"><i className="ti ti-alert-triangle"/><span>{lateDemands} entrega(s) atrasada(s) · {pendingApprovals} aprovação(ões) pendente(s) · {blockers} bloqueio(s)</span></div>
        )}

        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Clientes ativos</div><div className="metric-val">{activeClients??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--ok)'}}/> Em operação</div></div>
          <div className="metric"><div className="metric-lbl">Demandas abertas</div><div className="metric-val">{openDemands??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--warn)'}}/>{lateDemands??0} com atraso</div></div>
          <div className="metric"><div className="metric-lbl">Bloqueios</div><div className="metric-val" style={{color:(blockers??0)>0?'var(--err)':'var(--w)'}}>{blockers??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--err)'}}/> Aguardando ação</div></div>
          <div className="metric"><div className="metric-lbl">Aprovações</div><div className="metric-val" style={{color:(pendingApprovals??0)>0?'var(--warn)':'var(--w)'}}>{pendingApprovals??0}</div><div className="metric-inf"><span className="dot" style={{background:'var(--purple)'}}/> Pendentes</div></div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:'14px'}}>
          <div>
            <div className="sh"><div className="stitle">Entregas de hoje</div><div className="ssub">{todayDemands?.length??0} itens</div></div>
            <div style={{background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',overflow:'hidden'}}>
              {!todayDemands||todayDemands.length===0 ? (
                <div style={{padding:'32px',textAlign:'center',color:'var(--ok)',fontSize:'12px'}}>
                  <i className="ti ti-circle-check" style={{fontSize:'24px',display:'block',marginBottom:'8px'}}/> Nenhuma entrega hoje
                </div>
              ) : todayDemands.map((d:any)=>(
                <div key={d.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'11px 14px',borderBottom:'0.5px solid #141414'}}>
                  <div style={{width:'10px',height:'10px',borderRadius:'50%',background:priorityColor[d.priority],flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'11px',fontWeight:600,color:'#DDD',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.title}</div>
                    <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{d.client?.name||'Interno'} · {d.type}</div>
                  </div>
                  {d.responsible&&<div style={{width:'24px',height:'24px',borderRadius:'6px',background:'var(--s3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',color:'var(--t2)',fontWeight:700,flexShrink:0}}>{d.responsible.avatar_initials}</div>}
                </div>
              ))}
            </div>

            {soonDemands && soonDemands.length > 0 && (
              <div style={{marginTop:'16px'}}>
                <div className="sh"><div className="stitle">Vencendo em até 3 dias</div></div>
                <div style={{background:'var(--s1)',border:'0.5px solid var(--warn-br)',borderRadius:'var(--rc)',overflow:'hidden'}}>
                  {soonDemands.map((d:any)=>(
                    <div key={d.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',borderBottom:'0.5px solid #141414'}}>
                      <i className="ti ti-calendar-exclamation" style={{color:'var(--warn)',fontSize:'14px',flexShrink:0}}/>
                      <div style={{flex:1}}><div style={{fontSize:'11px',fontWeight:600,color:'#CCC'}}>{d.title}</div><div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{d.client?.name||'Interno'}</div></div>
                      <span style={{fontSize:'10px',fontWeight:600,color:'var(--warn)'}}>{new Date(d.final_deadline+'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',padding:'14px'}}>
              <div style={{fontSize:'9px',fontWeight:700,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'12px'}}>Acesso rápido</div>
              {[
                {href:'/dashboard/meu-dia',icon:'ti-sun',label:'Meu dia',color:'var(--warn)'},
                {href:'/dashboard/semana-equipe',icon:'ti-calendar-week',label:'Semana da equipe',color:'var(--blue)'},
                {href:'/dashboard/kanban',icon:'ti-layout-kanban',label:'Kanban',color:'var(--ok)'},
                {href:'/dashboard/agenda',icon:'ti-calendar',label:'Agenda',color:'var(--purple)'},
                {href:'/dashboard/avisos',icon:'ti-bell',label:'Avisos',color:'var(--err)'},
              ].map(item=>(
                <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 10px',borderRadius:'var(--r)',color:'var(--t2)',fontSize:'12px',textDecoration:'none',transition:'background .1s',marginBottom:'2px'}}>
                  <i className={`ti ${item.icon}`} style={{color:item.color,fontSize:'15px',width:'16px'}}/>
                  {item.label}
                  <i className="ti ti-arrow-right" style={{marginLeft:'auto',fontSize:'11px',color:'var(--t4)'}}/>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
