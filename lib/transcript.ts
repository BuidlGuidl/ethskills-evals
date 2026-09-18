import { PRICES_CHECKED, PRICES_SOURCE } from "./prices.js";
import { claudeTokens, jsonEvents } from "./usage.js";
import type { Executor, RunUsage } from "./types.js";

const MAX_TOOL_INPUT_CHARS = 200;
const MAX_TOOL_RESULT_CHARS = 400;

type TranscriptHeader = {
  run: string;
  executor: Executor;
  model: string;
  reasoningEffort: string;
  exit: number;
  workspacePath: string;
  // The harness's usage record, which is where codex's footer gets its duration and its
  // derived cost — codex reports neither. null for a run with no usage to report: an
  // interrupted one, whose partial tokens beside a whole session's work would read as a
  // cheap run rather than a dead one. claude's footer comes from its own result event.
  usage: RunUsage | null;
};

// Executor output carries whatever the tools it ran printed. One NUL from a `tsc` banner made
// git call a transcript binary (#133), so every piece of text is cleaned where it enters a
// renderer, before `truncate` and `fence` measure it: CRLF becomes LF and a line keeps only
// its last carriage-return frame, as a terminal would show it (a `\r` with nothing after it
// moves the cursor and erases nothing); then CSI, single-line OSC and other ESC sequences go;
// then every C0 control and DEL except newline and tab.
const ESCAPE_SEQUENCE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b\n]*(?:\x07|\x1b\\)|\x1b[ -/]*[0-~]/g;
const CONTROL_BYTE = /[\x00-\x08\x0b-\x1f\x7f]/g;

export const stripControlBytes = (value: string) => value
  .replace(/\r\n/g, "\n")
  .split("\n").map(line => line.replace(/\r+$/, "")).map(line => line.slice(line.lastIndexOf("\r") + 1)).join("\n")
  .replace(ESCAPE_SEQUENCE, "").replace(CONTROL_BYTE, "");

const truncate = (value: string, limit: number) => {
  value = stripControlBytes(value);
  const collapsed = value.trimEnd();

  return collapsed.length > limit ? `${collapsed.slice(0, limit)} … [${collapsed.length - limit} more chars]` : collapsed;
};

const quoteBlock = (value: string) => value.split("\n").map(line => `  > ${line}`).join("\n");

