import type { LedgerEntry, LoanRequest, Member, RequestId, Tool } from "./types";

const dayMs = 24 * 60 * 60 * 1000;

export type Settlement = {
  lateDays: number;
  feePaidUsdc: number;
  refundUsdc: number;
};

export function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function calculateLateDays(dueAt: string, returnedAt: string): number {
  const due = new Date(dueAt).getTime();
  const returned = new Date(returnedAt).getTime();

  if (returned <= due) {
    return 0;
  }

  return Math.ceil((returned - due) / dayMs);
}

export function calculateReturnSettlement(request: LoanRequest, returnedAt: string): Settlement {
  if (!request.dueAt) {
    throw new Error("Cannot settle a loan without a due date.");
  }

  const lateDays = calculateLateDays(request.dueAt, returnedAt);
  const feePaidUsdc = Math.min(
    request.depositUsdc,
    roundUsdc(lateDays * request.lateFeeUsdcPerDay),
  );
  const refundUsdc = roundUsdc(request.depositUsdc - feePaidUsdc);

  return { lateDays, feePaidUsdc, refundUsdc };
}

export function createLoanRequest(
  id: RequestId,
  tool: Tool,
  borrower: Member,
  requestedDays: number,
  nowIso: string,
): { request: LoanRequest; ledgerEntry: LedgerEntry } {
  return {
    request: {
      id,
      toolId: tool.id,
      borrowerId: borrower.id,
      status: "requested",
      requestedDays,
      depositUsdc: tool.depositUsdc,
      lateFeeUsdcPerDay: tool.lateFeeUsdcPerDay,
      requestedAt: nowIso,
    },
    ledgerEntry: {
      id: `${id}-escrow`,
      at: nowIso,
      type: "escrow",
      requestId: id,
      fromMemberId: borrower.id,
      amountUsdc: tool.depositUsdc,
      memo: `USDC deposit escrowed for ${tool.name}.`,
    },
  };
}

export function roundUsdc(value: number): number {
  return Math.round(value * 100) / 100;
}
