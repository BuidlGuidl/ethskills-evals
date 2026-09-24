/**
 * rebalance.ts — execution path for the WETH/USDC treasury rebalancer.
 *
 * AUTHORITY MODEL (read DEPLOY.md before running this against real funds):
 *
 *   Treasury Safe  (holds the ~$400k in WETH + USDC; 2-of-3 owners on hardware devices)
 *        ▲  execTransactionFromModule
 *   Zodiac Roles Modifier v2  (enabled as a module on the Safe; owned by the Safe)
 *        ▲  execTransactionWithRole(...)       ← the only call this script ever makes
 *   Agent EOA  (this script's key; holds ONLY a small ETH gas float; NOT a Safe owner)
 *
 * The agent key can do exactly one thing: make the Safe call Uniswap V3
 * SwapRouter02.exactInputSingle on the WETH/USDC 0.05% pool, with the Safe as
 * recipient, within a per-token daily allowance enforced on-chain by the Roles
 * modifier. It cannot transfer tokens, approve spenders, change owners/modules,
 * or raise its own allowance. Those need 2 hardware signatures on the Safe.
 * Everything in THIS file (slippage, oracle checks, per-trade cap) is defence in
 * depth; the on-chain Roles policy is the actual security boundary.
 *
 * Contracts touched (Ethereum mainnet, chainId 1) — verified to have code:
 *   WETH9                        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 *   USDC (FiatTokenProxy)        0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   Uniswap V3 SwapRouter02      0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
 *   Uniswap V3 QuoterV2          0x61fFE014bA17989E743c5F6cB21bF9697530B21e  (eth_call only)
 *   Uniswap V3 USDC/WETH 0.05%   0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640  (implicit, via router)
 *   Chainlink ETH/USD            0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419  (read only)
 *   Chainlink USDC/USD           0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6  (read only)
 *   Treasury Safe                $SAFE_ADDRESS            (yours)
 *   Roles Modifier v2 proxy      $ROLES_MODIFIER_ADDRESS  (yours)
 *
 * Usage:
 *   npx tsx rebalance.ts preflight
 *   npx tsx rebalance.ts verify-policy                 # must pass before going live
 *   npx tsx rebalance.ts swap WETH_TO_USDC 4.5         # human-readable amountIn
 *   npx tsx rebalance.ts swap USDC_TO_WETH 20000
 *
 * Without AUTONOMOUS=1 every swap stops at a y/N prompt showing amount,
 * checksummed addresses and live gas cost. The signal engine imports
 * executeRebalance() and runs with AUTONOMOUS=1 only after the go-live checklist
 * in DEPLOY.md is complete.
 */

import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  isHex,
  keccak256,
  maxUint256,
  parseAbi,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

// ───────────────────────── constants ─────────────────────────

const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const SWAP_ROUTER_02: Address = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
const QUOTER_V2: Address = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const CHAINLINK_ETH_USD: Address = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
const CHAINLINK_USDC_USD: Address = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6'
const POOL_FEE = 500 // 0.05% tier — the Roles policy pins this exact value
const OPERATION_CALL = 0 // Safe Enum.Operation.Call; DelegateCall (1) is forbidden by policy

const DECIMALS = { WETH: 18, USDC: 6 } as const

// ───────────────────────── ABIs ─────────────────────────

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

