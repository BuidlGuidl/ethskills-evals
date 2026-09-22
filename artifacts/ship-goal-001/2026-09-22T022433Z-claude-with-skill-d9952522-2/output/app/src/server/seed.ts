/**
 * Seeds offchain content for local development: a few neighbours and the tools
 * they own, listed against anvil's default accounts.
 *
 * Loans and track records are NOT seeded — they only exist as contract events,
 * so to see them you start a loan through the UI (or with `cast`) against a
 * local deployment and let `npm run indexer` pick it up. That asymmetry is the
 * architecture working as intended.
 */
import { parseUnits, getAddress } from 'viem'
import { db, migrate } from './db'
import { createTool } from './tools'
import { saveProfile, setRosterFlag } from './members'

const usdc = (amount: string) => parseUnits(amount, 6)

// anvil's deterministic accounts (mnemonic "test test ... junk").
const neighbours = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', name: 'Ana (steward)', unit: '1A' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', name: 'Ben', unit: '2C' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', name: 'Cleo', unit: '4B' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', name: 'Dov', unit: '7' },
] as const

const listings = [
  {
    owner: neighbours[1].address,
    title: 'Circular saw, 7¼″',
    conditionNotes: 'Sharp blade, guard sticks a little. Bring your own extension cord.',
    deposit: usdc('60'),
    lateFeePerDay: usdc('5'),
    maxLoanDays: 4,
  },
  {
    owner: neighbours[2].address,
    title: 'Extension ladder, 6 m',
    conditionNotes: 'Heavy. Needs two people to carry up the stairs. Rubber feet are new.',
    deposit: usdc('80'),
    lateFeePerDay: usdc('4'),
    maxLoanDays: 3,
  },
  {
    owner: neighbours[2].address,
    title: 'Wheelbarrow',
    conditionNotes: 'Tyre holds air for about a week. Pump is in the shed with it.',
    deposit: usdc('30'),
    lateFeePerDay: usdc('2'),
    maxLoanDays: 7,
  },
  {
    owner: neighbours[3].address,
    title: 'Carpet cleaner',
    conditionNotes: 'Return it empty and rinsed, please. Detergent not included.',
    deposit: usdc('45'),
    lateFeePerDay: usdc('3'),
    maxLoanDays: 2,
  },
]

migrate()

const existing = db().prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM tools').get()!
if (existing.n > 0) {
  console.log(`database already has ${existing.n} tool(s); not seeding again`)
  process.exit(0)
}

for (const neighbour of neighbours) {
  const address = getAddress(neighbour.address)
  saveProfile({ address, displayName: neighbour.name, unitLabel: neighbour.unit })
  // Mirrors what the indexer would write after the steward added them onchain.
  setRosterFlag(address, true)
}

for (const listing of listings) {
  const tool = createTool({
    ownerAddress: getAddress(listing.owner),
    title: listing.title,
    conditionNotes: listing.conditionNotes,
    photoKey: null,
    deposit: listing.deposit,
    lateFeePerDay: listing.lateFeePerDay,
    maxLateDays: Number(listing.deposit / listing.lateFeePerDay),
    maxLoanDays: listing.maxLoanDays,
  })
  console.log(`listed ${tool.title} (toolId ${tool.toolId})`)
}

console.log(`seeded ${neighbours.length} neighbours and ${listings.length} tools`)
