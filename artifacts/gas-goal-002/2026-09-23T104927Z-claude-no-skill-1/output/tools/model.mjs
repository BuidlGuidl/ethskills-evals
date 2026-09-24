#!/usr/bin/env node
/**
 * Gas cost model for the Base payments relayer.
 *
 * Every input comes from tools/measured.json, which was produced by real
 * measurement (mainnet receipts + a forked-USDC gas benchmark), not estimation.
 *
 * Usage:
 *   node tools/model.mjs
 *   node tools/model.mjs --new-payee-share 0.56 --tip-wei 0 --batch 250
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const M = JSON.parse(readFileSync(join(here, 'measured.json'), 'utf8'))

/* ------------------------------------------------------------------ args */

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? dflt : Number(process.argv[i + 1])
}

const cfg = {
  perDay: arg('per-day', M.workload.transfersPerDay),
  newPayeeShare: arg('new-payee-share', 0.36),
  batchSize: arg('batch', 100),
  baseFeeWei: arg('base-fee-wei', M.feeMarket.l2BaseFeeWei),
  currentTipWei: arg('current-tip-wei', M.feeMarket.observedMeanEffectiveGasPriceWei - M.feeMarket.l2BaseFeeWei),
  proposedTipWei: arg('tip-wei', M.feeMarket.nodeSuggestedGasPriceWei - M.feeMarket.l2BaseFeeWei),
  ethUsd: arg('eth-usd', M.prices.ethUsd),
}

/* ------------------------------------------------------------ gas lookup */

const lerpShare = (table, share) => {
  // measured at 0% / 36% / 100% new payees; interpolate between bracketing points
  const pts = Object.keys(table)
    .map(k => [Number(k.replace('newPayeeShare', '')) / 100, table[k]])
    .sort((a, b) => a[0] - b[0])
  for (let i = 0; i < pts.length - 1; i++) {
    const [s0, t0] = pts[i], [s1, t1] = pts[i + 1]
    if (share >= s0 && share <= s1) return { s0, t0, s1, t1, w: (share - s0) / (s1 - s0) }
  }
  const last = pts[pts.length - 1]
  return { s0: last[0], t0: last[1], s1: last[0], t1: last[1], w: 0 }
}

function batchGas(mode, n, share) {
  const table = M.gasPerPayment[mode]
  const { t0, t1, w } = lerpShare(table, share)
  const key = `n${n}`
  const g0 = t0[key], g1 = t1[key]
  if (g0 === undefined) throw new Error(`no measurement for ${mode} at n=${n}`)
  return g1 === undefined ? g0 : g0 + (g1 - g0) * w
}

const individualGas = share =>
  M.gasPerPayment.individual.existingPayee * (1 - share) +
  M.gasPerPayment.individual.newPayee * share

const nearestL1 = (table, n) => {
  const keys = Object.keys(table).map(k => Number(k.slice(1))).sort((a, b) => a - b)
  const pick = keys.reduce((best, k) => (Math.abs(k - n) < Math.abs(best - n) ? k : best), keys[0])
  return table[`n${pick}`]
}

/* -------------------------------------------------------------- scenarios */

const WEI_PER_ETH = 1e18
function cost({ gas, l1Wei, tipWei }) {
  const gasPrice = cfg.baseFeeWei + tipWei
  const weiPerPayment = gas * gasPrice + l1Wei
  const ethPerYear = (weiPerPayment * cfg.perDay * 365) / WEI_PER_ETH
  return {
    weiPerPayment,
    usdPerPayment: (weiPerPayment / WEI_PER_ETH) * cfg.ethUsd,
    usdPerYear: ethPerYear * cfg.ethUsd,
    ethPerYear,
    gas,
    gasPrice,
    l1Wei,
  }
}

const share = cfg.newPayeeShare
const n = cfg.batchSize
const L1_IND = M.l1DataFeeWeiPerPayment.individual
const L1_PACKED = nearestL1(M.l1DataFeeWeiPerPayment.batchedPacked, n)
const L1_ARRAYS = nearestL1(M.l1DataFeeWeiPerPayment.batchedArrays, n)

