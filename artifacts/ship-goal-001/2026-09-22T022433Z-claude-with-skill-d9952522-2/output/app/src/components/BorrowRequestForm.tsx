'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Ask the owner for a few days. Free and offchain — nothing is escrowed yet. */
export function BorrowRequestForm({
  toolUuid,
  maxLoanDays,
}: {
  toolUuid: string
  maxLoanDays: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [days, setDays] = useState(Math.min(3, maxLoanDays))
  const [note, setNote] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolUuid, days, note }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not send the request')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="row">
        <label>
          Days
          <input
            type="number"
            min={1}
            max={maxLoanDays}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          />
        </label>
        <label className="grow">
          Note for the owner
          <input
            value={note}
            maxLength={500}
            placeholder="Putting up shelves on Saturday"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Ask to borrow'}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  )
}
