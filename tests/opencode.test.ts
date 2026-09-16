import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveEffort, resolveModel } from "../lib/effort.js";
import { detectBrokenShell } from "../lib/executor-health.js";
import { harnessOpencodeHome, opencodeEnv } from "../lib/opencode-home.js";
import { buildTranscript } from "../lib/transcript.js";
import { buildUsage, parseTranscriptStats } from "../lib/usage.js";

// Two steps of `opencode run --format json`, trimmed to the fields the harness reads. The
// shapes are real: step one is a bash round from agents-arena-backend's fixture, step two the
// closing text from a 2026-09-16 probe on openrouter/z-ai/glm-5.3-flash (opencode 1.18.15).
// Tokens are per step: the second step's cache read is the first step's prompt.
const step = (tokens: Record<string, unknown>, cost: number, reason: string) =>
  JSON.stringify({ type: "step_finish", sessionID: "ses_1", part: { type: "step-finish", reason, tokens, cost } });

const bashPart = JSON.stringify({
  type: "tool_use",
  sessionID: "ses_1",
  part: {
    type: "tool",
    tool: "bash",
    callID: "call_1",
    state: {
      status: "completed",
      input: { command: "echo hello arena" },
      output: "hello arena\n",
      metadata: { output: "hello arena\n", exit: 0, truncated: false },
      title: "echo hello arena",
    },
  },
});

const opencodeStdout = [
  JSON.stringify({ type: "step_start", sessionID: "ses_1", part: { type: "step-start" } }),
  bashPart,
  step({ total: 15198, input: 15138, output: 45, reasoning: 15, cache: { write: 0, read: 0 } }, 0.0015138, "tool-calls"),
  JSON.stringify({ type: "step_start", sessionID: "ses_1", part: { type: "step-start" } }),
  JSON.stringify({ type: "reasoning", sessionID: "ses_1", part: { type: "reasoning", text: "The command succeeded." } }),
  JSON.stringify({ type: "text", sessionID: "ses_1", part: { type: "text", text: "hello arena" } }),
  step({ total: 15226, input: 109, output: 3, reasoning: 10, cache: { write: 0, read: 15104 } }, 0.0011204327, "stop"),
  "",
].join("\n");

test("opencode usage sums every step, folds reasoning into output, and takes opencode's own price", () => {
  const usage = buildUsage("opencode", opencodeStdout, "", 42_000, "openrouter/z-ai/glm-5.3-flash");

  assert.equal(usage.input_tokens, 15_247);
  assert.equal(usage.cache_creation_input_tokens, 0);
  assert.equal(usage.cache_read_input_tokens, 15_104);
  // 45 + 15 + 3 + 10: reasoning is billed as output and counted as output on the other stacks.
  assert.equal(usage.output_tokens, 73);
  assert.equal(usage.total_tokens, 30_424);
  assert.equal(usage.turns, 2);
  assert.equal(usage.cost_usd, 0.002634);
  assert.equal(usage.cost_source, "executor");
  assert.equal(usage.duration_s, 42);
});

// A subscription or free route reports 0 on every step. That is "no price", not a free run.
test("opencode steps all priced at zero record no cost rather than a free run", () => {
  const stdout = [
    step({ input: 100, output: 10, reasoning: 0, cache: { write: 0, read: 0 } }, 0, "stop"),
  ].join("\n");
  const usage = buildUsage("opencode", stdout, "", 1_000, "openrouter/z-ai/glm-5.2:free");

  assert.equal(usage.total_tokens, 110);
  assert.equal(usage.cost_usd, null);
  assert.equal(usage.cost_source, null);
});

test("an opencode run that died before its first step records only its duration", () => {
  const usage = buildUsage("opencode", JSON.stringify({ type: "step_start" }), "", 5_000, "openrouter/moonshotai/kimi-k3");

  assert.equal(usage.total_tokens, null);
  assert.equal(usage.cost_usd, null);
  assert.equal(usage.turns, null);
  assert.equal(usage.duration_s, 5);
});

