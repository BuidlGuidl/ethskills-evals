/**
 * rebalance.ts — turns a rebalance decision into a signed, submitted mainnet swap.
 *
 * ─── Accounts and contracts ────────────────────────────────────────────────
 *
 *   Treasury Safe (SAFE_ADDRESS)
 *     Holds the ~$400k in WETH + USDC. Owned by YOUR hardware wallets (e.g. 2-of-3).
 *     The agent is NOT an owner and cannot move funds out of it.
 *
 *   Zodiac Roles Modifier v2 (ROLES_MODIFIER_ADDRESS)
 *     Enabled as a module on the Safe. Holds one role (ROLE_KEY) assigned to the
 *     agent key. That role permits exactly one call:
 *       SwapRouter.exactInputSingle with
 *         tokenIn/tokenOut ∈ {WETH→USDC, USDC→WETH}, fee = 500, recipient == Safe,
 *         amountIn under a per-trade cap and within a daily on-chain allowance.
 *     No approve, no transfer, no value, no delegatecall. Built by roles-setup.ts;
 *     see DEPLOY.md §4.
 *
 *   Agent key (KMS_KEY_ID → an EOA address)
 *     secp256k1 key inside AWS KMS; the private key never exists on the VM.
 *     Holds only gas ETH. Sends: agent EOA → Roles.execTransactionWithRole →
 *     Safe.execTransactionFromModule → SwapRouter.exactInputSingle → pool.
 *
 *   Uniswap V3 SwapRouter (v1)   0xE592427A0AEce92De3Edee1F18E0157C05861564
 *     v1 rather than SwapRouter02 because v1 carries `deadline` inside the
 *     params struct, so the Roles permission can scope the call directly.
 *   Uniswap V3 QuoterV2          0x61fFE014bA17989E743c5F6cB21bF9697530B21e
 *   WETH/USDC 0.05% pool         0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 (token0=USDC, token1=WETH)
 *   WETH                         0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *   USDC                         0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   Chainlink ETH/USD            0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 (heartbeat 1h, 0.5% dev)
 *   Chainlink USDC/USD           0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6 (heartbeat 24h, 0.25% dev)
 *
 *   Submission: private orderflow only (Flashbots Protect / MEV Blocker). This
 *   code never broadcasts a swap to the public mempool.
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────
 *
 *   import { executeRebalance } from './rebalance.js'
 *   await executeRebalance({ id: 'sig-2026-09-19T17:00Z', side: 'SELL_WETH', usdNotional: 25_000, reason: '...' })
 *
 *   CLI:
 *     npx tsx rebalance.ts --side SELL_WETH --usd 25000 --id <unique-id> [--dry-run]
 *     npx tsx rebalance.ts --check        # preflight only: config, oracles, balances, nonce
 *
 * Every failure mode is fail-closed: when in doubt it does not trade, and for
 * anything that smells like compromise or loss it writes a HALT file that only
 * a human can remove.
 */

import { KMSClient, GetPublicKeyCommand, SignCommand } from '@aws-sdk/client-kms'
import {
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  numberToHex,
  parseAbi,
  parseEventLogs,
  parseGwei,
  parseEther,
  recoverAddress,
  serializeTransaction,
  toHex,
  TransactionReceiptNotFoundError,
} from 'viem'
import { privateKeyToAccount, publicKeyToAddress, toAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { join } from 'node:path'

// ═══════════════════════════════════════════════════════════════════════════
// Mainnet contracts (checked on startup — see verifyDeployment)
// ═══════════════════════════════════════════════════════════════════════════

const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNISWAP_V3_FACTORY: Address = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
const SWAP_ROUTER: Address = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
const QUOTER_V2: Address = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const POOL_WETH_USDC_500: Address = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'
const FEE_TIER = 500
const CHAINLINK_ETH_USD: Address = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
const CHAINLINK_USDC_USD: Address = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6'

const DEFAULT_PRIVATE_RPCS = ['https://rpc.flashbots.net/fast', 'https://rpc.mevblocker.io']

// ═══════════════════════════════════════════════════════════════════════════
// Policy. The on-chain Roles allowances are the real backstop; these off-chain
// limits are deliberately tighter so the bot trips before the chain does.
// ═══════════════════════════════════════════════════════════════════════════

const POLICY = {
  minTradeUsd: 1_000,
  maxTradeUsd: 50_000,
  maxRolling24hUsdPerSide: 90_000, // below the on-chain ~$100k/day/direction allowance (DEPLOY.md §4)
  maxSlippageBps: 30n, // minOut = quote * (1 - 0.30%)
  maxQuoteVsOracleBps: 100n, // refuse if Uniswap quote is >1% worse than Chainlink
  haltRealizedVsOracleBps: 150n, // realized fill >1.5% worse than oracle → HALT + page
  maxEthUsdAgeSec: 3600 + 900, // heartbeat 1h + margin
  maxUsdcUsdAgeSec: 86_400 + 3600, // heartbeat 24h + margin
  usdcDepegHaltBps: 100n, // USDC off $1 by >1% → HALT + page
  maxFeePerGas: parseGwei('40'), // don't rebalance into a gas spike; retry later
  maxPriorityFeePerGas: parseGwei('2'),
  deadlineSec: 300,
  inclusionTimeoutMs: 8 * 60_000, // private RPCs retry for ~25 blocks
  minAgentGasBalance: parseEther('0.02'),
} as const

// ═══════════════════════════════════════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════════════════════════════════════

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
])

