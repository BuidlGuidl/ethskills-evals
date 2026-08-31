import assert from "node:assert/strict";
import test from "node:test";
import { buildUsage, parseUsageRecord } from "../lib/usage.js";

// One line of claude's stream-json, trimmed to the fields the harness reads. The real
// event carries a dozen more; anything not read here is the transcript's business. The
// token shape is a real one, from artifacts/audit-goal-001/2026-08-27T093221Z-claude-no-skill-1:
// under prompt caching input_tokens is a double-digit remainder and the run's actual input
// is the two cache fields.
const claudeResultEvent = JSON.stringify({
  type: "result",
  subtype: "success",
  num_turns: 34,
  duration_ms: 812_345,
  total_cost_usd: 4.66,
  usage: {
    input_tokens: 12,
    cache_creation_input_tokens: 47_453,
    cache_read_input_tokens: 203_362,
    output_tokens: 31_748,
  },
});

const claudeStdout = [
  JSON.stringify({ type: "system", subtype: "init" }),
  JSON.stringify({ type: "assistant", message: { content: [] } }),
  claudeResultEvent,
  "",
].join("\n");

test("claude usage comes from the final result event", () => {
  const usage = buildUsage("claude", claudeStdout, "", 900_000);

  assert.equal(usage.turns, 34);
  assert.equal(usage.cost_usd, 4.66);
  assert.equal(usage.input_tokens, 12);
  assert.equal(usage.cache_creation_input_tokens, 47_453);
  assert.equal(usage.cache_read_input_tokens, 203_362);
  assert.equal(usage.output_tokens, 31_748);
  // The harness's own clock, not the executor's duration_ms: it is the one figure both
  // stacks report the same way.
  assert.equal(usage.duration_s, 900);
});

// The regression this shape exists to catch: summing input_tokens + output_tokens alone
// records 31,760 of the 282,575 tokens the run consumed — 89% dropped, and every token a
// skill's own prompt costs is in the 89%, so with_skill vs no_skill would compare output
// and nothing else.
test("claude total_tokens counts the cached input, not just the uncached remainder", () => {
  const usage = buildUsage("claude", claudeStdout, "", 900_000);

  assert.equal(usage.total_tokens, 282_575);
  assert.notEqual(usage.total_tokens, (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0));
});

// A stack or a model without prompt caching omits the cache fields entirely, and the total
// is then the plain two-way sum rather than null.
test("claude usage survives a result event with no cache fields", () => {
  const stdout = JSON.stringify({
    type: "result",
    usage: { input_tokens: 51_204, output_tokens: 8_133 },
  });
  const usage = buildUsage("claude", stdout, "", 1_000);

  assert.equal(usage.cache_creation_input_tokens, null);
  assert.equal(usage.cache_read_input_tokens, null);
  assert.equal(usage.total_tokens, 59_337);
});

// A result event with a usage object carrying none of the four fields is not a free run.
test("claude usage with no token fields at all stays absent", () => {
  const usage = buildUsage("claude", JSON.stringify({ type: "result", usage: {} }), "", 1_000);

  assert.equal(usage.total_tokens, null);
  assert.equal(usage.input_tokens, null);
});

test("a claude run that died before the result event still records its duration", () => {
  const usage = buildUsage("claude", JSON.stringify({ type: "assistant" }), "", 61_000);

  assert.deepEqual(usage, {
    duration_s: 61,
    turns: null,
    cost_usd: null,
    input_tokens: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    output_tokens: null,
    total_tokens: null,
  });
});

// codex prints the count with a thousands separator that has changed between versions:
// U+202F in the 2026-08-13 runs under artifacts/, a comma in codex-cli 0.146.1.
test("codex usage is parsed with either thousands separator", () => {
  for (const rendered of ["60\u202f128", "60,128", "60\u00a0128", "60 128"]) {
    const usage = buildUsage("codex", "", `some session log\n\ntokens used\n${rendered}\n`, 1_000);

    assert.equal(usage.total_tokens, 60_128);
    assert.equal(usage.cost_usd, null, "codex exec reports no price");
    assert.equal(usage.turns, null);
  }
});

test("codex usage takes the last count when the session prints several", () => {
  const log = "tokens used\n12,000\nmore work\ntokens used\n41,500\n";

  assert.equal(buildUsage("codex", "", log, 1_000).total_tokens, 41_500);
});

test("codex usage survives the inline form", () => {
  assert.equal(buildUsage("codex", "", "tokens used: 3,670\n", 1_000).total_tokens, 3_670);
});

test("a run with no usage block reads as absent, not as zero", () => {
  assert.equal(parseUsageRecord(undefined), undefined);
  assert.equal(parseUsageRecord(null), undefined);
});

test("a usage block round-trips through yaml shape", () => {
  const record = {
    duration_s: 812,
    turns: null,
    cost_usd: 4.66,
    input_tokens: 12,
    cache_creation_input_tokens: 47_453,
    cache_read_input_tokens: 203_362,
    output_tokens: 31_748,
    total_tokens: 282_575,
  };

  assert.deepEqual(parseUsageRecord(record), record);
});

// Same reason absent runs stay absent: a block missing duration_s is unmeasured, and a
// zero-second run beside real ones reads as an instant one.
test("a usage block missing a field reads as absent, not as zero", () => {
  assert.deepEqual(parseUsageRecord({}), {
    duration_s: null,
    turns: null,
    cost_usd: null,
    input_tokens: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    output_tokens: null,
    total_tokens: null,
  });
});
