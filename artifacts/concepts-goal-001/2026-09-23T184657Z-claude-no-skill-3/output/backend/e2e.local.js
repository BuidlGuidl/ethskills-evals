import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import {
  createPublicClient, createWalletClient, http, parseAbi, formatUnits, getAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { SubscriptionGate } from './gate.js'
import { ApiKeyIssuer } from './auth.js'
import { billingAbi } from './abi.js'

/**
 * End-to-end rehearsal of the whole thing against a local anvil: deploy, sign in, subscribe,
 * get served, time-travel a month, watch it renew, run out of money, lapse, get cut off,
 * resubscribe, cancel, get refunded. Run it before every mainnet deploy.
 *
 *   anvil --silent &        # or let this script find one already running
 *   npm run e2e
 */

const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
const DEPLOYER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const CUSTOMER = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })
const deployer = privateKeyToAccount(DEPLOYER)
const customer = privateKeyToAccount(CUSTOMER)
const asDeployer = createWalletClient({ account: deployer, chain: foundry, transport: http(RPC) })
const asCustomer = createWalletClient({ account: customer, chain: foundry, transport: http(RPC) })

const erc20 = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
])
const extraAbi = parseAbi([
  'function deposit(uint256 amount)',
  'function subscribe(uint8 planId)',
  'function depositAndSubscribe(uint256 amount, uint8 planId)',
  'function cancel() returns (uint256)',
  'function cancelAndWithdrawAll() returns (uint256)',
  'function settle(address account)',
])

const usd = (v) => `$${formatUnits(v, 6)}`
let step = 0
const say = (msg) => console.log(`\n${++step}. ${msg}`)

async function send(client, params) {
  const hash = await client.writeContract(params)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  assert.equal(receipt.status, 'success', 'transaction reverted')
  return receipt
}

async function forgeOut(args, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('forge', args, { env: { ...process.env, ...env }, encoding: 'utf8' })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (out += d))
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))))
  })
}

async function mineTime(seconds) {
  await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_increaseTime', params: [seconds] }),
  })
  await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'evm_mine', params: [] }),
  })
}

