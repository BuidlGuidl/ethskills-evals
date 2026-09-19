/**
 * roles-policy.ts — the onchain permission the agent runs under.
 *
 * Produces the calls the Safe OWNERS execute once, as a Safe batch against the
 * Zodiac Roles Modifier v2 (the Safe is the modifier's owner):
 *
 *   scopeTarget(ROLE, SwapRouter02)
 *   scopeFunction(ROLE, SwapRouter02, exactInputSingle, <conditions>, ExecutionOptions.None)
 *   setAllowance(WETH_IN_ALLOWANCE, ...)   daily WETH sell budget
 *   setAllowance(USDC_IN_ALLOWANCE, ...)   daily USDC sell budget
 *   assignRoles(agent, [ROLE], [true])
 *
 * The condition allows exactly:
 *   exactInputSingle({ tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: <Safe>,
 *                      amountIn: ≤ per-trade cap AND within daily WETH allowance,
 *                      amountOutMinimum: ≥ Chainlink-implied output − ORACLE_FLOOR_BPS
 *                                        (checked by contracts/OracleMinOutCondition.sol),
 *                      sqrtPriceLimitX96: 0 })
 *   OR the mirror image with USDC in / WETH out and the USDC allowance.
 * No ETH value, no delegatecall, no other function, no other contract.
 *
 * Print the batch:  npx tsx roles-policy.ts <agentAddress> <oracleMinOutConditionAddress>
 */

import { type Address, type Hex, concat, encodeAbiParameters, numberToHex, encodeFunctionData, getAddress, parseAbi, parseUnits, stringToHex, toFunctionSelector } from 'viem'
import { pathToFileURL } from 'node:url'

export const WETH = getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
export const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
export const SWAP_ROUTER_02 = getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
/** Zodiac ModuleProxyFactory and Roles Modifier v2 mastercopy (mainnet). */
export const MODULE_PROXY_FACTORY = getAddress('0x000000000000aDdB49795b0f9bA5BC298cDda236')
export const ROLES_V2_MASTERCOPY = getAddress('0x9646fDAD06d3e24444381f44362a3B0eB343D337')

export const ROLE_KEY = stringToHex('rebalancer', { size: 32 })
export const WETH_IN_ALLOWANCE = stringToHex('rebalancer-weth-in', { size: 32 })
export const USDC_IN_ALLOWANCE = stringToHex('rebalancer-usdc-in', { size: 32 })

/**
 * Limits. Denominated in tokens, not USD — re-derive the WETH numbers from the
 * ETH price when you deploy, and revisit them if ETH moves a lot.
 * They bound volume, not price: price is bounded by ORACLE_FLOOR_BPS. A
 * compromised agent key can churn at most one day's allowance per direction,
 * each swap at no worse than ~1.5% below Chainlink, until you revoke the role.
 */
export const LIMITS = {
  wethPerTrade: parseUnits('20', 18), // ≈ $50k at ~$2.6k/ETH
  wethPerDay: parseUnits('60', 18), // ≈ $160k/day
  usdcPerTrade: parseUnits('55000', 6),
  usdcPerDay: parseUnits('160000', 6),
  periodSec: 86_400n,
}

/**
 * Onchain floor for amountOutMinimum vs. Chainlink. Must be looser than the
 * off-chain floor in rebalance.ts (MAX_ORACLE_DEVIATION_BPS + SLIPPAGE_BPS =
 * 130 by default) or honest trades get rejected.
 */
export const ORACLE_FLOOR_BPS = 150n

/**
 * Allowance refill windows are timestamp + k·period. Epoch 0 with a 1-day period
 * makes them UTC days, matching the off-chain daily cap in rebalance.ts. (A
 * "now" timestamp that is ahead of block.timestamp silently delays the first
 * refill — caught by fork-test.ts.)
 */
const ALLOWANCE_EPOCH = 0n

// Roles v2 enums (zodiac-modifier-roles v2 Types.sol)
const ParameterType = { None: 0, Static: 1, Dynamic: 2, Tuple: 3, Array: 4, Calldata: 5, AbiEncoded: 6 } as const
const Operator = { Pass: 0, And: 1, Or: 2, Matches: 5, EqualToAvatar: 15, EqualTo: 16, GreaterThan: 17, LessThan: 18, Custom: 22, WithinAllowance: 28 } as const
const ExecutionOptions = { None: 0, Send: 1, DelegateCall: 2, Both: 3 } as const

type ConditionFlat = { parent: number; paramType: number; operator: number; compValue: Hex }

const word = (type: 'address' | 'uint256', v: Address | bigint) => encodeAbiParameters([{ type }], [v as never])

