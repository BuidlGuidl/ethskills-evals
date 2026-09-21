# Node 25 + SE-2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22.4 added the browser Web Storage API (`localStorage`, `sessionStorage`) as an experimental feature, hidden behind `--experimental-webstorage`.
- **Node 25 turned it on by default.** Now `localStorage` is a real global in every Node process.
- Normal storage needs a file on disk, set with `--localstorage-file=<path>`. CI does not pass that flag. Without it, Node 25 still creates the `localStorage` global, but it is empty: it has no `getItem`, `setItem`, and so on.

So the global exists but its methods do not. That is the exact error you see: it is `getItem` that is "not a function", not `localStorage` that is "not defined".

## Why Teammate A's model is out of date

"Node has no localStorage" was true until Node 24. Server-side-rendering code in wallet and state libraries (wagmi/RainbowKit storage, zustand `persist`, theme helpers, and similar) relies on it with checks like:

```js
if (typeof localStorage !== "undefined") localStorage.getItem(key)
// or: typeof window === "undefined" ? noop : ...
```

On Node 25 the `typeof localStorage` check passes, because the global now exists. The library decides it is running in a browser and calls `getItem`, which is missing. The error is not impossible. It is a new state that feature checks never planned for: the object exists but half of it is missing.

## Why Teammate B's polyfill can't work

The problem is where the polyfill runs.

1. **Prerender does not run in the process that loaded instrumentation.** `next build` creates separate worker processes for static generation (the "Collecting page data" and "Generating static pages" steps, including `/_not-found`). Each worker is a fresh Node process with its own `globalThis`. A patch to globals made in one process, whether from `instrumentation.ts` `register()` or from `next.config.ts`, is never seen by the workers that render pages. `instrumentation.ts` is a server-startup hook for the running server (`next start` / dev). It does not reliably run first in every build worker.
2. **Even where it does run, a typical polyfill backs off.** The usual pattern is `if (typeof globalThis.localStorage === "undefined") { ... }`. On Node 25 that check is false, so a "correct" polyfill does nothing and leaves Node's broken object in place.
3. **Library code has already run.** Libraries often capture storage when their module first loads. That happens during page module evaluation inside the worker, not in any hook you control.

How good the polyfill is makes no difference. It is running in the wrong process, or it sees the global and skips itself.

## The fix: a process-level setting that every worker inherits

Node flags passed through `NODE_OPTIONS` are passed down to every child process, including Next's build workers. Pick one:

```bash
# A: turn the feature off. `localStorage` is undefined again, like on Node ≤24,
#    which is what server-side checks in libraries expect. Simplest; recommended.
NODE_OPTIONS="--no-experimental-webstorage" yarn build

# B: give Node a backing file so localStorage has all its methods.
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

Notes:
- Prefer **A** for a static export. With **B**, libraries see a working `localStorage` during prerender and may bake persisted or "client" state into the HTML. The file also stays around between builds, so add it to `.gitignore` and delete it in CI.
- Set it where CI actually runs the build: the CI job's `env:`, or the script itself, e.g. in `packages/nextjs/package.json`:
  `"build": "NODE_OPTIONS=--no-experimental-webstorage next build"`
  (use `cross-env` if Windows matters). If `NODE_OPTIONS` is already set, add to it instead of overwriting it.
- Remove B's `instrumentation.ts` polyfill. It does nothing here and only confuses the next person to read it.
- Short-term alternative: pin CI to Node 24 LTS (`.nvmrc` / `engines` / `setup-node`) until the libraries handle Node 25.

Then check the build properly: `rm -rf .next out`, rebuild with `NEXT_PUBLIC_IPFS_BUILD=true`, and confirm `out/*/index.html` exists for every route (including the 404 page) before uploading.
