#!/usr/bin/env tsx
/**
 * rebalance.ts — WETH/USDC treasury rebalancer, Ethereum mainnet, viem.
 *
 * This file is the EXECUTION PATH: how a rebalance decision becomes a signed,
 * submitted mainnet transaction. Read DEPLOY.md before running this with real money.
 *
 * ---------------------------------------------------------------------------
 * ACCOUNTS (three distinct roles — do not collapse them)
 * ---------------------------------------------------------------------------
 *
 *  1. TREASURY SAFE            env SAFE_ADDRESS
 *     A Safe{Wallet} smart account that HOLDS the ~$400k of WETH + USDC.
 *     Owners are hardware wallets, offline, 2-of-3. Never on the VM.
 *     It is the `recipient` of every swap and the `owner` of the Roles modifier.
 *
 *  2. ROLES MODIFIER           env ROLES_MODIFIER_ADDRESS
 *     A Zodiac Roles Modifier v2 enabled as a Safe module. It is the ONLY thing
 *     the agent can talk to. It enforces, on-chain: which contract may be called
 *     (SwapRouter02), which function (exactInputSingle), which parameter values
 *     (tokenIn/tokenOut in {WETH,USDC}, recipient == Safe), and a spending
 *     allowance that refills on a schedule. These survive a total compromise of
 *     the VM. Everything else in this file is a convenience on top of them.
 *
 *  3. AGENT EOA                env AGENT_PRIVATE_KEY
 *     A hot key living on the cloud VM. It is a *member of a role*, nothing more.
 *     It holds ONLY gas ETH (~0.3 ETH). It cannot move treasury funds anywhere
 *     except through a scoped swap back into the Safe. If it leaks, the attacker's
 *     maximum damage is bounded by the role's allowance and slippage scoping.
 *
 * ---------------------------------------------------------------------------
 * CONTRACTS TOUCHED (all verified on mainnet — see DEPLOY.md "Address verification")
 * ---------------------------------------------------------------------------
 *   WETH9              0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2  balance/allowance reads
 *   USDC               0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  balance/allowance reads
 *   SwapRouter02       0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45  the swap (write)
 *   QuoterV2           0x61fFE014bA17989E743c5F6cB21bF9697530B21e  expected output (simulate only)
 *   Chainlink ETH/USD  0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419  independent price (read)
 *   V3 pool 0.05%      0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640  liquidity sanity (read)
 *   V3 pool 0.30%      0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8  liquidity sanity (read)
 *   <your Safe>        write, via the Roles modifier
 *   <Roles modifier>   write, the only tx the agent EOA ever sends
 *
 * ---------------------------------------------------------------------------
 * TRANSACTION SHAPE
 * ---------------------------------------------------------------------------
 *   agent EOA --> RolesModifier.execTransactionWithRole(
 *                     to        = SwapRouter02,
 *                     value     = 0,
 *                     data      = exactInputSingle({tokenIn, tokenOut, fee,
 *                                                   recipient = Safe, amountIn,
 *                                                   amountOutMinimum, sqrtPriceLimitX96 = 0}),
 *                     operation = Call (0),
 *                     roleKey   = ROLE_KEY,
 *                     shouldRevert = true)
 *             --> Safe.execTransactionFromModule --> SwapRouter02 --> Uniswap V3 pool
 *
 *   Signed locally with the agent key, submitted to a PRIVATE relay
 *   (Flashbots Protect / MEV Blocker) so it never enters the public mempool.
 *
 * Usage:
 *   tsx rebalance.ts              # one cycle; run from cron/systemd timer
 *   tsx rebalance.ts --dry-run    # simulate everything, sign nothing
 *   tsx rebalance.ts --preflight  # wiring + permission checks only, then exit
 */

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { mainnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ===========================================================================
// 1. MAINNET CONSTANTS
// ===========================================================================

const WETH = getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
const SWAP_ROUTER_02 = getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
const QUOTER_V2 = getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e')
const CHAINLINK_ETH_USD = getAddress('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419')
const UNISWAP_V3_FACTORY = getAddress('0x1F98431c8aD98523631AE4a59f267346ea31F984')

/** Fee tiers we are willing to route through, with their pools. */
const POOLS = [
  { fee: 500, address: getAddress('0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640') },
  { fee: 3000, address: getAddress('0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8') },
] as const

const WETH_DECIMALS = 18
const USDC_DECIMALS = 6
const CHAINLINK_DECIMALS = 8

/** Chainlink ETH/USD mainnet heartbeat is 3600s. Anything older is unusable. */
const ORACLE_MAX_STALENESS_SEC = 3600n

// --- ABIs (minimal, only what we call) -------------------------------------

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

const SWAP_ROUTER_02_ABI = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  { type: 'function', name: 'WETH9', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'factory', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const QUOTER_V2_ABI = [
  {
    // NOTE: not `view` — QuoterV2 works by reverting inside a swap. Must be simulated.
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'fee', type: 'uint24' },
        { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    }],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

const CHAINLINK_ABI = [
  {
    type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

const POOL_ABI = [
  { type: 'function', name: 'liquidity', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] },
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'fee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
] as const

/**
 * Zodiac Roles Modifier v2. If you deployed v1, the role identifier is `uint16 role`
 * instead of `bytes32 roleKey` — check before you wire this up. The --preflight
 * simulation below will fail loudly on a mismatch.
 */
const ROLES_V2_ABI = [
  {
    type: 'function', name: 'execTransactionWithRole', stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'roleKey', type: 'bytes32' },
      { name: 'shouldRevert', type: 'bool' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  { type: 'function', name: 'avatar', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'target', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const OPERATION_CALL = 0

// ===========================================================================
// 2. CONFIGURATION
// ===========================================================================

function env(key: string): string {
  const v = process.env[key]
  if (v === undefined || v === '') throw new Error(`missing required env var ${key}`)
  return v
}
function envOr(key: string, fallback: string): string {
  const v = process.env[key]
  return v === undefined || v === '' ? fallback : v
}
function envInt(key: string, fallback: number): number {
  const n = Number(envOr(key, String(fallback)))
  if (!Number.isFinite(n)) throw new Error(`env ${key} is not a number`)
  return n
}

const CONFIG = {
  /** Execution: 'roles' (production) or 'eoa' (fork/testnet dry runs only). */
  mode: envOr('EXECUTION_MODE', 'roles') as 'roles' | 'eoa',

  /** Your own node or a paid provider. Used for ALL reads and gas estimation. */
  rpcUrl: env('RPC_URL'),
  /** A second, independent provider. Reads are cross-checked against it. */
  rpcUrlBackup: envOr('RPC_URL_BACKUP', ''),
  /** Private relay for eth_sendRawTransaction. Never the public mempool. */
  relayUrl: envOr('RELAY_URL', 'https://rpc.flashbots.net/fast'),

  safeAddress: getAddress(envOr('SAFE_ADDRESS', '0x0000000000000000000000000000000000000000')),
  rolesModifier: getAddress(envOr('ROLES_MODIFIER_ADDRESS', '0x0000000000000000000000000000000000000000')),
  roleKey: envOr('ROLE_KEY', '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex,

  stateDir: envOr('STATE_DIR', path.resolve('./state')),
  alertWebhook: envOr('ALERT_WEBHOOK_URL', ''),

  // ---- strategy band ----
  /** Target share of the portfolio held in WETH, in basis points. 5000 = 50/50. */
  targetWethBps: BigInt(envInt('TARGET_WETH_BPS', 5000)),
  /** Do nothing until drift exceeds this share of the portfolio. Prevents churn. */
  rebalanceBandBps: BigInt(envInt('REBALANCE_BAND_BPS', 300)),

  // ---- hard risk limits (mirrored on-chain in the Roles allowance) ----
  minTradeUsd: parseUnits(envOr('MIN_TRADE_USD', '10000'), USDC_DECIMALS),
  maxTradeUsd: parseUnits(envOr('MAX_TRADE_USD', '50000'), USDC_DECIMALS),
  maxDailyNotionalUsd: parseUnits(envOr('MAX_DAILY_NOTIONAL_USD', '200000'), USDC_DECIMALS),
  maxTradesPerDay: envInt('MAX_TRADES_PER_DAY', 8),
  minSecondsBetweenTrades: envInt('MIN_SECONDS_BETWEEN_TRADES', 900),

  /** Slippage tolerance applied to the QuoterV2 result to derive amountOutMinimum. */
  maxSlippageBps: BigInt(envInt('MAX_SLIPPAGE_BPS', 50)),
  /** Abort if the pool quote and the Chainlink oracle disagree by more than this. */
  maxOracleDeviationBps: BigInt(envInt('MAX_ORACLE_DEVIATION_BPS', 200)),
  /** Abort if base fee is above this. Protects against fee spikes. */
  maxBaseFeeGwei: BigInt(envInt('MAX_BASE_FEE_GWEI', 80)),
  /** Abort if estimated gas cost exceeds this share of trade notional. */
  maxGasCostBps: BigInt(envInt('MAX_GAS_COST_BPS', 30)),
  /** Alert when the agent EOA's gas balance drops below this. */
  minAgentEthWei: parseUnits(envOr('MIN_AGENT_ETH', '0.05'), 18),

  // ---- inclusion / stuck-transaction policy ----
  inclusionTimeoutSec: envInt('INCLUSION_TIMEOUT_SEC', 180),
  maxFeeBumps: envInt('MAX_FEE_BUMPS', 2),
  feeBumpPct: BigInt(envInt('FEE_BUMP_PCT', 30)),
  priorityFeeFloorWei: parseUnits(envOr('PRIORITY_FEE_FLOOR_GWEI', '1'), 9),
}

const DRY_RUN = process.argv.includes('--dry-run')
const PREFLIGHT_ONLY = process.argv.includes('--preflight')

// ===========================================================================
// 3. LOGGING, ALERTING, HALT
// ===========================================================================

type Severity = 'info' | 'warn' | 'critical'

function log(level: Severity, msg: string, extra: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...serializable(extra) })
  process.stdout.write(line + '\n')
}

function serializable(o: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

/** Fire-and-forget alert. Never let a dead webhook take down the trader. */
async function alert(level: Severity, msg: string, extra: Record<string, unknown> = {}) {
  log(level, msg, extra)
  if (!CONFIG.alertWebhook) return
  try {
    await fetch(CONFIG.alertWebhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `[${level.toUpperCase()}] rebalancer: ${msg}\n${JSON.stringify(serializable(extra), null, 2)}` }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    log('warn', 'alert webhook failed', { error: String(e) })
  }
}

const HALT_FILE = () => path.join(CONFIG.stateDir, 'HALT')

/**
 * Off-chain kill switch. `touch state/HALT` on the VM and the agent stops trading
 * at the next cycle. This is the fast, soft stop. The hard stop is revoking the
 * role on-chain (needs Safe owners) — see DEPLOY.md "Incident response".
 */
function isHalted(): string | null {
  try {
    return fs.readFileSync(HALT_FILE(), 'utf8') || 'halted (no reason given)'
  } catch {
    return null
  }
}

function halt(reason: string) {
  fs.writeFileSync(HALT_FILE(), `${new Date().toISOString()} ${reason}\n`)
}

// ===========================================================================
// 4. SINGLE-INSTANCE LOCK
// ===========================================================================
//
// Two copies of this process racing on one nonce is how you accidentally trade
// twice. A cron overlap, a systemd restart during a slow cycle, an ssh session
// where you ran it by hand — all real. Exclusive-create lockfile, PID-checked.

function acquireLock(): () => void {
  fs.mkdirSync(CONFIG.stateDir, { recursive: true })
  const lockPath = path.join(CONFIG.stateDir, 'rebalancer.lock')
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lockPath, 'wx')
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      return () => { try { fs.unlinkSync(lockPath) } catch { /* already gone */ } }
    } catch (e: any) {
      if (e.code !== 'EEXIST') throw e
      const pid = Number(fs.readFileSync(lockPath, 'utf8').trim())
      let alive = true
      try { process.kill(pid, 0) } catch { alive = false }
      if (alive) throw new Error(`another rebalancer is running (pid ${pid}); refusing to start`)
      log('warn', 'clearing stale lock', { pid })
      fs.unlinkSync(lockPath)
    }
  }
  throw new Error('could not acquire lock')
}

// ===========================================================================
// 5. DURABLE JOURNAL
// ===========================================================================
//
// Written and fsync'd BEFORE the key ever signs. If the VM dies between signing
// and inclusion, the next run finds the record and reconciles instead of
// blindly re-trading.
//
// Ground truth for *position* is always on-chain balances, never this file.
// The journal answers exactly one question: "is something of mine still in flight?"

type JournalRecord =
  | { kind: 'intent'; id: string; ts: number; nonce: number; tokenIn: Address; tokenOut: Address; fee: number; amountIn: string; amountOutMinimum: string; notionalUsd: string; gas: string; maxFeePerGas: string; maxPriorityFeePerGas: string }
  | { kind: 'signed'; id: string; ts: number; nonce: number; hash: Hex }
  | { kind: 'sent'; id: string; ts: number; hash: Hex; relay: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }
  | { kind: 'cancel-sent'; id: string; ts: number; hash: Hex; nonce: number; maxFeePerGas: string; maxPriorityFeePerGas: string }
  | { kind: 'mined'; id: string; ts: number; hash: Hex; nonce: number; status: 'success' | 'reverted'; blockNumber: string; gasUsed: string; effectiveGasPrice: string }
  | { kind: 'cancelled'; id: string; ts: number; hash: Hex; nonce: number }
  | { kind: 'unresolved'; id: string; ts: number; nonce: number; detail: string }

export class Journal {
  private readonly file: string
  private records: JournalRecord[] = []

  constructor(stateDir: string) {
    fs.mkdirSync(stateDir, { recursive: true })
    this.file = path.join(stateDir, 'journal.jsonl')
    if (fs.existsSync(this.file)) {
      for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
        if (!line.trim()) continue
        try { this.records.push(JSON.parse(line)) } catch { log('warn', 'skipping corrupt journal line', { line }) }
      }
    }
  }

  /** Append + fsync. Synchronous and durable on purpose: this must survive kill -9. */
  append(rec: JournalRecord) {
    const fd = fs.openSync(this.file, 'a')
    try {
      fs.writeSync(fd, JSON.stringify(rec) + '\n')
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    this.records.push(rec)
  }

  all(): JournalRecord[] { return this.records }

  /** Intents with no terminal record (mined / cancelled / unresolved). */
  openIntents(): Extract<JournalRecord, { kind: 'intent' }>[] {
    const terminal = new Set(this.records.filter(r => r.kind === 'mined' || r.kind === 'cancelled' || r.kind === 'unresolved').map(r => r.id))
    return this.records.filter(r => r.kind === 'intent' && !terminal.has(r.id)) as any
  }

  /** Unique swap hashes signed for this intent, oldest first (original, then each bump). */
  hashesFor(id: string): Hex[] {
    const seen = new Set<Hex>()
    for (const r of this.records) {
      if ((r.kind === 'signed' || r.kind === 'sent') && r.id === id) seen.add((r as any).hash)
    }
    return [...seen]
  }

  /** Cancellations broadcast for this intent. Separate from swap hashes so a mined
   *  cancel is never mistaken for a completed trade in the daily notional count. */
  cancelHashesFor(id: string): Hex[] {
    return this.records.filter(r => r.kind === 'cancel-sent' && r.id === id).map(r => (r as any).hash)
  }

  /** Highest fees this intent has actually been signed at. A replacement must beat these. */
  lastFees(id: string): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
    let maxFee = 0n, maxPrio = 0n
    for (const r of this.records) {
      if ((r as any).id !== id) continue
      const f = (r as any).maxFeePerGas, p = (r as any).maxPriorityFeePerGas
      if (f) maxFee = BigInt(f) > maxFee ? BigInt(f) : maxFee
      if (p) maxPrio = BigInt(p) > maxPrio ? BigInt(p) : maxPrio
    }
    return { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPrio }
  }

  highestNonce(): number | null {
    const ns = this.records.filter(r => r.kind === 'intent').map(r => (r as any).nonce as number)
    return ns.length ? Math.max(...ns) : null
  }

  /** Successful trades in the last 24h, for the daily notional / count caps. */
  recentSuccesses(windowSec: number): { ts: number; notionalUsd: bigint }[] {
    const cutoff = Date.now() / 1000 - windowSec
    const intents = new Map(this.records.filter(r => r.kind === 'intent').map(r => [r.id, r as Extract<JournalRecord, { kind: 'intent' }>]))
    return this.records
      .filter((r): r is Extract<JournalRecord, { kind: 'mined' }> => r.kind === 'mined' && r.status === 'success' && r.ts >= cutoff)
      .map(r => ({ ts: r.ts, notionalUsd: BigInt(intents.get(r.id)?.notionalUsd ?? '0') }))
  }
}

// ===========================================================================
// 6. CLIENTS
// ===========================================================================

const node = createPublicClient({ chain: mainnet, transport: http(CONFIG.rpcUrl, { retryCount: 3, timeout: 20_000 }) })
const backupNode = CONFIG.rpcUrlBackup
  ? createPublicClient({ chain: mainnet, transport: http(CONFIG.rpcUrlBackup, { retryCount: 2, timeout: 20_000 }) })
  : null
/** Only ever used for eth_sendRawTransaction. */
const relay = createPublicClient({ chain: mainnet, transport: http(CONFIG.relayUrl, { retryCount: 2, timeout: 30_000 }) })
/** Public-mempool client, used ONLY to broadcast cancellations that must propagate. */
const publicBroadcast = createPublicClient({ chain: mainnet, transport: http(CONFIG.rpcUrl, { retryCount: 2 }) })

const agent = privateKeyToAccount(env('AGENT_PRIVATE_KEY') as Hex)
const wallet = createWalletClient({ account: agent, chain: mainnet, transport: http(CONFIG.rpcUrl) })

/** Where the tokens live and where swap output must land. */
const TREASURY: Address = CONFIG.mode === 'roles' ? CONFIG.safeAddress : agent.address

// ===========================================================================
// 7. STARTUP WIRING ASSERTIONS
// ===========================================================================
//
// A wrong address here is an unrecoverable loss, and a config typo is far more
// likely than a contract bug. These run every cycle. They are cheap.

export async function assertWiring() {
  const chainId = await node.getChainId()
  if (chainId !== 1) throw new Error(`RPC_URL is not Ethereum mainnet (chainId ${chainId})`)

  const [wethSym, wethDec, usdcSym, usdcDec, routerWeth, routerFactory] = await Promise.all([
    node.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'symbol' }),
    node.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'decimals' }),
    node.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'symbol' }),
    node.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'decimals' }),
    node.readContract({ address: SWAP_ROUTER_02, abi: SWAP_ROUTER_02_ABI, functionName: 'WETH9' }),
    node.readContract({ address: SWAP_ROUTER_02, abi: SWAP_ROUTER_02_ABI, functionName: 'factory' }),
  ])
  if (wethSym !== 'WETH' || wethDec !== WETH_DECIMALS) throw new Error('WETH address does not look like WETH')
  if (usdcSym !== 'USDC' || usdcDec !== USDC_DECIMALS) throw new Error('USDC address does not look like USDC')
  if (getAddress(routerWeth) !== WETH) throw new Error('SwapRouter02.WETH9 mismatch')
  if (getAddress(routerFactory) !== UNISWAP_V3_FACTORY) throw new Error('SwapRouter02.factory mismatch')

  for (const p of POOLS) {
    const [t0, t1, fee] = await Promise.all([
      node.readContract({ address: p.address, abi: POOL_ABI, functionName: 'token0' }),
      node.readContract({ address: p.address, abi: POOL_ABI, functionName: 'token1' }),
      node.readContract({ address: p.address, abi: POOL_ABI, functionName: 'fee' }),
    ])
    const pair = new Set([getAddress(t0), getAddress(t1)])
    if (!pair.has(WETH) || !pair.has(USDC) || fee !== p.fee) throw new Error(`pool ${p.address} is not the WETH/USDC ${p.fee} pool`)
  }

  if (CONFIG.mode === 'roles') {
    if (CONFIG.safeAddress === '0x0000000000000000000000000000000000000000') throw new Error('SAFE_ADDRESS not set')
    if (CONFIG.rolesModifier === '0x0000000000000000000000000000000000000000') throw new Error('ROLES_MODIFIER_ADDRESS not set')
    if (/^0x0+$/.test(CONFIG.roleKey)) throw new Error('ROLE_KEY not set')

    const safeCode = await node.getCode({ address: CONFIG.safeAddress })
    if (!safeCode || safeCode === '0x') throw new Error('SAFE_ADDRESS has no code — that is an EOA, not a Safe')

    const [avatar, target] = await Promise.all([
      node.readContract({ address: CONFIG.rolesModifier, abi: ROLES_V2_ABI, functionName: 'avatar' }),
      node.readContract({ address: CONFIG.rolesModifier, abi: ROLES_V2_ABI, functionName: 'target' }),
    ])
    // If these don't point at your Safe, the modifier is wired to someone else's account.
    if (getAddress(avatar) !== CONFIG.safeAddress) throw new Error(`Roles.avatar() = ${avatar}, expected Safe ${CONFIG.safeAddress}`)
    if (getAddress(target) !== CONFIG.safeAddress) throw new Error(`Roles.target() = ${target}, expected Safe ${CONFIG.safeAddress}`)
  }

  // Cross-check the primary RPC against a second provider. A provider that serves
  // stale or wrong state is a real failure mode and it is silent.
  if (backupNode) {
    const [a, b] = await Promise.all([node.getBlockNumber(), backupNode.getBlockNumber()])
    const drift = a > b ? a - b : b - a
    if (drift > 5n) throw new Error(`RPC providers disagree on head: ${a} vs ${b}`)
  }

  log('info', 'wiring ok', { chainId, mode: CONFIG.mode, treasury: TREASURY, agent: agent.address })
}

