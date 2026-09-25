import { PassCount } from "../components/PassCount.js";
import { Link } from "react-router-dom";
import { compareEntry, type Cell } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
const resultTone = (cell: Cell | null) => !cell ? "" : cell.passed === cell.total ? "rate-high" : cell.passed / cell.total < 0.5 ? "rate-low" : "rate-mid";
const Tasks = () => {
  const index = useIndex();
  return <>
    <header className="page-header">
      <h1>Tasks</h1>
      <p className="lede">Open a task to inspect its prompt, checks, and run results.</p>
      <div className="task-legend" aria-label="Task types and result colours">
        <span><span className="task-kind task-kind-quiz">Quiz</span> Reasoning and calculation</span>
        <span><span className="task-kind task-kind-goal">Goal</span> Applied task</span>
        <span className="rate-high">100% passed</span>
        <span className="rate-mid">50–99% passed</span>
        <span className="rate-low">Below 50% passed</span>
      </div>
      <p className="table-legend">A run must pass every check. Run counts include all three conditions; baseline runs can span both evaluation rounds.</p>
    </header>
    {index.skills.map(skill => <section key={skill.name} id={skill.name} className="anchored">
      <h2>
        <Link to={`/skill/${skill.name}`}>{skill.name}</Link>
      </h2>
      {index.showcase?.filter(entry => entry.skill === skill.name).map(entry => {
        const comparison = compareEntry(entry, index);
        return <div key={entry.model} className="task-group">
          <p className="model">{entry.model}</p>
          <div className="table-card scroll" role="region" aria-label={`${skill.name} tasks on ${entry.model}`} tabIndex={0}>
            <table className="table tasks-table">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="num">Checks</th>
                  <th scope="col" className="num">Runs</th>
                  <th scope="col" className="num">Without skill</th>
                  <th scope="col" className="num after">Revised skill</th>
                </tr>
              </thead>
              <tbody>{comparison.rows.map(row => <tr key={row.task}>
                <th scope="row">
                  <Link to={`/task/${row.task}`}>{row.task}</Link>
                </th>
                <td><span className={`task-kind task-kind-${row.kind}`}>{row.kind === "quiz" ? "Quiz" : "Goal"}</span></td>
                <td className="num">{index.tasks.find(task => task.id === row.task)?.expect.length}</td>
                <td className="num">{(row.noSkill?.total ?? 0) + (row.before?.total ?? 0) + (row.after?.total ?? 0)}</td>
                <td className={`num ${resultTone(row.noSkill)}`}><PassCount cell={row.noSkill} /></td>
                <td className={`num after ${resultTone(row.after)}`}><PassCount cell={row.after} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>;
      })}
    </section>)}
  </>;
};
export default Tasks;
