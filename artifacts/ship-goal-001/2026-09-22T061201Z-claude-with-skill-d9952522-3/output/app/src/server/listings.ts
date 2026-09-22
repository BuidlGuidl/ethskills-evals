import crypto from "node:crypto";

import {db, normaliseAddress, now} from "./db.ts";
import {allTrackRecords} from "./members.ts";
import {compareByReliability, emptyRecord, type TrackRecord} from "@/core/reputation.ts";

export interface Listing {
  id: string;
  ownerAddress: string;
  title: string;
  description: string;
  conditionNotes: string;
  photoPath: string | null;
  deposit: bigint;
  dailyLateFee: bigint;
  maxDays: number;
  status: "available" | "paused" | "retired";
  createdAt: number;
}

/** A listing plus everything the browse screen renders next to it. */
export interface BrowseEntry extends Listing {
  ownerName: string;
  ownerRecord: TrackRecord;
  /** Set while the tool is out on loan, so browse does not offer something already lent. */
  outOnLoanUntil: number | null;
}

interface ListingRow {
  id: string;
  owner_address: string;
  title: string;
  description: string;
  condition_notes: string;
  photo_path: string | null;
  deposit: string;
  daily_late_fee: string;
  max_days: number;
  status: Listing["status"];
  created_at: number;
}

const toListing = (row: ListingRow): Listing => ({
  id: row.id,
  ownerAddress: row.owner_address,
  title: row.title,
  description: row.description,
  conditionNotes: row.condition_notes,
  photoPath: row.photo_path,
  deposit: BigInt(row.deposit),
  dailyLateFee: BigInt(row.daily_late_fee),
  maxDays: row.max_days,
  status: row.status,
  createdAt: row.created_at,
});

/** Listing ids are bytes32 because they travel onchain inside the signed loan terms. */
export function newListingId(): string {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

export function createListing(input: {
  ownerAddress: string;
  title: string;
  description: string;
  conditionNotes: string;
  photoPath: string | null;
  deposit: bigint;
  dailyLateFee: bigint;
  maxDays: number;
}): Listing {
  const id = newListingId();
  const timestamp = now();
  db()
    .prepare(
      `INSERT INTO listings (id, owner_address, title, description, condition_notes, photo_path,
                             deposit, daily_late_fee, max_days, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
    )
    .run(
      id,
      normaliseAddress(input.ownerAddress),
      input.title,
      input.description,
      input.conditionNotes,
      input.photoPath,
      input.deposit.toString(),
      input.dailyLateFee.toString(),
      input.maxDays,
      timestamp,
      timestamp,
    );
  return getListing(id)!;
}

export function getListing(id: string): Listing | null {
  const row = db().prepare("SELECT * FROM listings WHERE id = ?").get(id) as
    | ListingRow
    | undefined;
  return row ? toListing(row) : null;
}

export function updateListingStatus(id: string, status: Listing["status"]): void {
  db()
    .prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, now(), id);
}

export function listingsByOwner(address: string): Listing[] {
  const rows = db()
    .prepare("SELECT * FROM listings WHERE owner_address = ? ORDER BY created_at DESC")
    .all(normaliseAddress(address)) as ListingRow[];
  return rows.map(toListing);
}

/**
 * The browse screen.
 *
 * Sorted by the *owner's* track record, so tools from members who hold up their end of the deal
 * surface first. The ranking is computed here, in the app, from indexed events — the contract
 * stores no score and no ordering. When the association decides that, say, a forfeit should cost
 * more, that is a change to `src/core/reputation.ts` and a redeploy of this app, not of the
 * escrow holding everyone's money.
 *
 * `search` matches title, description and condition notes. Tools currently out on loan are kept
 * in the results but marked, because knowing when a chainsaw is due back is useful.
 */
export function browse(options: {search?: string; includeUnavailable?: boolean} = {}): BrowseEntry[] {
  const clauses = ["l.status = 'available'"];
  const params: unknown[] = [];

  if (options.search) {
    clauses.push("(l.title LIKE ? OR l.description LIKE ? OR l.condition_notes LIKE ?)");
    const pattern = `%${options.search}%`;
    params.push(pattern, pattern, pattern);
  }

  const rows = db()
    .prepare(
      `SELECT l.*,
              m.display_name AS owner_name,
              (SELECT MAX(due_at) FROM loans o
                WHERE o.listing_id = l.id AND o.status IN ('active', 'disputed')) AS out_until
         FROM listings l
         JOIN members m ON m.address = l.owner_address
        WHERE ${clauses.join(" AND ")}
          AND m.status != 'suspended'`,
    )
    .all(...params) as (ListingRow & {owner_name: string; out_until: number | null})[];

  const records = allTrackRecords();
  const entries: BrowseEntry[] = rows.map((row) => ({
    ...toListing(row),
    ownerName: row.owner_name,
    ownerRecord: records.get(row.owner_address) ?? emptyRecord(row.owner_address, row.owner_name),
    outOnLoanUntil: row.out_until,
  }));

  return entries
    .filter((entry) => options.includeUnavailable !== false || entry.outOnLoanUntil === null)
    .sort((a, b) => {
      // Available now beats out-on-loan, whatever the owner's record.
      const aOut = a.outOnLoanUntil !== null ? 1 : 0;
      const bOut = b.outOnLoanUntil !== null ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      const byReliability = compareByReliability(a.ownerRecord, b.ownerRecord);
      if (byReliability !== 0) return byReliability;
      return b.createdAt - a.createdAt;
    });
}

/** True while an active or disputed loan exists for this listing. */
export function isOnLoan(listingId: string): boolean {
  const row = db()
    .prepare(
      "SELECT COUNT(*) AS n FROM loans WHERE listing_id = ? AND status IN ('active', 'disputed')",
    )
    .get(listingId) as {n: number};
  return row.n > 0;
}
