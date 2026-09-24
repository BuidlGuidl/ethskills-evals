import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { getAddress, type Address } from "viem";
import { SECONDS_PER_DAY } from "../src/dates.js";
import { StreakStore } from "../src/store.js";
import type { CheckInRecord } from "../src/types.js";

const contract = "0x000000000000000000000000000000000000c0de" as Address;
const alice = "0x00000000000000000000000000000000000000a1" as Address;
const bob = "0x00000000000000000000000000000000000000b0" as Address;

test("feed is newest first and cursor paginates older check-ins", async () => {
  const { store, cleanup } = await makeStore();
  try {
    store.addCheckIns([
      checkIn({ member: alice, day: 20, blockNumber: 100, logIndex: 0, note: "gm" }),
      checkIn({ member: bob, day: 21, blockNumber: 101, logIndex: 0, note: "ship" }),
      checkIn({ member: alice, day: 22, blockNumber: 102, logIndex: 0, note: "docs" }),
    ]);

    const firstPage = store.getFeed(2);
    assert.deepEqual(
      firstPage.items.map((item) => item.note),
      ["docs", "ship"],
    );
    assert.ok(firstPage.nextCursor);

    const secondPage = store.getFeed(2, firstPage.nextCursor ?? undefined);
    assert.deepEqual(
      secondPage.items.map((item) => item.note),
      ["gm"],
    );
    assert.equal(secondPage.nextCursor, null);
  } finally {
    await cleanup();
  }
});

test("profile current streak counts consecutive UTC days ending today or yesterday", async () => {
  const { store, cleanup } = await makeStore();
  try {
    const today = 300;
    store.addCheckIns([
      checkIn({ member: alice, day: today - 3, blockNumber: 10 }),
      checkIn({ member: alice, day: today - 2, blockNumber: 11 }),
      checkIn({ member: alice, day: today - 1, blockNumber: 12 }),
      checkIn({ member: bob, day: today - 3, blockNumber: 13 }),
    ]);

    const now = new Date(today * SECONDS_PER_DAY * 1000);
    assert.equal(store.getProfile(alice, now).currentStreak, 3);
    assert.equal(store.getProfile(alice, now).totalCheckIns, 3);
    assert.equal(store.getProfile(bob, now).currentStreak, 0);
  } finally {
    await cleanup();
  }
});

test("leaderboard ranks members by this month's check-ins", async () => {
  const { store, cleanup } = await makeStore();
  try {
    const jan1 = Date.UTC(2026, 0, 1) / 1000 / SECONDS_PER_DAY;
    store.addCheckIns([
      checkIn({ member: alice, day: jan1, blockNumber: 1 }),
      checkIn({ member: alice, day: jan1 + 1, blockNumber: 2 }),
      checkIn({ member: bob, day: jan1 + 1, blockNumber: 3 }),
      checkIn({ member: bob, day: jan1 + 40, blockNumber: 4 }),
    ]);

    const leaderboard = store.getLeaderboard("2026-01", 10);
    assert.deepEqual(
      leaderboard.items.map((item) => [item.member, item.checkIns, item.rank]),
      [
        [getAddress(alice), 2, 1],
        [getAddress(bob), 1, 2],
      ],
    );
  } finally {
    await cleanup();
  }
});

async function makeStore(): Promise<{
  store: StreakStore;
  cleanup: () => Promise<void>;
}> {
  const directory = await mkdtemp(join(tmpdir(), "streak-store-"));
  const store = await StreakStore.open(join(directory, "index.json"), contract, 1);
  return {
    store,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

function checkIn(input: {
  member: Address;
  day: number;
  blockNumber: number;
  logIndex?: number;
  note?: string;
}): CheckInRecord {
  const logIndex = input.logIndex ?? 0;
  return {
    id: `${input.blockNumber}:${logIndex}`,
    member: input.member,
    day: input.day,
    timestamp: input.day * SECONDS_PER_DAY + 1,
    note: input.note ?? "",
    blockNumber: input.blockNumber,
    transactionHash: `0x${input.blockNumber.toString(16).padStart(64, "0")}`,
    logIndex,
  };
}
