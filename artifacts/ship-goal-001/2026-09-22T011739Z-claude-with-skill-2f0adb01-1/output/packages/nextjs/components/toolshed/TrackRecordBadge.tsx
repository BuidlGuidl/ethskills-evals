"use client";

import { trackRecord, trackRecordTone } from "~~/utils/toolshed/reputation";
import { MemberStats } from "~~/utils/toolshed/types";

const TONE_CLASS = {
  neutral: "badge-ghost",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
} as const;

/** The track record, everywhere it's shown: a badge plus the raw counts behind it. */
export const TrackRecordBadge = ({ stats, showCounts = true }: { stats: MemberStats; showCounts?: boolean }) => {
  const record = trackRecord(stats);
  const counts = [
    `${record.loans} ${record.loans === 1 ? "loan" : "loans"}`,
    `${record.lateReturns} late`,
    record.defaults > 0 ? `${record.defaults} never returned` : null,
    record.lent > 0 ? `${record.lent} lent out` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`badge badge-sm ${TONE_CLASS[trackRecordTone(record)]}`}>{record.label}</span>
      {showCounts && <span className="text-xs opacity-60">{counts}</span>}
    </div>
  );
};
