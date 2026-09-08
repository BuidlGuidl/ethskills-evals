"use client";

import { useAccount } from "wagmi";
import { ArrowPathIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/tip-jar";

/** Withdraw controls, rendered only for the account that owns the jar. */
export const OwnerPanel = () => {
  const { address: connectedAddress } = useAccount();
  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });
  const { data: balance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "balance" });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "TipJar" });

  const isOwner = !!connectedAddress && !!owner && connectedAddress.toLowerCase() === owner.toLowerCase();
  if (!isOwner) return null;

  return (
    <div className="bg-base-100 border border-primary/40 rounded-xl p-6 shadow-md w-full flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div>
        <h2 className="text-lg font-bold m-0">You own this jar</h2>
        <p className="text-sm opacity-70 m-0">
          {formatUsdc(balance)} USDC is waiting for you. Withdrawing sends it to your wallet and leaves the feed
          untouched.
        </p>
      </div>
      <button
        className="btn btn-primary"
        disabled={isMining || !balance || balance === 0n}
        onClick={() => writeContractAsync({ functionName: "withdrawAll" })}
      >
        {isMining ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowUpTrayIcon className="h-4 w-4" />}
        Withdraw all
      </button>
    </div>
  );
};
