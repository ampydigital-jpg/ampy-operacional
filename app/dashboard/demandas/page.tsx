import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import DemandasView from './DemandasView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export default async function DemandasPage({ searchParams }: { searchParams: { new?: string; context?: string; pauta?: string; board?: string; column?: string } }) {
  noStore()
  const supabase = createClient()

  const [
    demandsResult,
    assignmentsResult,
    clientsResult,
    profilesResult,
    clientServicesResult,
    servicesResult,
    boardsResult,
    columnsResult,
    projectStepsResult,
    projectStatusesResult,
    pautasResult,
    pautaCardsResult,
  ] = await Promise.all([
    supabase.from('work_items').select('id,title,description,type,origin,destino,status,priority,client_id,client_service_id,responsible_id,created_by,board_id,board_column_id,pauta_id,is_pauta_card,pauta_card_id,internal_deadline,final_deadline,drive_link,briefing_link,moodboard_link,reference_link,notes,created_at,updated_at,closed_at,completed_at,completed_by,card_tag,card_tag_color').not('status','in','(archived,cancelled)').order('updated_at',{ascending:false}).limit(500),
    supabase.from('work_item_board_assignments').select('id,work_item_id,board_id,board_column_id,operational_status,is_required,assignment_status,position,assigned_at,completed_at,completed_by,metadata').eq('assignment_status','active').order('assigned_at'),
    supabase.from('clients').select('id,name,segment,status').eq('status','active').order('name'),
    supabase.from('profiles').select('id,full_name,display_name,avatar_url,role,is_active').order('full_name'),
    supabase.from('client_services').select('id,client_id,service_catalog_id,status').eq('status','active'),
    supabase.from('service_catalog').select('id,name').eq('is_active',true).order('name'),
    supabase.from('boards').select('id,name,color,status,board_kind').eq('status','active').order('name'),
    supabase.from('board_columns').select('id,board_id,name,color,operational_status,position').order('position',{ascending:true}),
    supabase.from('project_steps').select('id,work_item_id,status_id,position').order('position',{ascending:true}),
    supabase.from('project_step_statuses').select('id,work_item_id,name,color,behavior,position,is_archived').eq('is_archived',false).order('position',{ascending:true}),
    supabase.from('pautas').select('id,board_id,name,reference_month,magic_number_date,scheduled_until_date,lifecycle_status,archived_at').is('archived_at',null).order('reference_month',{ascending:false}),
    supabase.from('work_items').select('id,title,pauta_id,client_id,board_id,board_column_id,is_pauta_card,status,created_at').eq('is_pauta_card',true).not('status','in','(archived,cancelled)').order('created_at',{ascending:false}).limit(2000),
  ])

  const clients = clientsResult.data || []
  const profiles = profilesResult.data || []
  const activeProfiles = profiles.filter((profile: any) => profile?.is_active !== false)
  const services = servicesResult.data || []
  const boards = boardsResult.data || []
  const columns = columnsResult.data || []
  const projectSteps = projectStepsResult.data || []
  const projectStatuses = projectStatusesResult.data || []
  const pautas = pautasResult.data || []
  const pautaCards = pautaCardsResult.data || []
  const clientServicesRaw = clientServicesResult.data || []

  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const servicesById = mapById(services)
  const boardsById = mapById(boards)
  const columnsById = mapById(columns)
  const pautasById = mapById(pautas)
  const projectStatusesById = mapById(projectStatuses)

  const assignmentsByWorkItem = new Map<string, any[]>()
  for (const assignment of assignmentsResult.data || []) {
    const current = assignmentsByWorkItem.get(assignment.work_item_id) || []
    current.push({
      ...assignment,
      board: boardsById.get(assignment.board_id) || null,
      board_column: columnsById.get(assignment.board_column_id) || null,
      completed_by_profile: assignment.completed_by ? profilesById.get(assignment.completed_by) || null : null,
    })
    assignmentsByWorkItem.set(assignment.work_item_id,current)
  }

  const projectStepsByWorkItem = projectSteps.reduce((accumulator: Map<string, any[]>, step: any) => {
    const current = accumulator.get(step.work_item_id) || []
    current.push(step)
    accumulator.set(step.work_item_id,current)
    return accumulator
  }, new Map<string, any[]>())

  const clientServices = clientServicesRaw.map((item: any) => ({
    ...item,
    service: item.service_catalog_id ? servicesById.get(item.service_catalog_id) || null : null,
  }))
  const clientServicesById = mapById(clientServices)

  const baseDemands = (demandsResult.data || []).map((item: any) => {
    const assignments = assignmentsByWorkItem.get(item.id) || []
    const primaryAssignment = assignments[0] || null
    return {
      ...item,
      assignments,
      client: item.client_id ? clientsById.get(item.client_id) || null : null,
      responsible: item.responsible_id ? profilesById.get(item.responsible_id) || null : null,
      client_service: item.client_service_id ? clientServicesById.get(item.client_service_id) || null : null,
      board: item.board_id ? boardsById.get(item.board_id) || null : primaryAssignment?.board || null,
      board_column: item.board_column_id ? columnsById.get(item.board_column_id) || null : primaryAssignment?.board_column || null,
      pauta: item.pauta_id ? pautasById.get(item.pauta_id) || null : null,
      completion_responsible: item.completed_by ? profilesById.get(item.completed_by) || null : null,
    }
  })

  const demands = baseDemands.map((item: any) => {
    const itemSteps = [...(projectStepsByWorkItem.get(item.id) || [])].sort((a: any,b: any) => Number(a.position || 0) - Number(b.position || 0))
    const activeStep = itemSteps.find((step: any) => {
      const definition = step.status_id ? projectStatusesById.get(step.status_id) || null : null
      return definition?.behavior !== 'done'
    }) || itemSteps[itemSteps.length - 1] || null
    return {
      ...item,
      project_status: activeStep?.status_id ? projectStatusesById.get(activeStep.status_id) || null : null,
    }
  })

  const loadErrors = [
    demandsResult.error ? `Demandas: ${demandsResult.error.message}` : null,
    assignmentsResult.error ? `Distribuições: ${assignmentsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    profilesResult.error ? `Responsáveis: ${profilesResult.error.message}` : null,
    clientServicesResult.error ? `Serviços do cliente: ${clientServicesResult.error.message}` : null,
    servicesResult.error ? `Catálogo de serviços: ${servicesResult.error.message}` : null,
    boardsResult.error ? `Quadros: ${boardsResult.error.message}` : null,
    columnsResult.error ? `Colunas: ${columnsResult.error.message}` : null,
    projectStepsResult.error ? `Etapas dos projetos: ${projectStepsResult.error.message}` : null,
    projectStatusesResult.error ? `Status dos projetos: ${projectStatusesResult.error.message}` : null,
    pautasResult.error ? `Pautas: ${pautasResult.error.message}` : null,
    pautaCardsResult.error ? `Cards mensais das Pautas: ${pautaCardsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  const requestedContext = String(searchParams.context || '')
  const initialCreateContext = {
    open: searchParams.new === '1',
    kind: ['pauta','quadro','avulsa'].includes(requestedContext) ? requestedContext : 'pauta',
    pautaId: String(searchParams.pauta || ''),
    boardId: String(searchParams.board || ''),
    columnId: String(searchParams.column || ''),
  }

  return <DemandasView
    demands={demands}
    clients={clients}
    profiles={activeProfiles}
    clientServices={clientServices}
    boards={boards}
    boardColumns={columns}
    pautas={pautas}
    pautaCards={pautaCards}
    initialCreateContext={initialCreateContext}
    loadErrors={loadErrors}
  />
}
