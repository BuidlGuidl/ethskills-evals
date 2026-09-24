import { BigInt } from "@graphprotocol/graph-ts";

import { CheckedIn } from "../generated/Streak/Streak";
import { CheckIn, Community, DayStat, Member, MemberMonth } from "../generated/schema";
import { dateKey, monthKey } from "./dates";

const GLOBAL = "global";

/**
 * The single handler. Every screen is served from what this writes:
 *
 *   feed        -> the CheckIn rows
 *   profile     -> the Member row
 *   leaderboard -> the MemberMonth rows
 *
 * Streak arithmetic is not re-derived here: the contract already computed the
 * member's streak and total and put them in the event, so the indexer cannot
 * drift from the chain.
 */
export function handleCheckedIn(event: CheckedIn): void {
  let day = event.params.day.toI32();
  let streak = event.params.streak.toI32();
  let total = event.params.total.toI32();
  let timestamp = event.params.timestamp;

  // ---- Member ------------------------------------------------------------
  let member = Member.load(event.params.member);
  let isNewMember = member == null;
  if (member == null) {
    member = new Member(event.params.member);
    member.longestStreak = 0;
    member.firstCheckInDay = day;
    member.firstCheckInAt = timestamp;
  }
  member.totalCheckIns = total;
  member.currentStreak = streak;
  if (streak > member.longestStreak) member.longestStreak = streak;
  member.lastCheckInDay = day;
  member.lastCheckInAt = timestamp;
  member.save();

  // ---- CheckIn (feed row) ------------------------------------------------
  let id = event.transaction.hash.concatI32(event.logIndex.toI32());
  let checkIn = new CheckIn(id);
  checkIn.member = member.id;
  checkIn.day = day;
  checkIn.date = dateKey(day);
  checkIn.note = event.params.note;
  checkIn.streakAfter = streak;
  checkIn.totalAfter = total;
  checkIn.timestamp = timestamp;
  checkIn.blockNumber = event.block.number;
  checkIn.txHash = event.transaction.hash;
  checkIn.logIndex = event.logIndex;
  checkIn.seq = event.block.number.times(BigInt.fromI32(100000)).plus(event.logIndex);
  checkIn.save();

  // ---- MemberMonth (leaderboard row) -------------------------------------
  let month = monthKey(day);
  let mmId = member.id.toHexString() + "-" + month;
  let memberMonth = MemberMonth.load(mmId);
  if (memberMonth == null) {
    memberMonth = new MemberMonth(mmId);
    memberMonth.member = member.id;
    memberMonth.month = month;
    memberMonth.checkIns = 0;
    memberMonth.firstCheckInAt = timestamp;
  }
  memberMonth.checkIns = memberMonth.checkIns + 1;
  memberMonth.lastCheckInAt = timestamp;
  memberMonth.save();

  // ---- Daily rollup ------------------------------------------------------
  let dayId = day.toString();
  let dayStat = DayStat.load(dayId);
  if (dayStat == null) {
    dayStat = new DayStat(dayId);
    dayStat.day = day;
    dayStat.date = checkIn.date;
    dayStat.checkIns = 0;
  }
  dayStat.checkIns = dayStat.checkIns + 1;
  dayStat.save();

  // ---- Community totals --------------------------------------------------
  let community = Community.load(GLOBAL);
  if (community == null) {
    community = new Community(GLOBAL);
    community.totalCheckIns = 0;
    community.totalMembers = 0;
    community.firstCheckInAt = timestamp;
  }
  community.totalCheckIns = community.totalCheckIns + 1;
  if (isNewMember) community.totalMembers = community.totalMembers + 1;
  community.lastCheckInAt = timestamp;
  community.save();
}

