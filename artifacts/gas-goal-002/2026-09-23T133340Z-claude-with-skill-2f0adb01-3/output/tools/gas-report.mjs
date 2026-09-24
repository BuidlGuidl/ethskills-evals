#!/usr/bin/env node
//
// gas-report — what the payments relayer actually spends on gas, and what the
// levers in PLAN.md are worth at today's prices.
//
// Two modes:
//
//   Model mode (no relayer address):
//     node tools/gas-report.mjs
//   Pulls live Base fee data and the live ETH price, then prices the current
//   per-transfer design against the batched design using the gas figures
//   measured in test/GasBenchmark.t.sol.
//
//   Actuals mode (relayer address supplied):
//     BASESCAN_API_KEY=... node tools/gas-report.mjs --relayer 0xabc... --days 30
//   Adds what the relayer really paid over the window, straight from receipts,
//   including gas burned on reverted transactions.
//
// No dependencies; Node 18+ for global fetch.

const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const GAS_ORACLE = "0x420000000000000000000000000000000000000F";

// ---------------------------------------------------------------------------
// Measured gas costs. Source: test/GasBenchmark.t.sol against a Base fork at
// block 51,690,700, cross-checked against live receipts and eth_estimateGas.
// "warm" = recipient already holds the token; "cold" = first-ever balance,
// which pays the 20,000-gas zero-to-non-zero SSTORE.
// ---------------------------------------------------------------------------
const GAS = {
  individual: { warm: 45_650, cold: 62_800 },
  // Per-payment cost inside a 250-payment batch.
  batched: { warm: 12_550, cold: 29_650 },
  // L1 data fee gas, from the GasPriceOracle on realistic payloads.
  l1: { individual: 1_941, batchedPerPayment: 96_218 / 250 },
};

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1]]);
    return acc;
  }, [])
);

const TRANSFERS_PER_DAY = Number(args["transfers-per-day"] ?? 40_000);
const WARM_SHARE = Number(args["warm-share"] ?? 0.8);
const BATCH_SIZE = Number(args["batch-size"] ?? 250);

async function rpc(method, params, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.result !== undefined) return json.result;
    } catch {
      /* fall through to backoff */
    }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  throw new Error(`RPC ${method} failed after ${attempts} attempts`);
}

const callOracle = (selector) =>
  rpc("eth_call", [{ to: GAS_ORACLE, data: selector }, "latest"]).then((r) => BigInt(r));

async function ethUsd() {
  if (process.env.ETH_USD) return Number(process.env.ETH_USD);
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const j = await r.json();
    if (j?.ethereum?.usd) return j.ethereum.usd;
  } catch {
    /* fall through */
  }
  throw new Error("could not fetch ETH price; set ETH_USD to override");
}

const usd = (eth, price) => eth * price;
const fmt = (n, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n) => (Math.abs(n) < 0.01 ? `$${n.toFixed(6)}` : `$${fmt(n)}`);

async function liveFees() {
  const [gasPriceHex, blockHex] = await Promise.all([rpc("eth_gasPrice", []), rpc("eth_blockNumber", [])]);
  const block = await rpc("eth_getBlockByNumber", [blockHex, false]);
  const [l1BaseFee, blobBaseFee] = await Promise.all([
    callOracle("0x519b4bd3"), // l1BaseFee()
    callOracle("0xf8206140"), // blobBaseFee()
  ]);
  return {
    l2GasPrice: BigInt(gasPriceHex),
    l2BaseFee: BigInt(block.baseFeePerGas),
    l1BaseFee,
    blobBaseFee,
    blockNumber: Number(BigInt(blockHex)),
  };
}

/// Cost of one payment in ETH, given an L2 gas price and an L1 fee per unit of
/// l1 gas derived from a reference measurement.
function priceScenario(fees, l1WeiPerGas, ethPrice) {
  const l2Wei = (gas) => Number(BigInt(gas) * fees.l2GasPrice);
  const l1Wei = (l1gas) => l1gas * l1WeiPerGas;

  const perPayment = (mode) => {
    const warm = (l2Wei(GAS[mode].warm) + l1Wei(mode === "individual" ? GAS.l1.individual : GAS.l1.batchedPerPayment)) / 1e18;
    const cold = (l2Wei(GAS[mode].cold) + l1Wei(mode === "individual" ? GAS.l1.individual : GAS.l1.batchedPerPayment)) / 1e18;
    const blended = warm * WARM_SHARE + cold * (1 - WARM_SHARE);
    return { warm, cold, blended };
  };

  const ind = perPayment("individual");
  const bat = perPayment("batched");
  const scale = (ethAmt) => ({
    perPayment: usd(ethAmt, ethPrice),
    daily: usd(ethAmt, ethPrice) * TRANSFERS_PER_DAY,
    monthly: usd(ethAmt, ethPrice) * TRANSFERS_PER_DAY * 30.44,
    annual: usd(ethAmt, ethPrice) * TRANSFERS_PER_DAY * 365,
  });
  return { individual: scale(ind.blended), batched: scale(bat.blended), raw: { ind, bat } };
}

