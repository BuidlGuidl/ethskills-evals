Node 25 changed the premise.  Recent Node releases added a global Web
Storage API: `localStorage` was added in Node 22.4, and in Node 25 it is no
longer gated behind `--experimental-webstorage`.  Node's own docs also call
out the sharp edge: when web storage is enabled and no `--localstorage-file`
is provided, reading the global returns an empty object.  That means code like
this no longer behaves the way it did on older Node:

```ts
if (typeof localStorage !== "undefined") {
  localStorage.getItem("theme");
}
```

On old Node, the guard was false.  On Node 25, the guard is true, but
`localStorage` may be `{}`, so `localStorage.getItem` is `undefined` and the
call fails with:

```text
TypeError: localStorage.getItem is not a function
```

So Teammate A's model is out of date.  It used to be mostly safe to think
"Node has no `localStorage`."  That is not true anymore.

Teammate B's polyfill can be perfectly correct and still have no effect,
because `instrumentation.ts` is the wrong place to install it for this failure.
Next calls `instrumentation.ts` when a Next server instance is initialized.
The failing `/_not-found` render is not happening inside that server instance.
During `next build` / static export, Next prerenders pages inside its internal
static export worker.  In Next source, the build creates a static worker for
methods including `exportPages`, and the export path runs through
`packages/next/src/export/worker.ts` with `NEXT_IS_EXPORT_WORKER=true`.
That worker loads the compiled page modules and prerenders them; it does not
run the app's server instrumentation hook first.  A polyfill registered from
`instrumentation.ts` therefore patches the wrong process/lifecycle.

The fix is to install the polyfill before Next's build/export worker loads any
application code.  In practice, put the polyfill in a CommonJS preload file and
inject it with `NODE_OPTIONS=--require`, because `NODE_OPTIONS` is inherited by
the Node child processes/workers that Next uses for prerendering.

Example:

```js
// packages/nextjs/polyfill-localstorage.cjs
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();

  globalThis.localStorage = {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}
```

Then run the build with the preload:

```sh
NODE_OPTIONS="--require ./polyfill-localstorage.cjs" yarn build
```

For a Scaffold-ETH 2 app where the build runs from `packages/nextjs`, the path
above is relative to that directory.  If CI invokes `yarn build` from another
directory, make the `--require` path absolute or adjust it to the actual working
directory.

An alternate workaround is to disable Node's built-in Web Storage during the
build:

```sh
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

That restores the old "Node has no `localStorage`" behavior, which works for
dependencies that correctly check for browser storage capability.  The preload
polyfill is the more direct fix when a dependency expects a usable
`localStorage` during static prerender.
