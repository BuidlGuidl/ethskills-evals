/**
 * Retry semantics for BatchRelayer, against a stub client.
 *
 * The case that matters: a send whose receipt wait times out, but whose
 * transaction lands anyway. The batch must not be paid twice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BatchRelayer } from '../src/batcher.mjs';

const BATCH = '0x' + '11'.repeat(20);
const TOKEN = '0x' + '22'.repeat(20);
const addr = (n) => '0x' + n.toString(16).padStart(40, '0');

function stubClient(overrides = {}) {
  const state = { sends: [], nonceCalls: 0, receipts: new Map() };
  return {
    state,
    baseFeePerGas: async () => 5_000_000n,
    simulate: async () => null,
    estimateGas: async () => 1_000_000n,
    pendingNonce: async () => { state.nonceCalls++; return 42; },
    receiptOf: async (h) => state.receipts.get(h) ?? null,
    sendAndWait: async (tx) => {
      state.sends.push(tx);
      return { status: 'success', gasUsed: 100n, transactionHash: '0xabc', hash: '0xabc' };
    },
    ...overrides,
  };
}

const mkRelayer = (client, opts = {}) => new BatchRelayer({
  client, batchTransfer: BATCH, token: TOKEN, mode: 'float',
  maxBatchSize: 10, maxWaitMs: 5, ...opts,
});

test('reuses one pinned nonce across retries', async () => {
  let attempt = 0;
  const client = stubClient({
    sendAndWait: async (tx) => {
      attempt++;
      if (attempt < 3) { const e = new Error('timeout'); throw e; }
      return { status: 'success', gasUsed: 100n, transactionHash: '0xok', hash: '0xok' };
    },
  });
  const relayer = mkRelayer(client);
  const p = relayer.enqueue(addr(1), 5n);
  await relayer.drain();
  await p;
  assert.equal(client.state.nonceCalls, 1, 'nonce fetched once');
});

test('does not resend when an earlier attempt already landed', async () => {
  const client = stubClient();
  let sends = 0;
  client.sendAndWait = async () => {
    sends++;
    // Broadcast succeeded, but waiting for the receipt timed out.
    client.state.receipts.set('0xlanded', { status: 'success', gasUsed: 77n, transactionHash: '0xlanded' });
    const e = new Error('receipt timeout');
    e.hash = '0xlanded';
    throw e;
  };
  const relayer = mkRelayer(client);
  const p = relayer.enqueue(addr(2), 5n);
  await relayer.drain();
  const receipt = await p;
  assert.equal(receipt.transactionHash, '0xlanded');
  assert.equal(sends, 1, 'must not broadcast a second batch');
});

test('escalates the tip on each retry', async () => {
  const tips = [];
  const client = stubClient({
    sendAndWait: async (tx) => {
      tips.push(tx.maxPriorityFeePerGas);
      if (tips.length < 3) throw new Error('not included');
      return { status: 'success', gasUsed: 1n, transactionHash: '0xz', hash: '0xz' };
    },
  });
  const relayer = mkRelayer(client);
  const p = relayer.enqueue(addr(3), 5n);
  await relayer.drain();
  await p;
  assert.ok(tips[1] > tips[0] && tips[2] > tips[1], `tips should rise: ${tips}`);
});

test('rejects the batch when every attempt fails and none landed', async () => {
  const client = stubClient({ sendAndWait: async () => { throw new Error('nope'); } });
  const relayer = mkRelayer(client, { maxAttempts: 2 });
  const p = relayer.enqueue(addr(4), 5n).then(() => 'ok', (e) => e.message);
  await relayer.drain();
  assert.equal(await p, 'nope');
});

test('preflight drops only the payout the contract names', async () => {
  let call = 0;
  const client = stubClient({
    simulate: async () => {
      // First simulation blames index 1; after it is dropped, all is well.
      if (call++ === 0) return { data: '0xc39ba1a9' + (1n).toString(16).padStart(64, '0') };
      return null;
    },
  });
  const relayer = mkRelayer(client);
  const results = [
    relayer.enqueue(addr(10), 1n).then(() => 'ok', () => 'rejected'),
    relayer.enqueue(addr(11), 1n).then(() => 'ok', () => 'rejected'),
    relayer.enqueue(addr(12), 1n).then(() => 'ok', () => 'rejected'),
  ];
  await relayer.drain();
  assert.deepEqual(await Promise.all(results), ['ok', 'rejected', 'ok']);
});
