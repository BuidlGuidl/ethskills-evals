import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArmSwitch } from "../components/ArmSwitch.js";
import { Grid } from "../components/Grid.js";
import { RunPanel } from "../components/RunPanel.js";
import { ComparisonBlock } from "../components/ComparisonBlock.js";
import { compareEntry, pool } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { count, thousands } from "../lib/format.js";
import { ARM_COLUMNS, ARM_LABELS, readArm, writeArm } from "../lib/grid.js";

const Summary = () => {
  const index = useIndex();
  const [params, setParams] = useSearchParams();
  const arm = readArm(params);
  const column = ARM_COLUMNS[arm];
  const [selected, setSelected] = useState<{ skill: string; model: string } | null>(null);
  useEffect(() => { setSelected(null); }, [arm]);
  const matrix = useMemo(() => {
    const matrix = new Map<string, Map<string, ReturnType<typeof compareEntry>>>();
    for (const entry of index.showcase ?? []) {
      let models = matrix.get(entry.skill);
      if (!models) { models = new Map(); matrix.set(entry.skill, models); }
      models.set(entry.model, compareEntry(entry, index));
    }
    return matrix;
  }, [index]);
  const models = [...new Set((index.showcase ?? []).map(entry => entry.model))];
  const comparisons = [...matrix.values()].flatMap(models => [...models.values()]);
  const versions = comparisons.filter(comparison => comparison.before && comparison.after);
  const versionTokens = (column: "before" | "after") => {
    const values = comparisons.map(comparison => comparison[column]?.tokens ?? null);
    return values.length && values.every((value): value is number => value !== null)
      ? values.reduce((total, value) => total + value, 0) : null;
  };
  const tasks = comparisons.reduce((total, comparison) => total + comparison.rows.length, 0);
  const runs = comparisons.reduce((total, comparison) => total + Object.values(comparison.runs).reduce((n, arm) => n + arm.length, 0), 0);
  const activeModels = selected ? [...(matrix.get(selected.skill) ?? [])]
    .filter(([model]) => selected.model === "total" || model === selected.model) : [];
  const activeCell = pool(activeModels.map(([, comparison]) => comparison.totals[column]));
  return <>
    <header className="page-header grid-intro">
      <h1>How AI agents perform on Ethereum tasks, with and without ethskills.</h1>
    </header>
    <ArmSwitch arm={arm} onChange={value => setParams(writeArm(params, value), { replace: true })} />
    <Grid label="Pass rates by skill and model" total
      rows={[...matrix].map(([skill, entries]) => {
        const selectedVersions = [...entries.values()].map(comparison => arm === "none" ? null : comparison[arm === "old" ? "before" : "after"]);
        const version = selectedVersions[0];
        const sharedVersion = version && selectedVersions.every(other => other?.id === version.id) ? version : null;
        const cells = Object.fromEntries(models.map(model => [model, entries.get(model)?.totals[column] ?? null]));
        return { key: skill, label: skill, cells, total: pool(Object.values(cells)),
          sub: sharedVersion ? `${thousands(sharedVersion.lines)} lines, ${thousands(sharedVersion.tokens)} tokens` : undefined };
      })}
      columns={models.map(model => {
        const executor = index.runs.find(run => run.model === model)?.executor;
        const icon = executor === "claude" ? "claude" : executor === "codex" ? "openai" : null;
        return { key: model, label: <span className="model-chip">{icon && <img width="16" height="16"
          src={`${import.meta.env.BASE_URL}icons/${icon}.svg`}
          alt={executor === "claude" ? "Claude Code" : "Codex"} />}{model}</span> };
      })}
      onCellClick={(skill, model) => setSelected({ skill, model })} note="More models are being run."
    />
    <section aria-labelledby="rewrites-heading">
      <h2 id="rewrites-heading">What the rewrites changed</h2>
      <ComparisonBlock title="All skills"
        subline={`${count(matrix.size, "skill")}, ${count(models.length, "model")}, ${count(tasks, "task")}, ${count(runs, "run")}`}
        noSkill={pool(comparisons.map(comparison => comparison.totals.noSkill))}
        before={pool(comparisons.map(comparison => comparison.totals.before))}
        after={pool(comparisons.map(comparison => comparison.totals.after))}
        beforeLines={versions.length ? versions.reduce((total, comparison) => total + comparison.before!.lines, 0) : null}
        afterLines={versions.length ? versions.reduce((total, comparison) => total + comparison.after!.lines, 0) : null}
        beforeTokens={versionTokens("before")} afterTokens={versionTokens("after")}
      />
      <a className="small" href={`https://github.com/${index.generated.repo}/issues/1`}>Read why we chose these tasks</a>
    </section>
    {selected && activeCell && <RunPanel title={selected.model === "total" ? `${selected.skill}, all models` : `${selected.skill} on ${selected.model}`}
      subline={`${ARM_LABELS[arm]}, ${activeCell.passed} of ${activeCell.total} runs passed`}
      groups={activeModels.flatMap(([model, comparison]) => comparison.rows.flatMap((row, position) => {
        const task = index.tasks.find(task => task.id === row.task);
        return task ? [{ task, model, heading: selected.model === "total" && position === 0 ? model : undefined,
          runs: comparison.runs[column].filter(run => run.task === task.id) }] : [];
      }))} onClose={() => setSelected(null)} footer={<Link to={`/skill/${selected.skill}`}>Open the skill page</Link>} />}
  </>;
};
export default Summary;
