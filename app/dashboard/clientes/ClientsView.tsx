'use client'

import { useMemo, useState } from 'react'
import { createClientAction, createClientServiceAction, updateClientAction } from '@/lib/actions'

const SEGMENTS = ['Moda','Varejo','Gastronomia','Saúde','Odontologia','Estética','Advocacia','Construção','Imobiliário','Condomínio','Marketing','Serviços','ONG','Outro']
const TABS = ['Visão geral','Serviços','Demandas','Agenda e Drive','Histórico']

function text(value: any, fallback = '—') {
  const output = String(value || '').trim()
  return output || fallback
}
function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}
function initials(name?: string | null) {
  return String(name || 'AM').split(' ').filter(Boolean).slice(0,2).map((part) => part[0]).join('').toUpperCase() || 'AM'
}
function statusLabel(status?: string | null) {
  const value = String(status || 'active')
  if (value === 'paused') return 'Pausado'
  if (value === 'onboarding') return 'Onboarding'
  if (value === 'ended' || value === 'inactive') return 'Encerrado'
  return 'Ativo'
}
function statusClass(status?: string | null) {
  const value = String(status || 'active')
  if (value === 'active') return 'bok'
  if (value === 'paused' || value === 'onboarding') return 'bwarn'
  return 'bmut'
}