const swapRouter02Abi = parseAbi([
  // IV3SwapRouter (SwapRouter02) — note: no deadline field, unlike the original SwapRouter
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

const rolesAbi = parseAbi([
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)',
  'function avatar() view returns (address)',
  'function target() view returns (address)',
  'function owner() view returns (address)',
  // Policy rejections. ConditionViolation.status indexes ROLES_STATUS below.
  'error ConditionViolation(uint8 status, bytes32 info)',
  'error NoMembership()',
  'error ModuleTransactionFailed()',
  'error NotAuthorized(address module)',
])

// PermissionChecker.Status in Zodiac Roles v2. An allowance breach inside the Or branch of our
// policy surfaces as OrViolation, not AllowanceExceeded.
const ROLES_STATUS = ['Ok', 'DelegateCallNotAllowed', 'TargetAddressNotAllowed', 'FunctionNotAllowed', 'SendNotAllowed',
  'OrViolation', 'NorViolation', 'ParameterNotAllowed', 'ParameterLessThanAllowed', 'ParameterGreaterThanAllowed',
  'ParameterNotAMatch', 'NotEveryArrayElementPasses', 'NoArrayElementPasses', 'ParameterNotSubsetOfAllowed',
  'BitmaskOverflow', 'BitmaskNotAllowed', 'CustomConditionViolation', 'AllowanceExceeded', 'CallAllowanceExceeded',
  'EtherAllowanceExceeded']

function explain(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError && reverted.data) {
      const { errorName, args } = reverted.data
      if (errorName === 'ConditionViolation') return `Roles policy rejected call: ${ROLES_STATUS[Number(args?.[0])] ?? args?.[0]}`
      return `reverted: ${errorName}(${(args ?? []).join(', ')})`
    }
    return err.shortMessage
  }
  return (err as Error).message
}

const safeAbi = parseAbi([
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function isModuleEnabled(address module) view returns (bool)',
  'function addOwnerWithThreshold(address owner, uint256 threshold)',
])

// ───────────────────────── config ─────────────────────────

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`missing required env var ${name}`)
  return v
}

function loadConfig() {
  const roleKey = env('ROLE_KEY')
  if (!isHex(roleKey) || roleKey.length !== 66) throw new Error('ROLE_KEY must be a 0x-prefixed bytes32')
  return {
    // Reads: your own/paid RPC. Writes: a private orderflow RPC so swaps never sit in the public mempool.
    rpcUrl: env('RPC_URL'),
    privateTxRpcUrl: env('PRIVATE_TX_RPC_URL', 'https://rpc.flashbots.net/fast'),
    safe: getAddress(env('SAFE_ADDRESS')),
    roles: getAddress(env('ROLES_MODIFIER_ADDRESS')),
    roleKey: roleKey as Hex,
    // Off-chain limits (defence in depth — the Roles allowance is the hard cap).
    maxTradeUsd: Number(env('MAX_TRADE_USD', '50000')),
    maxSlippageBps: BigInt(env('MAX_SLIPPAGE_BPS', '30')),
    // Chainlink ETH/USD has a 0.5% deviation threshold, so the oracle can lag the pool by
    // up to ~50 bps legitimately; 75 bps leaves room for that plus the 5 bps pool fee.
    maxOracleDeviationBps: BigInt(env('MAX_ORACLE_DEVIATION_BPS', '75')),
    oracleMaxAgeSec: BigInt(env('ORACLE_MAX_AGE_SEC', '3900')), // ETH/USD heartbeat 3600s
    usdcDepegBps: BigInt(env('USDC_DEPEG_BPS', '100')),
    maxFeeGwei: env('MAX_FEE_GWEI', '40'),
    minGasFloatEth: env('MIN_GAS_FLOAT_ETH', '0.02'),
    receiptTimeoutMs: Number(env('RECEIPT_TIMEOUT_MS', '300000')),
    stateFile: env('STATE_FILE', './.rebalance-state.json'),
    lockFile: env('LOCK_FILE', './.rebalance.lock'),
    autonomous: process.env.AUTONOMOUS === '1',
  }
}

type Config = ReturnType<typeof loadConfig>

function loadAgent() {
  // Injected at process start by your secret manager (see DEPLOY.md). Never in the repo,
  // never in a .env that gets committed, never pasted into a chat, ticket, or prompt.
  const pk = env('AGENT_PRIVATE_KEY')
  if (!isHex(pk) || pk.length !== 66) throw new Error('AGENT_PRIVATE_KEY is not a 32-byte hex key')
  return privateKeyToAccount(pk as Hex)
}

function clients(cfg: Config) {
  const publicClient = createPublicClient({ chain: mainnet, transport: http(cfg.rpcUrl) })
  // Used ONLY for eth_sendRawTransaction. Everything is signed locally.
  const privateTx = createWalletClient({ chain: mainnet, transport: http(cfg.privateTxRpcUrl) })
  return { publicClient, privateTx }
}

