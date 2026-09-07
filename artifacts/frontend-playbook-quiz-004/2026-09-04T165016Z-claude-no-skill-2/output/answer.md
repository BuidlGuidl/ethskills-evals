# `localStorage.getItem is not a function` during `next build` on Node 25

## TL;DR

Both teammates are reasoning about the wrong thing.

* **Node 25 ships Web Storage on by default.** `globalThis.localStorage` exists in a plain
  `node` process now. Teammate A's "Node has no localStorage" was true through Node 24 and is
  false as of Node 25.
* **Worse: without `--localstorage-file`, Node 25 does not give you a real `Storage`.** It hands
  back a bare null-prototype `{}` and prints a warning. So `typeof localStorage !== "undefined"`
  passes, `if (localStorage)` passes, and then `localStorage.getItem(...)` throws exactly the
  `TypeError` you are seeing.
* **The bug is caused by `localStorage` being *present*, not absent.** A polyfill is a fix for
  absence, so it is aimed at the wrong failure. And it never even loads: `instrumentation.ts`
  is a *server-runtime* hook, while `next build` prerenders your pages in **forked worker
  processes** that never boot a Next server. Teammate B is patching a process that does not
  render anything.
* **The fix** is to stop feature-detecting `localStorage` and feature-detect `window` instead
  (`window` and `document` are still genuinely browser-only in Node 25). One-line CI unblock
  while you land that: `NODE_OPTIONS=--no-experimental-webstorage`.

---

## 1. What actually changed in Node

Web Storage (`localStorage` / `sessionStorage`) landed in Node 22.4.0 behind
`--experimental-webstorage`, stayed opt-in through Node 24, and became **on by default in
Node 25**. The flag was renamed `--webstorage`, and the only thing left called
"experimental" is the *negation*, `--no-experimental-webstorage` — a good tell that the
feature graduated.

Measured on this machine (`env -u NODE_OPTIONS node -e ...`, no flags, no `NODE_OPTIONS`):

| Node       | `typeof localStorage` | `typeof localStorage.getItem` | webstorage CLI flags                        |
|------------|-----------------------|-------------------------------|---------------------------------------------|
| v20.19.1   | `undefined`           | n/a                           | *(none — feature does not exist)*           |
| v21.7.3    | `undefined`           | n/a                           | *(none)*                                    |
| v22.22.2   | `undefined`           | n/a                           | `--experimental-webstorage` (opt-in)        |
| v24.14.1   | `undefined`           | n/a                           | `--experimental-webstorage` (opt-in)        |
| **v25.9.0**| **`object`**          | **`undefined`**               | `--webstorage`, `--no-experimental-webstorage` |

That single row is your entire regression. Nothing in your app changed; the ambient global
namespace under it did.

### The nasty part: the half-initialized `localStorage`

`localStorage` needs somewhere to persist to. `sessionStorage` is in-memory and works
immediately, but `localStorage` is backed by the file given to `--localstorage-file`. What
happens when you don't pass one differs by version — and Node 25 chose the quieter, more
dangerous behaviour:

```console
$ node --experimental-webstorage -e 'localStorage.getItem("x")'   # Node 24
TypeError [ERR_INVALID_ARG_VALUE]: The argument '--localstorage-file' is an invalid
localStorage location. Received ''
    at Object.get [as localStorage] (node:internal/webstorage:30:17)

$ node -e 'localStorage.getItem("x")'                             # Node 25, no flags
(node:4121187) Warning: `--localstorage-file` was provided without a valid path
TypeError: localStorage.getItem is not a function          <-- your build error, verbatim
```

Node 24 threw loudly on property access. Node 25 warns and returns a decoy:

```console
$ node -e 'console.log(Reflect.ownKeys(localStorage), Object.getPrototypeOf(localStorage))'
[] [Object: null prototype] {}
```

An empty object with a null prototype. It is truthy. It is `typeof "object"`. It is not
`undefined`. It has no `getItem`, no `setItem`, no `Storage` prototype. Every cheap feature
detection in the JavaScript ecosystem says "we're in a browser, go ahead", and the very next
line explodes.

For completeness, with a path it behaves properly — which matters for the "what not to do"
section below:

```console
$ node --localstorage-file=/tmp/ls.json -e 'localStorage.setItem("a","1"); console.log(localStorage.getItem("a"), Object.getPrototypeOf(localStorage).constructor.name)'
1 Storage
```

### This is a trend, not a one-off

Node has been growing browser-shaped globals for years, and each one silently flips somebody's
`typeof` guard:

| Global        | `undefined` in Node… | present since |
|---------------|----------------------|---------------|
| `crypto`      | —                    | Node 20 (and earlier as webcrypto) |
| `navigator`   | ≤ Node 20            | **Node 21**   |
| `WebSocket`   | ≤ Node 21            | **Node 22**   |
| `localStorage` / `sessionStorage` | ≤ Node 24 | **Node 25** (Node 22.4 flagged) |
| `window`, `document` | **all versions, still today** | never |

