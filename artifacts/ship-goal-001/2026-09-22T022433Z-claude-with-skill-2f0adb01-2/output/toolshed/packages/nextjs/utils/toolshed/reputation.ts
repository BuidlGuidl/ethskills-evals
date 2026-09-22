import { EMPTY_RECORD, type Record } from "./types";

/**
 * Track record -> a 0-100 reliability score used to order the browse screen and the queue of
 * incoming requests an owner sees.
 *
 * The raw on-time rate is unusable on its own: someone with one perfect loan would outrank a
 * neighbor with forty loans and one late return, and a brand-new member would sit at either 0% or
 * 100% depending on which way you round. So the rate is smoothed toward a neutral prior — every
 * member is treated as if they already had PRIOR_WEIGHT loans at PRIOR_RATE. New members land near
 * the middle of the list and move up or down as real loans accumulate.
 *
 * A default (the tool never came back, and the whole deposit was forfeited) counts as
 * DEFAULT_PENALTY late returns, because it is a categorically worse event than a late return.
 *
 * This is deliberately offchain: it is a display ordering, not a rule about anyone's money, and the
 * association can retune it without touching a deployed contract. The inputs — `loansBorrowed`,
 * `lateReturns`, `defaults` — are all onchain and auditable by any member.
 */
export const PRIOR_WEIGHT = 3;
export const PRIOR_RATE = 0.8;
export const DEFAULT_PENALTY = 3;

export const reliabilityScore = (record: Record = EMPTY_RECORD) => {
  const loans = record.loansBorrowed;
  const bad = record.lateReturns + record.defaults * (DEFAULT_PENALTY - 1);
  const good = Math.max(0, loans - bad);
  const smoothed = (good + PRIOR_WEIGHT * PRIOR_RATE) / (loans + PRIOR_WEIGHT);
  return Math.round(Math.max(0, Math.min(1, smoothed)) * 100);
};

export type ReliabilityTier = "new" | "lender" | "trusted" | "solid" | "shaky";

/**
 * Only borrowing can go wrong, so the score is a borrower's score. But someone who has lent their
 * ladder out six times and never borrowed anything is not a stranger, and calling them "new" on the
 * browse screen would bury exactly the people this shed runs on — they get their own tier.
 */
export const reliabilityTier = (record: Record = EMPTY_RECORD): ReliabilityTier => {
  if (record.loansBorrowed === 0) return record.loansLent > 0 ? "lender" : "new";
  const score = reliabilityScore(record);
  if (score >= 85) return "trusted";
  if (score >= 65) return "solid";
  return "shaky";
};

export const TIER_LABEL: { [key in ReliabilityTier]: string } = {
  new: "New neighbor",
  lender: "Lends out",
  trusted: "Reliable",
  solid: "Mostly on time",
  shaky: "Often late",
};

/** DaisyUI badge modifiers, so the tiers read the same way everywhere. */
export const TIER_BADGE: { [key in ReliabilityTier]: string } = {
  new: "badge-ghost",
  lender: "badge-accent",
  trusted: "badge-success",
  solid: "badge-info",
  shaky: "badge-warning",
};

export const onTimeCount = (record: Record = EMPTY_RECORD) =>
  Math.max(0, record.loansBorrowed - record.lateReturns - record.defaults);

/**
 * Orders members (and, on the browse screen, the tools they own) so the people with the better
 * track record come first. Ties break toward the neighbor who has actually done the most loans.
 */
export const compareByReliability = (a: Record = EMPTY_RECORD, b: Record = EMPTY_RECORD) => {
  const diff = reliabilityScore(b) - reliabilityScore(a);
  if (diff !== 0) return diff;
  const activity = b.loansBorrowed + b.loansLent - (a.loansBorrowed + a.loansLent);
  if (activity !== 0) return activity;
  return a.defaults - b.defaults;
};