export default function ClientsView({ clients = [], profiles = [], services = [], clientServices = [], demands = [], loadErrors = [] }: any) {
  const safeClients = Array.isArray(clients) ? clients.filter(Boolean) : []
  const safeProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : []
  const safeServices = Array.isArray(services) ? services.filter(Boolean) : []
  const safeClientServices = Array.isArray(clientServices) ? clientServices.filter(Boolean) : []
  const safeDemands = Array.isArray(demands) ? demands.filter(Boolean) : []
  const safeLoadErrors = Array.isArray(loadErrors) ? loadErrors.filter(Boolean) : []

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(safeClients[0]?.id || null)
  const [tab, setTab] = useState('Visão geral')
  const [newModal, setNewModal] = useState(false)
  const [edit, setEdit] = useState(false)
  const [serviceModal, setServiceModal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selected = useMemo(() => safeClients.find((client: any) => client.id === selectedId) || null, [safeClients, selectedId])
  const visible = useMemo(() => {
    const term = query.toLowerCase().trim()
    return safeClients.filter((client: any) => {
      if (!term) return true
      return [client.name, client.segment, client.cidade, client.main_contact_phone].some((value) => String(value || '').toLowerCase().includes(term))
    })
  }, [safeClients, query])
  const selectedServices = selected ? safeClientServices.filter((service: any) => service.client_id === selected.id) : []
  const selectedDemands = selected ? safeDemands.filter((demand: any) => demand.client_id === selected.id) : []
  const activeCount = safeClients.filter((client: any) => String(client.status || 'active') === 'active').length

  async function submitClient(event: React.FormEvent<HTMLFormElement>, update = false) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(event.currentTarget)
    if (update && selected) formData.set('id', selected.id)
    const result = update ? await updateClientAction(formData) : await createClientAction(formData)
    if ('error' in result) {
      setError(result.error || 'Erro ao salvar cliente.')
      setLoading(false)
      return
    }
    window.location.reload()
  }

  async function submitService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result = await createClientServiceAction(new FormData(event.currentTarget))
    if ('error' in result) {
      setError(result.error || 'Erro ao vincular serviço.')
      setLoading(false)
      return
    }
    window.location.reload()
  }

  return <div className="page-wrap clients-page ops-page">
    <div className="topbar">
      <div><div className="tb-title">Painel de Clientes</div><div className="tb-sub">{activeCount} cliente(s) ativo(s) · sem valores financeiros</div></div>
      <div className="sbox"><i className="ti ti-search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente..." /></div>
      <button className="bpri" onClick={() => { setError(''); setNewModal(true) }}><i className="ti ti-plus" /> Novo cliente</button>
    </div>
    <div className="client-layout">
      <main className="client-table-wrap">
        {safeLoadErrors.length > 0 && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{safeLoadErrors.join(' | ')}</span></div>}
        <table className="client-table"><thead><tr><th>Cliente</th><th>Segmento</th><th>Cidade</th><th>Serviços ativos</th><th>Início</th><th>Término</th><th>Status</th></tr></thead><tbody>
          {visible.map((client: any) => {
            const linked = safeClientServices.filter((service: any) => service.client_id === client.id && String(service.status || 'active') === 'active')
            return <tr key={client.id} className={selected?.id === client.id ? 'selected' : ''} onClick={() => { setSelectedId(client.id); setTab('Visão geral'); setEdit(false) }}>
              <td><div className="client-name"><span style={{ background: client.avatar_bg || '#E2E8F0', color: client.avatar_color || '#111827' }}>{client.avatar_initials || initials(client.name)}</span><div><b>{text(client.name, 'Cliente sem nome')}</b><small>{text(client.main_contact_phone, 'Sem telefone')}</small></div></div></td>
              <td>{text(client.segment)}</td><td>{text(client.cidade)}</td><td>{linked.length ? `${linked.length} ativo${linked.length > 1 ? 's' : ''}` : 'Sem serviço ativo'}</td><td>{formatDate(client.inicio_contrato || client.started_at)}</td><td>{formatDate(client.fim_contrato || client.ended_at)}</td><td><span className={`badge ${statusClass(client.status)}`}>{statusLabel(client.status)}</span></td>
            </tr>
          })}
        </tbody></table>
        {!visible.length && <div className="empty"><i className="ti ti-users" /><div className="empty-title">Nenhum cliente encontrado</div></div>}
      </main>
      {selected && <aside className="client-detail-panel">
        <header><div className="client-name"><span style={{ background: selected.avatar_bg || '#E2E8F0', color: selected.avatar_color || '#111827' }}>{selected.avatar_initials || initials(selected.name)}</span><div><b>{text(selected.name, 'Cliente')}</b><small>{text(selected.segment, 'Sem segmento')} · {text(selected.cidade, 'Sem cidade')}</small></div></div><button className="mclose" onClick={() => setSelectedId(null)}><i className="ti ti-x" /></button></header>
        <div className="detail-tabs">{TABS.map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
        <div className="client-detail-body">
          {tab === 'Visão geral' && <><Info label="Responsável" value={selected.responsible?.full_name || 'Não definido'} /><Info label="Contato" value={selected.main_contact_name || 'Não definido'} /><Info label="E-mail" value={selected.main_contact_email || 'Não definido'} /><Info label="Telefone" value={selected.main_contact_phone || 'Não definido'} /><Info label="Instagram" value={selected.instagram || 'Não informado'} /><div className="notice"><i className="ti ti-shield-lock" /><span>Valores financeiros não aparecem no painel operacional.</span></div>{selected.notes && <p className="client-notes">{selected.notes}</p>}</>}
          {tab === 'Serviços' && <><div className="sh"><div className="stitle">Serviços entregues/ativos</div><button className="text-button" onClick={() => { setError(''); setServiceModal(true) }}><i className="ti ti-plus" /> Vincular</button></div>{selectedServices.length ? selectedServices.map((service: any) => <div className="service-card" key={service.id}><b>{service.service?.name || 'Serviço'}</b><span>{statusLabel(service.status)}</span><small>{service.monthly_quantity ? `${service.monthly_quantity} ${service.quantity_unit || 'entregas'} / mês` : 'Sem quantidade mensal'}{service.responsible?.full_name ? ` · ${service.responsible.full_name}` : ''}</small></div>) : <div className="empty-inline">Nenhum serviço ativo.</div>}</>}
          {tab === 'Demandas' && <>{selectedDemands.length ? selectedDemands.map((demand: any) => <div className="service-card" key={demand.id}><b>{demand.title || 'Demanda'}</b><span>{statusLabel(demand.status)}</span><small>{formatDate(demand.final_deadline || demand.internal_deadline)} · {demand.destino || 'processo'}</small></div>) : <div className="empty-inline">Nenhuma demanda ativa vinculada.</div>}</>}
          {tab === 'Agenda e Drive' && <><a className="quick-link" href={selected.drive_folder_url || '#'} target="_blank" onClick={(event) => !selected.drive_folder_url && event.preventDefault()}><i className="ti ti-brand-google-drive" /> {selected.drive_folder_url ? 'Abrir pasta do Drive' : 'Pasta do Drive não adicionada'}</a><a className="quick-link" href={selected.briefing_url || '#'} target="_blank" onClick={(event) => !selected.briefing_url && event.preventDefault()}><i className="ti ti-file-text" /> {selected.briefing_url ? 'Abrir briefing' : 'Briefing não adicionado'}</a><p className="empty-inline">Agenda do cliente será preenchida por agendas vinculadas ao cadastro.</p></>}
          {tab === 'Histórico' && <p className="empty-inline">Histórico operacional será ampliado após estabilização dos fluxos centrais.</p>}
          {edit && <ClientForm selected={selected} profiles={safeProfiles} loading={loading} onSubmit={(event: any) => submitClient(event, true)} />}
        </div>
        <footer><button className="bsec" onClick={() => setEdit(!edit)}>{edit ? 'Cancelar edição' : 'Editar cadastro'}</button></footer>
      </aside>}
    </div>
    {newModal && <ClientModal title="Novo cliente" profiles={safeProfiles} error={error} loading={loading} onClose={() => setNewModal(false)} onSubmit={(event: any) => submitClient(event, false)} />}
    {serviceModal && selected && <ServiceModal selected={selected} services={safeServices} profiles={safeProfiles} error={error} loading={loading} onClose={() => setServiceModal(false)} onSubmit={submitService} />}
  </div>
}

