"use client";

import { Address } from "@scaffold-ui/components";
import { useDeployedContractInfo, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="stat place-items-center">
    <div className="stat-title text-xs uppercase tracking-wide">{label}</div>
    <div className="stat-value text-2xl md:text-3xl">{value}</div>
    {hint && <div className="stat-desc">{hint}</div>}
  </div>
);

/** Headline numbers for the jar: lifetime tips, how many, and what is still sitting in it. */
export const JarStats = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const { data: totalTipped, isLoading: isLoadingTotal } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalTipped",
  });
  const { data: tipCount, isLoading: isLoadingCount } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tipCount",
  });
  const { data: jarBalance, isLoading: isLoadingBalance } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "balance",
  });

  return (
    <div className="w-full max-w-3xl">
      <div className="stats stats-vertical sm:stats-horizontal bg-base-100 border border-base-300 w-full shadow-sm">
        <Stat label="Tipped all time" value={isLoadingTotal ? "…" : `$${formatUsdc(totalTipped)}`} hint="USDC" />
        <Stat label="Tips" value={isLoadingCount ? "…" : (tipCount ?? 0n).toString()} hint="messages in the feed" />
        <Stat
          label="In the jar"
          value={isLoadingBalance ? "…" : `$${formatUsdc(jarBalance)}`}
          hint="not yet withdrawn"
        />
      </div>
      {tipJar?.address && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-sm opacity-70">
          <span>Jar contract</span>
          <Address address={tipJar.address} size="sm" chain={targetNetwork} />
        </div>
      )}
    </div>
  );
};