Verified across the same six Node builds. The practical rule falls straight out of the last
row: **`window` and `document` are the only globals whose absence still reliably means "not a
browser."** Everything else is a moving target.

---

## 2. Why teammate A's mental model is out of date

A is applying a rule that was correct from Node 0.x through Node 24 and stopped being correct
in the exact version CI just adopted. Two things to point out:

1. **The premise is now false.** Node 25 has `localStorage`. Run
   `node -e 'console.log(typeof localStorage)'` on the CI image; it prints `object`.
2. **The error message already disproves the premise.** If nothing were there, the error would
   be `ReferenceError: localStorage is not defined`. You got
   `TypeError: localStorage.getItem is not a function` — a `TypeError` on property *access of
   an existing object*. The error text was, all along, telling you an object exists and is the
   wrong shape. "Impossible" errors are usually a stale assumption plus an unread stack frame.

The deeper lesson: `typeof X === "undefined"` is not an environment check, it is a *snapshot of
one Node release's global namespace*. Environment detection built on it has a shelf life.

---

## 3. Why teammate B's polyfill cannot work, no matter how correct it is

Two independent reasons. Either alone is fatal.

### Reason 1: the code never runs in the process that prerenders

This is the one that matters. Ask where `/_not-found` is actually rendered:

* `instrumentation.ts` → `register()` is a **server runtime** hook. Next.js calls it when a
  Next *server instance* bootstraps — `next dev`, `next start`, a serverless function cold
  start. (Its sibling export, `onRequestError`, is request-time only — a good hint about which
  lifecycle this file belongs to.)
* `next build` static generation runs in **forked worker processes** (Next uses a
  `jest-worker` pool to render routes in parallel). Those workers import your compiled route
  modules and render them to HTML. They do not stand up a server, so the server-runtime hook is
  not part of their startup path. With `output: "export"` this is *all* of your rendering.

Your own evidence confirms it: a correct polyfill that had actually been installed in the
rendering process would have made `getItem` a function and changed the error. The build failing
*identically* is the tell that B's code and the failing code are not in the same process.

And it isn't a "the global is locked down" problem — I checked, and the override B wants would
work fine if it were in the right process:

```console
$ node -e '
  const d = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  console.log(d.configurable, typeof d.set);          // true function
  globalThis.localStorage = { getItem: () => null };
  console.log(typeof localStorage.getItem);'          // function
true function
function
```

`globalThis.localStorage` is a configurable accessor with a setter. B's polyfill is installable.
It is just installed in a process that renders zero pages.

Here is the process boundary in miniature — a parent that fixes its *own* globals, and a forked
child that is unaffected, which is precisely the `next build` → render-worker relationship:

```console
$ node --no-experimental-webstorage -e '
    console.log("parent typeof localStorage:", typeof localStorage);
    require("child_process").fork("/tmp/child-probe.js", [], { execArgv: [] })'
parent typeof localStorage: undefined
  child pid 4123444 execArgv= [] typeof localStorage: object     <-- worker never got the fix
```

