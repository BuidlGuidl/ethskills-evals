/**
 * USDC -> WETH swap on Base mainnet for large (6-figure) sizes.
 *
 * - Quotes Uniswap V3 (0.05%, 0.3%) and Aerodrome Slipstream (tickSpacing 100) on-chain.
 * - Finds the best split of the order across those pools (grid search).
 * - Checks the resulting price against Chainlink ETH/USD + USDC/USD; refuses bad fills.
 * - Every leg has amountOutMinimum + deadline. Dry run by default.
 *
 * Run:  RPC_URL=... AMOUNT_USDC=250000 npx tsx swap.ts             (dry run: quote + plan only)
 *       RPC_URL=... AMOUNT_USDC=250000 PRIVATE_KEY=0x... EXECUTE=1 npx tsx swap.ts
 * See NOTES.md for all env vars and pre-flight checklist.
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

// ---------------------------------------------------------------------------
// Addresses (Base mainnet, chainId 8453) — all verified on-chain, see NOTES.md
// ---------------------------------------------------------------------------
const USDC: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // native Circle USDC (not USDbC)
const WETH: Address = '0x4200000000000000000000000000000000000006' // OP-stack predeploy WETH9

const UNI_V3_ROUTER: Address = '0x2626664c2603336E57B271c5C0b26F421741e481' // Uniswap SwapRouter02
const UNI_V3_QUOTER: Address = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' // Uniswap QuoterV2
const AERO_CL_ROUTER: Address = '0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5' // Aerodrome Slipstream SwapRouter
const AERO_CL_QUOTER: Address = '0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0' // Aerodrome Slipstream QuoterV2

const CL_ETH_USD: Address = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' // Chainlink ETH/USD (8 dec)
const CL_USDC_USD: Address = '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B' // Chainlink USDC/USD (8 dec)
const CL_SEQUENCER: Address = '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433' // Chainlink L2 sequencer uptime

type Venue =
  | { name: string; kind: 'uniV3'; fee: number }
  | { name: string; kind: 'aeroCL'; tickSpacing: number }

// Deep USDC/WETH pools. Thin pools (uni 0.01%/1%, other aero spacings) add nothing at this size.
const VENUES: Venue[] = [
  { name: 'UniswapV3 0.05%', kind: 'uniV3', fee: 500 },
  { name: 'UniswapV3 0.30%', kind: 'uniV3', fee: 3000 },
  { name: 'Aerodrome CL ts100', kind: 'aeroCL', tickSpacing: 100 },
]

// ---------------------------------------------------------------------------
// ABIs (only what we call)
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

// Quoters are non-view (they revert internally) but are meant to be eth_call'ed.
// Declared `view` here so viem lets us batch them through multicall.
const uniQuoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const aeroQuoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, int24 tickSpacing, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

// SwapRouter02: struct has NO deadline; deadline goes through multicall(uint256 deadline, bytes[]).
const uniRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
])
// Slipstream router: v3-periphery style, deadline inside the struct, tickSpacing instead of fee.
const aeroRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
])

const chainlinkAbi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`missing env ${name}`)
  return v
}

const RPC_URL = env('RPC_URL')
const AMOUNT = parseUnits(env('AMOUNT_USDC'), 6)
const EXECUTE = process.env.EXECUTE === '1'
const SLIPPAGE_BPS = BigInt(env('SLIPPAGE_BPS', '30')) // quote -> fill tolerance per leg
const MAX_ORACLE_DEV_BPS = BigInt(env('MAX_ORACLE_DEV_BPS', '75')) // all-in cost vs Chainlink (fees + impact)
const SPLIT_STEPS = Number(env('SPLIT_STEPS', '20')) // split granularity: 20 => 5% increments
const CHUNKS = Number(env('CHUNKS', '1')) // >1 => slice order over time (TWAP-style)
const CHUNK_DELAY_SEC = Number(env('CHUNK_DELAY_SEC', '60'))
const DEADLINE_SEC = BigInt(env('DEADLINE_SEC', '120'))

const ETH_USD_MAX_AGE = 1500n // feed heartbeat 1200s on Base
const USDC_USD_MAX_AGE = 90_000n // feed heartbeat 86400s on Base
const SEQUENCER_GRACE = 3600n // wait 1h after sequencer restart before trusting prices

const BPS = 10_000n

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
const account = process.env.PRIVATE_KEY ? privateKeyToAccount(process.env.PRIVATE_KEY as Hex) : undefined
const walletClient = account ? createWalletClient({ account, chain: base, transport: http(RPC_URL) }) : undefined

// ---------------------------------------------------------------------------
// Oracle reference price
// ---------------------------------------------------------------------------
/** WETH (18 dec) that `usdcIn` is worth at Chainlink prices. Throws if feeds are unsafe. */
async function oracleWethFor(usdcIn: bigint): Promise<bigint> {
  const [seq, eth, usdc, block] = await Promise.all([
    publicClient.readContract({ address: CL_SEQUENCER, abi: chainlinkAbi, functionName: 'latestRoundData' }),
    publicClient.readContract({ address: CL_ETH_USD, abi: chainlinkAbi, functionName: 'latestRoundData' }),
    publicClient.readContract({ address: CL_USDC_USD, abi: chainlinkAbi, functionName: 'latestRoundData' }),
    publicClient.getBlock(),
  ])
  const now = block.timestamp
  if (seq[1] !== 0n) throw new Error('Base sequencer reported DOWN by Chainlink')
  if (now - seq[2] < SEQUENCER_GRACE) throw new Error('sequencer restarted < 1h ago; prices unreliable')
  if (eth[1] <= 0n || now - eth[3] > ETH_USD_MAX_AGE) throw new Error('ETH/USD feed stale or invalid')
  if (usdc[1] <= 0n || now - usdc[3] > USDC_USD_MAX_AGE) throw new Error('USDC/USD feed stale or invalid')
  // usdc(6) * usdcUsd(8) / ethUsd(8) -> 6 dec; *1e12 -> 18 dec
  return (usdcIn * usdc[1] * 10n ** 12n) / eth[1]
}

