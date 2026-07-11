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
  if (!value) return 'Sem perÃ­odo'
  const key = String(value).slice(0, 7)
  const [year, month] = key.split('-')
  return `${month}/${year}`
}

function formatDateTime(value: string) {
  if (!value) return 'â€”'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'â€”' : date.toLocaleString('pt-BR')
}

function itemTone(status: string) {
  if (status === 'approved') return '#16A34A'
  if (status === 'changes_requested') return '#DC2626'
  return '#F59E0B'
}

function statusText(status: string) {
  if (status === 'approved') return 'Aprovado'
  if (status === 'changes_requested') return 'Ajuste'
  return 'Pendente'
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
  const [selectedId, setSelectedId] = useState(String((Array.isArray(items) && items[0]?.id) || ''))
  const [savingId, setSavingId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selected = approvalItems.find((item) => item.id === selectedId) || approvalItems[0] || null

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

    const submitter = event.nativeEvent?.submitter as HTMLButtonElement | null
    const formData = new FormData(event.currentTarget)

    if (submitter?.name) {
      formData.set(submitter.name, submitter.value)
    }

    const decision = String(formData.get('decision') || '')
    const feedback = String(formData.get('client_feedback') || '').trim()

    if (decision === 'changes_requested' && !feedback) {
      setError('Descreva o ajuste necessÃ¡rio antes de enviar.')
      return
    }

    setSavingId(item.id)
    setError('')
    setMessage('')

    const result = await submitFeedBoardClientDecisionAction(token, item.id, formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao registrar resposta.')
      setSavingId('')
      return
    }

    if ('item' in result && result.item) {
      setApprovalItems((current) => current.map((entry) => entry.id === result.item.id ? { ...entry, ...result.item } : entry))
      setSelectedId(result.item.id)
    }

    if ('board_status' in result && result.board_status) {
      setBoardStatus(result.board_status)
    }

    setLocalEvents((current) => [
      {
        id: `local-${Date.now()}`,
        message: decision === 'approved'
          ? `Cliente aprovou o item "${item.title || 'Post'}".`
          : `Cliente solicitou ajuste no item "${item.title || 'Post'}".`,
        actor_name: String(formData.get('actor_name') || 'Cliente'),
        created_at: new Date().toISOString(),
      },
      ...current,
    ])

    setMessage(decision === 'approved' ? 'AprovaÃ§Ã£o registrada.' : 'SolicitaÃ§Ã£o de ajuste registrada.')
    setSavingId('')
  }

  return (
    <main style={{ minHeight: '100vh', background: '#E8EDF5', color: '#07111F', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 16px 44px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#64748B', fontWeight: 900 }}>AprovaÃ§Ã£o de conteúdo</div>
            <h1 style={{ margin: '8px 0 6px', fontSize: 26, lineHeight: 1.1 }}>{board.title}</h1>
            <div style={{ color: '#475569', fontSize: 13 }}>
              {board.client?.name || 'Cliente'} · {formatMonth(board.period_month)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-flex', padding: '8px 12px', borderRadius: 999, background: '#FFF', border: '1px solid #CBD5E1', fontSize: 12, fontWeight: 900 }}>
              {STATUS_LABEL[boardStatus] || boardStatus}
            </div>
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 11 }}>Documento enviado pela Ampy Digital</div>
          </div>
        </header>

        {message && (
          <div style={{ background: '#ECFDF5', border: '1px solid #86EFAC', color: '#166534', borderRadius: 14, padding: 12, marginBottom: 14, fontSize: 13, fontWeight: 800 }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 14, padding: 12, marginBottom: 14, fontSize: 13, fontWeight: 800 }}>
            {error}
          </div>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900 }}>Total</div>
            <div style={{ fontSize: 26, fontWeight: 950 }}>{summary.total}</div>
          </div>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900 }}>Aprovados</div>
            <div style={{ fontSize: 26, fontWeight: 950, color: '#16A34A' }}>{summary.approved}</div>
          </div>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900 }}>Ajustes</div>
            <div style={{ fontSize: 26, fontWeight: 950, color: '#DC2626' }}>{summary.changes}</div>
          </div>
          <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900 }}>Pendentes</div>
            <div style={{ fontSize: 26, fontWeight: 950, color: '#F59E0B' }}>{summary.pending}</div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '390px minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
          <section style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 374, maxWidth: '100%', background: '#050505', border: '10px solid #111827', borderRadius: 42, padding: '16px 12px 22px', boxShadow: '0 28px 70px rgba(15,23,42,.35)' }}>
              <div style={{ width: 82, height: 5, borderRadius: 999, background: '#1F2937', margin: '0 auto 14px' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 12px', borderBottom: '0.5px solid #1F2937', marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#111827', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }}>
                  {String(board.client?.name || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.client?.name || 'Cliente'}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{formatMonth(board.period_month)} · toque no post para revisar</div>
                </div>
              </div>

              {approvalItems.length === 0 ? (
                <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 12, textAlign: 'center', padding: 20 }}>
                  Nenhum conteúdo disponÃ­vel para aprovaÃ§Ã£o.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                  {approvalItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      style={{
                        aspectRatio: '9 / 16',
                        background: '#111',
                        border: selected?.id === item.id ? '2px solid #60A5FA' : '1px solid #1F2937',
                        borderRadius: 8,
                        overflow: 'hidden',
                        padding: 0,
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      {item.cover_url && (
                        <img src={item.cover_url} alt={item.title || 'Post'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}

                      {item.content_type === 'video' && (
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,.48)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                            â–¶
                          </span>
                        </span>
                      )}

                      {item.content_type === 'carousel' && (
                        <span style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,0,0,.78)', color: '#FFF', borderRadius: 6, padding: '3px 6px', fontSize: 8, fontWeight: 900 }}>
                          Carrossel
                        </span>
                      )}

                      <span style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,.78)', color: '#FFF', borderRadius: 6, padding: '3px 6px', fontSize: 9, fontWeight: 900 }}>
                        {index + 1}
                      </span>

                      <span style={{ position: 'absolute', left: 5, bottom: 5, background: itemTone(item.approval_status), color: '#FFF', borderRadius: 6, padding: '3px 6px', fontSize: 8, fontWeight: 900 }}>
                        {statusText(item.approval_status)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section style={{ display: 'grid', gap: 14 }}>
            {selected ? (
              <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 22, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                      {contentTypeLabel(selected.content_type)} · {statusText(selected.approval_status)}
                    </div>
                    <h2 style={{ margin: '6px 0 0', fontSize: 20 }}>{selected.title || 'Post selecionado'}</h2>
                  </div>

                  <span style={{ background: itemTone(selected.approval_status), color: '#FFF', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 900 }}>
                    {STATUS_LABEL[selected.approval_status] || 'Pendente'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: 14, alignItems: 'start', marginBottom: 14 }}>
                  <div style={{ aspectRatio: '9 / 16', background: '#111', borderRadius: 14, overflow: 'hidden' }}>
                    {selected.cover_url && <img src={selected.cover_url} alt={selected.title || 'Post'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {selected.source_file_name && <div style={{ fontSize: 12, color: '#475569' }}><strong>Arquivo:</strong> {selected.source_file_name}</div>}
                    {(selected.scheduled_date || selected.scheduled_time) && <div style={{ fontSize: 12, color: '#475569' }}><strong>ProgramaÃ§Ã£o:</strong> {selected.scheduled_date || '--/--'} {selected.scheduled_time || ''}</div>}
                    {selected.caption && <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}><strong>Legenda:</strong> {selected.caption}</div>}
                    {selected.content_url && (
                      <a href={selected.content_url} target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontSize: 12, fontWeight: 900, textDecoration: 'none' }}>
                        Abrir link do conteúdo
                      </a>
                    )}
                  </div>
                </div>

                <form onSubmit={(event) => submitDecision(event, selected)}>
                  <input type="hidden" name="actor_name" value="Cliente" />

                  <label style={{ display: 'block', fontSize: 11, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>
                    Comentário para ajuste
                  </label>

                  <textarea
                    id={`feedback-${selected.id}`}
                    name="client_feedback"
                    defaultValue=""
                    placeholder="Descreva o que precisa ser ajustado. Para aprovar, o comentÃ¡rio Ã© opcional."
                    style={{
                      width: '100%',
                      minHeight: 118,
                      resize: 'vertical',
                      border: '1px solid #CBD5E1',
                      borderRadius: 14,
                      padding: 12,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      marginBottom: 12,
                      outline: 'none',
                    }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      name="decision"
                      value="changes_requested"
                      disabled={savingId === selected.id}
                      style={{
                        border: '1px solid #FCA5A5',
                        background: '#FEF2F2',
                        color: '#991B1B',
                        borderRadius: 12,
                        padding: '12px 10px',
                        fontSize: 13,
                        fontWeight: 950,
                        cursor: 'pointer',
                      }}
                    >
                      Solicitar ajuste
                    </button>

                    <button
                      name="decision"
                      value="approved"
                      disabled={savingId === selected.id}
                      style={{
                        border: '1px solid #86EFAC',
                        background: '#ECFDF5',
                        color: '#166534',
                        borderRadius: 12,
                        padding: '12px 10px',
                        fontSize: 13,
                        fontWeight: 950,
                        cursor: 'pointer',
                      }}
                    >
                      Aprovar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 22, padding: 18, color: '#64748B', fontSize: 13 }}>
                Selecione um conteúdo no celular para revisar.
              </div>
            )}

            <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 22, padding: 18 }}>
              <div style={{ fontWeight: 950, marginBottom: 8 }}>Como aprovar</div>
              <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.55 }}>
                Toque em um conteúdo no mockup de celular. Se estiver correto, clique em Aprovar. Se precisar de ajuste, descreva o pedido e clique em Solicitar ajuste.
              </div>
            </div>

            <div style={{ background: '#FFF', border: '1px solid #D5DFEC', borderRadius: 22, padding: 18 }}>
              <div style={{ fontWeight: 950, marginBottom: 12 }}>HistÃ³rico</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                {localEvents.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: 12 }}>Nenhuma aÃ§Ã£o registrada ainda.</div>
                ) : localEvents.map((event: any) => (
                  <div key={event.id} style={{ borderLeft: '3px solid #2563EB', paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 850 }}>{event.message}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{event.actor_name || 'Cliente'} · {formatDateTime(event.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
