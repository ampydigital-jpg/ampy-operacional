import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Authority comes from Auth and the server-managed team record, never form data/profile.role. */
export async function requireActiveActor() {
  const session = createClient()
  const { data: { user }, error } = await session.auth.getUser()
  if (error || !user) throw new Error('Sessão inválida.')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id,is_active').eq('id', user.id).maybeSingle()
  if (profile?.is_active !== true) throw new Error('Usuário inativo.')
  let { data: member } = await admin.from('team_members')
    .select('id,profile_id,email,full_name,access_type,is_active')
    .eq('profile_id', user.id).maybeSingle()
  // Legacy records may not have profile_id yet. Match the verified Auth email only.
  if (!member && user.email && user.email_confirmed_at) {
    const fallback = await admin.from('team_members')
      .select('id,profile_id,email,full_name,access_type,is_active')
      .is('profile_id', null).eq('email', user.email).maybeSingle()
    member = fallback.data
  }
  if (!member || member.is_active !== true) throw new Error('Acesso da equipe inativo.')
  return { user, member, admin, session, total: member.access_type === 'total' }
}

export async function requireTotalActor() {
  const actor = await requireActiveActor()
  if (!actor.total) throw new Error('Esta ação exige Acesso Total.')
  return actor
}

export type ActiveActor = Awaited<ReturnType<typeof requireActiveActor>>

export async function requireContextAccess(actor: ActiveActor, table: 'work_items' | 'clients' | 'feed_boards' | 'avisos', id: string) {
  const fields = table === 'work_items' ? 'id,responsible_id,created_by'
    : table === 'clients' ? 'id,responsible_id'
      : table === 'feed_boards' ? 'id,client_id,created_by' : 'id,assigned_to,created_by,work_item_id,client_id'
  const { data, error } = await actor.admin.from(table).select(fields).eq('id', id).maybeSingle()
  const row = data as any
  if (error || !row) throw new Error('Contexto não encontrado.')
  if (actor.total || row.responsible_id === actor.user.id || row.created_by === actor.user.id || row.assigned_to === actor.user.id) return
  if (row.work_item_id) return requireContextAccess(actor, 'work_items', row.work_item_id)
  if (row.client_id) return requireContextAccess(actor, 'clients', row.client_id)
  throw new Error('Você não possui permissão para acessar este contexto.')
}

export async function requireMessageResolution(actor: ActiveActor, id: string, workItemId?: string) {
  const { data: message, error } = await actor.admin.from('internal_messages')
    .select('id,created_by_profile_id,work_item_id,client_id,feed_board_id,aviso_id').eq('id', id).maybeSingle()
  if (error || !message || (workItemId && message.work_item_id !== workItemId)) throw new Error('Mensagem não encontrada.')
  if (actor.total || message.created_by_profile_id === actor.user.id) return
  if (message.work_item_id) return requireContextAccess(actor, 'work_items', message.work_item_id)
  throw new Error('Somente o autor ou Acesso Total pode resolver esta mensagem.')
}