// ---------------------------------------------------------------------------
// Quoting + split optimisation
// ---------------------------------------------------------------------------
function quoteCall(v: Venue, amountIn: bigint) {
  return v.kind === 'uniV3'
    ? ({
        address: UNI_V3_QUOTER,
        abi: uniQuoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: v.fee, sqrtPriceLimitX96: 0n }],
      } as const)
    : ({
        address: AERO_CL_QUOTER,
        abi: aeroQuoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: v.tickSpacing, sqrtPriceLimitX96: 0n }],
      } as const)
}

/** WETH out for each amount on one venue; 0 if the quote reverts (e.g. not enough liquidity). */
async function quoteMany(v: Venue, amounts: bigint[]): Promise<bigint[]> {
  const res = await publicClient.multicall({
    contracts: amounts.map((a) => quoteCall(v, a)),
    allowFailure: true,
  })
  return res.map((r, i) => (amounts[i] === 0n || r.status !== 'success' ? 0n : r.result[0]))
}

type Leg = { venue: Venue; amountIn: bigint; quotedOut: bigint }

/**
 * Split `total` across VENUES in SPLIT_STEPS increments to maximise WETH out.
 * Pools are independent, so out(split) = sum of per-pool quotes; exact DP over the grid.
 */
async function planSplit(total: bigint): Promise<Leg[]> {
  const N = SPLIT_STEPS
  const grid = Array.from({ length: N + 1 }, (_, k) => (total * BigInt(k)) / BigInt(N))
  const quotes = await Promise.all(VENUES.map((v) => quoteMany(v, grid)))

  // best[j] = max WETH using venues seen so far with j steps; choice[p][j] = steps given to venue p
  let best: bigint[] = Array.from({ length: N + 1 }, (_, j) => (j === 0 ? 0n : -1n))
  const choice: number[][] = []
  for (let p = 0; p < VENUES.length; p++) {
    const next = Array<bigint>(N + 1).fill(-1n)
    const pick = Array<number>(N + 1).fill(0)
    for (let j = 0; j <= N; j++) {
      for (let k = 0; k <= j; k++) {
        if (best[j - k] < 0n || (k > 0 && quotes[p][k] === 0n)) continue
        const v = best[j - k] + quotes[p][k]
        if (v > next[j]) {
          next[j] = v
          pick[j] = k
        }
      }
    }
    best = next
    choice.push(pick)
  }
  if (best[N] <= 0n) throw new Error('no venue can fill this size')

  const steps: number[] = []
  for (let p = VENUES.length - 1, j = N; p >= 0; p--) {
    steps[p] = choice[p][j]
    j -= steps[p]
  }

  // Convert steps to exact amounts; biggest leg absorbs rounding dust, then re-quote exact amounts.
  const amounts = steps.map((k) => grid[k])
  const biggest = amounts.indexOf(amounts.reduce((a, b) => (b > a ? b : a)))
  amounts[biggest] += total - amounts.reduce((a, b) => a + b, 0n)

  const legs = VENUES.map((venue, i) => ({ venue, amountIn: amounts[i], quotedOut: 0n })).filter((l) => l.amountIn > 0n)
  const fresh = await Promise.all(legs.map((l) => quoteMany(l.venue, [l.amountIn])))
  legs.forEach((l, i) => (l.quotedOut = fresh[i][0]))
  if (legs.some((l) => l.quotedOut === 0n)) throw new Error('re-quote failed for a planned leg')
  return legs
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
const minOut = (quoted: bigint) => (quoted * (BPS - SLIPPAGE_BPS)) / BPS
const fmtUsdc = (x: bigint) => formatUnits(x, 6)
const fmtWeth = (x: bigint) => formatUnits(x, 18)
const px = (usdc: bigint, weth: bigint) => (weth === 0n ? 'n/a' : (Number(usdc) / 1e6 / (Number(weth) / 1e18)).toFixed(2))

async function ensureAllowance(spender: Address, needed: bigint) {
  const owner = account!.address
  const current = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'allowance', args: [owner, spender] })
  if (current >= needed) return
  // Exact-amount approval (no infinite approvals from a treasury wallet).
  const { request } = await publicClient.simulateContract({
    account,
    address: USDC,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, needed],
  })
  const hash = await walletClient!.writeContract(request)
  const r = await publicClient.waitForTransactionReceipt({ hash })
  if (r.status !== 'success') throw new Error(`approve to ${spender} failed: ${hash}`)
  console.log(`  approved ${fmtUsdc(needed)} USDC to ${spender} (${hash})`)
}

