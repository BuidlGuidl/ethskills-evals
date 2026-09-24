/**
 * setup.ts: builds (does NOT sign or send) the one-time Safe transaction batch
 * that wires the agent's permissions, and verifies the result on-chain.
 *
 *   tsx setup.ts batch  > safe-batch.json   # import into Safe{Wallet} → Apps → Transaction Builder
 *   tsx setup.ts verify                     # read-only check of the live configuration
 *
 * Env: SAFE_ADDRESS, AGENT_ADDRESS, PRICE_FLOOR_CONDITION, READ_RPC_URL,
 *      WETH_DAILY_CAP (default 60), USDC_DAILY_CAP (default 160000),
 *      PRICE_FLOOR_BPS (default 100), ROLES_SALT_NONCE (default 1)
 *
 * The owners (your hardware wallets) sign this batch. The agent key never signs it.
 */
import {
  type Address,
  type Hex,
  concat,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  formatUnits,
  getAddress,
  getContractAddress,
  http,
  keccak256,
  maxUint256,
  pad,
  parseAbi,
  parseUnits,
  stringToHex,
  toHex,
} from 'viem'
import { mainnet } from 'viem/chains'
import { MAINNET, POOL_FEE, ROLE_KEY, rolesAbi } from './rebalance.ts'

/** Zodiac deployments (same address on every chain). Cross-check against github.com/gnosisguild/zodiac before use. */
export const ZODIAC = {
  MODULE_PROXY_FACTORY: '0x000000000000aDdB49795b0f9bA5BC298cDda236',
  ROLES_V2_MASTERCOPY: '0x9646fDAD06d3e24444381f44362a3B0eB343D337',
} as const satisfies Record<string, Address>

export const ALLOWANCE_KEY = {
  WETH: stringToHex('rebalancer-weth-daily', { size: 32 }),
  USDC: stringToHex('rebalancer-usdc-daily', { size: 32 }),
} as const

const EXACT_INPUT_SINGLE: Hex = '0x414bf389'

const adminAbi = parseAbi([
  'struct ConditionFlat { uint8 parent; uint8 paramType; uint8 operator; bytes compValue; }',
  'function setUp(bytes initParams)',
  'function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)',
  'function scopeTarget(bytes32 roleKey, address targetAddress)',
  'function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, ConditionFlat[] conditions, uint8 options)',
  'function setAllowance(bytes32 key, uint128 balance, uint128 maxRefill, uint128 refill, uint64 period, uint64 timestamp)',
  'function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'function enableModule(address module)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

// Roles v2 enums (contracts/Types.sol)
const P = { None: 0, Static: 1, Dynamic: 2, Tuple: 3, Array: 4, Calldata: 5, AbiEncoded: 6 } as const
const O = { Pass: 0, And: 1, Or: 2, Matches: 5, EqualToAvatar: 15, EqualTo: 16, Custom: 22, WithinAllowance: 28 } as const

type ConditionFlat = { parent: number; paramType: number; operator: number; compValue: Hex }

export type SetupParams = {
  safe: Address
  agent: Address
  priceFloorCondition: Address
  wethDailyCap: bigint
  usdcDailyCap: bigint
  priceFloorBps: number
  rolesSaltNonce: bigint
}

export function rolesInitializer(safe: Address): Hex {
  const initParams = encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }], [safe, safe, safe])
  return encodeFunctionData({ abi: adminAbi, functionName: 'setUp', args: [initParams] })
}

/** CREATE2 address ModuleProxyFactory.deployModule will produce. */
export function predictRolesAddress(safe: Address, saltNonce: bigint): Address {
  const salt = keccak256(encodePacked(['bytes32', 'uint256'], [keccak256(rolesInitializer(safe)), saltNonce]))
  const bytecode = concat(['0x602d8060093d393df3363d3d373d3d3d363d73', ZODIAC.ROLES_V2_MASTERCOPY, '0x5af43d82803e903d91602b57fd5bf3'])
  return getContractAddress({ opcode: 'CREATE2', from: ZODIAC.MODULE_PROXY_FACTORY, salt, bytecode })
}

/**
 * Permission tree for SwapRouter.exactInputSingle, BFS-flattened:
 *   OR(
 *     params == { WETH, USDC, 500, recipient=Safe, deadline:any, amountIn ≤ WETH allowance, minOut ≥ oracle floor, limit:any },
 *     params == { USDC, WETH, 500, recipient=Safe, deadline:any, amountIn ≤ USDC allowance, minOut ≥ oracle floor, limit:any },
 *   )
 * No ETH value, no delegatecall. Every other target/function is denied by default.
 */
