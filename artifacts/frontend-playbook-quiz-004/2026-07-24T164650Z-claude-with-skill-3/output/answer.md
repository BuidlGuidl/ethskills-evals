# Why the Node 25 static export breaks — and how to actually fix it

## TL;DR

- **Node added a built-in `localStorage`.** Recent Node ships a Web Storage
  global, so `localStorage` now *exists* on the server — but it is not the
  browser's `Storage`, and in the prerender context it is missing the standard
  methods (`getItem`, `setItem`). That is exactly why the error is
  `localStorage.getItem is not a function` and **not** `localStorage is not
  defined`.
- **Teammate A is wrong** because their mental model ("Node has no
  `localStorage`") describes Node ≤ 24. On Node 25 the global is there. The
  error message itself proves it: there *is* an object to call `.getItem` on —
  it just doesn't have that method.
- **Teammate B is wrong** about *where the code runs*, not about the polyfill's
  correctness. Next.js prerenders pages in a **separate build worker process**.
  `instrumentation.ts` does not run in that worker, so a perfect polyfill
  registered there never executes in the process that actually crashes.
- **The fix:** inject the polyfill into *every* Node process via
  `NODE_OPTIONS="--require ./polyfill-localstorage.cjs"` for the build.

---

## 1. What actually changed in Node

For years the reliable server-side truth was: **Node has no `localStorage`.**
Browser-only globals (`window`, `document`, `localStorage`, `sessionStorage`)
simply didn't exist in Node, so the universal SSR guard —

```js
if (typeof localStorage !== "undefined") { /* browser-only path */ }
```

— was safe. On the server the check was `false`, the browser path was skipped,
and prerendering worked.

Recent Node versions ship the **Web Storage API** as a built-in global. Now
`globalThis.localStorage` is defined during `next build`. Two things follow:

1. **Presence checks stop protecting you.** `typeof localStorage !==
   "undefined"` is now `true` on the server, so browser-only code paths that
   used to be skipped during prerender suddenly run.
2. **The object isn't the browser's `Storage`.** In the static-export /
   prerender context this built-in `localStorage` does **not** expose the full
   WebStorage surface — `getItem`/`setItem` aren't there as callable methods.
   So `next-themes`, RainbowKit/wagmi, `usehooks-ts`, and any SE2 code that
   does `localStorage.getItem(...)` during static generation throws
   `TypeError: localStorage.getItem is not a function`.

This is why `/_not-found` (a fully static page that still pulls in the app
providers/theme setup) is the first thing to blow up.

## 2. Why Teammate A's mental model is out of date

A is reasoning from "Node has no `localStorage`, therefore `getItem` is being
called on nothing." That was true through Node 24. But look closely at the
error:

- **"`localStorage` is not defined"** would mean the global is missing.
- **"`localStorage.getItem` is not a function"** means the global *is present*
  (an object was successfully resolved) and we got far enough to look up
  `.getItem` on it — which turned out not to be a function.

The error itself is the evidence that A's premise is false. The global exists
now; it's just the wrong shape. A's model is one Node major behind reality.

## 3. Why Teammate B's (correct) polyfill can't work

B's polyfill is fine. The problem is **where it was registered.** The question
to answer is: *where does the prerender actually run?*

**Next.js does not prerender pages in the main `next build` process. It spawns
separate worker processes to render/export the static pages.** Static
generation for `/_not-found` and the other routes happens inside those build
workers.

`instrumentation.ts` (`register()`) is a **server-runtime** hook. It runs when
the Next server process starts — it does **not** run inside the prerender build
workers. So:

- B installs a beautiful polyfill in `instrumentation.ts`.
- The crash happens in a *different process* (the prerender worker) that never
  executed `instrumentation.ts`.
- The worker still sees Node's broken built-in `localStorage`, calls
  `getItem`, and dies — **identically**, no matter how correct the polyfill is.

The polyfill is loaded into the wrong process. Correctness of the code is
irrelevant when it never runs where the failure occurs.

## 4. What actually fixes it

Inject the polyfill into **every** Node process — including the prerender
workers — using Node's `--require`, which is inherited by child processes via
`NODE_OPTIONS`.

**a) Create `packages/nextjs/polyfill-localstorage.cjs`:**

```javascript
if (
  typeof globalThis.localStorage !== "undefined" &&
  typeof globalThis.localStorage.getItem !== "function"
) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
}
```

(Note the guard: it only replaces the broken built-in — the one that's defined
but missing `getItem` — so it's a no-op in a real browser.)

**b) Run the build with `--require` so it loads in every process:**

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

### Why `--require` and not the alternatives

| Approach | Runs in the prerender worker? | Result |
|---|---|---|
| `instrumentation.ts` / `register()` | ❌ server runtime only | fails identically (Teammate B) |
| polyfill in `next.config.ts` | ❌ main build process only | worker still crashes |
| `NODE_OPTIONS="--require ..."` | ✅ inherited by every child process | **fixes it** |

`NODE_OPTIONS` is inherited by the child processes Next spawns, and `--require`
executes the module *before* any application/page code loads — so the broken
built-in `localStorage` is patched in the exact process, at the exact moment,
where the prerender needs it.

### Related gotcha (same root cause)

Any page that touches browser-only APIs at import/prerender time gets **silently
skipped** on a static export and 404s on IPFS. SE2's block explorer pages
(`app/blockexplorer`) use `localStorage` at import time; if you don't need them,
rename the folder to `app/_blockexplorer-disabled` so they don't drag the
static export down.
