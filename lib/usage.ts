import { codexListPrice } from "./prices.js";
import { isRecord } from "./task.js";
import type { CostSource, Executor, RunUsage } from "./types.js";

// Thousands separators seen from codex across versions and locales: comma (0.146.1),
// narrow no-break space (the 2026-08-13 codex runs in artifacts/), plus the ordinary
// and non-breaking spaces the same formatter reaches for elsewhere. Strip them all
// before Number(), or "60 128" parses as 60. Written as escapes on purpose: the literal
// characters are invisible in a diff, and any pass that normalizes whitespace would silently
// drop them from the class and bring that bug back.
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
// how it is billed — codexUsageWarnings checks both assumptions against each event rather
// than trusting them silently.
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

// Field by field, null when there is nothing to add up — a run that died before its first
// usage event has no usage, not zero usage.
const sumTokens = (parts: RunTokens[]): RunTokens | null => {
  if (parts.length === 0) {
    return null;
  }

  const add = (key: keyof RunTokens) => sum(parts.map(part => part[key]));

  return {
    input: add("input"),
    cacheCreation: add("cacheCreation"),
    cacheRead: add("cacheRead"),
    inputTotal: add("inputTotal"),
    output: add("output"),
    total: add("total"),
  };
};

// The three ways codex's usage event could mean something other than what codexTokens reads
// it as. Each one would move dollars — the cache rates are a tenth of fresh input, and output
// is the dearest rate in the table — and each is silent otherwise, so a run says so out loud
// instead of recording a confident wrong number.
export const codexUsageWarnings = (usage: Record<string, unknown>): string[] => {
  const warnings: string[] = [];
  const prompt = numberOrNull(usage.input_tokens);
  const cacheRead = numberOrNull(usage.cached_input_tokens) ?? 0;
  const cacheCreation = numberOrNull(usage.cache_write_input_tokens) ?? 0;
  const output = numberOrNull(usage.output_tokens);
  const reasoning = numberOrNull(usage.reasoning_output_tokens);
  // codex has not carried this field on any observed event; if a version starts to, it is a
  // free check on the arithmetic below.
  const reported = numberOrNull(usage.total_tokens);

  if (prompt !== null && prompt - cacheRead - cacheCreation < 0) {
    warnings.push(
      `codex reported cached (${cacheRead}) + cache write (${cacheCreation}) above input_tokens (${prompt}), `
        + `so the cache fields are not parts of the prompt as assumed; uncached input was clamped to 0 and the cost is understated`,
    );
  }

  if (reasoning !== null && output !== null && reasoning > output) {
    warnings.push(
      `codex reported reasoning_output_tokens (${reasoning}) above output_tokens (${output}), `
        + `so output does not include reasoning as assumed and the cost is understated`,
    );
  }

  if (reported !== null && prompt !== null && output !== null && reported !== prompt + output) {
    warnings.push(`codex reported total_tokens ${reported}, but input + output is ${prompt + output}`);
  }

  return warnings;
};

// `codex exec --json` closes every turn with a turn.completed event carrying that turn's
// usage. Verified per-turn rather than cumulative on codex-cli 0.150.1 (2026-09-16): a
// resumed second turn reported its own 5 output tokens, not the session's 10. An exec session
// is normally one turn either way, so the turns are summed. null when no turn completed — a
// run that died mid-turn has no usage, not zero usage.
export const codexRunTokens = (stdout: string): RunTokens | null => {
  const usages = jsonEvents(stdout).events
    .filter(event => event.type === "turn.completed" && isRecord(event.usage))
    .map(event => event.usage as Record<string, unknown>);

  for (const usage of usages) {
    for (const warning of codexUsageWarnings(usage)) {
      console.warn(`usage: ${warning}`);
    }
  }

  return sumTokens(usages.map(codexTokens));
};

// opencode's tokens come in claude's shape already: input is the uncached remainder and the
// cache split sits beside it under cache.write / cache.read. reasoning is reported apart from
// output and billed as output (OpenRouter counts it inside max_tokens), so it is folded in —
// which is also the unit codex's output_tokens is in.
export const opencodeTokens = (tokens: Record<string, unknown>): RunTokens => {
  const cache = isRecord(tokens.cache) ? tokens.cache : {};
  const input = numberOrNull(tokens.input);
  const cacheCreation = numberOrNull(cache.write);
  const cacheRead = numberOrNull(cache.read);
  const output = sum([numberOrNull(tokens.output), numberOrNull(tokens.reasoning)]);

  return {
    input,
    cacheCreation,
    cacheRead,
    inputTotal: sum([input, cacheCreation, cacheRead]),
    output,
    total: sum([input, cacheCreation, cacheRead, output]),
  };
};

