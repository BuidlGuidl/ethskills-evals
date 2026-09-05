"use client";

import { useEffect, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdc, formatUsdcExact, timeAgo } from "~~/utils/usdc";

const PAGE_SIZE = 10;

/** Ticks once a minute so "3m ago" does not go stale, and stays null on the server to keep SSR stable. */
const useNow = () => {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  return now;
};

/** The tip feed, newest first, read straight from the contract. */
export const TipFeed = () => {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const now = useNow();
  const { targetNetwork } = useTargetNetwork();

  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getLatestTips",
    args: [0n, BigInt(visible)],
  });

  const total = Number(tipCount ?? 0n);
  const hasMore = total > visible;

  return (
    <div className="w-full max-w-xl flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold m-0">Tip feed</h2>
        {total > 0 && <span className="text-sm opacity-60">{total} total</span>}
      </div>

      {isLoading && !tips && <div className="skeleton h-24 w-full" />}

      {tips?.length === 0 && (
        <div className="card bg-base-100 border border-dashed border-base-300">
          <div className="card-body items-center text-center py-10">
            <p className="m-0 font-medium">No tips yet</p>
            <p className="m-0 text-sm opacity-60">Be the first to drop some USDC in the jar.</p>
          </div>
        </div>
      )}

      {tips?.map((tip, index) => (
        <div
          key={`${total - index}-${tip.timestamp}-${tip.from}`}
          className="card bg-base-100 border border-base-300 shadow-sm"
        >
          <div className="card-body gap-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Address address={tip.from} size="sm" chain={targetNetwork} />
              <div className="flex items-center gap-2">
                <span
                  className="badge badge-primary badge-lg font-semibold"
                  title={`${formatUsdcExact(tip.amount)} USDC`}
                >
                  ${formatUsdc(tip.amount)}
                </span>
                <span className="text-xs opacity-60" title={new Date(Number(tip.timestamp) * 1000).toLocaleString()}>
                  {now === null ? "" : timeAgo(tip.timestamp, now)}
                </span>
              </div>
            </div>
            {tip.message && <p className="m-0 break-words whitespace-pre-wrap">{tip.message}</p>}
          </div>
        </div>
      ))}

      {hasMore && (
        <button className="btn btn-ghost btn-sm self-center" onClick={() => setVisible(current => current + PAGE_SIZE)}>
          Show older tips
        </button>
      )}
    </div>
  );
};
