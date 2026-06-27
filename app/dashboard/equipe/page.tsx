import { createClient } from '@/lib/supabase/server'
import EquipeView from './EquipeView'

export default async function EquipePage() {
  const supabase = createClient()
  const { data: profiles } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name')
  return <EquipeView profiles={profiles || []} />
}
