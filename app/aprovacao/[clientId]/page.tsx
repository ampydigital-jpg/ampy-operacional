import { createClient } from '@/lib/supabase/server'
import AprovacaoClient from './AprovacaoClient'

export default async function AprovacaoPage({ params }: { params: { clientId: string } }) {
  const supabase = createClient()
  const [{ data: client }, { data: posts }] = await Promise.all([
    supabase.from('clients').select('name, avatar_initials, avatar_color, avatar_bg, instagram').eq('id', params.clientId).single(),
    supabase.from('feed_posts').select('*').eq('client_id', params.clientId).order('position'),
  ])

  if (!client) {
    return (
      <div style={{ background: '#0C0C0C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontFamily: 'Poppins,sans-serif' }}>
        Cliente não encontrado.
      </div>
    )
  }

  return <AprovacaoClient client={client} posts={posts || []} clientId={params.clientId} />
}
