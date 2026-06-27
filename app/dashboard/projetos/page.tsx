import { createClient } from '@/lib/supabase/server'
import ProjetosView from './ProjetosView'

export default async function ProjetosPage() {
  const supabase = createClient()
  const [{ data: projects }, { data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg), responsible:profiles(full_name)').not('status', 'eq', 'cancelled').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])
  return <ProjetosView projects={projects || []} clients={clients || []} profiles={profiles || []} />
}
