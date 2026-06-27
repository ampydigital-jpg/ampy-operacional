'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

interface Props {
  profile: Profile | null
}

const navGroups = [
  {
    label: 'Visão geral',
    items: [
      { href: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
      { href: '/dashboard/semana', icon: 'ti-calendar-week', label: 'Minha semana' },
      { href: '/dashboard/alertas', icon: 'ti-bell', label: 'Alertas', badge: true },
    ],
  },
  {
    label: 'Operação',
    items: [
      { href: '/dashboard/clientes', icon: 'ti-users', label: 'Clientes' },
      { href: '/dashboard/demandas', icon: 'ti-checklist', label: 'Demandas' },
      { href: '/dashboard/kanban', icon: 'ti-layout-kanban', label: 'Kanban' },
      { href: '/dashboard/projetos', icon: 'ti-folder', label: 'Projetos' },
      { href: '/dashboard/agenda', icon: 'ti-calendar', label: 'Agenda' },
    ],
  },
  {
    label: 'Serviços',
    items: [
      { href: '/dashboard/trafego', icon: 'ti-speakerphone', label: 'Tráfego' },
      { href: '/dashboard/social', icon: 'ti-photo', label: 'Social media' },
      { href: '/dashboard/relatorios', icon: 'ti-chart-bar', label: 'Relatórios' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/dashboard/equipe', icon: 'ti-users-group', label: 'Equipe' },
      { href: '/dashboard/configuracoes', icon: 'ti-settings', label: 'Configurações' },
    ],
  },
]

export default function Sidebar({ profile }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      width: '216px', minWidth: '216px',
      background: '#101010',
      borderRight: '0.5px solid #1C1C1C',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        height: '56px', display: 'flex', alignItems: 'center',
        padding: '0 18px', borderBottom: '0.5px solid #1C1C1C', gap: '10px', flexShrink: 0,
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: '#1C1C1C', border: '0.5px solid #2A2A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#666', fontSize: '12px', fontWeight: 600, flexShrink: 0,
        }}>A</div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFF', letterSpacing: '-0.2px' }}>Ampy</div>
          <div style={{ fontSize: '10px', fontWeight: 300, color: '#2E2E2E', letterSpacing: '0.5px' }}>Digital</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {navGroups.map(group => (
          <div key={group.label} style={{ padding: '18px 10px 2px' }}>
            <div style={{
              fontSize: '9px', fontWeight: 600, color: '#2E2E2E',
              letterSpacing: '1.8px', textTransform: 'uppercase',
              padding: '0 8px', marginBottom: '3px',
            }}>{group.label}</div>
            {group.items.map(item => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  padding: '8px 10px', borderRadius: '7px',
                  color: isActive ? '#EFEFEF' : '#555',
                  background: isActive ? '#1A1A1A' : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                  fontSize: '12px', textDecoration: 'none',
                  transition: 'background 0.1s, color 0.1s',
                }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: '15px', width: '16px' }} />
                  {item.label}
                  {item.badge && (
                    <span style={{
                      marginLeft: 'auto', background: '#2A1010', color: '#CC3333',
                      fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '10px',
                    }}>!</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{
        padding: '14px', borderTop: '0.5px solid #1C1C1C',
        display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0,
        cursor: 'pointer',
      }} onClick={handleLogout} title="Sair">
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: '#1C1C1C', border: '0.5px solid #2A2A2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 500,
          color: profile?.avatar_color ?? '#666',
          backgroundColor: profile?.avatar_bg ?? '#1C1C1C',
          flexShrink: 0,
        }}>
          {profile?.avatar_initials ?? 'AM'}
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 500, color: '#888' }}>
            {profile?.full_name ?? 'Usuário'}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 300, color: '#3A3A3A' }}>
            {profile?.role ?? 'Ampy Digital'}
          </div>
        </div>
      </div>
    </div>
  )
}
