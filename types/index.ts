// =============================================
// AMPY DIGITAL — TIPOS DO SISTEMA
// =============================================

export type ClientStatus = 'active' | 'onboarding' | 'paused' | 'cancelled'
export type ServiceStatus = 'active' | 'paused' | 'cancelled'
export type WorkItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'in_review'
  | 'awaiting_approval'
  | 'approved'
  | 'scheduled'
  | 'delivered'
  | 'done'
  | 'cancelled'
  | 'archived'

export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type EventType = 'meeting' | 'capture' | 'recording' | 'delivery' | 'internal' | 'commercial'
export type UserRole = 'admin' | 'director' | 'manager' | 'team_lead' | 'collaborator' | 'freelancer' | 'traffic' | 'financial'

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
}

export interface Client {
  id: string
  name: string
  segment: string
  status: ClientStatus
  avatar_initials: string
  avatar_color: string
  avatar_bg: string
  main_contact_email?: string
  main_contact_phone?: string
  drive_folder_url?: string
  briefing_url?: string
  notes?: string
  started_at: string
  created_at: string
  updated_at: string
  // joins
  responsible?: Profile
  services?: ClientService[]
  open_demands_count?: number
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
  status: ServiceStatus
  started_at: string
  responsible_id: string
  notes?: string
  // joins
  service?: ServiceCatalog
  responsible?: Profile
}

export interface WorkItem {
  id: string
  title: string
  description?: string
  client_id?: string
  service_id?: string
  project_id?: string
  type: string
  origin: string
  status: WorkItemStatus
  priority: Priority
  responsible_id?: string
  internal_deadline?: string
  final_deadline?: string
  drive_link?: string
  blocked_reason?: string
  created_by: string
  created_at: string
  updated_at: string
  // joins
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
  external_url?: string
  created_at: string
  // joins
  client?: Client
  responsible?: Profile
}

export interface Approval {
  id: string
  work_item_id: string
  version: number
  sent_at: string
  deadline?: string
  status: 'pending' | 'approved' | 'changes_requested' | 'cancelled'
  feedback?: string
  drive_link?: string
  responded_at?: string
}

export interface DashboardMetrics {
  active_clients: number
  open_demands: number
  late_demands: number
  active_blockers: number
  pending_approvals: number
  events_today: number
}
