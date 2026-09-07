import { useCallback } from 'react'
import { useReadContracts, useWatchContractEvent } from 'wagmi'
import { tipJarAbi } from '../abi/tipJar'
import { tipJarAddress } from '../config'

export type Tip = {
  sender: `0x${string}`
  amount: bigint
  timestamp: bigint
  message: string
}

/**
 * Reads the jar's headline numbers and the newest tips in a single multicall.
 *
 * The feed lives in contract storage rather than being reconstructed from logs, so a
 * fresh page load shows the full history without an indexer.
 */
export function useTipJar(feedLimit = 25) {
  const jar = { address: tipJarAddress!, abi: tipJarAbi } as const

  const query = useReadContracts({
    contracts: [
      { ...jar, functionName: 'tipCount' },
      { ...jar, functionName: 'totalTipped' },
      { ...jar, functionName: 'balance' },
      { ...jar, functionName: 'owner' },
      { ...jar, functionName: 'getRecentTips', args: [BigInt(feedLimit)] },
    ],
    query: { enabled: Boolean(tipJarAddress) },
  })

  const { refetch } = query
  const refresh = useCallback(() => {
    void refetch()
  }, [refetch])

  // Someone else's tip should show up without a reload.
  useWatchContractEvent({
    address: tipJarAddress,
    abi: tipJarAbi,
    eventName: 'TipReceived',
    enabled: Boolean(tipJarAddress),
    onLogs: refresh,
  })

  const [tipCount, totalTipped, balance, owner, recentTips] = query.data ?? []

  return {
    tipCount: tipCount?.result,
    totalTipped: totalTipped?.result,
    balance: balance?.result,
    owner: owner?.result,
    tips: (recentTips?.result as readonly Tip[] | undefined) ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refresh,
  }
}
