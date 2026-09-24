# Node 25 + SE2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22 added a Web Storage API (`localStorage` / `sessionStorage`), but it was off by default. You had to turn it on with `--experimental-webstorage`.
- **Node 25 turned it on by default.** Now `globalThis.localStorage` always exists in every Node process.
- On the server, it only becomes a real working Storage if you give Node a file to save into (`--localstorage-file=<path>`). Without that flag (normal CI), you still get a `localStorage` global, but it is **not a working Storage object**: it has no `getItem`, `setItem`, and so on.

So the global exists, but its methods don't.

## Why A's mental model is out of date

"Node has no localStorage" was true up to Node 24 (unless you passed a flag). SSR-safe code in libraries was written with that in mind:

```js
if (typeof localStorage !== "undefined") {
  localStorage.getItem("theme"); // assumed: only runs in a browser
}
```

On Node 25 that check passes, because the global now exists. The code then calls `getItem` on the broken object and crashes. The error message is exact: `localStorage` is defined, and `getItem` on it is not a function. In SE2 the code that trips over this is `next-themes`, RainbowKit/wagmi storage, and SE2's own hooks that use `localStorage`. They run while `/_not-found` (and every other page) is prerendered, because they sit in the root layout and providers.

## Why B's fix can't work, however correct the polyfill is

This is about *where* the code runs, not what it does.

1. **Prerendering doesn't run in the process that loads `instrumentation.ts`.** `next build` is the main process. It hands static page generation ("Collecting page data" / "Generating static pages") to **separate child worker processes**. Each worker is a new Node process with its own `globalThis`, and it gets its own broken Node 25 `localStorage`.
2. **`instrumentation.ts` is a runtime hook.** Its `register()` runs when a Next *server* starts up (`next start`, `next dev`, serverless boot). It is not run in the build's static-generation workers. With `output: "export"` there is no server at all. So B's code never runs in the process that renders `/_not-found`.
3. The same goes for patching `globalThis` in `next.config.ts`: that only runs in the main build process, and the workers don't inherit JS globals from it.
4. Also a trap: if the polyfill only installs itself when `typeof localStorage === "undefined"`, it would skip itself on Node 25 even in the right process, because the global exists. The guard has to test `typeof localStorage.getItem !== "function"`.

You can't patch a global in process A and expect process B to see it. The only thing child processes reliably inherit is the **environment**, including `NODE_OPTIONS`.

## What does fix it

Preload the polyfill into **every** Node process with `NODE_OPTIONS=--require`. Child workers inherit `NODE_OPTIONS`, so the polyfill runs before any Next or library code in each worker.

`packages/nextjs/polyfill-localstorage.cjs`:

```js
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
    key: i => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}
```

Build (e.g. in CI or the `build` / `ipfs` script):

```bash
cd packages/nextjs
rm -rf .next out
NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

(Use an absolute path, e.g. `--require $PWD/polyfill-localstorage.cjs`, if the build might start from another directory. Add to any existing `NODE_OPTIONS` rather than overwriting it.)

Other options:
- **Turn Node's built-in storage off** for the build: `NODE_OPTIONS=--no-experimental-webstorage`. Then `localStorage` is `undefined` again, like before Node 25, and the libraries' existing `typeof` checks work as intended. It's the same fix in spirit: an env var that every worker inherits.
- **Pin CI to Node 22/24 LTS** until the libraries handle Node 25. This is a stopgap, not a fix.

Afterwards, check that the export is complete (`ls out/*/index.html`). Pages that fail to prerender get skipped and show up as 404s on IPFS.

## TL;DR

Node 25 ships a `localStorage` global by default, but without `--localstorage-file` it isn't a working Storage. That breaks the libraries' `typeof localStorage !== "undefined"` browser check, so they call a `getItem` that doesn't exist. Prerendering runs in separate `next build` worker processes, where `instrumentation.ts` (a server runtime hook) never runs. So a global patched there can't reach them. The fix is to inject the polyfill with `NODE_OPTIONS="--require ./polyfill-localstorage.cjs"` (or disable Node's storage with `--no-experimental-webstorage`), because `NODE_OPTIONS` is inherited by every worker.
