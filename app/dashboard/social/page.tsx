export default function SocialPage() {
  return (
    <div className="page-wrap">
      <div className="topbar"><div className="tb-title">Social media</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Clientes social</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />A configurar</div></div>
          <div className="metric"><div className="metric-lbl">Posts semana</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Planejados</div></div>
          <div className="metric"><div className="metric-lbl">Aprovações</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Pendentes</div></div>
          <div className="metric"><div className="metric-lbl">Publicados</div><div className="metric-val">—</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Esta semana</div></div>
        </div>
        <div className="empty"><i className="ti ti-photo" /><div className="empty-title">Social media</div><div className="empty-sub">Gerencie as demandas de social media pelo Kanban. O calendário editorial completo estará disponível na próxima fase.</div></div>
      </div>
    </div>
  )
}
