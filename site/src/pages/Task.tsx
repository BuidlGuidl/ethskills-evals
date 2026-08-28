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
      </p>

      <h2>Prompt</h2>
      <pre className="block">{task.input}</pre>

      <h2>What the judge grades</h2>
      <ol className="expects">
        {task.expect.map((line, position) => (
          <li key={position}>{line}</li>
        ))}
      </ol>

      <h2>Runs</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>run</th>
            <th>variant</th>
            <th>skill</th>
            <th>model</th>
            <th>result</th>
            <th>expects</th>
            <th />
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
                {run.transcript_url && <a href={run.transcript_url}>transcript</a>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {task.notes !== null && (
        <>
          <h2>Why this task exists</h2>
          <pre className="block muted">{task.notes}</pre>
        </>
      )}
    </>
  );
};

export default Task;