export function swapConditions(priceFloorCondition: Address, priceFloorBps: number): ConditionFlat[] {
  const word = (a: Address) => pad(a, { size: 32 })
  const custom = concat([priceFloorCondition, toHex(priceFloorBps, { size: 12 })])
  const fields = (tokenIn: Address, tokenOut: Address, allowanceKey: Hex, parent: number): ConditionFlat[] => [
    { parent, paramType: P.Static, operator: O.EqualTo, compValue: word(tokenIn) },
    { parent, paramType: P.Static, operator: O.EqualTo, compValue: word(tokenOut) },
    { parent, paramType: P.Static, operator: O.EqualTo, compValue: toHex(POOL_FEE, { size: 32 }) },
    { parent, paramType: P.Static, operator: O.EqualToAvatar, compValue: '0x' },
    { parent, paramType: P.Static, operator: O.Pass, compValue: '0x' }, // deadline
    { parent, paramType: P.Static, operator: O.WithinAllowance, compValue: allowanceKey },
    { parent, paramType: P.Static, operator: O.Custom, compValue: custom }, // amountOutMinimum
    { parent, paramType: P.Static, operator: O.Pass, compValue: '0x' }, // sqrtPriceLimitX96
  ]
  return [
    { parent: 0, paramType: P.None, operator: O.Or, compValue: '0x' }, // 0
    { parent: 0, paramType: P.Calldata, operator: O.Matches, compValue: '0x' }, // 1: sell WETH
    { parent: 0, paramType: P.Calldata, operator: O.Matches, compValue: '0x' }, // 2: sell USDC
    { parent: 1, paramType: P.Tuple, operator: O.Matches, compValue: '0x' }, // 3
    { parent: 2, paramType: P.Tuple, operator: O.Matches, compValue: '0x' }, // 4
    ...fields(MAINNET.WETH, MAINNET.USDC, ALLOWANCE_KEY.WETH, 3), // 5-12
    ...fields(MAINNET.USDC, MAINNET.WETH, ALLOWANCE_KEY.USDC, 4), // 13-20
  ]
}

export function buildBatch(p: SetupParams): { to: Address; value: '0'; data: Hex; label: string }[] {
  const roles = predictRolesAddress(p.safe, p.rolesSaltNonce)
  const DAY = 86_400n
  const tx = (to: Address, data: Hex, label: string) => ({ to, value: '0' as const, data, label })
  return [
    tx(ZODIAC.MODULE_PROXY_FACTORY, encodeFunctionData({ abi: adminAbi, functionName: 'deployModule', args: [ZODIAC.ROLES_V2_MASTERCOPY, rolesInitializer(p.safe), p.rolesSaltNonce] }), `deploy Roles modifier at ${roles} (owner=avatar=target=Safe)`),
    tx(p.safe, encodeFunctionData({ abi: adminAbi, functionName: 'enableModule', args: [roles] }), 'enable Roles modifier as a Safe module'),
    tx(roles, encodeFunctionData({ abi: adminAbi, functionName: 'assignRoles', args: [p.agent, [ROLE_KEY], [true]] }), `grant role to agent ${p.agent}`),
    tx(roles, encodeFunctionData({ abi: adminAbi, functionName: 'scopeTarget', args: [ROLE_KEY, MAINNET.SWAP_ROUTER] }), 'scope role to SwapRouter'),
    tx(roles, encodeFunctionData({ abi: adminAbi, functionName: 'scopeFunction', args: [ROLE_KEY, MAINNET.SWAP_ROUTER, EXACT_INPUT_SINGLE, swapConditions(p.priceFloorCondition, p.priceFloorBps), 0] }), 'allow exactInputSingle with conditions'),
    tx(roles, encodeFunctionData({ abi: adminAbi, functionName: 'setAllowance', args: [ALLOWANCE_KEY.WETH, p.wethDailyCap, p.wethDailyCap, p.wethDailyCap, DAY, 0n] }), `WETH sell allowance ${formatUnits(p.wethDailyCap, 18)}/day`),
    tx(roles, encodeFunctionData({ abi: adminAbi, functionName: 'setAllowance', args: [ALLOWANCE_KEY.USDC, p.usdcDailyCap, p.usdcDailyCap, p.usdcDailyCap, DAY, 0n] }), `USDC sell allowance ${formatUnits(p.usdcDailyCap, 6)}/day`),
    tx(MAINNET.WETH, encodeFunctionData({ abi: adminAbi, functionName: 'approve', args: [MAINNET.SWAP_ROUTER, maxUint256] }), 'Safe approves SwapRouter for WETH'),
    tx(MAINNET.USDC, encodeFunctionData({ abi: adminAbi, functionName: 'approve', args: [MAINNET.SWAP_ROUTER, maxUint256] }), 'Safe approves SwapRouter for USDC'),
  ]
}

