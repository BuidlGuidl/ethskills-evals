import { Fragment, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cost, duration, thousands } from "../lib/format.js";
import type { Run, Task } from "../lib/types.js";

export const RunPanel = ({ title, subline, groups, footer, onClose }: {
  title: string;
  subline: string;
  groups: { task: Task; runs: Run[]; model?: string; heading?: string }[];
  footer?: ReactNode;
  onClose: () => void;
}) => {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  const sublineId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const siblings = [...document.body.children].filter(element => element instanceof HTMLElement && !element.contains(panel.current)) as HTMLElement[];
    const inert = siblings.map(element => element.inert);
    siblings.forEach(element => { element.inert = true; });
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
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
        <div><h2 id={titleId}>{title}</h2><p id={sublineId} className="muted small">{subline}</p>
          <p className="small muted">Filled dot: pass · hollow dot: fail</p></div>
        <button type="button" onClick={onClose}>Close</button>
      </header>
      {groups.map(({ task, runs, model, heading }) => <Fragment key={`${model ?? ""}/${task.id}`}>
        {heading && <h2 className="panel-model">{heading}</h2>}
        <section className="panel-task">
        <h3>{task.id}</h3><p className="muted small">{task.kind === "quiz" ? "Quiz" : "Goal"}</p>
        <details className="panel-prompt"><summary>Prompt</summary><pre className="prompt">{task.input}</pre></details>
        {[...runs].sort((a, b) => (a.created ?? "").localeCompare(b.created ?? "") || a.run.localeCompare(b.run)).map(run => {
          const earlier = run.rubric !== null && task.rubric !== null && run.rubric !== task.rubric;
          const checks = earlier ? Object.keys(run.expects ?? {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .map(key => ({ key, number: key.replace("expect_", ""), wording: "" }))
            : task.expect.map((wording, i) => ({ key: `expect_${i + 1}`, number: String(i + 1), wording }));
          return <details className="panel-run" key={run.run}>
          <summary>
            <span className="run-date">{run.created ? <time dateTime={run.created}>{run.created.slice(0, 10)}</time> : "Date not recorded"}</span>
            <span className={run.pass ? "good" : "bad"}>{run.pass === null ? "Not recorded" : run.pass ? "Pass" : "Fail"}</span>
            <span className="dots">{checks.map(({ key, number, wording }) => {
              const status = run.expects?.[key];
              return <span key={key} className={`dot ${status ?? "missing"}`} role="img"
                title={earlier ? `Check ${number}` : wording} aria-label={`Check ${number}: ${status ?? "not recorded"}${earlier ? "" : `. ${wording}`}`} />;
            })}</span>
            <span className="small muted">Checks and usage</span>
          </summary>
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
        </details>;
        })}
      </section></Fragment>)}
      {footer && <footer className="run-panel-footer">{footer}</footer>}
    </div>
  </div>, document.body);
};
