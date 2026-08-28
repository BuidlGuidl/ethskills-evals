import { Link } from "react-router-dom";
import { formatCell, summarize } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";

const Summary = () => {
  const index = useIndex();
  const rows = summarize(index);
  const measured = rows.filter(row => row.measured);

  return (
    <>
      <h1>Does the model already pass without the skill?</h1>
      <p className="lede">
        Every skill in the ethskills library, run as the same task with the skill and without it, a fresh executor per
        run and a blind judge. {index.runs.length} graded runs across {index.tasks.length} tasks.
      </p>
      <p className="muted">
        {measured.length} of {rows.length} skills have been benchmarked twice — once at full length and once after being
        cut down. Those are the rows with a <strong>reduced</strong> column; the rest say <em>not measured</em>.
      </p>

      <table className="grid">
        <thead>
          <tr>
            <th>skill</th>
            <th className="num">tasks</th>
            <th className="num">runs</th>
            <th className="num">no_skill</th>
            <th className="num">with_skill</th>
            <th className="num">original</th>
            <th className="num">reduced</th>
            <th>state</th>
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
              <td className="num">{formatCell(row.withSkill)}</td>
              <td className="num">{row.original ? `${row.original.lines} l` : "—"}</td>
              <td className="num">{row.reduced ? `${row.reduced.lines} l` : "—"}</td>
              <td>
                {row.runs === 0 ? (
                  <span className="tag idle">no runs</span>
                ) : row.measured ? (
                  <span className="tag good">reduction measured</span>
                ) : row.unmeasuredInRepo ? (
                  <span className="tag warnTag">reduced, not measured</span>
                ) : (
                  <span className="tag idle">one version</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

export default Summary;
