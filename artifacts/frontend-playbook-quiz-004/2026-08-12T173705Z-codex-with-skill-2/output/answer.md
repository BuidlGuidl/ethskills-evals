# What changed

The failure is caused by Node's newer experimental Web Storage support, not by a browser executing the page. On Node 25, `localStorage` may be present on `globalThis` even when Node was started without a storage backing file. In that state it is not a usable implementation of the browser Web Storage API: code can observe a truthy `localStorage`, but methods such as `getItem` are unavailable. A dependency that uses existence detection such as `typeof localStorage !== "undefined"` therefore takes its browser/storage path and then crashes during prerender.

That is why teammate A's model is stale. Historically, server-side Node had no `localStorage`, and existence checks reliably selected the server fallback. Recent Node versions can expose the global, so “Node has no localStorage” is no longer a safe assumption. The error itself proves that the identifier resolved to a value; it says that the value's `getItem` property is not callable, not that `localStorage` is undefined.

# Why the instrumentation polyfill does not help

Next.js does not necessarily prerender every page in the same process and JavaScript realm that loads the application's `instrumentation.ts`. During `next build`, static page rendering—including the generated `/_not-found` page—runs in separate Next.js build/prerender worker processes. Mutating `globalThis.localStorage` from `instrumentation.ts` only changes the process in which that module ran. It cannot patch the globals of an already separate worker, regardless of how correct the polyfill is. The same limitation applies to assigning the global from `next.config.ts`: it is an in-process mutation, not configuration inherited by child Node processes.

# The fix

Apply the remedy when Node starts so that every process spawned for the build, including prerender workers, inherits it through `NODE_OPTIONS`.

Either disable Node's experimental Web Storage global and restore the traditional server-side behavior:

```bash
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

or configure Node's built-in storage with a backing file so it exposes a functional API:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

For CI/static export, disabling experimental Web Storage is usually the cleaner choice: server rendering should not depend on persistent client storage, and browser-only code should still be guarded or deferred to a client effect. If a dependency intentionally requires storage during the build, use the backing-file option instead. Put the chosen flag in the environment of the `yarn build` command (or the CI job), rather than in application startup code, so all Next.js build workers receive it.
