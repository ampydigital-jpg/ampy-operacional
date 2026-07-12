import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function requireTotalAccess() {
  const authSupabase = createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminSupabase = createAdminClient()

  let accessType: string | null = null

  if (user.id) {
    const { data } = await adminSupabase
      .from('team_members')
      .select('access_type')
      .eq('profile_id', user.id)
      .maybeSingle()

    accessType = data?.access_type || null
  }

  if (!accessType && user.email) {
    const { data } = await adminSupabase
      .from('team_members')
      .select('access_type')
      .eq('email', user.email)
      .maybeSingle()

    accessType = data?.access_type || null
  }

  if (accessType !== 'total') {
    redirect('/dashboard')
  }
}

export default async function TotalAccessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireTotalAccess()

  return <>{children}</>
}
