# Why the Scaffold-ETH 2 static export breaks on Node 25

## TL;DR

Node 25 now ships a **built-in global `localStorage` object** — but it is a
stub that does **not** implement the standard WebStorage methods
(`getItem`, `setItem`, ...). Any library that calls `localStorage.getItem()`
during static prerender (`next-themes`, RainbowKit, wagmi, SE2's block
explorer) blows up with `TypeError: localStorage.getItem is not a function`.

- **Teammate A is wrong** because their mental model ("Node has no
  `localStorage`") is out of date — Node 22 introduced Web Storage and by
  Node 25 there *is* a `localStorage` global. That is exactly why the error
  is "`getItem` is not a function" and not "cannot read properties of
  *undefined*".
- **Teammate B is wrong** not about the polyfill code, but about *where* it
  runs. The prerender does **not** run in the process where
  `instrumentation.ts` executes. It runs in **separate Next.js build worker
  processes**, which never load the instrumentation hook.
- **The fix** is to inject the polyfill into *every* Node process with
  `NODE_OPTIONS="--require ./polyfill-localstorage.cjs"`.

---

## 1. What actually changed in recent Node versions

Historically, `localStorage` was a browser-only Web API. In Node it was
simply `undefined`, which is why the ubiquitous SSR guard
`typeof window !== "undefined"` (or the sloppier
`typeof localStorage !== "undefined"`) worked for years.

Node.js added a native **Web Storage API** (`localStorage` /
`sessionStorage`) as experimental globals starting in the Node 22 line, and
by **Node 25 a `localStorage` global is present in the runtime**. Crucially,
Node's implementation is *not* a drop-in for the browser's DOM `Storage`
object: in this build it exists as an object but is **missing the standard
WebStorage methods** — `getItem`, `setItem`, `removeItem`, etc. are not
functions on it.

So the ground shifted underneath the codebase:

| | Old Node | Node 25 |
|---|---|---|
| `typeof localStorage` | `"undefined"` | `"object"` |
| `localStorage.getItem` | (throws: can't read of `undefined`) | **not a function** |
| Feature-detect `typeof localStorage !== "undefined"` | correctly `false` on server | now `true` — guard passes, then crashes |

## 2. Why Teammate A's mental model is out of date

A says: *"Node has no `localStorage`, so there is nothing to call `getItem`
on."* That was true before Node 22. It is false on Node 25.

The **error message itself disproves A**. Two different things fail two
different ways:

- If `localStorage` really were absent (`undefined`), the error would be
  `TypeError: Cannot read properties of undefined (reading 'getItem')`.
- The actual error is `TypeError: localStorage.getItem is not a function`.
  You only get *that* wording when `localStorage` **is** a real, defined
  object — it just doesn't have a working `getItem` method.

In other words, the crash is proof that Node now provides a `localStorage`
global. A's "impossible" is exactly what happened: the object exists but is
a broken stub.

## 3. Why Teammate B's fix cannot work — no matter how correct the polyfill is

B's polyfill is presumably fine. The problem is **placement**, and it comes
down to *where the prerender actually runs*.

When Next.js does static generation / `output: "export"`, it does **not**
prerender pages in the main `next build` process. It **spawns separate Node
worker processes** (the static-generation/render workers) and prerenders
pages inside those child processes.

`instrumentation.ts`'s `register()` hook runs when a **Next.js server
runtime** is bootstrapped. It does **not** run inside the build's prerender
worker processes. So B's polyfill is loaded into a process that never
touches `/_not-found`, while the worker that *does* prerender
`/_not-found` starts up with Node's broken native `localStorage` and no
polyfill at all.

The same trap catches the other "obvious" spots:

- A polyfill in `next.config.ts` runs only in the **main** process, not the
  workers.
- A polyfill in `instrumentation.ts` runs in the **server runtime**, not the
  build workers.

Both miss the exact process where the crash happens. A perfectly correct
polyfill in the wrong process is dead code.

## 4. What actually fixes it

Inject the polyfill at the **Node process level** via `--require`, so it
loads into *every* Node process the build spawns — including the prerender
workers.

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

(Note the guard: it only replaces `localStorage` when the native one exists
but lacks `getItem`, so it's a no-op in the browser and on older Node.)

**Step 2 — run the build with `NODE_OPTIONS="--require ..."`:**

```bash
cd packages/nextjs
rm -rf .next out

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--require ./polyfill-localstorage.cjs" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

`--require` runs the module before any user code in **every Node process**,
so when a worker boots up to prerender `/_not-found`, `localStorage` already
has a working `getItem` before `next-themes`/RainbowKit ever touch it.

### Why `--require` and not the alternatives

| Approach | Runs in build worker? | Fixes it? |
|---|---|---|
| `instrumentation.ts` (B's attempt) | ❌ server runtime only | No |
| `next.config.ts` polyfill | ❌ main process only | No |
| `NODE_OPTIONS="--require ..."` | ✅ every process incl. workers | **Yes** |

### Related SE2 gotcha

SE2's block explorer pages touch `localStorage` **at import time**, which
can still crash static export even with the runtime polyfill loading order.
If you don't need those pages, rename `app/blockexplorer` to
`app/_blockexplorer-disabled` so they're excluded from prerender. Any page
that crashes during `yarn build` is silently skipped and 404s on IPFS.
