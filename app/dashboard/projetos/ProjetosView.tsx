'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createProjectStepAction } from '@/lib/actions'

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Não iniciada', in_progress: 'Em andamento', waiting: 'Aguardando', blocked: 'Bloqueada',
  in_review: 'Em revisão', awaiting_approval: 'Ag. aprovação', approved: 'Aprovada', scheduled: 'Programada',
  delivered: 'Entregue', done: 'Concluída', cancelled: 'Cancelada', archived: 'Arquivada',
}
const STATUS_BADGE: Record<string, string> = {
  done: 'bok', delivered: 'bok', approved: 'bok',
  not_started: 'bwarn', waiting: 'bwarn', awaiting_approval: 'bwarn', scheduled: 'bwarn',
  blocked: 'berr', cancelled: 'berr',
  in_progress: 'bblue', in_review: 'bblue', archived: 'bmut',
}

function fmtDate(value?: string | null) {
  return value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'
}
function stepDone(step: any) {
  return ['done', 'delivered', 'approved'].includes(String(step?.status || ''))
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
  const [stepTarget, setStepTarget] = useState<any | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => safeDemands.filter((item: any) => {
    const search = query.trim().toLowerCase()
    const matchesSearch = !search || String(item.title || '').toLowerCase().includes(search) || String(item.client?.name || '').toLowerCase().includes(search)
    return matchesSearch && (clientId === 'all' || item.client_id === clientId) && (responsibleId === 'all' || item.responsible_id === responsibleId) && (status === 'all' || item.status === status)
  }), [safeDemands, query, clientId, responsibleId, status])

  async function submitStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stepTarget) return
    setSaving(true)
    setError('')
    const result = await createProjectStepAction(new FormData(event.currentTarget))
    if ('error' in result) { setError(result.error || 'Erro ao criar etapa.'); setSaving(false); return }
    window.location.reload()
  }

  return <div className="page-wrap ops-page projects-page">
    <div className="topbar">
      <div><div className="tb-title">Projetos</div><div className="tb-sub">Projetos são Demandas com cronograma interno. Não há cadastro paralelo.</div></div>
      <div className="sbox"><i className="ti ti-search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar projeto..." /></div>
      <Link className="bpri" href="/dashboard/demandas"><i className="ti ti-plus" /> Nova demanda</Link>
    </div>
    <div className="board-toolbar">
      <select className="fi compact" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="all">Todos os clientes</option>{safeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
      <select className="fi compact" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><option value="all">Todos responsáveis</option>{safeProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>
      <select className="fi compact" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos status</option>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <span className="board-hint">Abra o projeto ou crie etapas diretamente pelo botão Cronograma.</span>
    </div>
    <div className="pad" style={{ overflowY: 'auto', flex: 1 }}>
      {safeLoadErrors.length > 0 && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{safeLoadErrors.join(' | ')}</span></div>}
      <div className="sh"><div className="ssub">{visible.length} projeto(s) encontrado(s)</div></div>
      {visible.length === 0 ? <div className="empty"><i className="ti ti-route" /><div className="empty-title">Nenhuma demanda de Projeto</div><div className="empty-sub">Crie uma demanda em Demandas e selecione Projeto ou Quadro + Projeto.</div></div> : <div className="project-list project-list-dense">
        {visible.map((item: any) => {
          const steps = Array.isArray(item.steps) ? item.steps : []
          const total = steps.length || Number(item.steps_count || 0)
          const done = steps.filter(stepDone).length || Number(item.steps_done || 0)
          const progress = total > 0 ? Math.round((done / total) * 100) : 0
          return <article className="project-card project-card-operational project-card-expanded" key={item.id}>
            <div className="project-card-top">
              <span className="project-icon">{item.client?.avatar_initials || item.title.slice(0, 2).toUpperCase()}</span>
              <div><Link href={`/dashboard/demandas/${item.id}`}><h3>{item.title}</h3></Link><p>{item.client?.name || 'Interno Ampy'} · {item.type}</p></div>
              <span className={`badge ${STATUS_BADGE[item.status] || 'bblue'}`}>{STATUS_LABEL[item.status] || item.status}</span>
            </div>
            <div className="project-progress"><div style={{ width: `${progress}%` }} /></div>
            <div className="project-card-bottom"><span>{item.responsible?.full_name || 'Sem responsável'}</span><span>{total ? `${done}/${total} etapas` : 'Sem etapas'}</span><span>{fmtDate(item.final_deadline)}</span><span>{progress}%</span></div>
            <div className="project-step-preview">
              {steps.slice(0, 3).map((step: any) => <div className="project-step-pill" key={step.id}><b>{step.title}</b><small>{STATUS_LABEL[step.status] || step.status}{step.end_date ? ` · ${fmtDate(step.end_date)}` : ''}</small></div>)}
              {!steps.length && <div className="project-step-empty">Cronograma ainda não criado.</div>}
            </div>
            <div className="project-actions"><Link className="bsec" href={`/dashboard/demandas/${item.id}`}>Abrir projeto</Link><button className="bpri" type="button" onClick={() => { setStepTarget(item); setError('') }}><i className="ti ti-plus" /> Criar etapa</button></div>
          </article>
        })}
      </div>}
    </div>
    {stepTarget && <div className="modal-ov" onClick={() => setStepTarget(null)}><div className="modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-head"><div><div className="modal-title">Nova etapa do cronograma</div><div className="modal-sub">{stepTarget.title}</div></div><button className="mclose" onClick={() => setStepTarget(null)}><i className="ti ti-x" /></button></div>
      <form onSubmit={submitStep}><div className="modal-body"><input type="hidden" name="work_item_id" value={stepTarget.id} /><div className="fg"><label className="fl">Etapa *</label><input className="fi" name="title" required placeholder="Ex.: Captação, edição, design, aprovação..." /></div><div className="frow"><div className="fg"><label className="fl">Início</label><input type="date" className="fi" name="start_date" /></div><div className="fg"><label className="fl">Fim</label><input type="date" className="fi" name="end_date" /></div></div><div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Definir depois</option>{safeProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div><div className="fg"><label className="fl">Observações</label><textarea className="fi" name="notes" placeholder="Dependências, materiais, links ou contexto da etapa." /></div>{error && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{error}</span></div>}</div><div className="modal-foot"><button className="bsec" type="button" onClick={() => setStepTarget(null)}>Cancelar</button><button className="bpri" disabled={saving}>{saving ? 'Criando...' : 'Criar etapa'}</button></div></form>
    </div></div>}
  </div>
}
