import { createClient } from '@/lib/supabase/server'
import RelatoriosView from './RelatoriosView'

export default async function RelatoriosPage() {
  const supabase = createClient()
  const { data: clients } = await supabase.from('clients').select('*, responsible:profiles(full_name), services:client_services(id, status, service:service_catalog(name))').eq('status', 'active').order('name')
  return <RelatoriosView clients={clients || []} />
}
