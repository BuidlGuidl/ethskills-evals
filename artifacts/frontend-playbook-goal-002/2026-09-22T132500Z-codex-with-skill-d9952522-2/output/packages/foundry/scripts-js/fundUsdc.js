import { spawnSync } from "child_process";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const MAX_SLOT = Number(process.env.USDC_BALANCE_SLOT_SCAN_LIMIT || 200);

const [recipient, rawAmount = "1000"] = process.argv.slice(2);

if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
  console.error("Usage: yarn fund:usdc <wallet-address> [amount]");
  process.exit(1);
}

function runCast(args) {
  const result = spawnSync("cast", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || `cast ${args.join(" ")} failed`).trim()
    );
  }
  return result.stdout.trim();
}

function parseUsdcAmount(input) {
  if (!/^\d+(\.\d{1,6})?$/.test(input)) {
    throw new Error(
      "Amount must be a positive decimal with at most 6 fractional digits."
    );
  }

  const [whole, fraction = ""] = input.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function uint256Hex(value) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function readBalance(address) {
  const output = runCast([
    "call",
    "--rpc-url",
    RPC_URL,
    BASE_USDC,
    "balanceOf(address)(uint256)",
    address,
  ]);
  return BigInt(output.split(/\s+/)[0]);
}

const amount = parseUsdcAmount(rawAmount);

for (let slot = 0; slot <= MAX_SLOT; slot++) {
  const storageKey = runCast(["index", "address", recipient, String(slot)]);
  runCast([
    "rpc",
    "--rpc-url",
    RPC_URL,
    "anvil_setStorageAt",
    BASE_USDC,
    storageKey,
    uint256Hex(amount),
  ]);

  if (readBalance(recipient) === amount) {
    console.log(
      `Funded ${recipient} with ${rawAmount} USDC on the local Base fork.`
    );
    console.log(`Detected Base USDC balances mapping slot: ${slot}`);
    process.exit(0);
  }
}

console.error(
  `Could not detect Base USDC balance storage slot in slots 0-${MAX_SLOT}.`
);
process.exit(1);
