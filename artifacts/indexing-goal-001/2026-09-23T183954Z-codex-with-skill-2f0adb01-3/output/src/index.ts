import { ponder } from "ponder:registry";
import { checkIns, memberMonths, members } from "ponder:schema";

import { unixSecondsToMonthKey } from "./date";

ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const member = event.args.member.toLowerCase() as `0x${string}`;
  const day = Number(event.args.day);
  const timestamp = event.block.timestamp;
  const month = unixSecondsToMonthKey(timestamp);

  await context.db.insert(checkIns).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    checkInId: event.args.checkInId,
    member,
    day,
    note: event.args.note,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });

  const existingMember = await context.db.find(members, { address: member });
  const streakAtLastCheckIn =
    existingMember == null
      ? 1
      : existingMember.lastCheckInDay === day - 1
        ? existingMember.streakAtLastCheckIn + 1
        : 1;

  if (existingMember == null) {
    await context.db.insert(members).values({
      address: member,
      totalCheckIns: 1,
      streakAtLastCheckIn,
      lastCheckInDay: day,
      lastCheckInAt: timestamp,
      updatedAt: timestamp,
    });
  } else {
    await context.db.update(members, { address: member }).set({
      totalCheckIns: existingMember.totalCheckIns + 1,
      streakAtLastCheckIn,
      lastCheckInDay: day,
      lastCheckInAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const existingMonth = await context.db.find(memberMonths, { member, month });
  if (existingMonth == null) {
    await context.db.insert(memberMonths).values({
      member,
      month,
      checkIns: 1,
      lastCheckInAt: timestamp,
    });
  } else {
    await context.db.update(memberMonths, { member, month }).set({
      checkIns: existingMonth.checkIns + 1,
      lastCheckInAt: timestamp,
    });
  }
});
