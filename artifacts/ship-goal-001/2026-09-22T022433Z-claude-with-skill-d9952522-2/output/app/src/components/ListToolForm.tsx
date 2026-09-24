'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** List a tool: a photo, what it is, condition notes, and the deposit terms. */
export function ListToolForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [deposit, setDeposit] = useState('40')
  const [lateFee, setLateFee] = useState('2')

  const capDays =
    Number(deposit) > 0 && Number(lateFee) > 0
      ? Math.floor(Number(deposit) / Number(lateFee))
      : undefined

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch('/api/tools', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not save the listing')
      router.push(`/tools/${result.uuid}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the listing')
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        What is it?
        <input name="title" required maxLength={80} placeholder="Circular saw, 7¼″" />
      </label>

      <label>
        Photo
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>

      <label>
        Condition notes
        <textarea
          name="conditionNotes"
          rows={4}
          maxLength={1000}
          placeholder="Blade is sharp, guard sticks a little. Bring your own extension cord."
        />
      </label>

      <div className="row">
        <label>
          Deposit (USDC)
          <input
            name="deposit"
            required
            inputMode="decimal"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
          />
        </label>
        <label>
          Late fee per day (USDC)
          <input
            name="lateFeePerDay"
            required
            inputMode="decimal"
            value={lateFee}
            onChange={(event) => setLateFee(event.target.value)}
          />
        </label>
        <label>
          Lend for up to (days)
          <input name="maxLoanDays" type="number" min={1} max={90} defaultValue={7} required />
        </label>
      </div>

      {capDays ? (
        <p className="muted">
          Late fees stop after {capDays} day{capDays === 1 ? '' : 's'} — that is when they add up to
          the whole deposit. The borrower can never lose more than the deposit.
        </p>
      ) : null}

      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'List it'}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  )
}
