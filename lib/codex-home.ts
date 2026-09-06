import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
// on the machine, and safe to delete (the next run rebuilds it). The harness puts a
// config.toml and the auth.json link in it; codex fills the rest in as it runs — its own
// bundled skills, plugin cache, state dbs — which is identical for every operator and so
// carries none of the asymmetry this redirect is about. Run content is kept out of it by
// --ephemeral (see scripts/run-executor.ts), because one dir shared by every run is a
// channel from a with_skill run to the no_skill run after it. Not under the workspace root
// — a run can `ls` its way around up there, and this dir holds a link to a live credential.
export const operatorCodexHome = () => path.resolve(process.env.CODEX_HOME || path.join(homedir(), ".codex"));

export const harnessCodexHome = () => path.resolve(process.env.EVAL_CODEX_HOME || path.join(HARNESS_ROOT, ".codex-home"));

const CONFIG = `# Written by the eval harness (lib/codex-home.ts).
#
# CODEX_HOME points here for every codex the harness spawns, so a run sees none of the
# operator's ~/.codex: no user config.toml, no global skills, plugins, rules or memories.
# The settings that have to survive the redirect travel on the command line instead (-m,
# -c model_reasoning_effort), so they land in executor.yaml and the record names them.
#
# Keep this file empty of settings. Anything configured here is configured for every run on
# this machine and for nobody else's, which is the asymmetry the redirect exists to remove.
# codex appends [projects."<path>"] trust_level here at runtime; the harness restores this
# content on the next spawn, so every run starts from the same trust state rather than from
# whatever the runs before it happened to leave behind.
`;

// Written under a unique name and renamed into place. Two runs in different workspaces are
// allowed to overlap (AGENTS.md rule 5), and a plain write truncates the file for as long as
// it takes to fill — long enough for a concurrent codex to read a half-written config.
const replaceFile = (target: string, contents: string) => {
  const staging = `${target}.${process.pid}.tmp`;

  writeFileSync(staging, contents);

  try {
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }
};

// Same reason, same shape: rm + symlink leaves a window with no auth.json at all, which a
// concurrent run reads as a logged-out machine. rename over the old link is atomic.
const replaceLink = (target: string, source: string) => {
  const staging = `${target}.${process.pid}.tmp`;

  symlinkSync(source, staging);

  try {
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { force: true });
    throw new Error(`could not link ${source} to ${target}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Symlink rather than copy: codex refreshes the token in place, so a copy goes stale mid
// benchmark and leaves a second live credential on disk. Writes through the link land in the
// operator's real auth.json, which is where codex login expects them.
const linkAuth = (home: string) => {
  const source = path.join(operatorCodexHome(), "auth.json");
  const link = path.join(home, "auth.json");
  const existing = lstatSync(link, { throwIfNoEntry: false });

  if (!existsSync(source)) {
    // OPENAI_API_KEY is codex's other credential path and needs no file. Anything else is a
    // logged-out machine, and failing here beats burning a run on an auth error.
    if (process.env.OPENAI_API_KEY) {
      // A link from an earlier run now points at a credential that is gone. Left in place,
      // codex reads the dangling link and reports "stored credentials could not be read"
      // rather than falling back to the env key.
      if (existing?.isSymbolicLink()) {
        rmSync(link, { force: true });
      }

      return;
    }

    throw new Error(`no codex credentials: ${source} does not exist and OPENAI_API_KEY is unset. Run codex login first.`);
  }

  if (existing?.isSymbolicLink()) {
    if (readlinkSync(link) === source) {
      return;
    }
  } else if (existing) {
    // Not the harness's link. Either codex replaced it with a real file — it writes through
    // temp + rename in places, and then this is the live credential and the operator's copy
    // is the stale one — or the operator put it there. Replacing it either way destroys a
    // token nothing else holds, so leave it: it is a credential, the run can use it.
    console.warn(
      `codex: ${link} is a regular file, not the harness's link to ${source}; leaving it in place. `
        + `Delete it to go back to the operator's credential.`,
    );

    return;
  }

  replaceLink(link, source);
};

// Idempotent: every codex spawn calls this, and the cost is a mkdir, a read, a compare and
// an lstat.
export const codexEnv = (): NodeJS.ProcessEnv => {
  const home = harnessCodexHome();

  // The two homes coinciding is not a degenerate no-op, it is destructive: the config write
  // below would overwrite the operator's real config.toml, and linkAuth would point their
  // auth.json at itself. It also silently voids the isolation this whole module exists for.
  if (home === operatorCodexHome()) {
    throw new Error(
      `EVAL_CODEX_HOME and CODEX_HOME are both ${home}; the harness home must be separate from the operator's, `
        + `or the run writes over the operator's codex config and credential.`,
    );
  }

  const configPath = path.join(home, "config.toml");

  mkdirSync(home, { recursive: true });

  if (!existsSync(configPath) || readFileSync(configPath, "utf8") !== CONFIG) {
    replaceFile(configPath, CONFIG);
  }

  linkAuth(home);

  return { ...process.env, CODEX_HOME: home };
};

// An operator setting read out of their config.toml, because the redirect above means codex
// no longer reads that file. Top-level keys only, which is where `codex login`-era configs
// put them; a value set under a [profile] or [profiles.x] table is deliberately not picked
// up, because the harness does not pass -p and would otherwise report a setting the run
// never used.
const operatorCodexSetting = (key: string): string | null => {
  const configPath = path.join(operatorCodexHome(), "config.toml");

  if (!existsSync(configPath)) {
    return null;
  }

  const setting = new RegExp(`^${key}\\s*=\\s*["']([^"']+)["']`);

  for (const line of readFileSync(configPath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[")) {
      break;
    }

    const match = setting.exec(trimmed);

    if (match) {
      return match[1];
    }
  }

  return null;
};

export const operatorCodexModel = (): string | null => operatorCodexSetting("model");

// The other setting that changes what the model does rather than how the harness is wired.
// Left behind by the redirect it would move a benchmark's runs apart from each other with
// nothing in the record to say so, which is the failure the redirect exists to prevent.
export const operatorCodexReasoningEffort = (): string | null => operatorCodexSetting("model_reasoning_effort");

// AGENTS.md's "codex → the model in ~/.codex/config.toml" has to keep meaning that, so the
// harness reads the model itself and passes it. The gain over letting the CLI read it: the
// model is now on argv and in executor.yaml, so the record names what ran instead of `null`.
export const resolveCodexModel = (requested: string | null, flag = "--model"): string | null => {
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
      + `and the record says model: null. Pass ${flag} to pin it.`,
  );

  return null;
};

// Carried on argv for the same reason as the model: a setting that changes the answer has to
// be visible in the record. Nothing is passed when the operator sets nothing — codex's own
// default is a legitimate choice, and the record says null for it.
export const codexReasoningArgs = (effort: string | null): string[] =>
  effort === null ? [] : ["-c", `model_reasoning_effort="${effort}"`];
