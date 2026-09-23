import { estimateBatchTxGas, estimateIndividualTxGas, GAS_CONSTANTS, calldataGas } from "../relayer/gas-model.ts";
import { encodeBatchTransfer } from "../relayer/encoder.ts";

const GWEI = 1_000_000_000n;
const ETH_USD_DEFAULT = 2720;
const LEAN_TIP_GWEI = 0.001;
const LEAN_BASE_GWEI = 0.005;

interface Flags {
  txsPerDay: number;
  ethUsd: number;
  freshRatio: number;
  windowSec: number;
  todayTipGwei: number;
  baseGwei: number;
  dupRate: number;
  l1WeiPerTx: bigint;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    txsPerDay: 40_000,
    ethUsd: ETH_USD_DEFAULT,
    freshRatio: 0.5,
    windowSec: 30,
    todayTipGwei: 0.035,
    baseGwei: LEAN_BASE_GWEI,
    dupRate: 0,
    l1WeiPerTx: GAS_CONSTANTS.l1FeeIndividualWei,
  };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    const num = Number(value);
    switch (key) {
      case "txs-per-day": flags.txsPerDay = num; break;
      case "eth-usd": flags.ethUsd = num; break;
      case "fresh-ratio": flags.freshRatio = num; break;
      case "window-sec": flags.windowSec = num; break;
      case "today-tip-gwei": flags.todayTipGwei = num; break;
      case "base-gwei": flags.baseGwei = num; break;
      case "dup-rate": flags.dupRate = num; break;
      default: throw new Error(`unknown flag --${key}`);
    }
  }
  return flags;
}

function usdFromWei(wei: bigint, ethUsd: number): string {
  const usd = Number(wei) / 1e18 * ethUsd;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.001) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}

