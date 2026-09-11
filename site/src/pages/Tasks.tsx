import { PassCount, ResultsLegend } from "../components/PassCount.js";
import { Link } from "react-router-dom";
import { compareEntry } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
const Tasks = () => {
  const index = useIndex();
  return <>
    <header className="page-header">
      <h1>Tasks</h1>
      <p className="lede">{index.tasks.length} tasks across {index.skills.length} skills. Quizzes ask the model to reason and calculate. Goals test whether it uses skill advice during a build without a reminder. Each task links to its prompt, checks and transcripts.</p>
      <p className="muted">Run counts include both skill versions and runs without the skill. A run passes only if the model passes every check.</p>
    </header>
    {index.skills.map(skill => <section key={skill.name} id={skill.name} className="anchored">
      <h2>
        <Link to={`/skill/${skill.name}`}>{skill.name}</Link>
      </h2>
      {index.showcase?.filter(entry => entry.skill === skill.name).map(entry => {
        const comparison = compareEntry(entry, index);
        return <div key={entry.model} className="task-group">
          <p className="model">{entry.model}</p>
          <ResultsLegend />
          <div className="scroll" role="region" aria-label={`${skill.name} tasks on ${entry.model}`} tabIndex={0}>
            <table className="grid">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="num">Checks</th>
                  <th scope="col" className="num">Runs</th>
                  <th scope="col" className="num">Without skill</th>
                  <th scope="col" className="num after">With skill, after rewrite</th>
                </tr>
              </thead>
              <tbody>{comparison.rows.map(row => <tr key={row.task}>
                <th scope="row">
                  <Link to={`/task/${row.task}`}>{row.task}</Link>
                </th>
                <td className="muted">{row.kind}</td>
                <td className="num">{index.tasks.find(task => task.id === row.task)?.expect.length}</td>
                <td className="num">{(row.noSkill?.total ?? 0) + (row.before?.total ?? 0) + (row.after?.total ?? 0)}</td>
                <td className="num"><PassCount cell={row.noSkill} /></td>
                <td className="num after"><PassCount cell={row.after} /></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>;
      })}
    </section>)}
  </>;
};
export default Tasks;