async function main() {
  const chainId = await publicClient.getChainId().catch(() => {
    throw new Error(`no chain at ${RPC} — start one with: anvil --silent &`)
  })
  assert.equal(chainId, 31337, 'refusing to run the e2e against anything but a local anvil')

  say('deploy a mock USDC and the billing contract')
  const mock = await forgeOut([
    'create', 'test/mocks/MockUSDC.sol:MockUSDC',
    '--rpc-url', RPC, '--private-key', DEPLOYER, '--broadcast', '--json',
  ])
  const usdc = getAddress(JSON.parse(mock.slice(mock.indexOf('{'))).deployedTo)
  await forgeOut(
    ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--private-key', DEPLOYER, '--broadcast'],
    { USDC: usdc },
  )
  const billing = getAddress(JSON.parse(readFileSync('deployments/31337.json', 'utf8')).billing)
  const abi = [...billingAbi, ...extraAbi]
  console.log(`   usdc ${usdc}\n   billing ${billing}`)

  say('customer gets an API key by signing a message (no gas, no transaction)')
  const issuer = new ApiKeyIssuer({ secret: 'x'.repeat(48), rpcUrl: RPC })
  const { nonce, message } = issuer.challenge(customer.address)
  const signature = await customer.signMessage({ message })
  const { apiKey } = await issuer.redeem({ address: customer.address, nonce, signature })
  assert.equal(issuer.addressFor(apiKey), getAddress(customer.address))
  assert.equal(issuer.addressFor(apiKey.slice(0, -1) + 'z'), null, 'forged key must be rejected')
  console.log(`   api key ${apiKey.slice(0, 20)}...`)

  const gate = new SubscriptionGate({ rpcUrl: RPC, chain: foundry, billingAddress: billing, watch: false })
  const check = () => gate.check(customer.address)

  say('before paying, the gate refuses service')
  gate.invalidate(customer.address)
  assert.equal((await check()).active, false)
  console.log('   402 Payment Required ✓')

  say('customer tops up $12 of USDC and subscribes to hobby ($5/mo)')
  await send(asDeployer, { address: usdc, abi: erc20, functionName: 'mint', args: [customer.address, 1000n * 10n ** 6n] })
  await send(asCustomer, { address: usdc, abi: erc20, functionName: 'approve', args: [billing, 2n ** 255n] })
  await send(asCustomer, { address: billing, abi, functionName: 'depositAndSubscribe', args: [12n * 10n ** 6n, 1] })
  gate.invalidate(customer.address)
  const first = await check()
  assert.equal(first.active, true)
  assert.equal(first.plan, 'hobby')
  console.log(`   served until ${new Date(first.activeUntil * 1000).toISOString()} ✓`)

  say('one month later it renews on its own — nobody ran a cron job')
  await mineTime(31 * 86400)
  gate.invalidate(customer.address)
  const second = await check()
  assert.equal(second.active, true)
  assert.ok(second.activeUntil > first.activeUntil, 'period should have rolled forward')
  const owedNow = await publicClient.readContract({ address: billing, abi, functionName: 'previewRevenue', args: [[customer.address]] })
  console.log(`   still active, ${usd(owedNow)} now claimable by the merchant ✓`)

  say('merchant settles and collects; the customer never noticed')
  await send(asDeployer, { address: billing, abi, functionName: 'settle', args: [customer.address] })
  const settled = await publicClient.readContract({ address: billing, abi, functionName: 'accruedRevenue' })
  assert.equal(settled, 5n * 10n ** 6n, 'one elapsed month of revenue')
  await send(asDeployer, { address: billing, abi, functionName: 'withdrawRevenue', args: [deployer.address, settled] })
  console.log(`   collected ${usd(settled)} ✓`)

  say('credit runs dry after the third month, and the gate cuts service off')
  await mineTime(70 * 86400)
  gate.invalidate(customer.address)
  const lapsed = await check()
  assert.equal(lapsed.active, false, 'should have lapsed once credit ran out')
  console.log('   402 Payment Required again ✓')

  say('a later top-up is NOT eaten by the downtime')
  await send(asCustomer, { address: billing, abi, functionName: 'deposit', args: [50n * 10n ** 6n] })
  const [, , , balance] = await publicClient.readContract({ address: billing, abi, functionName: 'statusOf', args: [customer.address] })
  assert.ok(balance >= 50n * 10n ** 6n, `expected the full top-up intact, got ${usd(balance)}`)
  gate.invalidate(customer.address)
  assert.equal((await check()).active, false, 'a top-up alone must not resurrect a lapsed sub')
  console.log(`   ${usd(balance)} credit intact, still unsubscribed until they opt in ✓`)

  say('customer resubscribes on pro, then cancels 15 days in and is refunded pro rata')
  await send(asCustomer, { address: billing, abi, functionName: 'subscribe', args: [2] })
  const before = await publicClient.readContract({ address: usdc, abi: erc20, functionName: 'balanceOf', args: [customer.address] })
  await mineTime(15 * 86400)
  await send(asCustomer, { address: billing, abi, functionName: 'cancelAndWithdrawAll', args: [] })
  const after = await publicClient.readContract({ address: usdc, abi: erc20, functionName: 'balanceOf', args: [customer.address] })
  const returned = after - before
  const charged = balance - returned
  console.log(`   got back ${usd(returned)}, charged ${usd(charged)} for half a month of pro ($20/mo)`)
  assert.ok(charged >= 9_900_000n && charged <= 10_100_000n, `expected ~$10 charged, got ${usd(charged)}`)
  gate.invalidate(customer.address)
  assert.equal((await check()).active, false)

  say('contract is left holding exactly what it still owes')
  const [held, revenue, onchain] = await Promise.all([
    publicClient.readContract({ address: billing, abi, functionName: 'customerFunds' }),
    publicClient.readContract({ address: billing, abi, functionName: 'accruedRevenue' }),
    publicClient.readContract({ address: usdc, abi: erc20, functionName: 'balanceOf', args: [billing] }),
  ])
  assert.ok(onchain >= held + revenue, 'solvency invariant broken')
  console.log(`   holds ${usd(onchain)} = ${usd(held)} customer funds + ${usd(revenue)} unclaimed revenue ✓`)

  gate.close()
  console.log('\nall good — the full lifecycle works end to end.')
}

main().catch((err) => {
  console.error('\nE2E FAILED:', err.message)
  process.exit(1)
})