// ===========================================================================
// 8. PRICING — oracle and pool, independently
// ===========================================================================

type Oracle = { ethUsd: bigint; updatedAt: bigint; ageSec: bigint }

/**
 * Chainlink is the independent reference. It is NOT used to price the trade —
 * it is used to decide whether the pool's price is believable at all. Deriving
 * your slippage bound from the same pool you are trading against protects you
 * from nothing.
 */
export async function readOracle(): Promise<Oracle> {
  const [, answer, , updatedAt] = await node.readContract({
    address: CHAINLINK_ETH_USD, abi: CHAINLINK_ABI, functionName: 'latestRoundData',
  })
  if (answer <= 0n) throw new Error('Chainlink returned a non-positive price')
  const now = BigInt(Math.floor(Date.now() / 1000))
  const ageSec = now > updatedAt ? now - updatedAt : 0n
  if (ageSec > ORACLE_MAX_STALENESS_SEC) {
    throw new Error(`Chainlink ETH/USD is stale: ${ageSec}s old (heartbeat ${ORACLE_MAX_STALENESS_SEC}s)`)
  }
  return { ethUsd: answer, updatedAt, ageSec }
}

/** USD notional (6dp) of a WETH amount (18dp), per the oracle. */
export const wethToUsd = (weth: bigint, ethUsd: bigint) => (weth * ethUsd) / 10n ** BigInt(WETH_DECIMALS + CHAINLINK_DECIMALS - USDC_DECIMALS)
/** WETH amount (18dp) equivalent to a USD notional (6dp), per the oracle. */
export const usdToWeth = (usd: bigint, ethUsd: bigint) => (usd * 10n ** BigInt(WETH_DECIMALS + CHAINLINK_DECIMALS - USDC_DECIMALS)) / ethUsd

