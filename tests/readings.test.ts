import assert from "node:assert/strict";
import test from "node:test";
import { orderReadings } from "../lib/readings.js";

const reading = (run: string, regrade_of: string | null = null, regraded_at: string | null = null) => ({
  task: "gas-goal-001",
  run,
  regrade_of,
  regraded_at,
});

test("ten regrades of one source come out in the order they were made, not in dir-name order", () => {
  // verify writes every regrade with regrade_of = source, so they tie on chain depth, and
  // `-regrade-10` sorts before `-regrade-2` as a string.
  const source = reading("r");
  const regrades = Array.from({ length: 10 }, (_, index) => reading(`r-regrade-${index + 1}`, "r"));
  const { lineages, warnings } = orderReadings([...regrades].reverse().concat(source));

  assert.deepEqual(warnings, []);
  assert.equal(lineages.length, 1);
  assert.deepEqual(
    lineages[0].map(entry => entry.run),
    ["r", ...Array.from({ length: 10 }, (_, index) => `r-regrade-${index + 1}`)],
  );
});

test("regraded_at orders siblings before their number does, and a record without it is older", () => {
  const source = reading("r");
  const early = reading("r-regrade-2", "r", "2026-08-30T00:00:00Z");
  const late = reading("r-regrade-1", "r", "2026-08-31T00:00:00Z");
  const undated = reading("r-regrade-3", "r");
  const { lineages } = orderReadings([late, early, source, undated]);

  assert.deepEqual(lineages[0].map(entry => entry.run), ["r", "r-regrade-3", "r-regrade-2", "r-regrade-1"]);
});

test("a regrade of a regrade is later than what it re-read, whatever its name says", () => {
  const source = reading("r");
  const first = reading("r-regrade-1", "r");
  const chained = reading("r-regrade-1-regrade-1", "r-regrade-1");
  const { lineages } = orderReadings([chained, source, first]);

  assert.deepEqual(lineages[0].map(entry => entry.run), ["r", "r-regrade-1", "r-regrade-1-regrade-1"]);
});

test("run ids repeat across tasks, so a lineage is keyed by task as well", () => {
  const here = reading("r");
  const there = { ...reading("r-regrade-1", "r"), task: "gas-goal-002" };
  const { lineages, warnings } = orderReadings([here, there]);

  assert.equal(lineages.length, 1, "the namesake regrade in another task has no source there and is reported");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /gas-goal-002\/r-regrade-1: regrade_of names r/);
});

test("a cycle is reported rather than followed", () => {
  const a = reading("a", "b");
  const b = reading("b", "a");
  const { lineages, warnings } = orderReadings([a, b]);

  assert.deepEqual(lineages, []);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /forms a cycle/);
});
