/**
 * fork-test.ts — end-to-end rehearsal on an anvil mainnet fork. Nothing touches mainnet.
 *
 *   anvil --fork-url $RPC_URL --chain-id 1 --port 8545
 *   npx tsx fork-test.ts
 *
 * Deploys a real Safe 1.4.1 and a real Roles v2 proxy from the mainnet factories, applies
 * roles-policy.ts exactly as the owners would, then drives rebalance.ts against it.
 * The Safe is impersonated here only to stand in for the owners' 2-of-3 signatures.
 */

import { type Address, createTestClient, createPublicClient, encodeFunctionData, encodeAbiParameters, http, parseAbi, parseEther, parseUnits, getAddress, zeroAddress, publicActions, walletActions } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { buildRevokeTransactions, buildSetupTransactions, MODULE_PROXY_FACTORY, ROLES_V2_MASTERCOPY, ROLE_KEY, SWAP_ROUTER_02, USDC, WETH, rolesAdminAbi } from './roles-policy.ts'

const ANVIL = process.env.ANVIL_URL ?? 'http://127.0.0.1:8545'
const SAFE_PROXY_FACTORY_141: Address = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const SAFE_SINGLETON_141: Address = '0x41675C099F32341bf84BFc5382aF534df5C7461a'
const COMPAT_FALLBACK_141: Address = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99'

const client = createTestClient({ chain: mainnet, mode: 'anvil', transport: http(ANVIL) }).extend(publicActions).extend(walletActions)
const funder = privateKeyToAccount(generatePrivateKey())

async function asAccount(from: Address, to: Address, data: `0x${string}`, value = 0n) {
  await client.impersonateAccount({ address: from })
  const hash = await client.sendTransaction({ account: from, to, data, value, chain: mainnet })
  const r = await client.waitForTransactionReceipt({ hash })
  await client.stopImpersonatingAccount({ address: from })
  if (r.status !== 'success') throw new Error(`tx from ${from} to ${to} reverted`)
}

function assert(cond: unknown, msg: string) { if (!cond) throw new Error('ASSERTION FAILED: ' + msg); console.log('  ok -', msg) }

