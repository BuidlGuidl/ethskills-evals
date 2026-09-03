import type { Executor } from "./types.js";

// `--setting-sources project` is load-bearing for claude: user-level config crowds the
// skill listing and skills stop triggering. For codex the model comes from
// ~/.codex/config.toml unless -m overrides it, and the network flag is load-bearing too:
// workspace-write blocks network by default, so without it every live-data task fails for
// the wrong reason. Both take the prompt on stdin — TASK.md can outgrow the argv limit.
export const buildCommand = (executor: Executor, model: string | null) => {
  if (executor === "claude") {
    const args = ["-u", "ANTHROPIC_API_KEY", "-u", "ANTHROPIC_AUTH_TOKEN", "claude", "-p"];

    if (model) {
      args.push("--model", model);
    }

    args.push(
      "--setting-sources", "project",
      "--dangerously-skip-permissions",
      "--strict-mcp-config",
      "--output-format", "stream-json",
      "--verbose",
    );

    return { file: "env", args };
  }

  // --disable shell_snapshot keeps one specific piece of the operator out of the run: codex
  // otherwise dumps the interactive shell's functions and aliases (`declare -f`, `alias`)
  // into a snapshot and sources that ahead of every command, and a single line that does not
  // re-parse takes the shell down for the rest of the run. Seen on 2026-08-27: extglob
  // patterns that `declare -f` emits without the shopt that made them legal produced "syntax
  // error near unexpected token `('", and a with_skill run could not read its own installed
  // skill — which grades as a skill that did not help rather than as a broken run.
  //
  // It is narrower than claude's --setting-sources project, and the two are not equivalent:
  // codex still runs every command through `/bin/bash -lc`, so /etc/profile and the
  // operator's ~/.bash_profile are sourced with the flag on. What the flag removes is the
  // snapshot, not the login shell.
  //
  // The feature name is codex-version-coupled, but it does not fail open: an unrecognised
  // name exits 1 with "Unknown feature flag: <name>" before the run starts (checked against
  // codex-cli 0.150.1), and verify refuses to grade a non-zero exit — a rename shows up as a
  // dead run, not as a quiet loss of the flag. That is also why this stays `--disable` rather
  // than the `-c features.shell_snapshot=false` it expands to: an unknown -c key is accepted
  // silently unless --strict-config is passed, so the two spellings differ exactly where it
  // matters.
  const args = ["exec", "--disable", "shell_snapshot", "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true"];

  if (model) {
    args.push("-m", model);
  }

  args.push("-");

  return { file: "codex", args };
};
