import { Link } from "react-router-dom";
import { formatCell, tally } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";

const Tasks = () => {
  const index = useIndex();
  const bySkill = [...new Set(index.tasks.map(task => task.skill))].sort();

  return (
    <>
      <h1>Tasks</h1>
      <p className="lede">
        {index.tasks.length} tasks across {bySkill.length} skills. A quiz asks the skill's question outright; a goal
        asks for a build and measures whether the discipline surfaces unprompted. Each one lists the{" "}
        <code>expect:</code> lines the judge grades against.
      </p>

      {bySkill.map(skill => {
        const tasks = index.tasks.filter(task => task.skill === skill).sort((a, b) => a.id.localeCompare(b.id));

        return (
          <section key={skill} id={skill}>
            <h2>
              <Link to={`/skill/${skill}`}>{skill}</Link>
            </h2>
            <table className="grid">
              <thead>
                <tr>
                  <th>task</th>
                  <th>kind</th>
                  <th className="num">expects</th>
                  <th className="num">runs</th>
                  <th className="num">no_skill</th>
                  <th className="num">with_skill</th>
                  <th>workspace</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const runs = index.runs.filter(run => run.task === task.id);

                  return (
                    <tr key={task.id}>
                      <th scope="row">
                        <Link to={`/task/${task.id}`}>{task.id.replace(`${skill}-`, "")}</Link>
                      </th>
                      <td>{task.kind}</td>
                      <td className="num">{task.expect.length}</td>
                      <td className="num">{runs.length}</td>
                      <td className="num">{formatCell(tally(runs.filter(run => run.variant === "no_skill")))}</td>
                      <td className="num">{formatCell(tally(runs.filter(run => run.variant === "with_skill")))}</td>
                      <td className="small muted">{task.template === null ? "bare" : task.template}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
};

export default Tasks;
