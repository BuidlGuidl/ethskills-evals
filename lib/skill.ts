import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

// One identity for a skill's text, used from both sides: setup records the id of the file
// it installed, and the results site groups runs by it. They have to agree, so neither may
// hash on its own terms.
//
// git prints a file trimmed and the filesystem does not, which had the same SKILL.md
// hashing as two versions differing by one newline. Normalise first, always.
export const normalizeSkillText = (text: string) => `${text.replace(/\s+$/, "")}\n`;

export const skillContentId = (text: string) =>
  createHash("sha256").update(normalizeSkillText(text)).digest("hex").slice(0, 12);

export const readSkillContentId = (skillDir: string) =>
  skillContentId(readFileSync(path.join(skillDir, "SKILL.md"), "utf8"));

// A skill's frontmatter `description` is its routing signal (#91): an agent with several
// skills installed reads every description and picks one. Parsed the way the descriptions
// test does, and thrown on the same faults, so a description that js-yaml rejects fails
// setup by name rather than installing nothing.
export const readSkillDescription = (skillDir: string) => {
  const text = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);

  if (match === null) {
    throw new Error(`${skillDir}/SKILL.md has no frontmatter`);
  }

  const loaded = yaml.load(match[1]);
  const description = loaded !== null && typeof loaded === "object" ? (loaded as Record<string, unknown>).description : undefined;

  if (typeof description !== "string" || description.trim().length === 0) {
    throw new Error(`${skillDir}/SKILL.md has no description`);
  }

  return description;
};

// A cede is a parenthesised list of backticked names: (`qa`), (`security`, `audit`). Matching
// the parenthetical itself, anywhere in the description, means a period inside the sentence
// ("e.g.", `scaffold.config`), a code token that is not a skill (`forge`), or a lowercase "not
// for" after a semicolon cannot hide or invent one. A backticked name outside parentheses is a
// mention, not a cede — a description may talk about a neighbour without handing it anything.
const CEDE = /\(\s*(`[a-z0-9-]+`(?:\s*(?:,|or|,\s*or)\s*`[a-z0-9-]+`)*)\s*\)/g;

export const cedes = (description: string) =>
  [...description.matchAll(CEDE)].flatMap(m => [...m[1].matchAll(/`([a-z0-9-]+)`/g)].map(n => n[1]));

// Every skill dir under skillsDir that has a SKILL.md, sorted.
export const listSkills = (skillsDir: string) =>
  readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
    .map(entry => entry.name)
    .sort();

// The skills a routing run installs beside `name`: the ones its description cedes to, and the
// ones whose descriptions cede to it. Both directions, because a cede only matters when the
// two skills are installed together, and which side wrote it does not change which one the
// agent should pick. A cede to a name that is not a skill is dropped here, not refused — the
// descriptions test is where that is caught.
export const routingNeighbours = (skillsDir: string, name: string) => {
  const names = listSkills(skillsDir);
  const description = (skill: string) => readSkillDescription(path.join(skillsDir, skill));
  const outgoing = cedes(description(name)).filter(target => names.includes(target));
  const incoming = names.filter(other => other !== name && cedes(description(other)).includes(name));

  return [...new Set([...outgoing, ...incoming])].filter(skill => skill !== name).sort();
};
