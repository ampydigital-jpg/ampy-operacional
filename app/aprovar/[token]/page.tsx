import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import PublicApprovalView from './PublicApprovalView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicApprovalPage({ params }: { params: { token: string } }) {
  noStore()

  const token = params.token
  const supabase = createAdminClient()

  const boardResult = await supabase
    .from('feed_boards')
    .select('id,client_id,title,period_month,status,visual_preset,share_token,notes,published_at,last_client_action_at,created_at,updated_at')
    .eq('share_token', token)
    .single()

  if (boardResult.error || !boardResult.data) notFound()

  const [clientResult, itemsResult, eventsResult] = await Promise.all([
    supabase
      .from('clients')
      .select('id,name,segment,instagram')
      .eq('id', boardResult.data.client_id)
      .single(),
    supabase
      .from('feed_board_items')
      .select('id,board_id,position,title,cover_url,content_url,caption,approval_status,client_feedback,approved_at,created_at,updated_at')
      .eq('board_id', boardResult.data.id)
      .order('position', { ascending: true }),
    supabase
      .from('feed_board_events')
      .select('id,board_id,item_id,actor_type,actor_name,event_type,message,metadata,created_at')
      .eq('board_id', boardResult.data.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const board = {
    ...boardResult.data,
    client: clientResult.data || null,
  }

  return (
    <PublicApprovalView
      token={token}
      board={board}
      items={itemsResult.data || []}
      events={eventsResult.data || []}
    />
  )
}