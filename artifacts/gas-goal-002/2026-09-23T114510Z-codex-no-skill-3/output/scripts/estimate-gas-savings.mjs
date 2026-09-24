#!/usr/bin/env node
import {
  annualize,
  dailyTransferCost,
  formatEth,
  formatUsd,
  gasSavings,
  tipSavings,
} from "../src/gasMath.mjs";

function readArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

function numberArg(args, name, fallback) {
  const raw = args[name] ?? process.env[name.toUpperCase().replaceAll("-", "_")];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid --${name}: ${raw}`);
  return parsed;
}

function row(name, dayUsd, yearUsd, detail) {
  return `| ${name} | ${formatUsd(dayUsd)} | ${formatUsd(yearUsd, 0)} | ${detail} |`;
}

const args = readArgs(process.argv);

const transfersPerDay = numberArg(args, "transfers-per-day", 40_000);
const directGas = numberArg(args, "direct-gas", 65_000);
const gasPriceGwei = numberArg(args, "gas-price-gwei", 0.006);
const ethUsd = numberArg(args, "eth-usd", 2718.95);
const targetPriorityGwei = numberArg(args, "target-priority-gwei", 0.001);
const currentPriorityGwei = numberArg(args, "current-priority-gwei", 0.001);
const batchGasSaved = numberArg(args, "batch-gas-saved", 12_000);
const duplicateRate = numberArg(args, "duplicate-rate", 0.025);
const nettableRate = numberArg(args, "nettable-rate", 0.25);

const baseline = dailyTransferCost({
  transfersPerDay,
  gasUsedPerTransfer: directGas,
  gasPriceGwei,
  ethUsd,
});
const baselineAnnual = annualize(baseline);

const batch = gasSavings({
  transfersPerDay,
  gasSavedPerTransfer: batchGasSaved,
  gasPriceGwei,
  ethUsd,
});
const dedupe = gasSavings({
  transfersPerDay,
  gasSavedPerTransfer: 0,
  savedTransfersPerDay: Math.round(transfersPerDay * duplicateRate),
  baselineGasUsedPerTransfer: directGas,
  gasPriceGwei,
  ethUsd,
});
const netting = gasSavings({
  transfersPerDay,
  gasSavedPerTransfer: 0,
  savedTransfersPerDay: Math.round(transfersPerDay * nettableRate),
  baselineGasUsedPerTransfer: directGas,
  gasPriceGwei,
  ethUsd,
});
const tips = tipSavings({
  transfersPerDay,
  gasUsedPerTransfer: directGas,
  currentPriorityGwei,
  targetPriorityGwei,
  ethUsd,
});

const scenarios = [
  ["Right-size priority fee", tips],
  ["Product-level netting", netting],
  ["Batch relayer contract", batch],
  ["Coalesce duplicate payouts", dedupe],
].sort((a, b) => b[1].usd - a[1].usd);

console.log(`# Base ERC-20 Gas Estimate

Inputs:
- transfers/day: ${transfersPerDay.toLocaleString("en-US")}
- direct gas/transfer: ${directGas.toLocaleString("en-US")}
- execution gas price: ${gasPriceGwei} gwei
- ETH/USD: ${formatUsd(ethUsd)}

Baseline execution spend: ${formatEth(baseline.totalWei)} ETH/day (${formatUsd(
  baseline.usd,
)}/day), ${baselineAnnual.eth.toFixed(4)} ETH/year (${formatUsd(baselineAnnual.usd, 0)}/year).

| Change | Saves/day | Saves/year | Model |
| --- | ---: | ---: | --- |
${scenarios
  .map(([name, value]) => {
    if (name === "Right-size priority fee") {
      return row(
        name,
        value.usd,
        value.usd * 365,
        `${currentPriorityGwei} gwei priority -> ${targetPriorityGwei} gwei priority`,
      );
    }
    if (name === "Product-level netting") {
      return row(name, value.usd, value.usd * 365, `${(nettableRate * 100).toFixed(1)}% fewer transfers`);
    }
    if (name === "Batch relayer contract") {
      return row(
        name,
        value.usd,
        value.usd * 365,
        `${batchGasSaved.toLocaleString("en-US")} gas saved/transfer`,
      );
    }
    return row(name, value.usd, value.usd * 365, `${(duplicateRate * 100).toFixed(1)}% fewer transfers`);
  })
  .join("\n")}
`);
