/**
 * fork-test.ts — end-to-end rehearsal on a local mainnet fork. Must pass before
 * real funds go in (DEPLOY.md step 6).
 *
 *   anvil --fork-url $READ_RPC_URL            # in another terminal
 *   npx tsx fork-test.ts
 *
 * Builds the production topology on the fork: a Safe v1.4.1 treasury, a Roles v2
 * modifier owned by that Safe, the policy from roles-policy.ts, standing Safe
 * approvals to SwapRouter02. Then it runs rebalance.ts as the agent, in both
 * directions, and checks that everything outside the policy reverts.
 * The agent here is an anvil test account instead of KMS.
 */

import {
  type Address,
  type Hex,
  createPublicClient,
  createTestClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  parseAbi,
  parseEther,
  parseUnits,
  zeroAddress,
} from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { readFileSync, rmSync } from 'node:fs'
import {
  MODULE_PROXY_FACTORY,
  ROLES_V2_MASTERCOPY,
  ROLE_KEY,
  SWAP_ROUTER_02,
  USDC,
  WETH,
  rolesAdminAbi,
  setupCalls,
  killSwitchCall,
} from './roles-policy.ts'

const FORK = process.env.FORK_RPC_URL ?? 'http://127.0.0.1:8545'
const SAFE_SINGLETON_141 = getAddress('0x41675C099F32341bf84BFc5382aF534df5C7461a')
const SAFE_PROXY_FACTORY_141 = getAddress('0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67')
const DAI = getAddress('0x6B175474E89094C44Da98b954EedeAC495271d0F')
const CHAINLINK_ETH_USD = getAddress('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419')
const artifact = (name: string) => JSON.parse(readFileSync(`out/${name}.sol/${name}.json`, 'utf8')) // `forge build` first

// anvil's well-known test mnemonic — worthless outside a local fork
const MNEMONIC = 'test test test test test test test test test test test junk'
const owner = mnemonicToAccount(MNEMONIC, { addressIndex: 0 })
const agent = mnemonicToAccount(MNEMONIC, { addressIndex: 1 })
const stranger = mnemonicToAccount(MNEMONIC, { addressIndex: 2 })

const pub = createPublicClient({ chain: mainnet, transport: http(FORK) })
const test = createTestClient({ chain: mainnet, mode: 'anvil', transport: http(FORK) })
const wallet = createWalletClient({ chain: mainnet, transport: http(FORK) })

const abi = parseAbi([
  'function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address)',
  'function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function enableModule(address module)',
  'function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'event ModuleProxyCreation(address indexed proxy, address indexed masterCopy)',
  'function deposit() payable',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool)',
  'struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(P params) payable returns (uint256)',
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
  'constructor(uint256)',
])

let failures = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!ok) failures++
}

async function send(from: Address, to: Address, data: Hex, value = 0n) {
  const hash = await wallet.sendTransaction({ account: from, to, data, value, chain: mainnet })
  const r = await pub.waitForTransactionReceipt({ hash })
  if (r.status !== 'success') throw new Error(`tx to ${to} reverted`)
  return r
}

async function asSafe(safe: Address, to: Address, data: Hex) {
  await test.impersonateAccount({ address: safe })
  await test.setBalance({ address: safe, value: parseEther('1') })
  await send(safe, to, data)
  await test.stopImpersonatingAccount({ address: safe })
}

// Every run leaves the fork exactly as it found it (the test etches over Chainlink).
const snapshot = await test.snapshot()

// ── 1. Safe (1-of-1 here; production is 2-of-3 hardware keys) ────────────────
const setupData = encodeFunctionData({
  abi,
  functionName: 'setup',
  args: [[owner.address], 1n, zeroAddress, '0x', zeroAddress, zeroAddress, 0n, zeroAddress],
})
const salt = BigInt(Date.now())
const { result: safe } = await pub.simulateContract({
  account: owner,
  address: SAFE_PROXY_FACTORY_141,
  abi,
  functionName: 'createProxyWithNonce',
  args: [SAFE_SINGLETON_141, setupData, salt],
})
await wallet.writeContract({ account: owner, address: SAFE_PROXY_FACTORY_141, abi, functionName: 'createProxyWithNonce', args: [SAFE_SINGLETON_141, setupData, salt], chain: mainnet })
  .then((hash) => pub.waitForTransactionReceipt({ hash }))
console.log('safe', safe)

