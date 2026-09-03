import assert from "node:assert/strict";
import test from "node:test";
import { findSkillMentions, guardJudgeBlindness } from "../lib/blindness.js";

// buildEvidence's own shape: one `# <section>` header per file, contents underneath,
// sections joined into the single string the judge is handed.
const evidence = (sections: [string, string][]) =>
  sections.map(([header, body]) => [`# ${header}`, body].join("\n")).join("\n\n");

test("clean evidence produces no hits", () => {
  const clean = evidence([
    ["output/answer.md", "ERC-8004 puts the identity registry at one address per chain.\nAgents register a domain.\n"],
    ["run.diff", "+const registry = process.env.REGISTRY_ADDRESS;\n"],
  ]);

  assert.deepEqual(findSkillMentions(clean), []);
  assert.doesNotThrow(() => guardJudgeBlindness(clean, false));
});

// The #92 review's finding: the line number was counted across the whole assembled
// evidence, so a hit on line 2 of answer.md was reported at a line answer.md does not
// have. It has to be the line within the named section, or the operator cannot open it.
test("a hit is numbered within its own section, not across the assembled evidence", () => {
  const hits = findSkillMentions(
    evidence([
      ["run.diff", "+const a = 1;\n+const b = 2;\n+const c = 3;\n"],
      ["output/answer.md", "Line one of the answer.\nAs the skill says, register the domain.\n"],
    ]),
  );

  assert.equal(hits.length, 1);
  assert.match(hits[0], /output\/answer\.md:2\b/);
  assert.match(hits[0], /\[skill self-reference\]/);
});

// A file whose NAME leaks the variant is a hit on the header itself, which belongs to
// no line of the file — reported as line 0 rather than silently dropped.
test("a leaking section header reports as line 0 of its own section", () => {
  const hits = findSkillMentions(evidence([["output/notes-from-SKILL.md", "nothing incriminating here\n"]]));

  assert.equal(hits.length, 1);
  assert.match(hits[0], /output\/notes-from-SKILL\.md:0\b/);
});

test("each pattern is recognised, and one line counts once", () => {
  const hits = findSkillMentions(
    evidence([
      [
        "output/answer.md",
        [
          "Sourced from .claude/skills/standards/SKILL.md and the skill's examples.",
          "Read .agents/skills/standards/",
          "The installed skill covers ERC-8004.",
        ].join("\n"),
      ],
    ]),
  );

  assert.equal(hits.length, 3);
  assert.match(hits[0], /output\/answer\.md:1\b/);
  assert.match(hits[1], /output\/answer\.md:2\b.*\[skill install path\]/);
  assert.match(hits[2], /output\/answer\.md:3\b.*\[skill self-reference\]/);
});

// The guard aborts before the judge call; --allow-skill-mention downgrades it to a warning
// so an operator who has read the hits can grade anyway.
test("the guard throws on a hit and --allow-skill-mention downgrades it to a warning", () => {
  const leaked = evidence([["output/answer.md", "Per the attached skill, agents self-register.\n"]]);
  const warnings: string[] = [];
  const original = console.warn;

  assert.throws(() => guardJudgeBlindness(leaked, false), /judge blindness: evidence contains 1 skill mention/);

  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));

  try {
    assert.doesNotThrow(() => guardJudgeBlindness(leaked, true));
  } finally {
    console.warn = original;
  }

  assert.match(warnings.join("\n"), /graded anyway per --allow-skill-mention/);
  assert.match(warnings.join("\n"), /output\/answer\.md:1/);
});