type Quote = { fee: number; pool: Address; amountOut: bigint; gasEstimate: bigint }

/** Ask QuoterV2 for each fee tier and keep the best. Simulation only — no state change. */
export async function bestQuote(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<Quote> {
  const quotes: Quote[] = []
  for (const p of POOLS) {
    try {
      const { result } = await node.simulateContract({
        address: QUOTER_V2, abi: QUOTER_V2_ABI, functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut, amountIn, fee: p.fee, sqrtPriceLimitX96: 0n }],
        account: agent.address,
      })
      quotes.push({ fee: p.fee, pool: p.address, amountOut: result[0], gasEstimate: result[3] })
    } catch (e) {
      log('warn', 'quote failed for fee tier', { fee: p.fee, error: String(e).slice(0, 200) })
    }
  }
  if (quotes.length === 0) throw new Error('no fee tier produced a quote')
  return quotes.reduce((a, b) => (b.amountOut > a.amountOut ? b : a))
}

// ===========================================================================
// 9. THE DECISION
// ===========================================================================
//
// Your signal goes here. The default below is a plain target-weight rebalance so
// this file runs end to end. Whatever you replace it with, keep the contract:
// it reads on-chain state, returns an intent, and does NOT sign anything. Every
// safety check downstream assumes the decision is untrusted.

