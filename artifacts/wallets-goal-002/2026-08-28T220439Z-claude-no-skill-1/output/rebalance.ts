/**
 * rebalance.ts — execution path for an unattended WETH/USDC treasury rebalancer
 * on Ethereum mainnet, using Uniswap V3.
 *
 * SCOPE OF THIS FILE
 * ------------------
 * This is the *execution* half only. It takes a `Signal` from your strategy
 * ("I want to be 62% WETH") and turns it into a signed, submitted, confirmed
 * mainnet transaction — with the guards that make that safe to do unattended.
 * It deliberately contains no alpha, no indicators, no signal generation.
 *
 * CUSTODY MODEL (read this before you run it)
 * -------------------------------------------
 * Two backends, selected by EXECUTION_MODE:
 *
 *   'roles'  (recommended, and what DEPLOY.md walks you through)
 *       Treasury lives in a Safe. A Zodiac Roles Modifier v2 module is enabled
 *       on that Safe. The agent's hot key is granted one narrow role: call
 *       SwapRouter02.exactInputSingle with tokenIn/tokenOut restricted to
 *       {WETH, USDC} and recipient forced to the Safe, plus ERC20.approve
 *       restricted to (spender == SwapRouter02). Rate limits live on-chain in
 *       the Roles module, not just in this file.
 *
 *       Consequence: full compromise of this VM and its key lets the attacker
 *       churn your treasury through Uniswap at a loss. It does NOT let them
 *       transfer it out. That is the whole point.
 *
 *   'eoa'    (degraded — the hot key literally holds the money)
 *       Included because it is the fastest thing to stand up and because you
 *       should see exactly how much less protection it gives you. Full
 *       compromise of this VM = total loss of everything the key holds.
 *       Do not point this at $400k.
 *
 * The calldata that hits Uniswap is identical in both modes. Only the wrapper,
 * the token holder, and the blast radius differ.
 *
 * TRANSACTION PRIVACY
 * -------------------
 * Swaps are submitted through a private relay (Flashbots Protect by default),
 * never the public mempool. A $50k WETH/USDC swap broadcast publicly with a
 * visible amountOutMinimum is an advertisement for a sandwich.
 *
 * PRICE SAFETY
 * ------------
 * amountOutMinimum is derived from a live Uniswap quote AND cross-checked
 * against the Chainlink ETH/USD feed. A slippage percentage alone is worthless
 * if it is a percentage of a manipulated pool price — the oracle band is what
 * actually bounds your loss.
 *
 * CRASH SAFETY
 * ------------
 * Every intent is journalled to disk with its nonce *before* broadcast, and
 * reconciled on startup. An unattended bot that restarts mid-flight and
 * re-sends a trade it already made is a far more likely way to lose money than
 * anything exotic.
 *
 * Run:  npx tsx rebalance.ts            (respects DRY_RUN)
 */

import 'dotenv/config'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------
// 1. MAINNET ADDRESSES
//
// Every one of these is verified at runtime by assertOnchainReality() before a
// single wei moves. Do not trust this list because it is in a file — trust it
// because the preflight checked the bytecode, the symbols, the decimals, and
// re-derived the pools from the canonical Uniswap V3 factory.
// ---------------------------------------------------------------------------

const WETH = getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48') // native Circle USDC
const SWAP_ROUTER_02 = getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
const QUOTER_V2 = getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e')
const UNIV3_FACTORY = getAddress('0x1F98431c8aD98523631AE4a59f267346ea31F984')
const CHAINLINK_ETH_USD = getAddress('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419')

/**
 * Fee tiers we route through; best quote wins.
 *
 * Measured on mainnet at $2,425/ETH: the 0.05% pool beat the others at every
 * size from $10k to $100k (21.0 bps vs oracle on a $50k buy, versus 53.2 bps
 * for 0.3%). The 0.3% tier is kept not because it competes but because it is
 * the fallback if the 0.05% pool is ever drained or manipulated — losing 30 bps
 * beats not being able to rebalance. The 0.01% tier is excluded: it has ~10x
 * less liquidity and degrades badly above $25k.
 */
const FEE_TIERS = [500, 3000] as const
type FeeTier = (typeof FEE_TIERS)[number]

const WETH_DECIMALS = 18
const USDC_DECIMALS = 6
/** Chainlink ETH/USD reports 8 decimals and has a 3600s heartbeat on mainnet. */
const ORACLE_DECIMALS = 8
const ORACLE_HEARTBEAT_S = 3600

// ---------------------------------------------------------------------------
// 2. ABIs
// ---------------------------------------------------------------------------

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
])

const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

const swapRouter02Abi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
])

const factoryAbi = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
])

const poolAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function liquidity() view returns (uint128)',
])

const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
])

/** Zodiac Roles Modifier v2. The agent calls this; the Safe executes. */
const rolesV2Abi = parseAbi([
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)',
  'function avatar() view returns (address)',
  'function target() view returns (address)',
])

// ---------------------------------------------------------------------------
// 3. CONFIG
//
// Everything here is a risk limit. Read each one and decide whether you would
// be comfortable waking up to the worst case it permits, because unattended
// means you will not be consulted.
// ---------------------------------------------------------------------------

/** Thrown for conditions where refusing to act is the correct outcome. */
class Abort extends Error {
  constructor(public readonly reason: string, public readonly detail: Record<string, unknown> = {}) {
    super(reason)
  }
}

/**
 * Required config is read at module load, which is before main()'s error
 * handler exists — throwing here would produce a raw Node stack trace instead
 * of a structured log. So missing vars are collected and reported together by
 * assertConfigComplete() at the start of the run. An operator fixing a fresh
 * deploy sees every missing variable at once rather than one per attempt.
 */
const missingEnv: string[] = []

function env(key: string): string {
  const v = process.env[key]
  if (v === undefined || v === '') {
    missingEnv.push(key)
    return ''
  }
  return v
}

