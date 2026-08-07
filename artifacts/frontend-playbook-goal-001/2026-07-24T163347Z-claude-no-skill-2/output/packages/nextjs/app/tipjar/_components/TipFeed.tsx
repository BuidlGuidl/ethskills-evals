"use client";

import { Address } from "@scaffold-ui/components";
import { formatUnits } from "viem";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const formatTime = (timestamp?: bigint) => {
  if (!timestamp) return "";
  return new Date(Number(timestamp) * 1000).toLocaleString();
};

export const TipFeed = () => {
  const { data: tips, isLoading } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "NewTip",
    fromBlock: 0n,
    watch: true,
  });

  const sorted = [...(tips ?? [])].sort((a, b) => Number((b.args.id ?? 0n) - (a.args.id ?? 0n)));

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Tip feed</h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="opacity-70 m-0">No tips yet. Be the first to drop one in the jar.</p>
        ) : (
          <ul className="flex flex-col gap-3 m-0 p-0 list-none">
            {sorted.map(tip => (
              <li key={`${tip.args.id}`} className="border border-base-300 rounded-box p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Address address={tip.args.from} size="sm" />
                  <span className="badge badge-primary badge-lg">
                    {formatUnits(tip.args.amount ?? 0n, USDC_DECIMALS)} USDC
                  </span>
                </div>
                {tip.args.message && <p className="mt-2 mb-1 break-words">{tip.args.message}</p>}
                <span className="text-xs opacity-60">{formatTime(tip.args.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
