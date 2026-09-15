import { PRICES_CHECKED, PRICES_SOURCE } from "./prices.js";
import { claudeTokens, codexRunTokens, jsonEvents } from "./usage.js";
import type { Executor, RunUsage } from "./types.js";

const MAX_TOOL_INPUT_CHARS = 200;
const MAX_TOOL_RESULT_CHARS = 400;

type TranscriptHeader = {
  run: string;
  executor: Executor;
  model: string | null;
  exit: number;
  workspacePath: string;
  // The harness's usage record. codex's footer needs it for duration and derived cost;
  // claude's footer comes from its own result event.
  usage?: RunUsage;
};

const truncate = (value: string, limit: number) => {
  const collapsed = value.trimEnd();

  return collapsed.length > limit ? `${collapsed.slice(0, limit)} … [${collapsed.length - limit} more chars]` : collapsed;
};

const quoteBlock = (value: string) => value.split("\n").map(line => `  > ${line}`).join("\n");

// A session log carries code blocks of its own, so a three-backtick fence would end early
// and the rest of the run would render as prose.
const fence = (value: string) => {
  const longest = (value.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  const ticks = "`".repeat(Math.max(3, longest + 1));

  return `${ticks}text\n${value.trimEnd()}\n${ticks}`;
};

const toolSummary = (input: unknown) => {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;

    for (const key of ["command", "file_path", "pattern", "url", "prompt", "query"]) {
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
      // Input is the three-way sum, not the `input_tokens` field: under prompt caching that
      // field is the uncached remainder and reads as a run that was handed nothing.
      const tokens = claudeTokens((event.usage ?? {}) as Record<string, unknown>);
      const show = (value: number | null) => (value === null ? "?" : String(value));

      sections.push([
        "## run stats",
        `- turns: ${String(event.num_turns ?? "?")}`,
        `- duration: ${Math.round(Number(event.duration_ms ?? 0) / 1000)}s`,
        `- cost: $${String(event.total_cost_usd ?? "?")}`,
        `- tokens in/out: ${show(tokens.inputTotal)}/${show(tokens.output)}`,
        `- of which cache write/read: ${show(tokens.cacheCreation)}/${show(tokens.cacheRead)}`,
      ].join("\n"));
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
  if (item.type === "agent_message") {
    return typeof item.text === "string" && item.text.trim().length > 0 ? `## assistant\n${item.text.trim()}` : null;
  }

  if (item.type === "command_execution") {
    const command = `## assistant\n- **exec** \`${toolSummary(item)}\` → exit ${String(item.exit_code ?? "?")}`;
    const output = truncate(typeof item.aggregated_output === "string" ? item.aggregated_output : "", MAX_TOOL_RESULT_CHARS);

    return output.length > 0 ? `${command}\n\n${quoteBlock(output)}` : command;
  }

  if (item.type === "file_change") {
    const changes = Array.isArray(item.changes) ? (item.changes as Record<string, unknown>[]) : [];

    return `## assistant\n${changes.map(change => `- **patch** ${String(change.kind)} \`${String(change.path)}\``).join("\n")}`;
  }

  // Dropped for the same reason claude's thinking blocks are: the report reads what the agent
  // did, and the raw jsonl keeps the rest.
  if (item.type === "reasoning" || item.type === "user_message") {
    return null;
  }

  return `## assistant\n- **${String(item.type)}** \`${toolSummary(item)}\``;
};

// `codex exec --json` puts one event per line on stdout: every message, command and patch as
// an item, and a turn.completed with that turn's usage. stderr is then diagnostics only, like
// claude's. Rendered to the same sections claude gets, so transcript.md means the same thing
// on both stacks, with the stats footer built from the harness's usage record — codex reports
// no duration or price, so both come from there.
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

  const tokens = codexRunTokens(raw);

  if (tokens !== null) {
    const show = (value: number | null) => (value === null ? "?" : String(value));
    const cost = header.usage?.cost_usd ?? null;
    const basis = cost === null
      ? `none — no list price for ${header.model ?? "the cli default model"} in lib/prices.ts`
      : `list price for ${header.model} as of ${PRICES_CHECKED} (${PRICES_SOURCE}); codex reports no price`;

    sections.push([
      "## run stats",
      "- turns: ?",
      `- duration: ${show(header.usage?.duration_s ?? null)}s`,
      `- cost: $${show(cost)}`,
      `- cost basis: ${basis}`,
      `- tokens in/out: ${show(tokens.inputTotal)}/${show(tokens.output)}`,
      `- of which cache write/read: ${show(tokens.cacheCreation)}/${show(tokens.cacheRead)}`,
    ].join("\n"));
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

// stdout and stderr both go in: which one holds the transcript is the executor's business,
// not the caller's.
export const buildTranscript = (header: TranscriptHeader, stdout: string, stderr: string) => {
  const heading = [
    `# Executor transcript — ${header.run}`,
    "",
    `**executor**: ${header.executor}  |  **model**: ${header.model ?? "cli default"}  |  **exit**: ${header.exit}`,
    `**workspace**: ${header.workspacePath}`,
  ].join("\n");
  const body = header.executor === "claude" ? renderClaude(stdout, stderr) : renderCodex(stdout, stderr, header);

  return `${heading}\n\n${body}\n`;
};
