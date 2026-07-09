'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile, isAdmin, isManager, forbidden } from '@/lib/permissions'
import type { DemandProcess, WorkItemStatus } from '@/types'
import { ampyLocalDateTimeToIso } from '@/lib/date'

const ALL_PATHS = [
  '/dashboard', '/dashboard/demandas', '/dashboard/quadro', '/dashboard/kanban',
  '/dashboard/projetos', '/dashboard/agenda', '/dashboard/meu-dia',
  '/dashboard/minha-semana', '/dashboard/semana-equipe', '/dashboard/alertas',
  '/dashboard/clientes', '/dashboard/equipe', '/dashboard/feed-preview',
]

const VALID_DEMAND_PROCESSES: DemandProcess[] = ['quadro', 'projeto', 'ambos', 'avulsa']
const VALID_WORK_ITEM_STATUSES: WorkItemStatus[] = [
  'not_started', 'in_progress', 'waiting', 'blocked', 'in_review', 'awaiting_approval',
  'approved', 'scheduled', 'delivered', 'done', 'cancelled', 'archived',
]

function revalidateOperationalPaths() {
  ALL_PATHS.forEach((path) => revalidatePath(path))
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function nullable(formData: FormData, key: string) {
  const result = value(formData, key)
  return result || null
}

function normalizeProcess(input?: string | null): DemandProcess {
  const normalized = input === 'kanban' ? 'quadro' : input
  return VALID_DEMAND_PROCESSES.includes(normalized as DemandProcess) ? normalized as DemandProcess : 'quadro'
}

function buildInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase() || 'CL'
}

async function addHistory(workItemId: string, actorId: string | undefined, fieldChanged: string, oldValue?: string | null, newValue?: string | null) {
  if (!actorId) return
  const supabase = createClient()
  await supabase.from('work_item_history').insert({
    work_item_id: workItemId,
    actor_id: actorId,
    field_changed: fieldChanged,
    old_value: oldValue || null,
    new_value: newValue || null,
  })
}

async function canOperateWorkItem(id: string) {
  const { supabase, user, profile } = await getCurrentProfile()
  if (!user || !profile) return { error: 'Sessão inválida ou usuário inativo.' as const }
  const { data: item, error } = await supabase
    .from('work_items')
    .select('id, title, client_id, client_service_id, responsible_id, created_by, status, destino')
    .eq('id', id)
    .single()
  if (error || !item) return { error: 'Demanda não encontrada.' as const }
  if (!isManager(profile.role) && item.responsible_id !== user.id && item.created_by !== user.id) {
    return { error: 'Você não possui permissão para alterar esta demanda.' as const }
  }
  return { supabase, user, profile, item }
}

async function validateWorkItemLinks(supabase: ReturnType<typeof createClient>, clientId: string | null, clientServiceId: string | null) {
  if (!clientServiceId) return { ok: true as const }
  if (!clientId) return { error: 'Serviço vinculado exige um cliente. Para demanda interna, deixe o serviço em branco.' as const }
  const { data: service, error } = await supabase
    .from('client_services')
    .select('id, client_id, status')
    .eq('id', clientServiceId)
    .single()
  if (error || !service) return { error: 'Serviço vinculado não encontrado.' as const }
  if (service.client_id !== clientId) return { error: 'O serviço selecionado não pertence ao cliente desta demanda.' as const }
  if (service.status !== 'active') return { error: 'O serviço selecionado não está ativo.' as const }
  return { ok: true as const }
}

async function validateCalendarLinks(supabase: ReturnType<typeof createClient>, clientId: string | null, workItemId: string | null) {
  if (!workItemId) return { clientId, ok: true as const }
  const { data: item, error } = await supabase
    .from('work_items')
    .select('id, client_id, status')
    .eq('id', workItemId)
    .single()
  if (error || !item) return { error: 'Demanda vinculada à agenda não foi encontrada.' as const }
  if (['archived', 'cancelled'].includes(item.status)) return { error: 'Não vincule agenda a uma demanda arquivada ou cancelada.' as const }
  if (clientId && item.client_id !== clientId) return { error: 'Cliente da agenda não corresponde ao cliente da demanda vinculada.' as const }
  return { clientId: item.client_id || clientId, ok: true as const }
}

