import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import type { Variant } from "../lib/types.js";

// Every number a report puts in a cost table has to come from here, from the committed
// transcripts, so a reader can re-derive the table instead of trusting it. The wallets report
// on PR #96 carried baseline costs assembled by hand from a benchmark-wide median in a prior
// report — one cell took its duration from an aggregate over seven tasks and its cost from the
// wrong column — and nothing in the repo could have caught it.
const ROOT = process.cwd();
const STATS_ARGS = new Set(["tasks", "since", "variant", "runs"]);

type RunStats = {
  run: string;
  task: string;
  variant: Variant;
  turns: number | null;
  duration: number | null;
  cost: number | null;
};

// run-executor appends this footer to every transcript; runs made before it existed have none,
// which is the difference between a number this repo can show you and one it cannot.
const readFooter = (transcriptPath: string) => {
  const text = readFileSync(transcriptPath, "utf8");
  const read = (label: string, pattern: RegExp) => {
    const match = text.match(pattern);

    return match === null ? null : Number(match[1]);
  };

  return {
    turns: read("turns", /^- turns: (\d+)$/m),
    duration: read("duration", /^- duration: (\d+)s$/m),
    cost: read("cost", /^- cost: \$([\d.]+)$/m),
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

const collect = (taskIds: string[], since: string | null, variant: Variant | null) => {
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

      const resultPath = path.join(taskDir, run, "result.yaml");
      const transcriptPath = path.join(taskDir, run, "transcript.md");

      if (!existsSync(resultPath)) {
        continue;
      }

      const result = loadYamlFile(resultPath);
      const runVariant = result.variant as Variant;

      if (variant !== null && runVariant !== variant) {
        continue;
      }

      stats.push({
        run,
        task: taskId,
        variant: runVariant,
        ...(existsSync(transcriptPath) ? readFooter(transcriptPath) : { turns: null, duration: null, cost: null }),
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
    const showRuns = args.runs !== undefined;
    const stats = collect(taskIds, since, variant);

    if (showRuns) {
      console.log("| run | variant | turns | duration | cost |");
      console.log("| --- | --- | --- | --- | --- |");

      for (const s of stats) {
        console.log(`| ${s.task}/${s.run} | ${s.variant} | ${format(s.turns, "")} | ${format(s.duration, "s")} | ${format(s.cost, "$")} |`);
      }

      console.log("");
    }

    console.log("| task | variant | n | turns | duration | cost | cost range |");
    console.log("| --- | --- | --- | --- | --- | --- | --- |");

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

        console.log(
          `| ${taskId} | ${v} | ${rows.length}${missing > 0 ? ` (${missing} with no footer)` : ""} `
            + `| ${format(median(rows.map(s => s.turns).filter((t): t is number => t !== null)), "")} `
            + `| ${format(median(rows.map(s => s.duration).filter((d): d is number => d !== null)), "s")} `
            + `| ${format(median(costs), "$")} | ${range} |`,
        );
      }
    }
  } catch (error) {
    console.error(`run-stats: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

main();
