import type { Executor } from "./types.js";

const MAX_TOOL_INPUT_CHARS = 200;
const MAX_TOOL_RESULT_CHARS = 400;

type TranscriptHeader = {
  run: string;
  executor: Executor;
  model: string | null;
  exit: number;
  workspacePath: string;
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

  // Everything claude has to say goes to stdout, so stderr is a diagnostic — a bad key, an
  // unavailable model, a crash before the first event. executor.stderr is not committed, so
  // dropping it here is how a failed run ends up with a transcript that reads as if the
  // agent did nothing.
  if (stderr.trim().length > 0) {
    sections.push(`## stderr\n\n${fence(stderr)}`);
  }

  return sections.join("\n\n");
};

// codex exec is the mirror image of claude: the session log — reasoning, every exec and its
// output, patches, token count — goes to stderr, and stdout carries only the final message.
// Joining them is what makes transcript.md mean the same thing on both stacks; reading the
// stdout file alone leaves a transcript in which the run appears to have done nothing.
const renderCodex = (sessionLog: string, finalMessage: string) => {
  const sections = [`## session\n\n${fence(sessionLog)}`];

  if (finalMessage.trim().length > 0) {
    sections.push(`## final message\n\n${finalMessage.trim()}`);
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
  const body = header.executor === "claude" ? renderClaude(stdout, stderr) : renderCodex(stderr, stdout);

  return `${heading}\n\n${body}\n`;
};
