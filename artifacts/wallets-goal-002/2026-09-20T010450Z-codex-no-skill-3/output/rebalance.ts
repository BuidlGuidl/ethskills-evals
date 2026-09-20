import 'dotenv/config'

import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  maxUint256,
  parseEther,
  parseGwei,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

/**
 * Execution path:
 * signal/strategy -> RebalanceDecision -> quote -> guard checks -> approval if needed
 * -> simulate exactInputSingle -> sign and submit Ethereum mainnet transaction.
 *
 * Accounts touched:
 * - TREASURY_ADDRESS / PRIVATE_KEY: EOA that owns WETH/USDC, pays gas, signs approvals/swaps.
 *
 * Contracts touched on Ethereum mainnet:
 * - WETH:          0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
 * - USDC:          0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
 * - Uniswap V3 Factory: 0x1F98431c8aD98523631AE4a59f267346ea31F984
 * - Uniswap V3 SwapRouter: 0xE592427A0AEce92De3Edee1F18E0157C05861564
 * - Uniswap V3 QuoterV2:    0x61fFE014bA17989E743c5F6cB21bF9697530B21e
 */

const ADDRESSES = {
  weth: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  usdc: getAddress('0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
  uniswapV3Factory: getAddress('0x1F98431c8aD98523631AE4a59f267346ea31F984'),
  uniswapV3SwapRouter: getAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564'),
  uniswapV3QuoterV2: getAddress('0x61fFE014bA17989E743c5F6cB21bF9697530B21e'),
} as const

const TOKENS = {
  WETH: { address: ADDRESSES.weth, decimals: 18, symbol: 'WETH' },
  USDC: { address: ADDRESSES.usdc, decimals: 6, symbol: 'USDC' },
} as const

type TokenSymbol = keyof typeof TOKENS
type Side = 'USDC_TO_WETH' | 'WETH_TO_USDC'

export type RebalanceDecision = {
  id: string
  side: Side
  amountIn: string
  poolFee: 100 | 500 | 3000 | 10000
  maxSlippageBps: number
  minAmountOut?: string
  validForSeconds: number
  reason?: string
}

const swapRouterAbi = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const

const quoterV2Abi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

const factoryAbi = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const

const poolAbi = [
  {
    type: 'function',
    name: 'liquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const

const required = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

const optionalBool = (name: string, fallback: boolean): boolean => {
  const value = process.env[name]
  if (value === undefined) return fallback
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase())
}

const optionalNumber = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`)
  return parsed
}

const asPrivateKey = (raw: string): Hex => {
  const prefixed = raw.startsWith('0x') ? raw : `0x${raw}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error('PRIVATE_KEY must be a 32-byte hex string')
  }
  return prefixed as Hex
}

const tokenPairForSide = (side: Side): { tokenIn: TokenSymbol; tokenOut: TokenSymbol } => {
  if (side === 'USDC_TO_WETH') return { tokenIn: 'USDC', tokenOut: 'WETH' }
  if (side === 'WETH_TO_USDC') return { tokenIn: 'WETH', tokenOut: 'USDC' }
  throw new Error(`Unsupported side ${side}`)
}

const bpsFloor = (amount: bigint, bpsToKeep: number): bigint => {
  return (amount * BigInt(bpsToKeep)) / 10_000n
}

