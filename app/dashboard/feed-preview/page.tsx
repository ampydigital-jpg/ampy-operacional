import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import FeedPreviewHome from './FeedPreviewHome'

function mapById(items: any[] | null | undefined) {
  return new Map((Array.isArray(items) ? items : []).filter(Boolean).map((item) => [item.id, item]))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedPreviewPage() {
  noStore()

  const supabase = createClient()

  const [boardsResult, clientsResult] = await Promise.all([
    supabase
      .from('feed_boards')
      .select('id,client_id,title,period_month,status,visual_preset,share_token,notes,published_at,last_client_action_at,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('clients')
      .select('id,name,segment,status,main_contact_phone,instagram')
      .order('name'),
  ])

  const clients = clientsResult.data || []
  const clientsById = mapById(clients)

  const boards = (boardsResult.data || []).map((board: any) => ({
    ...board,
    client: board.client_id ? clientsById.get(board.client_id) || null : null,
  }))

  const loadErrors = [
    boardsResult.error ? `Documentos: ${boardsResult.error.message}` : null,
    clientsResult.error ? `Clientes: ${clientsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <FeedPreviewHome boards={boards} clients={clients} loadErrors={loadErrors} />
}
