import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "./db.js";
import { ReadModel } from "./read-model.js";

function fixture() {
  const db = openDatabase(":memory:");
  const insert = db.prepare(`INSERT INTO check_ins
    (tx_hash, log_index, block_number, block_hash, member, day, timestamp, note)
    VALUES (?, ?, ?, 'block', ?, ?, ?, ?)`);
  const add = (tx: string, member: string, day: number, note = "") => insert.run(tx, 0, day, member, day, day * 86_400, note);
  return { db, add, reads: new ReadModel(db) };
}

test("profile computes an active consecutive streak and historical total", () => {
  const { db, add, reads } = fixture();
  add("a", "0xabc", 98); add("b", "0xabc", 99); add("c", "0xabc", 100); add("d", "0xabc", 90);
  assert.deepEqual(reads.profile("0xAbC", 100 * 86_400), { member: "0xabc", currentStreak: 3, totalCheckIns: 4 });
  assert.equal(reads.profile("0xabc", 103 * 86_400).currentStreak, 0);
  db.close();
});

test("feed is newest first and cursor pagination has no overlap", () => {
  const { db, add, reads } = fixture();
  add("a", "alice", 1); add("b", "bob", 2); add("c", "carol", 3);
  const first = reads.feed(2);
  assert.deepEqual(first.items.map(item => item.txHash), ["c", "b"]);
  const second = reads.feed(2, first.nextCursor!);
  assert.deepEqual(second.items.map(item => item.txHash), ["a"]);
  db.close();
});

test("leaderboard counts only the requested UTC calendar month", () => {
  const { db, add, reads } = fixture();
  const jan1 = Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
  add("a", "alice", jan1); add("b", "alice", jan1 + 1); add("c", "bob", jan1); add("d", "bob", jan1 - 1);
  assert.deepEqual(reads.leaderboard(2026, 1, 10).items, [
    { member: "alice", checkIns: 2 }, { member: "bob", checkIns: 1 },
  ]);
  db.close();
});
