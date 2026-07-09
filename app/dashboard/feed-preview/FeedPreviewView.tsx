'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

function normalizeText(value: any) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function dateKey(value: any) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function plannedDate(item: any) {
  return dateKey(item.final_deadline || item.internal_deadline || item.created_at)
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(value: string) {
  if (value === 'all') return 'Todos os periodos'
  const [year, month] = value.split('-')
  return `${month}/${year}`
}

function formatDate(value: any) {
  const key = dateKey(value)
  if (!key) return 'Sem data'
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}

function initials(name: string) {
  return String(name || 'AM')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AM'
}

function driveToImageUrl(url: string) {
  if (!url) return ''
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match2) return `https://drive.google.com/uc?export=view&id=${match2[1]}`
  if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url)) return url
  return ''
}

function isContentDemand(item: any) {
  const text = normalizeText([item.title, item.description, item.type, item.origin, item.destino, item.notes].join(' '))
  const include = [
    'planejamento',
    'captacao',
    'capta',
    'edicao',
    'edi',
    'design',
    'feed',
    'programacao',
    'social',
    'post',
    'posts',
    'reel',
    'story',
    'stories',
    'carrossel',
    'carousel',
    'conteudo',
    'legenda',
    'copy',
    'capa',
  ]

  const exclude = ['trafego', 'relatorio', 'reuniao', 'financeiro', 'interno']
  return include.some((word) => text.includes(word)) && !exclude.some((word) => text.includes(word))
}

function formatKind(item: any) {
  const text = normalizeText([item.title, item.description, item.type, item.notes].join(' '))
  if (text.includes('reel')) return 'Reel'
  if (text.includes('story') || text.includes('stories')) return 'Story'
  if (text.includes('carrossel') || text.includes('carousel')) return 'Carrossel'
  if (text.includes('capa')) return 'Capa'
  if (text.includes('programacao')) return 'Programacao'
  if (text.includes('feed')) return 'Feed'
  return item.type || 'Conteudo'
}

function statusMeta(item: any) {
  const status = normalizeText(item.status)
  const due = plannedDate(item)
  const today = new Date().toISOString().slice(0, 10)
  const isDone = ['done', 'completed', 'closed', 'concluido', 'concluida', 'aprovado', 'published'].some((word) => status.includes(word))

  if (!isDone && due && due < today) return { label: 'Atrasado', tone: 'berr', color: 'var(--err)', bg: 'var(--err-bg)', br: 'var(--err-br)' }
  if (isDone) return { label: 'Entregue', tone: 'bok', color: 'var(--ok)', bg: 'var(--ok-bg)', br: 'var(--ok-br)' }
  if (status.includes('pending') || status.includes('pend') || status.includes('todo') || status.includes('backlog')) return { label: 'Pendente', tone: 'bwarn', color: 'var(--warn)', bg: 'var(--warn-bg)', br: 'var(--warn-br)' }
  if (status.includes('review') || status.includes('revis') || status.includes('aprov')) return { label: 'Revisao', tone: 'bblue', color: 'var(--blue)', bg: 'var(--blue-bg)', br: 'var(--blue-br)' }
  return { label: 'Andamento', tone: 'bblue', color: 'var(--blue)', bg: 'var(--blue-bg)', br: 'var(--blue-br)' }
}

function approvalLabel(item: any) {
  const status = normalizeText(item.status)
  if (status.includes('approved') || status.includes('aprov')) return 'Aprovacao interna'
  if (status.includes('review') || status.includes('revis')) return 'Em revisao'
  if (status.includes('changes') || status.includes('ajuste')) return 'Ajuste solicitado'
  return 'Preparar aprovacao'
}

