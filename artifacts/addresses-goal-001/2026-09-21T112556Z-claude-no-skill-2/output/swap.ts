/**
 * USDC -> WETH on Base mainnet, split across on-chain venues for best execution.
 *
 * Flow:
 *   1. Safety checks: chain id, contract code, Base sequencer up, Chainlink ETH/USD fresh.
 *   2. Quote every USDC/WETH pool on Uniswap v3 + Aerodrome (Slipstream CL + classic).
 *   3. Greedy split: hand out the order in slices, each slice to the venue with the
 *      best *marginal* output. Big orders end up spread over the deepest pools.
 *   4. Reject the plan if total output is worse than Chainlink by > MAX_ORACLE_DEVIATION_BPS.
 *   5. (EXECUTE=true only) exact approvals, then one swap tx per leg, each with
 *      amountOutMinimum = planned quote - MAX_SLIPPAGE_BPS and a short deadline.
 *
 * Run:
 *   RPC_URL=... AMOUNT_USDC=250000 npx tsx swap.ts                       # dry run (quote only)
 *   RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 EXECUTE=true npx tsx swap.ts
 */
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

// ---------- Addresses (Base mainnet, chain id 8453) ----------

const USDC: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // native Circle USDC (not USDbC)
const WETH: Address = '0x4200000000000000000000000000000000000006'

// Uniswap v3
const UNI_V3_SWAP_ROUTER02: Address = '0x2626664c2603336E57B271c5C0b26F421741e481'
const UNI_V3_QUOTER_V2: Address = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a'
const UNI_V3_FEES = [100, 500, 3000, 10000] as const

// Aerodrome Slipstream (concentrated liquidity)
const AERO_CL_SWAP_ROUTER: Address = '0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5'
const AERO_CL_QUOTER: Address = '0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0'
const AERO_CL_TICK_SPACINGS = [1, 10, 50, 100, 200] as const

// Aerodrome classic (volatile x*y=k pool)
const AERO_ROUTER: Address = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'
const AERO_POOL_FACTORY: Address = '0x420DD381b31aEf6683db6B902084cB0FFECe40Da'

// Chainlink
const CL_ETH_USD: Address = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'
const CL_SEQUENCER_UPTIME: Address = '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433'

// ---------- ABIs (only what we call) ----------

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

// Quoters are non-view (they revert internally), but work via eth_call.
// Declared `view` here so viem lets us batch them through Multicall3.
const uniQuoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const aeroClQuoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, int24 tickSpacing, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const aeroRouterAbi = parseAbi([
  'struct Route { address from; address to; bool stable; address factory; }',
  'function getAmountsOut(uint256 amountIn, Route[] routes) view returns (uint256[] amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, Route[] routes, address to, uint256 deadline) returns (uint256[] amounts)',
])

const uniRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
])
const aeroClRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
])

const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
])

// ---------- Config ----------

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`missing env ${name}`)
  return v
}

const RPC_URL = env('RPC_URL')
const AMOUNT_IN = parseUnits(env('AMOUNT_USDC'), 6)
const MAX_SLIPPAGE_BPS = BigInt(env('MAX_SLIPPAGE_BPS', '30')) // per leg, vs. planned quote
const MAX_ORACLE_DEVIATION_BPS = BigInt(env('MAX_ORACLE_DEVIATION_BPS', '75')) // total, vs. Chainlink (fees + impact)
const SPLITS = BigInt(env('SPLITS', '20')) // granularity of the venue split
const DEADLINE_SECS = BigInt(env('DEADLINE_SECS', '120'))
const ORACLE_MAX_AGE_SECS = BigInt(env('ORACLE_MAX_AGE_SECS', '3600'))
const EXECUTE = env('EXECUTE', 'false') === 'true'

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })

// ---------- Venues ----------

