import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// opencode's version of the isolation codex gets from CODEX_HOME (lib/codex-home.ts). Left
// alone, a run reads the operator's ~/.config/opencode (config, AGENTS.md, skills/, plugins/,
// agents/), ~/.opencode (the same set again — opencode reads that dir whatever XDG says),
// ~/.claude/CLAUDE.md, every skill under ~/.claude/skills and ~/.agents/skills, every
// OPENCODE_* variable in the shell, and every provider whose API key is in the shell. A
// global skill on the task's subject then reaches the no_skill variant, and nothing in the
// record says so. There is no single home variable, so it takes several levers:
//
// - The child environment is rebuilt: every OPENCODE_* and OTEL_* variable is dropped, and
//   so is every provider key the pinned catalog names, OPENROUTER_API_KEY included. A key
//   left in the environment enables its provider, and the bash tool inherits the whole
//   environment, so a debugging `env` would land the key in a committed transcript. The
//   OpenRouter key goes into an auth.json in the run's own data dir instead, and is deleted
//   when the run ends.
// - XDG_CONFIG_HOME points into .opencode-home/config here (shared, empty of settings — the
//   node_modules opencode installs there for its plugins are the same for everyone);
//   XDG_DATA_HOME and XDG_STATE_HOME point into a dir per run, because the data dir carries
//   tool-output/ and workspace snapshots that a later run can read (codex's --ephemeral is
//   the same fix). The cache dir stays the operator's: it holds downloaded LSP servers,
//   which carry no run content, and the models catalog, which is pinned separately below.
// - ~/.opencode and the managed dirs cannot be redirected, so the run is refused while they
//   hold anything opencode would load.
// - OPENCODE_DISABLE_EXTERNAL_SKILLS drops the .claude/ and .agents/ skill dirs, global and
//   project alike; there is no flag that keeps the project copy and drops the global one, so
//   setup installs the skill at .opencode/skills/ for opencode runs, the one place left.
// - OPENCODE_DISABLE_CLAUDE_CODE drops ~/.claude/CLAUDE.md and CLAUDE.md up the tree.
// - OPENCODE_CONFIG_CONTENT carries the harness's own settings and outranks any opencode.json
//   the workspace holds or the executor writes: sharing off (an operator's `share: auto`
//   would publish the session), the `task` tool off (subagent spend never reaches the parent
//   session's step_finish events, and `--auto` never answers a subagent's permission prompt,
//   so a run that delegates either under-reports or hangs), and small_model pinned to the
//   run's model so no auxiliary call lands on another one.
// - The models catalog is pinned: opencode refreshes ~/.cache/opencode/models.json hourly,
//   and it is where a model's accepted efforts and prices come from, so a benchmark would
//   otherwise straddle a catalog change. The first opencode run copies the operator's into
//   .opencode-home/models.json and every run reads that copy; delete it to re-pin.
//
// What this does not do: pin OpenRouter's routing. OpenRouter picks a provider per request
// for these models, with different quantizations and context limits behind one name, and
// opencode sends no provider preferences. Pinning takes a provider order the harness has no
// basis to choose, so the record names the model and not who served it — a stated gap in the
// stack rule, see AGENTS.md.
export const operatorOpencodeDir = () => path.join(homedir(), ".opencode");

// Where opencode's managed settings live (docs: config, "Managed settings"); read by every
// opencode on the machine and redirected by nothing.
export const MANAGED_OPENCODE_DIRS = process.platform === "darwin"
  ? ["/Library/Application Support/opencode", "/etc/opencode"]
  : process.platform === "win32" ? [path.join(process.env.ProgramData ?? "C:\\ProgramData", "opencode")] : ["/etc/opencode"];

// What opencode loads from a config dir. ~/.opencode also holds opencode's own npm install
// for its plugins (package.json, node_modules/, bin/), which is not configuration.
const CONFIG_ENTRIES = new Set([
  "opencode.json", "opencode.jsonc", "config.json",
  "agent", "agents", "command", "commands", "mode", "modes",
  "plugin", "plugins", "skill", "skills", "tool", "tools", "themes",
]);

