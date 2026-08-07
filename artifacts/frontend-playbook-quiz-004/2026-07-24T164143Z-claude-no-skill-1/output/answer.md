# Why the Scaffold-ETH 2 static export broke on Node 25

## TL;DR

Node 25 ships the experimental **Web Storage API on by default**. That means
`localStorage` (and `sessionStorage`) now exist as *globals* in plain Node — but
without a `--localstorage-file` they are **half-initialized stubs**: the object
exists (`{}`), yet its methods (`getItem`, `setItem`, …) are never wired up.

So the classic browser-detection guard `typeof localStorage !== "undefined"`
**now passes on the server**, the code walks straight into
`localStorage.getItem(...)`, and `getItem` is `undefined` →
`TypeError: localStorage.getItem is not a function`.

- **Teammate A** is running a pre-Node-22 mental model. Node *does* have
  `localStorage` now.
- **Teammate B**'s polyfill can't win because the failing check runs at
  **module-evaluation time inside the prerender workers**, before
  `instrumentation.ts` ever executes — the wrong phase and, for build workers,
  the wrong process. A perfect polyfill that runs too late is inert.
- **The fix** is to stop pretending it's a browser: disable Node's Web Storage
  for the build (`--no-experimental-webstorage`), and/or pin CI back to Node 24
  until dependencies fix their guards. Root cause for code you own: guard on
  `typeof globalThis.document`, not on `window`/`localStorage`.

---

## 1. What actually changed in Node

Node added a WHATWG **Web Storage** implementation:

- **Node 22.4.0** — `localStorage`/`sessionStorage` introduced as globals, but
  gated behind the `--experimental-webstorage` flag. If you didn't pass the
  flag, they didn't exist, so nothing broke.
- **Node 25** — Web Storage is **enabled by default**. No flag required. This is
  the line CI just crossed when it moved from 24 → 25.

I reproduced this on the exact runtime CI is now using (`node v25.9.0`):

```
$ node -e "console.log(typeof localStorage)"
object                       # <-- it EXISTS now

$ node -e "console.log(localStorage)"
{}                           # <-- but it's an empty, half-built object
(node:xxxxx) Warning: `--localstorage-file` was provided without a valid path

$ node -e "console.log(typeof localStorage.getItem)"
undefined                    # <-- so its methods are NOT functions

$ node -e "console.log(typeof sessionStorage)"
object                       # same story for sessionStorage

$ node -e "console.log(typeof window)"
undefined                    # window is still NOT defined in Node 25.9.0
```

Two things matter here:

1. `localStorage` is now a **truthy, defined global** on the server.
2. Until you point Node at a backing store with `--localstorage-file`, it's a
   **stub with no working methods**. Providing a valid file makes the methods
   real:

   ```
   $ node --localstorage-file=./ls.tmp -e "localStorage.setItem('a','1'); console.log(localStorage.getItem('a'))"
   1                          # getItem is a real function once a file is set
   ```

(Note: some write-ups also claim Node 25 aliases `window` to `globalThis`. That
did **not** reproduce on 25.9.0 here — `typeof window` is still `undefined`. The
thing that actually broke your build is the `localStorage`/`sessionStorage`
globals, so that's what the rest of this focuses on.)

## 2. The exact mechanism of your error

Scaffold-ETH 2's provider stack (wagmi / RainbowKit / theme + Zustand `persist`
stores) is full of storage-backed code guarded by browser checks like:

```js
const isBrowser = typeof localStorage !== "undefined";
// ...later...
const raw = localStorage.getItem(KEY);
```

Walk it through on each runtime:

| Runtime | `typeof localStorage` | Guard result | `localStorage.getItem` | Outcome |
|---|---|---|---|---|
| Real browser | `"object"` (working) | browser ✓ | function | fine |
| Node ≤ 24 | `"undefined"` | server ✓ (skips) | n/a | fine |
| **Node 25** | `"object"` (**stub**) | **browser ✗** (falls through) | **undefined** | **`getItem is not a function`** |

The guard was never designed to distinguish "real browser Storage" from "Node's
empty Storage stub." Node 25 introduced a third state the guard can't see, and
the guard guesses wrong.

`/_not-found` is just the first page Next tries to prerender. It's the built-in
404, but it still renders through your root layout and provider tree, so it's the
first page to touch storage during static export. Any page would trip the same
way.

## 3. Why Teammate A is wrong

A's claim — "Node has no `localStorage`, so there's nothing to call `getItem`
on" — was **correct up to and including Node 24**. It's now stale by exactly one
major version.

Notice A's model predicts the *opposite* symptom. If `localStorage` truly didn't
exist, you'd get `ReferenceError: localStorage is not defined` (or the guard
would short-circuit and you'd get nothing at all). You are instead getting a
`TypeError` about a **missing method on an existing object**. That error is only
possible if `localStorage` *is* defined — which is precisely the Node 25 change
A hasn't absorbed. The error isn't impossible; it's the fingerprint of the new
behavior.

## 4. Why Teammate B's fix cannot work — where the prerender actually runs

