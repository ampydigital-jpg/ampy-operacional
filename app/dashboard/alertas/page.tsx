import { createClient } from '@/lib/supabase/server'
import { isManager } from '@/lib/permissions'
import AlertasView from './AlertasView'

export default async function AlertasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id || '').single()
  const date = new Date().toISOString().slice(0, 10)

  let late = supabase.from('work_items').select('id,title,final_deadline,blocked_reason,client:clients(name),responsible_id').lt('final_deadline', date).not('status', 'in', '(done,cancelled,archived)').order('final_deadline').limit(100)
  let blocked = supabase.from('work_items').select('id,title,final_deadline,blocked_reason,client:clients(name),responsible_id').eq('status', 'blocked').not('status', 'in', '(done,cancelled,archived)').order('updated_at', { ascending: false }).limit(100)
  let urgent = supabase.from('work_items').select('id,title,final_deadline,blocked_reason,client:clients(name),responsible_id').eq('priority', 'urgent').not('status', 'in', '(done,cancelled,archived)').order('final_deadline').limit(100)
  let due = supabase.from('work_items').select('id,title,final_deadline,blocked_reason,client:clients(name),responsible_id').gte('final_deadline', date).lte('final_deadline', new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)).not('status', 'in', '(done,cancelled,archived)').order('final_deadline').limit(100)

  if (!isManager(profile?.role)) {
    late = late.eq('responsible_id', user?.id)
    blocked = blocked.eq('responsible_id', user?.id)
    urgent = urgent.eq('responsible_id', user?.id)
    due = due.eq('responsible_id', user?.id)
  }

  const [{ data: lateItems }, { data: blockedItems }, { data: urgentItems }, { data: dueItems }] = await Promise.all([late, blocked, urgent, due])
  const sections = [
    { title: 'Atrasadas', items: lateItems || [], label: 'Atrasada', color: '#DC2626' },
    { title: 'Bloqueadas', items: blockedItems || [], label: 'Bloqueada', color: '#DC2626' },
    { title: 'Urgentes', items: urgentItems || [], label: 'Urgente', color: '#DC2626' },
    { title: 'Entregas próximas', items: dueItems || [], label: 'Próxima', color: '#2563EB' },
  ]

  return <AlertasView sections={sections} profileId={user?.id || null} />
}
