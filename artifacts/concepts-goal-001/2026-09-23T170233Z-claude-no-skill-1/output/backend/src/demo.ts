/**
 * End-to-end smoke test against a local anvil deployment.
 *
 *   anvil &
 *   BILLING_OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
 *     forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
 *     --private-key 0xac09...ff80
 *   BILLING_ADDRESS=<address> USDC_ADDRESS=<address> npm run demo
 *
 * Exercises the two things the gateway depends on: an API key is bound to an
 * address only by signature, and the gate reflects on-chain state.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  getAddress,
  isAddress,
  type Address,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

import { SubscriptionGate } from './gate.js'
import { ApiKeyStore, enrolmentMessage } from './apiKeys.js'
import { billingAbi } from './abi.js'

const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
const billing = process.env.BILLING_ADDRESS
const usdc = process.env.USDC_ADDRESS
if (!billing || !isAddress(billing)) throw new Error('BILLING_ADDRESS must be set')
if (!usdc || !isAddress(usdc)) throw new Error('USDC_ADDRESS must be set')

const erc20Abi = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

const subscribeAbi = [
  { type: 'function', name: 'depositAndSubscribe', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'planId', type: 'uint8' }], outputs: [] },
  { type: 'function', name: 'cancelAndWithdraw', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }], outputs: [] },
] as const

// anvil account #2
const customer = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')

const wallet = createWalletClient({ account: customer, chain: foundry, transport: http(RPC) })
const publicClient = createPublicClient({ chain: foundry, transport: http(RPC) })

async function send(hash: `0x${string}`): Promise<void> {
  await publicClient.waitForTransactionReceipt({ hash })
}

function ok(label: string, condition: boolean): void {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) process.exitCode = 1
}

async function main(): Promise<void> {
  const contract = getAddress(billing as Address)
  const token = getAddress(usdc as Address)

  const gate = new SubscriptionGate({
    address: contract,
    chain: foundry,
    rpcUrl: RPC,
    positiveTtlMs: 0, // demo: always read through
    negativeTtlMs: 0,
  })
  const keys = new ApiKeyStore()

  // --- address binding -------------------------------------------------
  const { nonce, issuedAt } = keys.issueNonce()
  const message = enrolmentMessage(customer.address, nonce, issuedAt)
  const signature = await wallet.signMessage({ message })
  const apiKey = await keys.enrol(customer.address, nonce, signature)
  ok('enrolment with a valid signature mints a key', apiKey.startsWith('wx_'))
  ok('key resolves to the signing address', keys.resolve(apiKey) === customer.address)
  ok('an unknown key resolves to nothing', keys.resolve('wx_made_up') === null)

  const replay = await keys
    .enrol(customer.address, nonce, signature)
    .then(() => null)
    .catch((e: Error) => e.message)
  ok('a nonce cannot be replayed', replay !== null)

  // Someone else's signature must not bind our address.
  const attacker = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6')
  const fresh = keys.issueNonce()
  const forged = await createWalletClient({ account: attacker, chain: foundry, transport: http(RPC) })
    .signMessage({ message: enrolmentMessage(customer.address, fresh.nonce, fresh.issuedAt) })
  const forgery = await keys
    .enrol(customer.address, fresh.nonce, forged)
    .then(() => null)
    .catch((e: Error) => e.message)
  ok('a third party cannot bind someone else’s address', forgery !== null)

  // --- entitlement -----------------------------------------------------
  ok('unsubscribed address is not entitled', !(await gate.check(customer.address)).active)

  await send(await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'mint', args: [customer.address, parseUnits('100', 6)] }))
  await send(await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [contract, parseUnits('100', 6)] }))
  await send(await wallet.writeContract({ address: contract, abi: subscribeAbi, functionName: 'depositAndSubscribe', args: [parseUnits('60', 6), 2] }))

  const active = await gate.check(customer.address)
  ok('after subscribing, the gate says active', active.active)
  ok('gate reports the pro plan', active.plan === 2)
  ok('expiry is in the future', active.expiresAt * 1000 > Date.now())

  const status = await publicClient.readContract({ address: contract, abi: billingAbi, functionName: 'statusOf', args: [customer.address] })
  ok('60 USDC on the 20 USDC plan funds three periods', Number(status.credit) === 40_000_000)

  // --- cancellation ----------------------------------------------------
  await send(await wallet.writeContract({ address: contract, abi: subscribeAbi, functionName: 'cancelAndWithdraw', args: [customer.address] }))
  gate.invalidate(customer.address)
  ok('after cancelling, the gate says inactive', !(await gate.check(customer.address)).active)

  console.log(process.exitCode ? '\nsome checks failed' : '\nall checks passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
