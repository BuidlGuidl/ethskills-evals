import type { BorrowRequest, Member, ToolListing } from "./types";

export type MemberReputation = Member & {
  lateRate: number;
  reliabilityScore: number;
};

export function reputationFor(member: Member): MemberReputation {
  const completed = Math.max(0, member.completedLoans);
  const late = Math.max(0, member.lateReturns);
  const lateRate = completed === 0 ? 0 : late / completed;
  const experienceBoost = Math.min(20, completed * 2);
  const reliabilityScore = Math.round(100 - lateRate * 70 + experienceBoost);

  return {
    ...member,
    lateRate,
    reliabilityScore: Math.max(0, Math.min(120, reliabilityScore))
  };
}

export function sortMembersByReliability(members: Member[]): MemberReputation[] {
  return members
    .map(reputationFor)
    .sort((a, b) => {
      if (b.reliabilityScore !== a.reliabilityScore) {
        return b.reliabilityScore - a.reliabilityScore;
      }
      if (a.lateRate !== b.lateRate) {
        return a.lateRate - b.lateRate;
      }
      return b.completedLoans - a.completedLoans;
    });
}

export function sortListingsForBrowse(listings: ToolListing[], members: Member[]): ToolListing[] {
  const scoreByAddress = new Map(
    sortMembersByReliability(members).map((member) => [member.address, member.reliabilityScore])
  );

  return [...listings].sort((a, b) => {
    const availableDelta = Number(b.available) - Number(a.available);
    if (availableDelta !== 0) return availableDelta;

    const scoreDelta = (scoreByAddress.get(b.owner) ?? 0) - (scoreByAddress.get(a.owner) ?? 0);
    if (scoreDelta !== 0) return scoreDelta;

    return a.name.localeCompare(b.name);
  });
}

export function sortRequestsForOwner(
  requests: BorrowRequest[],
  members: Member[],
  ownerListings: ToolListing[]
): BorrowRequest[] {
  const ownerToolIds = new Set(ownerListings.map((listing) => listing.id));
  const reputationByAddress = new Map(
    sortMembersByReliability(members).map((member) => [member.address, member])
  );

  return requests
    .filter((request) => ownerToolIds.has(request.toolId) && request.status === "pending")
    .sort((a, b) => {
      const aRep = reputationByAddress.get(a.borrower);
      const bRep = reputationByAddress.get(b.borrower);
      const scoreDelta = (bRep?.reliabilityScore ?? 0) - (aRep?.reliabilityScore ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      return a.dueDate.localeCompare(b.dueDate);
    });
}
