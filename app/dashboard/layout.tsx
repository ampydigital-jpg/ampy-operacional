import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/ui/Sidebar'
import Toaster from '@/components/ui/Toaster'


// AMPY-V17-A22 — EQUIPE, ACESSOS E SENHAS
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()



  const { data: teamMember } = await supabase
    .from('team_members')
    .select('access_type,must_change_password')
    .eq('profile_id', user.id)
    .maybeSingle()
return (
    <div className="app">
      <Sidebar
        profile={{
          ...profile,
          access_type:
            teamMember?.access_type ||
            'operacional',
          must_change_password:
            teamMember?.must_change_password ||
            false,
        }}
      />
      <div className="main">{children}</div>
      <Toaster />
    </div>
  )
}
