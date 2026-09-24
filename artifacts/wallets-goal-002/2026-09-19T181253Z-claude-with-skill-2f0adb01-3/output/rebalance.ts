/**
 * rebalance.ts — turns a rebalance decision (WETH <-> USDC) into a signed,
 * submitted Ethereum mainnet transaction.
 *
 * Custody model (see DEPLOY.md for setup):
 *
 *   Treasury Safe (holds the ~$400k WETH/USDC; owned by YOUR hardware keys, 2-of-3)
 *     └─ Zodiac Roles Modifier v2 (enabled as a Safe module)
 *          └─ role "rebalancer", assigned to the agent EOA, allows exactly one call:
 *             SwapRouter02.exactInputSingle with tokenIn/tokenOut ∈ {WETH, USDC},
 *             fee = 500, recipient = the Safe, amountIn ≤ per-trade cap and
 *             within a daily allowance, amountOutMinimum ≥ Chainlink − 1.5%
 *             (contracts/OracleMinOutCondition.sol). Nothing else: no transfer,
 *             no approve, no delegatecall, no ETH value. See roles-policy.ts.
 *
 *   Agent EOA (secp256k1 key inside AWS KMS, non-exportable)
 *     - holds only gas ETH, never treasury funds
 *     - is NOT a Safe owner
 *     - calls Roles.execTransactionWithRole(...) → Safe.execTransactionFromModule(...)
 *       → SwapRouter02.exactInputSingle(...), so the Safe is msg.sender, pays
 *       tokenIn, and receives tokenOut.
 *
 * If this VM is fully compromised, the attacker can only churn WETH<->USDC inside
 * the Safe, at most ~1.5% worse than Chainlink per swap, within the daily
 * allowances. They cannot withdraw, approve, or send funds anywhere.
 *
 * Usage:
 *   import { executeRebalance } from './rebalance.ts'   // from your signal engine
 *   npx tsx rebalance.ts WETH_TO_USDC 2.5 [--dry-run]   // manual / testing
 *   npx tsx rebalance.ts USDC_TO_WETH 10000 [--dry-run]
 */

import { GetPublicKeyCommand, KMSClient, SignCommand } from '@aws-sdk/client-kms'
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  type Address,
  type Hex,
  type TransactionSerializable,
  bytesToBigInt,
  createPublicClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  hashMessage,
  hashTypedData,
  http,
  keccak256,
  numberToHex,
  parseAbi,
  parseEventLogs,
  parseGwei,
  parseUnits,
  recoverAddress,
  serializeSignature,
  serializeTransaction,
} from 'viem'
import { type LocalAccount, publicKeyToAddress, toAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

// ─────────────────────────────────────────────────────────────────────────────
// Mainnet contracts this code touches (all verified-source on Etherscan)
// ─────────────────────────────────────────────────────────────────────────────

const WETH = getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
/** Uniswap V3 SwapRouter02 */
const SWAP_ROUTER_02 = getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
/** Uniswap V3 QuoterV2 (read-only, via eth_call) */
const QUOTER_V2 = getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e')
/** USDC/WETH 0.05% pool — the deepest WETH/USDC pool; the role pins fee=500 */
const POOL_FEE = 500
/** Chainlink ETH/USD and USDC/USD aggregator proxies (8 decimals) */
const CHAINLINK_ETH_USD = getAddress('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419')
const CHAINLINK_USDC_USD = getAddress('0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6')

const WETH_DECIMALS = 18
const USDC_DECIMALS = 6

// ─────────────────────────────────────────────────────────────────────────────
// ABIs (only the functions used)
// ─────────────────────────────────────────────────────────────────────────────

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

const swapRouterAbi = parseAbi([
  'struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)',
])

const quoterV2Abi = parseAbi([
  'struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }',
  'function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

/** Zodiac Roles Modifier v2 */
const rolesAbi = parseAbi([
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)',
  'function avatar() view returns (address)',
  'function target() view returns (address)',
])

/** Safe v1.4.1 */
const safeAbi = parseAbi([
  'function getOwners() view returns (address[])',
  'function isModuleEnabled(address module) view returns (bool)',
])

// ─────────────────────────────────────────────────────────────────────────────
// Config — everything from the environment; no secrets in this file.
// ─────────────────────────────────────────────────────────────────────────────

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`missing env ${name}`)
  return v
}

