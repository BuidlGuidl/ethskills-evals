/**
 * One-click entry: swap ALL WETH -> USDC on Uniswap V3, then supply EVERY USDC received to Aave V3,
 * as ONE atomic Ethereum-mainnet transaction sent FROM THE USER'S EXISTING EOA.
 *
 * How: EIP-7702 (live since Pectra, May 2025). The EOA signs an authorization that points its code
 * at eth-infinitism's audited, storage-less `Simple7702Account` (ERC-4337 v0.8 reference). The same
 * type-4 transaction then calls the EOA itself -> `executeBatch([...])`, so every call below runs
 * with msg.sender == the user's address. Any revert anywhere reverts the whole batch.
 *
 * The "unknown amount" problem: Aave's `supply()` needs an exact amount, and a static batch can't
 * know what the swap will return. So the swap's `recipient` is a tiny stateless helper
 * (contracts/SupplyAllToAaveV3.sol) whose `supplyAll()` supplies its ENTIRE balance to Aave with
 * `onBehalfOf = msg.sender` (the user). Funds sit in the helper only between two calls of the same tx.
 *
 * Usage (Node 22+):
 *   RPC_URL=...  PRIVATE_KEY=0x...  npx tsx entry.ts            # plan + full simulation, sends nothing
 *   RPC_URL=...  PRIVATE_KEY=0x...  npx tsx entry.ts --send     # ...then asks for a typed "yes" and sends
 *   RPC_URL=...  PRIVATE_KEY=0x...  npx tsx entry.ts deploy-helper   # one-time, from ANY funded account
 *
 * Optional env: SLIPPAGE_BPS (default 50 = 0.5%), MAX_ORACLE_DEVIATION_BPS (default 150),
 *               POOL_FEE (default 500 = the 0.05% WETH/USDC pool), MAX_GAS_ETH (default 0.02).
 *
 * For the real MetaMask user (no key export), see `sendWithWallet()` at the bottom: same calls,
 * submitted via EIP-5792 `wallet_sendCalls` with atomic execution required.
 */
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  concat,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  getContractAddress,
  http,
  keccak256,
  parseAbi,
  parseEther,
  zeroHash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { createInterface } from "node:readline/promises";

// ───────────────────────────── Mainnet addresses (all verified to have code on chain 1) ─────────────
export const ADDR = {
  WETH: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  USDC: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  // Uniswap V3 SwapRouter02 (IV3SwapRouter: exactInputSingle has NO deadline field; we use multicall(deadline,..))
  SWAP_ROUTER_02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
  UNI_QUOTER_V2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),
  // Aave V3 Ethereum "Core" market Pool (proxy) and the aEthUSDC token
  AAVE_POOL: getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"),
  A_USDC: getAddress("0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c"),
  // Chainlink ETH/USD — independent price reference for the slippage floor (8 decimals)
  CHAINLINK_ETH_USD: getAddress("0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"),
  // eth-infinitism Simple7702Account (account-abstraction v0.8.0) — the EIP-7702 delegation target
  SIMPLE_7702_ACCOUNT: getAddress("0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9"),
  // Arachnid deterministic CREATE2 deployer (used to deploy the helper at a predictable address)
  CREATE2_FACTORY: getAddress("0x4e59b44847b379578588920cA78FbF26c0B4956C"),
} as const;

// contracts/SupplyAllToAaveV3.sol compiled with:
//   solc 0.8.20 --optimize --optimize-runs 200 --evm-version shanghai --metadata-hash none --bin
// Anyone can recompile and compare; entry.ts refuses to run unless the on-chain code matches this.
export const HELPER_INITCODE: Hex = "0x608060405234801561000f575f80fd5b506103568061001d5f395ff3fe608060405234801561000f575f80fd5b5060043610610034575f3560e01c80637535d24614610038578063b2422b0514610070575b5f80fd5b6100537387870bca3f3fd6335c3f4ce8392d69350b4fa4e281565b6040516001600160a01b0390911681526020015b60405180910390f35b61008361007e3660046102ab565b610091565b604051908152602001610067565b6040516370a0823160e01b81523060048201525f906001600160a01b038416906370a0823190602401602060405180830381865afa1580156100d5573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906100f991906102e0565b905080158061010757508181105b1561013357604051630da801c760e31b8152600481018290526024810183905260440160405180910390fd5b604080517387870bca3f3fd6335c3f4ce8392d69350b4fa4e26024820152604480820184905282518083039091018152606490910182526020810180516001600160e01b031663095ea7b360e01b17905290515f9182916001600160a01b0387169161019e916102f7565b5f604051808303815f865af19150503d805f81146101d7576040519150601f19603f3d011682016040523d82523d5f602084013e6101dc565b606091505b509150915081158061020a575080511580159061020a5750808060200190518101906102089190610323565b155b1561022857604051633e3f8f7360e01b815260040160405180910390fd5b60405163617ba03760e01b81526001600160a01b0386166004820152602481018490523360448201525f60648201527387870bca3f3fd6335c3f4ce8392d69350b4fa4e29063617ba037906084015f604051808303815f87803b15801561028d575f80fd5b505af115801561029f573d5f803e3d5ffd5b50505050505092915050565b5f80604083850312156102bc575f80fd5b82356001600160a01b03811681146102d2575f80fd5b946020939093013593505050565b5f602082840312156102f0575f80fd5b5051919050565b5f82515f5b8181101561031657602081860181015185830152016102fc565b505f920191825250919050565b5f60208284031215610333575f80fd5b81518015158114610342575f80fd5b939250505056fea164736f6c6343000814000a";
const HELPER_SALT = zeroHash;
export const HELPER_ADDRESS = getContractAddress({
  opcode: "CREATE2",
  from: ADDR.CREATE2_FACTORY,
  salt: HELPER_SALT,
  bytecode: HELPER_INITCODE,
});

