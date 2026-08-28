import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { detectBrokenShell } from "../lib/executor-health.js";

const runDirWith = (capture: string | null) => {
  const runDir = mkdtempSync(path.join(tmpdir(), "eval-run-"));

  if (capture !== null) {
    writeFileSync(path.join(runDir, "executor.err"), capture);
  }

  return runDir;
};

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
  const found = detectBrokenShell(runDirWith(SNAPSHOT_FAILURE));

  assert.notEqual(found, null);
  assert.match(found!.cause, /no shell/);
  assert.match(found!.evidence, /Shell snapshot validation failed/);
});

test("a sandbox that could not start is caught too, with the machine-level remedy", () => {
  const found = detectBrokenShell(runDirWith(BWRAP_FAILURE));

  assert.notEqual(found, null);
  assert.match(found!.evidence, /^bwrap: setting up uid map/);
  assert.match(found!.remedy, /apparmor_restrict_unprivileged_userns/);
});

// The guard refuses to grade, so a false positive costs a whole run. Ordinary stderr —
// including a run that talks about shells — must pass through untouched.
test("an ordinary run is not refused", () => {
  const capture = `codex
I'll inspect the workspace and then write the contract.
exec /bin/bash -lc 'cat TASK.md' succeeded in 8ms
tokens used: 12345
`;

  assert.equal(detectBrokenShell(runDirWith(capture)), null);
});

// executor.err is gitignored, so a run dir that came from a clone has none. Missing capture
// is missing evidence, never a refusal.
test("no capture is not a refusal", () => {
  assert.equal(detectBrokenShell(runDirWith(null)), null);
});
