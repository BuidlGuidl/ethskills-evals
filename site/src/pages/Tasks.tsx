import { Link } from "react-router-dom";
import { compareEntry, formatCell } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
const Tasks = () => {
  const index = useIndex();
  return <>
    <header className="page-header">
      <p className="eyebrow">The benchmark tasks</p>
      <h1>What the model was asked.</h1>
      <p className="lede">{index.tasks.length} tasks across {index.skills.length} skills. Quizzes ask a question; goals ask for a build. Open a task for its prompt, checks and run transcripts.</p>
      <p className="muted">Counts show all selected runs on each model. “With skill” uses the rewrite. Skill pages explain which tasks enter comparison totals.</p>
    </header>
    {index.skills.map(skill => <section key={skill.name} id={skill.name} className="anchored">
      <h2>
        <Link to={`/skill/${skill.name}`}>{skill.name}</Link>
      </h2>
      {index.showcase?.filter(entry => entry.skill === skill.name).map(entry => {
        const comparison = compareEntry(entry, index);
        return <div key={entry.model} className="task-group">
          <p className="model">{entry.model}</p>
          <div className="scroll" role="region" aria-label={`${skill.name} tasks on ${entry.model}`} tabIndex={0}>
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="num">Checks</th>
                  <th scope="col" className="num">Runs</th>
                  <th scope="col" className="num">Without skill</th>
                  <th scope="col" className="num after">With skill (after)</th>
                </tr>
              </thead>
              <tbody>{comparison.rows.map(row => <tr key={row.task}>
                <th scope="row">
                  <Link to={`/task/${row.task}`}>{row.task}</Link>
                </th>
                <td className="muted">{row.kind}</td>
                <td className="num">{index.tasks.find(task => task.id === row.task)?.expect.length}</td>
                <td className="num">{(row.noSkill?.total ?? 0) + (row.before?.total ?? 0) + (row.after?.total ?? 0)}</td>
                <td className="num">{formatCell(row.noSkill)}</td>
                <td className="num after">{formatCell(row.after)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>;
      })}
    </section>)}
  </>;
};
export default Tasks;