export default function FeedPreviewView({ demands, clients, loadErrors = [] }: any) {
  const safeDemands = Array.isArray(demands) ? demands : []
  const safeClients = Array.isArray(clients) ? clients : []

  const [clientId, setClientId] = useState('all')
  const [period, setPeriod] = useState(currentMonthKey())
  const [mode, setMode] = useState('conteudo')

  const months = useMemo(() => {
    const values = new Set<string>()
    safeDemands.forEach((item: any) => {
      const key = plannedDate(item)
      if (key) values.add(key.slice(0, 7))
    })
    return Array.from(values).sort().reverse()
  }, [safeDemands])

  const contentDemands = useMemo(() => {
    return safeDemands.filter((item: any) => mode === 'all' || isContentDemand(item))
  }, [safeDemands, mode])

  const visible = useMemo(() => {
    return contentDemands
      .filter((item: any) => clientId === 'all' || item.client_id === clientId)
      .filter((item: any) => period === 'all' || plannedDate(item).slice(0, 7) === period)
      .sort((a: any, b: any) => {
        const da = plannedDate(a) || '9999-12-31'
        const db = plannedDate(b) || '9999-12-31'
        if (da !== db) return da.localeCompare(db)
        return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      })
  }, [contentDemands, clientId, period])

  const selectedClient = clientId === 'all' ? null : safeClients.find((client: any) => client.id === clientId)
  const gridItems = visible.slice(0, 60)
  const fillerCount = gridItems.length === 0 ? 9 : (3 - (gridItems.length % 3)) % 3

  const stats = useMemo(() => {
    const late = visible.filter((item: any) => statusMeta(item).label === 'Atrasado').length
    const done = visible.filter((item: any) => statusMeta(item).label === 'Entregue').length
    const pending = visible.filter((item: any) => statusMeta(item).label === 'Pendente').length
    return { total: visible.length, late, done, pending }
  }, [visible])

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div>
          <div className="tb-title">Feed Preview</div>
          <div className="tb-sub">Visao integrada das demandas de conteudo. A demanda continua sendo o registro principal.</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loadErrors.length > 0 && (
          <div className="empty" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
            <div className="empty-title">Aviso de carregamento</div>
            {loadErrors.map((error: string) => <div className="empty-sub" key={error}>{error}</div>)}
          </div>
        )}

        <div className="sh" style={{ marginBottom: 14 }}>
          <div>
            <div className="stitle">Filtros do preview</div>
            <div className="ssub">Cliente, periodo e origem dos itens exibidos no grid.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="fi compact" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="all">Todos os clientes</option>
              {safeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>

            <select className="fi compact" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="all">Todos os periodos</option>
              {!months.includes(currentMonthKey()) && <option value={currentMonthKey()}>{formatMonth(currentMonthKey())}</option>}
              {months.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
            </select>

            <select className="fi compact" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="conteudo">Somente conteudo</option>
              <option value="all">Todas demandas</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }}>
          <section>
            <div className="sh">
              <div>
                <div className="stitle">{selectedClient ? selectedClient.name : 'Feed geral'}</div>
                <div className="ssub">{visible.length} item(ns) em {formatMonth(period)}. Ordem visual nao altera data de publicacao.</div>
              </div>
              <span className="badge bblue">Grid 3 colunas</span>
            </div>

            <div style={{ background: '#0A0A0A', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, marginBottom: 14, borderBottom: '0.5px solid #1A1A1A' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#151515', color: '#DDD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                  {initials(selectedClient?.name || 'Ampy')}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>{selectedClient ? selectedClient.name : 'Ampy Digital'}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>Preview interno de conteudo</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
                {gridItems.map((item: any, index: number) => {
                  const meta = statusMeta(item)
                  const thumb = driveToImageUrl(item.drive_link || '')
                  return (
                    <Link
                      href={`/dashboard/demandas/${item.id}`}
                      key={item.id}
                      style={{
                        aspectRatio: '1',
                        background: '#181818',
                        borderRadius: 6,
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'block',
                        textDecoration: 'none',
                        border: '1px solid #222',
                      }}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.title || 'Demanda'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(event) => { event.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, textAlign: 'center' }}>
                          <i className="ti ti-photo" style={{ color: '#555', fontSize: 24 }} />
                          <div style={{ fontSize: 10, lineHeight: 1.25, color: '#BBB', fontWeight: 700 }}>{item.title || 'Demanda'}</div>
                          <div style={{ fontSize: 9, color: '#777' }}>{formatKind(item)}</div>
                        </div>
                      )}

                      <div style={{ position: 'absolute', top: 6, left: 6, padding: '3px 6px', borderRadius: 6, background: 'rgba(0,0,0,.78)', color: meta.color, fontSize: 9, fontWeight: 800 }}>
                        {meta.label}
                      </div>

                      <div style={{ position: 'absolute', top: 6, right: 6, padding: '3px 6px', borderRadius: 6, background: 'rgba(0,0,0,.78)', color: '#FFF', fontSize: 9, fontWeight: 800 }}>
                        {index + 1}
                      </div>

                      <div style={{ position: 'absolute', bottom: 6, left: 6, right: 6, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(0,0,0,.78)', color: '#DDD', fontSize: 9, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatKind(item)}</span>
                        <span style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(0,0,0,.78)', color: '#DDD', fontSize: 9, fontWeight: 700 }}>{formatDate(plannedDate(item)).slice(0, 5)}</span>
                      </div>
                    </Link>
                  )
                })}

                {Array.from({ length: fillerCount }).map((_, index) => (
                  <div key={`filler-${index}`} style={{ aspectRatio: '1', background: '#111', border: '1px dashed #252525', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="ti ti-plus" style={{ color: '#333', fontSize: 20 }} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="sh">
              <div>
                <div className="stitle">Resumo</div>
                <div className="ssub">Leitura do periodo filtrado.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="metric"><div className="metric-lbl">Itens</div><div className="metric-val">{stats.total}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--blue)' }} />Demandas</div></div>
              <div className="metric"><div className="metric-lbl">Entregas</div><div className="metric-val">{stats.done}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--ok)' }} />Concluidas</div></div>
              <div className="metric"><div className="metric-lbl">Pendencias</div><div className="metric-val">{stats.pending}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--warn)' }} />Abertas</div></div>
              <div className="metric"><div className="metric-lbl">Atrasos</div><div className="metric-val">{stats.late}</div><div className="metric-inf"><span className="dot" style={{ background: 'var(--err)' }} />Fora do prazo</div></div>
            </div>

            <div className="sh">
              <div>
                <div className="stitle">Itens do preview</div>
                <div className="ssub">Abrir item leva para a Demanda original.</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 }}>
              {visible.length === 0 ? (
                <div className="empty">
                  <i className="ti ti-photo" />
                  <div className="empty-title">Nenhum conteudo encontrado</div>
                  <div className="empty-sub">Crie ou classifique demandas de conteudo em Demandas para aparecerem aqui.</div>
                </div>
              ) : visible.map((item: any, index: number) => {
                const meta = statusMeta(item)
                return (
                  <Link href={`/dashboard/demandas/${item.id}`} key={item.id} style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: '12px 14px', textDecoration: 'none', display: 'block' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--t2)', flexShrink: 0 }}>{index + 1}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)', marginBottom: 3 }}>{item.title || 'Demanda sem titulo'}</div>
                        <div style={{ fontSize: 10, color: 'var(--t4)' }}>{item.client?.name || 'Interno Ampy'} · {formatKind(item)}</div>
                        <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 3 }}>{formatDate(plannedDate(item))} · {item.responsible?.full_name || 'Sem responsavel'}</div>
                      </div>
                      <span className={`badge ${meta.tone}`} style={{ whiteSpace: 'nowrap' }}>{meta.label}</span>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge bblue">Producao</span>
                      <span className="badge bmut">{approvalLabel(item)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', marginBottom: 6 }}>Limite desta Hotfix</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
                Esta versao e somente leitura integrada. Historico manual, reordenacao persistida, versionamento e aprovacao segura entram na proxima etapa.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
