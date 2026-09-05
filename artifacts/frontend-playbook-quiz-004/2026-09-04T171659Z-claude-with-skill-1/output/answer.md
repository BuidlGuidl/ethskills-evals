# `TypeError: localStorage.getItem is not a function` during Next.js prerender on Node 25

Short version: both teammates are reasoning about the wrong process. Node *does* have a
`localStorage` global now, but on a default Node 25 build it is not a usable `Storage`
object — and the prerender that crashes does not run in the process where
`instrumentation.ts` executes. The fix is a process-level Node flag exported through
`NODE_OPTIONS` before the build starts, so every worker Node spawns inherits it.

---

## 1. What actually changed in Node

Node picked up the Web Storage API (`localStorage` / `sessionStorage`) as an experimental
global, and in the current releases that global is present by default rather than hidden
behind an opt-in flag. That is the whole change, and it is enough to break code that was
correct for a decade.

The important detail is that the global is only half a `Storage`. `localStorage` in Node is
backed by an on-disk file, specified with `--localstorage-file=<path>`. With no backing file
configured, you still get *something* on `globalThis.localStorage` — but not an object
carrying the standard `getItem` / `setItem` / `removeItem` methods.

So on Node 25, with no flags:

```js
typeof localStorage            // "object"   <- used to be "undefined"
typeof localStorage.getItem    // "undefined" <- and this is the bug
```

Every library that persists wallet/connector state — wagmi, RainbowKit/ConnectKit,
WalletConnect, and the Scaffold-ETH 2 store wired on top of them — feature-detects storage
roughly like this:

```js
const storage =
  typeof localStorage !== "undefined" ? localStorage : memoryFallback;
```

For ten years that test meant "am I in a browser?". On Node 25 it answers **yes** inside the
build. The library skips its in-memory fallback, takes the browser branch, and calls
`storage.getItem(...)`. That call is what throws.

It fails on `/_not-found` for the least interesting possible reason: that page is a fully
static route Next.js always prerenders, and it still pulls in the root layout, so it drags
the whole wagmi/RainbowKit provider tree through module evaluation. It is simply the first
page to touch the poisoned global, not a page with a special problem.

## 2. Why Teammate A's model is out of date

A's rule — "Node has no `localStorage`, so this error is impossible" — was correct through
Node 20 and is now false. Under that old model the only reachable failure was:

```
ReferenceError: localStorage is not defined
```

…and the standard remedy was a `typeof window === "undefined"` guard.

The error message on the screen is itself the disproof. `localStorage.getItem` is a
*property access on a resolved object*. To even reach "is not a function", the runtime had to
look up `localStorage`, find a real value, and then look up `.getItem` on it. If A were
right, the engine would never have gotten that far — it would have thrown a `ReferenceError`
at the identifier. A `TypeError` on the member is positive evidence that the global exists.

The practical consequence: **existence checks for `localStorage` are no longer a browser
check.** `typeof localStorage !== "undefined"`, `if (globalThis.localStorage)`, and
`"localStorage" in globalThis` are all true-but-useless inside a Node build now. Only
`typeof window === "undefined"` still means what people think it means. That is why upgrading
CI to Node 25 broke a build whose application code did not change at all: the semantics of a
check buried in your dependencies changed underneath you.

## 3. Why Teammate B's polyfill cannot work — where the prerender actually runs

B's polyfill may be flawless. It is executing in the wrong process, and probably also at the
wrong time. Three independent reasons, any one of which is fatal:

**a) `next build` prerenders in forked child processes.** The `yarn build` you launch is a
coordinator. Static generation and export are fanned out to a pool of *separate Node worker
processes* that Next.js forks for parallelism. Each fork is a fresh V8 isolate with a fresh
global object. Anything you assign to `globalThis` in the parent — or in one worker — is
invisible to the workers that actually render your routes. The stack trace saying
"Error occurred prerendering page" is telling you the throw happened inside one of those
children.

**b) `instrumentation.ts` is the wrong hook for this phase.** `register()` is Next's *server
runtime* hook — it is designed for booting observability in the server that handles requests.
A `output: "export"` IPFS build has no such server; the pages are rendered and written to
`out/` at build time. Registering a global patch there aims it at a lifecycle the static
export barely uses.