const config = {
  /** Reads, simulation, receipts. A paid provider (Alchemy/Infura/QuickNode). */
  readRpcUrl: env('READ_RPC_URL'),
  /** Submission only. Private orderflow so swaps are not sandwiched in the public mempool. */
  submitRpcUrl: env('SUBMIT_RPC_URL', 'https://rpc.flashbots.net/fast'),
  awsRegion: env('AWS_REGION'),
  kmsKeyId: env('KMS_KEY_ID'),
  /** Pin the address derived from the KMS key so a wrong key id fails loudly. */
  expectedAgentAddress: getAddress(env('AGENT_ADDRESS')),
  safe: getAddress(env('SAFE_ADDRESS')),
  roles: getAddress(env('ROLES_MODIFIER_ADDRESS')),
  roleKey: env('ROLE_KEY') as Hex, // bytes32

  // Off-chain limits. These are a second layer; the onchain role is the real boundary.
  minTradeUsd: Number(env('MIN_TRADE_USD', '1000')),
  maxTradeUsd: Number(env('MAX_TRADE_USD', '50000')),
  dailyCapUsd: Number(env('DAILY_CAP_USD', '200000')),
  /** Max tolerated loss vs. the fresh on-chain quote between quoting and inclusion. */
  slippageBps: BigInt(env('SLIPPAGE_BPS', '30')),
  /** Max tolerated gap between the pool's quote and Chainlink. Chainlink ETH/USD
   *  updates on 0.5% deviation, so anything much beyond ~1% means a manipulated
   *  pool, a stale oracle, or a broken market — in all cases: do not trade. */
  maxOracleDeviationBps: BigInt(env('MAX_ORACLE_DEVIATION_BPS', '100')),
  // Chainlink heartbeats: ETH/USD 1h (0.5% deviation), USDC/USD 24h (0.25% deviation).
  maxEthOracleAgeSec: BigInt(env('MAX_ETH_ORACLE_AGE_SEC', '3900')),
  maxUsdcOracleAgeSec: BigInt(env('MAX_USDC_ORACLE_AGE_SEC', '90000')),
  maxFeePerGas: parseGwei(env('MAX_FEE_GWEI', '40')),
  minPriorityFee: parseGwei(env('MIN_PRIORITY_GWEI', '0.5')),
  minAgentGasEth: Number(env('MIN_AGENT_GAS_ETH', '0.03')),
  receiptTimeoutMs: Number(env('RECEIPT_TIMEOUT_MS', '180000')),
  /** Realized execution worse than Chainlink by more than this pages a human. */
  pageOnExecutionDeviationBps: BigInt(env('PAGE_ON_EXEC_DEVIATION_BPS', '75')),

  statePath: env('STATE_PATH', './rebalance-state.json'),
  logPath: env('LOG_PATH', './rebalance-log.jsonl'),
  haltFile: env('HALT_FILE', './HALT'),
  /** Two webhooks: routine info (a channel you read when you want) vs. pages (wakes you). */
  infoWebhook: process.env.INFO_WEBHOOK_URL,
  pageWebhook: process.env.PAGE_WEBHOOK_URL,
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

const publicClient = createPublicClient({ chain: mainnet, transport: http(config.readRpcUrl) })
const submitClient = createPublicClient({ chain: mainnet, transport: http(config.submitRpcUrl) })

// ─────────────────────────────────────────────────────────────────────────────
// Agent signer: secp256k1 key held in AWS KMS (KeySpec ECC_SECG_P256K1).
// The private key never exists on this VM; the instance role can only call
// kms:Sign / kms:GetPublicKey on this one key.
// ─────────────────────────────────────────────────────────────────────────────

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n

function parseDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  // SEQUENCE { INTEGER r, INTEGER s } — ECDSA secp256k1 sigs are ≤72 bytes, so short-form lengths.
  let i = 0
  if (der[i++] !== 0x30) throw new Error('KMS sig: not a DER sequence')
  i++ // sequence length
  if (der[i++] !== 0x02) throw new Error('KMS sig: r not an integer')
  const rLen = der[i++]
  const r = bytesToBigInt(der.slice(i, i + rLen))
  i += rLen
  if (der[i++] !== 0x02) throw new Error('KMS sig: s not an integer')
  const sLen = der[i++]
  const s = bytesToBigInt(der.slice(i, i + sLen))
  return { r, s }
}

