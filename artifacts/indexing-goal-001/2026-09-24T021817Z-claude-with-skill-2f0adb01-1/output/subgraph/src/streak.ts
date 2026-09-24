import { BigInt } from "@graphprotocol/graph-ts";
import { CheckedIn } from "../generated/Streak/Streak";
import { CheckIn, Global, Member, MemberMonth, Month } from "../generated/schema";
import { monthKeyFromDay } from "./date";

const GLOBAL_ID = "global";

function loadGlobal(): Global {
  let global = Global.load(GLOBAL_ID);
  if (global == null) {
    global = new Global(GLOBAL_ID);
    global.totalCheckIns = 0;
    global.totalMembers = 0;
    global.lastCheckInAt = BigInt.zero();
  }
  return global as Global;
}

/**
 * The single handler. Everything the three screens need is derived here, as the
 * indexer walks the contract's logs from its deployment block forward:
 *
 *   - global feed      -> one CheckIn entity per event, ordered by timestamp
 *   - member profile   -> Member (streak + all-time total)
 *   - leaderboard      -> MemberMonth (per-member count, per calendar month)
 *
 * `streak` and `total` come straight off the event, so the indexer never has to
 * re-derive the contract's own arithmetic and can't drift from it.
 */
export function handleCheckedIn(event: CheckedIn): void {
  const day = event.params.day.toI32();
  const streak = event.params.streak.toI32();
  const total = event.params.total.toI32();
  const timestamp = event.block.timestamp;
  const monthKey = monthKeyFromDay(day);
  const memberId = event.params.member.toHexString();

  // --- Member -------------------------------------------------------------
  let member = Member.load(memberId);
  const isNewMember = member == null;
  if (member == null) {
    member = new Member(memberId);
    member.address = event.params.member;
    member.longestStreak = 0;
    member.firstCheckInAt = timestamp;
  }
  member.totalCheckIns = total;
  member.streakAtLastCheckIn = streak;
  member.lastDay = day;
  member.lastCheckInAt = timestamp;
  if (streak > member.longestStreak) {
    member.longestStreak = streak;
  }
  member.save();

  // --- CheckIn (feed row) -------------------------------------------------
  const checkIn = new CheckIn(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  checkIn.member = memberId;
  checkIn.memberAddress = event.params.member;
  checkIn.note = event.params.note;
  checkIn.day = day;
  checkIn.month = monthKey;
  checkIn.streak = streak;
  checkIn.total = total;
  checkIn.timestamp = timestamp;
  checkIn.blockNumber = event.block.number;
  checkIn.transactionHash = event.transaction.hash;
  checkIn.sortKey = event.block.number
    .times(BigInt.fromI32(100000))
    .plus(event.logIndex);
  checkIn.save();

  // --- MemberMonth (leaderboard row) --------------------------------------
  const memberMonthId = monthKey + "-" + memberId;
  let memberMonth = MemberMonth.load(memberMonthId);
  const isNewToThisMonth = memberMonth == null;
  if (memberMonth == null) {
    memberMonth = new MemberMonth(memberMonthId);
    memberMonth.member = memberId;
    memberMonth.memberAddress = event.params.member;
    memberMonth.month = monthKey;
    memberMonth.checkIns = 0;
  }
  memberMonth.checkIns = memberMonth.checkIns + 1;
  memberMonth.lastCheckInAt = timestamp;
  memberMonth.save();

  // --- Month totals -------------------------------------------------------
  let month = Month.load(monthKey);
  if (month == null) {
    month = new Month(monthKey);
    month.checkIns = 0;
    month.activeMembers = 0;
  }
  month.checkIns = month.checkIns + 1;
  if (isNewToThisMonth) {
    month.activeMembers = month.activeMembers + 1;
  }
  month.save();

  // --- Global -------------------------------------------------------------
  const global = loadGlobal();
  global.totalCheckIns = global.totalCheckIns + 1;
  if (isNewMember) {
    global.totalMembers = global.totalMembers + 1;
  }
  global.lastCheckInAt = timestamp;
  global.save();
}
