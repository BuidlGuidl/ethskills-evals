import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cost, duration, thousands } from "../lib/format.js";
import type { Run, Task } from "../lib/types.js";
import { percent, rateBucket } from "../lib/grid.js";

const Chevron = () => <svg className="panel-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
  <path d="m4 2 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
</svg>;

const activateRow = (event: KeyboardEvent<HTMLTableRowElement>, toggle: () => void) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
};

const TaskRows = ({ task, runs, initiallyOpen }: { task: Task; runs: Run[]; initiallyOpen: boolean }) => {
  const [open, setOpen] = useState(initiallyOpen);
  const [expanded, setExpanded] = useState<string | null>(null);
  const passed = runs.filter(run => run.pass).length;
  const rate = percent(passed, runs.length);
  const toggle = () => setOpen(value => !value);
  return <>
    <tr className="panel-task-row panel-toggle" role="button" tabIndex={0} aria-expanded={open}
      aria-label={`${task.id}, ${task.kind === "quiz" ? "Quiz" : "Goal"}, ${passed} of ${runs.length} runs passed`}
      onClick={toggle} onKeyDown={event => activateRow(event, toggle)}>
      <th scope="row"><span className="panel-row-label"><Chevron />{task.id}</span></th>
      <td className="muted">{task.kind === "quiz" ? "Quiz" : "Goal"}</td>
      <td className={`panel-status ${runs.length ? `rate-${rateBucket(rate)}` : "muted"}`}><span>{runs.length ? `${passed}/${runs.length} · ${rate}%` : "Not run yet"}</span></td>
    </tr>
    {open && [...runs].sort((a, b) => (a.created ?? "").localeCompare(b.created ?? "") || a.run.localeCompare(b.run)).map((run, i) => {
      const earlier = run.rubric !== null && task.rubric !== null && run.rubric !== task.rubric;
      const checks = earlier ? Object.keys(run.expects ?? {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(key => ({ key, number: key.replace("expect_", ""), wording: "" }))
        : task.expect.map((wording, n) => ({ key: `expect_${n + 1}`, number: String(n + 1), wording }));
      const runOpen = expanded === run.run;
      const toggleRun = () => setExpanded(value => value === run.run ? null : run.run);
      return <Fragment key={run.run}>
        <tr className="panel-run-row panel-toggle" role="button" tabIndex={0} aria-expanded={runOpen}
          aria-label={`Run ${i + 1}, ${run.created?.slice(0, 10) ?? "Date not recorded"}, ${run.pass ? "Pass" : "Fail"}`}
          onClick={toggleRun} onKeyDown={event => activateRow(event, toggleRun)}>
          <th scope="row"><span className="panel-row-label"><Chevron />Run {i + 1}
            <span className="run-date muted">{run.created ? <time dateTime={run.created}>{run.created.slice(0, 10)}</time> : "Date not recorded"}</span>
          </span></th>
          <td><span className="dots">{checks.map(({ key, number, wording }) => {
            const status = run.expects?.[key];
            return <span key={key} className={`dot ${status ?? "missing"}`} role="img"
              aria-label={`Check ${number}: ${status ?? "not recorded"}${earlier ? "" : `. ${wording}`}`} />;
          })}</span></td>
          <td className={`panel-status ${run.pass === null ? "muted" : run.pass ? "rate-high" : "rate-low"}`}><span>{run.pass === null ? "Not recorded" : run.pass ? "Pass" : "Fail"}</span></td>
        </tr>
        {runOpen && <tr className="panel-detail-row"><td colSpan={3}>
          <details className="panel-prompt"><summary>Prompt</summary><pre className="prompt">{task.input}</pre></details>
          {earlier && <p className="small muted">This run used an earlier version of the checks.</p>}
          <ol className="panel-checks">{checks.map(({ key, number, wording }) => {
            const status = run.expects?.[key];
            return <li key={key}>{earlier && `Check ${number}: `}<span className={status === "pass" ? "good" : status === "fail" ? "bad" : "muted"}>
              {status === "pass" ? "Pass" : status === "fail" ? "Fail" : "Not recorded"}</span>{!earlier && ` ${wording}`}</li>;
          })}</ol>
          <dl className="panel-usage">
            {run.usage.tokens !== null && <div><dt>Tokens</dt><dd>{thousands(run.usage.tokens)}</dd></div>}
            {run.usage.duration_s !== null && <div><dt>Time</dt><dd>{duration(run.usage.duration_s)}</dd></div>}
            {run.usage.cost_usd !== null && <div><dt>Cost, USD</dt><dd>{cost(run.usage.cost_usd)}</dd></div>}
          </dl>
          {run.transcript_url && <a href={run.transcript_url} target="_blank" rel="noopener noreferrer">Transcript</a>}
        </td></tr>}
      </Fragment>;
    })}
  </>;
};

export const RunPanel = ({ title, subline, groups, controls, footer, onClose }: {
  title: string;
  subline: string;
  groups: { task: Task; runs: Run[]; model?: string; heading?: string }[];
  controls?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) => {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  const sublineId = useId();
  const allRuns = groups.flatMap(group => group.runs);
  const passed = allRuns.filter(run => run.pass).length;
  const rate = percent(passed, allRuns.length);
  const armLabel = subline.split(",")[0];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const siblings = [...document.body.children].filter(element => element instanceof HTMLElement && !element.contains(panel.current)) as HTMLElement[];
    const inert = siblings.map(element => element.inert);
    siblings.forEach(element => { element.inert = true; });
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const focusable = [...(panel.current?.querySelectorAll<HTMLElement>("button, a[href], summary, [tabindex='0']") ?? [])]
        .filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      siblings.forEach((element, i) => { element.inert = inert[i]; });
      previous?.focus();
    };
  }, []);
  return createPortal(<div className="run-panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="run-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={sublineId} tabIndex={-1}>
      <header className="run-panel-header">
        <div className="panel-title">
          <h2 id={titleId}>{title}</h2>
          <p id={sublineId} className="muted small">{armLabel}</p>
        </div>
        <p className="panel-header-status">{allRuns.length ? <>{passed} of {allRuns.length} runs pass / <span className={`rate-${rateBucket(rate)}`}>{rate}%</span></> : "Not run yet"}</p>
        <button className="panel-close" type="button" aria-label="Close panel" onClick={onClose}>×</button>
      </header>
      {controls && <div className="panel-controls">{controls}</div>}
      {allRuns.length === 0 && <p className="panel-empty muted">No runs are available for this selection.</p>}
      <div className="table-card scroll panel-table-card">
        <table className="table panel-table">
          <thead><tr><th scope="col">Task</th><th scope="col">Kind</th><th scope="col">Status</th></tr></thead>
          <tbody>{groups.map(({ task, runs, model, heading }) => <Fragment key={`${model ?? ""}/${task.id}`}>
            {heading && <tr className="panel-model-row"><th colSpan={3} scope="colgroup">{heading}</th></tr>}
            <TaskRows task={task} runs={runs} initiallyOpen={groups.length === 1} />
          </Fragment>)}</tbody>
        </table>
      </div>
      <p className="panel-dot-key small muted">Filled dot: pass · hollow dot: fail</p>
      {footer && <footer className="run-panel-footer">{footer}</footer>}
    </div>
  </div>, document.body);
};
