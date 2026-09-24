import test from "node:test";
import assert from "node:assert/strict";
import { packEntry, BatchingSender } from "../src/sender.mjs";

test("packEntry round-trips address and amount", () => {
  const to = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const packed = packEntry(to, 1_000_000n);
  assert.equal("0x" + (packed >> 96n).toString(16).padStart(40, "0"), to.toLowerCase());
  assert.equal(packed & ((1n << 96n) - 1n), 1_000_000n);
});

test("packEntry refuses amounts that would silently truncate", () => {
  assert.throws(() => packEntry("0x" + "11".repeat(20), 1n << 96n), RangeError);
  assert.throws(() => packEntry("0x" + "11".repeat(20), -1n), RangeError);
});

/// A full batch must go out immediately rather than waiting for the timer.
test("a full batch flushes without waiting for maxWaitMs", async () => {
  const sent = [];
  const s = harness(sent, { batchSize: 3, maxWaitMs: 3_600_000 });
  const ps = [1, 2, 3].map((i) => s.enqueue(addr(i), 10n));
  await Promise.all(ps);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].count, 3);
});

test("a partial batch flushes after maxWaitMs", async () => {
  const sent = [];
  const s = harness(sent, { batchSize: 100, maxWaitMs: 20 });
  await s.enqueue(addr(1), 10n);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].count, 1);
});

test("leftovers beyond one batch are flushed too, not dropped", async () => {
  const sent = [];
  const s = harness(sent, { batchSize: 2, maxWaitMs: 20 });
  const ps = [1, 2, 3, 4, 5].map((i) => s.enqueue(addr(i), 10n));
  await Promise.all(ps);
  assert.deepEqual(sent.map((b) => b.count), [2, 2, 1]);
});

test("a failing send rejects every caller in the batch", async () => {
  const s = harness([], { batchSize: 2, maxWaitMs: 20, fail: true });
  await assert.rejects(Promise.all([s.enqueue(addr(1), 10n), s.enqueue(addr(2), 10n)]), /reverted/);
});

test("a base fee above the circuit breaker stops the send", async () => {
  const s = harness([], { batchSize: 1, maxWaitMs: 20, baseFee: 5_000_000_000n });
  await assert.rejects(s.enqueue(addr(1), 10n), /circuit breaker/);
});

const addr = (i) => "0x" + i.toString(16).padStart(40, "0");

function harness(sent, { batchSize, maxWaitMs, fail = false, baseFee = 5_000_000n }) {
  return new BatchingSender({
    token: addr(9),
    batchTransfer: addr(8),
    batchSize,
    maxWaitMs,
    wallet: {
      account: { address: addr(7) },
      async sendTransaction({ data }) {
        if (fail) throw new Error("execution reverted");
        // 4-byte selector + token word + array offset + array length, then one word per entry
        const bytes = (data.length - 2) / 2;
        sent.push({ count: (bytes - 4 - 96) / 32, data });
        return "0x" + "ab".repeat(32);
      },
    },
    publicClient: {
      async getBlock() { return { baseFeePerGas: baseFee }; },
      async getTransactionCount() { return 1; },
      async waitForTransactionReceipt({ hash }) { return { transactionHash: hash, gasUsed: 1n }; },
    },
  });
}
