'use client'

// AMPY-V17-A22 — EQUIPE, ACESSOS E SENHAS
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }
    // Redireciona via window para garantir que os cookies sejam enviados

const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser()

    let mustChangePassword = false

    if (user) {
      const {
        data: member,
      } =
        await supabase
          .from('team_members')
          .select('must_change_password')
          .eq('profile_id', user.id)
          .maybeSingle()

      mustChangePassword =
        member?.must_change_password ||
        false
    }

    window.location.href =
      mustChangePassword
        ? '/dashboard/minha-conta?troca=obrigatoria'
        : '/dashboard'
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0C0C0C', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'360px', background:'#101010', border:'0.5px solid #1C1C1C', borderRadius:'14px', padding:'32px' }}>
        <div style={{ marginBottom:'28px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'9px', background:'#1C1C1C', border:'0.5px solid #2A2A2A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:600, color:'#666', marginBottom:'16px' }}>A</div>
          <div style={{ fontSize:'18px', fontWeight:600, color:'#FFF', letterSpacing:'-0.3px' }}>Ampy Digital</div>
          <div style={{ fontSize:'11px', color:'#333', marginTop:'3px' }}>Gerenciador Operacional</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:'14px' }}>
            <label style={{ display:'block', fontSize:'9px', fontWeight:600, color:'#2E2E2E', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com.br" required style={{ width:'100%', padding:'9px 12px', background:'#141414', border:'0.5px solid #242424', borderRadius:'7px', color:'#E0E0E0', fontSize:'12px', outline:'none', fontFamily:'Poppins, sans-serif' }} />
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={{ display:'block', fontSize:'9px', fontWeight:600, color:'#2E2E2E', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'6px' }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ width:'100%', padding:'9px 12px', background:'#141414', border:'0.5px solid #242424', borderRadius:'7px', color:'#E0E0E0', fontSize:'12px', outline:'none', fontFamily:'Poppins, sans-serif' }} />
          </div>
          {error && <div style={{ padding:'9px 12px', background:'#180D0D', border:'0.5px solid #2A1515', borderRadius:'7px', color:'#CC3333', fontSize:'11px', marginBottom:'14px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%', padding:'10px', background:loading?'#333':'#FFFFFF', border:'none', borderRadius:'7px', color:'#0C0C0C', fontSize:'12px', fontWeight:600, cursor:loading?'not-allowed':'pointer', fontFamily:'Poppins, sans-serif' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