function assertConfigComplete() {
  if (missingEnv.length > 0) {
    throw new Abort('missing_env_vars', {
      keys: missingEnv,
      hint: 'See .env.example. Secrets should be injected by your secrets ' +
        'manager at process start, not read from a file on disk.',
    })
  }
}
function envOpt(key: string, fallback: string): string {
  const v = process.env[key]
  return v === undefined || v === '' ? fallback : v
}
function envInt(key: string, fallback: number): number {
  const v = process.env[key]
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`env ${key} is not a number: ${v}`)
  return n
}

const CONFIG = {
  executionMode: envOpt('EXECUTION_MODE', 'roles') as 'roles' | 'eoa',

  /** Read RPC. Use a paid, dedicated endpoint — not a public free one. */
  rpcPrimary: env('RPC_PRIMARY'),
  /** Independent provider, different company. Used to cross-check state. */
  rpcSecondary: env('RPC_SECONDARY'),
  /** Private relay for submission. Swaps never touch the public mempool. */
  rpcSubmit: envOpt('RPC_SUBMIT', 'https://rpc.flashbots.net/fast'),

  /** Hot signer. In 'roles' mode this key holds gas money only. */
  agentPrivateKey: env('AGENT_PRIVATE_KEY') as Hex,

  /** Safe holding the treasury. Required in 'roles' mode. */
  safeAddress: process.env.SAFE_ADDRESS as Address | undefined,
  /** Zodiac Roles Modifier v2 instance enabled on that Safe. */
  rolesModifier: process.env.ROLES_MODIFIER as Address | undefined,
  /** bytes32 role key granted to the agent. */
  roleKey: envOpt('ROLE_KEY', '0x' + '00'.repeat(32)) as Hex,

  // --- Trade sizing -------------------------------------------------------
  /** Do nothing unless allocation drifts this far from target. Stops churn. */
  rebalanceBandBps: envInt('REBALANCE_BAND_BPS', 300), // 3%
  /** Below this, gas and spread eat the benefit. USD, 6dp. */
  minTradeUsd: BigInt(envInt('MIN_TRADE_USD', 10_000)) * 10n ** 6n,
  /** Hard ceiling on a single trade, regardless of what the signal wants. */
  maxTradeUsd: BigInt(envInt('MAX_TRADE_USD', 50_000)) * 10n ** 6n,
  /** Hard ceiling on total notional in a rolling 24h. Caps a runaway loop. */
  maxDailyNotionalUsd: BigInt(envInt('MAX_DAILY_NOTIONAL_USD', 200_000)) * 10n ** 6n,
  /** Minimum seconds between trades. Second line of defence against churn. */
  minSecondsBetweenTrades: envInt('MIN_SECONDS_BETWEEN_TRADES', 900),

  // --- Price safety -------------------------------------------------------
  /**
   * Slippage tolerance applied to the Uniswap quote to get amountOutMinimum.
   * This covers price movement between quoting and inclusion — NOT price
   * impact, which is already baked into the quote. 30 bps is a wide ETH move
   * for the 1-2 blocks we are exposed for.
   */
  slippageBps: envInt('SLIPPAGE_BPS', 30), // 0.30%
  /**
   * Max tolerated divergence between the Uniswap quote and the Chainlink
   * oracle. This is the real protection: it bounds how badly a manipulated
   * pool can price your trade.
   *
   * Calibration, measured on mainnet: a $50k trade in the 0.05% pool prices
   * 21.0 bps worse than oracle when buying WETH and 6.4 bps BETTER when
   * selling (the pool mid sits slightly above the feed). So honest execution
   * lives inside ~25 bps. 100 bps gives 4-5x headroom for normal basis and
   * oracle lag while still refusing anything that looks manipulated.
   * Re-measure before tightening this — too tight and the bot silently stops
   * trading during exactly the volatility you wanted it to trade through.
   */
  maxOracleDivergenceBps: envInt('MAX_ORACLE_DIVERGENCE_BPS', 100), // 1.00%

  // --- Gas ----------------------------------------------------------------
  /**
   * Refuse to trade when base fee is above this. Routine rebalancing is never
   * urgent enough to pay a gas spike; skipping a run costs you drift, and
   * drift is cheap.
   *
   * Calibration: mainnet base fee was ~0.05 gwei when this was written, and a
   * swap costs ~180-200k gas end to end (95-127k for exactInputSingle itself,
   * plus 21k base and ~40k of Roles module overhead). At 25 gwei that is
   * ~$12 — about 2.4 bps on a $50k trade, i.e. still noise. The cap is
   * therefore ~500x current base fee: generous enough that it never blocks
   * you in normal conditions, tight enough to stop the bot burning money in
   * a genuine congestion event.
   */
  maxBaseFeeGwei: envInt('MAX_BASE_FEE_GWEI', 25),
  /** Dominated by relay/builder economics rather than the public fee market;
   *  ~$1 at current prices, so not worth optimising. */
  maxPriorityFeeGwei: Number(envOpt('MAX_PRIORITY_FEE_GWEI', '2')),
  /** Alert threshold for the hot signer's ETH balance. */
  minSignerEthWei: BigInt(envOpt('MIN_SIGNER_ETH_WEI', '50000000000000000')), // 0.05 ETH
  /** How many blocks to wait before replacing/cancelling a stuck tx. */
  inclusionDeadlineBlocks: envInt('INCLUSION_DEADLINE_BLOCKS', 25), // ~5 min

  // --- Operations ---------------------------------------------------------
  stateDir: envOpt('STATE_DIR', join(process.cwd(), 'state')),
  /** If this file exists, the agent refuses to trade. Local kill switch. */
  killSwitchFile: envOpt('KILL_SWITCH_FILE', join(process.cwd(), 'state', 'HALT')),
  dryRun: envOpt('DRY_RUN', 'true') === 'true',
} as const

const BPS = 10_000n

// ---------------------------------------------------------------------------
// 4. LOGGING — structured, because you will be reading this in a log
//    aggregator at 3am, not in a terminal.
// ---------------------------------------------------------------------------

type Level = 'info' | 'warn' | 'error'
function log(level: Level, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify(
    { ts: new Date().toISOString(), level, event, ...data },
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
  )
  if (level === 'error') console.error(line)
  else console.log(line)
}

// ---------------------------------------------------------------------------
// 5. CLIENTS
// ---------------------------------------------------------------------------

