/**
 * setup-roles.ts — generates the ONE-TIME Safe transaction batch that gives the
 * agent key its (narrow) power over the treasury, plus an emergency-revoke batch.
 *
 * Nothing here is signed or sent. It writes Safe Transaction Builder JSON files
 * that the Safe owners import in app.safe.global → Apps → Transaction Builder,
 * review, and sign with their hardware wallets.
 *
 *   TREASURY_SAFE=0x... AGENT_ADDRESS=0x... \
 *   WETH_PER_DAY=40 USDC_PER_DAY=100000 [ALLOWANCE_PERIOD_HOURS=24] \
 *   tsx setup-roles.ts
 *
 * Batch contents (all executed by the Safe, via MultiSendCallOnly — no delegatecall):
 *   1. ModuleProxyFactory.deployModule(Roles v2.1.1 mastercopy, setUp(owner=avatar=target=Safe))
 *   2. Safe.enableModule(roles)
 *   3. roles.assignRoles(agent, [REBALANCER], [true])
 *   4. roles.scopeTarget(REBALANCER, SwapRouter)
 *   5. roles.scopeFunction(REBALANCER, SwapRouter, exactInputSingle, <conditions>, None)
 *        OR( tokenIn=WETH, tokenOut=USDC, amountIn within allowance WETH_IN,
 *            tokenIn=USDC, tokenOut=WETH, amountIn within allowance USDC_IN )
 *        AND fee == 500, recipient == Safe, amountOutMinimum > 0
 *        No ETH value, no delegatecall, no other function, no other contract.
 *   6. roles.setAllowance(WETH_IN, ...)  roles.setAllowance(USDC_IN, ...)   (refill every ALLOWANCE_PERIOD_HOURS, default 24h)
 *   7. WETH.approve(SwapRouter, max)     USDC.approve(SwapRouter, max)
 */
import { writeFileSync } from 'node:fs'
import {
  type Address,
  type Hex,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  getContractAddress,
  keccak256,
  maxUint256,
  pad,
  parseAbi,
  parseUnits,
  toHex,
} from 'viem'
import { ALLOWANCE_KEYS, DEFAULT_ROLE_KEY, MAINNET, erc20Abi, swapRouterAbi } from './rebalance.ts'

export const ZODIAC = {
  MODULE_PROXY_FACTORY: '0x000000000000aDdB49795b0f9bA5BC298cDda236',
  ROLES_V2_MASTERCOPY: '0xf2964ce6161ce0e75964fe7927ce114cb0b283d5', // Roles v2.1.1 (@gnosis-guild/zodiac 5.0.1)
} as const

const factoryAbi = parseAbi(['function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address proxy)'])
const rolesSetupAbi = parseAbi([
  'function setUp(bytes initParams)',
  'function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)',
  'function scopeTarget(bytes32 roleKey, address targetAddress)',
  'function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, (uint8 parent, uint8 paramType, uint8 operator, bytes compValue)[] conditions, uint8 options)',
  'function setAllowance(bytes32 key, uint128 balance, uint128 maxRefill, uint128 refill, uint64 period, uint64 timestamp)',
  'function revokeTarget(bytes32 roleKey, address targetAddress)',
])
const safeAbi = parseAbi(['function enableModule(address module)', 'function disableModule(address prevModule, address module)'])

// Roles v2 condition encoding (PermissionChecker / Integrity).
const P = { None: 0, Static: 1, Dynamic: 2, Tuple: 3, Array: 4, Calldata: 5, AbiEncoded: 6 } as const
const O = { Pass: 0, And: 1, Or: 2, Matches: 5, EqualToAvatar: 15, EqualTo: 16, GreaterThan: 17, WithinAllowance: 28 } as const
type Cond = { parent: number; paramType: number; operator: number; compValue: Hex }
const word = (v: bigint | Address) => (typeof v === 'bigint' ? pad(toHex(v), { size: 32 }) : pad(v.toLowerCase() as Hex, { size: 32 }))

/**
 * Flat condition tree, breadth-first, parents by index — equivalent to what
 * zodiac-roles-sdk produces for:
 *   c.calldataMatches([c.or(matches({...WETH→USDC...}), matches({...USDC→WETH...}))])
 */
