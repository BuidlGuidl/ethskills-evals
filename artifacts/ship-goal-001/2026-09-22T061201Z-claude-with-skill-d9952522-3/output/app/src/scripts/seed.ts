/**
 * `npm run db:seed` — a few members, tools and settled loans so a developer can see the browse
 * ranking and the track-record badges doing something on first run.
 *
 * The fake loans are written straight into the `loans` table with made-up ids. That table is
 * normally owned by the indexer, so this is only ever appropriate on a throwaway dev database —
 * the script refuses to run against one that already has real indexed loans.
 */
import crypto from "node:crypto";

import {db, migrate, now} from "@/server/db.ts";
import {createListing} from "@/server/listings.ts";
import {inviteMember} from "@/server/members.ts";

migrate();

const existing = db()
  .prepare("SELECT COUNT(*) AS n FROM indexer_state WHERE key = 'last_block'")
  .get() as {n: number};
if (existing.n > 0) {
  console.error(
    "This database has been indexed against a real chain — refusing to seed fake loans into it.",
  );
  process.exit(1);
}

const address = (seed: string) =>
  `0x${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 40)}`;

const PEOPLE = [
  {seed: "priya", name: "Priya Raman", unit: "12 Elm Row", borrowed: 14, late: 0, forfeits: 0},
  {seed: "marcus", name: "Marcus Bell", unit: "Flat 3B", borrowed: 9, late: 1, forfeits: 0},
  {seed: "yusuf", name: "Yusuf Kaya", unit: "4 Canal View", borrowed: 6, late: 3, forfeits: 0},
  {seed: "dee", name: "Dee Okafor", unit: "Flat 1A", borrowed: 11, late: 5, forfeits: 1},
  {seed: "tomas", name: "Tomas Lind", unit: "27 Elm Row", borrowed: 0, late: 0, forfeits: 0},
];

const TOOLS = [
  {owner: "priya", title: "Bosch 18V cordless drill", deposit: 60n, fee: 3n, days: 7,
   notes: "Two batteries; the second one holds about half a charge. Chuck is a little worn."},
  {owner: "priya", title: "Wallpaper steamer", deposit: 45n, fee: 2n, days: 4,
   notes: "Works fine, the hose fitting needs a firm push to seat properly."},
  {owner: "marcus", title: "Extending ladder, 3.2m", deposit: 90n, fee: 5n, days: 3,
   notes: "Heavy. One rubber foot has been replaced. Do not lend to anyone without a car."},
  {owner: "yusuf", title: "Petrol pressure washer", deposit: 180n, fee: 12n, days: 2,
   notes: "Bring it back with the tank empty. Pull start can take a few goes when cold."},
  {owner: "dee", title: "Tile cutter", deposit: 55n, fee: 3n, days: 5, notes: "Blade replaced last spring."},
  {owner: "marcus", title: "Wheelbarrow", deposit: 30n, fee: 1n, days: 14, notes: "Tyre needs pumping now and then."},
];

const usdc = (whole: bigint) => whole * 1_000_000n;

const members = new Map<string, string>();
for (const person of PEOPLE) {
  const memberAddress = address(person.seed);
  inviteMember(memberAddress, person.name, person.unit);
  db().prepare("UPDATE members SET status = 'active' WHERE address = ?").run(memberAddress);
  members.set(person.seed, memberAddress);
}

const listings = TOOLS.map((tool) =>
  createListing({
    ownerAddress: members.get(tool.owner)!,
    title: tool.title,
    description: "",
    conditionNotes: tool.notes,
    photoPath: null,
    deposit: usdc(tool.deposit),
    dailyLateFee: usdc(tool.fee),
    maxDays: tool.days,
  }),
);

// Settled history, so the ranking and the badges have something to show.
const insertLoan = db().prepare(
  `INSERT INTO loans (loan_id, listing_id, owner_address, borrower_address, deposit,
                      daily_late_fee, due_at, started_at, status, outcome, returned_at,
                      late_days, owner_amount, borrower_amount, opened_block, opened_tx)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?, ?, ?, ?, ?, 0, ?)`,
);

let counter = 0;
for (const person of PEOPLE) {
  const borrower = members.get(person.seed)!;
  for (let index = 0; index < person.borrowed; index++) {
    const listing = listings[index % listings.length];
    if (listing.ownerAddress === borrower) continue;

    const forfeited = index < person.forfeits;
    const late = !forfeited && index < person.forfeits + person.late;
    const lateDays = forfeited ? 40 : late ? 1 + (index % 3) : 0;
    const ownerAmount = forfeited
      ? listing.deposit
      : (() => {
          const fee = BigInt(lateDays) * listing.dailyLateFee;
          return fee > listing.deposit ? listing.deposit : fee;
        })();

    const startedAt = now() - (200 - counter) * 86_400;
    counter += 1;

    insertLoan.run(
      `0x${crypto.randomBytes(32).toString("hex")}`,
      listing.id,
      listing.ownerAddress,
      borrower,
      listing.deposit.toString(),
      listing.dailyLateFee.toString(),
      startedAt + 3 * 86_400,
      startedAt,
      forfeited ? "forfeited" : "owner_confirmed",
      forfeited ? null : startedAt + (3 + lateDays) * 86_400,
      lateDays,
      ownerAmount.toString(),
      (listing.deposit - ownerAmount).toString(),
      `0x${crypto.randomBytes(32).toString("hex")}`,
    );
  }
}

console.log(
  `seeded ${PEOPLE.length} members, ${listings.length} tools and ${counter} settled loans`,
);
console.log("browse / and you should see Priya's tools above Dee's");
