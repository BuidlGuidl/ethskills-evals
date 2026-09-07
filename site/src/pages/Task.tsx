import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useIndex } from "../lib/data.js";
import { duration, tokens } from "../lib/format.js";

const Task = () => {
  const index = useIndex();
  const { id } = useParams();
  const [copyStatus, setCopyStatus] = useState("");
  const task = index.tasks.find(entry => entry.id === id);
  if (!task) {
    return <h1>No such task</h1>;
  }

  const runs = index.runs.filter(run => run.task === task.id).sort((a, b) => (a.created ?? "").localeCompare(b.created ?? "") || a.run.localeCompare(b.run));
  const earlier = runs.some(run => run.rubric !== null && task.rubric !== null && run.rubric !== task.rubric);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(task.input);
      setCopyStatus("Prompt copied.");
    } catch {
      setCopyStatus("Copy failed. Select the prompt text to copy it.");
    }
  };
  return <>
    <header className="page-header">
      <Link className="back" to={`/skill/${task.skill}`}>{task.skill}</Link>
      <h1>{task.id}</h1>
      <p className="muted">{task.kind} · {task.expect.length} checks · {runs.length} runs</p>
    </header>
    <section aria-labelledby="prompt-heading">
      <div className="section-heading">
        <h2 id="prompt-heading">Prompt</h2>
        <button onClick={copy}>Copy prompt</button>
      </div>
      <p role="status" className="copy-status small">{copyStatus}</p>
      <pre className="prompt">{task.input}</pre>
    </section>
    <section aria-labelledby="checks-heading">
      <h2 id="checks-heading">Checks</h2>
      <ol className="checks">
        {task.expect.map((line, position) => <li key={position}>{line}</li>)}
      </ol>
      {earlier && <p className="footnote">Some runs used an earlier revision of these checks; their dots show the checks used for that run.</p>}
    </section>
    <section aria-labelledby="runs-heading">
      <div className="section-heading">
        <h2 id="runs-heading">Runs</h2>
        <p className="small muted">Filled dot: pass · hollow dot: fail</p>
      </div>
      <div className="scroll" role="region" aria-label="Task runs" tabIndex={0}>
        <table className="grid runs-table">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Variant</th>
              <th scope="col">Version</th>
              <th scope="col">Model</th>
              <th scope="col">Result</th>
              <th scope="col">Checks</th>
              <th scope="col" className="num">Tokens</th>
              <th scope="col" className="num">Duration</th>
              <th scope="col">Transcript</th>
            </tr>
          </thead>
          <tbody>{runs.map((run, position) => {
            const entry = index.showcase?.find(entry => entry.skill === task.skill && entry.model === run.model);
            const version = run.variant !== "with_skill" ? "—" : run.skill_content === entry?.before ? "before" : run.skill_content === entry?.after ? "after" : "—";
            // A short row label keeps archive bookkeeping out of the reading view; the link identifies the source.
            return <tr key={run.run}>
              <th scope="row" className="run-label">{String(position + 1).padStart(2, "0")}<span className="cell-detail">{run.created?.slice(0, 10) ?? "date not recorded"}</span>
              </th>
              <td>{run.variant === "with_skill" ? "with skill" : "without skill"}</td>
              <td>{version}</td>
              <td className="model">{run.model}</td>
              <td className={run.pass ? "good" : "bad"}>{run.pass === null ? "—" : run.pass ? "pass" : "fail"}</td>
              <td>
                <span className="dots">{run.expects ? Object.entries(run.expects).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([check, status]) => <span key={check} className={`dot ${status}`} role="img" aria-label={`Check ${check.replace("expect_", "")}: ${status}`} title={`Check ${check.replace("expect_", "")}: ${status}`} />) : "—"}</span>
              </td>
              <td className="num">{tokens(run.usage.tokens)}</td>
              <td className="num">{duration(run.usage.duration_s)}</td>
              <td>{run.transcript_url ? <a href={run.transcript_url} aria-label={`Open transcript for run ${position + 1}`}>Read ↗</a> : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  </>;
};
export default Task;
