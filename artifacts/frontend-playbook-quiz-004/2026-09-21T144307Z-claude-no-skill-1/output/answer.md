# Node 25 broke the SE-2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22 added the browser Web Storage API (`localStorage`, `sessionStorage`) behind `--experimental-webstorage`.
- **Node 25 turned it on by default.** `localStorage` is now a getter on `globalThis`.
- If you don't pass `--localstorage-file=<path>`, Node has nowhere to store data. The getter prints a warning and returns an **empty object with no methods**.

Checked on Node v25.9.0:

```
$ node -e 'console.log(typeof localStorage, typeof localStorage.getItem)'
object undefined
(node:…) Warning: `--localstorage-file` was provided without a valid path
```

So `localStorage` exists, but `localStorage.getItem` is `undefined`. Calling it throws exactly `TypeError: localStorage.getItem is not a function`.

## Why Teammate A's view is out of date

"Node has no localStorage" was true up to Node 24 (unless you turned on the flag). Many libraries rely on it to tell server from browser:

```js
if (typeof localStorage !== "undefined") localStorage.getItem(key)
```

On Node ≤24 that check is false on the server, so the code skips it. On Node 25 it's true, because the object exists but is empty. The code then calls `getItem` and crashes.

In SE-2 this happens in the wagmi/RainbowKit storage setup, `useLocalStorage`-style hooks, and theme code. They run while the root layout renders, which is why even `/_not-found` fails. The error isn't impossible. The check stopped working.

## Why Teammate B's polyfill can't work

1. **`instrumentation.ts` doesn't run where prerender runs.** Next.js calls `register()` when a **server runtime starts** (`next start`, `next dev`, the edge runtime). `next build` with `output: "export"` never starts a server. Static generation runs inside **separate build worker processes** that Next spawns. Each worker has its own `globalThis`, and that `globalThis` already has Node's broken `localStorage`. B's code either never runs during the build, or runs in a different process from the one rendering the page. The polyfill can be perfect and still never reach the code that crashes.
2. **Timing and module scope.** Even if you got it into the worker, much of the failing code reads `localStorage` when the module loads, or grabs it as it's bundled. A patch that runs later misses it.

Setting a global doesn't carry across processes. Only something every Node process picks up at startup does, like a CLI flag through `NODE_OPTIONS`, or a different Node version.

## What fixes it

Pick one. The first is the smallest change:

1. **Turn off Node's Web Storage for the build.** Child processes inherit environment variables, so every prerender worker gets the flag:
   ```jsonc
   // packages/nextjs/package.json
   "build": "NODE_OPTIONS=--no-experimental-webstorage next build"
   ```
   (or set `NODE_OPTIONS=--no-experimental-webstorage` in the CI job env). With the flag, `typeof localStorage === "undefined"` again:
   ```
   $ NODE_OPTIONS=--no-experimental-webstorage node -e 'console.log(typeof localStorage)'
   undefined
   ```
2. **Pin CI to an LTS Node (22 or 24)** via `actions/setup-node` `node-version`, `.nvmrc`, and `engines`. This is a good idea anyway: Node 25 is an odd-numbered release with no long-term support.
3. **Longer term, fix the checks** in your own code: check `typeof window !== "undefined"` (or run it only in the browser, inside `useEffect`) instead of `typeof localStorage`. Also upgrade Next.js, wagmi and RainbowKit to versions that handle Node 25.

Don't use `--localstorage-file=<path>` as the fix. It gives the server a real `localStorage` that writes to disk and persists between builds. That's shared state leaking into static pages, which is worse than "undefined".

Delete B's polyfill in `instrumentation.ts`. It does nothing for the export build.
