'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function ProfileForm({
  displayName,
  unitLabel,
}: {
  displayName: string
  unitLabel: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const [name, setName] = useState(displayName)
  const [unit, setUnit] = useState(unitLabel)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    setSaved(false)
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, unitLabel: unit }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not save')
      setSaved(true)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="row">
        <label className="grow">
          Name
          <input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Unit / address
          <input value={unit} maxLength={40} onChange={(event) => setUnit(event.target.value)} />
        </label>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      {saved ? <p className="muted">Saved.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  )
}
