// A member's track record, and the single number the browse and request
// screens sort by.
//
// Two problems with sorting on a raw on-time percentage:
//   - a member with one on-time loan would outrank a member with forty loans
//     and one late return, which is backwards;
//   - a brand new member has no percentage at all, and 300 members means
//     there are always new ones.
//
// So the rate is smoothed toward a neutral prior: we pretend every member
// starts with PRIOR_LOANS loans at PRIOR_ON_TIME_RATE. New members land in the
// middle of the pack and move from there, and a long clean history is worth
// more than a short one. The volume term is deliberately weak (log-scaled, and
// only a few points) -- it breaks ties between equally reliable members
// without letting a busy-but-late member outrank a careful one.

export const PRIOR_LOANS = 3;
export const PRIOR_ON_TIME_RATE = 0.9;
const VOLUME_WEIGHT = 4;

/**
 * @param {{completedLoans:number, lateLoans:number, lateDays:number}} record
 * @returns {{score:number, onTimeRate:number|null, smoothedRate:number, isNew:boolean}}
 */
export function reliability(record) {
  const completed = Math.max(0, record.completedLoans ?? 0);
  const late = Math.min(completed, Math.max(0, record.lateLoans ?? 0));
  const onTime = completed - late;

  const smoothedRate =
    (onTime + PRIOR_LOANS * PRIOR_ON_TIME_RATE) / (completed + PRIOR_LOANS);

  // Chronic lateness is worse than one bad return: a member whose late loans
  // average many days late gives back a little more of the smoothed rate.
  const daysPerLate = late > 0 ? (record.lateDays ?? 0) / late : 0;
  const severity = Math.min(0.1, (daysPerLate / 30) * (late / (completed + PRIOR_LOANS)));

  const volume = VOLUME_WEIGHT * Math.log10(1 + completed);
  const score = Math.max(0, (smoothedRate - severity) * 100 + volume);

  return {
    score: Math.round(score * 100) / 100,
    onTimeRate: completed > 0 ? onTime / completed : null,
    smoothedRate,
    isNew: completed === 0,
  };
}

/** Short phrase for the UI, e.g. "12 loans, 1 late". */
export function summarize(record) {
  const completed = record.completedLoans ?? 0;
  if (completed === 0) return 'New member';
  const late = record.lateLoans ?? 0;
  const loans = `${completed} loan${completed === 1 ? '' : 's'}`;
  return late === 0 ? `${loans}, all on time` : `${loans}, ${late} late`;
}
