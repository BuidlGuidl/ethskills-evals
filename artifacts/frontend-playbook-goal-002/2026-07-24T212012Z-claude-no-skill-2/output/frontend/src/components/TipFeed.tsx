import { useReadContract } from "wagmi";
import { formatUnits } from "viem";

import { TIP_JAR_ADDRESS, tipJarAbi, USDC_DECIMALS, type Tip } from "../contracts";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function timeAgo(ts: bigint) {
  const seconds = Math.floor(Date.now() / 1000 - Number(ts));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TipFeed() {
  const { data, isLoading, isError } = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: "getRecentTips",
    args: [50n],
    // Poll so newly sent tips (from this or other users) show up.
    query: { refetchInterval: 4000 },
  });

  const tips = (data ?? []) as readonly Tip[];

  return (
    <div className="card">
      <h2>Tip feed</h2>

      {isLoading && <p className="muted">Loading tips…</p>}
      {isError && (
        <p className="warn">
          Could not read tips. Is the local chain running and the contract
          deployed?
        </p>
      )}
      {!isLoading && !isError && tips.length === 0 && (
        <p className="muted">No tips yet — be the first!</p>
      )}

      <ul className="feed">
        {tips.map((t, i) => (
          <li key={`${t.timestamp}-${i}`} className="tip">
            <div className="tip-head">
              <span className="mono">{shortAddr(t.from)}</span>
              <span className="amount">
                ${formatUnits(t.amount, USDC_DECIMALS)}
              </span>
            </div>
            {t.message && <p className="tip-msg">{t.message}</p>}
            <span className="tip-time">{timeAgo(t.timestamp)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
