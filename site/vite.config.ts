import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The site is served at ethskills.com/evals: the main site proxies /evals/* to this
// deployment. So every asset URL and route carries that prefix, and the build lands in
// dist/evals so the files sit where the URLs say they are.
export default defineConfig({
  base: "/evals/",
  plugins: [react()],
  build: { outDir: "dist/evals", chunkSizeWarningLimit: 900 },
});