// ── 2. Roles v2 modifier: owner = avatar = target = Safe ────────────────────
const rolesInit = encodeFunctionData({
  abi: rolesAdminAbi,
  functionName: 'setUp',
  args: [encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }], [safe, safe, safe])],
})
const deployReceipt = await send(
  owner.address,
  MODULE_PROXY_FACTORY,
  encodeFunctionData({ abi, functionName: 'deployModule', args: [ROLES_V2_MASTERCOPY, rolesInit, salt] }),
)
const roles = deployReceipt.logs
  .map((l) => { try { return decodeEventLog({ abi, ...l }) } catch { return undefined } })
  .find((e) => e?.eventName === 'ModuleProxyCreation')!.args.proxy as Address
console.log('roles', roles)

// ── 3. Oracle floor condition (stateless, ownerless; anyone may deploy it) ───
await test.setBalance({ address: owner.address, value: parseEther('1000') })
const checkerHash = await wallet.deployContract({
  account: owner,
  chain: mainnet,
  abi: artifact('OracleMinOutCondition').abi,
  bytecode: artifact('OracleMinOutCondition').bytecode.object,
  args: [3900n],
})
const checker = (await pub.waitForTransactionReceipt({ hash: checkerHash })).contractAddress!
console.log('minOut condition', checker)

// ── 4. Owner-side setup, executed by the Safe ───────────────────────────────
await asSafe(safe, safe, encodeFunctionData({ abi, functionName: 'enableModule', args: [roles] }))
for (const data of setupCalls(agent.address, checker)) await asSafe(safe, roles, data)
await asSafe(safe, WETH, encodeFunctionData({ abi, functionName: 'approve', args: [SWAP_ROUTER_02, parseEther('500')] }))
await asSafe(safe, USDC, encodeFunctionData({ abi, functionName: 'approve', args: [SWAP_ROUTER_02, parseUnits('1000000', 6)] }))
await send(owner.address, WETH, encodeFunctionData({ abi, functionName: 'deposit' }), parseEther('100'))
await send(owner.address, WETH, encodeFunctionData({ abi, functionName: 'transfer', args: [safe, parseEther('100')] }))

// ── 5. Run the real execution path ──────────────────────────────────────────
const statePath = `/tmp/rebalance-fork-state-${salt}.json`
Object.assign(process.env, {
  READ_RPC_URL: FORK,
  SUBMIT_RPC_URL: FORK,
  AWS_REGION: 'unused',
  KMS_KEY_ID: 'unused',
  AGENT_ADDRESS: agent.address,
  SAFE_ADDRESS: safe,
  ROLES_MODIFIER_ADDRESS: roles,
  ROLE_KEY,
  STATE_PATH: statePath,
  LOG_PATH: `/tmp/rebalance-fork-log-${salt}.jsonl`,
  HALT_FILE: `/tmp/rebalance-fork-HALT-${salt}`,
})
const { executeRebalance } = await import('./rebalance.ts')

const dry = await executeRebalance({ direction: 'WETH_TO_USDC', amountIn: parseEther('10') }, { account: agent, dryRun: true })
check('dry run simulates', dry.status === 'simulated')

const r1 = await executeRebalance({ direction: 'WETH_TO_USDC', amountIn: parseEther('10'), reason: 'fork-test' }, { account: agent })
check('WETH→USDC executes', r1.status === 'executed', JSON.stringify(r1, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))

const r2 = await executeRebalance({ direction: 'USDC_TO_WETH', amountIn: parseUnits('20000', 6), reason: 'fork-test' }, { account: agent })
check('USDC→WETH executes', r2.status === 'executed')

const r3 = await executeRebalance({ direction: 'WETH_TO_USDC', amountIn: parseEther('21') }, { account: agent })
check('over per-trade cap aborts', r3.status === 'aborted')

// ── 6. Policy boundary: everything outside it must revert ───────────────────
const ethUsd = async () => (await pub.readContract({ address: CHAINLINK_ETH_USD, abi, functionName: 'latestRoundData' }))[1]
const price = await ethUsd()
// WETH→USDC min output at `bps` below Chainlink
const minOutAt = (amountIn: bigint, bps: bigint) => (amountIn * price * (10_000n - bps)) / 10n ** 20n / 10_000n
const swap = (o: Partial<{ tokenIn: Address; tokenOut: Address; fee: number; recipient: Address; amountIn: bigint; amountOutMinimum: bigint; sqrtPriceLimitX96: bigint }>) => {
  const amountIn = o.amountIn ?? parseEther('1')
  return encodeFunctionData({
    abi,
    functionName: 'exactInputSingle',
    args: [{ tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: safe, amountIn, amountOutMinimum: minOutAt(amountIn, 50n), sqrtPriceLimitX96: 0n, ...o }],
  })
}
async function reverts(name: string, from: Address, to: Address, data: Hex, operation = 0, value = 0n) {
  try {
    await pub.simulateContract({ account: from, address: roles, abi, functionName: 'execTransactionWithRole', args: [to, value, data, operation, ROLE_KEY, true] })
    check(`blocked: ${name}`, false, '(call was allowed!)')
  } catch {
    check(`blocked: ${name}`, true)
  }
}
async function allowed(name: string, data: Hex) {
  try {
    await pub.simulateContract({ account: agent, address: roles, abi, functionName: 'execTransactionWithRole', args: [SWAP_ROUTER_02, 0n, data, 0, ROLE_KEY, true] })
    check(`allowed: ${name}`, true)
  } catch (e) {
    check(`allowed: ${name}`, false, (e as Error).message.split('\n').slice(0, 4).join(' | '))
  }
}

