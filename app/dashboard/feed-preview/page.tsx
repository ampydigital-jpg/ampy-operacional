import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import FeedPreviewHome from './FeedPreviewHome'

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

function boardStats(boardId: string, items: any[], events: any[]) {
  const boardItems = items.filter((item: any) => item.board_id === boardId)
  const boardEvents = events.filter((event: any) => event.board_id === boardId)
  const total = boardItems.length
  const approved = boardItems.filter((item: any) => item.approval_status === 'approved').length
  const changes = boardItems.filter((item: any) => item.approval_status === 'changes_requested').length
  const pending = boardItems.filter((item: any) => !item.approval_status || item.approval_status === 'pending').length
  const lastEvent = boardEvents[0] || null

  return {
    total,
    approved,
    changes,
    pending,
    last_event_message: lastEvent?.message || null,
    last_event_at: lastEvent?.created_at || null,
    last_event_actor: lastEvent?.actor_name || null,
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedPreviewPage() {
  noStore()

  const supabase = createClient()

  const [boardsResult, clientsResult, itemsResult, eventsResult] = await Promise.all([
    supabase
      .from('feed_boards')
      .select('id,client_id,title,period_month,status,visual_preset,share_token,notes,published_at,last_client_action_at,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(250),
    supabase
      .from('clients')
      .select('id,name,segment,status,main_contact_phone,instagram')
      .order('name'),
    supabase
      .from('feed_board_items')
      .select('id,board_id,approval_status,updated_at')
      .order('updated_at', { ascending: false })
      .limit(2000),
    supabase
      .from('feed_board_events')
      .select('id,board_id,item_id,actor_type,actor_name,event_type,message,created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  const clients = clientsResult.data || []
  const clientsById = mapById(clients)
  const items = itemsResult.data || []
  const events = eventsResult.data || []

  const boards = (boardsResult.data || []).map((board: any) => ({
    ...board,
    client: board.client_id ? clientsById.get(board.client_id) || null : null,
    stats: boardStats(board.id, items, events),
  }))

  const loadErrors = [
    boardsResult.error ? `Documentos: ${boardsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
    itemsResult.error ? `Itens: ${itemsResult.error.message}` : null,
    eventsResult.error ? `HistÃ³rico: ${eventsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <FeedPreviewHome boards={boards} clients={clients} loadErrors={loadErrors} />
}
