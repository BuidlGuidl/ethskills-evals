"use client";

import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

/**
 * Withdrawal controls, rendered only for the jar's owner.
 *
 * The contract enforces this too — this only keeps a button that would always revert out of
 * everyone else's way.
 */
export const OwnerPanel = () => {
  const { address: connectedAddress } = useAccount();

  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });
  const { data: jarBalance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "jarBalance" });
  const { data: totalWithdrawn } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalWithdrawn",
  });

  const { writeContractAsync: writeTipJar, isMining: isWithdrawing } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  const isOwner = Boolean(connectedAddress && owner && connectedAddress.toLowerCase() === owner.toLowerCase());
  if (!isOwner) return null;

  const hasBalance = (jarBalance ?? 0n) > 0n;

  const handleWithdraw = async () => {
    try {
      await writeTipJar({ functionName: "withdrawAll" });
    } catch (error) {
      console.error("Withdrawal failed", error);
    }
  };

  return (
    <div className="card bg-base-100 border border-primary/40 shadow-sm">
      <div className="card-body flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="card-title text-lg m-0">Owner controls</h2>
          <p className="m-0 text-sm opacity-70">
            ${formatUsdc(jarBalance)} USDC ready to withdraw · ${formatUsdc(totalWithdrawn)} withdrawn so far
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleWithdraw} disabled={!hasBalance || isWithdrawing}>
          {isWithdrawing ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Withdrawing…
            </>
          ) : (
            "Withdraw all"
          )}
        </button>
      </div>
    </div>
  );
};
