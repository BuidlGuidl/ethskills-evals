/**
 * Node 22+ exposes an experimental Web Storage `localStorage` global when the process
 * is started with `--localstorage-file` (Next.js passes this during `next build`). With
 * no valid backing file the global is present but broken — calling `getItem` throws.
 *
 * Libraries that feature-detect storage via `typeof localStorage !== "undefined"`
 * (e.g. RainbowKit) then hit the broken global and crash the static export
 * (`output: "export"`) while prerendering pages.
 *
 * `localStorage` is a browser-only API, so on the server we remove the global to force
 * those detections back onto their safe no-op path. This module is imported for its
 * side effect at the top of the root layout, before any provider renders. It is a no-op
 * in the browser.
 */
if (typeof window === "undefined") {
  try {
    if (typeof (globalThis as { localStorage?: unknown }).localStorage !== "undefined") {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  } catch {
    // If the global can't be removed we leave it as-is; nothing else to do.
  }
}

export {};