test("an opencode transcript renders the run and a footer that reads back as the same usage", () => {
  const usage = buildUsage("opencode", opencodeStdout, "", 42_000, "openrouter/z-ai/glm-5.3-flash");
  const transcript = buildTranscript(
    {
      run: "2026-09-16T100000Z-opencode-no-skill-1",
      executor: "opencode",
      model: "openrouter/z-ai/glm-5.3-flash",
      reasoningEffort: "high",
      exit: 0,
      workspacePath: "/tmp/ws",
      usage,
    },
    opencodeStdout,
    "",
  );

  assert.match(transcript, /\*\*executor\*\*: opencode {2}\| {2}\*\*model\*\*: openrouter\/z-ai\/glm-5.3-flash {2}\| {2}\*\*effort\*\*: high/);
  assert.match(transcript, /- \*\*bash\*\* `echo hello arena` → exit 0\n\n {2}> hello arena/);
  assert.match(transcript, /## assistant\nhello arena/);
  assert.doesNotMatch(transcript, /The command succeeded/);
  assert.match(transcript, /- cost basis: reported by opencode: models.dev list price for openrouter\/z-ai\/glm-5.3-flash/);

  const stats = parseTranscriptStats(transcript);

  assert.ok(stats !== null);
  assert.equal(stats.turns, 2);
  assert.equal(stats.duration_s, 42);
  assert.equal(stats.cost_usd, 0.002634);
  assert.equal(stats.cost_source, "executor");
  assert.equal(stats.total_tokens, 30_424);
  assert.equal(stats.cache_read_input_tokens, 15_104);
});

test("an opencode API error lands in the transcript, not only in the raw capture", () => {
  const stdout = JSON.stringify({
    type: "error",
    sessionID: "ses_2",
    error: { name: "APIError", data: { message: "No endpoints found that support tool use.", statusCode: 404 } },
  });
  const transcript = buildTranscript(
    { run: "r", executor: "opencode", model: "openrouter/z-ai/glm-5.2:free", reasoningEffort: "low", exit: 1, workspacePath: "/tmp/ws" },
    stdout,
    "",
  );

  assert.match(transcript, /## error\n\n```text\nNo endpoints found that support tool use\.\n```/);
  assert.doesNotMatch(transcript, /## run stats/);
});

test("opencode names both model and effort on the command line, in opencode's own terms", () => {
  assert.throws(() => resolveModel("opencode", null, "--model"), /missing --model: .*provider\/model/);
  assert.equal(resolveModel("opencode", "openrouter/moonshotai/kimi-k3", "--model"), "openrouter/moonshotai/kimi-k3");
  assert.throws(() => resolveEffort("opencode", null, "--effort"), /missing --effort: .*\(low, medium, high\)/);
  assert.equal(resolveEffort("opencode", "high", "--effort"), "high");
});

// opencode accepts any --variant and silently runs at the default when it knows none of that
// name, so the check has to be here.
test("an effort opencode would silently ignore is refused before a run is spent on it", () => {
  assert.throws(() => resolveEffort("opencode", "xhigh", "--effort"), /unknown --effort for opencode: xhigh \(expected low, medium, high\)/);
  assert.throws(() => resolveEffort("opencode", "bogus", "--effort"), /unknown --effort for opencode: bogus/);
});

// Only codex's signatures are codex's: a bwrap line in an opencode capture is the run's
// output, not a diagnosis.
test("opencode has no dead-shell signatures yet, so nothing in its capture is one", () => {
  const runDir = mkdtempSync(path.join(tmpdir(), "eval-run-"));

  try {
    writeFileSync(path.join(runDir, "executor.err"), "bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted\n");
    assert.equal(detectBrokenShell(runDir, "opencode"), null);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

const withEnv = (values: Record<string, string | undefined>, body: () => void) => {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    body();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("opencode runs read nothing of the operator's: config, data, skills and CLAUDE.md are all redirected", () => {
  const home = mkdtempSync(path.join(tmpdir(), "eval-opencode-home-"));
  const runDir = mkdtempSync(path.join(tmpdir(), "eval-run-"));

  try {
    withEnv({ EVAL_OPENCODE_HOME: home, OPENROUTER_API_KEY: "sk-or-test", XDG_CONFIG_HOME: undefined }, () => {
      const env = opencodeEnv(runDir, "/tmp/ws");

      assert.equal(harnessOpencodeHome(), home);
      // opencode reads its project root from $PWD ahead of the cwd it was spawned in.
      assert.equal(env.PWD, "/tmp/ws");
      assert.equal(env.XDG_CONFIG_HOME, path.join(home, "config"));
      assert.equal(env.XDG_DATA_HOME, path.join(home, "data"));
      assert.equal(env.XDG_STATE_HOME, path.join(home, "state"));
      assert.equal(env.XDG_CACHE_HOME, undefined);
      assert.equal(env.OPENCODE_DB, path.join(runDir, "opencode.db"));
      assert.equal(env.OPENCODE_DISABLE_EXTERNAL_SKILLS, "1");
      assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, "1");
      assert.equal(env.OPENCODE_ENABLE_EXA, "1");
      assert.equal(env.OPENROUTER_API_KEY, "sk-or-test");
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("an opencode run without an OpenRouter key is refused before anything is spawned", () => {
  const home = mkdtempSync(path.join(tmpdir(), "eval-opencode-home-"));
  const runDir = mkdtempSync(path.join(tmpdir(), "eval-run-"));

  try {
    withEnv({ EVAL_OPENCODE_HOME: home, OPENROUTER_API_KEY: undefined }, () => {
      assert.throws(() => opencodeEnv(runDir, "/tmp/ws"), /OPENROUTER_API_KEY is unset/);
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("a harness home that is the operator's own config dir is refused, not silently a no-op", () => {
  const home = mkdtempSync(path.join(tmpdir(), "eval-opencode-home-"));
  const runDir = mkdtempSync(path.join(tmpdir(), "eval-run-"));

  try {
    // The operator's config is $XDG_CONFIG_HOME/opencode; the harness's is <home>/config/opencode.
    withEnv({ EVAL_OPENCODE_HOME: home, XDG_CONFIG_HOME: path.join(home, "config"), OPENROUTER_API_KEY: "sk-or-test" }, () => {
      assert.throws(() => opencodeEnv(runDir, "/tmp/ws"), /operator's own opencode config/);
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(runDir, { recursive: true, force: true });
  }
});
