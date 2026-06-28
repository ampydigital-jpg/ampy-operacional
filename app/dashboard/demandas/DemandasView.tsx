'use client'
import { useState } from 'react'
import { createWorkItemAction, deleteWorkItemAction } from '@/lib/actions'

const statusCfg: Record<string, any> = {
  not_started: { label: 'Não iniciada', color: 'var(--t3)', bg: 'var(--s2)', br: 'var(--b1)' },
  in_progress: { label: 'Em andamento', color: 'var(--blue)', bg: 'var(--blue-bg)', br: 'var(--blue-br)' },
  waiting: { label: 'Aguardando', color: 'var(--warn)', bg: 'var(--warn-bg)', br: 'var(--warn-br)' },
  blocked: { label: 'Bloqueada', color: 'var(--err)', bg: 'var(--err-bg)', br: 'var(--err-br)' },
  in_review: { label: 'Em revisão', color: 'var(--warn)', bg: 'var(--warn-bg)', br: 'var(--warn-br)' },
  awaiting_approval: { label: 'Ag. aprovação', color: 'var(--purple)', bg: 'var(--purple-bg)', br: 'var(--purple-br)' },
  approved: { label: 'Aprovada', color: 'var(--ok)', bg: 'var(--ok-bg)', br: 'var(--ok-br)' },
  done: { label: 'Concluída', color: 'var(--ok)', bg: 'var(--ok-bg)', br: 'var(--ok-br)' },
  cancelled: { label: 'Cancelada', color: 'var(--t3)', bg: 'var(--s2)', br: 'var(--b1)' },
}

const priorityColor: Record<string, string> = {
  urgent: 'var(--err)', high: 'var(--warn)', normal: 'var(--t3)', low: 'var(--t4)'
}

const typeOptions = ['Planejamento','Captação','Edição','Design','Org. Feed','Programação','Tráfego','Relatório','Reunião','Interno']

