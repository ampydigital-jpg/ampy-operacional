import { createClient } from '@/lib/supabase/server'

const STATUS_POST: Record<string,any> = {
  draft: { label: 'Rascunho', color: '#555' },
  review: { label: 'Em revisão', color: '#F59E0B' },
  approved: { label: 'Aprovado ✓', color: '#22C55E' },
  scheduled: { label: 'Programado', color: '#3B82F6' },
  published: { label: 'Publicado', color: '#8B5CF6' },
}

export default async function AprovacaoPage({ params }: { params: { clientId: string } }) {
  const supabase = createClient()
  const [{ data: client }, { data: posts }] = await Promise.all([
    supabase.from('clients').select('name, avatar_initials, avatar_color, avatar_bg, instagram').eq('id', params.clientId).single(),
    supabase.from('feed_posts').select('*').eq('client_id', params.clientId).order('position'),
  ])

  if (!client) return <div style={{background:'#0C0C0C',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#FFF',fontFamily:'Poppins,sans-serif'}}>Cliente não encontrado.</div>

  return (
    <div style={{background:'#0C0C0C',minHeight:'100vh',fontFamily:'Poppins,sans-serif',color:'#E0E0E0'}}>
      {/* HEADER */}
      <div style={{background:'#101010',borderBottom:'0.5px solid #1C1C1C',padding:'20px',textAlign:'center'}}>
        <div style={{width:'52px',height:'52px',borderRadius:'50%',background:client.avatar_bg,color:client.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:700,margin:'0 auto 10px'}}>
          {client.avatar_initials}
        </div>
        <div style={{fontSize:'20px',fontWeight:600,color:'#FFF'}}>{client.name}</div>
        {client.instagram&&<div style={{fontSize:'12px',color:'#666',marginTop:'4px'}}>{client.instagram}</div>}
        <div style={{fontSize:'11px',color:'#444',marginTop:'8px'}}>Aprovação de Conteúdo — Ampy Digital</div>
      </div>

      <div style={{maxWidth:'800px',margin:'0 auto',padding:'24px 16px'}}>
        {/* GRID */}
        <div style={{marginBottom:'32px'}}>
          <div style={{fontSize:'12px',fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'12px'}}>Preview do Feed</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'3px',background:'#1A1A1A',borderRadius:'12px',overflow:'hidden',padding:'3px'}}>
            {posts.map((post:any,i:number) => (
              <div key={post.id} style={{aspectRatio:'1',background:post.cover_url?'transparent':'#222',borderRadius:'8px',overflow:'hidden',position:'relative'}}>
                {post.cover_url ? (
                  <img src={post.cover_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                ) : (
                  <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'4px'}}>
                    <div style={{fontSize:'11px',color:'#555',fontWeight:600}}>{i+1}</div>
                    <div style={{fontSize:'9px',color:'#444',textAlign:'center',padding:'0 4px'}}>{post.title}</div>
                  </div>
                )}
                <div style={{position:'absolute',bottom:'4px',left:'4px',padding:'2px 6px',borderRadius:'4px',background:'rgba(0,0,0,0.8)',color:STATUS_POST[post.status]?.color||'#888',fontSize:'8px',fontWeight:700}}>{STATUS_POST[post.status]?.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* LISTA DE POSTS */}
        <div style={{fontSize:'12px',fontWeight:600,color:'#888',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'12px'}}>Detalhes dos posts</div>
        {posts.map((post:any,i:number) => (
          <div key={post.id} style={{background:'#101010',border:'0.5px solid #1C1C1C',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
              <div style={{width:'28px',height:'28px',borderRadius:'7px',background:'#1A1A1A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#888',flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'12px',fontWeight:600,color:'#DDD'}}>{post.title||`Post ${i+1}`}</div>
                {post.date&&<div style={{fontSize:'10px',color:'#555',marginTop:'2px'}}>{new Date(post.date+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})} {post.time&&`às ${post.time}h`}</div>}
              </div>
              <span style={{fontSize:'10px',fontWeight:600,padding:'3px 10px',borderRadius:'6px',background:'#1A1A1A',color:STATUS_POST[post.status]?.color||'#888'}}>{STATUS_POST[post.status]?.label}</span>
            </div>
            {post.caption&&<div style={{fontSize:'12px',color:'#AAA',lineHeight:1.7,marginBottom:'8px',padding:'10px',background:'#0A0A0A',borderRadius:'8px'}}>{post.caption}</div>}
            {post.hashtags&&<div style={{fontSize:'11px',color:'#3B82F6',marginBottom:'8px'}}>{post.hashtags}</div>}
            {post.drive_link&&<a href={post.drive_link} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'5px',fontSize:'11px',color:'#22C55E',textDecoration:'none',padding:'5px 10px',background:'#052E16',borderRadius:'6px'}}>
              <i className="ti ti-brand-google-drive"/>Ver arquivo no Drive
            </a>}
            {post.notes&&(
              <div style={{marginTop:'10px',padding:'10px',background:'#1C1200',borderRadius:'8px',borderLeft:'3px solid #F59E0B'}}>
                <div style={{fontSize:'10px',color:'#F59E0B',fontWeight:600,marginBottom:'4px'}}>Observações</div>
                <div style={{fontSize:'11px',color:'#886600'}}>{post.notes}</div>
              </div>
            )}
          </div>
        ))}

        <div style={{textAlign:'center',padding:'24px',color:'#333',fontSize:'11px',marginTop:'20px'}}>
          Powered by <strong style={{color:'#555'}}>Ampy Digital</strong>
        </div>
      </div>

      <link href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet" />
    </div>
  )
}
