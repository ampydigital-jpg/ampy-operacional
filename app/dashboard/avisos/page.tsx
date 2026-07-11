import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import AvisosView from './AvisosView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export default async function AvisosPage() {
  noStore()

  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    profileResult,
    avisosResult,
    manualResult,
    boardsResult,
    itemsResult,
    eventsResult,
    workItemsResult,
    clientsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user?.id || '').single(),
    supabase.from('avisos').select('*').order('updated_at', { ascending: false }).limit(1000),
    supabase.from('chat_messages').select('*').eq('channel', 'avisos').order('created_at', { ascending: false }).limit(80),
    supabase.from('feed_boards').select('id,client_id,title,period_month,status,share_token,published_at,last_client_action_at,updated_at,created_at').order('updated_at', { ascending: false }).limit(250),
    supabase.from('feed_board_items').select('id,board_id,title,position,approval_status,workflow_status,client_feedback,scheduled_date,scheduled_time,updated_at,created_at').order('updated_at', { ascending: false }).limit(2000),
    supabase.from('feed_board_events').select('id,board_id,item_id,actor_type,actor_name,event_type,message,created_at').order('created_at', { ascending: false }).limit(500),
    supabase.from('work_items').select('id,title,client_id,type,status,priority,internal_deadline,final_deadline,blocked_reason,updated_at,created_at,destino').order('updated_at', { ascending: false }).limit(800),
    supabase.from('clients').select('id,name,segment,status').order('name'),
  ])

  const clients = clientsResult.data || []
  const clientsById = mapById(clients)

  const boards = (boardsResult.data || []).map((board: any) => ({
    ...board,
    client: board.client_id ? clientsById.get(board.client_id) || null : null,
  }))

  const workItems = (workItemsResult.data || []).map((item: any) => ({
    ...item,
    client: item.client_id ? clientsById.get(item.client_id) || null : null,
  }))

  const loadErrors = [
    profileResult.error ? `Perfil: ${profileResult.error.message}` : null,
    avisosResult.error ? `Avisos: ${avisosResult.error.message}` : null,
    manualResult.error ? `Avisos manuais: ${manualResult.error.message}` : null,
    boardsResult.error ? `Aprovações: ${boardsResult.error.message}` : null,
    itemsResult.error ? `Itens de aprovação: ${itemsResult.error.message}` : null,
    eventsResult.error ? `Histórico de aprovações: ${eventsResult.error.message}` : null,
    workItemsResult.error ? `Demandas: ${workItemsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return (
    <AvisosView
      currentProfile={profileResult.data || null}
      canonicalAvisos={avisosResult.data || []}
      manualAvisos={manualResult.data || []}
      boards={boards}
      items={itemsResult.data || []}
      events={eventsResult.data || []}
      workItems={workItems}
      clients={clients}
      loadErrors={loadErrors}
    />
  )
}
