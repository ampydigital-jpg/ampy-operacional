import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ClientsView from './ClientsView'

export default async function ClientesPage() {
  const supabase = createClient()

  const [{ data: clients }, { data: profiles }] = await Promise.all([
    supabase.from('clients').select(`*, responsible:profiles(full_name, avatar_initials), services:client_services(id, status, service:service_catalog(name))`).order('name'),
    supabase.from('profiles').select('id, full_name, avatar_initials').eq('is_active', true).order('full_name'),
  ])

  const [{ count: total }, { count: active }, { count: paused }] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'paused'),
  ])

  return <ClientsView clients={clients || []} profiles={profiles || []} stats={{ total: total ?? 0, active: active ?? 0, paused: paused ?? 0 }} />
}
