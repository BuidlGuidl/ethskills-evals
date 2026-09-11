import { useParams } from "react-router-dom";
import { useDocs, useIndex } from "../lib/data.js";
import { renderMarkdown } from "../lib/markdown.js";

const Doc = ({ kind }: { kind: "report" | "pr" }) => {
  const index = useIndex();
  const { docs, error } = useDocs();
  const { file, number } = useParams();

  const found =
    kind === "report"
      ? index.reports.find(report => report.file === file)
      : index.prs.find(pr => String(pr.number) === number);

  if (found === undefined) {
    return <h1>{kind === "report" ? "Report not found" : "Pull request not found"}</h1>;
  }

  const title = "title" in found ? found.title : "";
  const raw = docs === null ? null : kind === "report" ? (docs.reports[file ?? ""] ?? "") : (docs.prs[number ?? ""] ?? "");
  // The page heading is the report's own first line, so that line is not rendered twice.
  const source = raw === null ? null : kind === "report" ? raw.replace(/^# [^\n]*\n/, "") : raw;
  const blob = `https://github.com/${index.generated.repo}/blob/main/`;
  const base = kind === "report" ? `${blob}reports/` : blob;

  return (
    <article>
      <p className="muted small">
        <a href={found.url}>{kind === "report" ? (found as { file: string }).file : `pull request #${number}`}</a>
      </p>
      <h1>{title}</h1>
      {error !== null && <p className="note">{error}</p>}
      {source === null && error === null && <p className="muted">Loading…</p>}
      {source !== null && <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(source, base) }} />}
    </article>
  );
};

export default Doc;
