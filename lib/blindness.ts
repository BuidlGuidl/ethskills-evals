// Excluding SKILL_INSTALL_DIRS from the evidence paths (lib/evidence.ts) keeps the skill
// FILES out, but it cannot keep the skill out of files the executor WROTE. A with_skill run
// that cites its source in answer.md — "per .claude/skills/standards/SKILL.md" — hands the
// judge the variant just as surely as a leaked directory would, and that is not hypothetical:
// 4 of 9 with_skill runs across the standards quizzes did it in #35, one printing the install
// path verbatim. Task preambles were reworded per-task afterwards, which fixes the tasks
// edited and nothing else. This list is the harness-level check, so the blindness invariant
// holds for every task, present and future, and not just the ones someone remembered to edit.
export const SKILL_MENTION_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "skill install path", pattern: /\.(?:claude|agents)[\/\\]skills\b/i },
  { label: "SKILL.md reference", pattern: /\bSKILL\.md\b/i },
  { label: "skill self-reference", pattern: /\b(?:the|my|this|provided|installed|attached)\s+skill\b/i },
];

// Reported as file:line so the operator can read the hit and judge it, rather than being told
// only that something matched. Scans the assembled evidence because that is exactly the string
// the judge receives — checking the source files instead would miss whatever the diff header
// carries. buildEvidence concatenates the sections it labels `# run.diff` and `# output/<path>`,
// so the line is counted from each section header rather than from the top of the assembled
// string: `output/answer.md:8` has to be line 8 OF answer.md to be worth printing. A header that
// matches on its own — a file whose NAME leaks the skill — reports as line 0 of its own section.
export const findSkillMentions = (evidence: string) => {
  const hits: string[] = [];
  let section = "evidence";
  let lineInSection = 0;

  for (const line of evidence.split("\n")) {
    if (line.startsWith("# run.diff") || line.startsWith("# output/")) {
      section = line.slice(2);
      lineInSection = 0;
    } else {
      lineInSection += 1;
    }

    for (const { label, pattern } of SKILL_MENTION_PATTERNS) {
      if (pattern.test(line)) {
        hits.push(`  ${section}:${lineInSection}  [${label}]  ${line.trim().slice(0, 160)}`);
        break;
      }
    }
  }

  return hits;
};

// Aborts BEFORE the judge call rather than after: the executor run is already paid for and is
// not lost, only its grading is deferred, so stopping here costs one cheap re-invocation while
// grading on leaked evidence costs the comparison the whole repo exists to make. A mention is
// not always a leak — a no_skill run can say "the skill" about something else, and a task may
// legitimately be about skills — so this is a stop-and-look, cleared with --allow-skill-mention
// once the operator has read the hits and recorded the call in the run's report.
export const guardJudgeBlindness = (evidence: string, allowSkillMention: boolean) => {
  const hits = findSkillMentions(evidence);

  if (hits.length === 0) {
    return;
  }

  if (allowSkillMention) {
    console.warn(`verify: ${hits.length} skill mention(s) in evidence, graded anyway per --allow-skill-mention:`);
    console.warn(hits.join("\n"));
    return;
  }

  throw new Error(
    [
      `judge blindness: evidence contains ${hits.length} skill mention(s), so the judge would learn the variant.`,
      ...hits,
      "",
      "Read the hits. If a run genuinely leaked its variant, that run's grading is not comparable —",
      "record it as a run incident rather than grading it. If the matches are incidental, re-run with",
      "--allow-skill-mention to grade anyway; note the decision in the report either way.",
    ].join("\n"),
  );
};
