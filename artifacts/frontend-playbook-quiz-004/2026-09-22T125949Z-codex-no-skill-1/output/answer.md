Node 25 changed the premise. Older Node versions effectively had no
`globalThis.localStorage`, so server-side code often got away with checks like
`typeof localStorage !== "undefined"` or with libraries that assumed "if
`localStorage` exists, it is browser storage." Node added Web Storage in 22.4
behind `--experimental-webstorage`; in Node 25 it is no longer behind that flag.
On Node 25, if no `--localstorage-file` is provided, reading the global returns
an empty object. That object exists, but it is not a usable Web Storage object,
so code that does `localStorage.getItem(...)` fails with:

```text
TypeError: localStorage.getItem is not a function
```

So teammate A's model is out of date. The failure is not "browser
`localStorage` somehow leaked into Node." It is Node's own new browser-compatible
global surface area, exposed in a shape that trips feature checks used by
Next-side libraries such as theme/wallet/storage helpers.

Teammate B's polyfill can be perfectly correct and still not matter if it is
registered in `instrumentation.ts`. `instrumentation.ts` runs when a Next server
instance is bootstrapped. A static export prerender is not running inside that
server instance. During `next build`, Next spins up its static/export worker
(`next/dist/export/worker`) and prerenders routes there. That worker process is
where `/_not-found` is rendered and where the bad `localStorage.getItem` call is
happening. Patching `globalThis.localStorage` in the parent build process, in
`next.config`, or in `instrumentation.ts` does not patch the separate prerender
worker's global object.

The fix is to make the polyfill load before Next's worker code starts, in every
Node process/worker used by the build. For example, put a CommonJS preload file
next to the Next app:

```js
// polyfill-localstorage.cjs
const existing = (() => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
})();

if (!existing || typeof existing.getItem !== "function") {
  const store = new Map();

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: key => store.get(String(key)) ?? null,
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: key => store.delete(String(key)),
      clear: () => store.clear(),
      key: index => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}
```

Then preload it for the build:

```json
{
  "scripts": {
    "build": "NODE_OPTIONS='--require ./polyfill-localstorage.cjs' next build"
  }
}
```

In a Scaffold-ETH 2 monorepo, the path must be relative to the Next app package
where `next build` actually runs, commonly `packages/nextjs`.

Pinning CI back to an LTS Node version or upgrading to a Next/library version
that uses stronger storage capability checks can also avoid the symptom. But if
CI must run Node 25 with the current stack, the reliable local fix is a Node
preload via `NODE_OPTIONS=--require`, because that reaches the actual static
export prerender worker.
