'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createFeedBoardItemAction,
  deleteFeedBoardItemAction,
  reorderFeedBoardItemsAction,
  updateFeedBoardAction,
  updateFeedBoardItemAction,
} from '@/lib/actions'

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

function formatMonth(value: string) {
  if (!value) return 'Sem periodo'
  const key = String(value).slice(0, 7)
  const [year, month] = key.split('-')
  return `${month}/${year}`
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR')
}

function safeFileName(name: string) {
  return String(name || 'capa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .toLowerCase()
}

function statusTone(status: string) {
  if (status === 'approved') return 'bok'
  if (status === 'changes_requested' || status === 'rejected') return 'berr'
  return 'bwarn'
}

export default function FeedBoardEditor({ board, items = [], events = [], loadErrors = [] }: any) {
  const [gridItems, setGridItems] = useState<any[]>(Array.isArray(items) ? items : [])
  const [selected, setSelected] = useState<any>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [orderDirty, setOrderDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const sortedItems = useMemo(() => {
    return [...gridItems].sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
  }, [gridItems])

  const fillerCount = sortedItems.length === 0 ? 9 : (3 - (sortedItems.length % 3)) % 3

  async function uploadFiles(event: any) {
    const files = Array.from(event.target.files || []) as File[]
    if (!files.length) return

    setUploading(true)
    setError('')

    try {
      const supabase = createClient()

      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        if (!file.type.startsWith('image/')) continue

        const path = `${board.id}/${Date.now()}-${index}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from('feed-preview')
          .upload(path, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('feed-preview').getPublicUrl(path)

        const formData = new FormData()
        formData.set('board_id', board.id)
        formData.set('title', file.name.replace(/\.[^/.]+$/, ''))
        formData.set('storage_path', path)
        formData.set('cover_url', data.publicUrl)
        formData.set('position', String(sortedItems.length + index))

        const result = await createFeedBoardItemAction(formData)
        if ('error' in result) throw new Error(result.error)
      }

      window.location.reload()
    } catch (err: any) {
      setError(err?.message || 'Erro ao subir capas.')
      setUploading(false)
    }
  }

  function dropAt(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      return
    }

    const next = [...sortedItems]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)

    setGridItems(next.map((item, pos) => ({ ...item, position: pos })))
    setDragIndex(null)
    setOrderDirty(true)
  }

  async function saveOrder() {
    setSaving(true)
    setError('')
    const result = await reorderFeedBoardItemsAction(board.id, sortedItems.map((item) => item.id))
    if ('error' in result) {
      setError(result.error || 'Erro ao salvar ordem.')
      setSaving(false)
      return
    }
    setOrderDirty(false)
    setSaving(false)
  }

  async function updateBoard(event: any) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await updateFeedBoardAction(board.id, new FormData(event.currentTarget))
    if ('error' in result) {
      setError(result.error || 'Erro ao salvar documento.')
      setSaving(false)
      return
    }
    window.location.reload()
  }

  async function updateItem(event: any) {
    event.preventDefault()
    if (!selected) return

    setSaving(true)
    setError('')
    const result = await updateFeedBoardItemAction(selected.id, new FormData(event.currentTarget))
    if ('error' in result) {
      setError(result.error || 'Erro ao salvar item.')
      setSaving(false)
      return
    }
    window.location.reload()
  }

  async function deleteItem() {
    if (!selected) return
    if (!confirm('Remover esta capa da grade?')) return

    setSaving(true)
    const result = await deleteFeedBoardItemAction(selected.id, board.id)
    if ('error' in result) {
      setError(result.error || 'Erro ao remover item.')
      setSaving(false)
      return
    }
    window.location.reload()
  }

  function openFirstWithoutLink() {
    const item = sortedItems.find((entry) => !entry.content_url) || sortedItems[0]
    if (item) setSelected(item)
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <Link className="bsec" href="/dashboard/feed-preview"><i className="ti ti-arrow-left" /> Feed Preview</Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tb-title">{board.title}</div>
          <div className="tb-sub">{board.client?.name || 'Cliente'} · {formatMonth(board.period_month)} · {PRESET_LABEL[board.visual_preset] || 'Personalizado'}</div>
        </div>
        <button className="bsec" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <i className="ti ti-upload" /> {uploading ? 'Subindo...' : 'Subir capas'}
        </button>
        <button className="bsec" onClick={openFirstWithoutLink} disabled={!sortedItems.length}>
          <i className="ti ti-link" /> Adicionar links
        </button>
        <button className="bpri" onClick={saveOrder} disabled={!orderDirty || saving}>
          <i className="ti ti-device-floppy" /> {saving ? 'Salvando...' : orderDirty ? 'Salvar ordem' : 'Ordem salva'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={uploadFiles} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {error && <div className="notice notice-err" style={{ marginBottom: 14 }}><i className="ti ti-alert-circle" /><span>{error}</span></div>}
        {loadErrors.length > 0 && <div className="notice notice-err" style={{ marginBottom: 14 }}><i className="ti ti-alert-circle" /><span>{loadErrors.join(' | ')}</span></div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }}>
          <section>
            <div className="sh">
              <div>
                <div className="stitle">Grade visual</div>
                <div className="ssub">{sortedItems.length} capa(s). Arraste para definir a sequencia do documento.</div>
              </div>
              <span className="badge bblue">3 colunas</span>
            </div>

            <div style={{ background: '#0A0A0A', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, marginBottom: 14, borderBottom: '0.5px solid #1A1A1A' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#151515', color: '#DDD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
                  {String(board.client?.name || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>{board.client?.name || 'Cliente'}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{formatMonth(board.period_month)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
                {sortedItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropAt(index)}
                    onDragEnd={() => setDragIndex(null)}
                    onClick={() => setSelected(item)}
                    style={{
                      aspectRatio: '1',
                      background: '#151515',
                      border: dragIndex === index ? '2px solid var(--blue)' : '1px solid #222',
                      borderRadius: 6,
                      overflow: 'hidden',
                      position: 'relative',
                      padding: 0,
                      cursor: 'grab',
                    }}
                  >
                    {item.cover_url ? (
                      <img src={item.cover_url} alt={item.title || 'Capa'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
                        <i className="ti ti-photo" />
                      </div>
                    )}
                    <span style={{ position: 'absolute', top: 6, right: 6, padding: '3px 6px', borderRadius: 6, background: 'rgba(0,0,0,.78)', color: '#FFF', fontSize: 9, fontWeight: 800 }}>{index + 1}</span>
                    <span className={`badge ${statusTone(item.approval_status)}`} style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 9 }}>{item.approval_status === 'approved' ? 'Aprovado' : item.approval_status === 'changes_requested' ? 'Ajuste' : 'Pendente'}</span>
                    {item.content_url && <span style={{ position: 'absolute', right: 6, bottom: 6, color: '#FFF', background: 'rgba(0,0,0,.78)', borderRadius: 6, padding: '3px 6px', fontSize: 9 }}><i className="ti ti-link" /></span>}
                  </button>
                ))}

                {Array.from({ length: fillerCount }).map((_, index) => (
                  <button key={`empty-${index}`} type="button" onClick={() => inputRef.current?.click()} style={{ aspectRatio: '1', background: '#111', border: '1px dashed #252525', borderRadius: 6, color: '#333', fontSize: 22 }}>
                    +
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <form onSubmit={updateBoard} style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div className="stitle" style={{ marginBottom: 10 }}>Documento</div>
              <div className="fg"><label className="fl">Nome</label><input className="fi" name="title" defaultValue={board.title || ''} /></div>
              <div className="frow">
                <div className="fg">
                  <label className="fl">Status</label>
                  <select className="fi" name="status" defaultValue={board.status || 'draft'}>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Visual</label>
                  <select className="fi" name="visual_preset" defaultValue={board.visual_preset || 'custom'}>
                    {Object.entries(PRESET_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div className="fg"><label className="fl">Notas internas</label><textarea className="fi" name="notes" defaultValue={board.notes || ''} /></div>
              <button className="bpri" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>{saving ? 'Salvando...' : 'Salvar documento'}</button>
            </form>

            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div className="stitle">Itens</div>
              <div className="ssub" style={{ marginBottom: 10 }}>Clique em uma capa para adicionar link ou observacao.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {sortedItems.length === 0 ? <div className="empty-inline">Nenhuma capa adicionada.</div> : sortedItems.map((item, index) => (
                  <button key={item.id} type="button" onClick={() => setSelected(item)} style={{ textAlign: 'left', background: 'var(--s2)', border: '0.5px solid var(--b1)', borderRadius: 10, padding: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <b style={{ color: 'var(--t2)', fontSize: 11 }}>{index + 1}</b>
                      <span style={{ color: 'var(--t1)', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Sem titulo'}</span>
                    </div>
                    <small style={{ color: item.content_url ? 'var(--ok)' : 'var(--t4)' }}>{item.content_url ? 'Link adicionado' : 'Sem link'}</small>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div className="stitle">Historico</div>
              <div className="ssub" style={{ marginBottom: 10 }}>Registro vivo do documento.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {events.length === 0 ? <div className="empty-inline">Sem historico ainda.</div> : events.map((event: any) => (
                  <div key={event.id} style={{ borderLeft: '3px solid var(--blue)', paddingLeft: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)' }}>{event.message}</div>
                    <div style={{ fontSize: 10, color: 'var(--t4)' }}>{event.actor_name || 'Ampy Digital'} · {formatDateTime(event.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {selected && (
        <div className="modal-ov" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Editar item da grade</div>
                <div className="modal-sub">Adicione o link do video/post/Drive e observacoes.</div>
              </div>
              <button className="mclose" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>

            <form onSubmit={updateItem}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
                  <div style={{ aspectRatio: '1', background: '#111', borderRadius: 12, overflow: 'hidden', border: '0.5px solid var(--b1)' }}>
                    {selected.cover_url && <img src={selected.cover_url} alt={selected.title || 'Capa'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div>
                    <div className="fg"><label className="fl">Titulo / referencia</label><input className="fi" name="title" defaultValue={selected.title || ''} /></div>
                    <div className="fg"><label className="fl">Link do video/post/Drive</label><input className="fi" name="content_url" defaultValue={selected.content_url || ''} placeholder="https://drive.google.com/..." /></div>
                    <div className="fg"><label className="fl">Legenda / texto de apoio</label><textarea className="fi" name="caption" defaultValue={selected.caption || ''} /></div>
                    <div className="fg"><label className="fl">Observacoes internas</label><textarea className="fi" name="internal_notes" defaultValue={selected.internal_notes || ''} /></div>
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="bsec danger-action" onClick={deleteItem}>Remover capa</button>
                <button type="button" className="bsec" onClick={() => setSelected(null)}>Cancelar</button>
                <button className="bpri" disabled={saving}>{saving ? 'Salvando...' : 'Salvar item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
