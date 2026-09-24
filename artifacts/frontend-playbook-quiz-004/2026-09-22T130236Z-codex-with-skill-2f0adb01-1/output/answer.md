# Node 25 `localStorage` and the SE2 static export failure

The build did not start failing because browser-only code suddenly started
running in a browser. It started failing because recent Node versions changed
the server-side global environment.

Node added a global Web Storage API in v22.4.0 behind
`--experimental-webstorage`. In Node 25 that API is enabled by default. The
surprising part is the Node 25 behavior when webstorage is enabled but no
`--localstorage-file` is provided: accessing `globalThis.localStorage` returns
an empty object.

So Teammate A's model is now stale. In older Node versions, this was a safe
assumption:

```ts
typeof localStorage === "undefined"
```

In Node 25, `localStorage` can exist during a server-side build. But if it is
the default empty object, it is not the browser Web Storage object that frontend
libraries expect. Code like this can now pass the existence check and still die:

```ts
localStorage.getItem("theme")
```

because the value exists, but `getItem` does not.

That is why the error is:

```text
TypeError: localStorage.getItem is not a function
Error occurred prerendering page "/_not-found"
```

It is not saying "Node has browser localStorage." It is saying "Node has a
global named localStorage, and in this configuration it is the wrong shape for
code that assumes the Web Storage methods exist."

Teammate B's polyfill can be perfectly correct and still not help if it is
registered from `instrumentation.ts`.

The failing render is not happening in the browser, and it is not happening in
the same process where a normal Next server is being bootstrapped. During
`next build` with static export, Next prerenders routes such as `/_not-found` in
its static generation/export worker process. A mutation like:

```ts
globalThis.localStorage = polyfilledStorage
```

only affects the Node process that executed it. It does not automatically patch
the separate worker process that Next uses to prerender static pages. Next
instrumentation is for bootstrapping the Next runtime/server environment; it is
not a reliable hook for patching globals inside the static prerender worker.
That is why the build can fail identically even though the polyfill code itself
is right.

The fix is to preload the polyfill into every Node process used by the build,
including Next's prerender workers. Do that with `NODE_OPTIONS=--require`, from
the Next app directory.

For example, in `packages/nextjs/polyfill-localstorage.cjs`:

```js
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();

  globalThis.localStorage = {
    getItem: key => store.get(String(key)) ?? null,
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: key => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    key: index => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}
```

Then build with:

```bash
cd packages/nextjs
NODE_OPTIONS="--require ./polyfill-localstorage.cjs" yarn build
```

For an SE2 static/IPFS export, that usually belongs in the full export command,
alongside the existing static build flags:

```bash
cd packages/nextjs
rm -rf .next out

NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
NEXT_PUBLIC_IPFS_BUILD=true \
NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
yarn build
```

The important distinction is the injection point. `instrumentation.ts` is too
late and too narrow for this failure mode. `NODE_OPTIONS=--require ...` is
inherited by child Node processes, so the static prerender worker sees the fixed
`globalThis.localStorage` before libraries such as `next-themes`, RainbowKit, or
other client-adjacent code try to call `localStorage.getItem()`.

References:

- Node.js globals documentation for `localStorage`: <https://nodejs.org/download/release/latest-v25.x/docs/api/globals.html#localstorage>
- Node.js CLI documentation for `--no-experimental-webstorage`: <https://nodejs.org/download/release/latest-v25.x/docs/api/cli.html#--no-experimental-webstorage>
- Next.js instrumentation documentation: <https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation>
- Next.js static generation worker options: <https://nextjs.org/docs/app/api-reference/config/next-config-js/staticGeneration>
