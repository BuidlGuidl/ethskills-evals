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
  variants: string[];
  variant_overlays?: Record<string, string>;
  skill_source?: {
    path: string;
  };
  verifier: {
    type: string;
    file: string;
  };
  success_metric: string;
  runs_per_variant: number;
  notes?: string;
};

export type AssertionStatus = "pass" | "fail";

export type ResultRecord = {
  task_id: string;
  run_id: string;
  variant: string;
  model: string | null;
  skill_version: string | null;
  pass: boolean;
  score: number;
  max_score: number;
  assertions: Record<string, AssertionStatus>;
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
  variant: string;
  created: string;
  workspace: string;
  skill_version: string | null;
  skill_installed: boolean;
  overlay_applied: boolean;
};

export type VerifierReport = {
  assertions: Record<string, AssertionStatus>;
  score?: number;
  maxScore?: number;
  notes?: string;
};

export type Verifier = (workspacePath: string) => Promise<VerifierReport>;
