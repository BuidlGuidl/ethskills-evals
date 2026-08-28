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
  /** a later regrade re-read this run; the two must never land in one tally */
  superseded_by: string | null;
  rubric: string | null;
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
  text: string;
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
  input: string;
  expect: string[];
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
  markdown: string;
};

export type PullRequest = {
  number: number;
  title: string;
  body: string;
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
