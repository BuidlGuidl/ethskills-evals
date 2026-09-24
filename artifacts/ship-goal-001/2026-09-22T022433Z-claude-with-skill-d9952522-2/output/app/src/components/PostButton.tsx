'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Small offchain action: decline a request, withdraw one, retire a listing. */
export function PostButton({
  url,
  label,
  body,
  className = 'ghost',
  confirm,
}: {
  url: string
  label: string
  body?: unknown
  className?: string
  confirm?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function post() {
    if (confirm && !window.confirm(confirm)) return
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'That did not work')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="action-inline">
      <button type="button" className={className} onClick={post} disabled={busy}>
        {busy ? '…' : label}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </span>
  )
}
