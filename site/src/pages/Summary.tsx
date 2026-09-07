import { Link } from "react-router-dom";
import { formatCell, summarize } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";

const Summary = () => {
  const index = useIndex();
  const rows = summarize(index);
  return (
    <>
      <h1 className="hero">Skill benchmarks</h1>
      <p className="lede">
        Results for every skill in the <a href="https://ethskills.com">ethskills</a> library. A skill earns its place
        only if a model does the job better with it than without it, so that is what is measured: the same task, once
        with the skill installed and once without, graded by a judge that never learns which is which.
      </p>

      <h2>How a skill is measured</h2>
      <ol className="steps">
        <li>
          <strong>A task.</strong> Each skill gets tasks of two kinds. A <em>quiz</em> asks the skill's question
          outright and checks whether the model already knows the answer. A <em>goal</em> asks for something to be built
          and checks whether the skill's discipline shows up unprompted. Goals are the harder test, and usually the
          reason a skill exists.
        </li>
        <li>
          <strong>Two variants.</strong> The task runs several times with the skill and several times without, each in a
          fresh workspace with a fresh agent. The agent sees the task and nothing else: an agent that knows how it is
          graded starts acting smart.
        </li>
        <li>
          <strong>A blind judge.</strong> A separate call grades every run against the task's <code>expect:</code>{" "}
          lines without knowing which variant produced it. The headline is the raw pass count.
        </li>
      </ol>
      <p className="copy">
        Every rewrite of a skill goes back through the same tasks, so a skill has a before and an after. The loop is
        short: benchmark, read what the failing runs got wrong, patch the skill where they point, run again, until the
        skill is crisp or it turns out not to be worth its place. How to run it yourself is in the{" "}
        <a href={`https://github.com/${index.generated.repo}#readme`}>repo README</a>.
      </p>

      <h2>Results</h2>
      <div className="scroll">
        <table className="grid">
          <thead>
            <tr className="group">
              <th colSpan={4} />
              <th colSpan={2} className="span">
                with skill
              </th>
            </tr>
            <tr>
              <th>skill</th>
              <th className="num">tasks</th>
              <th className="num">runs</th>
              <th className="num">without skill</th>
              <th className="num">before</th>
              <th className="num">after</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.skill}/${row.model}`}>
                <th scope="row">
                  <Link to={`/skill/${row.skill}`}>{row.skill}</Link>
                </th>
                <td className="num">
                  <Link to={`/tasks#${row.skill}`}>{row.tasks}</Link>
                </td>
                <td className="num">{row.runs}</td>
                <td className="num">{formatCell(row.noSkill)}</td>
                <td className="num">{formatCell(row.before)}</td>
                <td className="num">
                  {formatCell(row.after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
};

export default Summary;
