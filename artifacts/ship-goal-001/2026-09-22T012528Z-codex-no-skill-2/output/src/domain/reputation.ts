import type { Member, MemberStats } from "./types";

export function onTimeRate(stats: MemberStats): number {
  if (stats.completedLoans === 0) {
    return 1;
  }

  return Math.max(0, (stats.completedLoans - stats.lateReturns) / stats.completedLoans);
}

export function reputationScore(stats: MemberStats): number {
  const historyBonus = Math.min(stats.completedLoans, 20) * 3;
  const reliability = onTimeRate(stats) * 70;
  const latePenalty = stats.lateReturns * 8 + stats.totalLateDays * 2;
  const depositPenalty = Math.floor(stats.depositsForfeitedUsdc / 10);

  return Math.max(0, Math.round(reliability + historyBonus - latePenalty - depositPenalty));
}

export function reputationLabel(stats: MemberStats): string {
  const score = reputationScore(stats);

  if (score >= 90) return "Priority";
  if (score >= 70) return "Reliable";
  if (score >= 45) return "Building";
  return "Risky";
}

export function compareBorrowersByReputation(a: Member, b: Member): number {
  const scoreDelta = reputationScore(b.stats) - reputationScore(a.stats);

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return b.stats.completedLoans - a.stats.completedLoans;
}
