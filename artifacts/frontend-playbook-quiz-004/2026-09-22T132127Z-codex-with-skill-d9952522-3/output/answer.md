# Why the Node 25 static export fails

The failure is real, and Teammate A's model is out of date. Recent Node releases added browser-style Web Storage globals. `localStorage` was added in Node 22.4.0 behind the Web Storage flag, and in Node 25.0.0 that API became enabled by default. Node 25 also changed the unconfigured case: if Web Storage is enabled but no `--localstorage-file` is provided, reading the `localStorage` global returns an empty object.

That means this old server-side assumption is no longer safe:

```ts
if (typeof localStorage !== "undefined") {
  localStorage.getItem(...)
}
```

On older Node versions, `typeof localStorage` was usually `"undefined"`, so the branch did not run. On Node 25, `localStorage` can exist, so the branch runs, but in the default unconfigured state it is `{}` rather than a usable Storage object. The result is exactly this:

```txt
TypeError: localStorage.getItem is not a function
```

Teammate B can write a perfectly valid polyfill and still lose, because `instrumentation.ts` is the wrong place to solve this build failure. Next calls `instrumentation.ts` when a Next server instance is initialized. The failing render here is not a browser render and not a normal running Next server request. During `next build` / static export, Next prerenders pages in its static generation/export worker process. The `/_not-found` route is one of the pages rendered there. That worker has its own process/global object, so a monkey patch registered through `instrumentation.ts` in the server/bootstrap path does not reliably affect the process that is actually doing the prerender.

The fix is to change the Node process environment inherited by the build workers, before `yarn build` starts. Use one of these:

```bash
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

or, if the build really needs a usable Node `localStorage`:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

For a Scaffold-ETH 2 static/IPFS export, that usually means setting the option alongside the export env vars, for example:

```bash
NODE_OPTIONS="--no-experimental-webstorage" \
NEXT_PUBLIC_IPFS_BUILD=true \
yarn build
```

Disabling Web Storage is often the cleaner CI fix because it restores the old server-side feature detection behavior: browser-only code sees no `localStorage` during prerender and does not take the client-storage branch. Configuring `--localstorage-file` is also valid, but it creates shared server-side storage for the build process, which is rarely what a static export wants.

References:

- Node.js globals documentation: `localStorage` was added in v22.4.0; in v25.0.0 Web Storage is enabled by default, and without `--localstorage-file` the global returns an empty object.
- Node.js CLI documentation: `--no-experimental-webstorage` disables Web Storage, and `--localstorage-file=file` provides the backing file.
- Next.js build source: static prerender/export work is dispatched through a static worker with an `exportPages` method, and prerender errors are emitted from that worker path.