const scenarios = {
  S0_today: cost({ gas: individualGas(share), l1Wei: L1_IND, tipWei: cfg.currentTipWei }),
  S1_feePolicyOnly: cost({ gas: individualGas(share), l1Wei: L1_IND, tipWei: cfg.proposedTipWei }),
  S2_batchOnly: cost({ gas: batchGas('batchedFloatPacked', n, share), l1Wei: L1_PACKED, tipWei: cfg.currentTipWei }),
  S3_both: cost({ gas: batchGas('batchedFloatPacked', n, share), l1Wei: L1_PACKED, tipWei: cfg.proposedTipWei }),
  S3b_both_relayerCustody: cost({ gas: batchGas('batchedRelayerPacked', n, share), l1Wei: L1_PACKED, tipWei: cfg.proposedTipWei }),
  // The packed-vs-arrays difference is pure calldata, so it is independent of payee
  // state. Measured once at n=100 / 36% new, then applied as a delta at any share.
  S4_both_abiArrays: cost({
    gas: batchGas('batchedFloatPacked', n, share)
      + (M.gasPerPayment.batchedFloatArrays.newPayeeShare36.n100
         - M.gasPerPayment.batchedFloatPacked.newPayeeShare36.n100),
    l1Wei: L1_ARRAYS,
    tipWei: cfg.proposedTipWei,
  }),
}

/* ---------------------------------------------------------------- output */

const usd = x => '$' + x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = x => (x * 100).toFixed(1) + '%'
const base = scenarios.S0_today

console.log(`\nBase payments relayer — gas cost model`)
console.log(`  volume            ${cfg.perDay.toLocaleString()} transfers/day (${(cfg.perDay * 365).toLocaleString()}/yr)`)
console.log(`  new-payee share   ${pct(share)}   batch size ${n}   ETH $${cfg.ethUsd}`)
console.log(`  L2 base fee       ${cfg.baseFeeWei / 1e6} mwei`)
console.log(`  tip: today ${(cfg.currentTipWei / 1e6).toFixed(2)} mwei  ->  proposed ${(cfg.proposedTipWei / 1e6).toFixed(2)} mwei\n`)

const rows = [
  ['S0  today: 1 tx/payment, current tip', scenarios.S0_today],
  ['S1  fee policy only (no contract)', scenarios.S1_feePolicyOnly],
  ['S2  batching only (current tip)', scenarios.S2_batchOnly],
  ['S3  batching + fee policy', scenarios.S3_both],
  ['S3b  ...with relayer custody (transferFrom)', scenarios.S3b_both_relayerCustody],
  ['S4  ...with plain ABI arrays (unpacked)', scenarios.S4_both_abiArrays],
]

console.log('scenario'.padEnd(44), 'gas/pmt'.padStart(9), 'USD/pmt'.padStart(10), 'USD/year'.padStart(13), 'saved/yr'.padStart(13), 'saved'.padStart(7))
console.log('-'.repeat(101))
for (const [label, s] of rows) {
  const saved = base.usdPerYear - s.usdPerYear
  console.log(
    label.padEnd(44),
    Math.round(s.gas).toLocaleString().padStart(9),
    s.usdPerPayment.toFixed(6).padStart(10),
    usd(s.usdPerYear).padStart(13),
    (saved === 0 ? '-' : usd(saved)).padStart(13),
    (saved === 0 ? '-' : pct(saved / base.usdPerYear)).padStart(7),
  )
}

console.log(`\nL1 data fee share of total cost:`)
for (const [label, s] of rows.slice(0, 1).concat([rows[3]])) {
  console.log(`  ${label.padEnd(44)} ${pct(s.l1Wei / s.weiPerPayment)}`)
}

console.log(`\nIncremental ranking (each change applied on top of the previous):`)
const steps = [
  ['1. Fee policy (config only)', base.usdPerYear - scenarios.S1_feePolicyOnly.usdPerYear],
  ['2. Batching at n=' + n, scenarios.S1_feePolicyOnly.usdPerYear - scenarios.S3_both.usdPerYear],
  ['3. Packed calldata vs ABI arrays', scenarios.S4_both_abiArrays.usdPerYear - scenarios.S3_both.usdPerYear],
]
for (const [label, v] of steps) {
  console.log(`  ${label.padEnd(44)} ${usd(v).padStart(12)}/yr  (${pct(v / base.usdPerYear)} of today's spend)`)
}
console.log(`\n  ${'TOTAL'.padEnd(44)} ${usd(base.usdPerYear - scenarios.S3_both.usdPerYear).padStart(12)}/yr  (${pct(1 - scenarios.S3_both.usdPerYear / base.usdPerYear)})`)

console.log(`\nSensitivity — annual spend after S3 vs new-payee share:`)
for (const s of [0, 0.25, 0.5, 0.75, 1]) {
  const g = batchGas('batchedFloatPacked', n === 250 ? 100 : n, s)
  const c = cost({ gas: g, l1Wei: L1_PACKED, tipWei: cfg.proposedTipWei })
  const b = cost({ gas: individualGas(s), l1Wei: L1_IND, tipWei: cfg.currentTipWei })
  console.log(`  ${pct(s).padStart(6)} new payees:  today ${usd(b.usdPerYear).padStart(12)}  ->  after ${usd(c.usdPerYear).padStart(11)}  (${pct(1 - c.usdPerYear / b.usdPerYear)} saved)`)
}
console.log()
