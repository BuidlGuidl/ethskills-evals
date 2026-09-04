import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { CheckedIn as CheckedInEvent } from "../generated/Streak/Streak";
import { CheckIn, Member, MemberMonth } from "../generated/schema";

const ONE = BigInt.fromI32(1);

export function handleCheckedIn(event: CheckedInEvent): void {
  const memberId = event.params.member;
  let member = Member.load(memberId);

  if (member == null) {
    member = new Member(memberId);
    member.totalCheckIns = BigInt.zero();
    member.indexedStreak = BigInt.zero();
    member.lastCheckInDay = BigInt.fromI32(-2);
  }

  if (event.params.day.equals(member.lastCheckInDay.plus(ONE))) {
    member.indexedStreak = member.indexedStreak.plus(ONE);
  } else {
    member.indexedStreak = ONE;
  }
  member.totalCheckIns = member.totalCheckIns.plus(ONE);
  member.lastCheckInDay = event.params.day;
  member.lastCheckInAt = event.block.timestamp;
  member.save();

  const checkInId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const checkIn = new CheckIn(checkInId);
  checkIn.member = memberId;
  checkIn.note = event.params.note;
  checkIn.day = event.params.day;
  checkIn.timestamp = event.block.timestamp;
  checkIn.blockNumber = event.block.number;
  checkIn.sequence = event.block.number.times(BigInt.fromI32(1000000)).plus(event.logIndex);
  checkIn.transactionHash = event.transaction.hash;
  checkIn.save();

  const month = monthFromTimestamp(event.block.timestamp);
  const monthId = memberId.concat(Bytes.fromUTF8("-" + month));
  let memberMonth = MemberMonth.load(monthId);
  if (memberMonth == null) {
    memberMonth = new MemberMonth(monthId);
    memberMonth.member = memberId;
    memberMonth.month = month;
    memberMonth.count = BigInt.zero();
  }
  memberMonth.count = memberMonth.count.plus(ONE);
  memberMonth.save();
}

// Civil date conversion from days since Unix epoch; returns YYYY-MM in UTC.
function monthFromTimestamp(timestamp: BigInt): string {
  let z = timestamp.div(BigInt.fromI32(86400)).toI64() + 719468;
  const era = (z >= 0 ? z : z - 146096) / 146097;
  const dayOfEra = z - era * 146097;
  const yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365;
  let year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100);
  const monthPrime = (5 * dayOfYear + 2) / 153;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return year.toString() + "-" + (month < 10 ? "0" : "") + month.toString();
}