export async function createClientAction(formData: FormData) {
  const { supabase, profile } = await getCurrentProfile()
  if (!profile || !isManager(profile.role)) return forbidden()
  const name = value(formData, 'name')
  if (!name) return { error: 'Informe o nome do cliente.' }
  const palette = [
    { color: '#F59E0B', bg: '#1C1200' }, { color: '#22C55E', bg: '#052E16' },
    { color: '#8B5CF6', bg: '#0D0A1F' }, { color: '#3B82F6', bg: '#0A1628' },
    { color: '#EC4899', bg: '#1A0514' }, { color: '#10B981', bg: '#052019' },
  ]
  const color = palette[Math.floor(Math.random() * palette.length)]
  const { error } = await supabase.from('clients').insert({
    name,
    segment: nullable(formData, 'segment') || '',
    cidade: nullable(formData, 'cidade'),
    status: value(formData, 'status') || 'active',
    responsible_id: nullable(formData, 'responsible_id'),
    main_contact_name: nullable(formData, 'main_contact_name'),
    main_contact_email: nullable(formData, 'main_contact_email'),
    main_contact_phone: nullable(formData, 'main_contact_phone'),
    drive_folder_url: nullable(formData, 'drive_folder_url'),
    briefing_url: nullable(formData, 'briefing_url'),
    instagram: nullable(formData, 'instagram'),
    notes: nullable(formData, 'notes'),
    inicio_contrato: nullable(formData, 'inicio_contrato'),
    fim_contrato: nullable(formData, 'fim_contrato'),
    started_at: nullable(formData, 'inicio_contrato') || new Date().toISOString().slice(0, 10),
    ended_at: nullable(formData, 'fim_contrato'),
    avatar_initials: buildInitials(name),
    avatar_color: color.color,
    avatar_bg: color.bg,
  })
  if (error) return { error: error.message }
  revalidateOperationalPaths()
  return { success: true }
}

