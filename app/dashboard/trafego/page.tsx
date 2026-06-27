export default function TrafegoPage() {
  return (
    <div className="page-wrap">
      <div className="topbar"><div className="tb-title">Tráfego pago</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Campanhas ativas</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Integração futura</div></div>
          <div className="metric"><div className="metric-lbl">Clientes tráfego</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />A configurar</div></div>
          <div className="metric"><div className="metric-lbl">Meta Ads</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Fase futura</div></div>
          <div className="metric"><div className="metric-lbl">Google Ads</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Fase futura</div></div>
        </div>
        <div className="empty"><i className="ti ti-speakerphone" /><div className="empty-title">Gestão de tráfego</div><div className="empty-sub">Use o Kanban para gerenciar demandas de tráfego. Integração com Meta Ads e Google Ads na próxima fase.</div></div>
      </div>
    </div>
  )
}
