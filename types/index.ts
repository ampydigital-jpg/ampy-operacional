export type UserRole = 'admin' | 'director' | 'manager' | 'team_lead' | 'collaborator' | 'freelancer' | 'traffic' | 'financial'
export type ClientStatus = 'active' | 'onboarding' | 'paused' | 'cancelled'
export type ServiceStatus = 'active' | 'paused' | 'cancelled'
export type WorkItemStatus = 'not_started' | 'in_progress' | 'waiting' | 'blocked' | 'in_review' | 'awaiting_approval' | 'approved' | 'scheduled' | 'delivered' | 'done' | 'cancelled' | 'archived'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type DemandProcess = 'quadro' | 'projeto' | 'ambos' | 'avulsa'
export type EventType = 'meeting' | 'capture_external' | 'capture_studio' | 'recording' | 'delivery' | 'internal' | 'commercial'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  team_area?: string | null
  job_title?: string | null
  avatar_initials: string
  avatar_color: string
  avatar_bg: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  segment: string
  cidade?: string | null
  status: ClientStatus
  avatar_initials: string
  avatar_color: string
  avatar_bg: string
  responsible_id?: string | null
  main_contact_name?: string | null
  main_contact_email?: string | null
  main_contact_phone?: string | null
  drive_folder_url?: string | null
  briefing_url?: string | null
  last_report_url?: string | null
  instagram?: string | null
  website?: string | null
  notes?: string | null
  started_at?: string | null
  ended_at?: string | null
  inicio_contrato?: string | null
  fim_contrato?: string | null
  created_at: string
  updated_at: string
  responsible?: Profile
  services?: ClientService[]
}

export interface ServiceCatalog {
  id: string
  name: string
  category: string
  description?: string | null
  default_workflow: string[]
  is_active: boolean
}

export interface ClientService {
  id: string
  client_id: string
  service_catalog_id: string
  responsible_id?: string | null
  status: ServiceStatus
  started_at?: string | null
  notes?: string | null
  monthly_quantity?: number | null
  quantity_unit?: string | null
  delivered_quantity?: number | null
  service?: ServiceCatalog
  responsible?: Profile
}

export interface WorkItem {
  id: string
  title: string
  description?: string | null
  client_id?: string | null
  client_service_id?: string | null
  project_id?: string | null
  type: string
  origin: string
  destino: DemandProcess
  status: WorkItemStatus
  priority: Priority
  responsible_id?: string | null
  created_by?: string | null
  internal_deadline?: string | null
  final_deadline?: string | null
  blocked_reason?: string | null
  drive_link?: string | null
  notes?: string | null
  closed_at?: string | null
  created_at: string
  updated_at: string
  client?: Client | null
  responsible?: Profile | null
}

export interface ProjectStep {
  id: string
  work_item_id: string
  title: string
  responsible_id?: string | null
  start_date?: string | null
  end_date?: string | null
  status: WorkItemStatus
  position: number
  notes?: string | null
  responsible?: Profile | null
}

export interface CalendarEvent {
  id: string
  title: string
  type: EventType
  client_id?: string | null
  work_item_id?: string | null
  responsible_id?: string | null
  starts_at: string
  ends_at: string
  all_day?: boolean
  color?: string | null
  recurrence_rule?: string | null
  location?: string | null
  notes?: string | null
  confirmed: boolean
  drive_link?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  client?: Client | null
  responsible?: Profile | null
  work_item?: WorkItem | null
}
