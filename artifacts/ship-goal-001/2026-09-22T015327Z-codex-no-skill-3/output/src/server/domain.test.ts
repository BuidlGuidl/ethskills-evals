import assert from "node:assert/strict";
import test from "node:test";
import { parseUsdc } from "../shared/money.js";
import { approveLoan, calculateLateDays, requestLoan, returnLoan } from "./domain.js";
import { createSeedDatabase } from "./seed.js";

test("calculateLateDays charges full daily increments after due date", () => {
  assert.equal(calculateLateDays("2026-09-20", new Date("2026-09-20T23:59:59.000Z")), 0);
  assert.equal(calculateLateDays("2026-09-20", new Date("2026-09-21T00:00:00.000Z")), 1);
  assert.equal(calculateLateDays("2026-09-20", new Date("2026-09-22T00:00:00.000Z")), 2);
});

test("requestLoan escrows the borrower's USDC deposit", () => {
  const database = createSeedDatabase();
  const wallet = database.wallets.find((candidate) => candidate.memberId === "m-devon");
  assert.ok(wallet);

  const beforeAvailable = wallet.availableMicroUsdc;
  const loan = requestLoan(database, {
    toolId: "t-ladder",
    borrowerId: "m-devon",
    startDate: "2026-09-28",
    dueDate: "2026-09-30"
  });

  assert.equal(loan.status, "requested");
  assert.equal(wallet.availableMicroUsdc, beforeAvailable - parseUsdc("50"));
  assert.equal(wallet.escrowedMicroUsdc, parseUsdc("50"));
});

test("returnLoan pays late fees to owner and refunds the remainder", () => {
  const database = createSeedDatabase();
  const requested = requestLoan(database, {
    toolId: "t-pressure-washer",
    borrowerId: "m-devon",
    startDate: "2026-09-21",
    dueDate: "2026-09-21"
  });
  const active = approveLoan(database, requested.id, { ownerId: "m-ana" });
  assert.equal(active.status, "active");

  const borrowerWallet = database.wallets.find((candidate) => candidate.memberId === "m-devon");
  const ownerWallet = database.wallets.find((candidate) => candidate.memberId === "m-ana");
  assert.ok(borrowerWallet);
  assert.ok(ownerWallet);
  const ownerBefore = ownerWallet.availableMicroUsdc;

  const returned = returnLoan(database, requested.id, {
    returnedAt: "2026-09-23T12:00:00.000Z"
  });

  assert.equal(returned.status, "returned");
  assert.equal(returned.lateDays, 2);
  assert.equal(returned.lateFeeChargedMicroUsdc, parseUsdc("12"));
  assert.equal(ownerWallet.availableMicroUsdc, ownerBefore + parseUsdc("12"));
  assert.equal(borrowerWallet.escrowedMicroUsdc, 0);
});
