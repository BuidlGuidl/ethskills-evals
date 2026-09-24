/**
 * rebalance.ts — turns a rebalance decision into a signed, submitted mainnet transaction.
 *
 * AUTHORITY MODEL (read DEPLOY.md before running this with real funds)
 *
 *   Treasury Safe (2-of-3, owner keys on separate hardware wallets)   SAFE_ADDRESS
 *     holds all WETH + USDC. The agent key is NOT an owner.
 *        │ module
 *   Zodiac Roles Modifier v2                                          ROLES_MODIFIER_ADDRESS
 *     role "rebalancer" allows exactly one call:
 *       SwapRouter02.exactInputSingle(
 *         tokenIn/tokenOut ∈ {WETH→USDC, USDC→WETH}, fee = 500,
 *         recipient == Safe, amountIn within a daily on-chain allowance)
 *        │ execTransactionWithRole(...)
 *   Agent EOA (this process)                                          derived from AGENT_PRIVATE_KEY
 *     holds only ETH for gas. Can trade inside the role; cannot transfer,
 *     approve, withdraw, change its own limits, or change who signs.
 *
 * Contracts touched (Ethereum mainnet, chainId 1):
 *   WETH                         0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *   USDC                         0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   Uniswap V3 SwapRouter02      0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
 *   Uniswap V3 QuoterV2          0x61fFE014bA17989E743c5F6cB21bF9697530B21e
 *   Uniswap V3 WETH/USDC 0.05%   0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 (the pool the router hits)
 *   Chainlink ETH/USD            0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
 *   Chainlink USDC/USD           0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6
 *   Your Safe, your Roles Modifier instance — from env, see DEPLOY.md.
 *
 * Usage:
 *   npx tsx rebalance.ts SELL_WETH 12.5            # dry run: quote, simulate, price gas, print, stop
 *   npx tsx rebalance.ts BUY_WETH 30000 --execute  # sign and submit (what the agent service calls)
 *
 *   Or from the signal process:  await executeRebalance({ direction, amountIn }, { execute: true })
 *
 * Exit codes: 0 = done / dry run ok, 2 = refused by policy (safe to retry later),
 *             3 = unresolved pending tx (needs a look), 1 = anything else.
 */

import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseAbi,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ───────────────────────────── Contracts ─────────────────────────────

const WETH = getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const SWAP_ROUTER_02 = getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45");
const QUOTER_V2 = getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e");
const FEED_ETH_USD = getAddress("0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419");
const FEED_USDC_USD = getAddress("0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6");
const POOL_FEE = 500; // 0.05% tier — the deepest WETH/USDC pool. Must match the role's pinned fee.

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

const swapRouterAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);

const quoterV2Abi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

// Zodiac Roles Modifier v2
const rolesAbi = parseAbi([
  "function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)",
]);

// ───────────────────────────── Policy ─────────────────────────────
// Off-chain limits. The on-chain role allowance is the real boundary; these are
// tighter so the agent refuses bad trades before they ever reach the chain.

const POLICY = {
  minTradeUsd: 1_000,
  maxTradeUsd: 50_000,
  maxDailyNotionalUsd: 100_000, // both directions combined; keep <= each on-chain daily allowance (DEPLOY.md §4)
  maxSlippageBps: 30n, // amountOutMinimum = quote * (1 - 0.30%)
  maxOracleDeviationBps: 100n, // refuse if the pool quote is >1% worse than Chainlink
  ethUsdMaxAgeSec: 3_600 + 600, // feed heartbeat 1h + margin
  usdcUsdMaxAgeSec: 86_400 + 3_600, // feed heartbeat 24h + margin
  usdcPegToleranceBps: 100n, // halt if USDC/USD is off $1 by >1%
  maxBaseFeeGwei: 60n,
  maxGasCostUsd: 40,
  gasLimitBufferPct: 25n,
  receiptTimeoutMs: 180_000,
} as const;

// ───────────────────────────── Config ─────────────────────────────

type Direction = "SELL_WETH" | "BUY_WETH";
export type RebalanceDecision = { direction: Direction; amountIn: bigint };

