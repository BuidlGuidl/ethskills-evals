/**
 * Fund local accounts with real USDC on a Base fork.
 *
 * A fork is a local copy of Base, so instead of deploying a mock token we take USDC from an
 * address that already holds it: impersonate the holder, transfer, stop impersonating. Nothing
 * is broadcast anywhere and no real money moves.
 *
 * Usage (chain must be running via `yarn fork --network base`):
 *   yarn fund-usdc                          # 1,000 USDC to the default Anvil accounts
 *   yarn fund-usdc 0xYourBurnerAddress      # 1,000 USDC to one address
 *   yarn fund-usdc 0xAddr 250               # 250 USDC to one address
 */

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const USDC =
  process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Contracts that hold a lot of USDC on Base. The first one with enough balance is used, so the
// script keeps working when any single one of them moves its funds.
const WHALES = [
  "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", // Morpho Blue
  "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB", // Aave v3 aBasUSDC
  "0xcDAC0d6c6C59727a65F871236188350531885C43", // Aerodrome USDC pool
  "0xd0b53D9277642d899DF5C87A3966A349A798F224", // Uniswap v3 USDC/WETH
];

// Anvil's default mnemonic accounts #0 and #9 (#9 is the Scaffold-ETH deployer / jar owner).
const DEFAULT_RECIPIENTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
];

const TRANSFER_SELECTOR = "0xa9059cbb";
const BALANCE_OF_SELECTOR = "0x70a08231";

let requestId = 0;

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
  }).catch(() => {
    throw new Error(
      `Cannot reach ${RPC_URL}. Start the chain first: yarn fork --network base`
    );
  });

  const { result, error } = await response.json();
  if (error) throw new Error(`${method} failed: ${error.message}`);
  return result;
}

const pad = (value) => value.toString(16).padStart(64, "0");
const encodeAddress = (address) => pad(BigInt(address));

async function usdcBalanceOf(address) {
  const data = BALANCE_OF_SELECTOR + encodeAddress(address);
  return BigInt(await rpc("eth_call", [{ to: USDC, data }, "latest"]));
}

const formatUsdc = (amount) =>
  (Number(amount) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 });

async function waitForReceipt(txHash) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${txHash}`);
}

async function main() {
  const [addressArg, amountArg] = process.argv.slice(2);

  if (addressArg && !/^0x[0-9a-fA-F]{40}$/.test(addressArg)) {
    throw new Error(
      `"${addressArg}" is not an address. Usage: yarn fund-usdc [address] [amount]`
    );
  }
  const recipients = addressArg ? [addressArg] : DEFAULT_RECIPIENTS;

  const amount = amountArg ?? "1000";
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
    throw new Error(`"${amount}" is not a valid USDC amount (max 6 decimals).`);
  }
  const [whole, fraction = ""] = amount.split(".");
  const units = BigInt(whole + fraction.padEnd(6, "0"));
  if (units === 0n) throw new Error("Amount must be greater than zero.");

  const chainId = Number(await rpc("eth_chainId"));
  if (chainId !== 31337) {
    throw new Error(
      `Refusing to run against chain ${chainId}. This script only works on a local Anvil fork.`
    );
  }
  if ((await rpc("eth_getCode", [USDC, "latest"])) === "0x") {
    throw new Error(
      `No USDC at ${USDC}. Start the chain with \`yarn fork --network base\`, not \`yarn chain\`.`
    );
  }

  const needed = units * BigInt(recipients.length);
  let whale;
  for (const candidate of WHALES) {
    if ((await usdcBalanceOf(candidate)) >= needed) {
      whale = candidate;
      break;
    }
  }
  if (!whale) {
    throw new Error(
      `No known holder has ${formatUsdc(
        needed
      )} USDC. Add one to WHALES in scripts-js/fundUsdc.js.`
    );
  }

  console.log(
    `Taking USDC from ${whale} on the fork (holds ${formatUsdc(
      await usdcBalanceOf(whale)
    )} USDC)\n`
  );

  await rpc("anvil_impersonateAccount", [whale]);
  // The holder is a contract and may have no ETH; give it some so it can pay for gas.
  await rpc("anvil_setBalance", [whale, "0x" + (10n ** 18n).toString(16)]);

  try {
    for (const recipient of recipients) {
      const data = TRANSFER_SELECTOR + encodeAddress(recipient) + pad(units);
      const txHash = await rpc("eth_sendTransaction", [
        { from: whale, to: USDC, data, gas: "0x30d40" },
      ]);
      const receipt = await waitForReceipt(txHash);
      if (receipt.status !== "0x1")
        throw new Error(`Transfer to ${recipient} reverted (${txHash})`);

      console.log(
        `  ${recipient}  ->  ${formatUsdc(await usdcBalanceOf(recipient))} USDC`
      );
    }
  } finally {
    await rpc("anvil_stopImpersonatingAccount", [whale]);
  }

  console.log(
    "\nDone. Import one of these accounts into your wallet, or pass your burner address as an argument."
  );
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
