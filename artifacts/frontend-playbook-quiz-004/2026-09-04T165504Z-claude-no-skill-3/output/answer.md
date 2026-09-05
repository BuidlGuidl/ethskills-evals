# `localStorage.getItem is not a function` during `next build` on Node 25

## TL;DR

Both teammates are reasoning about the wrong thing.

* Node **25 ships Web Storage on by default**. `globalThis.localStorage` now exists in a
  plain `node` process with no flags. A's mental model was correct through Node 24 and is
  wrong on 25.
* But the object you get by default is **a broken stub** — a bare `{}` with no `getItem` —
  because `localStorage` needs a backing file (`--localstorage-file`) and CI doesn't pass one.
* So the failure is not "localStorage is missing". It's "`typeof localStorage !== 'undefined'`
  now returns **true** in Node, so every browser-detection guard written that way falls through
  into the browser branch and calls `.getItem` on an empty object."
* That is why B's polyfill changes nothing: a polyfill installs a missing global, and the
  global isn't missing. If B guarded it (as a correct polyfill does), the guard is false and the
  polyfill is a no-op. And `instrumentation.ts` is the wrong process anyway — see below.

---

## 1. What actually changed in Node

Web Storage (`localStorage` / `sessionStorage`) landed in Node 22.4.0 behind
`--experimental-webstorage`. It stayed behind that flag through the 22, 23 and 24 lines.
**In Node 25 it is unflagged.**

Measured on this machine (each row is `env -u NODE_OPTIONS node ...`):

| Node     | no flags                        | `--experimental-webstorage --localstorage-file=…` |
|----------|---------------------------------|---------------------------------------------------|
| v20.19.1 | `localStorage` undefined        | *`bad option: --experimental-webstorage`*         |
| v22.5.1  | `localStorage` undefined        | real `Storage`, `getItem` is a function           |
| v22.22.2 | `localStorage` undefined        | real `Storage`, `getItem` is a function           |
| v24.14.1 | `localStorage` undefined        | real `Storage`, `getItem` is a function           |
| v25.9.0  | **`localStorage` is an object** | real `Storage`, `getItem` is a function           |

Nothing in your app changed. The ambient global environment of the CI runner changed.

### Why the object is broken rather than working

`localStorage` is persistent, so it needs somewhere to persist to. Without a valid
`--localstorage-file` path, Node 25 defines the global anyway and the getter hands back an
empty placeholder object:

```console
$ node -v
v25.9.0
$ node -e 'console.log(localStorage, Object.getPrototypeOf(localStorage).constructor.name, typeof localStorage.getItem)'
{} Object undefined
(node:4129204) Warning: `--localstorage-file` was provided without a valid path
```

Note the asymmetry, which explains why only `localStorage` blows up:

```console
$ node -e 'console.log(typeof localStorage.getItem, typeof sessionStorage.getItem)'
undefined function
```

`sessionStorage` is in-memory, needs no file, and is a fully working `Storage`.
`localStorage` is the degraded one. Point Node at a file and it becomes real:

```console
$ node --localstorage-file=/tmp/ok.db -e 'console.log(typeof localStorage.getItem, Object.getPrototypeOf(localStorage).constructor.name)'
function Storage
```

### The exact reported error, reproduced in four lines

This is the shape of essentially every "is this a browser?" check in the web3 stack:

```console
$ node -e '
  const store = typeof localStorage !== "undefined" ? localStorage : null;
  console.log("detection says available:", store !== null, "| typeof window:", typeof window);
  store.getItem("wagmi.store");
'
detection says available: true | typeof window: undefined
TypeError: store.getItem is not a function
```

On Node 24 `store` was `null` and the code took its SSR fallback path. On Node 25 the
detection lies, and you get your build error verbatim.

---

## 2. Why Teammate A is out of date

A's claim — *"Node has no localStorage, so there's nothing to call `getItem` on"* — was a
true and useful heuristic for a decade, and it is exactly the heuristic that this Node
release invalidated. It fails in a specific and nasty way: A is right that there is no
*usable* localStorage in Node, but wrong that there is no *binding*. The binding is what
the code branches on.

This is the worst possible failure mode for feature detection — not absence, but a
convincing-looking presence. `typeof localStorage` says `"object"`; `"localStorage" in
globalThis` says `true`; `localStorage != null` says `true`. Every cheap check passes and
only the actual method call fails.

The stack trace is also real, not "impossible": `.getItem` is `undefined`, and calling
`undefined` throws `TypeError: ... is not a function`. That message is what a *partially
initialized* object produces. Had localStorage genuinely been absent, the error would have
read `ReferenceError: localStorage is not defined` — a different error class. The error text
itself is the evidence against A's theory.

---

## 3. Why Teammate B's polyfill cannot work — no matter how correct it is

Three independent reasons. Any one of them is fatal.

### (a) Nothing is missing, so there is nothing to polyfill

