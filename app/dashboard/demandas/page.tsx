import { createClient } from '@/lib/supabase/server'

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  not_started: { label: 'Não iniciada', color: '#444', bg: '#161616', border: '#222' },
  in_progress: { label: 'Em andamento', color: '#42A5F5', bg: '#0A1520', border: '#162030' },
  waiting: { label: 'Aguardando', color: '#CC8800', bg: '#181200', border: '#2A2000' },
  blocked: { label: 'Bloqueada', color: '#CC3333', bg: '#180D0D', border: '#2A1515' },
  in_review: { label: 'Em revisão', color: '#CC8800', bg: '#181200', border: '#2A2000' },
  awaiting_approval: { label: 'Ag. aprovação', color: '#9575CD', bg: '#0D0A1A', border: '#1E1530' },
  approved: { label: 'Aprovada', color: '#4CAF50', bg: '#0D180E', border: '#173520' },
  done: { label: 'Concluída', color: '#4CAF50', bg: '#0D180E', border: '#173520' },
  cancelled: { label: 'Cancelada', color: '#444', bg: '#161616', border: '#222' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgente', color: '#CC3333' },
  high: { label: 'Alta', color: '#CC8800' },
  normal: { label: 'Normal', color: '#444' },
  low: { label: 'Baixa', color: '#333' },
}

export default async function DemandasPage() {
  const supabase = createClient()

  const { data: demands } = await supabase
    .from('work_items')
    .select(`
      *,
      client:clients(name, avatar_initials, avatar_color, avatar_bg),
      responsible:profiles(full_name, avatar_initials)
    `)
    .not('status', 'in', '(done,cancelled,archived)')
    .order('priority', { ascending: false })
    .order('final_deadline', { ascending: true })
    .limit(50)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{
        height: '56px', background: '#0C0C0C', borderBottom: '0.5px solid #1C1C1C',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px', flexShrink: 0,
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFF', flex: 1, letterSpacing: '-0.2px' }}>
          Demandas
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 14px', height: '32px', background: '#FFF',
          border: 'none', borderRadius: '7px', color: '#0C0C0C',
          fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        }}>
          <i className="ti ti-plus" style={{ fontSize: '12px' }} />
          Nova demanda
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        {!demands || demands.length === 0 ? (
          <div style={{
            padding: '48px', textAlign: 'center',
            background: '#101010', borderRadius: '10px', border: '0.5px solid #1C1C1C',
          }}>
            <i className="ti ti-checklist" style={{ fontSize: '32px', color: '#2E2E2E', display: 'block', marginBottom: '12px' }} />
            <div style={{ fontSize: '13px', color: '#444', fontWeight: 500 }}>Nenhuma demanda aberta</div>
            <div style={{ fontSize: '11px', color: '#2E2E2E', marginTop: '4px' }}>
              Crie a primeira demanda para começar a operar.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', 'Demanda', 'Cliente', 'Responsável', 'Prazo', 'Status', 'Prioridade'].map(h => (
                  <th key={h} style={{
                    fontSize: '9px', fontWeight: 600, color: '#2E2E2E',
                    textTransform: 'uppercase', letterSpacing: '1.5px',
                    padding: '8px 12px', borderBottom: '0.5px solid #1C1C1C',
                    textAlign: 'left', background: '#0C0C0C',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demands.map((d: any) => {
                const st = statusConfig[d.status] ?? statusConfig.not_started
                const pr = priorityConfig[d.priority] ?? priorityConfig.normal
                const isLate = d.final_deadline && new Date(d.final_deadline) < new Date()
                return (
                  <tr key={d.id} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: pr.color, margin: '0 auto',
                      }} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#CCC' }}>{d.title}</div>
                      <div style={{ fontSize: '10px', color: '#2E2E2E', marginTop: '2px' }}>{d.type}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      {d.client ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{
                            width: '22px', height: '22px', borderRadius: '5px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '8px', fontWeight: 600,
                            background: d.client.avatar_bg, color: d.client.avatar_color,
                          }}>{d.client.avatar_initials}</div>
                          <span style={{ fontSize: '11px', color: '#AAA' }}>{d.client.name}</span>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: '#333' }}>Interno</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      {d.responsible ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '22px', height: '22px', borderRadius: '5px',
                            background: '#1C1C1C', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '8px', color: '#666',
                          }}>{d.responsible.avatar_initials}</div>
                          <span style={{ fontSize: '11px', color: '#888' }}>{d.responsible.full_name}</span>
                        </div>
                      ) : <span style={{ fontSize: '11px', color: '#333' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      {d.final_deadline ? (
                        <span style={{ fontSize: '11px', fontWeight: 500, color: isLate ? '#CC3333' : '#888' }}>
                          {new Date(d.final_deadline).toLocaleDateString('pt-BR')}
                        </span>
                      ) : <span style={{ fontSize: '11px', color: '#333' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 500,
                        background: st.bg, color: st.color, border: `0.5px solid ${st.border}`,
                      }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 500,
                        background: '#161616', color: pr.color, border: '0.5px solid #222',
                      }}>{pr.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
