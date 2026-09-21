/**
 * USDC -> WETH swap on Base mainnet for large clips.
 *
 * Flow: quote every candidate pool at the real size -> pick best -> sanity-check
 * against Chainlink ETH/USD and a small-size reference quote -> approve exact
 * amount -> simulate -> send with amountOutMinimum + deadline -> verify balance delta.
 *
 * Dry run by default (quotes + checks only). Pass --execute to send transactions.
 *
 *   PRIVATE_KEY=0x... BASE_RPC_URL=https://... AMOUNT_USDC=500000 npx tsx swap.ts
 *   PRIVATE_KEY=0x... BASE_RPC_URL=https://... AMOUNT_USDC=500000 npx tsx swap.ts --execute
 *
 * Every address below was checked on Base (chainId 8453) on 2026-09-21 — re-check
 * before moving real funds (see NOTES.md).
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// ---------- Addresses (Base mainnet, chainId 8453) ----------
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') // native Circle USDC (NOT USDbC 0xd9aA...)
const WETH = getAddress('0x4200000000000000000000000000000000000006')

// Aerodrome Slipstream (concentrated liquidity) — NOT the Aerodrome v2 Router 0xcF77...
const SLIPSTREAM_ROUTER = getAddress('0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5') // factory() = 0x5e7B...809A
const SLIPSTREAM_QUOTER = getAddress('0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0') // factory() = 0x5e7B...809A

// Uniswap v3 on Base (differs from Ethereum mainnet addresses)
const UNIV3_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481') // SwapRouter02, factory() = 0x3312...FDfD
const UNIV3_QUOTER = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a') // QuoterV2

// Chainlink ETH/USD on Base, 8 decimals
const CHAINLINK_ETH_USD = getAddress('0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')

// ---------- Config ----------
const EXECUTE = process.argv.includes('--execute')
const RPC_URL = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
const AMOUNT_USDC = process.env.AMOUNT_USDC ?? '1000'
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? '30') // tolerance vs live quote
const MAX_IMPACT_BPS = BigInt(process.env.MAX_IMPACT_BPS ?? '50') // quote vs small-size reference
const MAX_ORACLE_DEV_BPS = BigInt(process.env.MAX_ORACLE_DEV_BPS ?? '100') // min-out vs Chainlink fair value
const ORACLE_MAX_AGE_S = 3600n
const DEADLINE_S = 120n

type Venue =
  | { name: string; kind: 'slipstream'; tickSpacing: number; router: Address }
  | { name: string; kind: 'univ3'; fee: number; router: Address }

// Candidate USDC/WETH pools. Add/remove after checking current depth.
const VENUES: Venue[] = [
  { name: 'Aerodrome Slipstream ts=100', kind: 'slipstream', tickSpacing: 100, router: SLIPSTREAM_ROUTER },
  { name: 'Aerodrome Slipstream ts=1', kind: 'slipstream', tickSpacing: 1, router: SLIPSTREAM_ROUTER },
  { name: 'Uniswap v3 0.05%', kind: 'univ3', fee: 500, router: UNIV3_ROUTER },
  { name: 'Uniswap v3 0.30%', kind: 'univ3', fee: 3000, router: UNIV3_ROUTER },
]

// ---------- ABIs ----------
const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

const slipstreamQuoterAbi = [
  {
    type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'tickSpacing', type: 'int24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ] }],
    outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' }, { name: 'gasEstimate', type: 'uint256' }],
  },
] as const

const univ3QuoterAbi = [
  {
    type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ] }],
    outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' }, { name: 'gasEstimate', type: 'uint256' }],
  },
] as const

// Slipstream SwapRouter: deadline lives inside the params struct
const slipstreamRouterAbi = [
  {
    type: 'function', name: 'exactInputSingle', stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'tickSpacing', type: 'int24' }, { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' }, { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' }, { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ] }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const

// Uniswap SwapRouter02: no deadline in struct -> wrap in multicall(deadline, data[])
const univ3RouterAbi = [
  {
    type: 'function', name: 'exactInputSingle', stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'recipient', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ] }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function', name: 'multicall', stateMutability: 'payable',
    inputs: [{ name: 'deadline', type: 'uint256' }, { name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
] as const

const chainlinkAbi = [
  { type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [],
    outputs: [{ name: 'roundId', type: 'uint80' }, { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' }, { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' }] },
] as const

// ---------- Clients ----------
const pk = process.env.PRIVATE_KEY as Hex | undefined
if (!pk) throw new Error('PRIVATE_KEY not set')
const account = privateKeyToAccount(pk)
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL, { retryCount: 5, retryDelay: 500 }) })
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) })

const fmtWeth = (x: bigint) => formatUnits(x, 18)
const fmtUsdc = (x: bigint) => formatUnits(x, 6)

// Quoters are non-view (they revert internally), so read via eth_call simulation.
async function quote(v: Venue, amountIn: bigint): Promise<bigint> {
  if (v.kind === 'slipstream') {
    const { result } = await publicClient.simulateContract({
      address: SLIPSTREAM_QUOTER, abi: slipstreamQuoterAbi, functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, tickSpacing: v.tickSpacing, sqrtPriceLimitX96: 0n }],
    })
    return result[0]
  }
  const { result } = await publicClient.simulateContract({
    address: UNIV3_QUOTER, abi: univ3QuoterAbi, functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: USDC, tokenOut: WETH, amountIn, fee: v.fee, sqrtPriceLimitX96: 0n }],
  })
  return result[0]
}

async function main() {
  const chainId = await publicClient.getChainId()
  if (chainId !== base.id) throw new Error(`wrong chain: ${chainId}, expected ${base.id}`)

  // Identity checks: the addresses must be the contracts we think they are on THIS chain.
  const [usdcSym, wethSym] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'symbol' }),
  ])
  if (usdcSym !== 'USDC' || wethSym !== 'WETH') throw new Error(`token identity mismatch: ${usdcSym}/${wethSym}`)

  const amountIn = parseUnits(AMOUNT_USDC, 6)
  const me = account.address
  const usdcBal = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [me] })
  console.log(`account ${me}  USDC balance ${fmtUsdc(usdcBal)}  swap ${fmtUsdc(amountIn)} USDC`)
  if (usdcBal < amountIn) {
    if (EXECUTE) throw new Error('insufficient USDC')
    console.warn('WARN: insufficient USDC (dry run continues)')
  }

  // 1. Quote every venue at the real clip size.
  //    Sequential on purpose: public RPCs rate-limit bursts of eth_call.
  const quotes: { v: Venue; out: bigint }[] = []
  for (const v of VENUES) {
    // A failed quote aborts: silently skipping a venue could route size to a worse pool.
    try { quotes.push({ v, out: await quote(v, amountIn) }) }
    catch (e) { throw new Error(`quote failed: ${v.name}: ${(e as Error).message.split('\n')[0]}`) }
  }
  quotes.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0))
  for (const q of quotes) console.log(`  ${q.v.name.padEnd(30)} ${fmtWeth(q.out)} WETH`)
  const best = quotes[0]
  if (best.out === 0n) throw new Error('no venue returned a quote')
  console.log(`best: ${best.v.name}`)

  // 2. Price impact: compare against a 1,000 USDC reference quote on the same pool.
  const refIn = parseUnits('1000', 6)
  const refOut = await quote(best.v, refIn)
  const idealOut = (refOut * amountIn) / refIn
  const impactBps = idealOut > best.out ? ((idealOut - best.out) * 10_000n) / idealOut : 0n
  console.log(`price impact vs 1k-USDC reference: ${impactBps} bps (max ${MAX_IMPACT_BPS})`)
  if (impactBps > MAX_IMPACT_BPS) throw new Error('price impact too high — split the order or use smaller clips')

  // 3. Min out from the live quote.
  const minOut = (best.out * (10_000n - SLIPPAGE_BPS)) / 10_000n

  // 4. Independent check: minOut must be within MAX_ORACLE_DEV_BPS of Chainlink fair value.
  //    Protects against a pool that is manipulated or badly off-market at quote time.
  const [, answer, , updatedAt] = await publicClient.readContract({
    address: CHAINLINK_ETH_USD, abi: chainlinkAbi, functionName: 'latestRoundData',
  })
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (answer <= 0n) throw new Error('bad oracle answer')
  if (now - updatedAt > ORACLE_MAX_AGE_S) throw new Error(`oracle stale: ${now - updatedAt}s`)
  // USDC(6) -> WETH(18) at price(8): amountIn * 1e12 * 1e8 / price
  const fairOut = (amountIn * 10n ** 20n) / answer
  const oracleFloor = (fairOut * (10_000n - MAX_ORACLE_DEV_BPS)) / 10_000n
  console.log(`chainlink ETH/USD ${formatUnits(answer, 8)}  fair ${fmtWeth(fairOut)}  floor ${fmtWeth(oracleFloor)}`)
  console.log(`amountOutMinimum ${fmtWeth(minOut)} WETH (slippage ${SLIPPAGE_BPS} bps)`)
  if (minOut < oracleFloor) throw new Error('min out below oracle floor — pool is off-market or size too large')

  if (!EXECUTE) {
    console.log('dry run — pass --execute to send')
    return
  }

  // 5. Approve exact amount to the chosen router (no infinite approvals).
  const router = best.v.router
  const allowance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'allowance', args: [me, router] })
  if (allowance < amountIn) {
    const { request } = await publicClient.simulateContract({
      account, address: USDC, abi: erc20Abi, functionName: 'approve', args: [router, amountIn],
    })
    const h = await walletClient.writeContract(request)
    const r = await publicClient.waitForTransactionReceipt({ hash: h })
    if (r.status !== 'success') throw new Error(`approve failed ${h}`)
    console.log(`approved ${fmtUsdc(amountIn)} USDC to ${router}: ${h}`)
  }

  // 6. Simulate then send the swap.
  const deadline = now + DEADLINE_S
  const wethBefore = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [me] })
  let hash: Hex
  if (best.v.kind === 'slipstream') {
    const { request } = await publicClient.simulateContract({
      account, address: SLIPSTREAM_ROUTER, abi: slipstreamRouterAbi, functionName: 'exactInputSingle',
      args: [{ tokenIn: USDC, tokenOut: WETH, tickSpacing: best.v.tickSpacing, recipient: me,
        deadline, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
    })
    hash = await walletClient.writeContract(request)
  } else {
    const call = encodeFunctionData({
      abi: univ3RouterAbi, functionName: 'exactInputSingle',
      args: [{ tokenIn: USDC, tokenOut: WETH, fee: best.v.fee, recipient: me,
        amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n }],
    })
    const { request } = await publicClient.simulateContract({
      account, address: UNIV3_ROUTER, abi: univ3RouterAbi, functionName: 'multicall', args: [deadline, [call]],
    })
    hash = await walletClient.writeContract(request)
  }
  console.log(`swap tx ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`swap reverted ${hash}`)

  // 7. Verify what actually arrived.
  const wethAfter = await publicClient.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [me] })
  const got = wethAfter - wethBefore
  const effPrice = (amountIn * 10n ** 18n) / got // USDC(6dp) per 1 WETH
  console.log(`received ${fmtWeth(got)} WETH  effective price ${fmtUsdc(effPrice)} USDC/WETH  block ${receipt.blockNumber}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
