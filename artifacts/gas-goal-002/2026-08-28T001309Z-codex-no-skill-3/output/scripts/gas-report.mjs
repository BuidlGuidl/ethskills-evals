#!/usr/bin/env node
/*
 * Reconciles Base ERC-20 transfers made by one relayer without an explorer API.
 * Usage:
 *   BASE_RPC_URL=https://mainnet.base.org RELAYER=0x... node scripts/gas-report.mjs 2026-08-01 2026-08-08
 *
 * Optional: PAYOUT_SENDER=0x... is the address in Transfer.from (the batch contract
 * after rollout; defaults to RELAYER). TOKEN=0x... limits the report to one ERC-20. The report intentionally
 * uses paid receipt fields (l1Fee/operatorFee) when supplied by the RPC, not a gas-price estimate.
 */
import process from 'node:process';

const RPC_URL = process.env.BASE_RPC_URL;
const RELAYER = (process.env.RELAYER || '').toLowerCase();
const PAYOUT_SENDER = (process.env.PAYOUT_SENDER || process.env.RELAYER || '').toLowerCase();
const TOKEN = (process.env.TOKEN || '').toLowerCase();
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DAY_MS = 86_400_000;

if (!RPC_URL || !/^0x[0-9a-f]{40}$/.test(RELAYER) || !/^0x[0-9a-f]{40}$/.test(PAYOUT_SENDER)) {
  throw new Error('Set BASE_RPC_URL, RELAYER, and (if batching) a 20-byte PAYOUT_SENDER address.');
}

const [startArg, endArg] = process.argv.slice(2);
const end = endArg ? new Date(endArg) : new Date();
const start = startArg ? new Date(startArg) : new Date(end.getTime() - 7 * DAY_MS);
if (Number.isNaN(+start) || Number.isNaN(+end) || start >= end) {
  throw new Error('Pass ISO dates: [start] [end], with start before end.');
}

let requestId = 0;
async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}
const hex = n => `0x${BigInt(n).toString(16)}`;
const asBigInt = value => BigInt(value || '0x0');
const paddedAddress = address => `0x${'0'.repeat(24)}${address.slice(2)}`;

async function blockAtOrAfter(timestampMs) {
  let low = 0n;
  let high = asBigInt(await rpc('eth_blockNumber', []));
  while (low < high) {
    const mid = (low + high) / 2n;
    const block = await rpc('eth_getBlockByNumber', [hex(mid), false]);
    if (asBigInt(block.timestamp) * 1000n < BigInt(timestampMs)) low = mid + 1n;
    else high = mid;
  }
  return low;
}

async function logsInRanges(fromBlock, toBlock) {
  const logs = [];
  // Keep ranges modest; providers commonly impose result caps.  Halve and retry when capped.
  for (let from = fromBlock; from <= toBlock;) {
    let size = 1_000n;
    while (true) {
      const to = from + size - 1n > toBlock ? toBlock : from + size - 1n;
      try {
        const filter = {
          fromBlock: hex(from), toBlock: hex(to),
          topics: [TRANSFER_TOPIC, paddedAddress(PAYOUT_SENDER)],
        };
        if (TOKEN) filter.address = TOKEN;
        logs.push(...await rpc('eth_getLogs', [filter]));
        from = to + 1n;
        break;
      } catch (error) {
        if (size === 1n) throw error;
        size /= 2n;
      }
    }
  }
  return logs;
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const [fromBlock, toBlock] = await Promise.all([blockAtOrAfter(+start), blockAtOrAfter(+end)]);
const logs = await logsInRanges(fromBlock, toBlock - 1n);
const txHashes = [...new Set(logs.map(log => log.transactionHash))];
const receipts = await mapLimit(txHashes, 12, hash => rpc('eth_getTransactionReceipt', [hash]));

let l2Wei = 0n, l1Wei = 0n, operatorWei = 0n, receiptsWithoutL1Fee = 0;
for (const receipt of receipts) {
  l2Wei += asBigInt(receipt.gasUsed) * asBigInt(receipt.effectiveGasPrice ?? receipt.gasPrice);
  if (receipt.l1Fee === undefined) receiptsWithoutL1Fee++;
  else l1Wei += asBigInt(receipt.l1Fee);
  operatorWei += asBigInt(receipt.operatorFee);
}
const payouts = logs.length;
const totalWei = l2Wei + l1Wei + operatorWei;
const eth = wei => (Number(wei) / 1e18).toFixed(8);
const row = (label, value) => console.log(`${label.padEnd(30)} ${value}`);

console.log(`Base relayer gas report: ${start.toISOString()} to ${end.toISOString()}`);
row('Payout sender', PAYOUT_SENDER);
row('Blocks scanned', `${fromBlock}–${toBlock - 1n}`);
row('ERC-20 payout logs', payouts);
row('Transactions containing payouts', receipts.length);
row('L2 execution fee (ETH)', eth(l2Wei));
row('L1 data fee (ETH)', eth(l1Wei));
row('Operator fee (ETH)', eth(operatorWei));
row('Known total paid (ETH)', eth(totalWei));
row('Known ETH / payout', payouts ? eth(totalWei / BigInt(payouts)) : 'n/a');
if (receiptsWithoutL1Fee) {
  console.warn(`WARNING: ${receiptsWithoutL1Fee}/${receipts.length} receipts omitted l1Fee; the total is a lower bound. Use a Base RPC that returns OP receipt extensions before giving Finance a final total.`);
}
