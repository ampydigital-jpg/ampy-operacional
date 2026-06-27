'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createClientAction(formData: FormData) {
  const supabase = createClient()
  const name = formData.get('name') as string
  const segment = formData.get('segment') as string
  const status = formData.get('status') as string
  const responsible_id = formData.get('responsible_id') as string
  const main_contact_email = formData.get('main_contact_email') as string
  const main_contact_phone = formData.get('main_contact_phone') as string
  const main_contact_name = formData.get('main_contact_name') as string
  const drive_folder_url = formData.get('drive_folder_url') as string
  const briefing_url = formData.get('briefing_url') as string
  const instagram = formData.get('instagram') as string
  const notes = formData.get('notes') as string

  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const colors = [
    { color: '#CC8800', bg: '#1A1200' }, { color: '#4CAF50', bg: '#0A1A10' },
    { color: '#9575CD', bg: '#0D0A1A' }, { color: '#42A5F5', bg: '#0A1520' },
    { color: '#E91E63', bg: '#1A0A14' }, { color: '#66BB6A', bg: '#0A1A0A' },
    { color: '#FF7043', bg: '#1A0C0A' }, { color: '#26C6DA', bg: '#0A1A1A' },
  ]
  const c = colors[Math.floor(Math.random() * colors.length)]

  const { error } = await supabase.from('clients').insert({
    name, segment, status: status || 'active',
    responsible_id: responsible_id || null,
    main_contact_name, main_contact_email, main_contact_phone,
    drive_folder_url, briefing_url, instagram, notes,
    avatar_initials: initials, avatar_color: c.color, avatar_bg: c.bg,
    started_at: new Date().toISOString().split('T')[0],
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/clientes')
  return { success: true }
}

export async function createWorkItemAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('work_items').insert({
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    client_id: formData.get('client_id') as string || null,
    type: formData.get('type') as string || 'task',
    origin: formData.get('origin') as string || 'planned',
    status: 'not_started',
    priority: formData.get('priority') as string || 'normal',
    responsible_id: formData.get('responsible_id') as string || null,
    internal_deadline: formData.get('internal_deadline') as string || null,
    final_deadline: formData.get('final_deadline') as string || null,
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
  const { error } = await supabase.from('work_items').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/kanban')
  revalidatePath('/dashboard/demandas')
  return { success: true }
}

export async function createCalendarEventAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const date = formData.get('date') as string
  const time = formData.get('time') as string
  const duration = parseInt(formData.get('duration') as string || '60')
  const starts_at = new Date(`${date}T${time}`).toISOString()
  const ends_at = new Date(new Date(`${date}T${time}`).getTime() + duration * 60000).toISOString()

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

export async function createProfileAction(formData: FormData) {
  const supabase = createClient()
  const email = formData.get('email') as string
  const full_name = formData.get('full_name') as string
  const role = formData.get('role') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name }
  })

  if (error) return { error: error.message }

  await supabase.from('profiles').update({
    full_name,
    role,
    avatar_initials: full_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
  }).eq('id', data.user.id)

  revalidatePath('/dashboard/equipe')
  return { success: true }
}

export async function createProjectAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
