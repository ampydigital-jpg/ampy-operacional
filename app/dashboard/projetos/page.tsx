import {
  unstable_noStore as noStore,
} from 'next/cache'

import { createClient } from '@/lib/supabase/server'

import ProjectsWorkspace from './ProjectsWorkspace'

export const dynamic =
  'force-dynamic'

export const revalidate = 0

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

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: {
    project?: string
    item?: string
  }
}) {
  noStore()

  const supabase = createClient()

  const [
    demandsResult,
    clientsResult,
    profilesResult,
    stepsResult,
    stepStatusesResult,
    clientServicesResult,
    servicesResult,
  ] = await Promise.all([
    supabase
      .from('work_items')
      .select(
        'id,title,description,type,destino,status,priority,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,blocked_reason,updated_at,created_at',
      )
      .in(
        'destino',
        ['projeto', 'ambos'],
      )
      .not(
        'status',
        'in',
        '(archived,cancelled)',
      )
      .order(
        'updated_at',
        { ascending: false },
      )
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
        'id,work_item_id,title,status,status_id,start_date,end_date,responsible_id,position,notes',
      )
      .order('position'),

    supabase
      .from(
        'project_step_statuses',
      )
      .select(
        'id,work_item_id,name,color,behavior,position,is_archived,created_at,updated_at',
      )
      .eq('is_archived', false)
      .order('position'),

    supabase
      .from('client_services')
      .select(
        'id,client_id,service_catalog_id,status',
      )
      .eq('status', 'active'),

    supabase
      .from('service_catalog')
      .select('id,name,is_active')
      .eq('is_active', true)
      .order('name'),
  ])

  const clients =
    clientsResult.data || []

  const profiles =
    profilesResult.data || []

  const steps =
    stepsResult.data || []

  const stepStatuses =
    stepStatusesResult.data || []

  const services =
    servicesResult.data || []

  const clientServicesRaw =
    clientServicesResult.data || []

  const clientsById =
    mapById(clients)

  const profilesById =
    mapById(profiles)

  const servicesById =
    mapById(services)

  const statusesById =
    mapById(stepStatuses)

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
    ).map((item: any) => {
      const itemStatuses =
        stepStatuses.filter(
          (status: any) =>
            status.work_item_id ===
            item.id,
        )

      const itemSteps =
        steps.filter(
          (step: any) =>
            step.work_item_id ===
            item.id,
        )

      return {
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

        step_statuses:
          itemStatuses,

        steps:
          itemSteps.map(
            (step: any) => ({
              ...step,

              responsible:
                step.responsible_id
                  ? profilesById.get(
                      step.responsible_id,
                    ) || null
                  : null,

              status_definition:
                step.status_id
                  ? statusesById.get(
                      step.status_id,
                    ) || null
                  : null,
            }),
          ),
      }
    })

  const loadErrors = [
    demandsResult.error
      ? 'Projetos: ' +
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

    stepsResult.error
      ? 'Cronogramas: ' +
        stepsResult.error.message
      : null,

    stepStatusesResult.error
      ? 'Status das etapas: ' +
        stepStatusesResult.error.message
      : null,

    clientServicesResult.error
      ? 'Serviços do cliente: ' +
        clientServicesResult.error.message
      : null,

    servicesResult.error
      ? 'Catálogo de serviços: ' +
        servicesResult.error.message
      : null,
  ].filter(Boolean) as string[]

  return (
    <ProjectsWorkspace
      demands={demands}
      initialProjectId={String(
        searchParams.project ||
          searchParams.item ||
          '',
      )}
      clients={clients}
      profiles={profiles}
      clientServices={
        clientServices
      }
      loadErrors={loadErrors}
    />
  )
}
