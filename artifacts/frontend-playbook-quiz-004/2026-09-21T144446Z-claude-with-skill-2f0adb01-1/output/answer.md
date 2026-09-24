# Node 25 + SE2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22 added a Web Storage API (`localStorage` / `sessionStorage`) behind `--experimental-webstorage`.
- **Node 25 turned it on by default.** A global `localStorage` now exists in every Node process, even with no flags.
- But it only really works if you also pass `--localstorage-file=<path>` (where to save the data). Without that file, the global `localStorage` object still exists, but it has **no working `getItem` / `setItem` / `removeItem`**.

So on Node 25 the global is "there but broken": `typeof localStorage !== "undefined"` is true, and `localStorage.getItem(...)` throws `TypeError: ... is not a function`.

## Why Teammate A is wrong

A's rule "Node has no `localStorage`" held up to Node 24. Browser-only libraries depend on that rule. They check for the browser like this:

```js
if (typeof localStorage !== "undefined") { localStorage.getItem("theme") }
```

That check used to skip this code on the server. On Node 25 the check passes, because the global now exists, and the call then fails. `next-themes`, RainbowKit/wagmi storage, and SE2's own hooks all run during server prerender (building the HTML ahead of time), and `/_not-found` is only the first page that hits it. The error is not impossible. It's the new normal: a broken `localStorage` object is now always there.

## Why B's fix can't work

The polyfill code is fine. The problem is where it gets loaded.

- `instrumentation.ts` `register()` is a **server-runtime hook**. It runs when the Next server starts (`next start` / `next dev`). It is not part of the static-generation step of `next build`.
- `next build` does **not** prerender pages in the process you started. It spawns **separate build worker processes** (child Node processes) to collect page data and render static pages. Each worker is a fresh Node process with its own `globalThis`, and Node 25 has already put the broken `localStorage` in it.
- So B's patch either never runs during the build, or runs in some other process. The worker that renders `/_not-found` never sees it. For the same reason, putting the polyfill in `next.config.ts` doesn't help either: that file only runs in the main process.

A patch on `globalThis` only affects the process it runs in. It has to be in the **worker** process, before any page code loads.

## What fixes it

Load the polyfill with `NODE_OPTIONS`. Child processes inherit environment variables, so every Node process the build spawns, workers included, runs `--require` first.

`packages/nextjs/polyfill-localstorage.cjs`:

```js
if (typeof globalThis.localStorage !== "undefined" &&
    typeof globalThis.localStorage.getItem !== "function") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
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

Set the same `NODE_OPTIONS` in the CI job env, or put it in the `build` script, so no one has to remember it.

Other options that also work, for the same reason (they apply to every process):
- `NODE_OPTIONS="--no-experimental-webstorage"` removes the global again, so the old `typeof` checks work as before.
- `NODE_OPTIONS="--localstorage-file=/tmp/ls.json"` makes the built-in storage work (but build data then persists in a file).
- Pin CI to Node 24 LTS as a stopgap.

In our own code, check for the method, not just the object: `typeof globalThis.localStorage?.getItem === "function"`.

After the fix, check that every route was really exported. A page that crashes during prerender is missing from `out/` and gives a 404 on IPFS:

```bash
ls out/*/index.html
```
