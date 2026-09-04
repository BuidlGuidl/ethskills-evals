import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { IndexContext, loadIndex } from "./lib/data.js";
import type { Index } from "./lib/types.js";
import "./styles.css";

const Boot = () => {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
  }, []);

  if (error !== null) {
    return (
      <main className="wrap">
        <h1>No index</h1>
        <p className="muted">{error}</p>
      </main>
    );
  }

  if (index === null) {
    return <main className="wrap muted">Loading results…</main>;
  }

  return (
    <IndexContext.Provider value={index}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </IndexContext.Provider>
  );
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);
