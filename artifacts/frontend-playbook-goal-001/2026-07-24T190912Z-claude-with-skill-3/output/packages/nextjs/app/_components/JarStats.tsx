"use client";

import { Address } from "@scaffold-ui/components";
import { formatUnits } from "viem";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { USDC_DECIMALS, formatUsdc } from "~~/utils/usdc";

export const JarStats = () => {
  const { data: tipJar } = useScaffoldContract({ contractName: "TipJar" });
  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });
  const { data: jarBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [tipJar?.address],
  });

  return (
    <div className="card bg-base-100 shadow-md mb-6">
      <div className="card-body gap-4">
        <div className="stats stats-vertical sm:stats-horizontal bg-transparent">
          <div className="stat px-2">
            <div className="stat-title">Total tipped</div>
            <div className="stat-value text-2xl">{totalTipped !== undefined ? formatUsdc(totalTipped) : "…"}</div>
            <div className="stat-desc">USDC, all time</div>
          </div>
          <div className="stat px-2">
            <div className="stat-title">In the jar</div>
            <div className="stat-value text-2xl">
              {jarBalance !== undefined ? Number(formatUnits(jarBalance, USDC_DECIMALS)).toLocaleString() : "…"}
            </div>
            <div className="stat-desc">USDC, not yet withdrawn</div>
          </div>
          <div className="stat px-2">
            <div className="stat-title">Tips</div>
            <div className="stat-value text-2xl">{tipCount !== undefined ? tipCount.toString() : "…"}</div>
            <div className="stat-desc">messages left</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base-content/60">Jar contract:</span>
          {tipJar?.address ? <Address address={tipJar.address} size="sm" /> : <span>…</span>}
        </div>
      </div>
    </div>
  );
};
