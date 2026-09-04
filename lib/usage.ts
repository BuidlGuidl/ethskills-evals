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

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// null + null is null, not 0: a run whose event carried no token fields at all has to stay
// absent rather than report itself as having consumed nothing.
const sum = (values: (number | null)[]) =>
  values.every((value) => value === null) ? null : values.reduce((total: number, value) => total + (value ?? 0), 0);

export type ClaudeTokens = {
  input: number | null;
  cacheCreation: number | null;
  cacheRead: number | null;
  inputTotal: number | null;
  output: number | null;
  total: number | null;
};

// Claude Code caches the prompt, so `input_tokens` counts only what was neither written to
// nor read from the cache — single or double digits on every real run (6 to 306 across the
// 83 claude transcripts in artifacts/). The run's actual input is the two cache fields, and
// a skill's own context cost lands entirely in them, so a total that omits them cannot see
// the thing this harness exists to measure. All four are recorded: the breakdown is only
// available here, and result.yaml is append-only.
export const claudeTokens = (usage: Record<string, unknown>): ClaudeTokens => {
  const input = numberOrNull(usage.input_tokens);
  const cacheCreation = numberOrNull(usage.cache_creation_input_tokens);
  const cacheRead = numberOrNull(usage.cache_read_input_tokens);
  const output = numberOrNull(usage.output_tokens);

  return {
    input,
    cacheCreation,
    cacheRead,
    inputTotal: sum([input, cacheCreation, cacheRead]),
    output,
    total: sum([input, cacheCreation, cacheRead, output]),
  };
};

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

    const tokens = claudeTokens((event.usage ?? {}) as Record<string, unknown>);

    return {
      turns: numberOrNull(event.num_turns),
      cost_usd: numberOrNull(event.total_cost_usd),
      input_tokens: tokens.input,
      cache_creation_input_tokens: tokens.cacheCreation,
      cache_read_input_tokens: tokens.cacheRead,
      output_tokens: tokens.output,
      total_tokens: tokens.total,
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
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    output_tokens: null,
    total_tokens: toNumber(last[1]),
  };
};

// Duration is the harness's own measurement rather than the executor's, because it is the
// one figure both stacks can be compared on: claude reports duration_ms and a dollar cost,
// codex reports a token total and nothing else. A report that wants dollars for codex has
// to derive them from tokens and a published price, and should say so. The token totals are
// NOT comparable across stacks — claude's counts every cache read, codex's line is its own
// accounting and prints a fraction of the figure for comparable work — so compare tokens
// within a stack, between variants.
export const buildUsage = (executor: Executor, stdout: string, stderr: string, durationMs: number): RunUsage => {
  const parsed = executor === "claude" ? parseClaudeUsage(stdout) : parseCodexUsage(stderr);

  return {
    duration_s: Math.round(durationMs / 1000),
    turns: parsed?.turns ?? null,
    cost_usd: parsed?.cost_usd ?? null,
    input_tokens: parsed?.input_tokens ?? null,
    cache_creation_input_tokens: parsed?.cache_creation_input_tokens ?? null,
    cache_read_input_tokens: parsed?.cache_read_input_tokens ?? null,
    output_tokens: parsed?.output_tokens ?? null,
    total_tokens: parsed?.total_tokens ?? null,
  };
};

// Runs made before usage existed have no such block, and their executor.yaml is not going
// to grow one — runs are append-only. Absent stays absent rather than becoming a row of
// zeros, which would read as a free run in a table beside real numbers. That holds field by
// field too: a hand-edited block missing duration_s reads as unmeasured, not as instant.
export const parseUsageRecord = (value: unknown): RunUsage | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    duration_s: numberOrNull(value.duration_s),
    turns: numberOrNull(value.turns),
    cost_usd: numberOrNull(value.cost_usd),
    input_tokens: numberOrNull(value.input_tokens),
    cache_creation_input_tokens: numberOrNull(value.cache_creation_input_tokens),
    cache_read_input_tokens: numberOrNull(value.cache_read_input_tokens),
    output_tokens: numberOrNull(value.output_tokens),
    total_tokens: numberOrNull(value.total_tokens),
  };
};

// A transcript records its run stats one of two ways. Current runs carry the "## run stats"
// footer transcript.ts writes; the 147 runs made before that footer existed carry the raw
// result event instead, under different labels in a "## result" block. Both are the same
// claude result event, so both are readable — and a cost table that only knew the footer
// reported "no footer" for runs whose cost was sitting in the committed transcript.
const readMatch = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);

  return match === null ? null : toNumber(match[1]);
};

const parseFooter = (text: string) => {
  if (!/^## run stats$/m.test(text)) {
    return null;
  }

  // in/out is the three-way input sum and the output, the same pair claudeTokens returns;
  // "?" is what the footer prints for a field the result event did not carry.
  const inputTotal = readMatch(text, /^- tokens in\/out: (\d+)\/\d+$/m);
  const output = readMatch(text, /^- tokens in\/out: \d+\/(\d+)$/m);

  return {
    duration_s: readMatch(text, /^- duration: (\d+)s$/m),
    turns: readMatch(text, /^- turns: (\d+)$/m),
    cost_usd: readMatch(text, /^- cost: \$([\d.]+)$/m),
    input_tokens: null,
    cache_creation_input_tokens: readMatch(text, /^- of which cache write\/read: (\d+)\/\d+$/m),
    cache_read_input_tokens: readMatch(text, /^- of which cache write\/read: \d+\/(\d+)$/m),
    output_tokens: output,
    total_tokens: sum([inputTotal, output]),
  };
};

const parseResultBlock = (text: string) => {
  // No /m: the block runs to the next heading or to the end of the file, and a multiline `$`
  // would end it at the first line break instead.
  const block = text.match(/(?:^|\n)## result\n([\s\S]*?)(?=\n#{1,3} |$)/);

  if (block === null) {
    return null;
  }

  const body = block[1];
  const usageLine = body.match(/^usage: (\{.*)$/m);
  let tokens: ClaudeTokens = { input: null, cacheCreation: null, cacheRead: null, inputTotal: null, output: null, total: null };

  if (usageLine !== null) {
    try {
      tokens = claudeTokens(JSON.parse(usageLine[1]) as Record<string, unknown>);
    } catch {
      // A truncated or malformed line leaves the token fields absent, not zero.
    }
  }

  const durationMs = readMatch(body, /^duration_ms: (\d+)$/m);

  return {
    duration_s: durationMs === null ? null : Math.round(durationMs / 1000),
    turns: readMatch(body, /^num_turns: (\d+)$/m),
    cost_usd: readMatch(body, /^total_cost_usd: ([\d.]+)$/m),
    input_tokens: tokens.input,
    cache_creation_input_tokens: tokens.cacheCreation,
    cache_read_input_tokens: tokens.cacheRead,
    output_tokens: tokens.output,
    total_tokens: tokens.total,
  };
};

export const parseTranscriptStats = (text: string): RunUsage | null => parseFooter(text) ?? parseResultBlock(text);
