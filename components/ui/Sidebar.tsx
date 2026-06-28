'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const nav = [
  { group: 'Dashboards', items: [
    { href: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
    { href: '/dashboard/meu-dia', icon: 'ti-sun', label: 'Meu dia' },
    { href: '/dashboard/semana-equipe', icon: 'ti-calendar-week', label: 'Semana equipe' },
    { href: '/dashboard/avisos', icon: 'ti-bell', label: 'Avisos', badge: true },
  ]},
  { group: 'Operação', items: [
    { href: '/dashboard/clientes', icon: 'ti-users', label: 'Clientes' },
    { href: '/dashboard/demandas', icon: 'ti-checklist', label: 'Demandas' },
    { href: '/dashboard/kanban', icon: 'ti-layout-kanban', label: 'Kanban' },
    { href: '/dashboard/projetos', icon: 'ti-folder', label: 'Projetos' },
    { href: '/dashboard/agenda', icon: 'ti-calendar', label: 'Agenda' },
  ]},
  { group: 'Equipe', items: [
    { href: '/dashboard/chat', icon: 'ti-message-circle', label: 'Comunicação' },
    { href: '/dashboard/equipe', icon: 'ti-users-group', label: 'Equipe' },
    { href: '/dashboard/relatorios', icon: 'ti-chart-bar', label: 'Relatórios' },
  ]},
  { group: 'Sistema', items: [
    { href: '/dashboard/configuracoes', icon: 'ti-settings', label: 'Configurações' },
  ]},
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="sb">
      <div className="sb-brand">
        <div className="brand-ico">A</div>
        <div>
          <div className="brand-name">Ampy</div>
          <div className="brand-sub">Digital</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {nav.map(g => (
          <div key={g.group} className="nav-grp">
            <div className="nav-lbl">{g.group}</div>
            {g.items.map(item => (
              <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">!</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="sb-user" onClick={logout} title="Sair">
        <div className="uav" style={{ background: profile?.avatar_bg || '#1C1C1C', color: profile?.avatar_color || '#888' }}>
          {profile?.avatar_initials || 'AM'}
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--t2)' }}>{profile?.full_name || 'Usuário'}</div>
          <div style={{ fontSize: '10px', color: 'var(--t4)' }}>Sair</div>
        </div>
      </div>
    </div>
  )
}
