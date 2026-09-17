import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import yaml from "js-yaml";
import { codexEnv, codexReasoningArgs } from "../lib/codex-home.js";
import { CLAUDE_LAUNCH, resolveEffort, resolveModel } from "../lib/effort.js";
import { detectBrokenShell } from "../lib/executor-health.js";
import { hasCodexPrice } from "../lib/prices.js";
import { loadYamlFile, optionalArg, parseArgs, requireString } from "../lib/task.js";
import { buildTranscript, codexProgress } from "../lib/transcript.js";
import { buildUsage } from "../lib/usage.js";
import type { Executor, ExecutorRecord } from "../lib/types.js";
import { readWorkspacePath } from "../lib/workspace.js";

const ROOT = process.cwd();
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const RUN_ARGS = new Set(["run", "model", "effort"]);

const parseExecutor = (value: string): Executor => {
  if (!EXECUTORS.has(value as Executor)) {
    throw new Error(`unknown executor in result.yaml: ${value}`);
  }

  return value as Executor;
};

// `--setting-sources project` is load-bearing for claude: user-level config crowds the
// skill listing and skills stop triggering. codex gets the same isolation from a redirected
// CODEX_HOME (lib/codex-home.ts) plus two load-bearing flags:
// `sandbox_workspace_write.network_access=true` (workspace-write blocks network by
// default, so without it every live-data task fails for the wrong reason) and
// `--disable shell_snapshot` (see the block above the codex args). Both take the prompt
// on stdin — TASK.md can outgrow the argv limit.
const buildCommand = (executor: Executor, model: string, reasoningEffort: string) => {
  if (executor === "claude") {
    const args = [...CLAUDE_LAUNCH];

    args.push(
      "--model", model,
      "--effort", reasoningEffort,
      "--setting-sources", "project",
      "--dangerously-skip-permissions",
      "--strict-mcp-config",
      "--output-format", "stream-json",
      "--verbose",
    );

    return { file: "env", args };
  }

  // --disable shell_snapshot keeps the operator's interactive shell out of the run. codex
  // otherwise snapshots that shell's functions and aliases and sources the snapshot into
  // every command, so whatever is in the operator's rc files rides into the run — and a
  // single unparseable line in it takes the whole shell down. Seen on 2026-08-27: a snapshot
  // that failed to re-parse ("syntax error near unexpected token `('", from extglob patterns
  // `declare -f` dumps without the shopt that made them legal) left a with_skill run unable
  // to read its own installed skill, which grades as a skill that did not help rather than
  // as a broken run.
  //
  // Same rule as claude's --setting-sources project — the executor's environment is the
  // benchmark's, not the operator's — but not the same mechanism, and not the same coverage:
  // --setting-sources governs settings-file discovery only. claude snapshots the operator's
  // interactive shell into its own Bash tool exactly as codex does, and has no equivalent
  // flag, so that half of this exposure is still open.
  //
  // --ephemeral because the redirected CODEX_HOME is one dir shared by every run on this
  // machine. Without it codex writes each session into sessions/ and history.jsonl there,
  // and a later no_skill run that finds this repo finds an earlier with_skill run's session
  // log with the skill text in it — the same contamination the redirect exists to close,
  // one level down. It does not stop codex's own caches and state dbs, which are the same
  // for every operator and carry no run content.
  //
  // --json because it is the only place codex reports its token split. Without it the session
  // log ends in a bare `tokens used` count — uncached input plus output — which cannot be priced
  // and is not the unit claude's total is in. With it, every turn ends in a turn.completed event
  // carrying input, cached and output tokens, which is what usage.ts records and prices.
  //
  // The rest of ~/.codex is handled by CODEX_HOME below, not by a flag.
  const args = [
    "exec",
    "--json",
    "--disable", "shell_snapshot",
    "--ephemeral",
    "-s", "workspace-write",
    "-c", "sandbox_workspace_write.network_access=true",
    ...codexReasoningArgs(reasoningEffort),
    "-m", model,
    "-",
  ];

  return { file: "codex", args };
};

const writeRecord = async (recordPath: string, record: ExecutorRecord) =>
  writeFile(recordPath, yaml.dump(record, { lineWidth: -1 }));

