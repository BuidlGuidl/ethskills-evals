import { Link, useParams } from "react-router-dom";
import { useIndex } from "../lib/data.js";

const Task = () => {
  const index = useIndex();
  const { id } = useParams();
  const task = index.tasks.find(entry => entry.id === id) ?? null;

  if (task === null) {
    return <h1>No such task</h1>;
  }

  const runs = index.runs
    .filter(run => run.task === task.id)
    .sort((a, b) => (a.created ?? "").localeCompare(b.created ?? ""));

  return (
    <>
      <h1>{task.id}</h1>
      <p className="muted">
        <Link to={`/skill/${task.skill}`}>skills/{task.skill}</Link> · {task.kind} · {task.runs} runs per variant
        {task.template === null ? " · bare workspace" : ` · template ${task.template}`}
        {task.status === "retired" && <span className="tag warnTag">retired</span>}
      </p>
      {task.status === "retired" && (
        <p className="note">
          This task is retired: it is not run again, and the runs below are kept for what they measured at the time.
        </p>
      )}

      <h2>Prompt</h2>
      <pre className="block">{task.input}</pre>

      <h2>What the judge grades</h2>
      <ol className="expects">
        {task.expect.map((line, position) => (
          <li key={position}>{line}</li>
        ))}
      </ol>

      <h2>Runs</h2>
      {runs.some(entry => entry.regrade_of !== null) && (
        <p className="note">
          Some rows are regrades: the same run's stored evidence read a second time against rewritten{" "}
          <code>expect:</code> lines. A regrade and the run it re-read are one run, so the tables count only the newer
          reading — never both.
        </p>
      )}
      <table className="grid">
        <thead>
          <tr>
            <th>run</th>
            <th>variant</th>
            <th>skill</th>
            <th>model</th>
            <th>result</th>
            <th>expects</th>
            <th>model transcript</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.run}>
              <th scope="row" className="mono small">
                {run.run}
              </th>
              <td>{run.variant}</td>
              <td className="mono small">{run.skill_content ? run.skill_content.slice(0, 8) : "—"}</td>
              <td className="small">{run.executor_model ?? run.executor}</td>
              <td>
                {run.pass === null ? (
                  <span className="tag idle">ungraded</span>
                ) : run.pass ? (
                  <span className="tag good">pass</span>
                ) : (
                  <span className="tag bad">fail</span>
                )}
                {run.regrade_of !== null && (
                  <span className="tag" title={`re-read of ${run.regrade_of}`}>
                    regrade
                  </span>
                )}
                {run.superseded_by !== null && <span className="tag idle">re-read later</span>}
              </td>
              <td className="mono small">
                {run.expects
                  ? Object.entries(run.expects).map(([expect, status]) => (
                      <span key={expect} className={status === "pass" ? "dot good" : "dot bad"} title={expect}>
                        {status === "pass" ? "●" : "○"}
                      </span>
                    ))
                  : "—"}
              </td>
              <td className="small">
                {run.transcript_url ? <a href={run.transcript_url}>open</a> : <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {task.notes !== null && (
        <details className="why">
          <summary>Why this task exists, and how its checks were chosen</summary>
          <pre className="block muted">{task.notes}</pre>
        </details>
      )}
    </>
  );
};

export default Task;
