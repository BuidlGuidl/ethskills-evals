#!/usr/bin/env node
// Measures what Base actually charges right now and prints the cost model used in
// PLAN.md. Re-run it before quoting any figure to finance -- gas price and ETH/USD
// both move, and every number in the plan is a function of them.
//
//   node tools/measure-base.mjs [--transfers-per-day 40000] [--blocks 12]

const RPC = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(argv[i + 1]);
};
const TRANSFERS_PER_DAY = arg('transfers-per-day', 40_000);
const BLOCKS = arg('blocks', 12);

const rpc = async (method, params, url = RPC) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
};

async function ethUsd() {
  // Chainlink ETH/USD on mainnet, 8 decimals. latestRoundData() -> answer is word 1.
  try {
    const data = await rpc(
      'eth_call',
      [{ to: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', data: '0xfeaf968c' }, 'latest'],
      'https://ethereum-rpc.publicnode.com',
    );
    const answer = BigInt('0x' + data.slice(2 + 64, 2 + 128));
    return { price: Number(answer) / 1e8, source: 'chainlink' };
  } catch {
    const j = await (await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot')).json();
    return { price: Number(j.data.amount), source: 'coinbase' };
  }
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];

async function sampleTransfers() {
  const head = Number(await rpc('eth_blockNumber', []));
  const rows = [];
  const baseFees = [];
  for (let i = 0; i < BLOCKS; i++) {
    const b = await rpc('eth_getBlockByNumber', ['0x' + (head - 5 - i * 3).toString(16), true]);
    baseFees.push(Number(BigInt(b.baseFeePerGas)) / 1e9);
    const cand = b.transactions
      .filter((t) => t.input.startsWith('0xa9059cbb') && t.to?.toLowerCase() === USDC)
      .slice(0, 12);
    for (const t of cand) {
      const r = await rpc('eth_getTransactionReceipt', [t.hash]);
      if (r.status !== '0x1') continue;
      rows.push({
        gas: Number(BigInt(r.gasUsed)),
        egpGwei: Number(BigInt(r.effectiveGasPrice)) / 1e9,
        l1FeeEth: Number(BigInt(r.l1Fee ?? '0x0')) / 1e18,
        baseFeeGwei: Number(BigInt(b.baseFeePerGas)) / 1e9,
      });
    }
  }
  return { rows, baseFees };
}

const usd = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdPrecise = (n) => '$' + n.toFixed(6);

function cost({ gas, gasPriceGwei, l1FeeEth, ethUsd }) {
  // Two components on an OP-stack chain. l1FeeEth is NOT inside gasPriceGwei.
  const l2Eth = gas * gasPriceGwei * 1e-9;
  return { l2Eth, l1FeeEth, totalEth: l2Eth + l1FeeEth, totalUsd: (l2Eth + l1FeeEth) * ethUsd };
}

const main = async () => {
  const [{ price: eth, source }, gasPriceWei, baseFeeWei, { rows, baseFees }] = await Promise.all([
    ethUsd(),
    rpc('eth_gasPrice', []),
    rpc('eth_getBlockByNumber', ['latest', false]).then((b) => BigInt(b.baseFeePerGas)),
    sampleTransfers(),
  ]);

  const gasPriceGwei = Number(BigInt(gasPriceWei)) / 1e9;
  const baseFeeGwei = Number(baseFeeWei) / 1e9;

  console.log(`measured ${new Date().toISOString()}  rpc=${RPC}`);
  console.log(`ETH/USD                     ${usd(eth)}  (${source})`);
  console.log(`Base base fee               ${baseFeeGwei.toFixed(6)} gwei`);
  console.log(`Base suggested gas price    ${gasPriceGwei.toFixed(6)} gwei  (base fee + suggested tip)`);
  console.log(`base fee over ${BLOCKS} blocks     min ${Math.min(...baseFees).toFixed(6)} / med ${median(baseFees).toFixed(6)} / max ${Math.max(...baseFees).toFixed(6)} gwei`);
  console.log();

  const gasUsed = rows.map((r) => r.gas);
  const egp = rows.map((r) => r.egpGwei);
  const l1 = rows.map((r) => r.l1FeeEth);
  const ratio = rows.map((r) => r.egpGwei / r.baseFeeGwei);

  console.log(`sampled ${rows.length} successful USDC transfer() txs on Base`);
  console.log(`  gasUsed            min ${Math.min(...gasUsed)} / med ${median(gasUsed)} / mean ${mean(gasUsed).toFixed(0)} / max ${Math.max(...gasUsed)}`);
  console.log(`  effectiveGasPrice  med ${median(egp).toFixed(6)} / mean ${mean(egp).toFixed(6)} / max ${Math.max(...egp).toFixed(6)} gwei`);
  console.log(`  paid / base fee    med ${median(ratio).toFixed(2)}x / p90 ${pct(ratio, 0.9).toFixed(2)}x / max ${Math.max(...ratio).toFixed(2)}x`);
  console.log(`  l1Fee              med ${median(l1).toExponential(3)} ETH  (${usd(median(l1) * eth)})`);

  const c = cost({ gas: median(gasUsed), gasPriceGwei, l1FeeEth: median(l1), ethUsd: eth });
  const l1Share = (100 * c.l1FeeEth) / c.totalEth;
  console.log(`  L1 data fee share of total cost: ${l1Share.toFixed(2)}%  <- execution gas dominates`);
  console.log();

  console.log(`cost model at ${TRANSFERS_PER_DAY.toLocaleString()} transfers/day`);
  const scenarios = [
    ['today, median on-chain transfer', median(gasUsed), gasPriceGwei, median(l1)],
    ['same, if relayer pays p90 tip', median(gasUsed), baseFeeGwei * pct(ratio, 0.9), median(l1)],
    ['batched x50, repeat payees', 13_420, gasPriceGwei, median(l1) / 3],
    ['batched x50, new payees', 30_517, gasPriceGwei, median(l1) / 3],
  ];
  for (const [label, gas, gp, l1f] of scenarios) {
    const s = cost({ gas, gasPriceGwei: gp, l1FeeEth: l1f, ethUsd: eth });
    console.log(
      `  ${label.padEnd(34)} ${String(gas).padStart(7)} gas @ ${gp.toFixed(6)} gwei  ` +
        `= ${usdPrecise(s.totalUsd).padStart(11)}/payout  ${usd(s.totalUsd * TRANSFERS_PER_DAY).padStart(10)}/day  ` +
        `${usd(s.totalUsd * TRANSFERS_PER_DAY * 365).padStart(12)}/yr`,
    );
  }

  // Sanity check against mainnet, so "why not L1" is answered with a measured number.
  const l1GasPrice = Number(BigInt(await rpc('eth_gasPrice', [], 'https://ethereum-rpc.publicnode.com'))) / 1e9;
  const mainnet = cost({ gas: median(gasUsed), gasPriceGwei: l1GasPrice, l1FeeEth: 0, ethUsd: eth });
  console.log();
  console.log(
    `same workload on Ethereum mainnet @ ${l1GasPrice.toFixed(3)} gwei = ` +
      `${usdPrecise(mainnet.totalUsd)}/payout  ${usd(mainnet.totalUsd * TRANSFERS_PER_DAY)}/day  ` +
      `${usd(mainnet.totalUsd * TRANSFERS_PER_DAY * 365)}/yr`,
  );
};

main().catch((e) => {
  console.error('measurement failed:', e.message);
  console.error('Do not fall back to a remembered number -- fix the RPC and re-run.');
  process.exit(1);
});