type Venue =
  | { kind: 'uniV3'; name: string; fee: number; router: Address }
  | { kind: 'aeroCL'; name: string; tickSpacing: number; router: Address }
  | { kind: 'aeroV2'; name: string; router: Address }

const ALL_VENUES: Venue[] = [
  ...UNI_V3_FEES.map((fee): Venue => ({ kind: 'uniV3', name: `UniV3 ${fee / 1e4}%`, fee, router: UNI_V3_SWAP_ROUTER02 })),
  ...AERO_CL_TICK_SPACINGS.map((ts): Venue => ({ kind: 'aeroCL', name: `Aero CL ts=${ts}`, tickSpacing: ts, router: AERO_CL_SWAP_ROUTER })),
  { kind: 'aeroV2', name: 'Aero vAMM', router: AERO_ROUTER },
]

const aeroRoute = [{ from: USDC, to: WETH, stable: false, factory: AERO_POOL_FACTORY }] as const

function quoteCall(v: Venue, amountIn: bigint) {
  switch (v.kind) {
    case 'uniV3':
      return {
        address: UNI_V3_QUOTER_V2, abi: uniQuoterAbi, functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: v.fee, sqrtPriceLimitX96: 0n }],
      } as const
    case 'aeroCL':
      return {
        address: AERO_CL_QUOTER, abi: aeroClQuoterAbi, functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: v.tickSpacing, sqrtPriceLimitX96: 0n }],
      } as const
    case 'aeroV2':
      return {
        address: AERO_ROUTER, abi: aeroRouterAbi, functionName: 'getAmountsOut',
        args: [amountIn, aeroRoute],
      } as const
  }
}

function parseQuote(v: Venue, result: unknown): bigint {
  if (v.kind === 'aeroV2') return (result as readonly bigint[])[1]
  return (result as readonly [bigint, ...unknown[]])[0]
}

/** Quote many (venue, amount) pairs in one Multicall3 round trip. Failed quotes (no pool / no liquidity) -> 0. */
async function quoteMany(reqs: { v: Venue; amountIn: bigint }[]): Promise<bigint[]> {
  const res = await publicClient.multicall({
    contracts: reqs.map((r) => quoteCall(r.v, r.amountIn)),
    allowFailure: true,
  })
  return res.map((r, i) => (r.status === 'success' ? parseQuote(reqs[i].v, r.result) : 0n))
}

// ---------- Split planner ----------

type Leg = { v: Venue; amountIn: bigint; quotedOut: bigint }

/**
 * Greedy split: the order is cut into SPLITS slices; each slice goes to the venue whose
 * output grows the most by taking it. Output curves are concave (price impact), so this
 * converges on a near-optimal spread across pools.
 */
async function planSplit(amountIn: bigint): Promise<Leg[]> {
  const slice = amountIn / SPLITS
  // Drop venues that can't even fill one slice at a sane price.
  const probe = await quoteMany(ALL_VENUES.map((v) => ({ v, amountIn: slice })))
  const bestProbe = probe.reduce((a, b) => (b > a ? b : a), 0n)
  if (bestProbe === 0n) throw new Error('no venue returned a quote')
  const venues = ALL_VENUES.filter((_, i) => probe[i] * 100n >= bestProbe * 98n)

  const alloc = venues.map(() => 0n)
  const out = venues.map(() => 0n)
  let remaining = amountIn
  while (remaining > 0n) {
    const step = remaining < 2n * slice ? remaining : slice // last step takes the dust
    const next = await quoteMany(venues.map((v, i) => ({ v, amountIn: alloc[i] + step })))
    let best = -1
    let bestGain = 0n
    next.forEach((q, i) => {
      const gain = q - out[i]
      if (q > 0n && gain > bestGain) { best = i; bestGain = gain }
    })
    if (best < 0) throw new Error('not enough liquidity to fill order')
    alloc[best] += step
    out[best] = next[best]
    remaining -= step
  }
  return venues
    .map((v, i) => ({ v, amountIn: alloc[i], quotedOut: out[i] }))
    .filter((l) => l.amountIn > 0n)
    .sort((a, b) => (b.amountIn > a.amountIn ? 1 : -1))
}