export function paramsFromEnv(): SetupParams {
  const e = (k: string, d?: string) => {
    const v = process.env[k] ?? d
    if (!v) throw new Error(`missing env ${k}`)
    return v
  }
  return {
    safe: getAddress(e('SAFE_ADDRESS')),
    agent: getAddress(e('AGENT_ADDRESS')),
    priceFloorCondition: getAddress(e('PRICE_FLOOR_CONDITION')),
    wethDailyCap: parseUnits(e('WETH_DAILY_CAP', '60'), 18),
    usdcDailyCap: parseUnits(e('USDC_DAILY_CAP', '160000'), 6),
    priceFloorBps: Number(e('PRICE_FLOOR_BPS', '100')),
    rolesSaltNonce: BigInt(e('ROLES_SALT_NONCE', '1')),
  }
}

async function verify(p: SetupParams) {
  const pc = createPublicClient({ chain: mainnet, transport: http(process.env.READ_RPC_URL) })
  const roles = predictRolesAddress(p.safe, p.rolesSaltNonce)
  const safeAbi = parseAbi(['function getOwners() view returns (address[])', 'function getThreshold() view returns (uint256)', 'function isModuleEnabled(address) view returns (bool)', 'function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)'])
  const erc20 = parseAbi(['function allowance(address,address) view returns (uint256)'])
  const [owners, threshold, enabled, [modules], avatar, target, owner, wA, uA, wApp, uApp] = await Promise.all([
    pc.readContract({ address: p.safe, abi: safeAbi, functionName: 'getOwners' }),
    pc.readContract({ address: p.safe, abi: safeAbi, functionName: 'getThreshold' }),
    pc.readContract({ address: p.safe, abi: safeAbi, functionName: 'isModuleEnabled', args: [roles] }),
    pc.readContract({ address: p.safe, abi: safeAbi, functionName: 'getModulesPaginated', args: ['0x0000000000000000000000000000000000000001', 10n] }),
    pc.readContract({ address: roles, abi: rolesAbi, functionName: 'avatar' }),
    pc.readContract({ address: roles, abi: rolesAbi, functionName: 'target' }),
    pc.readContract({ address: roles, abi: rolesAbi, functionName: 'owner' }),
    pc.readContract({ address: roles, abi: rolesAbi, functionName: 'allowances', args: [ALLOWANCE_KEY.WETH] }),
    pc.readContract({ address: roles, abi: rolesAbi, functionName: 'allowances', args: [ALLOWANCE_KEY.USDC] }),
    pc.readContract({ address: MAINNET.WETH, abi: erc20, functionName: 'allowance', args: [p.safe, MAINNET.SWAP_ROUTER] }),
    pc.readContract({ address: MAINNET.USDC, abi: erc20, functionName: 'allowance', args: [p.safe, MAINNET.SWAP_ROUTER] }),
  ])
  const checks: [string, boolean][] = [
    [`threshold >= 2 (is ${threshold})`, threshold >= 2n],
    ['agent is not a Safe owner', !owners.some((o) => o === p.agent)],
    [`Roles ${roles} enabled on Safe`, enabled],
    [`Roles is the ONLY module (modules: ${modules.join(',')})`, modules.length === 1 && modules[0] === roles],
    ['Roles avatar == target == owner == Safe', avatar === p.safe && target === p.safe && owner === p.safe],
    [`WETH allowance refill ${formatUnits(wA[0], 18)}/${wA[2]}s, balance ${formatUnits(wA[3], 18)}`, wA[0] === p.wethDailyCap && wA[2] === 86_400n],
    [`USDC allowance refill ${formatUnits(uA[0], 6)}/${uA[2]}s, balance ${formatUnits(uA[3], 6)}`, uA[0] === p.usdcDailyCap && uA[2] === 86_400n],
    ['Safe approved SwapRouter for WETH and USDC', wApp > 0n && uApp > 0n],
  ]
  for (const [label, ok] of checks) console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (checks.some(([, ok]) => !ok)) process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2]
  const p = paramsFromEnv()
  if (cmd === 'batch') {
    const txs = buildBatch(p)
    console.error(`Roles modifier will be deployed at ${predictRolesAddress(p.safe, p.rolesSaltNonce)}; set ROLES_MODIFIER to this.`)
    for (const t of txs) console.error(`  - ${t.label}`)
    // Safe{Wallet} Transaction Builder import format.
    console.log(JSON.stringify({
      version: '1.0',
      chainId: '1',
      createdAt: Date.now(),
      meta: { name: 'Treasury rebalancer: Roles setup', description: txs.map((t) => t.label).join('; ') },
      transactions: txs.map(({ to, value, data }) => ({ to, value, data, contractMethod: null, contractInputsValues: null })),
    }, null, 2))
  } else if (cmd === 'verify') {
    await verify(p)
  } else {
    console.error('usage: tsx setup.ts batch|verify')
    process.exit(2)
  }
}
