'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const CHANNELS = [
  { id: 'geral', label: 'Geral', icon: 'ti-hash' },
  { id: 'planejamento', label: 'Planejamento', icon: 'ti-hash' },
  { id: 'captacao', label: 'Captação', icon: 'ti-hash' },
  { id: 'edicao', label: 'Edição', icon: 'ti-hash' },
  { id: 'design', label: 'Design', icon: 'ti-hash' },
  { id: 'feed', label: 'Feed e Prog.', icon: 'ti-hash' },
  { id: 'trafego', label: 'Tráfego', icon: 'ti-hash' },
  { id: 'gestao', label: 'Gestão', icon: 'ti-hash' },
]

export default function ChatView({ currentProfile }: any) {
  const [channel, setChannel] = useState('geral')
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [driveLink, setDriveLink] = useState('')
  const [showDriveInput, setShowDriveInput] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadMessages()
    const sub = supabase.channel(`chat:${channel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${channel}` }, payload => {
        setMessages(m => [...m, payload.new])
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [channel])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages() {
    const { data } = await supabase.from('chat_messages')
      .select('*, author:profiles(full_name, avatar_initials, avatar_bg, avatar_color)')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(50)
    setMessages(data || [])
  }

  async function sendMessage() {
    if (!text.trim() && !driveLink.trim()) return
    setSending(true)
    const content = driveLink.trim()
      ? JSON.stringify({ text: text.trim(), driveLink: driveLink.trim() })
      : text.trim()
    await supabase.from('chat_messages').insert({
      channel,
      content,
      author_id: currentProfile?.id,
    })
    setText('')
    setDriveLink('')
    setShowDriveInput(false)
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function parseContent(content: string) {
    try {
      const parsed = JSON.parse(content)
      if (parsed.text || parsed.driveLink) return parsed
    } catch {}
    return { text: content, driveLink: null }
  }

  const activeChannel = CHANNELS.find(c => c.id === channel)

  return (
    <div className="page-wrap">
      <div className="topbar"><div className="tb-title">Comunicação interna</div></div>
      <div className="chat-layout">
        <div className="chat-sb">
          <div className="chat-sb-title">Canais por setor</div>
          {CHANNELS.map(c => (
            <div key={c.id} className={`chat-ch ${channel===c.id?'active':''}`} onClick={() => setChannel(c.id)}>
              <i className={`ti ${c.icon}`}/>{c.label}
            </div>
          ))}
        </div>
        <div className="chat-main">
          <div style={{padding:'14px 18px',borderBottom:'0.5px solid var(--b1)',flexShrink:0}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'var(--w)'}}>#{activeChannel?.label}</div>
            <div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>Canal interno da equipe</div>
          </div>
          <div className="chat-msgs">
            {messages.length === 0 && (
              <div style={{textAlign:'center',color:'var(--t4)',fontSize:'12px',marginTop:'40px'}}>Nenhuma mensagem ainda. Seja o primeiro!</div>
            )}
            {messages.map((msg: any) => {
              const isMe = msg.author_id === currentProfile?.id
              const parsed = parseContent(msg.content)
              return (
                <div key={msg.id} className={`msg ${isMe?'mine':''}`}>
                  <div className="msg-av" style={{background:msg.author?.avatar_bg||'var(--s2)',color:msg.author?.avatar_color||'var(--t2)'}}>
                    {msg.author?.avatar_initials||'?'}
                  </div>
                  <div>
                    <div className="msg-name">{msg.author?.full_name||'Usuário'}</div>
                    <div className="msg-bubble">
                      {parsed.text && <div className="msg-text">{parsed.text}</div>}
                      {parsed.driveLink && (
                        <a href={parsed.driveLink} target="_blank" rel="noopener noreferrer"
                          style={{display:'inline-flex',alignItems:'center',gap:'6px',marginTop:parsed.text?'6px':'0',padding:'6px 10px',background:'var(--ok-bg)',border:'0.5px solid var(--ok-br)',borderRadius:'8px',fontSize:'11px',color:'var(--ok)',textDecoration:'none'}}>
                          <i className="ti ti-brand-google-drive" style={{fontSize:'13px'}}/>
                          <span>Arquivo no Drive</span>
                          <i className="ti ti-external-link" style={{fontSize:'11px'}}/>
                        </a>
                      )}
                      <div className="msg-meta">{new Date(msg.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className="chat-input-wrap" style={{flexDirection:'column',gap:'8px'}}>
            {showDriveInput && (
              <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',background:'var(--ok-bg)',border:'0.5px solid var(--ok-br)',borderRadius:'8px'}}>
                <i className="ti ti-brand-google-drive" style={{color:'var(--ok)',fontSize:'14px',flexShrink:0}}/>
                <input value={driveLink} onChange={e => setDriveLink(e.target.value)} placeholder="Cole o link do Drive aqui..." style={{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--t1)',fontSize:'12px',fontFamily:'Poppins,sans-serif'}} />
                <button onClick={() => { setDriveLink(''); setShowDriveInput(false) }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t4)',fontSize:'14px'}}><i className="ti ti-x"/></button>
              </div>
            )}
            <div style={{display:'flex',gap:'10px',alignItems:'flex-end'}}>
              <button onClick={() => setShowDriveInput(!showDriveInput)} title="Anexar link do Drive"
                style={{width:'38px',height:'38px',borderRadius:'10px',background:showDriveInput?'var(--ok-bg)':'var(--s2)',border:`0.5px solid ${showDriveInput?'var(--ok-br)':'var(--b2)'}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:showDriveInput?'var(--ok)':'var(--t3)',flexShrink:0}}>
                <i className="ti ti-brand-google-drive" style={{fontSize:'15px'}}/>
              </button>
              <textarea className="chat-input" placeholder={`Mensagem para #${activeChannel?.label}...`} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey} rows={1} />
              <button className="chat-send" onClick={sendMessage} disabled={sending}>
                <i className="ti ti-send"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
