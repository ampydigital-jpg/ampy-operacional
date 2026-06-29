'use client'
import { useState } from 'react'
import { createWorkItemAction, deleteWorkItemAction } from '@/lib/actions'

const STATUS_CFG: Record<string, any> = {
  not_started: { label: 'Não iniciada', color: 'var(--t3)', bg: 'var(--s2)', br: 'var(--b1)' },
  in_progress: { label: 'Em andamento', color: 'var(--blue)', bg: 'var(--blue-bg)', br: 'var(--blue-br)' },
  waiting: { label: 'Aguardando', color: 'var(--warn)', bg: 'var(--warn-bg)', br: 'var(--warn-br)' },
  blocked: { label: 'Bloqueada', color: 'var(--err)', bg: 'var(--err-bg)', br: 'var(--err-br)' },
  in_review: { label: 'Em revisão', color: 'var(--warn)', bg: 'var(--warn-bg)', br: 'var(--warn-br)' },
  awaiting_approval: { label: 'Ag. aprovação', color: 'var(--purple)', bg: 'var(--purple-bg)', br: 'var(--purple-br)' },
  approved: { label: 'Aprovada', color: 'var(--ok)', bg: 'var(--ok-bg)', br: 'var(--ok-br)' },
  done: { label: 'Concluída', color: 'var(--ok)', bg: 'var(--ok-bg)', br: 'var(--ok-br)' },
}
const PRIORIDADE_COLOR: Record<string, string> = {
  urgent: 'var(--err)', high: 'var(--warn)', normal: 'var(--t3)', low: 'var(--t4)'
}
const TIPOS = ['Planejamento','Captação','Edição','Design','Org. Feed','Programação','Tráfego','Relatório','Reunião','Interno']

