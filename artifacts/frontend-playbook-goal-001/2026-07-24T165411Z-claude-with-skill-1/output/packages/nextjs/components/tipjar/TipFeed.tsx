"use client";

import { formatUnits } from "viem";
import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const formatWhen = (timestamp: bigint) =>
  new Date(Number(timestamp) * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Live feed of the most recent tips plus the running total, read straight from the jar.
 */
export const TipFeed = () => {
  const { data: totalTipped } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalTipped",
  });

  const { data: tips } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getRecentTips",
    args: [50n],
  });

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-md">
      <div className="card-body gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="card-title">Tip feed</h2>
          <span className="text-sm opacity-70">
            Total: {totalTipped !== undefined ? `${formatUnits(totalTipped, USDC_DECIMALS)} USDC` : "—"}
          </span>
        </div>

        {!tips || tips.length === 0 ? (
          <p className="opacity-70 text-sm m-0">No tips yet. Be the first to drop some USDC.</p>
        ) : (
          <ul className="flex flex-col gap-3 m-0 p-0 list-none">
            {tips.map((tip, i) => (
              <li key={i} className="flex flex-col gap-1 border-b border-base-300 pb-3 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <Address address={tip.from} size="sm" />
                  <span className="font-bold whitespace-nowrap">{formatUnits(tip.amount, USDC_DECIMALS)} USDC</span>
                </div>
                {tip.message && <p className="m-0 text-sm break-words">{tip.message}</p>}
                <span className="text-xs opacity-50">{formatWhen(tip.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
