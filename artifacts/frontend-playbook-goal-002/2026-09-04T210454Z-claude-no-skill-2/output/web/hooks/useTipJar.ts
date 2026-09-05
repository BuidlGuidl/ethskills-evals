'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { erc20Abi, type Address } from 'viem'
import { useBlockNumber, useConnection, useReadContract, useReadContracts } from 'wagmi'
import { appConfig } from '@/lib/config'
import { tipJarAbi } from '@/lib/tipJarAbi'

/** How many tips the feed asks for. The contract returns them newest first. */
export const FEED_SIZE = 25

const addresses = appConfig.ok ? appConfig.value : null

const tipJarContract = addresses ? ({ address: addresses.tipJar, abi: tipJarAbi } as const) : null

export type Tip = {
  sender: Address
  amount: bigint
  timestamp: bigint
  message: string
}

/**
 * Re-reads every contract query whenever a new block lands, so a tip sent from
 * another tab or wallet shows up in the feed without a manual refresh.
 */
export function useRefetchOnNewBlock() {
  const queryClient = useQueryClient()
  const { data: blockNumber } = useBlockNumber({ watch: true })

  useEffect(() => {
    if (blockNumber === undefined) return
    queryClient.invalidateQueries({ queryKey: ['readContract'] })
    queryClient.invalidateQueries({ queryKey: ['readContracts'] })
  }, [blockNumber, queryClient])
}

/** Jar-wide totals shown in the header. */
export function useJarSummary() {
  const query = useReadContracts({
    contracts: tipJarContract
      ? [
          { ...tipJarContract, functionName: 'totalTipped' },
          { ...tipJarContract, functionName: 'tipCount' },
          { ...tipJarContract, functionName: 'balance' },
          { ...tipJarContract, functionName: 'owner' },
        ]
      : [],
    query: { enabled: tipJarContract !== null },
  })

  const [totalTipped, tipCount, balance, owner] = query.data ?? []

  return {
    ...query,
    totalTipped: totalTipped?.result,
    tipCount: tipCount?.result,
    balance: balance?.result,
    owner: owner?.result,
  }
}

/** The newest tips, straight from the contract — no indexer needed. */
export function useTipFeed(limit: number = FEED_SIZE) {
  const query = useReadContract({
    ...(tipJarContract ?? { address: undefined, abi: tipJarAbi }),
    functionName: 'latestTips',
    args: [BigInt(limit)],
    query: { enabled: tipJarContract !== null },
  })

  return { ...query, tips: (query.data ?? []) as readonly Tip[] }
}

/** The connected account's USDC balance and its current allowance for the jar. */
export function useTipperToken() {
  const { address } = useConnection()

  const query = useReadContracts({
    contracts:
      addresses && address
        ? [
            {
              address: addresses.usdc,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address],
            } as const,
            {
              address: addresses.usdc,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [address, addresses.tipJar],
            } as const,
          ]
        : [],
    query: { enabled: Boolean(addresses && address) },
  })

  const [balance, allowance] = query.data ?? []

  return {
    ...query,
    balance: balance?.result,
    allowance: allowance?.result,
  }
}
