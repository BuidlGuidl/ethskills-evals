/**
 * rebalance.ts — execution path for the WETH/USDC treasury rebalancer.
 *
 * A rebalance decision (from the signal engine) becomes ONE mainnet transaction:
 *
 *   agent EOA (hot key on the VM, holds only gas ETH)
 *     └─ calls  Zodiac Roles Modifier v2 .execTransactionWithRole(...)
 *          └─ which makes the treasury Safe call
 *               Uniswap V3 SwapRouter .exactInputSingle(WETH<->USDC, fee 500, recipient = Safe)
 *                 └─ swapping in the WETH/USDC 0.05% pool
 *
 * The hot key never holds the treasury and cannot move funds anywhere except
 * back into the Safe via that one pool. What it may do is enforced on-chain
 * by the Roles modifier (see setup-roles.ts / DEPLOY.md), including daily
 * per-token allowances. Everything in this file is defence in depth on top.
 *
 * Usage:
 *   tsx rebalance.ts preflight
 *   tsx rebalance.ts trade sell-weth 5            # sell 5 WETH for USDC
 *   tsx rebalance.ts trade buy-weth 20000 --dry-run   # quote+simulate, do not send
 *
 * From the signal engine:
 *   import { executeRebalance } from './rebalance.ts'
 *   await executeRebalance({ direction: 'BUY_WETH', amountIn: 20_000_000000n, id: 'sig-123' })
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  type Address,
  type Hex,
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseAbi,
  parseEther,
  parseGwei,
  parseUnits,
  stringToHex,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ─────────────────────────────────────────────────────────────────────────────
// Contracts touched (Ethereum mainnet, chainId 1). All verified to have code
// on mainnet; the pool address is what UniswapV3Factory.getPool(WETH, USDC, 500)
// returns.
// ─────────────────────────────────────────────────────────────────────────────
export const MAINNET = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // 18 decimals
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // 6 decimals (Circle, upgradeable, can blacklist)
  // Uniswap V3 SwapRouter (original, not SwapRouter02): exactInputSingle carries its own
  // `deadline`, so the Roles permission can scope a single plain function call.
  SWAP_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  POOL_WETH_USDC_500: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // token0 = USDC, token1 = WETH
  POOL_FEE: 500,
  CHAINLINK_ETH_USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // 8 decimals, heartbeat 3600s, deviation 0.5%
  CHAINLINK_USDC_USD: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // 8 decimals, heartbeat 86400s
} as const satisfies Record<string, Address | number>

export const DEFAULT_ROLE_KEY = stringToHex('REBALANCER', { size: 32 })
/** On-chain Roles allowances (rate limits on amountIn), one per sell direction. Set by setup-roles.ts. */
export const ALLOWANCE_KEYS = {
  WETH_IN: stringToHex('REBALANCER_WETH_IN', { size: 32 }),
  USDC_IN: stringToHex('REBALANCER_USDC_IN', { size: 32 }),
} as const

// Flashbots Protect: private submission, not visible in the public mempool, so
// the swap can't be sandwiched from there. Reverted txs are not included (no gas lost).
const DEFAULT_SUBMIT_RPC = 'https://rpc.flashbots.net/fast'

// ─────────────────────────────────────────────────────────────────────────────
// ABIs (only what we call)
// ─────────────────────────────────────────────────────────────────────────────
export const rolesAbi = parseAbi([
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)',
  'function avatar() view returns (address)',
  'function target() view returns (address)',
  'function owner() view returns (address)',
  'function allowances(bytes32 key) view returns (uint128 refill, uint128 maxRefill, uint64 period, uint128 balance, uint64 timestamp)',
  'error NotAuthorized(address sender)',
  'error ConditionViolation(uint8 status, bytes32 info)',
  'error NoMembership()',
  'error ModuleTransactionFailed()',
])

export const swapRouterAbi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
])

const quoterAbi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

const poolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
])

const aggregatorAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

const safeAbi = parseAbi([
  'function isModuleEnabled(address module) view returns (bool)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
])

// ─────────────────────────────────────────────────────────────────────────────
// Configuration (environment; secrets come from the secret manager via systemd)
// ─────────────────────────────────────────────────────────────────────────────
function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`missing required env ${name}`)
  return v
}
const num = (name: string, fallback: number) => Number(env(name, String(fallback)))

