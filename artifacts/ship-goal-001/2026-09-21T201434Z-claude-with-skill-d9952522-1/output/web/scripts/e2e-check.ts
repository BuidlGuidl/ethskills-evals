/**
 * The offchain half of scripts/e2e-local.sh: run the indexer until it catches
 * up, then assert the derived track record matches the loan that just settled
 * onchain.
 *
 * This is the check that proves the two halves of Toolshed agree — a contract
 * that settles correctly is not much use if the browse screen ranks on
 * something else.
 */
import assert from "node:assert/strict";
import { indexOnce } from "../src/indexer/run";
import { getLoan } from "../src/core/loans";
import { trackRecordFor } from "../src/core/reputation";

const BORROWER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const OWNER = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

async function main() {
  // Drain the log backlog.
  for (let i = 0; i < 50; i++) {
    const { logs, from, to } = await indexOnce();
    if (logs === 0 && from > to) break;
  }

  const loan = getLoan(1);
  assert.ok(loan, "loan 1 should have been indexed");
  assert.equal(loan.status, "settled", "loan should be settled");
  assert.equal(loan.daysLate, 2, "should be recorded as 2 days late");
  assert.equal(loan.lateFeePaid, "4000000", "$4 late fee");
  assert.equal(loan.refund, "56000000", "$56 refunded");
  assert.equal(loan.unreturned, false);
  console.log("     loan      settled, 2 days late, $4 fee, $56 refunded  ✓");

  const borrower = trackRecordFor(BORROWER);
  assert.equal(borrower.loansBorrowed, 1);
  assert.equal(borrower.lateReturns, 1);
  assert.equal(borrower.onTimeRate, 0);
  console.log(`     borrower  1 loan, 1 late, score ${borrower.score.toFixed(3)}  ✓`);

  const owner = trackRecordFor(OWNER);
  assert.equal(owner.loansLent, 1);
  console.log(`     owner     lent 1, score ${owner.score.toFixed(3)}  ✓`);

  // The whole point of the ranking: a member who returns things late must not
  // outrank one with a clean record.
  assert.ok(
    borrower.score < trackRecordFor(OWNER).score || borrower.score < 0.2,
    "a late borrower should not rank highly",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
