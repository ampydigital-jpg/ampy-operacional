import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BoardWorkspace from './BoardWorkspace'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapById(items: any[]) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

async function hasTotalAccess() {
  const supabase =
    createClient()

  const {
    data: {
      user,
    },
  } =
    await supabase
      .auth
      .getUser()

  if (!user) {
    return false
  }

  const [
    profileResult,
    teamResult,
  ] =
    await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id,role,is_active,email',
        )
        .eq(
          'id',
          user.id,
        )
        .maybeSingle(),

      supabase
        .from(
          'team_members',
        )
        .select(
          'access_type,is_active',
        )
        .eq(
          'profile_id',
          user.id,
        )
        .maybeSingle(),
    ])

  const profile =
    profileResult.data

  const team =
    teamResult.data

  if (
    profile
      ?.is_active !== false &&
    [
      'admin',
      'director',
    ].includes(
      String(
        profile?.role ||
        '',
      ),
    )
  ) {
    return true
  }

  if (
    team
      ?.is_active !== false &&
    team
      ?.access_type ===
        'total'
  ) {
    return true
  }

  if (!user.email) {
    return false
  }

  const byEmail =
    await supabase
      .from(
        'team_members',
      )
      .select(
        'access_type,is_active',
      )
      .ilike(
        'email',
        user.email,
      )
      .maybeSingle()

  return (
    byEmail
      .data
      ?.is_active !== false &&
    byEmail
      .data
      ?.access_type ===
        'total'
  )
}

