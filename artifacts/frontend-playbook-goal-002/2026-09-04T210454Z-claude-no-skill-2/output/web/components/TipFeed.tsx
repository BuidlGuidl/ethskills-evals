'use client'

import { useConnection } from 'wagmi'
import { useTipFeed } from '@/hooks/useTipJar'
import { formatTimestamp, formatUsdc, shortenAddress } from '@/lib/usdc'

export function TipFeed() {
  const { address } = useConnection()
  const { tips, isPending, error } = useTipFeed()

  return (
    <section className="card">
      <div className="card__head">
        <h2>Recent tips</h2>
        {tips.length > 0 ? <span className="muted">{tips.length} shown</span> : null}
      </div>

      {error ? (
        <p className="error" role="alert">
          Could not read the feed: {error.message.split('\n')[0]}
        </p>
      ) : isPending ? (
        <ul className="feed" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className="tip tip--skeleton" />
          ))}
        </ul>
      ) : tips.length === 0 ? (
        <p className="muted empty">No tips yet. Be the first.</p>
      ) : (
        <ul className="feed" data-testid="tip-feed">
          {tips.map((tip, index) => (
            <li key={`${tip.timestamp}-${tip.sender}-${index}`} className="tip">
              <div className="tip__head">
                <span className="tip__sender" title={tip.sender}>
                  {shortenAddress(tip.sender)}
                  {address && tip.sender.toLowerCase() === address.toLowerCase() ? (
                    <span className="tag">you</span>
                  ) : null}
                </span>
                <span className="tip__amount">{formatUsdc(tip.amount)} USDC</span>
              </div>
              {tip.message ? <p className="tip__message">{tip.message}</p> : null}
              <time className="tip__time" dateTime={new Date(Number(tip.timestamp) * 1000).toISOString()}>
                {formatTimestamp(tip.timestamp)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