// ───────────────────────────── ABIs (only what we call) ─────────────────────────────────────────────
const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const swapRouter02Abi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);
const quoterV2Abi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);
const simple7702Abi = parseAbi([
  "struct Call { address target; uint256 value; bytes data; }",
  "function executeBatch(Call[] calls)",
]);
const helperAbi = parseAbi([
  "function supplyAll(address asset, uint256 minAmount) returns (uint256 amount)",
]);

// ───────────────────────────── Config ───────────────────────────────────────────────────────────────
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? "50");
const MAX_ORACLE_DEVIATION_BPS = BigInt(process.env.MAX_ORACLE_DEVIATION_BPS ?? "150");
const POOL_FEE = Number(process.env.POOL_FEE ?? "500");
const MAX_GAS_ETH = parseEther(process.env.MAX_GAS_ETH ?? "0.02");
const CHAINLINK_MAX_AGE_S = 3600n + 600n; // ETH/USD heartbeat is 1h
const DEADLINE_S = 600n;

// EIP-7702 delegation designator: 0xef0100 || delegate address
const delegationCode = (impl: Address): Hex => concat(["0xef0100", impl]).toLowerCase() as Hex;

function die(msg: string): never {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

// ───────────────────────────── Plan: read state, price, build the batch ─────────────────────────────
export type Plan = {
  user: Address;
  amountIn: bigint;
  quotedOut: bigint;
  oracleOut: bigint;
  minOut: bigint;
  calls: { to: Address; value: bigint; data: Hex }[];
};

export async function buildPlan(client: PublicClient, user: Address): Promise<Plan> {
  const chainId = await client.getChainId();
  if (chainId !== 1) die(`Expected Ethereum mainnet (chainId 1), RPC reports ${chainId}`);

  // The helper must exist AND be byte-for-byte the audited source (not something at a look-alike address).
  const helperCode = await client.getCode({ address: HELPER_ADDRESS });
  if (!helperCode || helperCode === "0x") die(`Helper not deployed at ${HELPER_ADDRESS}. Run: npx tsx entry.ts deploy-helper`);
  const expectedRuntime = await client.call({ data: HELPER_INITCODE }); // run initcode to get runtime
  if (keccak256(helperCode) !== keccak256(expectedRuntime.data!)) die("Helper runtime code does not match HELPER_INITCODE");

  const amountIn = await client.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: "balanceOf", args: [user] });
  if (amountIn === 0n) die(`${user} holds no WETH`);

  // Independent price: Chainlink ETH/USD (8 dec). expected USDC (6 dec) = amountIn(18) * price(8) / 1e20
  const [, answer, , updatedAt] = await client.readContract({ address: ADDR.CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: "latestRoundData" });
  const { timestamp } = await client.getBlock();
  if (answer <= 0n) die("Chainlink returned a non-positive price");
  if (timestamp - updatedAt > CHAINLINK_MAX_AGE_S) die(`Chainlink ETH/USD is stale (${timestamp - updatedAt}s old)`);
  const oracleOut = (amountIn * BigInt(answer)) / 10n ** 20n;

  // Pool quote (QuoterV2 is non-view by design; simulate it)
  const { result } = await client.simulateContract({
    address: ADDR.UNI_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn: ADDR.WETH, tokenOut: ADDR.USDC, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
  });
  const quotedOut = result[0];

  // Refuse if the pool is already off-market (manipulated / thin / wrong fee tier).
  if (quotedOut * 10_000n < oracleOut * (10_000n - MAX_ORACLE_DEVIATION_BPS))
    die(`Uniswap quote ${formatUnits(quotedOut, 6)} USDC is > ${MAX_ORACLE_DEVIATION_BPS} bps below Chainlink-implied ${formatUnits(oracleOut, 6)}`);

  // Floor = the LOWER of the two references minus slippage. Enforced twice on chain:
  // by Uniswap (amountOutMinimum) and by the helper (minAmount).
  const ref = quotedOut < oracleOut ? quotedOut : oracleOut;
  const minOut = (ref * (10_000n - SLIPPAGE_BPS)) / 10_000n;

  const deadline = BigInt(timestamp) + DEADLINE_S;
  const swapCall = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [{
      tokenIn: ADDR.WETH,
      tokenOut: ADDR.USDC,
      fee: POOL_FEE,
      recipient: HELPER_ADDRESS, // USDC goes to the helper, which supplies ALL of it for the user
      amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n,
    }],
  });

  const calls = [
    // 1. Exact approval; the router pulls exactly amountIn, so no allowance survives the tx.
    { to: ADDR.WETH, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ADDR.SWAP_ROUTER_02, amountIn] }) },
    // 2. Swap with a deadline (SwapRouter02's multicall(deadline, data) wrapper).
    { to: ADDR.SWAP_ROUTER_02, value: 0n, data: encodeFunctionData({ abi: swapRouter02Abi, functionName: "multicall", args: [deadline, [swapCall]] }) },
    // 3. Supply everything the swap returned; aUSDC is minted to msg.sender = the user's EOA.
    { to: HELPER_ADDRESS, value: 0n, data: encodeFunctionData({ abi: helperAbi, functionName: "supplyAll", args: [ADDR.USDC, minOut] }) },
  ];

  return { user, amountIn, quotedOut, oracleOut, minOut, calls };
}

