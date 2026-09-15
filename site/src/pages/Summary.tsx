import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArmSwitch } from "../components/ArmSwitch.js";
import { Grid } from "../components/Grid.js";
import { RunPanel } from "../components/RunPanel.js";
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
  const tasks = comparisons.reduce((total, comparison) => total + comparison.rows.length, 0);
  const runs = comparisons.reduce((total, comparison) => total + Object.values(comparison.runs).reduce((n, arm) => n + arm.length, 0), 0);
  const activeModels = selected ? [...(matrix.get(selected.skill) ?? [])]
    .filter(([model]) => selected.model === "total" || model === selected.model) : [];
  const activeCell = pool(activeModels.map(([, comparison]) => comparison.totals[column]));
  const measured = comparisons.filter(item => item.totals.after !== null);
  const passed = measured.filter(item => item.totals.after!.passed === item.totals.after!.total).length;
  const review = measured.length - passed;
  const overall = [
    { key: "none", label: "Without skill", cell: pool(comparisons.map(item => item.totals.noSkill)) },
    { key: "old", label: "Original skill", cell: pool(comparisons.map(item => item.totals.before)) },
    { key: "new", label: "Revised skill", cell: pool(comparisons.map(item => item.totals.after)) },
  ];
  const uniqueVersions = [...new Map(versions.map(item => [`${item.before!.id}/${item.after!.id}`, item])).values()];
  const reductions = (["lines", "tokens"] as const).map(metric => {
    const before = uniqueVersions.reduce((sum, item) => sum + item.before![metric], 0);
    const after = uniqueVersions.reduce((sum, item) => sum + item.after![metric], 0);
    return { metric, before, after, reduction: before ? Math.round(100 * (before - after) / before) : null };
  });
  return <>
    <header className="executive-header">
      <h1>EthSkills evaluation</h1>
      <p className="executive-conclusion"><strong className="good">{passed} of {measured.length}</strong> tested skill/model pairs passed every selected run after the rewrite.
        {review > 0 && <> <span className="executive-attention">{review} still need review.</span></>}</p>
      <p className="muted small">{count(matrix.size, "skill")} · {count(models.length, "model")} · {count(tasks, "task")} · {count(runs, "run")}</p>
    </header>
    <section className="executive-metrics" aria-label="Executive summary">
      <div className="summary-rates">
        {overall.map(({ key, label, cell }, position) => {
          const previous = overall[position - 1]?.cell;
          const change = cell && previous ? cell.passed / cell.total - previous.passed / previous.total : 0;
          return <div className={`summary-rate ${change > 0 ? "summary-improved" : change < 0 ? "summary-lower" : ""}`} key={key}>
          <p>{label}</p>
          <strong>{cell ? `${Math.round(100 * cell.passed / cell.total)}%` : "Not tested"}</strong>
          <span>{cell ? `${cell.passed} of ${cell.total} runs passed` : "No results"}</span>
          <div className="summary-bar" aria-hidden="true"><span style={{ width: `${cell ? 100 * cell.passed / cell.total : 0}%` }} /></div>
          {key !== "none" && <div className={`summary-text summary-text-${key}`}>
            <p>Skill text</p>
            <dl>
              {reductions.map(({ metric, before, after, reduction }) => <div key={metric}>
                <dt>{metric === "lines" ? "Lines" : "Tokens"}</dt>
                <dd><strong>{thousands(key === "old" ? before : after)}</strong>
                  {key === "new" && reduction !== null && <span className={`summary-reduction ${reduction > 0 ? "good" : reduction < 0 ? "bad" : "muted"}`}>
                    {Math.abs(reduction)}% {reduction >= 0 ? "fewer" : "more"}
                  </span>}
                </dd>
              </div>)}
            </dl>
          </div>}
        </div>; })}
      </div>
    </section>
    <section aria-labelledby="results-heading">
      <h2 id="results-heading">Results by skill and model</h2>
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
    </section>
    <details className="summary-method">
      <summary>How to read this report</summary>
      <p>Each run starts with a fresh executor. A separate judge process grades the output against the task checks. The judge can use the same model as the executor.</p>
      <p>Open a table cell to inspect tasks and runs. Open the skill page for the rewrite, usage records, and source reports.</p>
      <p>“Old skill” and “New skill” are the selected original and revised versions. The revised version is not necessarily the latest version. Small samples, task coverage, and historical judge settings limit what these results establish.</p>
      <a href={`https://github.com/${index.generated.repo}/issues/1`}>Read why we chose these tasks ↗</a>
    </details>
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
