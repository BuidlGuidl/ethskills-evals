/**
 * roles-setup.ts — the exact on-chain permission the agent key gets, as the
 * batch of calls the Safe owners execute once (DEPLOY.md §3).
 *
 *   npx tsx roles-setup.ts > roles-batch.json
 *
 * Env: SAFE_ADDRESS, ROLES_MODIFIER_ADDRESS, AGENT_ADDRESS, ROLE_KEY,
 *      USDC_DAILY (default 100000), WETH_DAILY (default 40),
 *      USDC_PER_TRADE (default 55000), WETH_PER_TRADE (default 22)   — whole tokens.
 * WETH limits are in WETH, not dollars: re-size them when ETH moves a lot
 * (defaults assume ETH ≈ $2,650, i.e. ≈ $100k/day and ≈ $55k/trade each way).
 *
 * Output is a Safe{Wallet} Transaction Builder batch. Load it at
 * app.safe.global → Apps → Transaction Builder, check every call, sign with the
 * owner threshold. The batch is executed BY THE SAFE (it owns the Roles mod).
 *
 * What the role allows, and nothing else:
 *   SwapRouter(0xE592…1564).exactInputSingle({
 *     tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: <the Safe>,
 *     amountIn < WETH per-trade cap AND within the WETH daily allowance
 *   }) OR ({
 *     tokenIn: USDC, tokenOut: WETH, fee: 500, recipient: <the Safe>,
 *     amountIn < USDC per-trade cap AND within the USDC daily allowance
 *   })
 *   value = 0, operation = Call (ExecutionOptions.None: no ETH, no delegatecall).
 * The allowances refill once per 24h. amountOutMinimum is NOT constrained on-chain:
 * a stolen agent key can route up to one day's allowance per direction through
 * the pool at a bad price (sandwiched) before you revoke it. See DEPLOY.md §1.
 */

import { type Address, type Hex, encodeAbiParameters, encodeFunctionData, getAddress, pad, parseAbi, parseUnits, toFunctionSelector, keccak256, toHex } from 'viem'

export const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
export const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
export const SWAP_ROUTER: Address = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

// Zodiac Roles v2 enums (packages/evm/contracts/Types.sol)
const AbiType = { None: 0, Static: 1, Dynamic: 2, Tuple: 3, Array: 4, Calldata: 5, AbiEncoded: 6 } as const
const Op = { Pass: 0, And: 1, Or: 2, Matches: 5, EqualToAvatar: 15, EqualTo: 16, LessThan: 18, WithinAllowance: 28 } as const
const ExecutionOptions = { None: 0 } as const

const rolesAdminAbi = parseAbi([
  'struct ConditionFlat { uint8 parent; uint8 paramType; uint8 operator; bytes compValue; }',
  'function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)',
  'function scopeTarget(bytes32 roleKey, address targetAddress)',
  'function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, ConditionFlat[] conditions, uint8 options)',
  'function setAllowance(bytes32 key, uint128 balance, uint128 maxRefill, uint128 refill, uint64 period, uint64 timestamp)',
])
const erc20ApproveAbi = parseAbi(['function approve(address spender, uint256 amount) returns (bool)'])

export const EXACT_INPUT_SINGLE_SELECTOR = toFunctionSelector(
  'function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
)

export const ALLOWANCE_KEY_USDC_IN = keccak256(toHex('rebalancer.usdc-in'))
export const ALLOWANCE_KEY_WETH_IN = keccak256(toHex('rebalancer.weth-in'))

const word = (v: Hex) => pad(v, { size: 32 })
const addr = (a: Address) => encodeAbiParameters([{ type: 'address' }], [a])
const uint = (n: bigint) => encodeAbiParameters([{ type: 'uint256' }], [n])

type ConditionFlat = { parent: number; paramType: number; operator: number; compValue: Hex }

/** One branch's 8 struct fields, in ExactInputSingleParams order. */
function fields(parent: number, tokenIn: Address, tokenOut: Address): ConditionFlat[] {
  return [
    { parent, paramType: AbiType.Static, operator: Op.EqualTo, compValue: addr(tokenIn) }, // tokenIn
    { parent, paramType: AbiType.Static, operator: Op.EqualTo, compValue: addr(tokenOut) }, // tokenOut
    { parent, paramType: AbiType.Static, operator: Op.EqualTo, compValue: uint(500n) }, // fee
    { parent, paramType: AbiType.Static, operator: Op.EqualToAvatar, compValue: '0x' }, // recipient == Safe
    { parent, paramType: AbiType.Static, operator: Op.Pass, compValue: '0x' }, // deadline
    { parent, paramType: AbiType.None, operator: Op.And, compValue: '0x' }, // amountIn → children below
    { parent, paramType: AbiType.Static, operator: Op.Pass, compValue: '0x' }, // amountOutMinimum
    { parent, paramType: AbiType.Static, operator: Op.Pass, compValue: '0x' }, // sqrtPriceLimitX96
  ]
}

/** amountIn < per-trade cap AND amountIn fits the daily allowance. */
function amountInLimits(parent: number, perTradeCap: bigint, allowanceKey: Hex): ConditionFlat[] {
  return [
    { parent, paramType: AbiType.Static, operator: Op.LessThan, compValue: uint(perTradeCap) },
    { parent, paramType: AbiType.Static, operator: Op.WithinAllowance, compValue: word(allowanceKey) },
  ]
}

