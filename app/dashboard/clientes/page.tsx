
import {
  unstable_noStore as noStore,
} from 'next/cache'

import {
  createClient,
} from '@/lib/supabase/server'

import ClientsView from './ClientsView'

export const dynamic =
  'force-dynamic'

export const revalidate = 0

export default async function ClientesPage() {
  noStore()

  const supabase =
    createClient()

  const [
    clientsResult,
    profilesResult,
    servicesResult,
    clientServicesResult,
    demandsResult,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id,name,segment,cidade,status,operation_model,logo_url,logo_storage_path,strategic_map_url,briefing_url,avatar_initials,avatar_color,avatar_bg,responsible_id,main_contact_name,main_contact_email,main_contact_phone,drive_folder_url,instagram,notes,inicio_contrato,fim_contrato,started_at,ended_at',
      )
      .order('name'),

    supabase
      .from('profiles')
      .select(
        'id,full_name,avatar_initials,role,is_active',
      )
      .eq(
        'is_active',
        true,
      )
      .order(
        'full_name',
      ),

    supabase
      .from('service_catalog')
      .select(
        'id,name,category,description',
      )
      .eq(
        'is_active',
        true,
      )
      .order('name'),

    supabase
      .from('client_services')
      .select(
        'id,client_id,service_catalog_id,responsible_id,status,monthly_quantity,quantity_unit,delivered_quantity,notes,created_at',
      )
      .order('created_at'),

    supabase
      .from('work_items')
      .select(
        'id,title,client_id,status,final_deadline,internal_deadline,destino,responsible_id',
      )
      .not(
        'status',
        'in',
        '(archived,cancelled)',
      )
      .limit(1500),
  ])

  const profiles =
    profilesResult.data || []

  const services =
    servicesResult.data || []

  const profilesById =
    new Map(
      profiles.map(
        (item: any) => [
          item.id,
          item,
        ],
      ),
    )

  const servicesById =
    new Map(
      services.map(
        (item: any) => [
          item.id,
          item,
        ],
      ),
    )

  const clients =
    (
      clientsResult.data ||
      []
    ).map(
      (client: any) => ({
        ...client,

        responsible:
          client.responsible_id
            ? profilesById.get(
                client.responsible_id,
              ) || null
            : null,
      }),
    )

  const clientServices =
    (
      clientServicesResult.data ||
      []
    ).map(
      (service: any) => ({
        ...service,

        service:
          service.service_catalog_id
            ? servicesById.get(
                service.service_catalog_id,
              ) || null
            : null,

        responsible:
          service.responsible_id
            ? profilesById.get(
                service.responsible_id,
              ) || null
            : null,
      }),
    )

  const demands =
    demandsResult.data || []

  const loadErrors = [
    clientsResult.error,
    profilesResult.error,
    servicesResult.error,
    clientServicesResult.error,
    demandsResult.error,
  ]
    .filter(Boolean)
    .map(
      (error: any) =>
        error.message,
    )

  return (
    <ClientsView
      clients={clients}
      profiles={profiles}
      services={services}
      clientServices={
        clientServices
      }
      demands={demands}
      loadErrors={
        loadErrors
      }
    />
  )
}
