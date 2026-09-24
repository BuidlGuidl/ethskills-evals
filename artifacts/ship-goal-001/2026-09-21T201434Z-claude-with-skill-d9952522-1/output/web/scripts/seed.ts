/**
 * Fills the offchain database with a plausible neighborhood so the browse
 * screen has something to rank on a fresh checkout.
 *
 * Writes members, listings and *settled loan history* directly — it does not
 * touch the chain. The loan rows it writes are the same shape the indexer
 * produces, which is what makes the ranking visible without waiting for real
 * loans to complete.
 *
 *   npm run seed
 */
import { db, nowSeconds } from "../src/core/db";
import { createListing } from "../src/core/listings";

const MEMBERS = [
  { address: "0x1111111111111111111111111111111111111111", name: "Priya Raman", unit: "12A" },
  { address: "0x2222222222222222222222222222222222222222", name: "Tomás Oliveira", unit: "4C" },
  { address: "0x3333333333333333333333333333333333333333", name: "Ellen Whitfield", unit: "7B" },
  { address: "0x4444444444444444444444444444444444444444", name: "Marcus Bell", unit: "19" },
  { address: "0x5555555555555555555555555555555555555555", name: "Hana Kowalski", unit: "2F" },
];

const TOOLS = [
  {
    owner: 0,
    title: "Cordless drill, 18V",
    description: "Two batteries and a charger in a hard case. Good for anything around the house.",
    conditionNote: "Chuck sticks a little if you overtighten it. Battery B holds about half a charge.",
    deposit: "60.00",
    dailyLateFee: "2.00",
    maxDays: 7,
  },
  {
    owner: 0,
    title: "Extension ladder, 24ft",
    description: "Aluminium, reaches a second-storey gutter comfortably.",
    conditionNote: "One rubber foot is worn. Do not use it on wet tile.",
    deposit: "120.00",
    dailyLateFee: "5.00",
    maxDays: 3,
  },
  {
    owner: 1,
    title: "Circular saw",
    description: "7¼ inch blade, recently sharpened. Comes with a rip guide.",
    conditionNote: "Guard spring is stiff. Blade is sharp — treat it carefully.",
    deposit: "80.00",
    dailyLateFee: "3.00",
    maxDays: 4,
  },
  {
    owner: 2,
    title: "Wheelbarrow",
    description: "Steel tray, pneumatic tyre. Fine for soil, gravel or a load of branches.",
    conditionNote: "Tyre needs topping up every few weeks. Pump is in the shed.",
    deposit: "35.00",
    dailyLateFee: "1.00",
    maxDays: 5,
  },
  {
    owner: 3,
    title: "Pressure washer",
    description: "Electric, 1800 PSI. Two nozzles included.",
    conditionNote: "Works well. The hose has a slow drip at the coupling.",
    deposit: "90.00",
    dailyLateFee: "4.00",
    maxDays: 3,
  },
  {
    owner: 4,
    title: "Tile cutter, manual",
    description: "Scores and snaps up to 600mm. Bought for one bathroom, barely used.",
    conditionNote: "As new.",
    deposit: "45.00",
    dailyLateFee: "1.50",
    maxDays: 7,
  },
];

/** [borrowerIndex, ownerIndex, daysLate, unreturned] */
const HISTORY: [number, number, number, boolean][] = [
  // Priya: many loans, one late. Should rank at the top.
  [0, 1, 0, false], [0, 2, 0, false], [0, 3, 0, false], [0, 1, 0, false],
  [0, 2, 0, false], [0, 4, 0, false], [0, 3, 0, false], [0, 1, 2, false],
  [0, 2, 0, false], [0, 4, 0, false], [0, 3, 0, false], [0, 1, 0, false],
  // Tomás: solid, fewer loans.
  [1, 0, 0, false], [1, 2, 0, false], [1, 0, 1, false], [1, 3, 0, false], [1, 4, 0, false],
  // Ellen: one perfect loan. A naive ratio would rank her first; the Wilson
  // bound keeps her below Priya until she has more history.
  [2, 0, 0, false],
  // Marcus: late more often than not.
  [3, 0, 3, false], [3, 1, 5, false], [3, 2, 0, false], [3, 4, 2, false],
  // Hana: lost someone's tool.
  [4, 0, 0, false], [4, 1, 0, false], [4, 2, 30, true],
];

function main() {
  const conn = db();
  const ts = nowSeconds();

  const insertMember = conn.prepare(
    `INSERT INTO members (address, display_name, unit, approved, joined_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(address) DO UPDATE SET display_name = excluded.display_name, approved = 1`,
  );

  for (const m of MEMBERS) insertMember.run(m.address.toLowerCase(), m.name, m.unit, ts);

  const listingIds: string[] = [];
  for (const tool of TOOLS) {
    const listing = createListing(MEMBERS[tool.owner].address, {
      title: tool.title,
      description: tool.description,
      conditionNote: tool.conditionNote,
      photoUrl: null,
      deposit: (BigInt(Math.round(Number(tool.deposit) * 100)) * 10_000n).toString(),
      dailyLateFee: (BigInt(Math.round(Number(tool.dailyLateFee) * 100)) * 10_000n).toString(),
      maxDays: tool.maxDays,
    });
    listingIds.push(listing.id);
  }

  const insertLoan = conn.prepare(
    `INSERT INTO loans (loan_id, owner_address, borrower_address, listing_ref, deposit, daily_late_fee,
                        duration_days, status, requested_at, due_at, days_late, late_fee_paid, refund,
                        unreturned, settled_at)
     VALUES (?, ?, ?, '0x', ?, ?, ?, 'settled', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(loan_id) DO NOTHING`,
  );

  let loanId = 1;
  for (const [borrower, owner, daysLate, unreturned] of HISTORY) {
    const deposit = 60_000_000n;
    const dailyFee = 2_000_000n;
    const raw = BigInt(daysLate) * dailyFee;
    const fee = unreturned ? deposit : raw > deposit ? deposit : raw;

    insertLoan.run(
      loanId++,
      MEMBERS[owner].address.toLowerCase(),
      MEMBERS[borrower].address.toLowerCase(),
      deposit.toString(),
      dailyFee.toString(),
      4,
      ts - 86_400 * 30,
      ts - 86_400 * 26,
      daysLate,
      fee.toString(),
      (deposit - fee).toString(),
      unreturned ? 1 : 0,
      ts - 86_400 * 20,
    );
  }

  console.log(`seeded ${MEMBERS.length} members, ${listingIds.length} listings, ${HISTORY.length} settled loans`);
  console.log("start the app with `npm run dev` and open http://localhost:3000");
}

main();
