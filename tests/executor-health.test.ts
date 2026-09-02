import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { detectBrokenShell } from "../lib/executor-health.js";
import type { Executor } from "../lib/types.js";

// The dir is the argument detectBrokenShell takes, so build one and delete it again rather
// than leaving a tmpdir per assertion behind.
const withRunDir = <T>(capture: string | null, body: (runDir: string) => T): T => {
  const runDir = mkdtempSync(path.join(tmpdir(), "eval-run-"));

  if (capture !== null) {
    writeFileSync(path.join(runDir, "executor.err"), capture);
  }

  try {
    return body(runDir);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
};

const detect = (capture: string | null, executor: Executor = "codex") =>
  withRunDir(capture, runDir => detectBrokenShell(runDir, executor));

// The 2026-08-27 run this whole guard exists for: codex exited 0, the agent said the skill
// file could not be read and answered from its prior, and result.yaml would have recorded
// that as a skill that did not help.
const SNAPSHOT_FAILURE = `2026-08-27T14:55:01.123456Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a0.tmp-178: line 2547: syntax error near unexpected token \`('
codex
The local skill file can't be read in this sandbox (the shell fails before executing).
`;

const BWRAP_FAILURE = `exec /bin/bash -lc 'ls' failed:
bwrap: setting up uid map: Permission denied
`;

test("a shell-snapshot failure is caught even though the executor exited 0", () => {
  const found = detect(SNAPSHOT_FAILURE);

  assert.notEqual(found, null);
  assert.match(found!.cause, /no shell/);
  assert.match(found!.evidence, /Shell snapshot validation failed/);
});

test("a sandbox that could not start is caught too, with the machine-level remedy", () => {
  const found = detect(BWRAP_FAILURE);

  assert.notEqual(found, null);
  assert.match(found!.evidence, /^bwrap: setting up uid map/);
  assert.match(found!.remedy, /apparmor_restrict_unprivileged_userns/);
});

// Both signatures are codex's. A claude run that printed one of them printed it as output,
// and telling claude to pass --disable shell_snapshot or to fix bubblewrap names neither a
// flag nor a sandbox it has.
test("a codex signature in a claude run is not a claude diagnosis", () => {
  assert.equal(detect(SNAPSHOT_FAILURE, "claude"), null);
  assert.equal(detect(BWRAP_FAILURE, "claude"), null);
});

// The one that fires on this repo: codex writes each command's output into the capture, and
// this very file holds both signatures verbatim. AGENTS.md says a run may find this repo on
// purpose, so a healthy run that reads the tests must not be refused. The line that tells
// the two apart is the successful exec before the output — a run with no shell never has one.
test("a healthy run that reads this repo's own fixtures is not refused", () => {
  const capture = `exec /bin/bash -lc 'cat tests/executor-health.test.ts' in /tmp/workspace
 succeeded in 12ms:
${SNAPSHOT_FAILURE}${BWRAP_FAILURE}`;

  assert.equal(detect(capture), null);
});

// The guard refuses to grade, so a false positive costs a whole run. Ordinary stderr —
// including a run that talks about shells — must pass through untouched.
test("an ordinary run is not refused", () => {
  const capture = `codex
I'll inspect the workspace and then write the contract.
exec /bin/bash -lc 'cat TASK.md' succeeded in 8ms
tokens used: 12345
`;

  assert.equal(detect(capture), null);
});

// executor.err is gitignored, so a run dir that came from a clone has none. Missing capture
// is missing evidence, never a refusal.
test("no capture is not a refusal", () => {
  assert.equal(detect(null), null);
});
