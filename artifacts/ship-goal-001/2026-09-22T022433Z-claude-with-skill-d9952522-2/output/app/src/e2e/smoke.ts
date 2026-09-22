/**
 * End-to-end smoke test against a local anvil deployment.
 *
 *   anvil &                                   # terminal 1
 *   cd contracts && ./script/local.sh         # deploys mock USDC + Toolshed
 *   cd app && npm run smoke                   # this script
 *
 * It exercises the seam the unit tests cannot: that the EIP-712 types in
 * src/chain/eip712.ts produce the same digest as `Toolshed.hashOffer`, that a
 * borrower can fund a deposit against an owner's offchain signature, and that
 * the indexer turns the resulting events into the loan rows and track records
 * the UI renders.
 */
import assert from 'node:assert/strict'
import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  hashTypedData,
  http,
  parseUnits,
  publicActions,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { toolshedAbi } from '../chain/toolshedAbi'
import { toolshedAddress, usdcAddress } from '../chain/config'
import {
  eip712Domain,
  loanOfferTypes,
  serializeOffer,
  toolIdFor,
  type LoanOffer,
} from '../chain/eip712'
import { migrate } from '../server/db'
import { createTool } from '../server/tools'
import { saveProfile } from '../server/members'
import { syncOnce } from '../indexer/sync'
import { getLoan } from '../server/loans'
import { trackRecord } from '../server/reputation'

// anvil's deterministic keys: account 0 is the steward, 1 lends, 2 borrows.
const OWNER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const BORROWER_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

const owner = privateKeyToAccount(OWNER_KEY)
const borrower = privateKeyToAccount(BORROWER_KEY)
const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545'

const publicClient = createPublicClient({ chain: foundry, transport: http(rpc) })
const ownerWallet = createWalletClient({ account: owner, chain: foundry, transport: http(rpc) })
const borrowerWallet = createWalletClient({
  account: borrower,
  chain: foundry,
  transport: http(rpc),
})
const testClient = createTestClient({
  chain: foundry,
  mode: 'anvil',
  transport: http(rpc),
}).extend(publicActions)

const usdcAbi = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

const usdc = (amount: string) => parseUnits(amount, 6)

async function send(hash: `0x${string}`, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  assert.equal(receipt.status, 'success', `${label} reverted`)
  return receipt
}

/**
 * Mine past the indexer's confirmation lag and sync until the projection shows
 * what we expect. Mirrors how the real deployment behaves: events land a couple
 * of blocks before the app can see them.
 */
async function waitForIndex<T>(what: string, read: () => T | undefined, ok: (value: T) => boolean) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await testClient.mine({ blocks: 3 })
    await syncOnce()
    const value = read()
    if (value !== undefined && ok(value)) return value
  }
  throw new Error(`indexer never reported ${what}`)
}

