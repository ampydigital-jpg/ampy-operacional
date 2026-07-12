'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function isUnreadActiveAviso(row: any) {
  const status = String(row?.status || 'active').toLowerCase()
  const metadata = row?.metadata || {}

  if (metadata?.purged || metadata?.purged_at) return false
  if (['deleted', 'archived', 'done'].includes(status)) return false
  if (row?.deleted_at || row?.archived_at || row?.completed_at) return false
  if (row?.read_at) return false

  return true
}

export default function AvisosMenuBadge() {
  const supabase = useMemo(() => createClient(), [])
  const [count, setCount] = useState(0)

  const loadCount = useCallback(async () => {
    const { data, error } = await supabase
      .from('avisos')
      .select('id,status,read_at,deleted_at,archived_at,completed_at,metadata')
      .limit(1000)

    if (error || !data) {
      setCount(0)
      return
    }

    setCount(data.filter(isUnreadActiveAviso).length)
  }, [supabase])

  useEffect(() => {
    loadCount()

    const handleFocus = () => loadCount()
    const handleChanged = () => loadCount()

    window.addEventListener('focus', handleFocus)
    window.addEventListener('avisos:changed', handleChanged)

    const interval = window.setInterval(loadCount, 15000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('avisos:changed', handleChanged)
      window.clearInterval(interval)
    }
  }, [loadCount])

  if (count <= 0) return null

  return (
    <span
      className="nav-badge"
      title={count === 1 ? '1 aviso não lido' : `${count} avisos não lidos`}
      style={{
        minWidth: 18,
        height: 18,
        padding: '0 6px',
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
        background: '#DC2626',
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 950,
        lineHeight: 1,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
