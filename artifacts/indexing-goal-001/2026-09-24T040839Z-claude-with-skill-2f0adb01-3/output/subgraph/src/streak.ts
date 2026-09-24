import { BigInt } from "@graphprotocol/graph-ts";
import { CheckedIn } from "../generated/Streak/Streak";
import { CheckIn, Community, Member, MemberMonth } from "../generated/schema";
import { monthKey } from "./date";

const GLOBAL_ID = "global";

export function handleCheckedIn(event: CheckedIn): void {
  let memberId = event.params.member.toHexString();
  let dayIndex = event.params.dayIndex.toI32();
  let timestamp = event.block.timestamp;

  // --- Member + streak ------------------------------------------------------
  // Events arrive in chain order, so the streak is a simple running fold:
  // a check-in on the day right after the previous one extends the run,
  // anything further out starts a new one. The contract already guarantees
  // at most one check-in per member per day, so there is no same-day case.
  let community = loadCommunity();
  let member = Member.load(memberId);
  if (member == null) {
    member = new Member(memberId);
    member.address = event.params.member;
    member.totalCheckIns = 0;
    member.streakAtLastCheckIn = 0;
    member.longestStreak = 0;
    member.lastDayIndex = 0;
    member.firstCheckInAt = timestamp;
    community.totalMembers = community.totalMembers + 1;
  }

  let streak = 1;
  if (member.totalCheckIns > 0 && dayIndex == member.lastDayIndex + 1) {
    streak = member.streakAtLastCheckIn + 1;
  }

  member.totalCheckIns = member.totalCheckIns + 1;
  member.streakAtLastCheckIn = streak;
  if (streak > member.longestStreak) member.longestStreak = streak;
  member.lastDayIndex = dayIndex;
  member.lastCheckInAt = timestamp;
  member.save();

  // --- The check-in itself (global feed) ------------------------------------
  let checkIn = new CheckIn(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  checkIn.member = memberId;
  checkIn.note = event.params.note;
  checkIn.dayIndex = dayIndex;
  checkIn.streakAtCheckIn = streak;
  checkIn.timestamp = timestamp;
  checkIn.blockNumber = event.block.number;
  checkIn.txHash = event.transaction.hash;
  checkIn.sequence = event.block.number
    .times(BigInt.fromI32(100000))
    .plus(event.logIndex);
  checkIn.save();

  // --- Monthly leaderboard bucket -------------------------------------------
  let month = monthKey(dayIndex);
  let monthId = memberId + "-" + month;
  let memberMonth = MemberMonth.load(monthId);
  if (memberMonth == null) {
    memberMonth = new MemberMonth(monthId);
    memberMonth.member = memberId;
    memberMonth.month = month;
    memberMonth.checkIns = 0;
  }
  memberMonth.checkIns = memberMonth.checkIns + 1;
  memberMonth.lastCheckInAt = timestamp;
  memberMonth.save();

  // --- Community counters ----------------------------------------------------
  community.totalCheckIns = community.totalCheckIns + 1;
  community.lastCheckInAt = timestamp;
  community.save();
}

function loadCommunity(): Community {
  let community = Community.load(GLOBAL_ID);
  if (community == null) {
    community = new Community(GLOBAL_ID);
    community.totalCheckIns = 0;
    community.totalMembers = 0;
    community.lastCheckInAt = BigInt.zero();
  }
  return community as Community;
}
