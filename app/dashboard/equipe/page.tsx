import { createAdminClient } from '@/lib/supabase/admin'
import EquipeView from './EquipeView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EquipePage() {
  const adminSupabase = createAdminClient()

  const [
    membersResult,
    usersResult,
  ] = await Promise.all([
    adminSupabase
      .from('team_members')
      .select(
        'id,profile_id,full_name,display_name,avatar_url,email,job_title,access_type,operational_area,avatar_initials,avatar_color,avatar_bg,is_active,receives_internal_alerts,must_change_password,last_password_change_at,last_access_change_at,display_order',
      )
      .order('display_order', {
        ascending: true,
        nullsFirst: false,
      })
      .order('full_name'),

    adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    }),
  ])

  const authUsers =
    usersResult.data?.users || []

  const authById =
    new Map(
      authUsers.map((user) => [
        user.id,
        user,
      ]),
    )

  const authByEmail =
    new Map(
      authUsers
        .filter((user) => user.email)
        .map((user) => [
          String(user.email).toLowerCase(),
          user,
        ]),
    )

  const members =
    (membersResult.data || []).map((member: any) => {
      const authUser =
        (member.profile_id
          ? authById.get(member.profile_id)
          : null) ||
        authByEmail.get(
          String(member.email || '').toLowerCase(),
        ) ||
        null

      const bannedUntil =
        authUser?.banned_until
          ? new Date(authUser.banned_until)
          : null

      return {
        ...member,
        auth_status: {
          email_confirmed: Boolean(
            authUser?.email_confirmed_at,
          ),
          last_sign_in_at:
            authUser?.last_sign_in_at || null,
          banned: Boolean(
            bannedUntil &&
              !Number.isNaN(bannedUntil.getTime()) &&
              bannedUntil > new Date(),
          ),
        },
      }
    })

  const loadError =
    membersResult.error?.message ||
    usersResult.error?.message ||
    null

  return (
    <EquipeView
      members={members}
      loadError={loadError}
    />
  )
}