// A session log carries code blocks of its own, so a three-backtick fence would end early
// and the rest of the run would render as prose.
const fence = (value: string) => {
  value = stripControlBytes(value);
  const longest = (value.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const ticks = "`".repeat(Math.max(3, longest + 1));

  return `${ticks}text\n${value.trimEnd()}\n${ticks}`;
};

const toolSummary = (input: unknown) => {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;

    // filePath is opencode's spelling (read, edit, write); the rest are claude's and codex's.
    for (const key of ["command", "file_path", "filePath", "pattern", "url", "prompt", "query"]) {
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

type FooterStats = {
  turns: number | null;
  duration_s: number | null;
  cost_usd: number | null;
  // codex only: what kind of dollars those are. A claude cost is claude's own, and its
  // absence from the footer is what tells the parser so.
  costBasis: string | null;
  inputTotal: number | null;
  output: number | null;
  cacheCreation: number | null;
  cacheRead: number | null;
};

// One footer for both stacks, because parseFooter in lib/usage.ts reads exactly these lines
// back out of the committed transcript: two renderers assembling it by hand drifted apart
// once already. "?" is a field the run did not report, and the parser reads each side of a
// pair on its own, so one "?" never costs the number beside it.
const runStatsSection = (stats: FooterStats) => {
  const show = (value: number | null) => (value === null ? "?" : String(value));

  return [
    "## run stats",
    `- turns: ${show(stats.turns)}`,
    `- duration: ${show(stats.duration_s)}s`,
    `- cost: $${show(stats.cost_usd)}`,
    ...(stats.costBasis === null ? [] : [`- cost basis: ${stats.costBasis}`]),
    `- tokens in/out: ${show(stats.inputTotal)}/${show(stats.output)}`,
    `- of which cache write/read: ${show(stats.cacheCreation)}/${show(stats.cacheRead)}`,
  ].join("\n");
};

// claude -p --output-format stream-json emits one JSON event per line. The rendered
// transcript keeps what a reader of the report needs — what the agent said, what it ran,
// what came back — and drops the rest; the raw jsonl sits beside it for anything else.
const renderClaude = (raw: string, stderr: string) => {
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
          rendered.push(stripControlBytes(block.text).trim());
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
      // Input is the three-way sum, not the `input_tokens` field: under prompt caching that
      // field is the uncached remainder and reads as a run that was handed nothing.
      const tokens = claudeTokens((event.usage ?? {}) as Record<string, unknown>);
      const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
      const durationMs = number(event.duration_ms);

      sections.push(runStatsSection({
        turns: number(event.num_turns),
        duration_s: durationMs === null ? null : Math.round(durationMs / 1000),
        cost_usd: number(event.total_cost_usd),
        costBasis: null,
        inputTotal: tokens.inputTotal,
        output: tokens.output,
        cacheCreation: tokens.cacheCreation,
        cacheRead: tokens.cacheRead,
      }));
    }
  }

  // Everything claude has to say goes to stdout, so stderr is a diagnostic — a bad key, an
  // unavailable model, a crash before the first event. executor.err is not committed, so
  // dropping it here is how a failed run ends up with a transcript that reads as if the
  // agent did nothing.
  if (stderr.trim().length > 0) {
    sections.push(`## stderr\n\n${fence(stderr)}`);
  }

  return sections.join("\n\n");
};

const renderCodexItem = (item: Record<string, unknown>): string | null => {
  // A patch or a command that failed is the most informative line in a run, and status is the
  // only place a file_change says so — without it a rejected patch reads exactly like an
  // applied one.
  const status = typeof item.status === "string" && item.status !== "completed" ? ` → ${item.status}` : "";

  if (item.type === "agent_message") {
    return typeof item.text === "string" && item.text.trim().length > 0 ? `## assistant\n${stripControlBytes(item.text).trim()}` : null;
  }

  if (item.type === "command_execution") {
    const command = `## assistant\n- **exec** \`${toolSummary(item)}\` → exit ${String(item.exit_code ?? "?")}`;
    const output = truncate(typeof item.aggregated_output === "string" ? item.aggregated_output : "", MAX_TOOL_RESULT_CHARS);

    return output.length > 0 ? `${command}\n\n${quoteBlock(output)}` : command;
  }

  if (item.type === "file_change") {
    const changes = Array.isArray(item.changes) ? (item.changes as Record<string, unknown>[]) : [];

    return `## assistant\n${changes.map(change => `- **patch** ${String(change.kind)} \`${String(change.path)}\`${status}`).join("\n")}`;
  }

  // Dropped for the same reason claude's thinking blocks are: the report reads what the agent
  // did, and the raw jsonl keeps the rest.
  if (item.type === "reasoning" || item.type === "user_message") {
    return null;
  }

  return `## assistant\n- **${String(item.type)}** \`${toolSummary(item)}\`${status}`;
};

// One line per event for the operator's terminal. Under --json codex's session moves to
// stdout, which the harness captures to a file, so without this a codex run is a blank
// terminal for twenty minutes and a hung sandbox looks exactly like a working agent.
export const codexProgress = (line: string): string | null => {
  const { events } = jsonEvents(line);
  const event = events[0];

  if (event === undefined) {
    return null;
  }

  if (event.type === "turn.completed") {
    const usage = (event.usage ?? {}) as Record<string, unknown>;

    return `· turn complete (${String(usage.input_tokens ?? "?")} in / ${String(usage.output_tokens ?? "?")} out)`;
  }

  if (event.type !== "item.completed" || !event.item || typeof event.item !== "object") {
    return null;
  }

  const item = event.item as Record<string, unknown>;
  const rendered = renderCodexItem(item);

  return rendered === null ? null : `· ${truncate(rendered.replace(/^## assistant\n/, "").split("\n")[0], 120)}`;
};

