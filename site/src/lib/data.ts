import { createContext, useContext } from "react";
import type { Index } from "./types.js";

export const IndexContext = createContext<Index | null>(null);

export const useIndex = () => {
  const index = useContext(IndexContext);

  if (index === null) {
    throw new Error("index not loaded");
  }

  return index;
};

export const loadIndex = async (): Promise<Index> => {
  const response = await fetch(`${import.meta.env.BASE_URL}index.json`);

  if (!response.ok) {
    throw new Error(`index.json responded ${response.status} — run \`yarn build-index\` at the repo root`);
  }

  return (await response.json()) as Index;
};

export const shortDate = (value: string | null) => (value === null ? "—" : value.slice(0, 10));
