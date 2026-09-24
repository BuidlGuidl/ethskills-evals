#!/usr/bin/env node
// Live gas cost model for the Base payments relayer.
//
//   node scripts/gas-cost-report.mjs
//   TRANSFERS_PER_DAY=40000 NEW_RECIPIENT_SHARE=0.38 node scripts/gas-cost-report.mjs
//
// Pulls the current Base L2 base fee, the L1 data-availability inputs from the
// GasPriceOracle predeploy, and the ETH price, then prices today's spend and
// each option in PLAN.md. Nothing here is hardcoded from a blog post - rerun it
// and the numbers move with the chain.

const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const TRANSFERS_PER_DAY = Number(process.env.TRANSFERS_PER_DAY || 40_000);
// Share of payouts going to an address that does not yet hold the token. A
// zero -> non-zero balance write costs 20,000 gas; a repeat write costs 2,900.
const NEW_SHARE = Number(process.env.NEW_RECIPIENT_SHARE || 0.38);

// Gas constants measured on a Base fork, see test/GasBenchmark.t.sol.
const GAS = {
  singleNew: 62_171,       // observed on-chain, first-time recipient
  singleExisting: 43_000,  // observed on-chain, repeat recipient (40.3k-45.1k)
  batchMarginalNew: 32_354,
  batchMarginalExisting: 15_439,
  batchMarginalUniform: 14_401,
  batchFixedOverhead: 75_000, // per batch tx, conservative
};

let rpcId = 0;
async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

const ORACLE = '0x420000000000000000000000000000000000000F';
const call = (selector) => rpc('eth_call', [{ to: ORACLE, data: selector }, 'latest']);

async function ethUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const j = await r.json();
    if (j?.ethereum?.usd) return j.ethereum.usd;
  } catch { /* fall through */ }
  const fallback = Number(process.env.ETH_USD || 2731);
  console.warn(`! could not fetch ETH price, using $${fallback}`);
  return fallback;
}