async function actuals(relayer, days) {
  const key = process.env.BASESCAN_API_KEY;
  if (!key) {
    console.log("\n  (skipping actuals: set BASESCAN_API_KEY to measure real historical spend)\n");
    return null;
  }
  const latest = Number(BigInt(await rpc("eth_blockNumber", [])));
  // Base produces a block every 2s.
  const fromBlock = latest - Math.floor((days * 86400) / 2);
  const url =
    `https://api.etherscan.io/v2/api?chainid=8453&module=account&action=txlist` +
    `&address=${relayer}&startblock=${fromBlock}&endblock=${latest}&sort=asc&apikey=${key}`;

  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "1" || !Array.isArray(json.result)) {
    console.log(`\n  (actuals unavailable: ${json.message || "unexpected API response"})\n`);
    return null;
  }

  let l2Wei = 0n;
  let failedWei = 0n;
  let failed = 0;
  const outbound = json.result.filter((t) => t.from.toLowerCase() === relayer.toLowerCase());
  for (const t of outbound) {
    const spent = BigInt(t.gasUsed) * BigInt(t.gasPrice);
    l2Wei += spent;
    if (t.isError === "1" || t.txreceipt_status === "0") {
      failed++;
      failedWei += spent;
    }
  }
  return {
    count: outbound.length,
    fromBlock,
    latest,
    l2Eth: Number(l2Wei) / 1e18,
    failed,
    failedEth: Number(failedWei) / 1e18,
    note: "L2 execution fees only; the Basescan txlist endpoint omits the OP-stack l1Fee, which these measurements put at roughly 2% of the total.",
  };
}

(async () => {
  const [fees, ethPrice] = await Promise.all([liveFees(), ethUsd()]);

  // Derive wei-per-l1-gas from the live oracle using the reference single-transfer
  // payload, so the L1 share tracks real L1 conditions rather than a constant.
  const refL1Fee = 4.628e-9 * 1e18; // ETH, measured 2026-09-23 for a 153-byte tx
  const l1WeiPerGas = refL1Fee / GAS.l1.individual;

  console.log("=".repeat(76));
  console.log("  BASE PAYMENTS RELAYER — GAS COST REPORT");
  console.log("=".repeat(76));
  console.log(`  Block                 ${fees.blockNumber.toLocaleString()}`);
  console.log(`  L2 base fee           ${fmt(Number(fees.l2BaseFee) / 1e9, 6)} gwei`);
  console.log(`  L2 gas price (w/ tip) ${fmt(Number(fees.l2GasPrice) / 1e9, 6)} gwei`);
  console.log(`  L1 base fee           ${fmt(Number(fees.l1BaseFee) / 1e9, 4)} gwei`);
  console.log(`  L1 blob base fee      ${fmt(Number(fees.blobBaseFee) / 1e9, 6)} gwei`);
  console.log(`  ETH                   $${fmt(ethPrice)}`);
  console.log(`  Assumed volume        ${TRANSFERS_PER_DAY.toLocaleString()} transfers/day`);
  console.log(`  Assumed warm share    ${(WARM_SHARE * 100).toFixed(0)}% of recipients already hold the token`);

  const s = priceScenario(fees, l1WeiPerGas, ethPrice);

  console.log("\n" + "-".repeat(76));
  console.log("  TODAY — one transfer per transaction");
  console.log("-".repeat(76));
  console.log(`  Per payment           ${money(s.individual.perPayment)}`);
  console.log(`  Per day               ${money(s.individual.daily)}`);
  console.log(`  Per month             ${money(s.individual.monthly)}`);
  console.log(`  Per year              ${money(s.individual.annual)}`);

  console.log("\n" + "-".repeat(76));
  console.log(`  WITH BATCHING — ${BATCH_SIZE} payments per transaction (BatchPay)`);
  console.log("-".repeat(76));
  console.log(`  Per payment           ${money(s.batched.perPayment)}`);
  console.log(`  Per day               ${money(s.batched.daily)}`);
  console.log(`  Per month             ${money(s.batched.monthly)}`);
  console.log(`  Per year              ${money(s.batched.annual)}`);

  const savedMo = s.individual.monthly - s.batched.monthly;
  const savedYr = s.individual.annual - s.batched.annual;
  const pct = (1 - s.batched.annual / s.individual.annual) * 100;
  console.log("\n" + "-".repeat(76));
  console.log("  SAVING FROM BATCHING");
  console.log("-".repeat(76));
  console.log(`  ${money(savedMo)}/month   ${money(savedYr)}/year   (${pct.toFixed(0)}% reduction)`);

  console.log("\n" + "-".repeat(76));
  console.log("  SENSITIVITY — the budget is linear in all three of these");
  console.log("-".repeat(76));
  const base = s.individual.annual;
  for (const [label, mult] of [
    ["volume 10x (400k/day)", 10],
    ["ETH 3x ($8,100)", 3],
    ["Base L2 base fee 10x", (10 * 0.005014 + 0.001) / 0.006014],
    ["volume 10x AND ETH 3x", 30],
  ]) {
    console.log(`  ${label.padEnd(32)} ${money(base * mult).padStart(14)}/yr unbatched   ${money(base * mult * (1 - pct / 100)).padStart(14)}/yr batched`);
  }

  if (args.relayer) {
    const a = await actuals(args.relayer, Number(args.days ?? 30));
    if (a) {
      console.log("\n" + "-".repeat(76));
      console.log(`  ACTUALS — ${args.relayer} over the last ${args.days ?? 30} days`);
      console.log("-".repeat(76));
      console.log(`  Outbound transactions ${a.count.toLocaleString()}`);
      console.log(`  Gas spent             ${fmt(a.l2Eth, 6)} ETH  (${money(usd(a.l2Eth, ethPrice))})`);
      console.log(`  Per transaction       ${money(usd(a.l2Eth / Math.max(a.count, 1), ethPrice))}`);
      console.log(`  Reverted transactions ${a.failed.toLocaleString()} — ${money(usd(a.failedEth, ethPrice))} burned for nothing`);
      console.log(`  Note: ${a.note}`);
    }
  }

  console.log("\n" + "=".repeat(76));
  console.log("  Gas figures from test/GasBenchmark.t.sol. Re-run after any token or");
  console.log("  relayer change:  forge test --match-path test/GasBenchmark.t.sol -vv");
  console.log("=".repeat(76) + "\n");
})();