export function loadConfig() {
  const rawRoleKey = process.env.ROLE_KEY
  return {
    readRpcUrl: env('READ_RPC_URL'),
    submitRpcUrl: env('SUBMIT_RPC_URL', DEFAULT_SUBMIT_RPC),
    agentPrivateKey: env('AGENT_PRIVATE_KEY') as Hex,
    safe: getAddress(env('TREASURY_SAFE')),
    roles: getAddress(env('ROLES_MODIFIER')),
    roleKey: (rawRoleKey ? (rawRoleKey.startsWith('0x') ? rawRoleKey : stringToHex(rawRoleKey, { size: 32 })) : DEFAULT_ROLE_KEY) as Hex,
    stateDir: env('STATE_DIR', '/var/lib/rebalancer'),
    alertWebhook: process.env.ALERT_WEBHOOK_URL, // non-urgent: Slack/Discord/Telegram
    pageWebhook: process.env.PAGE_WEBHOOK_URL, // urgent: PagerDuty/Opsgenie/phone. Only for halts.

    // Trade guards. The hard limits are the on-chain Roles allowances; these are tighter/soft.
    minTradeUsd: num('MIN_TRADE_USD', 1_000),
    maxTradeUsd: num('MAX_TRADE_USD', 60_000),
    dailyNotionalUsd: num('DAILY_NOTIONAL_USD', 200_000), // keep <= on-chain allowances combined
    slippageBps: num('SLIPPAGE_BPS', 30), // vs. same-block quote
    maxOracleDeviationBps: num('MAX_ORACLE_DEVIATION_BPS', 100), // quote vs Chainlink (incl. 5bp fee)
    maxPriceImpactBps: num('MAX_PRICE_IMPACT_BPS', 30), // quote vs pool spot (incl. 5bp fee)
    usdcPegToleranceBps: num('USDC_PEG_TOLERANCE_BPS', 100),
    ethUsdMaxAgeSec: num('ETH_USD_MAX_AGE_SEC', 3_600 + 300),
    usdcUsdMaxAgeSec: num('USDC_USD_MAX_AGE_SEC', 86_400 + 1_800),

    // Gas / submission
    maxFeeGwei: num('MAX_FEE_GWEI', 60), // skip (not fail) trades when gas is above this
    priorityFeeGwei: num('PRIORITY_FEE_GWEI', 1),
    deadlineSec: num('DEADLINE_SEC', 180), // after this the swap can only revert
    minAgentEth: num('MIN_AGENT_ETH', 0.05), // warn below this
    maxConsecutiveFailures: num('MAX_CONSECUTIVE_FAILURES', 3),
  }
}
export type Config = ReturnType<typeof loadConfig>

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type Direction = 'SELL_WETH' | 'BUY_WETH'
export type RebalanceDecision = {
  direction: Direction
  /** In tokenIn base units: wei of WETH for SELL_WETH, 1e-6 USDC for BUY_WETH. */
  amountIn: bigint
  /** Idempotency key from the signal engine. The same id is never executed twice. */
  id?: string
  reason?: string
}
export type RebalanceResult =
  | { status: 'executed'; txHash: Hex; amountIn: bigint; amountOut: bigint; gasCostWei: bigint }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string; txHash?: Hex }
  | { status: 'pending'; txHash: Hex; reason: string }
  | { status: 'dry-run'; amountOutQuoted: bigint; amountOutMinimum: bigint; gas: bigint }

type Pending = { hash: Hex; nonce: number; deadline: number; decisionId?: string; direction: Direction; amountIn: string; sentAt: string }
type State = {
  day: string // UTC yyyy-mm-dd
  notionalUsdToday: number
  consecutiveFailures: number
  pending: Pending | null
  executedIds: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging / alerting
// ─────────────────────────────────────────────────────────────────────────────
function log(level: 'info' | 'warn' | 'error', msg: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data }, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  ;(level === 'info' ? console.log : console.error)(line)
}

