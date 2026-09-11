import { createContext, useContext, useEffect, useState } from "react";
import type { Docs, Index } from "./types.js";

export const IndexContext = createContext<Index | null>(null);

export const useIndex = () => {
  const index = useContext(IndexContext);

  if (index === null) {
    throw new Error("index not loaded");
  }

  return index;
};

const fetchJson = async <T,>(file: string): Promise<T> => {
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`);

  if (!response.ok) {
    throw new Error(`${file} responded ${response.status} — run \`yarn build-index\` at the repo root`);
  }

  return (await response.json()) as T;
};

export const loadIndex = () => fetchJson<Index>("index.json");

// The prose is most of the download and only a report or skill page needs it, so it is
// fetched the first time one opens and kept for the rest of the visit.
let docsPromise: Promise<Docs> | null = null;

export const loadDocs = () => (docsPromise ??= fetchJson<Docs>("docs.json"));

/** null while the prose is still on its way; the page shows a placeholder until then */
export const useDocs = () => {
  const [docs, setDocs] = useState<Docs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    loadDocs()
      .then(loaded => live && setDocs(loaded))
      .catch((failure: unknown) => live && setError(failure instanceof Error ? failure.message : String(failure)));

    return () => {
      live = false;
    };
  }, []);

  return { docs, error };
};

export const shortDate = (value: string | null) => (value === null ? "—" : value.slice(0, 10));
