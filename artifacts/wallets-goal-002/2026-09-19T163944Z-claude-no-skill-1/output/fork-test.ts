/**
 * fork-test.ts — end-to-end rehearsal on a local mainnet fork.
 *
 *   anvil --fork-url $MAINNET_RPC --chain-id 1 --port 8545 &
 *   npx tsx fork-test.ts
 *
 * Deploys a real Safe v1.4.1 + Zodiac Roles v2 proxy on the fork, applies the
 * exact permission batch from roles-setup.ts, funds the Safe, then:
 *   - runs executeRebalance() both directions through the real pool
 *   - checks idempotency
 *   - checks that the agent key CANNOT: send proceeds elsewhere, approve,
 *     transfer, use another fee tier, exceed its daily allowance
 *   - checks that use of the agent key outside the bot triggers HALT
 *   - checks the KMS DER → Ethereum signature conversion
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { rmSync, existsSync } from 'node:fs'
import {
  type Address,
  type Hex,
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  http,
  keccak256,
  parseAbi,
  parseEther,
  parseEventLogs,
  parseUnits,
  toHex,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { buildSetupCalls, SWAP_ROUTER, USDC, WETH } from './roles-setup.js'

const RPC = process.env.FORK_RPC ?? 'http://127.0.0.1:8545'
const OWNER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // anvil #0
const AGENT_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' // anvil #1
const SAFE_PROXY_FACTORY: Address = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const SAFE_SINGLETON_141: Address = '0x41675C099F32341bf84BFc5382aF534df5C7461a'
const MODULE_PROXY_FACTORY: Address = '0x000000000000aDdB49795b0f9bA5BC298cDda236'
const ROLES_V2_MASTERCOPY: Address = '0x9646fDAD06d3e24444381f44362a3B0eB343D337'
const ROLE_KEY = keccak256(toHex('rebalancer'))
const ATTACKER: Address = '0x000000000000000000000000000000000000dEaD'

const owner = privateKeyToAccount(OWNER_PK)
const agent = privateKeyToAccount(AGENT_PK)
const pub = createPublicClient({ chain: mainnet, transport: http(RPC) })
const test = createTestClient({ chain: mainnet, mode: 'anvil', transport: http(RPC) })
const ownerWallet = createWalletClient({ account: owner, chain: mainnet, transport: http(RPC) })
const agentWallet = createWalletClient({ account: agent, chain: mainnet, transport: http(RPC) })

const safeAbi = parseAbi([
  'function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function enableModule(address module)',
  'function getOwners() view returns (address[])',
])
const factoryAbi = parseAbi([
  'function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'event ProxyCreation(address indexed proxy, address singleton)',
])
const moduleFactoryAbi = parseAbi([
  'function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address proxy)',
  'event ModuleProxyCreation(address indexed proxy, address indexed masterCopy)',
])
const rolesAbi = parseAbi([
  'function setUp(bytes initParams)',
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool)',
])
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)',
])
const wethAbi = parseAbi(['function deposit() payable'])
const routerAbi = parseAbi([
  'struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }',
  'function exactInputSingle(P params) payable returns (uint256)',
])

let failures = 0
function check(cond: boolean, msg: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failures++
}

async function send(wallet: typeof ownerWallet, tx: { to: Address; data?: Hex; value?: bigint }) {
  const hash = await wallet.sendTransaction(tx)
  return pub.waitForTransactionReceipt({ hash })
}

async function asSafe(safe: Address, to: Address, data: Hex) {
  await test.impersonateAccount({ address: safe })
  await test.setBalance({ address: safe, value: parseEther('1') })
  const hash = await pub.request({
    method: 'eth_sendTransaction',
    params: [{ from: safe, to, data }],
  } as any)
  const r = await pub.waitForTransactionReceipt({ hash: hash as Hex })
  if (r.status !== 'success') throw new Error(`Safe call to ${to} reverted`)
  await test.stopImpersonatingAccount({ address: safe })
}

/** Agent calls Roles directly (bypassing the bot) — should be rejected by the permission. */
async function agentAttempt(roles: Address, to: Address, data: Hex): Promise<boolean> {
  try {
    await pub.call({
      account: agent.address,
      to: roles,
      data: encodeFunctionData({ abi: rolesAbi, functionName: 'execTransactionWithRole', args: [to, 0n, data, 0, ROLE_KEY, true] }),
    })
    return true
  } catch {
    return false
  }
}

