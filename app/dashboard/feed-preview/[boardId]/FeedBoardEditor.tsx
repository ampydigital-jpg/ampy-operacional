'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createFeedBoardItemSmoothAction,
  deleteFeedBoardItemAction,
  publishFeedBoardAction,
  reorderFeedBoardItemsAction,
  updateFeedBoardSettingsAction,
  updateFeedBoardItemPlanningAction,
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
  standard: 'Padrão',
  minimalist: 'Minimalista',
  creative: 'Criativo',
  neutral: 'Neutro',
  bold: 'Arrojado',
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  post: 'Post',
  video: 'Vídeo',
  carousel: 'Carrossel',
}

const VIEW_LABEL: Record<string, string> = {
  grid: 'Grade',
  mobile: 'Celular',
  desktop: 'Desktop',
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
  if (status === 'pending') return 'bwarn'
  return 'bblue'
}

function getVisualTone(preset: string) {
  if (preset === 'minimalist') return 'Minimalista'
  if (preset === 'creative') return 'Criativo'
  if (preset === 'neutral') return 'Neutro'
  if (preset === 'bold') return 'Arrojado'
  if (preset === 'standard') return 'Padrão'
  return 'Personalizado'
}

export default function FeedBoardEditor({ board, items = [], events = [], assets = [], loadErrors = [] }: any) {
  const [boardState, setBoardState] = useState<any>(board)
  const [gridItems, setGridItems] = useState<any[]>(Array.isArray(items) ? items : [])
  const [localEvents, setLocalEvents] = useState<any[]>(Array.isArray(events) ? events : [])
  const [carouselAssets] = useState<any[]>(Array.isArray(assets) ? assets : [])
  const [selected, setSelected] = useState<any>(null)
  const [linksModal, setLinksModal] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'mobile' | 'desktop'>('grid')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [orderDirty, setOrderDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const sortedItems = useMemo(() => {
    return [...gridItems].sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
  }, [gridItems])

  const fillerCount = sortedItems.length === 0 ? 12 : Math.max(0, Math.min(12 - sortedItems.length, (3 - (sortedItems.length % 3)) % 3))

  function getAssetsForItem(itemId: any) {
    return carouselAssets
      .filter((asset) => asset.item_id === itemId)
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
  }

  function addLocalEvent(text: string) {
    setLocalEvents((current) => [
      {
        id: `local-${Date.now()}`,
        message: text,
        actor_name: 'Ampy Digital',
        created_at: new Date().toISOString(),
      },
      ...current,
    ])
  }

  async function uploadFiles(event: any) {
    const files = Array.from(event.target.files || []) as File[]
    event.target.value = ''

    if (!files.length) return

    setUploading(true)
    setError('')
    setMessage('')

    try {
      const supabase = createClient()
      const createdItems: any[] = []

      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        if (!file.type.startsWith('image/')) continue

        const path = `${boardState.id}/${Date.now()}-${index}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from('feed-preview')
          .upload(path, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('feed-preview').getPublicUrl(path)

        const formData = new FormData()
        formData.set('board_id', boardState.id)
        formData.set('title', file.name.replace(/\.[^/.]+$/, ''))
        formData.set('storage_path', path)
        formData.set('cover_url', data.publicUrl)
        formData.set('position', String(sortedItems.length + createdItems.length))

        const result = await createFeedBoardItemSmoothAction(formData)
        if ('error' in result) throw new Error(result.error)

        if ('item' in result && result.item) {
          createdItems.push(result.item)
        }
      }

      if (createdItems.length > 0) {
        setGridItems((current) => [...current, ...createdItems])
        setMessage(`${createdItems.length} capa(s) adicionada(s).`)
        addLocalEvent(`Ampy Digital adicionou ${createdItems.length} capa(s).`)
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao subir capas.')
    } finally {
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
    setMessage('')

    const result = await reorderFeedBoardItemsAction(boardState.id, sortedItems.map((item) => item.id))
    if ('error' in result) {
      setError(result.error || 'Erro ao salvar ordem.')
      setSaving(false)
      return
    }

    setOrderDirty(false)
    setSaving(false)
    setMessage('Sequência salva.')
    addLocalEvent('Ampy Digital salvou a sequência da grade.')
  }

  async function updateBoard(event: any) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const formData = new FormData(event.currentTarget)
    formData.set('visual_preset', boardState.visual_preset || 'custom')

    const result = await updateFeedBoardSettingsAction(boardState.id, formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao salvar documento.')
      setSaving(false)
      return
    }

    setBoardState((current: any) => ({
      ...current,
      title: String(formData.get('title') || current.title),
      status: String(formData.get('status') || current.status),
      notes: String(formData.get('notes') || ''),
      updated_at: new Date().toISOString(),
    }))

    setMessage('Configurações da aprovação salvas.')
    addLocalEvent('Ampy Digital atualizou as configurações da aprovação.')
    setSaving(false)
  }

  async function saveVisualPreset(preset: string) {
    setSaving(true)
    setError('')
    setMessage('')

    const formData = new FormData()
    formData.set('title', boardState.title || '')
    formData.set('status', boardState.status || 'draft')
    formData.set('visual_preset', preset)
    formData.set('notes', boardState.notes || '')
    formData.set('drive_folder_url', boardState.drive_folder_url || '')

    const result = await updateFeedBoardSettingsAction(boardState.id, formData)

    if ('error' in result) {
      setError(result.error || 'Erro ao salvar visual.')
      setSaving(false)
      return
    }

    setBoardState((current: any) => ({ ...current, visual_preset: preset, updated_at: new Date().toISOString() }))
    setMessage(`Visual definido como ${getVisualTone(preset)}.`)
    addLocalEvent(`Ampy Digital definiu o visual como ${getVisualTone(preset)}.`)
    setSaving(false)
  }

  async function updateItem(event: any) {
    event.preventDefault()
    if (!selected) return

    setSaving(true)
    setError('')
    setMessage('')

    const result = await updateFeedBoardItemPlanningAction(selected.id, new FormData(event.currentTarget))

    if ('error' in result) {
      setError(result.error || 'Erro ao salvar item.')
      setSaving(false)
      return
    }

    if ('item' in result && result.item) {
      setGridItems((current) => current.map((item) => item.id === result.item.id ? result.item : item))
      setSelected(result.item)
    }

    setMessage('Item atualizado.')
    addLocalEvent('Ampy Digital atualizou um item da grade.')
    setSaving(false)
    setSelected(null)
  }

  async function saveLinksBatch(event: any) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const formData = new FormData(event.currentTarget)
    const updatedItems: any[] = []

    try {
      for (const item of sortedItems) {
        const nextTitle = String(formData.get(`title_${item.id}`) || item.title || '')
        const nextSource = String(formData.get(`source_file_name_${item.id}`) || '')
        const nextUrl = String(formData.get(`content_url_${item.id}`) || '')
        const nextDate = String(formData.get(`scheduled_date_${item.id}`) || '')
        const nextTime = String(formData.get(`scheduled_time_${item.id}`) || '')
        const nextCaption = String(formData.get(`caption_${item.id}`) || item.caption || '')
        const nextNotes = String(formData.get(`internal_notes_${item.id}`) || item.internal_notes || '')

        const nextType = String(formData.get(`content_type_${item.id}`) || item.content_type || 'post')


        const changed =
          nextTitle !== String(item.title || '') ||
          nextType !== String(item.content_type || 'post') ||
          nextSource !== String(item.source_file_name || '') ||
          nextUrl !== String(item.content_url || '') ||
          nextDate !== String(item.scheduled_date || '') ||
          nextTime !== String(item.scheduled_time || '') ||
          nextCaption !== String(item.caption || '') ||
          nextNotes !== String(item.internal_notes || '')

        if (!changed) continue

        const itemForm = new FormData()
        itemForm.set('title', nextTitle || 'Capa')
        itemForm.set('content_type', ['post', 'video', 'carousel'].includes(nextType) ? nextType : 'post')
        itemForm.set('source_file_name', nextSource)
        itemForm.set('content_url', nextUrl)
        itemForm.set('scheduled_date', nextDate)
        itemForm.set('scheduled_time', nextTime)
        itemForm.set('caption', nextCaption)
        itemForm.set('internal_notes', nextNotes)

        const result = await updateFeedBoardItemPlanningAction(item.id, itemForm)
        if ('error' in result) throw new Error(result.error)
        if ('item' in result && result.item) updatedItems.push(result.item)
      }

      if (updatedItems.length > 0) {
        setGridItems((current) => current.map((item) => updatedItems.find((updated) => updated.id === item.id) || item))
      }

      setMessage(updatedItems.length > 0 ? `${updatedItems.length} link(s) atualizado(s).` : 'Nenhuma alteração nos links.')
      addLocalEvent('Ampy Digital atualizou links da aprovação.')
      setLinksModal(false)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar links.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem() {
    if (!selected) return

    setSaving(true)
    setError('')
    setMessage('')

    const itemId = selected.id
    const result = await deleteFeedBoardItemAction(itemId, boardState.id)

    if ('error' in result) {
      setError(result.error || 'Erro ao remover item.')
      setSaving(false)
      return
    }

    setGridItems((current) => current.filter((item) => item.id !== itemId).map((item, pos) => ({ ...item, position: pos })))
    setSelected(null)
    setSaving(false)
    setOrderDirty(true)
    setMessage('Capa removida.')
    addLocalEvent('Ampy Digital removeu uma capa da grade.')
  }

  function openLinksModal() {
    if (!sortedItems.length) return
    setLinksModal(true)
  }

  async function publishBoard() {
    setSaving(true)
    setError('')
    setMessage('')

    if (orderDirty) {
      const orderResult = await reorderFeedBoardItemsAction(boardState.id, sortedItems.map((item) => item.id))
      if ('error' in orderResult) {
        setError(orderResult.error || 'Erro ao salvar sequência antes de subir o feed.')
        setSaving(false)
        return
      }
      setOrderDirty(false)
    }

    const result = await publishFeedBoardAction(boardState.id)
    if ('error' in result) {
      setError(result.error || 'Erro ao subir feed.')
      setSaving(false)
      return
    }

    setBoardState((current: any) => ({
      ...current,
      status: 'in_progress',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    setMessage('Feed marcado como Em andamento. Link público aberto em nova aba.'); if (boardState.share_token) { window.open(`/aprovar/${boardState.share_token}`, '_blank') }
    addLocalEvent('Ampy Digital subiu o feed para aprovação.')
    setSaving(false)
  }

  function renderCard(item: any, index: number, compact = false) {
    const itemAssets = getAssetsForItem(item.id)

    return (
      <button
        key={item.id}
        type="button"
        draggable={viewMode === 'grid'}
        onDragStart={() => setDragIndex(index)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => dropAt(index)}
        onDragEnd={() => setDragIndex(null)}
        onClick={() => setSelected(item)}
        style={{
          aspectRatio: '9 / 16',
          background: '#151515',
          border: dragIndex === index ? '2px solid var(--blue)' : '1px solid #222',
          borderRadius: compact ? 6 : 8,
          overflow: 'hidden',
          position: 'relative',
          padding: 0,
          cursor: viewMode === 'grid' ? 'grab' : 'pointer',
        }}
      >
        {item.cover_url ? (
          <img src={item.cover_url} alt={item.title || 'Capa'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
            <i className="ti ti-photo" />
          </div>
        )}

        {item.content_type === 'video' && (
          <span className="content-type-play-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: '50%', background: 'rgba(0,0,0,.48)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 18 : 22, boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
              ▶
            </span>
          </span>
        )}

        {item.content_type === 'carousel' && (
          <span style={{ position: 'absolute', top: 5, left: 5, padding: '3px 6px', borderRadius: 6, background: 'rgba(0,0,0,.72)', color: '#FFF', fontSize: compact ? 7 : 8, fontWeight: 900 }}>
            {itemAssets.length ? itemAssets.length + ' slides' : 'Carrossel'}
          </span>
        )}

        <span style={{ position: 'absolute', top: 5, right: 5, padding: '3px 6px', borderRadius: 6, background: 'rgba(0,0,0,.78)', color: '#FFF', fontSize: compact ? 8 : 9, fontWeight: 800 }}>
          {index + 1}
        </span>

        <span className={`badge ${statusTone(item.approval_status)}`} style={{ position: 'absolute', left: 5, bottom: 5, fontSize: compact ? 7 : 8 }}>
          {item.approval_status === 'approved' ? 'Aprovado' : item.approval_status === 'changes_requested' ? 'Ajuste' : 'Pendente'}
        </span>

        {item.content_url && (
          <span style={{ position: 'absolute', right: 5, bottom: 5, color: '#FFF', background: 'rgba(0,0,0,.78)', borderRadius: 6, padding: '3px 6px', fontSize: 9 }}>
            <i className="ti ti-link" />
          </span>
        )}
      </button>
    )
  }

  function renderFeedGrid(compact = false) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? 'repeat(3, minmax(54px, 76px))' : 'repeat(3, minmax(82px, 112px))',
          justifyContent: 'center',
          gap: compact ? 4 : 6,
        }}
      >
        {sortedItems.map((item, index) => renderCard(item, index, compact))}

        {viewMode === 'grid' && Array.from({ length: fillerCount }).map((_, index) => (
          <button
            key={`empty-${index}`}
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              aspectRatio: '9 / 16',
              background: '#111',
              border: '1px dashed #252525',
              borderRadius: 8,
              color: '#333',
              fontSize: 20,
            }}
          >
            +
          </button>
        ))}
      </div>
    )
  }

  function renderPreview() {
    if (viewMode === 'mobile') {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
          <div style={{ width: 360, maxWidth: '100%', background: '#050505', border: '10px solid #111', borderRadius: 38, padding: '16px 12px 22px', boxShadow: '0 28px 70px rgba(0,0,0,.35)' }}>
            <div style={{ width: 86, height: 5, borderRadius: 999, background: '#222', margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 12px', borderBottom: '0.5px solid #1A1A1A', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#151515', color: '#DDD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {String(boardState.client?.name || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#FFF' }}>{boardState.client?.name || 'Cliente'}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{formatMonth(boardState.period_month)} · {getVisualTone(boardState.visual_preset)}</div>
              </div>
            </div>
            {renderFeedGrid(true)}
          </div>
        </div>
      )
    }

    if (viewMode === 'desktop') {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
          <div style={{ width: 'min(860px, 100%)', background: '#050505', border: '1px solid #202020', borderRadius: 18, overflow: 'hidden', boxShadow: '0 28px 70px rgba(0,0,0,.28)' }}>
            <div style={{ height: 38, background: '#111', borderBottom: '1px solid #202020', display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#333' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#333' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#333' }} />
              <span style={{ marginLeft: 10, color: '#777', fontSize: 10 }}>aprovações.ampy.digital/{boardState.share_token ? String(boardState.share_token).slice(0, 8) : 'preview'}</span>
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 22, alignItems: 'start' }}>
                <div>
                  <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#151515', color: '#DDD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
                    {String(boardState.client?.name || 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ color: '#FFF', fontWeight: 900, fontSize: 18 }}>{boardState.client?.name || 'Cliente'}</div>
                  <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{boardState.title}</div>
                  <div style={{ color: '#666', fontSize: 10, marginTop: 8 }}>{formatMonth(boardState.period_month)} · {getVisualTone(boardState.visual_preset)}</div>
                </div>

                <div>{renderFeedGrid(false)}</div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return renderFeedGrid(false)
  }

  return (
    <div className="page-wrap">
      <div className="topbar">
        <Link className="bsec" href="/dashboard/feed-preview">
          <i className="ti ti-arrow-left" /> Aprovações
        </Link>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tb-title">{boardState.title}</div>
          <div className="tb-sub">
            {boardState.client?.name || 'Cliente'} · {formatMonth(boardState.period_month)} · {STATUS_LABEL[boardState.status] || 'Rascunho'}
          </div>
        </div>

        <button className="bsec" onClick={() => inputRef.current?.click()} disabled={uploading || saving}>
          <i className="ti ti-upload" /> {uploading ? 'Subindo...' : 'Subir Capas'}
        </button>

        <button className="bsec" onClick={openLinksModal} disabled={!sortedItems.length || saving}>
          <i className="ti ti-link" /> Adicionar Links
        </button>

        {orderDirty && (
          <button className="bsec" onClick={saveOrder} disabled={saving}>
            <i className="ti ti-device-floppy" /> Salvar sequência
          </button>
        )}

        <button className="bpri" onClick={publishBoard} disabled={saving || uploading || !sortedItems.length}>
          <i className="ti ti-send" /> Subir Feed
        </button>

        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={uploadFiles} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {error && <div className="notice notice-err" style={{ marginBottom: 14 }}><i className="ti ti-alert-circle" /><span>{error}</span></div>}
        {message && <div className="notice" style={{ marginBottom: 14 }}><i className="ti ti-check" /><span>{message}</span></div>}
        {loadErrors.length > 0 && <div className="notice notice-err" style={{ marginBottom: 14 }}><i className="ti ti-alert-circle" /><span>{loadErrors.join(' | ')}</span></div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: 16, alignItems: 'start' }}>
          <section>
            <div className="sh" style={{ alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div className="stitle">Grade da aprovação</div>
                <div className="ssub">Capas em 1080x1920. Escolha uma visualização para revisar a sequência.</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {Object.entries(VIEW_LABEL).map(([value, label]) => (
                    <button key={value} className={`fb ${viewMode === value ? 'on' : ''}`} type="button" onClick={() => setViewMode(value as any)}>
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {Object.entries(PRESET_LABEL).map(([value, label]) => (
                    <button key={value} className={`fb ${boardState.visual_preset === value ? 'on' : ''}`} type="button" disabled={saving} onClick={() => saveVisualPreset(value)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: '#0A0A0A', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottom: '0.5px solid #1A1A1A' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#151515', color: '#DDD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                  {String(boardState.client?.name || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#FFF' }}>{boardState.client?.name || 'Cliente'}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{formatMonth(boardState.period_month)} · {VIEW_LABEL[viewMode]} · {getVisualTone(boardState.visual_preset)}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <span className="badge bblue">3 colunas</span>
                  <span className="badge bmut">{sortedItems.length} item(ns)</span>
                </div>
              </div>

              {renderPreview()}
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <form onSubmit={updateBoard} style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div className="stitle" style={{ marginBottom: 10 }}>Configurações</div>

              <div className="fg">
                <label className="fl">Nome da aprovação</label>
                <input className="fi" name="title" defaultValue={boardState.title || ''} />
              </div>

              <div className="fg">
                <label className="fl">Status</label>
                <select className="fi" name="status" defaultValue={boardState.status || 'draft'}>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>

              <div className="fg">
                <label className="fl">Pasta do Drive</label>
                <input className="fi" name="drive_folder_url" defaultValue={boardState.drive_folder_url || ''} placeholder="https://drive.google.com/drive/folders/..." />
                {boardState.drive_folder_url && (
                  <a className="bsec" href={boardState.drive_folder_url} target="_blank" rel="noreferrer" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                    <i className="ti ti-folder-open" /> Abrir pasta do Drive
                  </a>
                )}
              </div>

              <div className="fg">
                <label className="fl">Notas internas</label>
                <textarea className="fi" name="notes" defaultValue={boardState.notes || ''} />
              </div>

              <button className="bsec" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </form>

            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div className="stitle">Links dos posts</div>
              <div className="ssub" style={{ marginBottom: 10 }}>Clique em Adicionar Links para preencher tudo em lote.</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
                {sortedItems.length === 0 ? (
                  <div className="empty-inline">Nenhuma capa adicionada.</div>
                ) : sortedItems.map((item, index) => (
                  <button key={item.id} type="button" onClick={() => setSelected(item)} style={{ textAlign: 'left', background: 'var(--s2)', border: '0.5px solid var(--b1)', borderRadius: 10, padding: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <b style={{ color: 'var(--t2)', fontSize: 11 }}>{index + 1}</b>
                      <span style={{ color: 'var(--t1)', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Sem título'}</span>
                    </div>
                    <small style={{ color: 'var(--t4)' }}>{CONTENT_TYPE_LABEL[item.content_type || 'post'] || 'Post'} · {item.content_url ? 'Link adicionado' : 'Sem link'}</small>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--s1)', border: '0.5px solid var(--b1)', borderRadius: 'var(--rc)', padding: 14 }}>
              <div className="stitle">Histórico</div>
              <div className="ssub" style={{ marginBottom: 10 }}>Registro vivo da aprovação.</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 230, overflowY: 'auto' }}>
                {localEvents.length === 0 ? (
                  <div className="empty-inline">Sem histórico ainda.</div>
                ) : localEvents.map((event: any) => (
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

      {linksModal && (
        <div className="modal-ov" onClick={() => setLinksModal(false)}>
          <div className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Adicionar links</div>
                <div className="modal-sub">Preencha os links dos posts em sequência. Ideal para Drive, vídeo ou URL final.</div>
              </div>
              <button className="mclose" onClick={() => setLinksModal(false)}><i className="ti ti-x" /></button>
            </div>

            <form onSubmit={saveLinksBatch}>
              <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sortedItems.map((item, index) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 12, alignItems: 'start', background: 'var(--s2)', border: '0.5px solid var(--b1)', borderRadius: 12, padding: 10 }}>
                      <div style={{ aspectRatio: '9 / 16', borderRadius: 8, overflow: 'hidden', background: '#111', position: 'relative' }}>
                        {item.cover_url && <img src={item.cover_url} alt={item.title || 'Capa'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        <span style={{ position: 'absolute', top: 4, right: 4, padding: '2px 5px', borderRadius: 5, background: 'rgba(0,0,0,.78)', color: '#FFF', fontSize: 8 }}>{index + 1}</span>
                      </div>

                      <div>
                        <div className="fg">
                          <label className="fl">Título</label>
                          <input className="fi" name={`title_${item.id}`} defaultValue={item.title || ''} />
                        </div>

                        <div className="fg">
                          <label className="fl">Tipo do conteúdo</label>
                          <select className="fi" name={`content_type_${item.id}`} defaultValue={item.content_type || 'post'}>
                            <option value="post">Post</option>
                            <option value="video">Vídeo</option>
                            <option value="carousel">Carrossel</option>
                          </select>
                        </div>

                        <div className="fg">
                          <label className="fl">Arquivo na pasta</label>
                          <input className="fi" name={`source_file_name_${item.id}`} defaultValue={item.source_file_name || ''} placeholder="Ex.: Video_1, Capa_1, P01_VIDEO" />
                        </div>

                        <div className="frow">
                          <div className="fg">
                            <label className="fl">Data</label>
                            <input className="fi" type="date" name={`scheduled_date_${item.id}`} defaultValue={item.scheduled_date || ''} />
                          </div>
                          <div className="fg">
                            <label className="fl">Hora</label>
                            <input className="fi" type="time" name={`scheduled_time_${item.id}`} defaultValue={item.scheduled_time || ''} />
                          </div>
                        </div>

                        <div className="fg">
                          <label className="fl">Link do post/vídeo/Drive</label>
                          <input className="fi" name={`content_url_${item.id}`} defaultValue={item.content_url || ''} placeholder="https://drive.google.com/..." />
                        </div>

                        <div className="fg">
                          <label className="fl">Legenda / observação para o cliente</label>
                          <textarea className="fi" name={`caption_${item.id}`} defaultValue={item.caption || ''} />
                        </div>

                        <input type="hidden" name={`internal_notes_${item.id}`} defaultValue={item.internal_notes || ''} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="bsec" onClick={() => setLinksModal(false)}>Cancelar</button>
                <button className="bpri" disabled={saving}>{saving ? 'Salvando...' : 'Salvar links'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-ov" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Editar post da aprovação</div>
                <div className="modal-sub">Adicione o link do vídeo/post/Drive e observações.</div>
              </div>
              <button className="mclose" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
            </div>

            <form onSubmit={updateItem}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
                  <div style={{ aspectRatio: '9 / 16', background: '#111', borderRadius: 12, overflow: 'hidden', border: '0.5px solid var(--b1)' }}>
                    {selected.cover_url && <img src={selected.cover_url} alt={selected.title || 'Capa'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>

                  <div>
                    <div className="fg">
                      <label className="fl">Título / referência</label>
                      <input className="fi" name="title" defaultValue={selected.title || ''} />
                    </div>

                    <div className="fg">
                      <label className="fl">Tipo do conteúdo</label>
                      <select className="fi" name="content_type" defaultValue={selected.content_type || 'post'}>
                        <option value="post">Post</option>
                        <option value="video">Vídeo</option>
                        <option value="carousel">Carrossel</option>
                      </select>
                    </div>

                    <div className="fg">
                      <label className="fl">Arquivo na pasta</label>
                      <input className="fi" name="source_file_name" defaultValue={selected.source_file_name || ''} placeholder="Ex.: Video_1, Capa_1, P01_VIDEO" />
                    </div>

                    <div className="frow">
                      <div className="fg">
                        <label className="fl">Data</label>
                        <input className="fi" type="date" name="scheduled_date" defaultValue={selected.scheduled_date || ''} />
                      </div>
                      <div className="fg">
                        <label className="fl">Hora</label>
                        <input className="fi" type="time" name="scheduled_time" defaultValue={selected.scheduled_time || ''} />
                      </div>
                    </div>

                    <div className="fg">
                      <label className="fl">Link do vídeo/post/Drive</label>
                      <input className="fi" name="content_url" defaultValue={selected.content_url || ''} placeholder="https://drive.google.com/..." />
                    </div>

                    <div className="fg">
                      <label className="fl">Legenda / texto de apoio</label>
                      <textarea className="fi" name="caption" defaultValue={selected.caption || ''} />
                    </div>

                    <div className="fg">
                      <label className="fl">Observações internas</label>
                      <textarea className="fi" name="internal_notes" defaultValue={selected.internal_notes || ''} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="bsec danger-action" onClick={deleteItem} disabled={saving}>Remover capa</button>
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