export default function DemandasView({ demands, clients, profiles }: any) {
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoTitle, setAutoTitle] = useState('')
  const [items, setItems] = useState(demands)

  const today = new Date().toISOString().split('T')[0]

  function updateAutoTitle(clientId: string, sd: string, ed: string) {
    const client = clients.find((c: any) => c.id === clientId)
    if (!client) { setAutoTitle(''); return }
    const fmt = (d: string) => { if (!d) return ''; const [,m,day] = d.split('-'); return `${day}/${m}` }
    const name = client.name.toUpperCase().split(' ').slice(0,3).join(' ')
    let t = `PLAN ${name}`
    if (sd) t += ` - ${fmt(sd)}`
    if (ed) t += ` A ${fmt(ed)}`
    setAutoTitle(t)
  }

  const filtered = items.filter((d: any) => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.client?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || d.status === statusFilter ||
      (statusFilter === 'late' && d.final_deadline && d.final_deadline < today && !['done','cancelled','archived'].includes(d.status))
    const matchPriority = priorityFilter === 'all' || d.priority === priorityFilter
    const matchDate = !dateFilter || d.final_deadline === dateFilter || d.internal_deadline === dateFilter
    return matchSearch && matchStatus && matchPriority && matchDate
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    if (autoTitle) fd.set('title', autoTitle)
    fd.set('start_date', startDate)
    const result = await createWorkItemAction(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  async function handleDelete(id: string) {
    if (!confirm('Arquivar esta demanda?')) return
    await deleteWorkItemAction(id)
    setItems(items.filter((i: any) => i.id !== id))
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Demandas</div>
        <div className="sbox"><i className="ti ti-search" /><input placeholder="Buscar demanda ou cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Nova demanda</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="filters" style={{ margin: 0 }}>
            {[['all','Todas'],['in_progress','Em andamento'],['blocked','Bloqueadas'],['awaiting_approval','Ag. aprovação'],['late','Atrasadas'],['done','Concluídas']].map(([v,l]) => (
              <button key={v} className={`fb ${statusFilter === v ? 'on' : ''}`} onClick={() => setStatusFilter(v)}>{l}</button>
            ))}
          </div>
          <select className="fi" style={{ width: '130px', height: '32px', padding: '0 10px' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="all">Prioridade</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
          </select>
          <input className="fi" type="date" style={{ width: '150px', height: '32px', padding: '0 10px' }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} title="Filtrar por data" />
          {dateFilter && <button className="bsec" onClick={() => setDateFilter('')} style={{ height: '32px', fontSize: '11px' }}>Limpar data</button>}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--t4)', marginBottom: '12px' }}>{filtered.length} demanda(s) encontrada(s)</div>

        {filtered.length === 0 ? (
          <div className="empty"><i className="ti ti-checklist" /><div className="empty-title">Nenhuma demanda encontrada</div><div className="empty-sub"><button className="bpri" onClick={() => setModal(true)} style={{ marginTop: '12px' }}>Criar primeira demanda</button></div></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['','Demanda','Cliente','Responsável','Prazo','Status','Prioridade',''].map(h => (
                <th key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '8px 12px', borderBottom: '0.5px solid var(--b1)', textAlign: 'left', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 1 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const st = statusCfg[d.status] || statusCfg.not_started
                const isLate = d.final_deadline && d.final_deadline < today && !['done','cancelled'].includes(d.status)
                return (
                  <tr key={d.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414', width: '12px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: priorityColor[d.priority], margin: '0 auto' }} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#DDD' }}>{d.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{d.type}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      {d.client ? <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><div style={{ width: '22px', height: '22px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, background: d.client.avatar_bg, color: d.client.avatar_color }}>{d.client.avatar_initials}</div><span style={{ fontSize: '11px', color: 'var(--t2)' }}>{d.client.name}</span></div> : <span style={{ fontSize: '11px', color: 'var(--t3)' }}>Interno</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      {d.responsible ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--t2)', fontWeight: 700 }}>{d.responsible.avatar_initials}</div><span style={{ fontSize: '11px', color: 'var(--t2)' }}>{d.responsible.full_name}</span></div> : <span style={{ fontSize: '11px', color: 'var(--t3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isLate ? 'var(--err)' : 'var(--t2)' }}>{d.final_deadline ? new Date(d.final_deadline + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span className="badge" style={{ background: st.bg, color: st.color, border: `0.5px solid ${st.br}` }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--s2)', color: priorityColor[d.priority], border: '0.5px solid var(--b2)' }}>{d.priority}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t4)', fontSize: '13px', padding: '4px' }} title="Arquivar"><i className="ti ti-archive" /></button>
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
                <div className="fg">
                  <label className="fl">Cliente</label>
                  <select className="fi" name="client_id" value={selectedClient} onChange={e => { setSelectedClient(e.target.value); updateAutoTitle(e.target.value, startDate, endDate) }}>
                    <option value="">Interno — Ampy</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Data início</label><input className="fi" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); updateAutoTitle(selectedClient, e.target.value, endDate) }} /></div>
                  <div className="fg"><label className="fl">Data fim (prazo final)</label><input className="fi" name="final_deadline" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); updateAutoTitle(selectedClient, startDate, e.target.value) }} /></div>
                </div>
                <div className="fg">
                  <label className="fl">Título {autoTitle ? '· gerado automaticamente' : ''}</label>
                  <input className="fi" name="title" placeholder="Ex: PLAN CLIENTE - 08/06 A 03/07" value={autoTitle} onChange={e => setAutoTitle(e.target.value)} />
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Tipo</label><select className="fi" name="type">{typeOptions.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div className="fg"><label className="fl">Prioridade</label><select className="fi" name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                  <div className="fg"><label className="fl">Prazo interno</label><input className="fi" name="internal_deadline" type="date" /></div>
                </div>
                <div className="fg"><label className="fl">Origem</label><select className="fi" name="origin"><option value="planned">Planejado</option><option value="recurring">Recorrente</option><option value="extra">Extra</option><option value="urgent">Urgente</option><option value="internal">Interno</option></select></div>
                <div className="fg"><label className="fl">Link Drive</label><input className="fi" name="drive_link" placeholder="https://drive.google.com/..." /></div>
                <div className="fg"><label className="fl">Descrição</label><textarea className="fi" name="description" placeholder="Detalhes, contexto, referências..." /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--err-bg)', border: '0.5px solid var(--err-br)', borderRadius: 'var(--r)', color: 'var(--err)', fontSize: '11px' }}>{error}</div>}
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
