import { Link, Route, Routes } from "react-router-dom";
import { useIndex } from "./lib/data.js";
import Doc from "./pages/Doc.js";
import Skill from "./pages/Skill.js";
import Summary from "./pages/Summary.js";
import Task from "./pages/Task.js";
import Tasks from "./pages/Tasks.js";
import Writeups from "./pages/Writeups.js";

const App = () => {
  const index = useIndex();

  return (
    <>
      <header className="topbar">
        <nav className="wrap bar">
          <Link className="brand" to="/">
            ethskills evals
          </Link>
          <Link to="/tasks">tasks</Link>
          <Link to="/writeups">write-ups</Link>
          <a href={`https://github.com/${index.generated.repo}`}>repo</a>
          <span className="grow" />
          <span className="muted small">
            {index.runs.length} runs · {index.generated.commit ? index.generated.commit.slice(0, 7) : "unknown"} ·{" "}
            {index.generated.at.slice(0, 10)}
          </span>
        </nav>
      </header>

      <main className="wrap">
        <Routes>
          <Route path="/" element={<Summary />} />
          <Route path="/skill/:name" element={<Skill />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/task/:id" element={<Task />} />
          <Route path="/writeups" element={<Writeups />} />
          <Route path="/report/:file" element={<Doc kind="report" />} />
          <Route path="/pr/:number" element={<Doc kind="pr" />} />
          <Route path="*" element={<h1>Not found</h1>} />
        </Routes>
      </main>

      {index.warnings.length > 0 && (
        <footer className="wrap warn">
          <strong>{index.warnings.length} warnings while building the index.</strong>
          <ul>
            {index.warnings.slice(0, 20).map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </footer>
      )}
    </>
  );
};

export default App;