export async function createKmsAccount(kms: KMSClient, keyId: string) {
  const { PublicKey } = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }))
  if (!PublicKey) throw new Error('KMS returned no public key')
  // SubjectPublicKeyInfo DER; the uncompressed point (0x04 || X || Y) is the trailing 65 bytes.
  const point = PublicKey.slice(-65)
  if (point[0] !== 0x04) throw new Error('KMS key is not an uncompressed secp256k1 key')
  const address = publicKeyToAddress(numberToHex(bytesToBigInt(point), { size: 65 }))

  async function signHash(hash: Hex) {
    const { Signature } = await kms.send(
      new SignCommand({
        KeyId: keyId,
        Message: Buffer.from(hash.slice(2), 'hex'),
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256', // KMS signs the 32-byte digest as given; we pass keccak256
      }),
    )
    if (!Signature) throw new Error('KMS returned no signature')
    let { r, s } = parseDerSignature(Signature)
    if (s > SECP256K1_N / 2n) s = SECP256K1_N - s // EIP-2: low-s only
    const rHex = numberToHex(r, { size: 32 })
    const sHex = numberToHex(s, { size: 32 })
    // KMS doesn't return the recovery id; find the one that recovers to our address.
    for (const yParity of [0, 1] as const) {
      const recovered = await recoverAddress({ hash, signature: { r: rHex, s: sHex, yParity } })
      if (recovered === address) return { r: rHex, s: sHex, yParity }
    }
    throw new Error('KMS signature does not recover to the agent address')
  }

  return toAccount({
    address,
    async signMessage({ message }) {
      return serializeSignature(await signHash(hashMessage(message)))
    },
    async signTypedData(typedData) {
      return serializeSignature(await signHash(hashTypedData(typedData)))
    },
    async signTransaction(tx, opts) {
      const serializer = opts?.serializer ?? serializeTransaction
      const hash = keccak256(await serializer(tx))
      return serializer(tx, await signHash(hash))
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Local state, logging, alerting
// ─────────────────────────────────────────────────────────────────────────────

type State = {
  day: string // UTC yyyy-mm-dd
  spentUsd: number
  pending?: { hash: Hex; nonce: number; submittedAt: number }
}

function loadState(): State {
  const today = new Date().toISOString().slice(0, 10)
  const s: State = existsSync(config.statePath)
    ? JSON.parse(readFileSync(config.statePath, 'utf8'))
    : { day: today, spentUsd: 0 }
  if (s.day !== today) {
    s.day = today
    s.spentUsd = 0
  }
  return s
}

function saveState(s: State) {
  const tmp = `${config.statePath}.tmp`
  writeFileSync(tmp, JSON.stringify(s, null, 2))
  renameSync(tmp, config.statePath) // atomic replace
}

function log(event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify(
    { ts: new Date().toISOString(), event, ...data },
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
  )
  console.log(line)
  appendFileSync(config.logPath, line + '\n')
}

async function alert(level: 'info' | 'page', message: string, data: Record<string, unknown> = {}) {
  log(`alert.${level}`, { message, ...data })
  const url = level === 'page' ? config.pageWebhook : config.infoWebhook
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ level, message, data }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    })
  } catch (e) {
    log('alert.delivery_failed', { error: String(e) })
  }
}

