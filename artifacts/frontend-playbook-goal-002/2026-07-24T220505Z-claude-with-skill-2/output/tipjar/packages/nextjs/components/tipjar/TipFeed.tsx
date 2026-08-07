"use client";

import { formatUnits } from "viem";
import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const timeAgo = (timestamp: bigint) => {
  const seconds = Math.floor(Date.now() / 1000 - Number(timestamp));
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * Chronological feed of every tip, newest first.
 */
export const TipFeed = () => {
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getAllTips",
  });

  // Newest first without mutating the underlying array.
  const feed = tips ? [...tips].reverse() : [];

  return (
    <div className="card bg-base-100 shadow w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Tip feed</h2>

        {isLoading && <span className="loading loading-spinner mx-auto"></span>}

        {!isLoading && feed.length === 0 && (
          <p className="text-center opacity-60 m-0">No tips yet — be the first!</p>
        )}

        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {feed.map((tip, i) => (
            <li key={feed.length - i} className="flex flex-col gap-1 border border-base-300 rounded-box p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Address address={tip.from} size="sm" />
                <span className="badge badge-primary badge-lg font-semibold">
                  ${Number(formatUnits(tip.amount, USDC_DECIMALS)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {tip.message && <p className="m-0 break-words">{tip.message}</p>}
              <span className="text-xs opacity-50">{timeAgo(tip.timestamp)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
