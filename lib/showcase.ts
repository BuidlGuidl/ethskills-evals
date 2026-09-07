import { existsSync, readFileSync } from "node:fs";
import { isRecord } from "./task.js";
import { parseTranscriptStats, parseUsageRecord } from "./usage.js";
import type { Entry, Run } from "../site/src/lib/types.js";

export const loadShowcase = (filePath: string): Entry[] | null => {
  if (!existsSync(filePath)) {
    return null;
  }

  const loaded: unknown = JSON.parse(readFileSync(filePath, "utf8"));

  if (!isRecord(loaded) || !Array.isArray(loaded.entries)) {
    throw new Error(`${filePath} must contain an entries array`);
  }

  const pairs = new Set<string>();

  return loaded.entries.map((entry: unknown, position: number) => {
    if (!isRecord(entry) || !["skill", "model", "before", "after"].every(key => typeof entry[key] === "string" && entry[key].length > 0)) {
      throw new Error(`${filePath}: entry ${position + 1} must name a skill, model, before and after`);
    }

    const pair = `${entry.skill}/${entry.model}`;

    if (pairs.has(pair)) {
      throw new Error(`${filePath}: duplicate entry for ${pair}`);
    }

    pairs.add(pair);

    return entry as Entry;
  });
};

// Older reports name one model for executor and judge. Only the explicit same-agent flag
// permits that fallback; a blind judge on another stack says nothing about the executor.
export const runModel = (record: Record<string, unknown>) => {
  if (typeof record.executor_model === "string") {
    return record.executor_model;
  }

  const judge = record.judge;

  return isRecord(judge) && judge.self_judged === true && typeof judge.model === "string"
    ? judge.model
    : `${typeof record.executor === "string" ? record.executor : "executor"}-unknown`;
};

// Match run-stats: the transcript wins field by field, with the record filling gaps.
export const runUsage = (text: string, value: unknown): Run["usage"] => {
  const transcript = parseTranscriptStats(text);
  const recorded = parseUsageRecord(value);

  return {
    tokens: transcript?.total_tokens ?? recorded?.total_tokens ?? null,
    duration_s: transcript?.duration_s ?? recorded?.duration_s ?? null,
    cost_usd: transcript?.cost_usd ?? recorded?.cost_usd ?? null,
    turns: transcript?.turns ?? recorded?.turns ?? null,
  };
};

type SelectionRun = Pick<Run, "task" | "skill" | "model" | "variant" | "skill_content" | "superseded_by" | "retracted" | "pass">;

type ShowcaseData = {
  skills: { name: string; versions: { id: string; runs: number }[] }[];
  tasks: { id: string; skill: string; status: string }[];
  runs: (Omit<SelectionRun, "variant"> & { variant: unknown })[];
  reports: { skill: string }[];
  prs: { skill: string | null }[];
};

export const selectShowcase = <Data extends ShowcaseData>(index: Data, entries: Entry[]) => {
  const names = new Set(entries.map(entry => entry.skill));
  const tasks = index.tasks.filter(task => names.has(task.skill) && task.status === "live");
  const live = new Set(tasks.map(task => task.id));
  const runs = index.runs.filter(run =>
    live.has(run.task) && run.superseded_by === null && run.retracted === null && run.pass !== null &&
    entries.some(entry => run.skill === entry.skill && run.model === entry.model &&
      (run.variant === "no_skill" || (run.variant === "with_skill" && (run.skill_content === entry.before || run.skill_content === entry.after)))),
  );
  const warnings: string[] = [];

  for (const entry of entries) {
    for (const side of ["before", "after"] as const) {
      if (!runs.some(run => run.skill === entry.skill && run.model === entry.model && run.variant === "with_skill" && run.skill_content === entry[side])) {
        warnings.push(`showcase ${entry.skill} (${entry.model}): ${side} version ${entry[side]} selects no runs`);
      }
    }
  }

  const reportSkill = (skill: string) => [...names].sort((a, b) => b.length - a.length).find(name => skill === name || skill.startsWith(`${name}-`));

  const skills = index.skills.filter(skill => names.has(skill.name)).map(skill => {
    const ids = new Set(entries.filter(entry => entry.skill === skill.name).flatMap(entry => [entry.before, entry.after]));

    return {
      ...skill,
      versions: skill.versions.filter(version => ids.has(version.id)).map(version => ({
        ...version,
        runs: runs.filter(run => run.skill === skill.name && run.variant === "with_skill" && run.skill_content === version.id).length,
      })),
    };
  });

  return {
    showcase: entries,
    skills,
    tasks,
    runs,
    reports: index.reports.filter(report => reportSkill(report.skill) !== undefined).map(report => ({ ...report, skill: reportSkill(report.skill)! })),
    prs: index.prs.filter(pr => pr.skill !== null && names.has(pr.skill)),
    warnings,
  };
};
