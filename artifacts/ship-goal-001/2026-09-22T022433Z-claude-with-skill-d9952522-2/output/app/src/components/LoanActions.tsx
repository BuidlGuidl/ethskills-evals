'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'
import { toolshedAbi } from '@/chain/toolshedAbi'
import { toolshedAddress } from '@/chain/config'
import { eip712Domain, returnReceiptTypes } from '@/chain/eip712'
import { usdcLabel, dateTime } from '@/ui/format'
import { useTx } from './useTx'

export type LoanActionProps = {
  loanId: number
  role: 'owner' | 'borrower'
  dueAt: number
  maxLateFeeAt: number
  lateDaysNow: number
  lateFeePerDay: string
  deposit: string
  receipt?: { returnedAt: number; signature: `0x${string}` }
}

/**
 * Every way a loan can end, from the point of view of whoever is looking at it.
 *
 * Owner:    confirm the return (settles now), or leave a signed receipt.
 * Borrower: close with the owner's receipt, or — once the late fee has hit its
 *           cap and the split can no longer change — close it themselves.
 */
export function LoanActions(props: LoanActionProps) {
  const { address } = useAccount()
  const { state, run, busy } = useTx()
  const { mutateAsync: signTypedData } = useSignTypedData()
  const router = useRouter()
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [receiptError, setReceiptError] = useState<string>()

  const lateFeeNow = BigInt(props.lateFeePerDay) * BigInt(props.lateDaysNow)
  const refundNow = BigInt(props.deposit) - lateFeeNow
  const maxLateReached = Date.now() / 1000 >= props.maxLateFeeAt

  function confirmReturn() {
    return run(async (send) => {
      await send({
        address: toolshedAddress,
        abi: toolshedAbi,
        functionName: 'confirmReturn',
        args: [BigInt(props.loanId)],
      })
    })
  }

  function closeWithReceipt() {
    if (!props.receipt) return
    return run(async (send) => {
      await send({
        address: toolshedAddress,
        abi: toolshedAbi,
        functionName: 'closeWithReceipt',
        args: [BigInt(props.loanId), BigInt(props.receipt!.returnedAt), props.receipt!.signature],
      })
    })
  }

  function closeAtMaxLateFee() {
    return run(async (send) => {
      await send({
        address: toolshedAddress,
        abi: toolshedAbi,
        functionName: 'closeAtMaxLateFee',
        args: [BigInt(props.loanId)],
      })
    })
  }

  /** Sign "you handed it back just now" so the borrower can settle without me. */
  async function signReceipt() {
    setReceiptBusy(true)
    setReceiptError(undefined)
    try {
      const returnedAt = Math.floor(Date.now() / 1000)
      const signature = await signTypedData({
        domain: eip712Domain,
        types: returnReceiptTypes,
        primaryType: 'ReturnReceipt',
        message: { loanId: BigInt(props.loanId), returnedAt: BigInt(returnedAt) },
      })
      const response = await fetch(`/api/loans/${props.loanId}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnedAt, signature }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not save the receipt')
      router.refresh()
    } catch (cause) {
      setReceiptError(cause instanceof Error ? cause.message : 'Could not sign')
    } finally {
      setReceiptBusy(false)
    }
  }

  const buttonLabel = busy
    ? state.phase === 'signing'
      ? 'Check your wallet…'
      : 'Confirming…'
    : undefined

  if (!address) return <p className="muted">Connect your wallet to act on this loan.</p>

  if (props.role === 'owner') {
    return (
      <div className="action">
        <p className="muted">
          Settling now pays you {usdcLabel(lateFeeNow)} in late fees and returns{' '}
          {usdcLabel(refundNow)} to the borrower.
        </p>
        <div className="row">
          <button type="button" onClick={confirmReturn} disabled={busy}>
            {buttonLabel ?? 'Confirm return & settle'}
          </button>
          <button type="button" className="ghost" onClick={signReceipt} disabled={receiptBusy}>
            {receiptBusy ? 'Check your wallet…' : 'Sign a return receipt instead'}
          </button>
        </div>
        {props.receipt ? (
          <p className="muted">
            Receipt signed for {dateTime(props.receipt.returnedAt)} — the borrower can settle it
            themselves.
          </p>
        ) : null}
        {state.error ? <p className="error">{state.error}</p> : null}
        {receiptError ? <p className="error">{receiptError}</p> : null}
      </div>
    )
  }

  return (
    <div className="action">
      {props.receipt ? (
        <>
          <p className="muted">
            The owner signed a receipt for {dateTime(props.receipt.returnedAt)}. Closing pays you
            back your deposit, minus any late fee for that date.
          </p>
          <button type="button" onClick={closeWithReceipt} disabled={busy}>
            {buttonLabel ?? 'Close loan & get deposit back'}
          </button>
        </>
      ) : maxLateReached ? (
        <>
          <p className="muted">
            The late fee has reached its cap, so the split can no longer change. You can close this
            yourself: {usdcLabel(lateFeeNow)} to the owner, {usdcLabel(refundNow)} back to you.
          </p>
          <button type="button" onClick={closeAtMaxLateFee} disabled={busy}>
            {buttonLabel ?? `Close & recover ${usdcLabel(refundNow)}`}
          </button>
        </>
      ) : (
        <p className="muted">
          Hand the tool back and ask the owner to confirm the return, or to sign you a receipt. If
          they go quiet you can close this yourself after {dateTime(props.maxLateFeeAt)}.
        </p>
      )}
      {state.error ? <p className="error">{state.error}</p> : null}
    </div>
  )
}
