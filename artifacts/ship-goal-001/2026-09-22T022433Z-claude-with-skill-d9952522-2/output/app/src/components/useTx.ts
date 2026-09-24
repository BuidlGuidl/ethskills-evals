'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useConfig, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import type { Abi } from 'viem'

export type SendTx = (request: {
  address: `0x${string}`
  abi: Abi | readonly unknown[]
  functionName: string
  args: readonly unknown[]
}) => Promise<`0x${string}`>

export type TxState = {
  phase: 'idle' | 'signing' | 'confirming' | 'done'
  error?: string
  hash?: `0x${string}`
}

/**
 * Send a transaction, wait for it, refresh the page data.
 *
 * Every write in this app is a short sequence of one or two transactions
 * followed by "the screen should now say something different", and the screens
 * are server-rendered from the indexed chain state — so `router.refresh()` at
 * the end is the whole state management story.
 */
export function useTx() {
  const config = useConfig()
  const { mutateAsync: writeContract } = useWriteContract()
  const router = useRouter()
  const [state, setState] = useState<TxState>({ phase: 'idle' })

  const send = useCallback<SendTx>(
    async (request) => {
      setState({ phase: 'signing' })
      const hash = await writeContract(request as never)
      setState({ phase: 'confirming', hash })
      const receipt = await waitForTransactionReceipt(config, { hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted')
      setState({ phase: 'done', hash })
      return hash
    },
    [config, writeContract],
  )

  const run = useCallback(
    async (work: (send: SendTx) => Promise<void>) => {
      try {
        await work(send)
        // Give the indexer a moment to pick the event up before re-rendering.
        await new Promise((resolve) => setTimeout(resolve, 1_500))
        router.refresh()
      } catch (error) {
        setState({
          phase: 'idle',
          error: error instanceof Error ? shortMessage(error) : 'Transaction failed',
        })
      }
    },
    [router, send],
  )

  return { state, run, busy: state.phase === 'signing' || state.phase === 'confirming' }
}

/** Wallet errors are novels; show the first line. */
function shortMessage(error: Error): string {
  const withShort = error as Error & { shortMessage?: string }
  return withShort.shortMessage ?? error.message.split('\n')[0]
}
