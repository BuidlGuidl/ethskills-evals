import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import yaml from "js-yaml";
import { loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import { buildTranscript } from "../lib/transcript.js";
import { buildUsage } from "../lib/usage.js";
import type { Executor, ExecutorRecord } from "../lib/types.js";
import { readWorkspacePath } from "../lib/workspace.js";

const ROOT = process.cwd();
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const RUN_ARGS = new Set(["run", "model"]);

const parseExecutor = (value: string): Executor => {
  if (!EXECUTORS.has(value as Executor)) {
    throw new Error(`unknown executor in result.yaml: ${value}`);
  }

  return value as Executor;
};

// `--setting-sources project` is load-bearing for claude: user-level config crowds the
// skill listing and skills stop triggering. For codex the model comes from
// ~/.codex/config.toml unless -m overrides it, and the network flag is load-bearing too:
// workspace-write blocks network by default, so without it every live-data task fails for
// the wrong reason. Both take the prompt on stdin — TASK.md can outgrow the argv limit.
const buildCommand = (executor: Executor, model: string | null) => {
  if (executor === "claude") {
    const args = ["-u", "ANTHROPIC_API_KEY", "-u", "ANTHROPIC_AUTH_TOKEN", "claude", "-p"];

    if (model) {
      args.push("--model", model);
    }

    args.push(
      "--setting-sources", "project",
      "--dangerously-skip-permissions",
      "--strict-mcp-config",
      "--output-format", "stream-json",
      "--verbose",
    );

    return { file: "env", args };
  }

  // --disable shell_snapshot for the same reason claude gets --setting-sources project: the
  // executor's shell must not be the operator's. codex otherwise snapshots the interactive
  // shell's functions and aliases and sources that into every command, so whatever is in the
  // operator's rc files rides into the run — and a single unparseable line in it takes the
  // whole shell down. Seen on 2026-08-27: a snapshot that failed to re-parse ("syntax error
  // near unexpected token `('", from extglob patterns `declare -f` dumps without the shopt
  // that made them legal) left a with_skill run unable to read its own installed skill, which
  // grades as a skill that did not help rather than as a broken run.
  const args = ["exec", "--disable", "shell_snapshot", "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true"];

  if (model) {
    args.push("-m", model);
  }

  args.push("-");

  return { file: "codex", args };
};

const writeRecord = async (recordPath: string, record: ExecutorRecord) =>
  writeFile(recordPath, yaml.dump(record, { lineWidth: -1 }));

const main = async () => {
  const args = parseArgs(RUN_ARGS);
  const runDir = path.resolve(ROOT, requireString(args.run, "--run"));
  const model = args.model === undefined ? null : requireString(args.model, "--model");
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
  const { file, args: commandArgs } = buildCommand(executor, model);
  const startedAt = Date.now();
  const record: ExecutorRecord = {
    executor,
    model,
    started: new Date(startedAt).toISOString(),
    finished: null,
    exit: null,
  };

  // Written before the spawn, finished only after the process exits: verify reads this to
  // refuse a workspace that is still being written to. A killed run leaves finished null
  // and stays ungradeable, which is the point — it is a dead run, not a zero score.
  await writeRecord(recordPath, record);

  // Both streams are captured raw and both are kept: which one carries the transcript is
  // the executor's business (claude puts everything on stdout, codex on stderr), and a run
  // that dies mid-way still leaves whatever it had written.
  const outStream = createWriteStream(path.join(runDir, executor === "claude" ? "transcript.jsonl" : "transcript.log"));
  const errStream = createWriteStream(path.join(runDir, "executor.err"));
  const chunks: string[] = [];
  const errors: string[] = [];

  console.log(`${executor}${model ? ` (${model})` : ""} → ${workspacePath}`);

  const child = spawn(file, commandArgs, { cwd: workspacePath, stdio: ["pipe", "pipe", "pipe"] });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    chunks.push(chunk);
    outStream.write(chunk);
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

  const transcript = buildTranscript(
    { run: requireString(result.run, "run"), executor, model, exit, workspacePath },
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
  const usage = buildUsage(executor, chunks.join(""), errors.join(""), Date.now() - startedAt);

  await writeRecord(recordPath, { ...record, finished: new Date().toISOString(), exit, usage });

  // buildUsage always measures the clock, so duration_s is a number here; cost is claude's
  // own float and prints as 1.7752330000000003 unless it is rounded to the cent.
  const price = usage.cost_usd === null ? "" : ` ($${usage.cost_usd.toFixed(2)})`;
  const tokens = usage.total_tokens === null ? "" : `, ${usage.total_tokens} tokens`;

  console.log(`executor exited ${exit} in ${usage.duration_s}s${price}${tokens}; transcript at ${path.join(runDir, "transcript.md")}`);
  process.exit(exit === 0 ? 0 : 2);
};

try {
  await main();
} catch (error) {
  console.error(`run-executor: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
