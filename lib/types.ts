export type Variant = "no_skill" | "with_skill";

export type WorkspaceSpec =
  | {
      repo: string;
      commit: string;
      template?: never;
    }
  | {
      repo?: never;
      commit?: never;
      template: string;
    };

export type TaskSpec = {
  id: string;
  skill: string;
  domain: string;
  input: string;
  workspace: WorkspaceSpec;
  skill_source: {
    path: string;
  };
  verifier: string;
  expect?: string[];
  runs_per_variant: number;
  notes?: string;
};

export type AssertionStatus = "pass" | "fail";

export type ResultOutcome =
  | "pass"
  | "task_fail"
  | "cheat"
  | "infra_error"
  | "timeout"
  | "judge_error";

export type ResultRecord = {
  task_id: string;
  run_id: string;
  variant: Variant;
  forced: boolean;
  model: string | null;
  skill_version: string | null;
  outcome: ResultOutcome;
  score: number;
  max_score: number;
  assertions: Record<string, AssertionStatus>;
  expects: Record<string, AssertionStatus>;
  metrics: {
    seconds: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
  };
  failure_tags: string[];
  artifacts: {
    diff: string;
    transcript: string;
  };
};

export type RunMetadata = {
  task_id: string;
  run_id: string;
  variant: Variant;
  forced: boolean;
  created: string;
  workspace: string;
  skill_version: string | null;
  skill_installed: boolean;
};

export type VerifierReport = {
  assertions: Record<string, AssertionStatus>;
  score?: number;
  maxScore?: number;
  notes?: string;
};

export type Verifier = (workspacePath: string) => Promise<VerifierReport>;
