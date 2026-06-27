import { createClient } from '@/lib/supabase/server'
import ChatView from './ChatView'

export default async function ChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id || '').single()
  return <ChatView currentProfile={profile} />
}
