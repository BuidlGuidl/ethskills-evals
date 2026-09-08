import type { Tip } from '../hooks/useTipJar'
import { formatRelativeTime, formatUSDC, shortenAddress } from '../lib/format'

type Props = {
  tips: readonly Tip[]
  isLoading: boolean
  connectedAddress?: string
}

export function TipFeed({ tips, isLoading, connectedAddress }: Props) {
  return (
    <section className="card feed">
      <div className="card__header">
        <h2>Tip feed</h2>
        {tips.length > 0 && <span className="feed__count">newest first</span>}
      </div>

      {isLoading && <p className="hint">Loading tips…</p>}

      {!isLoading && tips.length === 0 && (
        <p className="hint">No tips yet. Be the first one in the jar.</p>
      )}

      <ul className="feed__list">
        {tips.map((tip, index) => (
          <li
            key={`${tip.sender}-${tip.timestamp}-${index}`}
            className={`tip ${isSameAddress(tip.sender, connectedAddress) ? 'tip--mine' : ''}`}
          >
            <div className="tip__row">
              <span className="tip__sender mono" title={tip.sender}>
                {shortenAddress(tip.sender)}
                {isSameAddress(tip.sender, connectedAddress) && <span className="tip__you">you</span>}
              </span>
              <span className="tip__amount">{formatUSDC(tip.amount)} USDC</span>
            </div>
            {tip.message && <p className="tip__message">{tip.message}</p>}
            <time className="tip__time">{formatRelativeTime(tip.timestamp)}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}

function isSameAddress(a?: string, b?: string): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase())
}
