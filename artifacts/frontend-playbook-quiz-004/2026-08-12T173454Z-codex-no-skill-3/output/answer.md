# What broke on Node 25

Teammate A's premise used to be a useful description of Node, but it is no longer true. Node added a browser-compatible Web Storage global in v22.4.0 behind `--experimental-webstorage`. In Node 25 the flag is enabled by default (the API is still release-candidate). There is therefore a `globalThis.localStorage` during the build.

Node 25 also made an important, awkward choice: if Web Storage is enabled but Node was not given a valid `--localstorage-file`, evaluating `localStorage` returns an **empty object**. Thus code such as this, including equivalent code in a dependency, takes the wrong branch:

```ts
if (typeof localStorage !== "undefined") {
  localStorage.getItem("key");
}
```

The test succeeds because the global exists, but `{}` has no `getItem`, producing exactly `TypeError: localStorage.getItem is not a function`. This is why the failure changed from the old, familiar `ReferenceError: localStorage is not defined` and why it appeared merely by moving CI to Node 25.

## Why `instrumentation.ts` cannot repair this build

`instrumentation.ts` is a Next **server-instance bootstrap hook**: `register()` runs when Next initializes a server/runtime. Static export prerendering during `next build` is not performed by that server instance. Next creates separate build/static-generation worker processes and loads the compiled route graph there to render routes such as `/_not-found` into HTML. Those workers have their own globals, and the server's `register()` mutation is neither inherited nor replayed as a general-purpose preloader for them.

Consequently, even a perfect assignment to `globalThis.localStorage` in `register()` patches the wrong JavaScript process. A global monkey-patch is process-local; it cannot cross into an already/separately spawned prerender worker. The route name is also usually incidental: `/_not-found` is simply the first static route whose shared layout/provider/dependency executes the bad feature detection.

## Fixes

The clean CI fix is to use a Node release supported by the installed Scaffold-ETH 2/Next.js version (normally the current LTS pinned by the project, rather than Node 25). If CI must run Node 25, restore the pre-25 server environment for the entire `yarn build` process, so every child worker inherits it:

```sh
NODE_OPTIONS=--no-experimental-webstorage yarn build
```

Set that environment variable on the build command or in the CI job/container environment—not in application code or `instrumentation.ts`. Since Next's workers inherit `NODE_OPTIONS`, `localStorage` is absent in the parent and in every prerender worker, and existing browser/server feature detection behaves as intended.

Giving Node a real file is another mechanical workaround:

```sh
NODE_OPTIONS=--localstorage-file=/tmp/se2-build-localstorage yarn build
```

That supplies a real implementation with `getItem`, but it is usually the wrong semantic fix: Node's store is shared process/server state, not a user's browser storage, and worker/process behavior may differ. Disabling the experimental server global or pinning supported Node is safer.

Finally, if the call originates in application code rather than a dependency, fix that code too. A Client Component can still be prerendered on the server; `"use client"` does not mean its render function only runs in a browser. Read browser storage after mount (for example in `useEffect`) and use a deterministic server/initial value, or guard on an actual browser boundary such as `typeof window !== "undefined"`—not merely on the existence of Node's `localStorage` global. Upgrading Next.js/Scaffold-ETH 2 and the offending dependency to versions that support Node 25 is the durable alternative once those versions are available.

References: [Node 25 globals documentation](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage), [Next.js instrumentation documentation](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation), and [Next.js build worker source](https://github.com/vercel/next.js/blob/canary/packages/next/src/build/index.ts).
