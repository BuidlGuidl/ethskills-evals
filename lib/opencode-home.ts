import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// opencode's version of the isolation codex gets from CODEX_HOME (lib/codex-home.ts). Left
// alone, a run reads the operator's ~/.config/opencode (config, AGENTS.md, skills/, plugins/,
// agents/), ~/.claude/CLAUDE.md, and every skill under ~/.claude/skills and ~/.agents/skills.
// A global skill on the task's subject then reaches the no_skill variant, and nothing in the
// record says so. There is no single home variable, so it takes four levers:
//
// - XDG_CONFIG_HOME / XDG_DATA_HOME / XDG_STATE_HOME point into .opencode-home/ here, so the
//   operator's config dir and data dir (auth.json, session db, logs) are never read. The cache
//   dir stays the operator's: it holds the models list and downloaded LSP servers, which are
//   the same for everyone and carry no run content.
// - OPENCODE_DISABLE_EXTERNAL_SKILLS drops the .claude/ and .agents/ skill dirs, global and
//   project alike. The skill under test is installed at .opencode/skills/ instead (setup),
//   which opencode reads natively; there is no flag that keeps the project copy and drops
//   the global one.
// - OPENCODE_DISABLE_CLAUDE_CODE drops ~/.claude/CLAUDE.md and CLAUDE.md up the tree.
// - OPENCODE_DB puts the session db inside the run dir (gitignored), so one run's session,
//   skill text included, is not on disk for the next run to find — codex's --ephemeral.
//
// And PWD. opencode resolves its project root from $PWD before process.cwd() (cli/cmd/run.ts),
// and a spawned child inherits the shell's PWD, not the cwd it was given: the first end-to-end
// run (2026-09-16) took this repo for its project, read AGENTS.md here, answered as "the
// orchestrator" and wrote answer.md into this checkout, while the workspace stayed empty and
// graded 0/3. PWD is set to the workspace here, and run-executor passes --dir as well.
//
// Credentials: the data-dir redirect hides the operator's auth.json on purpose, so the only
// credential is OPENROUTER_API_KEY, which opencode reads from the environment. Every run is
// then on OpenRouter and on no other login of the operator's, and the key is what the
// record's model name (openrouter/<vendor>/<model>) assumes.
export const operatorOpencodeConfig = () =>
  path.resolve(process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "opencode");

export const harnessOpencodeHome = () => path.resolve(process.env.EVAL_OPENCODE_HOME || path.join(HARNESS_ROOT, ".opencode-home"));

export const OPENCODE_DB_FILE = "opencode.db";

// arena's two settings, for the same reasons: opencode clamps every model's output to 32k
// tokens and OpenRouter counts reasoning inside that limit, so a long think ate the answer
// (opencode min's the value against the model's real max); and opencode's websearch tool is
// off by default while claude and codex search out of the box. Without EXA_API_KEY the search
// goes through Exa's shared public endpoint.
const OPENCODE_SETTINGS: NodeJS.ProcessEnv = {
  OPENCODE_DISABLE_EXTERNAL_SKILLS: "1",
  OPENCODE_DISABLE_CLAUDE_CODE: "1",
  OPENCODE_DISABLE_AUTOUPDATE: "1",
  OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: "64000",
  OPENCODE_ENABLE_EXA: "1",
};

export const opencodeEnv = (runDir: string, workspacePath: string): NodeJS.ProcessEnv => {
  const home = harnessOpencodeHome();
  const config = path.join(home, "config");

  // Same guard as codex-home: pointing the harness at the operator's own dir would make the
  // redirect a no-op and hide it.
  if (path.join(config, "opencode") === operatorOpencodeConfig()) {
    throw new Error(
      `EVAL_OPENCODE_HOME resolves to the operator's own opencode config (${operatorOpencodeConfig()}); `
        + "the harness home must be separate, or the run reads the operator's config and skills.",
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("no opencode credentials: OPENROUTER_API_KEY is unset, and the harness runs opencode on OpenRouter only.");
  }

  if (!existsSync(runDir)) {
    throw new Error(`no run dir at ${runDir}`);
  }

  for (const dir of ["config", "data", "state"]) {
    mkdirSync(path.join(home, dir), { recursive: true });
  }

  return {
    ...process.env,
    ...OPENCODE_SETTINGS,
    XDG_CONFIG_HOME: config,
    XDG_DATA_HOME: path.join(home, "data"),
    XDG_STATE_HOME: path.join(home, "state"),
    OPENCODE_DB: path.join(path.resolve(runDir), OPENCODE_DB_FILE),
    PWD: path.resolve(workspacePath),
  };
};
