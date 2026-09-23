// Builds a BatchRelayer payout batch from a payouts file and either prints a
// ready-to-run cast command (default) or sends it (--send, uses PRIVATE_KEY env
// or --private-key). Fee fields are derived live; nothing is hardcoded.
//
// Payouts file: JSON array of {"address": "0x..", "amount": "123456"} (amount
// in token base units).
//
// Usage:
//   node scripts/send-batch.mjs --relayer 0x.. --token 0xUSDC --payouts payouts.json --from 0x<relayer EOA>
//   node scripts/send-batch.mjs ... --send --private-key 0x... (or PRIVATE_KEY env)
//   node scripts/send-batch.mjs ... --max-items 300
import {
  rpc, TOKENS, batchTransferFromCalldata, feeFields, getL1Fee, syntheticType2Tx,
  fmtUsd, ethUsd,
} from "./lib/base.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
function arg(name, fallback = undefined) {
  const i = args.indexOf("--" + name);
  return i === -1 || i + 1 >= args.length ? fallback : args[i + 1];
}
const relayer = arg("relayer");
const tokenArg = (arg("token") || "usdc").toLowerCase();
const token = tokenArg.startsWith("0x") ? tokenArg : TOKENS[tokenArg];
const from = arg("from");
const payoutsPath = arg("payouts");
const maxItems = Number(arg("max-items", "300"));
const send = args.includes("--send");
const privateKey = arg("private-key") || process.env.PRIVATE_KEY;

for (const [name, v] of Object.entries({ relayer, token, from, payoutsPath })) {
  if (!v) {
    console.error(
      `usage: node scripts/send-batch.mjs --relayer 0x.. --token usdc --from 0x<relayer EOA> --payouts file.json [--send] [--private-key 0x..]`
    );
    console.error(`missing --${name}`);
    process.exit(2);
  }
}

let payouts = JSON.parse(readFileSync(payoutsPath, "utf8"));
if (!Array.isArray(payouts)) throw new Error("payouts file must be a JSON array");
payouts = payouts.map((p) => ({
  address: p.address ?? p.to,
  amount: String(p.amount ?? p.value),
}));
if (payouts.length === 0) throw new Error("payouts array is empty");
if (payouts.length > maxItems) {
  throw new Error(
    `payouts has ${payouts.length} items > --max-items ${maxItems}; batch it via jq or lower the count (gas limit and retry blast radius both favor smaller batches)`
  );
}

const calldata = batchTransferFromCalldata({
  relayer,
  token,
  from,
  recipients: payouts.map((p) => p.address),
  amounts: payouts.map((p) => BigInt(p.amount)),
});

const [fields, eth, relayerCode] = await Promise.all([
  feeFields(),
  ethUsd(),
  rpc("eth_getCode", [relayer, "latest"]),
]);
if (relayerCode === "0x") {
  throw new Error(`no contract code at relayer address ${relayer} — deploy src/BatchRelayer.sol first`);
}

let gas;
try {
  gas = await rpc("eth_estimateGas", [{ from, to: relayer, data: calldata }]);
} catch (e) {
  throw new Error(
    `eth_estimateGas failed (${e.message}) — is ${from} the owner, and does it hold a token allowance for the relayer on ${token}?`
  );
}
const gasLimit = BigInt(gas).toString();

const l1Fee = await getL1Fee(
  syntheticType2Tx({ to: relayer, data: calldata, gasLimit: BigInt(gas) })
);
const totalEth = (Number(BigInt(gas)) * Number(fields.maxFeePerGas)) / 1e18 + Number(l1Fee) / 1e18;

console.log(`batch: ${payouts.length} payouts of ${token} from ${from}`);
console.log(`estimated gas : ${gasLimit} (${Number(BigInt(gas) / BigInt(payouts.length))} gas/payout incl. overhead)`);
console.log(`maxFeePerGas  : ${fields.maxFeePerGas} wei (${Number(fields.maxFeePerGas) / 1e9} gwei)`);
console.log(`tip           : ${fields.maxPriorityFeePerGas} wei (${Number(fields.maxPriorityFeePerGas) / 1e9} gwei)`);
console.log(`L1 data fee   : ${l1Fee} wei`);
console.log(`worst-case tx cost: ${fmtUsd(totalEth * eth)} (ETH/USD $${eth})`);

const castArgs = [
  "send",
  "--rpc-url", process.env.BASE_RPC_URL || "https://mainnet.base.org",
  "--gas-limit", gasLimit,
  "--gas-price", String(fields.maxFeePerGas), // EIP-1559 max fee
  "--priority-gas-price", String(fields.maxPriorityFeePerGas),
];
if (privateKey) castArgs.push("--private-key", privateKey);
castArgs.push(relayer, calldata);

if (send) {
  if (!privateKey) throw new Error("--send requires --private-key or PRIVATE_KEY env");
  const out = execFileSync("cast", castArgs, { encoding: "utf8" });
  console.log(out);
} else {
  console.log("");
  console.log("dry run — execute with:");
  console.log("  cast " + castArgs.join(" "));
}
