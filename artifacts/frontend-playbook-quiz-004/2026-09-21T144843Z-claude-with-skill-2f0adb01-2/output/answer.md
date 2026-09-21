# Node 25 + SE2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22 added the Web Storage API (`localStorage` / `sessionStorage`) as an experimental feature, hidden behind `--experimental-webstorage`.
- **Node 25 turned it on by default.** A global `localStorage` now exists in every Node process.
- It only really works if you give it a place to save data (`--localstorage-file=<path>`). Without that, which is how every build runs, the global is a **broken placeholder object**. It exists, but it has no working `getItem` / `setItem` / `removeItem` methods.

So the error is exactly right. `localStorage` is defined, and `getItem` on it is not a function.

## Why Teammate A's mental model is out of date

"Node has no localStorage" was true up to Node 24. Browser-only libraries depended on it. `next-themes`, RainbowKit / wagmi storage and SE2's own hooks all use guards like:

```js
if (typeof localStorage !== "undefined") localStorage.getItem(...)
```

or `typeof window`-style SSR checks that assume "no global means server". On Node 25 the guard passes, because the global exists now. The library then calls `getItem` on the placeholder and crashes. The error isn't impossible: the guard it relied on no longer means what it used to. If `localStorage` really didn't exist, you'd get `ReferenceError: localStorage is not defined`. A `TypeError` about a missing method proves the object is there.

## Why Teammate B's fix can't work

The polyfill code can be perfect. The problem is where it runs.

- `next build` doesn't prerender pages in the process that runs your code. Static generation (including `/_not-found`) happens in **separate child worker processes** that `next build` spawns.
- `instrumentation.ts`'s `register()` is a hook for starting the Next.js **server** (`next start`, `next dev`, serverless boot). It doesn't run inside the build's prerender workers.
- Even if it ran in the main build process, patching `globalThis` only affects that one process. Every process has its own global object, so a patch in the parent never reaches the workers. The same goes for patching in `next.config.ts`: that also only runs in the main process.

So the workers start with Node 25's broken `localStorage`, never see the patch, and fail the same way as before.

## What fixes it

Load the polyfill with a mechanism that every Node process picks up, workers included: **`NODE_OPTIONS="--require …"`**. Child processes inherit environment variables, and Node reads `NODE_OPTIONS` at startup. That way the polyfill runs before any Next or library code, in every process.

`packages/nextjs/polyfill-localstorage.cjs`:

```js
if (typeof globalThis.localStorage !== "undefined" &&
    typeof globalThis.localStorage.getItem !== "function") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}
```

Build:

```bash
cd packages/nextjs
rm -rf .next out
NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

Put this in the CI step's env or in the `build` script so nobody forgets it. Then delete the `instrumentation.ts` registration; it does nothing here.

### Other options

- `NODE_OPTIONS="--no-experimental-webstorage"`: removes the global entirely and brings back the pre-25 behavior the libraries expect. It's also passed through `NODE_OPTIONS`, for the same reason.
- Pin CI to Node 24 LTS (`.nvmrc` / `engines` / `actions/setup-node`) until the libraries' guards check for `typeof localStorage?.getItem === "function"`.

### After the fix

Check that `out/` contains every route (`ls out/*/index.html`). Pages that crash during prerender get dropped, and on IPFS they return 404. If they still fail, SE2's block explorer pages use `localStorage` when they load. Disable them if you don't need them (rename `app/blockexplorer` to `app/_blockexplorer-disabled`).
