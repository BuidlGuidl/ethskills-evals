// Sends a day's worth of ERC-20 payments through the Batcher contract,
// amortizing the 21,000-gas intrinsic tx cost across each batch (~40-50%
// cheaper per payment than individual transfers; see PLAN.md).
//
// Zero dependencies: ABI encoding is done by hand, signing/broadcasting is
// delegated to `cast send` (foundry).
//
// Usage:
//   node batchSend.js approve                # one-time: approve Batcher to pull tokens
//   node batchSend.js run payments.json      # send all payments in batches
//   node batchSend.js run payments.json --dry-run
//
// payments.json: [{ "to": "0x...", "amount": "1000000" }, ...]  (smallest unit)
//
// Env:
//   BASE_RPC      (default https://mainnet.base.org)
//   RELAYER_KEY   private key of the relayer wallet (owner of the Batcher)
//   TOKEN         ERC-20 address (e.g. USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
//   BATCHER       deployed Batcher address
//   BATCH_SIZE    payments per transaction (default 50)

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { getCastFeeArgs } from "./fees.js";

const RPC = process.env.BASE_RPC ?? "https://mainnet.base.org";
const KEY = process.env.RELAYER_KEY;
const TOKEN = process.env.TOKEN;
const BATCHER = process.env.BATCHER;
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 50);

// cast sig "batch(address,address[],uint256[])"
const BATCH_SELECTOR = "2e7298c2";
// cast sig "approve(address,uint256)"
const APPROVE_SELECTOR = "095ea7b3";

const pad32 = (hex) => hex.replace(/^0x/, "").padStart(64, "0");

function encodeBatch(token, to, amounts) {
  const n = to.length;
  // head: token, offset(to), offset(amounts)
  const offTo = 0x60;
  const offAmounts = 0x60 + 0x20 + 0x20 * n;
  let data = BATCH_SELECTOR + pad32(token) + pad32(offTo.toString(16)) + pad32(offAmounts.toString(16));
  data += pad32(n.toString(16)) + to.map(pad32).join("");
  data += pad32(n.toString(16)) + amounts.map((a) => pad32(BigInt(a).toString(16))).join("");
  return "0x" + data;
}

function castSend(to, data, feeArgs, dryRun) {
  const args = ["send", to, data, "--rpc-url", RPC, "--private-key", KEY, ...feeArgs];
  if (dryRun) {
    console.log("cast", args.map((a, i) => (args[i - 1] === "--private-key" ? "<redacted>" : a)).join(" "));
    return;
  }
  const out = execFileSync("cast", args, { encoding: "utf8" });
  const hash = out.match(/transactionHash\s+(0x[0-9a-fA-F]+)/)?.[1];
  console.log(`sent: ${hash ?? out.trim()}`);
}

async function main() {
  const [cmd, file, ...rest] = process.argv.slice(2);
  const dryRun = rest.includes("--dry-run");

  for (const [name, val] of Object.entries({ RELAYER_KEY: KEY, TOKEN, BATCHER })) {
    if (!val) throw new Error(`missing env var ${name}`);
  }

  const feeArgs = await getCastFeeArgs(RPC);

  if (cmd === "approve") {
    // One-time setup: let the Batcher pull tokens from the relayer.
    // type(uint256).max never decreases on spend, so this is paid for once.
    const data = "0x" + APPROVE_SELECTOR + pad32(BATCHER) + "f".repeat(64);
    castSend(TOKEN, data, feeArgs, dryRun);
    return;
  }

  if (cmd === "run") {
    const payments = JSON.parse(readFileSync(file, "utf8"));
    console.log(`${payments.length} payments, batches of ${BATCH_SIZE}, dryRun=${dryRun}`);
    for (let i = 0; i < payments.length; i += BATCH_SIZE) {
      const chunk = payments.slice(i, i + BATCH_SIZE);
      const data = encodeBatch(
        TOKEN,
        chunk.map((p) => p.to),
        chunk.map((p) => p.amount),
      );
      console.log(`batch ${i / BATCH_SIZE + 1}: ${chunk.length} payments`);
      castSend(BATCHER, data, feeArgs, dryRun);
    }
    return;
  }

  console.error("usage: node batchSend.js <approve|run payments.json [--dry-run]>");
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