const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
])

const swapRouterAbi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
  'function factory() view returns (address)',
])

const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

const rolesAbi = parseAbi([
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)',
  'function avatar() view returns (address)',
  'function target() view returns (address)',
])

const safeAbi = parseAbi(['function isModuleEnabled(address module) view returns (bool)'])

const poolAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
])

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type RebalanceDecision = {
  /** Unique per decision. Re-submitting the same id is a no-op (idempotency). */
  id: string
  side: 'SELL_WETH' | 'BUY_WETH'
  usdNotional: number
  reason?: string
}

export type RebalanceResult =
  | { status: 'filled'; txHash: Hex; amountIn: bigint; amountOut: bigint }
  | { status: 'skipped'; reason: string }
  | { status: 'expired'; txHash: Hex }
  | { status: 'dry-run'; amountIn: bigint; minOut: bigint; gas: bigint }

type LedgerEntry = {
  id: string
  side: RebalanceDecision['side']
  usdNotional: number
  createdAt: number
  status: 'submitted' | 'filled' | 'expired' | 'failed'
  nonce: number
  txHash?: Hex
  deadline: number
  amountIn: string
  minOut: string
  amountOut?: string
}

type Ledger = { nextNonce: number | null; entries: LedgerEntry[] }

// ═══════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`missing env ${name}`)
  return v
}

function requireAddress(name: string): Address {
  const v = requireEnv(name)
  if (!isAddress(v)) throw new Error(`${name} is not an address: ${v}`)
  return getAddress(v)
}

function loadConfig() {
  const rpcUrl = requireEnv('RPC_URL')
  const signer = (process.env.SIGNER ?? 'kms') as 'kms' | 'local-fork'
  const isLocalRpc = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(rpcUrl)
  if (signer === 'local-fork' && !isLocalRpc) {
    throw new Error('SIGNER=local-fork is only allowed against a local anvil fork (RPC_URL on localhost)')
  }
  const roleKey = requireEnv('ROLE_KEY') as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(roleKey)) throw new Error('ROLE_KEY must be a 32-byte hex value')

  return {
    rpcUrl,
    // On a local fork the "private" RPC is the fork itself; on mainnet it is never the public RPC.
    privateRpcUrls: isLocalRpc
      ? [rpcUrl]
      : (process.env.PRIVATE_RPC_URLS?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_PRIVATE_RPCS),
    signer,
    safe: requireAddress('SAFE_ADDRESS'),
    roles: requireAddress('ROLES_MODIFIER_ADDRESS'),
    roleKey,
    kmsKeyId: process.env.KMS_KEY_ID,
    awsRegion: process.env.AWS_REGION,
    stateDir: process.env.STATE_DIR ?? './state',
    alertWebhook: process.env.ALERT_WEBHOOK_URL, // non-paging channel (log/Slack/Discord)
    pageWebhook: process.env.PAGE_WEBHOOK_URL, // paging channel (PagerDuty/Pushover/…) — wakes a human
    heartbeatUrl: process.env.HEARTBEAT_URL, // dead-man's switch (e.g. healthchecks.io)
  }
}