const batchData = (plan: Plan): Hex =>
  encodeFunctionData({
    abi: simple7702Abi,
    functionName: "executeBatch",
    args: [plan.calls.map((c) => ({ target: c.to, value: c.value, data: c.data }))],
  });

// ───────────────────────────── Path A: developer / script with a local key (explicit EIP-7702) ─────
async function run(send: boolean) {
  const rpc = process.env.RPC_URL ?? die("Set RPC_URL (ideally a private/MEV-protected endpoint for --send)");
  const pk = (process.env.PRIVATE_KEY ?? die("Set PRIVATE_KEY (never commit it; prefer a hardware wallet in production)")) as Hex;
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });
  const user = account.address;

  // What code does the EOA have today?
  const code = (await publicClient.getCode({ address: user })) ?? "0x";
  const alreadyDelegated = code.toLowerCase() === delegationCode(ADDR.SIMPLE_7702_ACCOUNT);
  if (code !== "0x" && !alreadyDelegated)
    die(`${user} already has code ${code.slice(0, 48)}… (delegated elsewhere?). Refusing to overwrite another delegation.`);

  const plan = await buildPlan(publicClient, user);
  const data = batchData(plan);

  // Simulate the exact batch as it will execute, WITHOUT signing anything yet:
  // state-override the EOA's code with the 7702 designator the authorization would install.
  try {
    await publicClient.call({
      account: user,
      to: user,
      data,
      stateOverride: alreadyDelegated ? undefined : [{ address: user, code: delegationCode(ADDR.SIMPLE_7702_ACCOUNT) }],
    });
  } catch (e) {
    die(`Simulation reverted — nothing sent.\n${(e as Error).message}`);
  }

  const fees = await publicClient.estimateFeesPerGas();
  const aBefore = await publicClient.readContract({ address: ADDR.A_USDC, abi: erc20Abi, functionName: "balanceOf", args: [user] });

  console.log(`
  Account (unchanged address): ${user}
  Delegation:   ${alreadyDelegated ? "already → Simple7702Account" : `will set EOA code → Simple7702Account ${ADDR.SIMPLE_7702_ACCOUNT} (EIP-7702)`}
  Swap:         ${formatEther(plan.amountIn)} WETH → USDC  (Uniswap V3 ${POOL_FEE / 10_000}% pool via SwapRouter02)
  Quote:        ${formatUnits(plan.quotedOut, 6)} USDC   (Chainlink-implied ${formatUnits(plan.oracleOut, 6)})
  Min accepted: ${formatUnits(plan.minOut, 6)} USDC — otherwise the WHOLE tx reverts
  Supply:       100% of swap output → Aave V3 Pool ${ADDR.AAVE_POOL}, aUSDC to ${user}
  Helper:       ${HELPER_ADDRESS} (code hash verified)
  Simulation:   OK`);

  if (!send) return console.log("\n  Dry run only. Re-run with --send to execute.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\n  Type "yes" to sign and send this ONE transaction: ');
  rl.close();
  if (answer.trim() !== "yes") die("Aborted by user — nothing signed.");

  // executor: 'self' → the authorization nonce is (tx nonce + 1), since the same EOA sends the tx.
  const authorizationList = alreadyDelegated
    ? undefined
    : [await walletClient.signAuthorization({ account, contractAddress: ADDR.SIMPLE_7702_ACCOUNT, executor: "self" })];

  const gas = await publicClient.estimateGas({ account, to: user, data, authorizationList });
  const gasLimit = (gas * 130n) / 100n;
  const worstCase = gasLimit * fees.maxFeePerGas;
  if (worstCase > MAX_GAS_ETH) die(`Worst-case gas ${formatEther(worstCase)} ETH exceeds MAX_GAS_ETH`);

  const hash = await walletClient.sendTransaction({
    account,
    to: user, // call yourself: your code is now Simple7702Account, msg.sender == address(this) is authorized
    data,
    authorizationList,
    gas: gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`  Sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") die(`Transaction reverted in block ${receipt.blockNumber}. The batch is atomic: no swap, no supply. (Note: the 7702 delegation itself may still have been applied.)`);

  const aAfter = await publicClient.readContract({ address: ADDR.A_USDC, abi: erc20Abi, functionName: "balanceOf", args: [user] });
  const wethLeft = await publicClient.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: "balanceOf", args: [user] });
  const allowance = await publicClient.readContract({ address: ADDR.WETH, abi: erc20Abi, functionName: "allowance", args: [user, ADDR.SWAP_ROUTER_02] });
  console.log(`
  ✔ Block ${receipt.blockNumber}, gas used ${receipt.gasUsed}
    Supplied: +${formatUnits(aAfter - aBefore, 6)} aUSDC (now ${formatUnits(aAfter, 6)})
    WETH left: ${formatEther(wethLeft)} · leftover WETH→router allowance: ${allowance}
`);
}

// ───────────────────────────── One-time: deploy the helper deterministically ───────────────────────
async function deployHelper() {
  const rpc = process.env.RPC_URL ?? die("Set RPC_URL");
  const account = privateKeyToAccount((process.env.PRIVATE_KEY ?? die("Set PRIVATE_KEY")) as Hex);
  const publicClient = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpc) });
  const existing = await publicClient.getCode({ address: HELPER_ADDRESS });
  if (existing && existing !== "0x") return console.log(`Helper already deployed at ${HELPER_ADDRESS}`);
  const hash = await walletClient.sendTransaction({ account, to: ADDR.CREATE2_FACTORY, data: concat([HELPER_SALT, HELPER_INITCODE]) });
  const r = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Helper deployed at ${HELPER_ADDRESS} (tx ${hash}, status ${r.status})`);
}

// ───────────────────────────── Path B: the real MetaMask user (EIP-5792) ───────────────────────────
/**
 * In a dapp, the user keeps their key in MetaMask. Wallets do not let dapps submit arbitrary 7702
 * authorizations; instead the dapp asks for an ATOMIC batch via `wallet_sendCalls` and MetaMask
 * upgrades the same EOA to its own audited delegator (MetaMask Smart Account) and executes it.
 * The user sees one confirmation; `forceAtomic: true` makes the wallet refuse rather than fall back
 * to sending the calls as separate transactions.
 */
export async function sendWithWallet(publicClient: PublicClient, walletClient: WalletClient) {
  const [user] = await walletClient.getAddresses();
  const caps = await walletClient.getCapabilities({ account: user, chainId: 1 });
  const atomic = (caps as { atomic?: { status?: string } }).atomic?.status;
  if (atomic !== "supported" && atomic !== "ready") throw new Error(`Wallet cannot guarantee atomic batches (atomic=${atomic})`);

  const plan = await buildPlan(publicClient, user);
  const { id } = await walletClient.sendCalls({ account: user, chain: mainnet, calls: plan.calls, forceAtomic: true });
  const status = await walletClient.waitForCallsStatus({ id });
  if (status.status !== "success" || !status.atomic) throw new Error(`Batch failed or was not atomic: ${JSON.stringify(status)}`);
  return status;
}

// ───────────────────────────── CLI ─────────────────────────────────────────────────────────────────
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("entry.ts");
if (isMain) {
  const args = process.argv.slice(2);
  (args[0] === "deploy-helper" ? deployHelper() : run(args.includes("--send"))).catch((e) => die(e?.shortMessage ?? String(e)));
}
