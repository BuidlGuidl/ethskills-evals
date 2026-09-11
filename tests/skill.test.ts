import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeSkillText, readSkillContentId, skillContentId } from "../lib/skill.js";

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
