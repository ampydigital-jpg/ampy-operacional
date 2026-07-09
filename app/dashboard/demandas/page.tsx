import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DemandasView from './DemandasView'

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DemandasPage() {
  noStore()

  const supabase = createClient()

  const [demandsResult, clientsResult, profilesResult, clientServicesResult, servicesResult] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,description,type,origin,destino,status,priority,client_id,client_service_id,responsible_id,created_by,internal_deadline,final_deadline,drive_link,notes,created_at,updated_at,closed_at')
      .not('status', 'in', '(archived,cancelled)')
      .order('updated_at', { ascending: false })
      .limit(300),
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
    supabase
      .from('client_services')
      .select('id,client_id,service_catalog_id,status')
      .eq('status', 'active'),
    supabase
      .from('service_catalog')
      .select('id,name')
      .eq('is_active', true)
      .order('name'),
  ])

  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const services = servicesResult.data || []
  const clientServicesRaw = clientServicesResult.data || []

  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const servicesById = mapById(services)

  const demands = (demandsResult.data || []).map((item: any) => ({
    ...item,
    client: item.client_id ? clientsById.get(item.client_id) || null : null,
    responsible: item.responsible_id ? profilesById.get(item.responsible_id) || null : null,
  }))

  const clientServices = clientServicesRaw.map((item: any) => ({
    ...item,
    service: item.service_catalog_id ? servicesById.get(item.service_catalog_id) || null : null,
  }))

  const loadErrors = [
    demandsResult.error ? `Demandas: ${demandsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Responsáveis: ${profilesResult.error.message}` : null,
    clientServicesResult.error ? `Serviços do cliente: ${clientServicesResult.error.message}` : null,
    servicesResult.error ? `Catálogo de serviços: ${servicesResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return (
    <DemandasView
      demands={demands}
      clients={clients}
      profiles={profiles}
      clientServices={clientServices}
      loadErrors={loadErrors}
    />
  )
}