async function alert(cfg: Config, severity: 'warn' | 'page', text: string) {
  log(severity === 'page' ? 'error' : 'warn', `ALERT: ${text}`)
  const urls = [cfg.alertWebhook, severity === 'page' ? cfg.pageWebhook : undefined].filter(Boolean) as string[]
  await Promise.all(
    urls.map((url) =>
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // `text` for Slack, `content` for Discord; adapt for your pager's schema.
        body: JSON.stringify({ text: `[rebalancer ${severity}] ${text}`, content: `[rebalancer ${severity}] ${text}` }),
        signal: AbortSignal.timeout(10_000),
      }).catch((e) => log('error', 'alert delivery failed', { url, err: String(e) })),
    ),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Local state: lock, halt switch, pending tx, daily notional, idempotency
// ─────────────────────────────────────────────────────────────────────────────
const utcDay = () => new Date().toISOString().slice(0, 10)

function readState(cfg: Config): State {
  const p = join(cfg.stateDir, 'state.json')
  const s: State = existsSync(p)
    ? JSON.parse(readFileSync(p, 'utf8'))
    : { day: utcDay(), notionalUsdToday: 0, consecutiveFailures: 0, pending: null, executedIds: [] }
  if (s.day !== utcDay()) {
    s.day = utcDay()
    s.notionalUsdToday = 0
  }
  return s
}

function writeState(cfg: Config, s: State) {
  const p = join(cfg.stateDir, 'state.json')
  writeFileSync(`${p}.tmp`, JSON.stringify(s, null, 2))
  renameSync(`${p}.tmp`, p) // atomic replace
}

const haltPath = (cfg: Config) => join(cfg.stateDir, 'HALT')
export function isHalted(cfg: Config): string | null {
  return existsSync(haltPath(cfg)) ? readFileSync(haltPath(cfg), 'utf8') || 'halted' : null
}
async function halt(cfg: Config, reason: string) {
  writeFileSync(haltPath(cfg), `${new Date().toISOString()} ${reason}\n`)
  await alert(cfg, 'page', `HALTED — no more trades until a human deletes ${haltPath(cfg)}. Reason: ${reason}`)
}

