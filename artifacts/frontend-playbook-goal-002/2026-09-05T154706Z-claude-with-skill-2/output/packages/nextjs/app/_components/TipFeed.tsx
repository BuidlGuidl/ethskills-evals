"use client";

import { useEffect, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatTimeAgo, formatTokenAmount } from "~~/utils/tip-jar/format";

export type TipEntry = {
  sender: string;
  amount: bigint;
  timestamp: bigint;
  message: string;
};

type TipFeedProps = {
  tips?: readonly TipEntry[];
  isLoading: boolean;
  symbol: string;
  decimals: number;
};

/** Re-render on a timer so the "x ago" labels stay honest without a page refresh. */
const useNow = (intervalMs = 15_000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export const TipFeed = ({ tips, isLoading, symbol, decimals }: TipFeedProps) => {
  const { targetNetwork } = useTargetNetwork();
  const now = useNow();

  if (isLoading && !tips) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-base-100 border border-base-300 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-base-300 rounded w-1/3 mb-3" />
            <div className="h-3 bg-base-300 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!tips?.length) {
    return (
      <div className="bg-base-100 border border-base-300 border-dashed rounded-xl p-10 text-center">
        <p className="font-medium m-0">No tips yet</p>
        <p className="text-sm opacity-60 mt-1 mb-0">Be the first to drop something in the jar.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3 list-none p-0 m-0">
      {tips.map((tip, index) => (
        <li
          key={`${tip.timestamp}-${tip.sender}-${index}`}
          className="bg-base-100 border border-base-300 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Address address={tip.sender as `0x${string}`} size="sm" chain={targetNetwork} />
            <div className="flex items-center gap-3">
              <span className="font-bold text-primary whitespace-nowrap">
                {formatTokenAmount(tip.amount, decimals)} {symbol}
              </span>
              <time
                className="text-xs opacity-60 whitespace-nowrap"
                dateTime={new Date(Number(tip.timestamp) * 1000).toISOString()}
                title={new Date(Number(tip.timestamp) * 1000).toLocaleString()}
              >
                {formatTimeAgo(tip.timestamp, now)}
              </time>
            </div>
          </div>
          {tip.message && <p className="mt-2 mb-0 break-words whitespace-pre-wrap">{tip.message}</p>}
        </li>
      ))}
    </ul>
  );
};
