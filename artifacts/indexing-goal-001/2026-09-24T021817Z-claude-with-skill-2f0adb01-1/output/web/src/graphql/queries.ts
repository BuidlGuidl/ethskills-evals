import { query } from "./client";
import { monthKey } from "@/streak";

/* ------------------------------------------------------------------ types */

export type FeedCheckIn = {
  id: string;
  memberAddress: string;
  note: string;
  streak: number;
  timestamp: number;
  transactionHash: string;
  sortKey: string;
};

export type MemberProfile = {
  address: string;
  totalCheckIns: number;
  /** Raw snapshot from the chain — pass through `liveStreak()` before display. */
  streakAtLastCheckIn: number;
  longestStreak: number;
  lastDay: number;
  firstCheckInAt: number;
  lastCheckInAt: number;
  recentCheckIns: { id: string; note: string; timestamp: number; day: number }[];
};

export type LeaderboardRow = {
  rank: number;
  address: string;
  checkIns: number;
  /** All-time total, for context next to the monthly count. */
  totalCheckIns: number;
  streakAtLastCheckIn: number;
  lastDay: number;
};

/* ----------------------------------------------------------- 1. the feed */

const FEED_QUERY = /* GraphQL */ `
  query Feed($first: Int!, $cursor: BigInt!) {
    checkIns(
      first: $first
      orderBy: sortKey
      orderDirection: desc
      where: { sortKey_lt: $cursor }
    ) {
      id
      memberAddress
      note
      streak
      timestamp
      transactionHash
      sortKey
    }
  }
`;

/** Sentinel cursor meaning "from the newest check-in". Larger than any sortKey. */
export const FEED_HEAD = "999999999999999999999999";

/**
 * A page of the global feed, newest first, spanning the contract's entire
 * history — page 1 is today, page N is whatever month the indexer reaches.
 *
 * Paginates on `sortKey` (block number + log index) rather than `skip`. With
 * `skip`, a check-in landing between two requests shifts every later row down
 * by one and the reader silently sees a duplicate; a keyset cursor is anchored
 * to a row, so new arrivals at the head cannot disturb it.
 */
export async function fetchFeed(
  { first = 50, cursor = FEED_HEAD }: { first?: number; cursor?: string } = {}
): Promise<{ checkIns: FeedCheckIn[]; nextCursor: string | null }> {
  const data = await query<{ checkIns: RawCheckIn[] }>(
    FEED_QUERY,
    { first, cursor },
    { revalidate: 0 }
  );
  const checkIns = data.checkIns.map(
    (c): FeedCheckIn => ({
      id: c.id,
      memberAddress: c.memberAddress,
      note: c.note,
      streak: c.streak,
      timestamp: Number(c.timestamp),
      transactionHash: c.transactionHash,
      sortKey: c.sortKey,
    })
  );
  return {
    checkIns,
    // A short page means we reached the contract's first day.
    nextCursor:
      checkIns.length === first ? checkIns[checkIns.length - 1].sortKey : null,
  };
}

/* ------------------------------------------------------- 2. the profile */

const MEMBER_QUERY = /* GraphQL */ `
  query Member($id: ID!, $recent: Int!) {
    member(id: $id) {
      address
      totalCheckIns
      streakAtLastCheckIn
      longestStreak
      lastDay
      firstCheckInAt
      lastCheckInAt
      checkIns(first: $recent, orderBy: sortKey, orderDirection: desc) {
        id
        note
        timestamp
        day
      }
    }
  }
`;

/**
 * One member's profile. `null` when the address has never checked in — that is
 * a real, expected state (a wallet that has not joined), not an error.
 *
 * Note this is a single indexed lookup. The alternative — replaying the
 * member's logs at read time — would mean an `eth_getLogs` scan across every
 * block since deployment on each page view.
 */