B's instinct ("localStorage is broken → give it a correct polyfill") is aimed at
the wrong problem and, more importantly, fires in the wrong place.

**Where does the prerender run?** Not in the browser, and not in the long-lived
Next server that `instrumentation.ts` is built for. Static export (`next build`)
renders your pages in **Node, inside Next's build/prerender worker processes** —
it spins up worker processes that `import` your page/layout module graph and
execute it to produce HTML. The `TypeError` is thrown *there*, in a Node worker,
at render time.

`instrumentation.ts`'s `register()` is the hook for a **running server
instance** starting up. Against those build-time prerender workers it loses for
two independent reasons:

1. **Wrong phase (the decisive one).** The offending browser-detection runs at
   **module-evaluation time** — the instant the worker imports the module. Many
   of these libraries compute the decision *once* and cache it, e.g.
   `const isBrowser = typeof localStorage !== "undefined"` at module top level,
   or they call `localStorage.getItem` directly while the module initializes its
   store. By the time any `register()` polyfill could run, the guard has already
   evaluated (and frozen) its answer and/or the failing call has already
   happened. You cannot monkey-patch a global *before* code that read it during
   its own import.

2. **Wrong process / not guaranteed to run.** `instrumentation.register()` is
   not a reliable "runs first in every prerender worker" pre-hook. The isolated
   render workers evaluate your page modules to emit HTML; the instrumentation
   polyfill isn't guaranteed to have executed in that worker before those
   modules load.

And note what B is even trying to do: **supply a missing global**. But nothing
is missing — Node *already* defined `localStorage`. The global property is
writable/configurable (I checked: it has a get/set descriptor and reassigning
`globalThis.localStorage = {...}` *does* take effect), so overriding it is
technically possible. The barrier is purely **timing**: to win, your override
has to run before the first guard/first access in that worker, and
`instrumentation.ts` categorically does not give you that ordering during a
static export.

That's why "no matter how correct the polyfill is" holds: correctness of the
polyfill is irrelevant when it never runs before the code it's meant to protect.

## 5. What actually fixes it

Ranked, most robust / least effort first. For a Scaffold-ETH app you don't own
the guard code inside `next-themes`, wagmi, Zustand persist, etc., so prefer the
environment-level fixes:

1. **Turn Node's Web Storage back off for the build** (best targeted fix —
   restores the exact environment your deps expect, no code changes):

   ```bash
   # in the CI build step / package.json script
   NODE_OPTIONS=--no-experimental-webstorage yarn build
   ```

   Verified on 25.9.0:

   ```
   $ node --no-experimental-webstorage -e "console.log(typeof localStorage)"
   undefined
   ```

   With the global gone, `typeof localStorage !== "undefined"` correctly reports
   "server" again and every one of those guards skips as before. This fixes it
   regardless of *which* dependency has the sloppy guard.

2. **Pin CI back to Node 24 LTS** (fastest unblock while you roll out the above
   or wait on upstream). Set it in your CI matrix / `.nvmrc` / `engines`. Node 24
   doesn't ship Web Storage by default, so the regression disappears.

3. **Fix the guard at the root** (for code you own or can patch/override). Detect
   the browser with something that is *still* browser-only in Node 25:

   ```js
   // ❌ both now unreliable on the server in Node 25
   const isBrowser = typeof window !== "undefined";
   const isBrowser = typeof localStorage !== "undefined";

   // ✅ document has no Node global; use it (or feature-detect a WORKING storage)
   const isBrowser =
     typeof globalThis.document !== "undefined" &&
     typeof globalThis.localStorage?.getItem === "function";
   ```

   Then bump/patch the dependencies that had the bad guard (e.g. update
   `next-themes` to a release that fixed this; similar fixes are landing across
   the ecosystem).

For a Scaffold-ETH 2 monorepo, do **#1 in CI now** (one-line, unblocks the
export), keep **#2** as the safety net, and track **#3** via dependency upgrades
so you can eventually drop the flag and move forward on Node 25+.

## 6. What NOT to do

- **Don't give the build a `--localstorage-file`.** It *would* stop the crash
  (`getItem` becomes a real function, verified above), but you'd be handing your
  prerender a persistent, file-backed "browser" storage that has no business
  existing during static generation. It masks the real bug — a browser/server
  detection failure — instead of fixing it, and invites subtly wrong prerendered
  output.
- **Don't add more polyfills in `instrumentation.ts`** (B's path). Same phase/
  process problem described in §4 — it can't run early enough for the prerender
  workers.
- **Don't `try/catch` around every storage access.** It buries the signal and
  leaves the persist/theme logic silently no-op'ing during prerender.

---

## Sources

- [Node.js 25 `localStorage.getItem is not a function` — next-themes issue #389](https://github.com/pacocoursey/next-themes/issues/389)
- [Cause and Fix for `localStorage.getItem is not a function` in Next.js 15](https://tech.ldas.jp/en/posts/36e5d3a653a809/)
- [TypeError: localStorage.getItem is not a function — Vercel Community](https://community.vercel.com/t/typeerror-localstorage-getitem-is-not-a-function/28578)
- Directly reproduced on `node v25.9.0` (probes shown inline above).
