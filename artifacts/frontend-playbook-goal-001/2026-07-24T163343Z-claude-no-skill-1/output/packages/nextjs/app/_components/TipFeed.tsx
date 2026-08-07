"use client";

import { Address } from "@scaffold-ui/components";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

const formatTime = (timestamp: bigint) => new Date(Number(timestamp) * 1000).toLocaleString();

/** Live feed of tips, newest first, read from the `NewTip` event log. */
export const TipFeed = () => {
  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "NewTip",
    fromBlock: 0n,
    watch: true,
  });

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Tip feed</h2>

        {isLoading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!isLoading && (!events || events.length === 0) && (
          <p className="opacity-70">No tips yet. Be the first to leave one!</p>
        )}

        <ul className="flex flex-col gap-3">
          {events?.map((event, index) => {
            const { from, amount, message, timestamp } = event.args;
            return (
              <li key={`${event.transactionHash}-${index}`} className="bg-base-200 rounded-box p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Address address={from} size="sm" />
                  <span className="badge badge-primary badge-lg">{formatUsdc(amount ?? 0n)} USDC</span>
                </div>
                {message && <p className="mt-2 break-words">{message}</p>}
                {timestamp !== undefined && <p className="mt-1 text-xs opacity-60">{formatTime(timestamp)}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