await allowed('control: valid 1 WETH swap', swap({}))
await reverts('amountOutMinimum = 0 (self-sandwich)', agent.address, SWAP_ROUTER_02, swap({ amountOutMinimum: 0n }))
await reverts('amountOutMinimum 3% below Chainlink', agent.address, SWAP_ROUTER_02, swap({ amountOutMinimum: minOutAt(parseEther('1'), 300n) }))
await allowed('amountOutMinimum 1.4% below Chainlink (inside 150 bps floor)', swap({ amountOutMinimum: minOutAt(parseEther('1'), 140n) }))
await reverts('amountOutMinimum 1.6% below Chainlink', agent.address, SWAP_ROUTER_02, swap({ amountOutMinimum: minOutAt(parseEther('1'), 160n) }))
await reverts('USDC→WETH with amountOutMinimum = 0', agent.address, SWAP_ROUTER_02, swap({ tokenIn: USDC, tokenOut: WETH, amountIn: parseUnits('5000', 6), amountOutMinimum: 0n }))
await reverts('recipient = agent', agent.address, SWAP_ROUTER_02, swap({ recipient: agent.address }))
await reverts('tokenOut = DAI', agent.address, SWAP_ROUTER_02, swap({ tokenOut: DAI }))
await reverts('fee tier 3000', agent.address, SWAP_ROUTER_02, swap({ fee: 3000 }))
await reverts('amountIn 21 WETH (> per-trade cap)', agent.address, SWAP_ROUTER_02, swap({ amountIn: parseEther('21') }))
await reverts('WETH.transfer(agent)', agent.address, WETH, encodeFunctionData({ abi, functionName: 'transfer', args: [agent.address, 1n] }))
await reverts('WETH.approve(agent)', agent.address, WETH, encodeFunctionData({ abi, functionName: 'approve', args: [agent.address, 1n] }))
await reverts('delegatecall to router', agent.address, SWAP_ROUTER_02, swap({}), 1)
await reverts('sending ETH value', agent.address, SWAP_ROUTER_02, swap({}), 0, 1n)
await reverts('non-member caller', stranger.address, SWAP_ROUTER_02, swap({}))

// Daily allowance: 10 WETH used above, cap 60. Two 18-WETH swaps fit (46), a third must not (64).
for (const i of [1, 2]) {
  const r = await executeRebalance({ direction: 'WETH_TO_USDC', amountIn: parseEther('18') }, { account: agent })
  check(`18 WETH swap #${i} within daily allowance`, r.status === 'executed')
}
await reverts('18 WETH beyond daily WETH allowance', agent.address, SWAP_ROUTER_02, swap({ amountIn: parseEther('18') }))
await test.increaseTime({ seconds: 86_400 })
await test.mine({ blocks: 1 })
await reverts('stale Chainlink (fork clock +24h) fails closed', agent.address, SWAP_ROUTER_02, swap({ amountIn: parseEther('18') }))
// Etch a fresh-timestamp feed at the same price over the real one, then retry.
const mockHash = await wallet.deployContract({ account: owner, chain: mainnet, abi: artifact('MockAggregator').abi, bytecode: artifact('MockAggregator').bytecode.object, args: [price] })
const mock = (await pub.waitForTransactionReceipt({ hash: mockHash })).contractAddress!
await test.setCode({ address: CHAINLINK_ETH_USD, bytecode: (await pub.getCode({ address: mock }))! })
await allowed('allowance refills after 24h', swap({ amountIn: parseEther('18') }))

// Kill switch
await asSafe(safe, roles, killSwitchCall())
await reverts('any swap after kill switch', agent.address, SWAP_ROUTER_02, swap({}))

const [wethBal, usdcBal] = await Promise.all([
  pub.readContract({ address: WETH, abi, functionName: 'balanceOf', args: [safe] }),
  pub.readContract({ address: USDC, abi, functionName: 'balanceOf', args: [safe] }),
])
console.log(`\nSafe ends with ${Number(wethBal) / 1e18} WETH, ${Number(usdcBal) / 1e6} USDC`)
rmSync(statePath, { force: true })
await test.revert({ id: snapshot })
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
