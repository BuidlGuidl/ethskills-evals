# Why `localStorage.getItem is not a function` on Node 25 prerender

## What changed in Node

- Node 22.4 added Web Storage (`localStorage`, `sessionStorage`) as an **experimental, flagged** feature (`--experimental-webstorage`).
- **Node 25 turned it on by default.** Now `localStorage` is a real global in every Node process.
- It only works properly when a backing file is set (`--localstorage-file=<path>`). Without one, the global still **exists**, but it is not a working Storage object: it lacks the standard methods (`getItem`, `setItem`, …), so calling them throws.

## Why Teammate A is out of date

"Node has no localStorage" was true up to Node 24 (unless you passed the flag). On Node 25 it is false. The error message proves it: if there were no global, you'd get `ReferenceError: localStorage is not defined`. What you actually get is `TypeError: ... is not a function`. That means the name resolved to an object, and that object has no `getItem`.

This breaks SSR-safe library code (wallet connectors, wagmi/RainbowKit storage, theme persistence) that checks
`typeof window !== "undefined"` or `typeof localStorage !== "undefined"`, decides "we're in a browser", and calls `localStorage.getItem(...)`. That check used to fail safely on Node. Now it passes, so the call crashes while `/_not-found` (and other pages) are prerendered.

## Why Teammate B's polyfill can't fix it

It doesn't matter how correct the polyfill is. It runs in the wrong process, at the wrong time:

1. **`instrumentation.ts` doesn't run where the prerender runs.** Its `register()` is a runtime hook: Next calls it when a server instance starts. `next build` with `output: "export"` renders pages in **separate build worker processes** (static-generation workers started by the build). Each worker is a fresh Node process with its own globals. Anything patched onto `globalThis` in one process (the instrumentation hook, or the `next.config.ts` load in the main build process) never reaches the worker that actually prerenders `/_not-found`. That worker still has Node 25's broken built-in `localStorage`.
2. **Typical polyfills are guarded.** They're usually written as `if (typeof localStorage === "undefined") globalThis.localStorage = …`. On Node 25 the global is already defined, so the guard skips the polyfill even in processes where it does run.

So the build fails exactly the same way. The fix has to live at the **process level**, so that every worker Node spawns inherits it.

## What fixes it

Set it through `NODE_OPTIONS`. Child processes inherit this, so the build workers get it too:

```bash
cd packages/nextjs
rm -rf .next out

# Option A: turn off Node's built-in Web Storage (back to "no localStorage" behavior)
NODE_OPTIONS="--no-experimental-webstorage" NEXT_PUBLIC_IPFS_BUILD=true yarn build

# Option B: give it a backing file so the global is a working Storage object
NODE_OPTIONS="--localstorage-file=.node-localstorage" NEXT_PUBLIC_IPFS_BUILD=true yarn build
```

Recommendation: use **Option A** for a static export. The libraries' SSR checks then go back to "no storage on the server", which is correct. Build-time storage writes leaking into a file (Option B) aren't useful. If you use B, add `.node-localstorage` to `.gitignore`.

Put the fix in CI, e.g. as a job-level env var `NODE_OPTIONS: --no-experimental-webstorage`, or in the `build` script via `cross-env`. Don't put it in `instrumentation.ts` or `next.config.ts`. Pinning CI back to Node 24 LTS also works, but only as a stopgap.

Then delete the polyfill from `instrumentation.ts`. It does nothing here.

After the build, check the output as usual. `ls out/*/index.html` should show one directory per route. Then load a non-home route through the gateway after upload.
