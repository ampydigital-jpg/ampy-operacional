import { createClient } from '@/lib/supabase/server'
import DemandasView from './DemandasView'

export default async function DemandasPage() {
  const supabase = createClient()

  const [{ data: demands }, { data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('work_items').select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg), responsible:profiles(full_name, avatar_initials)').not('status', 'in', '(archived)').order('priority', { ascending: false }).order('final_deadline', { ascending: true }).limit(100),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, avatar_initials').eq('is_active', true).order('full_name'),
  ])

  return <DemandasView demands={demands || []} clients={clients || []} profiles={profiles || []} />
}
