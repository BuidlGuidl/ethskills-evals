import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Executor } from "./types.js";
import { jsonEvents } from "./usage.js";

const MAX_EVIDENCE_CHARS = 200;

// The failure class the exit code cannot see. When the executor's shell is dead, every
// command the agent runs fails before it runs, the agent falls back on its own prior, and
// the CLI still exits 0 — so `verify` grades a workspace in which the skill was never read
// as a skill that did not help. It is the worst failure this harness can have, because
// nothing in result.yaml distinguishes it from a real result.
//
// Both signatures are observed on real runs, not guessed: the first is the one that
// motivated `--disable shell_snapshot` (2026-08-27, orchestration-quiz-001), the second is
// the same symptom from a different cause on the same box. Anything that produces a run
// with no working shell belongs in this list.
//
// `source` is where that signature can legitimately appear. codex prints its own diagnostics
// on stderr and every command's output into the JSON event stream, so a pattern that names a
// command's output is looked for only there — which keeps the scan off this repo's own text
// when a run greps it, and keeps a diagnostic scan from having to be bounded at all.
type ShellFailure = {
  pattern: RegExp;
  source: "diagnostics" | "commands";
  cause: string;
  remedy: string;
};

// Keyed by executor, because a diagnosis is only useful if it names something the executor
// has: telling a claude run to fix codex's bubblewrap sandbox, or to pass a flag claude does
// not have, is worse than saying nothing. claude's own dead-shell signature is not known
// yet, so the honest list for it is empty.
export const SHELL_FAILURES: Record<Executor, ShellFailure[]> = {
  claude: [],
  codex: [
    {
      pattern: /codex_core::shell_snapshot: Shell snapshot validation failed/,
      source: "diagnostics",
      cause: "codex could not re-parse its snapshot of the operator's interactive shell, so the run had no shell",
      remedy: "run-executor passes --disable shell_snapshot, so this run was either launched by hand or predates that flag",
    },
    {
      // Lookbehind so "xbwrap:" in some unrelated word does not match; the evidence line
      // below is sliced out from the surrounding newlines either way.
      pattern: /(?<=^|\s)bwrap: [^\n]+/m,
      source: "commands",
      cause: "codex's bubblewrap sandbox could not start, so the run had no shell",
      remedy: "on Ubuntu this is kernel.apparmor_restrict_unprivileged_userns=1 blocking the user namespace bwrap needs: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0, or an AppArmor profile that permits userns for bwrap",
    },
  ],
};

// The bound for a capture that mixes diagnostics with command output — which is every codex
// run before `exec --json` (2026-09-15), whose whole session log went to stderr. codex prints
// a command's output *after* its "succeeded in <n>ms:" line, and a run with no shell never
// gets a first success, so everything past the first one is the run talking, not the harness.
// Without it `grep -r bwrap .` over a checkout of this repo — whose own tests and transcripts
// carry both signatures verbatim — gets a healthy run refused.
const SHELL_ALIVE = /\bsucceeded in \d/;

const beforeFirstSuccess = (captured: string) => {
  const alive = SHELL_ALIVE.exec(captured);

  return alive === null ? captured : captured.slice(0, alive.index);
};

// Under --json the same bound is exact, and structural rather than textual: the output of
// every command up to the first one that exited 0.
const outputsBeforeFirstSuccess = (raw: string) => {
  const outputs: string[] = [];

  for (const event of jsonEvents(raw).events) {
    const item = event.item as Record<string, unknown> | undefined;

    if (event.type !== "item.completed" || item?.type !== "command_execution") {
      continue;
    }

    if (item.exit_code === 0) {
      break;
    }

    if (typeof item.aggregated_output === "string") {
      outputs.push(item.aggregated_output);
    }
  }

  return outputs.join("\n");
};

const lineAt = (captured: string, index: number) => {
  const start = captured.lastIndexOf("\n", index) + 1;
  const end = captured.indexOf("\n", index);
  const line = captured.slice(start, end === -1 ? undefined : end).trim();

  return line.length > MAX_EVIDENCE_CHARS ? `${line.slice(0, MAX_EVIDENCE_CHARS)} …` : line;
};

// The harness's own captures of the executor, written by run-executor next to the record
// verify already reads: executor.err (the executor's stderr) and transcript.jsonl (its event
// stream). Both are gitignored, so a committed run has neither: no file means no signal,
// never a refusal, since the regrade guard already stops those.
//
// A run made before `exec --json` has no event stream, and its stderr is the whole session
// log — diagnostics and command output in one file — so there both kinds of signature are
// looked for, under the textual bound.
export const detectBrokenShell = (runDir: string, executor: Executor) => {
  const failures = SHELL_FAILURES[executor];

  if (failures.length === 0) {
    return null;
  }

  const errPath = path.join(runDir, "executor.err");
  const jsonlPath = path.join(runDir, "transcript.jsonl");
  const events = existsSync(jsonlPath) ? readFileSync(jsonlPath, "utf8") : null;
  const captures = [
    {
      capturePath: errPath,
      // A pre---json capture is both sources at once; a current one is diagnostics only, and
      // needs no bound because command output never reaches it.
      matches: (failure: ShellFailure) => events === null || failure.source === "diagnostics",
      read: () => (events === null ? beforeFirstSuccess(readFileSync(errPath, "utf8")) : readFileSync(errPath, "utf8")),
      exists: () => existsSync(errPath),
    },
    {
      capturePath: jsonlPath,
      matches: (failure: ShellFailure) => failure.source === "commands",
      read: () => outputsBeforeFirstSuccess(events ?? ""),
      exists: () => events !== null,
    },
  ];

  for (const capture of captures) {
    if (!capture.exists()) {
      continue;
    }

    const captured = capture.read();

    for (const failure of failures) {
      if (!capture.matches(failure)) {
        continue;
      }

      const match = failure.pattern.exec(captured);

      if (match) {
        return { cause: failure.cause, remedy: failure.remedy, evidence: lineAt(captured, match.index), capturePath: capture.capturePath };
      }
    }
  }

  return null;
};
