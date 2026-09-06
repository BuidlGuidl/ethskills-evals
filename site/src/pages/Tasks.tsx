import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Marker from "../components/Marker.js";
import { countRuns, formatCell, mixed, shareRubric, tally } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { CELLS_DIFFER, MIXED_RUBRICS } from "../lib/notes.js";

const Tasks = () => {
  const index = useIndex();
  const { hash } = useLocation();

  // A hash arriving with the navigation scrolls nothing on its own: the element it names is
  // rendered by this component, so it does not exist yet when the browser looks for it.
  useEffect(() => {
    if (hash.length > 1) {
      try {
        document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" });
      } catch {
        // a hash that is not valid percent-encoding names nothing; there is nowhere to scroll
      }
    }
  }, [hash]);
  const bySkill = [...new Set(index.tasks.map(task => task.skill))].sort();

  // Every run of a task, whatever skill version or expect revision it saw: an inventory, not
  // a comparison. A cell that pools rubrics says so, and so does a row whose two cells share none.
  const cells = index.tasks.map(task => {
    const runs = index.runs.filter(run => run.task === task.id);
    const noSkill = tally(runs.filter(run => run.variant === "no_skill"));
    const withSkill = tally(runs.filter(run => run.variant === "with_skill"));

    return {
      task,
      runs: countRuns(runs),
      noSkill,
      withSkill,
      differ: noSkill !== null && withSkill !== null && !shareRubric(noSkill, withSkill),
    };
  });
  const pooled = cells.some(cell => mixed(cell.noSkill) || mixed(cell.withSkill));
  const differ = cells.some(cell => cell.differ);

  return (
    <>
      <h1>Tasks</h1>
      <p className="lede">
        {index.tasks.length} tasks across {bySkill.length} skills. A quiz asks the skill's question outright; a goal
        asks for a build and measures whether the discipline surfaces unprompted. Each one lists the{" "}
        <code>expect:</code> lines the judge grades against. The counts here are every run of the task, over every
        version of the skill; the skill page is where before faces after.
      </p>

      {bySkill.map(skill => {
        const mine = cells
          .filter(cell => cell.task.skill === skill)
          .sort((a, b) => a.task.id.localeCompare(b.task.id));

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
                {mine.map(({ task, runs, noSkill, withSkill, differ: rowDiffers }) => (
                  <tr key={task.id}>
                    <th scope="row">
                      <Link to={`/task/${task.id}`}>{task.id.replace(`${skill}-`, "")}</Link>
                      {task.status === "retired" && <span className="tag warnTag">retired</span>}
                    </th>
                    <td>{task.kind}</td>
                    <td className="num">{task.expect.length}</td>
                    <td className="num">{runs}</td>
                    <td className="num">
                      {formatCell(noSkill)}
                      {mixed(noSkill) && <Marker symbol="†" note={MIXED_RUBRICS} />}
                    </td>
                    <td className="num">
                      {formatCell(withSkill)}
                      {rowDiffers && <Marker symbol="‡" note={CELLS_DIFFER} />}
                      {mixed(withSkill) && <Marker symbol="†" note={MIXED_RUBRICS} />}
                    </td>
                    <td className="small muted">{task.template === null ? "bare" : task.template}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {differ && (
        <p className="footnote">
          <strong className="moved">‡</strong> {CELLS_DIFFER}
        </p>
      )}

      {pooled && (
        <p className="footnote">
          <strong className="moved">†</strong> {MIXED_RUBRICS}
        </p>
      )}
    </>
  );
};

export default Tasks;