// ---------- Safety checks ----------

async function checkEnvironment() {
  const chainId = await publicClient.getChainId()
  if (chainId !== base.id) throw new Error(`wrong chain ${chainId}, expected Base (8453)`)

  for (const a of [USDC, WETH, UNI_V3_SWAP_ROUTER02, UNI_V3_QUOTER_V2, AERO_CL_SWAP_ROUTER, AERO_CL_QUOTER, AERO_ROUTER, CL_ETH_USD, CL_SEQUENCER_UPTIME]) {
    const code = await publicClient.getCode({ address: a })
    if (!code || code === '0x') throw new Error(`no contract at ${a}`)
  }

  // Sequencer down / just restarted -> prices and oracle are unreliable.
  const [, seqStatus, seqStartedAt] = await publicClient.readContract({ address: CL_SEQUENCER_UPTIME, abi: chainlinkAbi, functionName: 'latestRoundData' })
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (seqStatus !== 0n) throw new Error('Base sequencer reported DOWN')
  if (now - seqStartedAt < 3600n) throw new Error('sequencer restarted < 1h ago, waiting out grace period')
}

/** Chainlink ETH/USD -> expected WETH (18 dp) for `usdcIn` (6 dp) at oracle price, no fees. */
async function oracleWethFor(usdcIn: bigint): Promise<{ wethOut: bigint; price: bigint }> {
  const [, answer, , updatedAt] = await publicClient.readContract({ address: CL_ETH_USD, abi: chainlinkAbi, functionName: 'latestRoundData' })
  const decimals = await publicClient.readContract({ address: CL_ETH_USD, abi: chainlinkAbi, functionName: 'decimals' })
  const age = BigInt(Math.floor(Date.now() / 1000)) - updatedAt
  if (answer <= 0n) throw new Error('bad oracle answer')
  if (age > ORACLE_MAX_AGE_SECS) throw new Error(`oracle stale: ${age}s old`)
  // usdc(6) * 1e12 -> 18 dp USD; / (answer / 10^decimals) -> WETH 18 dp
  return { wethOut: (usdcIn * 10n ** 12n * 10n ** BigInt(decimals)) / answer, price: answer / 10n ** BigInt(decimals) }
}

const bps = (x: bigint, b: bigint) => (x * (10_000n - b)) / 10_000n
const fmtUsdc = (x: bigint) => Number(formatUnits(x, 6)).toLocaleString()
const fmtWeth = (x: bigint) => formatUnits(x, 18)

// ---------- Execution ----------

