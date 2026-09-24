/**
 * fork-test.ts: end-to-end test on a local mainnet fork. No real keys, no real funds.
 *
 *   anvil --fork-url $MAINNET_RPC --chain-id 1 &
 *   npm run build:contracts && tsx fork-test.ts
 *
 * Builds a 2-of-3 Safe, deploys PriceFloorCondition, applies the EXACT batch from
 * setup.ts (as the Safe), funds it, runs executeRebalance() through the real
 * code path, then tries everything a stolen agent key would try.
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseAbi,
  parseEther,
  parseEventLogs,
  parseUnits,
  zeroAddress,
} from 'viem'
import { mainnet } from 'viem/chains'
import { MAINNET, ROLE_KEY, loadConfig, executeRebalance, rolesAbi, swapRouterAbi } from './rebalance.ts'
import { buildBatch, predictRolesAddress, type SetupParams } from './setup.ts'

const RPC = process.env.FORK_RPC ?? 'http://127.0.0.1:8545'
const pc = createPublicClient({ chain: mainnet, transport: http(RPC) })
const rpc = (method: string, params: unknown[]) => pc.request({ method: method as any, params: params as any })
const walletFor = (account: Address) => createWalletClient({ account, chain: mainnet, transport: http(RPC) })

const SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a'
const SAFE_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const SAFE_FALLBACK = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99'
const OWNERS: Address[] = ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC']
const AGENT: Address = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
const ATTACKER: Address = '0x000000000000000000000000000000000000bEEF'

let failures = 0
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

async function asImpersonated(from: Address, to: Address, data: Hex, value = 0n) {
  await rpc('anvil_impersonateAccount', [from])
  await rpc('anvil_setBalance', [from, '0x' + parseEther('1000').toString(16)])
  const hash = await walletFor(from).sendTransaction({ to, data, value, gas: 5_000_000n })
  const r = await pc.waitForTransactionReceipt({ hash })
  if (r.status !== 'success') throw new Error(`tx as ${from} to ${to} reverted`)
  return r
}

async function main() {
  if (!String(await rpc('web3_clientVersion', [])).toLowerCase().includes('anvil')) throw new Error('not anvil')
  if ((await pc.getChainId()) !== 1) throw new Error('start anvil with --chain-id 1')

  // 1. Safe v1.4.1, 2-of-3 (stand-ins for your hardware wallets)
  const safeAbi = parseAbi([
    'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
    'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
    'event ProxyCreation(address indexed proxy, address singleton)',
  ])
  const init = encodeFunctionData({ abi: safeAbi, functionName: 'setup', args: [OWNERS, 2n, zeroAddress, '0x', SAFE_FALLBACK, zeroAddress, 0n, zeroAddress] })
  const r = await asImpersonated(OWNERS[0], SAFE_FACTORY, encodeFunctionData({ abi: safeAbi, functionName: 'createProxyWithNonce', args: [SAFE_SINGLETON, init, BigInt(Date.now())] }))
  const safe = parseEventLogs({ abi: safeAbi, logs: r.logs, eventName: 'ProxyCreation' })[0].args.proxy
  console.log('Safe', safe)

  // 2. PriceFloorCondition
  const art = JSON.parse(readFileSync('contracts/out/PriceFloorCondition.sol/PriceFloorCondition.json', 'utf8'))
  await rpc('anvil_impersonateAccount', [OWNERS[0]])
  const dh = await walletFor(OWNERS[0]).deployContract({ abi: art.abi, bytecode: art.bytecode.object, gas: 3_000_000n })
  const priceFloor = (await pc.waitForTransactionReceipt({ hash: dh })).contractAddress!
  console.log('PriceFloorCondition', priceFloor)

  // 3. Apply the setup batch as the Safe (in production: owners sign it in Safe{Wallet})
  const params: SetupParams = { safe, agent: AGENT, priceFloorCondition: priceFloor, wethDailyCap: parseEther('60'), usdcDailyCap: parseUnits('160000', 6), priceFloorBps: 100, rolesSaltNonce: 1n }
  for (const t of buildBatch(params)) await asImpersonated(safe, t.to, t.data)
  const roles = predictRolesAddress(safe, 1n)
  check('Roles deployed at predicted address', ((await pc.getCode({ address: roles })) ?? '0x').length > 2, roles)

  // 4. Fund the Safe: 100 WETH, then swap 50 WETH -> USDC (as the Safe directly, i.e. an owner tx)
  const wethAbi = parseAbi(['function deposit() payable', 'function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'])
  await asImpersonated(safe, MAINNET.WETH, encodeFunctionData({ abi: wethAbi, functionName: 'deposit' }), parseEther('100'))
  const now = (await pc.getBlock()).timestamp
  await asImpersonated(safe, MAINNET.SWAP_ROUTER, encodeFunctionData({ abi: swapRouterAbi, functionName: 'exactInputSingle', args: [{ tokenIn: MAINNET.WETH, tokenOut: MAINNET.USDC, fee: 500, recipient: safe, deadline: now + 600n, amountIn: parseEther('50'), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }] }))
  const bal = async (t: Address) => pc.readContract({ address: t, abi: wethAbi, functionName: 'balanceOf', args: [safe] })
  console.log('Safe balances  WETH', (await bal(MAINNET.WETH)).toString(), ' USDC', (await bal(MAINNET.USDC)).toString())
  await rpc('anvil_setBalance', [AGENT, '0x' + parseEther('1').toString(16)])

  // 5. Happy path through executeRebalance()
  Object.assign(process.env, {
    SAFE_ADDRESS: safe, ROLES_MODIFIER: roles, AGENT_ADDRESS: AGENT, READ_RPC_URL: RPC, SIGNER: 'fork-impersonate',
    STATE_DIR: mkdtempSync(join(tmpdir(), 'rebal-')), MAX_BASE_FEE_GWEI: '1000',
  })
  process.env.KILL_SWITCH_FILE = join(process.env.STATE_DIR!, 'PAUSE')
  const cfg = loadConfig()

  const w0 = await bal(MAINNET.WETH), u0 = await bal(MAINNET.USDC)
  const r1 = await executeRebalance({ id: 'fork-1', sell: 'WETH', amountIn: parseEther('5'), reason: 'fork test' }, { cfg })
  check('sell 5 WETH confirmed', r1.status === 'confirmed', JSON.stringify(r1, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
  check('Safe WETH -5, USDC up', (await bal(MAINNET.WETH)) === w0 - parseEther('5') && (await bal(MAINNET.USDC)) > u0)

  const r2 = await executeRebalance({ id: 'fork-2', sell: 'USDC', amountIn: parseUnits('20000', 6), reason: 'fork test' }, { cfg })
  check('sell 20k USDC confirmed', r2.status === 'confirmed')

  const r3 = await executeRebalance({ id: 'fork-1', sell: 'WETH', amountIn: parseEther('5'), reason: 'replay' }, { cfg })
  check('replayed decision id is skipped', r3.status === 'skipped', r3.status)

  const r4 = await executeRebalance({ id: 'fork-4', sell: 'USDC', amountIn: parseUnits('60000', 6), reason: 'too big' }, { cfg })
  check('trade above MAX_TRADE_USD aborted off-chain', r4.status === 'aborted', 'reason' in r4 ? r4.reason : '')

  const r5 = await executeRebalance({ id: 'fork-5', sell: 'WETH', amountIn: parseEther('1'), reason: 'dry' }, { cfg, dryRun: true })
  check('dry-run simulates without sending', r5.status === 'dry-run')

  // 6. Stolen-key scenarios: the agent calling Roles directly with hostile calldata.
  const block = await pc.getBlock()
  const swap = (o: Partial<{ tokenIn: Address; tokenOut: Address; fee: number; recipient: Address; amountIn: bigint; amountOutMinimum: bigint }>) =>
    encodeFunctionData({ abi: swapRouterAbi, functionName: 'exactInputSingle', args: [{ tokenIn: MAINNET.WETH, tokenOut: MAINNET.USDC, fee: 500, recipient: safe, deadline: block.timestamp + 600n, amountIn: parseEther('1'), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n, ...o }] })
  const viaRoles = (to: Address, data: Hex, operation = 0) =>
    encodeFunctionData({ abi: rolesAbi, functionName: 'execTransactionWithRole', args: [to, 0n, data, operation, ROLE_KEY, true] })
  const allowed = async (from: Address, data: Hex) => pc.call({ account: from, to: roles, data }).then(() => true, () => false)

  const [, answer] = await pc.readContract({ address: MAINNET.CHAINLINK_ETH_USD, abi: parseAbi(['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)']), functionName: 'latestRoundData' })
  const fair1Eth = (parseEther('1') * answer) / 10n ** 20n
  const at = (bps: bigint) => (fair1Eth * (10_000n - bps)) / 10_000n

  check('stolen key: minOut 0.5% under oracle ALLOWED (sanity)', await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ amountOutMinimum: at(50n) }))))
  check('stolen key: amountOutMinimum = 0 BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ amountOutMinimum: 0n })))))
  check('stolen key: minOut 3% under oracle BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ amountOutMinimum: at(300n) })))))
  check('stolen key: recipient = attacker BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ recipient: ATTACKER, amountOutMinimum: at(50n) })))))
  check('stolen key: fee tier 3000 BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ fee: 3000, amountOutMinimum: at(50n) })))))
  check('stolen key: WETH -> other token BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ tokenOut: '0x6B175474E89094C44Da98b954EedeAC495271d0F', amountOutMinimum: 1n })))))
  check('stolen key: 61 WETH (> daily allowance) BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ amountIn: parseEther('61'), amountOutMinimum: at(50n) * 61n })))))
  check('stolen key: WETH.transfer to attacker BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.WETH, encodeFunctionData({ abi: wethAbi, functionName: 'transfer', args: [ATTACKER, 1n] })))))
  check('stolen key: delegatecall BLOCKED', !(await allowed(AGENT, viaRoles(MAINNET.SWAP_ROUTER, swap({ amountOutMinimum: at(50n) }), 1))))
  const rolesAdmin = parseAbi(['function assignRoles(address,bytes32[],bool[])'])
  check('stolen key: grant itself more roles BLOCKED', !(await pc.call({ account: AGENT, to: roles, data: encodeFunctionData({ abi: rolesAdmin, functionName: 'assignRoles', args: [ATTACKER, [ROLE_KEY], [true]] }) }).then(() => true, () => false)))
  check('non-member address BLOCKED', !(await allowed(ATTACKER, viaRoles(MAINNET.SWAP_ROUTER, swap({ amountOutMinimum: at(50n) })))))

  // 7. Allowance accounting: 5 WETH were used by the happy path.
  const [, , , wBal] = await pc.readContract({ address: roles, abi: rolesAbi, functionName: 'allowances', args: [stringKey('rebalancer-weth-daily')] })
  check('on-chain WETH allowance decremented to 55', wBal === parseEther('55'), wBal.toString())

  // 8. Owners pull the plug: disable the module -> agent is dead.
  const disable = parseAbi(['function disableModule(address prevModule, address module)'])
  await asImpersonated(safe, safe, encodeFunctionData({ abi: disable, functionName: 'disableModule', args: ['0x0000000000000000000000000000000000000001', roles] }))
  const r6 = await executeRebalance({ id: 'fork-6', sell: 'WETH', amountIn: parseEther('1'), reason: 'after revoke' }, { cfg })
  check('after owners disable module, agent cannot trade', r6.status === 'aborted', 'reason' in r6 ? r6.reason : '')

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
  process.exit(failures === 0 ? 0 : 1)
}

function stringKey(s: string) {
  return ('0x' + Buffer.from(s).toString('hex').padEnd(64, '0')) as Hex
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
