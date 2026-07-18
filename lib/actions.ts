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
  '/dashboard/minha-semana', '/dashboard/semana-equipe', '/dashboard/avisos',
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
  if (error || !item) return { error: 'Demanda vinculada Ã  agenda não foi encontrada.' as const }
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
    { color: '#2563EB', bg: '#EAF2FF' }, { color: '#16A34A', bg: '#EAF7EF' },
    { color: '#CA8A04', bg: '#FFF7E6' }, { color: '#DC2626', bg: '#FEECEC' },
    { color: '#475467', bg: '#EEF2F7' },
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


export async function archiveClientAction(id: string, mode: 'archived' | 'inactive' = 'archived') {
  const { supabase, profile } = await getCurrentProfile()
  if (!profile || !isManager(profile.role)) return forbidden()
  if (!id) return { error: 'Cliente inválido.' }
  const nextStatus = mode === 'inactive' ? 'inactive' : 'archived'
  const payload: Record<string, unknown> = { status: nextStatus }
  if (mode === 'inactive') payload.ended_at = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('clients').update(payload).eq('id', id)
  if (error) return { error: error.message }
  if (mode === 'inactive') {
    await supabase.from('client_services').update({ status: 'inactive' }).eq('client_id', id)
  }
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
  if (conflict) return { error: `Conflito de agenda com â€œ${conflict.title}â€. Reagende ou altere o responsável.` }
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
  if (conflict) return { error: `Conflito de agenda com â€œ${conflict.title}â€. Reagende ou altere o responsável.` }
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
  if (conflict) return { error: `Conflito de agenda com â€œ${conflict.title}â€. Reagende ou altere o responsável.` }
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

// =========================================================
// HOTFIX 15B â€” Feed Preview documentos/grades
// =========================================================

function feedActionValue(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function feedActionNullable(formData: FormData, key: string) {
  const result = feedActionValue(formData, key)
  return result || null
}

function feedMonthStart(raw: string | null | undefined) {
  const clean = String(raw || '').trim()
  if (/^\d{4}-\d{2}$/.test(clean)) return `${clean}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return `${clean.slice(0, 7)}-01`
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function feedValidPreset(input: string | null | undefined) {
  const value = String(input || 'custom')
  return ['custom', 'standard', 'minimalist', 'creative', 'neutral', 'bold'].includes(value) ? value : 'custom'
}

function feedValidBoardStatus(input: string | null | undefined) {
  const value = String(input || 'draft')
  return ['draft', 'in_progress', 'sent', 'approved', 'changes_requested', 'archived'].includes(value) ? value : 'draft'
}

function revalidateFeedBoardPaths(boardId?: string | null) {
  revalidatePath('/dashboard/feed-preview')
  if (boardId) revalidatePath(`/dashboard/feed-preview/${boardId}`)
}

async function addFeedBoardEventInternal(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  itemId: string | null,
  eventType: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('feed_board_events')
      .insert({
        board_id: boardId,
        item_id: itemId,
        actor_type: 'internal',
        actor_id: auth.user?.id || null,
        actor_name: 'Ampy Digital',
        event_type: eventType,
        message,
        metadata,
      })
      .select('id')
      .single()

    return data
  } catch {
    return null
  }
}

export async function createFeedBoardAction(formData: FormData) {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { error: 'Sessao expirada. Faca login novamente.' }

  const clientId = feedActionValue(formData, 'client_id')
  if (!clientId) return { error: 'Selecione um cliente.' }

  const periodMonth = feedMonthStart(feedActionValue(formData, 'period_month'))
  const title = feedActionValue(formData, 'title') || `Feed Preview ${periodMonth.slice(5, 7)}/${periodMonth.slice(0, 4)}`

  const { data, error } = await supabase
    .from('feed_boards')
    .insert({
      client_id: clientId,
      title,
      period_month: periodMonth,
      status: 'draft',
      visual_preset: feedValidPreset(feedActionValue(formData, 'visual_preset')),
      created_by: auth.user.id,
      notes: feedActionNullable(formData, 'notes'),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidateFeedBoardPaths(data.id)
  return { success: true, id: data.id }
}

export async function updateFeedBoardAction(boardId: string, formData: FormData) {
  const supabase = createClient()

  const update = {
    title: feedActionValue(formData, 'title') || 'Feed Preview',
    status: feedValidBoardStatus(feedActionValue(formData, 'status')),
    visual_preset: feedValidPreset(feedActionValue(formData, 'visual_preset')),
    notes: feedActionNullable(formData, 'notes'),
  }

  const { error } = await supabase
    .from('feed_boards')
    .update(update)
    .eq('id', boardId)

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    null,
    'board_updated',
    'Ampy Digital atualizou o documento.',
    update
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true }
}

export async function createFeedBoardItemAction(formData: FormData) {
  const supabase = createClient()

  const boardId = feedActionValue(formData, 'board_id')
  if (!boardId) return { error: 'Documento nao encontrado.' }

  const positionRaw = Number(feedActionValue(formData, 'position') || '0')
  const position = Number.isFinite(positionRaw) && positionRaw >= 0 ? positionRaw : 0

  const payload = {
    board_id: boardId,
    position,
    title: feedActionNullable(formData, 'title'),
    cover_url: feedActionNullable(formData, 'cover_url'),
    storage_path: feedActionNullable(formData, 'storage_path'),
    content_url: feedActionNullable(formData, 'content_url'),
    caption: feedActionNullable(formData, 'caption'),
    internal_notes: feedActionNullable(formData, 'internal_notes'),
    approval_status: 'pending',
  }

  const { data, error } = await supabase
    .from('feed_board_items')
    .insert(payload)
    .select('*')
    .single()

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    data.id,
    'item_created',
    `Ampy Digital adicionou a capa ${position + 1}.`,
    { title: payload.title, storage_path: payload.storage_path }
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true, item: data }
}

export async function updateFeedBoardItemAction(itemId: string, formData: FormData) {
  const supabase = createClient()

  const { data: existing, error: existingError } = await supabase
    .from('feed_board_items')
    .select('id,board_id,title,content_url,caption,internal_notes')
    .eq('id', itemId)
    .single()

  if (existingError || !existing) return { error: existingError?.message || 'Item nao encontrado.' }

  const update = {
    title: feedActionNullable(formData, 'title'),
    content_url: feedActionNullable(formData, 'content_url'),
    caption: feedActionNullable(formData, 'caption'),
    internal_notes: feedActionNullable(formData, 'internal_notes'),
  }

  const { error } = await supabase
    .from('feed_board_items')
    .update(update)
    .eq('id', itemId)

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    existing.board_id,
    itemId,
    'item_updated',
    'Ampy Digital atualizou um item do documento.',
    update
  )

  revalidateFeedBoardPaths(existing.board_id)
  return { success: true }
}

export async function reorderFeedBoardItemsAction(boardId: string, itemIds: string[]) {
  const supabase = createClient()

  const safeIds = Array.isArray(itemIds) ? itemIds.filter(Boolean) : []
  if (!boardId || safeIds.length === 0) return { error: 'Ordem invalida.' }

  const updates = await Promise.all(
    safeIds.map((id, index) =>
      supabase
        .from('feed_board_items')
        .update({ position: index })
        .eq('id', id)
        .eq('board_id', boardId)
    )
  )

  const firstError = updates.find((result) => result.error)?.error
  if (firstError) return { error: firstError.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    null,
    'items_reordered',
    'Ampy Digital alterou a ordem da grade.',
    { itemIds: safeIds }
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true }
}

export async function deleteFeedBoardItemAction(itemId: string, boardId: string) {
  const supabase = createClient()

  if (!itemId || !boardId) return { error: 'Item invalido.' }

  const { error } = await supabase
    .from('feed_board_items')
    .delete()
    .eq('id', itemId)
    .eq('board_id', boardId)

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    null,
    'item_deleted',
    'Ampy Digital removeu uma capa do documento.'
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true }
}

// =========================================================
// HOTFIX 15B.1 â€” Aprovações: publicar, arquivar e excluir documento
// =========================================================

export async function publishFeedBoardAction(boardId: string) {
  const supabase = createClient()
  if (!boardId) return { error: 'Documento invalido.' }

  const { error } = await supabase
    .from('feed_boards')
    .update({
      status: 'in_progress',
      published_at: new Date().toISOString(),
    })
    .eq('id', boardId)

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    null,
    'board_published',
    'Ampy Digital subiu o feed para aprovação.'
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true }
}

export async function archiveFeedBoardAction(boardId: string) {
  const supabase = createClient()
  if (!boardId) return { error: 'Documento invalido.' }

  const { error } = await supabase
    .from('feed_boards')
    .update({ status: 'archived' })
    .eq('id', boardId)

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    null,
    'board_archived',
    'Ampy Digital arquivou o documento.'
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true }
}

export async function deleteFeedBoardAction(boardId: string) {
  const supabase = createClient()
  if (!boardId) return { error: 'Documento invalido.' }

  const { data: items } = await supabase
    .from('feed_board_items')
    .select('storage_path')
    .eq('board_id', boardId)

  const paths = (items || []).map((item: any) => item.storage_path).filter(Boolean)
  if (paths.length > 0) {
    await supabase.storage.from('feed-preview').remove(paths)
  }

  const { error } = await supabase
    .from('feed_boards')
    .delete()
    .eq('id', boardId)

  if (error) return { error: error.message }

  revalidateFeedBoardPaths(null)
  return { success: true }
}

// =========================================================
// HOTFIX 15B.1 â€” Aprovações: itens com retorno para UI suave
// =========================================================

export async function createFeedBoardItemSmoothAction(formData: FormData) {
  const supabase = createClient()

  const boardId = feedActionValue(formData, 'board_id')
  if (!boardId) return { error: 'Documento invalido.' }

  const positionRaw = feedActionValue(formData, 'position')
  const position = Number.isFinite(Number(positionRaw)) ? Number(positionRaw) : 0

  const payload = {
    board_id: boardId,
    title: feedActionValue(formData, 'title') || 'Capa',
    cover_url: feedActionNullable(formData, 'cover_url'),
    storage_path: feedActionNullable(formData, 'storage_path'),
    content_url: feedActionNullable(formData, 'content_url'),
    caption: feedActionNullable(formData, 'caption'),
    internal_notes: feedActionNullable(formData, 'internal_notes'),
    position,
    approval_status: 'pending',
  }

  const { data, error } = await supabase
    .from('feed_board_items')
    .insert(payload)
    .select('id,board_id,work_item_id,position,title,cover_url,storage_path,content_url,caption,internal_notes,approval_status,client_feedback,approved_at,created_at,updated_at')
    .single()

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    data.id,
    'item_created',
    `Ampy Digital adicionou a capa "${data.title || 'Capa'}".`
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true, item: data }
}

export async function updateFeedBoardItemSmoothAction(itemId: string, formData: FormData) {
  const supabase = createClient()
  if (!itemId) return { error: 'Item invalido.' }

  const payload = {
    title: feedActionValue(formData, 'title') || 'Capa',
    content_url: feedActionNullable(formData, 'content_url'),
    caption: feedActionNullable(formData, 'caption'),
    internal_notes: feedActionNullable(formData, 'internal_notes'),
  }

  const { data, error } = await supabase
    .from('feed_board_items')
    .update(payload)
    .eq('id', itemId)
    .select('id,board_id,work_item_id,position,title,cover_url,storage_path,content_url,caption,internal_notes,approval_status,client_feedback,approved_at,created_at,updated_at')
    .single()

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    data.board_id,
    data.id,
    'item_updated',
    `Ampy Digital atualizou a capa "${data.title || 'Capa'}".`
  )

  revalidateFeedBoardPaths(data.board_id)
  return { success: true, item: data }
}

// =========================================================
// HOTFIX 15C.2 â€” Aprovações: ação pública do cliente por token
// =========================================================

export async function submitFeedBoardClientDecisionAction(token: string, itemId: string, formData: FormData) {
  const supabase = createAdminClient()

  if (!token || !itemId) return { error: 'Link de aprovação inválido.' }

  const decision = feedActionValue(formData, 'decision')
  const feedback = feedActionNullable(formData, 'client_feedback')
  const actorName = feedActionValue(formData, 'actor_name') || 'Cliente'

  if (!['approved', 'changes_requested'].includes(decision)) {
    return { error: 'Ação inválida.' }
  }

  const { data: board, error: boardError } = await supabase
    .from('feed_boards')
    .select('id,title,status,share_token,client_id')
    .eq('share_token', token)
    .single()

  if (boardError || !board) return { error: 'Documento de aprovação não encontrado.' }
  if (board.status === 'archived') return { error: 'Este documento está arquivado.' }

  const itemPayload: any = {
    approval_status: decision,
      workflow_status: decision === 'approved' ? 'approved' : 'changes_requested',
    client_feedback: decision === 'changes_requested' ? (feedback || null) : null,
  }

  if (decision === 'approved') {
    itemPayload.approved_at = new Date().toISOString()
  } else {
    itemPayload.approved_at = null
  }

  const { data: updatedItem, error: itemError } = await supabase
    .from('feed_board_items')
    .update(itemPayload)
    .eq('id', itemId)
    .eq('board_id', board.id)
    .select('id,board_id,title,approval_status,client_feedback,approved_at')
    .single()

  if (itemError || !updatedItem) return { error: itemError?.message || 'Item não encontrado.' }

  const { data: allItems } = await supabase
    .from('feed_board_items')
    .select('id,approval_status')
    .eq('board_id', board.id)

  let nextBoardStatus = board.status

  if (decision === 'changes_requested') {
    nextBoardStatus = 'changes_requested'
  } else if ((allItems || []).length > 0 && (allItems || []).every((item: any) => item.approval_status === 'approved')) {
    nextBoardStatus = 'approved'
  } else if (board.status === 'draft') {
    nextBoardStatus = 'in_progress'
  }

  await supabase
    .from('feed_boards')
    .update({
      status: nextBoardStatus,
      last_client_action_at: new Date().toISOString(),
    })
    .eq('id', board.id)

  const eventRecord = await addFeedBoardEventInternal(
    supabase,
    board.id,
    updatedItem.id,
    decision === 'approved' ? 'client_item_approved' : 'client_item_changes_requested',
    decision === 'approved'
      ? `${actorName} aprovou o item "${updatedItem.title || 'Capa'}".`
      : `${actorName} solicitou ajuste no item "${updatedItem.title || 'Capa'}"${feedback ? `: ${feedback}` : ''}.`,
    { feedback }
  )

  if (decision === 'changes_requested') {
    const avisoMessage = `${actorName} solicitou ajuste no item "${updatedItem.title || 'Capa'}"${feedback ? `: ${feedback}` : ''}.`

    const { error: avisoError } = await supabase.from('avisos').insert({
      title: 'Ajuste solicitado em aprovação',
      message: avisoMessage,
      category: 'adjustment',
      priority: 'high',
      status: 'active',
      source_module: 'approval',
      source_table: 'feed_board_events',
      source_id: eventRecord?.id || null,
      source_url: `/dashboard/feed-preview/${board.id}`,
      action_label: 'Abrir aprovação',
      related_entity_type: 'feed_board_item',
      related_entity_id: updatedItem.id,
      dedupe_key: eventRecord?.id ? `approval-adjustment-event-${eventRecord.id}` : `approval-adjustment-${updatedItem.id}-${Date.now()}`,
      client_id: board.client_id || null,
      feed_board_id: board.id,
      feed_board_item_id: updatedItem.id,
      feed_board_event_id: eventRecord?.id || null,
      is_auto: true,
      metadata: {
        actor_name: actorName,
        feedback: feedback || null,
        item_title: updatedItem.title || null,
        board_title: board.title || null,
      },
    })

    if (avisoError) {
      console.error('[avisos] erro ao criar aviso de ajuste:', avisoError.message)
    }
  }

  revalidatePath(`/aprovacao/${token}`)
  revalidatePath('/dashboard/avisos')
  revalidateFeedBoardPaths(board.id)

  return {
    success: true,
    item: updatedItem,
    board_status: nextBoardStatus,
  }
}


// =========================================================
// HOTFIX 15D.1 — Aprovações: Drive manual, arquivo, data e hora
// =========================================================

export async function updateFeedBoardSettingsAction(boardId: string, formData: FormData) {
  const supabase = createClient()
  if (!boardId) return { error: 'Documento inválido.' }

  const payload = {
    title: feedActionValue(formData, 'title') || 'Aprovação',
    status: feedValidBoardStatus(feedActionValue(formData, 'status')),
    visual_preset: feedValidPreset(feedActionValue(formData, 'visual_preset')),
    notes: feedActionNullable(formData, 'notes'),
    drive_folder_url: feedActionNullable(formData, 'drive_folder_url'),
  }

  const { error } = await supabase
    .from('feed_boards')
    .update(payload)
    .eq('id', boardId)

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    boardId,
    null,
    'board_settings_updated',
    'Ampy Digital atualizou as configurações da aprovação.'
  )

  revalidateFeedBoardPaths(boardId)
  return { success: true }
}

export async function updateFeedBoardItemPlanningAction(itemId: string, formData: FormData) {
  const supabase = createClient()
  if (!itemId) return { error: 'Item inválido.' }

  const payload = {
    title: feedActionValue(formData, 'title') || 'Capa',
    content_type: ['post', 'video', 'carousel'].includes(feedActionValue(formData, 'content_type')) ? feedActionValue(formData, 'content_type') : 'post',
    source_file_name: feedActionNullable(formData, 'source_file_name'),
    content_url: feedActionNullable(formData, 'content_url'),
    caption: feedActionNullable(formData, 'caption'),
    scheduled_date: feedActionNullable(formData, 'scheduled_date'),
    scheduled_time: feedActionNullable(formData, 'scheduled_time'),
    internal_notes: feedActionNullable(formData, 'internal_notes'),
  }

  const { data, error } = await supabase
    .from('feed_board_items')
    .update(payload)
    .eq('id', itemId)
    .select('id,board_id,work_item_id,position,title,cover_url,storage_path,content_type,source_file_name,content_url,caption,scheduled_date,scheduled_time,internal_notes,approval_status,client_feedback,approved_at,created_at,updated_at')
    .single()

  if (error) return { error: error.message }

  await addFeedBoardEventInternal(
    supabase,
    data.board_id,
    data.id,
    'item_planning_updated',
    `Ampy Digital atualizou arquivo, link, legenda ou programação do item "${data.title || 'Capa'}".`
  )

  revalidateFeedBoardPaths(data.board_id)
  return { success: true, item: data }
}

// =========================================================
// AMPY-V17-A12B — FLUXO CONTEXTUAL DE QUADROS E PROJETOS
// =========================================================

async function v17A12bHasTotalAccess() {
  const { user } = await getCurrentProfile()

  if (!user) return false

  const admin = createAdminClient()

  const byProfile = await admin
    .from('team_members')
    .select('access_type,is_active')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (
    byProfile.data?.is_active !== false &&
    byProfile.data?.access_type === 'total'
  ) {
    return true
  }

  if (!user.email) return false

  const byEmail = await admin
    .from('team_members')
    .select('access_type,is_active')
    .ilike('email', user.email)
    .maybeSingle()

  return (
    byEmail.data?.is_active !== false &&
    byEmail.data?.access_type === 'total'
  )
}

async function v17A12bValidateBoard(
  supabase: ReturnType<typeof createClient>,
  boardId: string | null,
) {
  if (!boardId) {
    return { error: 'Selecione o Quadro da demanda.' as const }
  }

  const { data, error } = await supabase
    .from('boards')
    .select('id,name,status')
    .eq('id', boardId)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    return { error: 'Quadro inválido ou inativo.' as const }
  }

  return { board: data }
}

export async function createBoardAction(formData: FormData) {
  if (!(await v17A12bHasTotalAccess())) {
    return forbidden(
      'Somente usuários com Acesso Total podem criar Quadros.',
    )
  }

  const { supabase, user } = await getCurrentProfile()

  if (!user) {
    return { error: 'Sessão inválida.' }
  }

  const name = value(formData, 'name')

  if (name.length < 2) {
    return { error: 'Informe um nome válido para o Quadro.' }
  }

  const { data, error } = await supabase
    .from('boards')
    .insert({
      name,
      description: nullable(formData, 'description'),
      color: value(formData, 'color') || '#2563EB',
      status: value(formData, 'status') || 'active',
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidateOperationalPaths()

  return {
    success: true,
    id: data.id,
  }
}

export async function updateBoardAction(
  id: string,
  formData: FormData,
) {
  if (!(await v17A12bHasTotalAccess())) {
    return forbidden(
      'Somente usuários com Acesso Total podem editar Quadros.',
    )
  }

  if (!id) {
    return { error: 'Quadro inválido.' }
  }

  const { supabase } = await getCurrentProfile()
  const name = value(formData, 'name')

  if (name.length < 2) {
    return { error: 'Informe um nome válido para o Quadro.' }
  }

  const status = value(formData, 'status') || 'active'

  if (!['active', 'archived'].includes(status)) {
    return { error: 'Status de Quadro inválido.' }
  }

  const { error } = await supabase
    .from('boards')
    .update({
      name,
      description: nullable(formData, 'description'),
      color: value(formData, 'color') || '#2563EB',
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidateOperationalPaths()

  return { success: true }
}

export async function deleteBoardAction(id: string) {
  if (!(await v17A12bHasTotalAccess())) {
    return forbidden(
      'Somente usuários com Acesso Total podem excluir Quadros.',
    )
  }

  if (!id) {
    return { error: 'Quadro inválido.' }
  }

  const { supabase } = await getCurrentProfile()

  const { data, error } = await supabase.rpc(
    'delete_board_preserve_demands',
    {
      p_board_id: id,
    },
  )

  if (error) {
    return { error: error.message }
  }

  revalidateOperationalPaths()

  return {
    success: true,
    result: data,
  }
}

async function v17A12bCreateContextItem(
  formData: FormData,
  context: 'board' | 'project',
) {
  const { supabase, user, profile } = await getCurrentProfile()

  if (!user || !profile) {
    return { error: 'Sessão inválida ou usuário inativo.' }
  }

  const title = value(formData, 'title')

  if (!title) {
    return {
      error:
        context === 'project'
          ? 'Informe o título do projeto.'
          : 'Informe o título da demanda.',
    }
  }

  const clientId = nullable(formData, 'client_id')
  const clientServiceId = nullable(
    formData,
    'client_service_id',
  )

  const linkValidation = await validateWorkItemLinks(
    supabase,
    clientId,
    clientServiceId,
  )

  if ('error' in linkValidation) {
    return linkValidation
  }

  let boardId: string | null = null

  if (context === 'board') {
    boardId = nullable(formData, 'board_id')

    const boardValidation = await v17A12bValidateBoard(
      supabase,
      boardId,
    )

    if ('error' in boardValidation) {
      return boardValidation
    }
  }

  const requestedResponsible = nullable(
    formData,
    'responsible_id',
  )

  const responsibleId = isManager(profile.role)
    ? requestedResponsible
    : user.id

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      title,
      description: nullable(formData, 'description'),
      client_id: clientId,
      client_service_id: clientServiceId,
      type:
        nullable(formData, 'type') ||
        (clientId ? 'Planejamento' : 'Interno'),
      origin:
        value(formData, 'origin') ||
        (clientId ? 'planned' : 'internal'),
      destino: context === 'board' ? 'quadro' : 'projeto',
      board_id: boardId,
      status: 'not_started',
      priority: value(formData, 'priority') || 'normal',
      responsible_id: responsibleId,
      created_by: user.id,
      internal_deadline: nullable(
        formData,
        'internal_deadline',
      ),
      final_deadline: nullable(formData, 'final_deadline'),
      drive_link: nullable(formData, 'drive_link'),
      notes: nullable(formData, 'notes'),
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  await addHistory(
    data.id,
    user.id,
    'created',
    null,
    context === 'board' ? 'quadro' : 'projeto',
  )

  revalidateOperationalPaths()

  return {
    success: true,
    id: data.id,
  }
}

export async function createBoardDemandAction(
  formData: FormData,
) {
  return v17A12bCreateContextItem(formData, 'board')
}

export async function createProjectAction(formData: FormData) {
  return v17A12bCreateContextItem(formData, 'project')
}

export async function updateContextWorkItemAction(
  id: string,
  formData: FormData,
) {
  const permission = await canOperateWorkItem(id)

  if ('error' in permission) {
    return permission
  }

  const { supabase, user, profile } = permission

  const { data: existing, error: existingError } =
    await supabase
      .from('work_items')
      .select(
        'id,title,status,destino,board_id,responsible_id',
      )
      .eq('id', id)
      .single()

  if (existingError || !existing) {
    return { error: 'Demanda não encontrada.' }
  }

  const title = value(formData, 'title')

  if (!title) {
    return { error: 'Informe o título.' }
  }

  const context = value(formData, 'context')

  if (!['board', 'project'].includes(context)) {
    return { error: 'Contexto operacional inválido.' }
  }

  const clientId = nullable(formData, 'client_id')
  const clientServiceId = nullable(
    formData,
    'client_service_id',
  )

  const linkValidation = await validateWorkItemLinks(
    supabase,
    clientId,
    clientServiceId,
  )

  if ('error' in linkValidation) {
    return linkValidation
  }

  let boardId: string | null = null

  if (context === 'board') {
    boardId = nullable(formData, 'board_id')

    const boardValidation = await v17A12bValidateBoard(
      supabase,
      boardId,
    )

    if ('error' in boardValidation) {
      return boardValidation
    }
  }

  const status =
    value(formData, 'status') || existing.status

  if (
    !VALID_WORK_ITEM_STATUSES.includes(
      status as WorkItemStatus,
    )
  ) {
    return { error: 'Status inválido.' }
  }

  const update: Record<string, unknown> = {
    title,
    description: nullable(formData, 'description'),
    client_id: clientId,
    client_service_id: clientServiceId,
    type:
      nullable(formData, 'type') ||
      (clientId ? 'Planejamento' : 'Interno'),
    origin:
      value(formData, 'origin') ||
      (clientId ? 'planned' : 'internal'),
    destino: context === 'board' ? 'quadro' : 'projeto',
    board_id: context === 'board' ? boardId : null,
    status,
    priority: value(formData, 'priority') || 'normal',
    internal_deadline: nullable(
      formData,
      'internal_deadline',
    ),
    final_deadline: nullable(formData, 'final_deadline'),
    drive_link: nullable(formData, 'drive_link'),
    notes: nullable(formData, 'notes'),
    blocked_reason: nullable(formData, 'blocked_reason'),
  }

  if (isManager(profile.role)) {
    update.responsible_id = nullable(
      formData,
      'responsible_id',
    )
  }

  if (
    ['done', 'delivered', 'cancelled', 'archived'].includes(
      status,
    )
  ) {
    update.closed_at = new Date().toISOString()
  } else {
    update.closed_at = null
  }

  const { error } = await supabase
    .from('work_items')
    .update(update)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  await addHistory(
    id,
    user.id,
    'updated_context',
    existing.title,
    title,
  )

  if (existing.status !== status) {
    await addHistory(
      id,
      user.id,
      'status',
      existing.status,
      status,
    )
  }

  if (
    existing.destino !== update.destino ||
    existing.board_id !== update.board_id
  ) {
    await addHistory(
      id,
      user.id,
      'context',
      `${existing.destino}:${existing.board_id || ''}`,
      `${String(update.destino)}:${String(
        update.board_id || '',
      )}`,
    )
  }

  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${id}`)

  return { success: true }
}

export async function updateProjectStepAction(
  stepId: string,
  workItemId: string,
  formData: FormData,
) {
  const permission = await canOperateWorkItem(workItemId)

  if ('error' in permission) {
    return permission
  }

  const { supabase, user } = permission
  const title = value(formData, 'title')

  if (!title) {
    return { error: 'Informe o título da etapa.' }
  }

  const status = value(formData, 'status') || 'not_started'
  const validStepStatuses = [
    'not_started',
    'in_progress',
    'waiting',
    'blocked',
    'done',
  ]

  if (!validStepStatuses.includes(status)) {
    return { error: 'Status de etapa inválido.' }
  }

  const { data: existing } = await supabase
    .from('project_steps')
    .select('title,status')
    .eq('id', stepId)
    .eq('work_item_id', workItemId)
    .single()

  const { error } = await supabase
    .from('project_steps')
    .update({
      title,
      responsible_id: nullable(
        formData,
        'responsible_id',
      ),
      start_date: nullable(formData, 'start_date'),
      end_date: nullable(formData, 'end_date'),
      status,
      notes: nullable(formData, 'notes'),
    })
    .eq('id', stepId)
    .eq('work_item_id', workItemId)

  if (error) {
    return { error: error.message }
  }

  await addHistory(
    workItemId,
    user.id,
    'project_step_updated',
    existing?.title || stepId,
    title,
  )

  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${workItemId}`)

  return { success: true }
}

// =========================================================
// AMPY-V17-A14 — QUADRO COM COLUNAS EDITÁVEIS
// =========================================================

const V17_A14_COLUMN_STATUSES = [
  'not_started',
  'in_progress',
  'waiting',
  'blocked',
  'in_review',
  'awaiting_approval',
  'approved',
  'scheduled',
  'delivered',
  'done',
  'cancelled',
  'archived',
]

async function v17A14GetColumn(
  supabase: ReturnType<typeof createClient>,
  columnId: string | null,
) {
  if (!columnId) {
    return { error: 'Selecione a coluna da demanda.' as const }
  }

  const { data: column, error } = await supabase
    .from('board_columns')
    .select(
      'id,board_id,name,color,operational_status,position',
    )
    .eq('id', columnId)
    .single()

  if (error || !column) {
    return { error: 'Coluna inválida ou removida.' as const }
  }

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id,name,status')
    .eq('id', column.board_id)
    .eq('status', 'active')
    .single()

  if (boardError || !board) {
    return { error: 'Quadro inválido ou arquivado.' as const }
  }

  return { column, board }
}

export async function createBoardColumnAction(
  formData: FormData,
) {
  if (!(await v17A12bHasTotalAccess())) {
    return forbidden(
      'Somente usuários com Acesso Total podem criar colunas.',
    )
  }

  const { supabase } = await getCurrentProfile()
  const boardId = value(formData, 'board_id')
  const name = value(formData, 'name')
  const operationalStatus =
    value(formData, 'operational_status') || 'not_started'

  if (!boardId) return { error: 'Quadro inválido.' }
  if (!name) return { error: 'Informe o nome da coluna.' }

  if (!V17_A14_COLUMN_STATUSES.includes(operationalStatus)) {
    return { error: 'Status operacional inválido.' }
  }

  const { data: lastColumn } = await supabase
    .from('board_columns')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('board_columns')
    .insert({
      board_id: boardId,
      name,
      color: value(formData, 'color') || '#64748B',
      operational_status: operationalStatus,
      position: Number(lastColumn?.position ?? -1) + 1,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidateOperationalPaths()

  return { success: true, id: data.id }
}

export async function updateBoardColumnAction(
  columnId: string,
  formData: FormData,
) {
  if (!(await v17A12bHasTotalAccess())) {
    return forbidden(
      'Somente usuários com Acesso Total podem editar colunas.',
    )
  }

  const { supabase } = await getCurrentProfile()
  const name = value(formData, 'name')
  const operationalStatus =
    value(formData, 'operational_status')

  if (!name) return { error: 'Informe o nome da coluna.' }

  if (!V17_A14_COLUMN_STATUSES.includes(operationalStatus)) {
    return { error: 'Status operacional inválido.' }
  }

  const { error } = await supabase
    .from('board_columns')
    .update({
      name,
      color: value(formData, 'color') || '#64748B',
      operational_status: operationalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', columnId)

  if (error) return { error: error.message }

  const { error: cardsError } = await supabase
    .from('work_items')
    .update({ status: operationalStatus })
    .eq('board_column_id', columnId)
    .not('status', 'in', '(archived,cancelled)')

  if (cardsError) return { error: cardsError.message }

  revalidateOperationalPaths()

  return { success: true }
}

export async function reorderBoardColumnsAction(
  boardId: string,
  columnIds: string[],
) {
  if (!(await v17A12bHasTotalAccess())) {
    return forbidden(
      'Somente usuários com Acesso Total podem ordenar colunas.',
    )
  }

  const safeIds = Array.isArray(columnIds)
    ? columnIds.filter(Boolean)
    : []

  if (!boardId || safeIds.length === 0) {
    return { error: 'Ordem de colunas inválida.' }
  }

  const { supabase } = await getCurrentProfile()

  const { data: existing, error: readError } = await supabase
    .from('board_columns')
    .select('id')
    .eq('board_id', boardId)

  if (readError) return { error: readError.message }

  const existingIds = (existing || []).map((item) => item.id)

  if (
    existingIds.length !== safeIds.length ||
    existingIds.some((id) => !safeIds.includes(id))
  ) {
    return {
      error:
        'A ordem enviada não corresponde às colunas do Quadro.',
    }
  }

  const updates = await Promise.all(
    safeIds.map((id, position) =>
      supabase
        .from('board_columns')
        .update({
          position,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('board_id', boardId),
    ),
  )

  const firstError = updates.find((item) => item.error)?.error

  if (firstError) return { error: firstError.message }

  revalidateOperationalPaths()

  return { success: true }
}

export async function deleteBoardColumnAction(
  columnId: string,
  targetColumnId?: string | null,
) {
  if (!(await v17A12bHasTotalAccess())) {
    return forbidden(
      'Somente usuários com Acesso Total podem excluir colunas.',
    )
  }

  const { supabase } = await getCurrentProfile()

  const { data, error } = await supabase.rpc(
    'delete_board_column_move_cards',
    {
      p_column_id: columnId,
      p_target_column_id: targetColumnId || null,
    },
  )

  if (error) return { error: error.message }

  revalidateOperationalPaths()

  return { success: true, result: data }
}

export async function createBoardColumnDemandAction(
  formData: FormData,
) {
  const { supabase, user, profile } = await getCurrentProfile()

  if (!user || !profile) {
    return { error: 'Sessão inválida ou usuário inativo.' }
  }

  const title = value(formData, 'title')

  if (!title) return { error: 'Informe o título da demanda.' }

  const columnValidation = await v17A14GetColumn(
    supabase,
    nullable(formData, 'board_column_id'),
  )

  if ('error' in columnValidation) {
    return columnValidation
  }

  const clientId = nullable(formData, 'client_id')
  const clientServiceId = nullable(
    formData,
    'client_service_id',
  )

  const linkValidation = await validateWorkItemLinks(
    supabase,
    clientId,
    clientServiceId,
  )

  if ('error' in linkValidation) {
    return linkValidation
  }

  const requestedResponsible = nullable(
    formData,
    'responsible_id',
  )

  const responsibleId = isManager(profile.role)
    ? requestedResponsible
    : user.id

  const { column } = columnValidation

  const { data, error } = await supabase
    .from('work_items')
    .insert({
      title,
      description: nullable(formData, 'description'),
      client_id: clientId,
      client_service_id: clientServiceId,
      type:
        nullable(formData, 'type') ||
        (clientId ? 'Planejamento' : 'Interno'),
      origin:
        value(formData, 'origin') ||
        (clientId ? 'planned' : 'internal'),
      destino: 'quadro',
      board_id: column.board_id,
      board_column_id: column.id,
      status: column.operational_status,
      priority: value(formData, 'priority') || 'normal',
      responsible_id: responsibleId,
      created_by: user.id,
      internal_deadline: nullable(
        formData,
        'internal_deadline',
      ),
      final_deadline: nullable(
        formData,
        'final_deadline',
      ),
      drive_link: nullable(formData, 'drive_link'),
      notes: nullable(formData, 'notes'),
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await addHistory(
    data.id,
    user.id,
    'created',
    null,
    `quadro:${column.id}`,
  )

  revalidateOperationalPaths()

  return { success: true, id: data.id }
}

export async function updateBoardColumnDemandAction(
  id: string,
  formData: FormData,
) {
  const permission = await canOperateWorkItem(id)

  if ('error' in permission) return permission

  const { supabase, user, profile } = permission

  const { data: existing, error: existingError } =
    await supabase
      .from('work_items')
      .select(
        'id,title,status,board_id,board_column_id,responsible_id',
      )
      .eq('id', id)
      .single()

  if (existingError || !existing) {
    return { error: 'Demanda não encontrada.' }
  }

  const title = value(formData, 'title')

  if (!title) return { error: 'Informe o título.' }

  const columnValidation = await v17A14GetColumn(
    supabase,
    nullable(formData, 'board_column_id'),
  )

  if ('error' in columnValidation) {
    return columnValidation
  }

  const clientId = nullable(formData, 'client_id')
  const clientServiceId = nullable(
    formData,
    'client_service_id',
  )

  const linkValidation = await validateWorkItemLinks(
    supabase,
    clientId,
    clientServiceId,
  )

  if ('error' in linkValidation) {
    return linkValidation
  }

  const { column } = columnValidation

  const update: Record<string, unknown> = {
    title,
    description: nullable(formData, 'description'),
    client_id: clientId,
    client_service_id: clientServiceId,
    type:
      nullable(formData, 'type') ||
      (clientId ? 'Planejamento' : 'Interno'),
    origin:
      value(formData, 'origin') ||
      (clientId ? 'planned' : 'internal'),
    destino: 'quadro',
    board_id: column.board_id,
    board_column_id: column.id,
    status: column.operational_status,
    priority: value(formData, 'priority') || 'normal',
    internal_deadline: nullable(
      formData,
      'internal_deadline',
    ),
    final_deadline: nullable(formData, 'final_deadline'),
    drive_link: nullable(formData, 'drive_link'),
    notes: nullable(formData, 'notes'),
    blocked_reason: nullable(
      formData,
      'blocked_reason',
    ),
    closed_at: ['done', 'delivered', 'approved'].includes(
      column.operational_status,
    )
      ? new Date().toISOString()
      : null,
  }

  if (isManager(profile.role)) {
    update.responsible_id = nullable(
      formData,
      'responsible_id',
    )
  }

  const { error } = await supabase
    .from('work_items')
    .update(update)
    .eq('id', id)

  if (error) return { error: error.message }

  await addHistory(
    id,
    user.id,
    'board_column',
    existing.board_column_id || null,
    column.id,
  )

  if (existing.status !== column.operational_status) {
    await addHistory(
      id,
      user.id,
      'status',
      existing.status,
      column.operational_status,
    )
  }

  revalidateOperationalPaths()
  revalidatePath(`/dashboard/demandas/${id}`)

  return { success: true }
}

export async function moveBoardCardAction(
  id: string,
  columnId: string,
) {
  const permission = await canOperateWorkItem(id)

  if ('error' in permission) return permission

  const { supabase, user, item } = permission

  const columnValidation = await v17A14GetColumn(
    supabase,
    columnId,
  )

  if ('error' in columnValidation) {
    return columnValidation
  }

  const { column } = columnValidation

  const { error } = await supabase
    .from('work_items')
    .update({
      destino: 'quadro',
      board_id: column.board_id,
      board_column_id: column.id,
      status: column.operational_status,
      closed_at: ['done', 'delivered', 'approved'].includes(
        column.operational_status,
      )
        ? new Date().toISOString()
        : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  await addHistory(
    id,
    user.id,
    'board_column',
    null,
    column.id,
  )

  if (item.status !== column.operational_status) {
    await addHistory(
      id,
      user.id,
      'status',
      item.status,
      column.operational_status,
    )
  }

  revalidateOperationalPaths()

  return { success: true }
}
