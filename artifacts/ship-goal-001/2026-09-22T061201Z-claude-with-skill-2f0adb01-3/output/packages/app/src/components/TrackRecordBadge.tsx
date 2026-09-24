"use client";

import { TIER_LABEL, lenderSummary, lenderTierLabel, type Tier, type TrackRecord } from "@/lib/reputation";
import { shortAddress } from "@/lib/format";

const TIER_STYLE: Record<Tier, string> = {
  solid: "bg-emerald-100 text-emerald-900",
  thin: "bg-shed-100 text-shed-700",
  new: "bg-shed-100 text-shed-700",
  mixed: "bg-amber-100 text-amber-900",
  unreliable: "bg-red-100 text-red-900",
  lost: "bg-red-100 text-red-900",
};

/** The track record, shown the same way everywhere: tier, then the raw counts behind it. */
export function TrackRecordBadge({
  record,
  address,
  className = "",
  /** "owner" leads with how much they have lent; "borrower" with how they return things. */
  as = "borrower",
}: {
  record: TrackRecord;
  address?: string;
  className?: string;
  as?: "borrower" | "owner";
}) {
  const label = as === "owner" ? lenderTierLabel(record) : TIER_LABEL[record.tier];
  const summary = as === "owner" ? lenderSummary(record) : record.summary;
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className={`rounded-full px-2 py-0.5 font-medium ${TIER_STYLE[record.tier]}`}>
        {label}
      </span>
      <span className="text-shed-600">{summary}</span>
      {address && <span className="font-mono text-shed-600">{shortAddress(address)}</span>}
    </div>
  );
}