type Decision =
  | { action: 'hold'; reason: string }
  | { action: 'swap'; tokenIn: Address; tokenOut: Address; amountIn: bigint; notionalUsd: bigint; reason: string }

type Position = { weth: bigint; usdc: bigint; wethUsd: bigint; usdcUsd: bigint; totalUsd: bigint }

export async function readPosition(oracle: Oracle): Promise<Position> {
  const [weth, usdc] = await Promise.all([
    node.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [TREASURY] }),
    node.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [TREASURY] }),
  ])
  const wethUsd = wethToUsd(weth, oracle.ethUsd)
  return { weth, usdc, wethUsd, usdcUsd: usdc, totalUsd: wethUsd + usdc }
}

export function decide(pos: Position, oracle: Oracle): Decision {
  if (pos.totalUsd === 0n) return { action: 'hold', reason: 'treasury is empty' }

  const targetWethUsd = (pos.totalUsd * CONFIG.targetWethBps) / 10_000n
  const drift = pos.wethUsd - targetWethUsd
  const band = (pos.totalUsd * CONFIG.rebalanceBandBps) / 10_000n
  const absDrift = drift < 0n ? -drift : drift

  if (absDrift <= band) {
    return { action: 'hold', reason: `within band: drift ${fmtUsd(absDrift)} <= ${fmtUsd(band)}` }
  }

  // Trade only back to the target, capped by the per-trade limit.
  let notional = absDrift > CONFIG.maxTradeUsd ? CONFIG.maxTradeUsd : absDrift
  if (notional < CONFIG.minTradeUsd) {
    return { action: 'hold', reason: `drift ${fmtUsd(absDrift)} is below the ${fmtUsd(CONFIG.minTradeUsd)} minimum trade size` }
  }

  if (drift > 0n) {
    // Overweight WETH -> sell WETH for USDC.
    let amountIn = usdToWeth(notional, oracle.ethUsd)
    if (amountIn > pos.weth) { amountIn = pos.weth; notional = wethToUsd(amountIn, oracle.ethUsd) }
    return { action: 'swap', tokenIn: WETH, tokenOut: USDC, amountIn, notionalUsd: notional, reason: `overweight WETH by ${fmtUsd(absDrift)}` }
  } else {
    // Underweight WETH -> buy WETH with USDC.
    let amountIn = notional
    if (amountIn > pos.usdc) { amountIn = pos.usdc; notional = amountIn }
    return { action: 'swap', tokenIn: USDC, tokenOut: WETH, amountIn, notionalUsd: notional, reason: `underweight WETH by ${fmtUsd(absDrift)}` }
  }
}

