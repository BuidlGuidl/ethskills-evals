"use client";

import { formatUSDC } from "./format";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

/** Headline numbers for the jar: lifetime tipped, tip count, current balance. */
export const JarStats = () => {
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const { data: totalTipped } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalTipped",
  });
  const { data: tipCount } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tipCount",
  });
  const { data: jarBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [tipJar?.address],
  });

  const stats = [
    { label: "Total tipped", value: `$${formatUSDC(totalTipped)}` },
    { label: "Tips", value: tipCount !== undefined ? tipCount.toString() : "0" },
    { label: "In the jar", value: `$${formatUSDC(jarBalance)}` },
  ];

  return (
    <div className="stats stats-vertical sm:stats-horizontal bg-base-100 shadow w-full">
      {stats.map(stat => (
        <div key={stat.label} className="stat place-items-center">
          <div className="stat-title">{stat.label}</div>
          <div className="stat-value text-2xl sm:text-3xl">{stat.value}</div>
        </div>
      ))}
    </div>
  );
};
