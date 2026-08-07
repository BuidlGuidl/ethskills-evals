"use client";

import { formatUnits } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const formatUsdc = (value: bigint | undefined) =>
  value === undefined
    ? "—"
    : Number(formatUnits(value, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const JarStats = () => {
  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: balance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "balance" });
  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });

  return (
    <div className="stats stats-vertical sm:stats-horizontal bg-base-100 shadow w-full">
      <div className="stat">
        <div className="stat-title">Total tipped</div>
        <div className="stat-value text-primary text-2xl sm:text-3xl">{formatUsdc(totalTipped)}</div>
        <div className="stat-desc">USDC, all time</div>
      </div>
      <div className="stat">
        <div className="stat-title">In the jar</div>
        <div className="stat-value text-2xl sm:text-3xl">{formatUsdc(balance)}</div>
        <div className="stat-desc">USDC awaiting withdrawal</div>
      </div>
      <div className="stat">
        <div className="stat-title">Tips</div>
        <div className="stat-value text-2xl sm:text-3xl">{tipCount === undefined ? "—" : tipCount.toString()}</div>
        <div className="stat-desc">messages received</div>
      </div>
    </div>
  );
};