export async function updateClientAction(formData: FormData) {
  const { supabase, profile } = await getCurrentProfile()
  if (!profile || !isManager(profile.role)) return forbidden()
  const id = value(formData, 'id')
  const name = value(formData, 'name')
  if (!id || !name) return { error: 'Cliente inválido.' }
  const { error } = await supabase.from('clients').update({
    name,
    segment: nullable(formData, 'segment') || '',
    cidade: nullable(formData, 'cidade'),
    status: value(formData, 'status') || 'active',
    responsible_id: nullable(formData, 'responsible_id'),
    main_contact_name: nullable(formData, 'main_contact_name'),
    main_contact_email: nullable(formData, 'main_contact_email'),
    main_contact_phone: nullable(formData, 'main_contact_phone'),
    drive_folder_url: nullable(formData, 'drive_folder_url'),
    briefing_url: nullable(formData, 'briefing_url'),
    instagram: nullable(formData, 'instagram'),
    notes: nullable(formData, 'notes'),
    inicio_contrato: nullable(formData, 'inicio_contrato'),
    fim_contrato: nullable(formData, 'fim_contrato'),
    started_at: nullable(formData, 'inicio_contrato'),
    ended_at: nullable(formData, 'fim_contrato'),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidateOperationalPaths()
  return { success: true }
}

export async function createClientServiceAction(formData: FormData) {
  const { supabase, profile } = await getCurrentProfile()
  if (!profile || !isManager(profile.role)) return forbidden()
  const clientId = value(formData, 'client_id')
  const serviceCatalogId = value(formData, 'service_catalog_id')
  if (!clientId || !serviceCatalogId) return { error: 'Cliente e serviço são obrigatórios.' }
  const monthly = value(formData, 'monthly_quantity')
  const { error } = await supabase.from('client_services').insert({
    client_id: clientId,
    service_catalog_id: serviceCatalogId,
    responsible_id: nullable(formData, 'responsible_id'),
    status: value(formData, 'status') || 'active',
    started_at: nullable(formData, 'started_at'),
    monthly_quantity: monthly ? Number(monthly) : null,
    quantity_unit: nullable(formData, 'quantity_unit'),
    notes: nullable(formData, 'notes'),
  })
  if (error) return { error: error.message }
  revalidateOperationalPaths()
  return { success: true }
}

export async function updateClientServiceAction(formData: FormData) {
  const { supabase, profile } = await getCurrentProfile()
  if (!profile || !isManager(profile.role)) return forbidden()
  const id = value(formData, 'id')
  const monthly = value(formData, 'monthly_quantity')
  if (!id) return { error: 'Serviço inválido.' }
  const { error } = await supabase.from('client_services').update({
    responsible_id: nullable(formData, 'responsible_id'),
    status: value(formData, 'status') || 'active',
    monthly_quantity: monthly ? Number(monthly) : null,
    quantity_unit: nullable(formData, 'quantity_unit'),
    notes: nullable(formData, 'notes'),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidateOperationalPaths()
  return { success: true }
}

export async function createWorkItemAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentProfile()
  if (!user || !profile) return { error: 'Sessão inválida ou usuário inativo.' }
  const title = value(formData, 'title')
  const destino = normalizeProcess(value(formData, 'destino'))
  if (!title) return { error: 'Informe o título da demanda.' }
  const clientId = nullable(formData, 'client_id')
  const clientServiceId = nullable(formData, 'client_service_id')
  const linkValidation = await validateWorkItemLinks(supabase, clientId, clientServiceId)
  if ('error' in linkValidation) return linkValidation
  const requestedResponsible = nullable(formData, 'responsible_id')
  const responsibleId = isManager(profile.role) ? requestedResponsible : user.id
  const { data, error } = await supabase.from('work_items').insert({
    title,
    description: nullable(formData, 'description'),
    client_id: clientId,
    client_service_id: clientServiceId,
    type: nullable(formData, 'type') || (clientId ? 'Planejamento' : 'Interno'),
    origin: value(formData, 'origin') || (clientId ? 'planned' : 'internal'),
    destino,
    status: 'not_started',
    priority: value(formData, 'priority') || 'normal',
    responsible_id: responsibleId,
    created_by: user.id,
    internal_deadline: nullable(formData, 'internal_deadline'),
    final_deadline: nullable(formData, 'final_deadline'),
    drive_link: nullable(formData, 'drive_link'),
    notes: nullable(formData, 'notes'),
  }).select('id').single()
  if (error) return { error: error.message }
  await addHistory(data.id, user.id, 'created', null, destino)
  revalidateOperationalPaths()
  return { success: true, id: data.id }
}

export async function updateWorkItemAction(id: string, formData: FormData) {
  const permission = await canOperateWorkItem(id)
  if ('error' in permission) return permission
  const { supabase, user, profile, item } = permission
  const title = value(formData, 'title')
  if (!title) return { error: 'Informe o título da demanda.' }
  const clientId = nullable(formData, 'client_id')
  const clientServiceId = nullable(formData, 'client_service_id')
  const linkValidation = await validateWorkItemLinks(supabase, clientId, clientServiceId)
  if ('error' in linkValidation) return linkValidation
  const update: Record<string, unknown> = {
    title,
    description: nullable(formData, 'description'),
    client_id: clientId,
    client_service_id: clientServiceId,
    type: nullable(formData, 'type') || (clientId ? 'Planejamento' : 'Interno'),
    origin: value(formData, 'origin') || (clientId ? 'planned' : 'internal'),
    destino: normalizeProcess(value(formData, 'destino') || item.destino),
    priority: value(formData, 'priority') || 'normal',
    internal_deadline: nullable(formData, 'internal_deadline'),
    final_deadline: nullable(formData, 'final_deadline'),
    drive_link: nullable(formData, 'drive_link'),
    notes: nullable(formData, 'notes'),
    blocked_reason: nullable(formData, 'blocked_reason'),
  }
  if (isManager(profile.role)) update.responsible_id = nullable(formData, 'responsible_id')
  const { error } = await supabase.from('work_items').update(update).eq('id', id)
  if (error) return { error: error.message }
  await addHistory(id, user.id, 'updated', null, title)
  if (item.destino !== update.destino) await addHistory(id, user.id, 'destino', item.destino, String(update.destino))
  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${id}`)
  return { success: true }
}

export async function updateWorkItemStatusAction(id: string, status: WorkItemStatus | string) {
  if (!VALID_WORK_ITEM_STATUSES.includes(status as WorkItemStatus)) return { error: 'Status inválido.' }
  const permission = await canOperateWorkItem(id)
  if ('error' in permission) return permission
  const { supabase, user, item } = permission
  const update: Record<string, unknown> = { status }
  if (['done', 'delivered', 'cancelled', 'archived'].includes(String(status))) update.closed_at = new Date().toISOString()
  if (['done', 'delivered', 'cancelled', 'archived'].includes(item.status) && !['done', 'delivered', 'cancelled', 'archived'].includes(String(status))) update.closed_at = null
  const { error } = await supabase.from('work_items').update(update).eq('id', id)
  if (error) return { error: error.message }
  await addHistory(id, user.id, 'status', item.status, status)
  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${id}`)
  return { success: true }
}

export async function deleteWorkItemAction(id: string) {
  const permission = await canOperateWorkItem(id)
  if ('error' in permission) return permission
  const { supabase, user } = permission
  const { error } = await supabase.from('work_items').update({ status: 'archived', closed_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  await addHistory(id, user.id, 'archived', null, 'archived')
  revalidateOperationalPaths()
  return { success: true }
}

export async function createProjectStepAction(formData: FormData) {
  const workItemId = value(formData, 'work_item_id')
  const permission = await canOperateWorkItem(workItemId)
  if ('error' in permission) return permission
  const { supabase, user } = permission
  const title = value(formData, 'title')
  if (!title) return { error: 'Informe o título da etapa.' }
  const { count } = await supabase.from('project_steps').select('*', { count: 'exact', head: true }).eq('work_item_id', workItemId)
  const { error } = await supabase.from('project_steps').insert({
    work_item_id: workItemId,
    title,
    responsible_id: nullable(formData, 'responsible_id'),
    start_date: nullable(formData, 'start_date'),
    end_date: nullable(formData, 'end_date'),
    status: 'not_started',
    notes: nullable(formData, 'notes'),
    position: count || 0,
  })
  if (error) return { error: error.message }
  await addHistory(workItemId, user.id, 'project_step_created', null, title)
  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${workItemId}`)
  return { success: true }
}

export async function updateProjectStepStatusAction(stepId: string, workItemId: string, status: string) {
  const validStepStatuses = ['not_started', 'in_progress', 'waiting', 'blocked', 'done']
  if (!validStepStatuses.includes(status)) return { error: 'Status de etapa inválido.' }
  const permission = await canOperateWorkItem(workItemId)
  if ('error' in permission) return permission
  const { supabase, user } = permission
  const { data: existing } = await supabase.from('project_steps').select('status,title').eq('id', stepId).eq('work_item_id', workItemId).single()
  const { error } = await supabase.from('project_steps').update({ status }).eq('id', stepId).eq('work_item_id', workItemId)
  if (error) return { error: error.message }
  await addHistory(workItemId, user.id, 'project_step_status', existing?.status || null, `${existing?.title || stepId}: ${status}`)
  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${workItemId}`)
  return { success: true }
}

export async function deleteProjectStepAction(stepId: string, workItemId: string) {
  const permission = await canOperateWorkItem(workItemId)
  if ('error' in permission) return permission
  const { supabase, user } = permission
  const { data: existing } = await supabase.from('project_steps').select('title').eq('id', stepId).eq('work_item_id', workItemId).single()
  const { error } = await supabase.from('project_steps').delete().eq('id', stepId).eq('work_item_id', workItemId)
  if (error) return { error: error.message }
  await addHistory(workItemId, user.id, 'project_step_deleted', existing?.title || stepId, null)
  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${workItemId}`)
  return { success: true }
}

function isoFromForm(formData: FormData, dateKey: string, timeKey: string, allDay: boolean, endOfDay = false) {
  const date = value(formData, dateKey)
  const time = value(formData, timeKey) || '09:00'
  if (!date) return null
  return ampyLocalDateTimeToIso(date, time, allDay, endOfDay)
}

async function findCalendarConflict(supabase: ReturnType<typeof createClient>, responsibleId: string | null, startsAt: string, endsAt: string, ignoreId?: string) {
  if (!responsibleId) return null
  let query = supabase
    .from('calendar_events')
    .select('id,title,starts_at,ends_at')
    .eq('responsible_id', responsibleId)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt)
    .limit(1)
  if (ignoreId) query = query.neq('id', ignoreId)
  const { data, error } = await query
  if (error) return null
  return data?.[0] || null
}

export async function createCalendarEventAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentProfile()
  if (!user || !profile) return { error: 'Sessão inválida ou usuário inativo.' }
  const title = value(formData, 'title')
  if (!title) return { error: 'Informe o título da agenda.' }
  const allDay = value(formData, 'all_day') === 'on'
  const startsAt = isoFromForm(formData, 'start_date', 'start_time', allDay)
  const endsAt = isoFromForm(formData, 'end_date', 'end_time', allDay, true)
  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) return { error: 'Informe início e término válidos.' }
  const requestedResponsible = nullable(formData, 'responsible_id')
  const responsibleId = isManager(profile.role) ? requestedResponsible : user.id
  const linked = await validateCalendarLinks(supabase, nullable(formData, 'client_id'), nullable(formData, 'work_item_id'))
  if ('error' in linked) return linked
  const conflict = await findCalendarConflict(supabase, responsibleId, startsAt, endsAt)
  if (conflict) return { error: `Conflito de agenda com “${conflict.title}”. Reagende ou altere o responsável.` }
  const { data, error } = await supabase.from('calendar_events').insert({
    title,
    type: value(formData, 'type') || 'internal',
    client_id: linked.clientId,
    work_item_id: nullable(formData, 'work_item_id'),
    responsible_id: responsibleId,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
    color: nullable(formData, 'color'),
    recurrence_rule: nullable(formData, 'recurrence_rule'),
    location: nullable(formData, 'location'),
    notes: nullable(formData, 'notes'),
    confirmed: false,
    drive_link: nullable(formData, 'drive_link'),
    created_by: user.id,
  }).select('id, work_item_id').single()
  if (error) return { error: error.message }
  if (data?.work_item_id) await addHistory(data.work_item_id, user.id, 'calendar_event_created', null, title)
  revalidateOperationalPaths()
  return { success: true }
}

export async function updateCalendarEventAction(id: string, formData: FormData) {
  const { supabase, user, profile } = await getCurrentProfile()
  if (!user || !profile) return { error: 'Sessão inválida ou usuário inativo.' }
  const { data: existing } = await supabase.from('calendar_events').select('responsible_id, created_by, work_item_id, title').eq('id', id).single()
  if (!existing || (!isManager(profile.role) && existing.responsible_id !== user.id && existing.created_by !== user.id)) return forbidden('Você não possui permissão para alterar esta agenda.')
  const allDay = value(formData, 'all_day') === 'on'
  const startsAt = isoFromForm(formData, 'start_date', 'start_time', allDay)
  const endsAt = isoFromForm(formData, 'end_date', 'end_time', allDay, true)
  if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) return { error: 'Informe início e término válidos.' }
  const responsibleId = isManager(profile.role) ? nullable(formData, 'responsible_id') : existing.responsible_id
  const linked = await validateCalendarLinks(supabase, nullable(formData, 'client_id'), nullable(formData, 'work_item_id'))
  if ('error' in linked) return linked
  const conflict = await findCalendarConflict(supabase, responsibleId, startsAt, endsAt, id)
  if (conflict) return { error: `Conflito de agenda com “${conflict.title}”. Reagende ou altere o responsável.` }
  const { error } = await supabase.from('calendar_events').update({
    title: value(formData, 'title'), type: value(formData, 'type') || 'internal',
    client_id: linked.clientId, work_item_id: nullable(formData, 'work_item_id'),
    responsible_id: responsibleId,
    starts_at: startsAt, ends_at: endsAt, all_day: allDay, color: nullable(formData, 'color'),
    recurrence_rule: nullable(formData, 'recurrence_rule'), location: nullable(formData, 'location'), notes: nullable(formData, 'notes'),
    drive_link: nullable(formData, 'drive_link'),
  }).eq('id', id)
  if (error) return { error: error.message }
  const nextWorkItemId = nullable(formData, 'work_item_id') || existing.work_item_id
  if (nextWorkItemId) await addHistory(nextWorkItemId, user.id, 'calendar_event_updated', existing.title, value(formData, 'title'))
  revalidateOperationalPaths()
  return { success: true }
}

export async function moveCalendarEventAction(id: string, nextDate: string) {
  const { supabase, user, profile } = await getCurrentProfile()
  if (!user || !profile) return { error: 'Sessão inválida ou usuário inativo.' }
  const { data: event } = await supabase.from('calendar_events').select('starts_at, ends_at, responsible_id, created_by, work_item_id, title').eq('id', id).single()
  if (!event || (!isManager(profile.role) && event.responsible_id !== user.id && event.created_by !== user.id)) return forbidden('Você não possui permissão para mover esta agenda.')
  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)
  const duration = end.getTime() - start.getTime()
  const [year, month, day] = nextDate.split('-').map(Number)
  start.setFullYear(year, month - 1, day)
  const nextEnd = new Date(start.getTime() + duration)
  const conflict = await findCalendarConflict(supabase, event.responsible_id, start.toISOString(), nextEnd.toISOString(), id)
  if (conflict) return { error: `Conflito de agenda com “${conflict.title}”. Reagende ou altere o responsável.` }
  const { error } = await supabase.from('calendar_events').update({ starts_at: start.toISOString(), ends_at: nextEnd.toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  if (event.work_item_id) await addHistory(event.work_item_id, user.id, 'calendar_event_moved', event.title, nextDate)
  revalidateOperationalPaths()
  return { success: true }
}

export async function deleteCalendarEventAction(id: string) {
  const { supabase, user, profile } = await getCurrentProfile()
  if (!user || !profile) return { error: 'Sessão inválida ou usuário inativo.' }
  const { data: event } = await supabase.from('calendar_events').select('responsible_id, created_by, work_item_id, title').eq('id', id).single()
  if (!event || (!isManager(profile.role) && event.responsible_id !== user.id && event.created_by !== user.id)) return forbidden('Você não possui permissão para excluir esta agenda.')
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) return { error: error.message }
  if (event.work_item_id) await addHistory(event.work_item_id, user.id, 'calendar_event_deleted', event.title, null)
  revalidateOperationalPaths()
  return { success: true }
}

export async function inviteMemberAction(formData: FormData) {
  const { profile } = await getCurrentProfile()
  if (!profile || !isAdmin(profile.role)) return forbidden('Somente Administração ou Direção podem criar acessos.')
  const email = value(formData, 'email')
  const fullName = value(formData, 'full_name')
  if (!email || !fullName) return { error: 'Nome e e-mail são obrigatórios.' }
  try {
    const admin = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${appUrl}/login`,
    })
    if (error) return { error: error.message }
    revalidateOperationalPaths()
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível enviar o convite.' }
  }
}

export async function updateMemberAccessAction(formData: FormData) {
  const { supabase, profile } = await getCurrentProfile()
  if (!profile || !isAdmin(profile.role)) return forbidden('Somente Administração ou Direção podem alterar acessos.')
  const id = value(formData, 'id')
  if (!id) return { error: 'Membro inválido.' }
  const { error } = await supabase.from('profiles').update({
    role: value(formData, 'role') || 'collaborator',
    team_area: nullable(formData, 'team_area'),
    job_title: nullable(formData, 'job_title'),
    is_active: value(formData, 'is_active') === 'true',
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidateOperationalPaths()
  return { success: true }
}