class PolicyRefusal extends Error {}
class PendingTxUnresolved extends Error {}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name} (see DEPLOY.md §6)`);
  return v;
}

function loadConfig() {
  // AGENT_PRIVATE_KEY is injected at runtime by the secret manager. It has no default
  // and must never appear in this repo, a .env that is committed, a prompt, or a ticket.
  const key = requireEnv("AGENT_PRIVATE_KEY") as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("AGENT_PRIVATE_KEY is not a 32-byte hex key");
  return {
    readRpcUrl: requireEnv("RPC_URL"), // your paid mainnet RPC (reads, simulation, receipts)
    // Private submission so trades aren't sandwiched from the public mempool.
    submitRpcUrl: process.env.SUBMIT_RPC_URL ?? "https://rpc.flashbots.net/fast",
    account: privateKeyToAccount(key),
    safe: getAddress(requireEnv("SAFE_ADDRESS")),
    roles: getAddress(requireEnv("ROLES_MODIFIER_ADDRESS")),
    roleKey: stringToHex(process.env.ROLE_KEY ?? "rebalancer", { size: 32 }),
    stateDir: process.env.STATE_DIR ?? join(process.cwd(), "state"),
  };
}

// ───────────────────────────── Local state ─────────────────────────────
// Private submission means the public mempool never sees our pending tx, so a
// "pending" nonce read from RPC_URL can't be trusted. We track it ourselves.

type State = {
  day: string; // UTC yyyy-mm-dd
  notionalUsdToday: number;
  pending?: { hash: Hex; nonce: number; sentAt: string; decision: string };
  history: { hash: Hex; day: string; notionalUsd: number; status: string }[];
};

function readState(dir: string): State {
  const f = join(dir, "state.json");
  const today = new Date().toISOString().slice(0, 10);
  const s: State = existsSync(f)
    ? JSON.parse(readFileSync(f, "utf8"))
    : { day: today, notionalUsdToday: 0, history: [] };
  if (s.day !== today) {
    s.day = today;
    s.notionalUsdToday = 0;
  }
  return s;
}

function writeState(dir: string, s: State) {
  const f = join(dir, "state.json");
  writeFileSync(f + ".tmp", JSON.stringify(s, null, 2));
  renameSync(f + ".tmp", f);
}

function withLock<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, "rebalance.lock");
  let fd: number;
  try {
    fd = openSync(lock, "wx"); // fails if another run holds it
  } catch {
    throw new PolicyRefusal(`another rebalance is running (or crashed): ${lock}. Remove it only after checking state.json.`);
  }
  closeSync(fd);
  return fn().finally(() => unlinkSync(lock));
}

// ───────────────────────────── Helpers ─────────────────────────────

const usd6 = (x: bigint) => Number(x) / 1e6;
const fmtUsd = (x: number) => `$${x.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// ───────────────────────────── Execution path ─────────────────────────────

export async function executeRebalance(decision: RebalanceDecision, opts: { execute: boolean }) {
  const cfg = loadConfig();
  const client = createPublicClient({ chain: mainnet, transport: http(cfg.readRpcUrl) });
  const submitter = createPublicClient({ chain: mainnet, transport: http(cfg.submitRpcUrl) });
  const agent = cfg.account.address;

  return withLock(cfg.stateDir, async () => {
    const state = readState(cfg.stateDir);

    // 0. Chain + unresolved pending tx.
    const chainId = await client.getChainId();
    if (chainId !== 1) throw new Error(`RPC_URL is chain ${chainId}, expected mainnet (1)`);
    await resolvePending(client, cfg.stateDir, state, agent);

    // 1. Trade shape. The role enforces the same pair, fee and recipient on-chain.
    const [tokenIn, tokenOut] = decision.direction === "SELL_WETH" ? [WETH, USDC] : [USDC, WETH];
    const [decIn, decOut] = decision.direction === "SELL_WETH" ? [18, 6] : [6, 18];
    const symIn = decision.direction === "SELL_WETH" ? "WETH" : "USDC";
    const symOut = decision.direction === "SELL_WETH" ? "USDC" : "WETH";
    const { amountIn } = decision;
    if (amountIn <= 0n) throw new PolicyRefusal("amountIn must be positive");

    // 2. Live prices from Chainlink — never a remembered price.
    const block = await client.getBlock();
    const now = block.timestamp;
    const [ethUsd, usdcUsd] = await Promise.all([
      readFeed(client, FEED_ETH_USD, now, POLICY.ethUsdMaxAgeSec, "ETH/USD"),
      readFeed(client, FEED_USDC_USD, now, POLICY.usdcUsdMaxAgeSec, "USDC/USD"),
    ]);
    const pegDev = usdcUsd > 100_000_000n ? usdcUsd - 100_000_000n : 100_000_000n - usdcUsd;
    if (pegDev * 10_000n > POLICY.usdcPegToleranceBps * 100_000_000n)
      throw new PolicyRefusal(`USDC/USD at ${formatUnits(usdcUsd, 8)} — off peg, halting`);

    // Notional in 6-decimal USD. Chainlink ETH/USD has 8 decimals; WETH has 18.
    const notionalUsd6 = decision.direction === "SELL_WETH" ? (amountIn * ethUsd) / 10n ** 20n : amountIn;
    const notionalUsd = usd6(notionalUsd6);
    if (notionalUsd < POLICY.minTradeUsd || notionalUsd > POLICY.maxTradeUsd)
      throw new PolicyRefusal(`trade ${fmtUsd(notionalUsd)} outside [${POLICY.minTradeUsd}, ${POLICY.maxTradeUsd}]`);
    if (state.notionalUsdToday + notionalUsd > POLICY.maxDailyNotionalUsd)
      throw new PolicyRefusal(`daily cap: ${fmtUsd(state.notionalUsdToday)} already traded today`);

    // 3. Safe has the tokens and has approved the router (owners set this once; the agent can't).
    const [balIn, allowanceIn, balOutBefore] = await Promise.all([
      client.readContract({ address: tokenIn, abi: erc20Abi, functionName: "balanceOf", args: [cfg.safe] }),
      client.readContract({ address: tokenIn, abi: erc20Abi, functionName: "allowance", args: [cfg.safe, SWAP_ROUTER_02] }),
      client.readContract({ address: tokenOut, abi: erc20Abi, functionName: "balanceOf", args: [cfg.safe] }),
    ]);
    if (balIn < amountIn) throw new PolicyRefusal(`Safe holds ${formatUnits(balIn, decIn)} ${symIn} < ${formatUnits(amountIn, decIn)}`);
    if (allowanceIn < amountIn) throw new PolicyRefusal(`Safe's ${symIn} allowance to SwapRouter02 too low — owners must re-approve (DEPLOY.md §4)`);

    // 4. Quote and sanity-check against the oracle.
    const { result: quote } = await client.simulateContract({
      address: QUOTER_V2,
      abi: quoterV2Abi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn, tokenOut, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
    });
    const quotedOut = quote[0];
    const oracleOut = decision.direction === "SELL_WETH" ? (amountIn * ethUsd) / 10n ** 20n : (amountIn * 10n ** 20n) / ethUsd;
    if (quotedOut * 10_000n < oracleOut * (10_000n - POLICY.maxOracleDeviationBps))
      throw new PolicyRefusal(
        `pool quote ${formatUnits(quotedOut, decOut)} ${symOut} is >${POLICY.maxOracleDeviationBps}bps worse than oracle ${formatUnits(oracleOut, decOut)} — pool manipulated or illiquid`,
      );
    const amountOutMinimum = (quotedOut * (10_000n - POLICY.maxSlippageBps)) / 10_000n;

    // 5. Build: the inner swap (Safe → router) wrapped in the role call (agent → Roles Modifier).
    const swapParams = {
      tokenIn,
      tokenOut,
      fee: POOL_FEE,
      recipient: cfg.safe, // pinned by the role; anything else reverts on-chain
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    };
    const swapData = encodeFunctionData({ abi: swapRouterAbi, functionName: "exactInputSingle", args: [swapParams] });
    const outerData = encodeFunctionData({
      abi: rolesAbi,
      functionName: "execTransactionWithRole",
      // operation 0 = CALL (never DELEGATECALL); shouldRevert = true so an inner failure fails the tx
      args: [SWAP_ROUTER_02, 0n, swapData, 0, cfg.roleKey, true],
    });

    // 6. Simulate the real call, then prove the role is actually scoped: the same swap
    //    paid to the agent, and a plain transfer to the agent, must both be rejected.
    await client.call({ account: agent, to: cfg.roles, data: outerData }).catch((e) => {
      throw new PolicyRefusal(`simulation of the rebalance reverted: ${short(e)}`);
    });
    await assertScoped(client, cfg, agent, swapParams, tokenIn);

    // 7. Gas, priced live.
    const [gasEstimate, fees, agentEth] = await Promise.all([
      client.estimateGas({ account: agent, to: cfg.roles, data: outerData }),
      client.estimateFeesPerGas(),
      client.getBalance({ address: agent }),
    ]);
    const baseFee = block.baseFeePerGas ?? 0n;
    if (baseFee > POLICY.maxBaseFeeGwei * 10n ** 9n)
      throw new PolicyRefusal(`base fee ${formatUnits(baseFee, 9)} gwei > cap ${POLICY.maxBaseFeeGwei}`);
    const gas = (gasEstimate * (100n + POLICY.gasLimitBufferPct)) / 100n;
    const maxGasCostWei = gas * fees.maxFeePerGas;
    const maxGasCostUsd = usd6((maxGasCostWei * ethUsd) / 10n ** 20n);
    if (maxGasCostUsd > POLICY.maxGasCostUsd) throw new PolicyRefusal(`gas up to ${fmtUsd(maxGasCostUsd)} > cap`);
    if (agentEth < maxGasCostWei) throw new PolicyRefusal(`agent gas float ${formatEther(agentEth)} ETH too low — top up`);

    // 8. Print exactly what will be signed.
    console.log(
      [
        `── rebalance ${opts.execute ? "(EXECUTE)" : "(dry run)"} ──`,
        `  signer (agent EOA)   ${agent}`,
        `  tx to (Roles Mod.)   ${cfg.roles}`,
        `  inner call           SwapRouter02.exactInputSingle @ ${SWAP_ROUTER_02}`,
        `  funds from / to      Safe ${cfg.safe}`,
        `  sell                 ${formatUnits(amountIn, decIn)} ${symIn}  (~${fmtUsd(notionalUsd)})`,
        `  quote / min out      ${formatUnits(quotedOut, decOut)} / ${formatUnits(amountOutMinimum, decOut)} ${symOut}`,
        `  ETH/USD (Chainlink)  ${formatUnits(ethUsd, 8)}`,
        `  gas                  ${gas} units, max ${formatEther(maxGasCostWei)} ETH (~${fmtUsd(maxGasCostUsd)})`,
        `  traded today         ${fmtUsd(state.notionalUsdToday)} of ${fmtUsd(POLICY.maxDailyNotionalUsd)}`,
      ].join("\n"),
    );
    if (!opts.execute) {
      console.log("dry run — nothing signed. Re-run with --execute to submit.");
      return { submitted: false as const };
    }

    // 9. Sign locally, record the hash BEFORE broadcasting, then submit privately.
    const nonce = await client.getTransactionCount({ address: agent, blockTag: "latest" });
    const signed = await cfg.account.signTransaction({
      chainId: 1,
      type: "eip1559",
      to: cfg.roles,
      data: outerData,
      value: 0n,
      nonce,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    const hash = keccak256(signed);
    state.pending = { hash, nonce, sentAt: new Date().toISOString(), decision: `${decision.direction} ${formatUnits(amountIn, decIn)}` };
    state.notionalUsdToday += notionalUsd; // count it now; a failed tx is reconciled below
    writeState(cfg.stateDir, state);

    await submitter.sendRawTransaction({ serializedTransaction: signed });
    console.log(`submitted ${hash} (nonce ${nonce}) via ${new URL(cfg.submitRpcUrl).host}`);

    // 10. Confirm and verify the Safe actually received at least amountOutMinimum.
    const receipt = await client
      .waitForTransactionReceipt({ hash, timeout: POLICY.receiptTimeoutMs })
      .catch(() => {
        throw new PendingTxUnresolved(`${hash} not mined within ${POLICY.receiptTimeoutMs / 1000}s — left pending in state.json; next run will reconcile`);
      });
    state.pending = undefined;
    if (receipt.status !== "success") {
      state.notionalUsdToday -= notionalUsd;
      state.history.push({ hash, day: state.day, notionalUsd, status: "reverted" });
      writeState(cfg.stateDir, state);
      throw new Error(`tx ${hash} reverted in block ${receipt.blockNumber}`);
    }
    const balOutAfter = await client.readContract({
      address: tokenOut, abi: erc20Abi, functionName: "balanceOf", args: [cfg.safe], blockNumber: receipt.blockNumber,
    });
    const received = balOutAfter - balOutBefore;
    state.history.push({ hash, day: state.day, notionalUsd, status: "success" });
    writeState(cfg.stateDir, state);
    if (received < amountOutMinimum)
      console.error(`WARNING: Safe ${symOut} delta ${formatUnits(received, decOut)} < min out — investigate concurrent Safe activity`);
    console.log(`confirmed in block ${receipt.blockNumber}: Safe received ${formatUnits(received, decOut)} ${symOut}`);
    return { submitted: true as const, hash, received };
  });
}

async function readFeed(client: ReturnType<typeof createPublicClient>, feed: Address, now: bigint, maxAge: number, label: string) {
  const [, answer, , updatedAt] = await client.readContract({ address: feed, abi: chainlinkAbi, functionName: "latestRoundData" });
  if (answer <= 0n) throw new PolicyRefusal(`${label} feed returned ${answer}`);
  if (now - updatedAt > BigInt(maxAge)) throw new PolicyRefusal(`${label} feed stale: updated ${now - updatedAt}s ago`);
  return answer;
}

/** Refuse to run if the role would let this key move funds anywhere but back into the Safe. */
async function assertScoped(
  client: ReturnType<typeof createPublicClient>,
  cfg: ReturnType<typeof loadConfig>,
  agent: Address,
  swapParams: { tokenIn: Address; tokenOut: Address; fee: number; recipient: Address; amountIn: bigint; amountOutMinimum: bigint; sqrtPriceLimitX96: bigint },
  tokenIn: Address,
) {
  const probes: { label: string; to: Address; data: Hex }[] = [
    {
      label: "swap with recipient = agent",
      to: SWAP_ROUTER_02,
      data: encodeFunctionData({ abi: swapRouterAbi, functionName: "exactInputSingle", args: [{ ...swapParams, recipient: agent }] }),
    },
    {
      label: "token transfer to agent",
      to: tokenIn,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [agent, 1n] }),
    },
  ];
  for (const p of probes) {
    const data = encodeFunctionData({ abi: rolesAbi, functionName: "execTransactionWithRole", args: [p.to, 0n, p.data, 0, cfg.roleKey, true] });
    const allowed = await client.call({ account: agent, to: cfg.roles, data }).then(() => true, () => false);
    if (allowed) throw new Error(`ROLE MISCONFIGURED: "${p.label}" is permitted. The agent key can drain the Safe. Halting; revoke the role (DEPLOY.md §1).`);
  }
}

async function resolvePending(client: ReturnType<typeof createPublicClient>, dir: string, state: State, agent: Address) {
  if (!state.pending) return;
  const { hash, nonce } = state.pending;
  const receipt = await client.getTransactionReceipt({ hash }).catch(() => undefined);
  if (receipt) {
    state.history.push({ hash, day: state.day, notionalUsd: 0, status: `reconciled:${receipt.status}` });
    state.pending = undefined;
    writeState(dir, state);
    return;
  }
  const mined = await client.getTransactionCount({ address: agent, blockTag: "latest" });
  if (mined > nonce) {
    // Nonce consumed by something other than our recorded tx: someone else is using this key.
    throw new PendingTxUnresolved(`nonce ${nonce} used by a tx other than ${hash} — possible key compromise. Revoke the role (DEPLOY.md §1).`);
  }
  throw new PendingTxUnresolved(`tx ${hash} (nonce ${nonce}) still pending since ${state.pending.sentAt}; refusing to stack another trade`);
}

function short(e: unknown) {
  return (e as { shortMessage?: string }).shortMessage ?? String(e);
}

// ───────────────────────────── CLI ─────────────────────────────

async function main() {
  const [dir, amount, ...flags] = process.argv.slice(2);
  if ((dir !== "SELL_WETH" && dir !== "BUY_WETH") || !amount) {
    console.error("usage: tsx rebalance.ts <SELL_WETH|BUY_WETH> <amountIn in token units> [--execute]");
    process.exit(1);
  }
  const amountIn = parseUnits(amount, dir === "SELL_WETH" ? 18 : 6);
  await executeRebalance({ direction: dir, amountIn }, { execute: flags.includes("--execute") });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(e instanceof PolicyRefusal ? 2 : e instanceof PendingTxUnresolved ? 3 : 1);
  });
}