type PublicClient = ReturnType<typeof clients>['publicClient']

// ───────────────────────── types ─────────────────────────

export type Direction = 'WETH_TO_USDC' | 'USDC_TO_WETH'

export interface RebalanceDecision {
  direction: Direction
  /** amountIn in token base units (wei for WETH, 1e-6 for USDC) */
  amountIn: bigint
  /** free-form id from the signal engine, logged with the tx for reconciliation */
  signalId?: string
}

export interface RebalanceResult {
  status: 'executed' | 'aborted' | 'declined'
  reason?: string
  txHash?: Hex
  amountIn?: bigint
  amountOut?: bigint
}

function legs(direction: Direction) {
  return direction === 'WETH_TO_USDC'
    ? { tokenIn: WETH, tokenOut: USDC, symIn: 'WETH', symOut: 'USDC' } as const
    : { tokenIn: USDC, tokenOut: WETH, symIn: 'USDC', symOut: 'WETH' } as const
}

function log(event: string, data: Record<string, unknown> = {}) {
  // One JSON line per event → ship to your log store; the monitor reconciles against it.
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }, (_k, v) =>
    typeof v === 'bigint' ? v.toString() : v))
}

// ───────────────────────── oracle ─────────────────────────

async function readFeed(pc: PublicClient, feed: Address, maxAge: bigint): Promise<bigint> {
  const [[, answer, , updatedAt], block] = await Promise.all([
    pc.readContract({ address: feed, abi: chainlinkAbi, functionName: 'latestRoundData' }),
    pc.getBlock({ blockTag: 'latest' }),
  ])
  const now = block.timestamp // chain time, not the VM clock
  if (answer <= 0n) throw new Error(`oracle ${feed} returned non-positive answer`)
  if (now - updatedAt > maxAge) throw new Error(`oracle ${feed} stale: updated ${now - updatedAt}s ago`)
  return answer // both feeds use 8 decimals
}

async function readPrices(pc: PublicClient, cfg: Config) {
  const [ethUsd, usdcUsd] = await Promise.all([
    readFeed(pc, CHAINLINK_ETH_USD, cfg.oracleMaxAgeSec),
    // USDC/USD heartbeat is 24h
    readFeed(pc, CHAINLINK_USDC_USD, 90_000n),
  ])
  const depeg = usdcUsd > 100_000_000n ? usdcUsd - 100_000_000n : 100_000_000n - usdcUsd
  if (depeg * 10_000n > cfg.usdcDepegBps * 100_000_000n) {
    throw new Error(`USDC off peg: ${formatUnits(usdcUsd, 8)} USD — refusing to trade`)
  }
  return { ethUsd, usdcUsd }
}

/** Expected amountOut at oracle prices, no fees. */
function oracleAmountOut(direction: Direction, amountIn: bigint, p: { ethUsd: bigint; usdcUsd: bigint }) {
  return direction === 'WETH_TO_USDC'
    ? (amountIn * p.ethUsd) / p.usdcUsd / 10n ** 12n // 18 → 6 decimals
    : (amountIn * p.usdcUsd * 10n ** 12n) / p.ethUsd // 6 → 18 decimals
}

function notionalUsd(direction: Direction, amountIn: bigint, p: { ethUsd: bigint; usdcUsd: bigint }): number {
  const usd8 = direction === 'WETH_TO_USDC' ? (amountIn * p.ethUsd) / 10n ** 18n : (amountIn * p.usdcUsd) / 10n ** 6n
  return Number(formatUnits(usd8, 8))
}

// ───────────────────────── preflight ─────────────────────────

