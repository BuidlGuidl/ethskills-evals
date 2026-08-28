import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// `CODEX_HOME` is the only lever that isolates a codex run from its operator. --ignore-user-config
// drops config.toml alone; ~/.codex/skills, plugins/, rules/ and memories are directory
// discovery and load regardless. An operator with a global codex skill on the task's subject
// therefore contaminates the no_skill variant — not noise, a straight A/B invalidation, and
// invisible in the record. Pointing CODEX_HOME at a harness-owned dir closes all of it at
// once, and is what --setting-sources project is trying to be on the claude side.
//
// The dir is machine-local state, not a run artifact: it is gitignored, shared by every run
// on the machine, and safe to delete (the next run rebuilds it). Not under the workspace root
// — a run can `ls` its way around up there, and this dir holds a link to a live credential.
export const operatorCodexHome = () => path.resolve(process.env.CODEX_HOME || path.join(homedir(), ".codex"));

export const harnessCodexHome = () => path.resolve(process.env.EVAL_CODEX_HOME || path.join(HARNESS_ROOT, ".codex-home"));

const CONFIG = `# Written by the eval harness (lib/codex-home.ts) and rewritten on every run.
#
# CODEX_HOME points here for every codex the harness spawns, so a run sees none of the
# operator's ~/.codex: no user config.toml, no global skills, plugins, rules or memories.
# The model is passed on the command line instead (-m), so it lands in executor.yaml.
#
# Keep this file empty of settings. Anything configured here is configured for every run on
# this machine and for nobody else's, which is the asymmetry the redirect exists to remove.
`;

// Symlink rather than copy: codex refreshes the token in place, so a copy goes stale mid
// benchmark and leaves a second live credential on disk. Writes through the link land in the
// operator's real auth.json, which is where codex login expects them.
const linkAuth = (home: string) => {
  const source = path.join(operatorCodexHome(), "auth.json");
  const link = path.join(home, "auth.json");

  if (!existsSync(source)) {
    // OPENAI_API_KEY is codex's other credential path and needs no file. Anything else is a
    // logged-out machine, and failing here beats burning a run on an auth error.
    if (process.env.OPENAI_API_KEY) {
      return;
    }

    throw new Error(`no codex credentials: ${source} does not exist and OPENAI_API_KEY is unset. Run codex login first.`);
  }

  const existing = lstatSync(link, { throwIfNoEntry: false });

  if (existing?.isSymbolicLink() && readlinkSync(link) === source) {
    return;
  }

  if (existing) {
    rmSync(link, { force: true });
  }

  try {
    symlinkSync(source, link);
  } catch (error) {
    throw new Error(`could not link ${source} into ${home}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Idempotent: every codex spawn calls this, and the cost is a mkdir, a file write and an
// lstat.
export const codexEnv = (): NodeJS.ProcessEnv => {
  const home = harnessCodexHome();

  mkdirSync(home, { recursive: true });
  writeFileSync(path.join(home, "config.toml"), CONFIG);
  linkAuth(home);

  return { ...process.env, CODEX_HOME: home };
};

// The operator's configured model, read out of their config.toml because the redirect above
// means codex no longer reads it. Top-level keys only, which is where `codex login`-era
// configs put it; a model set under a [profile] or [profiles.x] table is deliberately not
// picked up, because the harness does not pass -p and would otherwise report a model the run
// never used.
export const operatorCodexModel = (): string | null => {
  const configPath = path.join(operatorCodexHome(), "config.toml");

  if (!existsSync(configPath)) {
    return null;
  }

  for (const line of readFileSync(configPath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[")) {
      break;
    }

    const match = /^model\s*=\s*["']([^"']+)["']/.exec(trimmed);

    if (match) {
      return match[1];
    }
  }

  return null;
};

// AGENTS.md's "codex → the model in ~/.codex/config.toml" has to keep meaning that, so the
// harness reads the model itself and passes it. The gain over letting the CLI read it: the
// model is now on argv and in executor.yaml, so the record names what ran instead of `null`.
export const resolveCodexModel = (requested: string | null): string | null => {
  if (requested !== null) {
    return requested;
  }

  const configured = operatorCodexModel();

  if (configured !== null) {
    return configured;
  }

  // Not an error — no model is a legitimate choice, and codex has a default. But it is the
  // one case where the record cannot name the model that ran, so it does not happen quietly.
  console.warn(
    `codex: no top-level model in ${path.join(operatorCodexHome(), "config.toml")}; the run uses codex's own default `
      + `and the record says model: null. Pass --model to pin it.`,
  );

  return null;
};
