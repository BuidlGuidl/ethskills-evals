import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import yaml from "js-yaml";

// A skill's `description` is the routing signal (#91): the agent reads every description and
// picks one. Two descriptions claiming the same input is a coin flip, and a "Not for (`x`)"
// clause is the only thing that breaks the tie — so every such clause has to point at a skill
// that exists, and every pair of skills that name each other has to agree on who owns what.
// #74 and #95 were both found by hand after a run went inert; this keeps the table honest
// without re-reading twelve descriptions per PR.

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

// Every backticked token in a description that is also a skill name is a cross-reference.
// `forge` in testing's description is a tool, not a skill, and is left alone by this rule.
const references = (description: string) =>
  [...description.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]).filter((token) => skillNames.includes(token));

// Sentences end at a period followed by whitespace or the end of the string. A period inside a
// token (`scaffold.config`, `block.timestamp`) is not a sentence boundary.
const sentences = (description: string) => description.split(/\.(?=\s|$)/).map((s) => s.trim()).filter(Boolean);

// A "Not for … (`x`)" sentence cedes an input to x. Every such sentence is inspected, and the
// name inside has to resolve even when it is not (or no longer) a skill — a retired name here
// is exactly the rot this test exists for.
const cedes = (description: string) =>
  sentences(description)
    .filter((sentence) => /\bNot for\b/.test(sentence))
    .flatMap((sentence) => [...sentence.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]));

// Cedes that are one-way on purpose. The target is a narrower skill nobody confuses with
// the source on its own input, so it has nothing to hand back. Adding a pair here is the
// decision; leaving it out fails the test until someone makes it.
const ONE_WAY: Record<string, string> = {
  "building-blocks->addresses": "addresses is a lookup; nothing in it reads as protocol integration",
  "building-blocks->l2s": "l2s picks a chain; it never names a DEX or lending market",
  "frontend-playbook->frontend-ux": "frontend-ux never mentions scaffolding, forks, or IPFS; nothing to hand back",
  "gas->l2s": "l2s owns non-cost chain choice and does not quote gas",
  "orchestration->frontend-ux": "frontend-ux never mentions launch, deploy, or a live network; nothing to hand back",
  "orchestration->qa": "qa's pre-ship checklist is UI-only and never claims deploy or launch order",
  "protocol->l2s": "l2s compares chains, never whether an EIP is live",
  "protocol->standards": "standards covers deployed ERCs; protocol asks about fork status",
  "security->audit": "audit is the offensive review; it already sends implementation to security in prose",
  "testing->audit": "audit is the offensive review of source; it never claims running or designing tests",
  "tools->addresses": "addresses is a lookup; nothing in it reads as package choice",
};

test("every skill has a name matching its directory and a description", () => {
  for (const [name, fm] of loadDescriptions()) {
    assert.equal(fm.name, name, `${name}: frontmatter name is ${String(fm.name)}`);
    assert.equal(typeof fm.description, "string", `${name}: description missing`);
    assert.ok((fm.description as string).trim().length > 0, `${name}: description empty`);
  }
});

test("every Not-for sentence names at least one skill, and each one exists", () => {
  for (const [name, fm] of loadDescriptions()) {
    const description = fm.description as string;

    for (const sentence of sentences(description).filter((s) => /\bNot for\b/.test(s))) {
      assert.ok(/`[a-z0-9-]+`/.test(sentence), `${name}: "${sentence}" cedes to nobody — name the skill in backticks`);
    }

    for (const target of cedes(description)) {
      assert.ok(skillNames.includes(target), `${name} cedes to \`${target}\`, which is not a skill in skills/`);
      assert.notEqual(target, name, `${name} cedes to itself`);
    }
  }
});

test("every cede is reciprocated or recorded as one-way", () => {
  const descriptions = loadDescriptions();
  const unrecorded: string[] = [];

  for (const [name, fm] of descriptions) {
    for (const target of cedes(fm.description as string)) {
      // Reciprocated means the target cedes something back, not that it mentions the source
      // in passing — a mention with no cede leaves the coin flip in place.
      const back = cedes(descriptions.get(target)!.description as string).includes(name);

      if (!back && !(`${name}->${target}` in ONE_WAY)) {
        unrecorded.push(`${name} says "Not for … (\`${target}\`)" but ${target}'s description never cedes anything to \`${name}\``);
      }
    }
  }

  assert.deepEqual(unrecorded, [], "Either add the reciprocal clause or record why the cede is one-way in ONE_WAY");
});

test("ONE_WAY lists only cedes that exist and are still one-way", () => {
  const descriptions = loadDescriptions();

  for (const key of Object.keys(ONE_WAY)) {
    const [name, target] = key.split("->");
    const fm = descriptions.get(name);

    assert.ok(fm, `ONE_WAY names ${name}, which is not a skill`);
    assert.ok(cedes(fm.description as string).includes(target), `ONE_WAY has ${key}, but ${name} no longer cedes to ${target}`);
    assert.ok(
      !references(descriptions.get(target)!.description as string).includes(name),
      `ONE_WAY has ${key}, but ${target} now names \`${name}\` — drop the entry`,
    );
  }
});