function perPeriod(usdPerTx: number, txsPerDay: number): string {
  const daily = usdPerTx * txsPerDay;
  const monthly = daily * 30.4;
  const yearly = daily * 365;
  const fmt = (v: number) => (v >= 1000 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);
  return `${fmt(daily).padStart(10)}/day ${fmt(monthly).padStart(9)}/mo ${fmt(yearly).padStart(10)}/yr`;
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const tps = flags.txsPerDay / 86_400;
  const entriesAfterNetting = flags.txsPerDay * (1 - flags.dupRate);
  const batchN = Math.max(2, Math.round(tps * flags.windowSec));
  const leanPriceWei = BigInt(Math.round((flags.baseGwei + LEAN_TIP_GWEI) * 1e9));
  const todayPriceWei = BigInt(Math.round((flags.baseGwei + flags.todayTipGwei) * 1e9));

  console.log("=".repeat(78));
  console.log("BASE RELAYER GAS COST MODEL");
  console.log(`txs/day ${flags.txsPerDay} | avg ${tps.toFixed(3)}/s | ETH $${flags.ethUsd} | fresh recipients ${(flags.freshRatio * 100).toFixed(0)}%`);
  console.log(`live inputs: Base base fee ${flags.baseGwei} gwei, USDC transfer gas 40,259 (existing) / 62,183 (fresh)`);
  console.log("=".repeat(78));

  const indGas = Number(estimateIndividualTxGas(flags.freshRatio));
  const indL2Wei = BigInt(indGas) * leanPriceWei;
  console.log("\n1) WHAT YOU SPEND TODAY - one tx per transfer, sensitivity to tip");
  console.log(`${"tip (gwei)".padEnd(14)}${"eff gwei".padEnd(12)}${"$/transfer".padEnd(14)}${"/day /month /year"}`);
  for (const tip of [0.001, 0.01, 0.035, 0.1, 0.25, 3.6]) {
    const eff = flags.baseGwei + tip;
    const priceWei = BigInt(Math.round(eff * 1e9));
    const l2 = Number(BigInt(indGas) * priceWei) / 1e18 * flags.ethUsd;
    const l1 = Number(GAS_CONSTANTS.l1FeeIndividualWei) / 1e18 * flags.ethUsd;
    const usdPerTx = l2 + l1;
    console.log(
      tip.toFixed(3).padEnd(14) +
        `${eff.toFixed(3)}`.padEnd(12) +
        `$${usdPerTx.toFixed(6)}`.padEnd(14) +
        perPeriod(usdPerTx, flags.txsPerDay),
    );
  }

  const todayLeanPerTx = (Number(BigInt(indGas) * leanPriceWei) + Number(GAS_CONSTANTS.l1FeeIndividualWei)) / 1e18 * flags.ethUsd;
  const todayFatPerTx = (Number(BigInt(indGas) * todayPriceWei) + Number(GAS_CONSTANTS.l1FeeIndividualWei)) / 1e18 * flags.ethUsd;

  console.log("\n2) AFTER BATCHING (lean fees) - per-entry cost by batch size");
  console.log(`${"batch N".padEnd(10)}${"window".padEnd(10)}${"gas/entry".padEnd(12)}${"$/entry".padEnd(14)}${"gas saved".padEnd(10)}${"/day /month /year"}`);
  for (const n of [5, 10, 25, 50, 100, 200]) {
    const total = Number(estimateBatchTxGas(n, flags.freshRatio));
    const perEntryGas = total / n;
    const l1PerEntry = Number(GAS_CONSTANTS.l1FeePerBatchEntryWei * BigInt(n)) / n;
    const usdPerEntry = (perEntryGas * Number(leanPriceWei) + l1PerEntry) / 1e18 * flags.ethUsd;
    const saving = 1 - perEntryGas / indGas;
    console.log(
      String(n).padEnd(10) +
        `${Math.round(n / tps)}s`.padEnd(10) +
        Math.round(perEntryGas).toLocaleString().padEnd(12) +
        `$${usdPerEntry.toFixed(6)}`.padEnd(14) +
        `${(saving * 100).toFixed(0)}%`.padEnd(10) +
        perPeriod(usdPerEntry, entriesAfterNetting),
    );
  }

  const batchTotal = Number(estimateBatchTxGas(batchN, flags.freshRatio));
  const batchPerEntryGas = batchTotal / batchN;
  const batchUsdPerEntry =
    (batchPerEntryGas * Number(leanPriceWei) + Number(GAS_CONSTANTS.l1FeePerBatchEntryWei)) / 1e18 * flags.ethUsd;

  console.log("\n3) RANKED CHANGES (your config: window " + flags.windowSec + "s, tip " + flags.todayTipGwei + " gwei)");
  const rows: [string, number, number][] = [
    ["A. Clamp tip to 0.001 gwei", todayFatPerTx - todayLeanPerTx, flags.txsPerDay],
    ["B. Batch via dispatcher (" + batchN + " entries)", todayLeanPerTx - batchUsdPerEntry, entriesAfterNetting],
  ];
  if (flags.dupRate > 0) {
    rows.push([
      `C. Net duplicates (${(flags.dupRate * 100).toFixed(0)}% of volume)`,
      todayLeanPerTx * flags.dupRate,
      flags.txsPerDay,
    ]);
  }
  rows.sort((a, b) => b[1] * b[2] - a[1] * a[2]);
  for (const [label, perTx, count] of rows) {
    console.log(`${label.padEnd(48)}${perPeriod(perTx, count)}`);
  }
  const combinedPerTx = (todayFatPerTx - batchUsdPerEntry) * (1 - 0) ;
  console.log(`${"=> A + B combined".padEnd(48)}${perPeriod(combinedPerTx, entriesAfterNetting)}`);
  console.log(
    `${"   total spend after A+B".padEnd(48)}${perPeriod(batchUsdPerEntry, entriesAfterNetting)}`,
  );

  console.log("\n4) RPC CALLS (estimate+send+2x receipt poll)");
  const todayCalls = flags.txsPerDay * 4;
  const batchTxsPerDay = entriesAfterNetting / batchN;
  const batchedCalls = batchTxsPerDay * 6;
  console.log(`today: ~${todayCalls.toLocaleString()}/day -> batched: ~${Math.round(batchedCalls).toLocaleString()}/day (${(100 - batchedCalls / todayCalls * 100).toFixed(1)}% fewer)`);

  console.log("\n5) SANITY: model internals");
  const sample = encodeBatchTransfer(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    Array.from({ length: batchN }, (_, i) => `0x${(0x1000 + i).toString(16).padStart(40, "0")}`),
    Array.from({ length: batchN }, () => 1_000_000n),
  );
  console.log(`batch calldata for N=${batchN}: ${(sample.length - 2) / 2} bytes, calldata gas ${calldataGas(sample).toString()}`);
  console.log(`batch tx total gas N=${batchN}: ${estimateBatchTxGas(batchN, flags.freshRatio).toLocaleString()} (avg ${Math.round(batchPerEntryGas).toLocaleString()}/entry)`);
  console.log(`individual tx gas (blended): ${indGas.toLocaleString()}`);
}

main();
