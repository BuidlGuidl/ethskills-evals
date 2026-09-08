"use client";

import { Address } from "@scaffold-ui/components";
import type { Address as AddressType } from "viem";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { formatTokenAmount } from "~~/utils/tip-jar/format";

type JarStatsProps = {
  totalTipped?: bigint;
  tipCount?: bigint;
  jarBalance?: bigint;
  owner?: AddressType;
  symbol: string;
  decimals: number;
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col items-center px-6 py-3">
    <span className="text-2xl font-bold leading-tight">{value}</span>
    <span className="text-xs uppercase tracking-wide opacity-60">{label}</span>
  </div>
);

export const JarStats = ({ totalTipped, tipCount, jarBalance, owner, symbol, decimals }: JarStatsProps) => {
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl shadow-md w-full">
      <div className="flex flex-wrap justify-center divide-x divide-base-300">
        <Stat
          label={`Total tipped`}
          value={totalTipped === undefined ? "—" : `${formatTokenAmount(totalTipped, decimals)} ${symbol}`}
        />
        <Stat label="Tips" value={tipCount === undefined ? "—" : tipCount.toString()} />
        <Stat
          label="In the jar"
          value={jarBalance === undefined ? "—" : `${formatTokenAmount(jarBalance, decimals)} ${symbol}`}
        />
      </div>
      {owner && (
        <div className="border-t border-base-300 flex items-center justify-center gap-2 py-2 text-sm">
          <span className="opacity-60">Tips go to</span>
          <Address address={owner} size="sm" chain={targetNetwork} />
        </div>
      )}
    </div>
  );
};
