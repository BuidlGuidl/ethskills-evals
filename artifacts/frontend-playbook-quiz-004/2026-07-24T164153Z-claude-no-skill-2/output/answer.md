# Why the static export breaks on Node 25

    TypeError: localStorage.getItem is not a function
    Error occurred prerendering page "/_not-found"

Short version: **Node now ships a global `localStorage`.** The object exists,
but with no backing store it has no `getItem`. Scaffold-ETH's dependency stack
detects "am I in a browser?" with `typeof localStorage !== 'undefined'`, that
check now passes inside Node, so browser-only code runs at build time and blows
up. A polyfill can't rescue it because it never runs in the process that does
the prerender.

All of the behavior below was reproduced on the `node v25.9.0` that CI is now
using.

---

## What actually changed in Node

Node gained a built-in **Web Storage API** (`localStorage` / `sessionStorage`
as globals). It landed experimentally in Node 22.4 and has since moved toward
being on by default — on Node 25 the `localStorage` global is present in a
plain `node -e` with no flags:

```
$ node -e "console.log(typeof localStorage)"
object
```

Crucially, the global is present but **inert unless you start Node with a
backing file** (`--localstorage-file=<path>`). Without it:

```
$ node -e "console.log(typeof localStorage, typeof localStorage.getItem)"
object undefined

$ node -e "localStorage.getItem('x')"
TypeError: localStorage.getItem is not a function   <-- our build error, exactly
```

Give it a file and the methods appear:

```
$ node --localstorage-file=/tmp/ls.db -e "console.log(typeof localStorage.getItem)"
function
```

So `localStorage` is now a lazy global backed by a getter. Read it without a
configured store and you get an object skeleton with **no `getItem`/`setItem`**
— which is precisely the crash.

## Why Teammate A's mental model is out of date

A is reasoning from "Node has no `localStorage`, so there is nothing to call
`getItem` on." That was true through roughly Node 21. It is false on Node 22.4+
and on the Node 25 in CI.

The error message itself disproves A: the runtime got far enough to *evaluate*
`localStorage` (it's an object, not a `ReferenceError`) and only failed when it
looked up `.getItem`. If `localStorage` genuinely didn't exist you'd see
`ReferenceError: localStorage is not defined`, not
`TypeError: localStorage.getItem is not a function`. The object is real; it's
just Node's half-initialized Web Storage, not the browser's.

The real trigger is a **feature-detection regression** in the ecosystem. Wagmi,
RainbowKit, and various storage helpers in the Scaffold-ETH dependency tree
guard browser-only code with something like:

```js
if (typeof localStorage !== 'undefined') { /* treat as browser */ }
```

On old Node that guard was `false` at prerender time, so the browser branch was
skipped. On Node 25 it's now `true`, so the browser branch **executes inside the
Node prerender** and immediately calls the missing `getItem`. Note the more
correct guard, `typeof window`, still behaves the old way:

```
$ node -e "console.log(typeof window, typeof localStorage)"
undefined object
```

That divergence — `window` undefined but `localStorage` defined — is the whole
bug. Code that used `localStorage` as a proxy for `window` now guesses wrong.

## Why Teammate B's polyfill cannot work — where the prerender runs

B's fix is conceptually the right shape (make a working `localStorage`) but it's
installed in the wrong place. `instrumentation.ts`'s `register()` runs once when
a **Next.js server instance** boots. The failure here is not from a running
server — it's from `next build` **prerendering/static export**, which is a
different execution context:

- `next build` renders each route to HTML in a **pool of separate worker
  processes** (Next.js farms static generation out to child processes/threads).
  The route module — e.g. a top-level wagmi/RainbowKit config created at import
  time — is evaluated inside one of those workers.
- Globals set by `instrumentation.register()` live in whatever process ran that
  hook. They do **not** propagate into the prerender worker that renders
  `/_not-found`. `register()` is also not reliably invoked in the build-time
  prerender path at all.
- Meanwhile Node's built-in `localStorage` is installed by the **runtime
  itself**, into *every* Node process, before any user code runs. So every
  worker starts with the broken built-in and none of them ever see B's polyfill.

That's why the build "fails identically" — the polyfill's correctness is
irrelevant when it's evaluated in a process that never touches the render. Even
if you moved the polyfill somewhere the workers do import, you'd be racing the
module's *top-level* `localStorage` access, and you'd be fighting a global the
runtime already defined. It's the wrong layer.

(The global is technically overwritable — its descriptor is
`configurable: true` with a setter — so an early enough, right-process
assignment *could* stick. But "early enough and in the right process for every
prerender worker" is exactly what `instrumentation.ts` doesn't give you, which
is why this approach is a dead end in practice.)

## What actually fixes it

Pick based on how much you can touch. Fastest and most reliable first.

**1. Turn Node's Web Storage back off for the build (recommended).**
Restore the pre-Node-22 environment so the `typeof localStorage` guards go back
to `false` during prerender:

```jsonc
// package.json
"scripts": {
  "build": "NODE_OPTIONS=--no-experimental-webstorage next build"
}
```

Verified: `node --no-experimental-webstorage -e "console.log(typeof localStorage)"`
prints `undefined`. This makes the browser-detection guards correct again with
zero code changes and no behavioral surprises. Set it in CI env if you prefer
not to touch `package.json`.

**2. Give Node a real backing store for the build.**
The opposite tack — make `localStorage` fully functional so `getItem` exists:

```jsonc
"build": "NODE_OPTIONS=--localstorage-file=.next/build-localstorage next build"
```

This stops the crash (methods now exist), but it's inferior to option 1: you're
letting genuinely browser-only code run and read/write a throwaway file during
the build instead of preventing it. Use it only if something actually depends
on Web Storage being present.

**3. Fix the guard at the source (the correct long-term fix).**
The root cause is code using `typeof localStorage` as a browser check. Where you
own that code, gate on `window` instead:

```js
// before
if (typeof localStorage !== 'undefined') { ... }
// after
if (typeof window !== 'undefined') { ... }
```

Most of the offending checks are in dependencies (wagmi / RainbowKit / storage
adapters), so upgrading those to versions that account for Node's Web Storage is
the durable path. Until those land, ship option 1 to unblock CI.

## TL;DR

- Recent Node (22.4+, on by default by Node 25) added a global `localStorage`.
  With no `--localstorage-file` it exists but has no `getItem` → the exact
  `TypeError`.
- **A** is wrong: Node *does* have `localStorage` now; the `TypeError` (not
  `ReferenceError`) proves the object exists.
- **B** is wrong: `next build` prerenders in separate worker processes; an
  `instrumentation.ts` polyfill never runs there, and Node's built-in global is
  installed into every process before user code — so the build fails identically.
- **Fix:** build with `NODE_OPTIONS=--no-experimental-webstorage` (or fix the
  `typeof localStorage` browser-detection guards / bump the deps that use them).
