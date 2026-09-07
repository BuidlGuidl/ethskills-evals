"use client";

import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

/**
 * Withdraw control, rendered only for the jar owner.
 */
export const OwnerWithdraw = () => {
  const { address: connectedAddress } = useAccount();
  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });
  const { data: balance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "balance" });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "TipJar" });

  const isOwner = !!connectedAddress && !!owner && connectedAddress.toLowerCase() === owner.toLowerCase();
  if (!isOwner) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-base-300 px-6 py-3 text-sm">
      <span className="opacity-60">You own this jar.</span>
      <button
        className="btn btn-sm btn-secondary"
        disabled={isMining || !balance}
        onClick={async () => {
          try {
            await writeContractAsync({ functionName: "withdraw" });
          } catch (error) {
            console.error("Withdraw failed", error);
          }
        }}
      >
        {isMining && <span className="loading loading-spinner loading-xs" />}
        Withdraw ${formatUsdc(balance)}
      </button>
    </div>
  );
};
