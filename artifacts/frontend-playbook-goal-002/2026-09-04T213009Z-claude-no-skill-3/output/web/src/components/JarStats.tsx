import { explorerAddressUrl } from '../config'
import { formatAmount, shortAddress } from '../lib/format'

type Props = {
  chainId: number
  tipJar: string | undefined
  owner: string | undefined
  totalTipped: bigint | undefined
  tipCount: bigint | undefined
  balance: bigint | undefined
  decimals: number
  symbol: string
}

export function JarStats({ chainId, tipJar, owner, totalTipped, tipCount, balance, decimals, symbol }: Props) {
  const jarLink = tipJar ? explorerAddressUrl(chainId, tipJar) : undefined

  return (
    <section className="card stats" aria-label="Jar totals">
      <div className="stat">
        <span className="stat-label">Total tipped</span>
        <span className="stat-value">
          {formatAmount(totalTipped, decimals)} <span className="stat-unit">{symbol}</span>
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">Tips</span>
        <span className="stat-value">{tipCount === undefined ? '—' : tipCount.toString()}</span>
      </div>
      <div className="stat">
        <span className="stat-label">In the jar</span>
        <span className="stat-value">
          {formatAmount(balance, decimals)} <span className="stat-unit">{symbol}</span>
        </span>
      </div>

      <dl className="meta">
        <div>
          <dt>Jar</dt>
          <dd title={tipJar}>
            {jarLink ? (
              <a href={jarLink} target="_blank" rel="noreferrer">
                {shortAddress(tipJar)}
              </a>
            ) : (
              shortAddress(tipJar) || '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd title={owner}>{shortAddress(owner) || '—'}</dd>
        </div>
      </dl>
    </section>
  )
}
