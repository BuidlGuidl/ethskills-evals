import { useParams } from "react-router-dom";
import { useIndex } from "../lib/data.js";
import { renderMarkdown } from "../lib/markdown.js";

const Doc = ({ kind }: { kind: "report" | "pr" }) => {
  const index = useIndex();
  const { file, number } = useParams();

  const found =
    kind === "report"
      ? index.reports.find(report => report.file === file)
      : index.prs.find(pr => String(pr.number) === number);

  if (found === undefined) {
    return <h1>Not found</h1>;
  }

  const title = "title" in found ? found.title : "";
  // The page heading is the report's own first line, so that line is not rendered twice.
  const source = "markdown" in found ? found.markdown.replace(/^# [^\n]*\n/, "") : found.body;
  const blob = `https://github.com/${index.generated.repo}/blob/main/`;
  const base = kind === "report" ? `${blob}reports/` : blob;

  return (
    <article>
      <p className="muted small">
        <a href={found.url}>{kind === "report" ? (found as { file: string }).file : `pull request #${number}`}</a>
      </p>
      <h1>{title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(source, base) }} />
    </article>
  );
};

export default Doc;
