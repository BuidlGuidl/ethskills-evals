import {
  assert,
  beforeEach,
  clearStore,
  describe,
  newMockEvent,
  test
} from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { CheckedIn } from "../generated/Streak/Streak";
import { handleCheckedIn } from "../src/streak";
import { monthKeyFromDay } from "../src/date";

const ALICE = "0x00000000000000000000000000000000000000a1";
const BOB = "0x00000000000000000000000000000000000000b2";

function createCheckedIn(
  member: string,
  day: i32,
  streak: i32,
  total: i32,
  note: string,
  blockNumber: i32,
  logIndex: i32
): CheckedIn {
  const event = changetype<CheckedIn>(newMockEvent());
  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam(
      "member",
      ethereum.Value.fromAddress(Address.fromString(member))
    )
  );
  event.parameters.push(
    new ethereum.EventParam("day", ethereum.Value.fromI32(day))
  );
  event.parameters.push(
    new ethereum.EventParam("streak", ethereum.Value.fromI32(streak))
  );
  event.parameters.push(
    new ethereum.EventParam("total", ethereum.Value.fromI32(total))
  );
  event.parameters.push(
    new ethereum.EventParam("note", ethereum.Value.fromString(note))
  );
  event.block.number = BigInt.fromI32(blockNumber);
  event.block.timestamp = BigInt.fromI32(day).times(BigInt.fromI32(86400));
  event.logIndex = BigInt.fromI32(logIndex);
  return event;
}

describe("handleCheckedIn", () => {
  beforeEach(() => {
    clearStore();
  });

  test("creates a feed row carrying who / when / note", () => {
    // Day 20000 = 2024-10-04.
    handleCheckedIn(createCheckedIn(ALICE, 20000, 1, 1, "gm", 100, 0));

    assert.entityCount("CheckIn", 1);
    const id = "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-0";
    assert.fieldEquals("CheckIn", id, "note", "gm");
    assert.fieldEquals("CheckIn", id, "day", "20000");
    assert.fieldEquals("CheckIn", id, "month", "2024-10");
    assert.fieldEquals("CheckIn", id, "streak", "1");
    assert.fieldEquals("CheckIn", id, "sortKey", "10000000");
  });

  test("tracks all-time total and longest streak on the member", () => {
    handleCheckedIn(createCheckedIn(ALICE, 20000, 1, 1, "", 100, 0));
    handleCheckedIn(createCheckedIn(ALICE, 20001, 2, 2, "", 101, 0));
    handleCheckedIn(createCheckedIn(ALICE, 20002, 3, 3, "", 102, 0));
    // Gap: the contract restarts the streak at 1, longest must survive.
    handleCheckedIn(createCheckedIn(ALICE, 20010, 1, 4, "", 110, 0));

    assert.fieldEquals("Member", ALICE, "totalCheckIns", "4");
    assert.fieldEquals("Member", ALICE, "streakAtLastCheckIn", "1");
    assert.fieldEquals("Member", ALICE, "longestStreak", "3");
    assert.fieldEquals("Member", ALICE, "lastDay", "20010");
  });

  test("buckets leaderboard counts by calendar month", () => {
    // 20000 = 2024-10-04, 20027 = 2024-10-31, 20028 = 2024-11-01.
    handleCheckedIn(createCheckedIn(ALICE, 20000, 1, 1, "", 100, 0));
    handleCheckedIn(createCheckedIn(ALICE, 20027, 1, 2, "", 101, 0));
    handleCheckedIn(createCheckedIn(ALICE, 20028, 2, 3, "", 102, 0));
    handleCheckedIn(createCheckedIn(BOB, 20028, 1, 1, "", 102, 1));

    assert.fieldEquals("MemberMonth", "2024-10-" + ALICE, "checkIns", "2");
    assert.fieldEquals("MemberMonth", "2024-11-" + ALICE, "checkIns", "1");
    assert.fieldEquals("MemberMonth", "2024-11-" + BOB, "checkIns", "1");

    assert.fieldEquals("Month", "2024-10", "checkIns", "2");
    assert.fieldEquals("Month", "2024-10", "activeMembers", "1");
    assert.fieldEquals("Month", "2024-11", "checkIns", "2");
    assert.fieldEquals("Month", "2024-11", "activeMembers", "2");
  });

  test("counts distinct members once", () => {
    handleCheckedIn(createCheckedIn(ALICE, 20000, 1, 1, "", 100, 0));
    handleCheckedIn(createCheckedIn(ALICE, 20001, 2, 2, "", 101, 0));
    handleCheckedIn(createCheckedIn(BOB, 20001, 1, 1, "", 101, 1));

    assert.fieldEquals("Global", "global", "totalCheckIns", "3");
    assert.fieldEquals("Global", "global", "totalMembers", "2");
  });
});

describe("monthKeyFromDay", () => {
  test("converts unix day indices to UTC YYYY-MM", () => {
    assert.stringEquals("1970-01", monthKeyFromDay(0));
    assert.stringEquals("1970-12", monthKeyFromDay(364));
    assert.stringEquals("2000-02", monthKeyFromDay(11016)); // 2000-02-29, leap
    assert.stringEquals("2024-02", monthKeyFromDay(19782)); // 2024-02-29, leap
    assert.stringEquals("2024-03", monthKeyFromDay(19783));
    assert.stringEquals("2024-12", monthKeyFromDay(20088)); // 2024-12-31
    assert.stringEquals("2025-01", monthKeyFromDay(20089)); // 2025-01-01
    assert.stringEquals("2026-09", monthKeyFromDay(20720)); // 2026-09-24
  });
});
