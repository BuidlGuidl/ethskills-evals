/**
 * Fund local accounts with REAL USDC on a Base fork.
 *
 * A fork is a local copy of Base, so instead of deploying a mock token we
 * impersonate an address that already holds USDC and have it send some over.
 * Nothing is broadcast to the real network and no real money moves.
 *
 * Usage:
 *   yarn fund-usdc                      # funds the 10 default anvil accounts, 10k USDC each
 *   yarn fund-usdc 0xYourBurnerAddress  # also funds a specific address (e.g. your burner wallet)
 *   AMOUNT=500 yarn fund-usdc 0xabc...  # custom amount, in whole USDC
 */

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

/** Canonical USDC on Base (6 decimals). */
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Morpho Blue on Base — holds hundreds of millions of USDC, so it can top everyone up. */
const WHALE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

/** The accounts anvil funds by default (mnemonic: "test test ... junk"). */
const ANVIL_ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
];

let rpcId = 0;

async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

const pad = (value) => value.toString(16).padStart(64, "0");

/** ERC-20 transfer(address,uint256) calldata. */
const encodeTransfer = (to, amount) =>
  `0xa9059cbb${pad(BigInt(to))}${pad(amount)}`;

/** ERC-20 balanceOf(address) calldata. */
const encodeBalanceOf = (owner) => `0x70a08231${pad(BigInt(owner))}`;

async function balanceOf(owner) {
  return BigInt(
    await rpc("eth_call", [
      { to: USDC, data: encodeBalanceOf(owner) },
      "latest",
    ])
  );
}

const formatUsdc = (units) =>
  (Number(units) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for a transaction to be mined. The fork runs with `--block-time 1`, so a
 * transaction is queued rather than mined the moment it is sent; reading a balance
 * straight after sending returns the pre-transfer value.
 */
async function waitForReceipt(hash, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      if (BigInt(receipt.status) !== 1n)
        throw new Error(`Transfer ${hash} reverted`);
      return receipt;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${hash} to be mined`);
}

async function main() {
  const extra = process.argv
    .slice(2)
    .filter((arg) => /^0x[0-9a-fA-F]{40}$/.test(arg));
  const invalid = process.argv
    .slice(2)
    .filter((arg) => !/^0x[0-9a-fA-F]{40}$/.test(arg));
  if (invalid.length) {
    console.error(
      `Ignoring arguments that are not addresses: ${invalid.join(", ")}`
    );
  }

  const whole = process.env.AMOUNT ? Number(process.env.AMOUNT) : 10_000;
  if (!Number.isFinite(whole) || whole <= 0) {
    throw new Error(
      `AMOUNT must be a positive number, got "${process.env.AMOUNT}"`
    );
  }
  const amount = BigInt(Math.round(whole * 1e6));

  const chainId = Number(await rpc("eth_chainId"));
  if (chainId !== 31337) {
    throw new Error(
      `Expected the local fork (chain 31337) at ${RPC_URL}, but found chain ${chainId}.`
    );
  }

  const code = await rpc("eth_getCode", [USDC, "latest"]);
  if (!code || code === "0x") {
    throw new Error(
      `No USDC contract at ${USDC} on ${RPC_URL}.\n` +
        `You are probably on an empty chain from \`yarn chain\`.\n` +
        `Start a Base fork instead:  yarn fork --network base`
    );
  }

  const whaleBalance = await balanceOf(WHALE);
  const targets = [
    ...new Set([...ANVIL_ACCOUNTS, ...extra].map((a) => a.toLowerCase())),
  ];
  const needed = amount * BigInt(targets.length);
  if (whaleBalance < needed) {
    throw new Error(
      `Whale ${WHALE} holds ${formatUsdc(whaleBalance)} USDC but ${formatUsdc(
        needed
      )} is needed. ` + `Lower AMOUNT or pick another holder.`
    );
  }

  console.log(
    `Funding ${targets.length} account(s) with ${formatUsdc(
      amount
    )} USDC each from ${WHALE}\n`
  );

  await rpc("anvil_impersonateAccount", [WHALE]);
  // Make sure the impersonated account can pay for gas.
  await rpc("anvil_setBalance", [WHALE, "0x56bc75e2d63100000"]); // 100 ETH

  try {
    for (const to of targets) {
      const hash = await rpc("eth_sendTransaction", [
        { from: WHALE, to: USDC, data: encodeTransfer(to, amount) },
      ]);
      await waitForReceipt(hash);
      console.log(`  ${to}  ->  ${formatUsdc(await balanceOf(to))} USDC`);
    }
  } finally {
    await rpc("anvil_stopImpersonatingAccount", [WHALE]);
  }

  console.log(
    "\nDone. Import one of these accounts into your wallet, or connect the burner wallet."
  );
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
