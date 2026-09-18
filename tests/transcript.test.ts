import assert from "node:assert/strict";
import test from "node:test";
import { buildTranscript, stripControlBytes } from "../lib/transcript.js";

const header = {
  run: "2026-09-17T143357Z-claude-with-skill-1",
  executor: "claude" as const,
  model: "claude-opus-5",
  reasoningEffort: "medium",
  exit: 0,
  workspacePath: "/tmp/workspace",
  usage: null,
};

// What the offending run's `npx tsc` printed (#133): a red banner in ANSI colour codes,
// then a buffer of NUL bytes. The bytes below are the shape, not the count.
const banner = "\x1b[41m\x1b[37m  This is not the tsc command you are looking for  \x1b[0m\n"
  + "To get the compiler, \x1b[34mtsc\x1b[0m, run:\n\t- npm install typescript\n"
  + "\x00\x00\x00\x00\x00\x00\x00\x00";

test("escape sequences and control bytes go, newline and tab stay", () => {
  const cleaned = stripControlBytes(banner);

  assert.equal(cleaned, "  This is not the tsc command you are looking for  \nTo get the compiler, tsc, run:\n\t- npm install typescript\n");
});

test("OSC and two-byte escapes go too, and so does a carriage return", () => {
  assert.equal(stripControlBytes("\x1b]0;title\x07x\x1b(By\r\n"), "xy\n");
  assert.equal(stripControlBytes("\x1b]8;;https://a.b\x1b\\link\x1b]8;;\x1b\\"), "link");
});

test("a claude transcript with a tool result full of control bytes is written as text", () => {
  const stdout = [
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "npx tsc --noEmit" } }] } }),
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: banner }] } }),
    "",
  ].join("\n");
  const transcript = buildTranscript(header, stdout, "\x1b[33mwarning:\x1b[0m slow\x00");

  assert.match(transcript, /  >   This is not the tsc command you are looking for  \n  > To get the compiler, tsc, run:\n  > \t- npm install typescript\n/);
  assert.match(transcript, /## stderr\n\n```text\nwarning: slow\n```/);
});

test("a codex transcript gets the same treatment", () => {
  const stdout = `${JSON.stringify({
    type: "item.completed",
    item: { type: "command_execution", command: "npx tsc", exit_code: 1, aggregated_output: banner },
  })}\n`;
  const transcript = buildTranscript({ ...header, executor: "codex" }, stdout, "");

  assert.match(transcript, /  >   This is not the tsc command you are looking for  \n  > To get the compiler, tsc, run:\n  > \t- npm install typescript\n/);
  assert.match(transcript, /- \*\*exec\*\* `npx tsc` → exit 1/);
});

test("tabs, Unicode and Markdown survive unchanged", () => {
  assert.equal(
    stripControlBytes("\té 中 😀 é `span`\n| a | b |\n```js\nconst x = 1;\n```\n"),
    "\té 中 😀 é `span`\n| a | b |\n```js\nconst x = 1;\n```\n",
  );
});

test("carriage returns keep the last progress frame of each line", () => {
  assert.equal(
    stripControlBytes("Resolving deltas:   0% (0/2)\rResolving deltas:  50% (1/2)\rResolving deltas: 100% (2/2)\ndone\r\n"),
    "Resolving deltas: 100% (2/2)\ndone\n",
  );
});

test("an OSC at the truncation boundary cannot consume later sections", () => {
  const stdout = [
    { type: "item.completed", item: { type: "command_execution", command: "first", exit_code: 0, aggregated_output: "\x1b]0;" + "x".repeat(396) + "\x07" } },
    { type: "item.completed", item: { type: "agent_message", text: "PRESERVE THIS ANSWER" } },
    { type: "item.completed", item: { type: "command_execution", command: "second", exit_code: 0, aggregated_output: "ding\x07more" } },
  ].map(event => JSON.stringify(event)).join("\n");
  const transcript = buildTranscript({ ...header, executor: "codex" }, stdout, "");

  assert.match(transcript, /## assistant\nPRESERVE THIS ANSWER\n/);
  assert.match(transcript, /- \*\*exec\*\* `first` → exit 0\n/);
  assert.match(transcript, /- \*\*exec\*\* `second` → exit 0\n\n  > dingmore\n/);
  assert.doesNotMatch(transcript, /\x1b|\x07/);
});
