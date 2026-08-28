OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 019ffc7b-e65a-77a2-a1dd-cc039a518581
--------
user
I have to get a full-stack Ethereum app in front of users by the end of the
week: one Solidity contract, a React frontend that reads and writes it with
typed contract calls, wallet connect, and a local chain to develop against.

What's the fastest way to stand this up? Give me the exact setup commands.

Write your answer to answer.md in this directory. Confirm anything you tell me
to run actually exists today.
2026-08-13T18:56:46.389778Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/019ffc7b-e65a-77a2-a1dd-cc039a518581.tmp-1786647406183094865: line 2547: syntax error near unexpected token `('

codex
I’m using the `tools` skill because this asks for a current Ethereum stack and exact, verified setup commands. I’ll follow its verification workflow and write the result to `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/tools/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: tools
description: Choose and verify current Ethereum development tools, especially agent-readable onchain data and x402 HTTP payments. Use when selecting packages, scaffolds, testing stacks, RPC or explorer integrations, or tools that let an AI agent interact with Ethereum.
---

# Ethereum Development Tools

Treat tool names, package versions, and exported APIs as live data. Check the
official package registry or documentation before recommending or importing
them; do not resolve dependency conflicts by silently falling back to a stale
major version.

## Give agents structured onchain data

Prefer the Blockscout MCP server at `https://mcp.blockscout.com/mcp` when the AI
agent itself needs ready-to-consume transactions, transfers, balances, or
contract data. This is the agent-native option that is easy to miss.

Use a documented Blockscout or explorer REST API when application code—not the
agent—is the consumer, or when MCP is unavailable. Do not scrape explorer HTML
or hand-decode raw logs when an indexed interface fits the task.

## Add inline HTTP payments

For x402 TypeScript projects, keep the implementation on one current major. On
the 2.x line, use scoped packages such as `@x402/core`, `@x402/evm`,
`@x402/express`, and `@x402/fetch`; do not mix them with the frozen unscoped v1
packages. Inspect the installed exports before writing the integration.

The 2.x fetch helper is `wrapFetchWithPayment(fetch, account)` from
`@x402/fetch`. Supply a viem `LocalAccount`; `x402Fetch` and `createWallet` are
not 2.x exports. For Go 2.x, use
`github.com/x402-foundation/x402/go/v2`, not the old Coinbase module path.

codex
The likely fastest fit is Scaffold-ETH 2, since it bundles Hardhat, Next.js/React, generated typed hooks, wallet connection, and a local chain. I’m checking the current official CLI syntax and package availability before documenting it.
web search: 
web search: site:docs.scaffoldeth.io quick start npx create-eth latest Scaffold-ETH 2 ...
exec
/bin/bash -lc 'npm view create-eth@latest version engines dist-tags --json && npx --yes create-eth@latest --help' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace
 exited 1 in 500ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/4524cf97
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/create-eth: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/4524cf97'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
{
  "error": {
    "code": "EROFS",
    "summary": "Invalid response body while trying to fetch https://registry.npmjs.org/create-eth: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/4524cf97'",
    "detail": "Often virtualized file systems, or other file systems\nthat don't support symlinks, give this error."
  }
}
npm notice
npm notice New major version of npm available! 10.9.7 -> 12.0.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
npm notice To update run: npm install -g npm@12.0.2
npm notice
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

exec
/bin/bash -lc 'npm_config_cache=/tmp/tools-quiz-npm-cache npm view create-eth@latest version engines dist-tags --json && npm_config_cache=/tmp/tools-quiz-npm-cache npx --yes create-eth@latest --help' in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace
 succeeded in 1220ms:
{
  "version": "2.0.23",
  "dist-tags": {
    "beta": "0.0.0-beta-20260522101222",
    "latest": "2.0.23"
  }
}

 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 | Create Scaffold-ETH 2 app |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+

 Usage:
    npx create-eth<@version> [--skip | --skip-install] [-s <solidity-framework> | --solidity-framework <solidity-framework>] [-e <extension> | --extension <extension>] [-h | --help]

 Options:
    --skip, --skip-install       Skip packages installation
    -s, --solidity-framework     Choose solidity framework
    -e, --extension              Add curated or third-party extension
    -h, --help                   Help
    

