import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import MinhaContaView from './MinhaContaView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MinhaContaPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminSupabase = createAdminClient()

  const [
    profileResult,
    memberResult,
  ] = await Promise.all([
    adminSupabase
      .from('profiles')
      .select('full_name,email,job_title')
      .eq('id', user.id)
      .single(),

    adminSupabase
      .from('team_members')
      .select(
        'access_type,operational_area,must_change_password,last_password_change_at',
      )
      .eq('profile_id', user.id)
      .maybeSingle(),
  ])

  const profile = profileResult.data
  const member = memberResult.data

  if (!profile) {
    redirect('/login')
  }

  return (
    <MinhaContaView
      account={{
        full_name: profile.full_name,
        email: profile.email,
        job_title: profile.job_title,
        access_type: member?.access_type || 'operacional',
        operational_area: member?.operational_area || '',
        must_change_password:
          member?.must_change_password || false,
        last_password_change_at:
          member?.last_password_change_at || null,
      }}
    />
  )
}