/** Single-flight: one rebalance at a time per state dir (and therefore per agent nonce). */
function withLock<T>(cfg: Config, fn: () => Promise<T>): Promise<T> {
  const p = join(cfg.stateDir, 'lock')
  if (existsSync(p)) {
    const pid = Number(readFileSync(p, 'utf8'))
    let alive = false
    try {
      process.kill(pid, 0)
      alive = true
    } catch {}
    if (alive) throw new Error(`another rebalance is running (pid ${pid})`)
    unlinkSync(p) // stale lock from a crashed process
  }
  const fd = openSync(p, 'wx')
  writeFileSync(fd, String(process.pid))
  closeSync(fd)
  return fn().finally(() => unlinkSync(p))
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────
export function makeClients(cfg: Config) {
  const account = privateKeyToAccount(cfg.agentPrivateKey)
  const pub = createPublicClient({ chain: mainnet, transport: http(cfg.readRpcUrl, { retryCount: 3, timeout: 20_000 }) })
  // Separate transport used ONLY for eth_sendRawTransaction.
  const submitter = createWalletClient({ chain: mainnet, account, transport: http(cfg.submitRpcUrl, { retryCount: 0, timeout: 20_000 }) })
  return { account, pub, submitter }
}
type Clients = ReturnType<typeof makeClients>

// ─────────────────────────────────────────────────────────────────────────────
// Prices
// ─────────────────────────────────────────────────────────────────────────────
async function readOracles(cfg: Config, { pub }: Clients) {
  const [eth, usdc, block] = await Promise.all([
    pub.readContract({ address: MAINNET.CHAINLINK_ETH_USD, abi: aggregatorAbi, functionName: 'latestRoundData' }),
    pub.readContract({ address: MAINNET.CHAINLINK_USDC_USD, abi: aggregatorAbi, functionName: 'latestRoundData' }),
    pub.getBlock({ blockTag: 'latest' }),
  ])
  const now = Number(block.timestamp)
  const ethUsd = eth[1] // 8 decimals
  const usdcUsd = usdc[1] // 8 decimals
  if (ethUsd <= 0n || usdcUsd <= 0n) throw new OracleError('non-positive oracle answer')
  if (now - Number(eth[3]) > cfg.ethUsdMaxAgeSec) throw new OracleError(`ETH/USD stale (${now - Number(eth[3])}s)`)
  if (now - Number(usdc[3]) > cfg.usdcUsdMaxAgeSec) throw new OracleError(`USDC/USD stale (${now - Number(usdc[3])}s)`)
  return { ethUsd, usdcUsd, block }
}
class OracleError extends Error {}

const BPS = 10_000n
const Q192 = 2n ** 192n

/** Expected output at oracle prices (no fee, no impact). */
function oracleOut(direction: Direction, amountIn: bigint, ethUsd: bigint, usdcUsd: bigint): bigint {
  // WETH 18dp, USDC 6dp → factor 1e12 between them.
  return direction === 'SELL_WETH' ? (amountIn * ethUsd) / usdcUsd / 10n ** 12n : (amountIn * usdcUsd * 10n ** 12n) / ethUsd
}

/** Output at pool spot price (no fee, no impact). Pool token0 = USDC, token1 = WETH. */
function spotOut(direction: Direction, amountIn: bigint, sqrtPriceX96: bigint): bigint {
  const p = sqrtPriceX96 * sqrtPriceX96 // price of token0 in token1, X192
  return direction === 'SELL_WETH' ? (amountIn * Q192) / p : (amountIn * p) / Q192
}

function usdValue(direction: Direction, amountIn: bigint, ethUsd: bigint, usdcUsd: bigint): number {
  const usd8 = direction === 'SELL_WETH' ? (amountIn * ethUsd) / 10n ** 18n : (amountIn * usdcUsd) / 10n ** 6n
  return Number(usd8) / 1e8
}

const tokens = (d: Direction) =>
  d === 'SELL_WETH'
    ? { tokenIn: MAINNET.WETH as Address, tokenOut: MAINNET.USDC as Address, decIn: 18, decOut: 6, symIn: 'WETH', symOut: 'USDC' }
    : { tokenIn: MAINNET.USDC as Address, tokenOut: MAINNET.WETH as Address, decIn: 6, decOut: 18, symIn: 'USDC', symOut: 'WETH' }

// ─────────────────────────────────────────────────────────────────────────────
// Pending-transaction resolution (run before every trade)
// ─────────────────────────────────────────────────────────────────────────────
/** Returns true if it is safe to send a new tx. */
async function resolvePending(cfg: Config, c: Clients, state: State): Promise<boolean> {
  const p = state.pending
  if (!p) return true
  const receipt = await c.pub.getTransactionReceipt({ hash: p.hash }).catch(() => null)
  if (receipt) {
    log('info', 'previous tx resolved', { hash: p.hash, status: receipt.status })
    if (receipt.status === 'success' && p.decisionId) state.executedIds = [...state.executedIds, p.decisionId].slice(-500)
    state.pending = null
    writeState(cfg, state)
    return true
  }
  const [nonce, block] = await Promise.all([c.pub.getTransactionCount({ address: c.account.address, blockTag: 'latest' }), c.pub.getBlock()])
  if (nonce > p.nonce) {
    // Our nonce was consumed by a tx we don't have a receipt for. With a single
    // sender that should be impossible → the key may be in use elsewhere.
    await halt(cfg, `agent nonce ${p.nonce} consumed by unknown tx (expected ${p.hash}). Possible key compromise.`)
    return false
  }
  if (Number(block.timestamp) > p.deadline + 60) {
    // Past the router deadline: even if it lands later it can only revert. Reuse the nonce.
    log('warn', 'previous tx dropped (deadline passed, never mined)', { hash: p.hash })
    state.pending = null
    writeState(cfg, state)
    return true
  }
  log('info', 'previous tx still in flight; not sending another', { hash: p.hash })
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// The execution path
// ─────────────────────────────────────────────────────────────────────────────
export async function executeRebalance(decision: RebalanceDecision, opts: { dryRun?: boolean; cfg?: Config } = {}): Promise<RebalanceResult> {
  const cfg = opts.cfg ?? loadConfig()
  mkdirSync(cfg.stateDir, { recursive: true })
  const halted = isHalted(cfg)
  if (halted) return { status: 'skipped', reason: `halted: ${halted.trim()}` }

  return withLock(cfg, async () => {
    const c = makeClients(cfg)
    const state = readState(cfg)
    try {
      const r = await executeLocked(cfg, c, state, decision, !!opts.dryRun)
      if (r.status === 'executed') state.consecutiveFailures = 0
      writeState(cfg, state)
      return r
    } catch (e) {
      const reason = e instanceof BaseError ? e.shortMessage : String((e as Error)?.message ?? e)
      log('error', 'rebalance failed', { reason, decision })
      if (opts.dryRun) return { status: 'failed', reason }
      state.consecutiveFailures += 1
      writeState(cfg, state)
      if (state.consecutiveFailures >= cfg.maxConsecutiveFailures) {
        await halt(cfg, `${state.consecutiveFailures} consecutive failures; last: ${reason}`)
      } else {
        await alert(cfg, 'warn', `rebalance failed (${state.consecutiveFailures}/${cfg.maxConsecutiveFailures}): ${reason}`)
      }
      return { status: 'failed', reason }
    }
  })
}

async function executeLocked(cfg: Config, c: Clients, state: State, d: RebalanceDecision, dryRun: boolean): Promise<RebalanceResult> {
  const { pub, account, submitter } = c
  const { tokenIn, tokenOut, decIn, decOut, symIn, symOut } = tokens(d.direction)

  // 0. Idempotency + in-flight tx
  if (d.id && state.executedIds.includes(d.id)) return { status: 'skipped', reason: `decision ${d.id} already executed` }
  if (d.id && state.pending?.decisionId === d.id) return { status: 'skipped', reason: `decision ${d.id} already in flight` }
  if (!dryRun && !(await resolvePending(cfg, c, state))) return { status: 'skipped', reason: 'previous tx unresolved' }
  if (isHalted(cfg)) return { status: 'skipped', reason: 'halted' }
  if (d.amountIn <= 0n) throw new Error('amountIn must be positive')

  // 1. Oracle prices (fresh, sane)
  let oracle
  try {
    oracle = await readOracles(cfg, c)
  } catch (e) {
    if (e instanceof OracleError) {
      await alert(cfg, 'warn', `skipping trade: ${e.message}`)
      return { status: 'skipped', reason: e.message }
    }
    throw e
  }
  const { ethUsd, usdcUsd, block } = oracle
  const pegDevBps = ((usdcUsd - 100_000_000n) * BPS) / 100_000_000n
  if ((pegDevBps < 0n ? -pegDevBps : pegDevBps) > BigInt(cfg.usdcPegToleranceBps)) {
    await halt(cfg, `USDC off peg: Chainlink USDC/USD = ${formatUnits(usdcUsd, 8)}. Human decision required.`)
    return { status: 'skipped', reason: 'USDC off peg' }
  }

  // 2. Size limits (soft; the on-chain Roles allowance is the hard cap)
  const usd = usdValue(d.direction, d.amountIn, ethUsd, usdcUsd)
  if (usd < cfg.minTradeUsd) return { status: 'skipped', reason: `trade $${usd.toFixed(0)} below MIN_TRADE_USD` }
  if (usd > cfg.maxTradeUsd) {
    await alert(cfg, 'warn', `signal asked for $${usd.toFixed(0)} > MAX_TRADE_USD; refused`)
    return { status: 'skipped', reason: 'above MAX_TRADE_USD' }
  }
  if (state.notionalUsdToday + usd > cfg.dailyNotionalUsd) {
    await alert(cfg, 'warn', `daily notional cap reached ($${state.notionalUsdToday.toFixed(0)} + $${usd.toFixed(0)} > $${cfg.dailyNotionalUsd})`)
    return { status: 'skipped', reason: 'daily notional cap' }
  }

  // 3. Treasury balance
  const bal = await pub.readContract({ address: tokenIn, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] })
  if (bal < d.amountIn) throw new Error(`Safe has ${formatUnits(bal, decIn)} ${symIn}, trade needs ${formatUnits(d.amountIn, decIn)}`)

  // 4. Quote at current block, then check it against the pool spot and against Chainlink
  const blockNumber = block.number
  const [{ result: quote }, slot0] = await Promise.all([
    pub.simulateContract({
      address: MAINNET.QUOTER_V2,
      abi: quoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn, tokenOut, amountIn: d.amountIn, fee: MAINNET.POOL_FEE, sqrtPriceLimitX96: 0n }],
      blockNumber,
    }),
    pub.readContract({ address: MAINNET.POOL_WETH_USDC_500, abi: poolAbi, functionName: 'slot0', blockNumber }),
  ])
  const quotedOut = quote[0]
  const refOracle = oracleOut(d.direction, d.amountIn, ethUsd, usdcUsd)
  const refSpot = spotOut(d.direction, d.amountIn, slot0[0])
  const oracleDevBps = Number(((refOracle - quotedOut) * BPS) / refOracle) // positive = we get less than oracle
  const impactBps = Number(((refSpot - quotedOut) * BPS) / refSpot)
  log('info', 'quote', { decision: d, usd, quotedOut, refOracle, refSpot, oracleDevBps, impactBps, block: blockNumber })

  if (oracleDevBps > cfg.maxOracleDeviationBps) {
    await alert(cfg, 'warn', `pool price ${oracleDevBps}bp worse than Chainlink (limit ${cfg.maxOracleDeviationBps}); skipped — possible manipulation or oracle lag`)
    return { status: 'skipped', reason: `oracle deviation ${oracleDevBps}bp` }
  }
  if (impactBps > cfg.maxPriceImpactBps) {
    await alert(cfg, 'warn', `price impact ${impactBps}bp > ${cfg.maxPriceImpactBps}bp; skipped — liquidity thin?`)
    return { status: 'skipped', reason: `price impact ${impactBps}bp` }
  }

  // 5. Minimum out: tighter of (quote − slippage) and (oracle − max deviation)
  const minFromQuote = (quotedOut * (BPS - BigInt(cfg.slippageBps))) / BPS
  const minFromOracle = (refOracle * (BPS - BigInt(cfg.maxOracleDeviationBps))) / BPS
  const amountOutMinimum = minFromQuote > minFromOracle ? minFromQuote : minFromOracle
  const deadline = Number(block.timestamp) + cfg.deadlineSec

  // 6. Build the call chain: Safe → SwapRouter.exactInputSingle, wrapped in Roles.execTransactionWithRole
  const swapData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        fee: MAINNET.POOL_FEE,
        recipient: cfg.safe, // Roles enforces recipient == avatar (the Safe)
        deadline: BigInt(deadline),
        amountIn: d.amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  const rolesCall = {
    address: cfg.roles,
    abi: rolesAbi,
    functionName: 'execTransactionWithRole',
    // operation 0 = Call (never DelegateCall); shouldRevert = true so a failed swap reverts the whole tx
    args: [MAINNET.SWAP_ROUTER, 0n, swapData, 0, cfg.roleKey, true],
  } as const

  // 7. Simulate exactly what will be sent (permission check + swap + minOut)
  try {
    await pub.simulateContract({ ...rolesCall, account: account.address })
  } catch (e) {
    const revert = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null
    const reason = revert instanceof ContractFunctionRevertedError ? `${revert.data?.errorName ?? revert.reason ?? 'revert'} ${JSON.stringify(revert.data?.args ?? [], (_, v) => (typeof v === 'bigint' ? v.toString() : v))}` : String(e)
    // ConditionViolation(status=..., ...) here usually means the Roles allowance is used up
    // for the rolling period, or the permission was changed. Either way, don't send.
    throw new Error(`simulation reverted: ${reason}`)
  }

  // 8. Gas
  const gasEstimate = await pub.estimateContractGas({ ...rolesCall, account: account.address })
  const gas = (gasEstimate * 13n) / 10n
  const baseFee = block.baseFeePerGas ?? 0n
  const maxPriorityFeePerGas = parseGwei(String(cfg.priorityFeeGwei))
  const cap = parseGwei(String(cfg.maxFeeGwei))
  if (baseFee + maxPriorityFeePerGas > cap) {
    log('info', 'gas above cap, skipping', { baseFeeGwei: formatUnits(baseFee, 9) })
    return { status: 'skipped', reason: `base fee ${formatUnits(baseFee, 9)} gwei above MAX_FEE_GWEI` }
  }
  const twiceBase = 2n * baseFee + maxPriorityFeePerGas
  const maxFeePerGas = twiceBase < cap ? twiceBase : cap
  const agentEth = await pub.getBalance({ address: account.address })
  if (agentEth < gas * maxFeePerGas) throw new Error(`agent EOA ${account.address} out of gas ETH (${formatUnits(agentEth, 18)} ETH)`)
  if (agentEth < parseEther(String(cfg.minAgentEth))) await alert(cfg, 'warn', `agent gas balance low: ${formatUnits(agentEth, 18)} ETH — top up ${account.address}`)

  if (dryRun) {
    log('info', 'dry run OK (simulated, not sent)', { amountOutMinimum, gas })
    return { status: 'dry-run', amountOutQuoted: quotedOut, amountOutMinimum, gas }
  }

  // 9. Sign locally, persist intent, then submit privately
  const nonce = await pub.getTransactionCount({ address: account.address, blockTag: 'latest' })
  const serialized = await account.signTransaction({
    chainId: mainnet.id,
    type: 'eip1559',
    to: cfg.roles,
    data: encodeFunctionData(rolesCall),
    value: 0n,
    nonce,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  })
  const hash = keccak256(serialized)
  // Written BEFORE sending so a crash between send and receipt can't cause a double trade.
  state.pending = { hash, nonce, deadline, decisionId: d.id, direction: d.direction, amountIn: d.amountIn.toString(), sentAt: new Date().toISOString() }
  state.notionalUsdToday += usd
  writeState(cfg, state)

  const returned = await submitter.sendRawTransaction({ serializedTransaction: serialized })
  if (returned.toLowerCase() !== hash.toLowerCase()) log('warn', 'submit RPC returned unexpected hash', { returned, hash })
  log('info', 'submitted', { hash, nonce, amountIn: d.amountIn, amountOutMinimum, maxFeeGwei: formatUnits(maxFeePerGas, 9), reason: d.reason })

  // 10. Wait until mined or until the deadline has certainly passed
  let receipt
  try {
    receipt = await pub.waitForTransactionReceipt({ hash, timeout: (cfg.deadlineSec + 90) * 1000, pollingInterval: 4_000 })
  } catch (e) {
    if (e instanceof WaitForTransactionReceiptTimeoutError) {
      // Leave `pending` set; the next run resolves it (the deadline guarantees it can't fill late).
      await alert(cfg, 'warn', `tx ${hash} not mined before deadline; will be resolved on next run`)
      return { status: 'pending', txHash: hash, reason: 'not mined before deadline' }
    }
    throw e
  }

  state.pending = null
  const gasCostWei = receipt.gasUsed * receipt.effectiveGasPrice
  if (receipt.status !== 'success') {
    writeState(cfg, state)
    throw new Error(`tx ${hash} reverted on-chain (block ${receipt.blockNumber})`)
  }
  if (d.id) state.executedIds = [...state.executedIds, d.id].slice(-500)

  // 11. Verify what actually happened from the logs: tokenOut into the Safe, tokenIn out of the Safe
  let amountOut = 0n
  let amountInActual = 0n
  for (const l of receipt.logs) {
    if (l.address.toLowerCase() !== tokenOut.toLowerCase() && l.address.toLowerCase() !== tokenIn.toLowerCase()) continue
    try {
      const ev = decodeEventLog({ abi: erc20Abi, data: l.data, topics: l.topics })
      if (ev.eventName !== 'Transfer') continue
      if (l.address.toLowerCase() === tokenOut.toLowerCase() && getAddress(ev.args.to) === cfg.safe) amountOut += ev.args.value
      if (l.address.toLowerCase() === tokenIn.toLowerCase() && getAddress(ev.args.from) === cfg.safe) amountInActual += ev.args.value
    } catch {}
  }
  if (amountOut < amountOutMinimum || amountInActual !== d.amountIn) {
    await halt(cfg, `tx ${hash} succeeded but Safe received ${amountOut} ${symOut} (min ${amountOutMinimum}) for ${amountInActual} ${symIn} — investigate`)
  }
  log('info', 'executed', {
    hash,
    block: receipt.blockNumber,
    [`${symIn}_in`]: formatUnits(amountInActual, decIn),
    [`${symOut}_out`]: formatUnits(amountOut, decOut),
    vsOracleBps: Number(((refOracle - amountOut) * BPS) / refOracle),
    gasEth: formatUnits(gasCostWei, 18),
  })
  return { status: 'executed', txHash: hash, amountIn: amountInActual, amountOut, gasCostWei }
}