const decimalStringToNumber = (value: string): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Could not parse decimal number: ${value}`)
  return parsed
}

const stringify = (value: unknown): string =>
  JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2,
  )

const log = (event: string, fields: Record<string, unknown> = {}) => {
  console.log(stringify({ event, at: new Date().toISOString(), ...fields }))
}

const loadDecisionFromEnv = (): RebalanceDecision => {
  if (process.env.REBALANCE_DECISION_JSON) {
    const parsed = JSON.parse(process.env.REBALANCE_DECISION_JSON) as Partial<RebalanceDecision>
    return normalizeDecision(parsed)
  }

  return normalizeDecision({
    id: process.env.DECISION_ID ?? `manual-${Date.now()}`,
    side: required('SIDE') as Side,
    amountIn: required('AMOUNT_IN'),
    poolFee: optionalNumber('POOL_FEE', 500) as RebalanceDecision['poolFee'],
    maxSlippageBps: optionalNumber('MAX_SLIPPAGE_BPS', 30),
    minAmountOut: process.env.MIN_AMOUNT_OUT,
    validForSeconds: optionalNumber('VALID_FOR_SECONDS', 90),
    reason: process.env.REASON,
  })
}

const normalizeDecision = (input: Partial<RebalanceDecision>): RebalanceDecision => {
  if (!input.id) throw new Error('Decision id is required')
  if (input.side !== 'USDC_TO_WETH' && input.side !== 'WETH_TO_USDC') {
    throw new Error('Decision side must be USDC_TO_WETH or WETH_TO_USDC')
  }
  if (!input.amountIn || decimalStringToNumber(input.amountIn) <= 0) {
    throw new Error('Decision amountIn must be a positive decimal string')
  }
  if (![100, 500, 3000, 10000].includes(Number(input.poolFee))) {
    throw new Error('poolFee must be one of 100, 500, 3000, 10000')
  }
  if (
    input.maxSlippageBps === undefined ||
    !Number.isInteger(input.maxSlippageBps) ||
    input.maxSlippageBps < 1
  ) {
    throw new Error('maxSlippageBps must be a positive integer')
  }
  if (!input.validForSeconds || input.validForSeconds < 15 || input.validForSeconds > 300) {
    throw new Error('validForSeconds must be between 15 and 300')
  }

  const maxAllowedSlippageBps = optionalNumber('MAX_ALLOWED_SLIPPAGE_BPS', 100)
  if (input.maxSlippageBps > maxAllowedSlippageBps) {
    throw new Error(
      `Decision slippage ${input.maxSlippageBps} bps exceeds MAX_ALLOWED_SLIPPAGE_BPS=${maxAllowedSlippageBps}`,
    )
  }

  return input as RebalanceDecision
}

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(required('RPC_URL')),
})

const account = privateKeyToAccount(asPrivateKey(required('PRIVATE_KEY')))
const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(required('RPC_URL')),
})

const expectedTreasury = getAddress(required('TREASURY_ADDRESS'))
if (getAddress(account.address) !== expectedTreasury) {
  throw new Error(`PRIVATE_KEY signs for ${account.address}, not TREASURY_ADDRESS=${expectedTreasury}`)
}

const confirmations = optionalNumber('CONFIRMATIONS', 2)
const execute = optionalBool('EXECUTE', false)

const assertMainnetAndContracts = async () => {
  const chainId = await publicClient.getChainId()
  if (chainId !== mainnet.id) throw new Error(`RPC_URL is chain ${chainId}; expected Ethereum mainnet chain 1`)

  const contracts = {
    WETH: ADDRESSES.weth,
    USDC: ADDRESSES.usdc,
    UniswapV3Factory: ADDRESSES.uniswapV3Factory,
    UniswapV3SwapRouter: ADDRESSES.uniswapV3SwapRouter,
    UniswapV3QuoterV2: ADDRESSES.uniswapV3QuoterV2,
  }

  await Promise.all(
    Object.entries(contracts).map(async ([name, address]) => {
      const bytecode = await publicClient.getBytecode({ address })
      if (!bytecode || bytecode === '0x') throw new Error(`${name} has no bytecode at ${address}`)
    }),
  )
}

const cappedFees = async () => {
  const feeEstimate = await publicClient.estimateFeesPerGas({ type: 'eip1559' })
  if (!feeEstimate.maxFeePerGas || !feeEstimate.maxPriorityFeePerGas) {
    throw new Error('RPC did not return EIP-1559 fee estimates')
  }

  const maxFeeCap = parseGwei(process.env.MAX_FEE_PER_GAS_GWEI ?? '80')
  const maxPriorityCap = parseGwei(process.env.MAX_PRIORITY_FEE_GWEI ?? '3')
  if (feeEstimate.maxFeePerGas > maxFeeCap) {
    throw new Error(
      `maxFeePerGas ${formatUnits(feeEstimate.maxFeePerGas, 9)} gwei exceeds MAX_FEE_PER_GAS_GWEI`,
    )
  }
  if (feeEstimate.maxPriorityFeePerGas > maxPriorityCap) {
    throw new Error(
      `maxPriorityFeePerGas ${formatUnits(
        feeEstimate.maxPriorityFeePerGas,
        9,
      )} gwei exceeds MAX_PRIORITY_FEE_GWEI`,
    )
  }

  return {
    maxFeePerGas: feeEstimate.maxFeePerGas,
    maxPriorityFeePerGas: feeEstimate.maxPriorityFeePerGas,
  }
}

const waitForSuccess = async (hash: Hex, label: string) => {
  log(`${label}.submitted`, { hash })
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations,
  })
  if (receipt.status !== 'success') throw new Error(`${label} transaction reverted: ${hash}`)
  log(`${label}.confirmed`, {
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    effectiveGasPriceGwei: formatUnits(receipt.effectiveGasPrice, 9),
  })
  return receipt
}

const ensureApproval = async (token: Address, amountIn: bigint, symbol: TokenSymbol) => {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, ADDRESSES.uniswapV3SwapRouter],
  })

  if (allowance >= amountIn) {
    log('approval.ok', {
      token: symbol,
      allowance: formatUnits(allowance, TOKENS[symbol].decimals),
      spender: ADDRESSES.uniswapV3SwapRouter,
    })
    return
  }

  const approvalPolicy = process.env.APPROVAL_POLICY ?? 'exact'
  if (!['exact', 'infinite'].includes(approvalPolicy)) {
    throw new Error('APPROVAL_POLICY must be exact or infinite')
  }

  const approvalAmount = approvalPolicy === 'infinite' ? maxUint256 : amountIn
  log('approval.required', {
    token: symbol,
    currentAllowance: formatUnits(allowance, TOKENS[symbol].decimals),
    approvalPolicy,
    approvalAmount: approvalPolicy === 'infinite' ? 'maxUint256' : formatUnits(approvalAmount, TOKENS[symbol].decimals),
  })

  if (!execute) {
    log('approval.skipped_dry_run', { set_EXECUTE: 'true to approve and continue to swap simulation' })
    throw new Error('Dry run stopped before approval because allowance is insufficient')
  }

  if (allowance > 0n) {
    const fees = await cappedFees()
    const { request } = await publicClient.simulateContract({
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      account,
      args: [ADDRESSES.uniswapV3SwapRouter, 0n],
      ...fees,
    })
    const hash = await walletClient.writeContract(request)
    await waitForSuccess(hash, 'approval.zero')
  }

  const fees = await cappedFees()
  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    account,
    args: [ADDRESSES.uniswapV3SwapRouter, approvalAmount],
    ...fees,
  })
  const hash = await walletClient.writeContract(request)
  await waitForSuccess(hash, 'approval.set')
}

export const executeRebalance = async (decision: RebalanceDecision) => {
  await assertMainnetAndContracts()

  const minEthBalance = parseEther(process.env.MIN_ETH_BALANCE ?? '0.05')
  const ethBalance = await publicClient.getBalance({ address: account.address })
  if (ethBalance < minEthBalance) {
    throw new Error(
      `Executor has ${formatEther(ethBalance)} ETH for gas; minimum is ${formatEther(minEthBalance)} ETH`,
    )
  }

  const { tokenIn: tokenInSymbol, tokenOut: tokenOutSymbol } = tokenPairForSide(decision.side)
  const tokenIn = TOKENS[tokenInSymbol]
  const tokenOut = TOKENS[tokenOutSymbol]
  const amountIn = parseUnits(decision.amountIn, tokenIn.decimals)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + decision.validForSeconds)

  const pool = await publicClient.readContract({
    address: ADDRESSES.uniswapV3Factory,
    abi: factoryAbi,
    functionName: 'getPool',
    args: [tokenIn.address, tokenOut.address, decision.poolFee],
  })
  if (pool === zeroAddress) {
    throw new Error(`No Uniswap V3 pool for ${tokenInSymbol}/${tokenOutSymbol} fee ${decision.poolFee}`)
  }

  const [poolLiquidity, tokenBalance] = await Promise.all([
    publicClient.readContract({
      address: pool,
      abi: poolAbi,
      functionName: 'liquidity',
    }),
    publicClient.readContract({
      address: tokenIn.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
  ])

  if (poolLiquidity === 0n) throw new Error(`Pool ${pool} currently has zero active liquidity`)
  if (tokenBalance < amountIn) {
    throw new Error(
      `Insufficient ${tokenInSymbol}: balance ${formatUnits(tokenBalance, tokenIn.decimals)}, need ${decision.amountIn}`,
    )
  }

  const quote = await publicClient.simulateContract({
    address: ADDRESSES.uniswapV3QuoterV2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    account,
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn,
        fee: decision.poolFee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  const [quotedAmountOut, sqrtPriceX96After, initializedTicksCrossed, quoteGasEstimate] = quote.result

  const slippageMinOut = bpsFloor(quotedAmountOut, 10_000 - decision.maxSlippageBps)
  const signalMinOut = decision.minAmountOut ? parseUnits(decision.minAmountOut, tokenOut.decimals) : 0n
  const amountOutMinimum = signalMinOut > slippageMinOut ? signalMinOut : slippageMinOut

  const tradeUsd =
    tokenInSymbol === 'USDC'
      ? decimalStringToNumber(formatUnits(amountIn, tokenIn.decimals))
      : decimalStringToNumber(formatUnits(quotedAmountOut, TOKENS.USDC.decimals))
  const minTradeUsd = optionalNumber('MIN_TRADE_USD', 10_000)
  const maxTradeUsd = optionalNumber('MAX_TRADE_USD', 50_000)
  if (tradeUsd < minTradeUsd || tradeUsd > maxTradeUsd) {
    throw new Error(`Trade value ${tradeUsd.toFixed(2)} USD is outside [${minTradeUsd}, ${maxTradeUsd}]`)
  }

  log('decision.accepted', {
    id: decision.id,
    reason: decision.reason,
    execute,
    treasury: account.address,
    side: decision.side,
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    pool,
    poolFee: decision.poolFee,
    amountIn: `${formatUnits(amountIn, tokenIn.decimals)} ${tokenInSymbol}`,
    quotedAmountOut: `${formatUnits(quotedAmountOut, tokenOut.decimals)} ${tokenOutSymbol}`,
    amountOutMinimum: `${formatUnits(amountOutMinimum, tokenOut.decimals)} ${tokenOutSymbol}`,
    maxSlippageBps: decision.maxSlippageBps,
    sqrtPriceX96After,
    initializedTicksCrossed,
    quoteGasEstimate,
    ethBalance: `${formatEther(ethBalance)} ETH`,
  })

  await ensureApproval(tokenIn.address, amountIn, tokenInSymbol)

  const fees = await cappedFees()
  const params = {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    fee: decision.poolFee,
    recipient: account.address,
    deadline,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  }

  const simulation = await publicClient.simulateContract({
    address: ADDRESSES.uniswapV3SwapRouter,
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    account,
    args: [params],
    value: 0n,
    ...fees,
  })

  log('swap.simulated', {
    id: decision.id,
    simulatedAmountOut: `${formatUnits(simulation.result, tokenOut.decimals)} ${tokenOutSymbol}`,
    maxFeePerGasGwei: formatUnits(fees.maxFeePerGas, 9),
    maxPriorityFeePerGasGwei: formatUnits(fees.maxPriorityFeePerGas, 9),
    deadline: Number(deadline),
  })

  if (!execute) {
    log('swap.skipped_dry_run', { set_EXECUTE: 'true to sign and submit' })
    return { dryRun: true, amountOutMinimum, quotedAmountOut }
  }

  const hash = await walletClient.writeContract(simulation.request)
  const receipt = await waitForSuccess(hash, 'swap')
  return { dryRun: false, hash, receipt, amountOutMinimum, quotedAmountOut }
}

executeRebalance(loadDecisionFromEnv()).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
