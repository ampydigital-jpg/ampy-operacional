'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'



export async function createClientAction(formData: FormData) {
  const supabase = createClient()
  const name = formData.get('name') as string
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const colors = [
    { color: '#F59E0B', bg: '#1C1200' }, { color: '#22C55E', bg: '#052E16' },
    { color: '#8B5CF6', bg: '#0D0A1F' }, { color: '#3B82F6', bg: '#0A1628' },
    { color: '#EC4899', bg: '#1A0514' }, { color: '#10B981', bg: '#052019' },
    { color: '#F97316', bg: '#1C0E05' }, { color: '#06B6D4', bg: '#051A1F' },
  ]
  const c = colors[Math.floor(Math.random() * colors.length)]
  const { error } = await supabase.from('clients').insert({
    name,
    segment: formData.get('segment') as string || '',
    status: formData.get('status') as string || 'active',
    responsible_id: formData.get('responsible_id') as string || null,
    main_contact_name: formData.get('main_contact_name') as string || null,
    main_contact_email: formData.get('main_contact_email') as string || null,
    main_contact_phone: formData.get('main_contact_phone') as string || null,
    drive_folder_url: formData.get('drive_folder_url') as string || null,
    briefing_url: formData.get('briefing_url') as string || null,
    instagram: formData.get('instagram') as string || null,
    notes: formData.get('notes') as string || null,
    avatar_initials: initials,
    avatar_color: c.color,
    avatar_bg: c.bg,
    started_at: new Date().toISOString().split('T')[0],
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/clientes')
  return { success: true }
}

export async function createWorkItemAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const clientId = formData.get('client_id') as string || null
  const startDate = formData.get('start_date') as string || ''
  const endDate = formData.get('final_deadline') as string || ''
  let title = formData.get('title') as string
  
  // Auto-gerar título se não preenchido
  if (!title && clientId) {
    const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).single()
    if (client) title = generateTitle(client.name, startDate, endDate)
  }
  if (!title) title = 'Nova demanda'

  const { error } = await supabase.from('work_items').insert({
    title,
    description: formData.get('description') as string || null,
    client_id: clientId,
    type: formData.get('type') as string || 'task',
    origin: formData.get('origin') as string || 'planned',
    status: formData.get('status') as string || 'not_started',
    priority: formData.get('priority') as string || 'normal',
    responsible_id: formData.get('responsible_id') as string || null,
    internal_deadline: formData.get('internal_deadline') as string || null,
    final_deadline: endDate || null,
    drive_link: formData.get('drive_link') as string || null,
    notes: formData.get('notes') as string || null,
    created_by: user?.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/demandas')
  revalidatePath('/dashboard/kanban')
  return { success: true }
}

export async function updateWorkItemStatusAction(id: string, status: string) {
  const supabase = createClient()
  const { error } = await supabase.from('work_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/kanban')
  revalidatePath('/dashboard/demandas')
  return { success: true }
}

export async function deleteWorkItemAction(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('work_items').update({ status: 'archived' }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/demandas')
  revalidatePath('/dashboard/kanban')
  return { success: true }
}

export async function createCalendarEventAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const date = formData.get('date') as string
  const time = formData.get('time') as string || '09:00'
  const duration = parseInt(formData.get('duration') as string || '60')
  const starts_at = new Date(`${date}T${time}`).toISOString()
  const ends_at = new Date(new Date(`${date}T${time}`).getTime() + duration * 60000).toISOString()
  const color = formData.get('color') as string || '#3B82F6'
  const { error } = await supabase.from('calendar_events').insert({
    title: formData.get('title') as string,
    type: formData.get('type') as string || 'meeting',
    client_id: formData.get('client_id') as string || null,
    responsible_id: formData.get('responsible_id') as string || null,
    starts_at, ends_at,
    location: formData.get('location') as string || null,
    notes: formData.get('notes') as string || null,
    confirmed: false,
    created_by: user?.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda')
  return { success: true }
}

export async function createProjectAction(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.from('projects').insert({
    name: formData.get('name') as string,
    type: formData.get('type') as string || 'project',
    client_id: formData.get('client_id') as string || null,
    responsible_id: formData.get('responsible_id') as string || null,
    status: 'active',
    description: formData.get('description') as string || null,
    started_at: new Date().toISOString().split('T')[0],
    deadline: formData.get('deadline') as string || null,
    drive_folder_url: formData.get('drive_folder_url') as string || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/projetos')
  return { success: true }
}

export async function saveKanbanColumnsAction(columns: any[]) {
  const supabase = createClient()
  const { error } = await supabase.from('kanban_columns').upsert(
    columns.map((c, i) => ({ ...c, position: i })),
    { onConflict: 'id' }
  )
  if (error) return { error: error.message }
  revalidatePath('/dashboard/kanban')
  return { success: true }
}
