"use client";

import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdc, timeAgo } from "~~/utils/usdc";

const FEED_SIZE = 25n;

/**
 * The tip feed, newest first. Read straight from the contract (which stores
 * every tip), so it needs no indexer and refreshes on each new block.
 */
export const TipFeed = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "recentTips",
    args: [FEED_SIZE],
  });

  return (
    <div className="bg-base-100 rounded-2xl shadow-md w-full">
      <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
        <h2 className="text-lg font-bold m-0">Tip feed</h2>
        <span className="text-xs opacity-60">newest first</span>
      </div>

      {isLoading && !tips ? (
        <div className="p-6 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-base-300" />
          ))}
        </div>
      ) : !tips?.length ? (
        <p className="px-6 py-10 text-center opacity-60">No tips yet — be the first one to fill the jar.</p>
      ) : (
        <ul className="divide-y divide-base-300 m-0 list-none p-0">
          {tips.map((tip, index) => (
            <li key={`${tip.timestamp}-${index}`} className="flex items-start gap-4 px-6 py-4">
              <div className="min-w-0 grow">
                <div className="flex flex-wrap items-center gap-2">
                  <Address address={tip.from} size="sm" chain={targetNetwork} />
                  <span className="text-xs opacity-50">{timeAgo(tip.timestamp)}</span>
                </div>
                {tip.message ? <p className="mt-1 mb-0 break-words">{tip.message}</p> : null}
              </div>
              <span className="shrink-0 font-bold tabular-nums text-primary">${formatUsdc(tip.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
