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


const VALID_CLIENT_OPERATION_MODELS = [
  'monthly',
  'parallel',
  'not_applicable',
] as const

function normalizeClientOperationModel(
  input: string,
) {
  return VALID_CLIENT_OPERATION_MODELS.includes(
    input as (
      typeof VALID_CLIENT_OPERATION_MODELS
    )[number],
  )
    ? input
    : 'monthly'
}

function normalizeClientSituation(
  input: string,
) {
  return input ===
    'inactive'
      ? 'inactive'
      : 'active'
}

export async function createClientAction(
  formData: FormData,
) {
  const {
    supabase,
    profile,
  } =
    await getCurrentProfile()

  if (
    !profile ||
    !isManager(
      profile.role,
    )
  ) {
    return forbidden()
  }

  const name =
    value(
      formData,
      'name',
    )

  if (!name) {
    return {
      error:
        'Informe o nome do cliente.',
    }
  }

  const status =
    normalizeClientSituation(
      value(
        formData,
        'status',
      ),
    )

  const operationModel =
    normalizeClientOperationModel(
      value(
        formData,
        'operation_model',
      ),
    )

  const strategicMapUrl =
    nullable(
      formData,
      'strategic_map_url',
    )

  const {
    error,
  } = await supabase
    .from('clients')
    .insert({
      name,

      segment:
        nullable(
          formData,
          'segment',
        ) || '',

      cidade:
        nullable(
          formData,
          'cidade',
        ),

      status,

      operation_model:
        operationModel,

      responsible_id:
        nullable(
          formData,
          'responsible_id',
        ),

      main_contact_name:
        nullable(
          formData,
          'main_contact_name',
        ),

      main_contact_email:
        nullable(
          formData,
          'main_contact_email',
        ),

      main_contact_phone:
        nullable(
          formData,
          'main_contact_phone',
        ),

      drive_folder_url:
        nullable(
          formData,
          'drive_folder_url',
        ),

      strategic_map_url:
        strategicMapUrl,

      briefing_url:
        strategicMapUrl,

      logo_url:
        nullable(
          formData,
          'logo_url',
        ),

      logo_storage_path:
        nullable(
          formData,
          'logo_storage_path',
        ),

      instagram:
        nullable(
          formData,
          'instagram',
        ),

      notes:
        nullable(
          formData,
          'notes',
        ),

      inicio_contrato:
        nullable(
          formData,
          'inicio_contrato',
        ),

      fim_contrato:
        nullable(
          formData,
          'fim_contrato',
        ),

      started_at:
        nullable(
          formData,
          'inicio_contrato',
        ),

      ended_at:
        nullable(
          formData,
          'fim_contrato',
        ),

      avatar_initials:
        buildInitials(name),

      avatar_color:
        '#475569',

      avatar_bg:
        '#F1F5F9',
    })

  if (error) {
    return {
      error:
        error.message,
    }
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function updateClientAction(
  formData: FormData,
) {
  const {
    supabase,
    profile,
  } =
    await getCurrentProfile()

  if (
    !profile ||
    !isManager(
      profile.role,
    )
  ) {
    return forbidden()
  }

  const id =
    value(
      formData,
      'id',
    )

  const name =
    value(
      formData,
      'name',
    )

  if (
    !id ||
    !name
  ) {
    return {
      error:
        'Cliente inválido.',
    }
  }

  const status =
    normalizeClientSituation(
      value(
        formData,
        'status',
      ),
    )

  const operationModel =
    normalizeClientOperationModel(
      value(
        formData,
        'operation_model',
      ),
    )

  const strategicMapUrl =
    nullable(
      formData,
      'strategic_map_url',
    )

  const {
    error,
  } = await supabase
    .from('clients')
    .update({
      name,

      segment:
        nullable(
          formData,
          'segment',
        ) || '',

      cidade:
        nullable(
          formData,
          'cidade',
        ),

      status,

      operation_model:
        operationModel,

      responsible_id:
        nullable(
          formData,
          'responsible_id',
        ),

      main_contact_name:
        nullable(
          formData,
          'main_contact_name',
        ),

      main_contact_email:
        nullable(
          formData,
          'main_contact_email',
        ),

      main_contact_phone:
        nullable(
          formData,
          'main_contact_phone',
        ),

      drive_folder_url:
        nullable(
          formData,
          'drive_folder_url',
        ),

      strategic_map_url:
        strategicMapUrl,

      briefing_url:
        strategicMapUrl,

      logo_url:
        nullable(
          formData,
          'logo_url',
        ),

      logo_storage_path:
        nullable(
          formData,
          'logo_storage_path',
        ),

      instagram:
        nullable(
          formData,
          'instagram',
        ),

      notes:
        nullable(
          formData,
          'notes',
        ),

      inicio_contrato:
        nullable(
          formData,
          'inicio_contrato',
        ),

      fim_contrato:
        nullable(
          formData,
          'fim_contrato',
        ),

      started_at:
        nullable(
          formData,
          'inicio_contrato',
        ),

      ended_at:
        nullable(
          formData,
          'fim_contrato',
        ),

      avatar_initials:
        buildInitials(name),

      avatar_color:
        '#475569',

      avatar_bg:
        '#F1F5F9',
    })
    .eq('id', id)

  if (error) {
    return {
      error:
        error.message,
    }
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
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


/* =========================================================
   AMPY-V17-A19.1 — AGENDA RECORRENTE
   ========================================================= */


const AMPY_CALENDAR_TYPES = {
  reu_a: {
    code: 'REU A',

    label:
      'Reunião de alinhamento',

    color: '#22C55E',
  },

  reu_c: {
    code: 'REU C',

    label:
      'Reunião comercial',

    color: '#15803D',
  },

  cap_e: {
    code: 'CAP E',

    label:
      'Captação externa',

    color: '#1E3A8A',
  },

  cap_s: {
    code: 'CAP S',

    label:
      'Captação em estúdio',

    color: '#60A5FA',
  },

  out_a: {
    code: 'OUT A',

    label:
      'Outro alinhamento',

    color: '#64748B',
  },
} as const

const AMPY_UNCONFIRMED_COLOR =
  '#DC2626'

type AmpyCalendarType =
  keyof typeof AMPY_CALENDAR_TYPES

// AMPY-V17-A19.3 — TIPOS, RECORRÊNCIA E TOPO DA AGENDA
// AMPY-V17-A19.4 — RECORRÊNCIA AUTOMÁTICA
// AMPY-V17-A19.5 — CONFIRMAÇÃO, CORES E CONTATO PERSONALIZADO
const AMPY_RECURRENCE_CONFIG = {
  every_week: {
    days: 7,
    rule:
      'FREQ=WEEKLY;INTERVAL=1',
  },

  every_2_weeks: {
    days: 14,
    rule:
      'FREQ=WEEKLY;INTERVAL=2',
  },

  every_4_weeks: {
    days: 28,
    rule:
      'FREQ=WEEKLY;INTERVAL=4',
  },
} as const

type AmpyRecurrenceMode =
  | keyof typeof AMPY_RECURRENCE_CONFIG
  | 'none'

function validRecurrenceMode(
  input: string,
): AmpyRecurrenceMode {
  return Object.prototype
    .hasOwnProperty.call(
      AMPY_RECURRENCE_CONFIG,
      input,
    )
      ? input as keyof typeof AMPY_RECURRENCE_CONFIG
      : 'none'
}

function validCalendarType(
  input: string,
): AmpyCalendarType {
  return Object.prototype
    .hasOwnProperty.call(
      AMPY_CALENDAR_TYPES,
      input,
    )
      ? input as AmpyCalendarType
      : 'out_a'
}

function isoFromForm(
  formData: FormData,
  dateKey: string,
  timeKey: string,
  allDay: boolean,
  endOfDay = false,
) {
  const date =
    value(
      formData,
      dateKey,
    )

  const time =
    value(
      formData,
      timeKey,
    ) || '09:00'

  if (!date) {
    return null
  }

  return ampyLocalDateTimeToIso(
    date,
    time,
    allDay,
    endOfDay,
  )
}

function addDaysToDateKey(
  input: string,
  days: number,
) {
  const [
    year,
    month,
    day,
  ] = input
    .split('-')
    .map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    )

  date.setUTCDate(
    date.getUTCDate() +
      days,
  )

  return date
    .toISOString()
    .slice(0, 10)
}

function calendarDateKey(
  value: string,
) {
  return new Date(value)
    .toISOString()
    .slice(0, 10)
}

async function calendarClient(
  supabase:
    ReturnType<
      typeof createClient
    >,

  clientId: string | null,
) {
  if (!clientId) {
    return null
  }

  const {
    data,
    error,
  } = await supabase
    .from('clients')
    .select(
      'id,name,status,fim_contrato,ended_at',
    )
    .eq('id', clientId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}


function calendarAutomaticTitle(
  type: AmpyCalendarType,
  clientName?: string | null,
  customName?: string | null,
) {
  const target =
    String(
      clientName ||
      customName ||
      'AMPY',
    ).trim() ||
    'AMPY'

  return (
    AMPY_CALENDAR_TYPES[
      type
    ].code +
    ' - ' +
    target.toUpperCase()
  )
}

function calendarEventColor(
  type: AmpyCalendarType,
  confirmed: boolean,
) {
  return confirmed
    ? AMPY_CALENDAR_TYPES[
        type
      ].color
    : AMPY_UNCONFIRMED_COLOR
}

async function findCalendarConflict(
  _supabase:
    ReturnType<
      typeof createClient
    >,

  _responsibleId:
    | string
    | null,

  _startsAt: string,
  _endsAt: string,

  _ignoreIds:
    string[] = [],
): Promise<{
  id: string
  title: string
  starts_at: string
  ends_at: string
} | null> {
  // AMPY-V17-A24-AGENDA-DINAMICA: simultaneous agendas are allowed.
  return null
}


function recurrenceOccurrences(
  formData: FormData,
  allDay: boolean,
  recurrenceUntil: string,
  intervalDays: number,
) {
  const firstStartDate =
    value(
      formData,
      'start_date',
    )

  const firstEndDate =
    value(
      formData,
      'end_date',
    )

  const startTime =
    value(
      formData,
      'start_time',
    ) || '09:00'

  const endTime =
    value(
      formData,
      'end_time',
    ) || '10:00'

  const output: Array<{
    startsAt: string
    endsAt: string
    sequence: number
  }> = []

  for (
    let sequence = 0;
    sequence < 80;
    sequence += 1
  ) {
    const offset =
      sequence * intervalDays

    const startDate =
      addDaysToDateKey(
        firstStartDate,
        offset,
      )

    if (
      startDate >
      recurrenceUntil
    ) {
      break
    }

    const endDate =
      addDaysToDateKey(
        firstEndDate,
        offset,
      )

    const startsAt =
      ampyLocalDateTimeToIso(
        startDate,
        startTime,
        allDay,
        false,
      )

    const endsAt =
      ampyLocalDateTimeToIso(
        endDate,
        endTime,
        allDay,
        true,
      )

    output.push({
      startsAt,
      endsAt,
      sequence,
    })
  }

  return output
}

export async function createCalendarEventAction(
  formData: FormData,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const allDay =
    value(
      formData,
      'all_day',
    ) === 'on'

  const startsAt =
    isoFromForm(
      formData,
      'start_date',
      'start_time',
      allDay,
    )

  const endsAt =
    isoFromForm(
      formData,
      'end_date',
      'end_time',
      allDay,
      true,
    )

  if (
    !startsAt ||
    !endsAt ||
    new Date(endsAt) <=
      new Date(startsAt)
  ) {
    return {
      error:
        'Informe início e término válidos.',
    }
  }

  const requestedResponsible =
    nullable(
      formData,
      'responsible_id',
    )

  const responsibleId =
    isManager(profile.role)
      ? requestedResponsible
      : user.id

  const linked =
    await validateCalendarLinks(
      supabase,
      nullable(
        formData,
        'client_id',
      ),
      nullable(
        formData,
        'work_item_id',
      ),
    )

  if ('error' in linked) {
    return linked
  }

  const client =
    await calendarClient(
      supabase,
      linked.clientId,
    )

  const contactMode =
    value(
      formData,
      'contact_mode',
    )

  const requestedCustomName =
    nullable(
      formData,
      'custom_name',
    )

  const customName =
    linked.clientId
      ? null
      : requestedCustomName

  if (
    contactMode === 'client' &&
    !linked.clientId
  ) {
    return {
      error:
        'Selecione o cliente da agenda.',
    }
  }

  if (
    contactMode === 'custom' &&
    !customName
  ) {
    return {
      error:
        'Informe o nome do lead, parceiro ou contato.',
    }
  }

  const type =
    validCalendarType(
      value(
        formData,
        'type',
      ),
    )

  const title =
    calendarAutomaticTitle(
      type,
      client?.name,
      customName,
    )

  const recurrenceMode =
    validRecurrenceMode(
      value(
        formData,
        'recurrence_mode',
      ),
    )

  const recurrenceConfig =
    recurrenceMode === 'none'
      ? null
      : AMPY_RECURRENCE_CONFIG[
          recurrenceMode
        ]

  const autoRecurrence =
    Boolean(recurrenceConfig)

  let recurrenceUntil:
    | string
    | null = null

  if (autoRecurrence) {
    const useContractEnd =
      value(
        formData,
        'use_contract_end',
      ) === 'on'

    recurrenceUntil =
      useContractEnd
        ? (
            client
              ?.fim_contrato ||
            client
              ?.ended_at ||
            null
          )
        : nullable(
            formData,
            'recurrence_until',
          )

    if (!recurrenceUntil) {
      return {
        error:
          'Informe até quando a agenda deve se repetir.',
      }
    }

    if (
      recurrenceUntil <
      value(
        formData,
        'start_date',
      )
    ) {
      return {
        error:
          'A data final da recorrência não pode ser anterior ao início.',
      }
    }
  }

  const occurrences =
    autoRecurrence
      ? recurrenceOccurrences(
          formData,
          allDay,
          recurrenceUntil as string,
          recurrenceConfig?.days || 28,
        )
      : [
          {
            startsAt,
            endsAt,
            sequence: 0,
          },
        ]

  if (
    occurrences.length === 0
  ) {
    return {
      error:
        'Nenhuma ocorrência válida foi gerada.',
    }
  }

  for (
    const occurrence
    of occurrences
  ) {
    const conflict =
      await findCalendarConflict(
        supabase,
        responsibleId,
        occurrence.startsAt,
        occurrence.endsAt,
      )

    if (conflict) {
      return {
        error:
          'Conflito de agenda com “' +
          conflict.title +
          '” em ' +
          new Date(
            occurrence.startsAt,
          ).toLocaleDateString(
            'pt-BR',
          ) +
          '. Reagende ou altere o responsável.',
      }
    }
  }

  const seriesId =
    autoRecurrence
      ? globalThis.crypto
          .randomUUID()
      : null

  const payload =
    occurrences.map(
      (occurrence) => ({
        title,
        type,

        client_id:
          linked.clientId,

        custom_name:
          customName,

        work_item_id:
          nullable(
            formData,
            'work_item_id',
          ),

        responsible_id:
          responsibleId,

        starts_at:
          occurrence.startsAt,

        ends_at:
          occurrence.endsAt,

        all_day: allDay,

        color:
          calendarEventColor(
            type,
            false,
          ),

        recurrence_rule:
          autoRecurrence &&
          recurrenceConfig
            ? recurrenceConfig.rule
            : null,

        series_id:
          seriesId,

        series_sequence:
          occurrence.sequence,

        recurrence_until:
          recurrenceUntil,

        auto_recurrence:
          autoRecurrence,

        location:
          nullable(
            formData,
            'location',
          ),

        notes:
          nullable(
            formData,
            'notes',
          ),

        confirmed: false,

        drive_link:
          nullable(
            formData,
            'drive_link',
          ),

        created_by:
          user.id,
      }),
    )

  const {
    data,
    error,
  } = await supabase
    .from('calendar_events')
    .insert(payload)
    .select(
      'id,work_item_id',
    )

  if (error) {
    return {
      error: error.message,
    }
  }

  const workItemId =
    nullable(
      formData,
      'work_item_id',
    )

  if (workItemId) {
    await addHistory(
      workItemId,
      user.id,
      autoRecurrence
        ? 'calendar_series_created'
        : 'calendar_event_created',
      null,
      autoRecurrence
        ? title +
          ' (' +
          String(
            data?.length || 0,
          ) +
          ' ocorrências)'
        : title,
    )
  }

  revalidateOperationalPaths()

  return {
    success: true,
    occurrences:
      data?.length || 0,
  }
}

export async function updateCalendarEventAction(
  id: string,
  formData: FormData,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const {
    data: existing,
  } = await supabase
    .from('calendar_events')
    .select(
      'id,responsible_id,created_by,work_item_id,title,starts_at,ends_at,series_id,confirmed,type,custom_name',
    )
    .eq('id', id)
    .single()

  if (
    !existing ||
    (
      !isManager(
        profile.role,
      ) &&
      existing.responsible_id !==
        user.id &&
      existing.created_by !==
        user.id
    )
  ) {
    return forbidden(
      'Você não possui permissão para alterar esta agenda.',
    )
  }

  const allDay =
    value(
      formData,
      'all_day',
    ) === 'on'

  const startsAt =
    isoFromForm(
      formData,
      'start_date',
      'start_time',
      allDay,
    )

  const endsAt =
    isoFromForm(
      formData,
      'end_date',
      'end_time',
      allDay,
      true,
    )

  if (
    !startsAt ||
    !endsAt ||
    new Date(endsAt) <=
      new Date(startsAt)
  ) {
    return {
      error:
        'Informe início e término válidos.',
    }
  }

  const responsibleId =
    isManager(
      profile.role,
    )
      ? nullable(
          formData,
          'responsible_id',
        )
      : existing.responsible_id

  const linked =
    await validateCalendarLinks(
      supabase,
      nullable(
        formData,
        'client_id',
      ),
      nullable(
        formData,
        'work_item_id',
      ),
    )

  if ('error' in linked) {
    return linked
  }

  const client =
    await calendarClient(
      supabase,
      linked.clientId,
    )

  const contactMode =
    value(
      formData,
      'contact_mode',
    )

  const requestedCustomName =
    nullable(
      formData,
      'custom_name',
    )

  const customName =
    linked.clientId
      ? null
      : requestedCustomName

  if (
    contactMode === 'client' &&
    !linked.clientId
  ) {
    return {
      error:
        'Selecione o cliente da agenda.',
    }
  }

  if (
    contactMode === 'custom' &&
    !customName
  ) {
    return {
      error:
        'Informe o nome do lead, parceiro ou contato.',
    }
  }

  const type =
    validCalendarType(
      value(
        formData,
        'type',
      ),
    )

  const title =
    calendarAutomaticTitle(
      type,
      client?.name,
      customName,
    )

  const scope =
    value(
      formData,
      'series_scope',
    ) === 'future'
      ? 'future'
      : 'single'

  const commonPayload = {
    title,
    type,

    client_id:
      linked.clientId,

    custom_name:
      customName,

    work_item_id:
      nullable(
        formData,
        'work_item_id',
      ),

    responsible_id:
      responsibleId,

    all_day:
      allDay,

    color:
      calendarEventColor(
        type,
        Boolean(
          existing.confirmed,
        ),
      ),

    location:
      nullable(
        formData,
        'location',
      ),

    notes:
      nullable(
        formData,
        'notes',
      ),

    drive_link:
      nullable(
        formData,
        'drive_link',
      ),
  }

  if (
    scope === 'future' &&
    existing.series_id
  ) {
    const {
      data: futureRows,
      error: futureError,
    } = await supabase
      .from('calendar_events')
      .select(
        'id,starts_at,ends_at,confirmed',
      )
      .eq(
        'series_id',
        existing.series_id,
      )
      .gte(
        'starts_at',
        existing.starts_at,
      )
      .order('starts_at')

    if (futureError) {
      return {
        error:
          futureError.message,
      }
    }

    const rows =
      futureRows || []

    const ignoreIds =
      rows.map(
        (row: any) =>
          row.id,
      )

    const delta =
      new Date(
        startsAt,
      ).getTime() -
      new Date(
        existing.starts_at,
      ).getTime()

    const duration =
      new Date(
        endsAt,
      ).getTime() -
      new Date(
        startsAt,
      ).getTime()

    const updates =
      rows.map(
        (
          row: any,
        ) => {
          const nextStart =
            new Date(
              new Date(
                row.starts_at,
              ).getTime() +
                delta,
            )

          const nextEnd =
            new Date(
              nextStart.getTime() +
                duration,
            )

          return {
            id: row.id,

            ...commonPayload,

            starts_at:
              nextStart
                .toISOString(),

            ends_at:
              nextEnd
                .toISOString(),
          }
        },
      )

    for (
      const update
      of updates
    ) {
      const conflict =
        await findCalendarConflict(
          supabase,
          responsibleId,
          update.starts_at,
          update.ends_at,
          ignoreIds,
        )

      if (conflict) {
        return {
          error:
            'Conflito de agenda com “' +
            conflict.title +
            '”. Nenhuma ocorrência foi alterada.',
        }
      }
    }

    const {
      error,
    } = await supabase
      .from('calendar_events')
      .upsert(
        updates,
        {
          onConflict: 'id',
        },
      )

    if (error) {
      return {
        error: error.message,
      }
    }
  } else {
    const conflict =
      await findCalendarConflict(
        supabase,
        responsibleId,
        startsAt,
        endsAt,
        [id],
      )

    if (conflict) {
      return {
        error:
          'Conflito de agenda com “' +
          conflict.title +
          '”. Reagende ou altere o responsável.',
      }
    }

    const {
      error,
    } = await supabase
      .from('calendar_events')
      .update({
        ...commonPayload,

        color:
          calendarEventColor(
            type,
            Boolean(
              existing.confirmed,
            ),
          ),

        starts_at:
          startsAt,

        ends_at:
          endsAt,
      })
      .eq('id', id)

    if (error) {
      return {
        error: error.message,
      }
    }
  }

  const nextWorkItemId =
    nullable(
      formData,
      'work_item_id',
    ) ||
    existing.work_item_id

  if (nextWorkItemId) {
    await addHistory(
      nextWorkItemId,
      user.id,
      scope === 'future'
        ? 'calendar_series_updated'
        : 'calendar_event_updated',
      existing.title,
      title,
    )
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
}


export async function toggleCalendarEventConfirmationAction(
  id: string,
  confirmed: boolean,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const {
    data: event,
    error: readError,
  } = await supabase
    .from('calendar_events')
    .select(
      'id,type,responsible_id,created_by,work_item_id,title,confirmed',
    )
    .eq('id', id)
    .single()

  if (
    readError ||
    !event ||
    (
      !isManager(
        profile.role,
      ) &&
      event.responsible_id !==
        user.id &&
      event.created_by !==
        user.id
    )
  ) {
    return forbidden(
      'Você não possui permissão para confirmar esta agenda.',
    )
  }

  const type =
    validCalendarType(
      event.type,
    )

  const {
    error,
  } = await supabase
    .from('calendar_events')
    .update({
      confirmed,

      color:
        calendarEventColor(
          type,
          confirmed,
        ),
    })
    .eq('id', id)

  if (error) {
    return {
      error: error.message,
    }
  }

  if (
    event.work_item_id
  ) {
    await addHistory(
      event.work_item_id,
      user.id,

      confirmed
        ? 'calendar_event_confirmed'
        : 'calendar_event_unconfirmed',

      event.confirmed
        ? 'confirmed'
        : 'unconfirmed',

      confirmed
        ? 'confirmed'
        : 'unconfirmed',
    )
  }

  revalidateOperationalPaths()

  return {
    success: true,
    confirmed,
  }
}

// AMPY-V17-A24.3-FUSO-MOVIMENTO
export async function moveCalendarEventAction(
  id: string,
  nextDate: string,
  nextTime?: string,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const {
    data: event,
  } = await supabase
    .from('calendar_events')
    .select(
      'starts_at,ends_at,responsible_id,created_by,work_item_id,title',
    )
    .eq('id', id)
    .single()

  if (
    !event ||
    (
      !isManager(
        profile.role,
      ) &&
      event.responsible_id !==
        user.id &&
      event.created_by !==
        user.id
    )
  ) {
    return forbidden(
      'Você não possui permissão para mover esta agenda.',
    )
  }

  const currentStart =
    new Date(
      event.starts_at,
    )

  const currentEnd =
    new Date(
      event.ends_at,
    )

  const duration =
    currentEnd.getTime() -
    currentStart.getTime()

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      nextDate,
    )
  ) {
    return {
      error:
        'Data de destino inválida.',
    }
  }

  const currentTimeParts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'America/Sao_Paulo',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hour12:
          false,
      },
    ).formatToParts(
      currentStart,
    )

  const readTimePart = (
    type:
      | 'hour'
      | 'minute',
  ) =>
    currentTimeParts.find(
      (part) =>
        part.type === type,
    )?.value || '00'

  const preservedTime =
    readTimePart('hour') +
    ':' +
    readTimePart('minute')

  const targetTime =
    nextTime &&
    /^\d{2}:\d{2}$/.test(
      nextTime,
    )
      ? nextTime
      : preservedTime

  const start =
    new Date(
      ampyLocalDateTimeToIso(
        nextDate,
        targetTime,
        false,
        false,
      ),
    )

  if (
    Number.isNaN(
      start.getTime(),
    )
  ) {
    return {
      error:
        'Data ou horário de destino inválido.',
    }
  }

  const nextEnd =
    new Date(
      start.getTime() +
        duration,
    )

  const conflict =
    await findCalendarConflict(
      supabase,
      event.responsible_id,
      start.toISOString(),
      nextEnd.toISOString(),
      [id],
    )

  if (conflict) {
    return {
      error:
        'Conflito de agenda com “' +
        conflict.title +
        '”. Reagende ou altere o responsável.',
    }
  }

  const {
    error,
  } = await supabase
    .from('calendar_events')
    .update({
      starts_at:
        start.toISOString(),

      ends_at:
        nextEnd.toISOString(),
    })
    .eq('id', id)

  if (error) {
    return {
      error: error.message,
    }
  }

  if (
    event.work_item_id
  ) {
    await addHistory(
      event.work_item_id,
      user.id,
      'calendar_event_moved',
      event.title,
      nextDate,
    )
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function resizeCalendarEventAction(
  id: string,
  nextEndAt: string,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessao invalida ou usuario inativo.',
    }
  }

  const {
    data: event,
    error: loadError,
  } = await supabase
    .from('calendar_events')
    .select(
      'starts_at,ends_at,responsible_id,created_by,work_item_id,title',
    )
    .eq('id', id)
    .single()

  if (loadError || !event) {
    return {
      error:
        loadError?.message ||
        'Agenda nao encontrada.',
    }
  }

  if (
    !isManager(profile.role) &&
    event.responsible_id !== user.id &&
    event.created_by !== user.id
  ) {
    return forbidden(
      'Voce nao possui permissao para redimensionar esta agenda.',
    )
  }

  const start = new Date(event.starts_at)
  const nextEnd = new Date(nextEndAt)

  if (
    Number.isNaN(nextEnd.getTime()) ||
    nextEnd.getTime() <= start.getTime()
  ) {
    return {
      error:
        'O termino precisa ser posterior ao inicio.',
    }
  }

  const { error } = await supabase
    .from('calendar_events')
    .update({
      ends_at:
        nextEnd.toISOString(),
    })
    .eq('id', id)

  if (error) {
    return {
      error: error.message,
    }
  }

  if (event.work_item_id) {
    await addHistory(
      event.work_item_id,
      user.id,
      'calendar_event_resized',
      event.ends_at,
      nextEnd.toISOString(),
    )
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function deleteCalendarEventAction(
  id: string,
  scope:
    | 'single'
    | 'future' = 'single',
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const {
    data: event,
  } = await supabase
    .from('calendar_events')
    .select(
      'id,responsible_id,created_by,work_item_id,title,starts_at,series_id',
    )
    .eq('id', id)
    .single()

  if (
    !event ||
    (
      !isManager(
        profile.role,
      ) &&
      event.responsible_id !==
        user.id &&
      event.created_by !==
        user.id
    )
  ) {
    return forbidden(
      'Você não possui permissão para excluir esta agenda.',
    )
  }

  let query =
    supabase
      .from('calendar_events')
      .delete()

  if (
    scope === 'future' &&
    event.series_id
  ) {
    query =
      query
        .eq(
          'series_id',
          event.series_id,
        )
        .gte(
          'starts_at',
          event.starts_at,
        )
  } else {
    query =
      query.eq(
        'id',
        id,
      )
  }

  const {
    error,
  } = await query

  if (error) {
    return {
      error: error.message,
    }
  }

  if (
    event.work_item_id
  ) {
    await addHistory(
      event.work_item_id,
      user.id,
      scope === 'future'
        ? 'calendar_series_deleted'
        : 'calendar_event_deleted',
      event.title,
      null,
    )
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
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

/* =========================================================
   AMPY-V17-A15 — DEMANDAS DO QUADRO POR CLIENTE E PERÍODO
   ========================================================= */

function boardPeriodDateLabel(
  input: string,
) {
  const parts = input.split('-')

  if (parts.length !== 3) {
    return input
  }

  return parts[2] + '/' + parts[1]
}

function boardPeriodTitle(
  clientName: string,
  startDate: string,
  finalDate: string,
) {
  return (
    clientName.trim().toUpperCase() +
    ' - ' +
    boardPeriodDateLabel(startDate) +
    ' - ' +
    boardPeriodDateLabel(finalDate)
  )
}

async function validateBoardPeriodDemand(
  supabase: any,
  formData: FormData,
) {
  const boardId =
    value(formData, 'board_id')

  const columnId =
    value(
      formData,
      'board_column_id',
    )

  const clientId =
    value(formData, 'client_id')

  const clientServiceId =
    nullable(
      formData,
      'client_service_id',
    )

  const responsibleId =
    value(
      formData,
      'responsible_id',
    )

  const startDate =
    value(
      formData,
      'internal_deadline',
    )

  const finalDate =
    value(
      formData,
      'final_deadline',
    )

  const priority =
    value(formData, 'priority') ||
    'normal'

  if (!boardId) {
    return {
      error:
        'Selecione o Quadro.',
    } as const
  }

  if (!columnId) {
    return {
      error:
        'Selecione a coluna.',
    } as const
  }

  if (!clientId) {
    return {
      error:
        'Selecione o cliente.',
    } as const
  }

  if (!responsibleId) {
    return {
      error:
        'Selecione o responsável.',
    } as const
  }

  if (!startDate) {
    return {
      error:
        'Informe a data de início.',
    } as const
  }

  if (!finalDate) {
    return {
      error:
        'Informe a data final.',
    } as const
  }

  if (finalDate < startDate) {
    return {
      error:
        'A data final não pode ser anterior à data de início.',
    } as const
  }

  if (
    ![
      'low',
      'normal',
      'high',
      'urgent',
    ].includes(priority)
  ) {
    return {
      error:
        'Prioridade inválida.',
    } as const
  }

  const [
    boardResult,
    columnResult,
    clientResult,
    responsibleResult,
  ] = await Promise.all([
    supabase
      .from('boards')
      .select('id,status')
      .eq('id', boardId)
      .eq('status', 'active')
      .maybeSingle(),

    supabase
      .from('board_columns')
      .select(
        'id,board_id,operational_status',
      )
      .eq('id', columnId)
      .maybeSingle(),

    supabase
      .from('clients')
      .select('id,name,status')
      .eq('id', clientId)
      .eq('status', 'active')
      .maybeSingle(),

    supabase
      .from('profiles')
      .select('id,is_active')
      .eq('id', responsibleId)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  if (
    boardResult.error ||
    !boardResult.data
  ) {
    return {
      error:
        'Quadro inválido ou inativo.',
    } as const
  }

  if (
    columnResult.error ||
    !columnResult.data ||
    columnResult.data.board_id !==
      boardId
  ) {
    return {
      error:
        'A coluna não pertence ao Quadro selecionado.',
    } as const
  }

  if (
    clientResult.error ||
    !clientResult.data
  ) {
    return {
      error:
        'Cliente inválido ou inativo.',
    } as const
  }

  if (
    responsibleResult.error ||
    !responsibleResult.data
  ) {
    return {
      error:
        'Responsável inválido ou inativo.',
    } as const
  }

  const linksValidation =
    await validateWorkItemLinks(
      supabase,
      clientId,
      clientServiceId,
    )

  // AMPY-V17-A15.1 — CORREÇÃO DE NARROWING TYPESCRIPT
  if (
    'error' in linksValidation &&
    typeof linksValidation.error === 'string' &&
    linksValidation.error
  ) {
    return {
      error: linksValidation.error,
    } as const
  }

  const notes =
    nullable(formData, 'notes')

  return {
    data: {
      title: boardPeriodTitle(
        clientResult.data.name,
        startDate,
        finalDate,
      ),
      description: null,
      type: 'Demanda do Quadro',
      status:
        columnResult.data
          .operational_status ||
        'not_started',
      priority,
      destino: 'quadro',
      board_id: boardId,
      board_column_id: columnId,
      client_id: clientId,
      client_service_id:
        clientServiceId,
      responsible_id:
        responsibleId,
      internal_deadline:
        startDate,
      final_deadline:
        finalDate,
      drive_link:
        nullable(
          formData,
          'drive_link',
        ),
      notes,
      blocked_reason: null,
    },
  } as const
}

export async function createBoardPeriodDemandAction(
  formData: FormData,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const validation =
    await validateBoardPeriodDemand(
      supabase,
      formData,
    )

  // AMPY-V17-A15.2B — PAYLOAD VALIDADO
  const validatedData =
    'data' in validation &&
    validation.data
      ? validation.data
      : null

  if (!validatedData) {
    return {
      error:
        'error' in validation &&
        typeof validation.error === 'string' &&
        validation.error
          ? validation.error
          : 'Não foi possível validar a demanda.',
    }
  }

  const { data, error } =
    await supabase
      .from('work_items')
      .insert({
        ...validatedData,
        created_by: user.id,
      })
      .select('id,title')
      .single()

  if (error || !data) {
    return {
      error:
        error?.message ||
        'Erro ao criar demanda.',
    }
  }

  await addHistory(
    data.id,
    user.id,
    'created',
    null,
    data.title,
  )

  revalidateOperationalPaths()

  return {
    success: true,
    id: data.id,
  }
}

export async function updateBoardPeriodDemandAction(
  id: string,
  formData: FormData,
) {
  const permission =
    await canOperateWorkItem(id)

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
    item,
  } = permission

  const validation =
    await validateBoardPeriodDemand(
      supabase,
      formData,
    )

  // AMPY-V17-A15.2B — PAYLOAD VALIDADO
  const validatedData =
    'data' in validation &&
    validation.data
      ? validation.data
      : null

  if (!validatedData) {
    return {
      error:
        'error' in validation &&
        typeof validation.error === 'string' &&
        validation.error
          ? validation.error
          : 'Não foi possível validar a demanda.',
    }
  }

  const { error } =
    await supabase
      .from('work_items')
      .update(validatedData)
      .eq('id', id)

  if (error) {
    return {
      error: error.message,
    }
  }

  if (
    item.title !==
    validatedData.title
  ) {
    await addHistory(
      id,
      user.id,
      'title',
      item.title,
      validatedData.title,
    )
  }

  if (
    item.status !==
    validatedData.status
  ) {
    await addHistory(
      id,
      user.id,
      'status',
      item.status,
      validatedData.status,
    )
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

/* =========================================================
   AMPY-V17-A16 — CRIAÇÃO UNIFICADA DE DEMANDAS
   ========================================================= */

function demandPeriodDateLabel(
  input: string,
) {
  const parts =
    String(input).split('-')

  if (parts.length !== 3) {
    return input
  }

  return (
    parts[2] +
    '/' +
    parts[1]
  )
}

function demandPeriodTitle(
  clientName: string,
  startDate: string,
  finalDate: string,
) {
  return (
    clientName
      .trim()
      .toUpperCase() +
    ' - ' +
    demandPeriodDateLabel(
      startDate,
    ) +
    ' - ' +
    demandPeriodDateLabel(
      finalDate,
    )
  )
}

export async function createDemandFromDemandasAction(
  formData: FormData,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const demandKind =
    value(
      formData,
      'demand_kind',
    )

  if (
    demandKind !== 'quadro' &&
    demandKind !== 'avulsa'
  ) {
    return {
      error:
        'Selecione Quadro ou Extra.',
    }
  }

  const startDate =
    value(
      formData,
      'internal_deadline',
    )

  const finalDate =
    value(
      formData,
      'final_deadline',
    )

  if (!startDate) {
    return {
      error:
        'Informe a data inicial.',
    }
  }

  if (!finalDate) {
    return {
      error:
        'Informe a data final.',
    }
  }

  if (
    finalDate < startDate
  ) {
    return {
      error:
        'A data final não pode ser anterior à data inicial.',
    }
  }

  const priority =
    value(
      formData,
      'priority',
    ) || 'normal'

  if (
    ![
      'low',
      'normal',
      'high',
      'urgent',
    ].includes(priority)
  ) {
    return {
      error:
        'Prioridade inválida.',
    }
  }

  const clientId =
    nullable(
      formData,
      'client_id',
    )

  const clientServiceId =
    nullable(
      formData,
      'client_service_id',
    )

  const linkValidation =
    await validateWorkItemLinks(
      supabase,
      clientId,
      clientServiceId,
    )

  if (
    'error' in linkValidation
  ) {
    return {
      error:
        linkValidation.error,
    }
  }

  const requestedResponsible =
    nullable(
      formData,
      'responsible_id',
    )

  const responsibleId =
    isManager(profile.role)
      ? requestedResponsible
      : user.id

  if (!responsibleId) {
    return {
      error:
        'Selecione o responsável.',
    }
  }

  let payload: any = null

  if (
    demandKind === 'quadro'
  ) {
    const boardId =
      value(
        formData,
        'board_id',
      )

    const boardColumnId =
      value(
        formData,
        'board_column_id',
      )

    if (!boardId) {
      return {
        error:
          'Selecione o Quadro.',
      }
    }

    if (!boardColumnId) {
      return {
        error:
          'Selecione a coluna.',
      }
    }

    if (!clientId) {
      return {
        error:
          'Selecione o cliente.',
      }
    }

    const [
      boardResult,
      columnResult,
      clientResult,
    ] = await Promise.all([
      supabase
        .from('boards')
        .select(
          'id,name,status',
        )
        .eq('id', boardId)
        .eq('status', 'active')
        .maybeSingle(),

      supabase
        .from('board_columns')
        .select('id,board_id,name,operational_status')
        .eq(
          'id',
          boardColumnId,
        )
        .eq(
          'board_id',
          boardId,
        )
        .maybeSingle(),

      supabase
        .from('clients')
        .select(
          'id,name,status',
        )
        .eq('id', clientId)
        .eq('status', 'active')
        .maybeSingle(),
    ])

    const board =
      boardResult.data

    const column =
      columnResult.data

    const client =
      clientResult.data

    if (
      boardResult.error ||
      !board
    ) {
      return {
        error:
          'Quadro inválido ou inativo.',
      }
    }

    if (
      columnResult.error ||
      !column ||
      column.board_id !==
        boardId
    ) {
      return {
        error:
          'A coluna não pertence ao Quadro selecionado.',
      }
    }

    if (
      clientResult.error ||
      !client
    ) {
      return {
        error:
          'Cliente inválido ou inativo.',
      }
    }

    payload = {
      title:
        demandPeriodTitle(
          client.name,
          startDate,
          finalDate,
        ),

      description: null,

      type:
        String(
          column.name ||
          'Quadro',
        ),

      origin: 'planned',
      destino: 'quadro',

      status:
        column.operational_status ||
        'not_started',

      priority,

      client_id: clientId,

      client_service_id:
        clientServiceId,

      responsible_id:
        responsibleId,

      created_by: user.id,

      board_id: boardId,

      board_column_id:
        boardColumnId,

      internal_deadline:
        startDate,

      final_deadline:
        finalDate,

      drive_link:
        nullable(
          formData,
          'drive_link',
        ),

      notes:
        nullable(
          formData,
          'notes',
        ),
    }
  } else {
    const title =
      value(
        formData,
        'title',
      )

    if (!title) {
      return {
        error:
          'Informe o título do Extra.',
      }
    }

    payload = {
      title,
      description: null,
      type: 'Extra',

      origin:
        clientId
          ? 'planned'
          : 'internal',

      destino: 'avulsa',
      status: 'not_started',
      priority,

      client_id: clientId,

      client_service_id:
        clientServiceId,

      responsible_id:
        responsibleId,

      created_by: user.id,

      board_id: null,

      board_column_id: null,

      internal_deadline:
        startDate,

      final_deadline:
        finalDate,

      drive_link:
        nullable(
          formData,
          'drive_link',
        ),

      notes:
        nullable(
          formData,
          'notes',
        ),
    }
  }

  if (!payload) {
    return {
      error:
        'Não foi possível preparar a demanda.',
    }
  }

  const {
    data: created,
    error,
  } = await supabase
    .from('work_items')
    .insert(payload)
    .select('id,title')
    .single()

  if (error || !created) {
    return {
      error:
        error?.message ||
        'Erro ao criar demanda.',
    }
  }

  await addHistory(
    created.id,
    user.id,
    'created',
    null,
    created.title,
  )

  revalidateOperationalPaths()

  return {
    success: true,
    id: created.id,
  }
}

/* =========================================================
   AMPY-V17-A17 — ACTIONS DE PROJETOS PADRONIZADOS
   ========================================================= */

function validateStandardProjectDates(
  startDate: string,
  finalDate: string,
) {
  if (!startDate) {
    return {
      error:
        'Informe a data inicial.',
    } as const
  }

  if (!finalDate) {
    return {
      error:
        'Informe a data final.',
    } as const
  }

  if (finalDate < startDate) {
    return {
      error:
        'A data final não pode ser anterior à data inicial.',
    } as const
  }

  return {
    ok: true,
  } as const
}

function validateStandardProjectPriority(
  priority: string,
) {
  if (
    ![
      'low',
      'normal',
      'high',
      'urgent',
    ].includes(priority)
  ) {
    return {
      error:
        'Prioridade inválida.',
    } as const
  }

  return {
    ok: true,
  } as const
}

function normalizeStandardProjectStatus(
  input: string,
) {
  return VALID_WORK_ITEM_STATUSES.includes(
    input as WorkItemStatus,
  )
    ? input
    : 'not_started'
}

export async function createStandardProjectAction(
  formData: FormData,
) {
  const {
    supabase,
    user,
    profile,
  } = await getCurrentProfile()

  if (!user || !profile) {
    return {
      error:
        'Sessão inválida ou usuário inativo.',
    }
  }

  const title =
    value(formData, 'title')

  if (!title) {
    return {
      error:
        'Informe o título do projeto.',
    }
  }

  const startDate =
    value(
      formData,
      'internal_deadline',
    )

  const finalDate =
    value(
      formData,
      'final_deadline',
    )

  const dateValidation =
    validateStandardProjectDates(
      startDate,
      finalDate,
    )

  if ('error' in dateValidation) {
    return dateValidation
  }

  const priority =
    value(
      formData,
      'priority',
    ) || 'normal'

  const priorityValidation =
    validateStandardProjectPriority(
      priority,
    )

  if (
    'error' in
    priorityValidation
  ) {
    return priorityValidation
  }

  const clientId =
    nullable(
      formData,
      'client_id',
    )

  const clientServiceId =
    nullable(
      formData,
      'client_service_id',
    )

  const linkValidation =
    await validateWorkItemLinks(
      supabase,
      clientId,
      clientServiceId,
    )

  if ('error' in linkValidation) {
    return {
      error:
        linkValidation.error,
    }
  }

  if (clientId) {
    const {
      data: client,
      error: clientError,
    } = await supabase
      .from('clients')
      .select('id,status')
      .eq('id', clientId)
      .eq('status', 'active')
      .maybeSingle()

    if (
      clientError ||
      !client
    ) {
      return {
        error:
          'Cliente inválido ou inativo.',
      }
    }
  }

  const requestedResponsible =
    nullable(
      formData,
      'responsible_id',
    )

  const responsibleId =
    isManager(profile.role)
      ? requestedResponsible
      : user.id

  if (!responsibleId) {
    return {
      error:
        'Selecione o responsável.',
    }
  }

  const status =
    normalizeStandardProjectStatus(
      value(formData, 'status'),
    )

  const closed =
    [
      'done',
      'delivered',
      'cancelled',
      'archived',
    ].includes(status)

  const payload: any = {
    title,
    description: null,
    type: 'Projeto',

    origin:
      clientId
        ? 'planned'
        : 'internal',

    destino: 'projeto',
    status,
    priority,

    client_id: clientId,

    client_service_id:
      clientServiceId,

    responsible_id:
      responsibleId,

    created_by: user.id,

    internal_deadline:
      startDate,

    final_deadline:
      finalDate,

    drive_link:
      nullable(
        formData,
        'drive_link',
      ),

    notes:
      nullable(
        formData,
        'notes',
      ),

    board_id: null,
    board_column_id: null,

    closed_at:
      closed
        ? new Date()
            .toISOString()
        : null,
  }

  const {
    data: created,
    error,
  } = await supabase
    .from('work_items')
    .insert(payload)
    .select('id,title')
    .single()

  if (error || !created) {
    return {
      error:
        error?.message ||
        'Erro ao criar projeto.',
    }
  }

  await addHistory(
    created.id,
    user.id,
    'project_created',
    null,
    title,
  )

  revalidateOperationalPaths()

  return {
    success: true,
    id: created.id,
  }
}

export async function updateStandardProjectAction(
  id: string,
  formData: FormData,
) {
  const permission =
    await canOperateWorkItem(id)

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
    profile,
    item,
  } = permission

  const title =
    value(formData, 'title')

  if (!title) {
    return {
      error:
        'Informe o título do projeto.',
    }
  }

  const startDate =
    value(
      formData,
      'internal_deadline',
    )

  const finalDate =
    value(
      formData,
      'final_deadline',
    )

  const dateValidation =
    validateStandardProjectDates(
      startDate,
      finalDate,
    )

  if ('error' in dateValidation) {
    return dateValidation
  }

  const priority =
    value(
      formData,
      'priority',
    ) || 'normal'

  const priorityValidation =
    validateStandardProjectPriority(
      priority,
    )

  if (
    'error' in
    priorityValidation
  ) {
    return priorityValidation
  }

  const clientId =
    nullable(
      formData,
      'client_id',
    )

  const clientServiceId =
    nullable(
      formData,
      'client_service_id',
    )

  const linkValidation =
    await validateWorkItemLinks(
      supabase,
      clientId,
      clientServiceId,
    )

  if ('error' in linkValidation) {
    return {
      error:
        linkValidation.error,
    }
  }

  if (clientId) {
    const {
      data: client,
      error: clientError,
    } = await supabase
      .from('clients')
      .select('id,status')
      .eq('id', clientId)
      .eq('status', 'active')
      .maybeSingle()

    if (
      clientError ||
      !client
    ) {
      return {
        error:
          'Cliente inválido ou inativo.',
      }
    }
  }

  const requestedResponsible =
    nullable(
      formData,
      'responsible_id',
    )

  const responsibleId =
    isManager(profile.role)
      ? requestedResponsible
      : user.id

  if (!responsibleId) {
    return {
      error:
        'Selecione o responsável.',
    }
  }

  const status =
    normalizeStandardProjectStatus(
      value(formData, 'status'),
    )

  const closed =
    [
      'done',
      'delivered',
      'cancelled',
      'archived',
    ].includes(status)

  const payload: any = {
    title,
    description: null,
    type: 'Projeto',

    origin:
      clientId
        ? 'planned'
        : 'internal',

    destino: 'projeto',
    status,
    priority,

    client_id: clientId,

    client_service_id:
      clientServiceId,

    responsible_id:
      responsibleId,

    internal_deadline:
      startDate,

    final_deadline:
      finalDate,

    drive_link:
      nullable(
        formData,
        'drive_link',
      ),

    notes:
      nullable(
        formData,
        'notes',
      ),

    board_id: null,
    board_column_id: null,

    closed_at:
      closed
        ? new Date()
            .toISOString()
        : null,
  }

  const { error } =
    await supabase
      .from('work_items')
      .update(payload)
      .eq('id', id)

  if (error) {
    return {
      error: error.message,
    }
  }

  await addHistory(
    id,
    user.id,
    'project_updated',
    item.status,
    status,
  )

  revalidateOperationalPaths()

  revalidatePath(
    '/dashboard/demandas/' +
      id,
  )

  return {
    success: true,
  }
}

/* =========================================================
   AMPY-V17-A18 — STATUS PERSONALIZADOS POR PROJETO
   ========================================================= */

const PROJECT_STEP_BEHAVIORS = [
  'pending',
  'active',
  'blocked',
  'done',
] as const

type ProjectStepBehavior =
  (typeof PROJECT_STEP_BEHAVIORS)[number]

function normalizeProjectStepColor(
  input: string,
) {
  const color =
    String(input || '')
      .trim()
      .toUpperCase()

  return /^#[0-9A-F]{6}$/.test(color)
    ? color
    : '#64748B'
}

function normalizeProjectStepBehavior(
  input: string,
):
  | ProjectStepBehavior
  | null {
  return PROJECT_STEP_BEHAVIORS.includes(
    input as ProjectStepBehavior,
  )
    ? (
        input as
          ProjectStepBehavior
      )
    : null
}

function projectStepBehaviorToLegacyStatus(
  behavior: ProjectStepBehavior,
) {
  if (behavior === 'active') {
    return 'in_progress'
  }

  if (behavior === 'blocked') {
    return 'blocked'
  }

  if (behavior === 'done') {
    return 'done'
  }

  return 'not_started'
}

async function getProjectStepStatusDefinition(
  supabase: any,
  statusId: string,
  projectId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from('project_step_statuses')
    .select(
      'id,work_item_id,name,color,behavior,position,is_archived',
    )
    .eq('id', statusId)
    .eq('work_item_id', projectId)
    .eq('is_archived', false)
    .maybeSingle()

  if (
    error ||
    !data
  ) {
    return {
      error:
        'Status da etapa inválido para este projeto.',
    } as const
  }

  const behavior =
    normalizeProjectStepBehavior(
      data.behavior,
    )

  if (!behavior) {
    return {
      error:
        'Comportamento do status inválido.',
    } as const
  }

  return {
    data: {
      ...data,
      behavior,
    },
  } as const
}

async function syncProjectStatusFromSteps(
  supabase: any,
  projectId: string,
) {
  const [
    stepsResult,
    statusesResult,
  ] = await Promise.all([
    supabase
      .from('project_steps')
      .select('id,status_id,status')
      .eq(
        'work_item_id',
        projectId,
      ),

    supabase
      .from(
        'project_step_statuses',
      )
      .select('id,behavior')
      .eq(
        'work_item_id',
        projectId,
      )
      .eq(
        'is_archived',
        false,
      ),
  ])

  if (stepsResult.error) {
    return {
      error:
        stepsResult.error.message,
    } as const
  }

  if (statusesResult.error) {
    return {
      error:
        statusesResult.error.message,
    } as const
  }

  const statusesById =
    new Map(
      (
        statusesResult.data || []
      ).map((status: any) => [
        status.id,
        status.behavior,
      ]),
    )

  const steps =
    stepsResult.data || []

  const behaviors =
    steps.map((step: any) => {
      const byDefinition =
        step.status_id
          ? statusesById.get(
              step.status_id,
            )
          : null

      if (
        PROJECT_STEP_BEHAVIORS.includes(
          byDefinition as
            ProjectStepBehavior,
        )
      ) {
        return (
          byDefinition as
            ProjectStepBehavior
        )
      }

      if (
        [
          'done',
          'delivered',
          'approved',
        ].includes(
          String(
            step.status || '',
          ),
        )
      ) {
        return 'done' as const
      }

      if (
        [
          'blocked',
          'waiting',
          'awaiting_approval',
        ].includes(
          String(
            step.status || '',
          ),
        )
      ) {
        return 'blocked' as const
      }

      if (
        [
          'in_progress',
          'in_review',
          'scheduled',
        ].includes(
          String(
            step.status || '',
          ),
        )
      ) {
        return 'active' as const
      }

      return 'pending' as const
    })

  let nextStatus =
    'not_started'

  if (
    behaviors.length > 0 &&
    behaviors.every(
      (behavior: string) =>
        behavior === 'done',
    )
  ) {
    nextStatus = 'done'
  } else if (
    behaviors.some(
      (behavior: string) =>
        behavior === 'blocked',
    )
  ) {
    nextStatus = 'blocked'
  } else if (
    behaviors.some(
      (behavior: string) =>
        behavior === 'active',
    )
  ) {
    nextStatus =
      'in_progress'
  }

  const closed =
    nextStatus === 'done'

  const { error } =
    await supabase
      .from('work_items')
      .update({
        status: nextStatus,

        closed_at:
          closed
            ? new Date()
                .toISOString()
            : null,
      })
      .eq('id', projectId)

  if (error) {
    return {
      error: error.message,
    } as const
  }

  return {
    success: true,
    status: nextStatus,
  } as const
}

function validateProjectStepDates(
  startDate: string,
  endDate: string,
) {
  if (!startDate) {
    return {
      error:
        'Informe a data de início da etapa.',
    } as const
  }

  if (!endDate) {
    return {
      error:
        'Informe a data final da etapa.',
    } as const
  }

  if (endDate < startDate) {
    return {
      error:
        'A data final da etapa não pode ser anterior ao início.',
    } as const
  }

  return {
    success: true,
  } as const
}

export async function createProjectStepStatusAction(
  projectId: string,
  formData: FormData,
) {
  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
    item,
  } = permission

  if (
    ![
      'projeto',
      'ambos',
    ].includes(
      String(item.destino || ''),
    )
  ) {
    return {
      error:
        'A demanda informada não é um projeto.',
    }
  }

  const name =
    value(formData, 'name')

  if (
    name.length < 1 ||
    name.length > 48
  ) {
    return {
      error:
        'O nome do status deve ter entre 1 e 48 caracteres.',
    }
  }

  const behavior =
    normalizeProjectStepBehavior(
      value(
        formData,
        'behavior',
      ),
    )

  if (!behavior) {
    return {
      error:
        'Comportamento do status inválido.',
    }
  }

  const color =
    normalizeProjectStepColor(
      value(
        formData,
        'color',
      ),
    )

  const {
    data: lastStatus,
    error: positionError,
  } = await supabase
    .from('project_step_statuses')
    .select('position')
    .eq(
      'work_item_id',
      projectId,
    )
    .eq(
      'is_archived',
      false,
    )
    .order(
      'position',
      { ascending: false },
    )
    .limit(1)
    .maybeSingle()

  if (positionError) {
    return {
      error:
        positionError.message,
    }
  }

  const nextPosition =
    Number(
      lastStatus?.position ??
        -1,
    ) + 1

  const { error } =
    await supabase
      .from(
        'project_step_statuses',
      )
      .insert({
        work_item_id:
          projectId,
        name,
        color,
        behavior,
        position:
          nextPosition,
        is_archived:
          false,
      })

  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'Já existe um status com esse nome neste projeto.'
          : error.message,
    }
  }

  await addHistory(
    projectId,
    user.id,
    'project_step_status_created',
    null,
    name,
  )

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function updateProjectStepStatusDefinitionAction(
  statusId: string,
  projectId: string,
  formData: FormData,
) {
  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
  } = permission

  const existing =
    await getProjectStepStatusDefinition(
      supabase,
      statusId,
      projectId,
    )

  if ('error' in existing) {
    return existing
  }

  const name =
    value(formData, 'name')

  if (
    name.length < 1 ||
    name.length > 48
  ) {
    return {
      error:
        'O nome do status deve ter entre 1 e 48 caracteres.',
    }
  }

  const behavior =
    normalizeProjectStepBehavior(
      value(
        formData,
        'behavior',
      ),
    )

  if (!behavior) {
    return {
      error:
        'Comportamento do status inválido.',
    }
  }

  const color =
    normalizeProjectStepColor(
      value(
        formData,
        'color',
      ),
    )

  const { error } =
    await supabase
      .from(
        'project_step_statuses',
      )
      .update({
        name,
        color,
        behavior,
      })
      .eq('id', statusId)
      .eq(
        'work_item_id',
        projectId,
      )

  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'Já existe um status com esse nome neste projeto.'
          : error.message,
    }
  }

  const legacyStatus =
    projectStepBehaviorToLegacyStatus(
      behavior,
    )

  const {
    error: stepsError,
  } = await supabase
    .from('project_steps')
    .update({
      status:
        legacyStatus,
    })
    .eq(
      'work_item_id',
      projectId,
    )
    .eq(
      'status_id',
      statusId,
    )

  if (stepsError) {
    return {
      error:
        stepsError.message,
    }
  }

  const syncResult =
    await syncProjectStatusFromSteps(
      supabase,
      projectId,
    )

  if ('error' in syncResult) {
    return syncResult
  }

  await addHistory(
    projectId,
    user.id,
    'project_step_status_updated',
    existing.data.name,
    name,
  )

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function moveProjectStepStatusAction(
  statusId: string,
  projectId: string,
  direction: 'up' | 'down',
) {
  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const { supabase } =
    permission

  const {
    data: statuses,
    error,
  } = await supabase
    .from('project_step_statuses')
    .select('id,position')
    .eq(
      'work_item_id',
      projectId,
    )
    .eq(
      'is_archived',
      false,
    )
    .order(
      'position',
      { ascending: true },
    )
    .order(
      'created_at',
      { ascending: true },
    )

  if (error) {
    return {
      error: error.message,
    }
  }

  const list =
    statuses || []

  const currentIndex =
    list.findIndex(
      (status: any) =>
        status.id === statusId,
    )

  if (currentIndex < 0) {
    return {
      error:
        'Status não encontrado.',
    }
  }

  const targetIndex =
    direction === 'up'
      ? currentIndex - 1
      : currentIndex + 1

  if (
    targetIndex < 0 ||
    targetIndex >= list.length
  ) {
    return {
      success: true,
    }
  }

  const current =
    list[currentIndex]

  const target =
    list[targetIndex]

  const firstUpdate =
    await supabase
      .from(
        'project_step_statuses',
      )
      .update({
        position:
          Number(
            target.position,
          ),
      })
      .eq(
        'id',
        current.id,
      )

  if (firstUpdate.error) {
    return {
      error:
        firstUpdate.error.message,
    }
  }

  const secondUpdate =
    await supabase
      .from(
        'project_step_statuses',
      )
      .update({
        position:
          Number(
            current.position,
          ),
      })
      .eq(
        'id',
        target.id,
      )

  if (secondUpdate.error) {
    return {
      error:
        secondUpdate.error.message,
    }
  }

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function deleteProjectStepStatusDefinitionAction(
  statusId: string,
  projectId: string,
  replacementStatusId: string,
) {
  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
  } = permission

  const {
    data: statuses,
    error: statusesError,
  } = await supabase
    .from('project_step_statuses')
    .select(
      'id,name,behavior,position',
    )
    .eq(
      'work_item_id',
      projectId,
    )
    .eq(
      'is_archived',
      false,
    )
    .order(
      'position',
      { ascending: true },
    )

  if (statusesError) {
    return {
      error:
        statusesError.message,
    }
  }

  const list =
    statuses || []

  if (list.length <= 1) {
    return {
      error:
        'Não é possível excluir o último status do projeto.',
    }
  }

  const current =
    list.find(
      (status: any) =>
        status.id === statusId,
    )

  if (!current) {
    return {
      error:
        'Status não encontrado.',
    }
  }

  const {
    count,
    error: countError,
  } = await supabase
    .from('project_steps')
    .select(
      'id',
      {
        count: 'exact',
        head: true,
      },
    )
    .eq(
      'work_item_id',
      projectId,
    )
    .eq(
      'status_id',
      statusId,
    )

  if (countError) {
    return {
      error:
        countError.message,
    }
  }

  const usage =
    Number(count || 0)

  if (usage > 0) {
    if (!replacementStatusId) {
      return {
        error:
          'Escolha para qual status as etapas serão transferidas.',
      }
    }

    if (
      replacementStatusId ===
      statusId
    ) {
      return {
        error:
          'O status de destino deve ser diferente.',
      }
    }

    const replacement =
      list.find(
        (status: any) =>
          status.id ===
          replacementStatusId,
      )

    if (!replacement) {
      return {
        error:
          'Status de destino inválido.',
      }
    }

    const replacementBehavior =
      normalizeProjectStepBehavior(
        replacement.behavior,
      )

    if (!replacementBehavior) {
      return {
        error:
          'Comportamento do status de destino inválido.',
      }
    }

    const moveResult =
      await supabase
        .from('project_steps')
        .update({
          status_id:
            replacementStatusId,

          status:
            projectStepBehaviorToLegacyStatus(
              replacementBehavior,
            ),
        })
        .eq(
          'work_item_id',
          projectId,
        )
        .eq(
          'status_id',
          statusId,
        )

    if (moveResult.error) {
      return {
        error:
          moveResult.error.message,
      }
    }
  }

  const deleteResult =
    await supabase
      .from(
        'project_step_statuses',
      )
      .delete()
      .eq('id', statusId)
      .eq(
        'work_item_id',
        projectId,
      )

  if (deleteResult.error) {
    return {
      error:
        deleteResult.error.message,
    }
  }

  const remaining =
    list.filter(
      (status: any) =>
        status.id !== statusId,
    )

  for (
    let index = 0;
    index < remaining.length;
    index += 1
  ) {
    const status =
      remaining[index]

    const reorderResult =
      await supabase
        .from(
          'project_step_statuses',
        )
        .update({
          position: index,
        })
        .eq(
          'id',
          status.id,
        )

    if (reorderResult.error) {
      return {
        error:
          reorderResult.error.message,
      }
    }
  }

  const syncResult =
    await syncProjectStatusFromSteps(
      supabase,
      projectId,
    )

  if ('error' in syncResult) {
    return syncResult
  }

  await addHistory(
    projectId,
    user.id,
    'project_step_status_deleted',
    current.name,
    null,
  )

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function createProjectStepDynamicAction(
  formData: FormData,
) {
  const projectId =
    value(
      formData,
      'work_item_id',
    )

  if (!projectId) {
    return {
      error:
        'Projeto inválido.',
    }
  }

  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
  } = permission

  const title =
    value(formData, 'title')

  if (
    title.length < 2 ||
    title.length > 140
  ) {
    return {
      error:
        'O título da etapa deve ter entre 2 e 140 caracteres.',
    }
  }

  const startDate =
    value(
      formData,
      'start_date',
    )

  const endDate =
    value(
      formData,
      'end_date',
    )

  const dateValidation =
    validateProjectStepDates(
      startDate,
      endDate,
    )

  if ('error' in dateValidation) {
    return dateValidation
  }

  const statusId =
    value(
      formData,
      'status_id',
    )

  const statusResult =
    await getProjectStepStatusDefinition(
      supabase,
      statusId,
      projectId,
    )

  if ('error' in statusResult) {
    return statusResult
  }

  const {
    data: lastStep,
    error: positionError,
  } = await supabase
    .from('project_steps')
    .select('position')
    .eq(
      'work_item_id',
      projectId,
    )
    .order(
      'position',
      { ascending: false },
    )
    .limit(1)
    .maybeSingle()

  if (positionError) {
    return {
      error:
        positionError.message,
    }
  }

  const {
    data: created,
    error,
  } = await supabase
    .from('project_steps')
    .insert({
      work_item_id:
        projectId,

      title,

      responsible_id:
        nullable(
          formData,
          'responsible_id',
        ),

      status_id:
        statusId,

      status:
        projectStepBehaviorToLegacyStatus(
          statusResult.data
            .behavior,
        ),

      start_date:
        startDate,

      end_date:
        endDate,

      position:
        Number(
          lastStep?.position ??
            -1,
        ) + 1,

      notes:
        nullable(
          formData,
          'notes',
        ),
    })
    .select('id,title')
    .single()

  if (
    error ||
    !created
  ) {
    return {
      error:
        error?.message ||
        'Erro ao criar etapa.',
    }
  }

  const syncResult =
    await syncProjectStatusFromSteps(
      supabase,
      projectId,
    )

  if ('error' in syncResult) {
    return syncResult
  }

  await addHistory(
    projectId,
    user.id,
    'project_step_created',
    null,
    title,
  )

  revalidateOperationalPaths()

  return {
    success: true,
    id: created.id,
  }
}

export async function updateProjectStepDynamicAction(
  stepId: string,
  projectId: string,
  formData: FormData,
) {
  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
  } = permission

  const title =
    value(formData, 'title')

  if (
    title.length < 2 ||
    title.length > 140
  ) {
    return {
      error:
        'O título da etapa deve ter entre 2 e 140 caracteres.',
    }
  }

  const startDate =
    value(
      formData,
      'start_date',
    )

  const endDate =
    value(
      formData,
      'end_date',
    )

  const dateValidation =
    validateProjectStepDates(
      startDate,
      endDate,
    )

  if ('error' in dateValidation) {
    return dateValidation
  }

  const statusId =
    value(
      formData,
      'status_id',
    )

  const statusResult =
    await getProjectStepStatusDefinition(
      supabase,
      statusId,
      projectId,
    )

  if ('error' in statusResult) {
    return statusResult
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from('project_steps')
    .select('id,title')
    .eq('id', stepId)
    .eq(
      'work_item_id',
      projectId,
    )
    .maybeSingle()

  if (
    existingError ||
    !existing
  ) {
    return {
      error:
        'Etapa não encontrada.',
    }
  }

  const { error } =
    await supabase
      .from('project_steps')
      .update({
        title,

        responsible_id:
          nullable(
            formData,
            'responsible_id',
          ),

        status_id:
          statusId,

        status:
          projectStepBehaviorToLegacyStatus(
            statusResult.data
              .behavior,
          ),

        start_date:
          startDate,

        end_date:
          endDate,

        notes:
          nullable(
            formData,
            'notes',
          ),
      })
      .eq('id', stepId)
      .eq(
        'work_item_id',
        projectId,
      )

  if (error) {
    return {
      error: error.message,
    }
  }

  const syncResult =
    await syncProjectStatusFromSteps(
      supabase,
      projectId,
    )

  if ('error' in syncResult) {
    return syncResult
  }

  await addHistory(
    projectId,
    user.id,
    'project_step_updated',
    existing.title,
    title,
  )

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function updateProjectStepStatusDynamicAction(
  stepId: string,
  projectId: string,
  statusId: string,
) {
  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
  } = permission

  const statusResult =
    await getProjectStepStatusDefinition(
      supabase,
      statusId,
      projectId,
    )

  if ('error' in statusResult) {
    return statusResult
  }

  const {
    data: step,
    error: stepError,
  } = await supabase
    .from('project_steps')
    .select(
      'id,status,status_id',
    )
    .eq('id', stepId)
    .eq(
      'work_item_id',
      projectId,
    )
    .maybeSingle()

  if (
    stepError ||
    !step
  ) {
    return {
      error:
        'Etapa não encontrada.',
    }
  }

  const legacyStatus =
    projectStepBehaviorToLegacyStatus(
      statusResult.data.behavior,
    )

  const { error } =
    await supabase
      .from('project_steps')
      .update({
        status_id:
          statusId,

        status:
          legacyStatus,
      })
      .eq('id', stepId)
      .eq(
        'work_item_id',
        projectId,
      )

  if (error) {
    return {
      error: error.message,
    }
  }

  const syncResult =
    await syncProjectStatusFromSteps(
      supabase,
      projectId,
    )

  if ('error' in syncResult) {
    return syncResult
  }

  await addHistory(
    projectId,
    user.id,
    'project_step_status_changed',
    step.status_id ||
      step.status ||
      null,
    statusId,
  )

  revalidateOperationalPaths()

  return {
    success: true,
  }
}

export async function deleteProjectStepDynamicAction(
  stepId: string,
  projectId: string,
) {
  const permission =
    await canOperateWorkItem(
      projectId,
    )

  if ('error' in permission) {
    return permission
  }

  const {
    supabase,
    user,
  } = permission

  const {
    data: step,
    error: stepError,
  } = await supabase
    .from('project_steps')
    .select('id,title')
    .eq('id', stepId)
    .eq(
      'work_item_id',
      projectId,
    )
    .maybeSingle()

  if (
    stepError ||
    !step
  ) {
    return {
      error:
        'Etapa não encontrada.',
    }
  }

  const { error } =
    await supabase
      .from('project_steps')
      .delete()
      .eq('id', stepId)
      .eq(
        'work_item_id',
        projectId,
      )

  if (error) {
    return {
      error: error.message,
    }
  }

  const {
    data: remaining,
    error: remainingError,
  } = await supabase
    .from('project_steps')
    .select('id,position')
    .eq(
      'work_item_id',
      projectId,
    )
    .order(
      'position',
      { ascending: true },
    )

  if (remainingError) {
    return {
      error:
        remainingError.message,
    }
  }

  for (
    let index = 0;
    index <
    (
      remaining || []
    ).length;
    index += 1
  ) {
    const item =
      (
        remaining || []
      )[index]

    const reorderResult =
      await supabase
        .from('project_steps')
        .update({
          position: index,
        })
        .eq('id', item.id)

    if (reorderResult.error) {
      return {
        error:
          reorderResult.error.message,
      }
    }
  }

  const syncResult =
    await syncProjectStatusFromSteps(
      supabase,
      projectId,
    )

  if ('error' in syncResult) {
    return syncResult
  }

  await addHistory(
    projectId,
    user.id,
    'project_step_deleted',
    step.title,
    null,
  )

  revalidateOperationalPaths()

  return {
    success: true,
  }
}
