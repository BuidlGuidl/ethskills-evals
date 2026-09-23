// Live finance quote for ERC-20 payout costs on Base.
// Usage:
//   node scripts/quote.mjs --token usdc
//   node scripts/quote.mjs --token 0x<address>
//   node scripts/quote.mjs --token usdc --relayer 0x<BatchRelayer> --batch-size 300
//   node scripts/quote.mjs --token usdc --transfers-per-day 40000
import {
  TOKENS, ethUsd, rpc, erc20TransferCalldata, syntheticType2Tx, getL1Fee,
  batchTransferFromCalldata, measureTransferGas, feeFields, blobBaseFee, fmtUsd,
  findTokenHolder,
} from "./lib/base.mjs";

const args = process.argv.slice(2);
function arg(name, fallback = undefined) {
  const i = args.indexOf("--" + name);
  return i === -1 || i + 1 >= args.length ? fallback : args[i + 1];
}
const tokenArg = (arg("token") || "usdc").toLowerCase();
const token = tokenArg.startsWith("0x") ? tokenArg : TOKENS[tokenArg];
if (!token) throw new Error(`unknown token '${tokenArg}' (use 0x.. or one of ${Object.keys(TOKENS).join(", ")})`);
const relayer = arg("relayer");
const batchSize = BigInt(arg("batch-size", "300"));
const perDay = BigInt(arg("transfers-per-day", "40000"));

// Batched-operation constants measured on a live Base fork against real USDC
// (test/BatchRelayer.base.fork.t.sol, 2026-09-23). Overridden below when a
// deployed relayer address is provided, using eth_estimateGas.
const MEASURED_BATCH_MARGINAL_GAS_COLD = 30_400n;
const MEASURED_BATCH_FIXED_GAS = 75_000n; // 21k intrinsic + dispatch + first-item share

const holder = await findTokenHolder(token, arg("from"));
const [eth, fields, transferGas, blobFee] = await Promise.all([
  ethUsd(),
  feeFields(),
  measureTransferGas(token, { from: holder }),
  blobBaseFee(),
]);

// L1 data fee for one standalone transfer (synthetic tx priced by GasPriceOracle)
const plainRaw = syntheticType2Tx({
  to: token,
  data: erc20TransferCalldata("0x000000000000000000000000000000000000dEaD", 1n),
  gasLimit: 90_878n,
});
const plainL1Fee = await getL1Fee(plainRaw);

// L1 data fee for one batch tx of batchSize items, amortized per item
const n = Number(batchSize);
const recipients = Array.from({ length: n }, (_, i) =>
  "0x" + ((0x01f8585f6d4b26e1n * BigInt(i + 7)) % (1n << 160n)).toString(16).padStart(40, "0"));
const amounts = Array.from({ length: n }, (_, i) => 25_500_000n + BigInt(i));
const batchCalldata = batchTransferFromCalldata({
  relayer: relayer || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  token,
  from: "0x1887FA9EdADeaB7562B01CC3F4FA246AcE2c3Cdd",
  recipients,
  amounts,
});
const batchRaw = syntheticType2Tx({
  to: relayer || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  data: batchCalldata,
  gasLimit: 1_500_000n + batchSize * 60_000n,
});
const batchL1Fee = await getL1Fee(batchRaw);
const batchL1PerItem = batchL1Fee / batchSize;

let batchExecGas;
const ownerFrom = arg("from");
if (relayer && ownerFrom) {
  try {
    batchExecGas = await rpc("eth_estimateGas", [{ from: ownerFrom, to: relayer, data: batchCalldata }]);
  } catch {
    // estimate can fail if the owner has no token approval yet; fall back to fork-measured constants
  }
}
const batchExecPerItemGas = batchExecGas
  ? (BigInt(batchExecGas) - MEASURED_BATCH_FIXED_GAS) / batchSize
  : MEASURED_BATCH_MARGINAL_GAS_COLD;

const gasPriceGwei = Number(fields.suggestedGasPrice) / 1e9;

const perTransferEth = (gasUsed, l1Wei) =>
  (Number(gasUsed) * gasPriceGwei * 1e-9) + (Number(l1Wei) / 1e18);

const standalonePerTx = perTransferEth(transferGas, plainL1Fee);
const batchedPerItem = perTransferEth(
  batchExecPerItemGas + MEASURED_BATCH_FIXED_GAS / batchSize,
  batchL1PerItem,
);

const money = (ethAmount) => ethAmount * eth;
const daily = (perTx) => money(perTx) * Number(perDay);

console.log(`Base payout cost quote (measured live ${new Date().toISOString()})`);
console.log(`  token: ${token} (transfer gas estimated from holder ${holder})`);
console.log(`  ETH/USD: $${eth}`);
console.log(`  gas price (incl. suggested tip): ${gasPriceGwei} gwei (base fee ${Number(fields.baseFeePerGas) / 1e9} gwei + tip ${Number(fields.suggestedGasPrice - fields.baseFeePerGas) / 1e9})`);
console.log(`  blob base fee (drives L1 data fee): ${Number(blobFee) / 1e9} gwei`);
console.log("");
console.log("Standalone (one tx per transfer):");
console.log(`  L2 execution : ${transferGas} gas (cold recipient) = ${fmtUsd(money(Number(transferGas) * gasPriceGwei * 1e-9))}`);
console.log(`  L1 data fee  : ${Number(plainL1Fee) / 1e9} gwei-wei = ${fmtUsd(money(Number(plainL1Fee) / 1e18))}`);
console.log(`  total        : ${fmtUsd(money(standalonePerTx))} per transfer`);
console.log("");
console.log(`Batched via BatchRelayer (batch size ${n}${relayer ? ", exec estimated live" : ", exec from fork measurements"}):`);
console.log(`  L2 execution : ~${batchExecPerItemGas} gas/item amortized = ${fmtUsd(money(Number(batchExecPerItemGas + MEASURED_BATCH_FIXED_GAS / batchSize) * gasPriceGwei * 1e-9))}`);
console.log(`  L1 data fee  : ${Number(batchL1PerItem) / 1e9} gwei-wei/item = ${fmtUsd(money(Number(batchL1PerItem) / 1e18))}`);
console.log(`  total        : ${fmtUsd(money(batchedPerItem))} per transfer`);
console.log("");
console.log(`At ${Number(perDay).toLocaleString()} transfers/day:`);
console.log(`  standalone: ${fmtUsd(daily(standalonePerTx))}/day   ${fmtUsd(daily(standalonePerTx) * 30)}/30d`);
console.log(`  batched  : ${fmtUsd(daily(batchedPerItem))}/day   ${fmtUsd(daily(batchedPerItem) * 30)}/30d`);
console.log(`  saving    : ${fmtUsd(daily(standalonePerTx) - daily(batchedPerItem))}/day  ${fmtUsd((daily(standalonePerTx) - daily(batchedPerItem)) * 30)}/30d (${Math.round((1 - batchedPerItem / standalonePerTx) * 100)}%)`);
