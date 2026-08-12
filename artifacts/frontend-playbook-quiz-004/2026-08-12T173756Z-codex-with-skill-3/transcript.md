OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019ff70d-6499-7f23-bbaf-58dc27ff5271
--------
user
CI moved onto Node 25 and our Scaffold-ETH 2 static export broke.
`yarn build` now dies during prerender:

    TypeError: localStorage.getItem is not a function
    Error occurred prerendering page "/_not-found"

Teammate A says the error is impossible — Node has no localStorage, so
there is nothing to call getItem on. Teammate B wrote a correct
localStorage polyfill and registered it in instrumentation.ts, and the
build still fails identically. Explain what actually changed in recent
Node versions, why A's mental model is out of date, why B's fix cannot
work no matter how correct the polyfill is (where does the prerender
actually run?), and what does fix it. Write your answer to answer.md
in this directory.
2026-08-12T17:37:58.146484Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019ff70d-6499-7f23-bbaf-58dc27ff5271.tmp-1786556277934432988: line 2547: syntax error near unexpected token `('

codex
I’m using the frontend-playbook skill because this is a Scaffold-ETH 2 build/prerender failure and its deployment guidance directly applies.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/frontend-playbook/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: frontend-playbook
description: Ship Scaffold-ETH 2 dApps from scaffold through fork integration and static production deployment. Use when starting an SE2-compatible Ethereum app, testing it against deployed chain state, or deploying and verifying an SE2 frontend on IPFS.
---

# Frontend Playbook

Follow this workflow; do not treat a green build or successful upload as proof that the intended app shipped.

## Start with the requested stack

When the user wants Scaffold-ETH 2 or has not selected a stack for a conventional contract-plus-frontend dApp, use its generator:

```bash
npx create-eth@2.0.23 # Tested version; update deliberately
```

Use the generated Foundry/Next.js monorepo, wallet integration, contract hooks, and components. Respect an explicitly requested alternative stack.

## Choose the local chain deliberately

- Use `yarn chain` for isolated contracts, mocks, and unit tests.
- Use `yarn fork --network <chain>` when behavior depends on deployed protocols, tokens, balances, or other real chain state.
- In fork mode, point the frontend at the local Anvil network (`chains.foundry`, chain ID 31337), not the upstream chain being copied. Switch to the real target chain only for a real deployment.

Anvil normally mines only when a transaction arrives, so between transactions the latest block and `block.timestamp` remain frozen; the next transaction advances time in one jump. This silently breaks live deadlines, expiry, and vesting displays even when `vm.warp` unit tests pass. For continuous behavior, enable interval mining:

```bash
cast rpc anvil_setIntervalMining 1
```

Manual mining or time manipulation is valid for a controlled one-step test; use interval mining for continuous behavior. Add `--block-time 1` to the fork script when the project should always run that way.

## Build a static IPFS release

Configure the IPFS build for static export, route directories, and static images:

```typescript
if (process.env.NEXT_PUBLIC_IPFS_BUILD === "true") {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = { unoptimized: true };
}
```

Set the production origin before building so Open Graph URLs and images do not resolve to localhost. Then remove old artifacts and rebuild:

```bash
cd packages/nextjs
rm -rf .next out
NEXT_PUBLIC_PRODUCTION_URL="https://<production-domain>" \
  NEXT_PUBLIC_IPFS_BUILD=true \
  yarn build
