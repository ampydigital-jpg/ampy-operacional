
import {
  unstable_noStore as noStore,
} from 'next/cache'

import { createClient } from '@/lib/supabase/server'

import DemandasView from './DemandasView'

function mapById(
  items:
    | any[]
    | null
    | undefined,
) {
  return new Map(
    (
      Array.isArray(items)
        ? items
        : []
    )
      .filter(Boolean)
      .map((item) => [
        item.id,
        item,
      ]),
  )
}

export const dynamic =
  'force-dynamic'

export const revalidate = 0

export default async function DemandasPage() {
  noStore()

  const supabase = createClient()

  const [
    demandsResult,
    clientsResult,
    profilesResult,
    clientServicesResult,
    servicesResult,
    boardsResult,
    columnsResult,
  ] = await Promise.all([
    supabase
      .from('work_items')
      .select('id,title,description,type,origin,destino,status,priority,client_id,client_service_id,responsible_id,created_by,board_id,board_column_id,internal_deadline,final_deadline,drive_link,notes,created_at,updated_at,closed_at')
      .not(
        'status',
        'in',
        '(archived,cancelled)',
      )
      .order(
        'updated_at',
        { ascending: false },
      )
      .limit(500),

    supabase
      .from('clients')
      .select(
        'id,name,segment,status',
      )
      .eq('status', 'active')
      .order('name'),

    supabase
      .from('profiles')
      .select('id,full_name,display_name,avatar_url,role,is_active')
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

    supabase
      .from('boards')
      .select(
        'id,name,color,status',
      )
      .eq('status', 'active')
      .order('name'),

    supabase
      .from('board_columns')
      .select('id,board_id,name,color,operational_status,position')
      .order(
        'position',
        { ascending: true },
      ),
  ])

  const clients =
    clientsResult.data || []

  const profiles =
    profilesResult.data || []

  const activeProfiles =
    profiles.filter(
      (profile: any) =>
        profile?.is_active !== false,
    )


  const services =
    servicesResult.data || []

  const boards =
    boardsResult.data || []

  const columns =
    columnsResult.data || []

  const clientServicesRaw =
    clientServicesResult.data || []

  const clientsById =
    mapById(clients)

  const profilesById =
    mapById(profiles)

  const servicesById =
    mapById(services)

  const boardsById =
    mapById(boards)

  const columnsById =
    mapById(columns)

  const clientServices =
    clientServicesRaw.map(
      (item: any) => ({
        ...item,
        service:
          item.service_catalog_id
            ? servicesById.get(
                item.service_catalog_id,
              ) || null
            : null,
      }),
    )

  const clientServicesById =
    mapById(clientServices)

  const demands =
    (
      demandsResult.data || []
    ).map((item: any) => ({
      ...item,

      client:
        item.client_id
          ? clientsById.get(
              item.client_id,
            ) || null
          : null,

      responsible:
        item.responsible_id
          ? profilesById.get(
              item.responsible_id,
            ) || null
          : null,

      client_service:
        item.client_service_id
          ? clientServicesById.get(
              item.client_service_id,
            ) || null
          : null,

      board:
        item.board_id
          ? boardsById.get(
              item.board_id,
            ) || null
          : null,

      board_column:
        item.board_column_id
          ? columnsById.get(
              item.board_column_id,
            ) || null
          : null,
    }))

  const loadErrors = [
    demandsResult.error
      ? 'Demandas: ' +
        demandsResult.error.message
      : null,

    clientsResult.error
      ? 'Clientes: ' +
        clientsResult.error.message
      : null,

    profilesResult.error
      ? 'Responsáveis: ' +
        profilesResult.error.message
      : null,

    clientServicesResult.error
      ? 'Serviços do cliente: ' +
        clientServicesResult.error.message
      : null,

    servicesResult.error
      ? 'Catálogo de serviços: ' +
        servicesResult.error.message
      : null,

    boardsResult.error
      ? 'Quadros: ' +
        boardsResult.error.message
      : null,

    columnsResult.error
      ? 'Colunas: ' +
        columnsResult.error.message
      : null,
  ].filter(Boolean) as string[]

  return (
    <DemandasView
      demands={demands}
      clients={clients}
      profiles={activeProfiles}
      clientServices={
        clientServices
      }
      boards={boards}
      boardColumns={columns}
      loadErrors={loadErrors}
    />
  )
}
