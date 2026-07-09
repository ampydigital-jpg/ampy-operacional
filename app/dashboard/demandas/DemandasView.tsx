'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createWorkItemAction, deleteWorkItemAction, updateWorkItemStatusAction } from '@/lib/actions'

const STATUS: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Não iniciada', className: 'bmut' }, in_progress: { label: 'Em andamento', className: 'bblue' },
  waiting: { label: 'Aguardando', className: 'bwarn' }, blocked: { label: 'Bloqueada', className: 'berr' },
  in_review: { label: 'Em revisão', className: 'bwarn' }, awaiting_approval: { label: 'Ag. aprovação', className: 'bpurp' },
  approved: { label: 'Aprovada', className: 'bok' }, scheduled: { label: 'Programada', className: 'bblue' },
  delivered: { label: 'Entregue', className: 'bok' }, done: { label: 'Concluída', className: 'bok' },
  cancelled: { label: 'Cancelada', className: 'bmut' }, archived: { label: 'Arquivada', className: 'bmut' },
}
const PROCESS_LABEL: Record<string, string> = { quadro: 'Quadro', projeto: 'Projeto', ambos: 'Quadro + Projeto', avulsa: 'Avulsa', kanban: 'Quadro' }

const TYPES = ['Planejamento','Captação','Edição','Design','Organização de Feed','Programação','Tráfego','Reunião','Relatório','Interno']
const today = () => new Date().toISOString().slice(0,10)

