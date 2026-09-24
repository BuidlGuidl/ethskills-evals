#!/usr/bin/env node

const {
  BASE_RPC_URL,
  DEFAULT_OBSERVED_ERC20_TRANSFER_GAS,
  DEFAULT_TRANSFERS_PER_DAY,
  buildBaseRelayerFeePolicy,
  estimateFromObservedAverage,
  estimateL1FeeForTransfer,
  estimateTransferSpend,
  fetchEthUsd,
  getBaseFeeSnapshot,
  sampleRecentErc20Transfers,
  savingsForReduction,
  summarizeSamples,
  weiToGwei,
} = require("../src/baseGas");

function parseArgs(argv) {
  const args = {
    rpcUrl: process.env.BASE_RPC_URL || BASE_RPC_URL,
    transfersPerDay: DEFAULT_TRANSFERS_PER_DAY,
    sample: 25,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--rpc-url") {
      args.rpcUrl = next;
      index += 1;
    } else if (arg === "--transfers-per-day") {
      args.transfersPerDay = Number(next);
      index += 1;
    } else if (arg === "--eth-usd") {
      args.ethUsd = Number(next);
      index += 1;
    } else if (arg === "--sample") {
      args.sample = Number(next);
      index += 1;
    } else if (arg === "--no-sample") {
      args.sample = 0;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.transfersPerDay) || args.transfersPerDay < 0) {
    throw new Error("--transfers-per-day must be a non-negative number");
  }
  if (!Number.isFinite(args.sample) || args.sample < 0) {
    throw new Error("--sample must be a non-negative number");
  }

  return args;
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

function printHelp() {
  console.log(`Usage: npm run gas:report -- [options]

Options:
  --rpc-url <url>             Base RPC URL; defaults to BASE_RPC_URL or public Base RPC
  --transfers-per-day <n>     Daily relayer volume; default 40000
  --eth-usd <price>           Override ETH/USD instead of fetching CoinGecko
  --sample <n>                Sample recent ERC-20 transfer receipts; default 25
  --no-sample                 Skip receipt sampling and use live fee estimator
  --json                      Print machine-readable JSON
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const [snapshot, ethUsd, l1FeeWei] = await Promise.all([
    getBaseFeeSnapshot(args.rpcUrl),
    args.ethUsd ? Promise.resolve(args.ethUsd) : fetchEthUsd(),
    estimateL1FeeForTransfer(args.rpcUrl),
  ]);

  let samples = [];
  let sampleWarning = null;
  if (args.sample > 0) {
    try {
      samples = await sampleRecentErc20Transfers(args.rpcUrl, {
        targetSamples: args.sample,
        maxBlocks: Math.max(120, args.sample * 8),
      });
    } catch (error) {
      sampleWarning = error.message;
    }
  }

  const sampleSummary = summarizeSamples(samples);
  const estimator = estimateTransferSpend({
    transfersPerDay: args.transfersPerDay,
    executionGas: sampleSummary.average?.gasUsed ?? DEFAULT_OBSERVED_ERC20_TRANSFER_GAS,
    effectiveGasPriceWei: snapshot.gasPriceWei,
    l1FeeWei,
    ethUsd,
  });
  const observed = samples.length
    ? estimateFromObservedAverage(samples, {
        transfersPerDay: args.transfersPerDay,
        ethUsd,
      })
    : null;
  const baseline = observed || estimator;
  const feePolicy = buildBaseRelayerFeePolicy(snapshot);
  const reductions = [0.1, 0.25, 0.5].map((fraction) => savingsForReduction(baseline.monthlyUsd, fraction));

  const report = {
    generatedAt: new Date().toISOString(),
    rpcUrl: args.rpcUrl,
    ethUsd,
    transfersPerDay: args.transfersPerDay,
    latestBlock: snapshot.blockNumber,
    liveFees: {
      baseFeeGwei: weiToGwei(snapshot.baseFeeWei),
      gasPriceGwei: weiToGwei(snapshot.gasPriceWei),
      priorityFeeGwei: weiToGwei(snapshot.priorityFeeWei),
      estimatedL1FeeEth: Number(l1FeeWei) / 1e18,
    },
    samples: sampleSummary,
    sampleWarning,
    estimator,
    observed,
    baseline,
    recommendedFeePolicy: {
      maxFeePerGasGwei: feePolicy.maxFeePerGasGwei,
      maxPriorityFeePerGasGwei: feePolicy.maxPriorityFeePerGasGwei,
      shouldDeferNonUrgent: feePolicy.shouldDeferNonUrgent,
    },
    monthlySavingsByTransferReduction: reductions,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Base ERC-20 relayer gas report");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Latest Base block: ${report.latestBlock}`);
  console.log(`ETH/USD: ${formatUsd(ethUsd)}`);
  console.log(`Volume: ${args.transfersPerDay.toLocaleString()} transfers/day`);
  console.log("");
  console.log("Live fees");
  console.log(`  base fee: ${report.liveFees.baseFeeGwei.toFixed(6)} gwei`);
  console.log(`  gas price: ${report.liveFees.gasPriceGwei.toFixed(6)} gwei`);
  console.log(`  estimated L1 data fee per transfer: ${report.liveFees.estimatedL1FeeEth.toExponential(4)} ETH`);
  console.log("");
  if (samples.length) {
    console.log(`Observed sample: ${samples.length} recent ERC-20 transfer receipts`);
    console.log(`  avg gas used: ${Math.round(sampleSummary.average.gasUsed).toLocaleString()}`);
    console.log(`  avg effective gas price: ${sampleSummary.average.effectiveGasPriceGwei.toFixed(6)} gwei`);
    console.log(`  avg all-in cost: ${sampleSummary.average.totalEth.toExponential(4)} ETH`);
  } else if (sampleWarning) {
    console.log(`Receipt sample skipped after RPC error: ${sampleWarning}`);
  } else {
    console.log("Receipt sample skipped.");
  }
  console.log("");
  console.log("Baseline spend");
  console.log(`  per transfer: ${baseline.perTransferEth.toExponential(4)} ETH (${formatUsd(baseline.perTransferUsd)})`);
  console.log(`  daily: ${formatUsd(baseline.dailyUsd)}`);
  console.log(`  monthly: ${formatUsd(baseline.monthlyUsd)}`);
  console.log(`  yearly: ${formatUsd(baseline.yearlyUsd)}`);
  console.log("");
  console.log("Recommended relayer fee caps");
  console.log(`  maxFeePerGas: ${feePolicy.maxFeePerGasGwei.toFixed(6)} gwei`);
  console.log(`  maxPriorityFeePerGas: ${feePolicy.maxPriorityFeePerGasGwei.toFixed(6)} gwei`);
  console.log(`  defer non-urgent sends: ${feePolicy.shouldDeferNonUrgent ? "yes" : "no"}`);
  console.log("");
  console.log("Savings from sending fewer transfers");
  for (const item of reductions) {
    console.log(`  ${(item.reductionFraction * 100).toFixed(0)}% fewer: ${formatUsd(item.monthlyUsd)}/month`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
