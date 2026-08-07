"use client";

import { formatUsdc, shortenAddress, timeAgo } from "../lib/format";

export type TipItem = {
  from: `0x${string}`;
  amount: bigint;
  message: string;
  timestamp: bigint;
};

export function TipFeed({
  tips,
  isLoading,
}: {
  tips: readonly TipItem[] | undefined;
  isLoading: boolean;
}) {
  // Show newest first.
  const ordered = tips ? [...tips].reverse() : [];

  return (
    <div className="card">
      <h2>Tip feed</h2>

      {isLoading && !tips && <p className="muted">Loading tips…</p>}

      {tips && ordered.length === 0 && (
        <p className="muted">No tips yet. Be the first to drop one! 💙</p>
      )}

      <ul className="feed">
        {ordered.map((tip, i) => (
          <li key={`${tip.timestamp}-${i}`} className="feed-item">
            <div className="feed-row">
              <span className="feed-amount">{formatUsdc(tip.amount)} USDC</span>
              <span className="muted feed-time">{timeAgo(tip.timestamp)}</span>
            </div>
            <div className="feed-from muted">
              from {shortenAddress(tip.from)}
            </div>
            {tip.message && <div className="feed-message">“{tip.message}”</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