export default async function QuadroPage({ searchParams }: { searchParams: { board?: string; pauta?: string; item?: string } }) {
  noStore()
  if (searchParams.pauta) {
    const params = new URLSearchParams()
    if (searchParams.board) params.set('board',searchParams.board)
    if (searchParams.pauta) params.set('pauta',searchParams.pauta)
    if (searchParams.item) params.set('item',searchParams.item)
    redirect('/dashboard/pautas?' + params.toString())
  }

  const supabase = createClient()
  const [boardsResult, clientsResult, profilesResult, clientServicesResult, servicesResult] = await Promise.all([
    supabase.from('boards').select('id,name,description,color,status,board_kind,created_at,updated_at').eq('status','active').eq('board_kind','custom').order('created_at'),
    supabase.from('clients').select('id,name,avatar_initials,avatar_color,avatar_bg,status,responsible_id,drive_folder_url').eq('status','active').order('name'),
    supabase.from('profiles').select('id,full_name,avatar_initials,role,is_active,display_name,avatar_url').order('full_name'),
    supabase.from('client_services').select('id,client_id,service_catalog_id,status,requires_alignment_meeting,requires_capture,default_capture_type').eq('status','active'),
    supabase.from('service_catalog').select('id,name,is_active').eq('is_active',true),
  ])

  const boards = boardsResult.data || []
  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const activeProfiles = profiles.filter((profile: any) => profile?.is_active !== false)
  const services = servicesResult.data || []
  const activeBoardId = boards.some((board: any) => board.id === searchParams.board) ? String(searchParams.board) : String(boards[0]?.id || '')

  let columnsResult: any = { data: [], error: null }
  let assignmentsResult: any = { data: [], error: null }
  let demandsResult: any = { data: [], error: null }
  let scheduleRequirementsResult: any = { data: [], error: null }
  let pautasResult: any = { data: [], error: null }

  if (activeBoardId) {
    columnsResult = await supabase.from('board_columns').select('id,board_id,name,color,operational_status,automation_role,position,created_at,updated_at').eq('board_id',activeBoardId).order('position')
    assignmentsResult = await supabase.from('work_item_board_assignments').select('id,work_item_id,board_id,board_column_id,operational_status,is_required,assignment_status,position,assigned_at,completed_at,completed_by,metadata').eq('board_id',activeBoardId).eq('assignment_status','active').order('position')
  }

  const assignmentRows = assignmentsResult.data || []
  const workItemIds = assignmentRows.map((assignment: any) => assignment.work_item_id).filter(Boolean)
  if (workItemIds.length) {
    demandsResult = await supabase.from('work_items').select('id,title,description,type,status,priority,destino,board_id,board_column_id,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,briefing_link,moodboard_link,reference_link,notes,blocked_reason,created_at,updated_at,card_tag,card_tag_color,pauta_id,is_pauta_card,pauta_card_id,completed_at,programming_covered_until').in('id',workItemIds).not('status','in','(archived,cancelled)').limit(2000)
    scheduleRequirementsResult = await supabase.from('work_item_schedule_requirements').select('id,work_item_id,requirement_type,status,calendar_event_id,calendar_type,scheduled_at,confirmed_at,completed_at,created_at,updated_at,calendar_event:calendar_events(id,type,starts_at,ends_at,confirmed,location,responsible_id)').in('work_item_id',workItemIds)
  }

  const pautaIds = Array.from(new Set((demandsResult.data || []).map((item: any) => item.pauta_id).filter(Boolean)))
  if (pautaIds.length) {
    pautasResult = await supabase.from('pautas').select('id,board_id,name,reference_month,magic_number_date,scheduled_until_date,lifecycle_status,opened_at,closed_at,archived_at,created_at,updated_at').in('id',pautaIds)
  }

  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const servicesById = mapById(services)
  const pautasById = mapById(pautasResult.data || [])
  const itemsById = mapById(demandsResult.data || [])
  const requirementsByItem = new Map<string, any[]>()
  for (const requirement of scheduleRequirementsResult.data || []) {
    const calendarEvent = Array.isArray(requirement.calendar_event) ? requirement.calendar_event[0] || null : requirement.calendar_event || null
    const current = requirementsByItem.get(requirement.work_item_id) || []
    current.push({...requirement,calendar_event:calendarEvent})
    requirementsByItem.set(requirement.work_item_id,current)
  }

  const demands = assignmentRows.map((assignment: any) => {
    const item = itemsById.get(assignment.work_item_id)
    if (!item) return null
    return {
      ...item,
      assignment_id: assignment.id,
      assignment_status: assignment.assignment_status,
      assignment_is_required: assignment.is_required,
      assignment_completed_at: assignment.completed_at,
      assignment_completed_by: assignment.completed_by ? profilesById.get(assignment.completed_by) || null : null,
      assignment_metadata: assignment.metadata || {},
      global_status: item.status,
      board_id: assignment.board_id,
      board_column_id: assignment.board_column_id,
      status: assignment.operational_status,
      client: item.client_id ? clientsById.get(item.client_id) || null : null,
      responsible: item.responsible_id ? profilesById.get(item.responsible_id) || null : null,
      pauta: item.pauta_id ? pautasById.get(item.pauta_id) || null : null,
      schedule_requirements: requirementsByItem.get(item.id) || [],
    }
  }).filter(Boolean)

  const clientServices = (clientServicesResult.data || []).map((item: any) => ({
    ...item,
    service: item.service_catalog_id ? servicesById.get(item.service_catalog_id) || null : null,
  }))

  const loadErrors = [
    boardsResult.error ? `Quadros: ${boardsResult.error.message}` : null,
    columnsResult.error ? `Colunas: ${columnsResult.error.message}` : null,
    assignmentsResult.error ? `Distribuições: ${assignmentsResult.error.message}` : null,
    demandsResult.error ? `Demandas: ${demandsResult.error.message}` : null,
    scheduleRequirementsResult.error ? `Agenda operacional: ${scheduleRequirementsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Responsáveis: ${profilesResult.error.message}` : null,
    clientServicesResult.error ? `Serviços: ${clientServicesResult.error.message}` : null,
    pautasResult.error ? `Pautas relacionadas: ${pautasResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <BoardWorkspace
    boards={boards}
    activeBoardId={activeBoardId}
    pautas={[]}
    activePautaKey=""
    activePauta={null}
    initialItemId={String(searchParams.item || '')}
    columns={columnsResult.data || []}
    demands={demands}
    clients={clients}
    profiles={activeProfiles}
    clientServices={clientServices}
    canManage={await hasTotalAccess()}
    loadErrors={loadErrors}
    workspaceMode="boards"
  />
}
