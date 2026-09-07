import { PatchDiff } from "@pierre/diffs/react";
import Marker from "../components/Marker.js";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { compareSkill, formatCell, mixed, type Cell, type Row } from "../lib/compare.js";
import { useDocs, useIndex } from "../lib/data.js";
import { patchBetween } from "../lib/diff.js";
import {
  MIXED_RUBRICS,
  MODEL_MOVED,
  NO_COMPARABLE_ROWS,
  NO_SHARED_TASKS,
  PARTIAL_COVERAGE,
  PROMPT_MOVED,
  RETIRED_ROW,
  RUBRIC_MOVED,
  UNAIDED_MODELS,
  UNAIDED_OFF_RUBRIC,
} from "../lib/notes.js";

const size = (lines: number, words: number) => `${lines} lines / ${words} words`;
const models = (cell: Cell | null) => (cell === null ? "—" : cell.models.join(", "));

// What moved between the two skilled cells, in the words of the footnote each mark stands for.
const movedNote = (row: Row) =>
  [row.rubricMoved ? RUBRIC_MOVED : null, row.promptMoved ? PROMPT_MOVED : null].filter(Boolean).join(" ");

const modelNote = (row: Row) => `${MODEL_MOVED} Before: ${models(row.before)}. After: ${models(row.after)}.`;

const unaidedModelNote = (row: Row) =>
  `${UNAIDED_MODELS} Without skill: ${models(row.noSkill)}. With skill: ${models(row.after ?? row.before)}.`;

