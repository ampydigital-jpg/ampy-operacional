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

const PRESET_LABEL: Record<string, string> = {
  custom: 'Personalizado',
  standard: 'Padrão',
  minimalist: 'Minimalista',
  creative: 'Criativo',
  neutral: 'Neutro',
  bold: 'Arrojado',
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(value: string) {
  if (!value) return 'Sem período'
  const key = String(value).slice(0, 7)
  const [year, month] = key.split('-')
  return `${month}/${year}`
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}

function toneForStatus(status: string) {
  if (status === 'approved') return 'bok'
  if (status === 'changes_requested') return 'berr'
  if (status === 'sent' || status === 'in_progress') return 'bblue'
  if (status === 'archived') return 'bmut'
  return 'bwarn'
}

function tabMatches(tab: string, status: string) {
  if (tab === 'active') return status !== 'archived'
  if (tab === 'files') return status === 'archived'
  if (tab === 'all') return true
  return status === tab
}

export default function FeedPreviewHome({ boards = [], clients = [], loadErrors = [] }: any) {
  const safeBoards = Array.isArray(boards) ? boards : []
  const safeClients = Array.isArray(clients) ? clients : []

  const [clientId, setClientId] = useState('all')
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const activeClients = safeClients.filter((client: any) => String(client.status || 'active') === 'active')

  const counts = useMemo(() => {
    return {
      active: safeBoards.filter((board: any) => String(board.status || 'draft') !== 'archived').length,
      draft: safeBoards.filter((board: any) => String(board.status || 'draft') === 'draft').length,
      in_progress: safeBoards.filter((board: any) => String(board.status || 'draft') === 'in_progress').length,
      changes_requested: safeBoards.filter((board: any) => String(board.status || 'draft') === 'changes_requested').length,
      approved: safeBoards.filter((board: any) => String(board.status || 'draft') === 'approved').length,
      files: safeBoards.filter((board: any) => String(board.status || 'draft') === 'archived').length,
      all: safeBoards.length,
    }
  }, [safeBoards])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()

    return safeBoards.filter((board: any) => {
      const statusValue = String(board.status || 'draft')
      const matchesClient = clientId === 'all' || board.client_id === clientId
      const matchesTab = tabMatches(tab, statusValue)
      const matchesSearch =
        !term ||
        [board.title, board.client?.name, board.client?.segment]
          .some((value) => String(value || '').toLowerCase().includes(term))

      return matchesClient && matchesTab && matchesSearch
    })
  }, [safeBoards, clientId, tab, query])

  async function createBoard(event: any) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    formData.set('visual_preset', 'custom')
    formData.set('status', 'draft')

    const result = await createFeedBoardAction(formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao criar aprovação.')
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

  const tabs = [
    ['active', 'Ativos', counts.active],
    ['draft', 'Rascunhos', counts.draft],
    ['in_progress', 'Em andamento', counts.in_progress],
    ['changes_requested', 'Ajustes', counts.changes_requested],
    ['approved', 'Aprovados', counts.approved],
    ['files', 'Arquivos', counts.files],
    ['all', 'Todos', counts.all],
  ]

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div>
          <div className="tb-title">Aprovações</div>
          <div className="tb-sub">Documentos visuais para aprovação de conteúdo por cliente.</div>
        </div>

        <button className="bpri" onClick={() => { setError(''); setModal(true) }}>
          <i className="ti ti-plus" /> Nova aprovação
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

        <div className="sh" style={{ marginBottom: 14 }}>
          <div>
            <div className="stitle">Documentos salvos</div>
            <div className="ssub">Crie, edite, arquive ou exclua grades de aprovação.</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="sbox" style={{ minWidth: 260 }}>
              <i className="ti ti-search" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar documento ou cliente..."
              />
            </div>

            <select className="fi compact" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="all">Todos os clientes</option>
              {safeClients.map((client: any) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {tabs.map(([value, label, count]: any) => (
            <button key={value} className={`fb ${tab === value ? 'on' : ''}`} onClick={() => setTab(value)}>
              {label} <span style={{ opacity: .7 }}>({count})</span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <i className="ti ti-clipboard-check" />
            <div className="empty-title">Nenhuma aprovação encontrada</div>
            <div className="empty-sub">
              Crie uma nova aprovação para subir capas, organizar a sequência e depois subir o feed para o cliente.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {visible.map((board: any) => (
              <div
                key={board.id}
                style={{
                  background: 'var(--s1)',
                  border: '0.5px solid var(--b1)',
                  borderRadius: 'var(--rc)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>
                      {board.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                      {board.client?.name || 'Cliente não encontrado'}
                    </div>
                  </div>

                  <span className={`badge ${toneForStatus(board.status)}`}>
                    {STATUS_LABEL[board.status] || board.status}
                  </span>
                </div>

                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="metric">
                    <div className="metric-lbl">Período</div>
                    <div className="metric-val" style={{ fontSize: 22 }}>{formatMonth(board.period_month)}</div>
                  </div>

                  <div className="metric">
                    <div className="metric-lbl">Visual</div>
                    <div className="metric-val" style={{ fontSize: 18 }}>
                      {PRESET_LABEL[board.visual_preset] || 'Personalizado'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 10, color: 'var(--t4)' }}>
                  Atualizado em {formatDate(board.updated_at)}
                </div>

                <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link className="bpri" href={`/dashboard/feed-preview/${board.id}`}>Abrir</Link>

                  {board.status !== 'archived' && (
                    <button className="bsec" type="button" disabled={loading} onClick={() => archiveBoard(board.id)}>
                      Arquivar
                    </button>
                  )}

                  <button className="bsec danger-action" type="button" disabled={loading} onClick={() => deleteBoard(board.id)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Nova aprovação</div>
                <div className="modal-sub">
                  Crie o documento antes de subir as capas. O visual será definido dentro da grade.
                </div>
              </div>

              <button className="mclose" onClick={() => setModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>

            <form onSubmit={createBoard}>
              <div className="modal-body">
                <div className="fg">
                  <label className="fl">Cliente *</label>
                  <select className="fi" name="client_id" required>
                    <option value="">Selecionar cliente</option>
                    {activeClients.map((client: any) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                <div className="fg">
                  <label className="fl">Período *</label>
                  <input className="fi" type="month" name="period_month" defaultValue={currentMonth()} required />
                </div>

                <div className="fg">
                  <label className="fl">Nome da aprovação</label>
                  <input className="fi" name="title" placeholder="Ex.: Aprovação Julho — Cliente" />
                </div>

                <div className="fg">
                  <label className="fl">Observações internas</label>
                  <textarea className="fi" name="notes" placeholder="Contexto interno da equipe..." />
                </div>

                {error && (
                  <div className="notice notice-err">
                    <i className="ti ti-alert-circle" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button className="bpri" disabled={loading}>{loading ? 'Criando...' : 'Criar aprovação'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}