const main = async () => {
  const args = parseArgs(RUN_ARGS);
  const runDir = path.resolve(ROOT, requireString(args.run, "--run"));
  const requestedModel = optionalArg(args, "model");
  const requestedEffort = optionalArg(args, "effort");
  const resultPath = path.join(runDir, "result.yaml");
  const recordPath = path.join(runDir, "executor.yaml");

  if (!existsSync(resultPath)) {
    throw new Error(`missing result.yaml at ${resultPath}; run yarn setup first`);
  }

  const result = loadYamlFile(resultPath);

  if (Object.prototype.hasOwnProperty.call(result, "pass")) {
    throw new Error(`run already graded; runs are append-only, set up a new run instead`);
  }

  // Append-only applies to execution too: a second executor in the same workspace grades
  // as one run, and there is no way to tell afterwards which agent wrote what.
  if (existsSync(recordPath)) {
    throw new Error(`run already executed (${recordPath}); set up a new run instead`);
  }

  const workspacePath = readWorkspacePath(runDir);

  if (!existsSync(path.join(workspacePath, "TASK.md"))) {
    throw new Error(`no TASK.md in ${workspacePath}`);
  }

  const executor = parseExecutor(requireString(result.executor, "executor"));
  const prompt = await readFile(path.join(workspacePath, "TASK.md"), "utf8");
  // Resolved before executor.yaml exists, so a refused run leaves the run dir reusable. Both
  // land on argv and in the record: a benchmark whose runs straddle a change of either has
  // nothing else to say so.
  const model = resolveModel(executor, requestedModel, "--model");
  const reasoningEffort = resolveEffort(executor, requestedEffort, "--effort");
  const env = executor === "codex" ? codexEnv() : process.env;

  // Asked here, before the spawn, because runs are append-only: a model with no row in
  // lib/prices.ts records cost_usd: null permanently, and finding that out afterwards means a
  // whole run was spent to learn it. Not fatal — a run without a cost is still a run.
  if (executor === "codex" && !hasCodexPrice(model)) {
    console.warn(
      `run-executor: no list price for ${model ?? "codex's own default model"} in lib/prices.ts, so this run will record `
        + `cost_usd: null. Add its row from the pricing page first if the run needs a cost. Ctrl-C now; this run is about to start.`,
    );
  }
  const { file, args: commandArgs } = buildCommand(executor, model, reasoningEffort);
  const startedAt = Date.now();
  const record: ExecutorRecord = {
    executor,
    model,
    reasoning_effort: reasoningEffort,
    started: new Date(startedAt).toISOString(),
    finished: null,
    exit: null,
  };

  // Written before the spawn, finished only after the process exits: verify reads this to
  // refuse a workspace that is still being written to. A killed run leaves finished null
  // and stays ungradeable, which is the point — it is a dead run, not a zero score.
  await writeRecord(recordPath, record);

  // Both streams are captured raw and both are kept: both executors stream JSON events on
  // stdout and diagnostics on stderr, and a run that dies mid-way still leaves whatever it
  // had written.
  const outStream = createWriteStream(path.join(runDir, "transcript.jsonl"));
  const errStream = createWriteStream(path.join(runDir, "executor.err"));
  const chunks: string[] = [];
  const errors: string[] = [];

  console.log(`${executor} (${model} · ${reasoningEffort}) → ${workspacePath}`);

  const child = spawn(file, commandArgs, { cwd: workspacePath, env, stdio: ["pipe", "pipe", "pipe"] });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  // --json moves codex's session from stderr to stdout, which is captured to a file, so
  // without an echo the operator watches a blank terminal for twenty minutes and cannot tell
  // a wedged sandbox from a working agent. One line per event, on stderr, where codex's own
  // session log used to appear.
  let pending = "";
  const progress = (chunk: string) => {
    if (executor !== "codex") {
      return;
    }

    const lines = (pending + chunk).split("\n");

    pending = lines.pop() ?? "";

    for (const line of lines) {
      const summary = codexProgress(line);

      if (summary !== null) {
        process.stderr.write(`${summary}\n`);
      }
    }
  };

  child.stdout.on("data", (chunk: string) => {
    chunks.push(chunk);
    outStream.write(chunk);
    progress(chunk);
  });
  child.stderr.on("data", (chunk: string) => {
    errors.push(chunk);
    errStream.write(chunk);
    process.stderr.write(chunk);
  });
  // A child that dies before reading the prompt makes this write raise EPIPE. Unhandled,
  // that kills run-executor after executor.yaml already exists, and the "already executed"
  // guard then bricks the run dir. The exit code below is the report of what happened.
  child.stdin.on("error", () => {});
  child.stdin.end(prompt);

  // Ctrl-C overrides node's default handler, so without the flag the parent would survive
  // its child, stamp finished + exit 143, and hand verify a killed run that grades like a
  // real one. An interrupted run must stay ungradeable.
  let interrupted = false;
  const stop = () => {
    interrupted = true;
    child.kill("SIGTERM");
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const exit = await new Promise<number>(resolve => {
    // `error` resolves without waiting for `close`, so the stdio handlers can still be live
    // when the streams below are ended: a late chunk would then write after end and take
    // the process down after the run, leaving executor.yaml.finished null on a live run.
    // The message goes to errStream too, or executor.err and transcript.md disagree.
    child.on("error", error => {
      errors.push(error.message);
      errStream.write(error.message);
      child.stdout.destroy();
      child.stderr.destroy();
      resolve(127);
    });
    child.on("close", (code, signal) => resolve(code ?? (signal ? 143 : 1)));
  });

  // end() only queues the flush; process.exit below drops whatever is still buffered.
  outStream.end();
  errStream.end();
  await Promise.all([finished(outStream), finished(errStream)]);

  // Measured before the transcript is written, because codex's stats footer is built from it.
  // An interrupted run gets no footer, for the same reason its usage never reaches
  // executor.yaml below: half a session's tokens against a whole session's work reads as a
  // cheap run rather than a dead one, and run-stats reads the transcript first.
  const usage = buildUsage(executor, chunks.join(""), errors.join(""), Date.now() - startedAt, model);
  const transcript = buildTranscript(
    { run: requireString(result.run, "run"), executor, model, reasoningEffort, exit, workspacePath, usage: interrupted ? null : usage },
    chunks.join(""),
    errors.join(""),
  );

  await writeFile(path.join(runDir, "transcript.md"), transcript);

  if (interrupted) {
    console.error(`run-executor: interrupted; ${recordPath} keeps finished: null, so verify will refuse this run. Delete ${runDir} and set up a new one.`);
    process.exit(2);
  }

  // Usage is recorded only for a run that finished: an interrupted run returns above with
  // finished null, and half a session's tokens against a whole session's work would read
  // as a cheap run rather than a dead one.
  await writeRecord(recordPath, { ...record, finished: new Date().toISOString(), exit, usage });

  // Only a run that reported a token split and still has no cost: that is a missing price.
  // A run with no split at all (a codex launched by hand without --json) has nothing to price,
  // and telling its operator to add a pricing row would not have helped.
  if (executor === "codex" && usage.input_tokens !== null && usage.cost_source === null) {
    console.warn(`run-executor: no list price for codex model ${model} in lib/prices.ts; cost_usd recorded as null`);
  }

  // buildUsage always measures the clock, so duration_s is a number here; cost prints as
  // 1.7752330000000003 unless it is rounded to the cent.
  const basis = usage.cost_source === "list_price" ? " at list price" : "";
  const price = usage.cost_usd === null ? "" : ` ($${usage.cost_usd.toFixed(2)}${basis})`;
  const tokens = usage.total_tokens === null ? "" : `, ${usage.total_tokens} tokens`;

  console.log(`executor exited ${exit} in ${usage.duration_s}s${price}${tokens}; transcript at ${path.join(runDir, "transcript.md")}`);

  // A dead shell exits 0, so reporting the exit code alone hands the orchestrator a green
  // light and it launches the next run before verify ever looks. The stderr is already here
  // — say so here, at the same non-zero exit the loop already knows to stop on. verify
  // repeats the check because a run can also be executed by hand.
  const brokenShell = detectBrokenShell(runDir, executor);

  if (brokenShell !== null) {
    console.error(
      `run-executor: ${brokenShell.cause}, and it still exited ${exit}. `
        + `${brokenShell.capturePath}: "${brokenShell.evidence}". ${brokenShell.remedy}. `
        + `Delete ${runDir} and set up a new run.`,
    );
    process.exit(2);
  }

  process.exit(exit === 0 ? 0 : 2);
};

try {
  await main();
} catch (error) {
  console.error(`run-executor: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
