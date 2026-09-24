/**
 * rebalance.ts: turns one rebalance decision (sell X of WETH or USDC) into a
 * signed, submitted Ethereum mainnet transaction.
 *
 * WHO HOLDS WHAT (read DEPLOY.md before running this against real funds)
 *
 *   Treasury Safe (SAFE_ADDRESS)        Holds the ~$400k in WETH + USDC. Owned by YOUR
 *                                       hardware wallets (2-of-3). The agent is NOT an owner.
 *   Roles Modifier (ROLES_MODIFIER)     Zodiac Roles v2 module enabled on the Safe. Lets
 *                                       members of ROLE_KEY make the Safe execute exactly
 *                                       one thing: SwapRouter.exactInputSingle WETH<->USDC,
 *                                       fee 500, recipient == the Safe, amountIn within a
 *                                       daily on-chain allowance, amountOutMinimum above a
 *                                       Chainlink price floor (PriceFloorCondition).
 *   Agent EOA (key in AWS KMS)          The only key this process uses. Holds gas ETH only.
 *                                       It never holds the treasury funds, and it cannot move them
 *                                       anywhere except through the scoped swap.
 *
 * Transaction path:
 *   agent EOA --tx--> RolesModifier.execTransactionWithRole(SwapRouter, 0, exactInputSingle(..), Call, ROLE_KEY, true)
 *             --> Safe.execTransactionFromModule(...) --> SwapRouter.exactInputSingle
 *             --> pool WETH/USDC 0.05% pulls tokenIn from the Safe, sends tokenOut to the Safe.
 *
 * Usage:
 *   tsx rebalance.ts --sell WETH --amount 12.5 --reason "signal: momentum-down" [--id <decisionId>] [--dry-run]
 *   tsx rebalance.ts --sell USDC --amount 30000 --reason "..." [--dry-run]
 * or import { executeRebalance } from your signal loop.
 */
import { KMSClient, GetPublicKeyCommand, SignCommand } from '@aws-sdk/client-kms'
import { appendFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  type Address,
  type Hex,
  type LocalAccount,
  type TransactionSerializable,
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  encodeFunctionData,
  formatUnits,
  getAddress,
  hexToBytes,
  http,
  keccak256,
  parseAbi,
  parseGwei,
  parseUnits,
  recoverAddress,
  serializeTransaction,
  stringToHex,
  toHex,
} from 'viem'
import { toAccount, publicKeyToAddress } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ─────────────────────────────────────────────────────────────────────────────
// Mainnet contracts touched (all verified to have code on chainId 1).
// ─────────────────────────────────────────────────────────────────────────────
export const MAINNET = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  /** Uniswap V3 SwapRouter (v1). Chosen over SwapRouter02 because its params struct carries `deadline`. */
  SWAP_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  /** Uniswap V3 QuoterV2 (used via eth_call only). */
  QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  /** Uniswap V3 USDC/WETH 0.05% pool (token0 = USDC). Only read, for sanity checks. */
  POOL_USDC_WETH_500: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
  /** Chainlink ETH/USD, 8 decimals, heartbeat 3600s, deviation 0.5%. */
  CHAINLINK_ETH_USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
} as const satisfies Record<string, Address>

export const POOL_FEE = 500
export const ROLE_KEY = stringToHex('treasury-rebalancer', { size: 32 })
const OPERATION_CALL = 0

export const TOKENS = {
  WETH: { address: MAINNET.WETH, decimals: 18 },
  USDC: { address: MAINNET.USDC, decimals: 6 },
} as const
export type Side = keyof typeof TOKENS

