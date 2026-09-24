#!/usr/bin/env node
/**
 * Renders all three screens in the terminal against a deployed subgraph.
 * The fastest way for a developer to confirm the read side works end to end.
 *
 *   npm run screens -- feed
 *   npm run screens -- profile 0xabc...
 *   npm run screens -- leaderboard 2026-08
 */
import { configFromEnv } from "./config.js";
import { getGlobalFeed } from "./feed.js";
import { getCommunityStats, getMemberMonthRank, getMonthlyLeaderboard } from "./leaderboard.js";
import { getMemberProfile } from "./profile.js";
import { indexingStatus } from "./graphql.js";
import { dateKey, relativeTime } from "./time.js";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function main() {
  const [screen = "feed", arg] = process.argv.slice(2);
  const config = configFromEnv();

  const status = await indexingStatus(config);
  console.log(`subgraph synced to block ${status.block}${status.hasIndexingErrors ? " (INDEXING ERRORS)" : ""}\n`);

  if (screen === "feed") {
    const stats = await getCommunityStats(config);
    console.log(`GLOBAL FEED — ${stats.totalCheckIns} check-ins from ${stats.totalMembers} members\n`);
    const page = await getGlobalFeed(config, { first: Number(arg) || 25 });
    for (const c of page.checkIns) {
      const note = c.note ? `  "${c.note}"` : "";
      console.log(`${short(c.member).padEnd(14)} ${relativeTime(c.timestamp).padStart(8)}  day ${c.date}  🔥${c.streakAfter}${note}`);
    }
    console.log(`\nnext cursor: ${page.nextCursor ?? "(end of history)"}`);
    return;
  }

  if (screen === "profile") {
    if (!arg) throw new Error("usage: profile <address>");
    const p = await getMemberProfile(config, arg);
    if (p.isNewMember) {
      console.log(`${arg} has never checked in.`);
      return;
    }
    const rank = await getMemberMonthRank(config, arg);
    console.log(`PROFILE ${p.address}`);
    console.log(`  current streak    ${p.currentStreak} day(s)${p.currentStreak === 0 && p.streakAsOfLastCheckIn > 0 ? `  (lapsed — was ${p.streakAsOfLastCheckIn})` : ""}`);
    console.log(`  longest streak    ${p.longestStreak}`);
    console.log(`  all-time check-ins ${p.totalCheckIns}`);
    console.log(`  member since      ${dateKey(p.firstCheckInDay)}`);
    console.log(`  this month        ${rank.checkIns} check-ins (rank ${rank.rank ?? "—"})`);
    console.log(`  can check in now  ${p.canCheckInToday ? "yes" : "no — already did today"}`);
    console.log("\n  recent:");
    for (const c of p.recentCheckIns) {
      console.log(`    ${c.date}  🔥${String(c.streakAfter).padEnd(3)} ${c.note}`);
    }
    return;
  }

  if (screen === "leaderboard") {
    const board = await getMonthlyLeaderboard(config, { month: arg, first: 25 });
    console.log(`LEADERBOARD ${board.month} — ${board.daysElapsed} day(s) elapsed\n`);
    for (const r of board.rows) {
      console.log(`${String(r.rank).padStart(3)}. ${short(r.member).padEnd(14)} ${String(r.checkIns).padStart(3)}/${board.daysElapsed}  streak 🔥${r.currentStreak}  all-time ${r.totalCheckIns}`);
    }
    return;
  }

  throw new Error(`unknown screen "${screen}" (feed | profile | leaderboard)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
