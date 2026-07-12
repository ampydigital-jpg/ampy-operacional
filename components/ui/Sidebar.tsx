'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AvisosMenuBadge from './AvisosMenuBadge'

const groups = [
  { label: 'Dashboards', items: [
    { href: '/dashboard', label: 'Painel de Controle', icon: 'ti-layout-dashboard' },
    { href: '/dashboard/meu-dia', label: 'Dia', icon: 'ti-sun' },
    { href: '/dashboard/minha-semana', label: 'Semana', icon: 'ti-calendar-week' },
    { href: '/dashboard/mes', label: 'MÃªs', icon: 'ti-calendar-month' },
  ]},
  { label: 'OperaÃ§Ã£o', items: [
    { href: '/dashboard/clientes', label: 'Painel de Clientes', icon: 'ti-users' },
    { href: '/dashboard/demandas', label: 'Demandas', icon: 'ti-checklist' },
    { href: '/dashboard/quadro', label: 'Quadro', icon: 'ti-layout-kanban' },
    { href: '/dashboard/projetos', label: 'Projetos', icon: 'ti-route' },
    { href: '/dashboard/agenda', label: 'Agenda', icon: 'ti-calendar-event' },
    { href: '/dashboard/avisos', label: 'Avisos', icon: 'ti-bell-ringing' },
    { href: '/dashboard/feed-preview', label: 'Aprovações', icon: 'ti-grid-dots' },
  ]},
  { label: 'Equipe', items: [
    { href: '/dashboard/comunicacao', label: 'ComunicaÃ§Ã£o', icon: 'ti-message-circle' },
    { href: '/dashboard/equipe', label: 'Equipe', icon: 'ti-users-group' },
    { href: '/dashboard/relatorios', label: 'RelatÃ³rios', icon: 'ti-chart-bar' },
  ]},
  { label: 'Sistema', items: [
    { href: '/dashboard/configuracoes', label: 'ConfiguraÃ§Ãµes', icon: 'ti-settings' },
  ]},
]

export default function Sidebar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="brand-ico">A</div>
        <div><div className="brand-name">Ampy</div><div className="brand-sub">Digital</div></div>
      </div>
      <nav style={{ overflowY: 'auto', flex: 1 }}>
        {groups.map((group) => (
          <div className="nav-grp" key={group.label}>
            <div className="nav-lbl">{group.label}</div>
            {group.items.map((item) => {
              const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
              return (
                <Link href={item.href} className={`nav-item ${active ? 'active' : ''}`} key={item.href}>
                  <i className={`ti ${item.icon}`} />
                  <span>{item.label}</span>
                  {item.href === '/dashboard/avisos' && <AvisosMenuBadge />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <button className="sb-user" onClick={logout} title="Sair" type="button">
        <div className="uav" style={{ background: profile?.avatar_bg || '#1C1C1C', color: profile?.avatar_color || '#888' }}>{profile?.avatar_initials || 'AM'}</div>
        <div style={{ textAlign: 'left' }}><div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--t2)' }}>{profile?.full_name || 'UsuÃ¡rio'}</div><div style={{ fontSize: '10px', color: 'var(--t4)' }}>Sair</div></div>
      </button>
    </aside>
  )
}

