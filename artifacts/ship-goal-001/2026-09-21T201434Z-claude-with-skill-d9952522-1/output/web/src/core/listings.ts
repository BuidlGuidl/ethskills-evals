import { keccak256, toHex } from "viem";
import { db, nowSeconds } from "./db";
import { allTrackRecords, type TrackRecord } from "./reputation";

export type Listing = {
  id: string;
  listingRef: `0x${string}`;
  ownerAddress: string;
  title: string;
  description: string;
  conditionNote: string;
  photoUrl: string | null;
  deposit: string;
  dailyLateFee: string;
  maxDays: number;
  available: boolean;
  createdAt: number;
  /** Whether a loan is currently out or pending on this listing. */
  onLoan: boolean;
  owner: TrackRecord;
};

type ListingRow = {
  id: string;
  listing_ref: string;
  owner_address: string;
  title: string;
  description: string;
  condition_note: string;
  photo_url: string | null;
  deposit: string;
  daily_late_fee: string;
  max_days: number;
  available: number;
  created_at: number;
  on_loan: number;
};

/** The onchain `listingRef` for an app-level listing id. */
export function listingRefFor(id: string): `0x${string}` {
  return keccak256(toHex(id));
}

const SELECT_LISTINGS = `
  SELECT l.*,
         EXISTS (
           SELECT 1 FROM loan_listings ll
           JOIN loans ln ON ln.loan_id = ll.loan_id
           WHERE ll.listing_id = l.id
             AND ln.status IN ('requested', 'active', 'return_asserted')
         ) AS on_loan
  FROM listings l
`;

function hydrate(rows: ListingRow[]): Listing[] {
  const records = allTrackRecords();
  return rows.map((r) => ({
    id: r.id,
    listingRef: r.listing_ref as `0x${string}`,
    ownerAddress: r.owner_address,
    title: r.title,
    description: r.description,
    conditionNote: r.condition_note,
    photoUrl: r.photo_url,
    deposit: r.deposit,
    dailyLateFee: r.daily_late_fee,
    maxDays: r.max_days,
    available: r.available === 1,
    createdAt: r.created_at,
    onLoan: r.on_loan === 1,
    owner: records.get(r.owner_address) ?? {
      address: r.owner_address,
      displayName: null,
      loansBorrowed: 0,
      lateReturns: 0,
      unreturned: 0,
      loansLent: 0,
      totalDaysLate: 0,
      onTimeRate: null,
      score: 0,
    },
  }));
}

export type BrowseSort = "trust" | "newest" | "deposit";

/**
 * The browse screen.
 *
 * Default sort is by the *owner's* track record, descending: the association's
 * whole point is that reliable neighbors surface first. Sorting happens here,
 * in SQL + JS, never onchain — the contract emits the facts and this is where
 * they become a ranking.
 */
export function browseListings(options: { sort?: BrowseSort; search?: string; includeUnavailable?: boolean } = {}): Listing[] {
  const { sort = "trust", search, includeUnavailable = false } = options;

  const where: string[] = [];
  const params: unknown[] = [];

  if (!includeUnavailable) where.push("l.available = 1");
  if (search) {
    where.push("(l.title LIKE ? OR l.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const sql = `${SELECT_LISTINGS} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const listings = hydrate(db().prepare(sql).all(...params) as ListingRow[]);

  switch (sort) {
    case "newest":
      return listings.sort((a, b) => b.createdAt - a.createdAt);
    case "deposit":
      return listings.sort((a, b) => Number(BigInt(a.deposit) - BigInt(b.deposit)));
    case "trust":
    default:
      return listings.sort((a, b) => {
        // Things you can borrow right now beat things that are already out.
        if (a.onLoan !== b.onLoan) return a.onLoan ? 1 : -1;
        if (b.owner.score !== a.owner.score) return b.owner.score - a.owner.score;
        // Tie-break on volume so an established lender beats a brand-new one.
        if (b.owner.loansLent !== a.owner.loansLent) return b.owner.loansLent - a.owner.loansLent;
        return b.createdAt - a.createdAt;
      });
  }
}

export function getListing(id: string): Listing | null {
  const row = db().prepare(`${SELECT_LISTINGS} WHERE l.id = ?`).get(id) as ListingRow | undefined;
  return row ? hydrate([row])[0] : null;
}

export function listingsByOwner(address: string): Listing[] {
  const rows = db()
    .prepare(`${SELECT_LISTINGS} WHERE l.owner_address = ? ORDER BY l.created_at DESC`)
    .all(address.toLowerCase()) as ListingRow[];
  return hydrate(rows);
}

export type ListingInput = {
  title: string;
  description?: string;
  conditionNote?: string;
  photoUrl?: string | null;
  deposit: string;
  dailyLateFee: string;
  maxDays: number;
};

export function createListing(ownerAddress: string, input: ListingInput): Listing {
  const id = crypto.randomUUID();
  const ts = nowSeconds();

  db()
    .prepare(
      `INSERT INTO listings (id, listing_ref, owner_address, title, description, condition_note,
                             photo_url, deposit, daily_late_fee, max_days, available, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      id,
      listingRefFor(id),
      ownerAddress.toLowerCase(),
      input.title,
      input.description ?? "",
      input.conditionNote ?? "",
      input.photoUrl ?? null,
      input.deposit,
      input.dailyLateFee,
      input.maxDays,
      ts,
      ts,
    );

  return getListing(id)!;
}

export function updateListing(id: string, ownerAddress: string, patch: Partial<ListingInput> & { available?: boolean }) {
  const existing = getListing(id);
  if (!existing) throw new Error("listing not found");
  if (existing.ownerAddress !== ownerAddress.toLowerCase()) throw new Error("not your listing");

  db()
    .prepare(
      `UPDATE listings SET title = ?, description = ?, condition_note = ?, photo_url = ?,
                           deposit = ?, daily_late_fee = ?, max_days = ?, available = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      patch.title ?? existing.title,
      patch.description ?? existing.description,
      patch.conditionNote ?? existing.conditionNote,
      patch.photoUrl !== undefined ? patch.photoUrl : existing.photoUrl,
      patch.deposit ?? existing.deposit,
      patch.dailyLateFee ?? existing.dailyLateFee,
      patch.maxDays ?? existing.maxDays,
      patch.available !== undefined ? (patch.available ? 1 : 0) : existing.available ? 1 : 0,
      nowSeconds(),
      id,
    );

  return getListing(id)!;
}
