'use client'
import { useState } from 'react'
import { createWorkItemAction } from '@/lib/actions'

const statusCfg: Record<string, any> = {
  not_started: { label: 'Não iniciada', color: 'var(--t3)', bg: 'var(--s2)', border: 'var(--b1)' },
  in_progress: { label: 'Em andamento', color: 'var(--blue)', bg: 'var(--bbg)', border: 'var(--bbr)' },
  waiting: { label: 'Aguardando', color: 'var(--amber)', bg: 'var(--abg)', border: 'var(--abr)' },
  blocked: { label: 'Bloqueada', color: 'var(--red)', bg: 'var(--rbg)', border: 'var(--rbr)' },
  in_review: { label: 'Em revisão', color: 'var(--amber)', bg: 'var(--abg)', border: 'var(--abr)' },
  awaiting_approval: { label: 'Ag. aprovação', color: 'var(--purple)', bg: 'var(--pbg)', border: 'var(--pbr)' },
  approved: { label: 'Aprovada', color: 'var(--green)', bg: 'var(--gbg)', border: 'var(--gbr)' },
  done: { label: 'Concluída', color: 'var(--green)', bg: 'var(--gbg)', border: 'var(--gbr)' },
  cancelled: { label: 'Cancelada', color: 'var(--t3)', bg: 'var(--s2)', border: 'var(--b1)' },
}
const priorityColor: Record<string, string> = { urgent: 'var(--red)', high: 'var(--amber)', normal: 'var(--t3)', low: 'var(--t4)' }
const typeOptions = ['Planejamento','Captação','Edição','Design','Org. Feed','Programação','Tráfego','Relatório','Reunião','Interno']
const originOptions = [['planned','Planejado'],['recurring','Recorrente'],['extra','Extra'],['urgent','Urgente'],['internal','Interno']]

export default function DemandasView({ demands, clients, profiles }: any) {
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const filtered = demands.filter((d: any) => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.client?.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || d.status === filter || (filter === 'late' && d.final_deadline && d.final_deadline < today && !['done','cancelled','archived'].includes(d.status))
    return matchSearch && matchFilter
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createWorkItemAction(new FormData(e.currentTarget))
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Demandas</div>
        <div className="sbox"><i className="ti ti-search" /><input placeholder="Buscar demanda ou cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Nova demanda</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="filters">
          {[['all','Todas'],['in_progress','Em andamento'],['blocked','Bloqueadas'],['awaiting_approval','Ag. aprovação'],['late','Atrasadas'],['done','Concluídas']].map(([v,l]) => (
            <button key={v} className={`fb ${filter === v ? 'on' : ''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty"><i className="ti ti-checklist" /><div className="empty-title">Nenhuma demanda encontrada</div><div className="empty-sub"><button className="bpri" onClick={() => setModal(true)} style={{ marginTop: '12px' }}>Criar primeira demanda</button></div></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['','Demanda','Cliente','Responsável','Prazo','Status','Prioridade'].map(h => (
                <th key={h} style={{ fontSize: '9px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '8px 12px', borderBottom: '0.5px solid var(--b1)', textAlign: 'left', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 1 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const st = statusCfg[d.status] || statusCfg.not_started
                const isLate = d.final_deadline && d.final_deadline < today && !['done','cancelled'].includes(d.status)
                return (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColor[d.priority], margin: '0 auto' }} /></td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#CCC' }}>{d.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.type}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      {d.client ? <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><div style={{ width: '22px', height: '22px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600, background: d.client.avatar_bg, color: d.client.avatar_color }}>{d.client.avatar_initials}</div><span style={{ fontSize: '11px', color: '#AAA' }}>{d.client.name}</span></div> : <span style={{ fontSize: '11px', color: 'var(--t3)' }}>Interno</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      {d.responsible ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--t2)' }}>{d.responsible.avatar_initials}</div><span style={{ fontSize: '11px', color: '#888' }}>{d.responsible.full_name}</span></div> : <span style={{ fontSize: '11px', color: 'var(--t3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: isLate ? 'var(--red)' : '#888' }}>{d.final_deadline ? new Date(d.final_deadline + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span className="badge" style={{ background: st.bg, color: st.color, border: `0.5px solid ${st.border}` }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'var(--s2)', color: priorityColor[d.priority], border: '0.5px solid var(--b1)' }}>{d.priority}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Nova demanda</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="fg"><label className="fl">Título *</label><input className="fi" name="title" placeholder="Descreva a demanda..." required /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id"><option value="">Interno — Ampy</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                  <div className="fg"><label className="fl">Tipo</label><select className="fi" name="type">{typeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                  <div className="fg"><label className="fl">Prioridade</label><select className="fi" name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baixa</option></select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Prazo interno</label><input className="fi" name="internal_deadline" type="date" /></div>
                  <div className="fg"><label className="fl">Prazo final</label><input className="fi" name="final_deadline" type="date" /></div>
                </div>
                <div className="fg"><label className="fl">Origem</label><select className="fi" name="origin">{originOptions.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="fg"><label className="fl">Link Drive</label><input className="fi" name="drive_link" placeholder="https://drive.google.com/..." /></div>
                <div className="fg"><label className="fl">Descrição / contexto</label><textarea className="fi" name="description" placeholder="Detalhes, contexto, referências..." /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--rbg)', border: '0.5px solid var(--rbr)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '11px' }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Criar demanda'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
