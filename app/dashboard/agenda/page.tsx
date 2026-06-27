import { createClient } from '@/lib/supabase/server'
import AgendaView from './AgendaView'

export default async function AgendaPage() {
  const supabase = createClient()

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

  const [{ data: events }, { data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('calendar_events').select('*, client:clients(name, avatar_initials), responsible:profiles(full_name)').gte('starts_at', firstDay).lte('starts_at', lastDay).order('starts_at'),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  return <AgendaView events={events || []} clients={clients || []} profiles={profiles || []} year={now.getFullYear()} month={now.getMonth()} />
}
