import { BigInt } from "@graphprotocol/graph-ts";
import { CheckIn as CheckInEvent } from "../../generated/Streak/Streak";
import { CheckIn, Member, Month, MonthMember } from "../../generated/schema";

class CivilMonth {
  year: i32;
  month: i32;

  constructor(year: i32, month: i32) {
    this.year = year;
    this.month = month;
  }
}

export function handleCheckIn(event: CheckInEvent): void {
  let memberId = event.params.member.toHexString();
  let member = Member.load(memberId);

  if (member == null) {
    member = new Member(memberId);
    member.address = event.params.member;
  }

  member.currentStreak = event.params.streak;
  member.totalCheckIns = event.params.totalCheckIns;
  member.lastCheckInDay = event.params.day;
  member.lastCheckInAt = event.block.timestamp;
  member.save();

  let civilMonth = monthFromTimestamp(event.block.timestamp);
  let monthId = civilMonth.year.toString() + "-" + pad2(civilMonth.month);
  let month = Month.load(monthId);

  if (month == null) {
    month = new Month(monthId);
    month.year = civilMonth.year;
    month.month = civilMonth.month;
    month.totalCheckIns = BigInt.zero();
  }

  month.totalCheckIns = month.totalCheckIns.plus(BigInt.fromI32(1));
  month.save();

  let monthMemberId = monthId + "-" + memberId;
  let monthMember = MonthMember.load(monthMemberId);

  if (monthMember == null) {
    monthMember = new MonthMember(monthMemberId);
    monthMember.month = monthId;
    monthMember.member = memberId;
    monthMember.memberAddress = event.params.member;
    monthMember.checkIns = BigInt.zero();
  }

  monthMember.checkIns = monthMember.checkIns.plus(BigInt.fromI32(1));
  monthMember.lastCheckInAt = event.block.timestamp;
  monthMember.save();

  let checkInId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let checkIn = new CheckIn(checkInId);
  checkIn.checkInId = event.params.checkInId;
  checkIn.member = memberId;
  checkIn.memberAddress = event.params.member;
  checkIn.day = event.params.day;
  checkIn.note = event.params.note;
  checkIn.streakAfter = event.params.streak;
  checkIn.memberTotalAfter = event.params.totalCheckIns;
  checkIn.timestamp = event.block.timestamp;
  checkIn.blockNumber = event.block.number;
  checkIn.transactionHash = event.transaction.hash;
  checkIn.logIndex = event.logIndex;
  checkIn.month = monthId;
  checkIn.monthMember = monthMemberId;
  checkIn.save();
}

function monthFromTimestamp(timestamp: BigInt): CivilMonth {
  let days = timestamp.div(BigInt.fromI32(86400)).toI64();
  let z = days + 719468;
  let era = z >= 0 ? z / 146097 : (z - 146096) / 146097;
  let doe = z - era * 146097;
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  let y = yoe + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let m = mp + (mp < 10 ? 3 : -9);

  if (m <= 2) {
    y += 1;
  }

  return new CivilMonth(y as i32, m as i32);
}

function pad2(value: i32): string {
  return value < 10 ? "0" + value.toString() : value.toString();
}