class Abort extends Error {
  constructor(
    message: string,
    public readonly page: boolean,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Oracle
// ─────────────────────────────────────────────────────────────────────────────

async function readChainlink(feed: Address, maxAgeSec: bigint): Promise<bigint> {
  const [, answer, , updatedAt] = await publicClient.readContract({
    address: feed,
    abi: chainlinkAbi,
    functionName: 'latestRoundData',
  })
  const age = BigInt(Math.floor(Date.now() / 1000)) - updatedAt
  if (answer <= 0n) throw new Abort(`Chainlink ${feed} returned non-positive answer`, true)
  if (age > maxAgeSec) throw new Abort(`Chainlink ${feed} stale (${age}s)`, true)
  return answer // 8 decimals
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────────────────────

export type RebalanceDecision = {
  direction: 'WETH_TO_USDC' | 'USDC_TO_WETH'
  /** Exact input amount in tokenIn base units (wei for WETH, 1e-6 for USDC). */
  amountIn: bigint
  /** Free-form id from the signal engine, for the audit log. */
  reason?: string
}

export type RebalanceResult =
  | { status: 'executed'; hash: Hex; amountOut: bigint }
  | { status: 'pending'; hash: Hex }
  | { status: 'simulated'; minOut: bigint; quote: bigint }
  | { status: 'aborted'; reason: string }

let accountPromise: ReturnType<typeof createKmsAccount> | undefined
function getAgent() {
  accountPromise ??= createKmsAccount(new KMSClient({ region: config.awsRegion }), config.kmsKeyId)
  return accountPromise
}

/** One-time sanity checks that the onchain wiring is what DEPLOY.md says it is. */
let wiringChecked = false
async function checkWiring(agent: Address) {
  if (wiringChecked) return
  const [chainId, owners, moduleEnabled, avatar, target] = await Promise.all([
    publicClient.getChainId(),
    publicClient.readContract({ address: config.safe, abi: safeAbi, functionName: 'getOwners' }),
    publicClient.readContract({ address: config.safe, abi: safeAbi, functionName: 'isModuleEnabled', args: [config.roles] }),
    publicClient.readContract({ address: config.roles, abi: rolesAbi, functionName: 'avatar' }),
    publicClient.readContract({ address: config.roles, abi: rolesAbi, functionName: 'target' }),
  ])
  if (chainId !== 1) throw new Abort(`READ_RPC_URL is chain ${chainId}, expected 1`, true)
  if (agent !== config.expectedAgentAddress)
    throw new Abort(`KMS key resolves to ${agent}, expected AGENT_ADDRESS ${config.expectedAgentAddress}`, true)
  if (owners.map(getAddress).includes(agent))
    throw new Abort('agent address is a Safe owner — it must only act through the Roles module', true)
  if (!moduleEnabled) throw new Abort('Roles modifier is not enabled on the Safe', true)
  if (getAddress(avatar) !== config.safe || getAddress(target) !== config.safe)
    throw new Abort('Roles modifier avatar/target is not the treasury Safe', true)
  wiringChecked = true
}

/** Refuse to stack transactions: at most one swap in flight. */
async function reconcilePending(state: State, agent: Address): Promise<number> {
  const latestNonce = await publicClient.getTransactionCount({ address: agent, blockTag: 'latest' })
  const p = state.pending
  if (!p) return latestNonce
  if (latestNonce > p.nonce) {
    const receipt = await publicClient.getTransactionReceipt({ hash: p.hash }).catch(() => undefined)
    log('pending.resolved', { hash: p.hash, nonce: p.nonce, status: receipt?.status ?? 'nonce consumed by other tx' })
    if (receipt?.status === 'reverted') await alert('page', 'previous rebalance tx reverted', { hash: p.hash })
    state.pending = undefined
    saveState(state)
    return latestNonce
  }
  // Not yet mined. Private-orderflow txs can be dropped silently. After 10 min we
  // allow a new decision, but it reuses the SAME nonce — so at most one of the two
  // can ever land. We never double-trade.
  const ageMs = Date.now() - p.submittedAt
  if (ageMs < 10 * 60_000) throw new Abort(`previous tx ${p.hash} still pending (${Math.round(ageMs / 1000)}s)`, false)
  await alert('info', 'previous tx not mined after 10 min; next tx will reuse its nonce', { hash: p.hash })
  return p.nonce
}

export type ExecuteOptions = {
  dryRun?: boolean
  /** Override the KMS signer. For the fork test only; production leaves this unset. */
  account?: LocalAccount
}

export async function executeRebalance(
  decision: RebalanceDecision,
  opts: ExecuteOptions = {},
): Promise<RebalanceResult> {
  try {
    return await executeInner(decision, opts)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    const page = e instanceof Abort ? e.page : true // unexpected errors page
    await alert(page ? 'page' : 'info', `rebalance aborted: ${reason}`, {
      direction: decision.direction,
      amountIn: decision.amountIn,
      ...(e instanceof Abort ? e.data : {}),
    })
    return { status: 'aborted', reason }
  }
}

async function executeInner(decision: RebalanceDecision, opts: ExecuteOptions): Promise<RebalanceResult> {
  // 0. Local kill switch (the onchain kill switch is in DEPLOY.md).
  if (existsSync(config.haltFile) || process.env.HALT === '1') throw new Abort('HALT is set', false)

  const agent = opts.account ?? (await getAgent())
  await checkWiring(agent.address)
  const state = loadState()

  const [tokenIn, tokenOut, decIn, decOut] =
    decision.direction === 'WETH_TO_USDC'
      ? ([WETH, USDC, WETH_DECIMALS, USDC_DECIMALS] as const)
      : ([USDC, WETH, USDC_DECIMALS, WETH_DECIMALS] as const)
  const { amountIn } = decision
  if (amountIn <= 0n) throw new Abort('amountIn must be positive', true)

  // 1. Prices. Chainlink is the reference; USDC is assumed ≈ $1 and we check that.
  const [ethUsd, usdcUsd] = await Promise.all([
    readChainlink(CHAINLINK_ETH_USD, config.maxEthOracleAgeSec),
    readChainlink(CHAINLINK_USDC_USD, config.maxUsdcOracleAgeSec),
  ])
  if (usdcUsd < 99_000_000n || usdcUsd > 101_000_000n)
    throw new Abort(`USDC off peg per Chainlink: ${formatUnits(usdcUsd, 8)}`, true)

  // Oracle-implied output and USD size of the trade.
  const oracleOut =
    decision.direction === 'WETH_TO_USDC'
      ? (amountIn * ethUsd) / 10n ** 20n // wei * usd(1e8) / 1e(18+8-6) → USDC base units
      : (amountIn * 10n ** 20n) / ethUsd // USDC base units → wei
  const tradeUsd = Number(formatUnits(decision.direction === 'WETH_TO_USDC' ? oracleOut : amountIn, USDC_DECIMALS))

  // 2. Off-chain size limits (onchain role enforces its own, independently).
  if (tradeUsd < config.minTradeUsd) throw new Abort(`trade $${tradeUsd.toFixed(0)} below MIN_TRADE_USD`, false)
  if (tradeUsd > config.maxTradeUsd) throw new Abort(`trade $${tradeUsd.toFixed(0)} above MAX_TRADE_USD`, true)
  if (state.spentUsd + tradeUsd > config.dailyCapUsd)
    throw new Abort(`daily cap: $${state.spentUsd.toFixed(0)} spent, +$${tradeUsd.toFixed(0)} > $${config.dailyCapUsd}`, true)

  // 3. Treasury state: balance and the Safe's standing approval to the router.
  //    The agent's role cannot call approve(); if this is short, an owner tops it up.
  const [balance, routerAllowance, agentEth] = await Promise.all([
    publicClient.readContract({ address: tokenIn, abi: erc20Abi, functionName: 'balanceOf', args: [config.safe] }),
    publicClient.readContract({ address: tokenIn, abi: erc20Abi, functionName: 'allowance', args: [config.safe, SWAP_ROUTER_02] }),
    publicClient.getBalance({ address: agent.address }),
  ])
  if (balance < amountIn) throw new Abort(`Safe holds ${formatUnits(balance, decIn)}, need ${formatUnits(amountIn, decIn)}`, true)
  if (routerAllowance < amountIn)
    throw new Abort('Safe → SwapRouter02 allowance too low; owners must re-approve', true, { routerAllowance })
  if (Number(formatEther(agentEth)) < config.minAgentGasEth)
    await alert('page', `agent gas balance low: ${formatEther(agentEth)} ETH`, { agent: agent.address })

  // 4. Fresh quote from the pool we will trade against, checked against Chainlink.
  const { result: [quote] } = await publicClient.simulateContract({
    address: QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [{ tokenIn, tokenOut, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
  })
  const deviationBps = ((oracleOut - quote) * 10_000n) / oracleOut // positive = pool worse than oracle
  if (deviationBps > config.maxOracleDeviationBps || deviationBps < -config.maxOracleDeviationBps)
    throw new Abort(`pool quote deviates ${deviationBps} bps from Chainlink`, true, { quote, oracleOut })

  // minOut is anchored to both the live quote and the oracle; the tx can never
  // execute worse than this, no matter when it lands or who is in the block.
  const oracleFloor = (oracleOut * (10_000n - config.maxOracleDeviationBps - config.slippageBps)) / 10_000n
  const quoteFloor = (quote * (10_000n - config.slippageBps)) / 10_000n
  const minOut = quoteFloor > oracleFloor ? quoteFloor : oracleFloor

  // 5. Build calls: Safe → SwapRouter02.exactInputSingle, wrapped in Roles.execTransactionWithRole.
  const swapData = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        fee: POOL_FEE,
        recipient: config.safe, // the role rejects any other recipient
        amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  const rolesData = encodeFunctionData({
    abi: rolesAbi,
    functionName: 'execTransactionWithRole',
    args: [SWAP_ROUTER_02, 0n, swapData, 0 /* Call, never DelegateCall */, config.roleKey, true],
  })

  log('rebalance.prepared', {
    reason: decision.reason,
    direction: decision.direction,
    amountIn: formatUnits(amountIn, decIn),
    quote: formatUnits(quote, decOut),
    oracleOut: formatUnits(oracleOut, decOut),
    minOut: formatUnits(minOut, decOut),
    deviationBps,
    tradeUsd,
    ethUsd: formatUnits(ethUsd, 8),
  })

  // 6. Full simulation as the agent. Catches role violations, exhausted
  //    allowances, and minOut failures before we spend gas.
  try {
    await publicClient.call({ account: agent.address, to: config.roles, data: rolesData })
  } catch (e) {
    throw new Abort(`simulation reverted: ${(e as Error).message.split('\n')[0]}`, true)
  }
  if (opts.dryRun) return { status: 'simulated', minOut, quote }

  // 7. Gas, fees, nonce.
  const nonce = await reconcilePending(state, agent.address)
  const [gasEstimate, block, fees] = await Promise.all([
    publicClient.estimateGas({ account: agent.address, to: config.roles, data: rolesData }),
    publicClient.getBlock({ blockTag: 'latest' }),
    publicClient.estimateFeesPerGas(),
  ])
  const baseFee = block.baseFeePerGas ?? 0n
  const maxPriorityFeePerGas =
    fees.maxPriorityFeePerGas > config.minPriorityFee ? fees.maxPriorityFeePerGas : config.minPriorityFee
  const maxFeePerGas = 2n * baseFee + maxPriorityFeePerGas
  if (maxFeePerGas > config.maxFeePerGas)
    throw new Abort(`gas too expensive: ${formatUnits(maxFeePerGas, 9)} gwei > cap`, false)

  const tx: TransactionSerializable = {
    type: 'eip1559',
    chainId: mainnet.id,
    nonce,
    to: config.roles,
    data: rolesData,
    value: 0n,
    gas: (gasEstimate * 130n) / 100n,
    maxFeePerGas,
    maxPriorityFeePerGas,
  }

  // 8. Sign in KMS, submit via private orderflow.
  const signed = await agent.signTransaction(tx)
  const hash = keccak256(signed)
  state.pending = { hash, nonce, submittedAt: Date.now() }
  state.spentUsd += tradeUsd // count before sending: a lost receipt must not free up budget
  saveState(state)
  await submitClient.sendRawTransaction({ serializedTransaction: signed })
  log('rebalance.submitted', { hash, nonce, gas: tx.gas, maxFeeGwei: formatUnits(maxFeePerGas, 9) })

  // 9. Confirm and verify the outcome from the receipt's Transfer logs.
  let receipt
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: config.receiptTimeoutMs })
  } catch {
    await alert('info', 'rebalance tx not mined yet; will reconcile on next run', { hash })
    return { status: 'pending', hash }
  }
  state.pending = undefined
  saveState(state)

  if (receipt.status !== 'success') throw new Abort(`tx reverted onchain`, true, { hash })

  const amountOut = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs })
    .filter((l) => getAddress(l.address) === tokenOut && getAddress(l.args.to) === config.safe)
    .reduce((sum, l) => sum + l.args.value, 0n)
  const execDeviationBps = ((oracleOut - amountOut) * 10_000n) / oracleOut
  const gasCostEth = formatEther(receipt.gasUsed * receipt.effectiveGasPrice)

