/**
 * USDC -> WETH swap on Base mainnet for large clips.
 *
 * Flow per tranche:
 *   1. sanity-check chain id + every configured address (router/quoter/pool wiring)
 *   2. quote the full tranche on every candidate pool (on-chain quoters, same block)
 *   3. pick the pool with the most WETH out
 *   4. reject if the fill is worse than Chainlink ETH/USD by more than --max-oracle-dev-bps
 *   5. amountOutMinimum = max(quote - slippage, oracle floor); approve exact amount; simulate; send
 *
 * Dry run by default. Pass --execute to send transactions.
 *
 *   RPC_URL=... PRIVATE_KEY=0x... npx tsx swap.ts --amount 250000 [--tranches 5 --interval-s 120] [--execute]
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
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { parseArgs } from 'node:util'

// ---------------------------------------------------------------------------
// Addresses — Base mainnet (chain 8453). Checked on-chain 2026-09-21; re-check before real funds (see NOTES.md).
// ---------------------------------------------------------------------------
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') // native Circle USDC (NOT USDbC 0xd9aA…)
const WETH = getAddress('0x4200000000000000000000000000000000000006') // OP-stack predeploy WETH9

// Chainlink feeds on Base (8 decimals) — price sanity guard only, never used for sizing.
const CL_ETH_USD = getAddress('0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')
const CL_USDC_USD = getAddress('0x7e860098F58bBFC8648a4311b374B1D669a2bc6B')

// Aerodrome Slipstream (concentrated liquidity; keyed by tickSpacing). Two live generations, each with its own factory/router/quoter.
const AERO_CL_V1 = {
  factory: getAddress('0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A'),
  router: getAddress('0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5'),
  quoter: getAddress('0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0'),
}
const AERO_CL_G3 = {
  factory: getAddress('0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef'),
  router: getAddress('0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F'),
  quoter: getAddress('0x514c8B5f54112481E28028F1166Bd78501089259'),
}
// Uniswap v3 on Base (NOT the Ethereum-mainnet router addresses).
const UNI_V3 = {
  factory: getAddress('0x33128a8fC17869897dcE68Ed026d694621f6FDfD'),
  router: getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'), // SwapRouter02
  quoter: getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a'), // QuoterV2
}

type Venue =
  | { name: string; kind: 'aero'; dex: typeof AERO_CL_V1; tickSpacing: number; pool: Address }
  | { name: string; kind: 'uni'; dex: typeof UNI_V3; fee: number; pool: Address }

// Only pools with real USDC/WETH depth at 100k+ clips (measured 2026-09-21). Thin pools left out on purpose.
const VENUES: Venue[] = [
  { name: 'Aerodrome Slipstream ts=100', kind: 'aero', dex: AERO_CL_V1, tickSpacing: 100, pool: getAddress('0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59') },
  { name: 'Aerodrome Slipstream(g3) ts=50', kind: 'aero', dex: AERO_CL_G3, tickSpacing: 50, pool: getAddress('0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A') },
  { name: 'Uniswap v3 0.05%', kind: 'uni', dex: UNI_V3, fee: 500, pool: getAddress('0xd0b53D9277642d899DF5C87A3966A349A798F224') },
  { name: 'Uniswap v3 0.30%', kind: 'uni', dex: UNI_V3, fee: 3000, pool: getAddress('0x6c561B446416E1A00E8E93E221854d6eA4171372') },
]

// ---------------------------------------------------------------------------
// ABIs — only the functions this script calls
// ---------------------------------------------------------------------------
const erc20Abi = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
])
const factoryRefAbi = parseAbi(['function factory() view returns (address)'])
const aeroFactoryAbi = parseAbi(['function getPool(address,address,int24) view returns (address)'])
const uniFactoryAbi = parseAbi(['function getPool(address,address,uint24) view returns (address)'])
const aeroQuoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,int24 tickSpacing,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
])
const uniQuoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
])
// Slipstream SwapRouter: struct carries its own deadline.
const aeroRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn,address tokenOut,int24 tickSpacing,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
])
// Uniswap SwapRouter02: no deadline in the struct -> wrap in multicall(deadline, data[]).
const uniRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)',
])
const feedAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)',
])

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const { values: opt } = parseArgs({
  options: {
    amount: { type: 'string' }, // total USDC, human units, e.g. 250000
    tranches: { type: 'string', default: '1' },
    'interval-s': { type: 'string', default: '60' },
    'slippage-bps': { type: 'string', default: '30' }, // vs the live quote
    'max-oracle-dev-bps': { type: 'string', default: '75' }, // fill vs Chainlink, incl. fee + impact
    'max-feed-age-s': { type: 'string', default: '3600' },
    'deadline-s': { type: 'string', default: '90' },
    recipient: { type: 'string' },
    execute: { type: 'boolean', default: false },
  },
})

const RPC_URL = process.env.RPC_URL
const PK = process.env.PRIVATE_KEY as `0x${string}` | undefined
if (!RPC_URL) throw new Error('RPC_URL required (use a dedicated Base node/provider, not the public endpoint)')
if (!PK) throw new Error('PRIVATE_KEY required')
if (!opt.amount) throw new Error('--amount <USDC> required')

const account = privateKeyToAccount(PK)
const recipient = getAddress(opt.recipient ?? account.address)
const totalIn = parseUnits(opt.amount, 6)
const tranches = BigInt(opt.tranches!)
const intervalS = Number(opt['interval-s'])
const slippageBps = BigInt(opt['slippage-bps']!)
const maxOracleDevBps = BigInt(opt['max-oracle-dev-bps']!)
const maxFeedAgeS = BigInt(opt['max-feed-age-s']!)
const deadlineS = BigInt(opt['deadline-s']!)
if (tranches < 1n) throw new Error('--tranches must be >= 1')
if (slippageBps > 200n) throw new Error('--slippage-bps > 200 refused; this is a guard, not a knob')

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) })

// ---------------------------------------------------------------------------
// Checks: refuse to run if any address is not what we think it is on THIS chain
// ---------------------------------------------------------------------------
async function verifyWiring() {
  const chainId = await publicClient.getChainId()
  if (chainId !== base.id) throw new Error(`wrong chain ${chainId}, expected Base ${base.id}`)

  const [uSym, uDec, wSym, wDec] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'decimals' }),
  ])
  if (uSym !== 'USDC' || uDec !== 6) throw new Error(`USDC mismatch: ${uSym}/${uDec}`)
  if (wSym !== 'WETH' || wDec !== 18) throw new Error(`WETH mismatch: ${wSym}/${wDec}`)

  for (const dex of [AERO_CL_V1, AERO_CL_G3, UNI_V3]) {
    for (const c of [dex.router, dex.quoter]) {
      const f = await publicClient.readContract({ address: c, abi: factoryRefAbi, functionName: 'factory' })
      if (getAddress(f) !== dex.factory) throw new Error(`${c}.factory() = ${f}, expected ${dex.factory}`)
    }
  }
  for (const v of VENUES) {
    const p =
      v.kind === 'aero'
        ? await publicClient.readContract({ address: v.dex.factory, abi: aeroFactoryAbi, functionName: 'getPool', args: [USDC, WETH, v.tickSpacing] })
        : await publicClient.readContract({ address: v.dex.factory, abi: uniFactoryAbi, functionName: 'getPool', args: [USDC, WETH, v.fee] })
    if (getAddress(p) !== v.pool) throw new Error(`${v.name}: factory returns pool ${p}, expected ${v.pool}`)
  }
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------
async function quote(v: Venue, amountIn: bigint): Promise<bigint> {
  if (v.kind === 'aero') {
    const { result } = await publicClient.simulateContract({
      address: v.dex.quoter, abi: aeroQuoterAbi, functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: v.tickSpacing, sqrtPriceLimitX96: 0n }],
    })
    return result[0]
  }
  const { result } = await publicClient.simulateContract({
    address: v.dex.quoter, abi: uniQuoterAbi, functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: v.fee, sqrtPriceLimitX96: 0n }],
  })
  return result[0]
}

/** Oracle WETH out for `usdcIn`, 18 decimals: usdcIn * (USDC/USD) / (ETH/USD). */
async function oracleOut(usdcIn: bigint): Promise<bigint> {
  const now = (await publicClient.getBlock()).timestamp
  const read = async (feed: Address) => {
    const [dec, [, answer, , updatedAt]] = await Promise.all([
      publicClient.readContract({ address: feed, abi: feedAbi, functionName: 'decimals' }),
      publicClient.readContract({ address: feed, abi: feedAbi, functionName: 'latestRoundData' }),
    ])
    if (answer <= 0n) throw new Error(`feed ${feed} non-positive answer`)
    if (now - updatedAt > maxFeedAgeS) throw new Error(`feed ${feed} stale: ${now - updatedAt}s old`)
    if (dec !== 8) throw new Error(`feed ${feed} unexpected decimals ${dec}`)
    return answer
  }
  const [ethUsd, usdcUsd] = await Promise.all([read(CL_ETH_USD), read(CL_USDC_USD)])
  // usdcIn (6 dp) * usdcUsd (8) / ethUsd (8) -> 6 dp of ETH; scale to 18.
  return (usdcIn * usdcUsd * 10n ** 12n) / ethUsd
}

