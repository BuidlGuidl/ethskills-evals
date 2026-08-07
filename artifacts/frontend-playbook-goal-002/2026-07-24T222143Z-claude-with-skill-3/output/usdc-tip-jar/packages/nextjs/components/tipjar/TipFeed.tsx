"use client";

import { formatUSDC, timeAgo } from "./format";
import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const FEED_SIZE = 25n;

/** Live feed of the most recent tips, newest first. */
export const TipFeed = () => {
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getRecentTips",
    args: [FEED_SIZE],
  });

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-4">
        <h2 className="card-title">Recent tips</h2>

        {isLoading && !tips ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : !tips || tips.length === 0 ? (
          <p className="text-center opacity-60 py-8">No tips yet — be the first! 🫙</p>
        ) : (
          <ul className="flex flex-col divide-y divide-base-300">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <Address address={tip.tipper} size="sm" />
                  {tip.message && <p className="text-sm break-words">{tip.message}</p>}
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="font-bold text-primary">${formatUSDC(tip.amount)}</span>
                  <span className="text-xs opacity-60">{timeAgo(tip.timestamp)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
