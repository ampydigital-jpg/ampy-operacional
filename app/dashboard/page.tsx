import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: activeClients },
    { count: openDemands },
    { count: lateDemands },
    { count: blockers },
    { count: pendingApprovals },
    { data: todayDemands },
    { data: recentClients },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('work_items').select('*', { count: 'exact', head: true }).not('status', 'in', '(done,cancelled,archived)'),
    supabase.from('work_items').select('*', { count: 'exact', head: true }).lt('final_deadline', today).not('status', 'in', '(done,cancelled,archived)'),
    supabase.from('blockers').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('work_items').select('*, client:clients(name, avatar_initials, avatar_color, avatar_bg), responsible:profiles(full_name, avatar_initials)').eq('final_deadline', today).not('status', 'in', '(done,cancelled,archived)').limit(8),
    supabase.from('clients').select('id, name, status, avatar_initials, avatar_color, avatar_bg').eq('status', 'active').order('created_at', { ascending: false }).limit(5),
  ])

  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const statusColor: Record<string, string> = {
    not_started: 'var(--t3)', in_progress: 'var(--blue)', waiting: 'var(--amber)',
    blocked: 'var(--red)', awaiting_approval: 'var(--purple)', done: 'var(--green)',
  }
  const priorityColor: Record<string, string> = { urgent: 'var(--red)', high: 'var(--amber)', normal: 'var(--t3)', low: 'var(--t4)' }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Dashboard</div>
        <div className="tb-sub">{dateStr}</div>
        <Link href="/dashboard/demandas/nova" className="bpri"><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Nova demanda</Link>
      </div>
      <div className="pad" style={{ overflowY: 'auto', flex: 1 }}>
        {(lateDemands ?? 0) > 0 && (
          <div className="notice"><i className="ti ti-alert-triangle" /><span>{lateDemands} entrega(s) atrasada(s) · {pendingApprovals} aprovação(ões) pendente(s)</span></div>
        )}
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Clientes ativos</div><div className="metric-val">{activeClients ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--green)' }} />Em operação</div></div>
          <div className="metric"><div className="metric-lbl">Demandas abertas</div><div className="metric-val">{openDemands ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--amber)' }} />{lateDemands ?? 0} com atraso</div></div>
          <div className="metric"><div className="metric-lbl">Bloqueios</div><div className="metric-val" style={{ color: (blockers ?? 0) > 0 ? 'var(--red)' : 'var(--w)' }}>{blockers ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--red)' }} />Aguardando ação</div></div>
          <div className="metric"><div className="metric-lbl">Aprovações</div><div className="metric-val" style={{ color: (pendingApprovals ?? 0) > 0 ? 'var(--amber)' : 'var(--w)' }}>{pendingApprovals ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--purple)' }} />Pendentes</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '12px' }}>
          <div>
            <div className="sh"><div className="stitle">Demandas de hoje</div><div className="ssub">{todayDemands?.length ?? 0} itens</div></div>
            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', overflow: 'hidden' }}>
              {!todayDemands || todayDemands.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t4)', fontSize: '12px' }}>Nenhuma demanda para hoje. <Link href="/dashboard/demandas/nova" style={{ color: 'var(--blue)' }}>Criar demanda</Link></div>
              ) : todayDemands.map((d: any) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '0.5px solid #141414' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColor[d.priority] || 'var(--t3)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#CCC' }}>{d.title}</div>
                    <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'}</div>
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'var(--s2)', color: 'var(--t3)' }}>{d.status?.replace(/_/g, ' ')}</span>
                  {d.responsible && (
                    <div style={{ width: '22px', height: '22px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600, background: 'var(--s3)', color: 'var(--t2)', flexShrink: 0 }}>{d.responsible.avatar_initials}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="sh"><div className="stitle">Clientes recentes</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {!recentClients || recentClients.length === 0 ? (
                <div className="empty"><i className="ti ti-users" /><div className="empty-title">Nenhum cliente</div><div className="empty-sub"><Link href="/dashboard/clientes/novo" style={{ color: 'var(--blue)' }}>Cadastrar primeiro cliente</Link></div></div>
              ) : recentClients.map((c: any) => (
                <Link key={c.id} href={`/dashboard/clientes/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', textDecoration: 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: c.avatar_bg, color: c.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>{c.avatar_initials}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: '11px', fontWeight: 500, color: '#CCC' }}>{c.name}</div></div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.status === 'active' ? 'var(--green)' : 'var(--t3)' }} />
                </Link>
              ))}
              <Link href="/dashboard/clientes" style={{ fontSize: '11px', color: 'var(--blue)', textAlign: 'center', padding: '8px' }}>Ver todos os clientes →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
