# Why Node 25 broke the export

The exception is literal: in Node 25, `localStorage` can exist while not being a
`Storage` object.

Node added Web Storage in 22.4 behind `--experimental-webstorage`. Node 25
enabled it by default. Its Node 25 behavior is particularly awkward: unless the
process was given `--localstorage-file`, reading the global `localStorage`
returns an empty object. Thus all of these can be true at once:

```ts
typeof localStorage !== "undefined" // true
typeof localStorage.getItem          // "undefined"
localStorage.getItem("x")            // TypeError
```

That invalidates teammate A's older, formerly useful model that server-side
Node simply has no `localStorage`. It also exposes code that uses existence as a
browser test. In a Scaffold-ETH 2 dependency (often a persisted client store),
that test now selects the Web Storage path and calls `getItem` during rendering.
`"use client"` does not prevent this: Client Components are still rendered on
the server to produce the initial static HTML.

## Why the instrumentation polyfill has no effect

`instrumentation.ts` initializes a Next **server runtime**. Static generation
during `next build`, however, is performed in Next's separate prerender/static
worker process (a child process created by the build machinery). Globals are
per-process. Mutating `globalThis.localStorage` in the build coordinator or a
server instrumentation callback cannot mutate the worker's global object, and
that callback is not an initialization hook for the prerender worker. Therefore
even a perfect polyfill installed there is in the wrong process; the worker
still starts with Node 25's empty `localStorage` object and fails on
`/_not-found`.

## Fixes

The direct CI fix is to restore the pre-25 server-side contract for every Node
process, including inherited Next workers:

```sh
NODE_OPTIONS=--no-experimental-webstorage yarn build
```

Setting `NODE_OPTIONS` is important: child Node processes inherit it, so the
flag reaches the process that actually prerenders. Pinning CI to a supported
LTS release whose Web Storage feature is not enabled by default is also a sound
operational fix. Supplying a unique writable file also makes Node provide the
real API:

```sh
NODE_OPTIONS=--localstorage-file=/tmp/se2-build-localstorage yarn build
```

but disabling the experimental server global is preferable. A process-wide,
shared, persistent store is not browser-per-user storage and can hide unsafe
server access.

The durable application/library fix is not to infer “browser” from
`typeof localStorage !== "undefined"`. Access browser storage only after the
component mounts (for example in `useEffect`), or supply storage lazily behind
an actual browser check such as `typeof window !== "undefined"`, with an SSR
fallback that does not touch storage. This also keeps prerendering correct on
Node versions that expose more browser-like globals.

Node's documentation records both relevant Node 25 changes: Web Storage became
enabled without the experimental flag, and `localStorage` without
`--localstorage-file` returns an empty object. Next's static-export documentation
also explicitly states that Client Components are prerendered during
`next build`, so browser APIs must be deferred until browser execution.

Sources: [Node.js 25 global `localStorage`](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage), [Node.js CLI `--localstorage-file`](https://nodejs.org/dist/latest/docs/api/cli.html#--localstorage-filefile), and [Next.js static exports: browser APIs](https://nextjs.org/docs/app/guides/static-exports#browser-apis).
