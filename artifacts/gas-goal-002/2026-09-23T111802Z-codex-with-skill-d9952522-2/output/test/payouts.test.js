import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePayouts, chunkByToken } from "../src/payouts.js";

const TOKEN_A = "0x1111111111111111111111111111111111111111";
const TOKEN_B = "0x2222222222222222222222222222222222222222";
const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

test("aggregates payouts by token and recipient and drops zero amounts", () => {
  const result = aggregatePayouts([
    { token: TOKEN_A, recipient: ALICE, amount: "10", reference: "payout-1" },
    { token: TOKEN_A, recipient: ALICE, amount: "15", reference: "payout-2" },
    { token: TOKEN_A, recipient: BOB, amount: "0", reference: "noop" },
    { token: TOKEN_B, recipient: ALICE, amount: "7" },
  ]);

  assert.equal(result.stats.inputCount, 4);
  assert.equal(result.stats.zeroAmountCount, 1);
  assert.equal(result.stats.outputCount, 2);
  assert.equal(result.stats.eliminatedCount, 1);
  assert.deepEqual(
    result.payouts.map((payout) => payout.amount),
    [25n, 7n],
  );
  assert.deepEqual(result.payouts[0].references, ["payout-1", "payout-2"]);
});

test("chunks aggregated payouts by token without mixing assets", () => {
  const aggregated = aggregatePayouts([
    { token: TOKEN_A, recipient: ALICE, amount: "10" },
    { token: TOKEN_A, recipient: BOB, amount: "15" },
    { token: TOKEN_B, recipient: ALICE, amount: "7" },
  ]);

  const chunks = chunkByToken(aggregated.payouts, 1);
  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks.map((chunk) => chunk.token), [TOKEN_A, TOKEN_A, TOKEN_B]);
  assert.deepEqual(chunks.map((chunk) => chunk.recipients.length), [1, 1, 1]);
});
