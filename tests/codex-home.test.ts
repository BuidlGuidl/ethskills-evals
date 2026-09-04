import assert from "node:assert/strict";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { codexEnv, codexReasoningArgs, operatorCodexModel, operatorCodexReasoningEffort, resolveCodexModel } from "../lib/codex-home.js";

// `process.env.X = undefined` stores the string "undefined", which leaves the next test
// resolving CODEX_HOME to <cwd>/undefined and reading OPENAI_API_KEY as set. Restore by
// deleting whatever was unset to begin with.
const restore = (name: string, previous: string | undefined) => {
  if (previous === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
};

// Both homes are env-driven so a test can stand in for the operator's machine: CODEX_HOME is
// where the operator's real state lives, EVAL_CODEX_HOME is the one the harness builds.
const withHomes = (operatorFiles: Record<string, string>, body: (homes: { operatorHome: string; harnessHome: string }) => void) => {
  const operatorHome = mkdtempSync(path.join(tmpdir(), "operator-codex-"));
  const harnessRoot = mkdtempSync(path.join(tmpdir(), "harness-codex-"));
  const harnessHome = path.join(harnessRoot, "home");
  const previous = { operator: process.env.CODEX_HOME, harness: process.env.EVAL_CODEX_HOME, key: process.env.OPENAI_API_KEY };

  for (const [name, content] of Object.entries(operatorFiles)) {
    mkdirSync(path.dirname(path.join(operatorHome, name)), { recursive: true });
    writeFileSync(path.join(operatorHome, name), content);
  }

  process.env.CODEX_HOME = operatorHome;
  process.env.EVAL_CODEX_HOME = harnessHome;

  try {
    body({ operatorHome, harnessHome });
  } finally {
    restore("CODEX_HOME", previous.operator);
    restore("EVAL_CODEX_HOME", previous.harness);
    restore("OPENAI_API_KEY", previous.key);
    // The harness home holds a symlink to the operator's auth.json; remove it first so
    // nothing here can follow a link out into the operator's dir.
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(operatorHome, { recursive: true, force: true });
  }
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

// The homes coinciding is the destructive case: config.toml is written over the operator's
// real one, and auth.json is relinked to itself. Refuse before either happens.
test("a harness home that is the operator's home is refused, not written over", () => {
  withHomes({ "auth.json": `{"token":"live"}\n`, "config.toml": `model = "gpt-5.6-sol"\n` }, ({ operatorHome }) => {
    process.env.EVAL_CODEX_HOME = operatorHome;

    assert.throws(() => codexEnv(), /must be separate/);
    assert.equal(readFileSync(path.join(operatorHome, "auth.json"), "utf8"), `{"token":"live"}\n`);
    assert.match(readFileSync(path.join(operatorHome, "config.toml"), "utf8"), /^model = /m);
  });
});

// codex writes through temp + rename in places, so the link can come back as a real file
// holding a token nothing else has. Deleting it to restore the link logs the harness out.
test("a real auth.json in the harness home is left alone, not replaced by the link", () => {
  withHomes({ "auth.json": `{"token":"stale"}\n` }, ({ harnessHome }) => {
    codexEnv();
    rmSync(path.join(harnessHome, "auth.json"));
    writeFileSync(path.join(harnessHome, "auth.json"), `{"token":"refreshed"}\n`);

    codexEnv();

    assert.equal(readFileSync(path.join(harnessHome, "auth.json"), "utf8"), `{"token":"refreshed"}\n`);
  });
});

test("a logged-out machine fails before the run rather than during it", () => {
  withHomes({}, ({ harnessHome }) => {
    delete process.env.OPENAI_API_KEY;
    assert.throws(() => codexEnv(), /codex login/);

    // OPENAI_API_KEY is codex's other credential path and needs no file.
    process.env.OPENAI_API_KEY = "sk-test";
    assert.doesNotThrow(() => codexEnv());

    // And no link is left pointing at the credential that is not there: codex reads a
    // dangling auth.json as unreadable stored credentials instead of using the env key.
    assert.equal(lstatSync(path.join(harnessHome, "auth.json"), { throwIfNoEntry: false }), undefined);
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

// The setting that changes the answer as much as the model does. Dropped silently it moves
// the runs before this redirect and the runs after it onto different footings, and nothing
// in the record says which one a given run was on.
test("the operator's reasoning effort crosses the redirect too", () => {
  withHomes({ "auth.json": "{}\n", "config.toml": `model_reasoning_effort = "low"\nmodel = "gpt-5.6-sol"\n` }, () => {
    assert.equal(operatorCodexReasoningEffort(), "low");
    assert.deepEqual(codexReasoningArgs("low"), ["-c", `model_reasoning_effort="low"`]);
  });

  // Nothing configured means codex's own default, which is a legitimate choice: pass no
  // flag rather than inventing one, and let the record say null.
  withHomes({ "auth.json": "{}\n", "config.toml": `model = "gpt-5.6-sol"\n` }, () => {
    assert.equal(operatorCodexReasoningEffort(), null);
    assert.deepEqual(codexReasoningArgs(null), []);
  });
});

// A model under [profile.x] is not the model this run gets — the harness passes no -p — so
// reporting it would put a model in the record that never ran.
test("a model inside a profile table is not read as the run's model", () => {
  withHomes({ "auth.json": "{}\n", "config.toml": `service_tier = "default"\n[profiles.work]\nmodel = "gpt-5.6-sol"\n` }, () => {
    assert.equal(operatorCodexModel(), null);
  });
});
