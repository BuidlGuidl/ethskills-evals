# Why the Scaffold-ETH 2 static export breaks on Node 25

## TL;DR

Node now ships a **built-in `localStorage` global**, and it does **not** have the
methods (`getItem`/`setItem`) that libraries expect. The prerender is what trips
over it — and the prerender runs in a **separate build-worker process**, not in
the runtime where `instrumentation.ts` executes. That's why B's polyfill, however
correct, never lands in the process that crashes. The fix is a `--require`
preload injected via `NODE_OPTIONS`, which is applied to *every* Node process,
workers included.

---

## 1. What actually changed in recent Node versions

For most of Node's history, `localStorage` was purely a browser thing. On the
server, `globalThis.localStorage` was `undefined`. Libraries relied on that:
they did feature detection like

```js
if (typeof localStorage !== "undefined") {
  localStorage.getItem("theme"); // browser branch
}
```

and on the server that branch was simply skipped.

Recent Node (the WHATWG **Web Storage** work, `localStorage`/`sessionStorage`)
changed this: Node now exposes a global `localStorage` object as part of its
ongoing push for web-platform parity (`fetch`, `navigator`, `Blob`, etc.). On
Node 25 in this build environment, `globalThis.localStorage` is **defined** — but
it is **not a full WebStorage implementation**. It's missing the standard
instance methods `getItem`, `setItem`, and friends.

So the runtime shape flipped:

| | Old Node | Node 25 |
|---|---|---|
| `typeof localStorage` | `"undefined"` | `"object"` |
| `localStorage.getItem` | (never reached) | `undefined` → **not a function** |

The feature-detect guard that used to protect the server now *passes*, code walks
into the browser branch, calls `localStorage.getItem(...)`, and throws
`TypeError: localStorage.getItem is not a function`. This is exactly what
`next-themes`, RainbowKit, and wagmi storage do during static generation.

## 2. Why Teammate A's mental model is out of date

A's claim — *"Node has no localStorage, so there is nothing to call getItem on"* —
was true through roughly Node 21. It is now false. The error message itself is the
proof: it is **not** `localStorage is not defined` (which is what you'd see if A
were right). It is `localStorage.getItem is not a function`. You can only get that
error if `localStorage` **exists** as an object and you successfully reached in to
grab `.getItem`. In other words, the error is only possible *because* Node added
the global. A is reasoning from a Node that no longer exists.

## 3. Why Teammate B's fix cannot work — where does the prerender run?

B's polyfill is correct as code. The problem is **where it runs versus where the
crash runs**.

`instrumentation.ts`'s `register()` hook runs in the **main Next.js server
runtime**. But static export prerendering (`output: "export"`) does not happen
there. Next.js spawns **separate worker processes** to prerender pages
(`/_not-found` and the rest). Each worker is its own Node process with its own
`globalThis`.

So the sequence is:

1. Main process starts, `instrumentation.register()` runs, B's polyfill patches
   `globalThis.localStorage` **in the main process**. ✅
2. Next.js forks a **build worker** to prerender `/_not-found`. That worker is a
   fresh process — it never ran `register()`, so its `globalThis.localStorage` is
   still Node's broken built-in. ❌
3. The worker evaluates the page, hits `localStorage.getItem`, and throws — the
   **identical** error, because the polyfill lives in the wrong process.

You cannot fix a worker process by mutating the parent's globals. That's the whole
reason the build "still fails identically" no matter how good the polyfill is. The
polyfill is patching a `globalThis` that the failing code never sees.

## 4. What actually fixes it

Inject the polyfill through a mechanism that applies to **every** Node process,
including the spawned prerender workers: a `--require` preload passed via
`NODE_OPTIONS`. Child processes inherit `NODE_OPTIONS`, so every worker runs the
preload before it evaluates any page.

**Step 1 — create `packages/nextjs/polyfill-localstorage.cjs`:**

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
    get length() {
      return store.size;
    },
  };
}
```

Note the guard: it only replaces `localStorage` when the built-in is present but
broken (`getItem` is not a function), so it is a no-op in the browser and on older
Node.

**Step 2 — load it through `NODE_OPTIONS` at build time:**

```bash
cd packages/nextjs && rm -rf .next out

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

### Why `--require` and not the alternatives

| Approach | Runs in main process | Runs in prerender worker | Fixes the build |
|---|---|---|---|
| `instrumentation.ts` (B's attempt) | ✅ | ❌ | ❌ |
| polyfill in `next.config.ts` | ✅ | ❌ | ❌ |
| `NODE_OPTIONS="--require ..."` | ✅ | ✅ | ✅ |

`--require` injects into **every** Node process the build spawns, so the worker
that actually prerenders `/_not-found` gets the patched `localStorage` before it
evaluates the page. That's the one place the fix has to be, and it's the one place
`instrumentation.ts` can't reach.

(If a page uses `localStorage` at *import time* and you don't need it — e.g. SE2's
block explorer — the other option is to exclude it from the static export by
renaming `app/blockexplorer` to something like `app/_blockexplorer-disabled`. But
for shared libraries like `next-themes`/RainbowKit, the `--require` preload is the
correct general fix.)
