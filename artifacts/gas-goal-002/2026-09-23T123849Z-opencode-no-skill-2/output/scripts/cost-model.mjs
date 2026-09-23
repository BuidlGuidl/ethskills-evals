#!/usr/bin/env node
import process from "node:process";

const USAGE = `
cost-model.mjs — standalone vs Disburser-batched cost model for ERC-20 payouts on Base

  node scripts/cost-model.mjs [options]

Defaults are measured on 2026-09-23 against real USDC on Base mainnet
(fork-measured batch gas, on-chain receipts for standalone gas and L1 fees).

Options:
  --eth-price <usd>       ETH price (default: live coingecko, fallback 2724)
  --per-day <n>           transfers/day (default 40000)
  --gas-gwei <x>          effective L2 gas price in gwei (default 0.006, measured)
  --blob-mult <x>         blob base fee multiplier vs measured (default 1)
  --warm-share <0..1>     share of transfers to already-funded recipients (default 0.5)
  --batch-size <n>        transfers per batch tx (default 250)
`;

function parseArgs(argv) {
  const args = { perDay: 40000, gasGwei: 0.006, blobMult: 1, warmShare: 0.5, batchSize: 250 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--eth-price") args.ethPrice = Number(argv[++i]);
    else if (a === "--per-day") args.perDay = Number(argv[++i]);
    else if (a === "--gas-gwei") args.gasGwei = Number(argv[++i]);
    else if (a === "--blob-mult") args.blobMult = Number(argv[++i]);
    else if (a === "--warm-share") args.warmShare = Number(argv[++i]);
    else if (a === "--batch-size") args.batchSize = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      console.log(USAGE);
      process.exit(1);
    }
  }
  return args;
}

const MEASURED = {
  gasStandaloneWarm: 62159,
  gasStandaloneCold: 80700,
  gasBatchedWarmMarginal: 12565,
  gasBatchedColdMarginal: 29577,
  gasBatchFixed: 94500,
  l1FeeWeiStandalone: 3.042e9,
  l1UnitsStandalone: 1600,
  l1UnitsBatchedPerTransfer: 35,
};

function perTransferCosts(args, gasGwei, blobMult) {
  const fixed = MEASURED.gasBatchFixed / args.batchSize;
  const standaloneGas =
    args.warmShare * MEASURED.gasStandaloneWarm + (1 - args.warmShare) * MEASURED.gasStandaloneCold;
  const batchedGas =
    args.warmShare * (MEASURED.gasBatchedWarmMarginal + fixed) +
    (1 - args.warmShare) * (MEASURED.gasBatchedColdMarginal + fixed);

  const ethPerGas = gasGwei * 1e-9;
  const l1StandaloneEth = (MEASURED.l1FeeWeiStandalone / 1e18) * blobMult;
  const l1BatchedEth = l1StandaloneEth * (MEASURED.l1UnitsBatchedPerTransfer / MEASURED.l1UnitsStandalone);

  return {
    standaloneGas,
    batchedGas,
    standalone: standaloneGas * ethPerGas + l1StandaloneEth,
    batched: batchedGas * ethPerGas + l1BatchedEth,
  };
}

async function ethPrice(fallback) {
  if (fallback) return fallback;
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    return (await res.json()).ethereum.usd;
  } catch {
    return 2724;
  }
}

const usd = (v) => `$${v < 0.01 ? v.toFixed(6) : v.toFixed(4)}`;

async function main() {
  const args = parseArgs(process.argv);
  const price = await ethPrice(args.ethPrice);

  const scenarios = [
    { name: "today (measured: 0.006 gwei, blob basefee 0.019 gwei)", gasGwei: 0.006, blobMult: 1 },
    { name: "busy (0.05 gwei, blob basefee ~1 gwei)", gasGwei: 0.05, blobMult: 53 },
    { name: "congested spike (0.3 gwei, blob basefee ~10 gwei)", gasGwei: 0.3, blobMult: 530 },
  ];

  console.log(`Cost model — ${args.perDay.toLocaleString()} ERC-20 transfers/day on Base, ETH $${price}
  (batch size ${args.batchSize}, warm-recipient share ${(args.warmShare * 100).toFixed(0)}%)
  gas figures: standalone from on-chain receipts, batched from Base-mainnet fork tests
`);
  for (const s of scenarios) {
    const c = perTransferCosts(args, s.gasGwei, s.blobMult);
    const cur = c.standalone * price * args.perDay;
    const bat = c.batched * price * args.perDay;
    const save = 1 - c.batched / c.standalone;
    console.log(`${s.name}
  standalone:  ${c.standaloneGas.toFixed(0)} gas/transfer  ${usd(c.standalone * price)}/transfer
               ${usd(cur)}/day   ${usd(cur * 365)}/yr
  batched:     ${c.batchedGas.toFixed(0)} gas/transfer  ${usd(c.batched * price)}/transfer
               ${usd(bat)}/day   ${usd(bat * 365)}/yr
  savings:     ${usd(cur - bat)}/day  ${(save * 100).toFixed(0)}%
`);
  }
  console.log(`Caveats: L2 gas price and blob base fee are volatile; the batched L1 data
figure (~35 compressed units/transfer vs ~1,600 standalone) is an estimate from the
Fjord fee schedule, everything else is measured. Tweak with flags or re-measure with
scripts/gas-audit.mjs against your relayer's own receipts.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
