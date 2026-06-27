export type UserRole = 'admin' | 'director' | 'manager' | 'team_lead' | 'collaborator' | 'freelancer' | 'traffic' | 'financial'
export type ClientStatus = 'active' | 'onboarding' | 'paused' | 'cancelled'
export type ServiceStatus = 'active' | 'paused' | 'cancelled'
export type WorkItemStatus = 'not_started' | 'in_progress' | 'waiting' | 'blocked' | 'in_review' | 'awaiting_approval' | 'approved' | 'scheduled' | 'delivered' | 'done' | 'cancelled' | 'archived'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type EventType = 'meeting' | 'capture' | 'recording' | 'delivery' | 'internal' | 'commercial'
export type ProjectStatus = 'active' | 'paused' | 'at_risk' | 'done' | 'cancelled'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
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
  status: ClientStatus
  avatar_initials: string
  avatar_color: string
  avatar_bg: string
  responsible_id?: string
  main_contact_name?: string
  main_contact_email?: string
  main_contact_phone?: string
  drive_folder_url?: string
  briefing_url?: string
  last_report_url?: string
  instagram?: string
  website?: string
  notes?: string
  started_at?: string
  created_at: string
  updated_at: string
  responsible?: Profile
  services?: ClientService[]
}

export interface ServiceCatalog {
  id: string
  name: string
  category: string
  description?: string
  default_workflow: string[]
  is_active: boolean
}

export interface ClientService {
  id: string
  client_id: string
  service_catalog_id: string
  responsible_id?: string
  status: ServiceStatus
  started_at?: string
  notes?: string
  service?: ServiceCatalog
  responsible?: Profile
}

export interface WorkItem {
  id: string
  title: string
  description?: string
  client_id?: string
  client_service_id?: string
  project_id?: string
  type: string
  origin: string
  status: WorkItemStatus
  priority: Priority
  responsible_id?: string
  created_by?: string
  internal_deadline?: string
  final_deadline?: string
  blocked_reason?: string
  drive_link?: string
  notes?: string
  closed_at?: string
  created_at: string
  updated_at: string
  client?: Client
  responsible?: Profile
}

export interface Project {
  id: string
  name: string
  type: string
  client_id?: string
  responsible_id?: string
  status: ProjectStatus
  description?: string
  started_at?: string
  deadline?: string
  drive_folder_url?: string
  created_at: string
  updated_at: string
  client?: Client
  responsible?: Profile
}

export interface CalendarEvent {
  id: string
  title: string
  type: EventType
  client_id?: string
  work_item_id?: string
  responsible_id?: string
  starts_at: string
  ends_at: string
  location?: string
  notes?: string
  confirmed: boolean
  drive_link?: string
  created_by?: string
  created_at: string
  updated_at: string
  client?: Client
  responsible?: Profile
}
