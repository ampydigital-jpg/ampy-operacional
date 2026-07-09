import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import ProjetosView from './ProjetosView'

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProjetosPage() {
  noStore()
  const supabase = createClient()

  const [demandsResult, clientsResult, profilesResult, stepsResult] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,type,destino,status,priority,client_id,responsible_id,final_deadline,updated_at,created_at')
      .in('destino', ['projeto', 'ambos'])
      .not('status', 'in', '(archived,cancelled)')
      .order('updated_at', { ascending: false })
      .limit(300),
    supabase
      .from('clients')
      .select('id,name,avatar_initials,avatar_color,avatar_bg,status')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('profiles')
      .select('id,full_name,avatar_initials,role,is_active')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('project_steps')
      .select('id,work_item_id,title,status,start_date,end_date,responsible_id,position')
      .order('position'),
  ])

  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const steps = stepsResult.data || []

  const demands = (demandsResult.data || []).map((item: any) => {
    const itemSteps = steps.filter((step: any) => step.work_item_id === item.id)
    const doneSteps = itemSteps.filter((step: any) => ['done', 'delivered', 'approved'].includes(step.status)).length
    return {
      ...item,
      client: item.client_id ? clientsById.get(item.client_id) || null : null,
      responsible: item.responsible_id ? profilesById.get(item.responsible_id) || null : null,
      steps_count: itemSteps.length,
      steps_done: doneSteps,
      steps: itemSteps.map((step: any) => ({
        ...step,
        responsible: step.responsible_id ? profilesById.get(step.responsible_id) || null : null,
      })),
    }
  })

  const loadErrors = [
    demandsResult.error ? `Projetos: ${demandsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Responsáveis: ${profilesResult.error.message}` : null,
    stepsResult.error ? `Cronogramas: ${stepsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <ProjetosView demands={demands} clients={clients} profiles={profiles} loadErrors={loadErrors} />
}
