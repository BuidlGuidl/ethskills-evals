import { describe, expect, it } from "vitest";
import { compareBorrowersByReputation, onTimeRate, reputationScore } from "./reputation";
import type { Member } from "./types";

const reliable: Member = {
  id: "m-good",
  name: "Good Neighbor",
  neighborhood: "North",
  wallet: "0xgood",
  stats: {
    completedLoans: 12,
    lateReturns: 0,
    totalLateDays: 0,
    depositsForfeitedUsdc: 0,
  },
};

const spotty: Member = {
  id: "m-spotty",
  name: "Spotty Neighbor",
  neighborhood: "South",
  wallet: "0xspotty",
  stats: {
    completedLoans: 12,
    lateReturns: 4,
    totalLateDays: 9,
    depositsForfeitedUsdc: 24,
  },
};

describe("borrower reputation", () => {
  it("treats new borrowers as on time until they build history", () => {
    expect(
      onTimeRate({
        completedLoans: 0,
        lateReturns: 0,
        totalLateDays: 0,
        depositsForfeitedUsdc: 0,
      }),
    ).toBe(1);
  });

  it("penalizes late returns and forfeited deposits", () => {
    expect(reputationScore(reliable.stats)).toBeGreaterThan(reputationScore(spotty.stats));
  });

  it("sorts stronger borrowers first", () => {
    expect([spotty, reliable].sort(compareBorrowersByReputation)[0]).toBe(reliable);
  });
});