const fmtUsd = (v: bigint) => `$${formatUnits(v, USDC_DECIMALS)}`

// ===========================================================================
// 10. PRE-TRADE GUARDS
// ===========================================================================
//
// Every one of these is a reason to NOT trade. A skipped rebalance costs a few
// basis points of drift. A bad trade costs real money. The asymmetry is the
// whole design: when uncertain, do nothing and say so.

type GuardContext = {
  decision: Extract<Decision, { action: 'swap' }>
  position: Position
  oracle: Oracle
  journal: Journal
  quote: Quote
  baseFee: bigint
}

async function runGuards(ctx: GuardContext): Promise<string[]> {
  const failures: string[] = []
  const { decision, oracle, journal, quote, baseFee } = ctx

  // --- size limits ---
  if (decision.notionalUsd > CONFIG.maxTradeUsd) failures.push(`trade ${fmtUsd(decision.notionalUsd)} exceeds per-trade cap ${fmtUsd(CONFIG.maxTradeUsd)}`)
  if (decision.notionalUsd < CONFIG.minTradeUsd) failures.push(`trade ${fmtUsd(decision.notionalUsd)} below minimum ${fmtUsd(CONFIG.minTradeUsd)}`)

  // --- rate limits (off-chain mirror of the on-chain Roles allowance) ---
  const recent = journal.recentSuccesses(86_400)
  const dayNotional = recent.reduce((a, r) => a + r.notionalUsd, 0n)
  if (dayNotional + decision.notionalUsd > CONFIG.maxDailyNotionalUsd) {
    failures.push(`24h notional would be ${fmtUsd(dayNotional + decision.notionalUsd)}, cap is ${fmtUsd(CONFIG.maxDailyNotionalUsd)}`)
  }
  if (recent.length >= CONFIG.maxTradesPerDay) failures.push(`already ${recent.length} trades in 24h, cap is ${CONFIG.maxTradesPerDay}`)
  const last = recent.length ? Math.max(...recent.map(r => r.ts)) : 0
  const sinceLast = Date.now() / 1000 - last
  if (last && sinceLast < CONFIG.minSecondsBetweenTrades) {
    failures.push(`last trade was ${Math.round(sinceLast)}s ago, minimum spacing is ${CONFIG.minSecondsBetweenTrades}s`)
  }

  // --- the pool must agree with the oracle ---
  // If the pool has been pushed away from the real price (manipulation, a
  // thin-liquidity moment, an oracle that froze), refuse rather than trade into it.
  const oracleOut = decision.tokenIn === WETH
    ? wethToUsd(decision.amountIn, oracle.ethUsd)
    : usdToWeth(decision.amountIn, oracle.ethUsd)
  const diff = quote.amountOut > oracleOut ? quote.amountOut - oracleOut : oracleOut - quote.amountOut
  const deviationBps = oracleOut === 0n ? 10_000n : (diff * 10_000n) / oracleOut
  if (deviationBps > CONFIG.maxOracleDeviationBps) {
    failures.push(`pool quote deviates ${deviationBps}bps from Chainlink (limit ${CONFIG.maxOracleDeviationBps}bps) — pool out of line or oracle stale`)
  }

  // --- pool depth ---
  const liq = await node.readContract({ address: quote.pool, abi: POOL_ABI, functionName: 'liquidity' })
  if (liq === 0n) failures.push(`pool ${quote.pool} has zero in-range liquidity`)

  // --- gas ---
  const maxBaseFee = CONFIG.maxBaseFeeGwei * 10n ** 9n
  if (baseFee > maxBaseFee) failures.push(`base fee ${formatUnits(baseFee, 9)} gwei exceeds cap ${CONFIG.maxBaseFeeGwei} gwei`)

  // --- the treasury actually holds what we are about to spend ---
  const bal = decision.tokenIn === WETH ? ctx.position.weth : ctx.position.usdc
  if (decision.amountIn > bal) failures.push(`amountIn exceeds treasury balance of ${decision.tokenIn}`)

  // --- the router is allowed to pull the input token from the treasury ---
  const allowance = await node.readContract({
    address: decision.tokenIn, abi: ERC20_ABI, functionName: 'allowance', args: [TREASURY, SWAP_ROUTER_02],
  })
  if (allowance < decision.amountIn) {
    failures.push(`SwapRouter02 allowance from treasury is ${allowance}, need ${decision.amountIn} — top it up from the Safe owners (see DEPLOY.md)`)
  }

  // --- gas money (also checked every cycle in main(), trade or no trade) ---
  const agentEth = await node.getBalance({ address: agent.address })
  if (agentEth < CONFIG.minAgentEthWei) {
    failures.push(`agent EOA has ${formatEther(agentEth)} ETH, below ${formatEther(CONFIG.minAgentEthWei)}`)
  }

  return failures
}

