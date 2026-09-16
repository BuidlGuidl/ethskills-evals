import path from "node:path";
import { operatorCodexHome, operatorCodexModel, operatorCodexReasoningEffort } from "./codex-home.js";
import type { Executor } from "./types.js";

// Every run and every grade names the model and the effort it ran at (#118). A run pitched as
// "Opus 5 medium" that recorded neither cannot be told apart from one at another effort, so an
// unset value stops the command before anything is spawned rather than landing as null.
export const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];

// codex validates nothing locally: an unknown effort rides all the way to the API, which
// answers 400 `[reasoning.effort] [invalid_enum_value]` once the run is already under way —
// a burned run dir, or a record naming an effort that never ran. The list is the one that
// error names (probed on codex-cli 0.150.1, 2026-09-16).
export const CODEX_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

const EFFORTS: Record<Executor, string[]> = { claude: CLAUDE_EFFORTS, codex: CODEX_EFFORTS };

const codexConfig = () => path.join(operatorCodexHome(), "config.toml");

// codex runs under a redirected CODEX_HOME, so the operator's top-level settings are read here
// and passed on argv; claude has no such fallback, because --setting-sources project ignores
// the operator's own settings anyway.
export const resolveModel = (agent: Executor, requested: string | null, flag: string): string => {
  const model = requested ?? (agent === "codex" ? operatorCodexModel() : null);

  if (model === null) {
    throw new Error(
      agent === "codex"
        ? `missing ${flag}: no top-level model in ${codexConfig()}, and a record must name the model that ran`
        : `missing ${flag}: a record must name the model that ran`,
    );
  }

  return model;
};

export const resolveEffort = (agent: Executor, requested: string | null, flag: string): string => {
  const accepted = EFFORTS[agent];
  const effort = requested ?? (agent === "codex" ? operatorCodexReasoningEffort() : null);

  if (effort === null) {
    throw new Error(
      agent === "codex"
        ? `missing ${flag}: no top-level model_reasoning_effort in ${codexConfig()}, and a record must name the effort that ran`
        : `missing ${flag}: a record must name the effort that ran (${accepted.join(", ")})`,
    );
  }

  if (!accepted.includes(effort)) {
    throw new Error(`unknown ${flag} for ${agent}: ${effort} (expected ${accepted.join(", ")})`);
  }

  return effort;
};
