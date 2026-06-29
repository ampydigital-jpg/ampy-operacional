import { createClient } from '@/lib/supabase/server'
import DashboardCharts from './DashboardCharts'

export default async function DashboardPage() {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const in3 = new Date(Date.now()+3*86400000).toISOString().split('T')[0]
  const last30 = new Date(Date.now()-30*86400000).toISOString().split('T')[0]

  const [
    { count: clientesAtivos },
    { count: demandasAbertas },
    { count: demandasAtrasadas },
    { count: aprovacoesPendentes },
    { data: demandasHoje },
    { data: vencendo3 },
    { data: todasDemandas },
  ] = await Promise.all([
    supabase.from('clients').select('*',{count:'exact',head:true}).eq('status','active'),
    supabase.from('work_items').select('*',{count:'exact',head:true}).not('status','in','(done,cancelled,archived)'),
    supabase.from('work_items').select('*',{count:'exact',head:true}).lt('final_deadline',hoje).not('status','in','(done,cancelled,archived)'),
    Promise.resolve({ count: 0 }),
    supabase.from('work_items').select('*,client:clients(name,avatar_initials,avatar_color,avatar_bg),responsible:profiles(full_name,avatar_initials)').eq('final_deadline',hoje).not('status','in','(done,cancelled,archived)').limit(8),
    supabase.from('work_items').select('*,client:clients(name)').gt('final_deadline',hoje).lte('final_deadline',in3).not('status','in','(done,cancelled,archived)').order('final_deadline').limit(5),
    supabase.from('work_items').select('type,status,priority,final_deadline,created_at').gte('created_at',last30+'T00:00:00').limit(200),
  ])

  // Processar dados para gráficos
  const tipoCont: Record<string,number> = {}
  const statusCont: Record<string,number> = {}
  const semanaData: Record<string,{total:number,done:number,late:number}> = {}
  todasDemandas?.forEach((d:any) => {
    tipoCont[d.type] = (tipoCont[d.type]||0)+1
    statusCont[d.status] = (statusCont[d.status]||0)+1
    if (d.created_at) {
      const sem = new Date(d.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
      if (!semanaData[sem]) semanaData[sem] = {total:0,done:0,late:0}
      semanaData[sem].total++
      if (d.status==='done') semanaData[sem].done++
      if (d.final_deadline&&d.final_deadline<hoje&&!['done','cancelled'].includes(d.status)) semanaData[sem].late++
    }
  })

  const pizzaData = Object.entries(tipoCont).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,6)
  const barData = Object.entries(semanaData).slice(-7).map(([date,v])=>({date,...v}))
  const statusLabels: Record<string,string> = { not_started:'Não iniciada', in_progress:'Em andamento', waiting:'Aguardando', blocked:'Bloqueada', in_review:'Em revisão', awaiting_approval:'Ag. aprovação', approved:'Aprovada', done:'Concluída' }
  const statusData = Object.entries(statusCont).map(([k,v])=>({name:statusLabels[k]||k,value:v}))

  const dateStr = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const priorCor: Record<string,string> = { urgent:'var(--err)', high:'var(--warn)', normal:'var(--t3)', low:'var(--t4)' }

  return (
    <DashboardCharts
      metrics={{activeClients:clientesAtivos??0, openDemands:demandasAbertas??0, lateDemands:demandasAtrasadas??0, pendingApprovals:aprovacoesPendentes??0}}
      todayDemands={demandasHoje||[]}
      soonDemands={vencendo3||[]}
      pizzaData={pizzaData}
      barData={barData}
      statusData={statusData}
      dateStr={dateStr}
      priorityColor={priorCor}
    />
  )
}
