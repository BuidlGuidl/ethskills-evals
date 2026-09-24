import { describe, expect, it } from "vitest";
import { getAddress, type Address, type Hex } from "viem";

import { StreakStore, type CheckInRecord } from "../src/db.js";
import { dateStringToDay } from "../src/time.js";

const alice = "0x0000000000000000000000000000000000000a11" as Address;
const bob = "0x0000000000000000000000000000000000000b0b" as Address;

describe("StreakStore", () => {
  it("returns the global feed newest first", () => {
    const store = new StreakStore(":memory:");
    insert(store, { member: alice, day: "2026-09-21", blockNumber: 10n, logIndex: 0, note: "gm" });
    insert(store, { member: bob, day: "2026-09-21", blockNumber: 11n, logIndex: 1, note: "shipped" });

    expect(store.feed().map((item) => item.note)).toEqual(["shipped", "gm"]);
    store.close();
  });

  it("counts a current streak through yesterday before today's check-in", () => {
    const store = new StreakStore(":memory:");
    insert(store, { member: alice, day: "2026-09-20", blockNumber: 1n });
    insert(store, { member: alice, day: "2026-09-21", blockNumber: 2n });
    insert(store, { member: alice, day: "2026-09-22", blockNumber: 3n });

    const profile = store.memberProfile(alice, new Date("2026-09-23T12:00:00.000Z"));
    expect(profile.currentStreak).toBe(3);
    expect(profile.totalCheckIns).toBe(3);
    store.close();
  });

  it("expires the current streak after a missed full UTC day", () => {
    const store = new StreakStore(":memory:");
    insert(store, { member: alice, day: "2026-09-20", blockNumber: 1n });
    insert(store, { member: alice, day: "2026-09-21", blockNumber: 2n });

    const profile = store.memberProfile(alice, new Date("2026-09-23T00:01:00.000Z"));
    expect(profile.currentStreak).toBe(0);
    expect(profile.totalCheckIns).toBe(2);
    store.close();
  });

  it("ranks members by monthly check-ins with latest check-in as tie-breaker", () => {
    const store = new StreakStore(":memory:");
    insert(store, { member: alice, day: "2026-09-01", blockNumber: 1n });
    insert(store, { member: alice, day: "2026-09-02", blockNumber: 2n });
    insert(store, { member: bob, day: "2026-09-15", blockNumber: 3n });
    insert(store, { member: bob, day: "2026-09-16", blockNumber: 4n });
    insert(store, { member: alice, day: "2026-08-31", blockNumber: 5n });

    const leaderboard = store.monthlyLeaderboard("2026-09");
    expect(leaderboard).toMatchObject([
      { member: getAddress(bob), checkIns: 2 },
      { member: getAddress(alice), checkIns: 2 },
    ]);
    store.close();
  });
});

function insert(
  store: StreakStore,
  overrides: Omit<Partial<CheckInRecord>, "day"> & { member: Address; day: string; blockNumber: bigint },
) {
  const blockNumber = overrides.blockNumber;
  const logIndex = overrides.logIndex ?? 0;
  const day = dateStringToDay(overrides.day);

  store.insertCheckIn({
    member: overrides.member,
    day,
    note: overrides.note ?? "",
    blockNumber,
    blockHash: hex(blockNumber, 64),
    transactionHash: hex(blockNumber * 100n + BigInt(logIndex), 64),
    logIndex,
    checkedInAt: day * 86_400 + 12,
  });
}

function hex(value: bigint, length: number): Hex {
  return `0x${value.toString(16).padStart(length, "0")}` as Hex;
}
