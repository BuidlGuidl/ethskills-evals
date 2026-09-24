/**
 * Turns the measured gas figures into a cost model for finance.
 *
 * Live inputs are read from Base mainnet at run time (L2 base fee, the L1 fee
 * oracle, ETH price). Gas-per-payout figures come from data/measurements.json,
 * produced by scripts/sweep.mjs against a Base mainnet fork.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { encodePayouts } from '../src/encode.mjs';

const RPC = process.env.BASE_RPC ?? 'https://mainnet.base.org';
const ORACLE = '0x420000000000000000000000000000000000000F';
const PAYOUTS_PER_DAY = Number(process.env.PAYOUTS_PER_DAY ?? 40_000);
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 200);

async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const callOracle = async (sel, argsHex = '') =>
  BigInt(await rpc('eth_call', [{ to: ORACLE, data: sel + argsHex }, 'latest']));

// ---- live chain state -------------------------------------------------------
const block = await rpc('eth_getBlockByNumber', ['latest', false]);
const baseFee = BigInt(block.baseFeePerGas);
const suggestedTip = BigInt(await rpc('eth_maxPriorityFeePerGas', []));
const ethUsd = Number((await (await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot')).json()).data.amount);

/** Ask the on-chain oracle what the L1 fee would be for a tx of this shape. */
async function l1FeeFor(calldataHex) {
  // getL1Fee(bytes). The oracle wants the unsigned tx; we approximate the
  // envelope (nonce, gas fields, to, signature) with 120 bytes of prefix.
  const payload = '00'.repeat(120) + calldataHex.slice(2);
  const bytesLen = payload.length / 2;
  const padded = payload + '0'.repeat((64 - (payload.length % 64)) % 64);
  const arg = (32n).toString(16).padStart(64, '0')
    + BigInt(bytesLen).toString(16).padStart(64, '0') + padded;
  return callOracle('0x49948e0e', arg);
}

const singleTransferCalldata = '0xa9059cbb' + '00'.repeat(12) + '11'.repeat(20) + (1000n).toString(16).padStart(64, '0');
const l1FeeSingle = await l1FeeFor(singleTransferCalldata);

const batchBlob = encodePayouts(Array.from({ length: BATCH_SIZE }, (_, i) => ({
  to: '0x' + (0x1111000000000000000000000000000000000000n + BigInt(i) * 7919n).toString(16).slice(-40).padStart(40, '0'),
  amount: 1_000_000n + BigInt(i),
})));
const l1FeeBatch = await l1FeeFor('0x' + '23b872dd' + batchBlob.slice(2));

// ---- measured gas -----------------------------------------------------------
const m = JSON.parse(readFileSync(new URL('../data/measurements.json', import.meta.url)));
const row = m.sweep.rows.find((r) => r.batchSize === BATCH_SIZE);
if (!row) throw new Error(`no measurement for batch size ${BATCH_SIZE}`);

const cold = m.sweep.baseline.standaloneTransferCold;
const warm = m.sweep.baseline.standaloneTransferWarm;

/**
 * What fraction of payouts go to a recipient who has never held the token?
 *
 * That recipient costs an extra 17,100 gas for the zero->nonzero balance write,
 * and it is the single largest driver of the result -- the cold write is
 * irreducible, so batching cannot remove it.
 *
 * This is a STATED ASSUMPTION, not a measurement. An earlier version inferred it
 * from where the network-wide median transfer gas fell between the two measured
 * extremes, but that estimate swung between 0.01 and 0.23 across samples taken
 * minutes apart -- it reflects whatever the rest of Base was doing, not our
 * payout mix, and it moved the headline saving by five percentage points. A
 * fixed, declared default is more honest than a number that looks measured and
 * is not.
 *
 * Replace it with your own figure from payout history:
 *   COLD_FRACTION=0.4 node scripts/cost-model.mjs
 *
 * `bounds` in the output gives the all-cold and all-warm extremes, which ARE
 * measured, so the true answer is guaranteed to sit between them.
 */
const DEFAULT_COLD_FRACTION = 0.25;
const coldFraction = process.env.COLD_FRACTION !== undefined
  ? Number(process.env.COLD_FRACTION)
  : DEFAULT_COLD_FRACTION;
if (!(coldFraction >= 0 && coldFraction <= 1)) throw new Error('COLD_FRACTION must be within [0,1]');

const blend = (c, w) => w + coldFraction * (c - w);
const singleGas = blend(cold, warm);
const batchedPullGas = blend(row.coldPullPerPayout, row.warmPullPerPayout);
const batchedFloatGas = blend(row.coldFloatPerPayout, row.warmFloatPerPayout);