export const operatorConfigFound = (operatorDir = operatorOpencodeDir(), managedDirs = MANAGED_OPENCODE_DIRS): string[] => {
  const found: string[] = [];

  if (existsSync(operatorDir)) {
    for (const entry of readdirSync(operatorDir)) {
      if (CONFIG_ENTRIES.has(entry)) {
        found.push(path.join(operatorDir, entry));
      }
    }
  }

  for (const managed of managedDirs) {
    if (existsSync(managed)) {
      found.push(managed);
    }
  }

  return found;
};

export const harnessOpencodeHome = () => path.resolve(process.env.EVAL_OPENCODE_HOME || path.join(HARNESS_ROOT, ".opencode-home"));

// Per run, under the harness home rather than the run dir: the data dir holds the credential
// for the length of the run, and artifacts/ is what gets committed.
export const opencodeRunHome = (runDir: string) => {
  const resolved = path.resolve(runDir);

  return path.join(harnessOpencodeHome(), "runs", path.basename(path.dirname(resolved)), path.basename(resolved));
};

const authPath = (runDir: string) => path.join(opencodeRunHome(runDir), "data", "opencode", "auth.json");

// Written under a unique name and renamed into place, as codex-home does: two runs may
// overlap, and a half-written file is worse than none.
const replaceFile = (target: string, contents: string, mode?: number) => {
  const staging = `${target}.${process.pid}.tmp`;

  writeFileSync(staging, contents, mode === undefined ? undefined : { mode });

  try {
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }
};

// --- the pinned catalog -------------------------------------------------------------------

export const operatorCatalogPath = () =>
  path.join(process.env.XDG_CACHE_HOME || path.join(homedir(), ".cache"), "opencode", "models.json");

export const pinnedCatalogPath = () => path.join(harnessOpencodeHome(), "models.json");

export const pinCatalog = (): string => {
  const pinned = pinnedCatalogPath();

  if (existsSync(pinned)) {
    return pinned;
  }

  const source = operatorCatalogPath();

  if (!existsSync(source)) {
    throw new Error(`no opencode models catalog at ${source}; run \`opencode models\` once so opencode fetches it, then retry`);
  }

  mkdirSync(path.dirname(pinned), { recursive: true });

  const staging = `${pinned}.${process.pid}.tmp`;

  copyFileSync(source, staging);
  renameSync(staging, pinned);

  return pinned;
};

type CatalogModel = {
  reasoning?: boolean;
  reasoning_options?: { type?: string; values?: string[] }[];
};

export type Catalog = Record<string, { env?: string[]; models?: Record<string, CatalogModel> }>;

export const loadCatalog = (file: string): Catalog => JSON.parse(readFileSync(file, "utf8")) as Catalog;

// The efforts `--variant` can name for a model, read from the same catalog opencode reads
// them from: an `effort` entry under reasoning_options lists them; a reasoning model with
// no such entry gets opencode's own default set for an OpenRouter model (low, medium,
// high — provider/transform.ts); a model without reasoning takes none, and cannot be run,
// because the record has to name an effort that was actually sent. null when the catalog
// does not know the model at all.
export const catalogEfforts = (catalog: Catalog, model: string): string[] | null => {
  const slash = model.indexOf("/");

  if (slash === -1) {
    return null;
  }

  const entry = catalog[model.slice(0, slash)]?.models?.[model.slice(slash + 1)];

  if (entry === undefined) {
    return null;
  }

  const listed = (entry.reasoning_options ?? []).find(option => option.type === "effort")?.values;

  if (listed !== undefined) {
    return listed;
  }

  return entry.reasoning === true ? ["low", "medium", "high"] : [];
};

// Every environment variable that would enable a provider other than OpenRouter: the
// catalog names them per provider, so the list is as long as the catalog and never typed
// by hand (218 providers, 2026-09-16).
export const catalogProviderEnv = (catalog: Catalog): string[] => {
  const names = new Set<string>();

  for (const [provider, entry] of Object.entries(catalog)) {
    if (provider === "openrouter") {
      continue;
    }

    for (const name of entry.env ?? []) {
      names.add(name);
    }
  }

  return [...names].sort();
};

