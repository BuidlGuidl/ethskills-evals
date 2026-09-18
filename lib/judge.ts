import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { codexEnv, codexReasoningArgs } from "./codex-home.js";
import { CLAUDE_LAUNCH } from "./effort.js";
import type { ExpectStatus, JudgeAgent, JudgeSpec } from "./types.js";

export type JudgeResult =
  | { ok: true; expects: Record<string, ExpectStatus> }
  | { ok: false; expects: Record<string, ExpectStatus>; error: string };

// A ceiling, not a budget: it only has to catch a hung CLI. At 120s it also caught judges that
// were still working — a high-effort grade of a repo-shaped snapshot can think past two
// minutes — and verify refuses a failed judge, so the run went ungraded for the harness's reason.
const JUDGE_TIMEOUT_MS = 600_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

const failExpectations = (expectations: string[]) =>
  Object.fromEntries(expectations.map((_, index) => [`expect_${index + 1}`, "fail" as const]));

// Agents wrap their answer in prose or fences however they like. Grab the outermost
// JSON object rather than demanding the whole stdout parse.
const extractJson = (output: string) => {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  return start === -1 || end <= start ? null : output.slice(start, end + 1);
};

const parseVerdicts = (output: string, expectations: string[]): JudgeResult => {
  const json = extractJson(output);

  if (!json) {
    return { ok: false, expects: failExpectations(expectations), error: "judge output contained no JSON object" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, expects: failExpectations(expectations), error: "judge output was not strict JSON" };
  }

  const verdicts = parsed && typeof parsed === "object" ? (parsed as { verdicts?: unknown }).verdicts : undefined;

  if (!Array.isArray(verdicts)) {
    return { ok: false, expects: failExpectations(expectations), error: "judge output missing verdicts array" };
  }

  const expects: Record<string, ExpectStatus> = {};

  for (let index = 0; index < expectations.length; index++) {
    const condition = index + 1;
    const verdict = verdicts.find(
      item => item && typeof item === "object" && (item as { condition?: unknown }).condition === condition,
    );
    const passed = verdict && typeof verdict === "object" ? (verdict as { pass?: unknown }).pass : undefined;

    if (typeof passed !== "boolean") {
      return { ok: false, expects: failExpectations(expectations), error: `judge output missing condition ${condition}` };
    }

    expects[`expect_${condition}`] = passed ? "pass" : "fail";
  }

  return { ok: true, expects };
};

type Spawned = { ok: true; output: string } | { ok: false; error: string };

// spawnSync reports its own kill as `spawnSync env ETIMEDOUT`, which names neither the limit nor
// the stack that hit it.
const spawnError = (error: Error, judge: JudgeSpec) =>
  (error as NodeJS.ErrnoException).code === "ETIMEDOUT"
    ? `${judge.agent} judge (${judge.model}, effort ${judge.reasoning_effort}) timed out after ${JUDGE_TIMEOUT_MS / 1000}s`
    : error.message;

// Both judges run in an empty dir of their own, never in the repo: a CLI discovers what its cwd
// holds, and this repo's root holds `.claude/skills` and `.agents/skills` (a benchmark's arms and
// run-id scheme), AGENTS.md, and every task's skill text under `skills/` — none of which a blind
// grader may see, and any of which can change mid-benchmark without a record showing it. The
// evidence is all in the prompt, so there is nothing in the repo the judge needs.
//
// One dir for every judge on the machine, not one per call: claude keys its project state on the
// cwd, so a fresh mkdtemp per grade leaves a ~/.claude/projects entry per run — thousands over a
// benchmark, and nothing ever removes them. It is not emptied between calls, because grades of
// different runs overlap; nothing of a grade is written here (see the codex judge's file, which
// is its own), so it stays as empty as it starts.
const JUDGE_DIR = path.join(tmpdir(), "skill-eval-judge");

