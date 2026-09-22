"use client";

import { TxButton } from "./TxButton";
import { useMyCredits } from "@/hooks/useToolshed";
import { formatUsdc } from "@/lib/format";

/**
 * Only appears if a payout could not be pushed to you — in practice, the token refusing the
 * transfer (a frozen USDC address). Lives in the layout because the person owed might be a
 * lender, a borrower, or both, and none of them should have to go looking for it.
 */
export function CreditsBanner() {
  const credits = useMyCredits();
  const amount = (credits.data as bigint | undefined) ?? 0n;
  if (amount === 0n) return null;

  return (
    <div className="card mb-5 flex flex-wrap items-center gap-3 border-emerald-300 bg-emerald-50 p-4">
      <p className="flex-1 text-sm text-emerald-900">
        {formatUsdc(amount)} is waiting for you — a payout could not be sent to your address automatically.
      </p>
      <TxButton functionName="withdrawCredits" args={[]} pendingLabel="Claiming…">
        Claim {formatUsdc(amount)}
      </TxButton>
    </div>
  );
}