function buildSwapTx(leg: Leg, recipient: Address, minOut: bigint, deadline: bigint): { to: Address; data: Hex } {
  const { v, amountIn } = leg
  switch (v.kind) {
    case 'uniV3': {
      // SwapRouter02's struct has no deadline -> wrap in multicall(deadline, ...)
      const inner = encodeFunctionData({
        abi: uniRouterAbi, functionName: 'exactInputSingle',
        args: [{ tokenIn: USDC, tokenOut: WETH, fee: v.fee, recipient, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
      })
      return { to: v.router, data: encodeFunctionData({ abi: uniRouterAbi, functionName: 'multicall', args: [deadline, [inner]] }) }
    }
    case 'aeroCL':
      return {
        to: v.router,
        data: encodeFunctionData({
          abi: aeroClRouterAbi, functionName: 'exactInputSingle',
          args: [{ tokenIn: USDC, tokenOut: WETH, tickSpacing: v.tickSpacing, recipient, deadline, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
        }),
      }
    case 'aeroV2':
      return {
        to: v.router,
        data: encodeFunctionData({ abi: aeroRouterAbi, functionName: 'swapExactTokensForTokens', args: [amountIn, minOut, aeroRoute, recipient, deadline] }),
      }
  }
}

async function main() {
  await checkEnvironment()

  const legs = await planSplit(AMOUNT_IN)
  const totalOut = legs.reduce((s, l) => s + l.quotedOut, 0n)
  const oracle = await oracleWethFor(AMOUNT_IN)
  const deviationBps = ((oracle.wethOut - totalOut) * 10_000n) / oracle.wethOut

  console.log(`\nSwap ${fmtUsdc(AMOUNT_IN)} USDC -> WETH   (Chainlink ETH/USD ≈ $${oracle.price})`)
  for (const l of legs) {
    const px = Number(formatUnits(l.amountIn, 6)) / Number(fmtWeth(l.quotedOut))
    console.log(`  ${l.v.name.padEnd(16)} ${fmtUsdc(l.amountIn).padStart(12)} USDC -> ${fmtWeth(l.quotedOut)} WETH  @ $${px.toFixed(2)}`)
  }
  console.log(`  total out ${fmtWeth(totalOut)} WETH, oracle ${fmtWeth(oracle.wethOut)} WETH, cost vs oracle ${deviationBps} bps`)

  if (deviationBps > MAX_ORACLE_DEVIATION_BPS) {
    throw new Error(`execution cost ${deviationBps} bps > limit ${MAX_ORACLE_DEVIATION_BPS} bps; reduce size or split over time`)
  }
  if (!EXECUTE) {
    console.log('\nDry run. Set EXECUTE=true to send transactions.')
    return
  }

  const account = privateKeyToAccount(env('PRIVATE_KEY') as Hex)
  const recipient = getAddress(env('RECIPIENT', account.address))
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC_URL) })

  const usdcBal = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
  if (usdcBal < AMOUNT_IN) throw new Error(`USDC balance ${fmtUsdc(usdcBal)} < ${fmtUsdc(AMOUNT_IN)}`)
  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] })

  // Exact approvals per router (never unlimited).
  const needByRouter = new Map<Address, bigint>()
  for (const l of legs) needByRouter.set(l.v.router, (needByRouter.get(l.v.router) ?? 0n) + l.amountIn)
  for (const [router, need] of needByRouter) {
    const current = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'allowance', args: [account.address, router] })
    if (current >= need) continue
    const hash = await wallet.writeContract({ address: USDC, abi: erc20Abi, functionName: 'approve', args: [router, need] })
    const r = await publicClient.waitForTransactionReceipt({ hash })
    if (r.status !== 'success') throw new Error(`approve ${router} failed: ${hash}`)
    console.log(`approved ${fmtUsdc(need)} USDC to ${router}  ${hash}`)
  }

  // One tx per leg. minOut is anchored to the plan, so later legs can't drift further.
  for (const leg of legs) {
    const minOut = bps(leg.quotedOut, MAX_SLIPPAGE_BPS)
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECS
    const tx = buildSwapTx(leg, recipient, minOut, deadline)

    // Fail fast before paying gas: dry-run the exact calldata.
    await publicClient.call({ account: account.address, to: tx.to, data: tx.data })
    const gas = await publicClient.estimateGas({ account: account.address, to: tx.to, data: tx.data })

    const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, gas: (gas * 12n) / 10n })
    const r = await publicClient.waitForTransactionReceipt({ hash })
    if (r.status !== 'success') throw new Error(`leg ${leg.v.name} reverted: ${hash}`)
    console.log(`swapped ${fmtUsdc(leg.amountIn)} USDC on ${leg.v.name} (min ${fmtWeth(minOut)} WETH)  ${hash}`)
  }

  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] })
  const got = wethAfter - wethBefore
  console.log(`\nreceived ${fmtWeth(got)} WETH (quoted ${fmtWeth(totalOut)}), avg price $${(Number(formatUnits(AMOUNT_IN, 6)) / Number(fmtWeth(got))).toFixed(2)}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
