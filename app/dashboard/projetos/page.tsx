import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import ProjectsWorkspace from './ProjectsWorkspace'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapById(items: any[] | null | undefined) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .map((item) => [item.id, item]),
  )
}

export default async function ProjetosPage() {
  noStore()

  const supabase = createClient()

  const [
    demandsResult,
    clientsResult,
    profilesResult,
    stepsResult,
  ] = await Promise.all([
    supabase
      .from('work_items')
      .select(
        'id,title,description,type,destino,status,priority,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,blocked_reason,updated_at,created_at',
      )
      .in('destino', ['projeto', 'ambos'])
      .not('status', 'in', '(archived,cancelled)')
      .order('updated_at', { ascending: false })
      .limit(1000),
    supabase
      .from('clients')
      .select(
        'id,name,avatar_initials,avatar_color,avatar_bg,status',
      )
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('profiles')
      .select(
        'id,full_name,avatar_initials,role,is_active',
      )
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('project_steps')
      .select(
        'id,work_item_id,title,status,start_date,end_date,responsible_id,position,notes',
      )
      .order('position'),
  ])

  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const steps = stepsResult.data || []

  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)

  const demands = (demandsResult.data || []).map(
    (item: any) => {
      const itemSteps = steps.filter(
        (step: any) => step.work_item_id === item.id,
      )

      return {
        ...item,
        client: item.client_id
          ? clientsById.get(item.client_id) || null
          : null,
        responsible: item.responsible_id
          ? profilesById.get(item.responsible_id) || null
          : null,
        steps: itemSteps.map((step: any) => ({
          ...step,
          responsible: step.responsible_id
            ? profilesById.get(step.responsible_id) || null
            : null,
        })),
      }
    },
  )

  const loadErrors = [
    demandsResult.error
      ? `Projetos: ${demandsResult.error.message}`
      : null,
    clientsResult.error
      ? `Clientes: ${clientsResult.error.message}`
      : null,
    profilesResult.error
      ? `Responsáveis: ${profilesResult.error.message}`
      : null,
    stepsResult.error
      ? `Cronogramas: ${stepsResult.error.message}`
      : null,
  ].filter(Boolean) as string[]

  return (
    <ProjectsWorkspace
      demands={demands}
      clients={clients}
      profiles={profiles}
      loadErrors={loadErrors}
    />
  )
}
