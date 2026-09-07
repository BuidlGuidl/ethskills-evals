import { Suspense, lazy, useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useIndex } from "./lib/data.js";
import Doc from "./pages/Doc.js";
import Summary from "./pages/Summary.js";
import Task from "./pages/Task.js";
import Tasks from "./pages/Tasks.js";

// Keep the diff engine off the front page's initial bundle.
const Skill = lazy(() => import("./pages/Skill.js"));

const App = () => {
  const index = useIndex();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      try {
        document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
      } catch { /* An invalid hash has no target. */ }
    } else {
      window.scrollTo(0, 0);
    }
    document.title = `${pathname === "/" ? "Skill benchmarks" : pathname.split("/").pop()} · ethskills evals`;
  }, [pathname, hash]);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="topbar">
      <nav className="wrap bar" aria-label="Main navigation">
        <Link className="brand" to="/">ethskills <span>evals</span>
        </Link>
        <NavLink to="/tasks">tasks</NavLink>
        <a href={`https://github.com/${index.generated.repo}`}>repo ↗</a>
        <span className="build-meta">{index.generated.commit ? <a href={`https://github.com/${index.generated.repo}/commit/${index.generated.commit}`}>{index.generated.commit.slice(0, 7)}</a> : "unknown commit"}<span> · </span>
          <time dateTime={index.generated.at}>{index.generated.at.slice(0, 10)}</time>
        </span>
      </nav>
    </header>
    <main className="wrap" id="main">
      <Routes>
        <Route path="/" element={<Summary />} />
        <Route path="/skill/:name" element={<Suspense fallback={<p className="muted">Loading skill…</p>}>
          <Skill />
        </Suspense>} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/task/:id" element={<Task key={pathname} />} />
        <Route path="/report/:file" element={<Doc kind="report" />} />
        <Route path="/pr/:number" element={<Doc kind="pr" />} />
        <Route path="*" element={<h1>Page not found</h1>} />
      </Routes>
    </main>
    <footer className="wrap site-footer">
      <span>ethskills evals</span>
      <a href={`https://github.com/${index.generated.repo}#readme`}>Run an ethskills benchmark ↗</a>
    </footer>
  </>;
};
export default App;
