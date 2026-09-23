import { encodePackedBatch } from "../src/encode-batch.mjs";

const RPC = process.env.BASE_RPC ?? "https://mainnet.base.org";
const ETH_USD_API = "https://api.coinbase.com/v2/prices/ETH-USD/spot";

const MEASURED = {
  date: "2026-09-23",
  gasPriceGwei: 0.006,
  baseFeeGwei: 0.005,
  standaloneTransferGas: 62147,
  batchedPerPaymentGas: 28000,
  batchFixedGas: 62640,
  l1FeeWeiPerStandaloneTx: 5652466791n,
  l1FeeWeiPerBatch200Tx: 5094675334n,
  ethUsd: 2724.55,
  blockGasLimit: 400000000,
};

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--live") out.live = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      out[key] = argv[i + 1];
      i++;
    }
  }
  return out;
}

const num = (v, d) => (v === undefined || v === null ? d : Number(v));
const gweiWei = (g) => BigInt(Math.round(g * 1e9));

function feePerTx(gas, effGwei, ethUsd, l1Usd) {
  const l2Usd = (Number(gas * gweiWei(effGwei)) / 1e18) * ethUsd;
  return l2Usd + l1Usd;
}

function fmtUsd(x) {
  if (x >= 1000) return "$" + x.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (x >= 1) return "$" + x.toFixed(2);
  if (x >= 0.001) return "$" + x.toFixed(4);
  return "$" + x.toExponential(2);
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
  return j.result;
}

async function liveParams() {
  const [gasPriceHex, spot] = await Promise.all([
    rpc("eth_gasPrice", []),
    fetch(ETH_USD_API).then((r) => r.json()),
  ]);
  const gasPriceGwei = Number(BigInt(gasPriceHex)) / 1e9;
  const ethUsd = Number(spot.data.amount);
  return { gasPriceGwei, ethUsd };
}

