#!/usr/bin/env node
// Live gas spend report for the Base payments relayer.
// Zero dependencies — talks JSON-RPC directly. Run: node src/gas-report.mjs
//
// Methodology:
//   - L2 execution gas per payment: measured on-chain-equivalent with Foundry
//     (test/GasComparison.t.sol, fresh recipient addresses — the realistic case).
//   - L1 data fee: queried live from Base's GasPriceOracle predeploy using
//     serialized-tx samples with a realistic zero/nonzero byte mix.
//   - ETH price: CoinGecko.

const RPCS = process.env.BASE_RPC_URL
  ? [process.env.BASE_RPC_URL]
  : ["https://mainnet.base.org", "https://base.llamarpc.com", "https://base-rpc.publicnode.com"];
const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F";

// --- Measured constants (forge test --match-contract GasComparisonTest) ---
const INDIVIDUAL_GAS = 74_579; // per payment, one tx per payment, cold recipients
const BATCH_GAS_PER_PAYMENT = 14_714; // per payment, 20 payments per tx
const BATCH_SIZE = 20;
const PAYMENTS_PER_DAY = 40_000;

// Serialized-tx samples for the L1 fee oracle (realistic byte composition).
// Individual ERC-20 transfer: 112 bytes, ~20 zero / ~92 nonzero.
const SAMPLE_INDIVIDUAL = "0x" + "ab".repeat(92) + "00".repeat(20);
// Batch of 20 (~1.5 KB serialized): ~596 nonzero / ~963 zero bytes.
const SAMPLE_BATCH = "0x" + "ab".repeat(596) + "00".repeat(963);

async function rpc(method, params = []) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`${method}: ${lastErr.message} (all RPCs failed)`);
}

async function ethPriceUsd() {
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
  return (await res.json()).ethereum.usd;
}

function encodeGetL1Fee(hexBytes) {
  // getL1Fee(bytes): selector + offset + length + data (padded)
  const data = hexBytes.slice(2);
  const len = data.length / 2;
  const padded = data.padEnd(Math.ceil(len / 32) * 64, "0");
  return "0x49948e0e" + "0".repeat(62) + "20" + len.toString(16).padStart(64, "0") + padded;
}

const fmtUsd = (n) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const fmtUsd4 = (n) => "$" + n.toFixed(6);

const gasPrice = BigInt(await rpc("eth_gasPrice"));
const block = await rpc("eth_getBlockByNumber", ["latest", false]);
const baseFee = BigInt(block.baseFeePerGas);
const l1FeeIndividual = BigInt(await rpc("eth_call", [
  { to: GAS_PRICE_ORACLE, data: encodeGetL1Fee(SAMPLE_INDIVIDUAL) }, "latest",
]));
const l1FeeBatch = BigInt(await rpc("eth_call", [
  { to: GAS_PRICE_ORACLE, data: encodeGetL1Fee(SAMPLE_BATCH) }, "latest",
]));
const ethUsd = await ethPriceUsd();

const toUsd = (wei) => (Number(wei) / 1e18) * ethUsd;

const rows = [
  ["Today: 1 tx per payment", INDIVIDUAL_GAS, l1FeeIndividual],
  ["Batched: 20 payments/tx", BATCH_GAS_PER_PAYMENT, l1FeeBatch / BigInt(BATCH_SIZE)],
];

console.log(`Base gas report — ${new Date().toISOString()}`);
console.log(`  base fee:        ${Number(baseFee) / 1e9} gwei`);
console.log(`  effective price: ${Number(gasPrice) / 1e9} gwei (incl. ~${Number(gasPrice - baseFee) / 1e9} gwei priority)`);
console.log(`  ETH price:       ${fmtUsd(ethUsd)}`);
console.log(`  volume:          ${PAYMENTS_PER_DAY.toLocaleString()} payments/day\n`);

console.log("scenario".padEnd(28), "gas/pay".padStart(10), "L1 fee/pay".padStart(12),
  "cost/pay".padStart(12), "per day".padStart(10), "per month".padStart(11), "per year".padStart(12));

let baseline;
for (const [label, gas, l1Fee] of rows) {
  const execWei = BigInt(gas) * gasPrice;
  const perPayment = toUsd(execWei + l1Fee);
  const perDay = perPayment * PAYMENTS_PER_DAY;
  if (!baseline) baseline = perDay;
  console.log(label.padEnd(28), gas.toLocaleString().padStart(10),
    ((Number(l1Fee) / 1e9).toFixed(3) + " gwei").padStart(12),
    fmtUsd4(perPayment).padStart(12), fmtUsd(perDay).padStart(10),
    fmtUsd(perDay * 30).padStart(11), fmtUsd(perDay * 365).padStart(12));
}

const batchedDay = rows[1] ? null : null;
const perDayBatched = toUsd(BigInt(BATCH_GAS_PER_PAYMENT) * gasPrice + l1FeeBatch / BigInt(BATCH_SIZE)) * PAYMENTS_PER_DAY;
console.log(`\nBatching saves ${fmtUsd(baseline - perDayBatched)}/day, ` +
  `${fmtUsd((baseline - perDayBatched) * 365)}/year ` +
  `(${(((baseline - perDayBatched) / baseline) * 100).toFixed(1)}%).`);
