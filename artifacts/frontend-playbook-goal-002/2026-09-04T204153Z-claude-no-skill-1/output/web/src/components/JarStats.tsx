import { formatUSDC, shortenAddress } from '../lib/format'

type Props = {
  tipCount?: bigint
  totalTipped?: bigint
  balance?: bigint
  owner?: string
}

export function JarStats({ tipCount, totalTipped, balance, owner }: Props) {
  return (
    <dl className="stats">
      <Stat label="Tips received" value={tipCount === undefined ? '—' : tipCount.toString()} />
      <Stat
        label="Total tipped"
        value={totalTipped === undefined ? '—' : `${formatUSDC(totalTipped)} USDC`}
      />
      <Stat
        label="In the jar"
        value={balance === undefined ? '—' : `${formatUSDC(balance)} USDC`}
      />
      <Stat label="Paid out to" value={owner ? shortenAddress(owner) : '—'} title={owner} />
    </dl>
  )
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value" title={title}>
        {value}
      </dd>
    </div>
  )
}