export function exactInputSingleConditions(): Cond[] {
  const leg = (tokenIn: Address, tokenOut: Address, allowanceKey: Hex, parent: number): Cond[] => [
    { parent, paramType: P.Static, operator: O.EqualTo, compValue: word(tokenIn) }, // tokenIn
    { parent, paramType: P.Static, operator: O.EqualTo, compValue: word(tokenOut) }, // tokenOut
    { parent, paramType: P.Static, operator: O.EqualTo, compValue: word(BigInt(MAINNET.POOL_FEE)) }, // fee
    { parent, paramType: P.Static, operator: O.EqualToAvatar, compValue: '0x' }, // recipient == Safe
    { parent, paramType: P.Static, operator: O.Pass, compValue: '0x' }, // deadline
    { parent, paramType: P.Static, operator: O.WithinAllowance, compValue: allowanceKey }, // amountIn
    { parent, paramType: P.Static, operator: O.GreaterThan, compValue: word(0n) }, // amountOutMinimum > 0
    { parent, paramType: P.Static, operator: O.Pass, compValue: '0x' }, // sqrtPriceLimitX96
  ]
  return [
    { parent: 0, paramType: P.Calldata, operator: O.Matches, compValue: '0x' }, // 0: calldata
    { parent: 0, paramType: P.None, operator: O.Or, compValue: '0x' }, // 1: OR over the params struct
    { parent: 1, paramType: P.Tuple, operator: O.Matches, compValue: '0x' }, // 2: WETH → USDC
    { parent: 1, paramType: P.Tuple, operator: O.Matches, compValue: '0x' }, // 3: USDC → WETH
    ...leg(MAINNET.WETH, MAINNET.USDC, ALLOWANCE_KEYS.WETH_IN, 2),
    ...leg(MAINNET.USDC, MAINNET.WETH, ALLOWANCE_KEYS.USDC_IN, 3),
  ]
}

export function rolesSetUpInitializer(safe: Address): Hex {
  const initParams = encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }], [safe, safe, safe])
  return encodeFunctionData({ abi: rolesSetupAbi, functionName: 'setUp', args: [initParams] })
}

/** Address the ModuleProxyFactory will deploy the Roles proxy to (CREATE2). */
export function predictRolesAddress(safe: Address, saltNonce: bigint): Address {
  const initializer = rolesSetUpInitializer(safe)
  const salt = keccak256(encodePacked(['bytes32', 'uint256'], [keccak256(initializer), saltNonce]))
  const bytecode = concat(['0x602d8060093d393df3363d3d373d3d3d363d73', ZODIAC.ROLES_V2_MASTERCOPY, '0x5af43d82803e903d91602b57fd5bf3'])
  return getContractAddress({ opcode: 'CREATE2', from: ZODIAC.MODULE_PROXY_FACTORY, salt, bytecode })
}

export type SafeTx = { to: Address; value: string; data: Hex }

