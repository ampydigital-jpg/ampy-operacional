import { createClient } from '@/lib/supabase/server'

export default async function ConfiguracoesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id || '').single()
  const { count: totalClients } = await supabase.from('clients').select('*', { count: 'exact', head: true })
  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true)

  return (
    <div className="page-wrap">
      <div className="topbar"><div className="tb-title">Configurações</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>Organização</div>
            {[['Nome', 'Ampy Digital'], ['Sistema', 'Gerenciador Operacional V1'], ['Clientes', String(totalClients ?? 0)], ['Usuários ativos', String(totalUsers ?? 0)]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #141414' }}>
                <span style={{ fontSize: '11px', color: 'var(--t4)' }}>{k}</span>
                <span style={{ fontSize: '11px', color: 'var(--t2)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>Meu perfil</div>
            {[['Nome', profile?.full_name || '—'], ['Email', profile?.email || '—'], ['Perfil', profile?.role || '—']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #141414' }}>
                <span style={{ fontSize: '11px', color: 'var(--t4)' }}>{k}</span>
                <span style={{ fontSize: '11px', color: 'var(--t2)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>Integrações</div>
            {[['Google Drive', 'Links ativos'], ['Google Calendar', 'Agenda interna'], ['WhatsApp', 'Fase futura'], ['Meta Ads', 'Fase futura'], ['Google Ads', 'Fase futura']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #141414' }}>
                <span style={{ fontSize: '11px', color: 'var(--t4)' }}>{k}</span>
                <span className="badge bmut" style={{ fontSize: '9px' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
