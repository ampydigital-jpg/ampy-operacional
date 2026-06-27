import { createClient } from '@/lib/supabase/server'
import type { Client } from '@/types'

export default async function ClientesPage() {
  const supabase = createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      *,
      responsible:profiles(full_name, avatar_initials),
      services:client_services(
        id, status,
        service:service_catalog(name)
      )
    `)
    .order('name')

  const statusLabel: Record<string, { label: string; color: string; bg: string; border: string }> = {
    active: { label: 'Ativo', color: '#4CAF50', bg: '#0D180E', border: '#173520' },
    onboarding: { label: 'Onboarding', color: '#42A5F5', bg: '#0A1520', border: '#162030' },
    paused: { label: 'Pausado', color: '#444', bg: '#161616', border: '#222' },
    cancelled: { label: 'Encerrado', color: '#CC3333', bg: '#180D0D', border: '#2A1515' },
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{
        height: '56px', background: '#0C0C0C', borderBottom: '0.5px solid #1C1C1C',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px', flexShrink: 0,
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFF', flex: 1, letterSpacing: '-0.2px' }}>
          Clientes
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#141414', border: '0.5px solid #1C1C1C',
          borderRadius: '7px', padding: '0 12px', height: '32px', width: '200px',
        }}>
          <i className="ti ti-search" style={{ color: '#333', fontSize: '13px' }} />
          <input
            placeholder="Buscar cliente..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#888', fontSize: '11px', fontFamily: 'Poppins, sans-serif', width: '100%',
            }}
          />
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 14px', height: '32px', background: '#FFF',
          border: 'none', borderRadius: '7px', color: '#0C0C0C',
          fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        }}>
          <i className="ti ti-plus" style={{ fontSize: '12px' }} />
          Novo cliente
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFF', letterSpacing: '-0.2px' }}>
            Todos os clientes
          </div>
          <div style={{ fontSize: '11px', color: '#2E2E2E' }}>
            {clients?.length ?? 0} cadastrados
          </div>
        </div>

        {!clients || clients.length === 0 ? (
          <div style={{
            padding: '48px', textAlign: 'center',
            background: '#101010', borderRadius: '10px', border: '0.5px solid #1C1C1C',
          }}>
            <i className="ti ti-users" style={{ fontSize: '32px', color: '#2E2E2E', display: 'block', marginBottom: '12px' }} />
            <div style={{ fontSize: '13px', color: '#444', fontWeight: 500 }}>Nenhum cliente cadastrado</div>
            <div style={{ fontSize: '11px', color: '#2E2E2E', marginTop: '4px' }}>
              Cadastre o primeiro cliente para começar.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {clients.map((client: Client) => {
              const st = statusLabel[client.status] ?? statusLabel.active
              const activeServices = client.services?.filter(s => s.status === 'active') ?? []
              return (
                <div key={client.id} style={{
                  background: '#101010', border: '0.5px solid #1C1C1C',
                  borderRadius: '10px', padding: '16px', cursor: 'pointer',
                  transition: 'border-color 0.1s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', marginBottom: '11px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 600,
                      background: client.avatar_bg, color: client.avatar_color,
                    }}>
                      {client.avatar_initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#E0E0E0', letterSpacing: '-0.1px' }}>
                        {client.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#2E2E2E', marginTop: '2px' }}>
                        {client.segment}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 500,
                      background: st.bg, color: st.color, border: `0.5px solid ${st.border}`,
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                      {st.label}
                    </span>
                  </div>

                  {activeServices.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                      {activeServices.slice(0, 4).map((s: any) => (
                        <span key={s.id} style={{
                          padding: '3px 8px', borderRadius: '5px', fontSize: '10px',
                          background: '#141414', border: '0.5px solid #1C1C1C', color: '#444',
                        }}>
                          {s.service?.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: '10px', borderTop: '0.5px solid #161616',
                  }}>
                    <div style={{ fontSize: '10px', color: '#2E2E2E' }}>
                      Resp. <span style={{ color: '#444' }}>{(client as any).responsible?.full_name ?? '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#2E2E2E' }}>
                      <i className="ti ti-checklist" style={{ fontSize: '11px' }} />
                      {activeServices.length} serviços
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