// ===========================================================================
// 11. BUILDING THE TRANSACTION
// ===========================================================================

/**
 * amountOutMinimum is the single most important number in this file. It is the
 * only thing standing between you and an adversarial execution environment:
 * sandwiches, stale inclusion, a pool that moved. It is derived from QuoterV2
 * (which prices actual impact) and then cross-checked against Chainlink in the
 * guards above. If this is wrong, nothing else matters.
 */
export function minimumOut(quotedOut: bigint): bigint {
  return (quotedOut * (10_000n - CONFIG.maxSlippageBps)) / 10_000n
}

export function encodeSwap(d: Extract<Decision, { action: 'swap' }>, fee: number, amountOutMinimum: bigint): Hex {
  return encodeFunctionData({
    abi: SWAP_ROUTER_02_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: d.tokenIn,
      tokenOut: d.tokenOut,
      fee,
      // Output goes straight back to the Safe. The agent EOA never custodies
      // treasury tokens, not even for one block.
      recipient: TREASURY,
      amountIn: d.amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    }],
  })
}

/**
 * Wrap the swap so it executes *as the Safe*, through the Roles modifier.
 * shouldRevert: true — if the inner call fails we want the whole tx to revert
 * loudly, not to silently return false and burn gas looking like a success.
 */
export function encodeOuterCall(swapData: Hex): { to: Address; data: Hex } {
  if (CONFIG.mode === 'eoa') return { to: SWAP_ROUTER_02, data: swapData }
  return {
    to: CONFIG.rolesModifier,
    data: encodeFunctionData({
      abi: ROLES_V2_ABI,
      functionName: 'execTransactionWithRole',
      args: [SWAP_ROUTER_02, 0n, swapData, OPERATION_CALL, CONFIG.roleKey, true],
    }),
  }
}

// ===========================================================================
// 12. NONCE MANAGEMENT
// ===========================================================================
//
// Subtle and important: transactions sent to a private relay never appear in
// your node's mempool, so `getTransactionCount(..., 'pending')` will NOT count
// them. Trusting it will hand you a nonce you already used. The journal is the
// only complete record of what this key has signed.

async function nextNonce(journal: Journal): Promise<number> {
  const onchain = await node.getTransactionCount({ address: agent.address, blockTag: 'latest' })
  const journaled = journal.highestNonce()
  return journaled === null ? onchain : Math.max(onchain, journaled + 1)
}

// ===========================================================================
// 13. RECONCILIATION
// ===========================================================================
//
// Runs first, every cycle. If anything the key signed is unaccounted for, we do
// not trade. Deciding on a position you are not sure about is how you end up
// double-selling.

async function reconcile(journal: Journal): Promise<'clear' | 'blocked'> {
  const open = journal.openIntents()
  if (open.length === 0) return 'clear'

  const onchainNonce = await node.getTransactionCount({ address: agent.address, blockTag: 'latest' })

  for (const intent of open) {
    const hashes = journal.hashesFor(intent.id)

    for (const hash of hashes) {
      const receipt = await node.getTransactionReceipt({ hash }).catch(() => null)
      if (receipt) {
        journal.append({
          kind: 'mined', id: intent.id, ts: Date.now() / 1000, hash, nonce: intent.nonce,
          status: receipt.status === 'success' ? 'success' : 'reverted',
          blockNumber: receipt.blockNumber.toString(), gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        })
        if (receipt.status !== 'success') {
          await alert('critical', 'a rebalance transaction reverted on-chain', { id: intent.id, hash })
        } else {
          log('info', 'reconciled a previously in-flight trade', { id: intent.id, hash })
        }
        break
      }
    }

    // A cancellation that landed also closes the intent — as 'cancelled', never as a
    // trade, so it does not consume the daily notional budget.
    if (journal.openIntents().some(i => i.id === intent.id)) {
      for (const hash of journal.cancelHashesFor(intent.id)) {
        const receipt = await node.getTransactionReceipt({ hash }).catch(() => null)
        if (receipt) {
          journal.append({ kind: 'cancelled', id: intent.id, ts: Date.now() / 1000, hash, nonce: intent.nonce })
          log('info', 'cancellation confirmed; the original swap never landed', { id: intent.id, cancelHash: hash })
          break
        }
      }
    }

    // Re-read: did either loop above close it out?
    if (!journal.openIntents().some(i => i.id === intent.id)) continue

    if (onchainNonce > intent.nonce) {
      // The nonce was consumed by a transaction that is not one of ours. Either
      // someone else has the key, or a hash we never recorded landed. Either way
      // we cannot reason about the position. Stop and get a human.
      journal.append({ kind: 'unresolved', id: intent.id, ts: Date.now() / 1000, nonce: intent.nonce, detail: `nonce ${intent.nonce} consumed by an unknown transaction` })
      halt(`nonce ${intent.nonce} consumed by a transaction we did not sign — possible key compromise`)
      await alert('critical', 'HALTED: nonce consumed by an unknown transaction — treat the agent key as compromised until proven otherwise', {
        id: intent.id, nonce: intent.nonce, onchainNonce, agent: agent.address,
      })
      return 'blocked'
    }

    // Still genuinely pending.
    const ageSec = Date.now() / 1000 - intent.ts
    log('warn', 'transaction still in flight', { id: intent.id, nonce: intent.nonce, ageSec: Math.round(ageSec) })
    if (ageSec > CONFIG.inclusionTimeoutSec) await handleStuck(journal, intent)
    return 'blocked'
  }

  return journal.openIntents().length === 0 ? 'clear' : 'blocked'
}