export async function fetchMember(
  address: string,
  { recent = 30 }: { recent?: number } = {}
): Promise<MemberProfile | null> {
  const data = await query<{ member: RawMember | null }>(
    MEMBER_QUERY,
    { id: address.toLowerCase(), recent },
    { revalidate: 0 }
  );
  const m = data.member;
  if (!m) return null;
  return {
    address: m.address,
    totalCheckIns: m.totalCheckIns,
    streakAtLastCheckIn: m.streakAtLastCheckIn,
    longestStreak: m.longestStreak,
    lastDay: m.lastDay,
    firstCheckInAt: Number(m.firstCheckInAt),
    lastCheckInAt: Number(m.lastCheckInAt),
    recentCheckIns: m.checkIns.map((c) => ({
      id: c.id,
      note: c.note,
      timestamp: Number(c.timestamp),
      day: c.day,
    })),
  };
}

/* --------------------------------------------------- 3. the leaderboard */

const LEADERBOARD_QUERY = /* GraphQL */ `
  query Leaderboard($month: String!, $first: Int!) {
    memberMonths(
      first: $first
      orderBy: checkIns
      orderDirection: desc
      where: { month: $month }
    ) {
      checkIns
      lastCheckInAt
      member {
        address
        totalCheckIns
        streakAtLastCheckIn
        lastDay
      }
    }
    month(id: $month) {
      checkIns
      activeMembers
    }
  }
`;

/**
 * Top members for a calendar month (defaults to the current UTC month).
 *
 * The ranking is a sort over a pre-aggregated per-member/per-month counter that
 * the indexer maintains, so it costs one query whether the month has 10
 * check-ins or 100,000 — and any past month is just as cheap as this one.
 * Ties are broken by who got there first.
 */
export async function fetchLeaderboard(
  { month = monthKey(), first = 50 }: { month?: string; first?: number } = {}
): Promise<{
  month: string;
  rows: LeaderboardRow[];
  totals: { checkIns: number; activeMembers: number };
}> {
  const data = await query<{
    memberMonths: RawMemberMonth[];
    month: { checkIns: number; activeMembers: number } | null;
  }>(LEADERBOARD_QUERY, { month, first }, { revalidate: 30 });

  const sorted = [...data.memberMonths].sort(
    (a, b) =>
      b.checkIns - a.checkIns || Number(a.lastCheckInAt) - Number(b.lastCheckInAt)
  );

  return {
    month,
    rows: sorted.map((row, i) => ({
      rank: i + 1,
      address: row.member.address,
      checkIns: row.checkIns,
      totalCheckIns: row.member.totalCheckIns,
      streakAtLastCheckIn: row.member.streakAtLastCheckIn,
      lastDay: row.member.lastDay,
    })),
    totals: data.month ?? { checkIns: 0, activeMembers: 0 },
  };
}

/* ------------------------------------------------------- community stats */

export async function fetchGlobalStats(): Promise<{
  totalCheckIns: number;
  totalMembers: number;
}> {
  const data = await query<{
    global: { totalCheckIns: number; totalMembers: number } | null;
  }>(`{ global(id: "global") { totalCheckIns totalMembers } }`, {}, { revalidate: 30 });
  return data.global ?? { totalCheckIns: 0, totalMembers: 0 };
}

/** Months that have any activity, newest first — powers the month switcher. */
export async function fetchMonths(first = 24): Promise<string[]> {
  const data = await query<{ months: { id: string }[] }>(
    `query Months($first: Int!) {
       months(first: $first, orderBy: id, orderDirection: desc) { id }
     }`,
    { first },
    { revalidate: 300 }
  );
  return data.months.map((m) => m.id);
}

/* ------------------------------------------------------------ raw shapes */

type RawCheckIn = {
  id: string;
  memberAddress: string;
  note: string;
  streak: number;
  timestamp: string;
  transactionHash: string;
  sortKey: string;
};

type RawMember = {
  address: string;
  totalCheckIns: number;
  streakAtLastCheckIn: number;
  longestStreak: number;
  lastDay: number;
  firstCheckInAt: string;
  lastCheckInAt: string;
  checkIns: { id: string; note: string; timestamp: string; day: number }[];
};

type RawMemberMonth = {
  checkIns: number;
  lastCheckInAt: string;
  member: {
    address: string;
    totalCheckIns: number;
    streakAtLastCheckIn: number;
    lastDay: number;
  };
};
