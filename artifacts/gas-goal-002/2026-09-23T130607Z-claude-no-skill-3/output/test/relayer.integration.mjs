/**
 * End-to-end: BatchRelayer against real USDC on a Base mainnet fork.
 *
 * Run via `./scripts/with-fork.sh node --test test/relayer.integration.mjs`.
 * The important case is preflight: one payout that cannot succeed must be
 * dropped without taking the rest of the batch down with it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { BatchRelayer } from '../src/batcher.mjs';
import { viemClient } from '../src/adapters/viem.mjs';
import { USDC, ACCT, KEY, RPC, setUsdcBalance, deployBatcher, giveEth, prewarm } from '../scripts/lib/fork.mjs';

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)']);
const account = privateKeyToAccount(KEY);
const transport = http(RPC);
const publicClient = createPublicClient({ chain: base, transport });
const walletClient = createWalletClient({ account, chain: base, transport });

const addr = (n) => '0x' + n.toString(16).padStart(40, '0');
const balance = (who) => publicClient.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [who] });

test('batches real USDC payouts in one transaction', async () => {
  await giveEth(ACCT);
  const batchTransfer = deployBatcher();
  await setUsdcBalance(batchTransfer, 1_000_000_000n);

  const recipients = Array.from({ length: 12 }, (_, i) => addr(0xda7a0000n + BigInt(i)));
  await prewarm(recipients);

  const events = [];
  const relayer = new BatchRelayer({
    client: viemClient(publicClient, walletClient),
    batchTransfer, token: USDC, mode: 'float',
    maxBatchSize: 50, maxWaitMs: 50,
    onEvent: (e) => events.push(e),
  });

  const sent = recipients.map((to, i) => relayer.enqueue(to, BigInt(1000 + i)));
  await relayer.drain();
  await Promise.all(sent);

  for (let i = 0; i < recipients.length; i++) {
    assert.equal(await balance(recipients[i]), BigInt(1000 + i), `recipient ${i}`);
  }
  const batches = events.filter((e) => e.type === 'batch_sent');
  assert.equal(batches.length, 1, 'all payouts in a single transaction');
  assert.equal(batches[0].size, 12);
});

test('drops a payout that cannot succeed and pays the rest', async () => {
  await giveEth(ACCT);
  const batchTransfer = deployBatcher();
  await setUsdcBalance(batchTransfer, 50_000n); // small float on purpose

  const good = Array.from({ length: 5 }, (_, i) => addr(0xbad00000n + BigInt(i)));
  await prewarm(good);

  const events = [];
  const relayer = new BatchRelayer({
    client: viemClient(publicClient, walletClient),
    batchTransfer, token: USDC, mode: 'float',
    maxBatchSize: 50, maxWaitMs: 50,
    onEvent: (e) => events.push(e),
  });

  const results = [
    relayer.enqueue(good[0], 1_000n),
    relayer.enqueue(good[1], 1_000n),
    // more than the whole float: this one can never succeed
    relayer.enqueue(good[2], 40_000_000n),
    relayer.enqueue(good[3], 1_000n),
    relayer.enqueue(good[4], 1_000n),
  ].map((p) => p.then(() => 'ok', () => 'rejected'));

  await relayer.drain();
  assert.deepEqual(await Promise.all(results), ['ok', 'ok', 'rejected', 'ok', 'ok']);

  assert.equal(await balance(good[0]), 1_000n);
  assert.equal(await balance(good[3]), 1_000n);
  assert.equal(await balance(good[2]), 0n, 'the impossible payout moved nothing');

  const dropped = events.filter((e) => e.type === 'payout_dropped');
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].to.toLowerCase(), good[2].toLowerCase());
});

test('splits a queue larger than maxBatchSize across transactions', async () => {
  await giveEth(ACCT);
  const batchTransfer = deployBatcher();
  await setUsdcBalance(batchTransfer, 1_000_000_000n);

  const recipients = Array.from({ length: 7 }, (_, i) => addr(0x5917000n + BigInt(i)));
  await prewarm(recipients);

  const events = [];
  const relayer = new BatchRelayer({
    client: viemClient(publicClient, walletClient),
    batchTransfer, token: USDC, mode: 'float',
    maxBatchSize: 3, maxWaitMs: 50,
    onEvent: (e) => events.push(e),
  });

  const sent = recipients.map((to) => relayer.enqueue(to, 500n));
  await relayer.drain();
  await Promise.all(sent);

  const sizes = events.filter((e) => e.type === 'batch_sent').map((e) => e.size);
  assert.deepEqual(sizes, [3, 3, 1]);
  for (const r of recipients) assert.equal(await balance(r), 500n);
});