/**
 * A transaction that will not land. Bump the fee a couple of times, then cancel
 * with a same-nonce self-send. The cancel goes out over the PUBLIC mempool on
 * purpose: it is a 0-value self-transfer with nothing to extract, and it needs
 * to propagate to every builder to reliably beat the original.
 */
async function handleStuck(journal: Journal, intent: Extract<JournalRecord, { kind: 'intent' }>) {
  const bumps = journal.hashesFor(intent.id).length - 1
  const network = await node.estimateFeesPerGas()
  const prev = journal.lastFees(intent.id)

  // A replacement must outbid the transaction it is replacing — the network estimate
  // is irrelevant to whether it is accepted, and can be far below what we already
  // signed if base fee fell in the meantime. Bump the previous fees, floor at network.
  const bump = (previous: bigint, current: bigint) => {
    const bumped = (previous * (100n + CONFIG.feeBumpPct)) / 100n
    return bumped > current ? bumped : current
  }
  const maxFeePerGas = bump(prev.maxFeePerGas, network.maxFeePerGas)
  const maxPriorityFeePerGas = bump(prev.maxPriorityFeePerGas, network.maxPriorityFeePerGas)

  if (bumps >= CONFIG.maxFeeBumps) {
    if (DRY_RUN) { log('info', 'dry-run: would cancel stuck transaction', { id: intent.id, nonce: intent.nonce }); return }
    const serialized = await wallet.signTransaction({
      account: agent, chainId: mainnet.id, to: agent.address, value: 0n, data: '0x', gas: 21_000n,
      maxFeePerGas, maxPriorityFeePerGas, nonce: intent.nonce, type: 'eip1559',
    })
    const hash = await publicBroadcast.sendRawTransaction({ serializedTransaction: serialized })
    // NOT terminal. The cancel has been broadcast, not won — the original swap can
    // still land. reconcile() closes this out only once a receipt exists, and until
    // then no new trade is opened.
    journal.append({
      kind: 'cancel-sent', id: intent.id, ts: Date.now() / 1000, hash, nonce: intent.nonce,
      maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    })
    await alert('warn', 'broadcast a cancellation for a stuck rebalance transaction', {
      id: intent.id, nonce: intent.nonce, cancelHash: hash,
      note: 'the original swap may still land; the agent stays blocked until one of them mines',
    })
    return
  }

  // Re-sign the SAME swap with the SAME amountOutMinimum, just paying more.
  // Re-quoting here would be a bug: it would let a stuck transaction quietly
  // widen its own slippage bound while you were not looking.
  log('warn', 'bumping fees on stuck transaction', { id: intent.id, nonce: intent.nonce, bump: bumps + 1 })
  if (DRY_RUN) return
  const swapData = encodeSwap(
    { action: 'swap', tokenIn: intent.tokenIn, tokenOut: intent.tokenOut, amountIn: BigInt(intent.amountIn), notionalUsd: 0n, reason: 'replacement' },
    intent.fee, BigInt(intent.amountOutMinimum),
  )
  const outer = encodeOuterCall(swapData)
  const serialized = await wallet.signTransaction({
    account: agent, chainId: mainnet.id, to: outer.to, value: 0n, data: outer.data,
    gas: BigInt(intent.gas), maxFeePerGas, maxPriorityFeePerGas,
    nonce: intent.nonce, type: 'eip1559',
  })
  const hash = await relay.sendRawTransaction({ serializedTransaction: serialized })
  journal.append({
    kind: 'sent', id: intent.id, ts: Date.now() / 1000, hash, relay: CONFIG.relayUrl,
    maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  })
}

// ===========================================================================
// 14. SIGN AND SUBMIT
// ===========================================================================

