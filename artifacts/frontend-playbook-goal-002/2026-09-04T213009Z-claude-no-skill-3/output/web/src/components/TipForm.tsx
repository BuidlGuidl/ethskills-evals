import { useMemo, useState, type FormEvent } from 'react'
import { parseUnits } from 'viem'
import { useConnection } from 'wagmi'
import { explorerTxUrl } from '../config'
import { describeError } from '../lib/errors'
import { formatAmount } from '../lib/format'
import { useSendTip } from '../hooks/useTipJar'
import { ConnectWallet } from './ConnectWallet'

const PRESETS = ['1', '5', '25']

type Props = {
  tipJar: `0x${string}` | undefined
  usdc: `0x${string}` | undefined
  chainId: number
  decimals: number
  symbol: string
  maxNameBytes: number
  maxMessageBytes: number
  onTipped: () => void
}

/** Amount + name + message, then approve-and-tip. */
export function TipForm({
  tipJar,
  usdc,
  chainId,
  decimals,
  symbol,
  maxNameBytes,
  maxMessageBytes,
  onTipped,
}: Props) {
  const { isConnected } = useConnection()
  const [amount, setAmount] = useState('5')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const { sendTip, reset, step, txHash, error, isBusy, usdcBalance } = useSendTip({
    tipJar,
    usdc,
    chainId,
    decimals,
    onSuccess: () => {
      setMessage('')
      onTipped()
    },
  })

  const parsed = useMemo(() => {
    if (!amount.trim()) return { units: undefined as bigint | undefined, problem: '' }
    try {
      const units = parseUnits(amount.trim(), decimals)
      if (units <= 0n) return { units: undefined, problem: 'Enter an amount above zero.' }
      return { units, problem: '' }
    } catch {
      return { units: undefined, problem: 'That is not a valid amount.' }
    }
  }, [amount, decimals])

  const nameBytes = new TextEncoder().encode(name).length
  const messageBytes = new TextEncoder().encode(message).length
  const notEnough = parsed.units !== undefined && usdcBalance !== undefined && parsed.units > usdcBalance

  const problem =
    parsed.problem ||
    (nameBytes > maxNameBytes ? `Name is ${nameBytes}/${maxNameBytes} bytes.` : '') ||
    (messageBytes > maxMessageBytes ? `Message is ${messageBytes}/${maxMessageBytes} bytes.` : '') ||
    (notEnough ? `You only have ${formatAmount(usdcBalance, decimals)} ${symbol}.` : '')

  const canSubmit = Boolean(isConnected && tipJar && parsed.units && !problem && !isBusy)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    void sendTip({ amount: amount.trim(), name: name.trim(), message: message.trim() })
  }

  const busyLabel =
    step === 'approving'
      ? `Approving ${symbol}…`
      : step === 'tipping'
        ? 'Confirm in your wallet…'
        : step === 'confirming'
          ? 'Waiting for confirmation…'
          : null

  return (
    <section className="card" aria-label="Send a tip">
      <header className="card-header">
        <h2>Send a tip</h2>
        {isConnected ? (
          <span className="muted small">
            Balance: {formatAmount(usdcBalance, decimals)} {symbol}
          </span>
        ) : null}
      </header>

      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label htmlFor="amount">Amount ({symbol})</label>
          <div className="amount-row">
            <input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5"
            />
            <div className="presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`chip${amount === preset ? ' selected' : ''}`}
                  onClick={() => setAmount(preset)}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="name">
            Name <span className="muted small">optional</span>
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="anon"
            aria-describedby="name-count"
          />
          <span id="name-count" className={`counter${nameBytes > maxNameBytes ? ' over' : ''}`}>
            {nameBytes}/{maxNameBytes}
          </span>
        </div>

        <div className="field">
          <label htmlFor="message">
            Message <span className="muted small">optional</span>
          </label>
          <textarea
            id="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="thanks for the open source work"
            aria-describedby="message-count"
          />
          <span id="message-count" className={`counter${messageBytes > maxMessageBytes ? ' over' : ''}`}>
            {messageBytes}/{maxMessageBytes}
          </span>
        </div>

        {isConnected ? (
          <button type="submit" className="button primary block" disabled={!canSubmit}>
            {busyLabel ?? `Tip ${amount || '0'} ${symbol}`}
          </button>
        ) : (
          <div className="connect-slot">
            <ConnectWallet />
            <p className="muted small">Connect a wallet to send a tip.</p>
          </div>
        )}

        {problem && isConnected ? <p className="error inline">{problem}</p> : null}
        {error ? <p className="error inline">{describeError(error)}</p> : null}

        {step === 'done' ? (
          <p className="success inline">
            Tip sent{' '}
            {txHash ? (
              explorerTxUrl(chainId, txHash) ? (
                <a href={explorerTxUrl(chainId, txHash)} target="_blank" rel="noreferrer">
                  view transaction
                </a>
              ) : (
                <code className="hash">{txHash.slice(0, 10)}…</code>
              )
            ) : null}{' '}
            <button type="button" className="link" onClick={reset}>
              send another
            </button>
          </p>
        ) : null}

        <p className="muted small hint">
          Tipping takes two transactions the first time: a {symbol} approval for this exact amount, then the tip itself.
        </p>
      </form>
    </section>
  )
}
