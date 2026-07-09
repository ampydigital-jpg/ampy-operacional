'use client'

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

const COLORS = ['#3B82F6','#22C55E','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#F97316','#EC4899']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#1A1A1A', border:'0.5px solid #2A2A2A', borderRadius:'8px', padding:'10px 14px' }}>
      {label && <div style={{ fontSize:'10px', color:'#777', marginBottom:'6px' }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize:'11px', color:p.color||'#CCC', display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:p.color||'#CCC', flexShrink:0 }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function DashboardCharts({ metrics, todayDemands, soonDemands, pizzaData, barData, statusData, dateStr, priorityColor }: any) {
  const metricCards = [
    {label:'Clientes ativos', value:metrics.activeClients, icon:'ti-users', color:'var(--ok)', bg:'var(--ok-bg)', sub:'Em operação', href:'/dashboard/clientes'},
    {label:'Demandas abertas', value:metrics.openDemands, icon:'ti-checklist', color:'var(--warn)', bg:'var(--warn-bg)', sub:`${metrics.lateDemands} com atraso`, href:'/dashboard/demandas?status=open&sort=deadline_asc'},
    {label:'Atrasadas', value:metrics.lateDemands, icon:'ti-clock-exclamation', color:metrics.lateDemands>0?'var(--err)':'var(--t3)', bg:metrics.lateDemands>0?'var(--err-bg)':'var(--s2)', sub:'Precisam de atenção', href:'/dashboard/demandas?status=late&sort=deadline_asc'},
    {label:'Bloqueadas', value:metrics.blockedDemands, icon:'ti-ban', color:metrics.blockedDemands>0?'var(--warn)':'var(--t3)', bg:metrics.blockedDemands>0?'var(--warn-bg)':'var(--s2)', sub:'Exigem desbloqueio', href:'/dashboard/demandas?status=blocked&sort=priority_desc'},
  ]

  return (
    <div className="page-wrap dashboard-page">
      <div className="topbar">
        <div className="tb-title">Dashboard</div>
        <div className="tb-sub">{dateStr}</div>
        <Link href="/dashboard/demandas?sort=deadline_asc" className="bsec">Ver demandas</Link>
        <Link href="/dashboard/demandas" className="bpri"><i className="ti ti-plus" style={{fontSize:'12px'}}/> Nova demanda</Link>
      </div>

      <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px'}}>
          {metricCards.map((m) => (
            <Link key={m.label} href={m.href} className="dashboard-metric-link" style={{background:'var(--s1)', border:`0.5px solid ${m.color}30`, borderRadius:'var(--rc)', padding:'18px', position:'relative', overflow:'hidden', textDecoration:'none'}}>
              <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:m.color, borderRadius:'12px 12px 0 0'}} />
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px'}}>
                <div style={{fontSize:'9px', fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'1.5px'}}>{m.label}</div>
                <div style={{width:'32px', height:'32px', borderRadius:'8px', background:m.bg, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <i className={`ti ${m.icon}`} style={{color:m.color, fontSize:'16px'}} />
                </div>
              </div>
              <div style={{fontSize:'32px', fontWeight:700, color:m.color, lineHeight:1, letterSpacing:'-1px', marginBottom:'6px'}}>{m.value}</div>
              <div style={{fontSize:'10px', color:'var(--t4)'}}>{m.sub}</div>
            </Link>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px'}}>
          <div style={{background:'var(--s1)', border:'0.5px solid var(--b1)', borderRadius:'var(--rc)', padding:'18px'}}>
            <div style={{fontSize:'12px', fontWeight:600, color:'var(--w)', marginBottom:'4px'}}>Demandas — últimos 30 dias</div>
            <div style={{fontSize:'10px', color:'var(--t4)', marginBottom:'16px'}}>Criadas, concluídas e atrasadas</div>
            {barData.length === 0 ? <div style={{height:'180px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', fontSize:'11px'}}>Nenhum dado ainda</div> :
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <XAxis dataKey="date" tick={{fill:'#666', fontSize:9}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#666', fontSize:9}} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" fill="#3B82F6" radius={[4,4,0,0]} maxBarSize={30} />
                  <Bar dataKey="done" name="Concluídas" fill="#22C55E" radius={[4,4,0,0]} maxBarSize={30} />
                  <Bar dataKey="late" name="Atrasadas" fill="#EF4444" radius={[4,4,0,0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>}
          </div>

          <div style={{background:'var(--s1)', border:'0.5px solid var(--b1)', borderRadius:'var(--rc)', padding:'18px'}}>
            <div style={{fontSize:'12px', fontWeight:600, color:'var(--w)', marginBottom:'4px'}}>Demandas por tipo</div>
            <div style={{fontSize:'10px', color:'var(--t4)', marginBottom:'8px'}}>Distribuição dos últimos 30 dias</div>
            {pizzaData.length === 0 ? <div style={{height:'180px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', fontSize:'11px'}}>Nenhum dado ainda</div> :
              <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart><Pie data={pizzaData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">{pizzaData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart>
                </ResponsiveContainer>
                <div style={{flex:1}}>{pizzaData.map((d:any, i:number) => <div key={i} style={{display:'flex', alignItems:'center', gap:'7px', marginBottom:'6px'}}><div style={{width:'8px', height:'8px', borderRadius:'2px', background:COLORS[i%COLORS.length], flexShrink:0}} /><span style={{fontSize:'10px', color:'var(--t2)', flex:1}}>{d.name}</span><span style={{fontSize:'10px', fontWeight:600, color:'var(--t3)'}}>{d.value}</span></div>)}</div>
              </div>}
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'300px 1fr 280px', gap:'12px'}}>
          <div style={{background:'var(--s1)', border:'0.5px solid var(--b1)', borderRadius:'var(--rc)', padding:'18px'}}>
            <div style={{fontSize:'12px', fontWeight:600, color:'var(--w)', marginBottom:'16px'}}>Por status</div>
            {statusData.length === 0 ? <div style={{color:'var(--t4)', fontSize:'11px', textAlign:'center', padding:'20px 0'}}>Sem dados</div> : statusData.map((d:any, i:number) => (
              <Link href={`/dashboard/demandas?status=${d.key || 'all'}`} key={i} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', textDecoration:'none'}}>
                <div style={{width:'8px', height:'8px', borderRadius:'50%', background:COLORS[i%COLORS.length], flexShrink:0}} />
                <span style={{fontSize:'11px', color:'var(--t2)', flex:1}}>{d.name}</span>
                <div style={{height:'5px', width:`${Math.min((d.value/Math.max(...statusData.map((x:any)=>x.value)))*80,80)}px`, background:COLORS[i%COLORS.length], borderRadius:'3px', opacity:0.7}} />
                <span style={{fontSize:'10px', fontWeight:600, color:'var(--t3)', minWidth:'20px', textAlign:'right'}}>{d.value}</span>
              </Link>
            ))}
          </div>

          <div style={{background:'var(--s1)', border:'0.5px solid var(--b1)', borderRadius:'var(--rc)', overflow:'hidden'}}>
            <div style={{padding:'14px 16px', borderBottom:'0.5px solid #161616', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontSize:'12px', fontWeight:600, color:'var(--w)'}}>Entregas de hoje</div>
              <Link href="/dashboard/demandas?due=today&sort=priority_desc" style={{fontSize:'10px', color:'var(--blue)'}}>{todayDemands.length} itens</Link>
            </div>
            {todayDemands.length === 0 ? <div style={{padding:'32px', textAlign:'center'}}><i className="ti ti-sun" style={{fontSize:'28px', color:'var(--ok)', display:'block', marginBottom:'8px'}} /><div style={{fontSize:'12px', color:'var(--ok)', fontWeight:500}}>Dia livre!</div><div style={{fontSize:'11px', color:'var(--t4)', marginTop:'4px'}}>Nenhuma entrega hoje</div></div> : todayDemands.map((d:any) => (
              <Link href={`/dashboard/demandas/${d.id}`} key={d.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderBottom:'0.5px solid #141414', textDecoration:'none'}}>
                <div style={{width:'10px', height:'10px', borderRadius:'50%', background:priorityColor[d.priority]||'var(--t3)', flexShrink:0}} />
                <div style={{flex:1, minWidth:0}}><div style={{fontSize:'11px', fontWeight:600, color:'#DDD', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{d.title}</div><div style={{fontSize:'10px', color:'var(--t4)', marginTop:'2px'}}>{d.client?.name||'Interno'} · {d.type}</div></div>
                {d.responsible && <div style={{width:'24px', height:'24px', borderRadius:'6px', background:'var(--s3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color:'var(--t2)', fontWeight:700, flexShrink:0}}>{d.responsible.avatar_initials}</div>}
              </Link>
            ))}
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            <div style={{background:'var(--s1)', border:'0.5px solid var(--b1)', borderRadius:'var(--rc)', padding:'14px'}}>
              <div style={{fontSize:'9px', fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'10px'}}>Acesso rápido</div>
              {[{href:'/dashboard/meu-dia', icon:'ti-sun', label:'Meu dia', color:'var(--warn)'},{href:'/dashboard/minha-semana', icon:'ti-calendar-week', label:'Minha semana', color:'var(--blue)'},{href:'/dashboard/quadro', icon:'ti-layout-kanban', label:'Quadro', color:'var(--ok)'},{href:'/dashboard/agenda', icon:'ti-calendar', label:'Agenda', color:'var(--purple)'},{href:'/dashboard/avisos', icon:'ti-bell', label:'Alertas', color:'var(--err)'}].map(item => <Link key={item.href} href={item.href} style={{display:'flex', alignItems:'center', gap:'9px', padding:'8px 10px', borderRadius:'var(--r)', color:'var(--t2)', fontSize:'11px', textDecoration:'none', marginBottom:'2px'}}><i className={`ti ${item.icon}`} style={{color:item.color, fontSize:'14px', width:'16px'}} />{item.label}<i className="ti ti-chevron-right" style={{marginLeft:'auto', fontSize:'11px', color:'var(--t4)'}} /></Link>)}
            </div>
            {soonDemands.length > 0 && <div style={{background:'var(--s1)', border:'0.5px solid var(--warn-br)', borderRadius:'var(--rc)', overflow:'hidden'}}><div style={{padding:'10px 14px', borderBottom:'0.5px solid #1C1400', display:'flex', alignItems:'center', gap:'7px'}}><i className="ti ti-alert-triangle" style={{color:'var(--warn)', fontSize:'13px'}} /><span style={{fontSize:'11px', fontWeight:600, color:'var(--warn)'}}>Vence em 3 dias</span></div>{soonDemands.map((d:any) => <Link href={`/dashboard/demandas/${d.id}`} key={d.id} style={{padding:'8px 14px', borderBottom:'0.5px solid #141414', display:'flex', justifyContent:'space-between', alignItems:'center', textDecoration:'none'}}><div style={{fontSize:'10px', color:'#CCC', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:'8px'}}>{d.title}</div><span style={{fontSize:'9px', fontWeight:700, color:'var(--warn)', flexShrink:0}}>{new Date(d.final_deadline+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span></Link>)}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