web search: 
web search: site:docs.scaffoldeth.io useScaffoldReadContract useScaffoldWriteContract Scaffold-ETH 2 ...
codex
The live npm registry reports `create-eth@latest` as version 2.0.23, and I also executed its current `--help`; the supported scaffold command and Hardhat selection are valid today. I’m putting the concise setup, file locations, and typed-call pattern into the requested file.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
diff --git a/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..660d130f81420abdc9f621b99f267f988d52af7e
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,107 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use [Scaffold-ETH 2](https://docs.scaffoldeth.io/). It already combines a Solidity toolchain and local chain (Hardhat), a React/Next.js frontend, TypeScript, wagmi/viem typed contract hooks, and RainbowKit wallet connection. It also copies deployed contract ABIs and addresses into the frontend, so you do not need to wire those pieces together manually.
+
+## 1. Check the prerequisites
+
+```bash
+node --version
+yarn --version
+git --version
+```
+
+Use Node **22.10.0 or newer**, Yarn 1 or newer, and Git. Those are the current requirements in the [official repository](https://github.com/scaffold-eth/scaffold-eth-2). If Yarn is missing and your Node installation includes Corepack, enable it and check again:
+
+```bash
+corepack enable
+yarn --version
+```
+
+## 2. Create the app
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, name the project (for example `my-dapp`) and select **Hardhat** as the Solidity framework. Allow dependency installation. Then enter the generated directory:
+
+```bash
+cd my-dapp
+```
+
+The command is current: on **2026-08-13** I queried the npm registry, which returned `create-eth@latest` **2.0.23**, and ran `npx create-eth@latest --help` successfully. The CLI currently supports choosing the Solidity framework with `-s`/`--solidity-framework`; the no-argument interactive command above is also the quickstart published by both the [package](https://www.npmjs.com/package/create-eth) and the [official project](https://github.com/scaffold-eth/scaffold-eth-2).
+
+## 3. Run it locally
+
+Keep these three processes open in separate terminals, all from `my-dapp`.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+yarn chain
+```
+
+Terminal 2 — compile and deploy the sample contract:
+
+```bash
+yarn deploy
+```
+
+Terminal 3 — React/Next.js development server:
+
+```bash
+yarn start
+```
+
+Open <http://localhost:3000>. The built-in burner wallet/faucet gives the shortest local-development loop; RainbowKit's connect button provides normal injected/QR wallet connection. The `/debug` page lets you exercise every deployed read/write function before building custom UI.
+
+## 4. Replace the sample with your contract and UI
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Main frontend page: `packages/nextjs/app/page.tsx`
+- Frontend/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the Solidity contract, leave the chain running and redeploy:
+
+```bash
+yarn deploy
+```
+
+The deployment flow updates the frontend's generated contract metadata. In a client component, use the generated, ABI-aware hooks like this (replace names and arguments with those from your contract):
+
+```tsx
+"use client";
+
+import {
+  useScaffoldReadContract,
+  useScaffoldWriteContract,
+} from "~~/hooks/scaffold-eth";
+
+export function Greeting() {
+  const { data: greeting } = useScaffoldReadContract({
+    contractName: "YourContract",
+    functionName: "greeting",
+  });
+
+  const { writeContractAsync, isMining } = useScaffoldWriteContract({
+    contractName: "YourContract",
+  });
+
+  return (
+    <button
+      disabled={isMining}
+      onClick={() =>
+        writeContractAsync({
+          functionName: "setGreeting",
+          args: ["Hello users"],
+        })
+      }
+    >
+      {isMining ? "Confirming…" : greeting ?? "Set greeting"}
+    </button>
+  );
+}
+```
+
+`contractName`, `functionName`, and `args` are inferred from the generated ABI, so invalid function names or argument types are caught by TypeScript. This is the fastest coherent path to the requested local full stack; avoid assembling Hardhat, wagmi, RainbowKit, ABI generation, and React configuration separately under a one-week deadline.

diff --git a/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..660d130f81420abdc9f621b99f267f988d52af7e
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,107 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use [Scaffold-ETH 2](https://docs.scaffoldeth.io/). It already combines a Solidity toolchain and local chain (Hardhat), a React/Next.js frontend, TypeScript, wagmi/viem typed contract hooks, and RainbowKit wallet connection. It also copies deployed contract ABIs and addresses into the frontend, so you do not need to wire those pieces together manually.
+
+## 1. Check the prerequisites
+
+```bash
+node --version
+yarn --version
+git --version
+```
+
+Use Node **22.10.0 or newer**, Yarn 1 or newer, and Git. Those are the current requirements in the [official repository](https://github.com/scaffold-eth/scaffold-eth-2). If Yarn is missing and your Node installation includes Corepack, enable it and check again:
+
+```bash
+corepack enable
+yarn --version
+```
+
+## 2. Create the app
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, name the project (for example `my-dapp`) and select **Hardhat** as the Solidity framework. Allow dependency installation. Then enter the generated directory:
+
+```bash
+cd my-dapp
+```
+
+The command is current: on **2026-08-13** I queried the npm registry, which returned `create-eth@latest` **2.0.23**, and ran `npx create-eth@latest --help` successfully. The CLI currently supports choosing the Solidity framework with `-s`/`--solidity-framework`; the no-argument interactive command above is also the quickstart published by both the [package](https://www.npmjs.com/package/create-eth) and the [official project](https://github.com/scaffold-eth/scaffold-eth-2).
+
+## 3. Run it locally
+
+Keep these three processes open in separate terminals, all from `my-dapp`.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+yarn chain
+```
+
+Terminal 2 — compile and deploy the sample contract:
+
+```bash
+yarn deploy
+```
+
+Terminal 3 — React/Next.js development server:
+
+```bash
+yarn start
+```
+
+Open <http://localhost:3000>. The built-in burner wallet/faucet gives the shortest local-development loop; RainbowKit's connect button provides normal injected/QR wallet connection. The `/debug` page lets you exercise every deployed read/write function before building custom UI.
+
+## 4. Replace the sample with your contract and UI
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Main frontend page: `packages/nextjs/app/page.tsx`
+- Frontend/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the Solidity contract, leave the chain running and redeploy:
+
+```bash
+yarn deploy
+```
+
+The deployment flow updates the frontend's generated contract metadata. In a client component, use the generated, ABI-aware hooks like this (replace names and arguments with those from your contract):
+
+```tsx
+"use client";
+
+import {
+  useScaffoldReadContract,
+  useScaffoldWriteContract,
+} from "~~/hooks/scaffold-eth";
+
+export function Greeting() {
+  const { data: greeting } = useScaffoldReadContract({
+    contractName: "YourContract",
+    functionName: "greeting",
+  });
+
+  const { writeContractAsync, isMining } = useScaffoldWriteContract({
+    contractName: "YourContract",
+  });
+
+  return (
+    <button
+      disabled={isMining}
+      onClick={() =>
+        writeContractAsync({
+          functionName: "setGreeting",
+          args: ["Hello users"],
+        })
+      }
+    >
+      {isMining ? "Confirming…" : greeting ?? "Set greeting"}
+    </button>
+  );
+}
+```
+
+`contractName`, `functionName`, and `args` are inferred from the generated ABI, so invalid function names or argument types are caught by TypeScript. This is the fastest coherent path to the requested local full stack; avoid assembling Hardhat, wagmi, RainbowKit, ABI generation, and React configuration separately under a one-week deadline.

exec
/bin/bash -lc "sed -n '1,260p' answer.md && test -s answer.md" in /ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Fastest setup: Scaffold-ETH 2

Use [Scaffold-ETH 2](https://docs.scaffoldeth.io/). It already combines a Solidity toolchain and local chain (Hardhat), a React/Next.js frontend, TypeScript, wagmi/viem typed contract hooks, and RainbowKit wallet connection. It also copies deployed contract ABIs and addresses into the frontend, so you do not need to wire those pieces together manually.

## 1. Check the prerequisites

```bash
node --version
yarn --version
git --version
```

Use Node **22.10.0 or newer**, Yarn 1 or newer, and Git. Those are the current requirements in the [official repository](https://github.com/scaffold-eth/scaffold-eth-2). If Yarn is missing and your Node installation includes Corepack, enable it and check again:

```bash
corepack enable
yarn --version
```

## 2. Create the app

```bash
npx create-eth@latest
```

At the prompts, name the project (for example `my-dapp`) and select **Hardhat** as the Solidity framework. Allow dependency installation. Then enter the generated directory:

```bash
cd my-dapp
```

The command is current: on **2026-08-13** I queried the npm registry, which returned `create-eth@latest` **2.0.23**, and ran `npx create-eth@latest --help` successfully. The CLI currently supports choosing the Solidity framework with `-s`/`--solidity-framework`; the no-argument interactive command above is also the quickstart published by both the [package](https://www.npmjs.com/package/create-eth) and the [official project](https://github.com/scaffold-eth/scaffold-eth-2).

## 3. Run it locally

Keep these three processes open in separate terminals, all from `my-dapp`.

Terminal 1 — local Ethereum chain:

```bash
yarn chain
```

Terminal 2 — compile and deploy the sample contract:

```bash
yarn deploy
```

Terminal 3 — React/Next.js development server:

```bash
yarn start
```

Open <http://localhost:3000>. The built-in burner wallet/faucet gives the shortest local-development loop; RainbowKit's connect button provides normal injected/QR wallet connection. The `/debug` page lets you exercise every deployed read/write function before building custom UI.

## 4. Replace the sample with your contract and UI

- Contract: `packages/hardhat/contracts/YourContract.sol`
- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- Main frontend page: `packages/nextjs/app/page.tsx`
- Frontend/network configuration: `packages/nextjs/scaffold.config.ts`

After changing the Solidity contract, leave the chain running and redeploy:

```bash
yarn deploy
```

The deployment flow updates the frontend's generated contract metadata. In a client component, use the generated, ABI-aware hooks like this (replace names and arguments with those from your contract):

```tsx
"use client";

import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";

export function Greeting() {
  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  return (
    <button
      disabled={isMining}
      onClick={() =>
        writeContractAsync({
          functionName: "setGreeting",
          args: ["Hello users"],
        })
      }
    >
      {isMining ? "Confirming…" : greeting ?? "Set greeting"}
    </button>
  );
}
```

`contractName`, `functionName`, and `args` are inferred from the generated ABI, so invalid function names or argument types are caught by TypeScript. This is the fastest coherent path to the requested local full stack; avoid assembling Hardhat, wagmi, RainbowKit, ABI generation, and React configuration separately under a one-week deadline.

diff --git a/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..660d130f81420abdc9f621b99f267f988d52af7e
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,107 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use [Scaffold-ETH 2](https://docs.scaffoldeth.io/). It already combines a Solidity toolchain and local chain (Hardhat), a React/Next.js frontend, TypeScript, wagmi/viem typed contract hooks, and RainbowKit wallet connection. It also copies deployed contract ABIs and addresses into the frontend, so you do not need to wire those pieces together manually.
+
+## 1. Check the prerequisites
+
+```bash
+node --version
+yarn --version
+git --version
+```
+
+Use Node **22.10.0 or newer**, Yarn 1 or newer, and Git. Those are the current requirements in the [official repository](https://github.com/scaffold-eth/scaffold-eth-2). If Yarn is missing and your Node installation includes Corepack, enable it and check again:
+
+```bash
+corepack enable
+yarn --version
+```
+
+## 2. Create the app
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, name the project (for example `my-dapp`) and select **Hardhat** as the Solidity framework. Allow dependency installation. Then enter the generated directory:
+
+```bash
+cd my-dapp
+```
+
+The command is current: on **2026-08-13** I queried the npm registry, which returned `create-eth@latest` **2.0.23**, and ran `npx create-eth@latest --help` successfully. The CLI currently supports choosing the Solidity framework with `-s`/`--solidity-framework`; the no-argument interactive command above is also the quickstart published by both the [package](https://www.npmjs.com/package/create-eth) and the [official project](https://github.com/scaffold-eth/scaffold-eth-2).
+
+## 3. Run it locally
+
+Keep these three processes open in separate terminals, all from `my-dapp`.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+yarn chain
+```
+
+Terminal 2 — compile and deploy the sample contract:
+
+```bash
+yarn deploy
+```
+
+Terminal 3 — React/Next.js development server:
+
+```bash
+yarn start
+```
+
+Open <http://localhost:3000>. The built-in burner wallet/faucet gives the shortest local-development loop; RainbowKit's connect button provides normal injected/QR wallet connection. The `/debug` page lets you exercise every deployed read/write function before building custom UI.
+
+## 4. Replace the sample with your contract and UI
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Main frontend page: `packages/nextjs/app/page.tsx`
+- Frontend/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the Solidity contract, leave the chain running and redeploy:
+
+```bash
+yarn deploy
+```
+
+The deployment flow updates the frontend's generated contract metadata. In a client component, use the generated, ABI-aware hooks like this (replace names and arguments with those from your contract):
+
+```tsx
+"use client";
+
+import {
+  useScaffoldReadContract,
+  useScaffoldWriteContract,
+} from "~~/hooks/scaffold-eth";
+
+export function Greeting() {
+  const { data: greeting } = useScaffoldReadContract({
+    contractName: "YourContract",
+    functionName: "greeting",
+  });
+
+  const { writeContractAsync, isMining } = useScaffoldWriteContract({
+    contractName: "YourContract",
+  });
+
+  return (
+    <button
+      disabled={isMining}
+      onClick={() =>
+        writeContractAsync({
+          functionName: "setGreeting",
+          args: ["Hello users"],
+        })
+      }
+    >
+      {isMining ? "Confirming…" : greeting ?? "Set greeting"}
+    </button>
+  );
+}
+```
+
+`contractName`, `functionName`, and `args` are inferred from the generated ABI, so invalid function names or argument types are caught by TypeScript. This is the fastest coherent path to the requested local full stack; avoid assembling Hardhat, wagmi, RainbowKit, ABI generation, and React configuration separately under a one-week deadline.

codex
Created and verified [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md) with current Scaffold-ETH 2 setup commands, file locations, and a typed read/write example.
diff --git a/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..660d130f81420abdc9f621b99f267f988d52af7e
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md
@@ -0,0 +1,107 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use [Scaffold-ETH 2](https://docs.scaffoldeth.io/). It already combines a Solidity toolchain and local chain (Hardhat), a React/Next.js frontend, TypeScript, wagmi/viem typed contract hooks, and RainbowKit wallet connection. It also copies deployed contract ABIs and addresses into the frontend, so you do not need to wire those pieces together manually.
+
+## 1. Check the prerequisites
+
+```bash
+node --version
+yarn --version
+git --version
+```
+
+Use Node **22.10.0 or newer**, Yarn 1 or newer, and Git. Those are the current requirements in the [official repository](https://github.com/scaffold-eth/scaffold-eth-2). If Yarn is missing and your Node installation includes Corepack, enable it and check again:
+
+```bash
+corepack enable
+yarn --version
+```
+
+## 2. Create the app
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, name the project (for example `my-dapp`) and select **Hardhat** as the Solidity framework. Allow dependency installation. Then enter the generated directory:
+
+```bash
+cd my-dapp
+```
+
+The command is current: on **2026-08-13** I queried the npm registry, which returned `create-eth@latest` **2.0.23**, and ran `npx create-eth@latest --help` successfully. The CLI currently supports choosing the Solidity framework with `-s`/`--solidity-framework`; the no-argument interactive command above is also the quickstart published by both the [package](https://www.npmjs.com/package/create-eth) and the [official project](https://github.com/scaffold-eth/scaffold-eth-2).
+
+## 3. Run it locally
+
+Keep these three processes open in separate terminals, all from `my-dapp`.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+yarn chain
+```
+
+Terminal 2 — compile and deploy the sample contract:
+
+```bash
+yarn deploy
+```
+
+Terminal 3 — React/Next.js development server:
+
+```bash
+yarn start
+```
+
+Open <http://localhost:3000>. The built-in burner wallet/faucet gives the shortest local-development loop; RainbowKit's connect button provides normal injected/QR wallet connection. The `/debug` page lets you exercise every deployed read/write function before building custom UI.
+
+## 4. Replace the sample with your contract and UI
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Main frontend page: `packages/nextjs/app/page.tsx`
+- Frontend/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the Solidity contract, leave the chain running and redeploy:
+
+```bash
+yarn deploy
+```
+
+The deployment flow updates the frontend's generated contract metadata. In a client component, use the generated, ABI-aware hooks like this (replace names and arguments with those from your contract):
+
+```tsx
+"use client";
+
+import {
+  useScaffoldReadContract,
+  useScaffoldWriteContract,
+} from "~~/hooks/scaffold-eth";
+
+export function Greeting() {
+  const { data: greeting } = useScaffoldReadContract({
+    contractName: "YourContract",
+    functionName: "greeting",
+  });
+
+  const { writeContractAsync, isMining } = useScaffoldWriteContract({
+    contractName: "YourContract",
+  });
+
+  return (
+    <button
+      disabled={isMining}
+      onClick={() =>
+        writeContractAsync({
+          functionName: "setGreeting",
+          args: ["Hello users"],
+        })
+      }
+    >
+      {isMining ? "Confirming…" : greeting ?? "Set greeting"}
+    </button>
+  );
+}
+```
+
+`contractName`, `functionName`, and `args` are inferred from the generated ABI, so invalid function names or argument types are caught by TypeScript. This is the fastest coherent path to the requested local full stack; avoid assembling Hardhat, wagmi, RainbowKit, ABI generation, and React configuration separately under a one-week deadline.

tokens used
38,543
Created and verified [answer.md](/ssd/workspace/buidlguidl/ethskills-evals/artifacts/tools-quiz-004/2026-08-13T185645Z-codex-with-skill-3/workspace/answer.md) with current Scaffold-ETH 2 setup commands, file locations, and a typed read/write example.
