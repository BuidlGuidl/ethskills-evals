"use client";

import { Address } from "@scaffold-ui/components";
import { OwnerWithdraw } from "~~/components/tipjar/OwnerWithdraw";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/usdc";

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col items-center px-6 py-4">
    <span className="text-3xl font-bold tabular-nums">{value}</span>
    <span className="text-xs uppercase tracking-wide opacity-60">{label}</span>
  </div>
);

/**
 * Headline numbers for the jar: lifetime tips, current balance and tip count.
 */
export const JarSummary = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });
  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: balance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "balance" });
  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });

  return (
    <div className="bg-base-100 rounded-2xl shadow-md w-full">
      <div className="flex flex-wrap justify-center divide-x divide-base-300">
        <Stat label="Tipped all time" value={`$${formatUsdc(totalTipped)}`} />
        <Stat label="In the jar" value={`$${formatUsdc(balance)}`} />
        <Stat label="Tips" value={tipCount === undefined ? "—" : tipCount.toString()} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-base-300 px-6 py-3 text-sm">
        <span className="opacity-60">Jar owner:</span>
        <Address address={owner} size="sm" chain={targetNetwork} />
      </div>
      <OwnerWithdraw />
    </div>
  );
};
