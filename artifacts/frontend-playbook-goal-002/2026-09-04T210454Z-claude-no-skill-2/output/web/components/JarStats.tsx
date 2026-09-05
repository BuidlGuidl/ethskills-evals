'use client'

import { appConfig } from '@/lib/config'
import { useJarSummary } from '@/hooks/useTipJar'
import { formatUsdc, shortenAddress } from '@/lib/usdc'

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={mono ? 'stat__value stat__value--mono' : 'stat__value'}>{value}</span>
    </div>
  )
}

export function JarStats() {
  const { totalTipped, tipCount, balance } = useJarSummary()

  return (
    <section className="stats">
      <Stat label="Tipped all time" value={totalTipped === undefined ? '—' : `$${formatUsdc(totalTipped)}`} />
      <Stat label="Tips" value={tipCount === undefined ? '—' : tipCount.toString()} />
      <Stat label="In the jar" value={balance === undefined ? '—' : `$${formatUsdc(balance)}`} />
      <Stat
        label="Jar contract"
        mono
        value={appConfig.ok ? shortenAddress(appConfig.value.tipJar) : '—'}
      />
    </section>
  )
}
