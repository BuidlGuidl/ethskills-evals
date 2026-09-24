# What broke

Node changed the premise. Older Node versions did not normally expose a
`localStorage` global, so browser-only packages often survived SSR/static
generation by doing a guard such as:

```ts
if (typeof localStorage !== "undefined") {
  localStorage.getItem("some-key");
}
```

In Node 25, Web Storage is no longer behind the old experimental flag. Node now
has a `globalThis.localStorage` entry. But if Web Storage is enabled and Node was
not started with `--localstorage-file`, reading `localStorage` returns an empty
object. That object is enough to pass the common existence check, but it is not a
usable Web Storage object, so `localStorage.getItem` is `undefined`.

That is why the error is:

```text
TypeError: localStorage.getItem is not a function
```

instead of:

```text
ReferenceError: localStorage is not defined
```

Teammate A's mental model was right for old Node, but it is out of date for Node
25.

# Why `instrumentation.ts` cannot fix it

Teammate B can write a perfectly correct polyfill and still lose if it is loaded
from `instrumentation.ts`.

Next's instrumentation hook is server-startup instrumentation. Its `register`
function runs when a Next server instance is bootstrapped. The failing phase here
is not a normal app server boot; it is `next build` static generation/export.

During static export, Next creates separate static/prerender workers and those
workers render the pages. The failing page in the log, `/_not-found`, is being
rendered inside that build worker. The worker is a separate Node execution
context, so a mutation done in the parent process or in server startup
instrumentation is not guaranteed to exist before the worker imports the app code
and its dependencies.

So the problem is not the quality of the polyfill. The problem is its injection
point. `instrumentation.ts` is too late and in the wrong process for this
prerender failure.

# What fixes it

Preload the polyfill into every Node process that participates in the build,
including the prerender workers. In practice, put the polyfill in the Next app
directory and run the build with `NODE_OPTIONS=--require`.

Example `packages/nextjs/polyfill-localstorage.cjs`:

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

For an IPFS/static export build, combine it with the usual export environment:

```bash
cd packages/nextjs
NEXT_PUBLIC_IPFS_BUILD=true \
NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
yarn build
```

The important part is `--require`: Node applies it during process startup, before
Next's static worker imports the app and before libraries such as `next-themes`,
RainbowKit, or Scaffold-ETH code probe `localStorage`.

References:

- Node.js v25 `localStorage` docs: https://nodejs.org/download/release/latest-v25.x/docs/api/globals.html#localstorage
- Next.js instrumentation docs: https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation
- Next.js static export worker source: https://github.com/vercel/next.js/blob/canary/packages/next/src/export/worker.ts
- Next.js static worker creation source: https://github.com/vercel/next.js/blob/canary/packages/next/src/build/index.ts