/** Condition tree, flattened breadth-first (parents in non-decreasing order) as Roles v2 requires. */
export function swapConditions(caps: { wethPerTrade: bigint; usdcPerTrade: bigint }): ConditionFlat[] {
  return [
    /* 0 */ { parent: 0, paramType: AbiType.None, operator: Op.Or, compValue: '0x' },
    /* 1 */ { parent: 0, paramType: AbiType.Calldata, operator: Op.Matches, compValue: '0x' }, // WETH → USDC
    /* 2 */ { parent: 0, paramType: AbiType.Calldata, operator: Op.Matches, compValue: '0x' }, // USDC → WETH
    /* 3 */ { parent: 1, paramType: AbiType.Tuple, operator: Op.Matches, compValue: '0x' },
    /* 4 */ { parent: 2, paramType: AbiType.Tuple, operator: Op.Matches, compValue: '0x' },
    /* 5-12  */ ...fields(3, WETH, USDC), // amountIn node = 10
    /* 13-20 */ ...fields(4, USDC, WETH), // amountIn node = 18
    /* 21-22 */ ...amountInLimits(10, caps.wethPerTrade, ALLOWANCE_KEY_WETH_IN),
    /* 23-24 */ ...amountInLimits(18, caps.usdcPerTrade, ALLOWANCE_KEY_USDC_IN),
  ]
}

export type SetupParams = {
  roles: Address
  agent: Address
  roleKey: Hex
  usdcPerDay: bigint // 6dp
  wethPerDay: bigint // 18dp
  usdcPerTrade: bigint // 6dp
  wethPerTrade: bigint // 18dp
  nowSec: bigint
}

/** Calls the Safe must make (as msg.sender) to wire the agent's permission. */
export function buildSetupCalls(p: SetupParams): { to: Address; data: Hex; description: string }[] {
  const day = 86_400n
  return [
    {
      to: p.roles,
      description: 'assign role to agent',
      data: encodeFunctionData({ abi: rolesAdminAbi, functionName: 'assignRoles', args: [p.agent, [p.roleKey], [true]] }),
    },
    {
      to: p.roles,
      description: 'scope SwapRouter as target',
      data: encodeFunctionData({ abi: rolesAdminAbi, functionName: 'scopeTarget', args: [p.roleKey, SWAP_ROUTER] }),
    },
    {
      to: p.roles,
      description: 'allow exactInputSingle WETH<->USDC, fee 500, recipient Safe, within allowance',
      data: encodeFunctionData({
        abi: rolesAdminAbi,
        functionName: 'scopeFunction',
        args: [
          p.roleKey,
          SWAP_ROUTER,
          EXACT_INPUT_SINGLE_SELECTOR,
          swapConditions({ wethPerTrade: p.wethPerTrade, usdcPerTrade: p.usdcPerTrade }),
          ExecutionOptions.None,
        ],
      }),
    },
    {
      to: p.roles,
      description: 'USDC-in allowance: refills daily',
      data: encodeFunctionData({
        abi: rolesAdminAbi,
        functionName: 'setAllowance',
        args: [ALLOWANCE_KEY_USDC_IN, p.usdcPerDay, p.usdcPerDay, p.usdcPerDay, day, p.nowSec],
      }),
    },
    {
      to: p.roles,
      description: 'WETH-in allowance: refills daily',
      data: encodeFunctionData({
        abi: rolesAdminAbi,
        functionName: 'setAllowance',
        args: [ALLOWANCE_KEY_WETH_IN, p.wethPerDay, p.wethPerDay, p.wethPerDay, day, p.nowSec],
      }),
    },
    // The router pulls tokenIn from the Safe (msg.sender) — the agent can't approve anything itself.
    {
      to: WETH,
      description: 'Safe approves SwapRouter for WETH',
      data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [SWAP_ROUTER, 2n ** 256n - 1n] }),
    },
    {
      to: USDC,
      description: 'Safe approves SwapRouter for USDC',
      data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [SWAP_ROUTER, 2n ** 256n - 1n] }),
    },
  ]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = (n: string) => {
    const v = process.env[n]
    if (!v) throw new Error(`missing env ${n}`)
    return v
  }
  const safe = getAddress(env('SAFE_ADDRESS'))
  const calls = buildSetupCalls({
    roles: getAddress(env('ROLES_MODIFIER_ADDRESS')),
    agent: getAddress(env('AGENT_ADDRESS')),
    roleKey: env('ROLE_KEY') as Hex,
    usdcPerDay: parseUnits(process.env.USDC_DAILY ?? '100000', 6),
    wethPerDay: parseUnits(process.env.WETH_DAILY ?? '40', 18),
    usdcPerTrade: parseUnits(process.env.USDC_PER_TRADE ?? '55000', 6),
    wethPerTrade: parseUnits(process.env.WETH_PER_TRADE ?? '22', 18),
    nowSec: BigInt(Math.floor(Date.now() / 1000)),
  })
  console.log(
    JSON.stringify(
      {
        version: '1.0',
        chainId: '1',
        createdAt: Date.now(),
        meta: { name: 'Rebalancer agent permissions', createdFromSafeAddress: safe, description: '' },
        transactions: calls.map((c) => ({ to: c.to, value: '0', data: c.data, contractMethod: null, contractInputsValues: null })),
      },
      null,
      2,
    ),
  )
}
