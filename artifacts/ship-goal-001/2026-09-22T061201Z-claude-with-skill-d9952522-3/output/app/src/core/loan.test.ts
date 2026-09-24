import assert from "node:assert/strict";
import {test} from "node:test";

import {
  DAY_SECONDS,
  forfeitableAt,
  formatUsdc,
  lateDaysAt,
  parseUsdc,
  relativeTime,
  settle,
} from "./loan.ts";
import {
  compareByReliability,
  emptyRecord,
  reliabilityLabel,
  reliabilityScore,
} from "./reputation.ts";

/**
 * Same numbers as `contracts/test/ToolshedEscrow.t.sol`: 120 USDC deposit, 5 USDC/day. If these
 * two ever disagree, the UI is quoting a settlement the chain will not honour.
 */
const DUE = 1_750_000_000n;
const TERMS = {deposit: 120_000_000n, dailyLateFee: 5_000_000n, dueAt: DUE};

test("returning at the deadline is on time", () => {
  const result = settle(TERMS, DUE);
  assert.equal(result.lateDays, 0n);
  assert.equal(result.ownerAmount, 0n);
  assert.equal(result.borrowerAmount, TERMS.deposit);
});

test("returning early is on time", () => {
  assert.equal(settle(TERMS, DUE - 3n * DAY_SECONDS).ownerAmount, 0n);
});

test("one second late costs a whole day", () => {
  const result = settle(TERMS, DUE + 1n);
  assert.equal(result.lateDays, 1n);
  assert.equal(result.ownerAmount, 5_000_000n);
  assert.equal(result.borrowerAmount, 115_000_000n);
});

test("late days count started days, matching test_confirmReturn_late_splitsDeposit", () => {
  const result = settle(TERMS, DUE + 3n * DAY_SECONDS + 4n * 3600n);
  assert.equal(result.lateDays, 4n);
  assert.equal(result.ownerAmount, 20_000_000n);
});

test("exactly N days late is N days, not N+1", () => {
  assert.equal(lateDaysAt(TERMS, DUE + 2n * DAY_SECONDS), 2n);
  assert.equal(lateDaysAt(TERMS, DUE + 2n * DAY_SECONDS + 1n), 3n);
});

test("owner never collects more than the deposit", () => {
  const result = settle(TERMS, DUE + 400n * DAY_SECONDS);
  assert.equal(result.ownerAmount, TERMS.deposit);
  assert.equal(result.borrowerAmount, 0n);
});

test("payouts always sum to the deposit", () => {
  for (let day = 0; day < 40; day++) {
    const result = settle(TERMS, DUE + BigInt(day) * DAY_SECONDS + 17n);
    assert.equal(result.ownerAmount + result.borrowerAmount, TERMS.deposit);
  }
});

test("forfeit unlocks where the contract says it does", () => {
  // test_claimForfeit_onlyAfterFeesCoverDeposit: 120 / 5 = 24 started days.
  assert.equal(forfeitableAt(TERMS), DUE + 23n * DAY_SECONDS + 1n);
  assert.equal(settle(TERMS, forfeitableAt(TERMS)).ownerAmount, TERMS.deposit);
  assert.ok(settle(TERMS, forfeitableAt(TERMS) - 1n).ownerAmount < TERMS.deposit);
});

test("a fee equal to the deposit forfeits after one late day", () => {
  const terms = {deposit: 50_000_000n, dailyLateFee: 50_000_000n, dueAt: DUE};
  assert.equal(forfeitableAt(terms), DUE + 1n);
});

test("USDC amounts round-trip", () => {
  assert.equal(formatUsdc(120_000_000n), "120.00");
  assert.equal(formatUsdc(12_500_000n), "12.50");
  assert.equal(formatUsdc(0n), "0.00");
  assert.equal(formatUsdc(1_234_567_000_000n), "1,234,567.00");
  assert.equal(parseUsdc("12.5"), 12_500_000n);
  assert.equal(parseUsdc("120"), 120_000_000n);
  assert.throws(() => parseUsdc("12.5.5"));
  assert.throws(() => parseUsdc("-4"));
  assert.throws(() => parseUsdc("1e6"));
});

test("relative time reads naturally in both directions", () => {
  assert.equal(relativeTime(DUE + 2n * DAY_SECONDS, DUE), "in 2 days");
  assert.equal(relativeTime(DUE - DAY_SECONDS, DUE), "1 day ago");
  assert.equal(relativeTime(DUE + 4n * 3600n, DUE), "in 4 hours");
});

// ------------------------------------------------------------------ reputation

test("a new member starts mid-pack, not at the bottom", () => {
  const fresh = reliabilityScore({loansBorrowed: 0, lateReturns: 0, forfeits: 0});
  const unreliable = reliabilityScore({loansBorrowed: 10, lateReturns: 6, forfeits: 0});
  const reliable = reliabilityScore({loansBorrowed: 10, lateReturns: 0, forfeits: 0});
  assert.ok(fresh > unreliable, "newcomer outranks a demonstrably late member");
  assert.ok(fresh < reliable, "but sits below a proven one");
});

test("a longer clean record beats a short one", () => {
  const short = reliabilityScore({loansBorrowed: 3, lateReturns: 0, forfeits: 0});
  const long = reliabilityScore({loansBorrowed: 30, lateReturns: 0, forfeits: 0});
  assert.ok(long > short);
});

test("a forfeit hurts more than a late return", () => {
  const late = reliabilityScore({loansBorrowed: 10, lateReturns: 1, forfeits: 0});
  const forfeit = reliabilityScore({loansBorrowed: 10, lateReturns: 1, forfeits: 1});
  assert.ok(forfeit < late);
});

test("score stays inside [0, 1] even when every loan went wrong", () => {
  const worst = reliabilityScore({loansBorrowed: 5, lateReturns: 5, forfeits: 5});
  assert.ok(worst >= 0 && worst <= 1, `got ${worst}`);
});

test("browse ordering puts the reliable member first", () => {
  const reliable = {...emptyRecord("0xa"), loansBorrowed: 12, lateReturns: 1};
  const flaky = {...emptyRecord("0xb"), loansBorrowed: 12, lateReturns: 7};
  const newcomer = emptyRecord("0xc");
  const sorted = [flaky, newcomer, reliable].sort(compareByReliability);
  assert.deepEqual(sorted.map((r) => r.address), ["0xa", "0xc", "0xb"]);
});

test("labels never show a bare decimal", () => {
  assert.equal(reliabilityLabel({loansBorrowed: 0, lateReturns: 0, forfeits: 0}), "New member");
  assert.equal(reliabilityLabel({loansBorrowed: 10, lateReturns: 2, forfeits: 0}), "80% on time");
});