const bps = (num: bigint, den: bigint) => Number(((num - den) * 10_000n) / den)
const price = (usdc: bigint, weth: bigint) => (Number(formatUnits(usdc, 6)) / Number(formatUnits(weth, 18))).toFixed(2)

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
async function ensureAllowance(spender: Address, amount: bigint) {
  const current = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'allowance', args: [account.address, spender] })
  if (current >= amount) return
  // Exact-amount approval, never unlimited: a treasury wallet should not leave standing allowances.
  const { request } = await publicClient.simulateContract({ account, address: USDC, abi: erc20Abi, functionName: 'approve', args: [spender, amount] })
  const hash = await walletClient.writeContract(request)
  const rcpt = await publicClient.waitForTransactionReceipt({ hash })
  if (rcpt.status !== 'success') throw new Error(`approve reverted: ${hash}`)
  console.log(`  approved ${formatUnits(amount, 6)} USDC to ${spender}  tx ${hash}`)
}

async function swap(v: Venue, amountIn: bigint, minOut: bigint): Promise<`0x${string}`> {
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + deadlineS
  if (v.kind === 'aero') {
    const { request } = await publicClient.simulateContract({
      account, address: v.dex.router, abi: aeroRouterAbi, functionName: 'exactInputSingle',
      args: [{ tokenIn: USDC, tokenOut: WETH, tickSpacing: v.tickSpacing, recipient, deadline, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
    })
    return walletClient.writeContract(request)
  }
  const inner = encodeFunctionData({
    abi: uniRouterAbi, functionName: 'exactInputSingle',
    args: [{ tokenIn: USDC, tokenOut: WETH, fee: v.fee, recipient, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
  })
  const { request } = await publicClient.simulateContract({
    account, address: v.dex.router, abi: uniRouterAbi, functionName: 'multicall', args: [deadline, [inner]],
  })
  return walletClient.writeContract(request)
}

async function runTranche(i: bigint, amountIn: bigint) {
  console.log(`\n== tranche ${i + 1n}/${tranches}: ${formatUnits(amountIn, 6)} USDC`)

  const quotes = await Promise.all(
    VENUES.map(async (v) => ({
      v,
      out: await quote(v, amountIn).catch((e) => {
        console.log(`  ${v.name}: quote failed (${e.shortMessage ?? e.message}), skipped`)
        return 0n
      }),
    })),
  )
  quotes.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0))
  const oracle = await oracleOut(amountIn)
  console.log(`  oracle: ${formatUnits(oracle, 18)} WETH @ ${price(amountIn, oracle)} USDC/ETH`)
  for (const q of quotes) {
    console.log(`  ${q.v.name.padEnd(32)} ${formatUnits(q.out, 18).padEnd(24)} WETH @ ${q.out ? price(amountIn, q.out) : '-'}  (${q.out ? bps(q.out, oracle) : '-'} bps vs oracle)`)
  }

  const best = quotes[0]
  if (best.out === 0n) throw new Error('no venue returned a quote')
  const devBps = BigInt(bps(best.out, oracle))
  if (devBps < -maxOracleDevBps) {
    throw new Error(`best fill ${devBps} bps vs oracle exceeds -${maxOracleDevBps} bps; aborting (reduce size / add tranches / check market)`)
  }

  const minFromQuote = (best.out * (10_000n - slippageBps)) / 10_000n
  const minFromOracle = (oracle * (10_000n - maxOracleDevBps)) / 10_000n
  const minOut = minFromQuote > minFromOracle ? minFromQuote : minFromOracle
  console.log(`  -> ${best.v.name} (pool ${best.v.pool}, router ${best.v.dex.router})`)
  console.log(`     minOut ${formatUnits(minOut, 18)} WETH (worst price ${price(amountIn, minOut)})`)

  if (!opt.execute) {
    console.log('  dry run: pass --execute to send')
    return
  }

  await ensureAllowance(best.v.dex.router, amountIn)
  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [recipient] })
  const hash = await swap(best.v, amountIn, minOut)
  console.log(`  swap tx ${hash}`)
  const rcpt = await publicClient.waitForTransactionReceipt({ hash })
  if (rcpt.status !== 'success') throw new Error(`swap reverted: ${hash}`)
  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [recipient], blockNumber: rcpt.blockNumber })
  const got = wethAfter - wethBefore
  console.log(`  filled ${formatUnits(got, 18)} WETH @ ${price(amountIn, got)} USDC/ETH (${bps(got, oracle)} bps vs oracle, block ${rcpt.blockNumber})`)
}

async function main() {
  await verifyWiring()
  console.log(`account ${account.address} -> recipient ${recipient}`)

  const bal = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
  if (bal < totalIn) {
    const msg = `USDC balance ${formatUnits(bal, 6)} < requested ${formatUnits(totalIn, 6)}`
    if (opt.execute) throw new Error(msg)
    console.log(`warning: ${msg} (dry run continues)`)
  }

  const per = totalIn / tranches
  for (let i = 0n; i < tranches; i++) {
    const amountIn = i === tranches - 1n ? totalIn - per * (tranches - 1n) : per // last tranche takes the dust
    await runTranche(i, amountIn)
    if (opt.execute && i < tranches - 1n) await new Promise((r) => setTimeout(r, intervalS * 1000))
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
