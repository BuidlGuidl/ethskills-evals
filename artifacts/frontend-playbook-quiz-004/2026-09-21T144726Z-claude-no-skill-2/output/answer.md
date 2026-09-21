# Node 25 + SE-2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22 added the browser **Web Storage API** (`localStorage`, `sessionStorage`) as an experimental feature. It was off unless you passed `--experimental-webstorage`.
- **Node 25 turned it on by default.** Now `globalThis.localStorage` exists in every Node process, including build processes.
- Server-side `localStorage` needs a file to store data in (`--localstorage-file=<path>`). Without that flag, Node 25 still creates the global, but it is **not a working Storage object**. It is basically an empty object with no `getItem` / `setItem` methods, and Node prints a warning about the missing `--localstorage-file`.

## Why Teammate A's view is out of date

A is right about Node ≤ 24 (with no flags). In Node 25 it is no longer true. Browser-only code usually checks for the server like this:

```ts
if (typeof localStorage !== "undefined") {
  localStorage.getItem(key);
}
```

On old Node that check was false, so the code skipped `localStorage`. On Node 25 it is **true**, because the global now exists. The code calls `getItem`, the method isn't there, and you get `TypeError: localStorage.getItem is not a function`. The message itself proves A wrong: the error is not "localStorage is not defined". The object exists and only the method is missing.

In SE-2, the code that hits this is wallet/state code that runs while the root layout renders on the server: wagmi/RainbowKit storage, `usehooks-ts` `useLocalStorage`, zustand `persist`, burner-wallet helpers, and so on. `/_not-found` fails first only because it is one of the first pages prerendered through the shared root layout. Every page would hit it.

## Why Teammate B's polyfill cannot work

1. **`instrumentation.ts` doesn't run where the prerender runs.** Next calls `register()` when a **Next server starts up** (`next dev`, `next start`, and server/edge runtime startup). `next build` with `output: "export"` does static generation in **separate worker processes** (child processes / static-generation workers). Those workers never call `register()`. A global set up in another process (or never set up) cannot reach them, because each Node process has its own `globalThis`.
2. **Even if it did run, a typical polyfill backs off.** Most polyfills are guarded by `if (typeof globalThis.localStorage === "undefined")`. On Node 25 that is false, so the polyfill installs nothing and leaves Node's broken object in place.
3. Libraries can also grab `localStorage` when their module loads, before any hook code runs.

So the quality of the polyfill doesn't matter. It's in the wrong process, and even there it would usually skip itself.

## What fixes it

Pick one of these. The first two are the quickest.

1. **Turn the Node feature off for the build.** Use an environment variable, not a CLI flag, so the worker processes inherit it too:
   ```bash
   NODE_OPTIONS="--no-experimental-webstorage" yarn build
   ```
   (Set it in the CI job env, or in the `build` script in `package.json`.) Now `localStorage` is `undefined` again during prerender, and the existing guards work.
2. **Pin CI to Node LTS (22 or 24)** with `actions/setup-node` `node-version: 24` / `.nvmrc` / `engines`, until your dependencies handle Node 25. SE-2 targets LTS anyway.
3. **Give Node a real storage file:** `NODE_OPTIONS="--localstorage-file=.next/ls.json"`. Now `localStorage` is a real Storage object and `getItem` works. The downside: data could be shared between prerenders. Option 1 is cleaner.
4. **Longer-term code fix:** in your own code, detect the browser properly, e.g. `typeof window !== "undefined"`, or `typeof localStorage?.getItem === "function"`, or read storage only inside `useEffect`. `typeof localStorage !== "undefined"` no longer means "in the browser". Also update Next / wagmi / usehooks-ts etc. to versions that know about Node 25's global.

If you do want a polyfill, it has to run **in the build workers** (e.g. `NODE_OPTIONS="--require ./ls-polyfill.cjs"`) and must **replace** a broken global (check `typeof localStorage.getItem !== "function"`), not only fill in a missing one. Turning the feature off (option 1) does the same job more simply.
