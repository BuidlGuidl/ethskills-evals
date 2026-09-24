'use client'

import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from '@/chain/erc20Abi'
import { toolshedAbi } from '@/chain/toolshedAbi'
import { toolshedAddress, usdcAddress } from '@/chain/config'
import { deserializeOffer, type SerializedLoanOffer } from '@/chain/eip712'
import { usdcLabel } from '@/ui/format'
import { useTx } from './useTx'

/**
 * The borrower's one action: fund the deposit and start the loan.
 *
 * Approve-then-start is two transactions on purpose — the allowance is for the
 * exact deposit, so the escrow can never pull more USDC than this loan needs.
 */
export function StartLoanButton({
  offer,
  signature,
}: {
  offer: SerializedLoanOffer
  signature: `0x${string}`
}) {
  const { address } = useAccount()
  const terms = deserializeOffer(offer)
  const { state, run, busy } = useTx()

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, toolshedAddress] : undefined,
    query: { enabled: Boolean(address) },
  })

  const { data: balance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })

  const wrongAccount = address && address.toLowerCase() !== terms.borrower.toLowerCase()
  const shortOfFunds = balance !== undefined && balance < terms.deposit
  const expired = terms.offerExpiry < BigInt(Math.floor(Date.now() / 1000))

  async function start() {
    await run(async (send) => {
      if ((allowance ?? 0n) < terms.deposit) {
        await send({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [toolshedAddress, terms.deposit],
        })
        await refetchAllowance()
      }
      await send({
        address: toolshedAddress,
        abi: toolshedAbi,
        functionName: 'startLoan',
        args: [terms, signature],
      })
    })
  }

  if (expired) return <p className="muted">This offer expired. Ask the owner to sign a new one.</p>
  if (wrongAccount) {
    return <p className="muted">Connect {terms.borrower} to take this loan.</p>
  }

  return (
    <div className="action">
      <button type="button" onClick={start} disabled={busy || shortOfFunds}>
        {busy
          ? state.phase === 'signing'
            ? 'Check your wallet…'
            : 'Confirming…'
          : `Pay ${usdcLabel(terms.deposit)} deposit & borrow`}
      </button>
      {shortOfFunds ? (
        <p className="error">
          You need {usdcLabel(terms.deposit)} in your wallet; you have {usdcLabel(balance ?? 0n)}.
        </p>
      ) : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </div>
  )
}
