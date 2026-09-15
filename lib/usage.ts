import { codexListPrice } from "./prices.js";
import { isRecord } from "./task.js";
import type { CostSource, Executor, RunUsage } from "./types.js";

// Thousands separators seen from codex across versions and locales: comma (0.146.1),
// narrow no-break space (the 2026-08-13 codex runs in artifacts/), plus the ordinary
// and non-breaking spaces the same formatter reaches for elsewhere. Strip them all
// before Number(), or "60 128" parses as 60.
const SEPARATORS = /[,    ]/g;

const toNumber = (raw: string) => {
  const value = Number(raw.replace(SEPARATORS, ""));

  return Number.isFinite(value) ? value : null;
};

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// null + null is null, not 0: a run whose event carried no token fields at all has to stay
// absent rather than report itself as having consumed nothing.
const sum = (values: (number | null)[]) =>
  values.every((value) => value === null) ? null : values.reduce((total: number, value) => total + (value ?? 0), 0);

// Both executors stream JSON lines on stdout. A line that is not a JSON object — a crash
// message, a CLI that ignored the flag — is not an event, and is returned apart so a renderer
// can still show it.
export const jsonEvents = (raw: string) => {
  const events: Record<string, unknown>[] = [];
  const unparsed: string[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    try {
      const event: unknown = JSON.parse(trimmed);

      if (isRecord(event)) {
        events.push(event);
        continue;
      }
    } catch {
      // falls through to unparsed
    }

    unparsed.push(line);
  }

  return { events, unparsed };
};

export type RunTokens = {
  input: number | null;
  cacheCreation: number | null;
  cacheRead: number | null;
  inputTotal: number | null;
  output: number | null;
  total: number | null;
};

// Kept under its old name: transcript.ts and the pre-footer parser below both read claude's
// usage object through it.
export type ClaudeTokens = RunTokens;

// Claude Code caches the prompt, so `input_tokens` counts only what was neither written to
// nor read from the cache — single or double digits on every real run (6 to 306 across the
// 83 claude transcripts in artifacts/). The run's actual input is the two cache fields, and
// a skill's own context cost lands entirely in them, so a total that omits them cannot see
// the thing this harness exists to measure. All four are recorded: the breakdown is only
// available here, and result.yaml is append-only.
export const claudeTokens = (usage: Record<string, unknown>): RunTokens => {
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

// codex uses OpenAI's convention, the other way round from claude's: input_tokens is the
// whole prompt, and cached_input_tokens and cache_write_input_tokens are parts of it. Re-cut
// into claude's shape so input_tokens means "uncached remainder" in every result.yaml. No
// reasoning field: output_tokens already includes reasoning_output_tokens, and that is also
// how it is billed.
export const codexTokens = (usage: Record<string, unknown>): RunTokens => {
  const prompt = numberOrNull(usage.input_tokens);
  const cacheRead = numberOrNull(usage.cached_input_tokens);
  const cacheCreation = numberOrNull(usage.cache_write_input_tokens);
  const output = numberOrNull(usage.output_tokens);

  return {
    input: prompt === null ? null : Math.max(0, prompt - (cacheRead ?? 0) - (cacheCreation ?? 0)),
    cacheCreation,
    cacheRead,
    inputTotal: prompt,
    output,
    total: sum([prompt, output]),
  };
};

// `codex exec --json` closes every turn with a turn.completed event carrying that turn's
// usage. An exec session is normally one turn, but nothing promises it, so the turns are
// summed field by field. null when no turn completed — a run that died mid-turn has no usage,
// not zero usage.
export const codexRunTokens = (stdout: string): RunTokens | null => {
  const turns = jsonEvents(stdout).events
    .filter(event => event.type === "turn.completed" && isRecord(event.usage))
    .map(event => codexTokens(event.usage as Record<string, unknown>));

  if (turns.length === 0) {
    return null;
  }

  const add = (key: keyof RunTokens) => sum(turns.map(turn => turn[key]));

  return {
    input: add("input"),
    cacheCreation: add("cacheCreation"),
    cacheRead: add("cacheRead"),
    inputTotal: add("inputTotal"),
    output: add("output"),
    total: add("total"),
  };
};

export const codexCost = (model: string | null, tokens: RunTokens) =>
  tokens.total === null
    ? null
    : codexListPrice(model, {
      uncachedInput: tokens.input ?? 0,
      cacheWrite: tokens.cacheCreation ?? 0,
      cacheRead: tokens.cacheRead ?? 0,
      output: tokens.output ?? 0,
    });

const sourceOf = (cost: number | null, source: CostSource): CostSource | null => (cost === null ? null : source);

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
    const cost = numberOrNull(event.total_cost_usd);

    return {
      turns: numberOrNull(event.num_turns),
      cost_usd: cost,
      cost_source: sourceOf(cost, "executor"),
      input_tokens: tokens.input,
      cache_creation_input_tokens: tokens.cacheCreation,
      cache_read_input_tokens: tokens.cacheRead,
      output_tokens: tokens.output,
      total_tokens: tokens.total,
    };
  }

  return null;
};

