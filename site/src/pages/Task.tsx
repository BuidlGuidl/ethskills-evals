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
    return <h1>Task not found</h1>;
  }

  const runs = index.runs.filter(run => run.task === task.id).sort((a, b) => (a.created ?? "").localeCompare(b.created ?? "") || a.run.localeCompare(b.run));
  const earlier = runs.some(run => (run.rubric !== null && task.rubric !== null && run.rubric !== task.rubric) || (run.prompt !== null && task.prompt !== null && run.prompt !== task.prompt));
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
      <p className="muted">{task.kind === "quiz" ? "Quiz: reasoning and calculation" : "Goal: apply advice during a build"} · {task.expect.length} checks · {runs.length} runs</p>
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
      <p className="small muted">The model must pass every check below for the run to pass.</p>
      <ol className="checks">
        {task.expect.map((line, position) => <li key={position}>{line}</li>)}
      </ol>
      {earlier && <p className="footnote">Some runs used an earlier prompt or earlier checks. Each run's dots show the checks used then.</p>}
    </section>
    <section aria-labelledby="runs-heading">
      <div className="section-heading">
        <h2 id="runs-heading">Runs</h2>
        <p className="small muted">Filled dot: pass · hollow dot: fail</p>
      </div>
      <p className="table-legend">Each row is one run. A pass means the model passed every check. "Not recorded" means the run has no record for that value.</p>
      <div className="scroll" role="region" aria-label="Task runs" tabIndex={0}>
        <table className="grid runs-table">
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Skill used</th>
              <th scope="col">Skill version</th>
              <th scope="col">Model</th>
              <th scope="col">Result</th>
              <th scope="col">Checks</th>
              <th scope="col" className="num">Tokens used</th>
              <th scope="col" className="num">Time taken</th>
              <th scope="col">Transcript</th>
            </tr>
          </thead>
          <tbody>{runs.map(run => {
            const entry = index.showcase?.find(entry => entry.skill === task.skill && entry.model === run.model);
            const version = run.variant !== "with_skill" ? "No skill" : run.skill_content === entry?.before ? "Before rewrite" : run.skill_content === entry?.after ? "After rewrite" : "Not recorded";
            return <tr key={run.run}>
              <th scope="row" className="run-label"><span className="run-id">{run.run}</span><span className="cell-detail">{run.created?.slice(0, 10) ?? "date not recorded"}</span>
              </th>
              <td>{run.variant === "with_skill" ? "with skill" : "without skill"}</td>
              <td>{version}</td>
              <td className="model">{run.model}</td>
              <td className={run.pass ? "good" : "bad"}>{run.pass === null ? "Not recorded" : run.pass ? "pass" : "fail"}</td>
              <td>
                <span className="dots">{run.expects ? Object.entries(run.expects).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([check, status]) => <span key={check} className={`dot ${status}`} role="img" aria-label={`Check ${check.replace("expect_", "")}: ${status}`} title={`Check ${check.replace("expect_", "")}: ${status}`} />) : "Not recorded"}</span>
              </td>
              <td className="num">{tokens(run.usage.tokens)}</td>
              <td className="num">{duration(run.usage.duration_s)}</td>
              <td>{run.transcript_url ? <a href={run.transcript_url} aria-label={`Open transcript for ${run.run}`}>Read transcript ↗</a> : "Not recorded"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  </>;
};
export default Task;
