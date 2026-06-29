import { createClient } from '@/lib/supabase/server'

export default async function AlertasPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: late }, { data: blocked }, { data: pending }] = await Promise.all([
    supabase.from('work_items').select('*, client:clients(name)').lt('final_deadline', today).not('status', 'in', '(done,cancelled,archived)').order('final_deadline').limit(20),
    supabase.from('work_items').select('*, client:clients(name)').eq('status', 'blocked').order('updated_at', { ascending: false }).limit(20),
    Promise.resolve({ data: [] }),
  ])

  return (
    <div className="page-wrap">
      <div className="topbar"><div className="tb-title">Alertas</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Atrasadas</div><div className="metric-val" style={{ color: (late?.length ?? 0) > 0 ? 'var(--red)' : 'var(--w)' }}>{late?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--red)' }} />Com atraso</div></div>
          <div className="metric"><div className="metric-lbl">Bloqueadas</div><div className="metric-val" style={{ color: (blocked?.length ?? 0) > 0 ? 'var(--amber)' : 'var(--w)' }}>{blocked?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--amber)' }} />Aguardando</div></div>
          <div className="metric"><div className="metric-lbl">Aprovações</div><div className="metric-val" style={{ color: (pending?.length ?? 0) > 0 ? 'var(--purple)' : 'var(--w)' }}>{pending?.length ?? 0}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--purple)' }} />Pendentes</div></div>
          <div className="metric"><div className="metric-lbl">Total alertas</div><div className="metric-val">{(late?.length ?? 0) + (blocked?.length ?? 0) + (pending?.length ?? 0)}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Ativos</div></div>
        </div>

        {late && late.length > 0 && <>
          <div className="sh"><div className="stitle">Demandas atrasadas</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {late.map((d: any) => (
              <div key={d.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--rbr)', borderRadius: 'var(--rc)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--rbg)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}><i className="ti ti-clock" /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: '11px', fontWeight: 500, color: '#CCC' }}>{d.title}</div><div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'} · Prazo: {new Date(d.final_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</div></div>
                <span className="badge berr">Atrasada</span>
              </div>
            ))}
          </div>
        </>}

        {blocked && blocked.length > 0 && <>
          <div className="sh"><div className="stitle">Demandas bloqueadas</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {blocked.map((d: any) => (
              <div key={d.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--abr)', borderRadius: 'var(--rc)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--abg)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}><i className="ti ti-lock" /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: '11px', fontWeight: 500, color: '#CCC' }}>{d.title}</div><div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.client?.name || 'Interno'} · {d.blocked_reason || 'Motivo não informado'}</div></div>
                <span className="badge bwarn">Bloqueada</span>
              </div>
            ))}
          </div>
        </>}

        {late?.length === 0 && blocked?.length === 0 && pending?.length === 0 && (
          <div className="empty"><i className="ti ti-circle-check" /><div className="empty-title" style={{ color: 'var(--green)' }}>Tudo em dia!</div><div className="empty-sub">Nenhum alerta ativo no momento.</div></div>
        )}
      </div>
    </div>
  )
}
