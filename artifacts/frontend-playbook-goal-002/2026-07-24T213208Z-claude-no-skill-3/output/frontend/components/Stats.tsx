"use client";

import { formatUsdc } from "../lib/format";

export function Stats({
  totalTipped,
  tipCount,
  jarBalance,
}: {
  totalTipped: bigint | undefined;
  tipCount: bigint | undefined;
  jarBalance: bigint | undefined;
}) {
  return (
    <div className="stats">
      <Stat
        label="Total tipped"
        value={totalTipped !== undefined ? `${formatUsdc(totalTipped)} USDC` : "…"}
      />
      <Stat
        label="Tips"
        value={tipCount !== undefined ? tipCount.toString() : "…"}
      />
      <Stat
        label="In the jar"
        value={jarBalance !== undefined ? `${formatUsdc(jarBalance)} USDC` : "…"}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
