import assert from "node:assert/strict";
import test from "node:test";
import { buildTranscript } from "../lib/transcript.js";
import { buildUsage, parseTranscriptStats, parseUsageRecord } from "../lib/usage.js";

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
    cost_source: null,
    input_tokens: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    output_tokens: null,
    total_tokens: null,
  });
});

test("a claude cost is recorded as the executor's own", () => {
  assert.equal(buildUsage("claude", claudeStdout, "", 1_000).cost_source, "executor");
});

// `codex exec --json` stdout, trimmed to the events the harness reads. The usage line is a real
// one, from codex-cli 0.150.1 on gpt-5.6-sol (2026-09-15).
const codexStdout = [
  JSON.stringify({ type: "thread.started", thread_id: "t" }),
  JSON.stringify({ type: "turn.started" }),
  JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "I'll look first." } }),
  JSON.stringify({
    type: "item.completed",
    item: { type: "command_execution", command: "/bin/bash -lc 'cat hello.txt'", aggregated_output: "hi\n", exit_code: 0 },
  }),
  JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } }),
  JSON.stringify({
    type: "turn.completed",
    usage: { input_tokens: 58_451, cached_input_tokens: 53_632, cache_write_input_tokens: 0, output_tokens: 267, reasoning_output_tokens: 0 },
  }),
  "",
].join("\n");

// OpenAI counts the cached part inside input_tokens; claude counts it beside. Recorded in
// claude's shape, or input_tokens would mean two different things in one result.yaml column.
test("codex --json usage is re-cut into claude's shape", () => {
  const usage = buildUsage("codex", codexStdout, "", 1_000, "gpt-5.6-sol");

  assert.equal(usage.input_tokens, 58_451 - 53_632);
  assert.equal(usage.cache_read_input_tokens, 53_632);
  assert.equal(usage.cache_creation_input_tokens, 0);
  assert.equal(usage.output_tokens, 267);
  assert.equal(usage.total_tokens, 58_451 + 267);
  assert.equal(usage.turns, null);
});

// 4,819 uncached × $4 + 53,632 cached × $0.40 + 267 output × $20, per million.
test("codex cost is derived from the token split and the model's list price", () => {
  const usage = buildUsage("codex", codexStdout, "", 1_000, "gpt-5.6-sol");

  assert.equal(usage.cost_usd, 0.046069);
  assert.equal(usage.cost_source, "list_price");
});

test("a codex model with no list price records no cost rather than a guess", () => {
  for (const model of ["gpt-unlisted", null]) {
    const usage = buildUsage("codex", codexStdout, "", 1_000, model);

    assert.equal(usage.cost_usd, null);
    assert.equal(usage.cost_source, null);
    assert.equal(usage.total_tokens, 58_718);
  }
});

test("codex usage sums every completed turn", () => {
  const turn = JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1_000, cached_input_tokens: 600, output_tokens: 50 } });
  const usage = buildUsage("codex", `${turn}\n${turn}\n`, "", 1_000, "gpt-5.6-sol");

  assert.equal(usage.input_tokens, 800);
  assert.equal(usage.cache_read_input_tokens, 1_200);
  assert.equal(usage.total_tokens, 2_100);
});

// A codex killed mid-turn never emits turn.completed: no usage, not zero usage.
test("a codex run with no completed turn records no tokens", () => {
  const usage = buildUsage("codex", JSON.stringify({ type: "turn.started" }), "", 1_000, "gpt-5.6-sol");

  assert.equal(usage.total_tokens, null);
  assert.equal(usage.cost_usd, null);
});

// run-stats reads the transcript first, so the footer has to carry the derived cost back out
// and say it is derived.
test("a codex transcript footer round-trips tokens, duration and a list-price cost", () => {
  const usage = buildUsage("codex", codexStdout, "", 42_000, "gpt-5.6-sol");
  const transcript = buildTranscript(
    { run: "r", executor: "codex", model: "gpt-5.6-sol", exit: 0, workspacePath: "/w", usage },
    codexStdout,
    "",
  );
  const stats = parseTranscriptStats(transcript);

  assert.match(transcript, /- \*\*exec\*\* `\/bin\/bash -lc 'cat hello.txt'` → exit 0/);
  assert.match(transcript, /## assistant\ndone/);
  assert.equal(stats?.duration_s, 42);
  assert.equal(stats?.cost_usd, 0.046069);
  assert.equal(stats?.cost_source, "list_price");
  assert.equal(stats?.total_tokens, 58_718);
  assert.equal(stats?.cache_read_input_tokens, 53_632);
});

// codex without --json printed the count with a thousands separator that has changed between
// versions: U+202F in the 2026-08-13 runs under artifacts/, a comma in codex-cli 0.146.1.
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
    cost_source: "list_price",
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
    cost_source: null,
    input_tokens: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    output_tokens: null,
    total_tokens: null,
  });
});

// The two shapes a committed transcript records its run in. 147 of the 970 in artifacts/
// predate the "## run stats" footer and carry the raw result event under a "## result"
// heading instead — same numbers, different labels — and a cost table that could only read
// the footer reported them as unmeasured while their cost sat in the file.
const footerTranscript = [
  "## assistant\n\nwriting the answer",
  "## run stats\n- turns: 8\n- duration: 418s\n- cost: $1.371153\n- tokens in/out: 250762/31748\n- of which cache write/read: 47453/203297",
].join("\n\n");

// Shape taken from artifacts/l2s-quiz-001/2026-08-24T201805Z-claude-with-skill-1.
const resultBlockTranscript = [
  "## assistant\n\nwriting the answer",
  `## result\nsubtype: success\nduration_ms: 524679\nnum_turns: 24\ntotal_cost_usd: 1.675763\nusage: ${JSON.stringify({
    input_tokens: 46,
    cache_creation_input_tokens: 48_009,
    cache_read_input_tokens: 871_832,
    output_tokens: 30_332,
  })}`,
  "### final message\n\nWritten to answer.md. duration_ms: 999999 appears here too.",
].join("\n\n");

// Every record written before cost_source existed got its cost from claude.
test("a recorded cost with no source is the executor's", () => {
  assert.equal(parseUsageRecord({ cost_usd: 1.2 })?.cost_source, "executor");
  assert.equal(parseUsageRecord({ cost_usd: null })?.cost_source, null);
});

test("the run stats footer is read when a transcript has one", () => {
  const stats = parseTranscriptStats(footerTranscript);

  assert.equal(stats?.turns, 8);
  assert.equal(stats?.duration_s, 418);
  assert.equal(stats?.cost_usd, 1.371153);
  assert.equal(stats?.total_tokens, 250_762 + 31_748);
});

test("a pre-footer transcript is read from its result block", () => {
  const stats = parseTranscriptStats(resultBlockTranscript);

  assert.equal(stats?.turns, 24);
  // duration_ms, in seconds — the unit the footer prints and the table compares in.
  assert.equal(stats?.duration_s, 525);
  assert.equal(stats?.cost_usd, 1.675763);
  // The three-way input sum plus output, never input_tokens alone.
  assert.equal(stats?.total_tokens, 46 + 48_009 + 871_832 + 30_332);
});

test("a transcript with neither shape reports nothing rather than zeros", () => {
  assert.equal(parseTranscriptStats("## assistant\n\nno stats here"), null);
});

// A malformed usage line loses the token fields and keeps the rest: absent, not zero.
test("an unparseable usage line leaves tokens absent", () => {
  const stats = parseTranscriptStats("## result\nduration_ms: 1000\nusage: {broken");

  assert.equal(stats?.duration_s, 1);
  assert.equal(stats?.total_tokens, null);
});
