import { test } from "node:test";
import assert from "node:assert/strict";
import { netPayouts, chunkBatch, encodePayout, encodePayoutPartial, decodeFailedBitmap } from "./payout-batcher.ts";

const TOKEN = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;
const A = "0x0000000000000000000000000000000000000001" as const;
const B = "0x0000000000000000000000000000000000000002" as const;

test("netPayouts merges same token+recipient and keeps order", () => {
  const merged = netPayouts([
    { id: "1", token: TOKEN, recipient: A, amount: 100n, queuedAt: 1 },
    { id: "2", token: TOKEN, recipient: B, amount: 200n, queuedAt: 2 },
    { id: "3", token: TOKEN, recipient: A, amount: 300n, queuedAt: 3 },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].recipient, A);
  assert.equal(merged[0].amount, 400n);
  assert.equal(merged[1].recipient, B);
  assert.equal(merged[1].amount, 200n);
});

test("netPayouts keeps different tokens separate", () => {
  const OTHER = "0x000000000000000000000000000000000000dead" as const;
  const merged = netPayouts([
    { id: "1", token: TOKEN, recipient: A, amount: 100n, queuedAt: 1 },
    { id: "2", token: OTHER, recipient: A, amount: 100n, queuedAt: 2 },
  ]);
  assert.equal(merged.length, 2);
});

test("chunkBatch respects max items", () => {
  const payouts = Array.from({ length: 501 }, (_, i) => ({
    id: String(i),
    token: TOKEN,
    recipient: A,
    amount: 1n,
    queuedAt: 0,
  }));
  const chunks = chunkBatch(payouts, 250);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 250);
  assert.equal(chunks[2].length, 1);
});

test("encodePayout matches cast reference encoding", () => {
  const expected =
    "0xe04eef4e000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000001e8480";
  assert.equal(encodePayout(TOKEN, [A, B], [1000000n, 2000000n]), expected);
});

test("encodePayoutPartial matches cast reference encoding", () => {
  const expected =
    "0x08005a24000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000f4240";
  assert.equal(encodePayoutPartial(TOKEN, [A], [1000000n]), expected);
});

test("decodeFailedBitmap reads failure bits", () => {
  const result = ("0x" +
    "0000000000000000000000000000000000000000000000000000000000000020" +
    "0000000000000000000000000000000000000000000000000000000000000001" +
    "0000000000000000000000000000000000000000000000000000000000000010") as `0x${string}`;
  const failed = decodeFailedBitmap(result);
  assert.equal(failed.length, 256);
  assert.equal(failed[4], true);
  assert.equal(failed[0], false);
  assert.equal(failed[255], false);
});
