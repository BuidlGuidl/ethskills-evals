import type { FeedTip } from '../hooks/useTipJar'
import { absoluteTime, addressHue, formatAmount, shortAddress, timeAgo } from '../lib/format'

type Props = {
  tips: readonly FeedTip[]
  decimals: number
  symbol: string
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export function TipFeed({ tips, decimals, symbol, isLoading, hasMore, onLoadMore }: Props) {
  return (
    <section className="card feed" aria-label="Tip feed">
      <header className="card-header">
        <h2>Tip feed</h2>
        <span className="muted small">newest first</span>
      </header>

      {isLoading && tips.length === 0 ? (
        <ul className="tips">
          {[0, 1, 2].map((i) => (
            <li key={i} className="tip skeleton" aria-hidden="true">
              <div className="tip-avatar" />
              <div className="tip-body">
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            </li>
          ))}
        </ul>
      ) : tips.length === 0 ? (
        <p className="empty">No tips yet. Be the first one in the jar.</p>
      ) : (
        <ul className="tips">
          {tips.map((tip, index) => {
            const hue = addressHue(tip.from)
            const display = tip.name.trim() || shortAddress(tip.from)
            return (
              <li className="tip" key={`${tip.from}-${tip.timestamp}-${index}`}>
                <div className="tip-avatar" style={{ background: `hsl(${hue} 70% 55%)` }} aria-hidden="true">
                  {display.slice(0, 1).toUpperCase()}
                </div>
                <div className="tip-body">
                  <div className="tip-head">
                    <span className="tip-name" title={tip.from}>
                      {display}
                    </span>
                    <span className="tip-amount">
                      +{formatAmount(tip.amount, decimals)} {symbol}
                    </span>
                  </div>
                  {tip.message ? <p className="tip-message">{tip.message}</p> : null}
                  <time className="tip-time" dateTime={new Date(Number(tip.timestamp) * 1000).toISOString()} title={absoluteTime(tip.timestamp)}>
                    {timeAgo(tip.timestamp)}
                  </time>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {hasMore ? (
        <button type="button" className="button block" onClick={onLoadMore}>
          Load older tips
        </button>
      ) : null}
    </section>
  )
}
