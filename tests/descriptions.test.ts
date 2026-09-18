import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import yaml from "js-yaml";

// A skill's `description` is the routing signal (#91): the agent reads every description and
// picks one. A "Not for … (`x`)" clause hands an input to a neighbour, so the name inside has
// to be a skill that still exists — a retired or misspelt one routes to nobody, and that is
// found by hand after a run goes inert (#74, #95). Which skill *should* own an input is a
// review question, not a string match, so nothing here tries to answer it.

const ROOT = path.resolve(import.meta.dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");

const skillNames = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(SKILLS_DIR, entry.name, "SKILL.md")))
  .map((entry) => entry.name)
  .sort();

const frontmatter = (name: string) => {
  const text = readFileSync(path.join(SKILLS_DIR, name, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);

  assert.ok(match, `${name}: SKILL.md has no frontmatter`);

  const loaded = yaml.load(match[1]);

  assert.ok(loaded !== null && typeof loaded === "object", `${name}: frontmatter is not a mapping`);

  return loaded as Record<string, unknown>;
};

// Parsed inside each test rather than at module load: a SKILL.md that js-yaml rejects (a bare
// `: ` in a description does it) then fails every test by name instead of aborting the file
// before any of them runs.
const loadDescriptions = () => new Map(skillNames.map((name) => [name, frontmatter(name)]));

// A cede is a parenthesised list of backticked names at or after the first "Not for".
// Before that, a parenthetical is a mention.
const CEDE = /\(\s*(`[a-z0-9-]+`(?:\s*(?:,|or|,\s*or)\s*`[a-z0-9-]+`)*)\s*\)/g;

export const cedes = (description: string) => {
  const start = description.search(/\bnot for\b/i);
  return start < 0 ? [] : [...description.slice(start).matchAll(CEDE)].flatMap((m) => [...m[1].matchAll(/`([a-z0-9-]+)`/g)].map((n) => n[1]));
};

test("cedes(): the parenthetical is the cede, whatever the sentence around it does", () => {
  assert.deepEqual(cedes("Use for a scaffold (`create-eth`). Not for the checklist (`qa`)."), ["qa"]);
  assert.deepEqual(cedes("Use for a scaffold (`create-eth`) and nothing else."), []);
  assert.deepEqual(cedes("Not for the pre-ship checklist, e.g. theme (`retired-skill`)."), ["retired-skill"]);
  assert.deepEqual(cedes("Not for running `forge` tests on their own (`testing`)."), ["testing"]);
  assert.deepEqual(cedes("Use for the frontend; not for the checklist (`qa`)."), ["qa"]);
  assert.deepEqual(cedes("Not for source review (`security`, `audit`) or chain choice (`l2s` or `gas`)."), [
    "security",
    "audit",
    "l2s",
    "gas",
  ]);
  assert.deepEqual(cedes("Covers fuzz testing with `forge`. Use `security` instead for source review."), []);
});

test("every skill has a name matching its directory and a description", () => {
  for (const [name, fm] of loadDescriptions()) {
    assert.equal(fm.name, name, `${name}: frontmatter name is ${String(fm.name)}`);
    assert.equal(typeof fm.description, "string", `${name}: description missing`);
    assert.ok((fm.description as string).trim().length > 0, `${name}: description empty`);
  }
});

test("every cede names a skill that exists, and a Not-for cedes to somebody", () => {
  for (const [name, fm] of loadDescriptions()) {
    const description = fm.description as string;
    const targets = cedes(description);

    if (/\bnot for\b/i.test(description)) {
      assert.ok(targets.length > 0, `${name}: has a "Not for" but cedes to nobody — name the skill as (\`skill\`)`);
    }

    for (const target of targets) {
      assert.ok(skillNames.includes(target), `${name} cedes to \`${target}\`, which is not a skill in skills/`);
      assert.notEqual(target, name, `${name} cedes to itself`);
    }
  }
});
