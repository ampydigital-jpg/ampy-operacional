'use client'
import { useState } from 'react'
import { createProjectAction } from '@/lib/actions'

const statusCfg: Record<string, any> = {
  active: { label: 'Em andamento', color: 'var(--blue)', bg: 'var(--bbg)', border: 'var(--bbr)' },
  at_risk: { label: 'Em risco', color: 'var(--amber)', bg: 'var(--abg)', border: 'var(--abr)' },
  paused: { label: 'Pausado', color: 'var(--t3)', bg: 'var(--s2)', border: 'var(--b1)' },
  done: { label: 'Concluído', color: 'var(--green)', bg: 'var(--gbg)', border: 'var(--gbr)' },
}

const typeLabels: Record<string, string> = {
  recurring: 'Recorrente', project: 'Projeto', campaign: 'Campanha', internal: 'Interno', traffic: 'Tráfego'
}

export default function ProjetosView({ projects, clients, profiles }: any) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleProj(id: string) { setOpen(o => ({ ...o, [id]: !o[id] })) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createProjectAction(new FormData(e.currentTarget))
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Projetos</div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Novo projeto</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="metrics">
          <div className="metric"><div className="metric-lbl">Total</div><div className="metric-val">{projects.length}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Cadastrados</div></div>
          <div className="metric"><div className="metric-lbl">Ativos</div><div className="metric-val">{projects.filter((p: any) => p.status === 'active').length}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--green)' }} />Em execução</div></div>
          <div className="metric"><div className="metric-lbl">Em risco</div><div className="metric-val" style={{ color: 'var(--amber)' }}>{projects.filter((p: any) => p.status === 'at_risk').length}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--amber)' }} />Atenção</div></div>
          <div className="metric"><div className="metric-lbl">Concluídos</div><div className="metric-val">{projects.filter((p: any) => p.status === 'done').length}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Finalizados</div></div>
        </div>

        {projects.length === 0 ? (
          <div className="empty"><i className="ti ti-folder" /><div className="empty-title">Nenhum projeto cadastrado</div><div className="empty-sub"><button className="bpri" onClick={() => setModal(true)} style={{ marginTop: '12px' }}>Criar primeiro projeto</button></div></div>
        ) : projects.map((p: any) => {
          const st = statusCfg[p.status] || statusCfg.active
          return (
            <div key={p.id} className="proj-card">
              <div className="proj-head" onClick={() => toggleProj(p.id)}>
                <div className="av" style={{ width: '38px', height: '38px', borderRadius: '9px', fontSize: '13px', background: p.client?.avatar_bg || 'var(--bbg)', color: p.client?.avatar_color || 'var(--blue)' }}>{p.client?.avatar_initials || p.name.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--w)', letterSpacing: '-0.2px' }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{typeLabels[p.type] || p.type} · {p.client?.name || 'Interno'} · {p.responsible?.full_name || '—'}</div>
                </div>
                <span className="badge" style={{ background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, marginRight: '10px' }}>{st.label}</span>
                {p.deadline && <span style={{ fontSize: '10px', color: 'var(--t4)', marginRight: '10px' }}>{new Date(p.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                <i className={`ti ti-chevron-down proj-tog ${open[p.id] ? 'open' : ''}`} />
              </div>
              <div className={`proj-body ${open[p.id] ? 'open' : ''}`}>
                {p.description && <div style={{ fontSize: '11px', color: 'var(--t3)', padding: '12px 0 8px', lineHeight: 1.6 }}>{p.description}</div>}
                {p.drive_folder_url && (
                  <a href={p.drive_folder_url} target="_blank" rel="noopener noreferrer" className="lrow" style={{ marginTop: '8px' }}>
                    <i className="ti ti-brand-google-drive" style={{ color: 'var(--green)', fontSize: '13px' }} />
                    <span>Pasta do projeto — Drive</span>
                    <i className="ti ti-external-link" style={{ color: 'var(--t4)', fontSize: '12px' }} />
                  </a>
                )}
                <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Cronograma</div>
                <div style={{ fontSize: '11px', color: 'var(--t4)', fontStyle: 'italic' }}>Etapas do cronograma serão adicionadas aqui. Em breve você poderá criar e gerenciar as etapas de cada projeto.</div>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Novo projeto</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="fg"><label className="fl">Nome do projeto *</label><input className="fi" name="name" placeholder="Nome do projeto..." required /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Tipo</label><select className="fi" name="type"><option value="project">Projeto</option><option value="campaign">Campanha</option><option value="internal">Interno</option><option value="recurring">Recorrente</option><option value="traffic">Tráfego</option></select></div>
                  <div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id"><option value="">Interno — Ampy</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                  <div className="fg"><label className="fl">Prazo</label><input className="fi" name="deadline" type="date" /></div>
                </div>
                <div className="fg"><label className="fl">Pasta no Drive</label><input className="fi" name="drive_folder_url" placeholder="https://drive.google.com/..." /></div>
                <div className="fg"><label className="fl">Descrição</label><textarea className="fi" name="description" placeholder="Objetivo e contexto do projeto..." /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--rbg)', border: '0.5px solid var(--rbr)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '11px' }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Criar projeto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
