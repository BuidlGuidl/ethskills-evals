import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadShowcase, runModel, runUsage, selectShowcase } from "../lib/showcase.js";
import type { Entry, Index } from "../site/src/lib/types.js";

const entry: Entry = { skill: "addresses", model: "claude-opus-5", before: "big", after: "small" };
const run = (id: string, content: string | null) => ({
  task: "addresses-quiz-001", skill: "addresses", run: id, model: entry.model,
  variant: content === null ? "no_skill" : "with_skill", skill_content: content,
  superseded_by: null as string | null, retracted: null as string | null, pass: true as boolean | null,
});
const data = {
  skills: [
    { name: "addresses", versions: ["big", "small", "other"].map(id => ({ id, runs: 99, text: id })) },
    { name: "gas", versions: [] },
  ],
  tasks: [
    { id: "addresses-quiz-001", skill: "addresses", status: "live" },
    { id: "addresses-quiz-002", skill: "addresses", status: "live" },
    { id: "addresses-retired", skill: "addresses", status: "retired" },
    { id: "gas-quiz-001", skill: "gas", status: "live" },
  ],
  runs: [run("before", "big"), run("after", "small"), run("without", null)],
  reports: [{ skill: "addresses" }, { skill: "addresses-minimal" }, { skill: "gas" }],
  prs: [{ skill: "addresses" }, { skill: "gas" }, { skill: null }],
};

test("the recorded executor model wins; only an explicit same-agent judge supplies a fallback", () => {
  assert.equal(runModel({ executor: "codex", executor_model: "gpt-5.4", judge: { self_judged: true, model: "other" } }), "gpt-5.4");
  assert.equal(runModel({ executor: "claude", judge: { self_judged: true, model: entry.model } }), entry.model);
  for (const self_judged of [false, undefined, "true"]) {
    assert.equal(runModel({ executor: "claude", judge: { self_judged, model: entry.model } }), "claude-unknown");
  }
  assert.equal(runModel({ executor: "codex", judge: { self_judged: true, model: null } }), "codex-unknown");
  assert.equal(runModel({ executor: "claude" }), "claude-unknown");
});

test("usage merges transcript stats over the record field by field, preserving missing values and recorded zeros", () => {
  const text = "## run stats\n- duration: 12s\n- tokens in/out: 100/20\n- cost: $0\n";
  assert.deepEqual(runUsage(text, { duration_s: 99, total_tokens: 999, cost_usd: 3, turns: 4 }), {
    tokens: 120, duration_s: 12, cost_usd: 0, turns: 4,
  });
  assert.deepEqual(runUsage("", undefined), { tokens: null, duration_s: null, cost_usd: null, turns: null });
  assert.deepEqual(runUsage("no stats", { total_tokens: 50, duration_s: 0 }), { tokens: 50, duration_s: 0, cost_usd: null, turns: null });
  assert.deepEqual(runUsage("", { total_tokens: "50", duration_s: Infinity }), runUsage("", null));
});

test("older result blocks include cached tokens in the total", () => {
  const text = '## result\nduration_ms: 12000\nnum_turns: 2\ntotal_cost_usd: 1.5\nusage: {"input_tokens":1,"cache_creation_input_tokens":10,"cache_read_input_tokens":100,"output_tokens":20}\n';
  assert.deepEqual(runUsage(text, null), { tokens: 131, duration_s: 12, cost_usd: 1.5, turns: 2 });
});

test("selection drops old readings, retractions, ungraded runs, retired tasks and other models or versions", () => {
  const excluded = [
    { ...run("source", "big"), superseded_by: "before" },
    { ...run("retracted", "big"), retracted: "executor failed" },
    { ...run("ungraded", "big"), pass: null },
    { ...run("retired", "big"), task: "addresses-retired" },
    { ...run("unknown-task", "big"), task: "missing" },
    { ...run("other-model", "big"), model: "gpt-5.4" },
    { ...run("other-skill", "big"), skill: "gas", task: "gas-quiz-001" },
    { ...run("bad-variant", "big"), variant: null },
    run("other-version", "other"),
  ];
  const result = selectShowcase({ ...data, runs: [...data.runs, ...excluded] }, [entry]);
  assert.deepEqual(result.runs, data.runs);
  assert.deepEqual(result.tasks.map(task => task.id), ["addresses-quiz-001", "addresses-quiz-002"]);
  assert.deepEqual(result.skills, [{ name: "addresses", versions: [{ id: "big", runs: 1, text: "big" }, { id: "small", runs: 1, text: "small" }] }]);
  assert.deepEqual(result.reports, [{ skill: "addresses" }, { skill: "addresses" }]);
  assert.deepEqual(result.prs, [{ skill: "addresses" }]);
  assert.deepEqual(result.warnings, []);
  assert.equal(data.skills[0].versions[0].runs, 99, "filtering must not alter resolved data");
});

