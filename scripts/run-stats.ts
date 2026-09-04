import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import { parseTranscriptStats, parseUsageRecord } from "../lib/usage.js";
import type { RunUsage, Variant } from "../lib/types.js";

// Every number a report puts in a cost table has to come from here, from the committed
// transcripts, so a reader can re-derive the table instead of trusting it. The wallets report
// on PR #96 carried baseline costs assembled by hand from a benchmark-wide median in a prior
// report — one cell took its duration from an aggregate over seven tasks and its cost from the
// wrong column — and nothing in the repo could have caught it.
const ROOT = process.cwd();
const STATS_ARGS = new Set(["tasks", "since", "variant", "skill-version", "runs"]);

type RunStats = {
  run: string;
  task: string;
  variant: Variant;
  turns: number | null;
  duration: number | null;
  cost: number | null;
  tokens: number | null;
};

const EMPTY: RunUsage = {
  duration_s: null,
  turns: null,
  cost_usd: null,
  input_tokens: null,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
  output_tokens: null,
  total_tokens: null,
};

// The transcript is the primary source: it is what the executor itself reported, and it is the
// file a reader opens to check a cell. result.yaml's usage block fills what the transcript does
// not carry — codex transcripts have no stats section at all, and their token total lives only
// there. Runs older than both stay absent rather than becoming zeros.
const readStats = (runDir: string, result: Record<string, unknown>) => {
  const transcriptPath = path.join(runDir, "transcript.md");
  const transcript = existsSync(transcriptPath) ? parseTranscriptStats(readFileSync(transcriptPath, "utf8")) : null;
  const recorded = parseUsageRecord(result.usage) ?? EMPTY;
  const usage = transcript ?? EMPTY;

  return {
    turns: usage.turns ?? recorded.turns,
    duration: usage.duration_s ?? recorded.duration_s,
    cost: usage.cost_usd ?? recorded.cost_usd,
    tokens: usage.total_tokens ?? recorded.total_tokens,
  };
};

const median = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

// Two with_skill arms of one task differ only by which revision of the skill they read, and
// the run directory name does not say. skill_version does, so an arm is a filter rather than a
// date range a reader has to know the boundaries of.
const collect = (taskIds: string[], since: string | null, variant: Variant | null, skillVersion: string | null) => {
  const stats: RunStats[] = [];

  for (const taskId of taskIds) {
    const taskDir = path.join(ROOT, "artifacts", taskId);

    if (!existsSync(taskDir)) {
      throw new Error(`no artifacts for task: ${taskId}`);
    }

    for (const run of readdirSync(taskDir).sort()) {
      // A regrade re-reads one run's stored evidence; it spawned no executor, so it has no
      // stats of its own and counting it would double the run it re-read.
      if (run.includes("-regrade-")) {
        continue;
      }

      if (since !== null && run < since) {
        continue;
      }

      const runDir = path.join(taskDir, run);
      const resultPath = path.join(runDir, "result.yaml");

      if (!existsSync(resultPath)) {
        continue;
      }

      const result = loadYamlFile(resultPath);
      const runVariant = result.variant as Variant;

      if (variant !== null && runVariant !== variant) {
        continue;
      }

      if (skillVersion !== null && result.skill_version !== skillVersion) {
        continue;
      }

      stats.push({
        run,
        task: taskId,
        variant: runVariant,
        ...readStats(runDir, result),
      });
    }
  }

  return stats;
};

const format = (value: number | null, unit: string) => (value === null ? "—" : `${unit === "$" ? "$" : ""}${unit === "$" ? value.toFixed(2) : Math.round(value)}${unit === "s" ? "s" : ""}`);

const main = () => {
  try {
    const args = parseArgs(STATS_ARGS);
    const taskIds = requireString(args.tasks, "--tasks").split(",").map(id => id.trim());
    const since = args.since === undefined ? null : requireString(args.since, "--since");
    const variant = args.variant === undefined ? null : (requireString(args.variant, "--variant") as Variant);
    const skillVersion = args["skill-version"] === undefined ? null : requireString(args["skill-version"], "--skill-version");
    const showRuns = args.runs !== undefined;
    const stats = collect(taskIds, since, variant, skillVersion);

    if (showRuns) {
      console.log("| run | variant | turns | duration | cost | tokens |");
      console.log("| --- | --- | --- | --- | --- | --- |");

      for (const s of stats) {
        console.log(
          `| ${s.task}/${s.run} | ${s.variant} | ${format(s.turns, "")} | ${format(s.duration, "s")} `
            + `| ${format(s.cost, "$")} | ${format(s.tokens, "")} |`,
        );
      }

      console.log("");
    }

    console.log("| task | variant | n | turns | duration | cost | cost range | tokens |");
    console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");

    for (const taskId of taskIds) {
      for (const v of ["no_skill", "with_skill"] as Variant[]) {
        const rows = stats.filter(s => s.task === taskId && s.variant === v);

        if (rows.length === 0) {
          continue;
        }

        const costs = rows.map(s => s.cost).filter((c): c is number => c !== null);
        // Stated beside the median, always: at n=3 a goal task's cheapest and dearest run can
        // differ by more than the delta the median is being read for.
        const range = costs.length === 0
          ? "—"
          : `$${Math.min(...costs).toFixed(2)}–$${Math.max(...costs).toFixed(2)}`;
        const missing = rows.length - costs.length;

        // total_tokens, never input_tokens: under prompt caching a skill's whole context cost
        // lands in the cache fields, which is exactly what a with_skill arm is being read for.
        const tokens = rows.map(s => s.tokens).filter((t): t is number => t !== null);

        console.log(
          `| ${taskId} | ${v} | ${rows.length}${missing > 0 ? ` (${missing} with no stats)` : ""} `
            + `| ${format(median(rows.map(s => s.turns).filter((t): t is number => t !== null)), "")} `
            + `| ${format(median(rows.map(s => s.duration).filter((d): d is number => d !== null)), "s")} `
            + `| ${format(median(costs), "$")} | ${range} | ${format(median(tokens), "")} |`,
        );
      }
    }
  } catch (error) {
    console.error(`run-stats: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

main();
