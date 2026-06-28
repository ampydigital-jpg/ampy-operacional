'use client'
import { useState, useRef } from 'react'
import { createWorkItemAction, updateWorkItemStatusAction, deleteWorkItemAction } from '@/lib/actions'

const DEFAULT_COLS = [
  { id: 'not_started', label: 'Planejamento', color: '#06B6D4', visible: true },
  { id: 'in_progress', label: 'Captação / Produção', color: '#F59E0B', visible: true },
  { id: 'in_review', label: 'Edição / Design', color: '#F97316', visible: true },
  { id: 'waiting', label: 'Org. Feed / Prog.', color: '#10B981', visible: true },
  { id: 'awaiting_approval', label: 'Aprovação cliente', color: '#8B5CF6', visible: true },
  { id: 'approved', label: 'Em andamento', color: '#22C55E', visible: true },
  { id: 'done', label: 'Concluído', color: '#555', visible: true },
]

const priorityColor: Record<string, string> = {
  urgent: 'var(--err)', high: 'var(--warn)', normal: 'var(--t3)', low: 'var(--t4)'
}

export default function KanbanView({ demands, clients, profiles }: any) {
  const [items, setItems] = useState<any[]>(demands)
  const [cols, setCols] = useState(DEFAULT_COLS)
  const [modal, setModal] = useState(false)
  const [configModal, setConfigModal] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState('not_started')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoTitle, setAutoTitle] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Scroll horizontal com mouse
  function handleMouseDown(e: React.MouseEvent) {
    const el = wrapRef.current
    if (!el) return
    const startX = e.pageX - el.offsetLeft
    const scrollLeft = el.scrollLeft
    const onMove = (ev: MouseEvent) => { el.scrollLeft = scrollLeft - (ev.pageX - el.offsetLeft - startX) }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Auto título
  function updateAutoTitle(clientId: string, sd: string, ed: string) {
    const client = clients.find((c: any) => c.id === clientId)
    if (!client) { setAutoTitle(''); return }
    const fmt = (d: string) => { if (!d) return ''; const [,m,day] = d.split('-'); return `${day}/${m}` }
    const name = client.name.toUpperCase().split(' ').slice(0, 3).join(' ')
    let t = `PLAN ${name}`
    if (sd) t += ` - ${fmt(sd)}`
    if (ed) t += ` A ${fmt(ed)}`
    setAutoTitle(t)
  }

  async function handleDrop(status: string) {
    if (!dragId) return
    const prev = [...items]
    setItems(items.map(i => i.id === dragId ? { ...i, status } : i))
    const result = await updateWorkItemStatusAction(dragId, status)
    if (result.error) setItems(prev)
    setDragId(null)
    setDragOver(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    if (autoTitle) fd.set('title', autoTitle)
    fd.set('status', defaultStatus)
    fd.set('start_date', startDate)
    const result = await createWorkItemAction(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    setAutoTitle('')
    setStartDate('')
    setEndDate('')
    setSelectedClient('')
    window.location.reload()
  }

  async function handleDelete(id: string) {
    if (!confirm('Arquivar esta demanda?')) return
    await deleteWorkItemAction(id)
    setItems(items.filter(i => i.id !== id))
  }

  const visibleCols = cols.filter(c => c.visible)

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Kanban</div>
        <div className="sbox"><i className="ti ti-search" /><input placeholder="Buscar demanda..." /></div>
        <button className="bsec" onClick={() => setConfigModal(true)}><i className="ti ti-settings" style={{ fontSize: '12px' }} /> Configurar</button>
        <button className="bpri" onClick={() => { setDefaultStatus('not_started'); setModal(true) }}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Nova demanda</button>
      </div>

      <div ref={wrapRef} className="kanban-wrap" onMouseDown={handleMouseDown}>
        {visibleCols.map(col => {
          const colItems = items.filter(i => i.status === col.id)
          const isDragOver = dragOver === col.id
          return (
            <div key={col.id} className="kcol"
              style={{ border: isDragOver ? `0.5px solid ${col.color}40` : undefined }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.id)}>
              <div className="kcol-head">
                <div className="kcol-name" style={{ color: col.color }}>{col.label}</div>
                <div className="kcol-n" style={{ background: `${col.color}15`, color: col.color }}>{colItems.length}</div>
              </div>
              <div className="kcol-body">
                {colItems.map(d => (
                  <div key={d.id} className="kcard"
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null) }}
                    style={{ opacity: dragId === d.id ? 0.5 : 1, borderLeft: `3px solid ${priorityColor[d.priority] || 'var(--b2)'}` }}>
                    <div className="kcard-title">{d.title}</div>
                    {d.client && <div className="kcard-period"><i className="ti ti-user" style={{ fontSize: '9px' }} />{d.client.name}</div>}
                    {d.final_deadline && (
                      <div className="kcard-period" style={{ color: new Date(d.final_deadline) < new Date() ? 'var(--err)' : 'var(--t4)' }}>
                        <i className="ti ti-calendar" style={{ fontSize: '9px' }} />
                        {new Date(d.final_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    <div className="kcard-bot">
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '9px', fontWeight: 600, color: priorityColor[d.priority] }}>{d.priority}</span>
                        <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t4)', fontSize: '11px', padding: '0' }} title="Arquivar"><i className="ti ti-archive" /></button>
                      </div>
                      {d.responsible && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--t2)', fontWeight: 600 }}>
                          {d.responsible.avatar_initials}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="kadd" onClick={() => { setDefaultStatus(col.id); setModal(true) }}>
                  <i className="ti ti-plus" style={{ fontSize: '12px' }} /> Criar
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL NOVA DEMANDA */}
      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Nova demanda</div>
              <button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>
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
                  <div className="fg">
                    <label className="fl">Data início</label>
                    <input className="fi" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); updateAutoTitle(selectedClient, e.target.value, endDate) }} />
                  </div>
                  <div className="fg">
                    <label className="fl">Data fim</label>
                    <input className="fi" name="final_deadline" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); updateAutoTitle(selectedClient, startDate, e.target.value) }} />
                  </div>
                </div>
                <div className="fg">
                  <label className="fl">Título {autoTitle ? '(gerado automaticamente)' : ''}</label>
                  <input className="fi" name="title" placeholder="Ex: PLAN CLIENTE - 08/06 A 03/07" value={autoTitle} onChange={e => setAutoTitle(e.target.value)} />
                </div>
                <div className="frow">
                  <div className="fg">
                    <label className="fl">Tipo</label>
                    <select className="fi" name="type">
                      <option>Planejamento</option><option>Captação</option><option>Edição</option>
                      <option>Design</option><option>Org. Feed</option><option>Programação</option><option>Tráfego</option>
                    </select>
                  </div>
                  <div className="fg">
                    <label className="fl">Prioridade</label>
                    <select className="fi" name="priority">
                      <option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
                <div className="fg">
                  <label className="fl">Responsável</label>
                  <select className="fi" name="responsible_id">
                    <option value="">Selecionar...</option>
                    {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Prazo interno</label>
                  <input className="fi" name="internal_deadline" type="date" />
                </div>
                <div className="fg">
                  <label className="fl">Link Drive</label>
                  <input className="fi" name="drive_link" placeholder="https://drive.google.com/..." />
                </div>
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

      {/* MODAL CONFIGURAR KANBAN */}
      {configModal && (
        <div className="modal-ov" onClick={() => setConfigModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Configurar Kanban</div>
              <button className="mclose" onClick={() => setConfigModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '11px', color: 'var(--t4)', marginBottom: '14px' }}>
                Ative ou desative colunas. Arraste para reordenar.
              </div>
              {cols.map((col, i) => (
                <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--s2)', borderRadius: 'var(--r)', marginBottom: '6px', border: '0.5px solid var(--b1)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '12px', color: col.visible ? 'var(--t1)' : 'var(--t4)' }}>{col.label}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--t3)' }}>
                    <input type="checkbox" checked={col.visible} onChange={() => setCols(cols.map((c, j) => j === i ? { ...c, visible: !c.visible } : c))} />
                    {col.visible ? 'Visível' : 'Oculta'}
                  </label>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="bsec" onClick={() => setCols(DEFAULT_COLS)}>Restaurar padrão</button>
              <button className="bpri" onClick={() => setConfigModal(false)}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