function fmtDate(date?: string | null) { return date ? new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR') : '—' }

export default function DemandasView({ demands, clients, profiles, clientServices }: any) {
  const [items, setItems] = useState<any[]>(demands)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [process, setProcess] = useState('all')
  const [clientId, setClientId] = useState('all')
  const [responsibleId, setResponsibleId] = useState('all')
  const [priority, setPriority] = useState('all')
  const [formClient, setFormClient] = useState('')
  const [formProcess, setFormProcess] = useState<'quadro'|'projeto'|'ambos'|'avulsa'>('quadro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => items.filter((item) => {
    const matchesSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.client?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'all' || item.status === status || (status === 'late' && item.final_deadline && item.final_deadline < today() && !['done','cancelled'].includes(item.status))
    return matchesSearch && matchesStatus && (process === 'all' || item.destino === process || (process === 'quadro' && item.destino === 'kanban') || (process === 'quadro' && item.destino === 'ambos') || (process === 'projeto' && item.destino === 'ambos')) && (clientId === 'all' || item.client_id === clientId) && (responsibleId === 'all' || item.responsible_id === responsibleId) && (priority === 'all' || item.priority === priority)
  }), [items, search, status, process, clientId, responsibleId, priority])

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

  const activeServices = formClient ? clientServices.filter((item: any) => item.client_id === formClient) : []

  return <div className="page-wrap">
    <div className="topbar">
      <div className="tb-title">Demandas</div>
      <div className="sbox"><i className="ti ti-search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar demanda ou cliente..." /></div>
      <button className="bpri" onClick={() => setOpen(true)}><i className="ti ti-plus" /> Nova demanda</button>
    </div>
    <div className="pad" style={{ overflowY:'auto', flex:1 }}>
      <div className="filters">
        {[['all','Todas'],['in_progress','Em andamento'],['blocked','Bloqueadas'],['awaiting_approval','Ag. aprovação'],['late','Atrasadas'],['done','Concluídas']].map(([key,label]) => <button className={`fb ${status === key ? 'on' : ''}`} onClick={() => setStatus(key)} key={key}>{label}</button>)}
      </div>
      <div className="filters demand-filters">
        <select className="fi compact" value={process} onChange={(e) => setProcess(e.target.value)}><option value="all">Todos processos</option><option value="quadro">Quadro</option><option value="projeto">Projeto</option><option value="ambos">Quadro + Projeto</option><option value="avulsa">Avulsa</option></select>
        <select className="fi compact" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="all">Todos os clientes</option>{clients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        <select className="fi compact" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><option value="all">Todos responsáveis</option>{profiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
        <select className="fi compact" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">Todas prioridades</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select>
      </div>
      <div className="sh"><div className="ssub">{filtered.length} demanda(s) encontrada(s)</div></div>
      {filtered.length === 0 ? <div className="empty"><i className="ti ti-checklist" /><div className="empty-title">Nenhuma demanda encontrada</div><div className="empty-sub">Crie a atividade nesta tela. Quadro e Projetos são visualizações do mesmo registro.</div></div> :
        <div className="demand-list">
          {filtered.map((item) => {
            const late = item.final_deadline && item.final_deadline < today() && !['done','cancelled'].includes(item.status)
            const statusCfg = STATUS[item.status] || STATUS.not_started
            return <div className="demand-row" key={item.id}>
              <div className={`priority-dot ${item.priority}`} />
              <div className="demand-main"><Link href={`/dashboard/demandas/${item.id}`} className="demand-title">{item.title}</Link><div className="demand-meta">{item.type} · {item.client?.name || 'Interno Ampy'} · {item.responsible?.full_name || 'Sem responsável'}</div></div>
              <div className="demand-process"><span className={`badge ${item.destino === 'projeto' ? 'bpurp' : item.destino === 'ambos' ? 'bwarn' : item.destino === 'avulsa' ? 'bmut' : 'bblue'}`}>{PROCESS_LABEL[item.destino] || 'Quadro'}</span></div>
              <div className={late ? 'demand-deadline late' : 'demand-deadline'}><i className="ti ti-calendar" /> {fmtDate(item.final_deadline)}</div>
              <select aria-label="Alterar status" className={`status-select ${statusCfg.className}`} value={item.status} onChange={(e) => quickStatus(item.id, e.target.value)}>
                {Object.entries(STATUS).map(([key, config]) => <option value={key} key={key}>{config.label}</option>)}
              </select>
              <button className="icon-button" title="Arquivar" onClick={() => archive(item.id)}><i className="ti ti-archive" /></button>
            </div>
          })}
        </div>}
    </div>
    {open && <div className="modal-ov" onClick={() => setOpen(false)}><div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><div><div className="modal-title">Nova demanda</div><div className="modal-sub">A criação acontece apenas em Demandas. Escolha o processo que exibirá a atividade.</div></div><button className="mclose" onClick={() => setOpen(false)}><i className="ti ti-x" /></button></div>
      <form onSubmit={submit}><div className="modal-body">
        <div className="fg"><label className="fl">Título *</label><input className="fi" name="title" required placeholder="Ex.: Conteúdos de Julho — Cliente X" /></div>
        <div className="frow"><div className="fg"><label className="fl">Processo *</label><select className="fi" name="destino" value={formProcess} onChange={(e) => setFormProcess(e.target.value as 'quadro'|'projeto'|'ambos'|'avulsa')}><option value="quadro">Quadro</option><option value="projeto">Projeto / Cronograma</option><option value="ambos">Quadro + Projeto</option><option value="avulsa">Avulsa</option></select></div><div className="fg"><label className="fl">Tipo</label><select className="fi" name="type">{TYPES.map((type) => <option key={type}>{type}</option>)}</select></div></div>
        <div className="frow"><div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id" value={formClient} onChange={(e) => setFormClient(e.target.value)}><option value="">Interno — Ampy</option>{clients.map((client: any) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></div><div className="fg"><label className="fl">Serviço vinculado</label><select className="fi" name="client_service_id" disabled={!formClient}><option value="">Não vincular</option>{activeServices.map((service: any) => <option value={service.id} key={service.id}>{service.service?.name || 'Serviço'}</option>)}</select></div></div>
        <div className="frow"><div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Definir depois</option>{profiles.map((profile: any) => <option value={profile.id} key={profile.id}>{profile.full_name}</option>)}</select></div><div className="fg"><label className="fl">Prioridade</label><select className="fi" name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baixa</option></select></div></div>
        <div className="frow"><div className="fg"><label className="fl">Prazo interno</label><input className="fi" name="internal_deadline" type="date" /></div><div className="fg"><label className="fl">Prazo final</label><input className="fi" name="final_deadline" type="date" /></div></div>
        <div className="fg"><label className="fl">Link Drive</label><input className="fi" name="drive_link" type="url" placeholder="https://drive.google.com/..." /></div>
        <div className="fg"><label className="fl">Descrição / contexto</label><textarea className="fi" name="description" placeholder="Objetivo, materiais necessários, critérios de entrega..." /></div>
        {formProcess === 'quadro' && <div className="notice"><i className="ti ti-info-circle" /><span>O Quadro permite acompanhar o fluxo por status. O cronograma também poderá ser acrescentado dentro desta demanda.</span></div>}
        {error && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{error}</span></div>}
      </div><div className="modal-foot"><button type="button" className="bsec" onClick={() => setOpen(false)}>Cancelar</button><button className="bpri" disabled={loading}>{loading ? 'Criando...' : 'Criar demanda'}</button></div></form>
    </div></div>}
  </div>
}
