'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Não iniciada', in_progress: 'Em andamento', waiting: 'Aguardando', blocked: 'Bloqueada',
  in_review: 'Em revisão', awaiting_approval: 'Ag. aprovação', approved: 'Aprovada', scheduled: 'Programada',
  delivered: 'Entregue', done: 'Concluída', cancelled: 'Cancelada', archived: 'Arquivada',
}

function fmtDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'
}

export default function ProjetosView({ demands, clients, profiles, loadErrors = [] }: any) {
  const safeDemands = Array.isArray(demands) ? demands.filter(Boolean) : []
  const safeClients = Array.isArray(clients) ? clients.filter(Boolean) : []
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : []
  const safeLoadErrors = Array.isArray(loadErrors) ? loadErrors.filter(Boolean) : []
  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState('all')
  const [responsibleId, setResponsibleId] = useState('all')
  const [status, setStatus] = useState('all')

  const visible = useMemo(() => safeDemands.filter((item: any) => {
    const search = query.trim().toLowerCase()
    const matchesSearch = !search || String(item.title || '').toLowerCase().includes(search) || String(item.client?.name || '').toLowerCase().includes(search)
    return matchesSearch && (clientId === 'all' || item.client_id === clientId) && (responsibleId === 'all' || item.responsible_id === responsibleId) && (status === 'all' || item.status === status)
  }), [safeDemands, query, clientId, responsibleId, status])

  return <div className="page-wrap ops-page">
    <div className="topbar">
      <div className="tb-title">Projetos</div>
      <div className="tb-sub">Demandas com processo Projeto ou Quadro + Projeto</div>
      <div className="sbox"><i className="ti ti-search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar projeto..." /></div>
      <Link className="bpri" href="/dashboard/demandas"><i className="ti ti-plus" /> Nova demanda</Link>
    </div>
    <div className="board-toolbar">
      <select className="fi compact" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="all">Todos os clientes</option>{safeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
      <select className="fi compact" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><option value="all">Todos responsáveis</option>{safeProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
      <select className="fi compact" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos status</option>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <span className="board-hint">Projetos não são cópias: são Demandas com cronograma interno.</span>
    </div>
    <div className="pad" style={{ overflowY: 'auto', flex: 1 }}>
      {safeLoadErrors.length > 0 && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{safeLoadErrors.join(' | ')}</span></div>}
      <div className="sh"><div className="ssub">{visible.length} projeto(s) encontrado(s)</div></div>
      {visible.length === 0 ? <div className="empty"><i className="ti ti-route" /><div className="empty-title">Nenhuma demanda de Projeto</div><div className="empty-sub">Crie uma demanda em Demandas e selecione Projeto ou Quadro + Projeto.</div></div> : <div className="project-list project-list-dense">
        {visible.map((item: any) => {
          const total = Number(item.steps_count || 0)
          const done = Number(item.steps_done || 0)
          const progress = total > 0 ? Math.round((done / total) * 100) : 0
          return <Link href={`/dashboard/demandas/${item.id}`} className="project-card project-card-operational" key={item.id}>
            <div className="project-card-top">
              <span className="project-icon">{item.client?.avatar_initials || item.title.slice(0, 2).toUpperCase()}</span>
              <div><h3>{item.title}</h3><p>{item.client?.name || 'Interno Ampy'} · {item.type}</p></div>
              <span className="badge bpurp">Projeto</span>
            </div>
            <div className="project-progress"><div style={{ width: `${progress}%` }} /></div>
            <div className="project-card-bottom"><span>{item.responsible?.full_name || 'Sem responsável'}</span><span>{total ? `${done}/${total} etapas` : 'Sem etapas'}</span><span>{fmtDate(item.final_deadline)}</span><span>{STATUS_LABEL[item.status] || item.status}</span></div>
          </Link>
        })}
      </div>}
    </div>
  </div>
}