function swapData(p: { tokenIn: Address; tokenOut: Address; fee?: number; recipient: Address; amountIn: bigint }) {
  return encodeFunctionData({
    abi: routerAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: p.tokenIn,
        tokenOut: p.tokenOut,
        fee: p.fee ?? 500,
        recipient: p.recipient,
        deadline: 2n ** 40n,
        amountIn: p.amountIn,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
}

async function main() {
  // ── KMS DER signature conversion (offline) ─────────────────────────────
  const { derToEthSignature } = await import('./rebalance.js')
  let sigOk = 0
  for (let i = 0; i < 20; i++) {
    const hash = keccak256(toHex(`msg-${i}`))
    // alternate high-s / low-s to exercise normalization, as KMS returns either
    const der = secp256k1.sign(hash.slice(2), AGENT_PK.slice(2), { lowS: i % 2 === 0 }).toDERRawBytes()
    const eth = await derToEthSignature(der, hash, agent.address)
    const ref = await agent.sign({ hash })
    if (BigInt(eth.r) === BigInt(ref.slice(0, 66)) && BigInt(eth.s) === BigInt('0x' + ref.slice(66, 130))) sigOk++
  }
  check(sigOk === 20, `KMS DER → Ethereum signature matches viem's signer (${sigOk}/20)`)

  // ── Deploy Safe (1-of-1 owner for the test; production is 2-of-3 hardware) ──
  const initializer = encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [[owner.address], 1n, zeroAddress, '0x', zeroAddress, zeroAddress, 0n, zeroAddress],
  })
  const r1 = await send(ownerWallet, {
    to: SAFE_PROXY_FACTORY,
    data: encodeFunctionData({ abi: factoryAbi, functionName: 'createProxyWithNonce', args: [SAFE_SINGLETON_141, initializer, BigInt(Date.now())] }),
  })
  const safe = parseEventLogs({ abi: factoryAbi, logs: r1.logs, eventName: 'ProxyCreation' })[0].args.proxy
  console.log('Safe', safe)

  // ── Deploy Roles v2 proxy: owner = avatar = target = Safe ──────────────
  const rolesInit = encodeFunctionData({
    abi: rolesAbi,
    functionName: 'setUp',
    args: [encodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }], [safe, safe, safe])],
  })
  const r2 = await send(ownerWallet, {
    to: MODULE_PROXY_FACTORY,
    data: encodeFunctionData({ abi: moduleFactoryAbi, functionName: 'deployModule', args: [ROLES_V2_MASTERCOPY, rolesInit, BigInt(Date.now())] }),
  })
  const roles = parseEventLogs({ abi: moduleFactoryAbi, logs: r2.logs, eventName: 'ModuleProxyCreation' })[0].args.proxy
  console.log('Roles', roles)

  // ── Safe enables module + applies the permission batch ─────────────────
  // (On mainnet these are Safe transactions signed by the owners; here we impersonate the Safe.)
  await asSafe(safe, safe, encodeFunctionData({ abi: safeAbi, functionName: 'enableModule', args: [roles] }))
  const block = await pub.getBlock()
  for (const c of buildSetupCalls({
    roles,
    agent: agent.address,
    roleKey: ROLE_KEY,
    usdcPerDay: parseUnits('60000', 6),
    wethPerDay: parseUnits('20', 18),
    usdcPerTrade: parseUnits('55000', 6),
    wethPerTrade: parseUnits('22', 18),
    nowSec: block.timestamp,
  })) {
    await asSafe(safe, c.to, c.data)
  }

  // ── Fund the Safe with 60 WETH ─────────────────────────────────────────
  await send(ownerWallet, { to: WETH, data: encodeFunctionData({ abi: wethAbi, functionName: 'deposit' }), value: parseEther('60') })
  await send(ownerWallet, { to: WETH, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [safe, parseEther('60')] }) })

  // ── Run the bot ────────────────────────────────────────────────────────
  const stateDir = './state-fork-test'
  rmSync(stateDir, { recursive: true, force: true })
  Object.assign(process.env, {
    RPC_URL: RPC,
    SIGNER: 'local-fork',
    FORK_PRIVATE_KEY: AGENT_PK,
    SAFE_ADDRESS: safe,
    ROLES_MODIFIER_ADDRESS: roles,
    ROLE_KEY,
    STATE_DIR: stateDir,
  })
  const { executeRebalance } = await import('./rebalance.js')

  const bal = async (t: Address) => pub.readContract({ address: t, abi: erc20Abi, functionName: 'balanceOf', args: [safe] })

  const dry = await executeRebalance({ id: 'dry-1', side: 'SELL_WETH', usdNotional: 25_000 }, { dryRun: true })
  check(dry.status === 'dry-run', `dry run simulates cleanly (${dry.status})`)

  const w0 = await bal(WETH)
  const sell = await executeRebalance({ id: 'd-1', side: 'SELL_WETH', usdNotional: 25_000 })
  const u1 = await bal(USDC)
  check(sell.status === 'filled', `SELL_WETH $25k filled (${sell.status})`)
  console.log(`      Safe: WETH ${formatUnits(w0, 18)} → ${formatUnits(await bal(WETH), 18)}, USDC 0 → ${formatUnits(u1, 6)}`)

  const again = await executeRebalance({ id: 'd-1', side: 'SELL_WETH', usdNotional: 25_000 })
  check(again.status === 'skipped', 'same decision id is not executed twice')

  const buy = await executeRebalance({ id: 'd-2', side: 'BUY_WETH', usdNotional: 20_000 })
  check(buy.status === 'filled', `BUY_WETH $20k filled (${buy.status})`)
  console.log(`      Safe: USDC ${formatUnits(u1, 6)} → ${formatUnits(await bal(USDC), 6)}, WETH → ${formatUnits(await bal(WETH), 18)}`)

  let threw = false
  try {
    await executeRebalance({ id: 'd-3', side: 'SELL_WETH', usdNotional: 75_000 })
  } catch {
    threw = true
  }
  check(threw, 'off-chain policy rejects a $75k trade')

  // ── What a stolen agent key can and cannot do (on-chain permission) ────
  const amt = parseEther('1')
  check(await agentAttempt(roles, SWAP_ROUTER, swapData({ tokenIn: WETH, tokenOut: USDC, recipient: safe, amountIn: amt })), 'agent CAN: swap WETH→USDC to the Safe')
  check(!(await agentAttempt(roles, SWAP_ROUTER, swapData({ tokenIn: WETH, tokenOut: USDC, recipient: ATTACKER, amountIn: amt }))), 'agent CANNOT: swap with proceeds to another address')
  check(!(await agentAttempt(roles, SWAP_ROUTER, swapData({ tokenIn: WETH, tokenOut: USDC, fee: 3000, recipient: safe, amountIn: amt }))), 'agent CANNOT: use a different fee tier / pool')
  check(!(await agentAttempt(roles, SWAP_ROUTER, swapData({ tokenIn: WETH, tokenOut: WETH, recipient: safe, amountIn: amt }))), 'agent CANNOT: mix token pairs')
  check(!(await agentAttempt(roles, WETH, encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [ATTACKER, amt] }))), 'agent CANNOT: transfer WETH out')
  check(!(await agentAttempt(roles, USDC, encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ATTACKER, 2n ** 255n] }))), 'agent CANNOT: approve a spender')
  check(!(await agentAttempt(roles, SWAP_ROUTER, swapData({ tokenIn: USDC, tokenOut: WETH, recipient: safe, amountIn: parseUnits('56000', 6) }))), 'agent CANNOT: exceed the per-trade cap (55k USDC)')
  // 20 WETH/day allowance, ~9.4 WETH already spent by d-1 → 12 WETH (under the 22 WETH per-trade cap) must fail
  check(!(await agentAttempt(roles, SWAP_ROUTER, swapData({ tokenIn: WETH, tokenOut: USDC, recipient: safe, amountIn: parseEther('12') }))), 'agent CANNOT: exceed the remaining daily WETH allowance')
  check(await agentAttempt(roles, SWAP_ROUTER, swapData({ tokenIn: WETH, tokenOut: USDC, recipient: safe, amountIn: parseEther('10') })), 'agent CAN: use what is left of the daily allowance (10 WETH)')

  // ── Agent key used outside the bot → HALT ──────────────────────────────
  await send(agentWallet, { to: agent.address, value: 0n })
  let halted = false
  try {
    await executeRebalance({ id: 'd-4', side: 'SELL_WETH', usdNotional: 10_000 })
  } catch (e) {
    halted = /outside this process/.test((e as Error).message)
  }
  check(halted && existsSync(`${stateDir}/HALT`), 'foreign use of agent nonce → HALT file written')
  const afterHalt = await executeRebalance({ id: 'd-5', side: 'SELL_WETH', usdNotional: 10_000 })
  check(afterHalt.status === 'skipped', 'no trading while HALT file exists')

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