async function main() {
  await client.setBalance({ address: funder.address, value: parseEther('1000') })

  // 1. Safe 1.4.1, 2-of-3 owners (stand-ins for three hardware wallets).
  const owners = [0, 1, 2].map(() => privateKeyToAccount(generatePrivateKey()).address)
  const setup = encodeFunctionData({
    abi: parseAbi(['function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)']),
    functionName: 'setup', args: [owners, 2n, zeroAddress, '0x', COMPAT_FALLBACK_141, zeroAddress, 0n, zeroAddress],
  })
  const factoryAbi = parseAbi(['function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address)'])
  const salt = BigInt(Date.now())
  const { result: safe, request } = await client.simulateContract({ account: funder, address: SAFE_PROXY_FACTORY_141, abi: factoryAbi, functionName: 'createProxyWithNonce', args: [SAFE_SINGLETON_141, setup, salt] })
  await client.waitForTransactionReceipt({ hash: await client.writeContract(request) })
  console.log('Safe', safe)

  // 2. Roles v2 proxy, owner = avatar = target = Safe.
  const setUpData = encodeFunctionData({ abi: rolesAdminAbi, functionName: 'setUp', args: [encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }], [safe, safe, safe])] })
  const mpfAbi = parseAbi(['function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address proxy)'])
  const dep = await client.simulateContract({ account: funder, address: MODULE_PROXY_FACTORY, abi: mpfAbi, functionName: 'deployModule', args: [ROLES_V2_MASTERCOPY, setUpData, salt] })
  await client.waitForTransactionReceipt({ hash: await client.writeContract(dep.request) })
  const roles = dep.result
  console.log('Roles', roles)

  // 3. Fund the Safe: 100 WETH, then swap 40 WETH → USDC so both sides exist.
  await client.setBalance({ address: safe, value: parseEther('101') })
  await asAccount(safe, WETH, encodeFunctionData({ abi: parseAbi(['function deposit() payable']), functionName: 'deposit' }), parseEther('100'))

  // 4. Agent key: random, fork-only. Gas float only.
  const agentKey = generatePrivateKey()
  const agent = privateKeyToAccount(agentKey).address
  await client.setBalance({ address: agent, value: parseEther('0.1') })

  // 5. Owners apply the policy (20 WETH/day, 60k USDC/day).
  for (const tx of buildSetupTransactions({ safe, roles, agent, wethPerDay: parseUnits('20', 18), usdcPerDay: parseUnits('60000', 6) })) {
    await asAccount(safe, tx.to, tx.data)
    console.log('  applied:', tx.description)
  }
  const swapAbi = parseAbi(['function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) returns (uint256)'])
  await asAccount(safe, SWAP_ROUTER_02, encodeFunctionData({ abi: swapAbi, functionName: 'exactInputSingle', args: [[WETH, USDC, 500, safe, parseEther('40'), 0n, 0n]] }))

  Object.assign(process.env, {
    RPC_URL: ANVIL, PRIVATE_TX_RPC_URL: ANVIL, AGENT_PRIVATE_KEY: agentKey, SAFE_ADDRESS: safe,
    ROLES_MODIFIER_ADDRESS: roles, ROLE_KEY, AUTONOMOUS: '1', MAX_FEE_GWEI: '500',
    STATE_FILE: '/tmp/fork-rebalance-state.json', LOCK_FILE: '/tmp/fork-rebalance.lock',
  })
  const { verifyPolicy, executeRebalance } = await import('./rebalance.ts')
  const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)'])
  const bal = (t: Address) => client.readContract({ address: t, abi: erc20, functionName: 'balanceOf', args: [safe] })

  console.log('\n== verify-policy')
  assert(await verifyPolicy(), 'every forbidden call is rejected by Roles; allowed swaps pass')

  console.log('\n== WETH→USDC 5 WETH')
  const u0 = await bal(USDC)
  const r1 = await executeRebalance({ direction: 'WETH_TO_USDC', amountIn: parseEther('5'), signalId: 't1' })
  assert(r1.status === 'executed', `executed (${r1.reason ?? r1.txHash})`)
  assert((await bal(USDC)) - u0 === r1.amountOut, 'USDC proceeds landed in the Safe')

  console.log('\n== USDC→WETH 20,000 USDC')
  const r2 = await executeRebalance({ direction: 'USDC_TO_WETH', amountIn: parseUnits('20000', 6), signalId: 't2' })
  assert(r2.status === 'executed', `executed (${r2.reason ?? r2.txHash})`)

  console.log('\n== 16 WETH (only 15 left in today\'s allowance)')
  const r3 = await executeRebalance({ direction: 'WETH_TO_USDC', amountIn: parseEther('16'), signalId: 't3' })
  assert(r3.status === 'aborted' && !r3.txHash && r3.reason?.includes('Roles policy rejected'), `blocked by on-chain allowance before signing (${r3.reason})`)

  console.log('\n== over MAX_TRADE_USD')
  const r4 = await executeRebalance({ direction: 'USDC_TO_WETH', amountIn: parseUnits('55000', 6), signalId: 't4' })
  assert(r4.status === 'aborted' && r4.reason?.includes('MAX_TRADE_USD'), 'off-chain per-trade cap')

  console.log('\n== next day: allowance refilled (policy-level check)')
  await client.increaseTime({ seconds: 86_400 }); await client.mine({ blocks: 1 })
  const execAbi = parseAbi(['function execTransactionWithRole(address,uint256,bytes,uint8,bytes32,bool) returns (bool)'])
  const sixteen = encodeFunctionData({ abi: swapAbi, functionName: 'exactInputSingle', args: [[WETH, USDC, 500, safe, parseEther('16'), 0n, 0n]] })
  await client.simulateContract({ account: agent, address: roles, abi: execAbi, functionName: 'execTransactionWithRole', args: [SWAP_ROUTER_02, 0n, sixteen, 0, ROLE_KEY, true] })
  assert(true, '16 WETH allowed again after the 24h refill')

  console.log('\n== owners evict the agent (no agent cooperation)')
  for (const tx of buildRevokeTransactions({ roles, agent })) await asAccount(safe, tx.to, tx.data)
  // Same call that was allowed a moment ago must now be rejected by Roles itself.
  const afterRevoke = await client.simulateContract({ account: agent, address: roles, abi: execAbi, functionName: 'execTransactionWithRole', args: [SWAP_ROUTER_02, 0n, sixteen, 0, ROLE_KEY, true] }).then(() => 'allowed', () => 'rejected')
  assert(afterRevoke === 'rejected', 'revoked agent cannot trade (rejected on-chain by Roles)')

  console.log('\n== preflight refuses if the agent is a Safe owner')
  await asAccount(safe, safe, encodeFunctionData({ abi: parseAbi(['function addOwnerWithThreshold(address,uint256)']), functionName: 'addOwnerWithThreshold', args: [agent, 2n] }))
  const r7 = await executeRebalance({ direction: 'WETH_TO_USDC', amountIn: parseEther('1'), signalId: 't7' })
  assert(r7.status === 'aborted' && r7.reason?.includes('Safe owner'), 'refuses to run with unbounded authority')

  console.log('\nALL FORK TESTS PASSED', getAddress(safe))
}

main().catch((e) => { console.error(e); process.exit(1) })
