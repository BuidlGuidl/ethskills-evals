import DOMPurify from "dompurify";
import { marked } from "marked";

// Report files are ours, but pull request bodies are written by whoever opened the pull
// request, which on a public repo is anyone. Rendered markdown gets sanitised.
export const renderMarkdown = (source: string) =>
  DOMPurify.sanitize(marked.parse(source, { async: false }) as string, { USE_PROFILES: { html: true } });
