import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { findSkillMentions } from "../lib/blindness.js";
import { resolveEffort, resolveModel } from "../lib/effort.js";
import { detectBrokenShell } from "../lib/executor-health.js";
import {
  catalogEfforts, catalogProviderEnv, forgetOpencodeCredential, opencodeArgs, opencodeEnv, opencodeRunHome, operatorConfigFound,
} from "../lib/opencode-home.js";
import { buildTranscript } from "../lib/transcript.js";
import { buildUsage, parseTranscriptStats } from "../lib/usage.js";
import { SKILL_BRIDGE_DIRS, SKILL_INSTALL_DIRS } from "../lib/workspace.js";

// Two steps of `opencode run --format json`, trimmed to the fields the harness reads. The
// shapes are real: step one is a bash round from agents-arena-backend's fixture, step two the
// closing text from a 2026-09-16 probe on openrouter/z-ai/glm-5.3-flash (opencode 1.18.15).
// Tokens are per step: the second step's cache read is the first step's prompt.
const step = (tokens: Record<string, unknown>, cost: number, reason: string) =>
  JSON.stringify({ type: "step_finish", sessionID: "ses_1", part: { type: "step-finish", reason, tokens, cost } });

const toolPart = (id: string, state: Record<string, unknown>, tool = "bash") =>
  JSON.stringify({ type: "tool_use", sessionID: "ses_1", part: { id, type: "tool", tool, callID: `call_${id}`, state } });

