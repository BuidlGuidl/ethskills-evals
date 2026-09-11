"use client";

import { useAccount } from "wagmi";
import { BanknotesIcon, HeartIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatUsdc } from "~~/utils/tip-jar";

const Stat = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="bg-base-100 border border-base-300 rounded-xl px-6 py-5 flex items-center gap-4 grow">
    <div className="text-primary">{icon}</div>
    <div>
      <p className="text-xs uppercase tracking-wide opacity-60 m-0">{label}</p>
      <p className="text-2xl font-bold m-0">{value}</p>
    </div>
  </div>
);

/** Headline numbers for the jar: what is in it, what it has taken, and your share. */
export const JarStats = () => {
  const { address: connectedAddress } = useAccount();

  const { data: balance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "balance" });
  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });
  const { data: yourTips } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tippedBy",
    args: [connectedAddress],
  });

  return (
    <div className="flex flex-col sm:flex-row gap-4 w-full">
      <Stat label="In the jar" value={`${formatUsdc(balance)} USDC`} icon={<BanknotesIcon className="h-8 w-8" />} />
      <Stat
        label={`All time (${tipCount?.toString() ?? "0"} tips)`}
        value={`${formatUsdc(totalTipped)} USDC`}
        icon={<HeartIcon className="h-8 w-8" />}
      />
      <Stat
        label="Your tips"
        value={`${formatUsdc(connectedAddress ? yourTips : 0n)} USDC`}
        icon={<UserCircleIcon className="h-8 w-8" />}
      />
    </div>
  );
};
