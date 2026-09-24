// rebalance.ts — turns a rebalance decision into a signed, submitted Ethereum mainnet transaction.
//
// ─── Who holds what ────────────────────────────────────────────────────────────────────────────
//
//   Treasury Safe (SAFE_ADDRESS)          holds the ~$400k of WETH + USDC. Owners: 2-of-3 hardware
//                                         wallets (see DEPLOY.md). The agent is NOT an owner.
//   Zodiac Roles Modifier v2              enabled as a module on the Safe; owned by the Safe.
//     (ROLES_MODIFIER_ADDRESS)            Holds role "rebalancer" (roles-setup.ts), which lets exactly one
//                                         call through: SwapRouter.exactInputSingle WETH<->USDC, 0.05% pool,
//                                         recipient == Safe, per-trade and 24h caps on amountIn.
//   Agent EOA (AGENT_ADDRESS)             the only key on the VM. Holds a small ETH float for gas and
//                                         nothing else. Member of "rebalancer". It cannot transfer tokens,
//                                         cannot send to any address but the Safe, cannot change its role.
//
//   Call path of every trade:
//     Agent EOA ──tx──> Roles.execTransactionWithRole(SwapRouter, 0, exactInputSingle(...), Call, "rebalancer", true)
//                 └──> Safe.execTransactionFromModule(...)  └──> SwapRouter.exactInputSingle  └──> pool 0x88e6…5640
//     Output tokens land in the Safe. Input tokens are pulled from the Safe (the Safe pre-approved SwapRouter).
//
// ─── Contracts touched (mainnet) ───────────────────────────────────────────────────────────────
//   WETH       0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
//   USDC       0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
//   SwapRouter 0xE592427A0AEce92De3Edee1F18E0157C05861564  (Uniswap V3, writes)
//   QuoterV2   0x61fFE014bA17989E743c5F6cB21bF9697530B21e  (eth_call only)
//   Pool       0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640  (USDC/WETH 0.05%)
//   Chainlink  ETH/USD 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419, USDC/USD 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6
//
// ─── Modes ─────────────────────────────────────────────────────────────────────────────────────
//   npx tsx rebalance.ts sell-weth 5            dry run: quotes, simulates, prints the plan, signs nothing
//   npx tsx rebalance.ts sell-usdc 20000 --confirm   prints the plan, waits for "yes" on the terminal
//   EXECUTE=1 npx tsx rebalance.ts sell-weth 5  unattended: submits (what the signal loop / systemd runs)
//   Or import { rebalance } from "./rebalance.ts" in the signal process.
//
//   Per-trade human approval is replaced by the on-chain role: the worst a bug or a stolen key can do is
//   bounded by the Roles caps, not by the checks in this file. The checks here are the tighter, off-chain
//   policy that keeps normal operation well inside those caps.

import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  encodeFunctionData,
  formatEther,
  formatGwei,
  formatUnits,
  getAddress,
  http,
  parseGwei,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { rolesAbi, Status } from "zodiac-roles-sdk";
import {
  ALLOWANCE_KEY_USDC,
  ALLOWANCE_KEY_WETH,
  CHAIN_ID,
  CHAINLINK_ETH_USD,
  CHAINLINK_USDC_USD,
  POOL_FEE,
  QUOTER_V2,
  ROLE_KEY,
  SWAP_ROUTER,
  USDC,
  WETH,
  chainlinkAbi,
  erc20Abi,
  quoterV2Abi,
  safeAbi,
  swapRouterAbi,
} from "./config.ts";

// ─── Off-chain policy (tighter than the on-chain caps) ───────────────────────────────────────────
const POLICY = {
  maxTradeUsd: 50_000,
  maxSlippageBps: 30n, // below min(quote, oracle) price
  maxPoolOracleDeviationBps: 75n, // abort if the pool's quote strays this far from Chainlink
  maxEthUsdAgeSec: 3_600n + 300n, // ETH/USD heartbeat 1h
  maxUsdcUsdAgeSec: 86_400n + 1_800n, // USDC/USD heartbeat 24h
  minUsdcPeg: 99_000_000n, // $0.99 at 8 decimals: stop trading into/out of a de-pegged USDC
  maxFeePerGas: parseGwei("40"),
  maxGasCostUsd: 40,
  swapDeadlineSec: 600n,
  receiptTimeoutMs: 8 * 60_000,
  minAgentEthBalance: 10n ** 16n, // 0.01 ETH — alert and stop below this
} as const;

