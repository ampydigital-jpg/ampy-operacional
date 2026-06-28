import { createClient } from '@/lib/supabase/server'
import AvisosView from './AvisosView'

export default async function AvisosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id||'').single()
  
  // Buscar avisos internos da tabela chat_messages usando canal 'avisos'
  const { data: avisos } = await supabase
    .from('chat_messages')
    .select('*, author:profiles(full_name, avatar_initials, avatar_bg, avatar_color)')
    .eq('channel', 'avisos')
    .order('created_at', { ascending: false })
    .limit(50)

  return <AvisosView avisos={avisos||[]} currentProfile={profile} />
}
