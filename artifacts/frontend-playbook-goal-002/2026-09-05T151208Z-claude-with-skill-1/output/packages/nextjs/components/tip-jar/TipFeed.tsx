"use client";

import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatRelativeTime, formatUsdc } from "~~/utils/usdc";

const FEED_PAGE_SIZE = 25n;

/**
 * The tip feed, newest first.
 *
 * Read straight from contract storage via `getTips` rather than from logs: the jar keeps every
 * tip onchain, so the feed survives a node that has pruned its logs and needs no indexer.
 * `useScaffoldReadContract` watches new blocks, so a fresh tip shows up on its own.
 */
export const TipFeed = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getTips",
    args: [0n, FEED_PAGE_SIZE],
  });

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title text-xl m-0">Recent tips</h2>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map(row => (
              <div key={row} className="skeleton h-16 w-full" />
            ))}
          </div>
        )}

        {!isLoading && tips?.length === 0 && (
          <div className="text-center py-10 opacity-60">
            <p className="m-0">No tips yet.</p>
            <p className="m-0 text-sm">Be the first to drop something in the jar.</p>
          </div>
        )}

        {!isLoading && tips && tips.length > 0 && (
          <ul className="flex flex-col gap-3 m-0 p-0 list-none max-h-[32rem] overflow-y-auto">
            {tips.map((tip, index) => (
              <li
                key={`${tip.timestamp}-${tip.sender}-${index}`}
                className="border border-base-300 rounded-box p-4 bg-base-200/40"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Address address={tip.sender} chain={targetNetwork} size="sm" />
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold">${formatUsdc(tip.amount)}</span>
                    <span className="text-xs opacity-60">{formatRelativeTime(tip.timestamp)}</span>
                  </div>
                </div>
                {tip.message && <p className="mt-2 mb-0 break-words">{tip.message}</p>}
              </li>
            ))}
          </ul>
        )}

        {!isLoading && tips && tips.length >= Number(FEED_PAGE_SIZE) && (
          <p className="text-xs opacity-50 m-0">
            Showing the {FEED_PAGE_SIZE.toString()} most recent tips. Older ones are still onchain — read them with
            `getTips(offset, limit)`.
          </p>
        )}
      </div>
    </div>
  );
};
