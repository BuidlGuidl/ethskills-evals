/**
 * Funds an address with USDC (and a little ETH for gas) on the local Base fork.
 *
 * The fork is a local copy of Base, so instead of deploying a mock token we
 * impersonate an account that already holds real USDC and transfer from it.
 * Nothing here is broadcast to Base.
 *
 * Usage: yarn fund <address> [amount-in-usdc]   (default: 1000)
 */

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Accounts that hold large USDC balances on Base. Balances move over time, so we
// try each one and use the first that still holds enough at the forked block.
const WHALES = [
  "0xcDAC0d6c6C59727a65F871236188350531885C43",
  "0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A",
  "0x3304E22DDaa22bCdC5fCa2269b418046aE7b566A",
  "0xF977814e90dA44bFA03b6295A0616a897441aceC",
];

let rpcId = 0;

async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  }).catch(() => {
    throw new Error(
      `Cannot reach ${RPC_URL}. Is the fork running? (yarn fork)`
    );
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

const pad32 = (hex) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
const toHex = (n) => "0x" + n.toString(16);

async function usdcBalanceOf(address) {
  const data = "0x70a08231" + pad32(address);
  return BigInt(await rpc("eth_call", [{ to: USDC, data }, "latest"]));
}

async function waitForReceipt(txHash, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${txHash} to be mined.`);
}

async function main() {
  const [address, amountArg] = process.argv.slice(2);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) {
    console.error("Usage: yarn fund <address> [amount-in-usdc]");
    process.exit(1);
  }
  const amount = BigInt(Math.round(Number(amountArg ?? 1000) * 1e6));

  const chainId = BigInt(await rpc("eth_chainId"));
  if (chainId !== 31337n) {
    console.error(
      `Expected the local fork (chain 31337) at ${RPC_URL}, got chain ${chainId}.`
    );
    process.exit(1);
  }
  if ((await rpc("eth_getCode", [USDC, "latest"])) === "0x") {
    console.error(
      "No USDC contract at the Base USDC address — start the chain with `yarn fork` (a Base fork)."
    );
    process.exit(1);
  }

  let whale;
  for (const candidate of WHALES) {
    if ((await usdcBalanceOf(candidate)) >= amount) {
      whale = candidate;
      break;
    }
  }
  if (!whale)
    throw new Error(
      `None of the known whales holds ${amount / 1000000n} USDC at this block.`
    );

  // Gas money for the impersonated sender and for the account being funded.
  await rpc("anvil_setBalance", [whale, toHex(10n ** 18n)]);
  await rpc("anvil_setBalance", [address, toHex(10n * 10n ** 18n)]);

  await rpc("anvil_impersonateAccount", [whale]);
  let txHash;
  try {
    const data = "0xa9059cbb" + pad32(address) + pad32(toHex(amount));
    txHash = await rpc("eth_sendTransaction", [
      { from: whale, to: USDC, data },
    ]);
  } finally {
    await rpc("anvil_stopImpersonatingAccount", [whale]);
  }

  // The fork mines on an interval, so wait for the transfer to land.
  const receipt = await waitForReceipt(txHash);
  if (BigInt(receipt.status) !== 1n)
    throw new Error(`Transfer reverted (tx ${txHash}).`);

  const balance = await usdcBalanceOf(address);
  console.log(
    `✅ Sent ${Number(amount) / 1e6} USDC from ${whale} to ${address}`
  );
  console.log(`   USDC balance: ${Number(balance) / 1e6}`);
  console.log(
    `   ETH balance:  ${
      Number(BigInt(await rpc("eth_getBalance", [address, "latest"]))) / 1e18
    }`
  );
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
