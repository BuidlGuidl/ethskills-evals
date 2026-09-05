OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019ff70b-d083-78f3-b93e-ec9b57bdd20b
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
2026-08-12T17:36:14.681244Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019ff70b-d083-78f3-b93e-ec9b57bdd20b.tmp-1786556174477555007: line 2547: syntax error near unexpected token `('

codex
I’m using the frontend-playbook skill because this is specifically an SE2 static-build/prerender failure. I’ll inspect its guidance, then write the requested explanation to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/frontend-playbook/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace
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
The key distinction is process scope: Node 25 exposes a detectable `localStorage` global, while Next’s static prerender executes in a separate build worker. I’m capturing both the cause and the two process-level remedies in the answer.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ffda39bc9cd80cc45839db215c44b259610c209c
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,56 @@
+# Why the Node 25 static export fails
+
+Teammate A's model was true for older Node releases: `localStorage` was normally an
+undeclared browser-only global, so server-side feature detection such as
+`typeof localStorage !== "undefined"` returned false.
+
+Recent Node versions added an experimental Web Storage implementation. On Node 25,
+`globalThis.localStorage` can therefore exist even when Node was started without a
+storage backing file. In that configuration the exposed value may not provide the
+normal Web Storage methods. A dependency sees that `localStorage` exists, assumes it
+is browser-compatible, and calls `localStorage.getItem(...)`; the result is the
+counterintuitive `TypeError: localStorage.getItem is not a function`. The failing
+`/_not-found` route is merely where that dependency is evaluated during export, not
+evidence that the route itself uses storage.
+
+## Why `instrumentation.ts` does not fix it
+
+Next's build command does not do all of its work in the process/runtime where the
+application instrumentation hook runs. Static page generation and prerendering run
+in a separate Next build worker (a child process). That worker starts its own Node
+runtime and gets Node's problematic built-in global before application-level
+instrumentation in another runtime could replace it. Consequently, even a perfect
+polyfill registered in `instrumentation.ts` cannot repair the global in the process
+that is actually throwing. The same process-boundary issue makes assigning a shim
+from `next.config.ts` unreliable: mutating the build coordinator's global does not
+mutate a child worker's global.
+
+## The fix
+
+Configure Node itself at process startup so the setting is inherited by every Next
+build worker. Either give Node's Web Storage implementation a backing file:
+
+```sh
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+or disable Node's experimental Web Storage global so browser-oriented libraries
+take their normal server-side fallback path:
+
+```sh
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+For an SE2 static/IPFS build, apply the option to the same command that invokes the
+build, for example:
+
+```sh
+NEXT_PUBLIC_IPFS_BUILD=true \
+NEXT_PUBLIC_PRODUCTION_URL="https://example.org" \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Putting the chosen flag in the CI build environment or package script is the
+durable fix. `NODE_OPTIONS` is inherited by the prerender child process, which is
+the property the application-level polyfill lacks.

diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ffda39bc9cd80cc45839db215c44b259610c209c
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,56 @@
+# Why the Node 25 static export fails
+
+Teammate A's model was true for older Node releases: `localStorage` was normally an
+undeclared browser-only global, so server-side feature detection such as
+`typeof localStorage !== "undefined"` returned false.
+
+Recent Node versions added an experimental Web Storage implementation. On Node 25,
+`globalThis.localStorage` can therefore exist even when Node was started without a
+storage backing file. In that configuration the exposed value may not provide the
+normal Web Storage methods. A dependency sees that `localStorage` exists, assumes it
+is browser-compatible, and calls `localStorage.getItem(...)`; the result is the
+counterintuitive `TypeError: localStorage.getItem is not a function`. The failing
+`/_not-found` route is merely where that dependency is evaluated during export, not
+evidence that the route itself uses storage.
+
+## Why `instrumentation.ts` does not fix it
+
+Next's build command does not do all of its work in the process/runtime where the
+application instrumentation hook runs. Static page generation and prerendering run
+in a separate Next build worker (a child process). That worker starts its own Node
+runtime and gets Node's problematic built-in global before application-level
+instrumentation in another runtime could replace it. Consequently, even a perfect
+polyfill registered in `instrumentation.ts` cannot repair the global in the process
+that is actually throwing. The same process-boundary issue makes assigning a shim
+from `next.config.ts` unreliable: mutating the build coordinator's global does not
+mutate a child worker's global.
+
+## The fix
+
+Configure Node itself at process startup so the setting is inherited by every Next
+build worker. Either give Node's Web Storage implementation a backing file:
+
+```sh
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+or disable Node's experimental Web Storage global so browser-oriented libraries
+take their normal server-side fallback path:
+
+```sh
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+For an SE2 static/IPFS build, apply the option to the same command that invokes the
+build, for example:
+
+```sh
+NEXT_PUBLIC_IPFS_BUILD=true \
+NEXT_PUBLIC_PRODUCTION_URL="https://example.org" \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Putting the chosen flag in the CI build environment or package script is the
+durable fix. `NODE_OPTIONS` is inherited by the prerender child process, which is
+the property the application-level polyfill lacks.

exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace
 succeeded in 2ms:
# Why the Node 25 static export fails

Teammate A's model was true for older Node releases: `localStorage` was normally an
undeclared browser-only global, so server-side feature detection such as
`typeof localStorage !== "undefined"` returned false.

Recent Node versions added an experimental Web Storage implementation. On Node 25,
`globalThis.localStorage` can therefore exist even when Node was started without a
storage backing file. In that configuration the exposed value may not provide the
normal Web Storage methods. A dependency sees that `localStorage` exists, assumes it
is browser-compatible, and calls `localStorage.getItem(...)`; the result is the
counterintuitive `TypeError: localStorage.getItem is not a function`. The failing
`/_not-found` route is merely where that dependency is evaluated during export, not
evidence that the route itself uses storage.

## Why `instrumentation.ts` does not fix it

Next's build command does not do all of its work in the process/runtime where the
application instrumentation hook runs. Static page generation and prerendering run
in a separate Next build worker (a child process). That worker starts its own Node
runtime and gets Node's problematic built-in global before application-level
instrumentation in another runtime could replace it. Consequently, even a perfect
polyfill registered in `instrumentation.ts` cannot repair the global in the process
that is actually throwing. The same process-boundary issue makes assigning a shim
from `next.config.ts` unreliable: mutating the build coordinator's global does not
mutate a child worker's global.

## The fix

Configure Node itself at process startup so the setting is inherited by every Next
build worker. Either give Node's Web Storage implementation a backing file:

```sh
NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
```

or disable Node's experimental Web Storage global so browser-oriented libraries
take their normal server-side fallback path:

```sh
NODE_OPTIONS="--no-experimental-webstorage" yarn build
```

For an SE2 static/IPFS build, apply the option to the same command that invokes the
build, for example:

```sh
NEXT_PUBLIC_IPFS_BUILD=true \
NEXT_PUBLIC_PRODUCTION_URL="https://example.org" \
NODE_OPTIONS="--no-experimental-webstorage" \
yarn build
```

Putting the chosen flag in the CI build environment or package script is the
durable fix. `NODE_OPTIONS` is inherited by the prerender child process, which is
the property the application-level polyfill lacks.

diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ffda39bc9cd80cc45839db215c44b259610c209c
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,56 @@
+# Why the Node 25 static export fails
+
+Teammate A's model was true for older Node releases: `localStorage` was normally an
+undeclared browser-only global, so server-side feature detection such as
+`typeof localStorage !== "undefined"` returned false.
+
+Recent Node versions added an experimental Web Storage implementation. On Node 25,
+`globalThis.localStorage` can therefore exist even when Node was started without a
+storage backing file. In that configuration the exposed value may not provide the
+normal Web Storage methods. A dependency sees that `localStorage` exists, assumes it
+is browser-compatible, and calls `localStorage.getItem(...)`; the result is the
+counterintuitive `TypeError: localStorage.getItem is not a function`. The failing
+`/_not-found` route is merely where that dependency is evaluated during export, not
+evidence that the route itself uses storage.
+
+## Why `instrumentation.ts` does not fix it
+
+Next's build command does not do all of its work in the process/runtime where the
+application instrumentation hook runs. Static page generation and prerendering run
+in a separate Next build worker (a child process). That worker starts its own Node
+runtime and gets Node's problematic built-in global before application-level
+instrumentation in another runtime could replace it. Consequently, even a perfect
+polyfill registered in `instrumentation.ts` cannot repair the global in the process
+that is actually throwing. The same process-boundary issue makes assigning a shim
+from `next.config.ts` unreliable: mutating the build coordinator's global does not
+mutate a child worker's global.
+
+## The fix
+
+Configure Node itself at process startup so the setting is inherited by every Next
+build worker. Either give Node's Web Storage implementation a backing file:
+
+```sh
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+or disable Node's experimental Web Storage global so browser-oriented libraries
+take their normal server-side fallback path:
+
+```sh
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+For an SE2 static/IPFS build, apply the option to the same command that invokes the
+build, for example:
+
+```sh
+NEXT_PUBLIC_IPFS_BUILD=true \
+NEXT_PUBLIC_PRODUCTION_URL="https://example.org" \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Putting the chosen flag in the CI build environment or package script is the
+durable fix. `NODE_OPTIONS` is inherited by the prerender child process, which is
+the property the application-level polyfill lacks.