async function preflight(pc: PublicClient, cfg: Config, agent: Address) {
  const chainId = await pc.getChainId()
  if (chainId !== 1) throw new Error(`RPC_URL is chainId ${chainId}, expected 1 (mainnet)`)

  const [owners, threshold, moduleEnabled, rolesAvatar, rolesTarget, rolesOwner, gasFloat] = await Promise.all([
    pc.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'getOwners' }),
    pc.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'getThreshold' }),
    pc.readContract({ address: cfg.safe, abi: safeAbi, functionName: 'isModuleEnabled', args: [cfg.roles] }),
    pc.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'avatar' }),
    pc.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'target' }),
    pc.readContract({ address: cfg.roles, abi: rolesAbi, functionName: 'owner' }),
    pc.getBalance({ address: agent }),
  ])

  // Refuse to run if the authority model in DEPLOY.md is not what is on-chain.
  if (owners.some((o) => getAddress(o) === agent)) throw new Error('agent key is a Safe owner — its authority is not bounded; refusing')
  if (threshold < 2n) throw new Error(`Safe threshold is ${threshold}; must be >= 2`)
  if (!moduleEnabled) throw new Error('Roles modifier is not enabled as a module on the Safe')
  if (getAddress(rolesAvatar) !== cfg.safe || getAddress(rolesTarget) !== cfg.safe) throw new Error('Roles avatar/target is not the treasury Safe')
  if (getAddress(rolesOwner) !== cfg.safe) throw new Error('Roles owner is not the Safe — someone else can rewrite the policy')
  if (gasFloat < parseUnits(cfg.minGasFloatEth, 18)) throw new Error(`agent gas float low: ${formatUnits(gasFloat, 18)} ETH`)

  return { owners, threshold, gasFloat }
}

// ─────────────── in-flight tx tracking (private mempool is invisible to public RPCs) ───────────────

interface InFlight { hash: Hex; nonce: number; sentAt: number }

async function checkInFlight(pc: PublicClient, cfg: Config, agent: Address) {
  if (!existsSync(cfg.stateFile)) return
  const prev = JSON.parse(readFileSync(cfg.stateFile, 'utf8')) as InFlight
  const minedNonce = await pc.getTransactionCount({ address: agent, blockTag: 'latest' })
  if (minedNonce > prev.nonce) {
    const receipt = await pc.getTransactionReceipt({ hash: prev.hash }).catch(() => null)
    log('inflight.resolved', { hash: prev.hash, status: receipt?.status ?? 'replaced-or-unknown' })
    unlinkSync(cfg.stateFile)
    return
  }
  // Still unmined. Flashbots Protect drops txs it cannot land within ~25 blocks.
  // Until then, don't stack decisions on top of an unknown outcome. After that, the next
  // tx reuses the same nonce, so at most one of the two can ever execute.
  if (Date.now() - prev.sentAt < 6 * 60_000) throw new Error(`previous tx ${prev.hash} (nonce ${prev.nonce}) still unresolved`)
  log('inflight.expired', { hash: prev.hash, nonce: prev.nonce })
  unlinkSync(cfg.stateFile)
}

// ───────────────────────── the execution path ─────────────────────────

