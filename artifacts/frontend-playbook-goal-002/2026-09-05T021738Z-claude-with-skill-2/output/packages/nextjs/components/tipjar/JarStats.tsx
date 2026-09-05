"use client";

import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/tipJar";

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="bg-base-100 border border-base-300 rounded-xl px-6 py-4 text-center min-w-[9rem]">
    <p className="text-xs uppercase tracking-wide opacity-60">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
    {hint && <p className="text-xs opacity-60">{hint}</p>}
  </div>
);

/** Headline numbers for the jar, refreshed on every block. */
export const JarStats = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: jarBalance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "jarBalance" });
  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });
  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-4">
        <Stat label="Tipped all-time" value={`${formatUsdc(totalTipped)} USDC`} />
        <Stat label="In the jar" value={`${formatUsdc(jarBalance)} USDC`} hint="withdrawable by the owner" />
        <Stat label="Tips" value={tipCount === undefined ? "—" : tipCount.toString()} />
      </div>
      <div className="flex items-center gap-2 text-sm opacity-70">
        <span>Jar owner:</span>
        <Address address={owner} size="sm" chain={targetNetwork} />
      </div>
    </div>
  );
};
