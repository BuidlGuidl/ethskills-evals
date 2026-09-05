import { useState, type FormEvent } from 'react'
import { parseUnits, type Hash } from 'viem'
import { useConfig, useConnection, useReadContracts, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { erc20Abi } from '../abi/erc20'
import { tipJarAbi } from '../abi/tipJar'
import { MAX_MESSAGE_BYTES, USDC_DECIMALS, localChain, tipJarAddress, usdcAddress } from '../config'
import { describeError } from '../lib/errors'
import { byteLength, formatUSDC } from '../lib/format'
import { WrongNetworkPill } from './ConnectWallet'

const QUICK_AMOUNTS = ['1', '5', '25']

/** Accepts "12", "12.5", ".5" with at most 6 decimals -- USDC's precision. */
const AMOUNT_PATTERN = /^\d*\.?\d{0,6}$/

type Step = 'idle' | 'approving' | 'tipping'

export function TipForm({ onTipped }: { onTipped: () => void }) {
  const { address, isConnected, chainId } = useConnection()
  const config = useConfig()
  const { mutateAsync: writeContract } = useWriteContract()

  const [amount, setAmount] = useState('5')
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')
  const [lastTx, setLastTx] = useState<Hash>()

  const wallet = useReadContracts({
    contracts: [
      { address: usdcAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address!] },
      {
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address!, tipJarAddress!],
      },
    ],
    query: { enabled: Boolean(address && tipJarAddress) },
  })

  const usdcBalance = wallet.data?.[0]?.result
  const allowance = wallet.data?.[1]?.result

  const parsedAmount = parseAmount(amount)
  const messageBytes = byteLength(message)
  const wrongNetwork = isConnected && chainId !== localChain.id
  const busy = step !== 'idle'

  const validationError = (() => {
    if (!isConnected) return 'Connect a wallet to send a tip.'
    if (parsedAmount === undefined) return 'Enter an amount in USDC.'
    if (parsedAmount <= 0n) return 'Amount must be greater than zero.'
    if (usdcBalance !== undefined && parsedAmount > usdcBalance) {
      return `That is more than your ${formatUSDC(usdcBalance)} USDC balance.`
    }
    if (messageBytes > MAX_MESSAGE_BYTES) return 'Message is too long.'
    return undefined
  })()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (validationError || parsedAmount === undefined || !tipJarAddress) return

    setError('')
    setLastTx(undefined)

    try {
      // USDC is pull-based: the jar can only take what we have approved.
      if (allowance === undefined || allowance < parsedAmount) {
        setStep('approving')
        const approvalHash = await writeContract({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [tipJarAddress, parsedAmount],
        })
        const approval = await waitForTransactionReceipt(config, { hash: approvalHash })
        if (approval.status !== 'success') throw new Error('USDC approval failed.')
      }

      setStep('tipping')
      const tipHash = await writeContract({
        address: tipJarAddress,
        abi: tipJarAbi,
        functionName: 'tip',
        args: [parsedAmount, message],
      })
      const receipt = await waitForTransactionReceipt(config, { hash: tipHash })
      if (receipt.status !== 'success') throw new Error('Tip transaction reverted.')

      setLastTx(tipHash)
      setMessage('')
      onTipped()
      void wallet.refetch()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setStep('idle')
    }
  }

  return (
    <form className="card tip-form" onSubmit={handleSubmit}>
      <div className="card__header">
        <h2>Leave a tip</h2>
        {usdcBalance !== undefined && (
          <span className="tip-form__balance">Balance: {formatUSDC(usdcBalance)} USDC</span>
        )}
      </div>

      <label className="field">
        <span className="field__label">Amount (USDC)</span>
        <input
          className="field__input"
          inputMode="decimal"
          placeholder="5.00"
          value={amount}
          disabled={busy}
          onChange={(e) => {
            if (AMOUNT_PATTERN.test(e.target.value)) setAmount(e.target.value)
          }}
        />
      </label>

      <div className="quick-amounts">
        {QUICK_AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip ${amount === value ? 'chip--active' : ''}`}
            disabled={busy}
            onClick={() => setAmount(value)}
          >
            ${value}
          </button>
        ))}
      </div>

      <label className="field">
        <span className="field__label">
          Message <span className="field__hint">optional, public</span>
        </span>
        <textarea
          className="field__input field__input--area"
          rows={3}
          placeholder="Say something nice…"
          value={message}
          disabled={busy}
          onChange={(e) => setMessage(e.target.value)}
        />
        <span className={`counter ${messageBytes > MAX_MESSAGE_BYTES ? 'counter--over' : ''}`}>
          {messageBytes}/{MAX_MESSAGE_BYTES}
        </span>
      </label>

      {wrongNetwork ? (
        <WrongNetworkPill />
      ) : (
        <button className="button button--primary" type="submit" disabled={busy || Boolean(validationError)}>
          {step === 'approving' && 'Approving USDC…'}
          {step === 'tipping' && 'Sending tip…'}
          {step === 'idle' && (parsedAmount ? `Tip ${amount} USDC` : 'Send tip')}
        </button>
      )}

      {!error && validationError && isConnected && <p className="hint">{validationError}</p>}
      {!isConnected && <p className="hint">Connect a wallet to send a tip.</p>}
      {error && <p className="error">{error}</p>}
      {lastTx && !error && (
        <p className="success">
          Tip sent. <span className="mono">{lastTx.slice(0, 10)}…</span>
        </p>
      )}
    </form>
  )
}

function parseAmount(value: string): bigint | undefined {
  if (!value || value === '.') return undefined
  try {
    return parseUnits(value, USDC_DECIMALS)
  } catch {
    return undefined
  }
}