A polyfill fills a hole. There is no hole — `globalThis.localStorage` is already defined.
A correctly written polyfill is guarded:

```ts
if (typeof localStorage === "undefined") {
  globalThis.localStorage = new MemoryStorage(); // never runs on Node 25
}
```

On Node 25 that condition is `false`, the body never executes, and the build fails
*identically* — which is precisely the symptom reported. The more correct B's polyfill is,
the more reliably it does nothing. Only an *unguarded, clobbering* assignment would have any
effect at all, and B's would still lose to (b).

(For the record, the global is writable — `{get: true, set: true, configurable: true}` — so
`globalThis.localStorage = …` does stick when it runs. The problem is where it runs.)

### (b) `instrumentation.ts` is a server hook; the prerender is not a server

This is the part worth internalising: **`next build` does not render your pages in the
process you are thinking of.**

```
yarn build
└─ next build                       ← main build process
   ├─ webpack/turbopack compile
   └─ static generation / export
      ├─ worker #1  (forked child process, own V8 isolate, own globalThis)  ← "/_not-found" renders HERE
      ├─ worker #2  (forked child process, own V8 isolate, own globalThis)
      └─ …one per CPU core
```

Next.js farms prerendering out to a pool of **forked child processes** (jest-worker). Each
worker is a separate OS process with a separate V8 isolate and therefore a **separate
`globalThis`**. Process globals are not shared, not inherited after fork, not serialized
across the worker channel. A mutation to `globalThis` in the parent is invisible in the
child by construction — this is an OS process-isolation fact, not a Next.js quirk you can
configure around.

`instrumentation.ts`'s `register()` is documented as running when a **Next.js server
instance** bootstraps — `next dev`, `next start`, the serverless/edge entrypoint. Static
export has no server instance. Depending on your Next version, `register()` either never
fires during `next build` at all (a long-standing, frequently-reported gap) or fires once in
the build's main process — the one process that never renders a page. Either way it does not
reach worker #1 where `/_not-found` is being rendered.

Worth noting: with `output: 'export'` this is doubly true. There is no runtime server *ever*
— not in CI, not in production. You are shipping static HTML to a CDN. An
instrumentation hook is code for a server that does not exist in your architecture.

### (c) Even in the right process, it can be too late

The crash happens while the page's module graph is being evaluated — wallet connectors and
storage adapters read `localStorage` at import time, not at render time. Bundled ESM imports
are hoisted and evaluated before any code you wrote in that graph runs. A polyfill that
executes "first" in source order can still execute after the import that already threw.

Anything that patches globals for a bundle must run **before the bundle is loaded**, which
means before the process reaches your application code at all: a `--require` preload or a
CLI flag. Not a module inside the graph.

---

## 4. What actually fixes it

### Tier 0 — unblock CI now (one line, not a fix)

Pin the runner back until the code fix lands:

```yaml
# .github/workflows/*.yml
- uses: actions/setup-node@v4
  with:
    node-version: 24    # or: node-version-file: .nvmrc
```

```
# .nvmrc
24
```

Also enforce it so it can't drift again, in `packages/nextjs/package.json` (and root):

```json
{ "engines": { "node": ">=20 <25" } }
```

### Tier 1 — the real fix: stop detecting `localStorage`, detect the browser

Every guard of this shape is now broken:

```ts
// BROKEN on Node 25 — the binding exists in Node
if (typeof localStorage !== "undefined") { … }
if (localStorage) { … }
"localStorage" in globalThis
```

Replace with a `window` check. `window` is still absent in Node and is not on any standards
track to appear there — it is the durable signal:

```ts
const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";
```

Two rules that follow:

1. **Always go through `window.localStorage`, never bare `localStorage`.** Bare
   `localStorage` is now ambient in Node and resolves to the stub; `window.localStorage`
   cannot resolve to anything on the server because `window` throws first. Making this a
   lint rule (`no-restricted-globals`) is the cheapest permanent guard — see Tier 3.
2. **Better: don't touch storage during render at all.** Prerender output must not depend on
   client state anyway, or you get hydration mismatches. Read storage in an effect:

   ```ts
   const [value, setValue] = useState<string | null>(null);           // server snapshot
   useEffect(() => setValue(window.localStorage.getItem(key)), [key]); // browser only
   ```

   or `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` with an explicit
   server snapshot. Effects never run during prerender, so the question disappears.

For the wagmi config in `packages/nextjs/services/web3/wagmiConfig.tsx`, make the storage
choice explicit rather than leaving it to defaults:

```ts
import { createConfig, createStorage, cookieStorage, noopStorage } from "wagmi";

export const wagmiConfig = createConfig({
  // …chains, transports, connectors
  ssr: true,
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
    // or cookieStorage, if you want connection state to survive SSR
  }),
});
```

`ssr: true` matters independently: it tells wagmi not to hydrate from persisted storage on
the server pass.

