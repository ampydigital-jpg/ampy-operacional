import { createClient } from '@/lib/supabase/server'
import AgendaView from './AgendaView'

export default async function AgendaPage({ searchParams }: { searchParams: { periodo?: string } }) {
  const supabase = createClient()
  const periodo = searchParams.periodo || '30'
  const now = new Date()
  const dias = parseInt(periodo)
  const dataFim = new Date(now.getTime() + dias * 86400000)

  const [{ data: events }, { data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('calendar_events')
      .select('*, client:clients(name, avatar_initials), responsible:profiles(full_name)')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', dataFim.toISOString())
      .order('starts_at'),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  return (
    <AgendaView
      events={events || []}
      clients={clients || []}
      profiles={profiles || []}
      year={now.getFullYear()}
      month={now.getMonth()}
      periodo={periodo}
    />
  )
}
