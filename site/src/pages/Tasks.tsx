import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { countRuns, formatCell, tally } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";

const Tasks = () => {
  const index = useIndex();
  const { hash } = useLocation();

  // A hash arriving with the navigation scrolls nothing on its own: the element it names is
  // rendered by this component, so it does not exist yet when the browser looks for it.
  useEffect(() => {
    if (hash.length > 1) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" });
    }
  }, [hash]);
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
          <section key={skill} id={skill} className="anchored">
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
                        {task.status === "retired" && <span className="tag warnTag">retired</span>}
                      </th>
                      <td>{task.kind}</td>
                      <td className="num">{task.expect.length}</td>
                      <td className="num">{countRuns(runs)}</td>
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
