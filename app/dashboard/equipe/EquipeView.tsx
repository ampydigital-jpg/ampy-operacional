'use client'
import { useState } from 'react'

const SETORES = [
  { nome: 'Planejamento', cargo: 'Estrategista Sênior', color: '#26C6DA', bg: '#0A1A1A' },
  { nome: 'Captação', cargo: 'Videomaker', color: 'var(--amber)', bg: 'var(--abg)' },
  { nome: 'Edição', cargo: 'Editor', color: '#FF7043', bg: '#1A0C0A' },
  { nome: 'Design', cargo: 'Designer', color: 'var(--purple)', bg: 'var(--pbg)' },
  { nome: 'Organização do Feed', cargo: 'Estrategista Júnior', color: '#66BB6A', bg: '#0A1A0A' },
  { nome: 'Programação das Postagens', cargo: 'Estrategista Júnior', color: 'var(--blue)', bg: 'var(--bbg)' },
  { nome: 'Tráfego', cargo: 'Gestor de Tráfego', color: '#42A5F5', bg: '#0A1520' },
  { nome: 'Gestão', cargo: 'Gerente de Operações', color: 'var(--amber)', bg: 'var(--abg)' },
  { nome: 'Administrativo', cargo: 'Coordenador Administrativo', color: 'var(--t3)', bg: 'var(--s2)' },
]

const roleLabels: Record<string, string> = {
  admin: 'Administrador', director: 'Direção', manager: 'Gestor',
  team_lead: 'Líder de Equipe', collaborator: 'Colaborador',
  freelancer: 'Freelancer', traffic: 'Tráfego', financial: 'Financeiro',
}

export default function EquipeView({ profiles }: any) {
  const [modal, setModal] = useState(false)

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="tb-title">Equipe</div>
        <button className="bpri" onClick={() => setModal(true)}><i className="ti ti-plus" style={{ fontSize: '12px' }} /> Novo membro</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="sh"><div className="stitle">Setores operacionais</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
          {SETORES.map(s => (
            <div key={s.nome} style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <div><div style={{ fontSize: '11px', fontWeight: 600, color: '#CCC' }}>{s.nome}</div><div style={{ fontSize: '10px', color: 'var(--t4)' }}>{s.cargo}</div></div>
            </div>
          ))}
        </div>

        <div className="sh"><div className="stitle">Membros</div><div className="ssub">{profiles.length} ativos</div></div>
        {profiles.length === 0 ? (
          <div className="empty"><i className="ti ti-users-group" /><div className="empty-title">Nenhum membro cadastrado</div><div className="empty-sub"><button className="bpri" onClick={() => setModal(true)} style={{ marginTop: '12px' }}>Adicionar primeiro membro</button></div></div>
        ) : (
          <div className="team-grid">
            {profiles.map((p: any) => (
              <div key={p.id} className="team-card">
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: p.avatar_bg || 'var(--s2)', color: p.avatar_color || 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>{p.avatar_initials}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--w)', letterSpacing: '-0.2px' }}>{p.full_name}</div>
                <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '2px', marginBottom: '6px' }}>{p.email}</div>
                <span className="badge bmut">{roleLabels[p.role] || p.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><div className="modal-title">Novo membro</div><button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button></div>
            <div className="modal-body">
              <div style={{ padding: '12px', background: 'var(--abg)', border: '0.5px solid var(--abr)', borderRadius: 'var(--r)', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--amber)' }}>Para adicionar membros, crie o usuário em <strong>Supabase → Authentication → Users</strong>, depois o usuário aparecerá aqui automaticamente.</div>
              </div>
              <div className="fg"><label className="fl">Email do novo membro</label><input className="fi" placeholder="membro@ampydigital.com.br" disabled /></div>
              <div style={{ fontSize: '11px', color: 'var(--t4)', lineHeight: 1.6 }}>
                1. Acesse supabase.com → projeto ampy-operacional<br />
                2. Authentication → Users → Add user<br />
                3. Preencha email e senha<br />
                4. O membro aparecerá automaticamente aqui
              </div>
            </div>
            <div className="modal-foot"><button className="bsec" onClick={() => setModal(false)}>Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
