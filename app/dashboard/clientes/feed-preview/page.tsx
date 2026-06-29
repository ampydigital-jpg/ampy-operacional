import { createClient } from '@/lib/supabase/server'
import FeedPreviewView from './FeedPreviewView'

export default async function FeedPreviewPage({ searchParams }: { searchParams: { clientId?: string } }) {
  const supabase = createClient()
  const clientId = searchParams.clientId

  if (!clientId) {
    const { data: clients } = await supabase.from('clients').select('id, name, avatar_initials, avatar_color, avatar_bg').eq('status', 'active').order('name')
    return (
      <div className="page-wrap">
        <div className="topbar"><div className="tb-title">Feed Preview</div><div className="tb-sub">Aprovação de conteúdo</div></div>
        <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
          <div className="sh"><div className="stitle">Selecione o cliente</div></div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px',maxWidth:'600px'}}>
            {clients?.map((c:any) => (
              <a key={c.id} href={`/dashboard/clientes/feed-preview?clientId=${c.id}`} style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',background:'var(--s1)',border:'0.5px solid var(--b1)',borderRadius:'var(--rc)',textDecoration:'none',transition:'border-color .1s'}}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--b2)')} onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--b1)')}>
                <div style={{width:'36px',height:'36px',borderRadius:'9px',background:c.avatar_bg,color:c.avatar_color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700}}>{c.avatar_initials}</div>
                <div style={{fontSize:'12px',fontWeight:600,color:'#DDD'}}>{c.name}</div>
                <span className="badge bblue" style={{marginLeft:'auto'}}>Abrir feed →</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const [{ data: client }, { data: posts }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('feed_posts').select('*').eq('client_id', clientId).order('position'),
  ])

  return <FeedPreviewView client={client} posts={posts||[]} />
}