export async function executeRebalance(decision: RebalanceDecision): Promise<RebalanceResult> {
  const cfg = loadConfig()
  const account = loadAgent()
  const { publicClient: pc, privateTx } = clients(cfg)
  const { tokenIn, tokenOut, symIn, symOut } = legs(decision.direction)
  const { amountIn } = decision

  // Single-writer lock: two processes must never sign from the same nonce stream.
  let lockFd: number
  try { lockFd = openSync(cfg.lockFile, 'wx') } catch { return { status: 'aborted', reason: `lock held: ${cfg.lockFile}` } }

  try {
    if (amountIn <= 0n) return { status: 'aborted', reason: 'amountIn must be > 0' }

    // 1. On-chain state matches the intended authority model.
    await preflight(pc, cfg, account.address)
    await checkInFlight(pc, cfg, account.address)

    // 2. Independent price reference.
    const prices = await readPrices(pc, cfg)
    const usd = notionalUsd(decision.direction, amountIn, prices)
    if (usd > cfg.maxTradeUsd) return { status: 'aborted', reason: `notional $${usd.toFixed(0)} > MAX_TRADE_USD` }

    // 3. The Safe actually holds what we're about to sell, and has approved the router.
    const [balIn, balOutBefore, routerAllowance] = await Promise.all([
      pc.readContract({ address: tokenIn, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] }),
      pc.readContract({ address: tokenOut, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe] }),
      pc.readContract({ address: tokenIn, abi: erc20Abi, functionName: 'allowance', args: [cfg.safe, SWAP_ROUTER_02] }),
    ])
    if (balIn < amountIn) return { status: 'aborted', reason: `Safe ${symIn} balance ${balIn} < amountIn ${amountIn}` }
    if (routerAllowance < amountIn) return { status: 'aborted', reason: `Safe has not approved SwapRouter02 for ${symIn} (owners must do this)` }

    // 4. Quote from the pool, sanity-checked against Chainlink.
    const { result: [quoteOut] } = await pc.simulateContract({
      address: QUOTER_V2, abi: quoterV2Abi, functionName: 'quoteExactInputSingle',
      args: [{ tokenIn, tokenOut, amountIn, fee: POOL_FEE, sqrtPriceLimitX96: 0n }],
    })
    const oracleOut = oracleAmountOut(decision.direction, amountIn, prices)
    if (quoteOut * 10_000n < oracleOut * (10_000n - cfg.maxOracleDeviationBps)) {
      return { status: 'aborted', reason: `pool quote ${quoteOut} is >${cfg.maxOracleDeviationBps}bps below oracle ${oracleOut}` }
    }
    const reference = quoteOut < oracleOut ? quoteOut : oracleOut
    const amountOutMinimum = (reference * (10_000n - cfg.maxSlippageBps)) / 10_000n

    // 5. Inner call: Safe → SwapRouter02.exactInputSingle, proceeds back to the Safe.
    const swapData = encodeFunctionData({
      abi: swapRouter02Abi, functionName: 'exactInputSingle',
      args: [{ tokenIn, tokenOut, fee: POOL_FEE, recipient: cfg.safe, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }],
    })

    // 6. Outer call: agent EOA → Roles.execTransactionWithRole. shouldRevert=true so a failed
    //    inner swap reverts the whole tx instead of "succeeding" with success=false.
    const rolesArgs = [SWAP_ROUTER_02, 0n, swapData, OPERATION_CALL, cfg.roleKey, true] as const

    // 7. Simulate as the agent. This is where the on-chain policy speaks: wrong target,
    //    wrong recipient, or exhausted allowance all revert here, before anything is signed.
    await pc.simulateContract({ account: account.address, address: cfg.roles, abi: rolesAbi, functionName: 'execTransactionWithRole', args: rolesArgs })
    const outerData = encodeFunctionData({ abi: rolesAbi, functionName: 'execTransactionWithRole', args: rolesArgs })

    // 8. Gas, priced live.
    const [gasEstimate, fees, nonce] = await Promise.all([
      pc.estimateGas({ account: account.address, to: cfg.roles, data: outerData, value: 0n }),
      pc.estimateFeesPerGas(),
      pc.getTransactionCount({ address: account.address, blockTag: 'latest' }),
    ])
    const gas = (gasEstimate * 13n) / 10n
    const maxFeeCap = parseUnits(cfg.maxFeeGwei, 9)
    if (fees.maxFeePerGas > maxFeeCap) return { status: 'aborted', reason: `maxFeePerGas ${formatUnits(fees.maxFeePerGas, 9)} gwei > cap ${cfg.maxFeeGwei}` }
    const maxGasCostWei = gas * fees.maxFeePerGas
    const maxGasCostUsd = Number(formatUnits((maxGasCostWei * prices.ethUsd) / 10n ** 18n, 8))

    // 9. The gate. Amount, checksummed destinations, live gas cost.
    const summary = {
      signalId: decision.signalId,
      sell: `${formatUnits(amountIn, DECIMALS[symIn])} ${symIn} (~$${usd.toFixed(0)})`,
      minReceive: `${formatUnits(amountOutMinimum, DECIMALS[symOut])} ${symOut}`,
      quoted: `${formatUnits(quoteOut, DECIMALS[symOut])} ${symOut}`,
      oracle: `${formatUnits(oracleOut, DECIMALS[symOut])} ${symOut}`,
      signer: account.address,
      txTo_RolesModifier: getAddress(cfg.roles),
      innerTarget_SwapRouter02: getAddress(SWAP_ROUTER_02),
      proceedsRecipient_Safe: getAddress(cfg.safe),
      nonce,
      gasLimit: gas,
      maxFeeGwei: formatUnits(fees.maxFeePerGas, 9),
      maxGasCost: `${formatUnits(maxGasCostWei, 18)} ETH (~$${maxGasCostUsd.toFixed(2)})`,
    }
    log('rebalance.ready', summary)

    if (!cfg.autonomous) {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = await rl.question('Sign and submit this transaction? [y/N] ')
      rl.close()
      if (answer.trim().toLowerCase() !== 'y') return { status: 'declined' }
    }

    // 10. Sign locally, submit privately.
    const serialized = await account.signTransaction({
      chainId: mainnet.id, type: 'eip1559', to: cfg.roles, data: outerData, value: 0n,
      gas, nonce, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    })
    const hash = keccak256(serialized)
    writeFileSync(cfg.stateFile, JSON.stringify({ hash, nonce, sentAt: Date.now() } satisfies InFlight))
    await privateTx.sendRawTransaction({ serializedTransaction: serialized })
    log('rebalance.submitted', { hash, nonce, signalId: decision.signalId })

    // 11. Wait, then verify the effect on the Safe rather than trusting the receipt alone.
    const receipt = await pc.waitForTransactionReceipt({ hash, timeout: cfg.receiptTimeoutMs })
    unlinkSync(cfg.stateFile)
    if (receipt.status !== 'success') {
      log('rebalance.reverted', { hash, block: receipt.blockNumber })
      return { status: 'aborted', reason: 'transaction reverted', txHash: hash }
    }
    const balOutAfter = await pc.readContract({ address: tokenOut, abi: erc20Abi, functionName: 'balanceOf', args: [cfg.safe], blockNumber: receipt.blockNumber })
    const received = balOutAfter - balOutBefore
    log('rebalance.executed', {
      hash, block: receipt.blockNumber, signalId: decision.signalId,
      amountIn, received, amountOutMinimum,
      gasUsed: receipt.gasUsed, effectiveGasPrice: receipt.effectiveGasPrice,
    })
    if (received < amountOutMinimum) log('ALERT.received_below_min', { hash, received, amountOutMinimum })
    return { status: 'executed', txHash: hash, amountIn, amountOut: received }
  } catch (err) {
    const reason = explain(err)
    log('rebalance.error', { error: reason })
    return { status: 'aborted', reason }
  } finally {
    closeSync(lockFd)
    unlinkSync(cfg.lockFile)
  }
}

