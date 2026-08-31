import { ponder } from "ponder:registry";
import { checkIn, member, memberMonth } from "ponder:schema";
import { monthOf } from "../utils/time";

/**
 * The only write the contract has, so the only handler the indexer needs.
 *
 * Ponder replays this for every historical CheckedIn log from the contract's
 * deployment block onwards, then keeps calling it for new blocks in realtime. The
 * three tables it maintains are what the API reads — no screen ever asks the chain
 * for history at request time.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member: address, day, streak, total, note } = event.args;
  const timestamp = Number(event.block.timestamp);
  const month = monthOf(timestamp);

  // 1. Append to the immutable log that backs the feeds.
  await context.db.insert(checkIn).values({
    id: `${event.block.number}-${event.log.logIndex}`,
    member: address,
    note,
    timestamp,
    day,
    month,
    streak,
    blockNumber: event.block.number,
    logIndex: event.log.logIndex,
    transactionHash: event.transaction.hash,
  });

  // 2. Roll up the member's profile. `streak` and `total` come from the contract,
  //    which already did the streak arithmetic, so there is nothing to recompute.
  await context.db
    .insert(member)
    .values({
      address,
      firstCheckInAt: timestamp,
      firstDay: day,
      lastCheckInAt: timestamp,
      lastDay: day,
      streakAsOfLastCheckIn: streak,
      longestStreak: streak,
      totalCheckIns: total,
    })
    .onConflictDoUpdate((row) => ({
      lastCheckInAt: timestamp,
      lastDay: day,
      streakAsOfLastCheckIn: streak,
      longestStreak: Math.max(row.longestStreak, streak),
      totalCheckIns: total,
    }));

  // 3. Increment the monthly bucket the leaderboard reads.
  await context.db
    .insert(memberMonth)
    .values({
      member: address,
      month,
      checkIns: 1,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      lastCheckInAt: timestamp,
    }));
});
