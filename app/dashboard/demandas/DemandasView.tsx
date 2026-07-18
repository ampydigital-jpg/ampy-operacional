'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createWorkItemAction, deleteWorkItemAction, updateWorkItemStatusAction } from '@/lib/actions'

const STATUS: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Não iniciada', className: 'bmut' },
  in_progress: { label: 'Em andamento', className: 'bblue' },
  waiting: { label: 'Aguardando', className: 'bwarn' },
  blocked: { label: 'Bloqueada', className: 'berr' },
  in_review: { label: 'Em revisão', className: 'bwarn' },
  awaiting_approval: { label: 'Ag. aprovação', className: 'bpurp' },
  approved: { label: 'Aprovada', className: 'bok' },
  scheduled: { label: 'Programada', className: 'bblue' },
  delivered: { label: 'Entregue', className: 'bok' },
  done: { label: 'Concluída', className: 'bok' },
  cancelled: { label: 'Cancelada', className: 'bmut' },
  archived: { label: 'Arquivada', className: 'bmut' },
}

const PROCESS_LABEL: Record<string, string> = {
  quadro: 'Quadro',
  projeto: 'Projeto',
  ambos: 'Quadro + Projeto',
  avulsa: 'Extra',
  kanban: 'Quadro',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
}

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 }
const CLOSED = ['done', 'cancelled', 'archived']
const TYPES = ['Planejamento','Captação','Edição','Design','Organização de Feed','Programação','Tráfego','Reunião','Relatório','Interno']

