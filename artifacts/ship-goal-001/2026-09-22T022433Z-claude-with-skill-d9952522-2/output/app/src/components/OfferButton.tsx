'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSignTypedData } from 'wagmi'
import { deserializeOffer, loanOfferTypes, type SerializedLoanOffer } from '@/chain/eip712'

/**
 * The owner approving a loan — a signature, not a transaction. The owner pays no
 * gas to say yes, and only the borrower who funds the deposit pays anything.
 */
export function OfferButton({ requestId, label = 'Approve & sign terms' }: { requestId: number; label?: string }) {
  const { mutateAsync: signTypedData } = useSignTypedData()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function approve() {
    setBusy(true)
    setError(undefined)
    try {
      const prepared = await fetch(`/api/requests/${requestId}/offer`)
      const body = (await prepared.json()) as {
        terms?: SerializedLoanOffer
        domain?: Record<string, unknown>
        error?: string
      }
      if (!prepared.ok || !body.terms || !body.domain) {
        throw new Error(body.error ?? 'Could not prepare the terms')
      }

      const signature = await signTypedData({
        domain: body.domain,
        types: loanOfferTypes,
        primaryType: 'LoanOffer',
        message: deserializeOffer(body.terms),
      })

      const saved = await fetch(`/api/requests/${requestId}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms: body.terms, signature }),
      })
      const result = await saved.json()
      if (!saved.ok) throw new Error(result.error ?? 'Could not save the offer')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="action">
      <button type="button" onClick={approve} disabled={busy}>
        {busy ? 'Check your wallet…' : label}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}