// `opencode run --format json` closes every model call with a step_finish event whose part
// carries that step's own tokens and the price opencode put on them (per step, not
// cumulative — checked against the arena fixture, where the second step's input is the
// first step's cache read). A run is many steps, one per tool round, so they are summed.
const opencodeSteps = (stdout: string) =>
  jsonEvents(stdout).events
    .filter(event => event.type === "step_finish" && isRecord(event.part))
    .map(event => event.part as Record<string, unknown>);

const opencodeStepTokens = (steps: Record<string, unknown>[]): RunTokens | null =>
  sumTokens(steps.filter(part => isRecord(part.tokens)).map(part => opencodeTokens(part.tokens as Record<string, unknown>)));

// opencode prices each step itself, from the catalog's list price for the model that ran. A
// login it cannot price — a subscription, a local model, a free OpenRouter route — reports 0
// on every step, which is "no price", not a free run; so a sum that rounds to zero records
// null. Rounded to a millionth, the precision claude reports at: the raw sum of ten-decimal
// step costs prints as 0.0019204327000000001.
const opencodeStepCost = (steps: Record<string, unknown>[]): number | null => {
  const total = steps.reduce((sum, part) => sum + (numberOrNull(part.cost) ?? 0), 0);
  const rounded = Math.round(total * 1_000_000) / 1_000_000;

  return rounded > 0 ? rounded : null;
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

// An opencode step is one model call — a tool round, the same thing claude counts as a turn.
// A step that errors or aborts emits no step_finish, so it is in none of these figures.
const parseOpencodeUsage = (stdout: string) => {
  const steps = opencodeSteps(stdout);
  const tokens = opencodeStepTokens(steps);

  if (tokens === null) {
    return null;
  }

  const cost = opencodeStepCost(steps);

  return {
    turns: steps.length,
    cost_usd: cost,
    cost_source: sourceOf(cost, "executor"),
    input_tokens: tokens.input,
    cache_creation_input_tokens: tokens.cacheCreation,
    cache_read_input_tokens: tokens.cacheRead,
    output_tokens: tokens.output,
    total_tokens: tokens.total,
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
// one figure every stack measures the same way. Tokens share a shape too, and cost is in
// dollars everywhere — but claude's and opencode's is the price the CLI reports and codex's
// is derived from a list price for `model` (lib/prices.ts), which is why cost_source is
// recorded beside it. `model`
// is required rather than defaulted: a codex call that forgets it silently loses the cost.
export const buildUsage = (
  executor: Executor,
  stdout: string,
  stderr: string,
  durationMs: number,
  model: string | null,
): RunUsage => {
  const parsed = executor === "claude"
    ? parseClaudeUsage(stdout)
    : executor === "opencode"
      ? parseOpencodeUsage(stdout)
      : parseCodexUsage(stdout, stderr, model);

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

// "?" is what the footer prints for a field the run did not report, and codex leaves the
// cache-write side of a pair unset routinely. Reading each side on its own keeps the other
// one: requiring digits on both dropped total_tokens — the number the whole cost table is
// built on — from any run with a "?" beside it.
const readPair = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  const side = (value: string | undefined) => (value === undefined || value === "?" ? null : toNumber(value));

  return match === null ? [null, null] as const : [side(match[1]), side(match[2])] as const;
};

const parseFooter = (text: string) => {
  // The LAST footer, and only as far as the next heading. A transcript's agent prose is
  // rendered above the footer verbatim, so a run that writes "- cost: $99.99" in its own
  // summary would otherwise have that read back as the recorded cost — and on codex the
  // sections after the footer ("## stdout", "## stderr") hold the run's own output too.
  const headings = [...text.matchAll(/^## run stats$/gm)];
  const last = headings.at(-1);

  if (last === undefined || last.index === undefined) {
    return null;
  }

  const rest = text.slice(last.index + last[0].length);
  const next = rest.search(/\n#{1,3} /);
  const footer = next === -1 ? rest : rest.slice(0, next);

  // in/out is the three-way input sum and the output, the same pair claudeTokens returns.
  const [inputTotal, output] = readPair(footer, /^- tokens in\/out: (\d+|\?)\/(\d+|\?)$/m);
  const [cacheCreation, cacheRead] = readPair(footer, /^- of which cache write\/read: (\d+|\?)\/(\d+|\?)$/m);
  const cost = readMatch(footer, /^- cost: \$([\d.]+)$/m);
  // An explicit line where the footer writes one (opencode); otherwise only codex footers
  // carry a cost basis line, and a claude footer's cost is claude's own.
  const explicit = footer.match(/^- cost source: (executor|list_price)$/m);
  const source = explicit !== null ? (explicit[1] as CostSource) : /^- cost basis: list price/m.test(footer) ? "list_price" : "executor";

  return {
    duration_s: readMatch(footer, /^- duration: (\d+)s$/m),
    turns: readMatch(footer, /^- turns: (\d+)$/m),
    cost_usd: cost,
    cost_source: sourceOf(cost, source),
    input_tokens: null,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: cacheRead,
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