type Config = ReturnType<typeof loadConfig>

// ═══════════════════════════════════════════════════════════════════════════
// Signer: AWS KMS-backed viem account (key never leaves the HSM)
// ═══════════════════════════════════════════════════════════════════════════

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n

function bytesToBigInt(b: Uint8Array): bigint {
  return b.length === 0 ? 0n : BigInt(toHex(b))
}

/** Parse ASN.1 DER `SEQUENCE { INTEGER r, INTEGER s }` as returned by KMS. */
function parseDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  let i = 0
  if (der[i++] !== 0x30) throw new Error('KMS signature: expected SEQUENCE')
  i++ // length (always short form for a 70-72 byte ECDSA sig)
  if (der[i++] !== 0x02) throw new Error('KMS signature: expected INTEGER r')
  const rLen = der[i++]
  const r = bytesToBigInt(der.subarray(i, i + rLen))
  i += rLen
  if (der[i++] !== 0x02) throw new Error('KMS signature: expected INTEGER s')
  const sLen = der[i++]
  const s = bytesToBigInt(der.subarray(i, i + sLen))
  return { r, s }
}

/** KMS DER signature → Ethereum {r, s, yParity}: low-s normalized, recovery bit found by trial. */
export async function derToEthSignature(der: Uint8Array, hash: Hex, address: Address) {
  let { r, s } = parseDerSignature(der)
  if (s > SECP256K1_N / 2n) s = SECP256K1_N - s // EIP-2: low-s only
  const rHex = numberToHex(r, { size: 32 })
  const sHex = numberToHex(s, { size: 32 })
  for (const yParity of [0, 1] as const) {
    const recovered = await recoverAddress({ hash, signature: { r: rHex, s: sHex, yParity } })
    if (recovered === address) return { r: rHex, s: sHex, yParity }
  }
  throw new Error('KMS signature did not recover to the agent address')
}

async function createKmsAccount(keyId: string, region?: string): Promise<LocalAccount> {
  const kms = new KMSClient(region ? { region } : {})
  const pub = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }))
  if (pub.KeySpec !== 'ECC_SECG_P256K1') throw new Error(`KMS key spec is ${pub.KeySpec}, need ECC_SECG_P256K1`)
  // SubjectPublicKeyInfo DER; the uncompressed point (0x04 || X || Y) is the trailing 65 bytes.
  const spki = pub.PublicKey!
  const address = publicKeyToAddress(toHex(spki.subarray(spki.length - 65)))

  async function signHash(hash: Hex) {
    const res = await kms.send(
      new SignCommand({
        KeyId: keyId,
        Message: Buffer.from(hash.slice(2), 'hex'),
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256', // with MessageType=DIGEST KMS signs the 32 bytes as-is
      }),
    )
    return derToEthSignature(res.Signature!, hash, address)
  }

  return toAccount({
    address,
    async signTransaction(tx, options) {
      const serializer = options?.serializer ?? serializeTransaction
      const sig = await signHash(keccak256(await serializer(tx)))
      return serializer(tx, sig)
    },
    // The agent has no reason to sign anything but transactions. Refuse, so a
    // bug or compromise elsewhere can't use it to sign permits/off-chain orders.
    async signMessage() {
      throw new Error('agent key does not sign messages')
    },
    async signTypedData() {
      throw new Error('agent key does not sign typed data')
    },
  })
}

async function loadAccount(cfg: Config): Promise<LocalAccount> {
  if (cfg.signer === 'local-fork') {
    // Fork testing only (enforced in loadConfig). Never put a mainnet key in env.
    return privateKeyToAccount(requireEnv('FORK_PRIVATE_KEY') as Hex)
  }
  if (!cfg.kmsKeyId) throw new Error('missing env KMS_KEY_ID')
  return createKmsAccount(cfg.kmsKeyId, cfg.awsRegion)
}

// ═══════════════════════════════════════════════════════════════════════════
// State: ledger (idempotency, nonce tracking), lock, HALT file
// ═══════════════════════════════════════════════════════════════════════════

