'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { tipJarAbi } from '@/lib/abi';
import { TIP_JAR_ADDRESS, USDC_DECIMALS } from '@/lib/contracts';
import { TipForm } from '@/components/TipForm';
import { TipFeed } from '@/components/TipFeed';

function Stats() {
  const { data: total } = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: 'totalTipped',
    query: { refetchInterval: 4000 },
  });
  const { data: count } = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: 'tipCount',
    query: { refetchInterval: 4000 },
  });

  return (
    <div className="stats">
      <div className="stat">
        <div className="label">Total tipped</div>
        <div className="value">
          {total !== undefined
            ? `${formatUnits(total as bigint, USDC_DECIMALS)}`
            : '—'}{' '}
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>USDC</span>
        </div>
      </div>
      <div className="stat">
        <div className="label">Tips</div>
        <div className="value">
          {count !== undefined ? Number(count as bigint) : '—'}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="container">
      <header className="topbar">
        <div className="brand">
          <span className="coin">$</span>
          <span>USDC Tip Jar</span>
        </div>
        <ConnectButton />
      </header>

      <Stats />
      <TipForm />
      <TipFeed />

      <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
        Tips are settled in USDC on Base. This build runs against a local Anvil
        chain.
      </p>
    </main>
  );
}
