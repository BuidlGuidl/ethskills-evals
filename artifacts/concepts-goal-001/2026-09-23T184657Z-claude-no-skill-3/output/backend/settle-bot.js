import { createPublicClient, createWalletClient, http, formatUnits, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { billingAbi } from './abi.js'

/**
 * Settlement and revenue collection.
 *
 * Nothing here affects whether a customer is subscribed — the contract answers that from a
 * closed-form projection whether or not anyone has settled. This job exists only to turn
 * elapsed periods into revenue you can withdraw, and to give you a number to reconcile
 * against. Skipping a run costs you nothing but delay; the money cannot be lost.
 *
 *   RPC_URL=... BILLING_ADDRESS=0x... [PRIVATE_KEY=0x... PAYOUT_TO=0x...] npm run settle
 *
 * Without PRIVATE_KEY it runs read-only and just reports. With one it settles every known
 * subscriber, and if PAYOUT_TO is set, sweeps the settled revenue there.
 */

const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
const address = getAddress(process.env.BILLING_ADDRESS ?? '')
const fromBlock = BigInt(process.env.FROM_BLOCK ?? '0')
const batchSize = Number(process.env.BATCH_SIZE ?? 100)
const payoutTo = process.env.PAYOUT_TO
const key = process.env.PRIVATE_KEY

const publicClient = createPublicClient({ transport: http(rpcUrl) })
const wallet = key
  ? createWalletClient({ account: privateKeyToAccount(key), transport: http(rpcUrl) })
  : null

const usd = (v) => `$${formatUnits(v, 6)}`

/**
 * Everyone who has ever subscribed. Derived from logs so the bot is stateless and can be
 * re-run on a fresh machine; for a big book, cache the set and only scan new blocks.
 */
async function knownSubscribers() {
  const logs = await publicClient.getContractEvents({
    address,
    abi: billingAbi,
    eventName: 'Subscribed',
    fromBlock,
    toBlock: 'latest',
  })
  return [...new Set(logs.map((l) => getAddress(l.args.account)))]
}

/** Accounts with elapsed periods that have not been written to storage yet. */
async function needingSettlement(accounts, settled) {
  const flags = await Promise.all(
    accounts.map((account) =>
      publicClient.readContract({
        address,
        abi: billingAbi,
        functionName: 'previewRevenue',
        args: [[account]],
      }),
    ),
  )
  return accounts.filter((_, i) => flags[i] > settled)
}

async function main() {
  const subscribers = await knownSubscribers()
  const [settled, held, active] = await Promise.all([
    publicClient.readContract({ address, abi: billingAbi, functionName: 'accruedRevenue' }),
    publicClient.readContract({ address, abi: billingAbi, functionName: 'customerFunds' }),
    publicClient.readContract({
      address,
      abi: billingAbi,
      functionName: 'areSubscribed',
      args: [subscribers],
    }),
  ])

  const activeCount = active.filter(Boolean).length
  const pending = await needingSettlement(subscribers, settled)
  const claimable = await publicClient.readContract({
    address,
    abi: billingAbi,
    functionName: 'previewRevenue',
    args: [pending],
  })

  console.log(`subscribers ever:     ${subscribers.length}`)
  console.log(`active right now:     ${activeCount}`)
  console.log(`customer funds held:  ${usd(held)}`)
  console.log(`revenue settled:      ${usd(settled)}`)
  console.log(`revenue after settle: ${usd(claimable)} (${pending.length} accounts to settle)`)

  if (!wallet) {
    console.log('\nread-only (no PRIVATE_KEY): nothing was sent')
    return
  }

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize)
    const hash = await wallet.writeContract({
      address,
      abi: billingAbi,
      functionName: 'settleMany',
      args: [batch],
      chain: null,
    })
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`settled ${batch.length} accounts: ${hash}`)
  }

  if (payoutTo) {
    const amount = await publicClient.readContract({
      address,
      abi: billingAbi,
      functionName: 'accruedRevenue',
    })
    if (amount === 0n) {
      console.log('nothing to collect')
    } else {
      const hash = await wallet.writeContract({
        address,
        abi: billingAbi,
        functionName: 'withdrawRevenue',
        args: [getAddress(payoutTo), amount],
        chain: null,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      console.log(`collected ${usd(amount)} to ${payoutTo}: ${hash}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
