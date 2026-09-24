#!/usr/bin/env node
// What the relayer wallet ACTUALLY paid, from its own receipts.
//
// tools/measure-base.mjs shows what the chain charges; this shows what you chose to
// pay on top of that. The gap between the two is the cheapest money in the plan --
// it needs no contract, only correct EIP-1559 fields.
//
//   BASESCAN_API_KEY=... node tools/audit-relayer.mjs --address 0xYourRelayer [--days 7]

const RPC = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const ADDRESS = arg('address');
const DAYS = Number(arg('days', 7));

if (!ADDRESS) { console.error('usage: node tools/audit-relayer.mjs --address 0x... [--days 7]'); process.exit(1); }

const rpc = async (method, params, url = RPC) => {
  const j = await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
};

async function ethUsd() {
  const data = await rpc('eth_call', [{ to: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', data: '0xfeaf968c' }, 'latest'], 'https://ethereum-rpc.publicnode.com');
  return Number(BigInt('0x' + data.slice(2 + 64, 2 + 128))) / 1e8;
}

async function txHashes() {
  const key = process.env.BASESCAN_API_KEY;
  if (!key) {
    throw new Error(
      'Set BASESCAN_API_KEY (free at basescan.org) so this can list the relayer\'s transactions.\n' +
      'Without an index, finding one wallet\'s txs means scanning every block, which the public RPC will rate-limit.',
    );
  }
  const head = Number(await rpc('eth_blockNumber', []));
  const startBlock = head - Math.floor((DAYS * 86400) / 2); // Base: 2s blocks
  const url = `https://api.etherscan.io/v2/api?chainid=8453&module=account&action=txlist&address=${ADDRESS}&startblock=${startBlock}&endblock=99999999&sort=desc&apikey=${key}`;
  const j = await (await fetch(url)).json();
  if (j.status !== '1') throw new Error(`basescan: ${j.message} ${j.result ?? ''}`);
  return j.result.map((t) => t.hash);
}

const usd = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const main = async () => {
  const [eth, hashes] = await Promise.all([ethUsd(), txHashes()]);
  let l2 = 0n, l1 = 0n, gas = 0n, failed = 0, n = 0;
  const ratios = [];

  for (const h of hashes) {
    const r = await rpc('eth_getTransactionReceipt', [h]);
    if (!r) continue;
    const b = await rpc('eth_getBlockByNumber', [r.blockNumber, false]);
    const g = BigInt(r.gasUsed), egp = BigInt(r.effectiveGasPrice), bf = BigInt(b.baseFeePerGas);
    l2 += g * egp; l1 += BigInt(r.l1Fee ?? '0x0'); gas += g; n++;
    if (r.status !== '0x1') failed++;
    ratios.push(Number(egp) / Number(bf));
  }
  if (n === 0) { console.log('No transactions found in that window.'); return; }

  const totalEth = Number(l2 + l1) / 1e18;
  const med = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
  const spentPerDay = (totalEth * eth) / DAYS;

  console.log(`relayer ${ADDRESS}  last ${DAYS} days  (${n} txs, ${failed} reverted)`);
  console.log(`  total paid           ${totalEth.toFixed(8)} ETH  = ${usd(totalEth * eth)}  @ ${usd(eth)}/ETH`);
  console.log(`  execution (L2)       ${(100 * Number(l2) / Number(l2 + l1)).toFixed(2)}%`);
  console.log(`  L1 data fee          ${(100 * Number(l1) / Number(l2 + l1)).toFixed(2)}%`);
  console.log(`  avg gasUsed          ${(Number(gas) / n).toFixed(0)}`);
  console.log(`  median paid/baseFee  ${med.toFixed(2)}x   <- every 1.0x above ~1.1x is avoidable overpayment`);
  console.log(`  run rate             ${usd(spentPerDay)}/day   ${usd(spentPerDay * 365)}/yr`);
  if (med > 1.5) {
    console.log(`\n  >>> At ${med.toFixed(2)}x base fee you are overpaying roughly ` +
      `${usd(spentPerDay * 365 * (1 - 1.1 / med))}/yr on tips alone.`);
    console.log('  >>> Fix by deriving fee fields per-tx with relayer/fees.mjs. No contract change needed.');
  }
  if (failed > 0) {
    console.log(`\n  >>> ${failed} reverted tx(s) (${(100 * failed / n).toFixed(1)}%). Reverted txs pay full gas and buy nothing.`);
  }
};

main().catch((e) => { console.error(e.message); process.exit(1); });
