import {createPublicClient, http, formatUnits, getAddress, type Address} from 'viem'
import {billingAbi} from './abi.ts'

/**
 * The daily/weekly ops check. Run it on a cron and have it shout on stderr; the exit code is
 * non-zero when something needs a human, so it drops straight into any alerting that watches
 * cron failures.
 *
 *   BILLING_CONTRACT=0x... RPC_URL=... SUBSCRIBERS=0xa,0xb npm run monitor
 *
 * `SUBSCRIBERS` is the address list you keep anyway for settlement. Build it from `Subscribed`
 * events if you do not have one — see reconcile() below.
 */

const CONTRACT = getAddress(req('BILLING_CONTRACT'))
const client = createPublicClient({transport: http(req('RPC_URL'))})

/** Warn when accrued-but-unswept revenue passes this, in USDC. Gas is only worth it in batches. */
const SWEEP_THRESHOLD = Number(process.env.SWEEP_THRESHOLD_USDC ?? 50)
/** Warn when a customer's balance has this many days left, so you can email them before cutoff. */
const EXPIRY_WARNING_DAYS = Number(process.env.EXPIRY_WARNING_DAYS ?? 5)

function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set`)
  return v
}

const usd = (v: bigint) => `$${formatUnits(v, 6)}`

async function main() {
  const warnings: string[] = []

  const [earned, customerBalance, surplus, paused, owner] = await Promise.all([
    read('earned'),
    read('totalCustomerBalance'),
    read('surplus'),
    read('paused'),
    read('owner'),
  ])

  console.log(`contract        ${CONTRACT}`)
  console.log(`owner           ${owner}`)
  console.log(`paused          ${paused}`)
  console.log(`settled revenue ${usd(earned as bigint)}   (withdrawable now)`)
  console.log(`customer credit ${usd(customerBalance as bigint)}   (not yours)`)
  console.log(`stray tokens    ${usd(surplus as bigint)}`)

  if (paused) warnings.push('contract is PAUSED — no new signups or top-ups are being accepted')
  if ((surplus as bigint) > 0n) {
    warnings.push(`${usd(surplus as bigint)} was transferred in directly rather than deposited; sweepSurplus() recovers it`)
  }

  // Solvency: the contract must hold at least what it owes everyone. This can only break if
  // something is very wrong, which is exactly why it is worth checking from the outside.
  const held = (await client.readContract({
    address: CONTRACT,
    abi: [{type: 'function', name: 'token', inputs: [], outputs: [{type: 'address'}], stateMutability: 'view'}],
    functionName: 'token',
  })) as Address
  const balance = (await client.readContract({
    address: held,
    abi: [{type: 'function', name: 'balanceOf', inputs: [{type: 'address'}], outputs: [{type: 'uint256'}], stateMutability: 'view'}],
    functionName: 'balanceOf',
    args: [CONTRACT],
  })) as bigint
  const owed = (earned as bigint) + (customerBalance as bigint)
  if (balance < owed) {
    warnings.push(`INSOLVENT: holds ${usd(balance)} but owes ${usd(owed)}`)
  }

  const subscribers = (process.env.SUBSCRIBERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => getAddress(s)) // not .map(getAddress): map passes the index, which viem reads as a chainId

  if (subscribers.length === 0) {
    console.log('\nno SUBSCRIBERS list given — skipping per-customer checks')
  } else {
    let pending = 0n
    let active = 0
    console.log(`\n${subscribers.length} tracked accounts:`)
    for (const user of subscribers) {
      const s = (await client.readContract({
        address: CONTRACT,
        abi: billingAbi,
        functionName: 'statusOf',
        args: [user],
      })) as {subscribed: boolean; planId: number; expiresAt: bigint; balance: bigint; accrued: bigint}

      pending += s.accrued
      if (s.subscribed) active++

      const daysLeft = s.subscribed ? (Number(s.expiresAt) * 1000 - Date.now()) / 86_400_000 : 0
      console.log(
        `  ${user}  ${s.subscribed ? `plan ${s.planId}, ${daysLeft.toFixed(1)}d left` : 'inactive'}` +
          `  credit ${usd(s.balance)}  unswept ${usd(s.accrued)}`,
      )
      if (s.subscribed && daysLeft < EXPIRY_WARNING_DAYS) {
        warnings.push(`${user} runs out in ${daysLeft.toFixed(1)} days — nudge them to top up`)
      }
    }
    console.log(`\nactive subscribers ${active}/${subscribers.length}`)
    console.log(`unswept revenue    ${usd(pending)}`)
    if (Number(formatUnits(pending, 6)) > SWEEP_THRESHOLD) {
      warnings.push(`${usd(pending)} accrued but unsettled — worth a settleMany() batch`)
    }
  }

  if (warnings.length > 0) {
    console.error('\nneeds attention:')
    for (const w of warnings) console.error(`  ! ${w}`)
    process.exitCode = 1
  } else {
    console.log('\nall clear')
  }
}

function read(fn: 'earned' | 'totalCustomerBalance' | 'surplus' | 'paused' | 'owner') {
  return client.readContract({address: CONTRACT, abi: billingAbi, functionName: fn})
}

/**
 * Rebuild the subscriber list from chain history, for when you do not have one or want to check
 * the one you have. Every account that ever subscribed is a candidate to settle.
 */
export async function reconcile(fromBlock: bigint): Promise<Address[]> {
  const logs = await client.getContractEvents({
    address: CONTRACT,
    abi: billingAbi,
    eventName: 'Subscribed',
    fromBlock,
    toBlock: 'latest',
  })
  return [...new Set(logs.map((l) => l.args.user as Address))]
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