// ─────────────────────────────────────────────────────────────────────────────
// ABIs (minimal)
// ─────────────────────────────────────────────────────────────────────────────
export const swapRouterAbi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
])
const quoterAbi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
export const rolesAbi = parseAbi([
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)',
  'function avatar() view returns (address)',
  'function target() view returns (address)',
  'function owner() view returns (address)',
  'function isModuleEnabled(address module) view returns (bool)',
  'function allowances(bytes32 key) view returns (uint128 refill, uint128 maxRefill, uint64 period, uint128 balance, uint64 timestamp)',
  // Errors, so reverts are readable in logs/alerts.
  'error NotAuthorized(address module)',
  'error ModuleTransactionFailed()',
  'error ConditionViolation(uint8 status, bytes32 info)',
  'error NoMembership()',
  'error FunctionSignatureTooShort()',
  'error DelegateCallNotAllowed()',
  'error TargetAddressNotAllowed()',
  'error FunctionNotAllowed()',
  'error SendNotAllowed()',
])
const safeAbi = parseAbi([
  'function isModuleEnabled(address module) view returns (bool)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
])
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])
const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

// ─────────────────────────────────────────────────────────────────────────────
// Config. All from env / secret manager. No secrets in this file, ever.
// ─────────────────────────────────────────────────────────────────────────────
function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`missing env ${name}`)
  return v
}

export function loadConfig() {
  return {
    safe: getAddress(env('SAFE_ADDRESS')),
    rolesModifier: getAddress(env('ROLES_MODIFIER')),
    /** The agent address you registered as a role member. Cross-checked against the signer. */
    agentAddress: getAddress(env('AGENT_ADDRESS')),
    /** Reads: your own node or a paid provider. Use an RPC key that is IP-allowlisted to the VM. */
    readRpcUrl: env('READ_RPC_URL'),
    /** Writes: private orderflow, so the swap never sits in the public mempool (sandwich protection). */
    submitRpcUrl: env('SUBMIT_RPC_URL', 'https://rpc.flashbots.net/fast'),
    signer: env('SIGNER', 'kms') as 'kms' | 'fork-impersonate',
    kmsKeyId: process.env.KMS_KEY_ID,
    awsRegion: process.env.AWS_REGION,

    // Off-chain limits. Keep these TIGHTER than the on-chain Roles allowances;
    // the on-chain ones are the backstop if this process or VM is compromised.
    maxTradeUsd: Number(env('MAX_TRADE_USD', '50000')),
    maxDailyUsd: Number(env('MAX_DAILY_USD', '150000')),
    minTradeUsd: Number(env('MIN_TRADE_USD', '1000')),
    /** Slippage vs min(pool quote, oracle fair value). On-chain floor is looser (PriceFloorCondition). */
    /** Invariant: SLIPPAGE_BPS + MAX_POOL_ORACLE_DEVIATION_BPS < on-chain PRICE_FLOOR_BPS (100), or trades revert in simulation. */
    slippageBps: BigInt(env('SLIPPAGE_BPS', '40')),
    /** Refuse to trade if the pool price and Chainlink disagree by more than this. */
    maxPoolOracleDeviationBps: BigInt(env('MAX_POOL_ORACLE_DEVIATION_BPS', '40')),
    maxOracleAgeSec: BigInt(env('MAX_ORACLE_AGE_SEC', '3900')),
    deadlineSec: BigInt(env('DEADLINE_SEC', '180')),
    /** Skip trading (not fail) when base fee is above this. Rebalancing can wait. */
    maxBaseFeeGwei: env('MAX_BASE_FEE_GWEI', '40'),
    priorityFeeGwei: env('PRIORITY_FEE_GWEI', '1'),
    minAgentEthBalance: env('MIN_AGENT_ETH', '0.05'),
    receiptTimeoutMs: Number(env('RECEIPT_TIMEOUT_MS', '300000')),

    stateDir: env('STATE_DIR', './state'),
    /** If this file exists, nothing trades. `touch` it to pause the bot without SSH-ing into code. */
    killSwitchFile: env('KILL_SWITCH_FILE', './state/PAUSE'),
    /** Pager / Slack / Telegram webhook. Fired on anything that is not a routine success. */
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  }
}
export type Config = ReturnType<typeof loadConfig>

// ─────────────────────────────────────────────────────────────────────────────
// Signer: AWS KMS secp256k1 key (ECC_SECG_P256K1, SIGN_VERIFY). The private key
// never exists on the VM; the VM's IAM role may call kms:Sign on this one key.
// ─────────────────────────────────────────────────────────────────────────────
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n

function parseDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  // SEQUENCE { INTEGER r, INTEGER s }
  let i = 0
  if (der[i++] !== 0x30) throw new Error('KMS sig: not a DER sequence')
  if (der[i] & 0x80) i += 1 + (der[i] & 0x7f)
  else i += 1
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error('KMS sig: expected INTEGER')
    const len = der[i++]
    const v = BigInt(toHex(der.slice(i, i + len)))
    i += len
    return v
  }
  const r = readInt()
  let s = readInt()
  if (s > SECP256K1_N / 2n) s = SECP256K1_N - s // EIP-2: low-s only
  return { r, s }
}

export async function kmsAccount(keyId: string, region: string | undefined): Promise<LocalAccount> {
  const kms = new KMSClient({ region })
  const pub = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }))
  if (pub.KeySpec !== 'ECC_SECG_P256K1' || !pub.PublicKey) throw new Error('KMS key must be ECC_SECG_P256K1')
  // SubjectPublicKeyInfo DER: the uncompressed point (0x04 || X || Y) is the last 65 bytes.
  const point = toHex(pub.PublicKey.slice(-65))
  const address = publicKeyToAddress(point)

  const signHash = async (hash: Hex) => {
    const out = await kms.send(
      new SignCommand({ KeyId: keyId, Message: hexToBytes(hash), MessageType: 'DIGEST', SigningAlgorithm: 'ECDSA_SHA_256' }),
    )
    if (!out.Signature) throw new Error('KMS returned no signature')
    const { r, s } = parseDerSignature(out.Signature)
    for (const yParity of [0, 1] as const) {
      const sig = { r: toHex(r, { size: 32 }), s: toHex(s, { size: 32 }), yParity }
      if ((await recoverAddress({ hash, signature: sig })) === address) return sig
    }
    throw new Error('KMS signature does not recover to the key address')
  }

  return toAccount({
    address,
    async signTransaction(tx, opts) {
      const serializer = opts?.serializer ?? serializeTransaction
      const sig = await signHash(keccak256(await serializer(tx)))
      return serializer(tx, sig)
    },
    // This bot only sends transactions. Refuse everything else so a bug can't sign a Permit.
    async signMessage() {
      throw new Error('signMessage disabled for the rebalancer key')
    },
    async signTypedData() {
      throw new Error('signTypedData disabled for the rebalancer key')
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────
function clients(cfg: Config) {
  const publicClient = createPublicClient({ chain: mainnet, transport: http(cfg.readRpcUrl, { retryCount: 3 }) })
  const submitClient = createWalletClient({ chain: mainnet, transport: http(cfg.submitRpcUrl, { retryCount: 0 }) })
  return { publicClient, submitClient }
}
type PublicClient = ReturnType<typeof clients>['publicClient']

type Signer =
  | { kind: 'kms'; account: LocalAccount }
  | { kind: 'fork-impersonate'; address: Address }

async function loadSigner(cfg: Config, publicClient: PublicClient): Promise<Signer> {
  if (cfg.signer === 'fork-impersonate') {
    // Local anvil fork only: no key at all, anvil signs for the impersonated address.
    const version = await publicClient.request({ method: 'web3_clientVersion' })
    if (!String(version).toLowerCase().includes('anvil')) throw new Error('fork-impersonate refused: RPC is not anvil')
    await publicClient.request({ method: 'anvil_impersonateAccount' as any, params: [cfg.agentAddress] as any })
    return { kind: 'fork-impersonate', address: cfg.agentAddress }
  }
  if (!cfg.kmsKeyId) throw new Error('missing env KMS_KEY_ID')
  const account = await kmsAccount(cfg.kmsKeyId, cfg.awsRegion)
  if (account.address !== cfg.agentAddress) {
    throw new Error(`KMS key address ${account.address} != AGENT_ADDRESS ${cfg.agentAddress}`)
  }
  return { kind: 'kms', account }
}
const signerAddress = (s: Signer) => (s.kind === 'kms' ? s.account.address : s.address)

// ─────────────────────────────────────────────────────────────────────────────
// Journal: append-only JSONL. Idempotency, daily limit, and in-flight tracking.
// Private orderflow means our read RPC can't see our own pending tx, so this
// file is the source of truth for "is something still in flight?".
// ─────────────────────────────────────────────────────────────────────────────
type JournalEntry =
  | { t: 'submitted'; at: number; id: string; hash: Hex; nonce: number; sell: Side; amountIn: string; usd: number }
  | { t: 'confirmed'; at: number; id: string; hash: Hex; block: string; amountOut: string; gasCostWei: string }
  | { t: 'reverted'; at: number; id: string; hash: Hex; block: string }
  | { t: 'dropped'; at: number; id: string; hash: Hex; nonce: number }

class Journal {
  private file: string
  constructor(dir: string) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'journal.jsonl')
  }
  entries(): JournalEntry[] {
    if (!existsSync(this.file)) return []
    return readFileSync(this.file, 'utf8').split('\n').filter(Boolean).map((l: string) => JSON.parse(l) as JournalEntry)
  }
  append(e: JournalEntry) {
    appendFileSync(this.file, JSON.stringify(e) + '\n', { flag: 'a' })
  }
  inFlight() {
    const done = new Set(this.entries().filter((e) => e.t !== 'submitted').map((e) => e.hash))
    return this.entries().filter((e): e is Extract<JournalEntry, { t: 'submitted' }> => e.t === 'submitted' && !done.has(e.hash))
  }
  seen(id: string) {
    return this.entries().some((e) => e.id === id && e.t !== 'dropped' && e.t !== 'reverted')
  }
  usdLast24h(now: number) {
    // Counts submitted trades, including still-pending ones, so a stuck tx can't be double-spent past the cap.
    const failed = new Set(this.entries().filter((e) => e.t === 'reverted' || e.t === 'dropped').map((e) => e.hash))
    return this.entries()
      .filter((e): e is Extract<JournalEntry, { t: 'submitted' }> => e.t === 'submitted' && !failed.has(e.hash) && now - e.at < 86_400_000)
      .reduce((sum, e) => sum + e.usd, 0)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging + alerting. Never log keys; there are none here to log.
// ─────────────────────────────────────────────────────────────────────────────
function log(level: 'info' | 'warn' | 'error', msg: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data }, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  ;(level === 'info' ? console.log : console.error)(line)
}

async function alert(cfg: Config, severity: 'page' | 'notify', msg: string, data: Record<string, unknown> = {}) {
  log(severity === 'page' ? 'error' : 'warn', `ALERT(${severity}): ${msg}`, data)
  if (!cfg.alertWebhookUrl) return
  try {
    await fetch(cfg.alertWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ severity, msg, data }, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    log('error', 'alert webhook failed', { err: String(e) })
  }
}

class Abort extends Error {
  constructor(message: string, readonly severity: 'page' | 'notify' | 'skip', readonly data: Record<string, unknown> = {}) {
    super(message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Preflight: prove the on-chain wiring is what we think before touching funds.
// ─────────────────────────────────────────────────────────────────────────────
async function preflight(cfg: Config, pc: PublicClient, agent: Address) {
  const chainId = await pc.getChainId()
  if (chainId !== 1) throw new Abort(`wrong chain ${chainId}`, 'page')

  const [avatar, target, owner, moduleEnabled] = await Promise.all([
    pc.readContract({ address: cfg.rolesModifier, abi: rolesAbi, functionName: 'avatar' }),
    pc.readContract({ address: cfg.rolesModifier, abi: rolesAbi, functionName: 'target' }),
    pc.readContract({ address: cfg.rolesModifier, abi: rolesAbi, functionName: 'owner' }),
    pc.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'isModuleEnabled', args: [cfg.rolesModifier] }),
  ])
  if (avatar !== cfg.safe || target !== cfg.safe) throw new Abort('Roles avatar/target is not the treasury Safe', 'page', { avatar, target })
  if (owner !== cfg.safe) throw new Abort('Roles owner is not the treasury Safe', 'page', { owner })
  if (!moduleEnabled) throw new Abort('Roles modifier not enabled on Safe (revoked? paused by owners?)', 'page')

  const owners = await pc.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'getOwners' })
  if (owners.map((o) => o.toLowerCase()).includes(agent.toLowerCase())) {
    throw new Abort('agent key is a Safe owner; it must not be', 'page')
  }

  const eth = await pc.getBalance({ address: agent })
  if (eth < parseUnits(cfg.minAgentEthBalance, 18)) {
    await alert(cfg, 'notify', 'agent gas balance low, top it up', { agent, eth: formatUnits(eth, 18) })
  }
}

async function oraclePrice(cfg: Config, pc: PublicClient) {
  const [, answer, , updatedAt] = await pc.readContract({
    address: MAINNET.CHAINLINK_ETH_USD,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
  })
  const block = await pc.getBlock()
  if (answer <= 0n) throw new Abort('oracle answer <= 0', 'page')
  if (block.timestamp - updatedAt > cfg.maxOracleAgeSec) throw new Abort('oracle stale', 'notify', { updatedAt })
  return { price: answer /* USD/ETH, 1e8 */, block }
}

/** Oracle fair output for amountIn, in tokenOut base units. Assumes USDC == $1. */
function fairOut(sell: Side, amountIn: bigint, price: bigint) {
  return sell === 'WETH' ? (amountIn * price) / 10n ** 20n : (amountIn * 10n ** 20n) / price
}
function usdValue(sell: Side, amountIn: bigint, price: bigint) {
  return sell === 'WETH' ? Number(formatUnits((amountIn * price) / 10n ** 8n, 18)) : Number(formatUnits(amountIn, 6))
}

function explainRevert(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null
    if (revert?.data) return `${revert.data.errorName}(${(revert.data.args ?? []).join(', ')})`
    const raw = (err.walk() as any)?.data as Hex | undefined
    if (raw && raw.length >= 10) {
      try {
        const d = decodeErrorResult({ abi: rolesAbi, data: raw })
        return `${d.errorName}(${(d.args ?? []).join(', ')})`
      } catch {}
    }
    return err.shortMessage
  }
  return String(err)
}