test("each skill/model entry selects its own versions and retains manifest order without doubling baselines", () => {
  const other = { ...entry, model: "gpt-5.4", before: "other" };
  const runs = [...data.runs, { ...run("other-before", "other"), model: other.model }, { ...run("other-after", "small"), model: other.model }];
  const result = selectShowcase({ ...data, runs }, [other, entry]);
  assert.deepEqual(result.showcase, [other, entry]);
  assert.equal(result.runs.length, 5);
  assert.deepEqual(result.warnings, []);
});

test("unknown versions, skills and models warn for each empty side", () => {
  const result = selectShowcase(data, [{ ...entry, after: "typo" }]);
  assert.deepEqual(result.warnings, ["showcase addresses (claude-opus-5): after version typo selects no runs"]);
  assert.equal(selectShowcase(data, [{ ...entry, skill: "unknown" }]).warnings.length, 2);
  assert.equal(selectShowcase(data, [{ ...entry, model: "unknown" }]).warnings.length, 2);
  assert.equal(selectShowcase({ ...data, runs: [run("baseline", null)] }, [entry]).warnings.length, 2);
});

test("manifest loading distinguishes absence from an empty selection and rejects malformed or duplicate entries", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "showcase-manifest-"));
  const file = path.join(dir, "showcase.json");
  try {
    assert.equal(loadShowcase(file), null);
    writeFileSync(file, JSON.stringify({ entries: [] }));
    assert.deepEqual(loadShowcase(file), []);
    for (const invalid of [{}, { entries: [{}] }, { entries: [entry, entry] }]) {
      writeFileSync(file, JSON.stringify(invalid));
      assert.throws(() => loadShowcase(file));
    }
    writeFileSync(file, JSON.stringify({ entries: [entry, { ...entry, model: "gpt-5.4" }] }));
    assert.equal(loadShowcase(file)?.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the CLI selects the committed showcase after resolution and leaves the derived cache intact", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "showcase-index-"));
  const out = path.join(dir, "index.json");
  const cache = path.join(dir, "derived.json");
  const original = readFileSync("site/derived.json", "utf8");
  writeFileSync(cache, original);
  const args = ["--import", "tsx", "scripts/build-index.ts", "--no-git", "--no-prs", "--strict", "--out", out, "--cache", cache];
  try {
    execFileSync(process.execPath, args, { encoding: "utf8" });
    const index: Index = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(index.skills.length, 7);
    assert.deepEqual(index.showcase, loadShowcase("site/showcase.json"));
    assert.ok(index.tasks.every(task => task.status === "live"));
    assert.ok(index.runs.every(run => typeof run.model === "string" && Object.keys(run.usage).length === 4));
    assert.deepEqual(selectShowcase(index, index.showcase!).runs, index.runs);
    assert.equal(readFileSync(cache, "utf8"), original);
    assert.ok(index.reports.some(report => report.file === "addresses-minimal-2026-08-19.md"));

    execFileSync(process.execPath, [...args, "--showcase", path.join(dir, "absent.json")]);
    const full: Index = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(full.showcase, undefined);
    const regrades = index.runs.filter(run => run.regrade_of !== null);
    assert.ok(regrades.length > 0);
    for (const reading of regrades) {
      let source = reading;
      while (source.regrade_of !== null) {
        source = full.runs.find(run => run.task === source.task && run.run === source.regrade_of)!;
        assert.ok(source);
      }
      assert.deepEqual(reading.usage, source.usage);
    }
    const counts = index.showcase!.map(entry => {
      const runs = index.runs.filter(run => run.skill === entry.skill && run.model === entry.model);
      return [entry.skill, ...[entry.before, entry.after, null].map(id => runs.filter(run => id === null ? run.variant === "no_skill" : run.variant === "with_skill" && run.skill_content === id).length)];
    });
    // Section 5 includes six before and six baseline runs on retired wallets quizzes.
    // Section 6 excludes those tasks, so the live counts are 15 and 40.
    assert.deepEqual(counts, [
      ["addresses", 18, 18, 24], ["concepts", 9, 11, 9], ["l2s", 15, 15, 15], ["protocol", 6, 6, 12],
      ["wallets", 15, 25, 40], ["security", 24, 24, 48], ["orchestration", 15, 15, 21],
    ]);
    assert.ok(full.skills.length > index.skills.length);
    assert.ok(full.runs.some(run => run.superseded_by !== null));

    const versions = spawnSync(process.execPath, [...args, "--versions"], { encoding: "utf8" });
    assert.equal(versions.status, 0);
    assert.match(versions.stderr, /Skill\tVersion id\tLines\tRuns/);
    for (const skill of full.skills) {
      for (const version of skill.versions) {
        assert.ok(versions.stderr.includes(`${skill.name}\t${version.id}\t${version.lines}\t${version.runs}\n`));
      }
    }
    assert.equal(readFileSync(cache, "utf8"), original);

    const manifest = path.join(dir, "bad.json");
    writeFileSync(manifest, JSON.stringify({ entries: [{ ...index.showcase![0], after: "unknown" }] }));
    const failed = spawnSync(process.execPath, [...args, "--showcase", manifest], { encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /after version unknown selects no runs/);
    assert.equal(readFileSync(cache, "utf8"), original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
