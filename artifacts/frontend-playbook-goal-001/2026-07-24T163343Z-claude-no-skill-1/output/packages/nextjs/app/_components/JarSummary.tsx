"use client";

import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

/** Jar totals plus a withdraw button that only the owner can use. */
export const JarSummary = () => {
  const { address: connectedAddress } = useAccount();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });
  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });

  const { data: jarBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [tipJar?.address],
  });

  const { writeContractAsync: writeTipJar, isMining } = useScaffoldWriteContract({ contractName: "TipJar" });

  const isOwner = !!connectedAddress && !!owner && connectedAddress.toLowerCase() === owner.toLowerCase();

  return (
    <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 w-full">
      <div className="stat">
        <div className="stat-title">Collected in jar</div>
        <div className="stat-value text-primary">{jarBalance !== undefined ? formatUsdc(jarBalance) : "—"}</div>
        <div className="stat-desc">USDC available to withdraw</div>
      </div>

      <div className="stat">
        <div className="stat-title">All-time tipped</div>
        <div className="stat-value">{totalTipped !== undefined ? formatUsdc(totalTipped) : "—"}</div>
        <div className="stat-desc">{tipCount !== undefined ? `${tipCount.toString()} tips` : ""}</div>
      </div>

      {isOwner && (
        <div className="stat">
          <div className="stat-title">Owner</div>
          <div className="stat-actions">
            <button
              className="btn btn-sm btn-secondary"
              disabled={isMining || !jarBalance}
              onClick={() => writeTipJar({ functionName: "withdraw" })}
            >
              {isMining && <span className="loading loading-spinner loading-xs" />}
              Withdraw
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