// `codex exec --json` puts one event per line on stdout: every message, command and patch as
// an item, and a turn.completed with that turn's usage. stderr is then diagnostics only, like
// claude's. Rendered to the same sections claude gets — including the same truncation of
// command output, so a codex transcript.md is neither more nor less complete than a claude
// one, and the untruncated capture is the gitignored transcript.jsonl on both stacks.
const renderCodex = (raw: string, stderr: string, header: TranscriptHeader) => {
  const sections: string[] = [];
  const { events, unparsed } = jsonEvents(raw);

  for (const event of events) {
    if (event.type === "item.completed" && event.item && typeof event.item === "object") {
      const rendered = renderCodexItem(event.item as Record<string, unknown>);

      if (rendered !== null) {
        sections.push(rendered);
      }
    }

    if (event.type === "error" || event.type === "turn.failed") {
      const error = event.error as { message?: unknown } | undefined;
      const message = typeof event.message === "string" ? event.message : typeof error?.message === "string" ? error.message : JSON.stringify(event);

      sections.push(`## error\n\n${fence(message)}`);
    }
  }

  const usage = header.usage;

  // No usage, or a run that died before its first turn.completed: no footer, rather than one
  // that reports a whole run's work as a handful of tokens.
  if (usage !== null && usage.total_tokens !== null) {
    const basis = usage.cost_usd !== null
      ? `list price for ${header.model} as of ${PRICES_CHECKED} (${PRICES_SOURCE}); codex reports no price`
      : `none — ${header.model} has no row in lib/prices.ts`;

    sections.push(runStatsSection({
      // A codex turn is one user prompt, always 1 in exec; it is not the unit claude's
      // num_turns counts, so the field stays unreported rather than lying with a 1.
      turns: null,
      duration_s: usage.duration_s,
      cost_usd: usage.cost_usd,
      costBasis: basis,
      inputTotal: usage.input_tokens === null && usage.cache_creation_input_tokens === null && usage.cache_read_input_tokens === null
        ? null
        : (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
      output: usage.output_tokens,
      cacheCreation: usage.cache_creation_input_tokens,
      cacheRead: usage.cache_read_input_tokens,
    }));
  }

  // A codex that crashed before its first event, or one launched without --json, leaves
  // plain text here; dropping it would leave a transcript in which the run did nothing.
  if (unparsed.length > 0) {
    sections.push(`## stdout\n\n${fence(unparsed.join("\n"))}`);
  }

  if (stderr.trim().length > 0) {
    sections.push(`## stderr\n\n${fence(stderr)}`);
  }

  return sections.join("\n\n");
};

const show = (value: number | null) => (value === null ? "?" : String(value));

// A tool part arrives once it has finished, completed or errored, with its input, its output
// (or its error), and — for bash — the exit code under metadata. A failed call is rendered
// too: a run that tried and failed must not read as one that never tried.
const renderOpencodeTool = (part: Record<string, unknown>): string | null => {
  const state = part.state && typeof part.state === "object" ? (part.state as Record<string, unknown>) : {};

  if (state.status !== "completed" && state.status !== "error") {
    return null;
  }

  const metadata = state.metadata && typeof state.metadata === "object" ? (state.metadata as Record<string, unknown>) : {};
  const outcome = state.status === "error" ? " → error" : typeof metadata.exit === "number" ? ` → exit ${metadata.exit}` : "";
  const line = `## assistant\n- **${String(part.tool ?? "tool")}** \`${toolSummary(state.input)}\`${outcome}`;
  const text = state.status === "error" ? state.error : state.output;
  const output = truncate(typeof text === "string" ? text : "", MAX_TOOL_RESULT_CHARS);

  return output.length > 0 ? `${line}\n\n${quoteBlock(output)}` : line;
};

// `opencode run --format json` puts one event per line on stdout: text and tool parts as the
// model produces them, a step_finish per model call with that step's tokens and price, and
// an error event when a call fails. Rendered to the same sections as the other two, with the
// footer built from the harness's usage record, since opencode reports no duration.
const renderOpencode = (raw: string, stderr: string, header: TranscriptHeader) => {
  const sections: string[] = [];
  const { events, unparsed } = jsonEvents(raw);
  // When opencode compacts a session it re-emits the completed tool parts under their
  // original ids, so a part is rendered the first time it is seen and never again.
  const seen = new Set<string>();

  for (const event of events) {
    const part = event.part && typeof event.part === "object" ? (event.part as Record<string, unknown>) : null;

    if (event.type === "text" && part !== null && typeof part.text === "string" && part.text.trim().length > 0) {
      sections.push(`## assistant\n${stripControlBytes(part.text).trim()}`);
    }

    if (event.type === "tool_use" && part !== null) {
      const id = typeof part.id === "string" ? part.id : null;

      if (id !== null && seen.has(id)) {
        continue;
      }

      const rendered = renderOpencodeTool(part);

      if (rendered !== null) {
        sections.push(rendered);

        if (id !== null) {
          seen.add(id);
        }
      }
    }

    if (event.type === "error") {
      const error = event.error as { message?: unknown; data?: { message?: unknown } } | undefined;
      const message = typeof error?.data?.message === "string"
        ? error.data.message
        : typeof error?.message === "string" ? error.message : JSON.stringify(event);

      sections.push(`## error\n\n${fence(message)}`);
    }

    // reasoning parts are dropped for the same reason claude's thinking blocks are.
  }

  // The footer is the harness's usage record, already measured from this same stream by
  // buildUsage; a run with no usage — died before its first step — gets no footer.
  const usage = header.usage;

  if (usage !== null && usage.total_tokens !== null) {
    const inputTotal = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const basis = usage.cost_usd === null
      ? "none — opencode priced every step at $0 (a free or subscription model reports no price)"
      : `reported by opencode: the pinned catalog's list price for ${header.model}; OpenRouter bills the routed provider's rate`;

    sections.push([
      "## run stats",
      `- turns: ${show(usage.turns)}`,
      `- duration: ${show(usage.duration_s)}s`,
      `- cost: $${show(usage.cost_usd)}`,
      `- cost source: ${usage.cost_source ?? "?"}`,
      `- cost basis: ${basis}`,
      `- tokens in/out: ${inputTotal}/${show(usage.output_tokens)}`,
      `- of which cache write/read: ${show(usage.cache_creation_input_tokens)}/${show(usage.cache_read_input_tokens)}`,
    ].join("\n"));
  }

  if (unparsed.length > 0) {
    sections.push(`## stdout\n\n${fence(unparsed.join("\n"))}`);
  }

  if (stderr.trim().length > 0) {
    sections.push(`## stderr\n\n${fence(stderr)}`);
  }

  return sections.join("\n\n");
};

// stdout and stderr both go in: which one holds the transcript is the executor's business,
// not the caller's.
export const buildTranscript = (header: TranscriptHeader, stdout: string, stderr: string) => {
  const heading = [
    `# Executor transcript — ${header.run}`,
    "",
    `**executor**: ${header.executor}  |  **model**: ${header.model}  |  **effort**: ${header.reasoningEffort}  |  **exit**: ${header.exit}`,
    `**workspace**: ${header.workspacePath}`,
  ].join("\n");
  const body = header.executor === "claude"
    ? renderClaude(stdout, stderr)
    : header.executor === "opencode"
      ? renderOpencode(stdout, stderr, header)
      : renderCodex(stdout, stderr, header);

  return stripControlBytes(`${heading}\n\n${body}\n`);
};