function paths(cfg: Config) {
  mkdirSync(cfg.stateDir, { recursive: true })
  return {
    ledger: join(cfg.stateDir, 'ledger.json'),
    lock: join(cfg.stateDir, 'rebalance.lock'),
    halt: join(cfg.stateDir, 'HALT'),
  }
}

function readLedger(cfg: Config): Ledger {
  const p = paths(cfg).ledger
  if (!existsSync(p)) return { nextNonce: null, entries: [] }
  return JSON.parse(readFileSync(p, 'utf8'))
}

function writeLedger(cfg: Config, ledger: Ledger) {
  const p = paths(cfg).ledger
  writeFileSync(`${p}.tmp`, JSON.stringify(ledger, null, 2))
  renameSync(`${p}.tmp`, p) // atomic replace
}

function acquireLock(cfg: Config): () => void {
  const p = paths(cfg).lock
  if (existsSync(p)) {
    const pid = Number(readFileSync(p, 'utf8'))
    let alive = false
    try {
      process.kill(pid, 0)
      alive = true
    } catch {}
    if (alive) throw new Error(`another rebalance is running (pid ${pid})`)
    unlinkSync(p) // stale lock from a crashed run; the ledger reconciliation handles its tx
  }
  const fd = openSync(p, 'wx')
  writeFileSync(fd, String(process.pid))
  closeSync(fd)
  return () => existsSync(p) && unlinkSync(p)
}

class HaltError extends Error {}

async function halt(cfg: Config, reason: string): Promise<never> {
  writeFileSync(paths(cfg).halt, `${new Date().toISOString()} ${reason}\n`, { flag: 'a' })
  await notify(cfg, 'page', `HALTED: ${reason}. Trading stopped until ${paths(cfg).halt} is removed by a human.`)
  throw new HaltError(reason)
}

// ═══════════════════════════════════════════════════════════════════════════
// Alerts
// ═══════════════════════════════════════════════════════════════════════════

async function notify(cfg: Config, level: 'info' | 'page', text: string) {
  const line = `[${new Date().toISOString()}] [${level}] ${text}`
  console.log(line)
  const url = level === 'page' ? (cfg.pageWebhook ?? cfg.alertWebhook) : cfg.alertWebhook
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: line }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    console.error('alert delivery failed', e)
  }
}

async function heartbeat(cfg: Config) {
  if (!cfg.heartbeatUrl) return
  await fetch(cfg.heartbeatUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => {})
}

// ═══════════════════════════════════════════════════════════════════════════
// Chain reads
// ═══════════════════════════════════════════════════════════════════════════

/** Refuse to run against anything other than the exact deployment we expect. */
async function verifyDeployment(client: PublicClient, cfg: Config, agent: Address) {
  const chainId = await client.getChainId()
  if (chainId !== 1) throw new Error(`RPC is chain ${chainId}, expected mainnet (1)`)

  const [routerFactory, t0, t1, fee, avatar, target, moduleEnabled] = await Promise.all([
    client.readContract({ address: SWAP_ROUTER, abi: swapRouterAbi, functionName: 'factory' }),
    client.readContract({ address: POOL_WETH_USDC_500, abi: poolAbi, functionName: 'token0' }),
    client.readContract({ address: POOL_WETH_USDC_500, abi: poolAbi, functionName: 'token1' }),
    client.readContract({ address: POOL_WETH_USDC_500, abi: poolAbi, functionName: 'fee' }),
    client.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'avatar' }),
    client.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'target' }),
    client.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'isModuleEnabled', args: [cfg.roles] }),
  ])
  if (routerFactory !== UNISWAP_V3_FACTORY) throw new Error('SwapRouter factory mismatch')
  if (t0 !== USDC || t1 !== WETH || fee !== FEE_TIER) throw new Error('pool token/fee mismatch')
  if (avatar !== cfg.safe || target !== cfg.safe) throw new Error('Roles modifier avatar/target is not the Safe')
  if (!moduleEnabled) throw new Error('Roles modifier is not enabled on the Safe')
  if (agent === cfg.safe) throw new Error('agent address equals Safe address')
}

