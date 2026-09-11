import { Link } from "react-router-dom";
import { PassCount, ResultsLegend } from "../components/PassCount.js";
import { ComparisonBlock } from "../components/ComparisonBlock.js";
import { summarize, type Cell } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { count, tokens } from "../lib/format.js";
const Summary = () => {
  const index = useIndex();
  const rows = summarize(index);
  const sum = (column: "noSkill" | "before" | "after"): Cell | null => {
    const cells = rows.map(row => row[column]).filter((cell): cell is Cell => cell !== null);
    return cells.length === 0 ? null : {
      passed: cells.reduce((total, cell) => total + cell.passed, 0),
      total: cells.reduce((total, cell) => total + cell.total, 0),
      rubrics: [...new Set(cells.flatMap(cell => cell.rubrics))],
    };
  };
  const versions = rows.filter(row => row.beforeVersion && row.afterVersion);
  const versionTokens = (column: "beforeVersion" | "afterVersion") => {
    const values = rows.map(row => {
      const version = row[column];
      return version?.tokens ?? null;
    });
    // A partial sum would understate the combined skill text.
    return values.length && values.every((value): value is number => value !== null)
      ? values.reduce((total, value) => total + value, 0) : null;
  };
  const skills = new Set(rows.map(row => row.skill)).size;
  const models = new Set(rows.map(row => row.model)).size;
  const tasks = rows.reduce((total, row) => total + row.tasks, 0);
  const runs = rows.reduce((total, row) => total + row.runs, 0);
  return (<>
    <header className="page-header intro">
      <h1>Skill evals</h1>
      <p className="lede">Each skill is tested on the same tasks, with and without it, before and after a rewrite, on one model.</p>
    </header>
    <ComparisonBlock title="All skills"
      subline={`${count(skills, "skill")}, ${count(models, "model")}, ${count(tasks, "task")}, ${count(runs, "run")}`}
      noSkill={sum("noSkill")} before={sum("before")} after={sum("after")}
      beforeLines={versions.length ? versions.reduce((total, row) => total + row.beforeVersion!.lines, 0) : null}
      afterLines={versions.length ? versions.reduce((total, row) => total + row.afterVersion!.lines, 0) : null}
      beforeTokens={versionTokens("beforeVersion")} afterTokens={versionTokens("afterVersion")}
    />
    <section aria-labelledby="results-heading">
      <div className="section-heading">
        <h2 id="results-heading">By skill</h2>
        <p className="muted small">{index.tasks.length} tasks · {index.runs.length} runs</p>
      </div>
      <ResultsLegend />
      <div className="scroll" role="region" aria-label="Skill results" tabIndex={0}>
        <table className="grid summary-table">
          <caption className="sr-only">Pass rates by skill and model, before and after the rewrite.</caption>
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Model</th>
              <th scope="col" className="num">Tasks</th>
              <th scope="col" className="num">Runs</th>
              <th scope="col" className="num">Without skill</th>
              <th scope="col" className="num secondary">Before rewrite</th>
              <th scope="col" className="num after">After rewrite</th>
              <th scope="col" className="num">Lines<span className="cell-detail">before to after</span></th>
              <th scope="col" className="num">Tokens per run<span className="cell-detail">median, before to after</span></th>
            </tr>
          </thead>
          <tbody>{rows.map(row => (<tr key={`${row.skill}/${row.model}`}>
            <th scope="row">
              <Link to={`/skill/${row.skill}`}>{row.skill}</Link>
            </th>
            <td className="model">{row.model}</td>
            <td className="num">
              <Link to={`/tasks#${row.skill}`}>{row.tasks}</Link>
            </td>
            <td className="num">{row.runs}</td>
            <td className="num">
              <PassCount cell={row.noSkill} />
            </td>
            <td className="num secondary"><PassCount cell={row.before} /></td>
            <td className="num after">
              <PassCount cell={row.after} before={row.before} />
            </td>
            <td className="num compact">{row.beforeVersion && row.afterVersion ? `${row.beforeVersion.lines} → ${row.afterVersion.lines}` : "Not recorded"}</td>
            <td className="num compact">{row.usage.before.tokens !== null && row.usage.after.tokens !== null ? `${tokens(row.usage.before.tokens)} → ${tokens(row.usage.after.tokens)}` : "Not recorded"}</td>
          </tr>))}</tbody>
        </table>
      </div>
      <p className="footnote">Token counts include recorded cache use. Compare counts only within the same model, since models count tokens differently.</p>
    </section>
    <section aria-label="How we test skills">
      <ul className="intro-pointers">
        <li>A <strong>quiz</strong> asks the model to reason and calculate. A <strong>goal</strong> tests whether it uses the skill's advice during a build without a reminder.</li>
        <li>We run each task several times <strong>with the skill</strong> and <strong>without it</strong>. Each run gets a fresh workspace and its own branch.</li>
        <li>A separate model checks every run. This <strong>blind judge</strong> sees the task's checks but does not know whether the model had the skill.</li>
        <li>We rewrite the skill, often cutting its length. Then we repeat the tasks on the same model.</li>
      </ul>
      <details className="task-detail">
        <summary>Why we use quizzes and goals</summary>
        <ul>
          <li><strong>Quizzes test whether the model can use a fact.</strong> "What does a 100k USDC flash loan on Aave V3 cost all-in?" needs a calculation. Asking for the fee alone tests recall or lookup.</li>
          <li><strong>Goals test whether the model uses advice without a reminder.</strong> The build needs a decision covered by the skill. The prompt never names that decision.</li>
        </ul>
        <a className="small" href={`https://github.com/${index.generated.repo}/issues/1`}>Read why we chose these tasks</a>
      </details>
    </section>
  </>);
};
export default Summary;
