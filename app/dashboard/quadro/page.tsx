import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import KanbanView from '../kanban/KanbanView'

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function QuadroPage() {
  noStore()
  const supabase = createClient()

  const [demandsResult, clientsResult, profilesResult] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,type,destino,status,priority,client_id,responsible_id,final_deadline,updated_at,created_at')
      .in('destino', ['quadro', 'ambos', 'kanban'])
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
  ])

  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)

  const demands = (demandsResult.data || []).map((item: any) => ({
    ...item,
    client: item.client_id ? clientsById.get(item.client_id) || null : null,
    responsible: item.responsible_id ? profilesById.get(item.responsible_id) || null : null,
  }))

  const loadErrors = [
    demandsResult.error ? `Demandas do Quadro: ${demandsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Responsáveis: ${profilesResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <KanbanView demands={demands} clients={clients} profiles={profiles} loadErrors={loadErrors} />
}
