/**
 * Renders all three screens through the read-side client, as plain text.
 * Point it at the local stack (anvil + `npm run dev` in indexer/) or at
 * production by overriding the env vars.
 *
 *   npm run demo
 *   INDEXER_URL=https://... STREAK_ADDRESS=0x... RPC_URL=https://... npm run demo
 */
import { anvil, base } from "viem/chains";
import type { Address } from "viem";

import { createStreakReader } from "./readSide";

const chainId = Number(process.env.CHAIN_ID ?? 31337);
const reader = createStreakReader({
  indexerUrl: process.env.INDEXER_URL ?? "http://localhost:42069",
  address: (process.env.STREAK_ADDRESS ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3") as Address,
  rpcUrl: process.env.RPC_URL ?? (chainId === 31337 ? "http://127.0.0.1:8545" : undefined),
  chain: chainId === 31337 ? anvil : base,
});

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const when = (ts: number) => new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16);

const main = async () => {
  console.log("\n=== SCREEN 1: global feed (newest first) ===");
  const feed = await reader.getFeed({ limit: 8 });
  for (const item of feed.items) {
    console.log(
      `  ${when(item.timestamp)}  ${short(item.member)}  streak ${String(item.streak).padStart(3)}  ${item.note || "—"}`,
    );
  }
  console.log(`  … nextCursor=${feed.nextCursor}`);

  console.log("\n=== SCREEN 3: leaderboard (this month) ===");
  const board = await reader.getLeaderboard({ limit: 10 });
  console.log(`  month ${board.month}`);
  for (const row of board.items) {
    console.log(
      `  #${row.rank}  ${short(row.member)}  ${String(row.checkInsThisMonth).padStart(3)} this month` +
        `   streak ${String(row.currentStreak).padStart(3)}   ${row.totalCheckIns} all-time`,
    );
  }

  const who = board.items[0]?.member;
  if (!who) return console.log("\n(no check-ins indexed yet)");

  console.log(`\n=== SCREEN 2: profile ${short(who)} ===`);
  const profile = await reader.getProfile(who);
  console.log(`  current streak : ${profile.currentStreak} days`);
  console.log(`  all-time       : ${profile.totalCheckIns} check-ins`);
  console.log(`  longest streak : ${profile.longestStreak} days`);
  console.log(`  member since   : ${profile.firstCheckInAt ? when(profile.firstCheckInAt) : "—"}`);
  console.log(`  checked in today: ${profile.checkedInToday}`);
  console.log(`  can check in now: ${await reader.canCheckIn(who)}`);
  for (const item of profile.recentCheckIns.slice(0, 5)) {
    console.log(`    ${when(item.timestamp)}  ${item.note || "—"}`);
  }

  const rank = await reader.getRank(who);
  console.log(`\n  rank this month: #${rank.rank} with ${rank.checkInsThisMonth} check-ins`);

  // Live streaks for the whole leaderboard in one request. Skipped where
  // Multicall3 is not deployed (some local nodes); it is present on Base.
  const members = board.items.map((row) => row.member);
  try {
    const live = await reader.getLiveMemberStats(members);
    console.log("\n  live via Multicall3 (1 request):");
    for (const m of live) console.log(`    ${short(m.address)} streak=${m.currentStreak} total=${m.totalCheckIns}`);
  } catch {
    console.log("\n  (Multicall3 not deployed on this chain — skipping batched live read)");
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