async function sendUniLegs(legs: Leg[], recipient: Address, deadline: bigint) {
  const calls = legs.map((l) =>
    encodeFunctionData({
      abi: uniRouterAbi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: USDC,
          tokenOut: WETH,
          fee: (l.venue as Extract<Venue, { kind: 'uniV3' }>).fee,
          recipient,
          amountIn: l.amountIn,
          amountOutMinimum: minOut(l.quotedOut),
          sqrtPriceLimitX96: 0n,
        },
      ],
    }),
  )
  // All Uniswap legs in one atomic tx, deadline enforced by multicall(uint256,bytes[]).
  const { request } = await publicClient.simulateContract({
    account,
    address: UNI_V3_ROUTER,
    abi: uniRouterAbi,
    functionName: 'multicall',
    args: [deadline, calls],
  })
  return walletClient!.writeContract(request)
}

async function sendAeroLeg(leg: Leg, recipient: Address, deadline: bigint) {
  const { request } = await publicClient.simulateContract({
    account,
    address: AERO_CL_ROUTER,
    abi: aeroRouterAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: USDC,
        tokenOut: WETH,
        tickSpacing: (leg.venue as Extract<Venue, { kind: 'aeroCL' }>).tickSpacing,
        recipient,
        deadline,
        amountIn: leg.amountIn,
        amountOutMinimum: minOut(leg.quotedOut),
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  return walletClient!.writeContract(request)
}

async function swapChunk(amountIn: bigint, recipient: Address) {
  const legs = await planSplit(amountIn)
  const quotedTotal = legs.reduce((a, l) => a + l.quotedOut, 0n)
  const oracleOut = await oracleWethFor(amountIn)
  const devBps = oracleOut > quotedTotal ? ((oracleOut - quotedTotal) * BPS) / oracleOut : 0n

  console.log(`\nChunk ${fmtUsdc(amountIn)} USDC`)
  for (const l of legs) {
    console.log(
      `  ${l.venue.name.padEnd(20)} in ${fmtUsdc(l.amountIn).padStart(14)} USDC  out ${fmtWeth(l.quotedOut)} WETH  ` +
        `@ ${px(l.amountIn, l.quotedOut)}  min ${fmtWeth(minOut(l.quotedOut))}`,
    )
  }
  console.log(`  total quoted ${fmtWeth(quotedTotal)} WETH @ ${px(amountIn, quotedTotal)} USDC/WETH`)
  console.log(`  oracle       ${fmtWeth(oracleOut)} WETH @ ${px(amountIn, oracleOut)}  -> cost vs oracle ${devBps} bps (max ${MAX_ORACLE_DEV_BPS})`)

  if (devBps > MAX_ORACLE_DEV_BPS) {
    throw new Error(`route is ${devBps} bps worse than Chainlink; limit ${MAX_ORACLE_DEV_BPS}. Use CHUNKS or a smaller size.`)
  }
  if (!EXECUTE) {
    console.log('  DRY RUN — set EXECUTE=1 to send')
    return
  }

  const uniLegs = legs.filter((l) => l.venue.kind === 'uniV3')
  const aeroLegs = legs.filter((l) => l.venue.kind === 'aeroCL')
  const uniIn = uniLegs.reduce((a, l) => a + l.amountIn, 0n)
  const aeroIn = aeroLegs.reduce((a, l) => a + l.amountIn, 0n)
  if (uniIn > 0n) await ensureAllowance(UNI_V3_ROUTER, uniIn)
  if (aeroIn > 0n) await ensureAllowance(AERO_CL_ROUTER, aeroIn)

  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] })
  const deadline = (await publicClient.getBlock()).timestamp + DEADLINE_SEC

  // Legs go out as separate txs (different routers). Each is independently protected by its own
  // amountOutMinimum; if a later leg reverts, earlier legs are already filled at acceptable prices.
  const hashes: Hex[] = []
  if (uniLegs.length) hashes.push(await sendUniLegs(uniLegs, recipient, deadline))
  for (const l of aeroLegs) hashes.push(await sendAeroLeg(l, recipient, deadline))
  for (const hash of hashes) {
    const r = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`  tx ${hash} ${r.status} (block ${r.blockNumber})`)
    if (r.status !== 'success') throw new Error(`swap tx reverted: ${hash}`)
  }

  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] })
  const got = wethAfter - wethBefore
  console.log(`  received ${fmtWeth(got)} WETH @ ${px(amountIn, got)} USDC/WETH`)
}

