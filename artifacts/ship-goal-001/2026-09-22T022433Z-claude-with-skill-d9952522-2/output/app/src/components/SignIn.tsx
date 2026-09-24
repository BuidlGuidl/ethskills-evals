'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAccount, useConnect, useConnectors, useDisconnect, useSignMessage } from 'wagmi'
import { shortAddress } from '@/ui/format'

/**
 * Connect a wallet, then prove the address once with a signature so the server
 * can attribute listings and requests to it.
 */
export function SignIn({ sessionAddress }: { sessionAddress: string | null }) {
  const { address, isConnected } = useAccount()
  const connectors = useConnectors()
  const { mutateAsync: connect, isPending: connecting } = useConnect()
  const { mutateAsync: disconnect } = useDisconnect()
  const { mutateAsync: signMessage } = useSignMessage()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const signedIn = Boolean(
    sessionAddress && address && sessionAddress.toLowerCase() === address.toLowerCase(),
  )

  async function signIn() {
    if (!address) return
    setBusy(true)
    setError(undefined)
    try {
      const nonceResponse = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const { nonce, message, error: nonceError } = await nonceResponse.json()
      if (!nonceResponse.ok) throw new Error(nonceError ?? 'Could not start sign-in')

      const signature = await signMessage({ message })
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, nonce, signature }),
      })
      const result = await verifyResponse.json()
      if (!verifyResponse.ok) throw new Error(result.error ?? 'Sign-in failed')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    await disconnect()
    router.refresh()
  }

  if (signedIn && address) {
    return (
      <div className="signin">
        <span className="who">{shortAddress(address)}</span>
        <button type="button" className="ghost" onClick={signOut}>
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="signin">
      {error ? <span className="error">{error}</span> : null}
      {isConnected ? (
        <button type="button" onClick={signIn} disabled={busy}>
          {busy ? 'Check your wallet…' : 'Sign in'}
        </button>
      ) : (
        connectors.map((connector) => (
          <button
            key={connector.uid}
            type="button"
            disabled={connecting}
            onClick={() => connect({ connector }).catch(() => setError('Could not connect'))}
          >
            {connector.name}
          </button>
        ))
      )}
    </div>
  )
}