const bashPart = toolPart("prt_1", {
  status: "completed",
  input: { command: "echo hello arena" },
  output: "hello arena\n",
  metadata: { output: "hello arena\n", exit: 0, truncated: false },
  title: "echo hello arena",
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

const MODEL = "openrouter/z-ai/glm-5.3-flash";

const header = (usage?: ReturnType<typeof buildUsage>, exit = 0) => ({
  run: "2026-09-16T100000Z-opencode-no-skill-1",
  executor: "opencode" as const,
  model: MODEL,
  reasoningEffort: "low",
  exit,
  workspacePath: "/tmp/ws",
  usage,
});

test("opencode usage sums every step, folds reasoning into output, and takes opencode's own price", () => {
  const usage = buildUsage("opencode", opencodeStdout, "", 42_000, MODEL);

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

// A subscription or free route reports 0 on every step. That is "no price", not a free run —
// and so is a sum that only rounds to zero.
test("opencode steps priced at zero record no cost rather than a free run", () => {
  const zero = step({ input: 100, output: 10, reasoning: 0, cache: { write: 0, read: 0 } }, 0, "stop");
  const usage = buildUsage("opencode", zero, "", 1_000, "openrouter/z-ai/glm-5.2:free");

  assert.equal(usage.total_tokens, 110);
  assert.equal(usage.cost_usd, null);
  assert.equal(usage.cost_source, null);

  const tiny = buildUsage("opencode", step({ input: 1, output: 1, reasoning: 0, cache: { write: 0, read: 0 } }, 0.0000002, "stop"), "", 1_000, MODEL);

  assert.equal(tiny.cost_usd, null);
});

test("an opencode run that died before its first step records only its duration", () => {
  const usage = buildUsage("opencode", JSON.stringify({ type: "step_start" }), "", 5_000, "openrouter/moonshotai/kimi-k3");

  assert.equal(usage.total_tokens, null);
  assert.equal(usage.cost_usd, null);
  assert.equal(usage.turns, null);
  assert.equal(usage.duration_s, 5);
});

test("an opencode transcript renders the run and a footer that reads back as the same usage", () => {
  const usage = buildUsage("opencode", opencodeStdout, "", 42_000, MODEL);
  const transcript = buildTranscript(header(usage), opencodeStdout, "");

  assert.match(transcript, /\*\*executor\*\*: opencode {2}\| {2}\*\*model\*\*: openrouter\/z-ai\/glm-5.3-flash {2}\| {2}\*\*effort\*\*: low/);
  assert.match(transcript, /- \*\*bash\*\* `echo hello arena` → exit 0\n\n {2}> hello arena/);
  assert.match(transcript, /## assistant\nhello arena/);
  assert.doesNotMatch(transcript, /The command succeeded/);
  assert.match(transcript, /^- cost source: executor$/m);
  assert.match(transcript, /- cost basis: reported by opencode: the pinned catalog's list price for openrouter\/z-ai\/glm-5.3-flash/);

  const stats = parseTranscriptStats(transcript);

  assert.ok(stats !== null);
  assert.equal(stats.turns, 2);
  assert.equal(stats.duration_s, 42);
  assert.equal(stats.cost_usd, 0.002634);
  assert.equal(stats.cost_source, "executor");
  assert.equal(stats.total_tokens, 30_424);
  assert.equal(stats.cache_read_input_tokens, 15_104);
});

// A call that failed is part of what the run did. And a compaction re-emits completed parts
// under their original ids, which must not read as the command having run twice.
test("a failed tool call is rendered with its error, and a re-emitted part only once", () => {
  const failed = toolPart("prt_2", {
    status: "error",
    input: { command: "cast call 0xdead 'factory()(address)' --rpc-url https://mainnet.base.org" },
    error: "Error: server returned an error response: error code -32000: execution reverted",
  });
  const stdout = [bashPart, failed, bashPart, step({ input: 10, output: 1, reasoning: 0, cache: { write: 0, read: 0 } }, 0.001, "stop")].join("\n");
  const transcript = buildTranscript(header(buildUsage("opencode", stdout, "", 1_000, MODEL)), stdout, "");

  assert.match(transcript, /- \*\*bash\*\* `cast call 0xdead[^`]*` → error\n\n {2}> Error: server returned an error response/);
  assert.equal(transcript.match(/echo hello arena/g)?.length, 1);
});

test("an opencode API error lands in the transcript, not only in the raw capture", () => {
  const stdout = JSON.stringify({
    type: "error",
    sessionID: "ses_2",
    error: { name: "APIError", data: { message: "No endpoints found that support tool use.", statusCode: 404 } },
  });
  const transcript = buildTranscript(header(undefined, 1), stdout, "");

  assert.match(transcript, /## error\n\n```text\nNo endpoints found that support tool use\.\n```/);
  assert.doesNotMatch(transcript, /## run stats/);
});

// --- the harness home, the pinned catalog and the run environment ---------------------------

// A catalog in the shape of ~/.cache/opencode/models.json, trimmed to what the harness reads.
const CATALOG = {
  openrouter: {
    env: ["OPENROUTER_API_KEY"],
    models: {
      "moonshotai/kimi-k3": { reasoning: true, reasoning_options: [{ type: "toggle" }, { type: "effort", values: ["low", "high", "max"] }] },
      "z-ai/glm-5.3-flash": { reasoning: true, reasoning_options: [{ type: "effort", values: ["low", "high", "max"] }] },
      "some/thinker": { reasoning: true },
      "some/plain": { reasoning: false },
    },
  },
  anthropic: { env: ["ANTHROPIC_API_KEY"], models: {} },
  openai: { env: ["OPENAI_API_KEY"], models: {} },
  github: { env: ["GITHUB_TOKEN"], models: {} },
};

const withEnv = (values: Record<string, string | undefined>, body: () => void) => {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  const apply = (entries: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  apply(values);

  try {
    body();
  } finally {
    apply(previous);
  }
};

// A harness home with the catalog already pinned, an empty operator home, and a run dir; every
// variable the harness reads or strips is set to a known value first.
const withHarness = (body: (dirs: { home: string; operatorHome: string; runDir: string }) => void) => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-opencode-"));
  const home = path.join(root, "harness-home");
  const operatorHome = path.join(root, "operator-home");
  const runDir = path.join(root, "artifacts", "addresses-quiz-001", "2026-09-16T100000Z-opencode-no-skill-1");

  mkdirSync(home, { recursive: true });
  mkdirSync(operatorHome, { recursive: true });
  mkdirSync(runDir, { recursive: true });
  writeFileSync(path.join(home, "models.json"), JSON.stringify(CATALOG));

  try {
    withEnv({
      EVAL_OPENCODE_HOME: home,
      HOME: operatorHome,
      OPENROUTER_API_KEY: "sk-or-test",
      ANTHROPIC_API_KEY: "sk-ant-test",
      GITHUB_TOKEN: "ghp-test",
      ETHERSCAN_API_KEY: "etherscan-test",
      OPENCODE_CONFIG_DIR: "/somewhere/else",
      OPENCODE_PERMISSION: "{}",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector",
      XDG_CACHE_HOME: path.join(root, "cache"),
      XDG_CONFIG_HOME: undefined,
      XDG_DATA_HOME: undefined,
      XDG_STATE_HOME: undefined,
    }, () => body({ home, operatorHome, runDir }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("opencode efforts come from the model's own catalog entry, and 'medium' is not one kimi-k3 takes", () => {
  withHarness(() => {
    assert.throws(
      () => resolveEffort("opencode", "medium", "--effort", "openrouter/moonshotai/kimi-k3"),
      /unknown --effort for opencode: medium \(expected low, high, max\)/,
    );
    assert.equal(resolveEffort("opencode", "high", "--effort", "openrouter/moonshotai/kimi-k3"), "high");
    assert.throws(() => resolveEffort("opencode", null, "--effort", "openrouter/moonshotai/kimi-k3"), /missing --effort: .*\(low, high, max\)/);
    // No listed set: opencode's own default for an OpenRouter reasoning model.
    assert.equal(resolveEffort("opencode", "medium", "--effort", "openrouter/some/thinker"), "medium");
    assert.throws(() => resolveEffort("opencode", "low", "--effort", "openrouter/some/plain"), /takes no reasoning effort/);
    assert.throws(() => resolveEffort("opencode", "low", "--effort", "openrouter/nobody/nothing"), /not in the pinned opencode catalog/);
  });

  assert.equal(catalogEfforts(CATALOG, "no-slash"), null);
});

test("opencode names the model on the command line, in opencode's own terms", () => {
  assert.throws(() => resolveModel("opencode", null, "--model"), /missing --model: .*provider\/model/);
  assert.equal(resolveModel("opencode", "openrouter/moonshotai/kimi-k3", "--model"), "openrouter/moonshotai/kimi-k3");
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

test("an opencode run's environment carries nothing of the operator's opencode, and no key but the one in auth.json", () => {
  withHarness(({ home, runDir }) => {
    const env = opencodeEnv({ runDir, workspacePath: "/tmp/ws", model: MODEL });
    const runHome = opencodeRunHome(runDir);

    // Dropped: opencode's own variables, telemetry, every provider key the catalog names.
    for (const name of ["OPENCODE_CONFIG_DIR", "OPENCODE_PERMISSION", "OTEL_EXPORTER_OTLP_ENDPOINT", "ANTHROPIC_API_KEY", "GITHUB_TOKEN", "OPENROUTER_API_KEY"]) {
      assert.equal(env[name], undefined, name);
    }

    // Kept: a key the catalog does not name is the task's business, and the cache is shared.
    assert.equal(env.ETHERSCAN_API_KEY, "etherscan-test");
    assert.equal(env.XDG_CACHE_HOME, process.env.XDG_CACHE_HOME);

    assert.equal(env.XDG_CONFIG_HOME, path.join(home, "config"));
    assert.equal(env.XDG_DATA_HOME, path.join(runHome, "data"));
    assert.equal(env.XDG_STATE_HOME, path.join(runHome, "state"));
    assert.equal(env.OPENCODE_MODELS_PATH, path.join(home, "models.json"));
    assert.equal(env.OPENCODE_DISABLE_MODELS_FETCH, "1");
    assert.equal(env.OPENCODE_DISABLE_EXTERNAL_SKILLS, "1");
    assert.equal(env.OPENCODE_DISABLE_CLAUDE_CODE, "1");
    assert.equal(env.OPENCODE_ENABLE_EXA, "1");
    // opencode reads its project root from $PWD ahead of the cwd it was spawned in.
    assert.equal(env.PWD, "/tmp/ws");

    const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT ?? "{}") as Record<string, unknown>;

    assert.equal(config.share, "disabled");
    assert.equal(config.small_model, MODEL);
    assert.deepEqual(config.tools, { task: false });
    assert.deepEqual(config.permission, { task: "deny" });

    const auth = path.join(runHome, "data", "opencode", "auth.json");

    assert.deepEqual(JSON.parse(readFileSync(auth, "utf8")), { openrouter: { type: "api", key: "sk-or-test" } });
    assert.equal(statSync(auth).mode & 0o777, 0o600);

    forgetOpencodeCredential(runDir);
    assert.equal(existsSync(auth), false);
    assert.equal(existsSync(path.join(runHome, "data")), true);
  });
});

test("the catalog is pinned on first use and the provider keys to drop are read from it", () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-opencode-"));
  const home = path.join(root, "harness-home");
  const cache = path.join(root, "cache");

  mkdirSync(path.join(cache, "opencode"), { recursive: true });
  writeFileSync(path.join(cache, "opencode", "models.json"), JSON.stringify(CATALOG));

  try {
    withEnv({ EVAL_OPENCODE_HOME: home, HOME: path.join(root, "operator-home"), XDG_CACHE_HOME: cache, OPENROUTER_API_KEY: "sk-or-test" }, () => {
      mkdirSync(path.join(root, "operator-home"), { recursive: true });

      const runDir = path.join(root, "a", "b");

      mkdirSync(runDir, { recursive: true });
      opencodeEnv({ runDir, workspacePath: "/tmp/ws", model: MODEL });
      assert.equal(readFileSync(path.join(home, "models.json"), "utf8"), JSON.stringify(CATALOG));
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  assert.deepEqual(catalogProviderEnv(CATALOG), ["ANTHROPIC_API_KEY", "GITHUB_TOKEN", "OPENAI_API_KEY"]);
});

test("an opencode run without an OpenRouter key is refused before anything is spawned", () => {
  withHarness(({ runDir }) => {
    withEnv({ OPENROUTER_API_KEY: undefined }, () => {
      assert.throws(() => opencodeEnv({ runDir, workspacePath: "/tmp/ws", model: MODEL }), /OPENROUTER_API_KEY is unset/);
    });
  });
});

// ~/.opencode is read by every opencode whatever the harness sets, so a skill or a config in
// it is a refusal, not something to work around. Its own npm install is not configuration.
test("an operator ~/.opencode with configuration in it refuses the run; opencode's own npm install does not", () => {
  withHarness(({ operatorHome, runDir }) => {
    const dir = path.join(operatorHome, ".opencode");

    mkdirSync(path.join(dir, "node_modules"), { recursive: true });
    mkdirSync(path.join(dir, "bin"), { recursive: true });
    writeFileSync(path.join(dir, "package.json"), "{}");
    assert.deepEqual(operatorConfigFound(dir, []), []);
    assert.ok(opencodeEnv({ runDir, workspacePath: "/tmp/ws", model: MODEL }));

    mkdirSync(path.join(dir, "skills", "addresses"), { recursive: true });
    assert.deepEqual(operatorConfigFound(dir, []), [path.join(dir, "skills")]);
    assert.throws(() => opencodeEnv({ runDir, workspacePath: "/tmp/ws", model: MODEL }), /operator's own configuration: .*\.opencode\/skills/);

    const managed = path.join(operatorHome, "etc-opencode");

    mkdirSync(managed);
    assert.deepEqual(operatorConfigFound(path.join(operatorHome, "none"), [managed]), [managed]);
  });
});

test("the opencode command line carries every flag a real run needed", () => {
  const args = opencodeArgs("openrouter/moonshotai/kimi-k3", "high", "/tmp/ws", "run-1");

  assert.deepEqual(args, [
    "run", "--format", "json", "--auto", "--dir", "/tmp/ws", "--title", "run-1", "--variant", "high", "-m", "openrouter/moonshotai/kimi-k3",
  ]);
});

// The bridge copy goes where the executor reads, and every bridge dir is also an evidence
// exclusion — the two lists are one list.
test("setup bridges the skill to .opencode/skills for opencode only, and the blindness guard knows the dir", () => {
  assert.deepEqual(SKILL_BRIDGE_DIRS, { claude: [".claude"], codex: [], opencode: [".opencode"] });
  assert.deepEqual(SKILL_INSTALL_DIRS, [".agents", ".claude", ".opencode"]);

  const hits = findSkillMentions("# output/answer.md\nRouter per .opencode/skills/addresses/SKILL.md, verified on-chain.\n");

  assert.ok(hits.some(hit => hit.includes("[skill install path]")), hits.join("\n"));
});
