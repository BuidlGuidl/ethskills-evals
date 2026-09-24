import { describe, expect, it } from "vitest";
import { sortListingsForBrowse, sortMembersByReliability, sortRequestsForOwner } from "./reputation";
import type { BorrowRequest, Member, ToolListing } from "./types";

const members: Member[] = [
  {
    address: "0x0000000000000000000000000000000000000001",
    displayName: "Reliable",
    joinedAt: "2025-01-01",
    completedLoans: 12,
    lateReturns: 0
  },
  {
    address: "0x0000000000000000000000000000000000000002",
    displayName: "Often late",
    joinedAt: "2025-01-01",
    completedLoans: 12,
    lateReturns: 5
  }
];

const listing = (id: string, owner: Member, available = true): ToolListing => ({
  id,
  owner: owner.address,
  name: id,
  category: "Garden",
  condition: "good",
  conditionNotes: "Ready",
  photoUrl: "",
  depositUsdc: 20,
  dailyLateFeeUsdc: 5,
  available,
  listingHash: "0x1234000000000000000000000000000000000000000000000000000000000000"
});

describe("reputation sorting", () => {
  it("ranks reliable members ahead of members with more late returns", () => {
    expect(sortMembersByReliability(members)[0].displayName).toBe("Reliable");
  });

  it("sorts browse results by availability and owner reliability", () => {
    const sorted = sortListingsForBrowse(
      [listing("late-owner-tool", members[1]), listing("reliable-owner-tool", members[0])],
      members
    );

    expect(sorted.map((item) => item.id)).toEqual(["reliable-owner-tool", "late-owner-tool"]);
  });

  it("sorts an owner's pending request queue by borrower reliability", () => {
    const requests: BorrowRequest[] = [
      {
        id: "request-late",
        toolId: "shared-drill",
        borrower: members[1].address,
        startDate: "2026-01-01",
        dueDate: "2026-01-03",
        status: "pending"
      },
      {
        id: "request-reliable",
        toolId: "shared-drill",
        borrower: members[0].address,
        startDate: "2026-01-01",
        dueDate: "2026-01-03",
        status: "pending"
      }
    ];

    const sorted = sortRequestsForOwner(requests, members, [listing("shared-drill", members[0])]);
    expect(sorted.map((request) => request.id)).toEqual(["request-reliable", "request-late"]);
  });
});
