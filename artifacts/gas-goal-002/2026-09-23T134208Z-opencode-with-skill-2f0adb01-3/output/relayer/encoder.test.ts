import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeBatchTransfer,
  encodeWithdraw,
  parseTransferFailedLog,
  parseBatchExecutedLog,
} from "./encoder.ts";

const REFERENCE =
  "0x1239ec8c000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000001234567890123456789012345678901234567890000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000001e8480" as const;

test("encodeBatchTransfer matches cast calldata reference", () => {
  const encoded = encodeBatchTransfer(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "0x1234567890123456789012345678901234567890"],
    [1_000_000n, 2_000_000n],
  );
  assert.equal(encoded, REFERENCE);
});

test("encodeWithdraw builds packed args", () => {
  const encoded = encodeWithdraw(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x1234567890123456789012345678901234567890",
    1n,
  );
  assert.equal(encoded.slice(0, 10), "0xd9caed12");
  assert.equal(encoded.length, 10 + 64 * 3);
});

test("encodeBatchTransfer rejects bad input", () => {
  assert.throws(() => encodeBatchTransfer("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", [], []));
  assert.throws(() =>
    encodeBatchTransfer("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", ["0x1234"], [1n, 2n]),
  );
});

test("parseTransferFailedLog decodes topics", () => {
  const log = {
    topics: [
      "0x77d85bbe9e2d90dc4e0a5153e5de22cc708506fbe1d7dc2bdc2dc653b2c04aea",
      "0x0000000000000000000000000000000000000000000000000000000000000007",
      "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045",
    ],
    data: "0x00000000000000000000000000000000000000000000000000000000000f4240",
  };
  const parsed = parseTransferFailedLog(log);
  assert.ok(parsed);
  assert.equal(parsed.index, 7n);
  assert.equal(parsed.recipient, "0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
  assert.equal(parsed.amount, 1_000_000n);
  assert.equal(parseTransferFailedLog({ topics: ["0xdead"], data: "0x" }), null);
});

test("parseBatchExecutedLog decodes fields", () => {
  const log = {
    topics: [
      "0xca81223dee601f44c44ce11d952c9f947da2bb8f802f2fc0928e836f42a8cebf",
      "0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    ],
    data:
      "0x" +
      "00000000000000000000000000000000000000000000000000000000000000c8".repeat(3),
  };
  const parsed = parseBatchExecutedLog(log);
  assert.ok(parsed);
  assert.equal(parsed.count, 200n);
  assert.equal(parsed.failedCount, 200n);
  assert.equal(parseBatchExecutedLog({ topics: ["0xdead"], data: "0x" }), null);
});