```

On Node 25, the built-in `localStorage` global can exist without the standard Web Storage methods when no backing file is configured; libraries detect it and crash on calls such as `getItem()` during static prerender. Apply a process-level remedy inherited by build workers, not only code in `instrumentation.ts` or `next.config.ts`. Depending on the app, use one of:

```bash
NODE_OPTIONS="--localstorage-file=.node-localstorage"
NODE_OPTIONS="--no-experimental-webstorage"
```

## Verify before and after upload

Before uploading, verify the expected change and route files exist in `out/`, and confirm generated metadata contains the production origin. After uploading:

1. Record the CID. An unchanged CID means the uploaded bytes are identical; check the build output and upload target before blaming gateway caching.
2. Load the root and at least one non-home route through the gateway. Root success does not prove exported routes resolve.
3. Verify the Open Graph image and URL use the production origin.
4. For ENS, update the content hash only after the deployed CID has been reviewed and approved, then confirm the resolver and public gateway serve that CID.

Do not claim the release is complete until these checks pass.

codex
The key distinction is process scope: the failure happens in Next’s separate static-prerender worker, so an in-process shim registered by the coordinating build process cannot reach it. I’m checking the exact Node flags before writing the answer.
web search: 
web search: site:nodejs.org/api globals localStorage --localstorage-file --no-experimental-webstorage Node 25
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cf844d4d7231a083f2a51b1967feb7a9c8857efd
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,50 @@
+# Why Node 25 broke the static export
+
+This is a real Node 25 compatibility change, not evidence that the application created a malformed polyfill.
+
+Node added a Web Storage implementation in Node 22.4. In Node 25, Web Storage is enabled by default rather than requiring `--experimental-webstorage`. There is an important edge case: if Node is started without `--localstorage-file`, reading the `localStorage` global returns an empty object. Consequently, both of these can be true:
+
+```ts
+typeof localStorage !== "undefined"; // true
+typeof localStorage.getItem;         // "undefined"
+```
+
+That is exactly how `localStorage.getItem is not a function` can occur. Teammate A's older mental model—server-side Node has no `localStorage`—was valid before Node exposed this browser-like global, but it is no longer valid on Node 25. It also explains why browser-oriented dependencies now take a different branch during prerender: a presence check succeeds, the dependency assumes it has a conforming Storage object, and its subsequent `getItem()` call fails. Node documents both the Node 25 default enablement and the empty-object behavior when no backing file is configured in its [global `localStorage` documentation](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage).
+
+## Why `instrumentation.ts` does not fix the build
+
+The JavaScript process that runs the instrumentation hook is not the process in which every page is statically rendered. Next's build coordinator delegates static generation/prerendering—including the generated `/_not-found` route—to separate worker processes. A mutation such as
+
+```ts
+globalThis.localStorage = polyfill;
+```
+
+changes only the current process's JavaScript global. A subsequently spawned worker inherits environment variables and Node command-line options, but it does **not** inherit the parent's JavaScript heap or mutations to `globalThis`. The prerender worker therefore starts Node 25 afresh, sees Node's empty built-in `localStorage` object, imports the dependency, and fails in exactly the same way. The correctness of B's polyfill is irrelevant because it is installed in the wrong process. The same process-boundary problem applies to trying to patch the global from `next.config.ts`.
+
+## The fix
+
+Apply the remedy at process startup so that it is inherited by all of Next's build workers. There are two valid choices:
+
+```bash
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+This restores the traditional server-side behavior: `localStorage` is absent, so well-behaved libraries take their SSR/non-browser path. This is generally the cleaner option for static prerendering.
+
+Alternatively, give Node's implementation a backing file so it creates a functional Storage object:
+
+```bash
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+For an Scaffold-ETH 2 static/IPFS export, for example:
+
+```bash
+cd packages/nextjs
+rm -rf .next out
+NEXT_PUBLIC_IPFS_BUILD=true \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Set the chosen `NODE_OPTIONS` value in CI (or in the build script), not in application runtime code. Pinning CI to an older supported Node release can be a temporary workaround, but the direct fix on Node 25 is to disable Web Storage or configure its backing file at process launch.

diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..cf844d4d7231a083f2a51b1967feb7a9c8857efd
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,50 @@
+# Why Node 25 broke the static export
+
+This is a real Node 25 compatibility change, not evidence that the application created a malformed polyfill.
+
+Node added a Web Storage implementation in Node 22.4. In Node 25, Web Storage is enabled by default rather than requiring `--experimental-webstorage`. There is an important edge case: if Node is started without `--localstorage-file`, reading the `localStorage` global returns an empty object. Consequently, both of these can be true:
+
+```ts
+typeof localStorage !== "undefined"; // true
+typeof localStorage.getItem;         // "undefined"
+```
+
+That is exactly how `localStorage.getItem is not a function` can occur. Teammate A's older mental model—server-side Node has no `localStorage`—was valid before Node exposed this browser-like global, but it is no longer valid on Node 25. It also explains why browser-oriented dependencies now take a different branch during prerender: a presence check succeeds, the dependency assumes it has a conforming Storage object, and its subsequent `getItem()` call fails. Node documents both the Node 25 default enablement and the empty-object behavior when no backing file is configured in its [global `localStorage` documentation](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage).
+
+## Why `instrumentation.ts` does not fix the build
+
+The JavaScript process that runs the instrumentation hook is not the process in which every page is statically rendered. Next's build coordinator delegates static generation/prerendering—including the generated `/_not-found` route—to separate worker processes. A mutation such as
+
+```ts
+globalThis.localStorage = polyfill;
+```
+
+changes only the current process's JavaScript global. A subsequently spawned worker inherits environment variables and Node command-line options, but it does **not** inherit the parent's JavaScript heap or mutations to `globalThis`. The prerender worker therefore starts Node 25 afresh, sees Node's empty built-in `localStorage` object, imports the dependency, and fails in exactly the same way. The correctness of B's polyfill is irrelevant because it is installed in the wrong process. The same process-boundary problem applies to trying to patch the global from `next.config.ts`.
+
+## The fix
+
+Apply the remedy at process startup so that it is inherited by all of Next's build workers. There are two valid choices:
+
+```bash
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+This restores the traditional server-side behavior: `localStorage` is absent, so well-behaved libraries take their SSR/non-browser path. This is generally the cleaner option for static prerendering.
+
+Alternatively, give Node's implementation a backing file so it creates a functional Storage object:
+
+```bash
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+For an Scaffold-ETH 2 static/IPFS export, for example:
+
+```bash
+cd packages/nextjs
+rm -rf .next out
+NEXT_PUBLIC_IPFS_BUILD=true \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Set the chosen `NODE_OPTIONS` value in CI (or in the build script), not in application runtime code. Pinning CI to an older supported Node release can be a temporary workaround, but the direct fix on Node 25 is to disable Web Storage or configure its backing file at process launch.

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b0e9e7ddc2f0bf1347ae9508b94e97e2678f619c
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,50 @@
+# Why Node 25 broke the static export
+
+This is a real Node 25 compatibility change, not evidence that the application created a malformed polyfill.
+
+Node added a Web Storage implementation in Node 22.4. In Node 25, Web Storage is enabled by default rather than requiring `--experimental-webstorage`. There is an important edge case: if Node is started without `--localstorage-file`, reading the `localStorage` global returns an empty object. Consequently, both of these can be true:
+
+```ts
+typeof localStorage !== "undefined"; // true
+typeof localStorage.getItem;         // "undefined"
+```
+
+That is exactly how `localStorage.getItem is not a function` can occur. Teammate A's older mental model—server-side Node has no `localStorage`—was valid before Node exposed this browser-like global, but it is no longer valid on Node 25. It also explains why browser-oriented dependencies now take a different branch during prerender: a presence check succeeds, the dependency assumes it has a conforming Storage object, and its subsequent `getItem()` call fails. Node documents both the Node 25 default enablement and the empty-object behavior when no backing file is configured in its [global `localStorage` documentation](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage).
+
+## Why `instrumentation.ts` does not fix the build
+
+The JavaScript process that runs the instrumentation hook is not the process in which every page is statically rendered. Next's build coordinator delegates static generation/prerendering—including the generated `/_not-found` route—to separate worker processes. A mutation such as
+
+```ts
+globalThis.localStorage = polyfill;
+```
+
+changes only the current process's JavaScript global. A subsequently spawned worker inherits environment variables and Node command-line options, but it does **not** inherit the parent's JavaScript heap or mutations to `globalThis`. The prerender worker therefore starts Node 25 afresh, sees Node's empty built-in `localStorage` object, imports the dependency, and fails in exactly the same way. The correctness of B's polyfill is irrelevant because it is installed in the wrong process. The same process-boundary problem applies to trying to patch the global from `next.config.ts`.
+
+## The fix
+
+Apply the remedy at process startup so that it is inherited by all of Next's build workers. There are two valid choices:
+
+```bash
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+This restores the traditional server-side behavior: `localStorage` is absent, so well-behaved libraries take their SSR/non-browser path. This is generally the cleaner option for static prerendering.
+
+Alternatively, give Node's implementation a backing file so it creates a functional Storage object:
+
+```bash
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+For a Scaffold-ETH 2 static/IPFS export, for example:
+
+```bash
+cd packages/nextjs
+rm -rf .next out
+NEXT_PUBLIC_IPFS_BUILD=true \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Set the chosen `NODE_OPTIONS` value in CI (or in the build script), not in application runtime code. Pinning CI to an older supported Node release can be a temporary workaround, but the direct fix on Node 25 is to disable Web Storage or configure its backing file at process launch.

diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b0e9e7ddc2f0bf1347ae9508b94e97e2678f619c
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,50 @@
+# Why Node 25 broke the static export
+
+This is a real Node 25 compatibility change, not evidence that the application created a malformed polyfill.
+
+Node added a Web Storage implementation in Node 22.4. In Node 25, Web Storage is enabled by default rather than requiring `--experimental-webstorage`. There is an important edge case: if Node is started without `--localstorage-file`, reading the `localStorage` global returns an empty object. Consequently, both of these can be true:
+
+```ts
+typeof localStorage !== "undefined"; // true
+typeof localStorage.getItem;         // "undefined"
+```
+
+That is exactly how `localStorage.getItem is not a function` can occur. Teammate A's older mental model—server-side Node has no `localStorage`—was valid before Node exposed this browser-like global, but it is no longer valid on Node 25. It also explains why browser-oriented dependencies now take a different branch during prerender: a presence check succeeds, the dependency assumes it has a conforming Storage object, and its subsequent `getItem()` call fails. Node documents both the Node 25 default enablement and the empty-object behavior when no backing file is configured in its [global `localStorage` documentation](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage).
+
+## Why `instrumentation.ts` does not fix the build
+
+The JavaScript process that runs the instrumentation hook is not the process in which every page is statically rendered. Next's build coordinator delegates static generation/prerendering—including the generated `/_not-found` route—to separate worker processes. A mutation such as
+
+```ts
+globalThis.localStorage = polyfill;
+```
+
+changes only the current process's JavaScript global. A subsequently spawned worker inherits environment variables and Node command-line options, but it does **not** inherit the parent's JavaScript heap or mutations to `globalThis`. The prerender worker therefore starts Node 25 afresh, sees Node's empty built-in `localStorage` object, imports the dependency, and fails in exactly the same way. The correctness of B's polyfill is irrelevant because it is installed in the wrong process. The same process-boundary problem applies to trying to patch the global from `next.config.ts`.
+
+## The fix
+
+Apply the remedy at process startup so that it is inherited by all of Next's build workers. There are two valid choices:
+
+```bash
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+This restores the traditional server-side behavior: `localStorage` is absent, so well-behaved libraries take their SSR/non-browser path. This is generally the cleaner option for static prerendering.
+
+Alternatively, give Node's implementation a backing file so it creates a functional Storage object:
+
+```bash
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+For a Scaffold-ETH 2 static/IPFS export, for example:
+
+```bash
+cd packages/nextjs
+rm -rf .next out
+NEXT_PUBLIC_IPFS_BUILD=true \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Set the chosen `NODE_OPTIONS` value in CI (or in the build script), not in application runtime code. Pinning CI to an older supported Node release can be a temporary workaround, but the direct fix on Node 25 is to disable Web Storage or configure its backing file at process launch.

codex
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md) explaining the Node 25 Web Storage change, Next.js prerender worker boundary, and both process-level fixes.
diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..b0e9e7ddc2f0bf1347ae9508b94e97e2678f619c
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,50 @@
+# Why Node 25 broke the static export
+
+This is a real Node 25 compatibility change, not evidence that the application created a malformed polyfill.
+
+Node added a Web Storage implementation in Node 22.4. In Node 25, Web Storage is enabled by default rather than requiring `--experimental-webstorage`. There is an important edge case: if Node is started without `--localstorage-file`, reading the `localStorage` global returns an empty object. Consequently, both of these can be true:
+
+```ts
+typeof localStorage !== "undefined"; // true
+typeof localStorage.getItem;         // "undefined"
+```
+
+That is exactly how `localStorage.getItem is not a function` can occur. Teammate A's older mental model—server-side Node has no `localStorage`—was valid before Node exposed this browser-like global, but it is no longer valid on Node 25. It also explains why browser-oriented dependencies now take a different branch during prerender: a presence check succeeds, the dependency assumes it has a conforming Storage object, and its subsequent `getItem()` call fails. Node documents both the Node 25 default enablement and the empty-object behavior when no backing file is configured in its [global `localStorage` documentation](https://nodejs.org/dist/latest/docs/api/globals.html#localstorage).
+
+## Why `instrumentation.ts` does not fix the build
+
+The JavaScript process that runs the instrumentation hook is not the process in which every page is statically rendered. Next's build coordinator delegates static generation/prerendering—including the generated `/_not-found` route—to separate worker processes. A mutation such as
+
+```ts
+globalThis.localStorage = polyfill;
+```
+
+changes only the current process's JavaScript global. A subsequently spawned worker inherits environment variables and Node command-line options, but it does **not** inherit the parent's JavaScript heap or mutations to `globalThis`. The prerender worker therefore starts Node 25 afresh, sees Node's empty built-in `localStorage` object, imports the dependency, and fails in exactly the same way. The correctness of B's polyfill is irrelevant because it is installed in the wrong process. The same process-boundary problem applies to trying to patch the global from `next.config.ts`.
+
+## The fix
+
+Apply the remedy at process startup so that it is inherited by all of Next's build workers. There are two valid choices:
+
+```bash
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+This restores the traditional server-side behavior: `localStorage` is absent, so well-behaved libraries take their SSR/non-browser path. This is generally the cleaner option for static prerendering.
+
+Alternatively, give Node's implementation a backing file so it creates a functional Storage object:
+
+```bash
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+For a Scaffold-ETH 2 static/IPFS export, for example:
+
+```bash
+cd packages/nextjs
+rm -rf .next out
+NEXT_PUBLIC_IPFS_BUILD=true \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Set the chosen `NODE_OPTIONS` value in CI (or in the build script), not in application runtime code. Pinning CI to an older supported Node release can be a temporary workaround, but the direct fix on Node 25 is to disable Web Storage or configure its backing file at process launch.

tokens used
19,625
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173756Z-codex-with-skill-3/workspace/answer.md) explaining the Node 25 Web Storage change, Next.js prerender worker boundary, and both process-level fixes.
