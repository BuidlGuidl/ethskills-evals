import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreFor } from "../reputation";
import { projectLateFee } from "../loans";
import { formatUsdc, parseUsdc } from "../chain";

/**
 * Covers the offchain logic that is not already covered by the Solidity
 * tests: the ranking formula, and the late-fee preview that must agree with
 * `Toolshed._lateFeeAt` or the UI will quote a number the chain then refuses.
 *
 *   npm test
 */

const DAY = 86_400;
const base = { deposit: "60000000", dailyLateFee: "2000000", assertedAt: null };

test("late-fee preview: nothing owed before the due date", () => {
  const due = 1_000_000;
  assert.deepEqual(projectLateFee({ ...base, dueAt: due }, due - 1), { fee: 0n, daysLate: 0 });
  assert.deepEqual(projectLateFee({ ...base, dueAt: due }, due), { fee: 0n, daysLate: 0 });
});

test("late-fee preview: a started day is a whole day, matching the contract", () => {
  const due = 1_000_000;
  assert.deepEqual(projectLateFee({ ...base, dueAt: due }, due + 1), { fee: 2_000_000n, daysLate: 1 });
  assert.deepEqual(projectLateFee({ ...base, dueAt: due }, due + DAY), { fee: 2_000_000n, daysLate: 1 });
  assert.deepEqual(projectLateFee({ ...base, dueAt: due }, due + DAY + 1), { fee: 4_000_000n, daysLate: 2 });
});

test("late-fee preview: capped at the deposit", () => {
  const due = 1_000_000;
  const { fee } = projectLateFee({ ...base, dueAt: due }, due + 400 * DAY);
  assert.equal(fee, 60_000_000n);
});

test("late-fee preview: freezes at the borrower's return assertion", () => {
  const due = 1_000_000;
  const asserted = due + DAY; // one day late when they said they returned it
  const { fee, daysLate } = projectLateFee({ ...base, dueAt: due, assertedAt: asserted }, due + 50 * DAY);
  assert.equal(daysLate, 1);
  assert.equal(fee, 2_000_000n);
});

test("ranking: a long clean history beats a single clean loan", () => {
  const veteran = scoreFor({ loansBorrowed: 20, lateReturns: 0, unreturned: 0, loansLent: 0 });
  const newcomer = scoreFor({ loansBorrowed: 1, lateReturns: 0, unreturned: 0, loansLent: 0 });
  assert.ok(veteran > newcomer, `${veteran} should beat ${newcomer}`);
});

test("ranking: one late return out of many beats a thin perfect record", () => {
  const veteran = scoreFor({ loansBorrowed: 40, lateReturns: 1, unreturned: 0, loansLent: 0 });
  const newcomer = scoreFor({ loansBorrowed: 1, lateReturns: 0, unreturned: 0, loansLent: 0 });
  assert.ok(veteran > newcomer, `${veteran} should beat ${newcomer}`);
});

test("ranking: chronic lateness sinks below a new neighbor", () => {
  const chronic = scoreFor({ loansBorrowed: 10, lateReturns: 8, unreturned: 0, loansLent: 0 });
  const unknown = scoreFor({ loansBorrowed: 0, lateReturns: 0, unreturned: 0, loansLent: 0 });
  assert.ok(chronic < 0.3);
  assert.equal(unknown, 0);
});

test("ranking: losing a tool outweighs lending a lot", () => {
  const loser = scoreFor({ loansBorrowed: 10, lateReturns: 0, unreturned: 1, loansLent: 10 });
  const clean = scoreFor({ loansBorrowed: 10, lateReturns: 0, unreturned: 0, loansLent: 0 });
  assert.ok(loser < clean);
});

test("ranking: score always lands in [0, 1]", () => {
  for (const s of [
    scoreFor({ loansBorrowed: 0, lateReturns: 0, unreturned: 5, loansLent: 0 }),
    scoreFor({ loansBorrowed: 100, lateReturns: 0, unreturned: 0, loansLent: 100 }),
    scoreFor({ loansBorrowed: 3, lateReturns: 3, unreturned: 3, loansLent: 0 }),
  ]) {
    assert.ok(s >= 0 && s <= 1, `out of range: ${s}`);
  }
});

test("usdc amounts round-trip exactly", () => {
  assert.equal(parseUsdc("40"), 40_000_000n);
  assert.equal(parseUsdc("40.5"), 40_500_000n);
  assert.equal(parseUsdc("0.000001"), 1n);
  assert.equal(formatUsdc(40_500_000n), "40.50");
  assert.equal(formatUsdc("1234567"), "1.23");
  assert.throws(() => parseUsdc("40.1234567"));
  assert.throws(() => parseUsdc("-5"));
});
