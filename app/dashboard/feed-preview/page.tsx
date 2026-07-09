import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import FeedPreviewView from './FeedPreviewView'

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedPreviewPage() {
  noStore()

  const supabase = createClient()

  const [demandsResult, clientsResult, profilesResult] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,description,type,origin,destino,status,priority,client_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,created_at,updated_at,closed_at')
      .not('status', 'in', '(archived,cancelled)')
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('clients')
      .select('id,name,segment,status')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('profiles')
      .select('id,full_name,role,is_active')
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
    demandsResult.error ? `Demandas: ${demandsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Responsaveis: ${profilesResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <FeedPreviewView demands={demands} clients={clients} profiles={profiles} loadErrors={loadErrors} />
}
