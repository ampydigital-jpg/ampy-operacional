'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { updateWorkItemStatusAction } from '@/lib/actions'

const columns = [
  { id:'not_started', label:'Planejamento', color:'#06B6D4' },
  { id:'in_progress', label:'Em andamento', color:'#F59E0B' },
  { id:'in_review', label:'Em revisão', color:'#F97316' },
  { id:'waiting', label:'Aguardando', color:'#8B5CF6' },
  { id:'blocked', label:'Bloqueada', color:'#EF4444' },
  { id:'awaiting_approval', label:'Aprovação', color:'#A855F7' },
  { id:'approved', label:'Aprovada', color:'#22C55E' },
  { id:'scheduled', label:'Programada', color:'#3B82F6' },
  { id:'delivered', label:'Entregue', color:'#16A34A' },
  { id:'done', label:'Concluída', color:'#555' },
]
const priorityColor: Record<string,string> = { urgent:'var(--err)', high:'var(--warn)', normal:'var(--blue)', low:'var(--t4)' }

export default function KanbanView({ demands, clients, profiles, loadErrors = [] }: any) {
  const safeDemands = Array.isArray(demands) ? demands.filter(Boolean) : []
  const safeClients = Array.isArray(clients) ? clients.filter(Boolean) : []
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : []
  const safeLoadErrors = Array.isArray(loadErrors) ? loadErrors.filter(Boolean) : []
  const [items, setItems] = useState(safeDemands)
  const [dragId, setDragId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState('all')
  const [responsibleId, setResponsibleId] = useState('all')
  const wrapRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => items.filter((item:any) => (!query || item.title.toLowerCase().includes(query.toLowerCase()) || item.client?.name?.toLowerCase().includes(query.toLowerCase())) && (clientId === 'all' || item.client_id === clientId) && (responsibleId === 'all' || item.responsible_id === responsibleId)), [items,query,clientId,responsibleId])

  function panStart(event: React.MouseEvent) {
    const el = wrapRef.current; if (!el || (event.target as HTMLElement).closest('a,button,select,input')) return
    const x = event.pageX - el.offsetLeft; const start = el.scrollLeft
    const move = (next: MouseEvent) => { el.scrollLeft = start - (next.pageX - el.offsetLeft - x) }
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }
  async function drop(status: string) {
    if (!dragId) return
    const before = items; setItems((all:any[]) => all.map((item) => item.id === dragId ? { ...item, status } : item))
    const result = await updateWorkItemStatusAction(dragId, status)
    if ('error' in result) { setItems(before); alert(result.error) }
    setDragId(null)
  }

  return <div className="page-wrap ops-page">
    <div className="topbar"><div className="tb-title">Quadro</div><div className="sbox"><i className="ti ti-search"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar demanda..."/></div><Link className="bpri" href="/dashboard/demandas"><i className="ti ti-plus"/> Nova demanda</Link></div>
    <div className="board-toolbar"><select className="fi compact" value={clientId} onChange={(e)=>setClientId(e.target.value)}><option value="all">Todos os clientes</option>{safeClients.map((client:any)=><option key={client.id} value={client.id}>{client.name}</option>)}</select><select className="fi compact" value={responsibleId} onChange={(e)=>setResponsibleId(e.target.value)}><option value="all">Todos responsáveis</option>{safeProfiles.map((profile:any)=><option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select><span className="board-hint">Arraste cards entre colunas para mudar o status. A criação acontece apenas em Demandas.</span></div>
    {safeLoadErrors.length > 0 && <div className="notice notice-err" style={{ margin:'10px 20px' }}><i className="ti ti-alert-circle" /><span>{safeLoadErrors.join(' | ')}</span></div>}
    <div ref={wrapRef} onMouseDown={panStart} className="kanban-wrap">
      {columns.map((column) => {
        const cards = filtered.filter((item:any) => item.status === column.id)
        return <section className="kcol" key={column.id} onDragOver={(event)=>event.preventDefault()} onDrop={()=>drop(column.id)}>
          <header className="kcol-head"><span className="kcol-name" style={{color:column.color}}>{column.label}</span><span className="kcol-n" style={{background:`${column.color}1e`,color:column.color}}>{cards.length}</span></header>
          <div className="kcol-body">{cards.map((item:any) => <article draggable className="kcard" key={item.id} onDragStart={()=>setDragId(item.id)} onDragEnd={()=>setDragId(null)} style={{borderLeft:`3px solid ${priorityColor[item.priority] || 'var(--b2)'}`, opacity:dragId === item.id ? .5 : 1}}>
            <Link href={`/dashboard/demandas/${item.id}`} className="kcard-title">{item.title}</Link>
            <div className="kcard-period">{item.client?.name || 'Interno Ampy'}</div>
            {item.final_deadline && <div className={`kcard-period ${item.final_deadline < new Date().toISOString().slice(0,10) && item.status !== 'done' ? 'late' : ''}`}><i className="ti ti-calendar"/> {new Date(`${item.final_deadline}T00:00:00`).toLocaleDateString('pt-BR')}</div>}
            <footer className="kcard-bot"><span className="priority-label" style={{color:priorityColor[item.priority]}}>{item.priority === 'urgent' ? 'Urgente' : item.priority === 'high' ? 'Alta' : item.priority === 'low' ? 'Baixa' : 'Normal'}</span>{item.responsible && <span className="mini-avatar">{item.responsible.avatar_initials}</span>}</footer>
          </article>)}{cards.length===0 && <div className="board-empty">Solte aqui</div>}</div>
        </section>
      })}
    </div>
  </div>
}
