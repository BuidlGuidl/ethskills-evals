/**
 * roles-policy.ts — the on-chain policy that bounds the agent key, as Safe transactions.
 *
 * This file signs nothing. It builds the calldata that the Safe OWNERS execute (2-of-3,
 * hardware wallets, via the Safe{Wallet} Transaction Builder) to:
 *   1. enable the Roles modifier as a module on the Safe
 *   2. approve SwapRouter02 to pull WETH and USDC from the Safe
 *   3. scope the "rebalancer" role to SwapRouter02.exactInputSingle with:
 *        (tokenIn=WETH, tokenOut=USDC, amountIn within WETH allowance)  OR
 *        (tokenIn=USDC, tokenOut=WETH, amountIn within USDC allowance)
 *        AND fee == 500 AND recipient == Safe (avatar); Call only, no ETH value, no delegatecall
 *   4. set the two daily allowances
 *   5. assign the role to the agent EOA
 *
 *   npx tsx roles-policy.ts > rebalancer-setup.json     # import into Transaction Builder
 *
 * Required env: SAFE_ADDRESS, ROLES_MODIFIER_ADDRESS, AGENT_ADDRESS (public address only),
 *   WETH_ALLOWANCE_PER_DAY, USDC_ALLOWANCE_PER_DAY (human units, e.g. "20" and "60000").
 */

import { type Address, type Hex, encodeAbiParameters, encodeFunctionData, getAddress, maxUint256, parseAbi, parseUnits, stringToHex, toFunctionSelector } from 'viem'

export const WETH: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
export const USDC: Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
export const SWAP_ROUTER_02: Address = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

/** Zodiac Roles v2 mastercopy and ModuleProxyFactory (mainnet). Deploy your own proxy from these. */
export const ROLES_V2_MASTERCOPY: Address = '0x9646fDAD06d3e24444381f44362a3B0eB343D337'
export const MODULE_PROXY_FACTORY: Address = '0x000000000000aDdB49795b0f9bA5BC298cDda236'

export const ROLE_KEY: Hex = stringToHex('rebalancer', { size: 32 })
export const WETH_ALLOWANCE_KEY: Hex = stringToHex('rebalancer.weth.daily', { size: 32 })
export const USDC_ALLOWANCE_KEY: Hex = stringToHex('rebalancer.usdc.daily', { size: 32 })

// Zodiac Roles v2 enums (packages/evm/contracts/Types.sol — note Dynamic at index 2)
const ParameterType = { None: 0, Static: 1, Dynamic: 2, Tuple: 3, Array: 4, Calldata: 5, AbiEncoded: 6 } as const
const Operator = { Pass: 0, And: 1, Or: 2, Matches: 5, EqualToAvatar: 15, EqualTo: 16, WithinAllowance: 28 } as const
const ExecutionOptions = { None: 0, Send: 1, DelegateCall: 2, Both: 3 } as const

export const rolesAdminAbi = parseAbi([
  'struct ConditionFlat { uint8 parent; uint8 paramType; uint8 operator; bytes compValue; }',
  'function setUp(bytes initParams)',
  'function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)',
  'function scopeTarget(bytes32 roleKey, address targetAddress)',
  'function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, ConditionFlat[] conditions, uint8 options)',
  'function revokeTarget(bytes32 roleKey, address targetAddress)',
  'function setAllowance(bytes32 key, uint128 balance, uint128 maxRefill, uint128 refill, uint64 period, uint64 timestamp)',
])
const safeAdminAbi = parseAbi(['function enableModule(address module)'])
const erc20ApproveAbi = parseAbi(['function approve(address spender, uint256 amount) returns (bool)'])

const word = (v: Address | bigint) =>
  typeof v === 'bigint' ? encodeAbiParameters([{ type: 'uint256' }], [v]) : encodeAbiParameters([{ type: 'address' }], [v])

/** Condition tree for exactInputSingle, flattened breadth-first as Roles v2 requires. */
export function exactInputSingleConditions() {
  const c = (parent: number, paramType: number, operator: number, compValue: Hex = '0x') => ({ parent, paramType, operator, compValue })
  const fields = (tokenIn: Address, tokenOut: Address, allowanceKey: Hex, parent: number) => [
    c(parent, ParameterType.Static, Operator.EqualTo, word(tokenIn)),          // tokenIn
    c(parent, ParameterType.Static, Operator.EqualTo, word(tokenOut)),         // tokenOut
    c(parent, ParameterType.Static, Operator.EqualTo, word(500n)),             // fee
    c(parent, ParameterType.Static, Operator.EqualToAvatar),                   // recipient == Safe
    c(parent, ParameterType.Static, Operator.WithinAllowance, allowanceKey),   // amountIn
    c(parent, ParameterType.Static, Operator.Pass),                            // amountOutMinimum
    c(parent, ParameterType.Static, Operator.Pass),                            // sqrtPriceLimitX96
  ]
  return [
    /* 0 */ c(0, ParameterType.None, Operator.Or),
    /* 1 */ c(0, ParameterType.Calldata, Operator.Matches),   // branch: sell WETH
    /* 2 */ c(0, ParameterType.Calldata, Operator.Matches),   // branch: sell USDC
    /* 3 */ c(1, ParameterType.Tuple, Operator.Matches),      // params (WETH→USDC)
    /* 4 */ c(2, ParameterType.Tuple, Operator.Matches),      // params (USDC→WETH)
    /* 5-11  */ ...fields(WETH, USDC, WETH_ALLOWANCE_KEY, 3),
    /* 12-18 */ ...fields(USDC, WETH, USDC_ALLOWANCE_KEY, 4),
  ]
}

