export type Variant = "no_skill" | "with_skill";
export type ExpectStatus = "pass" | "fail";

export type Run = {
  task: string;
  skill: string | null;
  run: string;
  variant: Variant | null;
  executor: string | null;
  executor_model: string | null;
  created: string | null;
  pass: boolean | null;
  expects: Record<string, ExpectStatus> | null;
  judge: { agent: string; model: string | null; self_judged: boolean } | null;
  skill_version: string | null;
  skill_content: string | null;
  /** this record re-judges that run's stored evidence; it is a second reading, not a second run */
  regrade_of: string | null;
  regraded_at: string | null;
  /** a later regrade re-read this run; the two must never land in one tally */
  superseded_by: string | null;
  /** the source run this record is a reading of — itself, for a run read once */
  lineage: string;
  /** 0 for the source, then each regrade in the order it was made */
  reading: number;
  /** why this grade measures the harness rather than the model; such a run is kept and never counted */
  retracted: string | null;
  /** fingerprint of the expect lines this run was graded against */
  rubric: string | null;
  /** fingerprint of the prompt this run was given */
  prompt: string | null;
  rubric_expects: number | null;
  transcript_url: string | null;
};

export type SkillVersion = {
  id: string;
  sha: string;
  lines: number;
  words: number;
  runs: number;
  in_repo: boolean;
};

export type Skill = {
  name: string;
  original: string | null;
  latest_measured: string | null;
  current: string | null;
  versions: SkillVersion[];
};

export type Task = {
  id: string;
  skill: string;
  kind: "quiz" | "goal";
  /** retired tasks are kept for the runs that were graded on them, and are not run again */
  status: "live" | "retired";
  input: string;
  expect: string[];
  /** the fingerprint of today's expect lines; a run graded on an earlier revision carries another */
  rubric: string | null;
  /** the fingerprint of today's prompt */
  prompt: string | null;
  runs: number;
  template: string | null;
  notes: string | null;
};

export type Report = {
  file: string;
  title: string;
  date: string | null;
  skill: string;
  url: string;
};

export type PullRequest = {
  number: number;
  title: string;
  url: string;
  merged_at: string | null;
  state: string;
  skill: string | null;
  reports: string[];
};

export type Index = {
  generated: { at: string; commit: string | null; dirty: boolean; repo: string };
  skills: Skill[];
  tasks: Task[];
  runs: Run[];
  reports: Report[];
  prs: PullRequest[];
  warnings: string[];
};

/** the prose, fetched only when a report or skill page opens: report markdown, pull request bodies, skill texts */
export type Docs = {
  reports: Record<string, string>;
  prs: Record<string, string>;
  skills: Record<string, string>;
};
