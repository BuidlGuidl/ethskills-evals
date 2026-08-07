"use client";

import { Address } from "@scaffold-ui/components";
import { formatUnits } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const formatWhen = (timestamp: bigint) => {
  const date = new Date(Number(timestamp) * 1000);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString();
};

/**
 * Live feed of tips read straight from the TipJar contract. `getTips` returns
 * the whole feed oldest-first; we reverse it to show the newest tip on top.
 * The scaffold read hook re-fetches on every new block, so new tips appear
 * automatically.
 */
export const TipFeed = () => {
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getTips",
  });

  const ordered = tips ? [...tips].reverse() : [];

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-md">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="card-title m-0">Tip feed</h2>
          <span className="badge badge-ghost">{ordered.length}</span>
        </div>

        {isLoading && ordered.length === 0 ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner" />
          </div>
        ) : ordered.length === 0 ? (
          <p className="opacity-60 text-sm py-6 text-center">No tips yet. Be the first to drop one in the jar!</p>
        ) : (
          <ul className="flex flex-col gap-3 max-h-[28rem] overflow-y-auto pr-1">
            {ordered.map((tip, i) => (
              <li key={ordered.length - i} className="border border-base-300 rounded-box p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Address address={tip.from} size="sm" onlyEnsOrAddress />
                  <span className="font-bold text-primary whitespace-nowrap">
                    {Number(formatUnits(tip.amount, USDC_DECIMALS)).toLocaleString()} USDC
                  </span>
                </div>
                {tip.message ? <p className="text-sm break-words m-0">{tip.message}</p> : null}
                <span className="text-xs opacity-50">{formatWhen(tip.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
