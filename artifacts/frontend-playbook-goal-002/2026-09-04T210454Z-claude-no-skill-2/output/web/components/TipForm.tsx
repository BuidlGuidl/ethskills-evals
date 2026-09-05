'use client'

import { useState, type FormEvent } from 'react'
import { erc20Abi } from 'viem'
import { useConfig, useConnection, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { appConfig, chain, chainLabel, hasTokenFaucet } from '@/lib/config'
import { tipJarAbi } from '@/lib/tipJarAbi'
import { MAX_MESSAGE_BYTES, formatUsdc, messageByteLength, parseUsdc } from '@/lib/usdc'
import { useTipperToken } from '@/hooks/useTipJar'
import { ConnectWallet } from './ConnectWallet'

const PRESETS = ['1', '5', '25']

type Status =
  | { kind: 'idle' }
  | { kind: 'approving' }
  | { kind: 'tipping' }
  | { kind: 'success'; amount: bigint }
  | { kind: 'error'; message: string }

/** Wallet errors are long and stack-shaped; the first line is the part worth showing. */
function readableError(error: unknown): string {
  if (error instanceof Error) {
    const [firstLine] = error.message.split('\n')
    return firstLine?.trim() || 'Transaction failed'
  }
  return 'Transaction failed'
}

export function TipForm({ onTipped }: { onTipped?: () => void }) {
  const config = useConfig()
  const { address, isConnected, chainId } = useConnection()
  const { mutateAsync: writeContractAsync } = useWriteContract()
  const { balance, allowance, refetch: refetchToken } = useTipperToken()

  const [amount, setAmount] = useState('5')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [minting, setMinting] = useState(false)

  if (!appConfig.ok) return null
  const { tipJar, usdc } = appConfig.value

  const parsed = parseUsdc(amount)
  const messageBytes = messageByteLength(message)
  const messageTooLong = messageBytes > MAX_MESSAGE_BYTES
  const insufficientFunds = parsed.ok && balance !== undefined && parsed.units > balance
  const wrongNetwork = isConnected && chainId !== chain.id
  const busy = status.kind === 'approving' || status.kind === 'tipping'

  const disabledReason = !parsed.ok
    ? parsed.error
    : messageTooLong
      ? `Message is ${messageBytes - MAX_MESSAGE_BYTES} bytes too long`
      : insufficientFunds
        ? 'Not enough USDC'
        : wrongNetwork
          ? `Switch to ${chainLabel} first`
          : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!parsed.ok || disabledReason || !address) return

    const units = parsed.units
    try {
      // USDC is pulled with transferFrom, so the jar needs an allowance first.
      // Approving the exact amount keeps no standing allowance behind after the tip.
      if (allowance === undefined || allowance < units) {
        setStatus({ kind: 'approving' })
        const approvalHash = await writeContractAsync({
          address: usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [tipJar, units],
        })
        await waitForTransactionReceipt(config, { hash: approvalHash })
      }

      setStatus({ kind: 'tipping' })
      const tipHash = await writeContractAsync({
        address: tipJar,
        abi: tipJarAbi,
        functionName: 'tip',
        args: [units, message],
      })
      await waitForTransactionReceipt(config, { hash: tipHash })

      setStatus({ kind: 'success', amount: units })
      setMessage('')
      await refetchToken()
      onTipped?.()
    } catch (error) {
      setStatus({ kind: 'error', message: readableError(error) })
    }
  }

  async function handleMint() {
    if (!address) return
    setMinting(true)
    try {
      const hash = await writeContractAsync({
        address: usdc,
        abi: [
          {
            type: 'function',
            name: 'mint',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [],
          },
        ] as const,
        functionName: 'mint',
        args: [address, 1_000_000_000n],
      })
      await waitForTransactionReceipt(config, { hash })
      await refetchToken()
    } catch (error) {
      setStatus({ kind: 'error', message: readableError(error) })
    } finally {
      setMinting(false)
    }
  }

  if (!isConnected) {
    return (
      <section className="card">
        <h2>Leave a tip</h2>
        <p className="muted">Connect a wallet to send USDC to this jar.</p>
        <ConnectWallet />
      </section>
    )
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2>Leave a tip</h2>
        {balance !== undefined ? (
          <span className="muted" data-testid="usdc-balance">
            Balance: {formatUsdc(balance)} USDC
          </span>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="amount">Amount (USDC)</label>
          <div className="amount-row">
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setStatus({ kind: 'idle' })
              }}
              aria-invalid={!parsed.ok}
            />
            <div className="presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`chip${amount === preset ? ' chip--active' : ''}`}
                  onClick={() => {
                    setAmount(preset)
                    setStatus({ kind: 'idle' })
                  }}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <div className="field__head">
            <label htmlFor="message">Message (optional)</label>
            <span className={messageTooLong ? 'counter counter--over' : 'counter'}>
              {messageBytes}/{MAX_MESSAGE_BYTES}
            </span>
          </div>
          <textarea
            id="message"
            name="message"
            rows={2}
            placeholder="Say something nice…"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value)
              setStatus({ kind: 'idle' })
            }}
            aria-invalid={messageTooLong}
          />
        </div>

        <button
          type="submit"
          className="button button--primary button--wide"
          disabled={busy || Boolean(disabledReason)}
        >
          {status.kind === 'approving'
            ? 'Approving USDC…'
            : status.kind === 'tipping'
              ? 'Sending tip…'
              : `Send ${parsed.ok ? formatUsdc(parsed.units) : '—'} USDC`}
        </button>

        {disabledReason ? <p className="hint">{disabledReason}</p> : null}
        {status.kind === 'success' ? (
          <p className="success" role="status">
            Sent {formatUsdc(status.amount)} USDC. Thank you!
          </p>
        ) : null}
        {status.kind === 'error' ? (
          <p className="error" role="alert">
            {status.message}
          </p>
        ) : null}
        {busy ? (
          <p className="hint">
            Two transactions: one to approve the USDC, one to send the tip. Confirm both in your wallet.
          </p>
        ) : null}
      </form>

      {hasTokenFaucet ? (
        <div className="faucet">
          <button type="button" className="button button--ghost" onClick={handleMint} disabled={minting}>
            {minting ? 'Minting…' : 'Mint 1,000 test USDC'}
          </button>
          <span className="muted">Local chain only — this token is a mock.</span>
        </div>
      ) : null}
    </section>
  )
}
