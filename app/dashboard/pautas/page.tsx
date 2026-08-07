import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import BoardWorkspace from '../quadro/BoardWorkspace'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapById(items: any[]) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export default async function PautasPage({ searchParams }: { searchParams: { board?: string; pauta?: string; item?: string; archived?: string } }) {
  noStore()
  const supabase = createClient()

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()

  let canManage = false

  if (user) {
    const [
      currentProfileResult,
      currentTeamResult,
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
          .from('team_members')
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
      currentProfileResult.data

    const team =
      currentTeamResult.data

    canManage =
      profile?.is_active !== false &&
      (
        [
          'admin',
          'director',
        ].includes(
          String(
            profile?.role || '',
          ),
        ) ||
        (
          team?.is_active !== false &&
          team?.access_type ===
            'total'
        )
      )
  }

  // V9.1 — PAUTAS ATIVAS E ARQUIVADAS
  const showArchived =
    searchParams.archived === '1'

  const [boardsResult, customBoardsResult, clientsResult, profilesResult, clientServicesResult, servicesResult] = await Promise.all([
    supabase.from('boards').select('id,name,description,color,status,board_kind,created_at,updated_at').eq('status','active').eq('board_kind','pauta').order('created_at'),
    supabase.from('boards').select('id,name,description,color,status,board_kind,created_at,updated_at').eq('status','active').eq('board_kind','custom').order('name'),
    supabase.from('clients').select('id,name,avatar_initials,avatar_color,avatar_bg,status,responsible_id,drive_folder_url').eq('status','active').order('name'),
    supabase.from('profiles').select('id,full_name,avatar_initials,role,is_active,display_name,avatar_url').eq('is_active',true).order('full_name'),
    supabase.from('client_services').select('id,client_id,service_catalog_id,status,requires_alignment_meeting,requires_capture,default_capture_type').eq('status','active'),
    supabase.from('service_catalog').select('id,name,is_active').eq('is_active',true),
  ])

  const boards = (boardsResult.data || []).map(
    (board: any) => ({
      ...board,
      name:
        board.board_kind === 'pauta'
          ? ''
          : board.name,
    }),
  )
  const distributionBoards = customBoardsResult.data || []
  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const services = servicesResult.data || []
  const activeBoardId = boards.some((board: any) => board.id === searchParams.board) ? String(searchParams.board) : String(boards[0]?.id || '')

  let pautasResult: any = { data: [], error: null }
  let columnsResult: any = { data: [], error: null }
  let distributionColumnsResult: any = { data: [], error: null }
  let demandsResult: any = { data: [], error: null }
  let scheduleRequirementsResult: any = { data: [], error: null }
  let assignmentsResult: any = { data: [], error: null }

  if (activeBoardId) {
    let pautaQuery = supabase
      .from('pautas')
      .select('id,board_id,name,reference_month,magic_number_date,scheduled_until_date,lifecycle_status,opened_at,closed_at,archived_at,created_at,updated_at')
      .eq('board_id', activeBoardId)

    pautaQuery = showArchived
      ? pautaQuery.eq(
          'lifecycle_status',
          'archived',
        )
      : pautaQuery.neq(
          'lifecycle_status',
          'archived',
        )

    pautasResult = await pautaQuery
      .order(
        'reference_month',
        { ascending: false },
      )
    columnsResult = await supabase.from('board_columns').select('id,board_id,name,color,operational_status,automation_role,position,created_at,updated_at').eq('board_id',activeBoardId).order('position')
  }

  if (distributionBoards.length) {
    distributionColumnsResult = await supabase.from('board_columns').select('id,board_id,name,color,operational_status,automation_role,position,created_at,updated_at').in('board_id',distributionBoards.map((board: any) => board.id)).order('position')
  }

  const pautas = pautasResult.data || []
  const requestedPauta = String(searchParams.pauta || '')
  const defaultPauta = pautas.find((pauta: any) => pauta.lifecycle_status === 'open') || pautas.find((pauta: any) => pauta.lifecycle_status === 'draft') || pautas[0] || null
  const activePautaKey =
    requestedPauta === 'all'
      ? 'all'
      : pautas.some(
          (pauta: any) =>
            pauta.id === requestedPauta,
        )
        ? requestedPauta
        : String(
            defaultPauta?.id || '',
          )
  const activePauta = pautas.find((pauta: any) => pauta.id === activePautaKey) || null

  let pautaManagementResult: any = { data: null, error: null }
  if (activePauta?.id) {
    pautaManagementResult = await supabase.rpc('get_pauta_management_snapshot',{p_pauta_id:activePauta.id})
  }

  const activePautaIds =
    pautas
      .map(
        (pauta: any) =>
          String(pauta.id || ''),
      )
      .filter(Boolean)

  if (
    activeBoardId &&
    activePautaKey &&
    (
      activePautaKey !== 'all' ||
      activePautaIds.length > 0
    )
  ) {
    let demandQuery =
      supabase
        .from('work_items')
        .select(
          'id,title,description,type,status,priority,destino,board_id,board_column_id,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,blocked_reason,created_at,updated_at,card_tag,card_tag_color,pauta_id,is_pauta_card,pauta_card_id,completed_at,programming_covered_until',
        )
        .not(
          'status',
          'in',
          '(archived,cancelled)',
        )

    if (
      activePautaKey === 'all'
    ) {
      demandQuery =
        demandQuery
          .eq(
            'is_pauta_card',
            true,
          )
          .in(
            'pauta_id',
            activePautaIds,
          )
    } else {
      demandQuery =
        demandQuery
          .eq(
            'pauta_id',
            activePautaKey,
          )
          .eq(
            'is_pauta_card',
            true,
          )
    }

    demandsResult =
      await demandQuery
        .order(
          'created_at',
          {
            ascending: false,
          },
        )
        .limit(2000)
  }

  const demandRows = demandsResult.data || []
  const demandIds = demandRows.map((item: any) => item.id).filter(Boolean)
  if (demandIds.length) {
    const [requirementsResult, activeAssignmentsResult] = await Promise.all([
      supabase.from('work_item_schedule_requirements').select('id,work_item_id,requirement_type,status,calendar_event_id,calendar_type,scheduled_at,confirmed_at,completed_at,created_at,updated_at,calendar_event:calendar_events(id,type,starts_at,ends_at,confirmed,location,responsible_id)').in('work_item_id',demandIds),
      supabase.from('work_item_board_assignments').select('id,work_item_id,board_id,board_column_id,operational_status,is_required,assignment_status,position,assigned_at,completed_at,metadata').in('work_item_id',demandIds).eq('assignment_status','active').order('assigned_at'),
    ])

    scheduleRequirementsResult = requirementsResult
    assignmentsResult = activeAssignmentsResult
  }

  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const servicesById = mapById(services)
  const pautasById = mapById(pautas)
  const distributionBoardsById = mapById(distributionBoards)
  const distributionColumnsById = mapById(distributionColumnsResult.data || [])
  const requirementsByItem = new Map<string, any[]>()
  const assignmentsByItem = new Map<string, any[]>()

  for (const requirement of scheduleRequirementsResult.data || []) {
    const calendarEvent = Array.isArray(requirement.calendar_event) ? requirement.calendar_event[0] || null : requirement.calendar_event || null
    const current = requirementsByItem.get(requirement.work_item_id) || []
    current.push({...requirement,calendar_event:calendarEvent})
    requirementsByItem.set(requirement.work_item_id,current)
  }

  for (const assignment of assignmentsResult.data || []) {
    const board = distributionBoardsById.get(assignment.board_id) || null
    const boardColumn = distributionColumnsById.get(assignment.board_column_id) || null
    const current = assignmentsByItem.get(assignment.work_item_id) || []

    current.push({
      ...assignment,
      board,
      board_column: boardColumn,
      board_name: board?.name || 'Quadro',
      board_column_name: boardColumn?.name || 'Sem coluna',
    })

    assignmentsByItem.set(assignment.work_item_id,current)
  }

  const demands = demandRows.map((item: any) => ({
    ...item,
    client: item.client_id ? clientsById.get(item.client_id) || null : null,
    responsible: item.responsible_id ? profilesById.get(item.responsible_id) || null : null,
    pauta: item.pauta_id ? pautasById.get(item.pauta_id) || null : null,
    schedule_requirements: requirementsByItem.get(item.id) || [],
    assignments: assignmentsByItem.get(item.id) || [],
  }))

  const clientServices = (clientServicesResult.data || []).map((item: any) => ({
    ...item,
    service: item.service_catalog_id ? servicesById.get(item.service_catalog_id) || null : null,
  }))

  const loadErrors = [
    boardsResult.error ? `Pautas: ${boardsResult.error.message}` : null,
    customBoardsResult.error ? `Quadros de destino: ${customBoardsResult.error.message}` : null,
    pautasResult.error ? `Pautas mensais: ${pautasResult.error.message}` : null,
    pautaManagementResult.error ? `Gestão da Pauta: ${pautaManagementResult.error.message}` : null,
    columnsResult.error ? `Colunas: ${columnsResult.error.message}` : null,
    distributionColumnsResult.error ? `Colunas de destino: ${distributionColumnsResult.error.message}` : null,
    demandsResult.error ? `Demandas: ${demandsResult.error.message}` : null,
    assignmentsResult.error ? `Distribuições: ${assignmentsResult.error.message}` : null,
    scheduleRequirementsResult.error ? `Agenda operacional: ${scheduleRequirementsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Responsáveis: ${profilesResult.error.message}` : null,
    clientServicesResult.error ? `Serviços: ${clientServicesResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <BoardWorkspace
    boards={boards}
    activeBoardId={activeBoardId}
    pautas={pautas}
    activePautaKey={activePautaKey}
    activePauta={activePauta}
    pautaManagement={pautaManagementResult.data || null}
    showArchived={showArchived}
    distributionBoards={distributionBoards}
    distributionColumns={distributionColumnsResult.data || []}
    initialItemId={String(searchParams.item || '')}
    columns={columnsResult.data || []}
    demands={demands}
    clients={clients}
    profiles={profiles}
    clientServices={clientServices}
    canManage={canManage}
    loadErrors={loadErrors}
    workspaceMode="pautas"
  />
}
