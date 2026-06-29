'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_POST = [
  { value: 'draft', label: 'Rascunho', color: 'var(--t3)', bg: 'var(--s2)', br: 'var(--b1)' },
  { value: 'review', label: 'Em revisão', color: 'var(--warn)', bg: 'var(--warn-bg)', br: 'var(--warn-br)' },
  { value: 'approved', label: 'Aprovado', color: 'var(--ok)', bg: 'var(--ok-bg)', br: 'var(--ok-br)' },
  { value: 'scheduled', label: 'Programado', color: 'var(--blue)', bg: 'var(--blue-bg)', br: 'var(--blue-br)' },
  { value: 'published', label: 'Publicado', color: 'var(--purple)', bg: 'var(--purple-bg)', br: 'var(--purple-br)' },
  { value: 'changes_requested', label: 'Ajuste solicitado', color: 'var(--err)', bg: 'var(--err-bg)', br: 'var(--err-br)' },
]

// Converte link do Drive para URL de imagem direta
function driveToImageUrl(url: string): string {
  if (!url) return ''
  // Formato: https://drive.google.com/file/d/FILE_ID/view
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
  // Formato: https://drive.google.com/open?id=FILE_ID
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match2) return `https://drive.google.com/uc?export=view&id=${match2[1]}`
  return url
}