// ─────────────────────────────────────────────────────────────────────────────
// The execution path
// ─────────────────────────────────────────────────────────────────────────────
export type RebalanceDecision = {
  /** Unique per decision. Re-running the same id is a no-op (safe to retry the process). */
  id: string
  sell: Side
  /** In tokenIn base units (wei for WETH, 1e-6 for USDC). */
  amountIn: bigint
  reason: string
}

export type RebalanceResult =
  | { status: 'confirmed'; hash: Hex; amountOut: bigint }
  | { status: 'skipped' | 'aborted' | 'pending' | 'reverted' | 'dry-run'; reason: string; hash?: Hex }

export async function executeRebalance(decision: RebalanceDecision, opts: { dryRun?: boolean; cfg?: Config } = {}): Promise<RebalanceResult> {
  const cfg = opts.cfg ?? loadConfig()
  const { publicClient: pc, submitClient } = clients(cfg)
  const journal = new Journal(cfg.stateDir)

  // One execution at a time on this VM.
  const lockFile = join(cfg.stateDir, 'lock')
  const lock = acquireLock(lockFile)
  if (lock === null) {
    await alert(cfg, 'notify', `another rebalance run holds ${lockFile}; skipping`)
    return { status: 'skipped', reason: 'locked' }
  }

  try {
    if (existsSync(cfg.killSwitchFile)) throw new Abort('kill switch present', 'skip')
    if (journal.seen(decision.id)) throw new Abort(`decision ${decision.id} already submitted`, 'skip')
    if (decision.amountIn <= 0n) throw new Abort('amountIn must be > 0', 'notify')

    const signer = await loadSigner(cfg, pc)
    const agent = signerAddress(signer)
    await preflight(cfg, pc, agent)

    // Resolve anything we previously sent before sending more.
    await reconcileInFlight(cfg, pc, journal)
    if (journal.inFlight().length > 0) throw new Abort('previous tx still in flight', 'notify', { inFlight: journal.inFlight() })

    const tokenIn = TOKENS[decision.sell]
    const tokenOut = TOKENS[decision.sell === 'WETH' ? 'USDC' : 'WETH']

    // Balance
    const bal = await pc.readContract({ address: tokenIn.address, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] })
    if (bal < decision.amountIn) throw new Abort('Safe balance < amountIn', 'notify', { bal, amountIn: decision.amountIn })
    const approved = await pc.readContract({ address: tokenIn.address, abi: erc20Abi, functionName: 'allowance', args: [cfg.safe, MAINNET.SWAP_ROUTER] })
    if (approved < decision.amountIn) throw new Abort('Safe -> SwapRouter approval too low (owners must re-approve)', 'page', { approved })

    // Price + limits
    const { price, block } = await oraclePrice(cfg, pc)
    const usd = usdValue(decision.sell, decision.amountIn, price)
    if (usd < cfg.minTradeUsd) throw new Abort(`trade $${usd.toFixed(0)} below MIN_TRADE_USD`, 'skip')
    if (usd > cfg.maxTradeUsd) throw new Abort(`trade $${usd.toFixed(0)} above MAX_TRADE_USD`, 'notify')
    const used = journal.usdLast24h(Date.now())
    if (used + usd > cfg.maxDailyUsd) throw new Abort(`daily cap: $${used.toFixed(0)} used + $${usd.toFixed(0)} > MAX_DAILY_USD`, 'notify')

    if (block.baseFeePerGas! > parseGwei(cfg.maxBaseFeeGwei)) {
      throw new Abort(`base fee ${formatUnits(block.baseFeePerGas!, 9)} gwei above cap`, 'skip')
    }

    // Quote vs oracle
    const { result: [quoted] } = await pc.simulateContract({
      address: MAINNET.QUOTER_V2,
      abi: quoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: tokenIn.address, tokenOut: tokenOut.address, amountIn: decision.amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
    })
    const fair = fairOut(decision.sell, decision.amountIn, price)
    const deviationBps = ((fair > quoted ? fair - quoted : quoted - fair) * 10_000n) / fair
    if (deviationBps > cfg.maxPoolOracleDeviationBps) {
      throw new Abort(`pool quote deviates ${deviationBps}bps from Chainlink`, 'notify', { quoted, fair })
    }
    const reference = quoted < fair ? quoted : fair
    const amountOutMinimum = (reference * (10_000n - cfg.slippageBps)) / 10_000n

    // Build: inner swap (executed BY the Safe) wrapped in the Roles call (sent by the agent).
    const swapData = encodeFunctionData({
      abi: swapRouterAbi,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: POOL_FEE,
        recipient: cfg.safe,
        deadline: block.timestamp + cfg.deadlineSec,
        amountIn: decision.amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      }],
    })
    const data = encodeFunctionData({
      abi: rolesAbi,
      functionName: 'execTransactionWithRole',
      args: [MAINNET.SWAP_ROUTER, 0n, swapData, OPERATION_CALL, ROLE_KEY, true],
    })

    // Simulate the exact call from the agent: catches Roles permission / allowance / price-floor rejections.
    let gas: bigint
    try {
      await pc.call({ account: agent, to: cfg.rolesModifier, data, blockTag: 'latest' })
      gas = await pc.estimateGas({ account: agent, to: cfg.rolesModifier, data })
    } catch (e) {
      throw new Abort(`simulation reverted: ${explainRevert(e)}`, 'page', { decision })
    }
    gas = (gas * 130n) / 100n

    const priority = parseGwei(cfg.priorityFeeGwei)
    const maxFeePerGas = block.baseFeePerGas! * 2n + priority
    const nonce = await pc.getTransactionCount({ address: agent, blockTag: 'latest' })

    const plan = {
      id: decision.id, reason: decision.reason, agent, safe: cfg.safe, via: cfg.rolesModifier, router: MAINNET.SWAP_ROUTER,
      sell: `${formatUnits(decision.amountIn, tokenIn.decimals)} ${decision.sell}`,
      minOut: `${formatUnits(amountOutMinimum, tokenOut.decimals)} ${decision.sell === 'WETH' ? 'USDC' : 'WETH'}`,
      quoted: formatUnits(quoted, tokenOut.decimals), oracleUsdPerEth: formatUnits(price, 8), usd: Math.round(usd),
      deviationBps, gas, maxFeeGwei: formatUnits(maxFeePerGas, 9), nonce,
    }
    if (opts.dryRun) {
      log('info', 'dry-run: would submit', plan)
      return { status: 'dry-run', reason: 'simulation passed' }
    }
    log('info', 'submitting', plan)

    const tx: TransactionSerializable = {
      type: 'eip1559', chainId: 1, to: cfg.rolesModifier, data, value: 0n, gas, nonce, maxFeePerGas, maxPriorityFeePerGas: priority,
    }

    let hash: Hex
    if (signer.kind === 'kms') {
      const raw = await signer.account.signTransaction(tx)
      hash = keccak256(raw)
      // Journal BEFORE broadcast: a crash after send must never lead to a blind resend.
      journal.append({ t: 'submitted', at: Date.now(), id: decision.id, hash, nonce, sell: decision.sell, amountIn: decision.amountIn.toString(), usd })
      const returned = await submitClient.sendRawTransaction({ serializedTransaction: raw })
      if (returned !== hash) log('warn', 'submit RPC returned different hash', { hash, returned })
    } else {
      // Fork only: anvil signs for the impersonated agent.
      const forkWallet = createWalletClient({ account: agent, chain: mainnet, transport: http(cfg.readRpcUrl) })
      hash = await forkWallet.sendTransaction({ to: cfg.rolesModifier, data, gas, nonce, maxFeePerGas, maxPriorityFeePerGas: priority })
      journal.append({ t: 'submitted', at: Date.now(), id: decision.id, hash, nonce, sell: decision.sell, amountIn: decision.amountIn.toString(), usd })
    }

    return await awaitAndVerify(cfg, pc, journal, { id: decision.id, hash, nonce, tokenOut: tokenOut.address, amountOutMinimum })
  } catch (e) {
    if (e instanceof Abort) {
      if (e.severity !== 'skip') await alert(cfg, e.severity, e.message, e.data)
      else log('info', `skip: ${e.message}`)
      return { status: e.severity === 'skip' ? 'skipped' : 'aborted', reason: e.message }
    }
    await alert(cfg, 'page', `unexpected error: ${String(e)}`, { decision: { ...decision, amountIn: decision.amountIn.toString() } })
    return { status: 'aborted', reason: String(e) }
  } finally {
    closeSync(lock)
    unlinkSync(lockFile)
  }
}

