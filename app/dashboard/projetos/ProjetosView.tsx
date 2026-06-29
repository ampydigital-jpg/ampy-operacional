'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_CFG: Record<string, any> = {
  not_started: { label: 'Não iniciada', color: 'var(--t3)' },
  in_progress: { label: 'Em andamento', color: 'var(--blue)' },
  waiting: { label: 'Aguardando', color: 'var(--warn)' },
  done: { label: 'Concluída', color: 'var(--ok)' },
  blocked: { label: 'Bloqueada', color: 'var(--err)' },
}

export default function ProjetosView({ demands, clients, profiles }: any) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [etapasMap, setEtapasMap] = useState<Record<string, any[]>>({})
  const [loadingEtapas, setLoadingEtapas] = useState<Record<string, boolean>>({})
  const [addEtapa, setAddEtapa] = useState<Record<string, boolean>>({})
  const [novaEtapa, setNovaEtapa] = useState<Record<string, any>>({})
  const supabase = createClient()

  async function toggleProjeto(id: string) {
    const isOpen = open[id]
    setOpen(o => ({ ...o, [id]: !isOpen }))
    if (!isOpen && !etapasMap[id]) {
      setLoadingEtapas(l => ({ ...l, [id]: true }))
      const { data } = await supabase.from('project_steps').select('*, responsible:profiles(full_name, avatar_initials)').eq('work_item_id', id).order('position')
      setEtapasMap(e => ({ ...e, [id]: data || [] }))
      setLoadingEtapas(l => ({ ...l, [id]: false }))
    }
  }

  async function salvarEtapa(workItemId: string) {
    const e = novaEtapa[workItemId]
    if (!e?.title) return
    const etapasAtuais = etapasMap[workItemId] || []
    const { data } = await supabase.from('project_steps').insert({
      work_item_id: workItemId,
      title: e.title,
      responsible_id: e.responsible_id || null,
      start_date: e.start_date || null,
      end_date: e.end_date || null,
      status: 'not_started',
      position: etapasAtuais.length,
    }).select('*, responsible:profiles(full_name, avatar_initials)').single()
    if (data) {
      setEtapasMap(em => ({ ...em, [workItemId]: [...etapasAtuais, data] }))
      setNovaEtapa(ne => ({ ...ne, [workItemId]: {} }))
      setAddEtapa(a => ({ ...a, [workItemId]: false }))
    }
  }

  async function updateEtapaStatus(etapaId: string, workItemId: string, status: string) {
    await supabase.from('project_steps').update({ status }).eq('id', etapaId)
    setEtapasMap(em => ({
      ...em,
      [workItemId]: em[workItemId].map(e => e.id === etapaId ? { ...e, status } : e)
    }))
  }

  async function deleteEtapa(etapaId: string, workItemId: string) {
    await supabase.from('project_steps').delete().eq('id', etapaId)
    setEtapasMap(em => ({
      ...em,
      [workItemId]: em[workItemId].filter(e => e.id !== etapaId)
    }))
  }

  if (demands.length === 0) {
    return (
      <div className="page-wrap">
        <div className="topbar"><div className="tb-title">Projetos</div></div>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="empty">
            <i className="ti ti-folder" />
            <div className="empty-title">Nenhum projeto ainda</div>
            <div className="empty-sub">Ao criar uma demanda, escolha "Projeto" como destino.<br />Ela aparecerá aqui com cronograma de etapas.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Projetos</div>
        <div className="tb-sub">{demands.length} projeto(s)</div>
      </div>
      <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
        {demands.map((d: any) => {
          const etapas = etapasMap[d.id] || []
          const total = etapas.length
          const concluidas = etapas.filter((e: any) => e.status === 'done').length
          const pct = total > 0 ? Math.round((concluidas/total)*100) : 0
          return (
            <div key={d.id} style={{background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',overflow:'hidden',marginBottom:'10px'}}>
              {/* CABEÇALHO DO PROJETO */}
              <div style={{padding:'16px',display:'flex',alignItems:'center',gap:'12px',cursor:'pointer'}} onClick={() => toggleProjeto(d.id)}>
                <div style={{width:'38px',height:'38px',borderRadius:'9px',background:d.client?.avatar_bg||'var(--blue-bg)',color:d.client?.avatar_color||'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{d.client?.avatar_initials||d.title.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--w)',letterSpacing:'-0.2px'}}>{d.title}</div>
                  <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{d.client?.name||'Interno'} · {d.type} · {d.responsible?.full_name||'Sem responsável'}</div>
                  {total > 0 && (
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'6px'}}>
                      <div style={{flex:1,height:'4px',background:'var(--s2)',borderRadius:'2px',overflow:'hidden'}}>
                        <div style={{width:`${pct}%`,height:'100%',background:pct===100?'var(--ok)':'var(--blue)',borderRadius:'2px',transition:'width .3s'}} />
                      </div>
                      <span style={{fontSize:'10px',color:'var(--t4)',whiteSpace:'nowrap'}}>{concluidas}/{total} etapas</span>
                    </div>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  {d.final_deadline && <span style={{fontSize:'10px',color:'var(--t4)'}}>{new Date(d.final_deadline+'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  <i className={`ti ti-chevron-down`} style={{color:'var(--t4)',fontSize:'14px',transition:'transform .15s',transform:open[d.id]?'rotate(180deg)':'none'}} />
                </div>
              </div>

              {/* ETAPAS */}
              {open[d.id] && (
                <div style={{borderTop:'0.5px solid var(--b1)',padding:'0 16px 16px'}}>
                  {loadingEtapas[d.id] ? (
                    <div style={{padding:'16px',textAlign:'center',color:'var(--t4)',fontSize:'11px'}}>Carregando etapas...</div>
                  ) : (
                    <>
                      {etapas.length === 0 && !addEtapa[d.id] && (
                        <div style={{padding:'16px 0',textAlign:'center',fontSize:'11px',color:'var(--t4)'}}>Nenhuma etapa cadastrada ainda.</div>
                      )}
                      {etapas.map((etapa: any, idx: number) => {
                        const st = STATUS_CFG[etapa.status] || STATUS_CFG.not_started
                        return (
                          <div key={etapa.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'0.5px solid #141414'}}>
                            <div style={{fontSize:'11px',fontWeight:700,color:'var(--t4)',minWidth:'24px'}}>{idx+1}</div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:'12px',fontWeight:500,color:'#DDD'}}>{etapa.title}</div>
                              <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>
                                {etapa.responsible?.full_name||'Sem responsável'}
                                {etapa.start_date && ` · ${new Date(etapa.start_date+'T00:00:00').toLocaleDateString('pt-BR')}`}
                                {etapa.end_date && ` → ${new Date(etapa.end_date+'T00:00:00').toLocaleDateString('pt-BR')}`}
                              </div>
                            </div>
                            <select value={etapa.status} onChange={e => updateEtapaStatus(etapa.id, d.id, e.target.value)} style={{background:'transparent',border:'none',color:st.color,fontSize:'11px',cursor:'pointer',outline:'none'}}>
                              <option value="not_started">Não iniciada</option>
                              <option value="in_progress">Em andamento</option>
                              <option value="waiting">Aguardando</option>
                              <option value="blocked">Bloqueada</option>
                              <option value="done">Concluída</option>
                            </select>
                            <button onClick={() => deleteEtapa(etapa.id, d.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t4)',fontSize:'12px'}}><i className="ti ti-trash" /></button>
                          </div>
                        )
                      })}

                      {addEtapa[d.id] ? (
                        <div style={{padding:'12px 0',borderBottom:'0.5px solid #141414'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                            <input className="fi" placeholder="Título da etapa *" value={novaEtapa[d.id]?.title||''} onChange={e => setNovaEtapa(ne => ({...ne,[d.id]:{...ne[d.id],title:e.target.value}}))} />
                            <select className="fi" value={novaEtapa[d.id]?.responsible_id||''} onChange={e => setNovaEtapa(ne => ({...ne,[d.id]:{...ne[d.id],responsible_id:e.target.value}}))}>
                              <option value="">Responsável...</option>
                              {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                            </select>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                            <input className="fi" type="date" value={novaEtapa[d.id]?.start_date||''} onChange={e => setNovaEtapa(ne => ({...ne,[d.id]:{...ne[d.id],start_date:e.target.value}}))} />
                            <input className="fi" type="date" value={novaEtapa[d.id]?.end_date||''} onChange={e => setNovaEtapa(ne => ({...ne,[d.id]:{...ne[d.id],end_date:e.target.value}}))} />
                          </div>
                          <div style={{display:'flex',gap:'8px'}}>
                            <button className="bsec" onClick={() => setAddEtapa(a => ({...a,[d.id]:false}))}>Cancelar</button>
                            <button className="bpri" onClick={() => salvarEtapa(d.id)}>Salvar etapa</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setAddEtapa(a => ({...a,[d.id]:true}))} style={{display:'flex',alignItems:'center',gap:'6px',padding:'10px 0',color:'var(--t4)',background:'none',border:'none',cursor:'pointer',fontSize:'11px',marginTop:'4px'}}>
                          <i className="ti ti-plus" />Adicionar etapa
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