### Tier 2 — third-party code you can't edit

Realistically the offending `localStorage.getItem` is inside a dependency (burner wallet
connector, a wallet SDK, an analytics or theme package), not your own source. You cannot
edit its guard. So remove the thing its guard is tripping over — turn the global off before
the bundle loads. Pick one:

**Option A — the Node flag (cleanest):**

```jsonc
// packages/nextjs/package.json
{ "scripts": { "build": "NODE_OPTIONS=--no-experimental-webstorage next build" } }
```

Verified on v25.9.0 — this removes both globals entirely, restoring exactly the Node 24
environment your dependencies were written against:

```console
$ node --no-experimental-webstorage -e 'console.log(typeof localStorage, typeof sessionStorage)'
undefined undefined
```

Cross-platform equivalent without inline env syntax:

```jsonc
{ "scripts": { "build": "cross-env NODE_OPTIONS=--no-experimental-webstorage next build" } }
```

Because it is a CLI flag on `NODE_OPTIONS`, it is **inherited by the forked prerender
workers** — which is the whole reason it works where B's polyfill didn't.

**Option B — a preload script**, if you'd rather not depend on the flag name surviving
future Node releases:

```js
// scripts/strip-webstorage.cjs
delete globalThis.localStorage;
delete globalThis.sessionStorage;
```

```jsonc
{ "scripts": { "build": "NODE_OPTIONS=--require=./scripts/strip-webstorage.cjs next build" } }
```

`delete` works — the property is `configurable: true` (verified above). `--require` runs
before any application module, and `NODE_OPTIONS` is inherited by the workers.

**Option C — if some dependency genuinely needs a working `localStorage` during build**
(rare; almost always the SSR fallback path is what you want), give Node a real one instead of
removing it:

```jsonc
{ "scripts": { "build": "node --localstorage-file=.next/cache/ls.db ./node_modules/.bin/next build" } }
```

This yields a genuine `Storage` with a real `getItem`. Use it only as a last resort: it means
your prerendered HTML can depend on a file on the build machine, which is a reproducibility
hazard.

**Recommendation:** Tier 2 Option A in CI today, Tier 1 in your own source as the durable fix.
Option A is a compatibility shim for your dependency tree, not a substitute for correct guards.

### Tier 3 — make the regression impossible to reintroduce

```jsonc
// packages/nextjs/.eslintrc.json
{
  "rules": {
    "no-restricted-globals": [
      "error",
      { "name": "localStorage",   "message": "Use window.localStorage behind a typeof window check — bare localStorage exists in Node 25+ as a broken stub." },
      { "name": "sessionStorage", "message": "Use window.sessionStorage behind a typeof window check." }
    ]
  }
}
```

This catches bare-global usage in your own code. It will not catch dependencies, which is
why the flag in Tier 2 stays.

---

## 5. Finding the actual culprit in your repo

`/_not-found` is a red herring — it's simply the first page prerendered, so it's where a
crash in shared providers (`app/layout.tsx` → `ScaffoldEthAppWithProviders` → wagmi /
RainbowKit / theme) surfaces first. Expect other pages to fail identically once it's fixed.

```bash
# your own source — bare localStorage, not window.localStorage
grep -rn --include=*.ts --include=*.tsx -E '(^|[^.\w])(local|session)Storage\b' packages/nextjs/ \
  | grep -v node_modules

# dependencies — the ones that guard on the binding instead of on window
grep -rln -E 'typeof (local|session)Storage\s*(!==|===)\s*["'\'']undefined' \
  node_modules/ .yarn/cache/ 2>/dev/null | head -40
```

Typical hits in a Scaffold-ETH 2 tree: burner-wallet connector key loading, wallet SDK
session restore, theme persistence, analytics. To get the real frame instead of Next's
truncated prerender summary:

```bash
cd packages/nextjs && NEXT_TELEMETRY_DISABLED=1 next build --debug 2>&1 | tail -60
```

---

## 6. One-paragraph summary for the team

Node 25 unflagged the Web Storage API, so `globalThis.localStorage` now exists in every Node
process — but with no `--localstorage-file` it's an empty `{}` with no methods. Our
browser-detection guards test `typeof localStorage !== "undefined"`, which used to be `false`
on the server and is now `true`, so prerender takes the browser path and calls `.getItem` on
an empty object. A's model was right through Node 24 and the unflagging is what invalidated
it; the `TypeError` (rather than `ReferenceError`) is the tell that the binding exists.
B's polyfill can't help because nothing is missing to polyfill, and because `next build`
prerenders in forked worker processes with their own `globalThis` — an `instrumentation.ts`
server hook can't reach them. Fix: `NODE_OPTIONS=--no-experimental-webstorage` on the build
to unblock CI, and change our guards from `typeof localStorage` to `typeof window` (or move
the reads into effects) so the app is correct on any Node.
