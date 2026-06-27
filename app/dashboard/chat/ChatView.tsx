'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const CHANNELS = [
  { id: 'geral', label: 'Geral', icon: 'ti-hash' },
  { id: 'planejamento', label: 'Planejamento', icon: 'ti-hash' },
  { id: 'captacao', label: 'Captação', icon: 'ti-hash' },
  { id: 'edicao', label: 'Edição', icon: 'ti-hash' },
  { id: 'design', label: 'Design', icon: 'ti-hash' },
  { id: 'feed', label: 'Feed e Programação', icon: 'ti-hash' },
  { id: 'trafego', label: 'Tráfego', icon: 'ti-hash' },
  { id: 'gestao', label: 'Gestão', icon: 'ti-hash' },
]

export default function ChatView({ currentProfile }: any) {
  const [channel, setChannel] = useState('geral')
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
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
    const { data } = await supabase.from('chat_messages').select('*, author:profiles(full_name, avatar_initials, avatar_bg, avatar_color)').eq('channel', channel).order('created_at', { ascending: true }).limit(50)
    setMessages(data || [])
  }

  async function sendMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    await supabase.from('chat_messages').insert({ channel, content: text.trim(), author_id: currentProfile?.id })
    setText('')
    setSending(false)
  }

  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const activeChannel = CHANNELS.find(c => c.id === channel)

  return (
    <div className="page-wrap">
      <div className="topbar"><div className="tb-title">Comunicação interna</div></div>
      <div className="chat-layout">
        <div className="chat-sb">
          <div className="chat-sb-title">Canais por setor</div>
          {CHANNELS.map(c => (
            <div key={c.id} className={`chat-ch ${channel === c.id ? 'active' : ''}`} onClick={() => setChannel(c.id)}>
              <i className={`ti ${c.icon}`} />{c.label}
            </div>
          ))}
        </div>
        <div className="chat-main">
          <div className="chat-head">
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--w)' }}>#{activeChannel?.label}</div>
            <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>Canal de comunicação da equipe</div>
          </div>
          <div className="chat-msgs">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--t4)', fontSize: '12px', marginTop: '40px' }}>Nenhuma mensagem ainda. Seja o primeiro a falar!</div>
            )}
            {messages.map((msg: any) => {
              const isMe = msg.author_id === currentProfile?.id
              return (
                <div key={msg.id} className={`msg ${isMe ? 'mine' : ''}`}>
                  <div className="msg-av" style={{ background: msg.author?.avatar_bg || 'var(--s2)', color: msg.author?.avatar_color || 'var(--t2)' }}>{msg.author?.avatar_initials || '?'}</div>
                  <div>
                    <div className="msg-name">{msg.author?.full_name || 'Usuário'}</div>
                    <div className="msg-bubble">
                      <div className="msg-text">{msg.content}</div>
                      <div className="msg-meta">{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-wrap">
            <textarea className="chat-input" placeholder={`Mensagem para #${activeChannel?.label}...`} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey} rows={1} />
            <button className="chat-send" onClick={sendMessage} disabled={sending}><i className="ti ti-send" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
