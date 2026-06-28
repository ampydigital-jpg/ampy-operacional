import { createClient } from '@/lib/supabase/server'
import ClientsView from './ClientsView'

export default async function ClientesPage() {
  const supabase = createClient()
  const [{ data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('clients').select('*, responsible:profiles(full_name, avatar_initials)').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, avatar_initials').eq('is_active', true).order('full_name'),
  ])
  return <ClientsView clients={clients || []} profiles={profiles || []} />
}