const Skill = () => {
  const index = useIndex();
  const { docs } = useDocs();
  const { name } = useParams();
  const skill = index.skills.find(entry => entry.name === name) ?? null;
  const [showDiff, setShowDiff] = useState(true);

  const comparison = useMemo(
    () => (skill === null ? null : compareSkill(skill, index.tasks, index.runs)),
    [skill, index],
  );

  const patch = useMemo(() => {
    const target = comparison?.after ?? comparison?.current ?? null;

    if (comparison?.before == null || target === null || target.id === comparison.before.id || docs === null) {
      return null;
    }

    return patchBetween(
      { sha: comparison.before.sha, text: docs.skills[comparison.before.id] ?? "" },
      { sha: target.sha, text: docs.skills[target.id] ?? "" },
    );
  }, [comparison, docs]);

  if (skill === null || comparison === null) {
    return <h1>No such skill</h1>;
  }

  const { before, after, current, between, rows, coverage } = comparison;
  // Nothing to put side by side when the repo still holds the one version that was measured.
  const right = after ?? (current !== null && current.id !== before?.id ? current : null);
  const reports = index.reports.filter(report => report.skill.startsWith(skill.name));
  const prs = index.prs.filter(pr => pr.skill === skill.name);
  const moved = rows.some(row => row.rubricMoved || row.promptMoved);
  const modelMoved = rows.some(row => row.modelMoved || row.unaidedModels);
  const offRubric = rows.some(row => row.unaidedOffRubric);
  const pooled = rows.some(row => mixed(row.noSkill) || mixed(row.before) || mixed(row.after));
  const retired = after !== null && rows.some(row => row.retired);
  const fullCoverage = coverage.counted === coverage.total;

  return (
    <>
      <h1>
        skills/{skill.name}
        <a className="small src" href={`https://ethskills.com/${skill.name}/SKILL.md`}>
          upstream
        </a>
      </h1>

      {after === null ? (
        <p className="lede">
          Measured once, at {before ? size(before.lines, before.words) : "an unknown size"}. It has not been rewritten
          and re-run, so there is no before and after to compare.
        </p>
      ) : (
        <p className="lede">
          Rewritten from <strong>{size(before!.lines, before!.words)}</strong> to{" "}
          <strong>{size(after.lines, after.words)}</strong>
          {comparison.comparable && fullCoverage
            ? ", and both versions were put through the same tasks."
            : comparison.comparable
              ? `, and compared on ${coverage.counted} of ${coverage.total} tasks.`
              : "."}
        </p>
      )}

      {comparison.editedAfterBenchmark && current !== null && (
        <p className="note">
          The file in the repo today is {size(current.lines, current.words)} — it was edited after the benchmark, so no
          run was graded on exactly this text. The numbers below belong to the versions that were measured.
        </p>
      )}

      <h2>Results</h2>
      <table className="grid">
        <thead>
          <tr className="group">
            <th colSpan={2} />
            <th colSpan={2} className="span">
              with skill
            </th>
          </tr>
          <tr>
            <th>task</th>
            <th className="num">without skill</th>
            <th className="num">before</th>
            <th className="num">after</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.task} className={after !== null && !row.counted ? "uncounted" : undefined}>
              <th scope="row">
                <Link to={`/task/${row.task}`}>{row.task.replace(`${skill.name}-`, "")}</Link>{" "}
                <span className="muted small">{row.kind}</span>
                {row.retired && <Marker symbol="retired" note={RETIRED_ROW} className="tag warnTag" />}
              </th>
              <td className="num">
                {formatCell(row.noSkill)}
                {row.unaidedOffRubric && <Marker symbol="§" note={UNAIDED_OFF_RUBRIC} />}
                {row.unaidedModels && <Marker symbol="◊" note={unaidedModelNote(row)} />}
                {mixed(row.noSkill) && <Marker symbol="†" note={MIXED_RUBRICS} />}
              </td>
              <td className="num">
                {formatCell(row.before)}
                {(row.rubricMoved || row.promptMoved) && <Marker symbol="‡" note={movedNote(row)} />}
                {row.modelMoved && <Marker symbol="◊" note={modelNote(row)} />}
                {mixed(row.before) && <Marker symbol="†" note={MIXED_RUBRICS} />}
              </td>
              <td className="num">
                {formatCell(row.after)}
                {(row.rubricMoved || row.promptMoved) && <Marker symbol="‡" note={movedNote(row)} />}
                {row.modelMoved && <Marker symbol="◊" note={modelNote(row)} />}
                {mixed(row.after) && <Marker symbol="†" note={MIXED_RUBRICS} />}
              </td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">
              total{" "}
              <span className="muted small">
                {fullCoverage ? `all ${coverage.total} tasks` : `${coverage.counted} of ${coverage.total} tasks`}
              </span>
            </th>
            <td className="num">{formatCell(comparison.totals.noSkill)}</td>
            <td className="num">{formatCell(comparison.totals.before)}</td>
            <td className="num">{formatCell(comparison.totals.after)}</td>
          </tr>
        </tbody>
      </table>

      <p className="footnote">
        Models: without skill {models(comparison.totals.noSkill)} · before {models(comparison.totals.before)}
        {after !== null && <> · after {models(comparison.totals.after)}</>}.
      </p>

      {!comparison.comparable && (
        <p className="note">{comparison.sharedRows === 0 ? NO_SHARED_TASKS : NO_COMPARABLE_ROWS}</p>
      )}

      {comparison.comparable && after !== null && !fullCoverage && (
        <p className="footnote">
          <strong className="moved">*</strong> {PARTIAL_COVERAGE}
        </p>
      )}

      {moved && (
        <p className="footnote">
          <strong className="moved">‡</strong> The task's expect: lines or prompt were rewritten between the two
          versions, so the two cells were graded by different rules and are not a comparison. Hover the mark for
          which. The row is left out of the totals.
        </p>
      )}

      {modelMoved && (
        <p className="footnote">
          <strong className="moved">◊</strong> {MODEL_MOVED} Hover the mark for the models.
        </p>
      )}

      {offRubric && (
        <p className="footnote">
          <strong className="moved">§</strong> {UNAIDED_OFF_RUBRIC}
        </p>
      )}

      {pooled && (
        <p className="footnote">
          <strong className="moved">†</strong> {MIXED_RUBRICS}
        </p>
      )}

      {retired && (
        <p className="footnote">
          <strong className="moved">retired</strong> {RETIRED_ROW}
        </p>
      )}

      {between.length > 0 && (
        <p className="footnote">
          {between.length} more measured {between.length === 1 ? "version was" : "versions were"} benchmarked and
          {between.length === 1 ? " is" : " are"} not shown above:{" "}
          {between.map(version => `${version.lines} lines (${version.runs} runs)`).join(", ")}.
        </p>
      )}

      {(reports.length > 0 || prs.length > 0) && (
        <>
          <h2>{right === null ? "Reports and write-ups" : "Why it changed"}</h2>
          <ul className="docs">
            {reports.map(report => (
              <li key={report.file}>
                <Link to={`/report/${report.file}`}>{report.title}</Link>{" "}
                <span className="muted small">report · {report.date}</span>
              </li>
            ))}
            {prs.map(pr => (
              <li key={pr.number}>
                <Link to={`/pr/${pr.number}`}>{pr.title}</Link>{" "}
                <span className="muted small">
                  pull request #{pr.number} · {pr.state.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {right !== null && (
        <>
          <h2>
            The skill, then and now
            <button className="toggle" onClick={() => setShowDiff(!showDiff)}>
              {showDiff ? "hide" : "show"}
            </button>
          </h2>
          {showDiff && docs === null && <p className="muted">Loading the skill texts…</p>}
          {showDiff && patch !== null && (
            <>
              <p className="footnote">
                Left: {before ? size(before.lines, before.words) : "—"}. Right:{" "}
                {after === null ? "the file in the repo now" : "the version measured after the rewrite"},{" "}
                {right !== null ? size(right.lines, right.words) : "—"}. Unchanged stretches are collapsed.
              </p>
                <PatchDiff
                patch={patch}
                className="patch"
                options={{
                  diffStyle: "split",
                  lineDiffType: "word",
                  overflow: "scroll",
                  disableFileHeader: true,
                  expandUnchanged: false,
                  theme: { light: "github-light", dark: "github-dark" },
                }}
              />
            </>
          )}
        </>
      )}

    </>
  );
};

export default Skill;
