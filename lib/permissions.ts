import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types'

export const MANAGER_ROLES: UserRole[] = ['admin', 'director', 'manager', 'team_lead']
export const ADMIN_ROLES: UserRole[] = ['admin', 'director']

export function isManager(role?: string | null) {
  return !!role && MANAGER_ROLES.includes(role as UserRole)
}

export function isAdmin(role?: string | null) {
  return !!role && ADMIN_ROLES.includes(role as UserRole)
}

export function isActiveProfile(profile?: Pick<Profile, 'is_active'> | null) {
  return !!profile && profile.is_active !== false
}

export async function getCurrentProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null as Profile | null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return { supabase, user, profile: profile as Profile | null }
}

export function forbidden(message = 'Você não possui permissão para esta ação.') {
  return { error: message }
}
