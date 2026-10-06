import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/permissions'
import DemandDetailView from './view'

export const dynamic = 'force-dynamic'

export default async function DemandDetailPage({ params }: { params: { id: string } }) {
  const { user, profile } = await getCurrentProfile()
  if (!user || !profile) redirect('/login')
  const supabase = createClient()
  const [demandResult, clientsResult, profilesResult, stepsResult, servicesResult] = await Promise.all([
    supabase.from('work_items').select('*,client:clients(name)').eq('id', params.id).maybeSingle(),
    supabase.from('clients').select('id,name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id,full_name').eq('is_active', true).order('full_name'),
    supabase.from('project_steps').select('*,responsible:profiles(full_name)').eq('work_item_id', params.id).order('position'),
    supabase.from('client_services').select('id,client_id,service:service_catalog(name)').eq('status', 'active'),
  ])
  if (demandResult.error) throw new Error('Não foi possível carregar a demanda.')
  if (!demandResult.data) notFound()
  if ([clientsResult, profilesResult, stepsResult, servicesResult].some(result => result.error)) {
    throw new Error('Não foi possível carregar os vínculos da demanda.')
  }
  return <DemandDetailView demand={demandResult.data} clients={clientsResult.data || []}
    profiles={profilesResult.data || []} steps={stepsResult.data || []} services={servicesResult.data || []} />
}