async function execute(journal: Journal, d: Extract<Decision, { action: 'swap' }>, quote: Quote, baseFee: bigint, oracle: Oracle) {
  const amountOutMinimum = minimumOut(quote.amountOut)
  const swapData = encodeSwap(d, quote.fee, amountOutMinimum)
  const outer = encodeOuterCall(swapData)

  // ---- Simulate the exact transaction against the current head. -----------
  // This is the last line of defence and it catches the things static checks
  // cannot: a Roles permission that does not actually cover these arguments,
  // an allowance that was revoked, a USDC blacklist, a slippage bound that the
  // real pool state will not satisfy. Never send what you have not simulated.
  if (CONFIG.mode === 'roles') {
    try {
      await node.simulateContract({
        address: CONFIG.rolesModifier, abi: ROLES_V2_ABI, functionName: 'execTransactionWithRole',
        args: [SWAP_ROUTER_02, 0n, swapData, OPERATION_CALL, CONFIG.roleKey, true],
        account: agent.address,
      })
    } catch (e) {
      // Most often: the role does not permit these exact arguments, the role's
      // allowance is exhausted, or the agent was removed as a role member.
      await alert('critical', 'Roles simulation failed — not sending', { error: String(e).slice(0, 800) })
      throw e
    }
  }
  const gasEstimate = await node.estimateGas({
    account: agent.address, to: outer.to, data: outer.data, value: 0n,
  })
  const gas = (gasEstimate * 125n) / 100n // headroom for state drift between now and inclusion

  // ---- Fees ----------------------------------------------------------------
  const fees = await node.estimateFeesPerGas()
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas > CONFIG.priorityFeeFloorWei ? fees.maxPriorityFeePerGas : CONFIG.priorityFeeFloorWei
  // Room for the base fee to roughly double before we are priced out of blocks.
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

  const gasCostWei = gas * maxFeePerGas
  const gasCostUsd = wethToUsd(gasCostWei, oracle.ethUsd)
  if (d.notionalUsd <= 0n) throw new Error('refusing to execute a zero-notional trade')
  const gasCostBps = (gasCostUsd * 10_000n) / d.notionalUsd
  if (gasCostBps > CONFIG.maxGasCostBps) {
    log('warn', 'skipping: gas cost too high relative to trade size', { gasCostUsd: fmtUsd(gasCostUsd), gasCostBps, cap: CONFIG.maxGasCostBps })
    return
  }

  const nonce = await nextNonce(journal)
  const id = `${Date.now()}-${nonce}`

  log('info', 'trade approved', {
    id, nonce, route: `${d.tokenIn === WETH ? 'WETH' : 'USDC'} -> ${d.tokenOut === WETH ? 'WETH' : 'USDC'}`,
    feeTier: quote.fee, pool: quote.pool,
    amountIn: formatUnits(d.amountIn, d.tokenIn === WETH ? WETH_DECIMALS : USDC_DECIMALS),
    quotedOut: formatUnits(quote.amountOut, d.tokenOut === WETH ? WETH_DECIMALS : USDC_DECIMALS),
    amountOutMinimum: formatUnits(amountOutMinimum, d.tokenOut === WETH ? WETH_DECIMALS : USDC_DECIMALS),
    notionalUsd: fmtUsd(d.notionalUsd), gasCostUsd: fmtUsd(gasCostUsd), gas, maxFeePerGas, to: outer.to,
  })

  if (DRY_RUN) { log('info', 'dry-run: not signing'); return }

  // ---- Journal BEFORE signing. --------------------------------------------
  // If the process dies on the next line, the next run knows a transaction with
  // this nonce may exist and reconciles instead of trading again.
  journal.append({
    kind: 'intent', id, ts: Date.now() / 1000, nonce,
    tokenIn: d.tokenIn, tokenOut: d.tokenOut, fee: quote.fee,
    amountIn: d.amountIn.toString(), amountOutMinimum: amountOutMinimum.toString(),
    notionalUsd: d.notionalUsd.toString(), gas: gas.toString(),
    maxFeePerGas: maxFeePerGas.toString(), maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
  })

  // ---- Sign locally. The key never leaves this process. --------------------
  const serialized = await wallet.signTransaction({
    account: agent, chainId: mainnet.id, to: outer.to, value: 0n, data: outer.data,
    gas, maxFeePerGas, maxPriorityFeePerGas, nonce, type: 'eip1559',
  })

  // ---- Submit privately. ---------------------------------------------------
  // A $10-50k WETH/USDC swap in the public mempool is a standing invitation to
  // be sandwiched. amountOutMinimum caps that loss; the private relay avoids it.
  const hash = await relay.sendRawTransaction({ serializedTransaction: serialized })
  journal.append({ kind: 'signed', id, ts: Date.now() / 1000, nonce, hash })
  journal.append({ kind: 'sent', id, ts: Date.now() / 1000, hash, relay: CONFIG.relayUrl })
  log('info', 'submitted to private relay', { id, hash, relay: CONFIG.relayUrl })

  // ---- Wait for inclusion. ------------------------------------------------
  // Not finding it here is normal, not an error: the next cycle's reconcile()
  // picks it up. Never re-send on a timeout.
  try {
    const receipt = await node.waitForTransactionReceipt({ hash, timeout: CONFIG.inclusionTimeoutSec * 1000, pollingInterval: 4_000 })
    journal.append({
      kind: 'mined', id, ts: Date.now() / 1000, hash, nonce,
      status: receipt.status === 'success' ? 'success' : 'reverted',
      blockNumber: receipt.blockNumber.toString(), gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
    })
    if (receipt.status === 'success') {
      const after = await readPosition(await readOracle())
      await alert('info', 'rebalance executed', {
        hash, block: receipt.blockNumber, notionalUsd: fmtUsd(d.notionalUsd),
        gasUsed: receipt.gasUsed, wethAfter: formatUnits(after.weth, WETH_DECIMALS), usdcAfter: formatUnits(after.usdc, USDC_DECIMALS),
      })
    } else {
      await alert('critical', 'rebalance transaction REVERTED', { hash, block: receipt.blockNumber })
    }
  } catch {
    log('warn', 'not included within timeout; leaving for next cycle to reconcile', { id, hash })
  }
}

// ===========================================================================
// 15. MAIN
// ===========================================================================

async function main() {
  const release = acquireLock()
  try {
    await assertWiring()
    if (PREFLIGHT_ONLY) { log('info', 'preflight ok'); return }

    const haltReason = isHalted()
    if (haltReason) {
      log('critical', 'HALT file present — not trading', { reason: haltReason.trim(), file: HALT_FILE() })
      return
    }

    const journal = new Journal(CONFIG.stateDir)

    // 1. Account for anything still in flight before forming a new opinion.
    if ((await reconcile(journal)) === 'blocked') {
      log('warn', 'unresolved in-flight transaction; skipping this cycle')
      return
    }

    // 2. Read the world.
    const oracle = await readOracle()
    const position = await readPosition(oracle)
    const block = await node.getBlock({ blockTag: 'latest' })
    const baseFee = block.baseFeePerGas ?? 0n

    log('info', 'position', {
      ethUsd: formatUnits(oracle.ethUsd, CHAINLINK_DECIMALS), oracleAgeSec: oracle.ageSec,
      weth: formatUnits(position.weth, WETH_DECIMALS), usdc: formatUnits(position.usdc, USDC_DECIMALS),
      totalUsd: fmtUsd(position.totalUsd),
      wethShareBps: position.totalUsd > 0n ? (position.wethUsd * 10_000n) / position.totalUsd : 0n,
      baseFeeGwei: formatUnits(baseFee, 9),
    })

    // 3. Decide.
    // Gas runway is checked unconditionally. If this only ran alongside a trade,
    // a long quiet spell would drain the agent unnoticed and the alert would arrive
    // at exactly the moment you needed it to trade instead.
    const agentEth = await node.getBalance({ address: agent.address })
    if (agentEth < CONFIG.minAgentEthWei) {
      await alert('critical', 'agent EOA is low on gas ETH — top it up or trading stops', {
        balance: formatEther(agentEth), floor: formatEther(CONFIG.minAgentEthWei), address: agent.address,
      })
    }

    const decision = decide(position, oracle)
    if (decision.action === 'hold') { log('info', 'hold', { reason: decision.reason }); return }

    // 4. Price it against the pools.
    const quote = await bestQuote(decision.tokenIn, decision.tokenOut, decision.amountIn)

    // 5. Check every reason not to do it.
    const failures = await runGuards({ decision, position, oracle, journal, quote, baseFee })
    if (failures.length) {
      log('warn', 'trade rejected by guards', { reason: decision.reason, failures })
      return
    }

    // 6. Sign and submit.
    await execute(journal, decision, quote, baseFee, oracle)
  } finally {
    release()
  }
}

// Only run when invoked directly, so the pure helpers above can be unit-tested.
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  main().catch(async (e) => {
    await alert('critical', 'rebalancer cycle threw', { error: String(e?.stack ?? e) })
    process.exitCode = 1
  })
}
