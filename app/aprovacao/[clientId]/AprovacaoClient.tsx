'use client'
import { useState } from 'react'

const STATUS_CFG: Record<string, any> = {
  draft: { label: 'Rascunho', color: '#666' },
  review: { label: 'Em revisão', color: '#F59E0B' },
  approved: { label: 'Aprovado ✓', color: '#22C55E' },
  scheduled: { label: 'Programado', color: '#3B82F6' },
  published: { label: 'Publicado', color: '#8B5CF6' },
  changes_requested: { label: 'Ajuste solicitado', color: '#EF4444' },
}

export default function AprovacaoClient({ client, posts: initialPosts, clientId }: any) {
  const [posts, setPosts] = useState<any[]>(initialPosts || [])
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<Record<string, boolean>>({})

  async function handleAprovar(postId: string) {
    setSaving(s => ({ ...s, [postId]: true }))
    await fetch('/api/aprovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, status: 'approved', feedback: 'approved' })
    })
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'approved', client_feedback: 'approved', approved_at: new Date().toISOString() } : p))
    setSaving(s => ({ ...s, [postId]: false }))
    setDone(d => ({ ...d, [postId]: true }))
  }

  async function handleSolicitarAjuste(postId: string) {
    const fb = feedbacks[postId]?.trim()
    if (!fb) { alert('Por favor descreva o ajuste necessário.'); return }
    setSaving(s => ({ ...s, [postId]: true }))
    await fetch('/api/aprovacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, status: 'changes_requested', feedback: fb })
    })
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'changes_requested', client_feedback: fb, approved_at: new Date().toISOString() } : p))
    setSaving(s => ({ ...s, [postId]: false }))
    setFeedbacks(f => ({ ...f, [postId]: '' }))
    setDone(d => ({ ...d, [postId]: true }))
  }

  const totalAprovados = posts.filter(p => p.status === 'approved').length
  const totalAjustes = posts.filter(p => p.status === 'changes_requested').length

  return (
    <div style={{ background: '#0C0C0C', minHeight: '100vh', fontFamily: 'Poppins,sans-serif', color: '#E0E0E0' }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: '#101010', borderBottom: '0.5px solid #1C1C1C', padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: client.avatar_bg, color: client.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, margin: '0 auto 10px' }}>
          {client.avatar_initials}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 600, color: '#FFF' }}>{client.name}</div>
        {client.instagram && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{client.instagram}</div>}
        <div style={{ fontSize: '11px', color: '#444', marginTop: '8px' }}>Aprovação de Conteúdo — Ampy Digital</div>

        {/* Status geral */}
        {posts.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
            <div style={{ padding: '6px 14px', borderRadius: '20px', background: '#052E16', border: '0.5px solid #22C55E', fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>
              {totalAprovados} aprovado(s)
            </div>
            {totalAjustes > 0 && (
              <div style={{ padding: '6px 14px', borderRadius: '20px', background: '#180D0D', border: '0.5px solid #EF4444', fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>
                {totalAjustes} ajuste(s)
              </div>
            )}
            <div style={{ padding: '6px 14px', borderRadius: '20px', background: '#0A0A0A', border: '0.5px solid #333', fontSize: '11px', color: '#666' }}>
              {posts.length} post(s) total
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        {/* GRID PREVIEW */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>Preview do Feed</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3px', background: '#1A1A1A', borderRadius: '12px', overflow: 'hidden', padding: '3px' }}>
            {(posts || []).map((post: any, i: number) => (
              <div key={post.id} style={{ aspectRatio: '1', background: post.cover_url ? 'transparent' : '#222', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                {post.cover_url ? (
                  <img src={post.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#555', fontWeight: 600 }}>{i + 1}</div>
                    <div style={{ fontSize: '9px', color: '#444', textAlign: 'center', padding: '0 4px' }}>{post.title}</div>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: '4px', left: '4px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.8)', color: STATUS_CFG[post.status]?.color || '#888', fontSize: '8px', fontWeight: 700 }}>
                  {STATUS_CFG[post.status]?.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* POSTS PARA APROVAÇÃO */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>Aprovar post a post</div>
        {(posts || []).map((post: any, i: number) => {
          const jaRespondido = done[post.id] || ['approved', 'changes_requested'].includes(post.status)
          return (
            <div key={post.id} style={{ background: '#101010', border: `0.5px solid ${post.status === 'changes_requested' ? '#2A1515' : post.status === 'approved' ? '#052E16' : '#1C1C1C'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#888', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#DDD' }}>{post.title || `Post ${i + 1}`}</div>
                  {post.date && <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{new Date(post.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} às {post.time}h</div>}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px', background: '#1A1A1A', color: STATUS_CFG[post.status]?.color || '#888' }}>
                  {STATUS_CFG[post.status]?.label}
                </span>
              </div>

              {post.cover_url && (
                <img src={post.cover_url} alt="" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />
              )}

              {post.caption && <div style={{ fontSize: '12px', color: '#AAA', lineHeight: 1.7, marginBottom: '8px', padding: '10px', background: '#0A0A0A', borderRadius: '8px' }}>{post.caption}</div>}
              {post.hashtags && <div style={{ fontSize: '11px', color: '#3B82F6', marginBottom: '12px' }}>{post.hashtags}</div>}
              {post.drive_link && (
                <a href={post.drive_link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#22C55E', textDecoration: 'none', padding: '5px 10px', background: '#052E16', borderRadius: '6px', marginBottom: '12px' }}>
                  <i className="ti ti-brand-google-drive" />Ver arquivo no Drive
                </a>
              )}

              {/* Botões de aprovação */}
              {!jaRespondido ? (
                <div style={{ borderTop: '0.5px solid #1A1A1A', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button onClick={() => handleAprovar(post.id)} disabled={saving[post.id]}
                      style={{ flex: 1, padding: '10px', background: '#052E16', border: '0.5px solid #22C55E', borderRadius: '8px', color: '#22C55E', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <i className="ti ti-check" /> {saving[post.id] ? 'Salvando...' : 'Aprovar este post'}
                    </button>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <textarea value={feedbacks[post.id] || ''} onChange={e => setFeedbacks(f => ({ ...f, [post.id]: e.target.value }))}
                      placeholder="Descreva o ajuste necessário..." rows={2}
                      style={{ width: '100%', padding: '8px 12px', background: '#0A0A0A', border: '0.5px solid #2A2A2A', borderRadius: '8px', color: '#CCC', fontSize: '12px', resize: 'vertical', fontFamily: 'Poppins,sans-serif', outline: 'none' }} />
                  </div>
                  <button onClick={() => handleSolicitarAjuste(post.id)} disabled={saving[post.id]}
                    style={{ width: '100%', padding: '10px', background: '#180D0D', border: '0.5px solid #EF4444', borderRadius: '8px', color: '#EF4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <i className="ti ti-alert-triangle" /> Solicitar ajuste
                  </button>
                </div>
              ) : (
                <div style={{ borderTop: '0.5px solid #1A1A1A', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className={`ti ${post.status === 'approved' ? 'ti-circle-check' : 'ti-alert-triangle'}`} style={{ color: post.status === 'approved' ? '#22C55E' : '#EF4444', fontSize: '16px' }} />
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: post.status === 'approved' ? '#22C55E' : '#EF4444' }}>
                      {post.status === 'approved' ? 'Aprovado por você' : 'Ajuste solicitado'}
                    </div>
                    {post.client_feedback && post.client_feedback !== 'approved' && (
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{post.client_feedback}</div>
                    )}
                    {post.approved_at && <div style={{ fontSize: '9px', color: '#444', marginTop: '2px' }}>{new Date(post.approved_at).toLocaleString('pt-BR')}</div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div style={{ textAlign: 'center', padding: '24px', color: '#333', fontSize: '11px', marginTop: '8px' }}>
          Powered by <strong style={{ color: '#555' }}>Ampy Digital</strong>
        </div>
      </div>
    </div>
  )
}
