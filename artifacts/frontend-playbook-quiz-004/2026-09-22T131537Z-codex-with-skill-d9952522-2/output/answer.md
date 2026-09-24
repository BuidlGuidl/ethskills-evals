Node 25 changed the shape of the failure.

Older versions made it reasonable to assume that server-side code would see no
`localStorage` at all. That mental model is now stale. Node added a Web Storage
global in Node 22.4.0, and in Node 25 it is enabled by default rather than being
behind `--experimental-webstorage`. Node's own docs also call out the especially
surprising Node 25 behavior: when Web Storage is enabled but Node was not started
with `--localstorage-file`, accessing `globalThis.localStorage` returns an empty
object.

That means library code which does browser-ish feature detection like this can
now take the wrong branch during `next build`:

```ts
if (typeof localStorage !== "undefined") {
  localStorage.getItem("some-key");
}
```

On older Node, the branch was skipped because `localStorage` was undefined. On
Node 25, the branch is entered because `localStorage` exists, but the value may
be `{}`, so `getItem` is missing and the build dies with:

```text
TypeError: localStorage.getItem is not a function
```

So Teammate A is wrong because modern Node can have a `localStorage` global. The
error is not impossible; it is exactly what happens when code detects the new
global but receives Node 25's no-backing-file placeholder object instead of a
real Web Storage implementation.

Teammate B's polyfill can also be correct and still have no effect. The failing
code is not running in the long-lived Next server that `instrumentation.ts`
patches at startup. Static export prerendering runs during `next build` inside
Next's build/static-generation worker process. A JavaScript mutation of
`globalThis.localStorage` in `instrumentation.ts` is process-local, and it is not
a startup flag inherited by the worker that actually evaluates `/_not-found` and
the other prerendered routes. The same basic issue applies to patching globals
from `next.config.ts`: that runs in the build coordinator, not as a reliable
preload for the worker process doing the prerender.

The fix is to change the Node process configuration inherited by the build
workers, usually through `NODE_OPTIONS`.

For a static export, the cleanest fix is usually to make Node behave like older
Node during the build:

```bash
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

The other valid fix is to give Node's built-in `localStorage` a backing file so
it is a real Web Storage object:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

For a Scaffold-ETH 2 IPFS/static export command, that means applying the option
at the command or CI environment level, for example:

```bash
NEXT_PUBLIC_IPFS_BUILD=true \
NODE_OPTIONS="--no-experimental-webstorage" \
yarn build
```

or:

```bash
NEXT_PUBLIC_IPFS_BUILD=true \
NODE_OPTIONS="--localstorage-file=.node-localstorage" \
yarn build
```

The important part is where the fix is applied: it must be a process-level Node
option that the Next build/prerender worker inherits. A polyfill registered from
application instrumentation is too late and in the wrong process.

References:

- [Node.js globals docs](https://nodejs.org/download/release/latest-v25.x/docs/api/globals.html#localstorage):
  `localStorage` was added in v22.4.0, is enabled by default in v25, and can
  return an empty object when no `--localstorage-file` is provided.
- [Node.js CLI docs](https://nodejs.org/download/release/latest-v25.x/docs/api/cli.html#--no-experimental-webstorage):
  `--no-experimental-webstorage` disables Web Storage support, and
  `--localstorage-file=file` configures the backing file.
- [Next.js instrumentation docs](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation):
  `instrumentation.ts` runs when a new Next server instance is initiated, which
  is not the same execution context as the static prerender worker used by
  `next build`.
