import { spawnSync } from "child_process";

/**
 * Fund an address with USDC on the local Base fork.
 *
 * Nothing here is broadcast anywhere: the fork is a local copy of Base, so we can impersonate an
 * account that already holds USDC and move real tokens into a demo account. That is preferable to
 * deploying a mock token, because the app keeps talking to the canonical USDC contract.
 *
 * Usage: yarn fund <address> [--amount 500]
 */
const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// Morpho Blue on Base: holds hundreds of millions of USDC, so it can bankroll any demo.
const WHALE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: yarn fund <address> [options]
Options:
  --amount <usdc>   Amount of USDC to send (default: 500)
  --help, -h        Show this help message
Example:
  yarn fund 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --amount 250
`);
  process.exit(args.length === 0 ? 1 : 0);
}

let recipient = null;
let amount = "500";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--amount" && args[i + 1]) {
    amount = args[i + 1];
    i++;
  } else if (!args[i].startsWith("-")) {
    recipient = args[i];
  }
}

if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
  console.error(`\n❌ Error: '${recipient ?? ""}' is not a valid address.`);
  process.exit(1);
}

const run = (args, { capture = false } = {}) => {
  const result = spawnSync("cast", args, {
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf-8",
  });
  if (result.error || result.status !== 0) {
    console.error(`\n❌ Error: \`cast ${args.slice(0, 2).join(" ")}\` failed.`);
    if (capture) console.error(result.stderr?.trim() || result.stdout?.trim());
    console.error(
      "Is the local fork running? Start it with: yarn fork --network base"
    );
    process.exit(1);
  }
  return result.stdout?.trim();
};

const chainId = run(["chain-id", "--rpc-url", RPC], { capture: true });
if (chainId !== "31337") {
  console.error(
    `\n❌ Error: expected the local Anvil fork (chain id 31337) at ${RPC}, found ${chainId}.`
  );
  process.exit(1);
}

// USDC has 6 decimals.
const rawAmount = BigInt(Math.round(Number(amount) * 1e6));
if (!(rawAmount > 0n)) {
  console.error(`\n❌ Error: '${amount}' is not a positive USDC amount.`);
  process.exit(1);
}

const whaleBalance = BigInt(
  run(["call", USDC, "balanceOf(address)(uint256)", WHALE, "--rpc-url", RPC], {
    capture: true,
  }).split(" ")[0]
);
if (whaleBalance < rawAmount) {
  console.error(
    `\n❌ Error: the impersonated holder only has ${
      Number(whaleBalance) / 1e6
    } USDC.`
  );
  process.exit(1);
}

// Gas for the recipient, gas for the whale, then the transfer itself.
run(
  ["rpc", "anvil_setBalance", recipient, "0xde0b6b3a7640000", "--rpc-url", RPC],
  { capture: true }
);
run(["rpc", "anvil_setBalance", WHALE, "0xde0b6b3a7640000", "--rpc-url", RPC], {
  capture: true,
});
run(["rpc", "anvil_impersonateAccount", WHALE, "--rpc-url", RPC], {
  capture: true,
});
run(
  [
    "send",
    USDC,
    "transfer(address,uint256)",
    recipient,
    rawAmount.toString(),
    "--from",
    WHALE,
    "--unlocked",
    "--rpc-url",
    RPC,
  ],
  { capture: true }
);
run(["rpc", "anvil_stopImpersonatingAccount", WHALE, "--rpc-url", RPC], {
  capture: true,
});

const balance = BigInt(
  run(
    ["call", USDC, "balanceOf(address)(uint256)", recipient, "--rpc-url", RPC],
    { capture: true }
  ).split(" ")[0]
);
console.log(`\n💸 Sent ${amount} USDC to ${recipient}`);
console.log(`   USDC balance: ${Number(balance) / 1e6}`);
console.log(`   ETH balance:  1 (for gas)\n`);
