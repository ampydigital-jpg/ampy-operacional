import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import BoardWorkspace from './BoardWorkspace'

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

export default async function QuadroPage({
  searchParams,
}: {
  searchParams: { board?: string }
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
        'id,name,description,color,status,created_at,updated_at',
      )
      .eq('status', 'active')
      .order('created_at'),
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
      .from('client_services')
      .select(
        'id,client_id,service_catalog_id,status',
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

  let demandsResult: any = {
    data: [],
    error: null,
  }

  if (activeBoardId) {
    demandsResult = await supabase
      .from('work_items')
      .select(
        'id,title,description,type,status,priority,destino,board_id,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,blocked_reason,created_at,updated_at',
      )
      .eq('board_id', activeBoardId)
      .not('status', 'in', '(archived,cancelled)')
      .order('created_at', { ascending: false })
      .limit(1000)
  }

  const clientsById = mapById(clients)
  const profilesById = mapById(profiles)
  const servicesById = mapById(services)

  const demands = (demandsResult.data || []).map(
    (item: any) => ({
      ...item,
      client: item.client_id
        ? clientsById.get(item.client_id) || null
        : null,
      responsible: item.responsible_id
        ? profilesById.get(item.responsible_id) || null
        : null,
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
    demandsResult.error
      ? `Demandas: ${demandsResult.error.message}`
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
      demands={demands}
      clients={clients}
      profiles={profiles}
      clientServices={clientServices}
      canManage={await hasTotalAccess()}
      loadErrors={loadErrors}
    />
  )
}
