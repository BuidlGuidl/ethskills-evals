# Node 25 broke SE-2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22.4 added Web Storage (`localStorage`, `sessionStorage`) behind a flag
  (`--experimental-webstorage`). It needs a backing file, `--localstorage-file=<path>`,
  to actually store anything.
- **Node 25 turned Web Storage on by default.** `localStorage` is now a real global
  in every Node process, with no flag needed.
- But if no `--localstorage-file` is set, the global still **exists** and is **not a
  working Storage object**: it lacks the standard methods (`getItem`, `setItem`, …).

So on Node 25, with default settings:

```js
typeof localStorage            // "object", not "undefined"
typeof localStorage.getItem    // "undefined"
localStorage.getItem("x")      // TypeError: localStorage.getItem is not a function
```

## Why Teammate A's view is out of date

"Node has no localStorage" was true through Node 24 (without flags). Lots of browser
code relies on that. Wallet/theme/storage libraries in an SE-2 app (wagmi,
RainbowKit, next-themes, persisted zustand stores, `usehooks-ts`, …) check whether
they're running in a browser like this:

```js
if (typeof localStorage !== "undefined") localStorage.getItem(key)
// or: typeof window === "undefined" ? … : …   (some check the storage global directly)
```

On Node 25 that check passes during server prerender. The library thinks it has
storage, calls `getItem`, and crashes. The error is exactly what you get when the
global is there but its methods aren't. A's claim "there's nothing to call it on" is
wrong now: there *is* something, it just doesn't work. `/_not-found` is only the
first page prerendered. It renders the root layout and providers, so every page
would fail the same way.

## Why B's polyfill can't fix it, however correct

1. **Wrong process.** `next build` doesn't prerender pages in the process that loads
   `instrumentation.ts`/`next.config.ts`. Static generation runs in **separate
   worker processes** that `next build` spawns. Each worker is a fresh Node 25
   process with Node's own broken `localStorage` global. Anything you patch in
   memory in one process isn't copied into another. `instrumentation.ts`'s
   `register()` is a server-startup hook, not something that runs first in every
   build worker, so the polyfill never reaches the code doing the prerender.
2. **Wrong timing, even where it runs.** The failing library code often runs when
   the module is imported or the provider first renders, before or apart from any
   instrumentation hook.
3. **The usual guard skips it anyway.** A normal polyfill says
   `if (typeof globalThis.localStorage === "undefined") { … }`. On Node 25 the
   global is defined, so a "correct" polyfill does nothing.

The polyfill is fine. It just runs in the wrong place. The problem comes from how
the Node runtime is set up, so the fix has to be a runtime setting that every
process inherits.

## What fixes it

Set it with `NODE_OPTIONS`. Child processes, including Next's build workers,
inherit that environment variable, so each worker starts up correctly. Pick one:

```bash
# Option A: turn Node's Web Storage off. `localStorage` goes back to undefined,
# and the libraries' `typeof` checks work again.
NODE_OPTIONS="--no-experimental-webstorage" NEXT_PUBLIC_IPFS_BUILD=true yarn build

# Option B: give Node a backing file so `localStorage` is a real, working Storage.
NODE_OPTIONS="--localstorage-file=.node-localstorage" NEXT_PUBLIC_IPFS_BUILD=true yarn build
```

Option A is usually the better fit for a static export: prerender should behave like
"no browser storage". Option B also works, but server rendering then reads and writes
a real file, which a browser-only app doesn't need. If you use it, add
`.node-localstorage` to `.gitignore`.

Put it in CI (and/or the `build` script in `packages/nextjs/package.json`) so it
applies every time:

```yaml
env:
  NODE_OPTIONS: --no-experimental-webstorage
```

If `NODE_OPTIONS` is already set (e.g. `--max-old-space-size`), add to it instead of
overwriting it. A stopgap is to pin CI to Node 24 LTS, which doesn't have this
behavior. But the flag fixes the actual cause, and you'd hit the same problem again
on your next Node upgrade.

After the fix, check the result, not just the exit code: `rm -rf .next out`, rebuild,
and confirm `out/*/index.html` exists for every route.
