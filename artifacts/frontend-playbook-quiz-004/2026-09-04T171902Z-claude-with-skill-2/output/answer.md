# `localStorage.getItem is not a function` on Node 25

## TL;DR

Node now ships a built-in `localStorage` global. On Node 25 it exists during the
Next.js build but has no usable Web Storage methods unless a backing file is
configured, so libraries that feature-detect with `typeof localStorage !== "undefined"`
pass the check and then crash on the first `getItem()`.

The fix is a **process-level flag**, not application code:

```bash
cd packages/nextjs
rm -rf .next out
NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

(Use `NODE_OPTIONS="--localstorage-file=.node-localstorage"` instead if something in
the app genuinely needs a *working* store during prerender — see "Which flag" below.)

---

## 1. What actually changed in Node

Node gained a Web Storage implementation — real `localStorage` / `sessionStorage`
globals. It arrived behind `--experimental-webstorage` in the Node 22 line and is
**on by default** in the current releases, including the Node 25 your CI just moved to.

The consequence that breaks the build: the global is *present* but, with no backing
store configured, it is not a functioning Web Storage object. You get an object where
you used to get nothing, and calling `getItem()` on it throws.

You can see it directly on a CI-like box:

```bash
node -e 'console.log(typeof localStorage, typeof localStorage?.getItem)'
```

On Node ≤ 21 that prints `undefined undefined`. On Node 25 the first value is no
longer `undefined`, which is the entire bug.

This is a classic **half-present global**. Every browser-storage shim in the
ecosystem — wagmi's `createStorage`, RainbowKit's persistence, WalletConnect's
session cache, various theme/`next-themes`-style helpers — is written as:

```js
const store = typeof localStorage !== "undefined" ? localStorage : memoryFallback;
```

That guard was correct for a decade. On Node 25 it now selects the broken branch and
skips the in-memory fallback that would have made prerender work.

## 2. Why Teammate A's model is out of date

"Node has no `localStorage`, so there is nothing to call `getItem` on" was true
through Node 21 and is now simply false.

The error message itself is the proof. If the global did not exist, the identifier
would fail to resolve and Node would throw:

```
ReferenceError: localStorage is not defined
```

Instead we get:

```
TypeError: localStorage.getItem is not a function
```

A `TypeError` about a missing *property* can only happen after `localStorage`
successfully resolved to an object. The runtime is telling us plainly that the global
is there. A's model predicts an error we are not seeing, which is the tell that the
model, not the stack trace, is wrong.

Two secondary points worth clearing up:

- **`/_not-found` is not special.** It is just the smallest page Next prerenders, so
  it is usually the first to hit the shared root layout. In a Scaffold-ETH 2 app that
  layout pulls in the wagmi / RainbowKit provider tree, which touches storage at
  module-evaluation time. Any route would fail; `/_not-found` merely fails first.
- **This is not "an SE2 bug" or "a wagmi bug."** Nothing in the app changed. The
  runtime's global namespace changed underneath it.

## 3. Why Teammate B's polyfill cannot work — where the prerender actually runs

B's polyfill may be flawless and still be irrelevant, for a reason that has nothing to
do with its correctness: **it is installed in the wrong process.**

`next build` does not prerender pages in the process you launched. It forks a pool of
**worker child processes** (Next's static/render worker pool, built on `jest-worker`)
and hands each one a set of routes to render. Those workers are where
`renderToString` runs and where the `TypeError` is thrown — note the message
"Error occurred prerendering page", which is the parent surfacing a failure that
happened in a child.

That process boundary is fatal to the approach:

- **JavaScript globals do not cross processes.** Assigning
  `globalThis.localStorage = myPolyfill` mutates the heap of exactly one V8 isolate.
  A forked child gets a fresh process with a fresh global object. Nothing is
  inherited. Only environment variables — and CLI flags passed through them, i.e.
  `NODE_OPTIONS` — cross a `fork()`/`spawn()`.
- **`instrumentation.ts` is the wrong hook anyway.** Its `register()` is a Next.js
  *server runtime* hook, meant for the server that serves requests (tracing, metrics,
  monitoring init). It is not a guaranteed pre-boot hook for every build-time render
  worker, and it certainly is not a Node bootstrap hook. Even in a worker where it did
  run, it runs as part of module graph evaluation — which is generally *too late*,
  because the storage-touching module (the wagmi config / connector setup) is
  evaluated during the same import phase and may read `localStorage` first.
- **The global may not be replaceable.** Node's built-in Web Storage globals are
  installed by the runtime, so a plain `globalThis.localStorage = ...` assignment is
  not something to rely on for silently taking effect.
- **The common guard makes the polyfill a no-op.** Most polyfills are written
  defensively as `if (typeof localStorage === "undefined") { install() }`. On Node 25
  that condition is now false, so the polyfill installs nothing — exactly the shape
  of "correct code, identical failure."

Same reasoning rules out `next.config.ts`: it is evaluated in the parent build
process, not in each render worker.

So the remedy has to be applied **at the process level, before Node boots, in a way
that is inherited by every spawned worker.**

## 4. What fixes it

Set `NODE_OPTIONS` on the build invocation. `NODE_OPTIONS` is an environment
variable, so every forked render worker inherits it, and the flags it carries are
applied during Node's bootstrap — before any application module is evaluated.

### Which flag

**Option A — remove the global (recommended default):**

```bash
NODE_OPTIONS="--no-experimental-webstorage"
```

This restores the pre-Node-24 world: `typeof localStorage === "undefined"` again, so
every library's existing feature detection correctly falls through to its in-memory /
no-op fallback. This is the right choice for a Scaffold-ETH 2 static export, where
prerendered HTML must not depend on persisted client state anyway — wallet connection
and cached state are hydrated in the browser.

**Option B — make the global work:**

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage"
```

