"use client";

import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

const StatValue = ({ value, isLoading }: { value: string; isLoading: boolean }) =>
  isLoading ? <span className="skeleton inline-block h-7 w-24 align-middle" /> : <span>{value}</span>;

/**
 * Headline numbers for the jar: lifetime tips, how many there were, and what is still sitting
 * in the contract waiting to be withdrawn.
 */
export const JarStats = () => {
  const { targetNetwork } = useTargetNetwork();

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
    functionName: "jarBalance",
  });
  const { data: owner } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "owner",
  });

  return (
    <div className="w-full">
      <div className="stats stats-vertical sm:stats-horizontal bg-base-100 border border-base-300 w-full shadow-sm">
        <div className="stat">
          <div className="stat-title">Tipped all time</div>
          <div className="stat-value text-2xl sm:text-3xl">
            <StatValue value={`$${formatUsdc(totalTipped)}`} isLoading={isLoadingTotal} />
          </div>
          <div className="stat-desc">USDC on Base</div>
        </div>

        <div className="stat">
          <div className="stat-title">Tips received</div>
          <div className="stat-value text-2xl sm:text-3xl">
            <StatValue value={tipCount === undefined ? "—" : tipCount.toString()} isLoading={isLoadingCount} />
          </div>
          <div className="stat-desc">from the community</div>
        </div>

        <div className="stat">
          <div className="stat-title">In the jar</div>
          <div className="stat-value text-2xl sm:text-3xl">
            <StatValue value={`$${formatUsdc(jarBalance)}`} isLoading={isLoadingBalance} />
          </div>
          <div className="stat-desc">not yet withdrawn</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-3 text-sm opacity-70">
        <span>Jar owner:</span>
        <Address address={owner} chain={targetNetwork} size="sm" />
      </div>
    </div>
  );
};
