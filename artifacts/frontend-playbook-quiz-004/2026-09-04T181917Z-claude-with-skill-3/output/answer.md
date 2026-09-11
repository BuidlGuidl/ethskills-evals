# Why the SE2 static export broke on Node 25

Short version: Node grew a `localStorage` global, but during a build with no storage
file configured it is a **method-less stub**, not a `Storage`. Library feature-detects
that ask "does `localStorage` exist?" now answer *yes* and then call `getItem()` on an
empty object. The fix has to be applied as a **process-level Node flag that the build's
render workers inherit** — which is exactly why a polyfill in `instrumentation.ts` does
nothing.

Everything below was verified against the Node in this environment (`v25.9.0`), not
recalled.

---

## 1. What actually changed in Node

Web Storage (`localStorage` / `sessionStorage`) landed in Node 22.4 behind
`--experimental-webstorage`. In Node 25 it is **on by default** — you now opt *out*
with `--no-experimental-webstorage`.

The trap is the shape of the global when Web Storage is enabled but no backing file is
configured:

```console
$ node -v
v25.9.0

$ node -e "
  console.log('typeof localStorage:', typeof localStorage);
  console.log('typeof window:      ', typeof window);
  console.log('prototype:', Object.getPrototypeOf(localStorage));
  console.log('getItem:  ', typeof localStorage.getItem);
  localStorage.getItem('x');
"
typeof localStorage: object
typeof window:       undefined
prototype: [Object: null prototype] {}
getItem:   undefined
TypeError: localStorage.getItem is not a function
(node:76135) Warning: `--localstorage-file` was provided without a valid path
```

So the global is present, it is an `object`, and it is a **null-prototype object with
zero properties**. Node even warns that it has no valid path. Give it one and it becomes
a real `Storage`:

```console
$ node --localstorage-file=/tmp/.ls -e "
  console.log(typeof localStorage.getItem); localStorage.setItem('a','1');
  console.log(localStorage.getItem('a'));"
function
1
```

That is the entire bug. Every library in the SE2 provider stack that persists state —
theme (`next-themes`), wallet/connector state (wagmi / RainbowKit), any
`zustand` `persist` store — guards with some variant of:

```ts
const storage = typeof localStorage !== "undefined" ? localStorage : noopStorage;
```

On Node ≤ 24 that check was `false` and the SSR/no-op branch ran. On Node 25 it is
`true`, the real branch runs, and the first `storage.getItem(...)` during prerender
throws.

`/_not-found` is not special — it is the **canary**. It is the built-in route that
always exists and is prerendered first, and it still pulls in your root layout and its
providers. Whichever route renders first is the one that reports the crash.

## 2. Why Teammate A's model is out of date

A is describing Node ≤ 22.3: no `localStorage` global at all, so `typeof localStorage`
is `"undefined"` and the guard short-circuits. That was true for a decade, so the
instinct is well-earned — it just expired.

Note what A got *half* right, and why it matters: `window` is still `undefined` in Node
(see the probe above). Node shipped the *storage* global without a DOM. So the failure
mode is precisely the narrow one where a `localStorage`-existence check has diverged
from a `window`-existence check. Anything guarded on `window` is still fine; that
asymmetry is what makes the bug look impossible from the outside.

The error message is also actively misleading. `localStorage.getItem is not a function`
reads like "localStorage is undefined." It means the opposite: the property lookup on
`localStorage` **succeeded** and returned `undefined`. If `localStorage` itself did not
exist, the message would be `localStorage is not defined` (a `ReferenceError`). The
error is proof the global is there.

## 3. Why Teammate B's polyfill cannot work

B's polyfill is probably fine. The problem is **which process it runs in**.

`next build` does not prerender in the process you launched. It forks a pool of worker
processes (jest-worker) and each one evaluates your page/layout module graph and renders
routes. Assigning to `globalThis.localStorage` mutates the heap of *one* process; forked
children get a **fresh V8 isolate with fresh globals**. Globals do not cross a
`fork()` boundary. Environment and CLI flags do.

Direct reproduction of B's exact situation:

```js
// parent.js
const { fork } = require("child_process");
globalThis.localStorage = { getItem: () => null, setItem: () => {} }; // B's polyfill
console.log("parent after polyfill:", typeof localStorage.getItem);
fork("./child.js"); // the render worker

// child.js
console.log("child:", typeof localStorage, "getItem:", typeof localStorage?.getItem);
```