// ───────────────────────── policy verification ─────────────────────────

/**
 * Simulates, from the agent's address, calls the Roles policy MUST reject, plus ones it must
 * allow. eth_call only — nothing is signed or sent. Run after every policy change.
 *
 * Uses shouldRevert=false: Roles still reverts when the *policy* rejects a call, but not when
 * the inner call fails. So "reverted" here means "the policy said no", independent of whether
 * the Safe is funded or has approved the router yet.
 */
export async function verifyPolicy(): Promise<boolean> {
  const cfg = loadConfig()
  const agent = loadAgent().address
  const { publicClient: pc } = clients(cfg)
  await preflight(pc, cfg, agent)

  const swap = (o: Partial<{ tokenIn: Address; tokenOut: Address; fee: number; recipient: Address; amountIn: bigint }>) =>
    encodeFunctionData({
      abi: swapRouter02Abi, functionName: 'exactInputSingle',
      args: [{ tokenIn: WETH, tokenOut: USDC, fee: POOL_FEE, recipient: cfg.safe, amountIn: parseUnits('0.01', 18), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n, ...o }],
    })
  const usdcToWeth = { tokenIn: USDC, tokenOut: WETH }

  const cases: { name: string; to: Address; data: Hex; op?: number; expect: 'allow' | 'deny' }[] = [
    { name: 'small WETH→USDC swap to Safe', to: SWAP_ROUTER_02, data: swap({}), expect: 'allow' },
    { name: 'small USDC→WETH swap to Safe', to: SWAP_ROUTER_02, data: swap({ ...usdcToWeth, amountIn: parseUnits('10', 6) }), expect: 'allow' },
    { name: 'swap with recipient = agent', to: SWAP_ROUTER_02, data: swap({ recipient: agent }), expect: 'deny' },
    { name: 'swap on 0.3% fee tier', to: SWAP_ROUTER_02, data: swap({ fee: 3000 }), expect: 'deny' },
    { name: 'swap WETH→WETH', to: SWAP_ROUTER_02, data: swap({ tokenOut: WETH }), expect: 'deny' },
    { name: 'swap WETH→(other token)', to: SWAP_ROUTER_02, data: swap({ tokenOut: CHAINLINK_ETH_USD }), expect: 'deny' },
    { name: 'swap 10,000 WETH (above WETH allowance)', to: SWAP_ROUTER_02, data: swap({ amountIn: parseUnits('10000', 18) }), expect: 'deny' },
    { name: 'swap 10M USDC (above USDC allowance)', to: SWAP_ROUTER_02, data: swap({ ...usdcToWeth, amountIn: parseUnits('10000000', 6) }), expect: 'deny' },
    { name: 'swap via DelegateCall', to: SWAP_ROUTER_02, data: swap({}), op: 1, expect: 'deny' },
    { name: 'WETH.transfer to agent', to: WETH, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [agent, 1n] }), expect: 'deny' },
    { name: 'USDC.transfer to agent', to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [agent, 1n] }), expect: 'deny' },
    { name: 'USDC.approve agent', to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [agent, maxUint256] }), expect: 'deny' },
    { name: 'Safe.addOwnerWithThreshold(agent, 1)', to: cfg.safe, data: encodeFunctionData({ abi: safeAbi, functionName: 'addOwnerWithThreshold', args: [agent, 1n] }), expect: 'deny' },
  ]

  let ok = true
  for (const c of cases) {
    let allowed: boolean
    try {
      await pc.simulateContract({
        account: agent, address: cfg.roles, abi: rolesAbi, functionName: 'execTransactionWithRole',
        args: [c.to, 0n, c.data, c.op ?? OPERATION_CALL, cfg.roleKey, false],
      })
      allowed = true
    } catch { allowed = false }
    const pass = (c.expect === 'allow') === allowed
    ok &&= pass
    console.log(`${pass ? 'PASS' : 'FAIL'}  expect ${c.expect.padEnd(5)}  ${c.name}`)
  }
  console.log(ok ? '\nPolicy OK.' : '\nPOLICY IS NOT SAFE. Do not run autonomously.')
  return ok
}

// ───────────────────────── CLI ─────────────────────────

async function main() {
  const [cmd, dir, amount] = process.argv.slice(2)
  if (cmd === 'preflight') {
    const cfg = loadConfig()
    const agent = loadAgent().address
    const r = await preflight(clients(cfg).publicClient, cfg, agent)
    log('preflight.ok', { agent, safe: cfg.safe, roles: cfg.roles, ...r })
  } else if (cmd === 'verify-policy') {
    process.exitCode = (await verifyPolicy()) ? 0 : 1
  } else if (cmd === 'swap' && (dir === 'WETH_TO_USDC' || dir === 'USDC_TO_WETH') && amount) {
    const amountIn = parseUnits(amount, dir === 'WETH_TO_USDC' ? DECIMALS.WETH : DECIMALS.USDC)
    const r = await executeRebalance({ direction: dir, amountIn, signalId: 'cli' })
    log('result', { ...r })
    process.exitCode = r.status === 'executed' ? 0 : 1
  } else {
    console.error('usage: rebalance.ts preflight | verify-policy | swap <WETH_TO_USDC|USDC_TO_WETH> <amount>')
    process.exitCode = 2
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