export default function FeedPreviewView({ client, posts: initialPosts }: any) {
  const [posts, setPosts] = useState<any[]>(initialPosts || [])
  const [modal, setModal] = useState(false)
  const [editPost, setEditPost] = useState<any>(null)
  const [tema, setTema] = useState<'dark' | 'light'>('dark')
  const [loading, setLoading] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const supabase = createClient()

  const EMPTY_POST = {
    title: '', date: '', time: '09:00', status: 'draft',
    caption: '', hashtags: '', drive_link: '', cover_url: '', notes: '', position: posts.length
  }

  // Converte link do Drive automaticamente ao salvar
  function processPost(data: any) {
    const processed = { ...data }
    if (processed.drive_link && !processed.cover_url) {
      const converted = driveToImageUrl(processed.drive_link)
      if (converted !== processed.drive_link) processed.cover_url = converted
    } else if (processed.cover_url) {
      processed.cover_url = driveToImageUrl(processed.cover_url) || processed.cover_url
    }
    return processed
  }

  async function salvarPost(data: any) {
    setLoading(true)
    const processed = processPost(data)
    if (data.id) {
      const { data: updated } = await supabase.from('feed_posts')
        .update({ ...processed, updated_at: new Date().toISOString() })
        .eq('id', data.id).select().single()
      if (updated) setPosts((prev: any[]) => prev.map(p => p.id === data.id ? updated : p))
    } else {
      const { data: created } = await supabase.from('feed_posts')
        .insert({ ...processed, client_id: client.id, position: posts.length })
        .select().single()
      if (created) setPosts((prev: any[]) => [...prev, created])
    }
    setModal(false)
    setEditPost(null)
    setLoading(false)
  }

  async function deletarPost(id: string) {
    if (!confirm('Excluir este post?')) return
    await supabase.from('feed_posts').delete().eq('id', id)
    setPosts((prev: any[]) => prev.filter(p => p.id !== id))
  }

  // Drag and drop para reordenar
  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx) }

  async function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
    const reordered = [...posts]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    const updated = reordered.map((p, i) => ({ ...p, position: i }))
    setPosts(updated)
    setDragIdx(null)
    setDragOverIdx(null)
    // Salvar nova ordem no banco
    await Promise.all(updated.map(p => supabase.from('feed_posts').update({ position: p.position }).eq('id', p.id)))
  }

  const linkAprovacao = typeof window !== 'undefined' ? `${window.location.origin}/aprovacao/${client?.id}` : ''

  async function copiarLink() {
    await navigator.clipboard.writeText(linkAprovacao)
    alert('Link copiado! Envie para o cliente aprovar.')
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Feed Preview</div>
        <div className="tb-sub">{client?.name}</div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button className={`fb ${tema === 'dark' ? 'on' : ''}`} onClick={() => setTema('dark')}>🌙 Dark</button>
          <button className={`fb ${tema === 'light' ? 'on' : ''}`} onClick={() => setTema('light')}>☀️ Light</button>
        </div>
        <button className="bsec" onClick={copiarLink}>
          <i className="ti ti-link" style={{ fontSize: '12px' }} /> Link aprovação
        </button>
        <button className="bpri" onClick={() => { setEditPost({ ...EMPTY_POST }); setModal(true) }}>
          <i className="ti ti-plus" style={{ fontSize: '12px' }} /> Novo post
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>

          {/* GRID 3x3 com drag and drop */}
          <div>
            <div className="sh">
              <div className="stitle">Preview do feed</div>
              <div className="ssub">{posts.length} posts · arraste para reordenar</div>
            </div>
            <div style={{ background: tema === 'dark' ? '#0A0A0A' : '#F5F5F5', borderRadius: 'var(--rc)', padding: '16px', border: '0.5px solid var(--b1)' }}>
              {/* Header estilo Instagram */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '14px', borderBottom: `0.5px solid ${tema === 'dark' ? '#1A1A1A' : '#E0E0E0'}` }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: client?.avatar_bg, color: client?.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>{client?.avatar_initials}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: tema === 'dark' ? '#FFF' : '#000' }}>{client?.name?.toLowerCase().replace(/ /g, '')}</div>
                  {client?.instagram && <div style={{ fontSize: '10px', color: '#888' }}>{client.instagram}</div>}
                </div>
              </div>

              {posts.length === 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '2px' }}>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '1', background: tema === 'dark' ? '#1A1A1A' : '#E8E8E8', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-photo" style={{ color: '#444', fontSize: '20px' }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3px' }}>
                  {posts.map((post: any, i: number) => {
                    const st = STATUS_POST.find(s => s.value === post.status) || STATUS_POST[0]
                    const isDragging = dragIdx === i
                    const isOver = dragOverIdx === i
                    return (
                      <div key={post.id}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={e => handleDragOver(e, i)}
                        onDrop={() => handleDrop(i)}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                        style={{ aspectRatio: '1', background: post.cover_url ? 'transparent' : tema === 'dark' ? '#1A1A1A' : '#E8E8E8', borderRadius: '4px', overflow: 'hidden', position: 'relative', cursor: 'grab', opacity: isDragging ? 0.4 : 1, border: isOver ? '2px solid var(--blue)' : '2px solid transparent', transition: 'opacity .15s, border .1s' }}
                        onClick={() => { setEditPost(post); setModal(true) }}>
                        {post.cover_url ? (
                          <img src={post.cover_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <i className="ti ti-photo" style={{ color: '#444', fontSize: '18px' }} />
                            <div style={{ fontSize: '8px', color: '#444', textAlign: 'center', padding: '0 4px' }}>{post.title || `Post ${i + 1}`}</div>
                          </div>
                        )}
                        <div style={{ position: 'absolute', top: '4px', left: '4px', padding: '2px 5px', borderRadius: '4px', background: 'rgba(0,0,0,0.75)', color: st.color, fontSize: '8px', fontWeight: 700 }}>{st.label}</div>
                        <div style={{ position: 'absolute', top: '4px', right: '4px', padding: '2px 5px', borderRadius: '4px', background: 'rgba(0,0,0,0.75)', color: '#FFF', fontSize: '8px', fontWeight: 700 }}>{i + 1}</div>
                        {post.date && <div style={{ position: 'absolute', bottom: '4px', left: '4px', padding: '2px 5px', borderRadius: '4px', background: 'rgba(0,0,0,0.75)', color: '#CCC', fontSize: '8px' }}>{new Date(post.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {post.time}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* LISTA DE POSTS */}
          <div>
            <div className="sh"><div className="stitle">Posts cadastrados</div></div>
            {posts.length === 0 ? (
              <div className="empty">
                <i className="ti ti-photo" />
                <div className="empty-title">Nenhum post</div>
                <div className="empty-sub">Adicione os posts do mês para montar o feed.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {posts.map((post: any, i: number) => {
                  const st = STATUS_POST.find(s => s.value === post.status) || STATUS_POST[0]
                  return (
                    <div key={post.id} style={{ background: 'var(--s1)', border: `0.5px solid ${post.status === 'changes_requested' ? 'var(--err-br)' : 'var(--b1)'}`, borderRadius: 'var(--rc)', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#DDD' }}>{post.title || 'Sem título'}</div>
                          {post.date && <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px' }}>{new Date(post.date + 'T00:00:00').toLocaleDateString('pt-BR')} às {post.time}</div>}
                          {post.caption && <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption}</div>}
                          {post.drive_link && (
                            <a href={post.drive_link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--ok)', marginTop: '4px', textDecoration: 'none' }}>
                              <i className="ti ti-brand-google-drive" style={{ fontSize: '11px' }} />Ver no Drive
                            </a>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span className="badge" style={{ background: st.bg, color: st.color, border: `0.5px solid ${st.br}`, fontSize: '9px' }}>{st.label}</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => { setEditPost(post); setModal(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t4)', fontSize: '12px' }}><i className="ti ti-edit" /></button>
                            <button onClick={() => deletarPost(post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t4)', fontSize: '12px' }}><i className="ti ti-trash" /></button>
                          </div>
                        </div>
                      </div>
                      {/* Feedback do cliente */}
                      {post.client_feedback && (
                        <div style={{ marginTop: '8px', padding: '8px 10px', background: post.status === 'changes_requested' ? 'var(--err-bg)' : 'var(--ok-bg)', borderRadius: '6px', borderLeft: `3px solid ${post.status === 'changes_requested' ? 'var(--err)' : 'var(--ok)'}` }}>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: post.status === 'changes_requested' ? 'var(--err)' : 'var(--ok)', marginBottom: '3px' }}>
                            {post.status === 'changes_requested' ? '⚠ Ajuste solicitado pelo cliente' : '✓ Aprovado pelo cliente'}
                          </div>
                          {post.client_feedback !== 'approved' && <div style={{ fontSize: '10px', color: 'var(--t2)' }}>{post.client_feedback}</div>}
                          {post.approved_at && <div style={{ fontSize: '9px', color: 'var(--t4)', marginTop: '3px' }}>{new Date(post.approved_at).toLocaleString('pt-BR')}</div>}
                        </div>
                      )}
                      {post.notes && <div style={{ marginTop: '8px', padding: '6px 8px', background: 'var(--warn-bg)', borderRadius: '6px', fontSize: '10px', color: 'var(--warn)' }}>📝 {post.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Link de aprovação */}
            <div style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>Link de aprovação</div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '8px', wordBreak: 'break-all' }}>{linkAprovacao}</div>
              <button className="bpri" style={{ width: '100%', justifyContent: 'center' }} onClick={copiarLink}>
                <i className="ti ti-copy" style={{ fontSize: '12px' }} /> Copiar link para o cliente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL EDIÇÃO/CRIAÇÃO DE POST */}
      {modal && editPost && (
        <div className="modal-ov" onClick={() => { setModal(false); setEditPost(null) }}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editPost.id ? 'Editar post' : 'Novo post'}</div>
              <button className="mclose" onClick={() => { setModal(false); setEditPost(null) }}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="frow">
                <div className="fg"><label className="fl">Título / referência</label><input className="fi" value={editPost.title || ''} onChange={e => setEditPost({ ...editPost, title: e.target.value })} placeholder="Ex: Post 1 — Dicas jurídicas" /></div>
                <div className="fg">
                  <label className="fl">Status</label>
                  <select className="fi" value={editPost.status || 'draft'} onChange={e => setEditPost({ ...editPost, status: e.target.value })}>
                    {STATUS_POST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Data de publicação</label><input className="fi" type="date" value={editPost.date || ''} onChange={e => setEditPost({ ...editPost, date: e.target.value })} /></div>
                <div className="fg"><label className="fl">Horário</label><input className="fi" type="time" value={editPost.time || '09:00'} onChange={e => setEditPost({ ...editPost, time: e.target.value })} /></div>
              </div>
              <div className="fg">
                <label className="fl">Link do arquivo no Drive</label>
                <input className="fi" value={editPost.drive_link || ''} onChange={e => setEditPost({ ...editPost, drive_link: e.target.value })} placeholder="https://drive.google.com/file/d/..." />
                <div style={{ fontSize: '9px', color: 'var(--t4)', marginTop: '4px' }}>Links do Drive são convertidos automaticamente para preview</div>
              </div>
              <div className="fg"><label className="fl">URL da imagem de capa (opcional)</label><input className="fi" value={editPost.cover_url || ''} onChange={e => setEditPost({ ...editPost, cover_url: e.target.value })} placeholder="https://... (deixe vazio para usar o Drive)" /></div>
              <div className="fg"><label className="fl">Legenda</label><textarea className="fi" value={editPost.caption || ''} onChange={e => setEditPost({ ...editPost, caption: e.target.value })} placeholder="Texto da legenda do post..." style={{ minHeight: '80px' }} /></div>
              <div className="fg"><label className="fl">Hashtags</label><input className="fi" value={editPost.hashtags || ''} onChange={e => setEditPost({ ...editPost, hashtags: e.target.value })} placeholder="#marketing #digital" /></div>
              <div className="fg"><label className="fl">Observações internas</label><textarea className="fi" value={editPost.notes || ''} onChange={e => setEditPost({ ...editPost, notes: e.target.value })} placeholder="Notas da equipe..." /></div>
            </div>
            <div className="modal-foot">
              <button className="bsec" onClick={() => { setModal(false); setEditPost(null) }}>Cancelar</button>
              <button className="bpri" disabled={loading} onClick={() => salvarPost(editPost)}>{loading ? 'Salvando...' : 'Salvar post'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
