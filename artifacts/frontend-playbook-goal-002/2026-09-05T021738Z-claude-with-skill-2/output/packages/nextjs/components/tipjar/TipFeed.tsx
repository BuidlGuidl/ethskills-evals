"use client";

import { Address } from "@scaffold-ui/components";
import { useAccount, useBlock } from "wagmi";
import { useScaffoldReadContract, useScaffoldWatchContractEvent, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { formatUsdc, timeAgo } from "~~/utils/tipJar";

const FEED_SIZE = 25n;

/**
 * Live feed of the most recent tips. Reads straight from the jar (`latestTips`), which is
 * refreshed on every new block by `useScaffoldReadContract`, and toasts on the `TipReceived`
 * event so tips from other people show up while you watch.
 */
export const TipFeed = () => {
  const { targetNetwork } = useTargetNetwork();
  const { address: connectedAddress } = useAccount();
  const { data: tips, isLoading } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "latestTips",
    args: [FEED_SIZE],
  });
  // The fork's clock is the source of truth for tip ages, not the browser's.
  const { data: block } = useBlock({ watch: true, chainId: targetNetwork.id });

  useScaffoldWatchContractEvent({
    contractName: "TipJar",
    eventName: "TipReceived",
    onLogs: logs => {
      logs.forEach(log => {
        const { sender, amount } = log.args;
        // Your own tip already gets a confirmation from the form.
        if (!sender || amount === undefined || sender === connectedAddress) return;
        notification.info(`New tip: ${formatUsdc(amount)} USDC`);
      });
    },
  });

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6 w-full max-w-xl shadow-md">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-bold">Tip feed</h2>
        <span className="text-xs opacity-60">newest first</span>
      </div>

      {isLoading && !tips ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 bg-base-300 rounded animate-pulse" />
          ))}
        </div>
      ) : !tips || tips.length === 0 ? (
        <p className="text-sm opacity-70 py-8 text-center">No tips yet — be the first one in the jar. 🫙</p>
      ) : (
        <ul className="divide-y divide-base-300">
          {tips.map((tip, index) => (
            <li key={`${tip.timestamp}-${index}-${tip.sender}`} className="py-3 flex gap-3 items-start">
              <div className="grow min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Address address={tip.sender} size="sm" chain={targetNetwork} />
                  <span className="text-xs opacity-60">{timeAgo(tip.timestamp, block?.timestamp)}</span>
                </div>
                {tip.message ? (
                  <p className="text-sm mt-1 break-words">{tip.message}</p>
                ) : (
                  <p className="text-sm mt-1 italic opacity-50">no message</p>
                )}
              </div>
              <span className="font-bold whitespace-nowrap">{formatUsdc(tip.amount)} USDC</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