/** Exclusive lock with PID; a lock left by a crashed (dead) process is reclaimed. */
function acquireLock(file: string): number | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx')
      writeSync(fd, String(process.pid))
      return fd
    } catch {
      const pid = Number(readFileSync(file, 'utf8'))
      try {
        if (pid) process.kill(pid, 0)
        return null // holder is alive
      } catch {
        log('warn', 'reclaiming stale lock', { file, pid })
        unlinkSync(file)
      }
    }
  }
  return null
}

async function awaitAndVerify(
  cfg: Config,
  pc: PublicClient,
  journal: Journal,
  s: { id: string; hash: Hex; nonce: number; tokenOut: Address; amountOutMinimum: bigint },
): Promise<RebalanceResult> {
  let receipt
  try {
    receipt = await pc.waitForTransactionReceipt({ hash: s.hash, timeout: cfg.receiptTimeoutMs, pollingInterval: 4_000 })
  } catch {
    // Not mined yet. Leave it journaled as in flight; the next run reconciles it.
    // The router deadline (DEADLINE_SEC) means a late inclusion reverts instead of trading at a stale price.
    await alert(cfg, 'notify', 'tx not mined within timeout; left in flight', { hash: s.hash, nonce: s.nonce })
    return { status: 'pending', reason: 'receipt timeout', hash: s.hash }
  }

  if (receipt.status !== 'success') {
    journal.append({ t: 'reverted', at: Date.now(), id: s.id, hash: s.hash, block: receipt.blockNumber.toString() })
    await alert(cfg, 'page', 'rebalance tx reverted on-chain', { hash: s.hash })
    return { status: 'reverted', reason: 'on-chain revert', hash: s.hash }
  }

  // Read what the Safe actually received from the Transfer log (tokenOut -> Safe).
  const transferTopic = keccak256(stringToHex('Transfer(address,address,uint256)'))
  const safeTopic = `0x${cfg.safe.slice(2).toLowerCase().padStart(64, '0')}`
  const inbound = receipt.logs.find(
    (l) => l.address.toLowerCase() === s.tokenOut.toLowerCase() && l.topics[0] === transferTopic && l.topics[2]?.toLowerCase() === safeTopic,
  )
  const amountOut = inbound ? BigInt(inbound.data) : 0n
  const gasCostWei = receipt.gasUsed * receipt.effectiveGasPrice
  journal.append({ t: 'confirmed', at: Date.now(), id: s.id, hash: s.hash, block: receipt.blockNumber.toString(), amountOut: amountOut.toString(), gasCostWei: gasCostWei.toString() })

  if (amountOut < s.amountOutMinimum) {
    await alert(cfg, 'page', 'confirmed tx but Safe did not receive >= amountOutMinimum', { hash: s.hash, amountOut })
  }
  log('info', 'confirmed', { hash: s.hash, block: receipt.blockNumber, amountOut, gasCostEth: formatUnits(gasCostWei, 18) })
  return { status: 'confirmed', hash: s.hash, amountOut }
}

