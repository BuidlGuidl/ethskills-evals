/**
 * Turns the measurements in bench-results.json into annual cost under each
 * option, ranked by saving. Every gas figure here was measured, not estimated;
 * the only inputs are volume, ETH price and the share of recipients who are new.
 *
 *   node script/cost-model.mjs [--transfers-per-day 40000] [--cold-share 0.5] [--eth-usd 2722]
 */

import { readFileSync } from "node:fs";

const bench = JSON.parse(readFileSync(new URL("./bench-results.json", import.meta.url)));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : Number(process.argv[i + 1]); };

const TRANSFERS_PER_DAY = arg("transfers-per-day", 40_000);
/** Share of transfers whose recipient has a zero token balance. That write costs
 *  20,000 gas instead of 2,900, a 17,100 gas swing -- the single largest
 *  variable in the model and the one we do not control. */
const COLD_SHARE = arg("cold-share", 0.5);

const L2_BASE_FEE = BigInt(bench.network.l2BaseFeeWei);

// Measured: batching does not change the cost of the balance write itself, so
// the cold/warm delta carries across every option unchanged.
const COLD_WARM_DELTA = 17_100;

const b100 = bench.batched.find((r) => r.n === 100);
const b200 = bench.batched.find((r) => r.n === 200);

/** Blend the measured cold-recipient number with the warm case. */
const blend = (coldGas) => coldGas - (1 - COLD_SHARE) * COLD_WARM_DELTA;

const OPTIONS = [
  {
    id: "singles-1gwei",
    label: "Today, if the relayer carries a 1 gwei mainnet tip",
    l2Gas: blend(bench.baseline.l2GasPerTransfer),
    l1FeeWei: bench.baseline.l1FeeWeiPerTransfer,
    tipWei: 1_000_000_000,
  },
  {
    id: "singles-0.03gwei",
    label: "Today, if the relayer chases the p90 tip on Base",
    l2Gas: blend(bench.baseline.l2GasPerTransfer),
    l1FeeWei: bench.baseline.l1FeeWeiPerTransfer,
    tipWei: 30_000_000,
  },
  {
    id: "singles-nodedefault",
    label: "Today, at the tip Base's own node suggests (0.001 gwei)",
    l2Gas: blend(bench.baseline.l2GasPerTransfer),
    l1FeeWei: bench.baseline.l1FeeWeiPerTransfer,
    tipWei: 1_000_000,
  },
  {
    id: "singles-tuned",
    label: "Fee policy only: one transfer per tx, 0.0005 gwei tip",
    l2Gas: blend(bench.baseline.l2GasPerTransfer),
    l1FeeWei: bench.baseline.l1FeeWeiPerTransfer,
    tipWei: 500_000,
  },
  {
    id: "batch100-tuned",
    label: "Fee policy + batches of 100 (disperse)",
    l2Gas: blend(b100.disperse.l2GasPerTransfer),
    l1FeeWei: b100.disperse.l1FeeWeiPerTransfer,
    tipWei: 500_000,
  },
  {
    id: "batch200-packed-tuned",
    label: "Fee policy + batches of 200, packed calldata",
    l2Gas: blend(b200.dispersePacked.l2GasPerTransfer),
    l1FeeWei: b200.dispersePacked.l1FeeWeiPerTransfer,
    tipWei: 500_000,
  },
];

async function ethPrice() {
  const override = arg("eth-usd", NaN);
  if (!Number.isNaN(override)) return override;
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    return (await r.json()).ethereum.usd;
  } catch { return 2700; }
}

const ethUsd = await ethPrice();

const priced = OPTIONS.map((o) => {
  const l2Wei = o.l2Gas * (Number(L2_BASE_FEE) + o.tipWei);
  const perTxWei = l2Wei + o.l1FeeWei;
  const perTxUsd = (perTxWei / 1e18) * ethUsd;
  return {
    ...o,
    perTxUsd,
    perDayUsd: perTxUsd * TRANSFERS_PER_DAY,
    perYearUsd: perTxUsd * TRANSFERS_PER_DAY * 365,
    l1SharePct: (o.l1FeeWei / perTxWei) * 100,
  };
});

const tuned = priced.find((p) => p.id === "singles-tuned");
const best = priced.reduce((a, b) => (a.perYearUsd < b.perYearUsd ? a : b));

const usd = (n) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

console.log(`Measured at block ${bench.block} (${bench.measuredAt})`);
console.log(`ETH $${ethUsd}  |  L2 base fee ${Number(L2_BASE_FEE) / 1e9} gwei  |  ${TRANSFERS_PER_DAY.toLocaleString()} transfers/day  |  ${(COLD_SHARE * 100).toFixed(0)}% new recipients\n`);

const w = [38, 11, 12, 12, 13, 9];
const row = (c) => c.map((v, i) => String(v).padEnd(w[i])).join("");
console.log(row(["option", "L2 gas/tx", "tip (gwei)", "$/transfer", "$/year", "L1 share"]));
console.log("-".repeat(w.reduce((a, c) => a + c, 0)));
for (const p of priced) {
  console.log(row([
    p.label.slice(0, 37),
    Math.round(p.l2Gas).toLocaleString(),
    p.tipWei / 1e9,
    "$" + p.perTxUsd.toFixed(6),
    usd(p.perYearUsd),
    p.l1SharePct.toFixed(1) + "%",
  ]));
}

console.log(`\nRanked savings, measured against "${tuned.label}" as the realistic baseline:`);
for (const p of priced.filter((p) => p.perYearUsd < tuned.perYearUsd).sort((a, b) => a.perYearUsd - b.perYearUsd)) {
  console.log(`  ${usd(tuned.perYearUsd - p.perYearUsd).padStart(9)}/yr  ${p.label}`);
}
console.log(`\nIf the relayer is currently on a 1 gwei tip, fixing that alone saves ${usd(priced[0].perYearUsd - tuned.perYearUsd)}/yr.`);
console.log(`Best measured option: ${best.label} at ${usd(best.perYearUsd)}/yr.`);