// --- the run's command line and environment ------------------------------------------------

// share off, task off, small_model pinned: see the block at the top. permission.task is the
// belt to tools.task's brace — either alone keeps a subagent from starting.
export const opencodeConfig = (model: string) => ({
  share: "disabled",
  small_model: model,
  tools: { task: false },
  permission: { task: "deny" },
});

// --format json because it is the only place opencode reports its tokens and its price.
// --auto approves every permission (claude's --dangerously-skip-permissions). --dir because
// opencode takes its project root from $PWD, not from the cwd it is spawned in (the env
// below sets PWD too; this is the belt to that brace). --title because without it opencode
// makes a separate model call to name the session, which reports no step_finish and so
// would be spend the record never sees. --variant is the effort, checked first by
// lib/effort.ts because opencode itself accepts any name. The prompt comes on stdin.
export const opencodeArgs = (model: string, effort: string, workspacePath: string, title: string) => [
  "run", "--format", "json", "--auto", "--dir", workspacePath, "--title", title, "--variant", effort, "-m", model,
];

export type OpencodeRun = { runDir: string; workspacePath: string; model: string };

export const opencodeEnv = ({ runDir, workspacePath, model }: OpencodeRun): NodeJS.ProcessEnv => {
  const home = harnessOpencodeHome();

  if (home === operatorOpencodeDir()) {
    throw new Error(`EVAL_OPENCODE_HOME is the operator's own ${home}; the harness home must be separate from it.`);
  }

  const found = operatorConfigFound();

  if (found.length > 0) {
    throw new Error(
      `opencode would load the operator's own configuration: ${found.join(", ")}. `
        + "opencode reads ~/.opencode and its managed dirs whatever the harness sets, so move them aside for the benchmark.",
    );
  }

  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    throw new Error("no opencode credentials: OPENROUTER_API_KEY is unset, and the harness runs opencode on OpenRouter only.");
  }

  const catalogPath = pinCatalog();
  const catalog = loadCatalog(catalogPath);
  const runHome = opencodeRunHome(runDir);

  mkdirSync(path.join(home, "config"), { recursive: true });
  mkdirSync(path.dirname(authPath(runDir)), { recursive: true });
  mkdirSync(path.join(runHome, "state"), { recursive: true });
  replaceFile(authPath(runDir), `${JSON.stringify({ openrouter: { type: "api", key } }, null, 2)}\n`, 0o600);

  const dropped = new Set([...catalogProviderEnv(catalog), "OPENROUTER_API_KEY"]);
  const env: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(process.env)) {
    if (/^(?:OPENCODE_|OTEL_)/.test(name) || dropped.has(name)) {
      continue;
    }

    env[name] = value;
  }

  return {
    ...env,
    XDG_CONFIG_HOME: path.join(home, "config"),
    XDG_DATA_HOME: path.join(runHome, "data"),
    XDG_STATE_HOME: path.join(runHome, "state"),
    OPENCODE_MODELS_PATH: catalogPath,
    OPENCODE_DISABLE_MODELS_FETCH: "1",
    OPENCODE_DISABLE_EXTERNAL_SKILLS: "1",
    OPENCODE_DISABLE_CLAUDE_CODE: "1",
    // Registers opencode's websearch tool, off by default while claude and codex search out
    // of the box; without EXA_API_KEY it uses Exa's shared public endpoint.
    OPENCODE_ENABLE_EXA: "1",
    // opencode clamps every model's output to 32k tokens and OpenRouter counts reasoning
    // inside that limit, so a long think ate the answer (agents-arena-backend's finding);
    // opencode min's this against the model's real maximum.
    OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: "64000",
    OPENCODE_CONFIG_CONTENT: JSON.stringify(opencodeConfig(model)),
    PWD: path.resolve(workspacePath),
  };
};

// The credential lives only as long as the run: the run's data dir stays for debugging, the
// key does not.
export const forgetOpencodeCredential = (runDir: string) => {
  rmSync(authPath(runDir), { force: true });
};
