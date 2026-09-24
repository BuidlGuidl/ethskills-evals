#!/usr/bin/env node
/**
 * The one recurring job this system has: sweep earned revenue out of the contract.
 *
 *   node ops/collect.mjs                 # report only, sends nothing
 *   node ops/collect.mjs --settle        # settle accounts with accrued revenue
 *   node ops/collect.mjs --settle --withdraw   # ...and move it to PAYOUT_ADDRESS
 *
 * Nothing breaks if you skip a month. Accrual is computed from timestamps, the money
 * is already in the contract, and no subscriber's access depends on this running.
 * It exists so *you* get paid, which is why it is safe to run it on a whim.
 *
 * Env: RPC_URL, BILLING_CONTRACT, DEPLOY_BLOCK, and for writes PRIVATE_KEY + PAYOUT_ADDRESS.
 */

import { createPublicClient, createWalletClient, http, formatUnits, getAddress, parseAbiItem } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { BILLING_ABI } from './abi.mjs'

const args = new Set(process.argv.slice(2))
const DO_SETTLE = args.has('--settle')
const DO_WITHDRAW = args.has('--withdraw')

const RPC_URL = req('RPC_URL')
const CONTRACT = getAddress(req('BILLING_CONTRACT'))
const DEPLOY_BLOCK = BigInt(process.env.DEPLOY_BLOCK ?? '0')
const LOG_CHUNK = BigInt(process.env.LOG_CHUNK ?? '50000') // many providers cap the range
const BATCH = Number(process.env.SETTLE_BATCH ?? '150') // accounts per settle() tx
const MIN_SWEEP = BigInt(process.env.MIN_SWEEP_USDC ?? '0') * 1_000_000n

function req(name) {
  const v = process.env[name]
  if (!v) throw new Error(`missing env ${name}`)
  return v
}
const usd = (v) => `$${Number(formatUnits(v, 6)).toFixed(2)}`

const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })

/** Every address that ever held an account here. Deposited covers subscribers and
 * anyone topped up by a third party; Subscribed covers the rest. */
async function findAccounts() {
  const latest = await publicClient.getBlockNumber()
  const events = [
    parseAbiItem('event Deposited(address indexed account, address indexed payer, uint256 amount, uint256 balance)'),
    parseAbiItem('event Subscribed(address indexed account, uint16 indexed planId, uint64 ratePerSecond, uint256 activeUntil)'),
  ]
  const found = new Set()

  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n > latest ? latest : from + LOG_CHUNK - 1n
    for (const event of events) {
      const logs = await publicClient.getLogs({ address: CONTRACT, event, fromBlock: from, toBlock: to })
      for (const log of logs) found.add(getAddress(log.args.account))
    }
    process.stderr.write(`\r  scanned blocks ${from}-${to} (${found.size} accounts)`)
  }
  process.stderr.write('\n')
  return [...found]
}

async function main() {
  const accounts = await findAccounts()

  const details = await Promise.all(
    accounts.map(async (a) => {
      const [planId, remaining, accrued, until, active] = await publicClient.readContract({
        address: CONTRACT, abi: BILLING_ABI, functionName: 'accountOf', args: [a],
      })
      return { address: a, planId, remaining, accrued, until, active }
    }),
  )

  const [settled, held, surplus] = await Promise.all([
    publicClient.readContract({ address: CONTRACT, abi: BILLING_ABI, functionName: 'collectedRevenue' }),
    publicClient.readContract({ address: CONTRACT, abi: BILLING_ABI, functionName: 'totalSubscriberBalance' }),
    publicClient.readContract({ address: CONTRACT, abi: BILLING_ABI, functionName: 'solvencySurplus' }),
  ])

  const unsettled = details.reduce((sum, d) => sum + d.accrued, 0n)
  const active = details.filter((d) => d.active)
  const lapsing = active
    .filter((d) => Number(d.until) * 1000 - Date.now() < 7 * 86_400_000)
    .sort((a, b) => Number(a.until - b.until))

  console.log(`\naccounts seen:        ${details.length}`)
  console.log(`active subscribers:   ${active.length}  (hobby ${active.filter((d) => d.planId === 1).length}, pro ${active.filter((d) => d.planId === 2).length})`)
  console.log(`customer float held:  ${usd(held)}   <- not yours; refundable on demand`)
  console.log(`revenue settled:      ${usd(settled)}`)
  console.log(`revenue accrued:      ${usd(unsettled)}  across ${details.filter((d) => d.accrued > 0n).length} accounts`)
  console.log(`claimable after sweep:${usd(settled + unsettled)}`)
  console.log(`solvency surplus:     ${usd(surplus)}   <- must never be negative (call would revert)`)

  if (lapsing.length) {
    console.log(`\nrunning out within 7 days (${lapsing.length}) — worth an email:`)
    for (const d of lapsing.slice(0, 20)) {
      console.log(`  ${d.address}  plan ${d.planId}  ${usd(d.remaining)} left  until ${new Date(Number(d.until) * 1000).toISOString()}`)
    }
  }

  if (!DO_SETTLE) {
    console.log('\n(report only — pass --settle to sweep, --settle --withdraw to also pay out)')
    return
  }

  if (settled + unsettled < MIN_SWEEP) {
    console.log(`\nbelow MIN_SWEEP_USDC (${usd(MIN_SWEEP)}); not spending gas today.`)
    return
  }

  const account = privateKeyToAccount(req('PRIVATE_KEY'))
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC_URL) })
  const onchainOwner = await publicClient.readContract({ address: CONTRACT, abi: BILLING_ABI, functionName: 'owner' })

  const toSettle = details.filter((d) => d.accrued > 0n).map((d) => d.address)
  for (let i = 0; i < toSettle.length; i += BATCH) {
    const batch = toSettle.slice(i, i + BATCH)
    const hash = await wallet.writeContract({ address: CONTRACT, abi: BILLING_ABI, functionName: 'settle', args: [batch] })
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`settled ${batch.length} accounts  ${hash}`)
  }

  if (!DO_WITHDRAW) return
  if (getAddress(onchainOwner) !== account.address) {
    console.log(`\nskipping withdraw: signer ${account.address} is not the owner (${onchainOwner}).`)
    console.log('settle() is permissionless so the sweep above still worked. Withdraw from the owner key.')
    return
  }

  const payout = getAddress(req('PAYOUT_ADDRESS'))
  const hash = await wallet.writeContract({
    address: CONTRACT, abi: BILLING_ABI, functionName: 'withdrawRevenue', args: [payout, 0n],
  })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`withdrew ${usd(settled + unsettled)} to ${payout}  ${hash}`)
}

main().catch((e) => {
  console.error(e.shortMessage ?? e.message ?? e)
  process.exit(1)
})
