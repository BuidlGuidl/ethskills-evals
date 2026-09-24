import type { StreakConfig } from "./config.js";
import { query } from "./graphql.js";
import { currentMonthKey, liveStreak, monthDayRange, todayIndex } from "./time.js";
import type { CommunityStats, Leaderboard, LeaderboardRow } from "./types.js";

interface RawMemberMonth {
  checkIns: number;
  firstCheckInAt: string;
  lastCheckInAt: string;
  member: {
    id: string;
    currentStreak: number;
    lastCheckInDay: number;
    totalCheckIns: number;
  };
}

/**
 * SCREEN 3 — top members for a calendar month by number of check-ins.
 *
 * Ranking is precomputed by the indexer: one MemberMonth row per member per
 * month, so this is a single indexed `orderBy: checkIns desc` read rather than a
 * scan over the month's check-ins. Works identically for the current month and
 * for any month already in history.
 *
 * graph-node takes only one sort key, so ties are broken client-side by who
 * reached the count first. A tie straddling the page boundary can therefore
 * order those two rows arbitrarily; fetch a slightly larger page than you render
 * if that matters.
 */
export async function getMonthlyLeaderboard(
  config: StreakConfig,
  opts: { month?: string; first?: number; skip?: number; now?: number } = {},
): Promise<Leaderboard> {
  const month = opts.month ?? currentMonthKey(opts.now);
  const first = Math.min(opts.first ?? 25, 1000);
  const skip = opts.skip ?? 0;

  const data = await query<{ memberMonths: RawMemberMonth[] }>(
    config,
    `query Leaderboard($month: String!, $first: Int!, $skip: Int!) {
       memberMonths(
         first: $first
         skip: $skip
         orderBy: checkIns
         orderDirection: desc
         where: { month: $month }
       ) {
         checkIns
         firstCheckInAt
         lastCheckInAt
         member { id currentStreak lastCheckInDay totalCheckIns }
       }
     }`,
    { month, first, skip },
  );

  const rows: LeaderboardRow[] = data.memberMonths
    .slice()
    .sort((a, b) =>
      b.checkIns - a.checkIns || Number(a.firstCheckInAt) - Number(b.firstCheckInAt),
    )
    .map((mm, i) => ({
      rank: skip + i + 1,
      member: mm.member.id as `0x${string}`,
      checkIns: mm.checkIns,
      currentStreak: liveStreak(mm.member.currentStreak, mm.member.lastCheckInDay, opts.now),
      totalCheckIns: mm.member.totalCheckIns,
      lastCheckInAt: Number(mm.lastCheckInAt),
    }));

  const { firstDay, lastDay } = monthDayRange(month);
  const today = todayIndex(opts.now);
  const daysElapsed = Math.max(0, Math.min(today, lastDay) - firstDay + 1);

  return { month, daysElapsed, rows };
}

/** Where one member sits on a month's leaderboard, even if outside the top N. */
export async function getMemberMonthRank(
  config: StreakConfig,
  address: string,
  opts: { month?: string; now?: number } = {},
): Promise<{ month: string; checkIns: number; rank: number | null }> {
  const month = opts.month ?? currentMonthKey(opts.now);
  const id = `${address.toLowerCase()}-${month}`;

  const mine = await query<{ memberMonth: { checkIns: number } | null }>(
    config,
    `query MyMonth($id: ID!) { memberMonth(id: $id) { checkIns } }`,
    { id },
  );
  if (!mine.memberMonth) return { month, checkIns: 0, rank: null };

  // Rank = how many members beat this count, + 1. `first: 0` still reports the
  // total via a count-only page walk, so page in chunks of 1000.
  let ahead = 0;
  let skip = 0;
  for (;;) {
    const page = await query<{ memberMonths: { id: string }[] }>(
      config,
      `query Ahead($month: String!, $count: Int!, $skip: Int!) {
         memberMonths(
           first: 1000
           skip: $skip
           where: { month: $month, checkIns_gt: $count }
         ) { id }
       }`,
      { month, count: mine.memberMonth.checkIns, skip },
    );
    ahead += page.memberMonths.length;
    if (page.memberMonths.length < 1000 || skip >= 4000) break;
    skip += 1000;
  }

  return { month, checkIns: mine.memberMonth.checkIns, rank: ahead + 1 };
}

/** Community-wide totals, for a header strip. */
export async function getCommunityStats(config: StreakConfig): Promise<CommunityStats> {
  const data = await query<{
    community: { totalCheckIns: number; totalMembers: number; firstCheckInAt: string; lastCheckInAt: string } | null;
  }>(config, `query Stats { community(id: "global") { totalCheckIns totalMembers firstCheckInAt lastCheckInAt } }`);

  const c = data.community;
  return {
    totalCheckIns: c?.totalCheckIns ?? 0,
    totalMembers: c?.totalMembers ?? 0,
    firstCheckInAt: Number(c?.firstCheckInAt ?? 0),
    lastCheckInAt: Number(c?.lastCheckInAt ?? 0),
  };
}
