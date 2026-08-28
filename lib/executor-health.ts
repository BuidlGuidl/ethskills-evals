import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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
type ShellFailure = {
  pattern: RegExp;
  cause: string;
  remedy: string;
};

export const SHELL_FAILURES: ShellFailure[] = [
  {
    pattern: /codex_core::shell_snapshot: Shell snapshot validation failed/,
    cause: "codex could not re-parse its snapshot of the operator's interactive shell, so the run had no shell",
    remedy: "run-executor passes --disable shell_snapshot, so this run was either launched by hand or predates that flag",
  },
  {
    // Lookbehind, so the match starts at "bwrap" rather than on the newline before it: the
    // evidence line below is sliced from the match position.
    pattern: /(?<=^|\s)bwrap: [^\n]+/m,
    cause: "codex's bubblewrap sandbox could not start, so the run had no shell",
    remedy: "on Ubuntu this is kernel.apparmor_restrict_unprivileged_userns=1 blocking the user namespace bwrap needs: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0, or an AppArmor profile that permits userns for bwrap",
  },
];

const lineAt = (captured: string, index: number) => {
  const start = captured.lastIndexOf("\n", index) + 1;
  const end = captured.indexOf("\n", index);
  const line = captured.slice(start, end === -1 ? undefined : end).trim();

  return line.length > MAX_EVIDENCE_CHARS ? `${line.slice(0, MAX_EVIDENCE_CHARS)} …` : line;
};

// executor.err only. That is the harness's own capture of the executor's stderr — for codex
// the whole session log, for claude the diagnostics — and it is written by run-executor next
// to the record verify already reads. It is gitignored, so a committed run has none: no file
// means no signal, never a refusal, since the regrade guard already stops those.
export const detectBrokenShell = (runDir: string) => {
  const capturePath = path.join(runDir, "executor.err");

  if (!existsSync(capturePath)) {
    return null;
  }

  const captured = readFileSync(capturePath, "utf8");

  for (const failure of SHELL_FAILURES) {
    const match = failure.pattern.exec(captured);

    if (match) {
      return { cause: failure.cause, remedy: failure.remedy, evidence: lineAt(captured, match.index), capturePath };
    }
  }

  return null;
};