export interface SafeTx { to: Address; value: '0'; data: Hex; description: string }

export function buildSetupTransactions(p: {
  safe: Address; roles: Address; agent: Address; wethPerDay: bigint; usdcPerDay: bigint; startTimestamp?: bigint
}): SafeTx[] {
  const DAY = 86_400n
  const ts = p.startTimestamp ?? 0n // 0 = start refilling from the current block time
  const selector = toFunctionSelector('function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))')
  const roles = (functionName: any, args: any, description: string): SafeTx =>
    ({ to: p.roles, value: '0', data: encodeFunctionData({ abi: rolesAdminAbi, functionName, args }), description })
  return [
    { to: p.safe, value: '0', data: encodeFunctionData({ abi: safeAdminAbi, functionName: 'enableModule', args: [p.roles] }), description: 'Safe: enable Roles modifier as module' },
    // The router can only pull from the Safe when the Safe itself calls it, and the only
    // non-owner path to that is the scoped role below, so an unlimited approval is acceptable.
    { to: WETH, value: '0', data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [SWAP_ROUTER_02, maxUint256] }), description: 'WETH: approve SwapRouter02' },
    { to: USDC, value: '0', data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [SWAP_ROUTER_02, maxUint256] }), description: 'USDC: approve SwapRouter02' },
    roles('scopeTarget', [ROLE_KEY, SWAP_ROUTER_02], 'Roles: scope rebalancer role to SwapRouter02'),
    roles('scopeFunction', [ROLE_KEY, SWAP_ROUTER_02, selector, exactInputSingleConditions(), ExecutionOptions.None], 'Roles: allow only exactInputSingle WETH<->USDC 0.05%, recipient=Safe, within allowance'),
    // balance = maxRefill = refill: at most one day's budget available at any moment; no carry-over.
    roles('setAllowance', [WETH_ALLOWANCE_KEY, p.wethPerDay, p.wethPerDay, p.wethPerDay, DAY, ts], 'Roles: WETH daily allowance'),
    roles('setAllowance', [USDC_ALLOWANCE_KEY, p.usdcPerDay, p.usdcPerDay, p.usdcPerDay, DAY, ts], 'Roles: USDC daily allowance'),
    roles('assignRoles', [p.agent, [ROLE_KEY], [true]], 'Roles: grant rebalancer role to agent EOA'),
  ]
}

/** Emergency: evict the agent. Needs owner signatures only — never the agent's cooperation. */
export function buildRevokeTransactions(p: { roles: Address; agent: Address }): SafeTx[] {
  return [
    { to: p.roles, value: '0', data: encodeFunctionData({ abi: rolesAdminAbi, functionName: 'assignRoles', args: [p.agent, [ROLE_KEY], [false]] }), description: 'Roles: revoke rebalancer role from agent' },
    { to: p.roles, value: '0', data: encodeFunctionData({ abi: rolesAdminAbi, functionName: 'setAllowance', args: [WETH_ALLOWANCE_KEY, 0n, 0n, 0n, 0n, 0n] }), description: 'Roles: zero WETH allowance' },
    { to: p.roles, value: '0', data: encodeFunctionData({ abi: rolesAdminAbi, functionName: 'setAllowance', args: [USDC_ALLOWANCE_KEY, 0n, 0n, 0n, 0n, 0n] }), description: 'Roles: zero USDC allowance' },
  ]
}

/** Safe{Wallet} Transaction Builder batch format. */
export function toTxBuilderJson(safe: Address, name: string, txs: SafeTx[]) {
  return {
    version: '1.0', chainId: '1', createdAt: Date.now(),
    meta: { name, description: txs.map((t, i) => `${i + 1}. ${t.description}`).join('\n'), txBuilderVersion: '1.16.5', createdFromSafeAddress: safe, createdFromOwnerAddress: '', checksum: '' },
    transactions: txs.map(({ to, value, data }) => ({ to, value, data, contractMethod: null, contractInputsValues: null })),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const need = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`missing env ${k}`); return v }
  const safe = getAddress(need('SAFE_ADDRESS'))
  const roles = getAddress(need('ROLES_MODIFIER_ADDRESS'))
  const agent = getAddress(need('AGENT_ADDRESS'))
  const mode = process.argv[2] ?? 'setup'
  const txs = mode === 'revoke'
    ? buildRevokeTransactions({ roles, agent })
    : buildSetupTransactions({ safe, roles, agent, wethPerDay: parseUnits(need('WETH_ALLOWANCE_PER_DAY'), 18), usdcPerDay: parseUnits(need('USDC_ALLOWANCE_PER_DAY'), 6) })
  console.log(JSON.stringify(toTxBuilderJson(safe, `rebalancer ${mode}`, txs), null, 2))
}
