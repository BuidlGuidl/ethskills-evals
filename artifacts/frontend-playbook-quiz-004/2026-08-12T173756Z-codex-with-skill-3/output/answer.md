# Why Node 25 broke the static export

This is a real Node 25 compatibility change, not evidence that the application created a malformed polyfill.

Node added a Web Storage implementation in Node 22.4. In Node 25, Web Storage is enabled by default rather than requiring `--experimental-webstorage`. There is an important edge case: if Node is started without `--localstorage-file`, reading the `localStorage` global returns an empty object. Consequently, both of these can be true:

```ts
typeof localStorage !== "undefined"; // true
typeof localStorage.getItem;         // "undefined"
```

That is exactly how `localStorage.getItem is not a function` can occur. Teammate A's older mental model—server-side Node has no `localStorage`—was valid before Node exposed this browser-like global, but it is no longer valid on Node 25. It also explains why browser-oriented dependencies now take a different branch during prerender: a presence check succeeds, the dependency assumes it has a conforming Storage object, and its subsequent `getItem()` call fails. Node documents both the Node 25 default enablement and the empty-object behavior when no backing file is configured in its [global `localStorage` documentation](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage).

## Why `instrumentation.ts` does not fix the build

The JavaScript process that runs the instrumentation hook is not the process in which every page is statically rendered. Next's build coordinator delegates static generation/prerendering—including the generated `/_not-found` route—to separate worker processes. A mutation such as

```ts
globalThis.localStorage = polyfill;
```

changes only the current process's JavaScript global. A subsequently spawned worker inherits environment variables and Node command-line options, but it does **not** inherit the parent's JavaScript heap or mutations to `globalThis`. The prerender worker therefore starts Node 25 afresh, sees Node's empty built-in `localStorage` object, imports the dependency, and fails in exactly the same way. The correctness of B's polyfill is irrelevant because it is installed in the wrong process. The same process-boundary problem applies to trying to patch the global from `next.config.ts`.

## The fix

Apply the remedy at process startup so that it is inherited by all of Next's build workers. There are two valid choices:

```bash
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

This restores the traditional server-side behavior: `localStorage` is absent, so well-behaved libraries take their SSR/non-browser path. This is generally the cleaner option for static prerendering.

Alternatively, give Node's implementation a backing file so it creates a functional Storage object:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

For a Scaffold-ETH 2 static/IPFS export, for example:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_IPFS_BUILD=true \
NODE_OPTIONS="--no-experimental-webstorage" \
yarn build
```

Set the chosen `NODE_OPTIONS` value in CI (or in the build script), not in application runtime code. Pinning CI to an older supported Node release can be a temporary workaround, but the direct fix on Node 25 is to disable Web Storage or configure its backing file at process launch.