function printReport(cfg) {
  const perDay = cfg.transfersPerDay;
  const standaloneGas = BigInt(cfg.standaloneGas);
  const batchedGas = BigInt(cfg.batchedGas);
  const netRatio = cfg.repeatRatio;
  const lines = [];
  const scenarios = [
    { label: "today (measured)", gwei: cfg.todayGwei },
    { label: "moderate stress", gwei: 0.05 },
    { label: "high stress", gwei: 0.25 },
  ];
  const l1StandaloneUsd = Number(MEASURED.l1FeeWeiPerStandaloneTx) / 1e18 * cfg.ethUsd;
  const l1BatchedUsd = (Number(MEASURED.l1FeeWeiPerBatch200Tx) / 1e18 * cfg.ethUsd) / cfg.batchSize;
  lines.push(`Inputs: ${perDay.toLocaleString()} transfers/day, gas ${cfg.standaloneGas}/transfer standalone, ${cfg.batchedGas}/payment batched (batch=${cfg.batchSize}), ETH $${cfg.ethUsd}`);
  lines.push("");
  lines.push("=== A. WHAT WE SPEND NOW (one transfer per tx, from relayer EOA) ===");
  for (const s of scenarios) {
    const per = feePerTx(standaloneGas, s.gwei, cfg.ethUsd, l1StandaloneUsd);
    lines.push(
      `  gas ${String(s.gwei).padStart(6)} gwei [${s.label}]: ${fmtUsd(per)}/tx -> ${fmtUsd(per * perDay)}/day -> ${fmtUsd(per * perDay * 365)}/yr`
    );
  }
  if (cfg.theirGwei) {
    const per = feePerTx(standaloneGas, cfg.theirGwei, cfg.ethUsd, l1StandaloneUsd);
    lines.push(`  at YOUR current effective gas price ${cfg.theirGwei} gwei: ${fmtUsd(per)}/tx -> ${fmtUsd(per * perDay * 365)}/yr`);
  }
  lines.push("");
  lines.push("=== B. LEVERS, RANKED BY ANNUAL SAVING (at measured gas price, then stress) ===");
  const levers = [];
  if (cfg.theirGwei && cfg.theirGwei > cfg.todayGwei * 1.5) {
    const per = feePerTx(standaloneGas, cfg.theirGwei, cfg.ethUsd, l1StandaloneUsd);
    const fix = feePerTx(standaloneGas, Math.max(cfg.todayGwei, 0.0015), cfg.ethUsd, l1StandaloneUsd);
    levers.push({
      name: `1. Fix fee policy (effective gas ${cfg.theirGwei} gwei -> ~${Math.max(cfg.todayGwei, 0.0015).toFixed(4)} gwei)`,
      yrNow: (per - fix) * perDay * 365,
      pct: 1 - fix / per,
    });
  }
  const netFactor = netRatio > 1 ? 1 - 1 / netRatio : 0;
  if (netFactor > 0) {
    const per = feePerTx(standaloneGas, cfg.todayGwei, cfg.ethUsd, l1StandaloneUsd);
    levers.push({
      name: `2. Net duplicate recipients (${perDay.toLocaleString()} payments -> ${(perDay / netRatio).toLocaleString()} transfers, repeat ratio ${netRatio})`,
      yrNow: per * perDay * netFactor * 365,
      pct: netFactor,
    });
  }
  {
    const perStd = feePerTx(standaloneGas, cfg.todayGwei, cfg.ethUsd, l1StandaloneUsd);
    const perBat = feePerTx(batchedGas, cfg.todayGwei, cfg.ethUsd, l1BatchedUsd);
    levers.push({
      name: "3. Batch on-chain (BatchSettler / 7702 executor, batch=" + cfg.batchSize + ")",
      yrNow: (perStd - perBat) * perDay * 365,
      pct: 1 - perBat / perStd,
      pctExecOnly: 1 - Number(batchedGas) / Number(standaloneGas),
    });
  }
  levers.sort((a, b) => b.yrNow - a.yrNow);
  for (const l of levers) {
    lines.push(`  ${l.name}`);
    lines.push(`     now: ${fmtUsd(l.yrNow)}/yr (${(l.pct * 100).toFixed(1)}% of that cost)${l.pctExecOnly ? ` [L2 execution gas: ${(l.pctExecOnly * 100).toFixed(1)}%]` : ""}`);
    if (levers.length && cfg.stressGwei) {
      const perStdS = feePerTx(standaloneGas, cfg.stressGwei, cfg.ethUsd, l1StandaloneUsd);
      const perBatS = feePerTx(batchedGas, cfg.stressGwei, cfg.ethUsd, l1BatchedUsd);
      if (l.name.startsWith("3.")) lines.push(`     at ${cfg.stressGwei} gwei: ${fmtUsd((perStdS - perBatS) * perDay * 365)}/yr`);
      if (l.name.startsWith("2.")) lines.push(`     at ${cfg.stressGwei} gwei: ${fmtUsd(perStdS * perDay * netFactor * 365)}/yr`);
    }
  }
  lines.push("");
  lines.push("=== C. END STATE (all code levers applied) ===");
  {
    const after = Math.min(1 / Math.max(netRatio, 1), 1);
    const per = feePerTx(batchedGas, cfg.todayGwei, cfg.ethUsd, l1BatchedUsd);
    const perS = feePerTx(batchedGas, 0.25, cfg.ethUsd, l1BatchedUsd);
    lines.push(`  batched + netted at today's gas: ${fmtUsd(per * perDay * after * 365)}/yr`);
    lines.push(`  batched + netted at 0.25 gwei:  ${fmtUsd(perS * perDay * after * 365)}/yr`);
  }
  lines.push("");
  lines.push("=== D. SANITY ===");
  lines.push(`  batch tx gas ~= ${MEASURED.batchFixedGas + cfg.batchedGas * cfg.batchSize} (< block limit ${MEASURED.blockGasLimit}); txs/day ${Math.ceil(perDay / cfg.batchSize)} instead of ${perDay}`);
  lines.push(`  uint64 amount cap: ${(2n ** 64n - 1n)} base units (e.g. ${(Number(2n ** 64n - 1n) / 1e6).toExponential(2)} of a 6-decimal token)`);
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  const cfg = {
    transfersPerDay: num(args["transfers-per-day"], 40000),
    standaloneGas: Math.round(num(args["standalone-gas"], MEASURED.standaloneTransferGas)),
    batchedGas: Math.round(num(args["batch-gas"], MEASURED.batchedPerPaymentGas)),
    batchSize: Math.round(num(args["batch-size"], 200)),
    repeatRatio: num(args["repeat-ratio"], 1),
    theirGwei: args["their-effective-gwei"] ? Number(args["their-effective-gwei"]) : null,
    ethUsd: num(args["eth"], MEASURED.ethUsd),
    todayGwei: MEASURED.gasPriceGwei,
    stressGwei: 0.25,
  };
  if (args.live) {
    try {
      const live = await liveParams();
      cfg.todayGwei = live.gasPriceGwei;
      cfg.ethUsd = live.ethUsd;
      console.error(`live: gas ${live.gasPriceGwei} gwei, ETH $${live.ethUsd}`);
    } catch (e) {
      console.error("live fetch failed, using measured defaults:", e.message);
    }
  }
  console.log(printReport(cfg));
  const demo = encodePackedBatch([
    { recipient: "0x1111111111111111111111111111111111111111", amount: 1500000n },
    { recipient: "0x2222222222222222222222222222222222222222", amount: 250000n },
  ]);
  console.log(`packed blob example: ${demo.blob} (${demo.count} entries, total ${demo.total})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
