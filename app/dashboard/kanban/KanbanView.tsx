'use client'
import { useState } from 'react'
import { createWorkItemAction, updateWorkItemStatusAction } from '@/lib/actions'

const COLS = [
  { id: 'not_started', label: 'Planejamento', color: '#26C6DA' },
  { id: 'in_progress', label: 'Captação / Produção', color: 'var(--amber)' },
  { id: 'in_review', label: 'Edição / Design', color: '#FF7043' },
  { id: 'waiting', label: 'Org. Feed / Prog.', color: '#66BB6A' },
  { id: 'awaiting_approval', label: 'Aprovação cliente', color: 'var(--purple)' },
  { id: 'approved', label: 'Em andamento', color: 'var(--green)' },
  { id: 'done', label: 'Concluído', color: 'var(--t3)' },
]

const priorityColor: Record<string, string> = { urgent: 'var(--red)', high: 'var(--amber)', normal: 'var(--t3)', low: 'var(--t4)' }

export default function KanbanView({ demands, clients, profiles }: any) {
  const [items, setItems] = useState<any[]>(demands)
  const [modal, setModal] = useState(false)
  const [defaultStatus, setDefaultStatus] = useState('not_started')
  const [dragId, setDragId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDrop(status: string) {
    if (!dragId) return
    const prev = items
    setItems(items.map(i => i.id === dragId ? { ...i, status } : i))
    const result = await updateWorkItemStatusAction(dragId, status)
    if (result.error) setItems(prev)
    setDragId(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('status', defaultStatus)
    const result = await createWorkItemAction(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Kanban</div>
        <div className="sbox"><i className="ti ti-search" /><input placeholder="Buscar demanda..." /></div>
        <button className="bpri" onClick={() => { setDefaultStatus('not_started'); setModal(true) }}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Nova demanda</button>
      </div>

      <div className="kanban-wrap">
        {COLS.map(col => {
          const colItems = items.filter(i => i.status === col.id)
          return (
            <div key={col.id} className="kcol" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(col.id)}>
              <div className="kcol-head">
                <div className="kcol-name" style={{ color: col.color }}>{col.label}</div>
                <div className="kcol-n" style={col.id === 'done' ? { background: 'var(--gbg)', color: 'var(--green)' } : {}}>{colItems.length}</div>
              </div>
              <div className="kcol-body">
                {colItems.map(d => (
                  <div key={d.id} className="kcard" draggable onDragStart={() => setDragId(d.id)} style={d.status === 'awaiting_approval' ? { borderColor: 'var(--pbr)' } : {}}>
                    <div className="kcard-title">{d.title}</div>
                    {d.client && <div className="kcard-period"><i className="ti ti-user" style={{ fontSize: '9px' }} />{d.client.name}</div>}
                    {d.final_deadline && <div className="kcard-period"><i className="ti ti-calendar" style={{ fontSize: '9px' }} />{new Date(d.final_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</div>}
                    <div className="kcard-bot">
                      <span style={{ fontSize: '9px', color: priorityColor[d.priority] }}>{d.priority}</span>
                      {d.responsible && <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--t2)' }}>{d.responsible.avatar_initials}</div>}
                    </div>
                  </div>
                ))}
                <div className="kadd" onClick={() => { setDefaultStatus(col.id); setModal(true) }}><i className="ti ti-plus" style={{ fontSize: '12px' }} />Criar</div>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Nova demanda</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="fg"><label className="fl">Título *</label><input className="fi" name="title" placeholder="Ex: PLAN CLIENTE - 08/06 A 03/07" required /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id"><option value="">Interno</option>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                  <div className="fg"><label className="fl">Tipo / Etapa</label><select className="fi" name="type"><option>Planejamento</option><option>Captação</option><option>Edição</option><option>Design</option><option>Org. Feed</option><option>Programação</option><option>Tráfego</option></select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                  <div className="fg"><label className="fl">Prioridade</label><select className="fi" name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div>
                </div>
                <div className="fg"><label className="fl">Período (ex: 08/06 a 03/07)</label><input className="fi" name="notes" placeholder="08/06 a 03/07" /></div>
                <div className="fg"><label className="fl">Prazo final</label><input className="fi" name="final_deadline" type="date" /></div>
                <div className="fg"><label className="fl">Link Drive</label><input className="fi" name="drive_link" placeholder="https://drive.google.com/..." /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--rbg)', border: '0.5px solid var(--rbr)', borderRadius: 'var(--r)', color: 'var(--red)', fontSize: '11px' }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