const usd = (wei) => (Number(wei) / 1e18) * ethUsd;
const scenario = (label, gasPerPayout, tip, l1FeePerTx, payoutsPerTx) => {
  const gasPrice = baseFee + tip;
  const l2 = BigInt(Math.round(gasPerPayout)) * gasPrice;
  const l1 = l1FeePerTx / BigInt(payoutsPerTx);
  const perPayout = usd(l2 + l1);
  return {
    label, gasPerPayout: Math.round(gasPerPayout), tipWei: Number(tip), payoutsPerTx,
    usdPerPayout: perPayout,
    l1SharePct: 100 * Number(l1) / Number(l2 + l1),
    perDayUsd: perPayout * PAYOUTS_PER_DAY,
    perMonthUsd: perPayout * PAYOUTS_PER_DAY * 30,
    perYearUsd: perPayout * PAYOUTS_PER_DAY * 365,
  };
};

const OPENING_TIP = 1_000n;
const today = scenario('today: one tx per payout, suggested tip', singleGas, suggestedTip, l1FeeSingle, 1);
const tipOnly = scenario('A. tip tuning only', singleGas, OPENING_TIP, l1FeeSingle, 1);
const batchOnly = scenario(`B. batching only (${BATCH_SIZE}/tx, pull custody)`, batchedPullGas, suggestedTip, l1FeeBatch, BATCH_SIZE);
const both = scenario('C. batching + tip tuning (recommended)', batchedPullGas, OPENING_TIP, l1FeeBatch, BATCH_SIZE);
const bothFloat = scenario('D. C, but with float custody in the contract', batchedFloatGas, OPENING_TIP, l1FeeBatch, BATCH_SIZE);

const saving = (s) => ({
  ...s,
  savingVsTodayPct: 100 * (1 - s.usdPerPayout / today.usdPerPayout),
  savingPerYearUsd: (today.usdPerPayout - s.usdPerPayout) * PAYOUTS_PER_DAY * 365,
});

/**
 * Today's absolute spend is small because two things happen to be cheap at once:
 * Base's L2 base fee is pinned at its 5,000,000 wei floor (blocks are ~14% full)
 * and post-blob L1 data availability is nearly free. Neither is guaranteed. The
 * value of batching is largely that it caps the downside if either moves --
 * under congestion the saving is the same percentage of a much bigger number.
 */
const sensitivity = [];
for (const baseFeeMult of [1n, 10n, 100n]) {
  for (const ethMult of [1, 4]) {
    const bf = baseFee * baseFeeMult;
    const price = ethUsd * ethMult;
    const cost = (gasPerPayout, tip, l1PerTx, perTx) =>
      ((Number(BigInt(Math.round(gasPerPayout)) * (bf + tip) + l1PerTx / BigInt(perTx)) / 1e18) * price)
      * PAYOUTS_PER_DAY * 365;
    const nowY = cost(singleGas, suggestedTip, l1FeeSingle, 1);
    const thenY = cost(batchedPullGas, OPENING_TIP, l1FeeBatch, BATCH_SIZE);
    sensitivity.push({
      scenario: `base fee x${baseFeeMult}, ETH x${ethMult}`,
      baseFeeGwei: Number(bf) / 1e9, ethUsd: price,
      todayPerYearUsd: nowY, recommendedPerYearUsd: thenY, savingPerYearUsd: nowY - thenY,
    });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  inputs: {
    rpc: RPC, block: Number(BigInt(block.number)), ethUsd,
    baseFeeWei: Number(baseFee), suggestedTipWei: Number(suggestedTip),
    payoutsPerDay: PAYOUTS_PER_DAY, batchSize: BATCH_SIZE,
    l1FeeSingleTxWei: Number(l1FeeSingle), l1FeeBatchTxWei: Number(l1FeeBatch),
    measuredGas: {
      standaloneCold: cold, standaloneWarm: warm,
      observedNetworkMedian: m.network.gasUsed.p50,
      coldFraction: +coldFraction.toFixed(3),
      coldFractionSource: process.env.COLD_FRACTION !== undefined ? 'COLD_FRACTION env' : 'stated default assumption',
      blendedStandalone: Math.round(singleGas),
      batchedPullCold: row.coldPullPerPayout, batchedPullWarm: row.warmPullPerPayout,
      blendedBatchedPull: Math.round(batchedPullGas),
      blendedBatchedFloat: Math.round(batchedFloatGas),
    },
  },
  scenarios: [today, tipOnly, batchOnly, both, bothFloat].map(saving),
  // Measured extremes. Whatever the real recipient mix, the answer is in here.
  bounds: [
    { case: 'every payout to a first-time recipient (all cold)', coldFraction: 1 },
    { case: 'every payout to a repeat recipient (all warm)', coldFraction: 0 },
  ].map(({ case: label, coldFraction: cf }) => {
    const b = (c, w) => w + cf * (c - w);
    const t = scenario('today', b(cold, warm), suggestedTip, l1FeeSingle, 1);
    const r = scenario('recommended', b(row.coldPullPerPayout, row.warmPullPerPayout), OPENING_TIP, l1FeeBatch, BATCH_SIZE);
    return { case: label, todayPerYearUsd: t.perYearUsd, recommendedPerYearUsd: r.perYearUsd,
      savingPerYearUsd: t.perYearUsd - r.perYearUsd, savingPct: 100 * (1 - r.usdPerPayout / t.usdPerPayout) };
  }),
  sensitivity,
};
writeFileSync(new URL('../data/cost-model.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