// ─── Environment ─────────────────────────────────────────────────────────────────────────────────
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env ${name}`);
  return v;
}

const cfg = {
  readRpc: env("RPC_URL"), // your own node or a paid provider; used for all reads, quotes, simulation
  submitRpc: env("SUBMIT_RPC_URL"), // private orderflow, e.g. https://rpc.flashbots.net/fast — keeps the trade out of the public mempool
  safe: getAddress(env("SAFE_ADDRESS")),
  roles: getAddress(env("ROLES_MODIFIER_ADDRESS")),
  agent: getAddress(env("AGENT_ADDRESS")), // expected address of the key file — catches a wrong or swapped key
  keyFile: env("AGENT_KEY_FILE"), // e.g. $CREDENTIALS_DIRECTORY/agent_key from systemd LoadCredentialEncrypted=
  stateDir: process.env.STATE_DIR ?? "/var/lib/rebalancer",
};

// The agent key is read from a file supplied at runtime (never from this repo, never logged).
function loadAgentAccount(): PrivateKeyAccount {
  const raw = readFileSync(cfg.keyFile, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error(`AGENT_KEY_FILE does not contain a 32-byte hex key`);
  const account = privateKeyToAccount(raw as Hex);
  if (account.address !== cfg.agent) {
    throw new Error(`key file resolves to ${account.address}, expected AGENT_ADDRESS ${cfg.agent}`);
  }
  return account;
}

const client: PublicClient = createPublicClient({ chain: mainnet, transport: http(cfg.readRpc) });
const submitClient = createPublicClient({ chain: mainnet, transport: http(cfg.submitRpc) });

const log = (event: string, data: Record<string, unknown> = {}) =>
  console.log(
    JSON.stringify({ t: new Date().toISOString(), event, ...data }, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );

// ─── Types ───────────────────────────────────────────────────────────────────────────────────────
export type Side = "sell-weth" | "sell-usdc";
export interface Decision {
  side: Side;
  amountIn: bigint; // raw units of the input token (WETH 18 dec, USDC 6 dec)
}
export type Mode = "dry-run" | "confirm" | "execute";

const tokenMeta = {
  "sell-weth": { tokenIn: WETH, tokenOut: USDC, decIn: 18, decOut: 6, symIn: "WETH", symOut: "USDC", allowanceKey: ALLOWANCE_KEY_WETH },
  "sell-usdc": { tokenIn: USDC, tokenOut: WETH, decIn: 6, decOut: 18, symIn: "USDC", symOut: "WETH", allowanceKey: ALLOWANCE_KEY_USDC },
} as const;

// ─── Reads ───────────────────────────────────────────────────────────────────────────────────────
async function readFeed(feed: Address, maxAge: bigint, now: bigint): Promise<bigint> {
  const [roundId, answer, , updatedAt, answeredInRound] = await client.readContract({
    address: feed,
    abi: chainlinkAbi,
    functionName: "latestRoundData",
  });
  if (answer <= 0n) throw new Error(`feed ${feed}: non-positive answer`);
  if (answeredInRound < roundId) throw new Error(`feed ${feed}: stale round`);
  if (now - updatedAt > maxAge) throw new Error(`feed ${feed}: last update ${now - updatedAt}s ago`);
  return answer; // 8 decimals
}

// Mirrors Roles v2 allowance accrual so we don't burn gas on a trade the modifier will reject.
async function remainingAllowance(key: Hex, now: bigint): Promise<bigint> {
  const [refill, maxRefill, period, balance, timestamp] = await client.readContract({
    address: cfg.roles,
    abi: rolesAbi,
    functionName: "allowances",
    args: [key],
  });
  if (period === 0n || now < timestamp + period) return balance;
  const intervals = (now - timestamp) / period;
  if (balance >= maxRefill) return balance;
  const accrued = balance + refill * intervals;
  return accrued < maxRefill ? accrued : maxRefill;
}

async function assertWiring(): Promise<void> {
  const chainId = await client.getChainId();
  if (chainId !== CHAIN_ID) throw new Error(`RPC_URL is chain ${chainId}, expected ${CHAIN_ID}`);
  const [avatar, target, enabled] = await Promise.all([
    client.readContract({ address: cfg.roles, abi: rolesAbi, functionName: "avatar" }),
    client.readContract({ address: cfg.roles, abi: rolesAbi, functionName: "target" }),
    client.readContract({ address: cfg.safe, abi: safeAbi, functionName: "isModuleEnabled", args: [cfg.roles] }),
  ]);
  if (getAddress(avatar) !== cfg.safe || getAddress(target) !== cfg.safe) {
    throw new Error(`Roles modifier avatar/target (${avatar}/${target}) is not the Safe ${cfg.safe}`);
  }
  if (!enabled) throw new Error(`Roles modifier is not enabled on the Safe (revoked?) — refusing to trade`);
}

// ─── One-in-flight guard ─────────────────────────────────────────────────────────────────────────
// Private orderflow means a pending tx is invisible to RPC_URL, so the pending nonce there can't be
// trusted. We record what we submitted and refuse to submit again until it is mined or its swap
// deadline has passed (after which it can only revert if it ever lands).
interface InFlight { hash: Hex; nonce: number; deadline: string }
const inflightPath = () => `${cfg.stateDir}/inflight.json`;
const lockPath = () => `${cfg.stateDir}/rebalance.lock`;

async function assertNothingInFlight(now: bigint): Promise<void> {
  if (!existsSync(inflightPath())) return;
  const prev = JSON.parse(readFileSync(inflightPath(), "utf8")) as InFlight;
  const receipt = await client.getTransactionReceipt({ hash: prev.hash }).catch(() => null);
  if (receipt) {
    log("previous_tx_resolved", { hash: prev.hash, status: receipt.status });
    unlinkSync(inflightPath());
    return;
  }
  if (now <= BigInt(prev.deadline) + 120n) {
    throw new Error(`previous tx ${prev.hash} (nonce ${prev.nonce}) still in flight until deadline ${prev.deadline}`);
  }
  log("previous_tx_expired", { ...prev });
  unlinkSync(inflightPath());
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let fd: number;
  try {
    fd = openSync(lockPath(), "wx");
  } catch {
    throw new Error(`another rebalance holds ${lockPath()} (remove it by hand only if no process is running)`);
  }
  return fn().finally(() => {
    closeSync(fd);
    unlinkSync(lockPath());
  });
}

// ─── The execution path ──────────────────────────────────────────────────────────────────────────
export async function rebalance(decision: Decision, mode: Mode): Promise<Hex | null> {
  return withLock(() => rebalanceUnlocked(decision, mode));
}

async function rebalanceUnlocked({ side, amountIn }: Decision, mode: Mode): Promise<Hex | null> {
  const m = tokenMeta[side];
  if (amountIn <= 0n) throw new Error("amountIn must be positive");

  await assertWiring();
  const block = await client.getBlock();
  const now = block.timestamp;
  await assertNothingInFlight(BigInt(Math.floor(Date.now() / 1000)));

  // 1. Prices from Chainlink (independent of the pool we are about to trade in).
  const [ethUsd, usdcUsd] = await Promise.all([
    readFeed(CHAINLINK_ETH_USD, POLICY.maxEthUsdAgeSec, now),
    readFeed(CHAINLINK_USDC_USD, POLICY.maxUsdcUsdAgeSec, now),
  ]);
  if (usdcUsd < POLICY.minUsdcPeg) throw new Error(`USDC/USD at ${formatUnits(usdcUsd, 8)} — below peg floor, halting`);

  const tradeUsd =
    side === "sell-weth" ? Number(formatUnits(amountIn * ethUsd, 26)) : Number(formatUnits(amountIn * usdcUsd, 14));
  if (tradeUsd > POLICY.maxTradeUsd) throw new Error(`trade ~$${tradeUsd.toFixed(0)} exceeds policy max $${POLICY.maxTradeUsd}`);

  // 2. Balances and on-chain allowance headroom.
  const [safeBalanceIn, routerAllowance, capLeft, agentEth] = await Promise.all([
    client.readContract({ address: m.tokenIn, abi: erc20Abi, functionName: "balanceOf", args: [cfg.safe] }),
    client.readContract({ address: m.tokenIn, abi: erc20Abi, functionName: "allowance", args: [cfg.safe, SWAP_ROUTER] }),
    remainingAllowance(m.allowanceKey, now),
    client.getBalance({ address: cfg.agent }),
  ]);
  if (safeBalanceIn < amountIn) throw new Error(`Safe holds ${formatUnits(safeBalanceIn, m.decIn)} ${m.symIn}, need ${formatUnits(amountIn, m.decIn)}`);
  if (routerAllowance < amountIn) throw new Error(`Safe has not approved SwapRouter for ${m.symIn} (owner action, see DEPLOY.md)`);
  if (capLeft < amountIn) throw new Error(`on-chain 24h cap: ${formatUnits(capLeft, m.decIn)} ${m.symIn} left, trade needs ${formatUnits(amountIn, m.decIn)}`);
  if (agentEth < POLICY.minAgentEthBalance) throw new Error(`agent gas float is ${formatEther(agentEth)} ETH — top it up`);

  // 3. Expected output from the oracle, and from the pool.
  const oracleOut =
    side === "sell-weth"
      ? (amountIn * ethUsd) / usdcUsd / 10n ** 12n // WETH(18) -> USDC(6)
      : (amountIn * usdcUsd * 10n ** 12n) / ethUsd; // USDC(6) -> WETH(18)

  const { result: [quoteOut] } = await client.simulateContract({
    address: QUOTER_V2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn: m.tokenIn, tokenOut: m.tokenOut, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
  });

  const deviationBps = ((oracleOut - quoteOut) * 10_000n) / oracleOut; // positive = pool pays less than oracle
  const absDev = deviationBps < 0n ? -deviationBps : deviationBps;
  if (absDev > POLICY.maxPoolOracleDeviationBps) {
    throw new Error(`pool quote deviates ${deviationBps} bps from Chainlink — possible manipulation or stale feed, not trading`);
  }
  const reference = quoteOut < oracleOut ? quoteOut : oracleOut;
  const amountOutMinimum = (reference * (10_000n - POLICY.maxSlippageBps)) / 10_000n;

  // 4. Build the swap, wrapped in the Roles call.
  const deadline = now + POLICY.swapDeadlineSec;
  const swapData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "exactInputSingle",
    args: [{
      tokenIn: m.tokenIn,
      tokenOut: m.tokenOut,
      fee: POOL_FEE,
      recipient: cfg.safe, // the role rejects any other recipient
      deadline,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    }],
  });
  const rolesArgs = [SWAP_ROUTER, 0n, swapData, 0 /* Call */, ROLE_KEY, true /* revert if inner call fails */] as const;

  // 5. Simulate from the agent address: proves the role admits this exact call and the swap clears min-out.
  try {
    await client.simulateContract({
      account: cfg.agent,
      address: cfg.roles,
      abi: rolesAbi,
      functionName: "execTransactionWithRole",
      args: rolesArgs,
    });
  } catch (err) {
    throw new Error(`simulation failed: ${describeRevert(err)}`);
  }

  // 6. Gas, priced live.
  const data = encodeFunctionData({ abi: rolesAbi, functionName: "execTransactionWithRole", args: rolesArgs });
  const gasEstimate = await client.estimateGas({ account: cfg.agent, to: cfg.roles, data });
  const gas = (gasEstimate * 125n) / 100n;
  const fees = await client.estimateFeesPerGas();
  if (fees.maxFeePerGas > POLICY.maxFeePerGas) {
    throw new Error(`maxFeePerGas ${formatGwei(fees.maxFeePerGas)} gwei above cap ${formatGwei(POLICY.maxFeePerGas)} — deferring`);
  }
  const maxGasCostWei = gas * fees.maxFeePerGas;
  const maxGasCostUsd = Number(formatUnits(maxGasCostWei * ethUsd, 26));
  if (maxGasCostUsd > POLICY.maxGasCostUsd) throw new Error(`gas up to $${maxGasCostUsd.toFixed(2)} above cap — deferring`);

  const plan = {
    mode,
    side,
    from_safe: cfg.safe,
    amount_in: `${formatUnits(amountIn, m.decIn)} ${m.symIn}`,
    trade_usd: tradeUsd.toFixed(2),
    expected_out_pool: `${formatUnits(quoteOut, m.decOut)} ${m.symOut}`,
    expected_out_oracle: `${formatUnits(oracleOut, m.decOut)} ${m.symOut}`,
    min_out: `${formatUnits(amountOutMinimum, m.decOut)} ${m.symOut}`,
    pool_vs_oracle_bps: deviationBps,
    recipient: cfg.safe,
    via: `Roles ${cfg.roles} -> SwapRouter ${SWAP_ROUTER}`,
    signer: cfg.agent,
    gas_limit: gas,
    max_fee_gwei: formatGwei(fees.maxFeePerGas),
    max_gas_cost: `${formatEther(maxGasCostWei)} ETH (~$${maxGasCostUsd.toFixed(2)} at Chainlink ETH/USD ${formatUnits(ethUsd, 8)})`,
    cap_left_24h: `${formatUnits(capLeft, m.decIn)} ${m.symIn}`,
    deadline,
  };
  log("plan", plan);

  // 7. Gate.
  if (mode === "dry-run") {
    log("dry_run_stop", { note: "nothing signed; pass --confirm or set EXECUTE=1 to submit" });
    return null;
  }
  if (mode === "confirm") {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const answer = await rl.question(
      `\nSwap ${plan.amount_in} -> min ${plan.min_out}, recipient ${cfg.safe}, gas up to ${plan.max_gas_cost}. Type "yes" to sign and submit: `,
    );
    rl.close();
    if (answer.trim() !== "yes") {
      log("declined");
      return null;
    }
  }

  // 8. Sign locally, submit privately.
  const account = loadAgentAccount();
  const nonce = await client.getTransactionCount({ address: account.address, blockTag: "pending" });
  const signed = await account.signTransaction({
    chainId: CHAIN_ID,
    type: "eip1559",
    to: cfg.roles,
    data,
    value: 0n,
    nonce,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const hash = await submitClient.sendRawTransaction({ serializedTransaction: signed });
  writeFileSync(inflightPath(), JSON.stringify({ hash, nonce, deadline: deadline.toString() } satisfies InFlight));
  log("submitted", { hash, nonce });

  // 9. Wait and verify.
  const receipt = await client
    .waitForTransactionReceipt({ hash, timeout: POLICY.receiptTimeoutMs })
    .catch((e) => {
      log("receipt_timeout", { hash, error: String(e) });
      return null;
    });
  if (!receipt) return hash; // left in inflight.json; next run waits for it or for the deadline
  unlinkSync(inflightPath());
  if (receipt.status !== "success") throw new Error(`tx ${hash} reverted in block ${receipt.blockNumber}`);

  const [wethAfter, usdcAfter] = await Promise.all([
    client.readContract({ address: WETH, abi: erc20Abi, functionName: "balanceOf", args: [cfg.safe] }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [cfg.safe] }),
  ]);
  log("confirmed", {
    hash,
    block: receipt.blockNumber,
    gas_used: receipt.gasUsed,
    gas_cost_eth: formatEther(receipt.gasUsed * receipt.effectiveGasPrice),
    safe_weth: formatUnits(wethAfter, 18),
    safe_usdc: formatUnits(usdcAfter, 6),
  });
  return hash;
}

function describeRevert(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (revert?.data?.errorName === "ConditionViolation") {
      const [status] = revert.data.args as [number, Hex];
      return `Roles ConditionViolation: ${Status[status] ?? status} (the role does not permit this call)`;
    }
    if (revert?.data?.errorName) return `${revert.data.errorName}(${(revert.data.args ?? []).join(", ")})`;
    if (revert?.reason) return revert.reason;
    return err.shortMessage;
  }
  return String(err);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const [side, amount, ...flags] = process.argv.slice(2);
  if ((side !== "sell-weth" && side !== "sell-usdc") || !amount) {
    console.error("usage: rebalance.ts <sell-weth|sell-usdc> <amount in token units> [--confirm]");
    process.exit(2);
  }
  const amountIn = parseUnits(amount, tokenMeta[side].decIn);
  const mode: Mode = flags.includes("--confirm") ? "confirm" : process.env.EXECUTE === "1" ? "execute" : "dry-run";
  await rebalance({ side, amountIn }, mode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    log("error", { message: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}
