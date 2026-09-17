import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { cedes, normalizeSkillText, readSkillContentId, readSkillDescription, routingNeighbours, skillContentId } from "../lib/skill.js";

// setup records this id in result.yaml and the results site groups runs by it. The two sides
// hash different sources for the same file — one reads the working tree, the other reads
// `git show`, which trims — so anything that makes those disagree splits one skill version
// into two and drops runs out of their column.

test("trailing whitespace does not make a second version of one file", () => {
  const text = "# skill\n\nverify before you send.\n";

  assert.equal(skillContentId(text), skillContentId(text.trimEnd()));
  assert.equal(skillContentId(text), skillContentId(`${text}\n\n  \n`));
});

test("a real edit changes the id", () => {
  assert.notEqual(skillContentId("# skill\nverify.\n"), skillContentId("# skill\nverify twice.\n"));
});

test("normalisation leaves exactly one trailing newline", () => {
  assert.equal(normalizeSkillText("a\n\n\n"), "a\n");
  assert.equal(normalizeSkillText("a"), "a\n");
});

test("reading a skill dir gives the id of its SKILL.md", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "eval-skill-"));
  const text = "# gas\n\nmeasure, do not guess.\n";

  writeFileSync(path.join(dir, "SKILL.md"), text);

  assert.equal(readSkillContentId(dir), skillContentId(text));
});

// Routing (#134): the descriptions decide which neighbours a routing run installs, so the
// parser here is the one the setup reads through — the same rules the descriptions test
// applies to the skills in the repo.

test("cedes(): the parenthetical is the cede, whatever the sentence around it does", () => {
  assert.deepEqual(cedes("Not for the pre-ship checklist, e.g. theme (`retired-skill`)."), ["retired-skill"]);
  assert.deepEqual(cedes("Not for running `forge` tests on their own (`testing`)."), ["testing"]);
  assert.deepEqual(cedes("Not for source review (`security`, `audit`) or chain choice (`l2s` or `gas`)."), [
    "security",
    "audit",
    "l2s",
    "gas",
  ]);
  assert.deepEqual(cedes("Covers fuzz testing with `forge`. Use `security` instead for source review."), []);
});

const skillsDir = (skills: Record<string, string>) => {
  const dir = mkdtempSync(path.join(tmpdir(), "eval-skills-"));

  for (const [name, description] of Object.entries(skills)) {
    mkdirSync(path.join(dir, name));
    writeFileSync(path.join(dir, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  }

  return dir;
};

test("routing neighbours are the skills a description cedes to and the ones that cede to it", () => {
  const dir = skillsDir({
    gas: 'Use for fee maths. Not for chain choice (`l2s`).',
    l2s: 'Use for chain choice. Not for bridging UX (`wallets`).',
    wallets: 'Use for signing. Not for the fee itself (`gas`).',
    noir: "Use for circuits.",
  });

  assert.deepEqual(routingNeighbours(dir, "gas"), ["l2s", "wallets"]);
  assert.deepEqual(routingNeighbours(dir, "l2s"), ["gas", "wallets"]);
  assert.deepEqual(routingNeighbours(dir, "noir"), []);
});

test("a cede to a name that is not a skill installs nothing, and a self-cede is not a neighbour", () => {
  const dir = skillsDir({
    gas: 'Not for chain choice (`l2s`), nor for gas itself (`gas`), nor for a skill that left (`retired`).',
    l2s: "Use for chain choice.",
  });

  assert.deepEqual(routingNeighbours(dir, "gas"), ["l2s"]);
});

test("a skill without a description cannot be routed to or from", () => {
  const dir = skillsDir({ gas: "Use for fee maths." });

  mkdirSync(path.join(dir, "bare"));
  writeFileSync(path.join(dir, "bare", "SKILL.md"), "# no frontmatter\n");

  assert.throws(() => routingNeighbours(dir, "gas"), /bare\/SKILL.md has no frontmatter/);
  assert.throws(() => readSkillDescription(path.join(dir, "bare")), /no frontmatter/);
});
