'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { archiveFeedBoardAction, createFeedBoardAction, deleteFeedBoardAction } from '@/lib/actions'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  sent: 'Enviado',
  approved: 'Aprovado',
  changes_requested: 'Ajustes solicitados',
  archived: 'Arquivado',
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(value: string) {
  if (!value) return 'Sem perÃ­odo'
  const key = String(value).slice(0, 7)
  const [year, month] = key.split('-')
  return `${month}/${year}`
}

function formatDateTime(value: string) {
  if (!value) return 'â€”'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'â€”' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function toneForStatus(status: string) {
  if (status === 'approved') return 'bok'
  if (status === 'changes_requested') return 'berr'
  if (status === 'sent' || status === 'in_progress') return 'bblue'
  if (status === 'archived') return 'bmut'
  return 'bwarn'
}

function filterMatch(scope: string, board: any) {
  const status = String(board.status || 'draft')
  const stats = board.stats || {}

  if (scope === 'active') return status !== 'archived'
  if (scope === 'pending') return Number(stats.pending || 0) > 0
  if (scope === 'changes') return status === 'changes_requested' || Number(stats.changes || 0) > 0
  if (scope === 'approved') return status === 'approved'
  if (scope === 'archived') return status === 'archived'
  if (scope === 'all') return true

  return status === scope
}

export default function FeedPreviewHome({ boards = [], clients = [], loadErrors = [] }: any) {
  const safeBoards = Array.isArray(boards) ? boards : []
  const safeClients = Array.isArray(clients) ? clients : []

  const [clientId, setClientId] = useState('all')
  const [scope, setScope] = useState('active')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('updated_desc')
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const activeClients = safeClients.filter((client: any) => String(client.status || 'active') === 'active')

  const counts = useMemo(() => {
    return {
      active: safeBoards.filter((board: any) => String(board.status || 'draft') !== 'archived').length,
      pending: safeBoards.filter((board: any) => Number(board.stats?.pending || 0) > 0).length,
      changes: safeBoards.filter((board: any) => Number(board.stats?.changes || 0) > 0 || String(board.status || '') === 'changes_requested').length,
      approved: safeBoards.filter((board: any) => String(board.status || '') === 'approved').length,
      archived: safeBoards.filter((board: any) => String(board.status || '') === 'archived').length,
      all: safeBoards.length,
    }
  }, [safeBoards])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()

    const filtered = safeBoards.filter((board: any) => {
      const matchesClient = clientId === 'all' || board.client_id === clientId
      const matchesScope = filterMatch(scope, board)
      const matchesSearch =
        !term ||
        [board.title, board.client?.name, board.client?.segment, board.stats?.last_event_message]
          .some((value) => String(value || '').toLowerCase().includes(term))

      return matchesClient && matchesScope && matchesSearch
    })

    return filtered.sort((a: any, b: any) => {
      if (sort === 'period_asc') return String(a.period_month || '').localeCompare(String(b.period_month || ''))
      if (sort === 'period_desc') return String(b.period_month || '').localeCompare(String(a.period_month || ''))
      if (sort === 'pending_desc') return Number(b.stats?.pending || 0) - Number(a.stats?.pending || 0)
      if (sort === 'changes_desc') return Number(b.stats?.changes || 0) - Number(a.stats?.changes || 0)
      if (sort === 'updated_asc') return new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime()
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    })
  }, [safeBoards, clientId, scope, query, sort])

  async function createBoard(event: any) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    formData.set('visual_preset', 'custom')
    formData.set('status', 'draft')

    const result = await createFeedBoardAction(formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao criar aprovaÃ§Ã£o.')
      setLoading(false)
      return
    }

    window.location.href = `/dashboard/feed-preview/${result.id}`
  }

  async function archiveBoard(boardId: string) {
    setLoading(true)
    setError('')

    const result = await archiveFeedBoardAction(boardId)

    if ('error' in result) {
      setError(result.error || 'Erro ao arquivar.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function deleteBoard(boardId: string) {
    setLoading(true)
    setError('')

    const result = await deleteFeedBoardAction(boardId)

    if ('error' in result) {
      setError(result.error || 'Erro ao excluir.')
      setLoading(false)
      return
    }

    window.location.reload()
  }

  const filters = [
    ['active', 'Ativos', counts.active],
    ['pending', 'Pendentes', counts.pending],
    ['changes', 'Com ajustes', counts.changes],
    ['approved', 'Aprovados', counts.approved],
    ['archived', 'Arquivados', counts.archived],
    ['all', 'Todos', counts.all],
  ]

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div>
          <div className="tb-title">AprovaÃ§Ãµes</div>
          <div className="tb-sub">Lista operacional de documentos enviados, pendentes e com ajustes.</div>
        </div>

        <button className="bpri" onClick={() => { setError(''); setModal(true) }}>
          <i className="ti ti-plus" /> Nova aprovaÃ§Ã£o
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loadErrors.length > 0 && (
          <div className="notice notice-err" style={{ marginBottom: 14 }}>
            <i className="ti ti-alert-circle" />
            <span>{loadErrors.join(' | ')}</span>
          </div>
        )}

        {error && (
          <div className="notice notice-err" style={{ marginBottom: 14 }}>
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
          </div>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
          <div className="metric"><div className="metric-lbl">Ativos</div><div className="metric-val">{counts.active}</div></div>
          <div className="metric"><div className="metric-lbl">Pendentes</div><div className="metric-val">{counts.pending}</div></div>
          <div className="metric"><div className="metric-lbl">Ajustes</div><div className="metric-val">{counts.changes}</div></div>
          <div className="metric"><div className="metric-lbl">Aprovados</div><div className="metric-val">{counts.approved}</div></div>
          <div className="metric"><div className="metric-lbl">Arquivos</div><div className="metric-val">{counts.archived}</div></div>
        </section>

        <div className="sh" style={{ marginBottom: 14 }}>
          <div>
            <div className="stitle">Documentos de aprovaÃ§Ã£o</div>
            <div className="ssub">Use a lista para priorizar ajustes, pendÃªncias e aprovaÃ§Ãµes por cliente.</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="sbox" style={{ minWidth: 260 }}>
              <i className="ti ti-search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar documento, cliente ou evento..." />
            </div>

            <select className="fi compact" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="all">Todos os clientes</option>
              {safeClients.map((client: any) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>

            <select className="fi compact" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="updated_desc">Atualizados recentemente</option>
              <option value="updated_asc">Mais antigos primeiro</option>
              <option value="period_asc">Menor perÃ­odo</option>
              <option value="period_desc">Maior perÃ­odo</option>
              <option value="pending_desc">Mais pendentes</option>
              <option value="changes_desc">Mais ajustes</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {filters.map(([value, label, count]: any) => (
            <button key={value} className={`fb ${scope === value ? 'on' : ''}`} onClick={() => setScope(value)}>
              {label} <span style={{ opacity: .7 }}>({count})</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <i className="ti ti-clipboard-check" />
            <div className="empty-title">Nenhuma aprovaÃ§Ã£o encontrada</div>
            <div className="empty-sub">Crie uma nova aprovaÃ§Ã£o ou ajuste os filtros.</div>
          </div>
        ) : (
          <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr .65fr .75fr .75fr .75fr 1.1fr .9fr', gap: 10, padding: '12px 14px', background: 'var(--s2)', color: 'var(--t3)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
              <div>Documento</div>
              <div>Cliente</div>
              <div>PerÃ­odo</div>
              <div>Status</div>
              <div>Itens</div>
              <div>PendÃªncias</div>
              <div>Ãšltima aÃ§Ã£o</div>
              <div>AÃ§Ãµes</div>
            </div>

            {visible.map((board: any) => {
              const stats = board.stats || {}
              const publicUrl = board.share_token ? `/aprovar/${board.share_token}` : ''

              return (
                <div key={board.id} style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr .65fr .75fr .75fr .75fr 1.1fr .9fr', gap: 10, alignItems: 'center', padding: '13px 14px', borderTop: '0.5px solid var(--b1)' }}>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/dashboard/feed-preview/${board.id}`} style={{ display: 'block', color: 'var(--t1)', fontSize: 13, fontWeight: 900, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {board.title}
                    </Link>
                    <div style={{ color: 'var(--t4)', fontSize: 10, marginTop: 3 }}>
                      Atualizado em {formatDateTime(board.updated_at)}
                    </div>
                  </div>

                  <div style={{ minWidth: 0, fontSize: 12, color: 'var(--t2)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {board.client?.name || 'Cliente nÃ£o encontrado'}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 800 }}>{formatMonth(board.period_month)}</div>

                  <div><span className={`badge ${toneForStatus(board.status)}`}>{STATUS_LABEL[board.status] || board.status}</span></div>

                  <div style={{ fontSize: 12, fontWeight: 900 }}>
                    {stats.total || 0}
                    <span style={{ color: 'var(--t4)', fontSize: 10, fontWeight: 700 }}> posts</span>
                  </div>

                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span className={`badge ${Number(stats.pending || 0) > 0 ? 'bwarn' : 'bmut'}`}>{stats.pending || 0} pend.</span>
                    <span className={`badge ${Number(stats.changes || 0) > 0 ? 'berr' : 'bmut'}`}>{stats.changes || 0} aj.</span>
                    <span className={`badge ${Number(stats.approved || 0) > 0 ? 'bok' : 'bmut'}`}>{stats.approved || 0} ok</span>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--t2)', fontSize: 11, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stats.last_event_message || 'Sem aÃ§Ã£o registrada'}
                    </div>
                    <div style={{ color: 'var(--t4)', fontSize: 10 }}>{formatDateTime(stats.last_event_at)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Link className="bsec" href={`/dashboard/feed-preview/${board.id}`}>Abrir</Link>
                    {publicUrl && <a className="bsec" href={publicUrl} target="_blank" rel="noreferrer">Cliente</a>}
                    {board.status !== 'archived' && <button className="bsec" type="button" disabled={loading} onClick={() => archiveBoard(board.id)}>Arquivar</button>}
                    <button className="bsec danger-action" type="button" disabled={loading} onClick={() => deleteBoard(board.id)}>Excluir</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Nova aprovaÃ§Ã£o</div>
                <div className="modal-sub">Crie o documento antes de subir as capas.</div>
              </div>
              <button className="mclose" onClick={() => setModal(false)}><i className="ti ti-x" /></button>
            </div>

            <form onSubmit={createBoard}>
              <div className="modal-body">
                <div className="fg">
                  <label className="fl">Cliente *</label>
                  <select className="fi" name="client_id" required>
                    <option value="">Selecionar cliente</option>
                    {activeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </div>

                <div className="fg">
                  <label className="fl">Nome da aprovaÃ§Ã£o *</label>
                  <input className="fi" name="title" defaultValue={`Feed Preview ${formatMonth(currentMonth())}`} required />
                </div>

                <div className="fg">
                  <label className="fl">PerÃ­odo *</label>
                  <input className="fi" name="period_month" type="month" defaultValue={currentMonth()} required />
                </div>

                <div className="fg">
                  <label className="fl">ObservaÃ§Ãµes internas</label>
                  <textarea className="fi" name="notes" placeholder="ObservaÃ§Ãµes para a equipe." />
                </div>
              </div>

              <div className="modal-foot">
                <button className="bsec" type="button" onClick={() => setModal(false)}>Cancelar</button>
                <button className="bpri" disabled={loading}>{loading ? 'Criando...' : 'Criar aprovaÃ§Ã£o'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
