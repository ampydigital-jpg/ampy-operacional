import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { postId, status, feedback } = await request.json()
    if (!postId || !status) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const supabase = createClient()
    const { error } = await supabase.from('feed_posts').update({
      status,
      client_feedback: feedback || null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', postId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