**c) Even in the right process, module evaluation beats you to it.** The offending
`getItem()` runs while the connector/store module is being *imported*, at module top level,
as the page graph loads. Any patch that has to run as a step before that import is racing —
and losing to — the very import that crashes.

The strongest clue is one B already has: **the build fails *identically*.** Not differently,
not further along. A polyfill that had loaded and then proved insufficient would move or
change the error. An unchanged error means the code never ran in the failing context at all.

There is a fourth, subtler reason to stop patching from userland: Node's `localStorage` is a
built-in global installed by the runtime. Reassigning or shadowing a runtime-owned global is
fragile even where your code *does* run. Ask Node not to create the broken global, rather
than fighting it after the fact.

## 4. What actually fixes it

Set a Node flag through `NODE_OPTIONS` **before** the build process starts. `NODE_OPTIONS`
is read by every Node process at startup and is inherited through the environment by every
child Node forks — which is exactly the reach the problem requires and exactly the reach
`instrumentation.ts` lacks. Pick one of the two:

```bash
cd packages/nextjs
rm -rf .next out

# Option 1 (recommended for a static export): remove the global entirely.
NODE_OPTIONS="--no-experimental-webstorage" \
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build

# Option 2: keep the global, but give it a real backing file so the methods exist.
NODE_OPTIONS="--localstorage-file=.node-localstorage" \
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

**Which one.** Prefer `--no-experimental-webstorage`. It restores the world Teammate A
remembers: `typeof localStorage === "undefined"` in Node, every dependency's feature detect
answers "not a browser" and takes its in-memory/no-op path, and the prerendered HTML contains
no server-side persisted wallet state — which is what you want, since that HTML is about to
be pinned to IPFS and served to every visitor. Reach for `--localstorage-file` only if some
dependency hard-requires a functioning `Storage` object at import time and does not degrade;
if you use it, add `.node-localstorage` to `.gitignore` and delete it alongside `.next`/`out`
between builds so build-time state cannot leak into a release.

**Where to put it.** Set it in CI's environment, or bake it into the build script so local
and CI builds agree:

```json
"scripts": {
  "build": "NODE_OPTIONS=--no-experimental-webstorage next build"
}
```

Do **not** try to set `NODE_OPTIONS` in `.env` / `.env.local`. Next.js loads those files
*after* the Node process is already running; flags that change how the runtime boots must be
in the environment before `node` starts.

**Optional hardening in code you own.** The flag is the fix because you cannot edit your
dependencies. In your own Scaffold-ETH components and hooks, stop using `localStorage` as the
browser test — gate on `typeof window === "undefined"`, and pass wagmi an explicit storage
(`cookieStorage`, or `noopStorage` on the server) via `createStorage` instead of letting it
sniff for a global. That keeps this class of breakage from returning when the next runtime
grows another browser API.

## 5. Confirm the build is actually fixed, not just green

A passing `yarn build` is not proof the release is right. Before uploading:

```bash
ls out/*/index.html   # one directory with an index.html per route
```

Check that every expected route emitted its own directory (with `trailingSlash: true`), that
the change you meant to ship is present in `out/`, and that generated metadata carries the
production origin rather than `localhost`. After uploading, record the CID, then load the root
**and** at least one non-home route through the gateway — root success does not prove exported
routes resolve:

```bash
curl -s -o /dev/null -w "%{http_code}" -L "https://<gateway>/ipfs/<cid>/debug/"  # expect 200
```

An unchanged CID means the uploaded bytes are identical — check the build output and upload
target before blaming gateway caching. Update an ENS content hash only after the deployed CID
has been reviewed and approved.

---

### One-paragraph summary for the thread

Node now ships a `localStorage` global by default, but without `--localstorage-file` it has no
`getItem`/`setItem`. Every library that used `typeof localStorage !== "undefined"` as its
"am I in a browser?" check now gets a false yes during the build and calls a method that isn't
there — so A's "impossible" is out of date, and the `TypeError` (rather than a `ReferenceError`)
proves the global exists. B's polyfill is fine but unreachable: `next build` prerenders in
forked child processes with their own globals, and `instrumentation.ts` targets the server
runtime a static export doesn't use — the identical error message is the tell that it never
ran. Fix it at process level with `NODE_OPTIONS="--no-experimental-webstorage"` (or
`--localstorage-file=.node-localstorage`) set before the build, since `NODE_OPTIONS` is
inherited by every worker Node spawns.
