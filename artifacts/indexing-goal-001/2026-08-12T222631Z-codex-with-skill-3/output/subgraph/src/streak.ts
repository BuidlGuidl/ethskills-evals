import { BigInt } from "@graphprotocol/graph-ts";
import { CheckedIn as CheckedInEvent } from "../generated/Streak/Streak";
import { CheckIn, Member, MonthlyMember } from "../generated/schema";

const ONE = BigInt.fromI32(1);

// Howard Hinnant's civil-from-days algorithm. Returns a stable year*12+month index.
function monthIndex(utcDay: BigInt): i32 {
  let z = utcDay.toI32() + 719468;
  let era = z >= 0 ? z / 146097 : (z - 146096) / 146097;
  let doe = z - era * 146097;
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  let year = yoe + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let month = mp + (mp < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return year * 12 + month - 1;
}

export function handleCheckedIn(event: CheckedInEvent): void {
  let member = Member.load(event.params.member);
  if (member == null) {
    member = new Member(event.params.member);
    member.totalCheckIns = BigInt.zero();
    member.currentStreak = BigInt.zero();
    member.lastCheckInDay = BigInt.fromI32(-2);
    member.lastCheckInAt = BigInt.zero();
  }

  member.currentStreak = event.params.utcDay.equals(member.lastCheckInDay.plus(ONE))
    ? member.currentStreak.plus(ONE)
    : ONE;
  member.totalCheckIns = member.totalCheckIns.plus(ONE);
  member.lastCheckInDay = event.params.utcDay;
  member.lastCheckInAt = event.block.timestamp;
  member.save();

  let id = event.transaction.hash.concatI32(event.logIndex.toI32());
  let checkIn = new CheckIn(id);
  checkIn.member = event.params.member;
  checkIn.utcDay = event.params.utcDay;
  checkIn.note = event.params.note;
  checkIn.timestamp = event.block.timestamp;
  checkIn.blockNumber = event.block.number;
  checkIn.transactionHash = event.transaction.hash;
  checkIn.logIndex = event.logIndex;
  checkIn.save();

  let month = monthIndex(event.params.utcDay);
  let monthlyId = month.toString() + "-" + event.params.member.toHexString();
  let monthly = MonthlyMember.load(monthlyId);
  if (monthly == null) {
    monthly = new MonthlyMember(monthlyId);
    monthly.month = month;
    monthly.member = event.params.member;
    monthly.checkIns = BigInt.zero();
  }
  monthly.checkIns = monthly.checkIns.plus(ONE);
  monthly.lastCheckInAt = event.block.timestamp;
  monthly.save();
}
