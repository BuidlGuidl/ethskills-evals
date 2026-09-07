# Why Node 25 broke the static export

The exception is real, and its exact wording is the clue. In Node 25,
`localStorage` is no longer necessarily absent. Node added an experimental Web
Storage implementation in 22.4, and Node 25 enabled it by default. However, when
Node 25 is started without `--localstorage-file`, reading the global returns an
empty object. Consequently:

```ts
typeof localStorage !== "undefined" // true
localStorage.getItem                // undefined
```

Code that has historically used the first expression as its browser/SSR guard
now enters the browser branch during server rendering and then tries to call
`undefined`. That is why Teammate A's older model—"Node has no
`localStorage`"—was once useful but is false on Node 25. This is also why the
failure says `getItem is not a function`, rather than `localStorage is not
defined`.

Teammate B patched the wrong JavaScript realm. Next does not do all of
`next build` in the CLI process. It creates static-generation workers and the
worker imports and renders the application bundle to prerender routes (including
the generated `/_not-found` route). Mutating `globalThis.localStorage` in the
build process does not cross a process boundary; each worker has its own
`globalThis`. Moreover, `instrumentation.ts` is a server-lifecycle hook (called
when a Next server instance is initiated), not a guaranteed preloader for the
separate build-time static export worker before application modules evaluate.
Thus even a perfect polyfill installed there cannot repair the realm in which
this exception occurs.

The clean build fix is to restore the server-side invariant expected by the
existing browser guard, and to do it at Node startup so it applies to the CLI
and every child worker:

```sh
NODE_OPTIONS=--no-experimental-webstorage yarn build
```

For example, make that environment setting part of the CI build step. Pinning
CI to the project's supported Node LTS version also avoids the Node 25 behavior.
Do not treat `--localstorage-file` as the normal SSR fix: it supplies a real
process-wide, file-backed storage object, but that turns accidental browser-only
storage access during prerender into shared server/build state instead of
exposing the bug.

The durable application/library fix is to stop evaluating storage-dependent
code during SSR: access `window.localStorage` only in client-side lifecycle code
(for example, an effect), or inject a storage adapter and use an in-memory/no-op
adapter on the server. If a feature check is unavoidable, check the capability,
not merely the global's existence:

```ts
const storage =
  typeof window !== "undefined" &&
  typeof window.localStorage?.getItem === "function"
    ? window.localStorage
    : undefined;
```

`"use client"` alone is not sufficient protection: Client Components can still
be rendered to HTML during the build, so browser APIs must remain out of render
and module-initialization paths.

References: [Node 25 global `localStorage` history and behavior](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage), [Node's `--no-experimental-webstorage` flag](https://nodejs.org/dist/latest/docs/api/cli.html#--no-experimental-webstorage), and [Next.js static-generation worker creation](https://github.com/vercel/next.js/blob/canary/packages/next/src/build/index.ts).