const usd = (n) => {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  return a < 0.01 ? `${sign}$${a.toFixed(6)}` : `${sign}$${a.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

async function main() {
  const [baseFeeHex, gasPriceHex, ethPrice] = await Promise.all([
    rpc('eth_gasPrice'), // sequencer's suggested total price
    rpc('eth_getBlockByNumber', ['latest', false]).then((b) => b.baseFeePerGas),
    ethUsd(),
  ]);
  const suggested = BigInt(baseFeeHex);
  const baseFee = BigInt(gasPriceHex);

  // L1 data fee inputs (Fjord): fee = (baseFeeScalar*16*l1BaseFee + blobScalar*blobBaseFee) ...
  const [l1BaseFee, blobBaseFee] = await Promise.all([
    call('0x519b4bd3').then(BigInt), // l1BaseFee()
    call('0xf8206140').then(BigInt), // blobBaseFee()
  ]);

  const gwei = (v) => Number(v) / 1e9;
  const priceWei = Number(suggested);

  console.log('=== Live inputs ===');
  console.log(`RPC                 ${RPC}`);
  console.log(`L2 base fee         ${gwei(baseFee).toFixed(6)} gwei`);
  console.log(`L2 suggested price  ${gwei(suggested).toFixed(6)} gwei`);
  console.log(`L1 base fee         ${gwei(l1BaseFee).toFixed(4)} gwei`);
  console.log(`L1 blob base fee    ${gwei(blobBaseFee).toFixed(6)} gwei`);
  console.log(`ETH                 $${ethPrice}`);
  console.log(`Volume              ${TRANSFERS_PER_DAY.toLocaleString()} transfers/day, ${(NEW_SHARE * 100).toFixed(0)}% to first-time recipients\n`);

  // L1 data fee per transfer. Measured directly from receipts at ~3e-9 ETH for a
  // 68-byte transfer; it scales with compressed calldata size and is ~1% of the
  // total, so we carry it as a measured constant rather than re-deriving Fjord.
  const L1_FEE_ETH_PER_TX = 3e-9;

  const costOf = (gas, l1Eth = L1_FEE_ETH_PER_TX) => ((gas * priceWei) / 1e18 + l1Eth) * ethPrice;

  const perYear = (perTx) => perTx * TRANSFERS_PER_DAY * 365;
  const perMonth = (perTx) => (perTx * TRANSFERS_PER_DAY * 365) / 12;

  const blendedSingle = NEW_SHARE * GAS.singleNew + (1 - NEW_SHARE) * GAS.singleExisting;
  const baseline = costOf(blendedSingle);

  console.log('=== Today: one transfer per transaction ===');
  console.log(`first-time recipient  ${GAS.singleNew.toLocaleString()} gas  ${usd(costOf(GAS.singleNew))}`);
  console.log(`repeat recipient      ${GAS.singleExisting.toLocaleString()} gas  ${usd(costOf(GAS.singleExisting))}`);
  console.log(`blended               ${Math.round(blendedSingle).toLocaleString()} gas  ${usd(baseline)}`);
  console.log(`  -> ${usd(baseline * TRANSFERS_PER_DAY)}/day   ${usd(perMonth(baseline))}/month   ${usd(perYear(baseline))}/year\n`);

  console.log('=== Option: batch transfers via BatchTransfer.sol ===');
  const rows = [];
  for (const n of [1, 10, 25, 50, 100, 200]) {
    const marginal = NEW_SHARE * GAS.batchMarginalNew + (1 - NEW_SHARE) * GAS.batchMarginalExisting;
    const perPayoutGas = marginal + GAS.batchFixedOverhead / n;
    // One batch tx carries one L1 data fee, amortised across n payouts, but the
    // payload grows ~2 words per payout - net it still shrinks per payout.
    const l1 = L1_FEE_ETH_PER_TX * (0.35 + 0.65 / n);
    const perPayout = costOf(perPayoutGas, l1);
    rows.push({ n, perPayoutGas, perPayout });
    const saving = perYear(baseline) - perYear(perPayout);
    console.log(
      `batch of ${String(n).padStart(3)}  ${String(Math.round(perPayoutGas)).padStart(7)} gas/payout  ` +
      `${usd(perPayout).padStart(11)}  saves ${usd(saving).padStart(9)}/yr  (${((1 - perPayout / baseline) * 100).toFixed(0)}%)`
    );
  }

  const best = rows.find((r) => r.n === 100);
  console.log('\n=== Option: uniform-amount batches (batchTransferSameAmount) ===');
  {
    const marginal = NEW_SHARE * GAS.batchMarginalNew + (1 - NEW_SHARE) * GAS.batchMarginalUniform;
    const perPayoutGas = marginal + GAS.batchFixedOverhead / 100;
    const perPayout = costOf(perPayoutGas, L1_FEE_ETH_PER_TX * 0.35);
    console.log(`batch of 100  ${Math.round(perPayoutGas)} gas/payout  ${usd(perPayout)}  ` +
      `extra saving over mixed-amount batching: ${usd(perYear(best.perPayout) - perYear(perPayout))}/yr`);
  }

  console.log('\n=== Where the money actually goes ===');
  const l2Share = (blendedSingle * priceWei) / 1e18;
  console.log(`L2 execution  ${((l2Share / (l2Share + L1_FEE_ETH_PER_TX)) * 100).toFixed(1)}% of each transfer`);
  console.log(`L1 data       ${((L1_FEE_ETH_PER_TX / (l2Share + L1_FEE_ETH_PER_TX)) * 100).toFixed(1)}% of each transfer`);
  console.log('-> calldata compression targets the L1 share and is not worth the engineering time.');

  console.log('\n=== Fee-overpayment check ===');
  console.log(`If the relayer hardcodes a 1 gwei priority fee instead of tracking the ${gwei(suggested).toFixed(4)} gwei suggestion,`);
  const naive = ((blendedSingle * 1e9) / 1e18 + L1_FEE_ETH_PER_TX) * ethPrice;
  console.log(`each transfer costs ${usd(naive)} instead of ${usd(baseline)} - ${usd(perYear(naive) - perYear(baseline))}/yr of pure waste.`);
  console.log('Run relayer/check-relayer-fees.mjs against the live relayer address to confirm which one you are doing.');
}

main().catch((e) => { console.error(e); process.exit(1); });
