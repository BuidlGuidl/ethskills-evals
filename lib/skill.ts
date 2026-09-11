import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

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
