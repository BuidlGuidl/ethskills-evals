# `TypeError: localStorage.getItem is not a function` on Node 25

Short version: the error is real, Node 25 is the cause, and the fix has to be
delivered as a **process-level flag** (`NODE_OPTIONS`) because the prerender does
not run in the process either teammate is thinking about.

---

## 1. What actually changed in Node

Node.js gained a built-in Web Storage implementation — `localStorage` /
`sessionStorage` as real globals. It arrived behind an experimental flag and, as
of **Node 25, the `localStorage` global is exposed by default**.

The important detail is *how* it is exposed. Node's `localStorage` is backed by a
file on disk, and that file is configured with `--localstorage-file`. When no
backing store has been configured, you do not get "no global" and you do not get a
working Storage either — you get a **global that is present and truthy but does
not carry the standard Web Storage methods**. So:

```js
typeof localStorage            // "object"  ← not "undefined" any more
Boolean(localStorage)          // true      ← feature detection passes
typeof localStorage.getItem    // "undefined" ← and then it explodes
```

That is the whole bug in three lines.

---

## 2. Why Teammate A's model is out of date

A is describing Node ≤ 22 (and the pre-flag default in 24), where `localStorage`
genuinely did not exist. Every SSR-aware library in the SE2 stack was written
against that world, so they all guard the same way:

```js
if (typeof window !== "undefined" && localStorage) { ... }
// or
if (typeof localStorage !== "undefined") { localStorage.getItem("theme") }
```

Those guards are *existence* checks, not *capability* checks. On Node 25 they now
return `true` on the server for the first time ever, the code walks straight past
the guard it was relying on, and calls `.getItem()` on an object that has no such
method. `next-themes`, RainbowKit/wagmi's storage layer, and any SE2 page that
reads `localStorage` at import time all fail exactly this way.

`/_not-found` is not special — it is simply the first page Next prerenders that
pulls in the root layout (and therefore the theme provider), so it is where the
crash surfaces. The error is not "impossible"; it is the predictable consequence
of a global changing from absent to half-present.

---

## 3. Why Teammate B's polyfill cannot work

The polyfill is probably fine. The **registration point** is wrong, and no amount
of correctness in the shim rescues it.

`next build` does not prerender pages in the process you typed `yarn build` into.
Next.js spawns **separate Node child processes (static-generation workers)** and
renders pages there. That gives you three distinct process contexts:

| Where you put the fix | Which process it runs in | Reaches the prerender? |
|---|---|---|
| `next.config.ts` | the main build process only | ❌ |
| `instrumentation.ts` | server runtime; **not the build worker** | ❌ |
| `NODE_OPTIONS=...` | inherited by the main process **and every child it spawns** | ✅ |

`instrumentation.ts` is a *server runtime* hook — it is meant for wiring up
telemetry when the server boots. It does not execute inside the static-generation
worker during `next build`, so B's `globalThis.localStorage = {...}` is assigned in
a process that never renders `/_not-found`. The worker starts clean, with Node 25's
own broken-ish `localStorage` global, and fails identically. Hence "the build still
fails identically" — that is the diagnostic signature of a fix that never ran, not
of a fix that ran and was insufficient.

Same reasoning kills the `next.config.ts` variant, which is the other place people
naturally try.

The general rule: **environment problems in a child process must be fixed by
something the child inherits.** `NODE_OPTIONS` is inherited. Module-level code in
your app is not.

---

## 4. What does fix it

Any of these, because all three ride in on `NODE_OPTIONS`:

```bash
NODE_OPTIONS="--no-experimental-webstorage"           # remove the global; restores pre-25 behavior
NODE_OPTIONS="--localstorage-file=.node-localstorage"  # give it a real, working store
NODE_OPTIONS="--require ./polyfill-localstorage.cjs"   # inject a shim into every process
```

**Recommended: `--no-experimental-webstorage`.** It makes `localStorage`
`undefined` again on the server, which is precisely the condition every SSR-aware
library already guards for correctly. Nothing else has to change.

Use `--localstorage-file` instead if something in the build genuinely wants a
functioning store rather than an absent one.

### The full SE2 static-export build command

```bash
cd packages/nextjs
rm -rf .next out                     # always clean first — stale artifacts are the #1 IPFS footgun

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

In CI, set `NODE_OPTIONS=--no-experimental-webstorage` as a job-level env var so it
covers every build step.

### Portable option — B's polyfill, registered correctly

B's work is salvageable. Move it out of `instrumentation.ts` into a CommonJS file
loaded via `--require`, and it will be present in every worker. It is also
version-safe: it no-ops on older Node where the global is absent, and repairs the
Node 25 half-object when it is present.

```javascript
// packages/nextjs/polyfill-localstorage.cjs
if (typeof globalThis.localStorage !== "undefined" &&
    typeof globalThis.localStorage.getItem !== "function") {
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

```bash
NODE_OPTIONS="--require ./polyfill-localstorage.cjs" yarn build
```

### A separate, also-valid fix: drop the offending pages

If the crashing route is something you did not want in the export anyway, remove it
from the build. SE2's block explorer touches `localStorage` at import time and is
the usual repeat offender:

```bash
mv app/blockexplorer app/_blockexplorer-disabled
```

This is the right call when you genuinely do not need those pages — but it does not
substitute for the `NODE_OPTIONS` flag if the theme provider in your root layout is
what's crashing, since that reaches every page.

---

## 5. One more reason to care, specific to static export

A page that crashes during prerender is **skipped**, not always fatal — and a
skipped page means a **404 on the IPFS gateway** with no error anywhere in the
deploy. So after the build, verify rather than assume:

```bash
ls out/*/index.html    # every route should have its own directory + index.html
```

And while you're here: static export to IPFS also needs `trailingSlash: true` in
`next.config.ts`, or every route except `/` 404s regardless of this localStorage
issue — gateways resolve `debug/` → `debug/index.html`, but not a bare `debug.html`.

---

## Summary

- **What changed:** Node 25 ships `localStorage` as a default global; with no
  backing file it is a truthy object missing the Storage methods.
- **A is wrong because:** the "Node has no localStorage" assumption held through
  Node 22/24 and stopped being true in 25 — which is exactly why every
  `typeof localStorage !== "undefined"` guard in the stack now fails open.
- **B is wrong because:** `next build` prerenders in spawned child processes;
  `instrumentation.ts` (and `next.config.ts`) never execute there, so a perfect
  polyfill registered in either place is simply never loaded.
- **The fix:** `NODE_OPTIONS="--no-experimental-webstorage"` on the build command
  (or `--localstorage-file`, or `--require` B's shim) — `NODE_OPTIONS` is the one
  channel every child process inherits.
