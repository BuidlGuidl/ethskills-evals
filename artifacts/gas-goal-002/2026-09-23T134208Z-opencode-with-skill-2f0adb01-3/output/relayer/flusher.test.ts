import test from "node:test";
import assert from "node:assert/strict";
import { BatchingFlusher, type RelayerSigner, type TxRequest } from "./flusher.ts";
import { defaultFeePolicy } from "./fees.ts";
import { estimateBatchGasLimit } from "./gas-model.ts";

const DISPATCHER = "0x1234567890123456789012345678901234567890";
const TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

class RecordingSigner implements RelayerSigner {
  sent: TxRequest[] = [];
  fail = false;
  address(): string {
    return "0xabc0000000000000000000000000000000000001";
  }
  async sendTransaction(request: TxRequest): Promise<string> {
    if (this.fail) throw new Error("rpc down");
    this.sent.push(request);
    return `0xhash${this.sent.length}`;
  }
}

test("flusher sends due batch as single transaction", async () => {
  const signer = new RecordingSigner();
  const flusher = new BatchingFlusher(signer, { baseFeeWei: async () => 5_000_000n }, DISPATCHER, {
    maxEntries: 100,
    maxWaitMs: 1_000,
    freshRatio: 0.5,
  });
  await flusher.enqueue({ token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: 1n }, 0);
  await flusher.enqueue({ token: TOKEN, recipient: "0x2222222222222222222222222222222222222222", amount: 2n }, 0);

  const result = await flusher.flushOnce(5_000);
  assert.equal(result.sent.length, 1);
  assert.equal(result.deferred, 0);
  assert.equal(signer.sent.length, 1);
  const tx = signer.sent[0];
  assert.equal(tx.to, DISPATCHER);
  assert.equal(tx.data.slice(0, 10), "0x1239ec8c");
  assert.equal(tx.gasLimit, estimateBatchGasLimit(2, 0.5));
  assert.equal(tx.maxPriorityFeePerGas, defaultFeePolicy().tipFloorWei);
});

test("single-entry batch falls back to direct erc-20 transfer", async () => {
  const signer = new RecordingSigner();
  const flusher = new BatchingFlusher(signer, { baseFeeWei: async () => 5_000_000n }, DISPATCHER, {
    maxWaitMs: 1_000,
  });
  await flusher.enqueue(
    { token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: 7n },
    0,
  );
  const result = await flusher.flushOnce(5_000);
  assert.equal(result.sent.length, 1);
  const tx = signer.sent[0];
  assert.equal(tx.to, TOKEN.toLowerCase());
  assert.equal(tx.data.slice(0, 10), "0xa9059cbb");
});

test("flusher defers batches when base fee spikes", async () => {
  const signer = new RecordingSigner();
  const flusher = new BatchingFlusher(signer, { baseFeeWei: async () => 1_000_000_000n }, DISPATCHER, {
    maxWaitMs: 1_000,
  });
  await flusher.enqueue({ token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: 1n }, 0);
  const result = await flusher.flushOnce(5_000);
  assert.equal(result.sent.length, 0);
  assert.equal(result.deferred, 1);
  assert.equal(signer.sent.length, 0);
  assert.equal(flusher.pendingCount(), 1);

  const flusher2 = new BatchingFlusher(signer, { baseFeeWei: async () => 5_000_000n }, DISPATCHER, {
    maxWaitMs: 1_000,
  });
  await flusher2.enqueue({ token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: 1n }, 0);
  assert.equal((await flusher2.flushOnce(5_000)).sent.length, 1);
});

test("failed sends requeue payouts", async () => {
  const signer = new RecordingSigner();
  signer.fail = true;
  const flusher = new BatchingFlusher(signer, { baseFeeWei: async () => 5_000_000n }, DISPATCHER, {
    maxWaitMs: 1_000,
  });
  await flusher.enqueue({ token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: 1n }, 0);
  const result = await flusher.flushOnce(5_000);
  assert.equal(result.sent.length, 0);
  assert.equal(flusher.pendingCount(), 1);
});

test("validatePayout hook runs before enqueue", async () => {
  const signer = new RecordingSigner();
  const flusher = new BatchingFlusher(signer, { baseFeeWei: async () => 5_000_000n }, DISPATCHER, {
    maxWaitMs: 1_000,
    validatePayout: async (p) => {
      if (p.recipient === "0xblocked") throw new Error("blocked");
    },
  });
  await assert.rejects(() =>
    flusher.enqueue({ token: TOKEN, recipient: "0xblocked", amount: 1n }),
  );
  await flusher.enqueue({ token: TOKEN, recipient: "0x1111111111111111111111111111111111111111", amount: 1n }, 0);
  assert.equal(flusher.pendingCount(), 1);
});
