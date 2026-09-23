import test from "node:test";
import assert from "node:assert/strict";
import { PayoutQueue, defaultQueueOptions } from "./batch-queue.ts";

const TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const TOKEN_B = "0x4200000000000000000000000000000000000006";

function payout(recipient: string, amount: bigint, token = TOKEN) {
  return { token, recipient, amount, ref: `ref-${recipient}` };
}

test("groups by token and nets duplicates when enabled", () => {
  const q = new PayoutQueue({ ...defaultQueueOptions(), netDuplicates: true, maxEntries: 100, maxWaitMs: 1000 });
  q.add(payout("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", 5n), 0);
  q.add(payout("0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045", 7n), 0);
  q.add(payout("0x1234567890123456789012345678901234567890", 3n), 0);
  q.add(payout("0x1234567890123456789012345678901234567890", 3n, TOKEN_B), 0);

  const batches = q.due(5000);
  assert.equal(batches.length, 2);
  const main = batches.find((b) => b.token === TOKEN.toLowerCase())!;
  assert.equal(main.recipients.length, 2);
  const vitalik = main.recipients.findIndex((r) => r.toLowerCase().startsWith("0xd8da"));
  assert.equal(main.amounts[vitalik], 12n);
  const weth = batches.find((b) => b.token === TOKEN_B)!;
  assert.equal(weth.amounts[0], 3n);
});

test("keeps duplicate recipients separate when netting disabled", () => {
  const q = new PayoutQueue({ maxEntries: 100, maxWaitMs: 1000, netDuplicates: false });
  q.add(payout("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", 5n), 0);
  q.add(payout("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", 7n), 0);
  const batches = q.due(5000);
  assert.equal(batches[0].recipients.length, 2);
  assert.deepEqual(batches[0].amounts, [5n, 7n]);
});

test("nothing due before max wait unless full", () => {
  const q = new PayoutQueue({ maxEntries: 100, maxWaitMs: 30_000 });
  q.add(payout("0x1", 1n), 0);
  assert.equal(q.due(10_000).length, 0);
  assert.equal(q.due(31_000).length, 1);
});

test("full queue flushes immediately in bounded chunks", () => {
  const q = new PayoutQueue({ maxEntries: 10, maxWaitMs: 60_000 });
  for (let i = 0; i < 25; i++) {
    q.add(payout(`0x${(0x1000 + i).toString(16).padStart(40, "0")}`, 1n), 0);
  }
  const batches = q.due(1_000);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].recipients.length, 10);
  assert.equal(q.pendingCount(), 15);
});

test("rejects invalid input", () => {
  const q = new PayoutQueue();
  assert.throws(() => q.add(payout("0x1", 0n)));
  assert.throws(() => new PayoutQueue({ maxEntries: 1 }));
});
