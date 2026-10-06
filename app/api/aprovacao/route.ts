import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireActiveActor, requireContextAccess } from '@/lib/server-access'

export async function POST(request: Request) {
  try {
    let actor
    try { actor = await requireActiveActor() } catch {
      return NextResponse.json({ error: 'Sessão inválida ou inativa' }, { status: 401 })
    }
    const { postId, status, feedback } = await request.json()
    if (typeof postId !== 'string' || !['approved', 'changes_requested'].includes(status) ||
        (feedback != null && (typeof feedback !== 'string' || feedback.length > 5000))) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    const { data: post } = await actor.session.from('feed_posts').select('id,client_id').eq('id', postId).maybeSingle()
    if (!post) return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
    try { await requireContextAccess(actor, 'clients', post.client_id) } catch {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const supabase = createClient()
    const { error } = await supabase.from('feed_posts').update({
      status,
      client_feedback: feedback || null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', postId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
