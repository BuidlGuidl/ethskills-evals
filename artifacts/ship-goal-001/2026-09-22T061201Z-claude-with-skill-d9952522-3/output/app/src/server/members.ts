import {db, normaliseAddress, now} from "./db.ts";
import {sessionAddress} from "./session.ts";
import {emptyRecord, type TrackRecord} from "@/core/reputation.ts";

export interface Member {
  address: string;
  displayName: string;
  unitLabel: string | null;
  bio: string | null;
  status: "invited" | "active" | "suspended";
  isAdmin: boolean;
  createdAt: number;
}

interface MemberRow {
  address: string;
  display_name: string;
  unit_label: string | null;
  bio: string | null;
  status: Member["status"];
  is_admin: number;
  created_at: number;
}

const toMember = (row: MemberRow): Member => ({
  address: row.address,
  displayName: row.display_name,
  unitLabel: row.unit_label,
  bio: row.bio,
  status: row.status,
  isAdmin: row.is_admin === 1,
  createdAt: row.created_at,
});

/** Addresses in TOOLSHED_ADMINS can invite and suspend, and are members automatically. */
export function adminAddresses(): string[] {
  return (process.env.TOOLSHED_ADMINS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^0x[0-9a-f]{40}$/.test(value));
}

export function getMember(address: string): Member | null {
  const row = db()
    .prepare("SELECT * FROM members WHERE address = ?")
    .get(normaliseAddress(address)) as MemberRow | undefined;
  return row ? toMember(row) : null;
}

export function listMembers(): Member[] {
  const rows = db()
    .prepare("SELECT * FROM members ORDER BY display_name COLLATE NOCASE")
    .all() as MemberRow[];
  return rows.map(toMember);
}

export function inviteMember(address: string, displayName: string, unitLabel?: string): Member {
  const normalised = normaliseAddress(address);
  db()
    .prepare(
      `INSERT INTO members (address, display_name, unit_label, status, is_admin, created_at)
       VALUES (?, ?, ?, 'invited', ?, ?)
       ON CONFLICT(address) DO UPDATE SET display_name = excluded.display_name,
                                          unit_label = excluded.unit_label`,
    )
    .run(
      normalised,
      displayName,
      unitLabel ?? null,
      adminAddresses().includes(normalised) ? 1 : 0,
      now(),
    );
  return getMember(normalised)!;
}

export function setMemberStatus(address: string, status: Member["status"]): void {
  db()
    .prepare("UPDATE members SET status = ? WHERE address = ?")
    .run(status, normaliseAddress(address));
}

export function updateProfile(address: string, fields: {displayName?: string; unitLabel?: string; bio?: string}): void {
  const member = getMember(address);
  if (!member) return;
  db()
    .prepare("UPDATE members SET display_name = ?, unit_label = ?, bio = ? WHERE address = ?")
    .run(
      fields.displayName ?? member.displayName,
      fields.unitLabel ?? member.unitLabel,
      fields.bio ?? member.bio,
      normaliseAddress(address),
    );
}

/**
 * Called on a successful signature check.
 *
 * The association's roll is the gate: an address must already be on it. An admin address is
 * enrolled on first sign-in so a fresh deployment is not locked out of its own admin screens.
 */
export function signIn(address: string): {ok: true; member: Member} | {ok: false; reason: string} {
  const normalised = normaliseAddress(address);
  let member = getMember(normalised);

  if (!member && adminAddresses().includes(normalised)) {
    member = inviteMember(normalised, `Admin ${normalised.slice(0, 6)}`);
  }
  if (!member) {
    return {
      ok: false,
      reason: "That wallet is not on the association's member list. Ask a committee member to add it.",
    };
  }
  if (member.status === "suspended") {
    return {ok: false, reason: "This membership is suspended."};
  }

  db()
    .prepare("UPDATE members SET status = 'active', last_seen_at = ? WHERE address = ?")
    .run(now(), normalised);
  return {ok: true, member: {...member, status: "active"}};
}

/** The signed-in member, or null. Use in API routes and server components. */
export async function currentMember(): Promise<Member | null> {
  const address = await sessionAddress();
  if (!address) return null;
  const member = getMember(address);
  if (!member || member.status === "suspended") return null;
  return member;
}

// ---------------------------------------------------------------- track records

interface RecordRow {
  address: string;
  display_name: string | null;
  loans_borrowed: number;
  late_returns: number;
  forfeits: number;
  late_days_total: number;
  loans_lent: number;
  late_fees_earned: string | null;
  loans_outstanding: number;
  member_since: number | null;
}

/**
 * Track records for every member, computed from indexed loans.
 *
 * Done in one query rather than per member: the browse screen needs a score for every owner on
 * the page, and an association this size fits comfortably in a single scan. `late_fees_earned`
 * is summed as a REAL and re-rounded, which is exact for any plausible USDC total (well inside
 * 2^53 base units — about 9 billion USDC).
 */
export function allTrackRecords(): Map<string, TrackRecord> {
  const rows = db()
    .prepare(
      `SELECT m.address,
              m.display_name,
              COUNT(b.loan_id)                                                AS loans_borrowed,
              COALESCE(SUM(CASE WHEN b.late_days > 0 THEN 1 ELSE 0 END), 0)   AS late_returns,
              COALESCE(SUM(CASE WHEN b.outcome = 'forfeited' THEN 1 ELSE 0 END), 0) AS forfeits,
              COALESCE(SUM(b.late_days), 0)                                   AS late_days_total,
              MIN(b.started_at)                                               AS member_since,
              (SELECT COUNT(*) FROM loans l
                 WHERE l.owner_address = m.address AND l.status = 'closed')   AS loans_lent,
              (SELECT COALESCE(SUM(CAST(l.owner_amount AS REAL)), 0) FROM loans l
                 WHERE l.owner_address = m.address AND l.status = 'closed')   AS late_fees_earned,
              (SELECT COUNT(*) FROM loans l
                 WHERE l.borrower_address = m.address
                   AND l.status IN ('active', 'disputed'))                    AS loans_outstanding
         FROM members m
         LEFT JOIN loans b
           ON b.borrower_address = m.address AND b.status = 'closed'
        GROUP BY m.address`,
    )
    .all() as RecordRow[];

  const records = new Map<string, TrackRecord>();
  for (const row of rows) {
    records.set(row.address, {
      address: row.address,
      displayName: row.display_name,
      loansBorrowed: row.loans_borrowed,
      lateReturns: row.late_returns,
      forfeits: row.forfeits,
      lateDaysTotal: row.late_days_total,
      loansLent: row.loans_lent,
      lateFeesEarned: BigInt(Math.round(Number(row.late_fees_earned ?? 0))),
      loansOutstanding: row.loans_outstanding,
      memberSince: row.member_since,
    });
  }
  return records;
}

export function trackRecord(address: string): TrackRecord {
  const normalised = normaliseAddress(address);
  return allTrackRecords().get(normalised) ?? emptyRecord(normalised);
}
