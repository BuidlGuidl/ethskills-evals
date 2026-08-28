import assert from "node:assert/strict";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { codexEnv, operatorCodexModel, resolveCodexModel } from "../lib/codex-home.js";

// Both homes are env-driven so a test can stand in for the operator's machine: CODEX_HOME is
// where the operator's real state lives, EVAL_CODEX_HOME is the one the harness builds.
const withHomes = (operatorFiles: Record<string, string>, body: () => void) => {
  const operatorHome = mkdtempSync(path.join(tmpdir(), "operator-codex-"));
  const harnessHome = path.join(mkdtempSync(path.join(tmpdir(), "harness-codex-")), "home");
  const previous = { operator: process.env.CODEX_HOME, harness: process.env.EVAL_CODEX_HOME, key: process.env.OPENAI_API_KEY };

  for (const [name, content] of Object.entries(operatorFiles)) {
    mkdirSync(path.dirname(path.join(operatorHome, name)), { recursive: true });
    writeFileSync(path.join(operatorHome, name), content);
  }

  process.env.CODEX_HOME = operatorHome;
  process.env.EVAL_CODEX_HOME = harnessHome;

  try {
    body();
  } finally {
    process.env.CODEX_HOME = previous.operator;
    process.env.EVAL_CODEX_HOME = previous.harness;
    process.env.OPENAI_API_KEY = previous.key;
  }

  return { operatorHome, harnessHome };
};

test("the harness home carries the credential and nothing else the operator has", () => {
  withHomes(
    {
      "auth.json": `{"token":"live"}\n`,
      "config.toml": `model = "gpt-5.6-sol"\n`,
      "skills/foundry-verify/SKILL.md": "# a global skill on the task's subject\n",
    },
    () => {
      const env = codexEnv();
      const home = env.CODEX_HOME!;

      // The link, not a copy: codex refreshes the token in place.
      assert.equal(lstatSync(path.join(home, "auth.json")).isSymbolicLink(), true);
      assert.equal(readlinkSync(path.join(home, "auth.json")), path.join(process.env.CODEX_HOME!, "auth.json"));

      // The operator's skills, and their config.toml, are simply not in this home.
      assert.equal(lstatSync(path.join(home, "skills"), { throwIfNoEntry: false }), undefined);
      assert.doesNotMatch(readFileSync(path.join(home, "config.toml"), "utf8"), /^\s*model\s*=/m);
    },
  );
});

test("a logged-out machine fails before the run rather than during it", () => {
  withHomes({}, () => {
    delete process.env.OPENAI_API_KEY;
    assert.throws(() => codexEnv(), /codex login/);

    // OPENAI_API_KEY is codex's other credential path and needs no file.
    process.env.OPENAI_API_KEY = "sk-test";
    assert.doesNotThrow(() => codexEnv());
  });
});

// AGENTS.md promises "codex → the model in ~/.codex/config.toml". The redirect means codex
// no longer reads that file, so the harness has to read it and pass it on argv.
test("the operator's configured model still reaches the run, and lands in the record", () => {
  withHomes({ "auth.json": "{}\n", "config.toml": `service_tier = "default"\nmodel = "gpt-5.6-sol"\n` }, () => {
    assert.equal(operatorCodexModel(), "gpt-5.6-sol");
    assert.equal(resolveCodexModel(null), "gpt-5.6-sol");
    assert.equal(resolveCodexModel("gpt-5.6-xhigh"), "gpt-5.6-xhigh");
  });
});

// A model under [profile.x] is not the model this run gets — the harness passes no -p — so
// reporting it would put a model in the record that never ran.
test("a model inside a profile table is not read as the run's model", () => {
  withHomes({ "auth.json": "{}\n", "config.toml": `service_tier = "default"\n[profiles.work]\nmodel = "gpt-5.6-sol"\n` }, () => {
    assert.equal(operatorCodexModel(), null);
  });
});
