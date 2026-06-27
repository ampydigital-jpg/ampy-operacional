'use client'
import { useState } from 'react'
import { createClientAction } from '@/lib/actions'

const statusCfg: Record<string, any> = {
  active: { label: 'Ativo', color: 'var(--green)', bg: 'var(--gbg)', border: 'var(--gbr)' },
  onboarding: { label: 'Onboarding', color: 'var(--blue)', bg: 'var(--bbg)', border: 'var(--bbr)' },
  paused: { label: 'Pausado', color: 'var(--t3)', bg: 'var(--s2)', border: 'var(--b1)' },
  cancelled: { label: 'Encerrado', color: 'var(--red)', bg: 'var(--rbg)', border: 'var(--rbr)' },
}

export default function ClientsView({ clients, profiles, stats }: any) {
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = clients.filter((c: any) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const result = await createClientAction(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Clientes</div>
        <div className="sbox"><i className="ti ti-search" /><input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Novo cliente</button>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div className="metrics">
            <div className="metric"><div className="metric-lbl">Total</div><div className="metric-val">{stats.total}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--t3)' }} />Cadastrados</div></div>
            <div className="metric"><div className="metric-lbl">Ativos</div><div className="metric-val">{stats.active}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--green)' }} />Em operação</div></div>
            <div className="metric"><div className="metric-lbl">Pausados</div><div className="metric-val">{stats.paused}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--amber)' }} />Temporariamente</div></div>
            <div className="metric"><div className="metric-lbl">Serviços</div><div className="metric-val">{clients.reduce((a: number, c: any) => a + (c.services?.filter((s: any) => s.status === 'active').length || 0), 0)}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--blue)' }} />Ativos</div></div>
          </div>

          <div className="filters">
            {[['all','Todos'],['active','Ativos'],['onboarding','Onboarding'],['paused','Pausados'],['cancelled','Encerrados']].map(([v, l]) => (
              <button key={v} className={`fb ${filter === v ? 'on' : ''}`} onClick={() => setFilter(v)}>{l}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty"><i className="ti ti-users" /><div className="empty-title">Nenhum cliente encontrado</div><div className="empty-sub">Cadastre o primeiro cliente</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {filtered.map((c: any) => {
                const st = statusCfg[c.status] || statusCfg.active
                const activeServices = c.services?.filter((s: any) => s.status === 'active') || []
                return (
                  <div key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)} style={{ background: 'var(--s1)', border: `0.5px solid ${selected?.id === c.id ? 'var(--b3)' : 'var(--b1)'}`, borderRadius: 'var(--rc)', padding: '16px', cursor: 'pointer', transition: 'border-color .1s' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', marginBottom: '10px' }}>
                      <div className="av" style={{ width: '36px', height: '36px', fontSize: '12px', background: c.avatar_bg, color: c.avatar_color }}>{c.avatar_initials}</div>
                      <div><div style={{ fontSize: '12px', fontWeight: 600, color: '#E0E0E0' }}>{c.name}</div><div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{c.segment}</div></div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <span className="badge" style={{ background: st.bg, color: st.color, border: `0.5px solid ${st.border}` }}><span className="dot" style={{ background: st.color }} />{st.label}</span>
                    </div>
                    {activeServices.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                        {activeServices.slice(0, 4).map((s: any) => <span key={s.id} style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10px', background: 'var(--s2)', border: '0.5px solid var(--b1)', color: 'var(--t3)' }}>{s.service?.name}</span>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '0.5px solid #161616' }}>
                      <div style={{ fontSize: '10px', color: 'var(--t4)' }}>Resp. <span style={{ color: 'var(--t3)' }}>{c.responsible?.full_name || '—'}</span></div>
                      <div style={{ fontSize: '10px', color: 'var(--t4)', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-checklist" style={{ fontSize: '11px' }} />{activeServices.length}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {selected && (
          <div className="panel">
            <div className="panel-head">
              <div className="av" style={{ width: '38px', height: '38px', borderRadius: '9px', fontSize: '13px', background: selected.avatar_bg, color: selected.avatar_color }}>{selected.avatar_initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--w)', letterSpacing: '-0.2px' }}>{selected.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{selected.segment}</div>
                <div style={{ marginTop: '6px' }}><span className="badge bok"><span className="dot" style={{ background: 'var(--green)' }} />Ativo</span></div>
              </div>
              <div className="pclose" onClick={() => setSelected(null)}><i className="ti ti-x" /></div>
            </div>
            <div className="panel-body">
              <div className="psec">Identificação</div>
              <div className="prow"><span className="pkey">Responsável</span><span className="pval">{selected.responsible?.full_name || '—'}</span></div>
              <div className="prow"><span className="pkey">Contato</span><span className="pval" style={{ fontSize: '10px' }}>{selected.main_contact_email || '—'}</span></div>
              <div className="prow"><span className="pkey">Telefone</span><span className="pval">{selected.main_contact_phone || '—'}</span></div>
              <div className="prow"><span className="pkey">Instagram</span><span className="pval">{selected.instagram || '—'}</span></div>
              {selected.notes && <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--t3)', lineHeight: 1.5 }}>{selected.notes}</div>}

              <div className="psec">Central de links</div>
              {selected.drive_folder_url ? <a href={selected.drive_folder_url} target="_blank" rel="noopener noreferrer" className="lrow"><i className="ti ti-brand-google-drive" style={{ color: 'var(--green)', fontSize: '13px' }} /><span>Pasta principal — Drive</span><i className="ti ti-external-link" style={{ color: 'var(--t4)', fontSize: '12px' }} /></a> : <div style={{ fontSize: '11px', color: 'var(--t4)', padding: '8px 0' }}>Nenhum link cadastrado</div>}
              {selected.briefing_url && <a href={selected.briefing_url} target="_blank" rel="noopener noreferrer" className="lrow"><i className="ti ti-file-description" style={{ color: 'var(--blue)', fontSize: '13px' }} /><span>Briefing</span><i className="ti ti-external-link" style={{ color: 'var(--t4)', fontSize: '12px' }} /></a>}
              {selected.last_report_url && <a href={selected.last_report_url} target="_blank" rel="noopener noreferrer" className="lrow"><i className="ti ti-chart-line" style={{ color: 'var(--purple)', fontSize: '13px' }} /><span>Último relatório</span><i className="ti ti-external-link" style={{ color: 'var(--t4)', fontSize: '12px' }} /></a>}
            </div>
            <div className="panel-foot">
              <button className="pbsec" onClick={() => setSelected(null)}>Fechar</button>
              <button className="pbpri" onClick={() => { setSelected(null); setModal(true) }}>Nova demanda</button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Novo cliente</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="fg"><label className="fl">Nome do cliente *</label><input className="fi" name="name" placeholder="Nome da empresa..." required /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Segmento</label><input className="fi" name="segment" placeholder="Ex: Gastronomia, Saúde..." /></div>
                  <div className="fg"><label className="fl">Status</label><select className="fi" name="status"><option value="active">Ativo</option><option value="onboarding">Onboarding</option><option value="paused">Pausado</option></select></div>
                </div>
                <div className="fg"><label className="fl">Responsável principal</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                <div className="fg"><label className="fl">Nome do contato</label><input className="fi" name="main_contact_name" placeholder="Nome da pessoa de contato" /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Email de contato</label><input className="fi" name="main_contact_email" type="email" placeholder="contato@empresa.com.br" /></div>
                  <div className="fg"><label className="fl">Telefone</label><input className="fi" name="main_contact_phone" placeholder="(48) 99999-0000" /></div>
                </div>
                <div className="fg"><label className="fl">Instagram</label><input className="fi" name="instagram" placeholder="@usuario" /></div>
                <div className="fg"><label className="fl">Pasta principal no Drive</label><input className="fi" name="drive_folder_url" placeholder="https://drive.google.com/drive/folders/..." /></div>
                <div className="fg"><label className="fl">Link do briefing</label><input className="fi" name="briefing_url" placeholder="https://drive.google.com/..." /></div>
                <div className="fg"><label className="fl">Observações internas</label><textarea className="fi" name="notes" placeholder="Notas relevantes sobre o cliente..." /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--rbg)', border: '0.5px solid var(--rbr)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '11px' }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Cadastrar cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
