'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_POST = [
  { value: 'draft', label: 'Rascunho', color: 'var(--t3)', bg: 'var(--s2)' },
  { value: 'review', label: 'Em revisão', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  { value: 'approved', label: 'Aprovado', color: 'var(--ok)', bg: 'var(--ok-bg)' },
  { value: 'scheduled', label: 'Programado', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  { value: 'published', label: 'Publicado', color: 'var(--purple)', bg: 'var(--purple-bg)' },
]

export default function FeedPreviewView({ client, posts: initialPosts }: any) {
  const [posts, setPosts] = useState(initialPosts)
  const [modal, setModal] = useState(false)
  const [editPost, setEditPost] = useState<any>(null)
  const [tema, setTema] = useState<'dark'|'light'>('dark')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const EMPTY_POST = { title:'', date:'', time:'09:00', status:'draft', caption:'', hashtags:'', drive_link:'', cover_url:'', notes:'', position: posts.length }

  async function salvarPost(data: any) {
    setLoading(true)
    if (data.id) {
      const { data: updated } = await supabase.from('feed_posts').update({...data, updated_at: new Date().toISOString()}).eq('id', data.id).select().single()
      if (updated) setPosts((prev: any[]) => prev.map(p => p.id===data.id ? updated : p))
    } else {
      const { data: created } = await supabase.from('feed_posts').insert({...data, client_id: client.id}).select().single()
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

  const linkAprovacao = typeof window !== 'undefined' ? `${window.location.origin}/aprovacao/${client.id}` : ''

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Feed Preview</div>
        <div className="tb-sub">{client?.name}</div>
        <div style={{display:'flex',gap:'6px'}}>
          <button className={`fb ${tema==='dark'?'on':''}`} onClick={() => setTema('dark')}>🌙 Dark</button>
          <button className={`fb ${tema==='light'?'on':''}`} onClick={() => setTema('light')}>☀️ Light</button>
        </div>
        <button className="bsec" onClick={() => navigator.clipboard.writeText(linkAprovacao).then(() => alert('Link copiado!'))}>
          <i className="ti ti-link" style={{fontSize:'12px'}}/> Link aprovação
        </button>
        <button className="bpri" onClick={() => { setEditPost({...EMPTY_POST}); setModal(true) }}>
          <i className="ti ti-plus" style={{fontSize:'12px'}}/> Novo post
        </button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:'16px'}}>
          {/* GRID DO FEED */}
          <div>
            <div className="sh">
              <div className="stitle">Preview do feed</div>
              <div className="ssub">{posts.length} posts</div>
            </div>
            <div style={{background:tema==='dark'?'#0A0A0A':'#F5F5F5',borderRadius:'var(--rc)',padding:'16px',border:'0.5px solid var(--b1)'}}>
              {/* Header estilo Instagram */}
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px',paddingBottom:'14px',borderBottom:`0.5px solid ${tema==='dark'?'#1A1A1A':'#E0E0E0'}`}}>
                <div style={{width:'38px',height:'38px',borderRadius:'50%',background:client?.avatar_bg,color:client?.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700}}>{client?.avatar_initials}</div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:tema==='dark'?'#FFF':'#000'}}>{client?.name?.toLowerCase().replace(/ /g,'')}</div>
                  {client?.instagram&&<div style={{fontSize:'10px',color:'#888'}}>{client.instagram}</div>}
                </div>
              </div>

              {posts.length === 0 ? (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'2px'}}>
                  {Array.from({length:9}).map((_,i) => (
                    <div key={i} style={{aspectRatio:'1',background:tema==='dark'?'#1A1A1A':'#E8E8E8',borderRadius:'4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <i className="ti ti-photo" style={{color:'#444',fontSize:'20px'}}/>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'2px'}}>
                  {posts.map((post:any,i:number) => {
                    const st = STATUS_POST.find(s=>s.value===post.status)||STATUS_POST[0]
                    return (
                      <div key={post.id} style={{aspectRatio:'1',background:post.cover_url?'transparent':tema==='dark'?'#1A1A1A':'#E8E8E8',borderRadius:'4px',overflow:'hidden',position:'relative',cursor:'pointer'}} onClick={() => { setEditPost(post); setModal(true) }}>
                        {post.cover_url ? (
                          <img src={post.cover_url} alt={post.title} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>(e.currentTarget.style.display='none')} />
                        ) : (
                          <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'4px'}}>
                            <i className="ti ti-photo" style={{color:'#444',fontSize:'18px'}}/>
                            <div style={{fontSize:'8px',color:'#444',textAlign:'center',padding:'0 4px'}}>{post.title||`Post ${i+1}`}</div>
                          </div>
                        )}
                        <div style={{position:'absolute',top:'4px',left:'4px',padding:'2px 6px',borderRadius:'4px',background:st.bg,color:st.color,fontSize:'8px',fontWeight:700}}>{st.label}</div>
                        <div style={{position:'absolute',top:'4px',right:'4px',padding:'2px 5px',borderRadius:'4px',background:'rgba(0,0,0,0.7)',color:'#FFF',fontSize:'8px',fontWeight:700}}>{i+1}</div>
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
              <div className="empty"><i className="ti ti-photo"/><div className="empty-title">Nenhum post</div><div className="empty-sub">Adicione os posts do mês para montar o feed.</div></div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {posts.map((post:any,i:number) => {
                  const st = STATUS_POST.find(s=>s.value===post.status)||STATUS_POST[0]
                  return (
                    <div key={post.id} style={{background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:'10px'}}>
                        <div style={{width:'24px',height:'24px',borderRadius:'6px',background:'var(--s2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:700,color:'var(--t2)',flexShrink:0}}>{i+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'11px',fontWeight:600,color:'#DDD'}}>{post.title||'Sem título'}</div>
                          {post.date&&<div style={{fontSize:'10px',color:'var(--t4)',marginTop:'2px'}}>{new Date(post.date+'T00:00:00').toLocaleDateString('pt-BR')} {post.time&&`às ${post.time}`}</div>}
                          {post.caption&&<div style={{fontSize:'10px',color:'var(--t3)',marginTop:'4px',lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{post.caption}</div>}
                          {post.drive_link&&<a href={post.drive_link} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'4px',fontSize:'9px',color:'var(--ok)',marginTop:'4px',textDecoration:'none'}}><i className="ti ti-brand-google-drive" style={{fontSize:'11px'}}/>Arquivo no Drive</a>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                          <span className="badge" style={{background:st.bg,color:st.color,fontSize:'9px'}}>{st.label}</span>
                          <div style={{display:'flex',gap:'4px'}}>
                            <button onClick={() => { setEditPost(post); setModal(true) }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t4)',fontSize:'12px'}}><i className="ti ti-edit"/></button>
                            <button onClick={() => deletarPost(post.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t4)',fontSize:'12px'}}><i className="ti ti-trash"/></button>
                          </div>
                        </div>
                      </div>
                      {post.notes&&<div style={{marginTop:'8px',padding:'6px 8px',background:'var(--warn-bg)',borderRadius:'6px',fontSize:'10px',color:'var(--warn)'}}>💬 {post.notes}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL POST */}
      {modal && editPost && (
        <div className="modal-ov" onClick={() => { setModal(false); setEditPost(null) }}>
          <div className="modal" style={{maxWidth:'560px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{editPost.id?'Editar post':'Novo post'}</div>
              <button className="mclose" onClick={() => { setModal(false); setEditPost(null) }}><i className="ti ti-x"/></button>
            </div>
            <div className="modal-body">
              <div className="frow">
                <div className="fg"><label className="fl">Título / referência</label><input className="fi" value={editPost.title||''} onChange={e=>setEditPost({...editPost,title:e.target.value})} placeholder="Ex: Post 1 - Dicas de saúde" /></div>
                <div className="fg"><label className="fl">Status</label><select className="fi" value={editPost.status||'draft'} onChange={e=>setEditPost({...editPost,status:e.target.value})}>{STATUS_POST.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
              </div>
              <div className="frow">
                <div className="fg"><label className="fl">Data de publicação</label><input className="fi" type="date" value={editPost.date||''} onChange={e=>setEditPost({...editPost,date:e.target.value})} /></div>
                <div className="fg"><label className="fl">Horário</label><input className="fi" type="time" value={editPost.time||'09:00'} onChange={e=>setEditPost({...editPost,time:e.target.value})} /></div>
              </div>
              <div className="fg"><label className="fl">Link da capa no Drive</label><input className="fi" value={editPost.drive_link||''} onChange={e=>setEditPost({...editPost,drive_link:e.target.value})} placeholder="https://drive.google.com/..." /></div>
              <div className="fg"><label className="fl">URL da imagem de capa (para preview)</label><input className="fi" value={editPost.cover_url||''} onChange={e=>setEditPost({...editPost,cover_url:e.target.value})} placeholder="https://..." /></div>
              <div className="fg"><label className="fl">Legenda</label><textarea className="fi" value={editPost.caption||''} onChange={e=>setEditPost({...editPost,caption:e.target.value})} placeholder="Texto da legenda do post..." style={{minHeight:'80px'}} /></div>
              <div className="fg"><label className="fl">Hashtags</label><input className="fi" value={editPost.hashtags||''} onChange={e=>setEditPost({...editPost,hashtags:e.target.value})} placeholder="#marketing #digital #ampy" /></div>
              <div className="fg"><label className="fl">Observações / feedback do cliente</label><textarea className="fi" value={editPost.notes||''} onChange={e=>setEditPost({...editPost,notes:e.target.value})} placeholder="Comentários, ajustes solicitados..." /></div>
            </div>
            <div className="modal-foot">
              <button className="bsec" onClick={() => { setModal(false); setEditPost(null) }}>Cancelar</button>
              <button className="bpri" disabled={loading} onClick={() => salvarPost(editPost)}>{loading?'Salvando...':'Salvar post'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