export default function DemandasView({ demands, clients, profiles }: any) {
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('all')
  const [prioFiltro, setPrioFiltro] = useState('all')
  const [dataFiltro, setDataFiltro] = useState('')
  const [destinoModal, setDestinoModal] = useState<'kanban'|'projeto'>('kanban')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clienteSel, setClienteSel] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [tituloAuto, setTituloAuto] = useState('')
  const [items, setItems] = useState(demands)

  const hoje = new Date().toISOString().split('T')[0]

  function gerarTitulo(clientId: string, inicio: string, fim: string) {
    const c = clients.find((x: any) => x.id === clientId)
    if (!c) { setTituloAuto(''); return }
    const fmt = (d: string) => { if (!d) return ''; const [,m,day] = d.split('-'); return `${day}/${m}` }
    const nome = c.name.toUpperCase().split(' ').slice(0,3).join(' ')
    let t = `PLAN ${nome}`
    if (inicio) t += ` - ${fmt(inicio)}`
    if (fim) t += ` A ${fmt(fim)}`
    setTituloAuto(t)
  }

  const filtrados = items.filter((d: any) => {
    const ms = d.title.toLowerCase().includes(search.toLowerCase()) || d.client?.name?.toLowerCase().includes(search.toLowerCase())
    const mst = statusFiltro === 'all' || d.status === statusFiltro ||
      (statusFiltro === 'late' && d.final_deadline < hoje && !['done','cancelled'].includes(d.status))
    const mp = prioFiltro === 'all' || d.priority === prioFiltro
    const md = !dataFiltro || d.final_deadline === dataFiltro || d.internal_deadline === dataFiltro
    return ms && mst && mp && md
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    if (tituloAuto && !fd.get('title')) fd.set('title', tituloAuto)
    fd.set('start_date', dataInicio)
    fd.set('destino', destinoModal)
    const result = await createWorkItemAction(fd)
    if (result.error) { setError(result.error); setLoading(false); return }
    setModal(false)
    setLoading(false)
    window.location.reload()
  }

  async function handleDelete(id: string) {
    if (!confirm('Arquivar esta demanda?')) return
    await deleteWorkItemAction(id)
    setItems((prev: any[]) => prev.filter(i => i.id !== id))
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Demandas</div>
        <div className="sbox"><i className="ti ti-search" /><input placeholder="Buscar demanda ou cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{fontSize:'12px'}} /> Nova demanda</button>
      </div>

      <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
        <div style={{display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center'}}>
          <div className="filters" style={{margin:0}}>
            {[['all','Todas'],['in_progress','Em andamento'],['blocked','Bloqueadas'],['awaiting_approval','Ag. aprovação'],['late','Atrasadas'],['done','Concluídas']].map(([v,l]) => (
              <button key={v} className={`fb ${statusFiltro===v?'on':''}`} onClick={() => setStatusFiltro(v)}>{l}</button>
            ))}
          </div>
          <select className="fi" style={{width:'130px',height:'32px',padding:'0 10px'}} value={prioFiltro} onChange={e => setPrioFiltro(e.target.value)}>
            <option value="all">Prioridade</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>
          <input className="fi" type="date" style={{width:'150px',height:'32px',padding:'0 10px'}} value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} />
          {dataFiltro && <button className="bsec" onClick={() => setDataFiltro('')} style={{height:'32px'}}>Limpar</button>}
        </div>

        <div style={{fontSize:'11px', color:'var(--t4)', marginBottom:'12px'}}>{filtrados.length} demanda(s)</div>

        {filtrados.length === 0 ? (
          <div className="empty"><i className="ti ti-checklist" /><div className="empty-title">Nenhuma demanda encontrada</div><div className="empty-sub"><button className="bpri" onClick={() => setModal(true)} style={{marginTop:'12px'}}>Criar demanda</button></div></div>
        ) : (
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr>{['','Título','Cliente','Destino','Responsável','Prazo final','Status','Prioridade',''].map(h => (
                <th key={h} style={{fontSize:'9px',fontWeight:700,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'1.5px',padding:'8px 12px',borderBottom:'0.5px solid var(--b1)',textAlign:'left',background:'var(--bg)',position:'sticky',top:0,zIndex:1}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtrados.map((d: any) => {
                const st = STATUS_CFG[d.status] || STATUS_CFG.not_started
                const atrasada = d.final_deadline && d.final_deadline < hoje && !['done','cancelled'].includes(d.status)
                return (
                  <tr key={d.id} onMouseEnter={e => e.currentTarget.style.background='var(--s1)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414',width:'12px'}}>
                      <div style={{width:'10px',height:'10px',borderRadius:'50%',background:PRIORIDADE_COLOR[d.priority]}} />
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      <div style={{fontSize:'11px',fontWeight:600,color:'#DDD'}}>{d.title}</div>
                      <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{d.type}</div>
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      {d.client ? (
                        <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                          <div style={{width:'22px',height:'22px',borderRadius:'5px',background:d.client.avatar_bg,color:d.client.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:700}}>{d.client.avatar_initials}</div>
                          <span style={{fontSize:'11px',color:'var(--t2)'}}>{d.client.name}</span>
                        </div>
                      ) : <span style={{fontSize:'11px',color:'var(--t3)'}}>Interno</span>}
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      <span className="badge" style={{background:d.destino==='projeto'?'var(--purple-bg)':'var(--blue-bg)',color:d.destino==='projeto'?'var(--purple)':'var(--blue)',border:`0.5px solid ${d.destino==='projeto'?'var(--purple-br)':'var(--blue-br)'}`}}>
                        {d.destino==='projeto'?'Projeto':'Kanban'}
                      </span>
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      {d.responsible ? (
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <div style={{width:'22px',height:'22px',borderRadius:'5px',background:'var(--s3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',color:'var(--t2)',fontWeight:700}}>{d.responsible.avatar_initials}</div>
                          <span style={{fontSize:'11px',color:'var(--t2)'}}>{d.responsible.full_name}</span>
                        </div>
                      ) : <span style={{fontSize:'11px',color:'var(--t3)'}}>—</span>}
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      <span style={{fontSize:'11px',fontWeight:600,color:atrasada?'var(--err)':'var(--t2)'}}>{d.final_deadline ? new Date(d.final_deadline+'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      <span className="badge" style={{background:st.bg,color:st.color,border:`0.5px solid ${st.br}`}}>{st.label}</span>
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      <span style={{fontSize:'10px',fontWeight:600,padding:'2px 8px',borderRadius:'4px',background:'var(--s2)',color:PRIORIDADE_COLOR[d.priority],border:'0.5px solid var(--b2)'}}>{d.priority}</span>
                    </td>
                    <td style={{padding:'10px 12px',borderBottom:'0.5px solid #141414'}}>
                      <button onClick={() => handleDelete(d.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t4)',fontSize:'13px'}} title="Arquivar"><i className="ti ti-archive" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Nova demanda</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* DESTINO */}
                <div className="fg">
                  <label className="fl">Destino *</label>
                  <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
                    <button type="button" onClick={() => setDestinoModal('kanban')} style={{flex:1,padding:'10px',borderRadius:'var(--r)',border:`0.5px solid ${destinoModal==='kanban'?'var(--blue)':'var(--b2)'}`,background:destinoModal==='kanban'?'var(--blue-bg)':'transparent',color:destinoModal==='kanban'?'var(--blue)':'var(--t3)',fontSize:'12px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'7px'}}>
                      <i className="ti ti-layout-kanban" />Kanban
                    </button>
                    <button type="button" onClick={() => setDestinoModal('projeto')} style={{flex:1,padding:'10px',borderRadius:'var(--r)',border:`0.5px solid ${destinoModal==='projeto'?'var(--purple)':'var(--b2)'}`,background:destinoModal==='projeto'?'var(--purple-bg)':'transparent',color:destinoModal==='projeto'?'var(--purple)':'var(--t3)',fontSize:'12px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'7px'}}>
                      <i className="ti ti-folder" />Projeto
                    </button>
                  </div>
                  <input type="hidden" name="destino" value={destinoModal} />
                </div>

                <div className="fg">
                  <label className="fl">Cliente</label>
                  <select className="fi" name="client_id" value={clienteSel} onChange={e => { setClienteSel(e.target.value); gerarTitulo(e.target.value, dataInicio, dataFim) }}>
                    <option value="">Interno — Ampy</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Data início</label><input className="fi" type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); gerarTitulo(clienteSel, e.target.value, dataFim) }} /></div>
                  <div className="fg"><label className="fl">Data fim (prazo final)</label><input className="fi" name="final_deadline" type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); gerarTitulo(clienteSel, dataInicio, e.target.value) }} /></div>
                </div>
                <div className="fg">
                  <label className="fl">Título {tituloAuto ? '· gerado automaticamente' : ''}</label>
                  <input className="fi" name="title" placeholder="Ex: PLAN CLIENTE - 08/06 A 03/07" value={tituloAuto} onChange={e => setTituloAuto(e.target.value)} />
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Tipo</label><select className="fi" name="type">{TIPOS.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div className="fg"><label className="fl">Prioridade</label><select className="fi" name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baixa</option></select></div>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">Responsável</label><select className="fi" name="responsible_id"><option value="">Selecionar...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
                  <div className="fg"><label className="fl">Prazo interno</label><input className="fi" name="internal_deadline" type="date" /></div>
                </div>
                <div className="fg"><label className="fl">Link Drive</label><input className="fi" name="drive_link" placeholder="https://drive.google.com/..." /></div>
                <div className="fg"><label className="fl">Descrição / contexto</label><textarea className="fi" name="description" placeholder="Detalhes, referências..." /></div>
                {error && <div style={{padding:'8px 12px',background:'var(--err-bg)',border:'0.5px solid var(--err-br)',borderRadius:'var(--r)',color:'var(--err)',fontSize:'11px'}}>{error}</div>}
              </div>
              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="bpri" disabled={loading}>{loading?'Salvando...':'Criar demanda'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
