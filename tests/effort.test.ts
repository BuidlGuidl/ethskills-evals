import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveEffort, resolveModel } from "../lib/effort.js";

const withOperatorConfig = (config: string | null, body: () => void) => {
  const home = mkdtempSync(path.join(tmpdir(), "operator-codex-"));
  const previous = process.env.CODEX_HOME;

  if (config !== null) {
    writeFileSync(path.join(home, "config.toml"), config);
  }

  process.env.CODEX_HOME = home;

  try {
    body();
  } finally {
    if (previous === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previous;
    }

    rmSync(home, { recursive: true, force: true });
  }
};

test("claude has no fallback: model and effort are both named on the command line", () => {
  withOperatorConfig(`model = "gpt-5.6-sol"\nmodel_reasoning_effort = "low"\n`, () => {
    assert.throws(() => resolveModel("claude", null, "--model"), /missing --model/);
    assert.throws(() => resolveEffort("claude", null, "--effort"), /missing --effort/);
    assert.throws(() => resolveEffort("claude", null, "--judge-effort"), /missing --judge-effort/);
  });

  assert.equal(resolveModel("claude", "claude-opus-5", "--model"), "claude-opus-5");
  assert.equal(resolveEffort("claude", "medium", "--effort"), "medium");
});

test("a claude effort the CLI does not accept is refused before a run is spent on it", () => {
  assert.throws(() => resolveEffort("claude", "minimal", "--effort"), /unknown --effort for claude: minimal/);
});

test("codex takes the flag over the operator's config, and the config when there is no flag", () => {
  withOperatorConfig(`model = "gpt-5.6-sol"\nmodel_reasoning_effort = "low"\n`, () => {
    assert.equal(resolveModel("codex", null, "--model"), "gpt-5.6-sol");
    assert.equal(resolveModel("codex", "gpt-5.4", "--model"), "gpt-5.4");
    assert.equal(resolveEffort("codex", null, "--effort"), "low");
    assert.equal(resolveEffort("codex", "high", "--effort"), "high");
  });
});

test("codex with neither a flag nor a top-level setting is refused, not recorded as null", () => {
  withOperatorConfig(`[profiles.work]\nmodel = "gpt-5.6-sol"\nmodel_reasoning_effort = "high"\n`, () => {
    assert.throws(() => resolveModel("codex", null, "--judge-model"), /missing --judge-model: no top-level model/);
    assert.throws(() => resolveEffort("codex", null, "--judge-effort"), /missing --judge-effort: no top-level model_reasoning_effort/);
  });

  withOperatorConfig(null, () => {
    assert.throws(() => resolveEffort("codex", null, "--effort"), /missing --effort/);
  });
});
