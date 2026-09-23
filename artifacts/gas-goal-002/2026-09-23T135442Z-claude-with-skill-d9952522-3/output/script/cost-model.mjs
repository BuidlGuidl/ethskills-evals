/**
 * Ranks the cost of each proposed change, using live Base fee data plus the
 * gas constants measured by script/measure-gas.mjs.
 *
 * Re-run this before quoting any figure: Base's base fee, the L1 blob market
 * and ETH/USD all move, and the ranking of the levers can move with them.
 *
 *   node script/cost-model.mjs [--transfers 40000] [--first-time 0.20]
 */
const RPC = process.env.RPC_URL || "https://mainnet.base.org";
const ORACLE = "0x420000000000000000000000000000000000000F";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(process.argv[i + 1]);
};
const TRANSFERS_PER_DAY = arg("transfers", 40_000);
const FIRST_TIME_SHARE = arg("first-time", 0.20);
const BATCH_SIZE = arg("batch", 100);

let id = 1;
async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

/** GasPriceOracle.getL1FeeUpperBound(uint256) -> uint256 */
async function l1Fee(txBytes) {
  const data = "0xf1c7a58b" + BigInt(txBytes).toString(16).padStart(64, "0");
  return BigInt(await rpc("eth_call", [{ to: ORACLE, data }, "latest"]));
}

const ethUsd = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot")
  .then((r) => r.json()).then((j) => Number(j.data.amount));
const baseFee = BigInt((await rpc("eth_getBlockByNumber", ["latest", false])).baseFeePerGas);

// --- measured constants (script/measure-gas.mjs, anvil fork of Base) --------
// Validated against live receipts: the one-tx-per-payment figures reproduce
// the observed on-chain medians (45,059 / 62,159) to within 0.4%.
const GAS = { singleWarm: 44_867n, singleCold: 61_967n };
/** Measured per-payment gas by batch size, existing recipients. */
const BATCH_WARM = { 1: 59_280n, 5: 22_711n, 10: 18_151n, 25: 15_416n, 50: 14_505n, 100: 14_065n, 200: 13_850n, 400: 13_754n };
/** First-time recipients carry an unavoidable +17,100 zero-to-nonzero SSTORE. */
const BATCH_COLD = Object.fromEntries(Object.entries(BATCH_WARM).map(([k, v]) => [k, v + 17_100n]));
/** payUniform measured 215 gas/payment below pay at n=100. */
const UNIFORM_DELTA = 215n;
if (!BATCH_WARM[BATCH_SIZE]) throw new Error(`no measurement for batch size ${BATCH_SIZE}; measured: ${Object.keys(BATCH_WARM)}`);
GAS.batchWarm = BATCH_WARM[BATCH_SIZE];
GAS.batchCold = BATCH_COLD[BATCH_SIZE];
GAS.uniformWarm = GAS.batchWarm - UNIFORM_DELTA;
// Transaction sizes in bytes, for the L1 data fee.
const SIZE = {
  single: 110,
  batchPay: 4 + 32 * 4 + BATCH_SIZE * 32 * 2 + 40,
  batchUniform: 4 + 32 * 4 + BATCH_SIZE * 32 + 40,
};

const [l1Single, l1BatchPay, l1BatchUniform] = await Promise.all(
  [SIZE.single, SIZE.batchPay, SIZE.batchUniform].map(l1Fee)
);

// --- fee scenarios ---------------------------------------------------------
// Baseline tip: what ethers/viem volunteer by default on Base, i.e. the node's
// eth_maxPriorityFeePerGas suggestion. Measured at ~1,000,000 wei.
const TIP_DEFAULT = 1_000_000n;
// Proposed tip: measured floor. Every Base block sampled included a zero-tip tx.
const TIP_FLOOR = 1_000n;

const DAYS = 365;
const n = BigInt(TRANSFERS_PER_DAY);
const coldN = BigInt(Math.round(TRANSFERS_PER_DAY * FIRST_TIME_SHARE));
const warmN = n - coldN;
const usd = (wei) => (Number(wei) / 1e18) * ethUsd;

