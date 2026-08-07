"use client";

import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { Address } from "@scaffold-ui/components";
import {
  useDeployedContractInfo,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";

const formatUsdc = (value?: bigint) => (value === undefined ? "—" : `${formatUnits(value, 6)} USDC`);

/**
 * Headline stats for the jar: how many tips, how much has flowed through, the
 * balance waiting to be withdrawn, and an owner-only withdraw button.
 */
export const JarStats = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });
  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: jarBalance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "balance" });
  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });

  const { writeContractAsync: withdraw, isPending: isWithdrawing } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  const isOwner = !!connectedAddress && !!owner && connectedAddress.toLowerCase() === owner.toLowerCase();

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="stat bg-base-200 rounded-box">
            <div className="stat-title">Tips</div>
            <div className="stat-value text-2xl">{tipCount === undefined ? "—" : tipCount.toString()}</div>
          </div>
          <div className="stat bg-base-200 rounded-box">
            <div className="stat-title">Total tipped</div>
            <div className="stat-value text-2xl">{formatUsdc(totalTipped)}</div>
          </div>
          <div className="stat bg-base-200 rounded-box">
            <div className="stat-title">Awaiting withdrawal</div>
            <div className="stat-value text-2xl">{formatUsdc(jarBalance)}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Jar:</span>
            {tipJar?.address ? <Address address={tipJar.address} chain={targetNetwork} size="sm" /> : "—"}
          </div>
          {isOwner && (
            <button
              className="btn btn-outline btn-sm"
              disabled={isWithdrawing || !jarBalance || jarBalance === 0n}
              onClick={async () => {
                await withdraw({ functionName: "withdraw" });
              }}
            >
              {isWithdrawing ? <span className="loading loading-spinner loading-xs" /> : "Withdraw"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