const inJudgeDir = (run: (dir: string) => Spawned): Spawned => {
  mkdirSync(JUDGE_DIR, { recursive: true });

  try {
    return run(JUDGE_DIR);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// `claude -p` prints the final message to stdout. Both auth env vars are unset so a
// stray key can't silently swap the account the judge grades under. The prompt goes in
// on stdin, not argv: repo-shaped runs assemble evidence far larger than the OS argv
// limit (E2BIG), and `-p` with no positional prompt reads it from stdin.
const runClaudeJudge = (prompt: string, judge: JudgeSpec): Spawned => inJudgeDir(dir => {
  const args = [
    ...CLAUDE_LAUNCH,
    "--model", judge.model,
    "--effort", judge.reasoning_effort,
    "--setting-sources", "project", "--strict-mcp-config",
  ];

  const result = spawnSync("env", args, {
    cwd: dir,
    input: prompt,
    encoding: "utf8",
    timeout: JUDGE_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });

  if (result.error) {
    return { ok: false, error: spawnError(result.error, judge) };
  }

  if (result.status !== 0) {
    return { ok: false, error: result.stderr.trim() || "judge exited non-zero" };
  }

  return { ok: true, output: result.stdout };
});

// `codex exec` interleaves session logging with the answer on stdout, so take the
// final message from --output-last-message instead. read-only: the judge reads
// evidence, it never edits a workspace. `-` for the prompt reads it from stdin, keeping
// repo-shaped evidence off argv (E2BIG). `--disable shell_snapshot` for the same reason
// the executor gets it (see scripts/run-executor.ts): the operator's rc files must not
// ride into a graded process, and one unparseable line in the snapshot leaves the judge
// with no shell to check its evidence in. CODEX_HOME is redirected for the same reason it
// is on the executor — a global codex skill about the task's subject must not reach the
// grader either — which is also why the model arrives resolved (verify does it, so
// result.yaml names the model that graded). No network flag here on purpose: the judge
// grades from the evidence in its prompt, so read-only's default deny is correct.
const runCodexJudge = (prompt: string, judge: JudgeSpec): Spawned => inJudgeDir(dir => {
  // In a dir of its own under the shared cwd, and removed below: two grades run at once, and
  // one judge's answer must not be the file another judge reads.
  const messageDir = mkdtempSync(path.join(dir, "message-"));
  const messagePath = path.join(messageDir, "last-message.txt");
  // The effort verify resolved rides along for the same reason the model does: the redirect
  // means codex reads none of the operator's config.toml, and a judge whose effort silently
  // changed mid-benchmark grades the back half differently from the front half.
  const args = [
    "exec",
    "--disable", "shell_snapshot",
    "-s", "read-only",
    "--skip-git-repo-check",
    "--ephemeral",
    ...codexReasoningArgs(judge.reasoning_effort),
    "-o", messagePath,
    "-m", judge.model,
    "-",
  ];

  const result = spawnSync("codex", args, {
    cwd: dir,
    input: prompt,
    encoding: "utf8",
    env: codexEnv(),
    timeout: JUDGE_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });

  if (result.error) {
    return { ok: false, error: spawnError(result.error, judge) };
  }

  try {
    if (result.status !== 0) {
      return { ok: false, error: result.stderr.trim() || "judge exited non-zero" };
    }

    return { ok: true, output: readFileSync(messagePath, "utf8") };
  } finally {
    rmSync(messageDir, { recursive: true, force: true });
  }
});

const JUDGE_RUNNERS: Record<JudgeAgent, (prompt: string, judge: JudgeSpec) => Spawned> = {
  claude: runClaudeJudge,
  codex: runCodexJudge,
};

export const judgeExpectations = (
  taskInput: string,
  expectations: string[],
  evidence: string,
  judge: JudgeSpec,
): JudgeResult => {
  const prompt = [
    "You are grading a coding-agent run. You are blind to the variant and skill.",
    "Decide whether each numbered condition is satisfied by the evidence for the task.",
    'Return only strict JSON: {"verdicts":[{"condition":1,"pass":true,"reason":"..."}]}',
    "",
    "TASK:",
    taskInput,
    "",
    "EVIDENCE:",
    evidence,
    "",
    "EXPECT CONDITIONS:",
    ...expectations.map((condition, index) => `${index + 1}. ${condition}`),
  ].join("\n");

  const spawned = JUDGE_RUNNERS[judge.agent](prompt, judge);

  if (!spawned.ok) {
    return { ok: false, expects: failExpectations(expectations), error: spawned.error };
  }

  return parseVerdicts(spawned.output.trim(), expectations);
};
