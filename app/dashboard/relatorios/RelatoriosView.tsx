'use client'
import { useState } from 'react'

export default function RelatoriosView({ clients }: any) {
  const [selected, setSelected] = useState<any>(null)
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
  })

  if (selected) {
    const activeServices = selected.services?.filter((s: any) => s.status === 'active') || []
    return (
      <div className="page-wrap">
        <div className="topbar" style={{ display: 'flex' }}>
          <div className="tb-title">Relatório — {selected.name}</div>
          <button className="bsec" onClick={() => setSelected(null)}>← Voltar</button>
          <button className="bpri" onClick={() => window.print()}><i className="ti ti-printer" style={{ fontSize: '12px' }} /> Imprimir / PDF</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} id="relatorio-print">
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '0.5px solid var(--b1)' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--w)', letterSpacing: '-0.3px' }}>Ampy Digital</div>
                <div style={{ fontSize: '11px', color: 'var(--t4)', marginTop: '2px' }}>Relatório Operacional Mensal</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--w)' }}>{selected.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--t4)', marginTop: '2px' }}>{period}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Informações gerais</div>
              {[['Responsável', selected.responsible?.full_name || '—'], ['Período', period], ['Segmento', selected.segment || '—'], ['Contato', selected.main_contact_email || '—']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #141414' }}>
                  <span style={{ fontSize: '11px', color: 'var(--t2)' }}>{k}</span>
                  <span style={{ fontSize: '11px', color: 'var(--t1)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Serviços ativos</div>
              {activeServices.length === 0 ? <div style={{ fontSize: '11px', color: 'var(--t4)' }}>Nenhum serviço ativo</div> : activeServices.map((s: any) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #141414' }}>
                  <span style={{ fontSize: '11px', color: 'var(--t2)' }}>{s.service?.name}</span>
                  <span className="badge bok">Ativo</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Observações do período</div>
              <textarea style={{ width: '100%', minHeight: '100px', background: 'var(--s2)', border: '0.5px solid var(--b2)', borderRadius: 'var(--r)', color: 'var(--t1)', fontSize: '12px', padding: '10px 12px', fontFamily: 'Poppins, sans-serif', outline: 'none', resize: 'vertical' }} placeholder="Adicione observações, resultados e próximos passos..." />
            </div>

            {selected.drive_folder_url && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Materiais</div>
                <a href={selected.drive_folder_url} target="_blank" rel="noopener noreferrer" className="lrow">
                  <i className="ti ti-brand-google-drive" style={{ color: 'var(--green)', fontSize: '13px' }} />
                  <span>Pasta do cliente — Drive</span>
                  <i className="ti ti-external-link" style={{ color: 'var(--t4)', fontSize: '12px' }} />
                </a>
              </div>
            )}
          </div>
        </div>
        <style>{`@media print { .topbar, .sb { display: none !important; } .page-wrap { overflow: visible !important; } body { background: white; color: black; } }`}</style>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="topbar"><div className="tb-title">Relatórios</div></div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="sh"><div className="stitle">Selecione um cliente para gerar o relatório</div></div>
        {clients.length === 0 ? (
          <div className="empty"><i className="ti ti-chart-bar" /><div className="empty-title">Nenhum cliente ativo</div><div className="empty-sub">Cadastre clientes para gerar relatórios</div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clients.map((c: any) => {
              const activeServices = c.services?.filter((s: any) => s.status === 'active') || []
              return (
                <div key={c.id} onClick={() => setSelected(c)} style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'border-color .1s' }} onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--b2)')} onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--b1)')}>
                  <div className="av" style={{ width: '36px', height: '36px', fontSize: '12px', background: c.avatar_bg, color: c.avatar_color, flexShrink: 0 }}>{c.avatar_initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#CCC' }}>{c.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{activeServices.map((s: any) => s.service?.name).join(' · ') || 'Sem serviços ativos'}</div>
                  </div>
                  <span className="badge bok">Gerar relatório →</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