This gives Node's built-in Web Storage a real backing file, so `getItem()` and friends
actually function. Use it if some dependency insists on a *working* store at build
time and cannot tolerate its absence. Add `.node-localstorage` to `.gitignore`, and
be aware the file persists between builds — stale contents can leak into prerendered
output, so clear it in CI if that matters.

Start with A; fall back to B only if A surfaces a dependency that hard-requires
storage.

### Make it permanent

Put it in the build script so local, CI, and release builds agree:

```json
{
  "scripts": {
    "build": "NODE_OPTIONS=\"--no-experimental-webstorage\" next build"
  }
}
```

If your CI sets `NODE_OPTIONS` for other reasons, **append** rather than overwrite —
the last assignment wins and will silently drop the flag.

Pinning Node back to 22/24 in CI also makes the symptom disappear, but that is
deferral, not a fix: it re-breaks the moment anyone bumps the runtime. Take the flag.

### Full IPFS release build

```bash
cd packages/nextjs
rm -rf .next out
NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

with the IPFS branch in `next.config.ts`:

```typescript
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

## 5. Verify — a green build is not the deliverable

A passing `yarn build` only proves the `TypeError` is gone. Before uploading, confirm
the export is actually complete and correct:

```bash
ls out/*/index.html   # one directory with an index.html per route
```

- Every route emitted its own directory (`trailingSlash` + `output: "export"`).
- The change you expect is present in `out/`, not just in `.next/`.
- Generated metadata / Open Graph URLs carry the production origin, not `localhost`.

After uploading: record the CID (an unchanged CID means identical bytes — check the
build and upload target before blaming gateway caching), then load the root **and** at
least one non-home route through the gateway:

```bash
curl -s -o /dev/null -w "%{http_code}" -L "https://<gateway>/ipfs/<cid>/debug/"  # expect 200
```

Root success does not prove exported subroutes resolve. For ENS, update the content
hash only after the deployed CID has been reviewed, then confirm the resolver and a
public gateway serve that CID.

## Summary

| Claim | Verdict |
|---|---|
| A: "Node has no `localStorage`, the error is impossible" | Out of date. Node ships Web Storage globals, on by default in 25. A `TypeError` on `.getItem` proves the object resolved; absence would be a `ReferenceError`. |
| B: "a correct polyfill in `instrumentation.ts` will fix it" | Cannot work regardless of quality. Prerender runs in forked worker processes; globals do not cross process boundaries, and `instrumentation.ts` runs too late and in the wrong place. Most polyfills also no-op because the global now exists. |
| Fix | `NODE_OPTIONS="--no-experimental-webstorage"` (or `--localstorage-file=…`) on the build command — inherited by every worker, applied before any app module loads. |
