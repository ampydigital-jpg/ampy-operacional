import { createClient } from '@/lib/supabase/server'
import ProjetosView from './ProjetosView'

export default async function ProjetosPage() {
  const supabase = createClient()
  const [{ data: demands }, { data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('work_items')
      .select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg), responsible:profiles(full_name, avatar_initials)')
      .in('destino', ['projeto','ambos'])
      .not('status', 'in', '(archived,cancelled)')
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, avatar_initials').eq('is_active', true).order('full_name'),
  ])
  return <ProjetosView demands={demands || []} clients={clients || []} profiles={profiles || []} />
}