/** Annual USD for a scheme, given per-payment gas and per-transaction L1 fee. */
function annual({ warmGas, coldGas, l1PerTx, perTx, tip }) {
  const gasPrice = baseFee + tip;
  const exec = (warmN * warmGas + coldN * coldGas) * gasPrice;
  // perTx = payments per transaction, so this is the L1 fee per day.
  const txPerDay = (n + BigInt(perTx) - 1n) / BigInt(perTx);
  return usd((exec + txPerDay * l1PerTx) * BigInt(DAYS));
}

const scenarios = {
  "A. today: one tx per payment, default tip": annual({
    warmGas: GAS.singleWarm, coldGas: GAS.singleCold, l1PerTx: l1Single, perTx: 1, tip: TIP_DEFAULT,
  }),
  "B. fee policy only (tip -> floor)": annual({
    warmGas: GAS.singleWarm, coldGas: GAS.singleCold, l1PerTx: l1Single, perTx: 1, tip: TIP_FLOOR,
  }),
  [`C. batching only (pay, n=${BATCH_SIZE}), default tip`]: annual({
    warmGas: GAS.batchWarm, coldGas: GAS.batchCold, l1PerTx: l1BatchPay, perTx: BATCH_SIZE, tip: TIP_DEFAULT,
  }),
  [`D. batching + fee policy`]: annual({
    warmGas: GAS.batchWarm, coldGas: GAS.batchCold, l1PerTx: l1BatchPay, perTx: BATCH_SIZE, tip: TIP_FLOOR,
  }),
  [`E. D + payUniform where amounts are equal`]: annual({
    warmGas: GAS.uniformWarm, coldGas: GAS.batchCold, l1PerTx: l1BatchUniform, perTx: BATCH_SIZE, tip: TIP_FLOOR,
  }),
};

console.log(`\ninputs (live, ${new Date().toISOString()})`);
console.log(`  ETH/USD              ${ethUsd}`);
console.log(`  Base base fee        ${baseFee} wei (${(Number(baseFee) / 1e9).toFixed(6)} gwei)`);
console.log(`  L1 fee, single tx    ${l1Single} wei`);
console.log(`  L1 fee, batch(${BATCH_SIZE})   ${l1BatchPay} wei`);
console.log(`  transfers/day        ${TRANSFERS_PER_DAY}  (${(FIRST_TIME_SHARE * 100).toFixed(0)}% to first-time recipients)`);

const base = scenarios["A. today: one tx per payment, default tip"];
console.log(`\nannual gas cost (USD)`);
for (const [name, cost] of Object.entries(scenarios)) {
  const save = base - cost;
  console.log(
    `  ${name.padEnd(46)} ${cost.toFixed(0).padStart(8)}` +
    (save > 0 ? `   saves ${save.toFixed(0).padStart(7)}  (${((save / base) * 100).toFixed(1)}%)` : "")
  );
}

const l1ShareA = usd(BigInt(TRANSFERS_PER_DAY) * l1Single * BigInt(DAYS)) / base * 100;
console.log(`\nL1 data fee is ${l1ShareA.toFixed(1)}% of today's bill -- calldata compression is not the lever.`);
console.log(`Per-payment gas: ${GAS.singleWarm} -> ${GAS.batchWarm} (existing recipient), ` +
  `${GAS.singleCold} -> ${GAS.batchCold} (first-time).`);

// Batch size trades gas against how long a payment waits to be included.
const perMin = TRANSFERS_PER_DAY / 1440;
console.log(`\nbatch size vs payout latency (at ${perMin.toFixed(1)} payments/min)`);
for (const [size, g] of Object.entries(BATCH_WARM)) {
  if (size === "1") continue;
  const cost = annual({ warmGas: g, coldGas: BATCH_COLD[size], l1PerTx: l1BatchPay, perTx: Number(size), tip: TIP_FLOOR });
  console.log(`  n=${String(size).padStart(3)}  ${g} gas/payment  ~${(Number(size) / perMin).toFixed(1)} min wait  $${cost.toFixed(0)}/yr`);
}