/** Resolve journaled-but-unresolved txs: mined -> record; nonce used by something else -> dropped. */
async function reconcileInFlight(cfg: Config, pc: PublicClient, journal: Journal) {
  for (const e of journal.inFlight()) {
    const receipt = await pc.getTransactionReceipt({ hash: e.hash }).catch(() => null)
    if (receipt) {
      journal.append(
        receipt.status === 'success'
          ? { t: 'confirmed', at: Date.now(), id: e.id, hash: e.hash, block: receipt.blockNumber.toString(), amountOut: '0', gasCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString() }
          : { t: 'reverted', at: Date.now(), id: e.id, hash: e.hash, block: receipt.blockNumber.toString() },
      )
      continue
    }
    const agentNonce = await pc.getTransactionCount({ address: cfg.agentAddress, blockTag: 'latest' })
    if (agentNonce > e.nonce) {
      // Nonce consumed by a different tx. If you didn't send one, the agent key is compromised.
      journal.append({ t: 'dropped', at: Date.now(), id: e.id, hash: e.hash, nonce: e.nonce })
      await alert(cfg, 'page', 'journaled tx nonce was consumed by an unknown tx', { hash: e.hash, nonce: e.nonce })
    } else if (Date.now() - e.at > 30 * 60_000) {
      // Private RPC gave up and the deadline has long passed: it can no longer execute a swap.
      journal.append({ t: 'dropped', at: Date.now(), id: e.id, hash: e.hash, nonce: e.nonce })
      log('warn', 'marking stale in-flight tx as dropped (deadline long past)', { hash: e.hash })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      sell: { type: 'string' },
      amount: { type: 'string' },
      reason: { type: 'string', default: 'manual' },
      id: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  })
  const sell = values.sell?.toUpperCase() as Side | undefined
  if ((sell !== 'WETH' && sell !== 'USDC') || !values.amount) {
    console.error('usage: tsx rebalance.ts --sell WETH|USDC --amount <decimal> [--reason ..] [--id ..] [--dry-run]')
    process.exit(2)
  }
  const decision: RebalanceDecision = {
    id: values.id ?? `${Date.now()}-${sell}-${values.amount}`,
    sell,
    amountIn: parseUnits(values.amount, TOKENS[sell].decimals),
    reason: values.reason!,
  }
  const res = await executeRebalance(decision, { dryRun: values['dry-run'] })
  console.log(JSON.stringify(res, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
  process.exit(res.status === 'confirmed' || res.status === 'dry-run' || res.status === 'skipped' ? 0 : 1)
}

