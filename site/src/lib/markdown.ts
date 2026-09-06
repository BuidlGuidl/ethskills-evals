import DOMPurify from "dompurify";
import { marked } from "marked";

// Report files are ours, but pull request bodies are written by whoever opened the pull
// request, which on a public repo is anyone. Rendered markdown gets sanitised.
//
// A report links to its neighbours the way a file does — `../mistakes/gas.md`,
// `reports/gas-2026-08-28.md` — and inside the app those paths name nothing. They are
// resolved against where the file lives on github, so the link goes where the author meant.
export const renderMarkdown = (source: string, base: string) => {
  const html = DOMPurify.sanitize(marked.parse(source, { async: false }) as string, { USE_PROFILES: { html: true } });
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";

    if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("#") && !href.startsWith("/")) {
      anchor.setAttribute("href", new URL(href, base).href);
    }
  }

  return doc.body.innerHTML;
};
