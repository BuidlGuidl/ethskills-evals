// Which of the skills installed in a workspace the executor loaded, read from transcript.md.
//
// The transcript is the executor-neutral surface: all three renderers in lib/transcript.ts
// put every tool call on a line of the shape `- **<tool>** \`<input>\`` and every tool result
// under `  > `. So a Skill call is a line whose tool is `Skill`, and a read of a skill by path
// (codex and opencode have no Skill tool — they `sed` or `read` the file) is any other tool
// line naming `skills/<name>/SKILL.md`. Tool output is not consulted: an `ls -R` of the
// workspace names every installed skill's path, and that is the executor listing, not loading.
//
// Reading the rendered transcript rather than the raw capture also means the record can be
// re-derived from a committed run, where the capture is gitignored.
const TOOL_LINE = /^- \*\*([^*]+)\*\* `(.*)`/;
const SKILL_PATH = /skills[\\/]([a-z0-9-]+)[\\/]SKILL\.md/g;

// claude's Skill input is `{"skill": "<name>"}`, sometimes with `args`; the renderer prints it
// as JSON because none of the keys it summarises by are present. A bare name is accepted too.
const skillArgument = (summary: string) => {
  try {
    const parsed: unknown = JSON.parse(summary);

    return parsed !== null && typeof parsed === "object" && typeof (parsed as { skill?: unknown }).skill === "string"
      ? (parsed as { skill: string }).skill
      : null;
  } catch {
    return /^[a-z0-9-]+$/.test(summary) ? summary : null;
  }
};

// In the order the executor first reached for each one: for a routing run the first name is
// the routing decision, and the rest are what it went on to read.
export const loadedSkills = (transcript: string, installed: string[]): string[] => {
  const loaded: string[] = [];
  const note = (name: string | null) => {
    if (name !== null && installed.includes(name) && !loaded.includes(name)) {
      loaded.push(name);
    }
  };

  for (const line of transcript.split("\n")) {
    const match = TOOL_LINE.exec(line);

    if (match === null) {
      continue;
    }

    const [, tool, summary] = match;

    if (tool === "Skill") {
      note(skillArgument(summary));
      continue;
    }

    for (const hit of summary.matchAll(SKILL_PATH)) {
      note(hit[1]);
    }
  }

  return loaded;
};
