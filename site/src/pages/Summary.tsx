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
      <p className="lede">{index.skills.length} skills from <a href="https://ethskills.com">ethskills.com</a>, each measured before and after a rewrite, on one model.</p>
      <ul className="intro-pointers">
        <li>Two kinds of task: a <strong>quiz</strong> needs reasoning and calculation; a <strong>goal</strong> tests a skill’s advice during a build, without prompting it.</li>
        <li>Each task runs several times <strong>with the skill</strong> and <strong>without it</strong>. Each run starts in a fresh workspace on its own branch.</li>
        <li>A separate, <strong>blind judge</strong> grades every run against the task’s checks without knowing whether it used the skill.</li>
        <li>We rewrite the skill, usually much shorter, then run the same tasks again on the same model.</li>
      </ul>
      <details className="task-detail">
        <summary>Why quizzes and goals test different things</summary>
        <ul>
          <li><strong>Quizzes test whether the model can use a fact.</strong> “What does a 100k USDC flash loan on Aave V3 cost all-in?” requires a calculation. Asking for the fee alone only tests recall or lookup.</li>
          <li><strong>Goals test whether the model applies advice unprompted.</strong> The build requires a decision that the skill covers, but the prompt never names it. This tests whether the advice reaches the work when needed.</li>
        </ul>
        <a className="small" href={`https://github.com/${index.generated.repo}/issues/1`}>Read the task design discussion</a>
      </details>
    </header>
    <section aria-labelledby="results-heading">
      <div className="section-heading">
        <h2 id="results-heading">Results</h2>
        <p className="muted small">{index.tasks.length} tasks · {index.runs.length} runs</p>
      </div>
      <ResultsLegend />
      <p className="table-legend">Rates use tasks with matching checks in all three columns. Task and run counts include all shown results.</p>
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
              <th scope="col" className="num">Lines<span className="cell-detail">Before → after rewrite</span></th>
              <th scope="col" className="num">Median tokens / run<span className="cell-detail">Before → after rewrite</span></th>
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
      <p className="footnote">Token counts measure model usage, including recorded cache use. Compare them within one model; models count tokens differently.</p>
    </section>
  </>);
};
export default Summary;
