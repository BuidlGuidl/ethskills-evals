# Node 25, Next prerender, and `localStorage.getItem`

The failure is real, and Teammate A's model is the stale part.

Older Node versions normally made `localStorage` a browser-only global unless you explicitly opted into Node's experimental Web Storage support. In Node 25, Web Storage is enabled by default. Node also changed the no-backing-file behavior: when Web Storage is enabled but Node was not started with `--localstorage-file`, accessing `globalThis.localStorage` returns an empty object.

That means this is no longer the old:

```text
ReferenceError: localStorage is not defined
```

It is now:

```text
globalThis.localStorage === {}
typeof localStorage.getItem === "undefined"
```

So browser/environment detection that only checks whether `localStorage` exists can take the wrong branch, and the first call to `localStorage.getItem(...)` crashes with:

```text
TypeError: localStorage.getItem is not a function
```

Teammate B's polyfill can be perfectly correct and still not help because `instrumentation.ts` is the wrong place for this failure. Next calls `instrumentation.ts` when a Next server instance is bootstrapped. Static export prerendering during `next build` is not running inside that already-bootstrapped server instance. Next creates separate static generation/export workers from the build process, and those workers are where `/_not-found` is being rendered. A global mutation installed by `instrumentation.ts` in some other startup path is not guaranteed to exist in those prerender worker processes.

The fix has to be process-level configuration inherited by the build workers, not an app-level polyfill registered after the wrong process starts. Use one of these in CI before `yarn build`:

```bash
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

or, if something in the build genuinely needs Node's `localStorage` implementation:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

For a Scaffold-ETH 2 static export, the first option is usually the cleaner fix: disable Node's server-side Web Storage global so libraries go back to the expected non-browser behavior during prerender. The second option gives Node a real backing file so `localStorage` has the standard Web Storage methods.

References:

- Node globals docs: https://nodejs.org/download/release/latest-v25.x/docs/api/globals.html#localstorage
- Node CLI docs: https://nodejs.org/download/release/latest-v25.x/docs/api/cli.html#--no-experimental-webstorage
- Next instrumentation docs: https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation
- Next build source: https://github.com/vercel/next.js/blob/canary/packages/next/src/build/index.ts
