"use client";

import { useEffect, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdc, timeAgo } from "~~/utils/tip-jar";

const FEED_SIZE = 25n;

/**
 * The tip feed, newest first.
 *
 * Tips are read straight from contract storage rather than from logs, so the feed
 * survives an RPC that trims log history and needs no indexer. `useScaffoldReadContract`
 * watches for new blocks, so a tip shows up here on its own.
 */
export const TipFeed = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getLatestTips",
    args: [FEED_SIZE],
  });

  // Relative timestamps only settle on the client, otherwise SSR and the first
  // client render disagree.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6 shadow-md w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold m-0">Tip feed</h2>
        {tips && tips.length > 0 && <span className="badge badge-ghost">last {tips.length}</span>}
      </div>

      {isLoading && !tips ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(row => (
            <div key={row} className="h-16 bg-base-300 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !tips || tips.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 opacity-70">
          <ChatBubbleLeftRightIcon className="h-10 w-10 mb-2" />
          <p className="m-0">No tips yet. Be the first one.</p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-3 max-h-[32rem] overflow-y-auto">
          {tips.map((tip, index) => (
            <li
              key={`${tip.timestamp}-${tip.sender}-${index}`}
              className="border border-base-300 rounded-lg p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Address address={tip.sender} size="sm" chain={targetNetwork} />
                <span className="font-bold text-primary whitespace-nowrap">{formatUsdc(tip.amount)} USDC</span>
              </div>
              {tip.message && <p className="m-0 break-words">{tip.message}</p>}
              <span className="text-xs opacity-60">{nowMs === null ? "" : timeAgo(tip.timestamp, nowMs)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