  const summary = {
    hash,
    block: receipt.blockNumber,
    direction: decision.direction,
    amountIn: formatUnits(amountIn, decIn),
    amountOut: formatUnits(amountOut, decOut),
    execDeviationBps,
    gasCostEth,
  }
  log('rebalance.executed', summary)
  if (amountOut < minOut || execDeviationBps > config.pageOnExecutionDeviationBps)
    await alert('page', 'rebalance executed at a bad price', summary)
  else await alert('info', 'rebalance executed', summary)

  return { status: 'executed', hash, amountOut }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI: npx tsx rebalance.ts <WETH_TO_USDC|USDC_TO_WETH> <amount> [--dry-run]
// ─────────────────────────────────────────────────────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [direction, amount] = process.argv.slice(2)
  if (direction !== 'WETH_TO_USDC' && direction !== 'USDC_TO_WETH' || !amount) {
    console.error('usage: tsx rebalance.ts <WETH_TO_USDC|USDC_TO_WETH> <amount> [--dry-run]')
    process.exit(2)
  }
  const amountIn = parseUnits(amount, direction === 'WETH_TO_USDC' ? WETH_DECIMALS : USDC_DECIMALS)
  const result = await executeRebalance(
    { direction, amountIn, reason: 'manual-cli' },
    { dryRun: process.argv.includes('--dry-run') },
  )
  console.log(JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
  process.exit(result.status === 'aborted' ? 1 : 0)
}