function Info({ label, value }: { label: string; value: string }) { return <div className="info-row"><span>{label}</span><b>{value}</b></div> }
function ClientForm({ selected, profiles, loading, onSubmit }: any) { return <form onSubmit={onSubmit} className="edit-client-form"><ClientFields selected={selected} profiles={profiles} /><input type="hidden" name="status" value={selected.status || 'active'} /><button className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Salvar cadastro'}</button></form> }
function ClientModal({ title, onClose, onSubmit, error, loading, profiles }: any) { return <div className="modal-ov" onClick={onClose}><div className="modal modal-wide" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div className="modal-title">{title}</div><button className="mclose" onClick={onClose}><i className="ti ti-x" /></button></div><form onSubmit={onSubmit}><div className="modal-body"><ClientFields profiles={profiles} />{error && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{error}</span></div>}</div><div className="modal-foot"><button type="button" className="bsec" onClick={onClose}>Cancelar</button><button className="bpri" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar cliente'}</button></div></form></div></div> }
function ClientFields({ selected = {}, profiles = [] }: any) { return <><div className="fg"><label className="fl">Nome *</label><input className="fi" name="name" required defaultValue={selected.name || ''} /></div><div className="frow"><div className="fg"><label className="fl">Segmento</label><select className="fi" name="segment" defaultValue={selected.segment || ''}><option value="">Selecionar</option>{SEGMENTS.map((segment) => <option key={segment}>{segment}</option>)}</select></div><div className="fg"><label className="fl">Cidade</label><input className="fi" name="cidade" defaultValue={selected.cidade || ''} /></div></div><div className="frow"><div className="fg"><label className="fl">Início</label><input type="date" className="fi" name="inicio_contrato" defaultValue={selected.inicio_contrato || selected.started_at || ''} /></div><div className="fg"><label className="fl">Término</label><input type="date" className="fi" name="fim_contrato" defaultValue={selected.fim_contrato || selected.ended_at || ''} /></div></div><div className="frow"><div className="fg"><label className="fl">Contato</label><input className="fi" name="main_contact_name" defaultValue={selected.main_contact_name || ''} /></div><div className="fg"><label className="fl">Telefone</label><input className="fi" name="main_contact_phone" defaultValue={selected.main_contact_phone || ''} /></div></div><div className="fg"><label className="fl">Pasta Drive</label><input className="fi" name="drive_folder_url" defaultValue={selected.drive_folder_url || ''} placeholder="https://drive.google.com/..." /></div><div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id" defaultValue={selected.responsible_id || ''}><option value="">Definir depois</option>{profiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div><div className="fg"><label className="fl">Observações</label><textarea className="fi" name="notes" defaultValue={selected.notes || ''} /></div></> }
function ServiceModal({ selected, services, profiles, error, loading, onClose, onSubmit }: any) { return <div className="modal-ov" onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div className="modal-title">Vincular serviço</div><button className="mclose" onClick={onClose}><i className="ti ti-x" /></button></div><form onSubmit={onSubmit}><div className="modal-body"><input type="hidden" name="client_id" value={selected.id} /><div className="fg"><label className="fl">Serviço *</label><select className="fi" name="service_catalog_id" required><option value="">Selecionar</option>{services.map((service: any) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div><div className="frow"><div className="fg"><label className="fl">Quantidade mensal</label><input className="fi" type="number" min="0" name="monthly_quantity" placeholder="Ex.: 12" /></div><div className="fg"><label className="fl">Unidade</label><select className="fi" name="quantity_unit"><option value="">Não se aplica</option><option value="conteúdos">conteúdos</option><option value="vídeos">vídeos</option><option value="entregas">entregas</option></select></div></div><div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Definir depois</option>{profiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div>{error && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{error}</span></div>}</div><div className="modal-foot"><button className="bsec" type="button" onClick={onClose}>Cancelar</button><button className="bpri" disabled={loading}>{loading ? 'Vinculando...' : 'Vincular serviço'}</button></div></form></div></div> }