/** Lazy: privateKeyToAccount throws on an empty key, and we want the missing
 *  key reported as config, not as a crash. */
let _account: ReturnType<typeof privateKeyToAccount> | undefined
function getAccount() {
  if (!_account) _account = privateKeyToAccount(CONFIG.agentPrivateKey)
  return _account
}

const primary = createPublicClient({
  chain: mainnet,
  transport: http(CONFIG.rpcPrimary, { retryCount: 3, timeout: 15_000 }),
})
const secondary = createPublicClient({
  chain: mainnet,
  transport: http(CONFIG.rpcSecondary, { retryCount: 2, timeout: 15_000 }),
})
/**
 * Submission-only. Flashbots Protect implements eth_sendRawTransaction and
 * little else reliably — never read state through it.
 */
const submit = createPublicClient({
  chain: mainnet,
  transport: http(CONFIG.rpcSubmit, { retryCount: 2, timeout: 20_000 }),
})


// ---------------------------------------------------------------------------
// 6. DURABLE JOURNAL
//
// The failure mode this exists for: we sign and broadcast, the VM dies before
// we see a receipt, systemd restarts us, and we happily place the same $50k
// trade again. The journal makes every run reconcile before it decides.
// ---------------------------------------------------------------------------

type JournalStatus = 'intent' | 'broadcast' | 'confirmed' | 'failed' | 'abandoned'

interface JournalEntry {
  id: string
  createdAt: number
  status: JournalStatus
  nonce: number
  txHash?: Hex
  /** Notional in USD 6dp, used for the rolling daily cap. */
  notionalUsd: string
  tokenIn: Address
  tokenOut: Address
  amountIn: string
  amountOutMinimum: string
  /** Set on confirmation. */
  blockNumber?: string
  gasUsed?: string
  note?: string
}

const JOURNAL_PATH = join(CONFIG.stateDir, 'journal.json')
const LOCK_PATH = join(CONFIG.stateDir, 'agent.lock')

function loadJournal(): JournalEntry[] {
  if (!existsSync(JOURNAL_PATH)) return []
  try {
    return JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as JournalEntry[]
  } catch (e) {
    // A corrupt journal means we cannot know what we already did. Stopping is
    // the only safe response; guessing risks a duplicate trade.
    throw new Abort('journal_corrupt', { path: JOURNAL_PATH, error: String(e) })
  }
}

