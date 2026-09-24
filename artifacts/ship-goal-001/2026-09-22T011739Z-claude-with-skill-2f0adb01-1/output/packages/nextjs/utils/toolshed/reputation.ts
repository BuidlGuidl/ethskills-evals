import { MemberStats } from "./types";

/**
 * Track record, computed offchain from the counters the contract keeps.
 *
 * Reliability is the share of loans returned on time, with a Laplace prior (+1 good, +1 bad)
 * so that somebody who has borrowed once and got it back on time doesn't outrank a neighbour
 * with forty on-time returns. A default (tool never came back) counts as a bad outcome and
 * also as a loan.
 */
export type TrackRecord = {
  loans: number; // completed borrows + defaults
  onTime: number;
  lateReturns: number;
  defaults: number;
  totalLateDays: number;
  lent: number;
  reliability: number; // 0..1, smoothed
  /** Sort key for requests: reliability first, borrowing volume as tie-break. */
  score: number;
  /** Sort key for the browse screen, where lending volume counts too. */
  lenderScore: number;
  label: string;
};

export const trackRecord = (stats: MemberStats): TrackRecord => {
  const loans = stats.loansBorrowed + stats.defaults;
  const onTime = Math.max(stats.loansBorrowed - stats.lateReturns, 0);
  const bad = stats.lateReturns + stats.defaults;
  const reliability = (onTime + 1) / (onTime + bad + 2);

  return {
    loans,
    onTime,
    lateReturns: stats.lateReturns,
    defaults: stats.defaults,
    totalLateDays: stats.totalLateDays,
    lent: stats.loansLent,
    reliability,
    score: reliability * 1000 + Math.min(loans, 50),
    // Somebody who only ever lends has no borrowing record to rank on, so the browse screen
    // ranks them on how much they've lent instead of leaving every owner tied at the prior.
    lenderScore: reliability * 1000 + Math.min(loans + stats.loansLent, 50),
    label:
      loans > 0
        ? `${Math.round(reliability * 100)}% on time`
        : stats.loansLent > 0
          ? `${stats.loansLent} lent out`
          : "New neighbour",
  };
};

/** Colour band for the track-record badge. Neutral until somebody has a history. */
export const trackRecordTone = (record: TrackRecord): "neutral" | "success" | "warning" | "error" => {
  if (record.loans === 0) return "neutral";
  if (record.defaults > 0) return "error";
  if (record.reliability >= 0.8) return "success";
  if (record.reliability >= 0.5) return "warning";
  return "error";
};
