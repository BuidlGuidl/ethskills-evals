import { describe, expect, it } from "vitest";
import { calculateLateDays, calculateReturnSettlement } from "./lending";
import type { LoanRequest } from "./types";

const request: LoanRequest = {
  id: "r-test",
  toolId: "t-test",
  borrowerId: "m-test",
  status: "active",
  requestedDays: 3,
  depositUsdc: 50,
  lateFeeUsdcPerDay: 8,
  requestedAt: "2026-09-01T12:00:00.000Z",
  approvedAt: "2026-09-01T12:00:00.000Z",
  dueAt: "2026-09-04T12:00:00.000Z",
};

describe("lending settlement", () => {
  it("does not charge when a tool comes back on time", () => {
    expect(calculateReturnSettlement(request, "2026-09-04T12:00:00.000Z")).toEqual({
      lateDays: 0,
      feePaidUsdc: 0,
      refundUsdc: 50,
    });
  });

  it("rounds partial overdue days up to protect owners", () => {
    expect(calculateLateDays("2026-09-04T12:00:00.000Z", "2026-09-04T13:00:00.000Z")).toBe(1);
  });

  it("caps late fees at the deposited amount", () => {
    expect(calculateReturnSettlement(request, "2026-09-14T12:00:00.000Z")).toEqual({
      lateDays: 10,
      feePaidUsdc: 50,
      refundUsdc: 0,
    });
  });
});