```console
$ node parent.js
parent after polyfill: function      <-- polyfill works... here
child: object getItem: undefined     <-- render worker still sees the broken stub

$ NODE_OPTIONS="--no-experimental-webstorage" node parent.js
parent after polyfill: function
child: undefined                     <-- flag crossed the boundary
```

The build fails *identically* because from the workers' point of view B changed nothing.

There is a second, independent reason on top of the process boundary: with
`output: "export"` there is no Next.js server runtime to bootstrap, and `register()` is
the server-bootstrap hook. Even setting the fork problem aside, it is the wrong lifecycle
hook for a static export. Both reasons point the same direction — the fix must be applied
*before any JavaScript in the worker runs*, which means at process startup, which means a
Node flag.

The general rule worth keeping: **a runtime patch cannot fix a startup-time,
cross-process condition.** Correctness of the polyfill was never the variable.

## 4. What actually fixes it

### Immediate unblock — one env var on the build (recommended)

Set it where it reaches the whole build, not inside app code. Both flags are accepted in
`NODE_OPTIONS` (verified above), and `NODE_OPTIONS` is inherited by every forked worker.

```bash
cd packages/nextjs
rm -rf .next out
NODE_OPTIONS="--no-experimental-webstorage" \
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

This restores Node ≤ 24 semantics: the global disappears, `typeof localStorage !==
"undefined"` is `false` again, and every library takes its SSR/no-op branch. For a
static export this is the right default — nothing should be persisting to real browser
storage at build time anyway.

The alternative, if some code genuinely needs a *working* store during prerender:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage"
```

This makes `localStorage` a real, functional `Storage`. Use it only deliberately: it
gives the build a real file on disk, so prerender output can now depend on leftover
state from a previous run. If you take this route, gitignore the file and `rm -f` it
alongside `rm -rf .next out`.

Pin it in the package script / CI so it does not depend on anyone remembering:

```jsonc
// packages/nextjs/package.json
"scripts": {
  "build": "NODE_OPTIONS=--no-experimental-webstorage next build"
}
```

If your CI sets `NODE_OPTIONS` for other reasons, **append** rather than overwrite —
last-flag-wins clobbering here is silent.

### The durable fix — repair the guard

The env var stops the bleeding and should ship today; it also permanently protects you
from third-party code you do not control. But your own code should stop asking the
question that changed meaning. Find the offenders:

```bash
grep -rn "typeof localStorage\|localStorage\." packages/nextjs \
  --include=*.ts --include=*.tsx | grep -v node_modules
```

For each hit, in rough order of preference:

1. **Guard on `window`, not on `localStorage`.** `typeof window !== "undefined"` is still
   a correct browser check on Node 25 — verified above. `window?.localStorage` is
   strictly better than `typeof localStorage !== "undefined"`.
2. **Do not touch storage during render.** Move reads into `useEffect`, or load the
   component with `dynamic(..., { ssr: false })`, so the code only ever runs in a browser.
3. **Give the library an explicit SSR storage** rather than letting it feature-detect:
   wagmi's `createStorage({ storage: ... })` (or `cookieStorage`), and
   `createJSONStorage` for `persist` stores, both accept one.

### Then verify the release properly

A green build is not proof the right bytes shipped:

```bash
ls out/*/index.html          # one directory with an index.html per route
grep -r "<production-domain>" out/index.html   # OG url/image on the production origin
```

After upload, record the CID (an unchanged CID means identical bytes — check the build,
not the gateway cache) and fetch a **non-home** route through the gateway:

```bash
curl -s -o /dev/null -w "%{http_code}" -L "https://<gateway>/ipfs/<cid>/debug/"  # expect 200
```

Only update the ENS content hash after that CID has been reviewed.

---

## Summary

| | |
|---|---|
| **What changed** | Node 25 enables Web Storage by default; with no `--localstorage-file`, `localStorage` is a null-prototype object with no methods |
| **Why A is wrong** | Correct for Node ≤ 22.3. `window` is still undefined, but `localStorage` no longer is — the two checks diverged. `getItem is not a function` proves the global *exists* |
| **Why B is wrong** | `next build` prerenders in forked worker processes. `globalThis` mutations don't cross `fork()`; env/CLI flags do. Also, `output: "export"` has no server runtime for `register()` to hook |
| **The fix** | `NODE_OPTIONS="--no-experimental-webstorage"` on the build (or `--localstorage-file=...` if a real store is needed), plus replace `typeof localStorage` guards with `typeof window` / `useEffect` / explicit SSR storage |
