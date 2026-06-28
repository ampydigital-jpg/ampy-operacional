'use client'
import { useState } from 'react'
import { createClientAction, updateClientAction } from '@/lib/actions'

const statusCfg: Record<string, any> = {
  active: { label: 'Ativo', color: 'var(--ok)', bg: 'var(--ok-bg)', br: 'var(--ok-br)' },
  onboarding: { label: 'Onboarding', color: 'var(--blue)', bg: 'var(--blue-bg)', br: 'var(--blue-br)' },
}

const SEGMENTOS = ['Gastronomia','Saúde','Advocacia','Moda','Varejo','Beleza','Educação','Construção','Arquitetura','Imóveis','Financeiro','Negócios','Serviços','Outro']
const PAGAMENTOS = ['Boleto','Espécie','PIX','Cartão','Transferência']
const TEMPOS = ['1 mês','3 meses','6 meses','1 ano','2 anos']

export default function ClientsView({ clients, profiles }: any) {
  const [selected, setSelected] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = clients.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.segment?.toLowerCase().includes(search.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createClientAction(new FormData(e.currentTarget))
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    fd.set('id', selected.id)
    const result = await updateClientAction(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setEditing(false)
    setLoading(false)
    window.location.reload()
  }

  const formatCurrency = (v: any) => v ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
  const formatDate = (d: any) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

  const isExpiring = (fim: string) => {
    if (!fim) return false
    const diff = (new Date(fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Painel de Clientes</div>
        <div className="sbox"><i className="ti ti-search" /><input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="tb-sub">{filtered.length} ativos</div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Novo cliente</button>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
        {/* LISTA */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Cliente','Segmento','Cidade','Valor','Contrato','Vencimento','Status',''].map(h => (
                  <th key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '8px 12px', borderBottom: '0.5px solid var(--b1)', textAlign: 'left', background: 'var(--bg)', position: 'sticky', top: 0 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => {
                const st = statusCfg[c.status] || statusCfg.active
                const expiring = isExpiring(c.fim_contrato)
                return (
                  <tr key={c.id} onClick={() => { setSelected(c); setEditing(false) }} style={{ cursor: 'pointer', background: selected?.id === c.id ? 'var(--s2)' : '' }} onMouseEnter={e => { if (selected?.id !== c.id) e.currentTarget.style.background = 'var(--s1)' }} onMouseLeave={e => { if (selected?.id !== c.id) e.currentTarget.style.background = '' }}>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: c.avatar_bg, color: c.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>{c.avatar_initials}</div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#DDD' }}>{c.name}</div>
                          {c.cnpj_cpf && <div style={{ fontSize: '9px', color: 'var(--t4)' }}>{c.cnpj_cpf}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414', fontSize: '11px', color: 'var(--t2)' }}>{c.segment || '—'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414', fontSize: '11px', color: 'var(--t2)' }}>{c.cidade || '—'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414', fontSize: '11px', fontWeight: 600, color: 'var(--ok)' }}>{formatCurrency(c.valor_mensal)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414', fontSize: '11px', color: 'var(--t2)' }}>{c.tempo_contrato || '—'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: expiring ? 'var(--warn)' : 'var(--t3)' }}>{formatDate(c.fim_contrato)}</span>
                      {expiring && <span style={{ fontSize: '9px', color: 'var(--warn)', marginLeft: '5px' }}>⚠</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <span className="badge" style={{ background: st.bg, color: st.color, border: `0.5px solid ${st.br}` }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid #141414' }}>
                      <button onClick={e => { e.stopPropagation(); setSelected(c); setEditing(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t4)', fontSize: '13px' }} title="Editar"><i className="ti ti-edit" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* PAINEL LATERAL */}
        {selected && !editing && (
          <div className="panel">
            <div className="panel-head">
              <div className="av" style={{ width: '40px', height: '40px', fontSize: '13px', background: selected.avatar_bg, color: selected.avatar_color }}>{selected.avatar_initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--w)' }}>{selected.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{selected.segment || '—'} · {selected.cidade || '—'}</div>
              </div>
              <button className="pclose" onClick={() => setEditing(true)} title="Editar"><i className="ti ti-edit" /></button>
              <button className="pclose" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="panel-body">
              <div className="psec">Identificação</div>
              <div className="prow"><span className="pkey">CNPJ/CPF</span><span className="pval">{selected.cnpj_cpf || '—'}</span></div>
              <div className="prow"><span className="pkey">Email</span><span className="pval" style={{ fontSize: '10px' }}>{selected.main_contact_email || '—'}</span></div>
              <div className="prow"><span className="pkey">Telefone</span><span className="pval">{selected.main_contact_phone || '—'}</span></div>
              <div className="prow"><span className="pkey">Instagram</span><span className="pval">{selected.instagram || '—'}</span></div>
              <div className="prow"><span className="pkey">Responsável</span><span className="pval">{selected.responsible?.full_name || '—'}</span></div>

              <div className="psec">Contrato</div>
              <div className="prow"><span className="pkey">Valor mensal</span><span className="pval" style={{ color: 'var(--ok)', fontWeight: 600 }}>{formatCurrency(selected.valor_mensal)}</span></div>
              <div className="prow"><span className="pkey">Dia vencimento</span><span className="pval">Todo dia {selected.dia_vencimento || '—'}</span></div>
              <div className="prow"><span className="pkey">Pgto</span><span className="pval">{selected.metodo_pagamento || '—'}</span></div>
              <div className="prow"><span className="pkey">NF</span><span className="pval">{selected.notas_fiscais || '—'}</span></div>
              <div className="prow"><span className="pkey">Tempo</span><span className="pval">{selected.tempo_contrato || '—'}</span></div>
              <div className="prow"><span className="pkey">Início</span><span className="pval">{formatDate(selected.inicio_contrato)}</span></div>
              <div className="prow"><span className="pkey">Término</span><span className="pval" style={{ color: isExpiring(selected.fim_contrato) ? 'var(--warn)' : '' }}>{formatDate(selected.fim_contrato)}</span></div>
              <div className="prow"><span className="pkey">Situação</span><span className="pval">{selected.situacao_contrato || '—'}</span></div>

              <div className="psec">Links</div>
              {selected.drive_folder_url ? <a href={selected.drive_folder_url} target="_blank" rel="noopener noreferrer" className="lrow"><i className="ti ti-brand-google-drive" style={{ color: 'var(--ok)', fontSize: '13px' }} /><span>Pasta no Drive</span><i className="ti ti-external-link" style={{ color: 'var(--t4)', fontSize: '12px' }} /></a> : <div style={{ fontSize: '11px', color: 'var(--t4)', padding: '6px 0' }}>Nenhum link cadastrado</div>}
              {selected.briefing_url && <a href={selected.briefing_url} target="_blank" rel="noopener noreferrer" className="lrow"><i className="ti ti-file-description" style={{ color: 'var(--blue)', fontSize: '13px' }} /><span>Briefing</span><i className="ti ti-external-link" style={{ color: 'var(--t4)', fontSize: '12px' }} /></a>}

              {selected.notes && <><div className="psec">Observações</div><div style={{ fontSize: '11px', color: 'var(--t3)', lineHeight: 1.6 }}>{selected.notes}</div></>}
            </div>
            <div className="panel-foot">
              <button className="pbsec" onClick={() => setSelected(null)}>Fechar</button>
              <button className="pbpri" onClick={() => setEditing(true)}>Editar cliente</button>
            </div>
          </div>
        )}

        {/* EDIÇÃO */}
        {selected && editing && (
          <div className="panel" style={{ width: '400px', minWidth: '400px' }}>
            <div className="panel-head">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--w)' }}>Editar — {selected.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>Todos os campos</div>
              </div>
              <button className="pclose" onClick={() => setEditing(false)}><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="panel-body">
                <div className="fg"><label className="fl">Nome *</label><input className="fi" name="name" defaultValue={selected.name} required /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Segmento</label><select className="fi" name="segment" defaultValue={selected.segment || ''}><option value="">Selecionar...</option>{SEGMENTOS.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div className="fg"><label className="fl">Cidade</label><input className="fi" name="cidade" defaultValue={selected.cidade || ''} /></div>
                </div>
                <div className="fg"><label className="fl">CNPJ/CPF</label><input className="fi" name="cnpj_cpf" defaultValue={selected.cnpj_cpf || ''} /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Email contato</label><input className="fi" name="main_contact_email" type="email" defaultValue={selected.main_contact_email || ''} /></div>
                  <div className="fg"><label className="fl">Telefone</label><input className="fi" name="main_contact_phone" defaultValue={selected.main_contact_phone || ''} /></div>
                </div>
                <div className="fg"><label className="fl">Instagram</label><input className="fi" name="instagram" defaultValue={selected.instagram || ''} /></div>
                <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id" defaultValue={selected.responsible_id || ''}><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>

                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '2px', margin: '16px 0 8px' }}>Contrato</div>
                <div className="frow">
                  <div className="fg"><label className="fl">Valor mensal (R$)</label><input className="fi" name="valor_mensal" type="number" step="0.01" defaultValue={selected.valor_mensal || ''} /></div>
                  <div className="fg"><label className="fl">Dia vencimento</label><input className="fi" name="dia_vencimento" type="number" min="1" max="31" defaultValue={selected.dia_vencimento || ''} /></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Pagamento</label><select className="fi" name="metodo_pagamento" defaultValue={selected.metodo_pagamento || ''}><option value="">Selecionar...</option>{PAGAMENTOS.map(p => <option key={p}>{p}</option>)}</select></div>
                  <div className="fg"><label className="fl">Notas fiscais</label><select className="fi" name="notas_fiscais" defaultValue={selected.notas_fiscais || ''}><option value="">Selecionar...</option><option>Automático</option><option>Manual</option><option>Não emite</option></select></div>
                </div>
                <div className="fg"><label className="fl">Tempo de contrato</label><select className="fi" name="tempo_contrato" defaultValue={selected.tempo_contrato || ''}><option value="">Selecionar...</option>{TEMPOS.map(t => <option key={t}>{t}</option>)}</select></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Início contrato</label><input className="fi" name="inicio_contrato" type="date" defaultValue={selected.inicio_contrato || ''} /></div>
                  <div className="fg"><label className="fl">Fim contrato</label><input className="fi" name="fim_contrato" type="date" defaultValue={selected.fim_contrato || ''} /></div>
                </div>
                <div className="fg"><label className="fl">Situação</label><select className="fi" name="situacao_contrato" defaultValue={selected.situacao_contrato || ''}><option value="">Selecionar...</option><option>Ativo</option><option>Renovando</option><option>Pausado</option><option>Encerrado</option></select></div>
                <div className="fg"><label className="fl">Pasta Drive</label><input className="fi" name="drive_folder_url" defaultValue={selected.drive_folder_url || ''} placeholder="https://drive.google.com/..." /></div>
                <div className="fg"><label className="fl">Link briefing</label><input className="fi" name="briefing_url" defaultValue={selected.briefing_url || ''} placeholder="https://drive.google.com/..." /></div>
                <div className="fg"><label className="fl">Status</label><select className="fi" name="status" defaultValue={selected.status}><option value="active">Ativo</option><option value="onboarding">Onboarding</option><option value="paused">Pausado</option><option value="cancelled">Encerrado</option></select></div>
                <div className="fg"><label className="fl">Observações</label><textarea className="fi" name="notes" defaultValue={selected.notes || ''} /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--err-bg)', border: '0.5px solid var(--err-br)', borderRadius: 'var(--r)', color: 'var(--err)', fontSize: '11px' }}>{error}</div>}
              </div>
              <div className="panel-foot">
                <button type="button" className="pbsec" onClick={() => setEditing(false)}>Cancelar</button>
                <button type="submit" className="pbpri" disabled={loading}>{loading ? 'Salvando...' : 'Salvar alterações'}</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* MODAL NOVO CLIENTE */}
      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Novo cliente</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="fg"><label className="fl">Nome *</label><input className="fi" name="name" placeholder="Nome da empresa..." required /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Segmento</label><select className="fi" name="segment"><option value="">Selecionar...</option>{SEGMENTOS.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div className="fg"><label className="fl">Cidade</label><input className="fi" name="cidade" placeholder="Araranguá..." /></div>
                </div>
                <div className="fg"><label className="fl">CNPJ/CPF</label><input className="fi" name="cnpj_cpf" placeholder="00.000.000/0001-00" /></div>
                <div className="frow">
                  <div className="fg"><label className="fl">Email</label><input className="fi" name="main_contact_email" type="email" /></div>
                  <div className="fg"><label className="fl">Telefone</label><input className="fi" name="main_contact_phone" placeholder="(48) 99999-0000" /></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Valor mensal</label><input className="fi" name="valor_mensal" type="number" step="0.01" placeholder="0,00" /></div>
                  <div className="fg"><label className="fl">Dia vencimento</label><input className="fi" name="dia_vencimento" type="number" min="1" max="31" /></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Início contrato</label><input className="fi" name="inicio_contrato" type="date" /></div>
                  <div className="fg"><label className="fl">Fim contrato</label><input className="fi" name="fim_contrato" type="date" /></div>
                </div>
                <div className="fg"><label className="fl">Pasta Drive</label><input className="fi" name="drive_folder_url" placeholder="https://drive.google.com/..." /></div>
                {error && <div style={{ padding: '8px 12px', background: 'var(--err-bg)', border: '0.5px solid var(--err-br)', borderRadius: 'var(--r)', color: 'var(--err)', fontSize: '11px' }}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading ? 'Salvando...' : 'Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
