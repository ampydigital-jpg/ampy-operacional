import { createClient } from '@/lib/supabase/server'
import DashboardCharts from './DashboardCharts'

export default async function DashboardPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const in3 = new Date(Date.now() + 3*86400000).toISOString().split('T')[0]
  const last30 = new Date(Date.now() - 30*86400000).toISOString().split('T')[0]

  const [
    { count: activeClients },
    { count: openDemands },
    { count: lateDemands },
    { count: pendingApprovals },
    { data: todayDemands },
    { data: soonDemands },
    { data: allDemands },
    { data: clients },
  ] = await Promise.all([
    supabase.from('clients').select('*',{count:'exact',head:true}).eq('status','active'),
    supabase.from('work_items').select('*',{count:'exact',head:true}).not('status','in','(done,cancelled,archived)'),
    supabase.from('work_items').select('*',{count:'exact',head:true}).lt('final_deadline',today).not('status','in','(done,cancelled,archived)'),
    supabase.from('approvals').select('*',{count:'exact',head:true}).eq('status','pending'),
    supabase.from('work_items').select('*,client:clients(name,avatar_initials,avatar_color,avatar_bg),responsible:profiles(full_name,avatar_initials)').eq('final_deadline',today).not('status','in','(done,cancelled,archived)').limit(8),
    supabase.from('work_items').select('*,client:clients(name)').gt('final_deadline',today).lte('final_deadline',in3).not('status','in','(done,cancelled,archived)').order('final_deadline').limit(5),
    supabase.from('work_items').select('type,status,priority,client_id,final_deadline,created_at').gte('created_at', last30+'T00:00:00').limit(200),
    supabase.from('clients').select('id,name,avatar_initials,avatar_color,avatar_bg').eq('status','active').order('name').limit(10),
  ])

  // Processar dados para gráficos
  const typeCount: Record<string,number> = {}
  const statusCount: Record<string,number> = {}
  const weekData: Record<string,{total:number,done:number,late:number}> = {}

  allDemands?.forEach((d:any) => {
    typeCount[d.type] = (typeCount[d.type]||0)+1
    statusCount[d.status] = (statusCount[d.status]||0)+1
    if (d.created_at) {
      const week = new Date(d.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
      if (!weekData[week]) weekData[week] = {total:0,done:0,late:0}
      weekData[week].total++
      if (d.status==='done') weekData[week].done++
      if (d.final_deadline && d.final_deadline < today && !['done','cancelled'].includes(d.status)) weekData[week].late++
    }
  })

  const pizzaData = Object.entries(typeCount).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,6)
  const barData = Object.entries(weekData).slice(-7).map(([date,v])=>({date,...v}))

  const statusLabels: Record<string,string> = {
    not_started:'Não iniciada', in_progress:'Em andamento', waiting:'Aguardando',
    blocked:'Bloqueada', in_review:'Em revisão', awaiting_approval:'Ag. aprovação',
    approved:'Aprovada', done:'Concluída'
  }
  const statusData = Object.entries(statusCount).map(([k,v])=>({name:statusLabels[k]||k,value:v}))

  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const priorityColor: Record<string,string> = { urgent:'var(--err)', high:'var(--warn)', normal:'var(--t3)', low:'var(--t4)' }

  return (
    <DashboardCharts
      metrics={{ activeClients:activeClients??0, openDemands:openDemands??0, lateDemands:lateDemands??0, pendingApprovals:pendingApprovals??0 }}
      todayDemands={todayDemands||[]}
      soonDemands={soonDemands||[]}
      pizzaData={pizzaData}
      barData={barData}
      statusData={statusData}
      clients={clients||[]}
      dateStr={dateStr}
      priorityColor={priorityColor}
    />
  )
}