// ─────────────────────────────────────────────────────────────────────────────
// Preflight: verify the on-chain setup matches what this code assumes
// ─────────────────────────────────────────────────────────────────────────────
export async function preflight(cfg: Config = loadConfig()): Promise<boolean> {
  const c = makeClients(cfg)
  const { pub, account } = c
  const checks: [string, boolean, unknown][] = []
  const chainId = await pub.getChainId()
  checks.push(['read RPC is mainnet', chainId === 1, chainId])
  const [avatar, target, rolesOwner, moduleOn, owners, threshold, wethAllow, usdcAllow, gasBal, weth, usdc] = await Promise.all([
    pub.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'avatar' }),
    pub.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'target' }),
    pub.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'owner' }),
    pub.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'isModuleEnabled', args: [cfg.roles] }),
    pub.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'getOwners' }),
    pub.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'getThreshold' }),
    pub.readContract({ address: MAINNET.WETH, abi: erc20Abi, functionName: 'allowance', args: [cfg.safe, MAINNET.SWAP_ROUTER] }),
    pub.readContract({ address: MAINNET.USDC, abi: erc20Abi, functionName: 'allowance', args: [cfg.safe, MAINNET.SWAP_ROUTER] }),
    pub.getBalance({ address: account.address }),
    pub.readContract({ address: MAINNET.WETH, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] }),
    pub.readContract({ address: MAINNET.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] }),
  ])
  checks.push(['Roles.avatar == Safe', getAddress(avatar) === cfg.safe, avatar])
  checks.push(['Roles.target == Safe', getAddress(target) === cfg.safe, target])
  checks.push(['Roles.owner == Safe', getAddress(rolesOwner) === cfg.safe, rolesOwner])
  checks.push(['Roles enabled as Safe module', moduleOn, moduleOn])
  checks.push(['agent is NOT a Safe owner', !owners.map(getAddress).includes(account.address), owners])
  checks.push(['Safe threshold >= 2', threshold >= 2n, threshold])
  checks.push(['Safe approved router for WETH', wethAllow > 0n, wethAllow])
  checks.push(['Safe approved router for USDC', usdcAllow > 0n, usdcAllow])
  checks.push([`agent gas balance >= ${cfg.minAgentEth} ETH`, gasBal >= parseEther(String(cfg.minAgentEth)), formatUnits(gasBal, 18)])
  checks.push(['not halted', !isHalted(cfg), isHalted(cfg)])
  for (const [key, dec] of [[ALLOWANCE_KEYS.WETH_IN, 18], [ALLOWANCE_KEYS.USDC_IN, 6]] as const) {
    const [refill, maxRefill, period, balance] = await pub.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'allowances', args: [key] })
    checks.push([`Roles allowance ${key.slice(0, 42)} configured`, period > 0n && maxRefill > 0n, {
      refillPerPeriod: formatUnits(refill, dec), maxRefill: formatUnits(maxRefill, dec), periodSec: period, storedBalance: formatUnits(balance, dec),
    }])
  }
  for (const [name, ok, v] of checks) log(ok ? 'info' : 'error', `${ok ? 'PASS' : 'FAIL'} ${name}`, { value: v })
  log('info', 'treasury', { safe: cfg.safe, agent: account.address, WETH: formatUnits(weth, 18), USDC: formatUnits(usdc, 6) })
  return checks.every(([, ok]) => ok)
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const [cmd, side, amount] = process.argv.slice(2)
  const dryRun = process.argv.includes('--dry-run')
  if (cmd === 'preflight') {
    process.exit((await preflight()) ? 0 : 1)
  } else if (cmd === 'trade' && (side === 'sell-weth' || side === 'buy-weth') && amount) {
    const direction: Direction = side === 'sell-weth' ? 'SELL_WETH' : 'BUY_WETH'
    const amountIn = parseUnits(amount, direction === 'SELL_WETH' ? 18 : 6)
    const r = await executeRebalance({ direction, amountIn, reason: 'manual CLI' }, { dryRun })
    log('info', 'result', r)
    process.exit(r.status === 'executed' || r.status === 'dry-run' ? 0 : 1)
  } else {
    console.error('usage: tsx rebalance.ts preflight | trade <sell-weth|buy-weth> <amount> [--dry-run]')
    process.exit(2)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    log('error', 'fatal', { err: String(e?.stack ?? e) })
    process.exit(1)
  })
}
