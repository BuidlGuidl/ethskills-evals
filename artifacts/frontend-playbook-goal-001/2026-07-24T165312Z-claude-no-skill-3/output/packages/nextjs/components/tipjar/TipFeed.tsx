"use client";

import { Address } from "@scaffold-ui/components";
import { formatUnits } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const timeAgo = (timestamp: bigint) => {
  const seconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const TipFeed = () => {
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "recentTips",
    args: [50n],
  });

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Tip feed</h2>

        {isLoading && <div className="loading loading-spinner mx-auto" />}

        {!isLoading && (!tips || tips.length === 0) && (
          <p className="text-base-content/60 text-center py-6">No tips yet — be the first!</p>
        )}

        <ul className="flex flex-col gap-3">
          {tips?.map((tip, i) => (
            <li key={i} className="flex flex-col gap-1 border-b border-base-300 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <Address address={tip.from} size="sm" />
                <span className="badge badge-primary badge-lg whitespace-nowrap">
                  {Number(formatUnits(tip.amount, USDC_DECIMALS)).toLocaleString()} USDC
                </span>
              </div>
              {tip.message && <p className="text-sm break-words">{tip.message}</p>}
              <span className="text-xs text-base-content/50">{timeAgo(tip.timestamp)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
