"use client";

import { formatUnits } from "viem";
import { Address } from "@scaffold-ui/components";
import { useScaffoldEventHistory, useTargetNetwork } from "~~/hooks/scaffold-eth";

const formatTime = (timestamp?: bigint) => {
  if (timestamp === undefined) return "";
  return new Date(Number(timestamp) * 1000).toLocaleString();
};

/** Live feed of every tip, newest first, read from the on-chain NewTip events. */
export const TipFeed = () => {
  const { targetNetwork } = useTargetNetwork();
  // No explicit fromBlock: the hook defaults to the contract's deployedOnBlock. On a
  // Base fork that keeps eth_getLogs within local blocks — querying from block 0 would
  // forward to the real Base RPC, which caps getLogs at a 10k block range and errors.
  const { data: tips, isLoading } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "NewTip",
    watch: true,
  });

  // Sort newest-first ourselves so the feed order doesn't depend on hook internals.
  const sortedTips = [...(tips ?? [])].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return Number(b.blockNumber - a.blockNumber);
    return Number(b.logIndex) - Number(a.logIndex);
  });

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Tip feed</h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : sortedTips.length === 0 ? (
          <p className="text-center py-8 opacity-70">No tips yet — be the first!</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sortedTips.map((tip, index) => (
              <li key={`${tip.transactionHash}-${index}`} className="bg-base-200 rounded-box p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Address address={tip.args.from} chain={targetNetwork} size="sm" />
                  <span className="font-bold">{formatUnits(tip.args.amount ?? 0n, 6)} USDC</span>
                </div>
                {tip.args.message && <p className="mt-2 break-words">{tip.args.message}</p>}
                <p className="text-xs opacity-60 mt-1">{formatTime(tip.args.timestamp)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
