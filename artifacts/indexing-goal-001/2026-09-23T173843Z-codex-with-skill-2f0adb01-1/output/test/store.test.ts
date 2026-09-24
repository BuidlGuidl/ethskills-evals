import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StreakStore } from "../src/store.js";
import type { CheckInEvent } from "../src/types.js";

const alice = "0x1111111111111111111111111111111111111111";
const bob = "0x2222222222222222222222222222222222222222";

describe("StreakStore", () => {
  it("backs feed, profile, and monthly leaderboard from indexed events", () => {
    const store = new StreakStore(path.join(os.tmpdir(), `streak-${Date.now()}.sqlite`));

    const inserted = store.ingestCheckIns([
      event({ member: alice, day: 2, note: "gm", blockNumber: 2, logIndex: 0 }),
      event({ member: bob, day: 3, note: "shipped", blockNumber: 3, logIndex: 0 }),
      event({ member: alice, day: 3, note: "again", blockNumber: 4, logIndex: 0 }),
    ]);

    assert.equal(inserted, 3);
    assert.equal(store.ingestCheckIns([event({ member: alice, day: 2, blockNumber: 2 })]), 0);

    const feed = store.getFeed(10);
    assert.deepEqual(feed.map((item) => item.note), ["again", "shipped", "gm"]);

    const aliceProfile = store.getMemberProfile(alice, 3 * 86_400 + 100);
    assert.equal(aliceProfile.totalCheckIns, 2);
    assert.equal(aliceProfile.currentStreak, 2);

    const leaderboard = store.getMonthlyLeaderboard("1970-01", 10);
    assert.deepEqual(leaderboard.map((entry) => [entry.address, entry.checkIns]), [
      [alice, 2],
      [bob, 1],
    ]);

    store.close();
  });
});

function event(overrides: Partial<CheckInEvent>): CheckInEvent {
  const day = overrides.day ?? 1;
  const blockNumber = overrides.blockNumber ?? day;
  const logIndex = overrides.logIndex ?? 0;

  return {
    id: `${blockNumber}:${logIndex}`,
    member: (overrides.member ?? alice) as `0x${string}`,
    note: overrides.note ?? "",
    day,
    timestamp: day * 86_400,
    blockNumber,
    txHash: `0x${blockNumber.toString(16).padStart(64, "0")}` as `0x${string}`,
    logIndex,
  };
}
