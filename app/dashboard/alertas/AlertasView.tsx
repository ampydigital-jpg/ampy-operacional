'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type AlertItem = {
  id: string
  title: string
  client?: { name?: string | null } | null
  final_deadline?: string | null
  blocked_reason?: string | null
  section: string
  label: string
  color: string
}

function readKey(profileId?: string | null) { return `ampy-alertas-read-${profileId || 'local'}` }
function hideKey(profileId?: string | null) { return `ampy-alertas-hidden-${profileId || 'local'}` }
function fmt(value?: string | null) { return value ? new Date(`${String(value).slice(0,10)}T00:00:00`).toLocaleDateString('pt-BR') : 'sem prazo final' }

export default function AlertasView({ sections = [], profileId }: { sections: any[]; profileId?: string | null }) {
  const [readIds, setReadIds] = useState<string[]>([])
  const [hiddenIds, setHiddenIds] = useState<string[]>([])

  useEffect(() => {
    try {
      setReadIds(JSON.parse(localStorage.getItem(readKey(profileId)) || '[]'))
      setHiddenIds(JSON.parse(localStorage.getItem(hideKey(profileId)) || '[]'))
    } catch {
      setReadIds([]); setHiddenIds([])
    }
  }, [profileId])

  const flat: AlertItem[] = useMemo(() => sections.flatMap((section: any) => (section.items || []).map((item: any) => ({ ...item, section: section.title, label: section.label, color: section.color }))), [sections])
  const visible = flat.filter((item) => !hiddenIds.includes(`${item.section}-${item.id}`))
  const unread = visible.filter((item) => !readIds.includes(`${item.section}-${item.id}`))

  function persist(nextRead = readIds, nextHidden = hiddenIds) {
    localStorage.setItem(readKey(profileId), JSON.stringify(nextRead))
    localStorage.setItem(hideKey(profileId), JSON.stringify(nextHidden))
  }
  function markRead(key: string) {
    const next = readIds.includes(key) ? readIds : [...readIds, key]
    setReadIds(next); persist(next, hiddenIds)
  }
  function markAllRead() {
    const keys = visible.map((item) => `${item.section}-${item.id}`)
    const next = Array.from(new Set([...readIds, ...keys]))
    setReadIds(next); persist(next, hiddenIds)
  }
  function hideAlert(key: string) {
    const nextHidden = hiddenIds.includes(key) ? hiddenIds : [...hiddenIds, key]
    const nextRead = readIds.includes(key) ? readIds : [...readIds, key]
    setHiddenIds(nextHidden); setReadIds(nextRead); persist(nextRead, nextHidden)
  }
  function restoreHidden() {
    setHiddenIds([]); persist(readIds, [])
  }

  return <div className="page-wrap ops-page alerts-page">
    <div className="topbar">
      <div><div className="tb-title">Avisos operacionais</div><div className="tb-sub">Caixa de leitura da operação · {unread.length} não lido(s)</div></div>
      <div className="alert-actions"><button className="bsec" onClick={markAllRead}>Marcar tudo como lido</button><button className="bsec" onClick={restoreHidden}>Restaurar ocultos</button></div>
    </div>
    <div className="pad alerts-pad">
      <div className="metrics"><Metric label="Não lidos" value={unread.length} tone="warn"/><Metric label="Ativos" value={visible.length} tone="blue"/><Metric label="Ocultos" value={hiddenIds.length} tone="mut"/></div>
      {!visible.length ? <div className="empty"><i className="ti ti-circle-check"/><div className="empty-title">Nenhum aviso ativo</div><div className="empty-sub">Prazos, bloqueios, prioridades e entregas próximas aparecerão aqui.</div></div> : <div className="alerts-inbox">
        {sections.map((section: any) => {
          const items = visible.filter((item) => item.section === section.title)
          if (!items.length) return null
          return <section className="alert-section" key={section.title}><div className="sh"><div className="stitle">{section.title}</div><div className="ssub">{items.length}</div></div>{items.map((item) => {
            const key = `${item.section}-${item.id}`
            const isRead = readIds.includes(key)
            return <article className={`alert-card alert-mail ${isRead ? 'read' : 'unread'}`} key={key}>
              <i className="ti ti-alert-circle" style={{ color: item.color }}/>
              <Link href={`/dashboard/demandas/${item.id}`} className="alert-mail-main" onClick={() => markRead(key)}><b>{item.title}</b><small>{item.client?.name || 'Interno Ampy'} · prazo {fmt(item.final_deadline)}{item.blocked_reason ? ` · ${item.blocked_reason}` : ''}</small></Link>
              <span className="badge" style={{ color: item.color, borderColor: `${item.color}55`, background: `${item.color}15` }}>{item.label}</span>
              <span className={`read-state ${isRead ? 'done' : ''}`}>{isRead ? 'Lido por você' : 'Não lido'}</span>
              <button className="icon-button" title="Marcar como lido" onClick={() => markRead(key)}><i className="ti ti-check" /></button>
              <button className="icon-button danger" title="Apagar da caixa" onClick={() => hideAlert(key)}><i className="ti ti-trash" /></button>
            </article>
          })}</section>
        })}
      </div>}
    </div>
  </div>
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'warn' | 'blue' | 'mut' }) {
  const color = tone === 'warn' ? 'var(--warn)' : tone === 'blue' ? 'var(--blue)' : 'var(--t3)'
  return <div className="metric"><div className="metric-lbl">{label}</div><div className="metric-val" style={{ color }}>{value}</div><div className="metric-inf"><span className="dot" style={{ background: color }}/>Avisos</div></div>
}
