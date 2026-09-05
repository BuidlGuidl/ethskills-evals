# `TypeError: localStorage.getItem is not a function` on Node 25

Short version: Node 25 ships a built-in `localStorage` global, but with no
backing store configured it is a truthy object *without* the Web Storage
methods. Feature-detection passes, the call crashes. And the crash happens in
a Next.js **build worker** — a separate Node process — so anything you register
inside your app code (`next.config.ts`, `instrumentation.ts`) never runs there.
The fix has to be process-level, which in practice means `NODE_OPTIONS`.

---

## 1. What actually changed in Node

Node has been growing Web Storage (`localStorage` / `sessionStorage`) behind
the experimental web-storage implementation. On recent versions — and by
default on **Node 25** — `globalThis.localStorage` now *exists* in a plain
server process.

The catch: without a backing file configured, that global is present but is
not a usable `Storage` instance. It's an object; it does not carry working
`getItem` / `setItem` / `removeItem`. So:

```js
typeof localStorage            // "object"   ← detection says "we're fine"
localStorage.getItem("theme")  // TypeError: localStorage.getItem is not a function
```

That is the entire bug. Nothing in your app changed; the *shape of the global*
changed underneath it.

## 2. Why Teammate A's mental model is out of date

A is reasoning from the pre-25 world, where the rule "Node has no
`localStorage`" was true, and where every SSR-aware library encoded it as:

```js
if (typeof window === "undefined") return;          // or
if (typeof localStorage !== "undefined") { ...use it... }
```

Those guards were written to answer the question *"am I in a browser?"* using
the presence of a browser global as the proxy. Node 25 broke the proxy. The
global is now present on the server, so the guard falls through into the
browser branch and the code confidently calls a method that isn't there.

This is why the error looks "impossible" to A: the reasoning is
`no localStorage → nothing to call getItem on → no such error`. But the actual
state is a *third* case A's model has no room for — **`localStorage` exists and
is broken**. That third case is exactly what produces `getItem is not a
function` rather than `Cannot read properties of undefined`. The error message
itself is the tell: it says the *property lookup succeeded* and the value
wasn't callable. An absent global would have thrown a different error entirely.

Concretely, `next-themes`, RainbowKit/wagmi's storage layer, and similar
persistence code all feature-detect this way, and `/_not-found` is usually the
first page prerendered that pulls in the root layout's providers — which is why
that page is named in the failure even though you never wrote it.

## 3. Why Teammate B's polyfill cannot work — where the prerender actually runs

B's polyfill is probably fine. The problem is *where it was installed*.

`next build` does not prerender your pages in the process you launched. Next.js
spawns **separate Node child processes (build workers)** to do static
generation, and those workers get a fresh JS realm — fresh globals, fresh
module registry, none of your main-process mutations.

- **`next.config.ts`** is evaluated in the *main* build process to produce
  config. Patching `globalThis.localStorage` there patches the parent's globals.
  The worker starts clean and re-crashes.
- **`instrumentation.ts`** is worse: it is a *runtime* hook, for the server /
  edge runtime when the app is serving. It **does not run in the build worker
  during static generation at all.** B's code very likely never executed a
  single time during `yarn build` — which is exactly consistent with the build
  failing *identically*, with no change in the error, no change in the page
  named. A polyfill that ran and was wrong would usually shift the symptom; one
  that never ran leaves the output byte-identical.

So the correctness of the polyfill is irrelevant. It is loaded into the wrong
process. To fix a broken global in a child process you have to affect the
process *at spawn time*, and the one channel Node child processes inherit
automatically is the environment — specifically `NODE_OPTIONS`.

## 4. What actually fixes it

Put the remedy in `NODE_OPTIONS` so every worker inherits it. Any of these
three work:

```bash
NODE_OPTIONS="--no-experimental-webstorage"           # removes the global; pre-25 behavior
NODE_OPTIONS="--localstorage-file=.node-localstorage" # gives it a real, working store
NODE_OPTIONS="--require ./polyfill-localstorage.cjs"  # injects a shim into every process
```

**Recommended: `--no-experimental-webstorage`.** It makes `localStorage`
`undefined` again, which is the exact case every SSR-aware library already
guards for correctly. It's the smallest change and it restores the assumption
the ecosystem was written against.

Use `--localstorage-file=…` instead if something genuinely wants a *working*
store during the build (it persists to that file — add it to `.gitignore`).

Use `--require` if you need one command that behaves the same across Node
versions — this is also where B's polyfill finally belongs. Reuse their code,
just move it and load it via `-r`:

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

Note the guard shape: it replaces the global only when it exists *and* is
broken — the Node 25 case — and leaves a real browser `Storage` alone.

### The full SE2 static-export build command

```bash
cd packages/nextjs
rm -rf .next out                        # always clean first

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

In CI, set `NODE_OPTIONS` as a job-level env var so it applies to the build
step and everything it spawns.

### The other legitimate fix: drop the offending pages

If the crashing page isn't one you wanted in the export, deleting it from the
build is a real fix, not a workaround. SE2's block explorer touches
`localStorage` at import time; if you don't need it:

```bash
mv app/blockexplorer app/_blockexplorer-disabled
```

This is the right call when you were never going to ship those routes. It is
*not* a substitute for `NODE_OPTIONS` if the providers in your root layout are
what's crashing — that reaches every page.

### Do not do

- ❌ Patch `localStorage` in `next.config.ts` — wrong process.
- ❌ Register the polyfill in `instrumentation.ts` — never runs during static
  generation.
- ❌ Pin CI back to Node 22 and call it fixed — it buys time, but Node 25 is
  where everything is going and the same crash returns at the next bump.

## 5. Verify the fix

A build that "succeeds" isn't enough — a page that crashes during prerender can
be skipped, which on IPFS shows up later as a 404, not a build error. Check the
output:

```bash
ls out/*/index.html      # every route you expect has a directory + index.html
```

Also confirm `trailingSlash: true` is set for the IPFS build, or every route
except `/` 404s on the gateway for an unrelated reason — worth ruling out in
the same pass so you don't chase it as a second bug.

---

## Summary

| Claim | Verdict |
|---|---|
| A: "Node has no `localStorage`, error is impossible" | Was true before Node 25. Node 25 adds the global; unconfigured it lacks `getItem`. The error message — *is not a function*, not *of undefined* — proves the global exists. |
| B: "a correct polyfill in `instrumentation.ts` should fix it" | Polyfill is fine, location is wrong. `instrumentation.ts` doesn't run in build workers; prerender happens in spawned child processes with fresh globals. It never executed. |
| Fix | `NODE_OPTIONS="--no-experimental-webstorage"` (or `--localstorage-file=…`, or `--require ./polyfill-localstorage.cjs`) — env vars are inherited by every worker. Optionally also remove pages that touch `localStorage` at import time. |