Same shape as: instrumentation runs (or doesn't) over here; the TypeError happens over there.

### Reason 2: it is the inverse of the fix

Even granting Reason 1 away — suppose B got the polyfill into every worker. It would then paper
over the crash by making the *browser* code path succeed *on the server*, which is a different
bug wearing a hat:

* wagmi/RainbowKit/WalletConnect would "restore" a wallet session from an empty server-side
  store, and prerender HTML that assumes a specific (disconnected, or worse, stale) state.
* At hydration the client reads the *real* browser `localStorage`, gets different values, and
  React reports a hydration mismatch — or silently discards the server HTML and flashes.
* For `output: "export"` this is baked into static files at build time. You'd ship one user's
  build-machine state to everyone.

Server-side rendering must not read client storage *at all*. The correct server behaviour is
"there is no storage here" — which is what a no-op store, not a working polyfill, expresses.
The crash was Node bluntly telling you a browser-only code path is executing on the server. The
goal is to not take that path, not to make it survive.

---

## 4. What actually fixes it

### a) Unblock CI now (one line, zero code change)

Turn Web Storage back off for the build. Use `NODE_OPTIONS`, **not** a CLI flag — `NODE_OPTIONS`
is an environment variable and therefore inherited by the forked render workers, which is
exactly the propagation a CLI flag lacks (see the fork demo above):

```yaml
# .github/workflows/ci.yml
- run: yarn build
  env:
    NODE_OPTIONS: --no-experimental-webstorage
```

Verified end to end:

```console
$ NODE_OPTIONS=--no-experimental-webstorage node parent-probe.js
parent pid 4123423 typeof localStorage: undefined
  child pid 4123430 execArgv= [] typeof localStorage: undefined   <-- worker inherits it
```

This restores the Node 24 global namespace for the whole process tree. Treat it as a tourniquet
with a ticket attached, not the cure: it leaves your code one Node upgrade away from breaking
again, and it will not help anyone building on Node 25 outside CI.

### b) The real fix: detect the browser with `window`

Find every server-reachable `localStorage` / `sessionStorage` reference and re-gate it. The rule:
**check `window`, and access storage as a property of `window`.**

```diff
-const storage = typeof localStorage !== "undefined" ? localStorage : noopStorage;
+const storage = typeof window !== "undefined" ? window.localStorage : noopStorage;
```

`window.localStorage` is doubly safe: the guard tests the one global Node still doesn't define,
and the access itself can't accidentally resolve to Node's bare global. Both halves of that diff,
run on Node 25.9.0:

```console
typeof localStorage  -> store=picked  TypeError: store.getItem is not a function   <-- prerender dies here
typeof window        -> store=null    read ok: null
```

To find the call sites:

```bash
# bare localStorage/sessionStorage reads not already behind a window check
grep -rn --include=*.{ts,tsx,js,jsx} -E '(^|[^.\w])(localStorage|sessionStorage)\b' packages/nextjs \
  | grep -v node_modules

# the guard idiom itself, wherever it appears
grep -rn --include=*.{ts,tsx,js,jsx} -E 'typeof\s+(localStorage|sessionStorage|navigator)\s*[!=]==' . \
  | grep -v node_modules
```

In a Scaffold-ETH 2 app the usual suspects are:

* **wagmi config** (`packages/nextjs/services/web3/wagmiConfig.ts`) — `createConfig`'s
  `storage`. Use wagmi's own helpers rather than hand-rolling:
  `createStorage({ storage: typeof window !== "undefined" ? window.localStorage : noopStorage })`,
  importing `noopStorage` from `wagmi`. `cookieStorage` is the right choice instead if you
  actually want SSR-visible state — but for `output: "export"` you don't.
* **zustand `persist`** (`services/store/store.ts` or similar) —
  `createJSONStorage(() => localStorage)` evaluates its callback eagerly enough to bite during
  SSG. Guard it, or skip `persist` on the server.
* **RainbowKit / WalletConnect / `@walletconnect/keyvaluestorage`** in the provider tree — these
  are the ones that most often run at *module scope*, which is also why an
  `instrumentation.ts`-based fix would lose the race even if it ran in the right process: the
  route module graph is evaluated when the worker imports the page.

Note that this fires on `/_not-found` specifically because that route is still wrapped in your
root `layout.tsx` provider tree, so the Web3 providers get prerendered even for a page with no
Web3 content. It's the smallest page in the app, which is why it's the one that surfaced first —
not a special case.

### c) Keep genuinely browser-only work out of prerender

Where a component truly cannot render without storage, don't guard the global — move the work
to the client:

```tsx
// only after mount, i.e. never during prerender
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton />;
```

or keep the subtree out of the server bundle entirely:

```tsx
const WalletPanel = dynamic(() => import("./WalletPanel"), { ssr: false });
```

This is also what kills the hydration-mismatch class of bug, not just the crash.

### d) Pin the runtime so this is a PR, not a surprise

```jsonc
// package.json
"engines": { "node": ">=20.18.3 <26" }
```

plus a committed `.nvmrc` and `node-version-file: .nvmrc` in `actions/setup-node`, so the CI
runtime moves when someone deliberately bumps it and the diff shows up in review.

### e) What *not* to do

**Do not "fix" this with `--localstorage-file`.** It is the most tempting option because it makes
the error vanish — Node then hands you a real, working `Storage`:

```console
$ node --localstorage-file=/tmp/ls.json -e 'localStorage.setItem("a","1"); console.log(localStorage.getItem("a"))'
1
```

…which is precisely Reason 2 above, plus a persistent file on the build agent. You'd trade a
loud build failure for silent hydration mismatches and cross-build state bleed through a shared
CI cache. The crash is doing you a favour; keep it until the guards are fixed.

---

## 5. Verify

```bash
# 1. Confirm the diagnosis on the CI image
node -e 'console.log(process.version, typeof localStorage, typeof localStorage.getItem)'
# expect: v25.x object undefined

# 2. After fixing the guards, build on Node 25 with NO escape hatch.
env -u NODE_OPTIONS yarn build      # must pass on its own merits

# 3. Then confirm the tourniquet is removable
#    (drop NODE_OPTIONS from the workflow and watch CI stay green)
```

If step 2 passes without `--no-experimental-webstorage`, the guards are genuinely fixed rather
than hidden, and Node 26 won't reopen this ticket.

---

## Notes on scope

* Every Node-level claim above was executed on this machine against
  v20.19.1 / v21.7.3 / v22.5.1 / v22.22.2 / v24.14.1 / v25.9.0, and the `TypeError` message
  reproduces character-for-character.
* This working directory contains no application source (just `package.json` and `TASK.md`), so
  the Scaffold-ETH 2 file paths in §4b are the conventional locations rather than paths I
  confirmed in your tree — run the two `grep`s to get the real list.
* The Next.js internals (server-runtime `register()`, worker-pool prerendering) are stable
  across Next 14/15, but the precise set of lifecycles that load `instrumentation.ts` has moved
  between releases. It doesn't change the conclusion: whatever the version, an identical failure
  after B's change is proof the polyfill isn't reaching the rendering process, and §4b fixes it
  regardless of which process anything runs in.
