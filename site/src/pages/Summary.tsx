import { Link } from "react-router-dom";
import { formatCell, summarize } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";

const Summary = () => {
  const index = useIndex();
  const rows = summarize(index);
  const rewritten = rows.filter(row => row.after !== null);

  return (
    <>
      <h1>Does the skill earn its place?</h1>
      <p className="lede">
        Every skill in the <a href="https://ethskills.com">ethskills</a> library is checked the same way: the same task
        run twice, once with the skill installed and once without. A fresh executor for each run, and a blind judge that
        reads the work but never learns which variant produced it.
      </p>
      <p>
        Tasks come in two kinds. A <strong>quiz</strong> asks the skill's question outright and measures whether the
        model already knows the answer. A <strong>goal</strong> asks for something to be built and measures whether the
        discipline surfaces unprompted — the harder claim, and usually the one a skill exists for.
      </p>
      <p>
        When a skill is rewritten the same tasks run again, so a rewrite has a before and an after.{" "}
        {rewritten.length} of {rows.length} skills have been through that twice; the rest have been measured once, and
        their <em>new skill</em> cell is a dash.
      </p>

      <table className="grid">
        <thead>
          <tr>
            <th>skill</th>
            <th className="num">tasks</th>
            <th className="num">runs</th>
            <th className="num">no skill</th>
            <th className="num">old skill</th>
            <th className="num">new skill</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name}>
              <th scope="row">
                <Link to={`/skill/${row.name}`}>{row.name}</Link>
              </th>
              <td className="num">
                <Link to={`/tasks#${row.name}`}>{row.tasks}</Link>
              </td>
              <td className="num">{row.runs}</td>
              <td className="num">{formatCell(row.noSkill)}</td>
              <td className="num">{formatCell(row.before)}</td>
              <td className="num">{formatCell(row.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted small">
        Counts are runs, not records: a regrade re-reads one run's stored evidence against rewritten expect lines, and
        only the newest reading of a run is counted.
      </p>
    </>
  );
};

export default Summary;
