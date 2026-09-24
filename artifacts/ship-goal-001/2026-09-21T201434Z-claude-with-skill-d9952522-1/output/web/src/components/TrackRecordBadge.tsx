import type { TrackRecord } from "@/core/reputation";

/**
 * The track record, stated in plain numbers rather than as a score out of
 * five. Neighbors trust "14 loans, 1 late" more than they trust "4.6 stars",
 * and the underlying facts are all public onchain anyway.
 */
export function TrackRecordBadge({ record }: { record: TrackRecord }) {
  if (record.loansBorrowed === 0 && record.loansLent === 0) {
    return <span className="badge new">New neighbor</span>;
  }

  const parts: string[] = [];
  if (record.loansBorrowed > 0) {
    parts.push(`${record.loansBorrowed} ${record.loansBorrowed === 1 ? "loan" : "loans"}`);
    parts.push(record.lateReturns === 0 ? "all on time" : `${record.lateReturns} late`);
  }
  if (record.loansLent > 0) parts.push(`lent ${record.loansLent}`);
  if (record.unreturned > 0) parts.push(`${record.unreturned} never returned`);

  const shaky = record.unreturned > 0 || (record.onTimeRate !== null && record.onTimeRate < 0.6);

  return <span className={`badge${shaky ? " shaky" : ""}`}>{parts.join(" · ")}</span>;
}
