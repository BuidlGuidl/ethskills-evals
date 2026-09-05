# Why `localStorage.getItem is not a function` breaks a Node 25 static export

## TL;DR

Node 25 ships a built-in `localStorage` global. It exists, it's truthy, but with no
backing store configured it does **not** carry the standard Web Storage methods. Every
SSR-aware library feature-detects with `typeof localStorage !== "undefined"`, sees a
real object, calls `.getItem()` — and dies during static page generation.

The fix has to be process-level, carried by `NODE_OPTIONS`, because Next.js prerenders
in **separate worker processes** that neither `next.config.ts` nor `instrumentation.ts`
can reach:

```bash
cd packages/nextjs
rm -rf .next out

NEXT_PUBLIC_PRODUCTION_URL="https://yourapp.yourname.eth.link" \
  NODE_OPTIONS="--no-experimental-webstorage" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_IGNORE_BUILD_ERROR=true \
  yarn build
```

---

## 1. What actually changed in Node

Historically Node had no Web Storage API at all. `localStorage` was strictly a browser
global, which is exactly why the whole JS ecosystem settled on this guard:

```js
if (typeof localStorage !== "undefined") {
  const theme = localStorage.getItem("theme");
}
```

That guard was safe for a decade because on the server the identifier simply did not
resolve.

Node 25 changed the premise. It now exposes a built-in `localStorage` global. But
without a backing file configured, what you get is an object that satisfies the
existence check while lacking the standard Web Storage methods. So the guard passes and
the very next line — the actual `.getItem()` call — throws.

This is the worst possible failure shape: not "missing API" but "API-shaped object that
isn't the API." Feature detection based on existence is now a false positive across the
entire ecosystem.

In a Scaffold-ETH 2 app the callers are everywhere: `next-themes` reads the stored theme
on init, RainbowKit/wagmi restore the last-connected connector from storage, and SE2's
own block explorer pages touch `localStorage` at import time. `/_not-found` is just the
first page the prerenderer happens to reach — it is not special, and chasing that
specific route is a dead end.

---

## 2. Why Teammate A's mental model is out of date

A's reasoning is: *"Node has no `localStorage`, so there is nothing to call `getItem`
on, so this error is impossible."*

Every clause was true through Node 24. As of Node 25 the first clause is false, and once
it's false the conclusion inverts. Read the error message literally — it is not
`localStorage is not defined` (which is what A's model predicts and what you'd have seen
on Node 22). It is `localStorage.getItem is not a function`. That message can *only* be
produced by an object that exists. The runtime is telling you precisely that A's premise
no longer holds.

Note also what the "impossible" claim implies: if it really were impossible, the build
would have failed identically on Node 24. It didn't. The only variable that changed is
the Node major version. That's the whole diagnosis.

---

## 3. Why Teammate B's polyfill cannot work — no matter how correct it is

B's polyfill is presumably fine. The problem is not the polyfill's contents; it's the
process it runs in. **Where does the prerender actually run?**

Next.js does not prerender pages in the process you launched with `yarn build`. It
**spawns separate Node worker processes** for static generation, and those workers are
where page modules get imported and evaluated. That is where `localStorage.getItem` is
called and where the throw happens.

Now trace B's fix:

- **`instrumentation.ts` does not run in the build worker at all.** It's a server-runtime
  hook for the running Next.js server, not a build-time hook that executes inside each
  prerender worker. The polyfill is registered into a process that never prerenders a page.
- The same trap catches the other obvious placement: **a polyfill at the top of
  `next.config.ts` runs only in the main build process.** The config module is loaded by
  the coordinator; the workers are separate processes with their own fresh globals, and
  JavaScript globals do not cross a process boundary.

So B is patching process A while the crash occurs in process B. Correctness of the shim
is irrelevant — it is never loaded where it's needed. Any "fix" that consists of running
application-level JS inside the Next.js build pipeline has this same defect.

The only thing that reliably reaches every prerender worker is a setting the OS carries
across the fork: an environment variable. `NODE_OPTIONS` is inherited by every child
process Node spawns, which is exactly the property this bug requires.

---

## 4. What actually fixes it

Pick one of these three — all are process-level and all reach the workers:

```bash
NODE_OPTIONS="--no-experimental-webstorage"           # Removes the global; pre-25 behavior
NODE_OPTIONS="--localstorage-file=.node-localstorage"  # Gives it a real, working store
NODE_OPTIONS="--require ./polyfill-localstorage.cjs"   # Injects a shim into every process
```

**`--no-experimental-webstorage` is the recommended default.** It makes `localStorage`
`undefined` again, which is the exact case every SSR-aware library already guards for.
You are not adding a workaround; you are restoring the environment the libraries were
written against.

Use **`--localstorage-file`** instead when something genuinely wants a working store
during the build — it gives Node a real backing file so reads and writes actually
function.

Use the **`--require` shim** when you need one command that works across Node versions
(CI matrices spanning 22 and 25, for example). Note this is B's polyfill — reused
verbatim, just delivered through a mechanism that reaches the workers:

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

`--require` runs it in *every* Node process including each spawned worker, before any
application code loads. That's the difference — mechanism, not content. Worth saying to
B directly: the code was never the problem.

### The other legitimate fix: drop the crash-prone pages

Dealing with the offending pages directly is also valid, and it's the right call when you
didn't want them in the export anyway. SE2's block explorer uses `localStorage` at import
time; if you don't need it:

```bash
mv packages/nextjs/app/blockexplorer packages/nextjs/app/_blockexplorer-disabled
```

This is a real fix, not a hack — but only for pages you're genuinely willing to lose. It
won't help with `next-themes` or RainbowKit, which are used app-wide, so for most SE2
projects you'll want the `NODE_OPTIONS` fix regardless.

---

## 5. After it builds — verify, don't assume

This bug has a nasty second act. **A page that crashes during static export gets skipped
silently**, and on IPFS a missing page is a 404 rather than a build error. So confirm the
routes actually made it:

```bash
ls out/*/index.html    # every route should have its own directory + index.html
```

While you're there, two adjacent IPFS-export requirements that bite for related reasons:

- **`trailingSlash: true`** — without it Next emits `debug.html`, and IPFS gateways
  resolve directories to `index.html` but not bare filenames, so `/debug` 404s. With it
  you get `debug/index.html`, which resolves.
- **`NEXT_PUBLIC_PRODUCTION_URL`** — without it your `og:image` points at
  `localhost:3000` in the deployed build. Check with `grep 'og:image' out/index.html`.

The IPFS-safe config, for reference:

```typescript
const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";
if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

And always `rm -rf .next out` before rebuilding — deploying a stale build is the single
most common IPFS footgun, and it will make a working fix look like a failed one.

---

## Summary

| | Claim | Verdict |
|---|---|---|
| **A** | Node has no `localStorage`, so the error is impossible | True through Node 24, false as of Node 25. The error text (`.getItem is not a function`, not `is not defined`) proves the global exists. |
| **B** | A correct polyfill in `instrumentation.ts` will fix it | Polyfill is fine; placement is fatal. `instrumentation.ts` doesn't run in the build worker, and `next.config.ts` runs only in the main process. Prerendering happens in **separate spawned processes**. |
| **Fix** | `NODE_OPTIONS="--no-experimental-webstorage"` on the build command | `NODE_OPTIONS` is inherited by every child process, so it reaches the prerender workers — the one property this bug demands. |
