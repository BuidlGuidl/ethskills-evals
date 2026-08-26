import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import type { Executor, ExecutorRecord } from "../lib/types.js";

const ROOT = process.cwd();
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const RUN_ARGS = new Set(["run", "model"]);
const MAX_TOOL_INPUT_CHARS = 200;
const MAX_TOOL_RESULT_CHARS = 400;

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

  const args = ["exec", "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true"];

  if (model) {
    args.push("-m", model);
  }

  args.push("-");

  return { file: "codex", args };
};

const truncate = (value: string, limit: number) => {
  const collapsed = value.trimEnd();

  return collapsed.length > limit ? `${collapsed.slice(0, limit)} … [${collapsed.length - limit} more chars]` : collapsed;
};

const quoteBlock = (value: string) => value.split("\n").map(line => `  > ${line}`).join("\n");

const toolSummary = (input: unknown) => {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;

    for (const key of ["command", "file_path", "pattern", "url", "prompt"]) {
      if (typeof record[key] === "string") {
        return truncate(record[key] as string, MAX_TOOL_INPUT_CHARS);
      }
    }
  }

  return truncate(JSON.stringify(input ?? null), MAX_TOOL_INPUT_CHARS);
};

const resultText = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(item => (item && typeof item === "object" ? resultText((item as { text?: unknown }).text) : "")).join("\n");
  }

  return "";
};

// claude -p --output-format stream-json emits one JSON event per line. The rendered
// transcript keeps what a reader of the report needs — what the agent said, what it ran,
// what came back — and drops the rest; the raw jsonl sits beside it for anything else.
const renderClaudeTranscript = (raw: string) => {
  const sections: string[] = [];

  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    let event: Record<string, unknown>;

    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const message = event.message as { content?: unknown } | undefined;
    const blocks = Array.isArray(message?.content) ? message.content : [];

    if (event.type === "assistant") {
      const rendered: string[] = [];

      for (const block of blocks as Record<string, unknown>[]) {
        if (block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0) {
          rendered.push(block.text.trim());
        }

        if (block.type === "tool_use") {
          rendered.push(`- **${String(block.name)}** \`${toolSummary(block.input)}\``);
        }
      }

      if (rendered.length > 0) {
        sections.push(`## assistant\n${rendered.join("\n\n")}`);
      }
    }

    if (event.type === "user") {
      for (const block of blocks as Record<string, unknown>[]) {
        if (block.type === "tool_result") {
          const text = truncate(resultText(block.content), MAX_TOOL_RESULT_CHARS);

          if (text.length > 0) {
            sections.push(quoteBlock(text));
          }
        }
      }
    }

    if (event.type === "result") {
      const usage = (event.usage ?? {}) as Record<string, unknown>;

      sections.push([
        "## run stats",
        `- turns: ${String(event.num_turns ?? "?")}`,
        `- duration: ${Math.round(Number(event.duration_ms ?? 0) / 1000)}s`,
        `- cost: $${String(event.total_cost_usd ?? "?")}`,
        `- tokens in/out: ${String(usage.input_tokens ?? "?")}/${String(usage.output_tokens ?? "?")}`,
      ].join("\n"));
    }
  }

  return sections.join("\n\n");
};

const writeRecord = async (recordPath: string, record: ExecutorRecord) =>
  writeFile(recordPath, yaml.dump(record, { lineWidth: -1 }));

const main = async () => {
  const args = parseArgs(RUN_ARGS);
  const runDir = path.resolve(ROOT, requireString(args.run, "--run"));
  const model = args.model === undefined ? null : requireString(args.model, "--model");
  const resultPath = path.join(runDir, "result.yaml");
  const recordPath = path.join(runDir, "executor.yaml");
  const workspacePath = path.join(runDir, "workspace");

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

  if (!existsSync(path.join(workspacePath, "TASK.md"))) {
    throw new Error(`no TASK.md in ${workspacePath}`);
  }

  const executor = parseExecutor(requireString(result.executor, "executor"));
  const prompt = await readFile(path.join(workspacePath, "TASK.md"), "utf8");
  const { file, args: commandArgs } = buildCommand(executor, model);
  const record: ExecutorRecord = {
    executor,
    model,
    started: new Date().toISOString(),
    finished: null,
    exit: null,
  };

  // Written before the spawn, finished only after the process exits: verify reads this to
  // refuse a workspace that is still being written to. A killed run leaves finished null
  // and stays ungradeable, which is the point — it is a dead run, not a zero score.
  await writeRecord(recordPath, record);

  const rawPath = path.join(runDir, executor === "claude" ? "transcript.jsonl" : "transcript.log");
  const rawStream = createWriteStream(rawPath);
  const chunks: string[] = [];
  const errors: string[] = [];

  console.log(`${executor}${model ? ` (${model})` : ""} → ${workspacePath}`);

  const child = spawn(file, commandArgs, { cwd: workspacePath, stdio: ["pipe", "pipe", "pipe"] });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    chunks.push(chunk);
    rawStream.write(chunk);
  });
  child.stderr.on("data", (chunk: string) => {
    errors.push(chunk);
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
    child.on("error", error => {
      errors.push(error.message);
      resolve(127);
    });
    child.on("close", (code, signal) => resolve(code ?? (signal ? 143 : 1)));
  });

  rawStream.end();
  await once(rawStream, "finish");

  const raw = chunks.join("");
  const header = [
    `# Executor transcript — ${requireString(result.run, "run")}`,
    "",
    `**executor**: ${executor}  |  **model**: ${model ?? "cli default"}  |  **exit**: ${exit}`,
    `**workspace**: ${workspacePath}`,
  ].join("\n");
  const body = executor === "claude" ? renderClaudeTranscript(raw) : raw.trimEnd();

  await writeFile(path.join(runDir, "transcript.md"), `${header}\n\n${body}\n`);

  if (errors.length > 0) {
    await writeFile(path.join(runDir, "executor.err"), errors.join(""));
  }

  if (interrupted) {
    console.error(`run-executor: interrupted; ${recordPath} keeps finished: null, so verify will refuse this run. Delete ${runDir} and set up a new one.`);
    process.exit(2);
  }

  await writeRecord(recordPath, { ...record, finished: new Date().toISOString(), exit });

  console.log(`executor exited ${exit}; transcript at ${path.join(runDir, "transcript.md")}`);
  process.exit(exit === 0 ? 0 : 2);
};

try {
  await main();
} catch (error) {
  console.error(`run-executor: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
