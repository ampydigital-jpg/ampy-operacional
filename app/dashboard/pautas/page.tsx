import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import BoardWorkspace from '../quadro/BoardWorkspace'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapById(items: any[]) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .map((item) => [item.id, item]),
  )
}

async function hasTotalAccess() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const admin = createAdminClient()

  const byProfile = await admin
    .from('team_members')
    .select('access_type,is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (
    byProfile.data?.is_active !== false &&
    byProfile.data?.access_type === 'total'
  ) {
    return true
  }

  if (!user.email) return false

  const byEmail = await admin
    .from('team_members')
    .select('access_type,is_active')
    .ilike('email', user.email)
    .maybeSingle()

  return (
    byEmail.data?.is_active !== false &&
    byEmail.data?.access_type === 'total'
  )
}

export default async function PautasPage({
  searchParams,
}: {
  searchParams: {
    board?: string
    pauta?: string
    item?: string
  }
}) {
  noStore()

  const supabase = createClient()

  const [
    boardsResult,
    clientsResult,
    profilesResult,
    clientServicesResult,
    servicesResult,
  ] = await Promise.all([
    supabase
      .from('boards')
      .select(
        'id,name,description,color,status,board_kind,created_at,updated_at',
      )
      .eq('status', 'active')
      .eq('board_kind', 'pauta')
      .order('created_at'),
    supabase
      .from('clients')
      .select(
        'id,name,avatar_initials,avatar_color,avatar_bg,status,responsible_id,drive_folder_url',
      )
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('profiles')
      .select(
        'id,full_name,avatar_initials,role,is_active,display_name,avatar_url',
      )
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('client_services')
      .select(
        'id,client_id,service_catalog_id,status,requires_alignment_meeting,requires_capture,default_capture_type',
      )
      .eq('status', 'active'),
    supabase
      .from('service_catalog')
      .select('id,name,is_active')
      .eq('is_active', true),
  ])

  const boards = boardsResult.data || []
  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const services = servicesResult.data || []

  const activeBoardId = boards.some(
    (board: any) => board.id === searchParams.board,
  )
    ? String(searchParams.board)
    : String(boards[0]?.id || '')

  let pautasResult: any = {
    data: [],
    error: null,
  }

  let columnsResult: any = {
    data: [],
    error: null,
  }

  let demandsResult: any = {
    data: [],
    error: null,
  }

  let scheduleRequirementsResult: any = {
    data: [],
    error: null,
  }

  if (activeBoardId) {
    pautasResult = await supabase
      .from('pautas')
      .select(
        'id,board_id,name,reference_month,magic_number_date,scheduled_until_date,lifecycle_status,opened_at,closed_at,archived_at,created_at,updated_at',
      )
      .eq('board_id', activeBoardId)
      .order('reference_month', {
        ascending: false,
      })
  }

  const pautas = pautasResult.data || []

  const requestedPauta = String(
    searchParams.pauta || '',
  )

  const defaultPauta =
    pautas.find(
      (pauta: any) =>
        pauta.lifecycle_status === 'open',
    ) ||
    pautas.find(
      (pauta: any) =>
        pauta.lifecycle_status === 'draft',
    ) ||
    pautas[0] ||
    null

  const activePautaKey =
    requestedPauta === 'all' ||
    requestedPauta === 'legacy'
      ? requestedPauta
      : pautas.some(
            (pauta: any) =>
              pauta.id === requestedPauta,
          )
        ? requestedPauta
        : String(
            defaultPauta?.id || 'legacy',
          )

  const activePauta =
    pautas.find(
      (pauta: any) =>
        pauta.id === activePautaKey,
    ) || null

  if (activeBoardId) {
    columnsResult = await supabase
      .from('board_columns')
      .select(
        'id,board_id,name,color,operational_status,automation_role,position,created_at,updated_at',
      )
      .eq('board_id', activeBoardId)
      .order('position')

    let demandQuery = supabase
      .from('work_items')
      .select(
        'id,title,description,type,status,priority,destino,board_id,board_column_id,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,blocked_reason,created_at,updated_at,card_tag,card_tag_color,pauta_id,is_pauta_card,pauta_card_id,completed_at,programming_covered_until',
      )
      .eq('board_id', activeBoardId)
      .not('status', 'in', '(archived,cancelled)')

    if (activePautaKey === 'legacy') {
      demandQuery = demandQuery.is(
        'pauta_id',
        null,
      )
    } else if (activePautaKey !== 'all') {
      demandQuery = demandQuery.eq(
        'pauta_id',
        activePautaKey,
      )
    }

    demandsResult = await demandQuery
      .order('created_at', {
        ascending: false,
      })
      .limit(2000)
  }

  const demandRows =
    demandsResult.data || []

  const demandIds =
    demandRows
      .map((item: any) => item.id)
      .filter(Boolean)

  if (demandIds.length > 0) {
    scheduleRequirementsResult =
      await supabase
        .from(
          'work_item_schedule_requirements',
        )
        .select(
          'id,work_item_id,requirement_type,status,calendar_event_id,calendar_type,scheduled_at,confirmed_at,completed_at,created_at,updated_at,calendar_event:calendar_events(id,type,starts_at,ends_at,confirmed,location,responsible_id)',
        )
        .in(
          'work_item_id',
          demandIds,
        )
  }

  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const servicesById = mapById(services)
  const pautasById = mapById(pautas)

  const requirementsByItem =
    new Map<string, any[]>()

  for (
    const requirement
    of scheduleRequirementsResult.data || []
  ) {
    const calendarEvent =
      Array.isArray(
        requirement.calendar_event,
      )
        ? requirement.calendar_event[0] || null
        : requirement.calendar_event || null

    const current =
      requirementsByItem.get(
        requirement.work_item_id,
      ) || []

    current.push({
      ...requirement,
      calendar_event:
        calendarEvent,
    })

    requirementsByItem.set(
      requirement.work_item_id,
      current,
    )
  }

  const demands = demandRows.map(
    (item: any) => ({
      ...item,
      client: item.client_id
        ? clientsById.get(item.client_id) || null
        : null,
      responsible: item.responsible_id
        ? profilesById.get(item.responsible_id) || null
        : null,
      pauta: item.pauta_id
        ? pautasById.get(item.pauta_id) || null
        : null,
      schedule_requirements:
        requirementsByItem.get(item.id) || [],
    }),
  )

  const clientServices = (
    clientServicesResult.data || []
  ).map((item: any) => ({
    ...item,
    service: item.service_catalog_id
      ? servicesById.get(item.service_catalog_id) || null
      : null,
  }))

  const loadErrors = [
    boardsResult.error
      ? `Quadros: ${boardsResult.error.message}`
      : null,
    pautasResult.error
      ? `Pautas: ${pautasResult.error.message}`
      : null,
    columnsResult.error
      ? `Colunas: ${columnsResult.error.message}`
      : null,
    demandsResult.error
      ? `Demandas: ${demandsResult.error.message}`
      : null,
    scheduleRequirementsResult.error
      ? `Agenda operacional: ${scheduleRequirementsResult.error.message}`
      : null,
    clientsResult.error
      ? `Clientes: ${clientsResult.error.message}`
      : null,
    profilesResult.error
      ? `Responsáveis: ${profilesResult.error.message}`
      : null,
    clientServicesResult.error
      ? `Serviços: ${clientServicesResult.error.message}`
      : null,
  ].filter(Boolean) as string[]

  return (
    <BoardWorkspace
      boards={boards}
      activeBoardId={activeBoardId}
      pautas={pautas}
      activePautaKey={activePautaKey}
      activePauta={activePauta}
      initialItemId={String(
        searchParams.item || '',
      )}
      columns={columnsResult.data || []}
      demands={demands}
      clients={clients}
      profiles={profiles}
      clientServices={clientServices}
      canManage={await hasTotalAccess()}
      loadErrors={loadErrors}
      workspaceMode="pautas"
    />
  )
}