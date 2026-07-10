'use client'

import { useMemo, useState } from 'react'
import { submitFeedBoardClientDecisionAction } from '@/lib/actions'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  sent: 'Enviado',
  approved: 'Aprovado',
  changes_requested: 'Ajustes solicitados',
  archived: 'Arquivado',
  pending: 'Pendente',
}

function formatMonth(value: string) {
  if (!value) return 'Sem período'
  const key = String(value).slice(0, 7)
  const [year, month] = key.split('-')
  return `${month}/${year}`
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR')
}

function itemTone(status: string) {
  if (status === 'approved') return '#16A34A'
  if (status === 'changes_requested') return '#DC2626'
  return '#F59E0B'
}

function contentTypeLabel(type: string) {
  if (type === 'video') return 'Vídeo'
  if (type === 'carousel') return 'Carrossel'
  return 'Post'
}

export default function PublicApprovalView({ token, board, items = [], events = [] }: any) {
  const [boardStatus, setBoardStatus] = useState(board.status || 'in_progress')
  const [approvalItems, setApprovalItems] = useState<any[]>(Array.isArray(items) ? items : [])
  const [localEvents, setLocalEvents] = useState<any[]>(Array.isArray(events) ? events : [])
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const summary = useMemo(() => {
    return {
      total: approvalItems.length,
      approved: approvalItems.filter((item) => item.approval_status === 'approved').length,
      changes: approvalItems.filter((item) => item.approval_status === 'changes_requested').length,
      pending: approvalItems.filter((item) => !item.approval_status || item.approval_status === 'pending').length,
    }
  }, [approvalItems])

  async function submitDecision(event: any, item: any) {
    event.preventDefault()

    setSavingId(item.id)
    setError('')
    setMessage('')

    const formData = new FormData(event.currentTarget)
    const result = await submitFeedBoardClientDecisionAction(token, item.id, formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao registrar resposta.')
      setSavingId('')
      return
    }

    if ('item' in result && result.item) {
      setApprovalItems((current) => current.map((entry) => entry.id === result.item.id ? { ...entry, ...result.item } : entry))
    }

    if ('board_status' in result && result.board_status) {
      setBoardStatus(result.board_status)
    }

    const decision = String(formData.get('decision') || '')
    const feedback = String(formData.get('client_feedback') || '')

    setLocalEvents((current) => [
      {
        id: `local-${Date.now()}`,
        message: decision === 'approved' ? `Cliente aprovou o item "${item.title || 'Capa'}".` : `Cliente solicitou ajuste no item "${item.title || 'Capa'}".`,
        actor_name: String(formData.get('actor_name') || 'Cliente'),
        created_at: new Date().toISOString(),
      },
      ...current,
    ])

    setMessage(decision === 'approved' ? 'Aprovação registrada.' : 'Solicitação de ajuste registrada.')
    setSavingId('')

    if (feedback) {
      const field = document.getElementById(`feedback-${item.id}`) as HTMLTextAreaElement | null
      if (field) field.value = feedback
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#E8EDF5', color: '#07111F', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 18px 48px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#64748B', fontWeight: 800 }}>Aprovação de conteúdo</div>
            <h1 style={{ margin: '8px 0 6px', fontSize: 28, lineHeight: 1.1 }}>{board.title}</h1>
            <div style={{ color: '#475569', fontSize: 13 }}>
              {board.client?.name || 'Cliente'} · {formatMonth(board.period_month)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-flex', padding: '8px 12px', borderRadius: 999, background: '#FFF', border: '1px solid #CBD5E1', fontSize: 12, fontWeight: 800 }}>
              Status: {STATUS_LABEL[boardStatus] || boardStatus}
            </div>
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 11 }}>Documento enviado pela Ampy Digital</div>
          </div>
        </header>

        {message && (
          <div style={{ background: '#ECFDF5', border: '1px solid #86EFAC', color: '#166534', borderRadius: 14, padding: 12, marginBottom: 14, fontSize: 13, fontWeight: 700 }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 14, padding: 12, marginBottom: 14, fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 800 }}>Total</div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>{summary.total}</div>
          </div>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 800 }}>Aprovados</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#16A34A' }}>{summary.approved}</div>
          </div>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 800 }}>Ajustes</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#DC2626' }}>{summary.changes}</div>
          </div>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 800 }}>Pendentes</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#F59E0B' }}>{summary.pending}</div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
          <section style={{ background: '#050505', borderRadius: 22, padding: 16, border: '1px solid #0F172A' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {approvalItems.map((item, index) => (
                <article key={item.id} style={{ background: '#0F0F0F', borderRadius: 12, overflow: 'hidden', border: '1px solid #1F2937' }}>
                  <div style={{ aspectRatio: '9 / 16', position: 'relative', background: '#111' }}>
                    {item.cover_url && (
                      <img src={item.cover_url} alt={item.title || 'Capa'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}

                    {item.content_type === 'video' && (
                      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,0,0,.48)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
                          ▶
                        </span>
                      </span>
                    )}

                    {item.content_type === 'carousel' && (
                      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,.78)', color: '#FFF', borderRadius: 8, padding: '4px 7px', fontSize: 10, fontWeight: 900 }}>
                        Carrossel
                      </span>
                    )}

                    <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.78)', color: '#FFF', borderRadius: 8, padding: '4px 7px', fontSize: 11, fontWeight: 900 }}>
                      {index + 1}
                    </span>

                    <span style={{ position: 'absolute', left: 8, bottom: 8, background: itemTone(item.approval_status), color: '#FFF', borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 900 }}>
                      {STATUS_LABEL[item.approval_status] || 'Pendente'}
                    </span>
                  </div>

                  <form onSubmit={(event) => submitDecision(event, item)} style={{ background: '#FFF', padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>{item.title || `Post ${index + 1}`}</div>

                    {(item.source_file_name || item.scheduled_date || item.scheduled_time) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#64748B', fontSize: 10, marginBottom: 8 }}>
                        {item.source_file_name && <span>Arquivo: {item.source_file_name}</span>}
                        {(item.scheduled_date || item.scheduled_time) && <span>Programação: {item.scheduled_date || '--/--'} {item.scheduled_time || ''}</span>}
                      </div>
                    )}

                    {item.caption && (
                      <div style={{ color: '#475569', fontSize: 11, lineHeight: 1.45, marginBottom: 8 }}>{item.caption}</div>
                    )}

                    {item.content_url && (
                      <a href={item.content_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', marginBottom: 10, color: '#2563EB', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>
                        Abrir link do conteúdo
                      </a>
                    )}

                    <input type="hidden" name="actor_name" value="Cliente" />

                    <textarea
                      id={`feedback-${item.id}`}
                      name="client_feedback"
                      defaultValue={item.client_feedback || ''}
                      placeholder="Comentário ou ajuste..."
                      style={{
                        width: '100%',
                        minHeight: 72,
                        resize: 'vertical',
                        border: '1px solid #CBD5E1',
                        borderRadius: 10,
                        padding: 10,
                        fontFamily: 'inherit',
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        name="decision"
                        value="changes_requested"
                        disabled={savingId === item.id}
                        style={{
                          border: '1px solid #FCA5A5',
                          background: '#FEF2F2',
                          color: '#991B1B',
                          borderRadius: 10,
                          padding: '9px 8px',
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: 'pointer',
                        }}
                      >
                        Solicitar ajuste
                      </button>

                      <button
                        name="decision"
                        value="approved"
                        disabled={savingId === item.id}
                        style={{
                          border: '1px solid #86EFAC',
                          background: '#ECFDF5',
                          color: '#166534',
                          borderRadius: 10,
                          padding: '9px 8px',
                          fontSize: 11,
                          fontWeight: 900,
                          cursor: 'pointer',
                        }}
                      >
                        Aprovar
                      </button>
                    </div>
                  </form>
                </article>
              ))}
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 18, padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Como aprovar</div>
              <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.55 }}>
                Revise cada conteúdo em ordem. Se estiver correto, clique em Aprovar. Se precisar de ajuste, escreva o comentário e clique em Solicitar ajuste.
              </div>
            </div>

            <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 18, padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Histórico</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                {localEvents.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 12 }}>Nenhuma ação registrada ainda.</div>
                ) : localEvents.map((event: any) => (
                  <div key={event.id} style={{ borderLeft: '3px solid #2563EB', paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{event.message}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{event.actor_name || 'Cliente'} · {formatDateTime(event.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