async function main() {
  migrate()

  const deposit = usdc('60')
  const lateFeePerDay = usdc('5')
  const maxLateDays = Number(deposit / lateFeePerDay)

  saveProfile({ address: owner.address, displayName: 'Ben', unitLabel: '2C' })
  saveProfile({ address: borrower.address, displayName: 'Cleo', unitLabel: '4B' })

  const tool = createTool({
    ownerAddress: owner.address,
    title: `Smoke-test drill ${Date.now()}`,
    conditionNotes: 'Chuck is a bit worn.',
    photoKey: null,
    deposit,
    lateFeePerDay,
    maxLateDays,
    maxLoanDays: 4,
  })
  assert.equal(tool.toolId, toolIdFor(tool.uuid), 'toolId is derived from the listing uuid')
  console.log(`listed ${tool.title}`)

  // Fund the borrower and let the escrow pull exactly the deposit.
  await send(
    await ownerWallet.writeContract({
      address: usdcAddress,
      abi: usdcAbi,
      functionName: 'mint',
      args: [borrower.address, deposit],
    }),
    'mint',
  )
  await send(
    await borrowerWallet.writeContract({
      address: usdcAddress,
      abi: usdcAbi,
      functionName: 'approve',
      args: [toolshedAddress, deposit],
    }),
    'approve',
  )

  const balanceOf = (who: `0x${string}`) =>
    publicClient.readContract({
      address: usdcAddress,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [who],
    })

  // Deltas, not absolutes: a dev anvil usually has state from earlier runs.
  const borrowerBefore = await balanceOf(borrower.address)
  const ownerBefore = await balanceOf(owner.address)

  const latest = await publicClient.getBlock()
  const nowSeconds = Number(latest.timestamp)

  const offer: LoanOffer = {
    toolId: tool.toolId,
    owner: owner.address,
    borrower: borrower.address,
    deposit,
    lateFeePerDay,
    dueAt: BigInt(nowSeconds + 3 * 86_400),
    maxLateDays,
    offerExpiry: BigInt(nowSeconds + 86_400),
    nonce: BigInt(Date.now()),
  }

  // The check that matters most: our offchain typed-data definition and the
  // contract's must hash to the same digest, or every signature is worthless.
  const localDigest = hashTypedData({
    domain: eip712Domain,
    types: loanOfferTypes,
    primaryType: 'LoanOffer',
    message: offer,
  })
  const onchainDigest = await publicClient.readContract({
    address: toolshedAddress,
    abi: toolshedAbi,
    functionName: 'hashOffer',
    args: [offer],
  })
  assert.equal(localDigest, onchainDigest, 'EIP-712 digest mismatch between app and contract')
  console.log('EIP-712 digests agree')

  const signature = await ownerWallet.signTypedData({
    domain: eip712Domain,
    types: loanOfferTypes,
    primaryType: 'LoanOffer',
    message: offer,
  })

  await send(
    await borrowerWallet.writeContract({
      address: toolshedAddress,
      abi: toolshedAbi,
      functionName: 'startLoan',
      args: [offer, signature],
    }),
    'startLoan',
  )
  console.log('loan started')

  const loanId = Number(
    await publicClient.readContract({
      address: toolshedAddress,
      abi: toolshedAbi,
      functionName: 'loanCount',
    }),
  )
  const active = await waitForIndex(
    'the new loan',
    () => getLoan(loanId),
    (loan) => loan.status === 'active',
  )
  assert.equal(active.status, 'active')
  assert.equal(active.deposit, deposit)
  assert.equal(active.tool?.uuid, tool.uuid, 'loan resolves back to the offchain listing')
  console.log(`indexed loan #${loanId} as active`)

  // Two days and a minute late: the contract bills three whole days.
  await testClient.increaseTime({ seconds: 3 * 86_400 + 2 * 86_400 + 60 })
  await testClient.mine({ blocks: 1 })

  await send(
    await ownerWallet.writeContract({
      address: toolshedAddress,
      abi: toolshedAbi,
      functionName: 'confirmReturn',
      args: [BigInt(loanId)],
    }),
    'confirmReturn',
  )
  const settled = await waitForIndex(
    'the settlement',
    () => getLoan(loanId),
    (loan) => loan.status === 'settled',
  )
  assert.equal(settled.lateDays, 3, 'three billable late days')
  assert.equal(settled.lateFee, lateFeePerDay * 3n)
  assert.equal(settled.refund, deposit - lateFeePerDay * 3n)
  assert.equal(settled.route, 'owner_confirmed')
  console.log(`settled: ${settled.lateDays} late days, fee ${settled.lateFee}`)

  const borrowerAfter = await balanceOf(borrower.address)
  const ownerAfter = await balanceOf(owner.address)
  assert.equal(borrowerAfter - borrowerBefore, -(lateFeePerDay * 3n), 'borrower only lost the late fee')
  assert.equal(ownerAfter - ownerBefore, lateFeePerDay * 3n, 'owner collected the late fee')

  const record = trackRecord(borrower.address)
  assert.ok(record.borrowed >= 1, 'track record counts the loan')
  assert.ok(record.lateReturns >= 1, 'track record counts the late return')
  console.log(
    `track record for ${record.displayName}: ${record.borrowed} loans, ${record.lateReturns} late`,
  )

  // Serialization round-trip, the shape the HTTP API and database use.
  const serialized = serializeOffer(offer)
  assert.equal(serialized.deposit, deposit.toString())

  console.log('\nsmoke test passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
