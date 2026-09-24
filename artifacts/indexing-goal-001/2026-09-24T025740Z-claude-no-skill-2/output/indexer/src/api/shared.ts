import { formatMonth } from "../lib/time";

export type CheckInRow = {
  id: string;
  member: `0x${string}`;
  day: number;
  month: number;
  timestamp: bigint;
  note: string;
  streak: number;
  memberTotal: number;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
};

/** Wire shape of a feed item. Timestamps are unix seconds plus an ISO string. */
export function serializeCheckIn(row: CheckInRow) {
  return {
    id: row.id,
    member: row.member,
    note: row.note,
    timestamp: Number(row.timestamp),
    time: new Date(Number(row.timestamp) * 1000).toISOString(),
    day: row.day,
    month: formatMonth(row.month),
    // The member's streak and total *at the moment of this check-in*.
    streak: row.streak,
    memberTotal: row.memberTotal,
    blockNumber: Number(row.blockNumber),
    logIndex: row.logIndex,
    transactionHash: row.transactionHash,
  };
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Validate and normalize an address to the lowercase form the tables store. */
export function normalizeAddress(input: string | undefined): `0x${string}` | null {
  if (!input || !ADDRESS_RE.test(input.trim())) return null;
  return input.trim().toLowerCase() as `0x${string}`;
}

export function clampLimit(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}