/** Flattened condition tree, in BFS order as Roles v2 requires. */
export function swapConditions(minOutCondition: Address): ConditionFlat[] {
  const n = (parent: number, paramType: number, operator: number, compValue: Hex = '0x'): ConditionFlat => ({
    parent,
    paramType,
    operator,
    compValue,
  })
  const S = ParameterType.Static
  // exactInputSingle fields: tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96
  const fields = (tupleIdx: number, tokenIn: Address, tokenOut: Address) => [
    n(tupleIdx, S, Operator.EqualTo, word('address', tokenIn)),
    n(tupleIdx, S, Operator.EqualTo, word('address', tokenOut)),
    n(tupleIdx, S, Operator.EqualTo, word('uint256', 500n)),
    n(tupleIdx, S, Operator.EqualToAvatar), // recipient must be the Safe
    n(tupleIdx, ParameterType.None, Operator.And), // amountIn → two checks below
    // amountOutMinimum: custom condition; compValue = adapter address ‖ bytes12(maxBps)
    n(tupleIdx, S, Operator.Custom, concat([getAddress(minOutCondition), numberToHex(ORACLE_FLOOR_BPS, { size: 12 })])),
    n(tupleIdx, S, Operator.EqualTo, word('uint256', 0n)),
  ]
  return [
    /* 0 */ n(0, ParameterType.None, Operator.Or),
    /* 1 */ n(0, ParameterType.Calldata, Operator.Matches), // WETH → USDC
    /* 2 */ n(0, ParameterType.Calldata, Operator.Matches), // USDC → WETH
    /* 3 */ n(1, ParameterType.Tuple, Operator.Matches),
    /* 4 */ n(2, ParameterType.Tuple, Operator.Matches),
    /* 5-11 */ ...fields(3, WETH, USDC), // amountIn And-node = 9
    /* 12-18 */ ...fields(4, USDC, WETH), // amountIn And-node = 16
    /* 19 */ n(9, S, Operator.LessThan, word('uint256', LIMITS.wethPerTrade + 1n)),
    /* 20 */ n(9, S, Operator.WithinAllowance, WETH_IN_ALLOWANCE),
    /* 21 */ n(16, S, Operator.LessThan, word('uint256', LIMITS.usdcPerTrade + 1n)),
    /* 22 */ n(16, S, Operator.WithinAllowance, USDC_IN_ALLOWANCE),
  ]
}

export const rolesAdminAbi = parseAbi([
  'struct ConditionFlat { uint8 parent; uint8 paramType; uint8 operator; bytes compValue; }',
  'function scopeTarget(bytes32 roleKey, address targetAddress)',
  'function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, ConditionFlat[] conditions, uint8 options)',
  'function setAllowance(bytes32 key, uint128 balance, uint128 maxRefill, uint128 refill, uint64 period, uint64 timestamp)',
  'function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)',
  'function revokeTarget(bytes32 roleKey, address targetAddress)',
  'function setUp(bytes initParams)',
])

/** The one-time setup batch: [{ to: rolesModifier, data }], executed by the Safe owners. */
export function setupCalls(agent: Address, minOutCondition: Address): Hex[] {
  const selector = toFunctionSelector('exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))')
  return [
    encodeFunctionData({ abi: rolesAdminAbi, functionName: 'scopeTarget', args: [ROLE_KEY, SWAP_ROUTER_02] }),
    encodeFunctionData({
      abi: rolesAdminAbi,
      functionName: 'scopeFunction',
      args: [ROLE_KEY, SWAP_ROUTER_02, selector, swapConditions(minOutCondition), ExecutionOptions.None],
    }),
    encodeFunctionData({
      abi: rolesAdminAbi,
      functionName: 'setAllowance',
      args: [WETH_IN_ALLOWANCE, LIMITS.wethPerDay, LIMITS.wethPerDay, LIMITS.wethPerDay, LIMITS.periodSec, ALLOWANCE_EPOCH],
    }),
    encodeFunctionData({
      abi: rolesAdminAbi,
      functionName: 'setAllowance',
      args: [USDC_IN_ALLOWANCE, LIMITS.usdcPerDay, LIMITS.usdcPerDay, LIMITS.usdcPerDay, LIMITS.periodSec, ALLOWANCE_EPOCH],
    }),
    encodeFunctionData({ abi: rolesAdminAbi, functionName: 'assignRoles', args: [getAddress(agent), [ROLE_KEY], [true]] }),
  ]
}

/** Kill switch: removes the router from the role. One Safe tx, no redeploy. */
export function killSwitchCall(): Hex {
  return encodeFunctionData({ abi: rolesAdminAbi, functionName: 'revokeTarget', args: [ROLE_KEY, SWAP_ROUTER_02] })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [agent, minOutCondition] = process.argv.slice(2)
  if (!agent || !minOutCondition) {
    console.error('usage: tsx roles-policy.ts <agentAddress> <oracleMinOutConditionAddress>')
    process.exit(2)
  }
  const calls = setupCalls(getAddress(agent), getAddress(minOutCondition))
  console.log(JSON.stringify({ roleKey: ROLE_KEY, to: 'the Roles modifier', calls, killSwitch: killSwitchCall() }, null, 2))
}
