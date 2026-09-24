# Node 25 + SE-2 static export: `localStorage.getItem is not a function`

## What changed in Node

- Node 22 added the browser Web Storage API (`localStorage`, `sessionStorage`) as an **experimental, opt-in** feature behind `--experimental-webstorage`.
- **Node 25 turned it on by default.** Now `globalThis.localStorage` exists in every Node process unless you turn it off.
- A real, working `localStorage` needs a backing file: `--localstorage-file=<path>`. Without that flag (and CI doesn't pass it), Node 25 still defines the global, but what you get is **not a working Storage object**: it prints a warning and hands back an object with no usable `getItem`/`setItem`. So `localStorage` is truthy and `localStorage.getItem` is `undefined`, which gives exactly `TypeError: localStorage.getItem is not a function`.

## Why Teammate A's model is out of date

"Node has no localStorage" was true up to Node 24 (unless you passed the flag). A lot of browser-or-server checks depend on it:

```js
if (typeof localStorage !== "undefined") localStorage.getItem(key) // "we're in a browser"
```

On Node 25 that check passes on the server. The SE-2 wallet stack (wagmi's `createStorage`, RainbowKit, `usehooks-ts`'s `useLocalStorage`, burner-wallet/theme helpers, etc.) decides it's in a browser and calls `getItem` on the half-built global Node gave it. The error isn't impossible. It happens *because* Node now has a `localStorage` global. The old error would have been `localStorage is not defined`. The new one says the thing exists but isn't a function, and that's how you can tell this is the cause.

`/_not-found` fails first only because it's the first page prerendered. Every page is wrapped in the same providers (`ScaffoldEthAppWithProviders` → wagmi/RainbowKit), so any page would crash the same way.

## Why Teammate B's polyfill can't work, however correct it is

`instrumentation.ts` / `register()` is a **server startup hook**. Next.js calls it when a Next *server* boots (`next start`, `next dev`, or a serverless function cold start). It is not a "run this before any code in any process" hook.

The prerender doesn't run in a server. During `next build`, static generation (and with `output: "export"` that means every page, since there's no server at all afterward) runs in **separate worker processes** that the build spawns (Next's static-generation workers). Each worker is a new Node process with its own `globalThis`, and Node 25 sets up its own broken `localStorage` in each one. Your `register()` never runs in those workers, and even if it ran in the main build process, patching one process's globals does nothing to another's. So the polyfill is right but it runs in the wrong process, or not at all. The build fails the same way because the code that crashes never sees the patch.

(Patching it "earlier" in app code has the same problem, plus import order: wagmi/RainbowKit can read storage while modules are being loaded, before your patch runs.)

## What fixes it

Whatever you do has to reach **every Node process the build starts**. Environment variables are inherited by child processes, so use `NODE_OPTIONS`:

```jsonc
// packages/nextjs/package.json
"scripts": {
  "build": "NODE_OPTIONS=--no-experimental-webstorage next build"
}
```

or in CI:

```yaml
env:
  NODE_OPTIONS: --no-experimental-webstorage
```

This turns the Node 25 global off again. `typeof localStorage === "undefined"` on the server, the libraries go back to their SSR-safe path, and prerender works. (If `NODE_OPTIONS` already has other flags, add this one to the list. Use `cross-env` if the script has to run on Windows.)

Other options:

- **Pin CI to Node 22/24 LTS** (`.nvmrc`, `actions/setup-node` `node-version: 22`/`24`, `"engines"`). This works, but it puts off the problem instead of fixing it. Node 25 isn't LTS anyway, so pinning to LTS is reasonable for CI.
- **Don't** fix it with `--localstorage-file=...` for SSR. That gives you a working storage, but one file shared by every render and request on the server. That's wrong for per-user browser state and could leak data between users.
- **Longer term:** any of your own code that checks `typeof localStorage` / `typeof window.localStorage` should check `typeof window !== "undefined"`, or only read storage inside `useEffect`. Update wagmi/RainbowKit/usehooks-ts once their releases handle Node 25's global.

### Short version
Node 25 now defines `localStorage` by default, and without `--localstorage-file` that object has no working methods, so "is there a localStorage?" checks now pass on the server and then crash. `instrumentation.ts` runs at server startup, not in the `next build` prerender workers where the crash happens. Set `NODE_OPTIONS=--no-experimental-webstorage` for the build (or pin CI to LTS Node).