const today = () => new Date().toISOString().slice(0,10)
const plusDays = (days: number) => { const date = new Date(); date.setDate(date.getDate()+days); return date.toISOString().slice(0,10) }
function fmtDate(date?: string | null) { return date ? new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR') : '—' }
function processMatches(itemDestino: string | null | undefined, selected: string) {
  const value = String(itemDestino || 'quadro')
  if (selected === 'all') return true
  if (selected === 'quadro') return value === 'quadro' || value === 'kanban' || value === 'ambos'
  if (selected === 'projeto') return value === 'projeto' || value === 'ambos'
  return value === selected
}
function deadlineOf(item: any) { return item.final_deadline || item.internal_deadline || '' }

export default function DemandasView({ demands, clients, profiles, clientServices, loadErrors = [] }: any) {
  const safeDemands = Array.isArray(demands) ? demands.filter(Boolean) : []
  const safeClients = Array.isArray(clients) ? clients.filter(Boolean) : []
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : []
  const safeClientServices = Array.isArray(clientServices) ? clientServices.filter(Boolean) : []
  const safeLoadErrors = Array.isArray(loadErrors) ? loadErrors.filter(Boolean) : []

  const [items, setItems] = useState<any[]>(safeDemands)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [process, setProcess] = useState('all')
  const [clientId, setClientId] = useState('all')
  const [responsibleId, setResponsibleId] = useState('all')
  const [priority, setPriority] = useState('all')
  const [deadline, setDeadline] = useState('all')
  const [sort, setSort] = useState('deadline_asc')
  const [formClient, setFormClient] = useState('')
  const [formProcess, setFormProcess] = useState<'quadro'|'projeto'|'ambos'|'avulsa'>('avulsa')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const now = today()
    const next7 = plusDays(7)
    const list = items.filter((item) => {
      const itemDeadline = deadlineOf(item)
      const isLate = Boolean(itemDeadline && itemDeadline < now && !CLOSED.includes(item.status))
      const isOpen = !CLOSED.includes(item.status)
      const matchesSearch = !search || String(item.title || '').toLowerCase().includes(search.toLowerCase()) || String(item.client?.name || '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = status === 'all' || (status === 'open' && isOpen) || item.status === status || (status === 'late' && isLate)
      const matchesDeadline = deadline === 'all' || (deadline === 'today' && (item.final_deadline === now || item.internal_deadline === now)) || (deadline === 'late' && isLate) || (deadline === 'next7' && itemDeadline && itemDeadline >= now && itemDeadline <= next7)
      return matchesSearch && matchesStatus && matchesDeadline && processMatches(item.destino, process) && (clientId === 'all' || item.client_id === clientId) && (responsibleId === 'all' || item.responsible_id === responsibleId) && (priority === 'all' || item.priority === priority)
    })

    return [...list].sort((a, b) => {
      const da = deadlineOf(a) || '9999-12-31'
      const db = deadlineOf(b) || '9999-12-31'
      if (sort === 'az') return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')
      if (sort === 'za') return String(b.title || '').localeCompare(String(a.title || ''), 'pt-BR')
      if (sort === 'deadline_desc') return db.localeCompare(da)
      if (sort === 'priority_desc') return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0) || da.localeCompare(db)
      if (sort === 'priority_asc') return (PRIORITY_WEIGHT[a.priority] || 0) - (PRIORITY_WEIGHT[b.priority] || 0) || da.localeCompare(db)
      if (sort === 'recent') return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      if (sort === 'oldest') return String(a.created_at || '').localeCompare(String(b.created_at || ''))
      if (sort === 'status') return String(a.status || '').localeCompare(String(b.status || ''), 'pt-BR')
      return da.localeCompare(db)
    })
  }, [items, search, status, process, clientId, responsibleId, priority, deadline, sort])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    const result = await createWorkItemAction(new FormData(event.currentTarget))
    if ('error' in result) { setError(result.error || 'Erro ao criar demanda.'); setLoading(false); return }
    setOpen(false); setLoading(false); window.location.reload()
  }

  async function archive(id: string) {
    if (!confirm('Arquivar esta demanda? Ela sairá das visões operacionais, sem apagar o histórico.')) return
    const result = await deleteWorkItemAction(id)
    if (!('error' in result)) setItems((current) => current.filter((item) => item.id !== id))
  }

  async function quickStatus(id: string, next: string) {
    const current = items
    setItems((all) => all.map((item) => item.id === id ? { ...item, status: next } : item))
    const result = await updateWorkItemStatusAction(id, next)
    if ('error' in result) { setItems(current); alert(result.error) }
  }

  const activeServices = formClient ? safeClientServices.filter((item: any) => item && item.client_id === formClient) : []

  return <div className="page-wrap ops-page demands-page">
    <div className="topbar">
      <div className="tb-title">Demandas</div>
      <div className="sbox"><i className="ti ti-search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar demanda ou cliente..." /></div>
      <button className="bpri" onClick={() => { setFormProcess('avulsa'); setOpen(true) }}><i className="ti ti-plus" /> Novo Extra</button>
    </div>
    <div className="pad" style={{ overflowY:'auto', flex:1 }}>
      <div className="filters">
        {[['all','Todas'],['open','Abertas'],['in_progress','Em andamento'],['blocked','Bloqueadas'],['awaiting_approval','Ag. aprovação'],['late','Atrasadas'],['done','Concluídas']].map(([key,label]) => <button className={`fb ${status === key ? 'on' : ''}`} onClick={() => setStatus(key)} key={key}>{label}</button>)}
      </div>
      <div className="filters demand-filters">
        <select className="fi compact" value={process} onChange={(e) => setProcess(e.target.value)}><option value="all">Todos processos</option><option value="quadro">Quadro</option><option value="projeto">Projeto</option><option value="ambos">Quadro + Projeto</option><option value="avulsa">Extra</option></select>
        <select className="fi compact" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="all">Todos os clientes</option>{safeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        <select className="fi compact" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><option value="all">Todos responsáveis</option>{safeProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
        <select className="fi compact" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">Todas prioridades</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select>
        <select className="fi compact" value={deadline} onChange={(e) => setDeadline(e.target.value)}><option value="all">Todos prazos</option><option value="today">Hoje</option><option value="late">Atrasadas</option><option value="next7">Próximos 7 dias</option></select>
        <select className="fi compact" value={sort} onChange={(e) => setSort(e.target.value)}><option value="deadline_asc">Prazo: menor → maior</option><option value="deadline_desc">Prazo: maior → menor</option><option value="priority_desc">Prioridade: maior → menor</option><option value="priority_asc">Prioridade: menor → maior</option><option value="az">A–Z</option><option value="za">Z–A</option><option value="recent">Mais recentes</option><option value="oldest">Mais antigas</option><option value="status">Status</option></select>
      </div>
      {safeLoadErrors.length > 0 && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{safeLoadErrors.join(' | ')}</span></div>}
      <div className="sh"><div className="ssub">{filtered.length} demanda(s) encontrada(s)</div></div>
      {filtered.length === 0 ? <div className="empty"><i className="ti ti-checklist" /><div className="empty-title">Nenhuma demanda encontrada</div><div className="empty-sub">Crie Extras nesta tela. Demandas de Quadro e Projetos nascem dentro das respectivas abas.</div></div> :
        <div className="demand-table">
          <div className="demand-head"><span>Atividade</span><span>Cliente/serviço</span><span>Processo</span><span>Prazo</span><span>Responsável</span><span>Prioridade</span><span>Status</span><span /></div>
          {filtered.map((item) => {
            const late = deadlineOf(item) && deadlineOf(item) < today() && !CLOSED.includes(item.status)
            const statusCfg = STATUS[item.status] || STATUS.not_started
            return <div className="demand-line" key={item.id}>
              <div className="demand-line-title"><span className={`priority-dot ${item.priority}`} /><div><Link href={`/dashboard/demandas/${item.id}`} className="demand-title">{item.title}</Link><small>{item.type}</small></div></div>
              <div className="demand-cell"><b>{item.client?.name || 'Interno Ampy'}</b><small>{item.client_service?.service?.name || 'Sem serviço'}</small></div>
              <div><span className={`badge ${item.destino === 'projeto' ? 'bpurp' : item.destino === 'ambos' ? 'bwarn' : item.destino === 'avulsa' ? 'bmut' : 'bblue'}`}>{PROCESS_LABEL[item.destino] || 'Quadro'}</span></div>
              <div className={late ? 'demand-deadline late' : 'demand-deadline'}><i className="ti ti-calendar" /> {fmtDate(item.final_deadline || item.internal_deadline)}</div>
              <div className="demand-cell"><b>{item.responsible?.full_name || 'Sem responsável'}</b></div>
              <div><span className={`priority-chip priority-${item.priority}`}>{PRIORITY_LABEL[item.priority] || 'Normal'}</span></div>
              <select aria-label="Alterar status" className={`status-select ${statusCfg.className}`} value={item.status} onChange={(e) => quickStatus(item.id, e.target.value)}>
                {Object.entries(STATUS).map(([key, config]) => <option value={key} key={key}>{config.label}</option>)}
              </select>
              <button className="icon-button" title="Arquivar" onClick={() => archive(item.id)}><i className="ti ti-archive" /></button>
            </div>
          })}
        </div>}
    </div>
    {open && <div className="modal-ov" onClick={() => setOpen(false)}><div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><div><div className="modal-title">Novo Extra</div><div className="modal-sub">Demandas de Quadro e Projetos são criadas dentro das respectivas abas.</div></div><button className="mclose" onClick={() => setOpen(false)}><i className="ti ti-x" /></button></div>
      <form onSubmit={submit}><div className="modal-body">
        <div className="fg"><label className="fl">Título *</label><input className="fi" name="title" required placeholder="Ex.: Conteúdos de Julho — Cliente X" /></div>
        <input type="hidden" name="destino" value={formProcess} /><div className="fg"><label className="fl">Tipo</label><select className="fi" name="type">{TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
        <div className="frow"><div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id" value={formClient} onChange={(e) => setFormClient(e.target.value)}><option value="">Interno Ampy</option>{safeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div><div className="fg"><label className="fl">Serviço</label><select className="fi" name="client_service_id" disabled={!formClient}><option value="">Sem serviço específico</option>{activeServices.map((item: any) => <option key={item.id} value={item.id}>{item.service?.name || 'Serviço ativo'}</option>)}</select></div></div>
        <div className="frow"><div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Definir depois</option>{safeProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div><div className="fg"><label className="fl">Prioridade</label><select className="fi" name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baixa</option></select></div></div>
        <div className="frow"><div className="fg"><label className="fl">Prazo interno</label><input className="fi" name="internal_deadline" type="date" /></div><div className="fg"><label className="fl">Prazo final</label><input className="fi" name="final_deadline" type="date" /></div></div>
        <div className="fg"><label className="fl">Descrição</label><textarea className="fi" name="description" placeholder="Contexto, entregáveis, observações ou briefing rápido." /></div>
        <div className="fg"><label className="fl">Link Drive</label><input className="fi" name="drive_link" placeholder="https://drive.google.com/..." /></div>
        {error && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{error}</span></div>}
      </div><div className="modal-foot"><button type="button" className="bsec" onClick={() => setOpen(false)}>Cancelar</button><button className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Criar demanda'}</button></div></form>
    </div></div>}
  </div>
}
