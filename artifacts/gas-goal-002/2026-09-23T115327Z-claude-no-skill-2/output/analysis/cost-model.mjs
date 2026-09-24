/**
 * What we spend on gas, and what each change saves.
 *
 * Reads the measured gas numbers from bench/out/results.json and prices them with live
 * Base parameters, so the report re-prices itself as the base fee and ETH move. Every
 * gas figure here is measured, not estimated; the assumptions are only about volume,
 * recipient mix, and price.
 *
 *   node analysis/cost-model.mjs [--volume 40000] [--new-recipient-share 0.30]
 */
import { readFileSync } from "node:fs";
import { rpc, hexToNum } from "./rpc.mjs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(process.argv[i + 1]);
};

const VOLUME = arg("volume", 40_000);
// Share of payouts going to an address that does not yet hold the token. Such a payout
// writes a zero storage slot (20,000 gas) instead of rewriting a non-zero one (2,900).
// Default is inferred from the bimodal split in analysis/onchain-baseline.mjs.
const NEW_SHARE = arg("new-recipient-share", 0.30);
const BATCH_SIZE = arg("batch-size", 250);

const results = JSON.parse(readFileSync(new URL("../bench/out/results.json", import.meta.url)));

// ---- live prices -----------------------------------------------------------------
const block = await rpc("eth_getBlockByNumber", ["latest", false]);
const baseFee = BigInt(block.baseFeePerGas);

const ethUsdRaw = await rpc("eth_call", [{
  to: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", // Chainlink ETH/USD on Base
  data: "0xfeaf968c", // latestRoundData()
}, "latest"]);
const ethUsd = Number(BigInt("0x" + ethUsdRaw.slice(2 + 64, 2 + 128))) / 1e8;

// Historical relayer tip; the current policy pays this on top of every unit of gas.
const LEGACY_TIP = 1_000_000n;

const pick = (n, packed, existing) =>
  results.batch.find((r) => r.n === n && r.packed === packed && r.existingRecipient === existing);

/** Blended gas across the new/existing recipient mix. */
const blend = (existingGas, newGas) => existingGas * (1 - NEW_SHARE) + newGas * NEW_SHARE;

/** Cost of one payout in USD, given L2 gas, L1 data fee in wei, and the tip policy. */
function usd(l2Gas, l1Wei, tip) {
  const l2Wei = Number(BigInt(Math.round(l2Gas)) * (baseFee + tip));
  return ((l2Wei + l1Wei) / 1e18) * ethUsd;
}

const baseL1 = Number(results.baseline.existingRecipient.l1Fee);
const scenarios = [];

// --- today ---
const todayGas = blend(results.baseline.existingRecipient.perTransferL2, results.baseline.newRecipient.perTransferL2);
scenarios.push({ name: "Today: one transfer per payout, 0.001 gwei tip", gas: todayGas, l1: baseL1, tip: LEGACY_TIP });

// --- tip only ---
scenarios.push({ name: "Drop the priority fee to zero (no other change)", gas: todayGas, l1: baseL1, tip: 0n });

// --- batching ---
for (const packed of [false, true]) {
  const b = blend(pick(BATCH_SIZE, packed, true).perTransferL2, pick(BATCH_SIZE, packed, false).perTransferL2);
  const l1 = blend(Number(pick(BATCH_SIZE, packed, true).l1FeePerTransferWei), Number(pick(BATCH_SIZE, packed, false).l1FeePerTransferWei));
  scenarios.push({
    name: `Batch ${BATCH_SIZE}/tx, ${packed ? "packed" : "array"} calldata, zero tip`,
    gas: b, l1, tip: 0n,
  });
}

// ---- report ----------------------------------------------------------------------
console.log(`Base fee ${(Number(baseFee) / 1e9).toFixed(6)} gwei | ETH $${ethUsd.toFixed(2)} | ${VOLUME.toLocaleString()} payouts/day`);
console.log(`Recipient mix: ${((1 - NEW_SHARE) * 100).toFixed(0)}% existing holders / ${(NEW_SHARE * 100).toFixed(0)}% new\n`);

const baselineAnnual = usd(scenarios[0].gas, scenarios[0].l1, scenarios[0].tip) * VOLUME * 365;
const rows = scenarios.map((s) => {
  const per = usd(s.gas, s.l1, s.tip);
  const annual = per * VOLUME * 365;
  return {
    scenario: s.name,
    "gas/payout": Math.round(s.gas).toLocaleString(),
    "$/payout": per.toFixed(6),
    "$/day": (per * VOLUME).toFixed(2),
    "$/year": annual.toFixed(0),
    "saving": annual === baselineAnnual ? "—" : `${(((baselineAnnual - annual) / baselineAnnual) * 100).toFixed(1)}%`,
  };
});
console.table(rows);

// ---- sensitivity: gas is cheap today, but the base fee has spiked 60x in our sample --
console.log("Annual spend if the base fee rises (batched + zero tip, vs today's per-payout method):");
const best = scenarios.at(-1);
const sens = [1, 5, 20, 60].map((mult) => {
  const bf = baseFee * BigInt(mult);
  const price = (gas, l1, tip) => ((Number(BigInt(Math.round(gas)) * (bf + tip)) + l1) / 1e18) * ethUsd * VOLUME * 365;
  return {
    "base fee": `${(Number(bf) / 1e9).toFixed(4)} gwei (${mult}x)`,
    "today $/yr": price(scenarios[0].gas, scenarios[0].l1, LEGACY_TIP).toFixed(0),
    "batched $/yr": price(best.gas, best.l1, 0n).toFixed(0),
    "avoided $/yr": (price(scenarios[0].gas, scenarios[0].l1, LEGACY_TIP) - price(best.gas, best.l1, 0n)).toFixed(0),
  };
});
console.table(sens);
