What changed is that Node is no longer the clean "no browser storage globals" environment that a lot of SSR-era code assumed.

Node added Web Storage globals in Node 22.4. In Node 25 that API was enabled by default. In a Node 25 process, `localStorage` can exist even though the process is not a browser. Worse, if Node was not started with a real `--localstorage-file`, the value exposed for `localStorage` is an empty object, not a usable Web Storage object. So code that reaches `localStorage.getItem(...)` can now fail as:

```text
TypeError: localStorage.getItem is not a function
```

That is why teammate A's model is out of date. "Node has no localStorage" used to be a decent practical assumption, but recent Node versions have been adding browser-compatible Web APIs. The bug is not impossible; it is exactly what happens when SSR/build code sees a `localStorage` global that is present but not browser-complete.

Teammate B's polyfill can be perfectly correct and still not affect this failure. `instrumentation.ts` is a Next server startup hook: its `register()` function runs when a Next server instance starts. Static export prerendering is not running inside that server instance. During `next build` with `output: "export"`, Next renders routes like `/_not-found` at build time in its static/export worker process. That worker has its own Node global object and is executing the server/prerender bundle to produce HTML. A mutation made from the app's instrumentation hook is not guaranteed to run in that export worker before the offending module/component is evaluated, and in this failure path it does not.

The fix is to remove Node's experimental Web Storage global from the build environment, or avoid Node 25 for this build. For CI, set:

```bash
NODE_OPTIONS=--no-experimental-webstorage yarn build
```

or pin the static export job to an LTS Node version that Scaffold-ETH 2 / Next / its theme dependencies support.

The longer-term code/dependency fix is to stop treating the presence of `localStorage` as proof of a browser. Browser-only storage reads must happen after hydration, usually inside `useEffect`, or behind a stronger browser check such as `typeof document !== "undefined"` plus verifying `typeof globalThis.localStorage?.getItem === "function"`. But for the broken CI build on Node 25, the practical unblock is disabling Node's Web Storage for the build process, not adding an `instrumentation.ts` polyfill.

References:

- Node globals documentation: https://nodejs.org/download/release/latest-v25.x/docs/api/globals.html#localstorage
- Next static export documentation: https://nextjs.org/docs/app/guides/static-exports
- Next instrumentation documentation: https://nextjs.org/docs/app/guides/instrumentation