async function main() {
  const chainId = await publicClient.getChainId()
  if (chainId !== base.id) throw new Error(`RPC is chain ${chainId}, expected Base (8453)`)
  if (EXECUTE && !account) throw new Error('EXECUTE=1 requires PRIVATE_KEY')
  if (!Number.isInteger(CHUNKS) || CHUNKS < 1) throw new Error('CHUNKS must be an integer >= 1')
  if (!Number.isInteger(SPLIT_STEPS) || SPLIT_STEPS < 1 || SPLIT_STEPS > 50) throw new Error('SPLIT_STEPS must be 1..50')
  if (SLIPPAGE_BPS > 200n || MAX_ORACLE_DEV_BPS > 300n) throw new Error('slippage limits look unsafe (>2% / >3%)')

  const recipient = getAddress(process.env.RECIPIENT ?? account?.address ?? '0x0000000000000000000000000000000000000000')
  if (EXECUTE) {
    const [usdcBal, ethBal] = await Promise.all([
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account!.address] }),
      publicClient.getBalance({ address: account!.address }),
    ])
    if (usdcBal < AMOUNT) throw new Error(`USDC balance ${fmtUsdc(usdcBal)} < ${fmtUsdc(AMOUNT)}`)
    if (ethBal === 0n) throw new Error('no ETH for gas')
    console.log(`account ${account!.address}  USDC ${fmtUsdc(usdcBal)}  ETH ${formatUnits(ethBal, 18)}  -> recipient ${recipient}`)
  }

  console.log(`swap ${fmtUsdc(AMOUNT)} USDC -> WETH in ${CHUNKS} chunk(s), slippage ${SLIPPAGE_BPS} bps, max vs oracle ${MAX_ORACLE_DEV_BPS} bps`)
  const per = AMOUNT / BigInt(CHUNKS)
  for (let i = 0; i < CHUNKS; i++) {
    const amt = i === CHUNKS - 1 ? AMOUNT - per * BigInt(CHUNKS - 1) : per
    await swapChunk(amt, recipient)
    if (i < CHUNKS - 1) {
      console.log(`  waiting ${CHUNK_DELAY_SEC}s for pools to rebalance...`)
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_SEC * 1000))
    }
  }
}

main().catch((e) => {
  console.error(`\nABORTED: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
