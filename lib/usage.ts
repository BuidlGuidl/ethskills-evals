import { isRecord } from "./task.js";
import type { Executor, RunUsage } from "./types.js";

// Thousands separators seen from codex across versions and locales: comma (0.146.1),
// narrow no-break space (the 2026-08-13 codex runs in artifacts/), plus the ordinary
// and non-breaking spaces the same formatter reaches for elsewhere. Strip them all
// before Number(), or "60 128" parses as 60.
const SEPARATORS = /[,\u0020\u00a0\u2009\u202f]/g;

const toNumber = (raw: string) => {
  const value = Number(raw.replace(SEPARATORS, ""));

  return Number.isFinite(value) ? value : null;
};

const sum = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

// claude streams one `result` event at the end of the session carrying the whole run's
// accounting. It is the same event transcript.ts renders as "## run stats", read here
// from the raw capture so the numbers reach result.yaml instead of only the prose.
const parseClaudeUsage = (stdout: string) => {
  for (const line of stdout.split("\n").reverse()) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || !trimmed.startsWith("{")) {
      continue;
    }

    let event: Record<string, unknown>;

    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (event.type !== "result") {
      continue;
    }

    const usage = (event.usage ?? {}) as Record<string, unknown>;
    const input = typeof usage.input_tokens === "number" ? usage.input_tokens : null;
    const output = typeof usage.output_tokens === "number" ? usage.output_tokens : null;

    return {
      turns: typeof event.num_turns === "number" ? event.num_turns : null,
      cost_usd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : null,
      input_tokens: input,
      output_tokens: output,
      total_tokens: sum(input, output),
    };
  }

  return null;
};

// codex exec prints one "tokens used" line at the end of the session log, and nothing
// else about the run: no price, no turn count, no input/output split. Last match wins —
// a run that hits its context limit prints the line more than once.
const parseCodexUsage = (sessionLog: string) => {
  const matches = [...sessionLog.matchAll(/tokens used[:\s]*\n?\s*([\d,\u0020\u00a0\u2009\u202f]*\d)/g)];
  const last = matches.at(-1);

  if (last === undefined) {
    return null;
  }

  return {
    turns: null,
    cost_usd: null,
    input_tokens: null,
    output_tokens: null,
    total_tokens: toNumber(last[1]),
  };
};

// Duration is the harness's own measurement rather than the executor's, because it is the
// one figure both stacks can be compared on: claude reports duration_ms and a dollar cost,
// codex reports a token total and nothing else. A report that wants dollars for codex has
// to derive them from tokens and a published price, and should say so.
export const buildUsage = (executor: Executor, stdout: string, stderr: string, durationMs: number): RunUsage => {
  const parsed = executor === "claude" ? parseClaudeUsage(stdout) : parseCodexUsage(stderr);

  return {
    duration_s: Math.round(durationMs / 1000),
    turns: parsed?.turns ?? null,
    cost_usd: parsed?.cost_usd ?? null,
    input_tokens: parsed?.input_tokens ?? null,
    output_tokens: parsed?.output_tokens ?? null,
    total_tokens: parsed?.total_tokens ?? null,
  };
};

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// Runs made before usage existed have no such block, and their executor.yaml is not going
// to grow one — runs are append-only. Absent stays absent rather than becoming a row of
// zeros, which would read as a free run in a table beside real numbers.
export const parseUsageRecord = (value: unknown): RunUsage | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    duration_s: numberOrNull(value.duration_s) ?? 0,
    turns: numberOrNull(value.turns),
    cost_usd: numberOrNull(value.cost_usd),
    input_tokens: numberOrNull(value.input_tokens),
    output_tokens: numberOrNull(value.output_tokens),
    total_tokens: numberOrNull(value.total_tokens),
  };
};
