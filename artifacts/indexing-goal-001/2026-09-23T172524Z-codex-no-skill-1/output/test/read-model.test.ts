import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getAddress } from "viem";
import { ReadModelStore } from "../src/read-model/store.js";
import type { CheckInRecord } from "../src/read-model/types.js";

const alice = getAddress("0x00000000000000000000000000000000000000a1");
const bob = getAddress("0x00000000000000000000000000000000000000b0");

test("feed is newest first and deduplicated", () => {
  withStore((store) => {
    store.upsertMany([
      record({ id: "10-0", member: alice, day: 10, blockNumber: "10", logIndex: 0 }),
      record({ id: "11-0", member: bob, day: 11, blockNumber: "11", logIndex: 0 }),
      record({ id: "11-0", member: bob, day: 11, blockNumber: "11", logIndex: 0 })
    ]);

    assert.deepEqual(
      store.feed(10).map((item) => item.id),
      ["11-0", "10-0"]
    );
  });
});

test("member profile calculates active and broken streaks from complete history", () => {
  withStore((store) => {
    store.upsertMany([
      record({ id: "1-0", member: alice, day: 98, blockNumber: "1" }),
      record({ id: "2-0", member: alice, day: 99, blockNumber: "2" }),
      record({ id: "3-0", member: alice, day: 100, blockNumber: "3" }),
      record({ id: "4-0", member: bob, day: 96, blockNumber: "4" })
    ]);

    assert.equal(store.memberProfile(alice, dateForDay(100)).currentStreak, 3);
    assert.equal(store.memberProfile(alice, dateForDay(101)).currentStreak, 3);
    assert.equal(store.memberProfile(alice, dateForDay(102)).currentStreak, 0);
    assert.equal(store.memberProfile(alice, dateForDay(100)).totalCheckIns, 3);
  });
});

test("monthly leaderboard ranks by month count then latest check-in", () => {
  withStore((store) => {
    store.upsertMany([
      record({ id: "1-0", member: alice, day: 20332, timestamp: 1, blockNumber: "1" }),
      record({ id: "2-0", member: alice, day: 20333, timestamp: 2, blockNumber: "2" }),
      record({ id: "3-0", member: bob, day: 20333, timestamp: 3, blockNumber: "3" }),
      record({ id: "4-0", member: bob, day: 20334, timestamp: 4, blockNumber: "4" })
    ]);

    const rows = store.monthlyLeaderboard(20332, 20362, 10, dateForDay(20334));

    assert.deepEqual(
      rows.map((row) => [row.member, row.checkIns, row.rank]),
      [
        [bob, 2, 1],
        [alice, 2, 2]
      ]
    );
  });
});

function withStore(run: (store: ReadModelStore) => void) {
  const dir = mkdtempSync(join(tmpdir(), "streak-store-"));
  try {
    run(new ReadModelStore(join(dir, "model.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function record(overrides: Partial<CheckInRecord>): CheckInRecord {
  return {
    id: "1-0",
    member: alice,
    day: 1,
    timestamp: overrides.day ?? 1,
    note: "gm",
    totalCheckInsAtEvent: 1,
    streakAtEvent: 1,
    blockNumber: "1",
    blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    transactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    logIndex: 0,
    ...overrides
  };
}

function dateForDay(day: number): Date {
  return new Date(day * 86_400 * 1000);
}