/** Atomic + fsynced. A half-written journal is as bad as no journal. */
function saveJournal(entries: JournalEntry[]) {
  mkdirSync(CONFIG.stateDir, { recursive: true })
  const tmp = `${JOURNAL_PATH}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, JSON.stringify(entries, null, 2))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, JOURNAL_PATH)
}

function upsert(entries: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  const next = entries.filter((e) => e.id !== entry.id)
  next.push(entry)
  saveJournal(next)
  return next
}

/**
 * Single-writer guarantee. Two instances sharing a nonce is a bad day.
 *
 * Note the two sharp edges here, both of which fail in the direction of
 * "bot silently never trades again", which is the worst failure mode for an
 * unattended system:
 *   - The lock must be DELETED on release, not blanked. A blank file parses as
 *     pid 0, and process.kill(0, 0) targets the current process group and
 *     *succeeds* — so a cleanly-stopped bot would read its own leftover lock as
 *     a live instance and refuse to run, forever.
 *   - A pid must be validated before it is probed, for the same reason.
 */
function acquireLock() {
  mkdirSync(CONFIG.stateDir, { recursive: true })
  if (existsSync(LOCK_PATH)) {
    const owner = readFileSync(LOCK_PATH, 'utf8').trim()
    const pid = Number(owner)
    const plausible = Number.isInteger(pid) && pid > 0
    let alive = false
    if (plausible) {
      try {
        process.kill(pid, 0) // signal 0 = existence check, no signal delivered
        alive = true
      } catch {
        alive = false // ESRCH: process is gone
      }
    }
    if (alive && pid !== process.pid) throw new Abort('another_instance_running', { pid })
    log('warn', 'stale_lock_cleared', { owner: owner || '(empty)' })
  }
  writeFileSync(LOCK_PATH, String(process.pid))
  const release = () => {
    try {
      if (existsSync(LOCK_PATH) && readFileSync(LOCK_PATH, 'utf8').trim() === String(process.pid)) {
        rmSync(LOCK_PATH, { force: true })
      }
    } catch { /* best effort — a stale lock is recoverable, a crash here is not */ }
  }
  process.on('exit', release)
  process.on('SIGINT', () => { release(); process.exit(130) })
  process.on('SIGTERM', () => { release(); process.exit(143) })
}

/**
 * Resolve anything left in flight from a previous run before we decide
 * anything new. Returns the reconciled journal.
 */
async function reconcile(entries: JournalEntry[]): Promise<JournalEntry[]> {
  const open = entries.filter((e) => e.status === 'intent' || e.status === 'broadcast')
  if (open.length === 0) return entries

  const confirmedNonce = await primary.getTransactionCount({
    address: getAccount().address,
    blockTag: 'latest',
  })

  let out = entries
  for (const e of open) {
    if (e.txHash) {
      const receipt = await primary
        .getTransactionReceipt({ hash: e.txHash })
        .catch(() => null)
      if (receipt) {
        out = upsert(out, {
          ...e,
          status: receipt.status === 'success' ? 'confirmed' : 'failed',
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          note: 'reconciled_on_startup',
        })
        log('info', 'reconciled', { id: e.id, txHash: e.txHash, status: receipt.status })
        continue
      }
    }

    if (e.nonce < confirmedNonce) {
      // The nonce was consumed but not by a tx we can find a receipt for —
      // most likely replaced. We cannot assume our trade did not happen.
      // Refuse to trade until a human looks.
      out = upsert(out, { ...e, status: 'abandoned', note: 'nonce_consumed_receipt_unknown' })
      throw new Abort('unresolved_inflight_tx', {
        id: e.id,
        nonce: e.nonce,
        txHash: e.txHash ?? null,
        hint: 'Nonce was consumed but the recorded tx has no receipt. Inspect the ' +
          'signer on Etherscan, mark the journal entry resolved, then restart.',
      })
    }

    // Nonce still free: nothing landed. Safe to discard the intent.
    out = upsert(out, { ...e, status: 'abandoned', note: 'nonce_still_free_never_landed' })
    log('warn', 'discarded_stale_intent', { id: e.id, nonce: e.nonce })
  }
  return out
}

function rollingDailyNotionalUsd(entries: JournalEntry[]): bigint {
  const cutoff = Date.now() - 24 * 3600 * 1000
  return entries
    .filter((e) => e.createdAt >= cutoff && (e.status === 'confirmed' || e.status === 'broadcast'))
    .reduce((acc, e) => acc + BigInt(e.notionalUsd), 0n)
}

function lastTradeAt(entries: JournalEntry[]): number {
  const t = entries
    .filter((e) => e.status === 'confirmed' || e.status === 'broadcast')
    .map((e) => e.createdAt)
  return t.length ? Math.max(...t) : 0
}

// ---------------------------------------------------------------------------
// 7. PREFLIGHT
//
// Verify the world matches our assumptions. Cheap, and it turns a hardcoded
// address list into a checked one.
// ---------------------------------------------------------------------------

async function assertOnchainReality() {
  // Chain identity, from both providers independently.
  const [id1, id2] = await Promise.all([primary.getChainId(), secondary.getChainId()])
  if (id1 !== 1 || id2 !== 1) throw new Abort('not_mainnet', { id1, id2 })

  // Providers agree on head. A provider stuck on a stale block would give us
  // stale balances and stale prices.
  const [b1, b2] = await Promise.all([primary.getBlockNumber(), secondary.getBlockNumber()])
  const drift = b1 > b2 ? b1 - b2 : b2 - b1
  if (drift > 5n) throw new Abort('rpc_providers_out_of_sync', { b1, b2, drift })

  // Contracts exist.
  for (const [name, addr] of Object.entries({
    WETH, USDC, SWAP_ROUTER_02, QUOTER_V2, UNIV3_FACTORY, CHAINLINK_ETH_USD,
  })) {
    const code = await primary.getCode({ address: addr as Address })
    if (!code || code === '0x') throw new Abort('address_has_no_code', { name, addr })
  }

  // Tokens are what we think they are.
  const [wSym, wDec, uSym, uDec] = await Promise.all([
    primary.readContract({ address: WETH, abi: erc20Abi, functionName: 'symbol' }),
    primary.readContract({ address: WETH, abi: erc20Abi, functionName: 'decimals' }),
    primary.readContract({ address: USDC, abi: erc20Abi, functionName: 'symbol' }),
    primary.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }),
  ])
  if (wSym !== 'WETH' || wDec !== WETH_DECIMALS) throw new Abort('weth_mismatch', { wSym, wDec })
  if (uSym !== 'USDC' || uDec !== USDC_DECIMALS) throw new Abort('usdc_mismatch', { uSym, uDec })

  // Pools are re-derived from the canonical factory rather than trusted.
  for (const fee of FEE_TIERS) {
    const pool = await primary.readContract({
      address: UNIV3_FACTORY, abi: factoryAbi, functionName: 'getPool', args: [WETH, USDC, fee],
    })
    if (pool === '0x0000000000000000000000000000000000000000') {
      throw new Abort('pool_missing', { fee })
    }
    const liq = await primary.readContract({ address: pool, abi: poolAbi, functionName: 'liquidity' })
    log('info', 'pool_ok', { fee, pool, liquidity: liq })
  }

  // In roles mode, confirm the module is actually wired to our Safe.
  if (CONFIG.executionMode === 'roles') {
    if (!CONFIG.safeAddress || !CONFIG.rolesModifier) {
      throw new Abort('roles_mode_misconfigured', { hint: 'Set SAFE_ADDRESS and ROLES_MODIFIER' })
    }
    const [avatar, target] = await Promise.all([
      primary.readContract({ address: CONFIG.rolesModifier, abi: rolesV2Abi, functionName: 'avatar' }),
      primary.readContract({ address: CONFIG.rolesModifier, abi: rolesV2Abi, functionName: 'target' }),
    ])
    if (getAddress(avatar) !== getAddress(CONFIG.safeAddress)) {
      throw new Abort('roles_avatar_mismatch', { avatar, safe: CONFIG.safeAddress })
    }
    if (getAddress(target) !== getAddress(CONFIG.safeAddress)) {
      throw new Abort('roles_target_mismatch', { target, safe: CONFIG.safeAddress })
    }
  }

  // Gas money. In roles mode this is the only thing the hot key holds.
  const ethBal = await primary.getBalance({ address: getAccount().address })
  if (ethBal < CONFIG.minSignerEthWei) {
    throw new Abort('signer_out_of_gas', {
      signer: getAccount().address,
      balanceEth: formatUnits(ethBal, 18),
      hint: 'Top up the agent signer with ETH. It cannot trade without gas.',
    })
  }

  log('info', 'preflight_ok', {
    mode: CONFIG.executionMode,
    signer: getAccount().address,
    treasury: treasuryAddress(),
    block: b1,
    signerEth: formatUnits(ethBal, 18),
  })
}

function assertNotHalted() {
  if (existsSync(CONFIG.killSwitchFile)) {
    throw new Abort('kill_switch_engaged', {
      file: CONFIG.killSwitchFile,
      message: readFileSync(CONFIG.killSwitchFile, 'utf8').trim().slice(0, 500),
    })
  }
}

/** Whoever actually holds the tokens and receives swap output. */
function treasuryAddress(): Address {
  return CONFIG.executionMode === 'roles' ? CONFIG.safeAddress! : getAccount().address
}

// ---------------------------------------------------------------------------
// 8. PRICING
// ---------------------------------------------------------------------------

interface OraclePrice {
  /** USD per ETH, 8 decimals. */
  usdPerEth: bigint
  updatedAt: number
}

async function readOracle(client: PublicClient): Promise<OraclePrice> {
  const [, answer, , updatedAt] = await client.readContract({
    address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: 'latestRoundData',
  })
  if (answer <= 0n) throw new Abort('oracle_non_positive', { answer })

  const ageS = Math.floor(Date.now() / 1000) - Number(updatedAt)
  // Allow a little past heartbeat for normal jitter, but stale price = no trade.
  if (ageS > ORACLE_HEARTBEAT_S * 1.5) {
    throw new Abort('oracle_stale', { ageS, heartbeat: ORACLE_HEARTBEAT_S })
  }
  return { usdPerEth: answer, updatedAt: Number(updatedAt) }
}

/** Read the oracle from both providers; disagreement means one is lying or lagging. */
async function readOracleChecked(): Promise<OraclePrice> {
  const [a, b] = await Promise.all([readOracle(primary), readOracle(secondary)])
  const hi = a.usdPerEth > b.usdPerEth ? a.usdPerEth : b.usdPerEth
  const lo = a.usdPerEth > b.usdPerEth ? b.usdPerEth : a.usdPerEth
  const divergenceBps = ((hi - lo) * BPS) / lo
  if (divergenceBps > 50n) {
    throw new Abort('rpc_price_disagreement', { a: a.usdPerEth, b: b.usdPerEth, divergenceBps })
  }
  return a
}

interface Quote {
  fee: FeeTier
  amountOut: bigint
  gasEstimate: bigint
}

/** Quote every allowed fee tier and take the best fill. */
async function bestQuote(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<Quote> {
  const results: Quote[] = []
  for (const fee of FEE_TIERS) {
    try {
      const { result } = await primary.simulateContract({
        address: QUOTER_V2,
        abi: quoterV2Abi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
        account: treasuryAddress(),
      })
      const [amountOut, , , gasEstimate] = result
      results.push({ fee, amountOut, gasEstimate })
    } catch (e) {
      log('warn', 'quote_failed', { fee, error: shortError(e) })
    }
  }
  if (results.length === 0) throw new Abort('no_quotes_available', { tokenIn, tokenOut, amountIn })
  return results.reduce((best, q) => (q.amountOut > best.amountOut ? q : best))
}

/**
 * The trade only proceeds if the pool's price agrees with Chainlink. This is
 * what stops a manipulated pool from turning a "0.3% slippage" trade into a
 * 40% loss — slippage is measured against the quote, and the quote is exactly
 * the thing an attacker controls.
 */
function assertQuoteWithinOracleBand(args: {
  tokenIn: Address
  amountIn: bigint
  quoteOut: bigint
  usdPerEth: bigint
}) {
  const { tokenIn, amountIn, quoteOut, usdPerEth } = args

  let oracleOut: bigint
  if (tokenIn === USDC) {
    // USDC(6) in -> WETH(18) out.  weth = usdc * 1e18 * 1e8 / (1e6 * price)
    oracleOut = (amountIn * 10n ** 18n * 10n ** BigInt(ORACLE_DECIMALS)) / (10n ** 6n * usdPerEth)
  } else {
    // WETH(18) in -> USDC(6) out.  usdc = weth * price * 1e6 / (1e18 * 1e8)
    oracleOut = (amountIn * usdPerEth * 10n ** 6n) / (10n ** 18n * 10n ** BigInt(ORACLE_DECIMALS))
  }

  if (quoteOut >= oracleOut) return // better than oracle — no complaint

  const shortfallBps = ((oracleOut - quoteOut) * BPS) / oracleOut
  if (shortfallBps > BigInt(CONFIG.maxOracleDivergenceBps)) {
    throw new Abort('quote_outside_oracle_band', {
      quoteOut, oracleOut, shortfallBps, limitBps: CONFIG.maxOracleDivergenceBps,
      hint: 'Pool price disagrees with Chainlink beyond tolerance. Possible ' +
        'manipulation, depeg, or a genuine dislocation. Not trading.',
    })
  }
  log('info', 'oracle_band_ok', { quoteOut, oracleOut, shortfallBps })
}

// ---------------------------------------------------------------------------
// 9. DECISION
//
// Strategy hands us a target weight. Everything below converts that into a
// concrete, bounded trade — or into "do nothing", which is the common case.
// ---------------------------------------------------------------------------

export interface Signal {
  /** Desired WETH share of the treasury, in bps. 5000 = 50/50. */
  targetWethBps: number
  /** Free-form provenance, journalled for the post-mortem you will one day do. */
  source: string
}

interface Position {
  wethWei: bigint
  usdc6: bigint
  usdPerEth: bigint
  wethValueUsd6: bigint
  totalUsd6: bigint
  currentWethBps: bigint
}

async function readPosition(usdPerEth: bigint): Promise<Position> {
  const holder = treasuryAddress()
  const [wethWei, usdc6] = await Promise.all([
    primary.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [holder] }),
    primary.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [holder] }),
  ])

  // Cross-check balances against the second provider. A single lying or lagging
  // RPC could otherwise convince us to make a large wrong-sized trade.
  const [wethWei2, usdc62] = await Promise.all([
    secondary.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [holder] }),
    secondary.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [holder] }),
  ])
  if (wethWei !== wethWei2 || usdc6 !== usdc62) {
    throw new Abort('balance_disagreement_between_rpcs', { wethWei, wethWei2, usdc6, usdc62 })
  }

  // WETH value in USDC units (6dp): wei * price(8dp) / 1e20
  const wethValueUsd6 = (wethWei * usdPerEth) / 10n ** 20n
  const totalUsd6 = wethValueUsd6 + usdc6
  if (totalUsd6 === 0n) throw new Abort('empty_treasury', { holder })

  return {
    wethWei, usdc6, usdPerEth, wethValueUsd6, totalUsd6,
    currentWethBps: (wethValueUsd6 * BPS) / totalUsd6,
  }
}

interface TradeIntent {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  /** Notional in USD 6dp, for caps and reporting. */
  notionalUsd6: bigint
}

function decide(pos: Position, signal: Signal, journal: JournalEntry[]): TradeIntent | null {
  const target = BigInt(Math.max(0, Math.min(10_000, Math.round(signal.targetWethBps))))
  const driftBps = pos.currentWethBps > target
    ? pos.currentWethBps - target
    : target - pos.currentWethBps

  log('info', 'position', {
    wethEth: formatUnits(pos.wethWei, 18),
    usdc: formatUnits(pos.usdc6, 6),
    totalUsd: formatUnits(pos.totalUsd6, 6),
    currentWethBps: pos.currentWethBps,
    targetWethBps: target,
    driftBps,
  })

  if (driftBps < BigInt(CONFIG.rebalanceBandBps)) {
    log('info', 'no_trade', { reason: 'within_band', driftBps, band: CONFIG.rebalanceBandBps })
    return null
  }

  const sinceLast = (Date.now() - lastTradeAt(journal)) / 1000
  if (sinceLast < CONFIG.minSecondsBetweenTrades) {
    log('info', 'no_trade', { reason: 'cooldown', sinceLast, required: CONFIG.minSecondsBetweenTrades })
    return null
  }

  const dailySoFar = rollingDailyNotionalUsd(journal)
  const dailyRemaining = CONFIG.maxDailyNotionalUsd - dailySoFar
  if (dailyRemaining < CONFIG.minTradeUsd) {
    log('warn', 'no_trade', {
      reason: 'daily_notional_cap_reached',
      dailySoFar, cap: CONFIG.maxDailyNotionalUsd,
    })
    return null
  }

  const targetWethUsd6 = (pos.totalUsd6 * target) / BPS
  const deltaUsd6 = targetWethUsd6 - pos.wethValueUsd6 // >0 => buy WETH
  const buyWeth = deltaUsd6 > 0n
  let notional = deltaUsd6 > 0n ? deltaUsd6 : -deltaUsd6

  // Apply every ceiling, then check the floor last.
  if (notional > CONFIG.maxTradeUsd) notional = CONFIG.maxTradeUsd
  if (notional > dailyRemaining) notional = dailyRemaining
  if (notional < CONFIG.minTradeUsd) {
    log('info', 'no_trade', { reason: 'below_min_size', notional, min: CONFIG.minTradeUsd })
    return null
  }

  let tokenIn: Address, tokenOut: Address, amountIn: bigint
  if (buyWeth) {
    tokenIn = USDC; tokenOut = WETH
    amountIn = notional
    if (amountIn > pos.usdc6) amountIn = pos.usdc6
  } else {
    tokenIn = WETH; tokenOut = USDC
    // USD(6dp) -> wei: usd * 1e20 / price(8dp)
    amountIn = (notional * 10n ** 20n) / pos.usdPerEth
    if (amountIn > pos.wethWei) amountIn = pos.wethWei
  }

  if (amountIn === 0n) {
    log('warn', 'no_trade', { reason: 'insufficient_balance_for_side', buyWeth })
    return null
  }

  return { tokenIn, tokenOut, amountIn, notionalUsd6: notional }
}

// ---------------------------------------------------------------------------
// 10. EXECUTION BACKENDS
//
// Both produce (to, data) for the agent EOA to sign. The Uniswap calldata is
// byte-identical; only the wrapper differs.
// ---------------------------------------------------------------------------

interface OuterCall {
  to: Address
  data: Hex
  description: string
}

function wrap(innerTo: Address, innerData: Hex, description: string): OuterCall {
  if (CONFIG.executionMode === 'eoa') {
    return { to: innerTo, data: innerData, description }
  }
  return {
    to: CONFIG.rolesModifier!,
    data: encodeFunctionData({
      abi: rolesV2Abi,
      functionName: 'execTransactionWithRole',
      args: [
        innerTo,
        0n,
        innerData,
        0, // Operation.Call — never DelegateCall. DelegateCall from a Safe is
           // arbitrary code execution against the treasury.
        CONFIG.roleKey,
        true, // shouldRevert: surface permission failures instead of silently
              // burning gas on a no-op.
      ],
    }),
    description: `${description} (via Roles)`,
  }
}

function buildApprove(token: Address, amount: bigint): OuterCall {
  // WETH and USDC both permit a direct re-approve from a non-zero allowance,
  // so no approve-to-zero dance is needed. That is NOT true of every ERC20.
  return wrap(
    token,
    encodeFunctionData({
      abi: erc20Abi, functionName: 'approve', args: [SWAP_ROUTER_02, amount],
    }),
    `approve ${token} -> SwapRouter02 ${amount}`,
  )
}

function buildSwap(intent: TradeIntent, fee: FeeTier, amountOutMinimum: bigint): OuterCall {
  return wrap(
    SWAP_ROUTER_02,
    encodeFunctionData({
      abi: swapRouter02Abi,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        fee,
        // Output goes straight to the treasury, never to the hot signer.
        // In roles mode this field is also pinned by the on-chain permission,
        // so a compromised agent cannot redirect the proceeds.
        recipient: treasuryAddress(),
        amountIn: intent.amountIn,
        amountOutMinimum,
        // 0 = no price limit. amountOutMinimum is the real protection; a
        // sqrtPriceLimit here would only cause confusing partial fills.
        sqrtPriceLimitX96: 0n,
      }],
    }),
    `exactInputSingle ${intent.amountIn} ${intent.tokenIn} -> ${intent.tokenOut} @ ${fee}`,
  )
}

/**
 * NOTE ON DEADLINES. SwapRouter02's exactInputSingle has no deadline field
 * (unlike the original SwapRouter); the deadline lives on its multicall
 * wrapper. We deliberately do not use multicall, because wrapping the call
 * makes the Zodiac Roles permission far harder to scope tightly, and a loosely
 * scoped permission is a bigger risk than a late fill.
 *
 * Staleness is instead handled by (a) amountOutMinimum, which is an economic
 * deadline — if price moves against us past the bound, the tx reverts rather
 * than filling badly — and (b) cancelStuckTransaction() below, which replaces
 * the nonce if we are not included within INCLUSION_DEADLINE_BLOCKS.
 */

// ---------------------------------------------------------------------------
// 11. FEES, SIGNING, SUBMISSION
// ---------------------------------------------------------------------------

interface Fees { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }

async function currentFees(): Promise<Fees> {
  const block = await primary.getBlock({ blockTag: 'latest' })
  const baseFee = block.baseFeePerGas ?? 0n
  const maxPriorityFeePerGas = BigInt(Math.floor(CONFIG.maxPriorityFeeGwei * 1e9))
  // 2x base gives headroom for a few blocks of base fee growth.
  return { maxFeePerGas: baseFee * 2n + maxPriorityFeePerGas, maxPriorityFeePerGas }
}

/**
 * Fees for a *trade*, subject to the gas cap policy.
 *
 * Deliberately separate from currentFees(): the cap says "routine rebalancing
 * is not worth a gas spike", which is a statement about trading, not about
 * housekeeping. Clearing a stuck nonce must stay possible during exactly the
 * congestion that caused the stall, so cancels use currentFees() directly.
 */
async function feeParams(): Promise<Fees> {
  const block = await primary.getBlock({ blockTag: 'latest' })
  const baseFee = block.baseFeePerGas ?? 0n
  const capWei = BigInt(CONFIG.maxBaseFeeGwei) * 10n ** 9n
  if (baseFee > capWei) {
    throw new Abort('base_fee_too_high', {
      baseFeeGwei: formatUnits(baseFee, 9), capGwei: CONFIG.maxBaseFeeGwei,
      hint: 'Routine rebalancing is not worth a gas spike. Will retry next run.',
    })
  }
  return currentFees()
}

/**
 * Simulate against pending state as the actual sender. If this reverts we do
 * not spend gas finding out on-chain, and — more importantly — we do not
 * discover a misconfigured Roles permission by burning a real transaction.
 */
async function simulateOrThrow(call: OuterCall): Promise<bigint> {
  try {
    await primary.call({
      account: getAccount().address, to: call.to, data: call.data, value: 0n, blockTag: 'pending',
    })
  } catch (e) {
    throw new Abort('simulation_reverted', { call: call.description, error: shortError(e) })
  }
  const gas = await primary.estimateGas({
    account: getAccount().address, to: call.to, data: call.data, value: 0n,
  })
  return (gas * 125n) / 100n // headroom for state drift between now and inclusion
}

async function signAndSubmit(args: {
  call: OuterCall
  gas: bigint
  nonce: number
}): Promise<Hex> {
  const { maxFeePerGas, maxPriorityFeePerGas } = await feeParams()
  const serialized = await getAccount().signTransaction({
    to: args.call.to,
    data: args.call.data,
    value: 0n,
    gas: args.gas,
    nonce: args.nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chainId: mainnet.id,
    type: 'eip1559',
  })
  // Private relay only. This transaction is never seen by the public mempool.
  const hash = await submit.request({
    method: 'eth_sendRawTransaction',
    params: [serialized],
  }) as Hex
  log('info', 'submitted', {
    hash, nonce: args.nonce, gas: args.gas,
    maxFeeGwei: formatUnits(maxFeePerGas, 9), via: CONFIG.rpcSubmit, call: args.call.description,
  })
  return hash
}

/**
 * Replace a stuck nonce with a 0-value self-send at a higher fee, and wait for
 * it to land.
 *
 * Two deliberate differences from the trade path:
 *   - Submitted via the PUBLIC RPC, not the private relay. A 0-value self-send
 *     leaks nothing worth protecting, and a cancel needs to be seen by as many
 *     builders as possible to land quickly. Privacy is for the swap; the cancel
 *     just needs to win.
 *   - Fees bypass the gas cap (see feeParams) so a congestion event cannot
 *     leave us permanently unable to clear the nonce.
 *
 * We block until it confirms. Returning early would leave a pending cancel on
 * a nonce the next run would then try to reuse, turning one stuck transaction
 * into a nonce-collision loop.
 */
async function cancelStuckTransaction(nonce: number): Promise<Hex> {
  const { maxFeePerGas, maxPriorityFeePerGas } = await currentFees()
  // Replacement requires >=12.5% bump on both fields; 30% to be sure.
  const bump = (v: bigint) => (v * 130n) / 100n
  const serialized = await getAccount().signTransaction({
    to: getAccount().address,
    value: 0n,
    data: '0x',
    gas: 21_000n,
    nonce,
    maxFeePerGas: bump(maxFeePerGas),
    maxPriorityFeePerGas: bump(maxPriorityFeePerGas),
    chainId: mainnet.id,
    type: 'eip1559',
  })
  const hash = await primary.request({
    method: 'eth_sendRawTransaction', params: [serialized],
  }) as Hex
  log('warn', 'cancel_submitted', { nonce, hash })

  const start = await primary.getBlockNumber()
  for (;;) {
    const r = await primary.getTransactionReceipt({ hash }).catch(() => null)
    if (r) {
      log('warn', 'cancel_confirmed', { nonce, hash, block: r.blockNumber })
      return hash
    }
    if ((await primary.getBlockNumber()) > start + BigInt(CONFIG.inclusionDeadlineBlocks)) {
      // Both the trade and its cancel are stuck. Do not guess which will land;
      // stop and let the next run's reconcile resolve the nonce.
      throw new Abort('cancel_did_not_confirm', {
        nonce, cancelHash: hash,
        hint: 'Nonce is contested. Check the signer on Etherscan before restarting.',
      })
    }
    await sleep(4_000)
  }
}

interface Outcome {
  status: 'confirmed' | 'failed' | 'cancelled'
  txHash: Hex
  blockNumber?: bigint
  gasUsed?: bigint
}

async function awaitInclusion(txHash: Hex, nonce: number): Promise<Outcome> {
  const start = await primary.getBlockNumber()
  const deadline = start + BigInt(CONFIG.inclusionDeadlineBlocks)

  for (;;) {
    const receipt = await primary.getTransactionReceipt({ hash: txHash }).catch(() => null)
    if (receipt) {
      return {
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
        txHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      }
    }

    const now = await primary.getBlockNumber()
    if (now > deadline) {
      // Not included in time. Reclaim the nonce so the next run starts clean;
      // leaving a stuck tx around risks it landing later at a stale price.
      log('warn', 'inclusion_deadline_exceeded', { txHash, nonce, waitedBlocks: now - start })
      const cancelHash = await cancelStuckTransaction(nonce)
      return { status: 'cancelled', txHash: cancelHash }
    }
    await sleep(4_000)
  }
}

// ---------------------------------------------------------------------------
// 12. THE REBALANCE
// ---------------------------------------------------------------------------

export async function rebalance(signal: Signal): Promise<void> {
  assertConfigComplete()
  assertNotHalted()
  acquireLock()
  await assertOnchainReality()

  let journal = await reconcile(loadJournal())

  const oracle = await readOracleChecked()
  const pos = await readPosition(oracle.usdPerEth)
  const intent = decide(pos, signal, journal)
  if (!intent) return

  // Fresh quote, then the oracle sanity check, then amountOutMinimum.
  const quote = await bestQuote(intent.tokenIn, intent.tokenOut, intent.amountIn)
  assertQuoteWithinOracleBand({
    tokenIn: intent.tokenIn,
    amountIn: intent.amountIn,
    quoteOut: quote.amountOut,
    usdPerEth: oracle.usdPerEth,
  })
  const amountOutMinimum =
    (quote.amountOut * (BPS - BigInt(CONFIG.slippageBps))) / BPS

  log('info', 'trade_planned', {
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn,
    notionalUsd: formatUnits(intent.notionalUsd6, 6),
    feeTier: quote.fee,
    quotedOut: quote.amountOut,
    amountOutMinimum,
    slippageBps: CONFIG.slippageBps,
  })

  if (CONFIG.dryRun) {
    log('warn', 'dry_run_stop', { hint: 'Set DRY_RUN=false to submit for real.' })
    return
  }

  // --- Allowance -----------------------------------------------------------
  // We keep a bounded standing allowance rather than approving max. A
  // compromised router (or a compromised agent, in roles mode) can only ever
  // pull up to this. Topped up to exactly the cap when it runs short.
  const allowanceCap = CONFIG.maxTradeUsd * 4n // headroom for a few trades
  const currentAllowance = await primary.readContract({
    address: intent.tokenIn, abi: erc20Abi, functionName: 'allowance',
    args: [treasuryAddress(), SWAP_ROUTER_02],
  })

  let nonce = await primary.getTransactionCount({ address: getAccount().address, blockTag: 'latest' })

  if (currentAllowance < intent.amountIn) {
    const approveAmount = intent.tokenIn === USDC
      ? allowanceCap
      : (allowanceCap * 10n ** 20n) / oracle.usdPerEth
    const approveCall = buildApprove(intent.tokenIn, approveAmount)
    const gas = await simulateOrThrow(approveCall)
    const hash = await signAndSubmit({ call: approveCall, gas, nonce })
    const res = await awaitInclusion(hash, nonce)
    if (res.status !== 'confirmed') {
      throw new Abort('approve_did_not_confirm', { status: res.status, txHash: res.txHash })
    }
    nonce += 1
    log('info', 'approve_confirmed', { token: intent.tokenIn, amount: approveAmount })
  }

  // --- Swap ----------------------------------------------------------------
  const swapCall = buildSwap(intent, quote.fee, amountOutMinimum)
  const gas = await simulateOrThrow(swapCall)

  const entry: JournalEntry = {
    id: `${Date.now()}-${nonce}`,
    createdAt: Date.now(),
    status: 'intent',
    nonce,
    notionalUsd: intent.notionalUsd6.toString(),
    tokenIn: intent.tokenIn,
    tokenOut: intent.tokenOut,
    amountIn: intent.amountIn.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    note: signal.source,
  }
  // Journalled BEFORE broadcast. If we die on the next line, the next run
  // knows a trade may be in flight at this nonce and reconciles it.
  journal = upsert(journal, entry)

  const txHash = await signAndSubmit({ call: swapCall, gas, nonce })
  journal = upsert(journal, { ...entry, status: 'broadcast', txHash })

  const outcome = await awaitInclusion(txHash, nonce)
  journal = upsert(journal, {
    ...entry,
    status: outcome.status === 'confirmed' ? 'confirmed'
      : outcome.status === 'failed' ? 'failed' : 'abandoned',
    txHash: outcome.txHash,
    blockNumber: outcome.blockNumber?.toString(),
    gasUsed: outcome.gasUsed?.toString(),
    note: `${signal.source}|${outcome.status}`,
  })

  if (outcome.status === 'confirmed') {
    const after = await readPosition(oracle.usdPerEth)
    log('info', 'rebalance_complete', {
      txHash: outcome.txHash,
      block: outcome.blockNumber,
      gasUsed: outcome.gasUsed,
      wethBpsBefore: pos.currentWethBps,
      wethBpsAfter: after.currentWethBps,
      targetWethBps: signal.targetWethBps,
    })
  } else {
    // A revert here is not routine. Something in the guard set is wrong, or
    // the market moved through amountOutMinimum. Escalate.
    log('error', 'rebalance_did_not_confirm', { status: outcome.status, txHash: outcome.txHash })
    throw new Abort('swap_not_confirmed', { status: outcome.status, txHash: outcome.txHash })
  }
}

// ---------------------------------------------------------------------------
// 13. UTIL / ENTRYPOINT
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function shortError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      return `revert: ${revert.data?.errorName ?? revert.reason ?? 'unknown'}`
    }
    return e.shortMessage
  }
  return String(e)
}

/**
 * Replace this with a call into your strategy. It is intentionally the only
 * thing in this file that is a stub: this module owns execution, not alpha.
 */
async function getSignal(): Promise<Signal> {
  const raw = process.env.TARGET_WETH_BPS
  if (!raw) throw new Abort('no_signal', { hint: 'Wire getSignal() to your strategy.' })
  return { targetWethBps: Number(raw), source: envOpt('SIGNAL_SOURCE', 'manual') }
}

async function main() {
  try {
    // Config before anything else, so a fresh deploy reports every missing
    // variable in one go rather than failing on whichever check runs first.
    assertConfigComplete()
    await rebalance(await getSignal())
    process.exit(0)
  } catch (e) {
    if (e instanceof Abort) {
      // Expected refusals. Not every one is an emergency, but every one means
      // no trade happened — your alerting decides which reasons page you.
      // detail is spread FIRST so a detail key can never shadow `reason` —
      // alerting keys off `reason` and must not be maskable by payload.
      log('error', 'aborted', { ...e.detail, reason: e.reason })
      process.exit(2)
    }
    log('error', 'unhandled', { error: shortError(e), stack: (e as Error)?.stack })
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  void main()
}
