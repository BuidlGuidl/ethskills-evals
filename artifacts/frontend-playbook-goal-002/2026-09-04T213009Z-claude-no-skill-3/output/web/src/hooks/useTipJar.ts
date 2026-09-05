import { useCallback, useMemo, useState } from 'react'
import { erc20Abi as viemErc20Abi, parseUnits, type Address } from 'viem'
import { useChainId, useConfig, useConnection, useReadContract, useReadContracts, useWatchContractEvent, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { tipJarAbi } from '../abi/tipJar'
import { deploymentFor } from '../config'

export const FEED_PAGE_SIZE = 10n

export type FeedTip = {
  from: Address
  amount: bigint
  timestamp: bigint
  name: string
  message: string
}

/** Everything the page needs to know about the jar on the connected chain. */
export function useJar() {
  const chainId = useChainId()
  const deployment = deploymentFor(chainId)
  const tipJar = deployment?.tipJar
  const usdc = deployment?.usdc

  const jarContract = { address: tipJar, abi: tipJarAbi, chainId } as const
  const tokenContract = { address: usdc, abi: viemErc20Abi, chainId } as const

  const query = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...jarContract, functionName: 'totalTipped' },
      { ...jarContract, functionName: 'tipCount' },
      { ...jarContract, functionName: 'balance' },
      { ...jarContract, functionName: 'owner' },
      { ...jarContract, functionName: 'token' },
      { ...jarContract, functionName: 'MAX_NAME_BYTES' },
      { ...jarContract, functionName: 'MAX_MESSAGE_BYTES' },
      { ...tokenContract, functionName: 'decimals' },
      { ...tokenContract, functionName: 'symbol' },
    ],
    query: { enabled: Boolean(tipJar && usdc) },
  })

  const [totalTipped, tipCount, balance, owner, token, maxNameBytes, maxMessageBytes, decimals, symbol] =
    query.data ?? []

  return {
    chainId,
    tipJar,
    usdc,
    totalTipped,
    tipCount,
    balance,
    owner,
    /** The token the contract actually holds, read back from the jar. */
    token,
    maxNameBytes: maxNameBytes === undefined ? 32 : Number(maxNameBytes),
    maxMessageBytes: maxMessageBytes === undefined ? 280 : Number(maxMessageBytes),
    decimals: decimals ?? 6,
    symbol: symbol ?? 'USDC',
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/** Newest-first tip feed, growing by a page at a time. */
export function useTipFeed(tipJar: Address | undefined, chainId: number, tipCount: bigint | undefined) {
  const [limit, setLimit] = useState(FEED_PAGE_SIZE)

  const query = useReadContract({
    address: tipJar,
    abi: tipJarAbi,
    chainId,
    functionName: 'getTips',
    args: [0n, limit],
    query: { enabled: Boolean(tipJar) },
  })

  const tips = useMemo(() => (query.data ?? []) as readonly FeedTip[], [query.data])
  const hasMore = tipCount !== undefined && BigInt(tips.length) < tipCount

  return {
    tips,
    hasMore,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    loadMore: () => setLimit((current) => current + FEED_PAGE_SIZE),
  }
}

/** Re-runs `onTip` whenever the jar emits a TipReceived event. */
export function useTipEvents(tipJar: Address | undefined, chainId: number, onTip: () => void) {
  useWatchContractEvent({
    address: tipJar,
    abi: tipJarAbi,
    chainId,
    eventName: 'TipReceived',
    // Anvil and most RPCs are happy to poll; filters are not always available.
    poll: true,
    pollingInterval: 2_000,
    enabled: Boolean(tipJar),
    onLogs: onTip,
  })
}

export type TipStep = 'idle' | 'approving' | 'tipping' | 'confirming' | 'done'

/**
 * Drives the approve-then-tip flow. USDC needs an allowance before the jar can
 * pull funds, so this checks the current allowance and only asks for approval
 * when it is short.
 */
export function useSendTip(params: {
  tipJar: Address | undefined
  usdc: Address | undefined
  chainId: number
  decimals: number
  onSuccess?: () => void
}) {
  const { tipJar, usdc, chainId, decimals, onSuccess } = params
  const { address } = useConnection()
  const config = useConfig()
  const { writeContractAsync } = useWriteContract()

  const [step, setStep] = useState<TipStep>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState<unknown>()

  const balanceQuery = useReadContract({
    address: usdc,
    abi: viemErc20Abi,
    chainId,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(usdc && address) },
  })

  const allowanceQuery = useReadContract({
    address: usdc,
    abi: viemErc20Abi,
    chainId,
    functionName: 'allowance',
    args: address && tipJar ? [address, tipJar] : undefined,
    query: { enabled: Boolean(usdc && address && tipJar) },
  })

  const sendTip = useCallback(
    async (input: { amount: string; name: string; message: string }) => {
      if (!tipJar || !usdc || !address) return
      const amount = parseUnits(input.amount, decimals)

      setError(undefined)
      setTxHash(undefined)

      try {
        const allowance = (await allowanceQuery.refetch()).data ?? 0n

        if (allowance < amount) {
          setStep('approving')
          const approvalHash = await writeContractAsync({
            address: usdc,
            abi: viemErc20Abi,
            chainId,
            functionName: 'approve',
            // Approve exactly what is being tipped: no standing allowance is
            // left behind for the jar to spend later.
            args: [tipJar, amount],
          })
          await waitForTransactionReceipt(config, { hash: approvalHash, chainId })
        }

        setStep('tipping')
        const hash = await writeContractAsync({
          address: tipJar,
          abi: tipJarAbi,
          chainId,
          functionName: 'tip',
          args: [amount, input.name, input.message],
        })
        setTxHash(hash)

        setStep('confirming')
        const receipt = await waitForTransactionReceipt(config, { hash, chainId })
        if (receipt.status === 'reverted') throw new Error('Transaction reverted on chain.')

        setStep('done')
        await Promise.all([balanceQuery.refetch(), allowanceQuery.refetch()])
        onSuccess?.()
      } catch (caught) {
        setError(caught)
        setStep('idle')
      }
    },
    [address, allowanceQuery, balanceQuery, chainId, config, decimals, onSuccess, tipJar, usdc, writeContractAsync],
  )

  const reset = useCallback(() => {
    setStep('idle')
    setError(undefined)
    setTxHash(undefined)
  }, [])

  return {
    sendTip,
    reset,
    step,
    txHash,
    error,
    isBusy: step === 'approving' || step === 'tipping' || step === 'confirming',
    usdcBalance: balanceQuery.data,
    allowance: allowanceQuery.data,
  }
}
