import path from "node:path";
import { operatorCodexHome, operatorCodexModel, operatorCodexReasoningEffort } from "./codex-home.js";
import { catalogEfforts, loadCatalog, pinCatalog, pinnedCatalogPath } from "./opencode-home.js";
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

// opencode's are per model, not per CLI: `--variant` maps to `reasoning.effort`, and the
// values a model takes are in the models catalog (kimi-k3 and glm-5.3: low, high, max — no
// medium). Checked here and not left to opencode, which accepts any variant name and silently
// runs at the model's default when it knows none of that name (seen on 1.18.15 with
// --variant bogus), so the record would name an effort that was never sent.
const opencodeEfforts = (model: string, flag: string): string[] => {
  const catalog = loadCatalog(pinCatalog());
  const efforts = catalogEfforts(catalog, model);

  if (efforts === null) {
    throw new Error(`${flag}: ${model} is not in the pinned opencode catalog ${pinnedCatalogPath()}; check \`opencode models\`, and delete the pinned copy to re-pin a fresher one`);
  }

  if (efforts.length === 0) {
    throw new Error(`${flag}: ${model} lists no reasoning efforts in the catalog, so opencode would send none whatever --variant says, and the record cannot name one`);
  }

  return efforts;
};

// Per executor, not per model: a model can still clamp a value its CLI accepts, which the
// record cannot see. The lists are what the two CLIs take, not a promise about any model.
// opencode has no fixed list; resolveEffort reads the model's own from the catalog.
const EFFORTS: Record<Executor, string[]> = { claude: CLAUDE_EFFORTS, codex: CODEX_EFFORTS, opencode: [] };

// Only codex keeps the settings the redirect drops in a file the harness can read; claude's
// own settings are out of reach behind --setting-sources project, so there is nothing to fall
// back to and the flag is the only source.
const OPERATOR_FALLBACK: Record<Executor, { model: () => string | null; effort: () => string | null }> = {
  claude: { model: () => null, effort: () => null },
  codex: { model: operatorCodexModel, effort: operatorCodexReasoningEffort },
  // opencode's own config is out of reach for the same reason claude's is: the harness
  // redirects it (lib/opencode-home.ts), so the flags are the only source.
  opencode: { model: () => null, effort: () => null },
};

const codexConfig = () => path.join(operatorCodexHome(), "config.toml");

// Every claude the harness spawns starts here, executor and judge alike, so the two cannot
// drift. The unset list is the point: claude reads CLAUDE_CODE_EFFORT_LEVEL from the
// environment, so an operator shell that exports it would decide the effort while the record
// named the flag's value — the record would be false, which is worse than absent. The two
// ANTHROPIC_* keys go for the older reason: a stray key silently swaps the account the run
// bills to and grades under.
export const CLAUDE_LAUNCH = [
  "-u", "ANTHROPIC_API_KEY",
  "-u", "ANTHROPIC_AUTH_TOKEN",
  "-u", "CLAUDE_CODE_EFFORT_LEVEL",
  "claude", "-p",
];

// codex runs under a redirected CODEX_HOME, so the operator's top-level settings are read here
// and passed on argv; claude has no such fallback, because --setting-sources project ignores
// the operator's own settings anyway.
const missing = (agent: Executor, flag: string, setting: string, accepted: string[] | null) =>
  new Error(
    agent === "codex"
      ? `missing ${flag}: no top-level ${setting} in ${codexConfig()}, and a record must name the ${setting === "model" ? "model" : "effort"} that ran`
      : agent === "opencode" && setting === "model"
        ? `missing ${flag}: a record must name the model that ran, as opencode names it (provider/model, e.g. openrouter/z-ai/glm-5.3)`
        : `missing ${flag}: a record must name the ${setting === "model" ? "model" : "effort"} that ran${accepted === null ? "" : ` (${accepted.join(", ")})`}`,
  );

export const resolveModel = (agent: Executor, requested: string | null, flag: string): string => {
  const model = requested ?? OPERATOR_FALLBACK[agent].model();

  if (model === null) {
    throw missing(agent, flag, "model", null);
  }

  return model;
};

// `model` is read for opencode only, whose accepted efforts depend on it.
export const resolveEffort = (agent: Executor, requested: string | null, flag: string, model: string | null = null): string => {
  const accepted = agent === "opencode" && model !== null ? opencodeEfforts(model, flag) : EFFORTS[agent];
  const effort = requested ?? OPERATOR_FALLBACK[agent].effort();

  if (effort === null) {
    throw missing(agent, flag, "model_reasoning_effort", accepted);
  }

  if (!accepted.includes(effort)) {
    throw new Error(`unknown ${flag} for ${agent}: ${effort} (expected ${accepted.join(", ")})`);
  }

  return effort;
};
