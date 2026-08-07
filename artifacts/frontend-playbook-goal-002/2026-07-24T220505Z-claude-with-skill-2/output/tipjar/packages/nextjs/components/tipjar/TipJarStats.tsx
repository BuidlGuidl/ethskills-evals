"use client";

import { formatUnits } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const fmt = (value: bigint | undefined) =>
  value === undefined ? "—" : Number(formatUnits(value, USDC_DECIMALS)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Headline numbers for the jar: lifetime tips, current balance, and tip count.
 */
export const TipJarStats = () => {
  const { data: totalTipped } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalTipped",
  });
  const { data: jarBalance } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "jarBalance",
  });
  const { data: tipCount } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tipCount",
  });

  return (
    <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 w-full">
      <div className="stat place-items-center">
        <div className="stat-title">Total tipped</div>
        <div className="stat-value text-primary text-2xl">${fmt(totalTipped)}</div>
        <div className="stat-desc">USDC, all time</div>
      </div>
      <div className="stat place-items-center">
        <div className="stat-title">In the jar</div>
        <div className="stat-value text-2xl">${fmt(jarBalance)}</div>
        <div className="stat-desc">USDC, not yet withdrawn</div>
      </div>
      <div className="stat place-items-center">
        <div className="stat-title">Tips</div>
        <div className="stat-value text-2xl">{tipCount === undefined ? "—" : tipCount.toString()}</div>
        <div className="stat-desc">total sent</div>
      </div>
    </div>
  );
};
