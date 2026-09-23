import test from "node:test";
import assert from "node:assert/strict";
import { createBatcher, planTopUps } from "../src/batcher.mjs";

const TOKEN = "0x833589fCE7ebf8E197d5f76c16a30B249F8eD0d9";

function makeItem(recipient, amount, token = TOKEN, source) {
  return { token, recipient, amount, source };
}

test("nets duplicate recipients within a flush window", () => {
  const b = createBatcher({ policy: { maxItems: 10, maxAgeMs: 60_000 } });
  b.add(makeItem("0x1111111111111111111111111111111111111111", 100n));
  b.add(makeItem("0x1111111111111111111111111111111111111111", 50n));
  b.add(makeItem("0x2222222222222222222222222222222222222222", 7n));
  assert.equal(b.size(), 2);
  const flushed = b.drain();
  assert.equal(flushed.length, 2);
  const one = flushed.find((x) => x.recipient === "0x1111111111111111111111111111111111111111");
  assert.equal(one.amount, 150n);
});

test("keeps different tokens separate", () => {
  const b = createBatcher();
  b.add(makeItem("0x1111111111111111111111111111111111111111", 1n, "0x" + "aa".repeat(20)));
  b.add(makeItem("0x1111111111111111111111111111111111111111", 2n, "0x" + "bb".repeat(20)));
  assert.equal(b.size(), 2);
});

test("case-insensitive netting", () => {
  const b = createBatcher();
  b.add(makeItem("0xABCDEF0000000000000000000000000000000001", 1n));
  b.add(makeItem("0xabcdef0000000000000000000000000000000001", 2n));
  assert.equal(b.size(), 1);
  assert.equal(b.drain()[0].amount, 3n);
});

test("flushes when max items reached", () => {
  const b = createBatcher({ policy: { maxItems: 3, maxAgeMs: 60_000 } });
  let t = 1000;
  const now = () => t;
  const b2 = createBatcher({ policy: { maxItems: 3, maxAgeMs: 60_000 }, now });
  b2.add(makeItem("0x1111111111111111111111111111111111111111", 1n));
  b2.add(makeItem("0x2222222222222222222222222222222222222222", 1n));
  assert.equal(b2.shouldFlush(), false);
  b2.add(makeItem("0x3333333333333333333333333333333333333333", 1n));
  assert.equal(b2.shouldFlush(), true);
  assert.equal(b2.drain().length, 3);
  assert.equal(b2.shouldFlush(), false);
  assert.equal(b2.size(), 0);
});

test("flushes when oldest item exceeds max age", () => {
  let t = 1000;
  const now = () => t;
  const b = createBatcher({ policy: { maxItems: 100, maxAgeMs: 60_000 }, now });
  b.add(makeItem("0x1111111111111111111111111111111111111111", 1n));
  t = 1000 + 59_999;
  assert.equal(b.shouldFlush(), false);
  t = 1000 + 60_000;
  assert.equal(b.shouldFlush(), true);
});

test("age resets after drain", () => {
  let t = 1000;
  const b = createBatcher({ policy: { maxItems: 100, maxAgeMs: 60_000 }, now: () => t });
  b.add(makeItem("0x1111111111111111111111111111111111111111", 1n));
  t += 60_000;
  b.drain();
  t += 60_000;
  assert.equal(b.shouldFlush(), false);
});

test("rejects bad items", () => {
  const b = createBatcher();
  assert.throws(() => b.add({ token: TOKEN, recipient: "0x1" }));
  assert.throws(() => b.add({ token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: 0n }));
  assert.throws(() => b.add({ token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: -5n }));
});

test("tracks netted payment count", () => {
  const b = createBatcher();
  b.add(makeItem("0x1111111111111111111111111111111111111111", 1n));
  b.add(makeItem("0x1111111111111111111111111111111111111111", 1n));
  b.add(makeItem("0x2222222222222222222222222222222222222222", 1n));
  assert.equal(b.nettedFrom(), 0);
  b.drain();
  assert.equal(b.nettedFrom(), 2);
});

test("planTopUps computes top-up with safety multiple", () => {
  const batches = [
    { token: TOKEN, total: "1000" },
    { token: TOKEN, total: "500" },
    { token: "0x" + "aa".repeat(20), total: "9000" },
  ];
  assert.equal(planTopUps(batches, TOKEN, 0n, 2), 3000n);
  assert.equal(planTopUps(batches, TOKEN, 1500n, 2), 1500n);
  assert.equal(planTopUps(batches, TOKEN, 3000n, 2), 0n);
});
