import { createClient } from '@/lib/supabase/server'
import KanbanView from '../kanban/KanbanView'

export default async function QuadroPage() {
  const supabase = createClient()
  const [{ data: demands }, { data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('work_items').select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg), responsible:profiles(full_name, avatar_initials)').in('destino', ['quadro','ambos','kanban']).not('status', 'in', '(archived,cancelled)').order('updated_at', { ascending: false }).limit(250),
    supabase.from('clients').select('id,name,avatar_initials,avatar_color,avatar_bg').eq('status','active').order('name'),
    supabase.from('profiles').select('id,full_name,avatar_initials,role').eq('is_active',true).order('full_name'),
  ])
  return <KanbanView demands={demands || []} clients={clients || []} profiles={profiles || []} />
}
