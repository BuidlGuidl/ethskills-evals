import { ponder } from "ponder:registry";
import { checkIns, members, monthlyMemberCheckIns } from "ponder:schema";
import { monthFromUnixTimestamp } from "./dates";

ponder.on("StreakCheckIn:CheckIn", async ({ event, context }) => {
  const member = event.args.member.toLowerCase() as `0x${string}`;
  const day = Number(event.args.day);
  const timestamp = Number(event.args.timestamp);
  const month = monthFromUnixTimestamp(timestamp);
  const checkInId = `${context.chain.id}:${event.transaction.hash}:${event.log.logIndex}`;

  await context.db.insert(checkIns).values({
    id: checkInId,
    member,
    day,
    timestamp,
    month,
    note: event.args.note,
    transactionHash: event.transaction.hash,
    blockNumber: event.block.number,
    logIndex: event.log.logIndex,
  });

  const existingMember = await context.db.find(members, { address: member });
  const nextTotal = (existingMember?.totalCheckIns ?? 0) + 1;
  const nextStreak =
    existingMember === null || day > existingMember.lastCheckInDay + 1
      ? 1
      : existingMember.currentStreak + 1;

  if (existingMember === null) {
    await context.db.insert(members).values({
      address: member,
      totalCheckIns: nextTotal,
      currentStreak: nextStreak,
      lastCheckInDay: day,
      lastCheckInAt: timestamp,
    });
  } else {
    await context.db.update(members, { address: member }).set({
      totalCheckIns: nextTotal,
      currentStreak: nextStreak,
      lastCheckInDay: day,
      lastCheckInAt: timestamp,
    });
  }

  const monthlyId = `${month}:${member}`;
  const existingMonthly = await context.db.find(monthlyMemberCheckIns, { id: monthlyId });

  if (existingMonthly === null) {
    await context.db.insert(monthlyMemberCheckIns).values({
      id: monthlyId,
      member,
      month,
      checkIns: 1,
      lastCheckInAt: timestamp,
    });
  } else {
    await context.db.update(monthlyMemberCheckIns, { id: monthlyId }).set({
      checkIns: existingMonthly.checkIns + 1,
      lastCheckInAt: timestamp,
    });
  }
});
