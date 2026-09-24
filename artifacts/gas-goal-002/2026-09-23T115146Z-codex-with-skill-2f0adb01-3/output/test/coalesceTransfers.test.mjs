import test from "node:test";
import assert from "node:assert/strict";
import { coalesceTransfers } from "../src/coalesceTransfers.mjs";

const token = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const alice = "0x1111111111111111111111111111111111111111";
const bob = "0x2222222222222222222222222222222222222222";

test("coalesceTransfers sums same chain token recipient transfers", () => {
  const result = coalesceTransfers([
    { id: "p1", chainId: 8453, token, recipient: alice, amount: "10" },
    { id: "p2", chainId: 8453, token, recipient: alice, amount: "32" },
    { id: "p3", chainId: 8453, token, recipient: bob, amount: "7" },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].amount, "42");
  assert.deepEqual(result[0].sourceTransferIds, ["p1", "p2"]);
});

test("coalesceTransfers respects canCoalesce false", () => {
  const result = coalesceTransfers([
    { id: "p1", token, recipient: alice, amount: "10", canCoalesce: false },
    { id: "p2", token, recipient: alice, amount: "32" },
  ]);

  assert.equal(result.length, 2);
});

test("coalesceTransfers rejects invalid addresses", () => {
  assert.throws(() => coalesceTransfers([{ token: "bad", recipient: alice, amount: "1" }]), /token/);
});
