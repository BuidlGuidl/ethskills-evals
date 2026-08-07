"use client";

import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

const timeAgo = (timestamp: bigint) => {
  const seconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
};

export const TipFeed = () => {
  const { data: tips, isLoading } = useScaffoldReadContract({ contractName: "TipJar", functionName: "getTips" });

  // getTips() returns oldest-first; show newest-first.
  const feed = tips ? [...tips].reverse() : [];

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body gap-4">
        <h2 className="card-title">Tip feed</h2>

        {isLoading && <span className="loading loading-spinner mx-auto" />}

        {!isLoading && feed.length === 0 && (
          <p className="text-center text-base-content/60 py-4">No tips yet. Be the first!</p>
        )}

        <ul className="flex flex-col gap-3">
          {feed.map((tip, i) => (
            <li
              key={`${tip.timestamp}-${i}`}
              className="flex flex-col gap-1 border-b border-base-300 pb-3 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <Address address={tip.tipper} size="sm" />
                <span className="badge badge-primary badge-lg whitespace-nowrap">{formatUsdc(tip.amount)} USDC</span>
              </div>
              {tip.message && <p className="text-base-content/90 break-words">{tip.message}</p>}
              <span className="text-xs text-base-content/50">{timeAgo(tip.timestamp)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
