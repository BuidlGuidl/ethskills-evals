'use client';

import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { tipJarAbi } from '@/lib/abi';
import { TIP_JAR_ADDRESS, USDC_DECIMALS } from '@/lib/contracts';

type Tip = {
  tipper: `0x${string}`;
  amount: bigint;
  message: string;
  timestamp: bigint;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: bigint) {
  const seconds = Math.floor(Date.now() / 1000) - Number(ts);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function TipFeed() {
  const { data, isLoading, isError } = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: 'getRecentTips',
    args: [50n],
    query: {
      // Poll so the feed reflects new tips (including from other accounts).
      refetchInterval: 4000,
    },
  });

  const tips = (data as Tip[] | undefined) ?? [];

  return (
    <div className="card">
      <h2>Tip feed</h2>

      {isLoading && <div className="empty">Loading tips…</div>}

      {isError && (
        <div className="notice error">
          Couldn&apos;t read the tip jar. Is your wallet connected to the local
          Anvil network (chain 31337) and is the contract deployed?
        </div>
      )}

      {!isLoading && !isError && tips.length === 0 && (
        <div className="empty">No tips yet — be the first to drop one. 🫙</div>
      )}

      {tips.map((tip, i) => (
        <div className="tip" key={`${tip.timestamp}-${i}`}>
          <div className="tip-head">
            <span className="amount">
              {formatUnits(tip.amount, USDC_DECIMALS)} USDC
            </span>
            <span className="addr" title={tip.tipper}>
              {shortAddr(tip.tipper)}
            </span>
          </div>
          {tip.message && <div className="message">{tip.message}</div>}
          <div className="time">{timeAgo(tip.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}