// Before `--json`, codex exec printed one "tokens used" line at the end of the session log
// on stderr, and nothing else about the run: no price, no turn count, no input/output split.
// The number is uncached input plus output. Kept so a capture from a codex launched by hand
// without the flag still records what it can. Last match wins — a run that hits its context
// limit prints the line more than once.
const parseCodexLogUsage = (sessionLog: string) => {
  const matches = [...sessionLog.matchAll(/tokens used[:\s]*\n?\s*([\d,    ]*\d)/g)];
  const last = matches.at(-1);

  if (last === undefined) {
    return null;
  }

  return {
    turns: null,
    cost_usd: null,
    cost_source: null,
    input_tokens: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    output_tokens: null,
    total_tokens: toNumber(last[1]),
  };
};

// No turn count: a codex "turn" is one user prompt, always 1 in exec, which is not the unit
// claude's num_turns counts.
const parseCodexUsage = (stdout: string, stderr: string, model: string | null) => {
  const tokens = codexRunTokens(stdout);

  if (tokens === null) {
    return parseCodexLogUsage(stderr);
  }

  const cost = codexCost(model, tokens);

  return {
    turns: null,
    cost_usd: cost,
    cost_source: sourceOf(cost, "list_price"),
    input_tokens: tokens.input,
    cache_creation_input_tokens: tokens.cacheCreation,
    cache_read_input_tokens: tokens.cacheRead,
    output_tokens: tokens.output,
    total_tokens: tokens.total,
  };
};

// Duration is the harness's own measurement rather than the executor's, because it is the
// one figure both stacks measure the same way. Tokens now share a shape too, and cost is in
// dollars on both — but claude's is the price it reports and codex's is derived from a list
// price for `model` (lib/prices.ts), which is why cost_source is recorded beside it.
export const buildUsage = (
  executor: Executor,
  stdout: string,
  stderr: string,
  durationMs: number,
  model: string | null = null,
): RunUsage => {
  const parsed = executor === "claude" ? parseClaudeUsage(stdout) : parseCodexUsage(stdout, stderr, model);

  return {
    duration_s: Math.round(durationMs / 1000),
    turns: parsed?.turns ?? null,
    cost_usd: parsed?.cost_usd ?? null,
    cost_source: parsed?.cost_source ?? null,
    input_tokens: parsed?.input_tokens ?? null,
    cache_creation_input_tokens: parsed?.cache_creation_input_tokens ?? null,
    cache_read_input_tokens: parsed?.cache_read_input_tokens ?? null,
    output_tokens: parsed?.output_tokens ?? null,
    total_tokens: parsed?.total_tokens ?? null,
  };
};

const parseCostSource = (value: unknown, cost: number | null): CostSource | null => {
  if (value === "executor" || value === "list_price") {
    return value;
  }

  // A record written before cost_source existed: only claude could put a cost in it then.
  return sourceOf(cost, "executor");
};

// Runs made before usage existed have no such block, and their executor.yaml is not going
// to grow one — runs are append-only. Absent stays absent rather than becoming a row of
// zeros, which would read as a free run in a table beside real numbers. That holds field by
// field too: a hand-edited block missing duration_s reads as unmeasured, not as instant.
export const parseUsageRecord = (value: unknown): RunUsage | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const cost = numberOrNull(value.cost_usd);

  return {
    duration_s: numberOrNull(value.duration_s),
    turns: numberOrNull(value.turns),
    cost_usd: cost,
    cost_source: parseCostSource(value.cost_source, cost),
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
  const cost = readMatch(text, /^- cost: \$([\d.]+)$/m);
  // Only codex footers carry a cost basis line; a claude footer's cost is claude's own.
  const source = /^- cost basis: list price/m.test(text) ? "list_price" : "executor";

  return {
    duration_s: readMatch(text, /^- duration: (\d+)s$/m),
    turns: readMatch(text, /^- turns: (\d+)$/m),
    cost_usd: cost,
    cost_source: sourceOf(cost, source),
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
  let tokens: RunTokens = { input: null, cacheCreation: null, cacheRead: null, inputTotal: null, output: null, total: null };

  if (usageLine !== null) {
    try {
      tokens = claudeTokens(JSON.parse(usageLine[1]) as Record<string, unknown>);
    } catch {
      // A truncated or malformed line leaves the token fields absent, not zero.
    }
  }

  const durationMs = readMatch(body, /^duration_ms: (\d+)$/m);
  const cost = readMatch(body, /^total_cost_usd: ([\d.]+)$/m);

  return {
    duration_s: durationMs === null ? null : Math.round(durationMs / 1000),
    turns: readMatch(body, /^num_turns: (\d+)$/m),
    cost_usd: cost,
    cost_source: sourceOf(cost, "executor"),
    input_tokens: tokens.input,
    cache_creation_input_tokens: tokens.cacheCreation,
    cache_read_input_tokens: tokens.cacheRead,
    output_tokens: tokens.output,
    total_tokens: tokens.total,
  };
};

export const parseTranscriptStats = (text: string): RunUsage | null => parseFooter(text) ?? parseResultBlock(text);
