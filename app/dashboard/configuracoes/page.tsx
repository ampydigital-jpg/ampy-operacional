import { createClient } from '@/lib/supabase/server'

function fmt(value?: string | null) {
  return value ? new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'
}
function statusLabel(status?: string | null) {
  const value = String(status || 'active')
  if (value === 'archived') return 'Arquivado'
  if (value === 'paused') return 'Pausado'
  if (value === 'inactive' || value === 'ended') return 'Inativo'
  return 'Ativo'
}

export default async function ConfiguracoesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id || '').single()
  const { count: totalClients } = await supabase.from('clients').select('*', { count: 'exact', head: true })
  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true)
  const { data: archivedClients } = await supabase
    .from('clients')
    .select('id,name,status,cidade,segment,fim_contrato,ended_at')
    .in('status', ['archived','inactive','ended'])
    .order('name')
    .limit(120)

  return (
    <div className="page-wrap ops-page settings-page">
      <div className="topbar"><div><div className="tb-title">Configurações</div><div className="tb-sub">Estrutura, arquivos operacionais e clientes fora da operação ativa</div></div></div>
      <div className="pad settings-pad">
        <div className="settings-grid">
          <ConfigCard title="Organização" rows={[['Nome', 'Ampy Digital'], ['Sistema', 'Gerenciador Operacional'], ['Clientes', String(totalClients ?? 0)], ['Usuários ativos', String(totalUsers ?? 0)]]} />
          <ConfigCard title="Meu perfil" rows={[['Nome', profile?.full_name || '—'], ['Email', profile?.email || '—'], ['Perfil', profile?.role || '—']]} />
          <ConfigCard title="Integrações" rows={[['Google Drive', 'Links ativos'], ['Agenda', 'Interna'], ['WhatsApp', 'Fase futura'], ['Meta Ads', 'Fase futura'], ['Google Ads', 'Fase futura']]} badge />
        </div>
        <section className="settings-card archived-clients-card">
          <div className="sh"><div><div className="stitle">Arquivo de clientes</div><div className="ssub">Clientes arquivados ou inativos ficam fora da operação por padrão.</div></div><span className="badge bmut">{archivedClients?.length || 0}</span></div>
          {!archivedClients?.length ? <div className="empty-inline">Nenhum cliente arquivado/inativo.</div> : <div className="archived-client-list">
            {archivedClients.map((client: any) => <div className="archived-client-row" key={client.id}><div><b>{client.name}</b><small>{client.segment || 'Sem segmento'} · {client.cidade || 'Sem cidade'}</small></div><span>{fmt(client.fim_contrato || client.ended_at)}</span><span className="badge bmut">{statusLabel(client.status)}</span></div>)}
          </div>}
        </section>
      </div>
    </div>
  )
}

function ConfigCard({ title, rows, badge = false }: { title: string; rows: string[][]; badge?: boolean }) {
  return <section className="settings-card"><div className="settings-card-title">{title}</div>{rows.map(([k, v]) => <div className="settings-row" key={k}><span>{k}</span>{badge ? <span className="badge bmut">{v}</span> : <b>{v}</b>}</div>)}</section>
}
