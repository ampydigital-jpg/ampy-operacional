import { createClient } from '@/lib/supabase/server'

export default async function AvisosPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]

  const [
    { data: late, count: lateCount },
    { data: blocked, count: blockedCount },
    { data: pending, count: pendingCount },
    { data: soon },
    { data: noResp, count: noRespCount },
  ] = await Promise.all([
    supabase.from('work_items').select('*, client:clients(name)', { count: 'exact' }).lt('final_deadline', today).not('status', 'in', '(done,cancelled,archived)').order('final_deadline').limit(15),
    supabase.from('work_items').select('*, client:clients(name)', { count: 'exact' }).eq('status', 'blocked').order('updated_at', { ascending: false }).limit(15),
    supabase.from('approvals').select('*, work_item:work_items(title, client:clients(name))', { count: 'exact' }).eq('status', 'pending').order('sent_at').limit(15),
    supabase.from('work_items').select('*, client:clients(name)').gte('final_deadline', today).lte('final_deadline', in3days).not('status', 'in', '(done,cancelled,archived)').order('final_deadline').limit(10),
    supabase.from('work_items').select('*, client:clients(name)', { count: 'exact' }).is('responsible_id', null).not('status', 'in', '(done,cancelled,archived)').limit(10),
  ])

  const total = (lateCount ?? 0) + (blockedCount ?? 0) + (pendingCount ?? 0) + (noRespCount ?? 0)

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Avisos</div>
        {total > 0 && <span className="badge berr">{total} ativos</span>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Atrasadas</div><div className="metric-val" style={{ color: (lateCount ?? 0) > 0 ? 'var(--err)' : 'var(--w)' }}>{lateCount ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--err)' }} />Com atraso</div></div>
          <div className="metric"><div className="metric-lbl">Bloqueadas</div><div className="metric-val" style={{ color: (blockedCount ?? 0) > 0 ? 'var(--warn)' : 'var(--w)' }}>{blockedCount ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--warn)' }} />Aguardando</div></div>
          <div className="metric"><div className="metric-lbl">Aprovações</div><div className="metric-val" style={{ color: (pendingCount ?? 0) > 0 ? 'var(--purple)' : 'var(--w)' }}>{pendingCount ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--purple)' }} />Pendentes</div></div>
          <div className="metric"><div className="metric-lbl">Sem responsável</div><div className="metric-val" style={{ color: (noRespCount ?? 0) > 0 ? 'var(--warn)' : 'var(--w)' }}>{noRespCount ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--warn)' }} />Precisam de atenção</div></div>
        </div>

        {total === 0 && (
          <div className="empty"><i className="ti ti-circle-check" style={{ color: 'var(--ok)' }} /><div className="empty-title" style={{ color: 'var(--ok)' }}>Tudo em dia!</div><div className="empty-sub">Nenhum aviso ativo no momento.</div></div>
        )}

        {late && late.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div className="sh"><div className="stitle" style={{ color: 'var(--err)' }}>🔴 Demandas atrasadas</div></div>
            {late.map((d: any) => (
              <div key={d.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--err-br)', borderRadius: 'var(--rc)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--err-bg)', color: 'var(--err)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}><i className="ti ti-clock" /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: '12px', fontWeight: 600, color: '#CCC' }}>{d.title}</div><div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'} · Prazo: {new Date(d.final_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</div></div>
                <span className="badge berr">Atrasada</span>
              </div>
            ))}
          </div>
        )}

        {blocked && blocked.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div className="sh"><div className="stitle" style={{ color: 'var(--warn)' }}>🟡 Demandas bloqueadas</div></div>
            {blocked.map((d: any) => (
              <div key={d.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--warn-br)', borderRadius: 'var(--rc)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--warn-bg)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}><i className="ti ti-lock" /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: '12px', fontWeight: 600, color: '#CCC' }}>{d.title}</div><div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'} · {d.blocked_reason || 'Motivo não informado'}</div></div>
                <span className="badge bwarn">Bloqueada</span>
              </div>
            ))}
          </div>
        )}

        {soon && soon.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div className="sh"><div className="stitle" style={{ color: 'var(--warn)' }}>🟡 Vencendo em até 3 dias</div></div>
            {soon.map((d: any) => (
              <div key={d.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--warn-br)', borderRadius: 'var(--rc)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--warn-bg)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}><i className="ti ti-calendar-exclamation" /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: '12px', fontWeight: 600, color: '#CCC' }}>{d.title}</div><div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'} · Prazo: {new Date(d.final_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</div></div>
                <span className="badge bwarn">Vence em breve</span>
              </div>
            ))}
          </div>
        )}

        {noResp && noResp.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div className="sh"><div className="stitle" style={{ color: 'var(--warn)' }}>🟡 Sem responsável</div></div>
            {noResp.map((d: any) => (
              <div key={d.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--warn-br)', borderRadius: 'var(--rc)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--warn-bg)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}><i className="ti ti-user-off" /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: '12px', fontWeight: 600, color: '#CCC' }}>{d.title}</div><div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'} · Sem responsável atribuído</div></div>
                <span className="badge bwarn">Sem responsável</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
