import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArmSwitch } from "../components/ArmSwitch.js";
import { Grid } from "../components/Grid.js";
import { RunPanel } from "../components/RunPanel.js";
import { compareEntry, pool } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { count, thousands } from "../lib/format.js";
import { ARM_COLUMNS, readArm, writeArm, type Arm } from "../lib/grid.js";

const Summary = () => {
  const index = useIndex();
  const [params, setParams] = useSearchParams();
  const arm = readArm(params);
  const column = ARM_COLUMNS[arm];
  const [selected, setSelected] = useState<{ skill: string; model: string; arm: Arm } | null>(null);
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
  const panelColumn = ARM_COLUMNS[selected?.arm ?? arm];
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
      <p className="muted small">{count(matrix.size, "skill")} · {count(models.length, "model")} · {count(tasks, "task")} · {count(runs, "run")}</p>
    </header>
    <section className="executive-metrics" aria-label="Executive summary">
      <div className="summary-rates">
        {overall.map(({ key, label, cell }) => {
          const baseline = overall[0].cell;
          const change = key !== "none" && cell && baseline ? 100 * (cell.passed / cell.total - baseline.passed / baseline.total) : null;
          return <div className={`summary-rate ${change !== null && change > 0 ? "summary-improved" : change !== null && change < 0 ? "summary-lower" : ""}`} key={key}>
          <p>{label}</p>
          <strong>{cell ? `${Math.round(100 * cell.passed / cell.total)}%` : "Not tested"}</strong>
          <span>{cell ? `${cell.passed} of ${cell.total} runs passed` : "No results"}</span>
          <div className="summary-bar" aria-hidden="true"><span style={{ width: `${cell ? 100 * cell.passed / cell.total : 0}%` }} /></div>
          {key !== "none" && <div className="summary-text">
            <p>Skill text</p>
            <dl>
              {reductions.map(({ metric, before, after, reduction }) => <div key={metric}>
                <dt>{metric === "lines" ? "Lines" : "Tokens"}</dt>
                <dd><strong className={before === after ? "muted" : (key === "old" ? before < after : after < before) ? "good" : "bad"}>{thousands(key === "old" ? before : after)}</strong>
                  {key === "new" && reduction !== null && <span className={`summary-reduction ${after < before ? "good" : after > before ? "bad" : "muted"}`}>
                    {before === after ? "No change" : `${Math.abs(reduction)}% ${after < before ? "fewer" : "more"}`}
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
      onCellClick={(skill, model) => setSelected({ skill, model, arm })} note="More models are being run."
    />
    </section>
    <details className="summary-method" open>
      <summary>How to read this report</summary>
      <p>A run passes only if it meets every task check. Each run starts in a fresh session. A separate judge checks the output and may use the same model.</p>
      <p>Select a table cell to compare runs. Open a skill page to see the text changes and full reports.</p>
      <p>Results apply to the tasks, models, and skill versions tested. “New skill” means the revised version tested here.</p>
      <a target="_blank" rel="noopener noreferrer" href={`https://github.com/${index.generated.repo}/issues/1`}>Read why we chose these tasks ↗</a>
    </details>
    {selected && <RunPanel title={`Task results for the ${selected.skill} skill`}
      subline={selected.model === "total" ? "All models" : selected.model}
      controls={<ArmSwitch arm={selected.arm} onChange={value => setSelected({ ...selected, arm: value })} />}
      groups={activeModels.flatMap(([model, comparison]) => comparison.rows.flatMap((row, position) => {
        const task = index.tasks.find(task => task.id === row.task);
        return task ? [{ task, model, heading: selected.model === "total" && position === 0 ? model : undefined,
          runs: comparison.runs[panelColumn].filter(run => run.task === task.id) }] : [];
      }))} onClose={() => setSelected(null)} headerLink={<Link to={`/skill/${selected.skill}`}>View skill details →</Link>} />}
  </>;
};
export default Summary;
