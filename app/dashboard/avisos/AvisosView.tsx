'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIAS = [
  { value: 'geral', label: 'Geral', color: 'var(--blue)', bg: 'var(--blue-bg)', icon: 'ti-speakerphone' },
  { value: 'urgente', label: 'Urgente', color: 'var(--err)', bg: 'var(--err-bg)', icon: 'ti-alert-triangle' },
  { value: 'reuniao', label: 'Reunião', color: 'var(--purple)', bg: 'var(--purple-bg)', icon: 'ti-calendar-event' },
  { value: 'lembrete', label: 'Lembrete', color: 'var(--warn)', bg: 'var(--warn-bg)', icon: 'ti-bell' },
  { value: 'conquista', label: 'Conquista', color: 'var(--ok)', bg: 'var(--ok-bg)', icon: 'ti-trophy' },
]

export default function AvisosView({ avisos: initialAvisos, currentProfile }: any) {
  const [avisos, setAvisos] = useState(initialAvisos)
  const [modal, setModal] = useState(false)
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('geral')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const sub = supabase.channel('avisos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel=eq.avisos' }, payload => {
        setAvisos((prev: any[]) => [payload.new, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  async function handlePost() {
    if (!texto.trim()) return
    setSending(true)
    await supabase.from('chat_messages').insert({
      channel: 'avisos',
      content: JSON.stringify({ texto: texto.trim(), categoria }),
      author_id: currentProfile?.id,
    })
    setTexto('')
    setCategoria('geral')
    setModal(false)
    setSending(false)
  }

  function parseAviso(content: string) {
    try { return JSON.parse(content) }
    catch { return { texto: content, categoria: 'geral' } }
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Avisos</div>
        <div className="tb-sub">Mural interno da equipe</div>
        <button className="bpri" onClick={() => setModal(true)}>
          <i className="ti ti-speakerphone" style={{ fontSize: '12px' }} /> Novo aviso
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {avisos.length === 0 ? (
          <div className="empty">
            <i className="ti ti-speakerphone" />
            <div className="empty-title">Nenhum aviso publicado</div>
            <div className="empty-sub">Use o mural para comunicados, lembretes e conquistas da equipe.</div>
            <button className="bpri" onClick={() => setModal(true)} style={{ marginTop: '16px' }}>Criar primeiro aviso</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '720px', margin: '0 auto' }}>
            {avisos.map((av: any) => {
              const data = parseAviso(av.content)
              const cat = CATEGORIAS.find(c => c.value === data.categoria) || CATEGORIAS[0]
              const dt = new Date(av.created_at)
              return (
                <div key={av.id} style={{ background: 'var(--s1)', border: `0.5px solid ${cat.color}30`, borderRadius: 'var(--rc)', overflow: 'hidden' }}>
                  <div style={{ height: '3px', background: cat.color }} />
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`ti ${cat.icon}`} style={{ color: cat.color, fontSize: '16px' }} />
                      </div>
                      <div>
                        <span className="badge" style={{ background: cat.bg, color: cat.color, border: `0.5px solid ${cat.color}40`, fontSize: '9px', marginBottom: '3px' }}>{cat.label}</span>
                        <div style={{ fontSize: '10px', color: 'var(--t4)' }}>
                          {av.author?.full_name || 'Equipe'} · {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', width: '30px', height: '30px', borderRadius: '8px', background: av.author?.avatar_bg || 'var(--s2)', color: av.author?.avatar_color || 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                        {av.author?.avatar_initials || '?'}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#DDD', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{data.texto}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Novo aviso</div>
              <button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="fg">
                <label className="fl">Categoria</label>
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {CATEGORIAS.map(c => (
                    <button key={c.value} onClick={() => setCategoria(c.value)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '20px', border: `0.5px solid ${categoria === c.value ? c.color : 'var(--b2)'}`, background: categoria === c.value ? c.bg : 'transparent', color: categoria === c.value ? c.color : 'var(--t3)', fontSize: '11px', cursor: 'pointer' }}>
                      <i className={`ti ${c.icon}`} style={{ fontSize: '12px' }} />{c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fg">
                <label className="fl">Mensagem *</label>
                <textarea className="fi" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escreva o comunicado para a equipe..." style={{ minHeight: '120px' }} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="bsec" onClick={() => setModal(false)}>Cancelar</button>
              <button className="bpri" onClick={handlePost} disabled={sending || !texto.trim()}>{sending ? 'Publicando...' : 'Publicar aviso'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
