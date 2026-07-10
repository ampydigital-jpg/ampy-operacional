import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FeedBoardEditor from './FeedBoardEditor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FeedBoardPage({ params }: { params: { boardId: string } }) {
  noStore()

  const supabase = createClient()
  const boardId = params.boardId

  const boardResult = await supabase
    .from('feed_boards')
    .select('id,client_id,title,period_month,status,visual_preset,share_token,notes,drive_folder_url,published_at,last_client_action_at,created_at,updated_at')
    .eq('id', boardId)
    .single()

  if (boardResult.error || !boardResult.data) notFound()

  const [clientResult, itemsResult, eventsResult, assetsResult] = await Promise.all([
    supabase
      .from('clients')
      .select('id,name,segment,status,main_contact_phone,instagram,drive_folder_url')
      .eq('id', boardResult.data.client_id)
      .single(),
    supabase
      .from('feed_board_items')
      .select('id,board_id,work_item_id,position,title,cover_url,storage_path,content_type,source_file_name,content_url,caption,scheduled_date,scheduled_time,internal_notes,approval_status,client_feedback,approved_at,created_at,updated_at')
      .eq('board_id', boardId)
      .order('position', { ascending: true }),
    supabase
      .from('feed_board_events')
      .select('id,board_id,item_id,actor_type,actor_name,event_type,message,metadata,created_at')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('feed_board_item_assets')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true }),
  ])

  const board = {
    ...boardResult.data,
    client: clientResult.data || null,
  }

  const loadErrors = [
    clientResult.error ? `Cliente: ${clientResult.error.message}` : null,
    itemsResult.error ? `Itens: ${itemsResult.error.message}` : null,
    eventsResult.error ? `Historico: ${eventsResult.error.message}` : null,
  ].filter(Boolean) as string[]

  return <FeedBoardEditor board={board} items={itemsResult.data || []} events={eventsResult.data || []} assets={assetsResult.data || []} loadErrors={loadErrors} />
}







