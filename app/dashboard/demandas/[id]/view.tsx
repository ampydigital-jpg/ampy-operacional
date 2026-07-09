'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createProjectStepAction, deleteProjectStepAction, deleteWorkItemAction, updateProjectStepStatusAction, updateWorkItemAction, updateWorkItemStatusAction } from '@/lib/actions'

const statusOptions = [
  ['not_started','Não iniciada'],['in_progress','Em andamento'],['waiting','Aguardando'],['blocked','Bloqueada'],['in_review','Em revisão'],['awaiting_approval','Aguardando aprovação'],['approved','Aprovada'],['scheduled','Programada'],['delivered','Entregue'],['done','Concluída'],['cancelled','Cancelada'],
]
const processOptions = [['quadro','Quadro'],['projeto','Projeto / Cronograma'],['ambos','Quadro + Projeto'],['avulsa','Avulsa']]
const processLabels: Record<string, string> = { quadro: 'Quadro', projeto: 'Projeto', ambos: 'Quadro + Projeto', avulsa: 'Avulsa', kanban: 'Quadro' }

const types = ['Planejamento','Captação','Edição','Design','Organização de Feed','Programação','Tráfego','Reunião','Relatório','Interno']

export default function DemandDetailView({ demand, clients, profiles, steps: initialSteps, services }: any) {
  const [item, setItem] = useState(demand)
  const [steps, setSteps] = useState(initialSteps)
  const [saving, setSaving] = useState(false)
  const [newStep, setNewStep] = useState(false)
  const [error, setError] = useState('')
  const serviceOptions = useMemo(() => services.filter((service: any) => service.client_id === item.client_id), [services, item.client_id])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const result = await updateWorkItemAction(item.id, new FormData(event.currentTarget))
    if ('error' in result) { setError(result.error || 'Erro ao salvar.'); setSaving(false); return }
    setSaving(false); window.location.reload()
  }
  async function changeStatus(status: string) {
    const result = await updateWorkItemStatusAction(item.id, status)
    if ('error' in result) { setError(result.error || 'Erro inesperado.'); return }
    setItem({ ...item, status })
  }
  async function addStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const result = await createProjectStepAction(new FormData(event.currentTarget))
    if ('error' in result) { setError(result.error || 'Erro ao criar etapa.'); return }
    window.location.reload()
  }
  async function updateStep(stepId: string, status: string) {
    const result = await updateProjectStepStatusAction(stepId, item.id, status)
    if ('error' in result) { setError(result.error || 'Erro inesperado.'); return }
    setSteps((all: any[]) => all.map((step) => step.id === stepId ? { ...step, status } : step))
  }
  async function removeStep(stepId: string) {
    if (!confirm('Excluir esta etapa do cronograma?')) return
    const result = await deleteProjectStepAction(stepId, item.id)
    if (!('error' in result)) setSteps((all: any[]) => all.filter((step) => step.id !== stepId))
  }
  async function archive() {
    if (!confirm('Arquivar demanda?')) return
    const result = await deleteWorkItemAction(item.id)
    if (!('error' in result)) window.location.href = '/dashboard/demandas'
  }
  const done = steps.filter((step: any) => step.status === 'done').length
  const progress = steps.length ? Math.round(done / steps.length * 100) : 0

  return <div className="page-wrap">
    <div className="topbar"><Link className="bsec" href="/dashboard/demandas"><i className="ti ti-arrow-left" /> Demandas</Link><div className="tb-title">{item.title}</div><select className="fi compact" style={{width:180}} value={item.status} onChange={(e) => changeStatus(e.target.value)}>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button className="bsec" onClick={archive}><i className="ti ti-archive" /> Arquivar</button></div>
    <div className="pad detail-layout" style={{overflowY:'auto',flex:1}}>
      <main>
        <section className="detail-card"><div className="detail-card-head"><div><div className="eyebrow">Demanda única</div><h2>{item.title}</h2><p>Processo: {processLabels[item.destino] || 'Quadro'} · {item.client?.name || 'Interno Ampy'}</p></div><div className="detail-progress"><span>{progress}%</span><small>cronograma</small></div></div>
          <form onSubmit={save}><div className="detail-form">
            <div className="fg"><label className="fl">Título *</label><input className="fi" name="title" defaultValue={item.title} required /></div>
            <div className="frow"><div className="fg"><label className="fl">Cliente</label><select className="fi" name="client_id" defaultValue={item.client_id || ''}><option value="">Interno — Ampy</option>{clients.map((client:any) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div><div className="fg"><label className="fl">Serviço vinculado</label><select className="fi" name="client_service_id" defaultValue={item.client_service_id || ''}><option value="">Não vincular</option>{serviceOptions.map((service:any) => <option key={service.id} value={service.id}>{service.service?.name || 'Serviço'}</option>)}</select></div></div>
            <div className="frow"><div className="fg"><label className="fl">Processo</label><select className="fi" name="destino" defaultValue={item.destino || 'quadro'}>{processOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="fg"><label className="fl">Tipo</label><select className="fi" name="type" defaultValue={item.type}>{types.map((type) => <option key={type}>{type}</option>)}</select></div></div>
            <div className="frow"><div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id" defaultValue={item.responsible_id || ''}><option value="">Definir depois</option>{profiles.map((profile:any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div><div className="fg"><label className="fl">Classificação</label><input className="fi" value={item.client_id ? 'Cliente' : 'Interna — Ampy'} readOnly /></div></div>
            <div className="frow"><div className="fg"><label className="fl">Prioridade</label><select className="fi" name="priority" defaultValue={item.priority}><option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select></div><div className="fg"><label className="fl">Origem</label><select className="fi" name="origin" defaultValue={item.origin}><option value="planned">Planejada</option><option value="recurring">Recorrente</option><option value="extra">Extra</option><option value="adjustment">Ajuste</option><option value="urgent">Urgente</option><option value="internal">Interna</option></select></div></div>
            <div className="frow"><div className="fg"><label className="fl">Prazo interno</label><input className="fi" type="date" name="internal_deadline" defaultValue={item.internal_deadline || ''} /></div><div className="fg"><label className="fl">Prazo final</label><input className="fi" type="date" name="final_deadline" defaultValue={item.final_deadline || ''} /></div></div>
            <div className="fg"><label className="fl">Link Drive</label><input className="fi" type="url" name="drive_link" defaultValue={item.drive_link || ''} placeholder="https://drive.google.com/..." /></div>
            <div className="fg"><label className="fl">Motivo de bloqueio</label><input className="fi" name="blocked_reason" defaultValue={item.blocked_reason || ''} placeholder="Material pendente, retorno do cliente, dependência..." /></div>
            <div className="fg"><label className="fl">Descrição / contexto</label><textarea className="fi" name="description" defaultValue={item.description || ''} /></div>
            {error && <div className="notice notice-err"><i className="ti ti-alert-circle"/><span>{error}</span></div>}
            <div style={{display:'flex',justifyContent:'flex-end'}}><button className="bpri" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
          </div></form>
        </section>
      </main>
      <aside className="detail-side"><section className="detail-card"><div className="sh"><div className="stitle">Cronograma interno</div><div className="ssub">{done}/{steps.length}</div></div><div className="progress-track"><div style={{width:`${progress}%`}} /></div>
        {steps.length === 0 && !newStep && <p className="empty-inline">Ainda não há etapas. O cronograma pode existir tanto em Demanda de Projeto quanto em card do Quadro.</p>}
        <div className="step-list">{steps.map((step:any, index:number) => <div className="step-row" key={step.id}><span className="step-index">{index + 1}</span><div className="step-content"><b>{step.title}</b><small>{step.responsible?.full_name || 'Sem responsável'}{step.end_date ? ` · vence ${new Date(`${step.end_date}T00:00:00`).toLocaleDateString('pt-BR')}` : ''}</small></div><select className="step-select" value={step.status} onChange={(e) => updateStep(step.id, e.target.value)}>{statusOptions.filter(([value]) => ['not_started','in_progress','waiting','blocked','done'].includes(value)).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><button className="icon-button" onClick={() => removeStep(step.id)}><i className="ti ti-trash" /></button></div>)}</div>
        {newStep ? <form onSubmit={addStep} className="new-step"><input type="hidden" name="work_item_id" value={item.id}/><div className="fg"><label className="fl">Etapa *</label><input className="fi" name="title" required /></div><div className="frow"><div className="fg"><label className="fl">Início</label><input type="date" name="start_date" className="fi" /></div><div className="fg"><label className="fl">Fim</label><input type="date" name="end_date" className="fi" /></div></div><div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Definir depois</option>{profiles.map((profile:any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div><div className="row-actions"><button className="bsec" type="button" onClick={() => setNewStep(false)}>Cancelar</button><button className="bpri">Adicionar etapa</button></div></form> : <button className="text-button" onClick={() => setNewStep(true)}><i className="ti ti-plus" /> Adicionar etapa</button>}
      </section>
      <section className="detail-card"><div className="stitle">Acesso rápido</div>{item.drive_link ? <a className="quick-link" href={item.drive_link} target="_blank"><i className="ti ti-brand-google-drive"/> Abrir arquivo no Drive</a> : <p className="empty-inline">Nenhum link de Drive adicionado.</p>}</section></aside>
    </div>
  </div>
}
