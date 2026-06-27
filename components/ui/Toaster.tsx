'use client'
import { useEffect, useState } from 'react'

interface Toast { id: number; msg: string; type?: 'ok' | 'err' }
let addToast: (msg: string, type?: 'ok' | 'err') => void = () => {}

export function toast(msg: string, type: 'ok' | 'err' = 'ok') { addToast(msg, type) }

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    addToast = (msg, type = 'ok') => {
      const id = Date.now()
      setToasts(t => [...t, { id, msg, type }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }
  }, [])

  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <i className={`ti ${t.type === 'err' ? 'ti-alert-circle' : 'ti-circle-check'}`} style={{ color: t.type === 'err' ? 'var(--red)' : 'var(--green)' }} />
          {t.msg}
        </div>
      ))}
    </div>
  )
}
