Node 25 changed the premise.

Older Node releases did not expose Web Storage in a normal `node` process, so
server-side code often treated `typeof localStorage !== "undefined"` or similar
as a browser check. That assumption is now stale. Node added Web Storage globals
in v22.4.0, and in v25.0.0 they are no longer hidden behind
`--experimental-webstorage`. In Node 25, if `--localstorage-file` is not set,
accessing `globalThis.localStorage` returns an empty object. So the failure is
very plausible: something sees that `localStorage` exists, assumes it is the
browser `Storage` object, and calls `localStorage.getItem(...)`; but the value is
`{}`, so `getItem` is not a function.

That is why Teammate A's model is out of date. "Node has no localStorage" used
to be a good shorthand. On Node 25, Node does have a `localStorage` global by
default, but not necessarily a usable browser-compatible one unless the process
is started with the right Web Storage flags.

Teammate B's polyfill can be perfectly correct and still not help, because the
crash is happening in Next's build-time static generation/export worker, not in
the already-started app server process that instrumentation normally patches.
For `output: "export"`, `next build` prerenders routes such as `/_not-found`
during the build. Next creates a static worker and calls its `exportPages`
method; that worker is a separate Jest worker child process running
`next/dist/export/worker`, which sets `NEXT_IS_EXPORT_WORKER` and loads the
compiled server/app bundles to render the HTML. A global mutation done from
`instrumentation.ts` in the parent/server runtime does not reliably run before
those modules are evaluated in that worker, and even if it ran in another
process, that process's `globalThis` is not shared with the export worker.

The practical fix is to remove Node's new Web Storage global from the build
runtime before Next starts any of its workers:

```sh
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

Put that in CI or in the Scaffold-ETH/Next build script. If CI already sets
`NODE_OPTIONS`, append the flag rather than replacing the existing value, for
example:

```sh
NODE_OPTIONS="$NODE_OPTIONS --no-experimental-webstorage" yarn build
```

Pinning CI back to an LTS Node version where Web Storage is still off by default
also avoids the break. Passing `--localstorage-file=...` can make Node provide a
real `Storage` object, but it is usually the wrong direction for SSR/static
generation: it encourages server-rendered code to believe it is in a browser.
The durable code fix is for the offending dependency or app code to stop using
the existence of `localStorage` as a browser test and only touch browser storage
behind a real client/runtime guard, such as code that runs after hydration or a
check for `document`/a callable `localStorage.getItem`.

The `/_not-found` route is probably just the first shared App Router tree that
Next prerendered. In Scaffold-ETH 2, root providers such as theme/wallet/client
providers are part of that shared tree, so a browser-storage read in a provider
or dependency can surface while rendering the not-found page even when the bug
is not in the not-found component itself.

References:

- Node globals: https://nodejs.org/download/release/latest-v25.x/docs/api/globals.html#localstorage
- Next static export docs: https://nextjs.org/docs/app/guides/static-exports
- Next static worker source: https://github.com/vercel/next.js/blob/canary/packages/next/src/build/index.ts
- Next export worker source: https://github.com/vercel/next.js/blob/canary/packages/next/src/export/worker.ts
