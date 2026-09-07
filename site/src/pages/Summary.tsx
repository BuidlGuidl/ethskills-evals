import { Link } from "react-router-dom";
import { PassCount } from "../components/PassCount.js";
import { formatCell, summarize } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { tokens } from "../lib/format.js";
const Summary = () => {
  const index = useIndex();
  const rows = summarize(index);
  return (<>
    <header className="page-header intro">
      <p className="eyebrow">Ethereum skills · measured and rewritten</p>
      <h1>Less to read.<br />Put to the same test.</h1>
      <p className="lede">Benchmarks for {index.skills.length} skills from <a href="https://ethskills.com">ethskills</a>. Quizzes test what a model knows; goals test what it builds. Each task runs with and without the skill in fresh workspaces. A separate, blind judge checks the work without knowing the variant.</p>
      <p className="intro-detail">Measure the skill, read the mistakes, rewrite it, then repeat the same tasks on the same model. Compare the rewrite with no skill first, then with the version we vendored.</p>
    </header>
    <section aria-labelledby="results-heading">
      <div className="section-heading">
        <h2 id="results-heading">Results</h2>
        <p className="muted small">{index.tasks.length} tasks · {index.runs.length} runs</p>
      </div>
      <div className="scroll" role="region" aria-label="Skill results" tabIndex={0}>
        <table className="grid summary-table">
          <caption className="sr-only">Pass counts by skill and model. After is the rewritten skill; before is the vendored version.</caption>
          <thead>
            <tr className="group">
              <th colSpan={5} />
              <th colSpan={2} scope="colgroup">With skill</th>
              <th colSpan={2} scope="colgroup">Before → after</th>
            </tr>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Model</th>
              <th scope="col" className="num">Tasks</th>
              <th scope="col" className="num">Runs</th>
              <th scope="col" className="num">Without skill</th>
              <th scope="col" className="num secondary">Before</th>
              <th scope="col" className="num after">After</th>
              <th scope="col" className="num">Lines</th>
              <th scope="col" className="num">Tokens / run</th>
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
            <td className="num secondary">{formatCell(row.before)}</td>
            <td className="num after">
              <PassCount cell={row.after} />
            </td>
            <td className="num compact">{row.beforeVersion && row.afterVersion ? `${row.beforeVersion.lines} → ${row.afterVersion.lines}` : "—"}</td>
            <td className="num compact">{row.usage.before.tokens !== null && row.usage.after.tokens !== null ? `${tokens(row.usage.before.tokens)} → ${tokens(row.usage.after.tokens)}` : "—"}</td>
          </tr>))}</tbody>
        </table>
      </div>
      <p className="footnote">Pass counts include only tasks with matching checks in all three columns; tokens are medians per run, and a dash means records are missing.</p>
    </section>
  </>);
};
export default Summary;
