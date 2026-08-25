import { ponder } from "ponder:registry";
import { checkIn, member, monthlyMember } from "ponder:schema";
import type { Address } from "viem";

const monthKey = (seconds: bigint) => new Date(Number(seconds) * 1_000).toISOString().slice(0, 7);

ponder.on("Streak:CheckIn", async ({ event, context }) => {
  const address = event.args.member.toLowerCase() as Address;
  const day = Number(event.args.day);
  const timestamp = BigInt(event.args.timestamp);
  const id = `${event.transaction.hash}-${event.log.logIndex}`;
  const month = monthKey(timestamp);

  await context.db.insert(checkIn).values({
    id,
    member: address,
    note: event.args.note,
    timestamp,
    day,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });

  const prior = await context.db.find(member, { address });
  const currentStreak = prior && prior.latestDay === day - 1 ? prior.currentStreak + 1 : 1;
  await context.db
    .insert(member)
    .values({ address, currentStreak, totalCheckIns: 1, latestDay: day, latestCheckInAt: timestamp })
    .onConflictDoUpdate({
      currentStreak,
      totalCheckIns: (prior?.totalCheckIns ?? 0) + 1,
      latestDay: day,
      latestCheckInAt: timestamp,
    });

  const monthlyId = `${month}-${address}`;
  const monthly = await context.db.find(monthlyMember, { id: monthlyId });
  await context.db
    .insert(monthlyMember)
    .values({ id: monthlyId, month, member: address, checkIns: 1 })
    .onConflictDoUpdate({ checkIns: (monthly?.checkIns ?? 0) + 1 });
});