async function readFeed(client: PublicClient, feed: Address, maxAgeSec: number, label: string) {
  const [roundId, answer, , updatedAt, answeredInRound] = await client.readContract({
    address: feed,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
  })
  const age = Math.floor(Date.now() / 1000) - Number(updatedAt)
  if (answer <= 0n) throw new Error(`${label}: non-positive answer`)
  if (answeredInRound < roundId) throw new Error(`${label}: stale round`)
  if (age > maxAgeSec) throw new Error(`${label}: stale by ${age}s`)
  return answer // 8 decimals for both feeds
}

// ═══════════════════════════════════════════════════════════════════════════
// Ledger reconciliation: resolve any in-flight tx from a previous run and
// detect use of the agent key by anyone other than this process.
// ═══════════════════════════════════════════════════════════════════════════

async function reconcile(client: PublicClient, cfg: Config, agent: Address) {
  const ledger = readLedger(cfg)
  const chainNonce = await client.getTransactionCount({ address: agent, blockTag: 'latest' })
  const now = Math.floor(Date.now() / 1000)

  for (const e of ledger.entries.filter((e) => e.status === 'submitted')) {
    const receipt = e.txHash ? await getReceiptOrNull(client, e.txHash) : null
    if (receipt) {
      e.status = receipt.status === 'success' ? 'filled' : 'failed'
      const out = receipt.status === 'success' ? extractAmountOut(receipt.logs, cfg.safe, e.side) : null
      if (out !== null) e.amountOut = out.toString()
      await notify(cfg, 'info', `reconciled ${e.id}: ${e.status} (${e.txHash})`)
    } else if (chainNonce > e.nonce && (await nonceUsedByOwnEarlierTx(client, ledger, e))) {
      e.status = 'expired' // a late-landing earlier tx of ours took this nonce
      await notify(cfg, 'info', `decision ${e.id} displaced by an earlier tx of ours at nonce ${e.nonce}`)
    } else if (chainNonce > e.nonce) {
      // Our nonce was consumed by a tx that is not ours.
      writeLedger(cfg, ledger)
      await halt(cfg, `agent nonce ${e.nonce} consumed by an unknown tx — possible key compromise`)
    } else if (now > e.deadline + 60) {
      e.status = 'expired' // past deadline: cannot execute any more (router reverts)
      await notify(cfg, 'info', `decision ${e.id} expired unfilled`)
    } else {
      writeLedger(cfg, ledger)
      throw new Error(`decision ${e.id} still in flight (${e.txHash}); retry after deadline`)
    }
  }

  if (ledger.nextNonce !== null && chainNonce > ledger.nextNonce) {
    writeLedger(cfg, ledger)
    await halt(cfg, `agent nonce is ${chainNonce}, ledger expected ${ledger.nextNonce} — agent key used outside this process`)
  }
  ledger.nextNonce = chainNonce
  writeLedger(cfg, ledger)
  return { ledger, nonce: chainNonce }
}

async function getReceiptOrNull(client: PublicClient, hash: Hex) {
  try {
    return await client.getTransactionReceipt({ hash })
  } catch (e) {
    if (e instanceof TransactionReceiptNotFoundError) return null
    throw e // RPC trouble must not be mistaken for "not mined"
  }
}

async function nonceUsedByOwnEarlierTx(client: PublicClient, ledger: Ledger, e: LedgerEntry) {
  for (const other of ledger.entries) {
    if (other === e || other.nonce !== e.nonce || !other.txHash) continue
    if (await getReceiptOrNull(client, other.txHash)) return true
  }
  return false
}

function extractAmountOut(logs: readonly any[], safe: Address, side: RebalanceDecision['side']): bigint | null {
  const swaps = parseEventLogs({ abi: poolAbi, eventName: 'Swap', logs: logs as any }).filter(
    (l) => getAddress(l.address) === POOL_WETH_USDC_500 && l.args.recipient === safe,
  )
  if (swaps.length !== 1) return null
  const { amount0, amount1 } = swaps[0].args // pool perspective: negative = paid out
  return side === 'SELL_WETH' ? -amount0 : -amount1
}

// ═══════════════════════════════════════════════════════════════════════════
// Execution path
// ═══════════════════════════════════════════════════════════════════════════

