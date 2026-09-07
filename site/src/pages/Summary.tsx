import { Link } from "react-router-dom";
import { PassCount, ResultsLegend } from "../components/PassCount.js";
import { summarize } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { tokens } from "../lib/format.js";
const Summary = () => {
  const index = useIndex();
  const rows = summarize(index);
  return (<>
    <header className="page-header intro">
      <h1>Skill evals</h1>
      <p className="lede">{index.skills.length} skills from <a href="https://ethskills.com">ethskills.com</a>, each tested before and after a rewrite on the same model.</p>
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
    </header>
    <section aria-labelledby="results-heading">
      <div className="section-heading">
        <h2 id="results-heading">Results</h2>
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
              <th scope="col" className="num secondary">With skill, before rewrite</th>
              <th scope="col" className="num after">With skill, after rewrite</th>
              <th scope="col" className="num">Lines<span className="cell-detail">Before and after rewrite</span></th>
              <th scope="col" className="num">Median tokens per run<span className="cell-detail">Before and after rewrite</span></th>
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
              <PassCount cell={row.after} />
            </td>
            <td className="num compact">{row.beforeVersion && row.afterVersion ? `${row.beforeVersion.lines} → ${row.afterVersion.lines}` : "Not recorded"}</td>
            <td className="num compact">{row.usage.before.tokens !== null && row.usage.after.tokens !== null ? `${tokens(row.usage.before.tokens)} → ${tokens(row.usage.after.tokens)}` : "Not recorded"}</td>
          </tr>))}</tbody>
        </table>
      </div>
      <p className="footnote">Token counts include recorded cache use. Compare counts only within the same model, since models count tokens differently.</p>
    </section>
  </>);
};
export default Summary;
