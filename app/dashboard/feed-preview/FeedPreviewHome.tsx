'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createFeedBoardAction } from '@/lib/actions'

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
  standard: 'Padrao',
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
  if (!value) return 'Sem periodo'
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

export default function FeedPreviewHome({ boards = [], clients = [], loadErrors = [] }: any) {
  const safeBoards = Array.isArray(boards) ? boards : []
  const safeClients = Array.isArray(clients) ? clients : []
  const [clientId, setClientId] = useState('all')
  const [status, setStatus] = useState('open')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const activeClients = safeClients.filter((client: any) => String(client.status || 'active') === 'active')

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return safeBoards.filter((board: any) => {
      const statusValue = String(board.status || 'draft')
      const matchesClient = clientId === 'all' || board.client_id === clientId
      const matchesStatus = status === 'all'
        || (status === 'open' ? !['approved', 'archived'].includes(statusValue) : statusValue === status)
      const matchesSearch = !term || [board.title, board.client?.name, board.client?.segment].some((value) => String(value || '').toLowerCase().includes(term))
      return matchesClient && matchesStatus && matchesSearch
    })
  }, [safeBoards, clientId, status, query])

  async function createBoard(event: any) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result = await createFeedBoardAction(new FormData(event.currentTarget))
    if ('error' in result) {
      setError(result.error || 'Erro ao criar grade.')
      setLoading(false)
      return
    }
    window.location.href = `/dashboard/feed-preview/${result.id}`
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div>
          <div className="tb-title">Feed Preview</div>
          <div className="tb-sub">Documentos visuais de aprovacao por cliente. Upload, grade, links e historico.</div>
        </div>
        <button className="bpri" onClick={() => { setError(''); setModal(true) }}>
          <i className="ti ti-plus" /> Nova grade
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loadErrors.length > 0 && (
          <div className="notice notice-err" style={{ marginBottom: 14 }}>
            <i className="ti ti-alert-circle" />
            <span>{loadErrors.join(' | ')}</span>
          </div>
        )}

        <div className="sh" style={{ marginBottom: 14 }}>
          <div>
            <div className="stitle">Documentos de Feed Preview</div>
            <div className="ssub">Crie uma grade mensal, suba as capas e organize a sequencia para aprovacao.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="sbox" style={{ minWidth: 260 }}>
              <i className="ti ti-search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar documento ou cliente..." />
            </div>
            <select className="fi compact" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="all">Todos os clientes</option>
              {safeClients.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            <select className="fi compact" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="open">Abertos</option>
              <option value="draft">Rascunhos</option>
              <option value="in_progress">Em andamento</option>
              <option value="sent">Enviados</option>
              <option value="changes_requested">Ajustes solicitados</option>
              <option value="approved">Aprovados</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <i className="ti ti-grid-dots" />
            <div className="empty-title">Nenhuma grade encontrada</div>
            <div className="empty-sub">Crie uma nova grade para subir capas e montar o documento de aprovacao.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {visible.map((board: any) => (
              <Link
                href={`/dashboard/feed-preview/${board.id}`}
                key={board.id}
                style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 16, textDecoration: 'none', display: 'block' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>{board.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{board.client?.name || 'Cliente nao encontrado'}</div>
                  </div>
                  <span className={`badge ${toneForStatus(board.status)}`}>{STATUS_LABEL[board.status] || board.status}</span>
                </div>

                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="metric"><div className="metric-lbl">Periodo</div><div className="metric-val" style={{ fontSize: 22 }}>{formatMonth(board.period_month)}</div></div>
                  <div className="metric"><div className="metric-lbl">Visual</div><div className="metric-val" style={{ fontSize: 18 }}>{PRESET_LABEL[board.visual_preset] || 'Personalizado'}</div></div>
                </div>

                <div style={{ marginTop: 12, fontSize: 10, color: 'var(--t4)' }}>
                  Atualizado em {formatDate(board.updated_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-ov" onClick={() => setModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Nova grade de Feed Preview</div>
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

                <div className="frow">
                  <div className="fg">
                    <label className="fl">Periodo *</label>
                    <input className="fi" type="month" name="period_month" defaultValue={currentMonth()} required />
                  </div>
                  <div className="fg">
                    <label className="fl">Visual</label>
                    <select className="fi" name="visual_preset" defaultValue="custom">
                      <option value="custom">Personalizado</option>
                      <option value="standard">Padrao</option>
                      <option value="minimalist">Minimalista</option>
                      <option value="creative">Criativo</option>
                      <option value="neutral">Neutro</option>
                      <option value="bold">Arrojado</option>
                    </select>
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">Nome da grade</label>
                  <input className="fi" name="title" placeholder="Ex.: Feed Julho — Cliente" />
                </div>

                <div className="fg">
                  <label className="fl">Observacoes internas</label>
                  <textarea className="fi" name="notes" placeholder="Contexto interno da equipe..." />
                </div>

                {error && <div className="notice notice-err"><i className="ti ti-alert-circle" /><span>{error}</span></div>}
              </div>

              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setModal(false)}>Cancelar</button>
                <button className="bpri" disabled={loading}>{loading ? 'Criando...' : 'Criar grade'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
