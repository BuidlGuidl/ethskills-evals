"use client";

import { useAccount } from "wagmi";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

/** Only rendered for the jar owner: withdraw everything the jar has collected. */
export const OwnerPanel = () => {
  const { address: connectedAddress } = useAccount();

  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });
  const { data: jarBalance, refetch: refetchBalance } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "balance",
  });
  const { writeContractAsync: writeTipJar, isMining: isWithdrawing } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  const isOwner = Boolean(connectedAddress && owner && connectedAddress.toLowerCase() === owner.toLowerCase());
  if (!isOwner) return null;

  const handleWithdraw = async () => {
    await writeTipJar({ functionName: "withdrawAll" });
    await refetchBalance();
  };

  return (
    <div className="alert bg-base-100 border border-base-300 w-full max-w-xl flex-col sm:flex-row items-center gap-3">
      <BanknotesIcon className="h-6 w-6 shrink-0" />
      <span className="grow text-sm">
        You own this jar. It holds <span className="font-semibold">${formatUsdc(jarBalance)} USDC</span>.
      </span>
      <button
        className="btn btn-sm btn-outline"
        onClick={handleWithdraw}
        disabled={isWithdrawing || !jarBalance || jarBalance === 0n}
      >
        {isWithdrawing ? (
          <>
            <span className="loading loading-spinner loading-xs" />
            Withdrawing…
          </>
        ) : (
          "Withdraw all"
        )}
      </button>
    </div>
  );
};