export async function executeRebalance(
  decision: RebalanceDecision,
  opts: { dryRun?: boolean } = {},
): Promise<RebalanceResult> {
  const cfg = loadConfig()
  if (existsSync(paths(cfg).halt)) {
    return { status: 'skipped', reason: `HALT file present: ${readFileSync(paths(cfg).halt, 'utf8').trim()}` }
  }

  const release = acquireLock(cfg)
  try {
    return await run(cfg, decision, opts)
  } catch (e) {
    if (!(e instanceof HaltError)) await notify(cfg, 'info', `rebalance ${decision.id} errored: ${(e as Error).message}`)
    throw e
  } finally {
    release()
  }
}

async function run(cfg: Config, d: RebalanceDecision, opts: { dryRun?: boolean }): Promise<RebalanceResult> {
  // ── 0. Validate the decision itself ──────────────────────────────────────
  if (d.side !== 'SELL_WETH' && d.side !== 'BUY_WETH') throw new Error(`bad side ${d.side}`)
  if (!Number.isFinite(d.usdNotional) || d.usdNotional < POLICY.minTradeUsd || d.usdNotional > POLICY.maxTradeUsd) {
    throw new Error(`usdNotional ${d.usdNotional} outside [${POLICY.minTradeUsd}, ${POLICY.maxTradeUsd}]`)
  }

  const client = createPublicClient({ chain: mainnet, transport: http(cfg.rpcUrl, { retryCount: 3 }) })
  const account = await loadAccount(cfg)
  const agent = account.address

  await verifyDeployment(client, cfg, agent)

  // ── 1. Reconcile previous runs; idempotency; rolling 24h notional ────────
  const { ledger, nonce } = await reconcile(client, cfg, agent)
  if (ledger.entries.some((e) => e.id === d.id)) return { status: 'skipped', reason: `decision ${d.id} already processed` }

  const dayAgo = Date.now() - 86_400_000
  const used24h = ledger.entries
    .filter((e) => e.side === d.side && e.createdAt > dayAgo && e.status !== 'expired' && e.status !== 'failed')
    .reduce((sum, e) => sum + e.usdNotional, 0)
  if (used24h + d.usdNotional > POLICY.maxRolling24hUsdPerSide) {
    return { status: 'skipped', reason: `24h ${d.side} notional ${used24h} + ${d.usdNotional} > ${POLICY.maxRolling24hUsdPerSide}` }
  }

  // ── 2. Gas money for the agent ───────────────────────────────────────────
  const gasBal = await client.getBalance({ address: agent })
  if (gasBal < POLICY.minAgentGasBalance) {
    await notify(cfg, 'info', `agent gas low: ${formatUnits(gasBal, 18)} ETH at ${agent}`)
    if (gasBal < POLICY.minAgentGasBalance / 4n) return { status: 'skipped', reason: 'agent out of gas ETH' }
  }

  // ── 3. Oracle prices (ETH/USD, USDC/USD), USDC peg check ────────────────
  const [ethUsd, usdcUsd] = await Promise.all([
    readFeed(client, CHAINLINK_ETH_USD, POLICY.maxEthUsdAgeSec, 'ETH/USD'),
    readFeed(client, CHAINLINK_USDC_USD, POLICY.maxUsdcUsdAgeSec, 'USDC/USD'),
  ])
  const pegDevBps = ((usdcUsd > 100_000_000n ? usdcUsd - 100_000_000n : 100_000_000n - usdcUsd) * 10_000n) / 100_000_000n
  if (pegDevBps > POLICY.usdcDepegHaltBps) await halt(cfg, `USDC/USD at ${formatUnits(usdcUsd, 8)} — depeg`)

  // ── 4. Size the trade in token units from the USD notional ──────────────
  const cents = BigInt(Math.round(d.usdNotional * 100))
  const [tokenIn, tokenOut] = d.side === 'SELL_WETH' ? [WETH, USDC] : [USDC, WETH]
  const amountIn =
    d.side === 'SELL_WETH'
      ? (cents * 10n ** 18n * 10n ** 8n) / (ethUsd * 100n) // WETH wei
      : (cents * 10n ** 4n * 10n ** 8n) / usdcUsd // USDC 6dp
  const oracleOut =
    d.side === 'SELL_WETH'
      ? (amountIn * ethUsd) / usdcUsd / 10n ** 12n // USDC 6dp
      : (amountIn * usdcUsd * 10n ** 12n) / ethUsd // WETH wei

  const [safeBal, safeAllowance] = await Promise.all([
    client.readContract({ address: tokenIn, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] }),
    client.readContract({ address: tokenIn, abi: erc20Abi, functionName: 'allowance', args: [cfg.safe, SWAP_ROUTER] }),
  ])
  if (safeBal < amountIn) return { status: 'skipped', reason: `Safe ${tokenIn} balance ${safeBal} < ${amountIn}` }
  if (safeAllowance < amountIn) {
    await notify(cfg, 'page', `Safe allowance to SwapRouter for ${tokenIn} is ${safeAllowance} < ${amountIn}; owners must re-approve`)
    return { status: 'skipped', reason: 'insufficient router allowance' }
  }

  // ── 5. Quote on-chain, sanity-check against the oracle ──────────────────
  const { result: quote } = await client.simulateContract({
    address: QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn, tokenOut, amountIn, fee: FEE_TIER, sqrtPriceLimitX96: 0n }],
  })
  const quotedOut = quote[0]
  const oracleFloor = (oracleOut * (10_000n - POLICY.maxQuoteVsOracleBps)) / 10_000n
  if (quotedOut < oracleFloor) {
    await notify(cfg, 'info', `quote ${quotedOut} < oracle floor ${oracleFloor} for ${d.id}; pool off-market or thin, skipping`)
    return { status: 'skipped', reason: 'quote too far below oracle' }
  }
  const minOut = (quotedOut * (10_000n - POLICY.maxSlippageBps)) / 10_000n

  // ── 6. Build calldata: agent → Roles → Safe → SwapRouter ────────────────
  const deadline = Math.floor(Date.now() / 1000) + POLICY.deadlineSec
  const swapData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        fee: FEE_TIER,
        recipient: cfg.safe, // proceeds always land back in the Safe (also enforced by Roles)
        deadline: BigInt(deadline),
        amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  const data = encodeFunctionData({
    abi: rolesAbi,
    functionName: 'execTransactionWithRole',
    // value 0, operation 0 = Call (never DelegateCall), shouldRevert = true so a
    // permission or swap failure reverts the whole tx instead of "succeeding".
    args: [SWAP_ROUTER, 0n, swapData, 0, cfg.roleKey, true],
  })

  // ── 7. Simulate exactly what will be sent; estimate gas; fee caps ───────
  await client.call({ account: agent, to: cfg.roles, data })
  const gasEstimate = await client.estimateGas({ account: agent, to: cfg.roles, data })
  const gas = (gasEstimate * 13n) / 10n

  const block = await client.getBlock()
  const baseFee = block.baseFeePerGas ?? 0n
  const priority = POLICY.maxPriorityFeePerGas
  const maxFeePerGas = baseFee * 2n + priority > POLICY.maxFeePerGas ? POLICY.maxFeePerGas : baseFee * 2n + priority
  if (baseFee + priority > POLICY.maxFeePerGas) {
    return { status: 'skipped', reason: `base fee ${formatUnits(baseFee, 9)} gwei above cap` }
  }

  if (opts.dryRun) {
    console.log({ agent, tokenIn, amountIn, quotedOut, oracleOut, minOut, gas, maxFeePerGas, nonce })
    return { status: 'dry-run', amountIn, minOut, gas }
  }

  // ── 8. Sign (KMS) ───────────────────────────────────────────────────────
  const signed = await account.signTransaction({
    type: 'eip1559',
    chainId: 1,
    nonce,
    to: cfg.roles,
    data,
    value: 0n,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas: priority,
  })
  const txHash = keccak256(signed)

  // Record before sending: if we crash after broadcast, reconcile() picks it up.
  ledger.entries.push({
    id: d.id,
    side: d.side,
    usdNotional: d.usdNotional,
    createdAt: Date.now(),
    status: 'submitted',
    nonce,
    txHash,
    deadline,
    amountIn: amountIn.toString(),
    minOut: minOut.toString(),
  })
  ledger.nextNonce = nonce + 1
  writeLedger(cfg, ledger)

  // ── 9. Submit via private orderflow only ────────────────────────────────
  const results = await Promise.allSettled(
    cfg.privateRpcUrls.map((url) =>
      createPublicClient({ chain: mainnet, transport: http(url, { retryCount: 2 }) }).sendRawTransaction({
        serializedTransaction: signed,
      }),
    ),
  )
  if (!results.some((r) => r.status === 'fulfilled')) {
    // Nothing accepted it. Leave the entry 'submitted': reconcile() will mark it expired after the deadline.
    throw new Error(`all private RPCs rejected tx: ${results.map((r) => (r as PromiseRejectedResult).reason?.shortMessage ?? r).join(' | ')}`)
  }

  // ── 10. Wait for inclusion (on the public RPC), verify the fill ─────────
  const receipt = await client
    .waitForTransactionReceipt({ hash: txHash, timeout: POLICY.inclusionTimeoutMs, pollingInterval: 4_000 })
    .catch(() => null)
  const entry = ledger.entries[ledger.entries.length - 1]

  if (!receipt) {
    // Not included before timeout. The deadline makes it unexecutable soon; reconcile() finalizes it.
    await notify(cfg, 'info', `decision ${d.id} not included within timeout (${txHash})`)
    return { status: 'expired', txHash }
  }
  if (receipt.status !== 'success') {
    entry.status = 'failed'
    writeLedger(cfg, ledger)
    await notify(cfg, 'info', `decision ${d.id} reverted on-chain (${txHash})`)
    return { status: 'skipped', reason: 'reverted' }
  }

  const amountOut = extractAmountOut(receipt.logs, cfg.safe, d.side)
  entry.status = 'filled'
  entry.amountOut = amountOut?.toString()
  writeLedger(cfg, ledger)

  if (amountOut === null) await halt(cfg, `tx ${txHash} succeeded but no Swap to the Safe was found`)
  const haltFloor = (oracleOut * (10_000n - POLICY.haltRealizedVsOracleBps)) / 10_000n
  if (amountOut! < haltFloor) {
    await halt(cfg, `fill for ${d.id} was ${amountOut} vs oracle ${oracleOut} (>${POLICY.haltRealizedVsOracleBps}bps worse)`)
  }

  await notify(
    cfg,
    'info',
    `filled ${d.id} ${d.side} in=${amountIn} out=${amountOut} oracle=${oracleOut} gasUsed=${receipt.gasUsed} tx=${txHash}`,
  )
  await heartbeat(cfg)
  return { status: 'filled', txHash, amountIn, amountOut: amountOut! }
}