codex
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md) explaining the Node 25 Web Storage change, Next.js prerender worker boundary, and both `NODE_OPTIONS` fixes.
diff --git a/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..ffda39bc9cd80cc45839db215c44b259610c209c
--- /dev/null
+++ b/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,56 @@
+# Why the Node 25 static export fails
+
+Teammate A's model was true for older Node releases: `localStorage` was normally an
+undeclared browser-only global, so server-side feature detection such as
+`typeof localStorage !== "undefined"` returned false.
+
+Recent Node versions added an experimental Web Storage implementation. On Node 25,
+`globalThis.localStorage` can therefore exist even when Node was started without a
+storage backing file. In that configuration the exposed value may not provide the
+normal Web Storage methods. A dependency sees that `localStorage` exists, assumes it
+is browser-compatible, and calls `localStorage.getItem(...)`; the result is the
+counterintuitive `TypeError: localStorage.getItem is not a function`. The failing
+`/_not-found` route is merely where that dependency is evaluated during export, not
+evidence that the route itself uses storage.
+
+## Why `instrumentation.ts` does not fix it
+
+Next's build command does not do all of its work in the process/runtime where the
+application instrumentation hook runs. Static page generation and prerendering run
+in a separate Next build worker (a child process). That worker starts its own Node
+runtime and gets Node's problematic built-in global before application-level
+instrumentation in another runtime could replace it. Consequently, even a perfect
+polyfill registered in `instrumentation.ts` cannot repair the global in the process
+that is actually throwing. The same process-boundary issue makes assigning a shim
+from `next.config.ts` unreliable: mutating the build coordinator's global does not
+mutate a child worker's global.
+
+## The fix
+
+Configure Node itself at process startup so the setting is inherited by every Next
+build worker. Either give Node's Web Storage implementation a backing file:
+
+```sh
+NODE_OPTIONS="--localstorage-file=.node-localstorage" yarn build
+```
+
+or disable Node's experimental Web Storage global so browser-oriented libraries
+take their normal server-side fallback path:
+
+```sh
+NODE_OPTIONS="--no-experimental-webstorage" yarn build
+```
+
+For an SE2 static/IPFS build, apply the option to the same command that invokes the
+build, for example:
+
+```sh
+NEXT_PUBLIC_IPFS_BUILD=true \
+NEXT_PUBLIC_PRODUCTION_URL="https://example.org" \
+NODE_OPTIONS="--no-experimental-webstorage" \
+yarn build
+```
+
+Putting the chosen flag in the CI build environment or package script is the
+durable fix. `NODE_OPTIONS` is inherited by the prerender child process, which is
+the property the application-level polyfill lacks.

tokens used
20,036
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/frontend-playbook-quiz-004/2026-08-12T173614Z-codex-with-skill-1/workspace/answer.md) explaining the Node 25 Web Storage change, Next.js prerender worker boundary, and both `NODE_OPTIONS` fixes.
