import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()

  const [
    { count: activeClients },
    { count: openDemands },
    { count: lateDemands },
    { count: blockers },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('work_items').select('*', { count: 'exact', head: true }).not('status', 'in', '(done,cancelled,archived)'),
    supabase.from('work_items').select('*', { count: 'exact', head: true }).lt('final_deadline', new Date().toISOString()).not('status', 'in', '(done,cancelled,archived)'),
    supabase.from('blockers').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const metrics = [
    { label: 'Clientes ativos', value: activeClients ?? 0, color: '#4CAF50', info: 'Em operação' },
    { label: 'Demandas abertas', value: openDemands ?? 0, color: '#CC8800', info: `${lateDemands ?? 0} com atraso` },
    { label: 'Bloqueios ativos', value: blockers ?? 0, color: '#CC3333', info: 'Aguardando ação' },
    { label: 'Aprovações', value: pendingApprovals ?? 0, color: '#9575CD', info: 'Pendentes' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{
        height: '56px', background: '#0C0C0C', borderBottom: '0.5px solid #1C1C1C',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px', flexShrink: 0,
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFF', flex: 1, letterSpacing: '-0.2px' }}>
          Dashboard
        </div>
        <div style={{ fontSize: '11px', color: '#2E2E2E' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {(lateDemands ?? 0) > 0 || (blockers ?? 0) > 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '9px',
            padding: '9px 13px', background: '#181200', border: '0.5px solid #2A2000',
            borderRadius: '8px', marginBottom: '18px',
          }}>
            <i className="ti ti-alert-triangle" style={{ color: '#CC8800', fontSize: '13px' }} />
            <span style={{ fontSize: '11px', color: '#886600' }}>
              {lateDemands} entrega(s) atrasada(s) · {pendingApprovals} aprovação(ões) pendente(s) · {blockers} bloqueio(s) ativo(s)
            </span>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
          {metrics.map(m => (
            <div key={m.label} style={{
              background: '#101010', border: '0.5px solid #1C1C1C',
              borderRadius: '10px', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 600, color: '#2E2E2E', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: m.color, lineHeight: 1, letterSpacing: '-0.5px' }}>
                {m.value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '10px', color: '#2E2E2E' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                {m.info}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '12px', color: '#3A3A3A', padding: '40px', textAlign: 'center', background: '#101010', borderRadius: '10px', border: '0.5px solid #1C1C1C' }}>
          Dashboard completo com alertas, performance por serviço e carga de equipe em desenvolvimento.
        </div>
      </div>
    </div>
  )
}