// ═══════════════════════════════════════════════════════════════════════════
// Preflight (run from cron every few minutes even when not trading, so the
// heartbeat proves the box, RPC, KMS and on-chain wiring are all alive)
// ═══════════════════════════════════════════════════════════════════════════

export async function preflight() {
  const cfg = loadConfig()
  const client = createPublicClient({ chain: mainnet, transport: http(cfg.rpcUrl) })
  const account = await loadAccount(cfg)
  await verifyDeployment(client, cfg, account.address)
  const release = acquireLock(cfg)
  try {
    await reconcile(client, cfg, account.address)
  } finally {
    release()
  }
  const [ethUsd, usdcUsd, weth, usdc, gas] = await Promise.all([
    readFeed(client, CHAINLINK_ETH_USD, POLICY.maxEthUsdAgeSec, 'ETH/USD'),
    readFeed(client, CHAINLINK_USDC_USD, POLICY.maxUsdcUsdAgeSec, 'USDC/USD'),
    client.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] }),
    client.getBalance({ address: account.address }),
  ])
  console.log({
    agent: account.address,
    safe: cfg.safe,
    halted: existsSync(paths(cfg).halt),
    ethUsd: formatUnits(ethUsd, 8),
    usdcUsd: formatUnits(usdcUsd, 8),
    safeWETH: formatUnits(weth, 18),
    safeUSDC: formatUnits(usdc, 6),
    agentGasETH: formatUnits(gas, 18),
  })
  if (!existsSync(paths(cfg).halt)) await heartbeat(cfg)
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const flag = (n: string) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : undefined
  }
  const main = args.includes('--check')
    ? preflight()
    : executeRebalance(
        {
          id: flag('--id') ?? (() => { throw new Error('--id required') })(),
          side: flag('--side') as RebalanceDecision['side'],
          usdNotional: Number(flag('--usd')),
        },
        { dryRun: args.includes('--dry-run') },
      ).then((r) => console.log(r))
  main.catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