export function buildSetupBatch(p: {
  safe: Address
  agent: Address
  wethPerDay: bigint
  usdcPerDay: bigint
  saltNonce: bigint
  nowSec: bigint
  /** Allowance refill period; the per-token amounts refill in full every period. Default 24h. */
  periodSec?: bigint
  roleKey?: Hex
}): { roles: Address; txs: SafeTx[] } {
  const roleKey = p.roleKey ?? DEFAULT_ROLE_KEY
  const roles = predictRolesAddress(p.safe, p.saltNonce)
  const selector = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: 'exactInputSingle',
    args: [{ tokenIn: MAINNET.WETH, tokenOut: MAINNET.USDC, fee: 0, recipient: p.safe, deadline: 0n, amountIn: 0n, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }],
  }).slice(0, 10) as Hex // 0x414bf389
  const period = p.periodSec ?? 86_400n
  const tx = (to: Address, data: Hex): SafeTx => ({ to, value: '0', data })
  const txs: SafeTx[] = [
    tx(ZODIAC.MODULE_PROXY_FACTORY, encodeFunctionData({ abi: factoryAbi, functionName: 'deployModule', args: [ZODIAC.ROLES_V2_MASTERCOPY, rolesSetUpInitializer(p.safe), p.saltNonce] })),
    tx(p.safe, encodeFunctionData({ abi: safeAbi, functionName: 'enableModule', args: [roles] })),
    tx(roles, encodeFunctionData({ abi: rolesSetupAbi, functionName: 'assignRoles', args: [p.agent, [roleKey], [true]] })),
    tx(roles, encodeFunctionData({ abi: rolesSetupAbi, functionName: 'scopeTarget', args: [roleKey, MAINNET.SWAP_ROUTER] })),
    tx(roles, encodeFunctionData({ abi: rolesSetupAbi, functionName: 'scopeFunction', args: [roleKey, MAINNET.SWAP_ROUTER, selector, exactInputSingleConditions(), 0 /* ExecutionOptions.None */] })),
    // setAllowance(key, balance, maxRefill, refill, period, timestamp): starts full, tops back up to the full amount every period.
    tx(roles, encodeFunctionData({ abi: rolesSetupAbi, functionName: 'setAllowance', args: [ALLOWANCE_KEYS.WETH_IN, p.wethPerDay, p.wethPerDay, p.wethPerDay, period, p.nowSec] })),
    tx(roles, encodeFunctionData({ abi: rolesSetupAbi, functionName: 'setAllowance', args: [ALLOWANCE_KEYS.USDC_IN, p.usdcPerDay, p.usdcPerDay, p.usdcPerDay, period, p.nowSec] })),
    tx(MAINNET.WETH, encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [MAINNET.SWAP_ROUTER, maxUint256] })),
    tx(MAINNET.USDC, encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [MAINNET.SWAP_ROUTER, maxUint256] })),
  ]
  return { roles, txs }
}

/** Emergency: agent loses the role immediately. Needs the Safe threshold to sign. */
export function buildRevokeBatch(p: { roles: Address; agent: Address; roleKey?: Hex }): SafeTx[] {
  return [{ to: p.roles, value: '0', data: encodeFunctionData({ abi: rolesSetupAbi, functionName: 'assignRoles', args: [p.agent, [p.roleKey ?? DEFAULT_ROLE_KEY], [false]] }) }]
}

function txBuilderJson(safe: Address, name: string, description: string, txs: SafeTx[]) {
  return JSON.stringify(
    {
      version: '1.0',
      chainId: '1',
      createdAt: Date.now(),
      meta: { name, description, txBuilderVersion: '1.16.5', createdFromSafeAddress: safe },
      transactions: txs.map((t) => ({ ...t, contractMethod: null, contractInputsValues: null })),
    },
    null,
    2,
  )
}

async function main() {
  const safe = getAddress(process.env.TREASURY_SAFE ?? '')
  const agent = getAddress(process.env.AGENT_ADDRESS ?? '')
  const wethPerDay = parseUnits(process.env.WETH_PER_DAY ?? '40', 18)
  const usdcPerDay = parseUnits(process.env.USDC_PER_DAY ?? '100000', 6)
  const periodSec = BigInt(Math.round(Number(process.env.ALLOWANCE_PERIOD_HOURS ?? '24') * 3600))
  const saltNonce = BigInt(process.env.SALT_NONCE ?? Date.now())
  const { roles, txs } = buildSetupBatch({ safe, agent, wethPerDay, usdcPerDay, saltNonce, periodSec, nowSec: BigInt(Math.floor(Date.now() / 1000)) })

  writeFileSync('safe-batch-setup.json', txBuilderJson(safe, 'Rebalancer: Roles module + permissions', `Roles at ${roles}; agent ${agent}`, txs))
  writeFileSync('safe-batch-revoke.json', txBuilderJson(safe, 'EMERGENCY: revoke rebalancer agent', `Remove REBALANCER role from ${agent}`, buildRevokeBatch({ roles, agent })))
  console.log(`Roles modifier will be deployed at: ${roles}   (set ROLES_MODIFIER to this)`)
  console.log(`Agent: ${agent}`)
  console.log(`Allowances: ${process.env.WETH_PER_DAY ?? '40'} WETH and ${process.env.USDC_PER_DAY ?? '100000'} USDC per ${Number(periodSec) / 3600}h`)
  console.log('Wrote safe-batch-setup.json and safe-batch-revoke.json')
}

if (process.argv[1]?.endsWith('setup-roles.ts')) main()
