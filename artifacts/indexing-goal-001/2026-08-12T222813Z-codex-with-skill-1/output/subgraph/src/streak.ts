import { BigInt } from "@graphprotocol/graph-ts";
import { CheckedIn as CheckedInEvent } from "../generated/Streak/Streak";
import { CheckIn, Member, MonthlyMember } from "../generated/schema";

const ONE = BigInt.fromI32(1);
const ZERO = BigInt.zero();

// Gregorian calendar conversion from days since Unix epoch. Returns YYYY-MM.
function monthForDay(day: BigInt): string {
  let z = day.toI64() + 719468;
  let era = z >= 0 ? z / 146097 : (z - 146096) / 146097;
  let doe = z - era * 146097;
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  let year = yoe + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let month = mp + (mp < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return year.toString() + "-" + (month < 10 ? "0" : "") + month.toString();
}

export function handleCheckedIn(event: CheckedInEvent): void {
  let member = Member.load(event.params.member);
  if (member == null) {
    member = new Member(event.params.member);
    member.totalCheckIns = ZERO;
    member.streak = ZERO;
    member.lastCheckInDay = BigInt.fromI32(-2);
    member.lastCheckInAt = ZERO;
  }

  member.streak = event.params.day.equals(member.lastCheckInDay.plus(ONE))
    ? member.streak.plus(ONE)
    : ONE;
  member.totalCheckIns = member.totalCheckIns.plus(ONE);
  member.lastCheckInDay = event.params.day;
  member.lastCheckInAt = event.params.timestamp;
  member.save();

  const checkIn = new CheckIn(event.transaction.hash.concatI32(event.logIndex.toI32()));
  checkIn.member = event.params.member;
  checkIn.day = event.params.day;
  checkIn.timestamp = event.params.timestamp;
  checkIn.note = event.params.note;
  checkIn.transactionHash = event.transaction.hash;
  checkIn.blockNumber = event.block.number;
  checkIn.logIndex = event.logIndex;
  checkIn.save();

  const month = monthForDay(event.params.day);
  const monthlyId = month + "-" + event.params.member.toHexString();
  let monthly = MonthlyMember.load(monthlyId);
  if (monthly == null) {
    monthly = new MonthlyMember(monthlyId);
    monthly.month = month;
    monthly.member = event.params.member;
    monthly.checkIns = ZERO;
    monthly.lastCheckInAt = ZERO;
  }
  monthly.checkIns = monthly.checkIns.plus(ONE);
  monthly.lastCheckInAt = event.params.timestamp;
  monthly.save();
}
