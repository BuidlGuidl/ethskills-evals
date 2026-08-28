2026-08-20T21:35:26.044731Z ERROR codex_models_manager::cache: failed to load models cache: missing field `base_instructions` at line 97 column 5
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a02119-b067-73c3-9620-b89aed20a0f0
--------
user
I have to get a full-stack Ethereum app in front of users by the end of the
week: one Solidity contract, a React frontend that reads and writes it with
typed contract calls, wallet connect, and a local chain to develop against.

What's the fastest way to stand this up? Give me the exact setup commands.

Write your answer to answer.md in this directory. Confirm anything you tell me
to run actually exists today.

2026-08-20T21:35:27.063855Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a02119-b067-73c3-9620-b89aed20a0f0.tmp-1787261726860599851: line 2547: syntax error near unexpected token `('

codex
I’m using the `tools` skill because this is a current Ethereum tooling and scaffold selection question. I’ll verify the recommended commands against today’s official package metadata before writing `answer.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/tools/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: tools
description: Choose and verify current Ethereum development tools, especially agent-readable onchain data and x402 HTTP payments. Use when selecting packages or a scaffold for an Ethereum project, or wiring the tools that let an AI agent read onchain data and pay for HTTP calls.
---

# Ethereum Development Tools

Treat tool names, package versions, and exported APIs as live data. Check the
official package registry or documentation before recommending or importing
them; do not resolve dependency conflicts by silently falling back to a stale
major version.

For a new Scaffold-ETH 2 app, the live scaffold package is `create-eth`:
`npx create-eth@latest`. Check that it resolves before handing it over. Pinning
the version `latest` currently resolves to is fine once you have verified it —
what is not fine is `create-eth-app` or `create-scaffold-eth`, which are dead
package names rather than older spellings of this one.

## Give agents structured onchain data

Prefer the Blockscout MCP server at `https://mcp.blockscout.com/mcp` when the AI
agent itself needs ready-to-consume transactions, transfers, balances, or
contract data. This is the agent-native option that is easy to miss.

Use a documented Blockscout or explorer REST API when application code—not the
agent—is the consumer, or when MCP is unavailable. Do not scrape explorer HTML
or hand-decode raw logs when an indexed interface fits the task.

## Add inline HTTP payments

For x402 TypeScript projects, use the scoped `@x402/*` packages — `@x402/core`,
`@x402/evm`, `@x402/express`, `@x402/fetch` — and keep the whole implementation on
one major. The unscoped `x402`, `x402-fetch`, and `x402-express` packages are
frozen at 1.2.0 and are not the maintained line, whatever a version range resolves
them to; do not fall back to them to clear a dependency conflict. `@coinbase/x402`
is the Coinbase facilitator config, which sits alongside the scoped family rather
than replacing it. Inspect the installed exports before writing the integration.

`x402Fetch` and `createWallet` do not exist in the scoped packages at all, and
passing a wallet or account straight to `wrapFetchWithPayment` is the frozen v1
call shape — the scoped `@x402/fetch` wrappers take an x402 client or a scheme
config. Read the installed types instead of a remembered snippet. For Go, use
`github.com/x402-foundation/x402/go/v2`; the old `github.com/coinbase/x402/go`
path does not error, it silently resolves to a stale pre-Foundation commit.

codex
The live skill identifies Scaffold-ETH 2’s current launcher as `create-eth`. I’m checking both npm resolution and the scaffold’s official CLI options so the commands are copy-pasteable, including a non-interactive fallback.
exec
/bin/bash -lc 'npm view create-eth version dist-tags.latest bin repository.url --json && npm exec --yes --package=create-eth@latest -- create-eth --help' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace
 exited 1 in 253ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/762fac64
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/create-eth: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/762fac64'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
{
  "error": {
    "code": "EROFS",
    "summary": "Invalid response body while trying to fetch https://registry.npmjs.org/create-eth: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/762fac64'",
    "detail": "Often virtualized file systems, or other file systems\nthat don't support symlinks, give this error."
  }
}
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

exec
/bin/bash -lc 'npm_config_cache=/tmp/tools-quiz-npm-cache npm view create-eth version dist-tags.latest bin repository.url --json && npm_config_cache=/tmp/tools-quiz-npm-cache npm exec --yes --package=create-eth@latest -- create-eth --help' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace
 succeeded in 7475ms:
{
  "version": "2.0.23",
  "dist-tags.latest": "2.0.23",
  "bin": {
    "create-eth": "bin/create-dapp-se2.js"
  },
  "repository.url": "git+https://github.com/scaffold-eth/create-eth.git"
}
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me

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
web search: site:docs.scaffoldeth.io quick start npx create-eth yarn chain deploy start Scaffold-ETH 2 ...
codex
Verification succeeded: npm currently resolves `create-eth@latest` to `2.0.23`, its executable is present, and the generated project’s `chain`, `deploy`, and `start` scripts match the official Scaffold-ETH 2 repository. I’m writing the concise setup and the relevant contract/frontend paths now.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
diff --git a/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..76b6810743cca9c349dc1fdd0e53ceb34b04de93
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,80 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use Scaffold-ETH 2 with Hardhat. It already combines a Solidity workspace and local Hardhat chain with a Next.js/React TypeScript frontend, RainbowKit wallet connection, wagmi/viem, typed contract hooks, ABI export, and contract hot reload.
+
+Prerequisites: Git, Node.js **22.10.0 or newer**, and Yarn. Check them first:
+
+```bash
+git --version
+node --version
+corepack enable
+yarn --version
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest -s hardhat
+```
+
+When prompted, enter a project name such as `my-dapp`. The generator installs dependencies. Then run the three services in separate terminals.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+cd my-dapp
+yarn chain
+```
+
+Terminal 2 — compile and deploy the included example contract:
+
+```bash
+cd my-dapp
+yarn deploy
+```
+
+Terminal 3 — frontend:
+
+```bash
+cd my-dapp
+yarn start
+```
+
+Open <http://localhost:3000>. The scaffold includes wallet connect; on localhost it also provides a burner wallet/faucet workflow for immediate development.
+
+Replace the example with the one contract and UI you need:
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Frontend pages/components: `packages/nextjs/app/`
+- App/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the contract, keep the chain running and rerun:
+
+```bash
+yarn deploy
+```
+
+That deployment regenerates `packages/nextjs/contracts/deployedContracts.ts`; the ABI is inferred with `as const`, which drives typed contract names, function names, arguments, and return values in the frontend. Use the current hooks:
+
+```tsx
+const { data } = useScaffoldReadContract({
+  contractName: "YourContract",
+  functionName: "purpose",
+});
+
+const { writeContractAsync } = useScaffoldWriteContract("YourContract");
+
+await writeContractAsync({
+  functionName: "setPurpose",
+  args: [newPurpose],
+});
+```
+
+Import those hooks from `~~/hooks/scaffold-eth`. Do not use the obsolete names `useScaffoldContractRead` or `useScaffoldContractWrite`.
+
+## Verification (2026-08-20)
+
+I checked the live npm registry: `create-eth@latest` resolves to **2.0.23**, publishes the `create-eth` executable, and its live `--help` accepts `-s, --solidity-framework`. I also checked the current official repository: its root scripts include `chain`, `deploy`, and `start`, and it requires Node `>=22.10.0`. The official quickstart documents the same three-terminal workflow: [Scaffold-ETH 2 repository and quickstart](https://github.com/scaffold-eth/scaffold-eth-2), [current root package scripts](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json).
+
+The current package name is **`create-eth`**. Avoid stale commands such as `create-eth-app` or `create-scaffold-eth`.

diff --git a/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..76b6810743cca9c349dc1fdd0e53ceb34b04de93
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,80 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use Scaffold-ETH 2 with Hardhat. It already combines a Solidity workspace and local Hardhat chain with a Next.js/React TypeScript frontend, RainbowKit wallet connection, wagmi/viem, typed contract hooks, ABI export, and contract hot reload.
+
+Prerequisites: Git, Node.js **22.10.0 or newer**, and Yarn. Check them first:
+
+```bash
+git --version
+node --version
+corepack enable
+yarn --version
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest -s hardhat
+```
+
+When prompted, enter a project name such as `my-dapp`. The generator installs dependencies. Then run the three services in separate terminals.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+cd my-dapp
+yarn chain
+```
+
+Terminal 2 — compile and deploy the included example contract:
+
+```bash
+cd my-dapp
+yarn deploy
+```
+
+Terminal 3 — frontend:
+
+```bash
+cd my-dapp
+yarn start
+```
+
+Open <http://localhost:3000>. The scaffold includes wallet connect; on localhost it also provides a burner wallet/faucet workflow for immediate development.
+
+Replace the example with the one contract and UI you need:
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Frontend pages/components: `packages/nextjs/app/`
+- App/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the contract, keep the chain running and rerun:
+
+```bash
+yarn deploy
+```
+
+That deployment regenerates `packages/nextjs/contracts/deployedContracts.ts`; the ABI is inferred with `as const`, which drives typed contract names, function names, arguments, and return values in the frontend. Use the current hooks:
+
+```tsx
+const { data } = useScaffoldReadContract({
+  contractName: "YourContract",
+  functionName: "purpose",
+});
+
+const { writeContractAsync } = useScaffoldWriteContract("YourContract");
+
+await writeContractAsync({
+  functionName: "setPurpose",
+  args: [newPurpose],
+});
+```
+
+Import those hooks from `~~/hooks/scaffold-eth`. Do not use the obsolete names `useScaffoldContractRead` or `useScaffoldContractWrite`.
+
+## Verification (2026-08-20)
+
+I checked the live npm registry: `create-eth@latest` resolves to **2.0.23**, publishes the `create-eth` executable, and its live `--help` accepts `-s, --solidity-framework`. I also checked the current official repository: its root scripts include `chain`, `deploy`, and `start`, and it requires Node `>=22.10.0`. The official quickstart documents the same three-terminal workflow: [Scaffold-ETH 2 repository and quickstart](https://github.com/scaffold-eth/scaffold-eth-2), [current root package scripts](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json).
+
+The current package name is **`create-eth`**. Avoid stale commands such as `create-eth-app` or `create-scaffold-eth`.

exec
/bin/bash -lc "test -s answer.md && sed -n '1,240p' answer.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Fastest setup: Scaffold-ETH 2

Use Scaffold-ETH 2 with Hardhat. It already combines a Solidity workspace and local Hardhat chain with a Next.js/React TypeScript frontend, RainbowKit wallet connection, wagmi/viem, typed contract hooks, ABI export, and contract hot reload.

Prerequisites: Git, Node.js **22.10.0 or newer**, and Yarn. Check them first:

```bash
git --version
node --version
corepack enable
yarn --version
```

Create the app:

```bash
npx create-eth@latest -s hardhat
```

When prompted, enter a project name such as `my-dapp`. The generator installs dependencies. Then run the three services in separate terminals.

Terminal 1 — local Ethereum chain:

```bash
cd my-dapp
yarn chain
```

Terminal 2 — compile and deploy the included example contract:

```bash
cd my-dapp
yarn deploy
```

Terminal 3 — frontend:

```bash
cd my-dapp
yarn start
```

Open <http://localhost:3000>. The scaffold includes wallet connect; on localhost it also provides a burner wallet/faucet workflow for immediate development.

Replace the example with the one contract and UI you need:

- Contract: `packages/hardhat/contracts/YourContract.sol`
- Deployment: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- Frontend pages/components: `packages/nextjs/app/`
- App/network configuration: `packages/nextjs/scaffold.config.ts`

After changing the contract, keep the chain running and rerun:

```bash
yarn deploy
```

That deployment regenerates `packages/nextjs/contracts/deployedContracts.ts`; the ABI is inferred with `as const`, which drives typed contract names, function names, arguments, and return values in the frontend. Use the current hooks:

```tsx
const { data } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "purpose",
});

const { writeContractAsync } = useScaffoldWriteContract("YourContract");

await writeContractAsync({
  functionName: "setPurpose",
  args: [newPurpose],
});
```

Import those hooks from `~~/hooks/scaffold-eth`. Do not use the obsolete names `useScaffoldContractRead` or `useScaffoldContractWrite`.

## Verification (2026-08-20)

I checked the live npm registry: `create-eth@latest` resolves to **2.0.23**, publishes the `create-eth` executable, and its live `--help` accepts `-s, --solidity-framework`. I also checked the current official repository: its root scripts include `chain`, `deploy`, and `start`, and it requires Node `>=22.10.0`. The official quickstart documents the same three-terminal workflow: [Scaffold-ETH 2 repository and quickstart](https://github.com/scaffold-eth/scaffold-eth-2), [current root package scripts](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json).

The current package name is **`create-eth`**. Avoid stale commands such as `create-eth-app` or `create-scaffold-eth`.

diff --git a/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..76b6810743cca9c349dc1fdd0e53ceb34b04de93
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,80 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use Scaffold-ETH 2 with Hardhat. It already combines a Solidity workspace and local Hardhat chain with a Next.js/React TypeScript frontend, RainbowKit wallet connection, wagmi/viem, typed contract hooks, ABI export, and contract hot reload.
+
+Prerequisites: Git, Node.js **22.10.0 or newer**, and Yarn. Check them first:
+
+```bash
+git --version
+node --version
+corepack enable
+yarn --version
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest -s hardhat
+```
+
+When prompted, enter a project name such as `my-dapp`. The generator installs dependencies. Then run the three services in separate terminals.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+cd my-dapp
+yarn chain
+```
+
+Terminal 2 — compile and deploy the included example contract:
+
+```bash
+cd my-dapp
+yarn deploy
+```
+
+Terminal 3 — frontend:
+
+```bash
+cd my-dapp
+yarn start
+```
+
+Open <http://localhost:3000>. The scaffold includes wallet connect; on localhost it also provides a burner wallet/faucet workflow for immediate development.
+
+Replace the example with the one contract and UI you need:
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Frontend pages/components: `packages/nextjs/app/`
+- App/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the contract, keep the chain running and rerun:
+
+```bash
+yarn deploy
+```
+
+That deployment regenerates `packages/nextjs/contracts/deployedContracts.ts`; the ABI is inferred with `as const`, which drives typed contract names, function names, arguments, and return values in the frontend. Use the current hooks:
+
+```tsx
+const { data } = useScaffoldReadContract({
+  contractName: "YourContract",
+  functionName: "purpose",
+});
+
+const { writeContractAsync } = useScaffoldWriteContract("YourContract");
+
+await writeContractAsync({
+  functionName: "setPurpose",
+  args: [newPurpose],
+});
+```
+
+Import those hooks from `~~/hooks/scaffold-eth`. Do not use the obsolete names `useScaffoldContractRead` or `useScaffoldContractWrite`.
+
+## Verification (2026-08-20)
+
+I checked the live npm registry: `create-eth@latest` resolves to **2.0.23**, publishes the `create-eth` executable, and its live `--help` accepts `-s, --solidity-framework`. I also checked the current official repository: its root scripts include `chain`, `deploy`, and `start`, and it requires Node `>=22.10.0`. The official quickstart documents the same three-terminal workflow: [Scaffold-ETH 2 repository and quickstart](https://github.com/scaffold-eth/scaffold-eth-2), [current root package scripts](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json).
+
+The current package name is **`create-eth`**. Avoid stale commands such as `create-eth-app` or `create-scaffold-eth`.

codex
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md) with verified Scaffold-ETH 2 setup commands and typed contract-call guidance.
diff --git a/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..76b6810743cca9c349dc1fdd0e53ceb34b04de93
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md
@@ -0,0 +1,80 @@
+# Fastest setup: Scaffold-ETH 2
+
+Use Scaffold-ETH 2 with Hardhat. It already combines a Solidity workspace and local Hardhat chain with a Next.js/React TypeScript frontend, RainbowKit wallet connection, wagmi/viem, typed contract hooks, ABI export, and contract hot reload.
+
+Prerequisites: Git, Node.js **22.10.0 or newer**, and Yarn. Check them first:
+
+```bash
+git --version
+node --version
+corepack enable
+yarn --version
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest -s hardhat
+```
+
+When prompted, enter a project name such as `my-dapp`. The generator installs dependencies. Then run the three services in separate terminals.
+
+Terminal 1 — local Ethereum chain:
+
+```bash
+cd my-dapp
+yarn chain
+```
+
+Terminal 2 — compile and deploy the included example contract:
+
+```bash
+cd my-dapp
+yarn deploy
+```
+
+Terminal 3 — frontend:
+
+```bash
+cd my-dapp
+yarn start
+```
+
+Open <http://localhost:3000>. The scaffold includes wallet connect; on localhost it also provides a burner wallet/faucet workflow for immediate development.
+
+Replace the example with the one contract and UI you need:
+
+- Contract: `packages/hardhat/contracts/YourContract.sol`
+- Deployment: `packages/hardhat/deploy/00_deploy_your_contract.ts`
+- Frontend pages/components: `packages/nextjs/app/`
+- App/network configuration: `packages/nextjs/scaffold.config.ts`
+
+After changing the contract, keep the chain running and rerun:
+
+```bash
+yarn deploy
+```
+
+That deployment regenerates `packages/nextjs/contracts/deployedContracts.ts`; the ABI is inferred with `as const`, which drives typed contract names, function names, arguments, and return values in the frontend. Use the current hooks:
+
+```tsx
+const { data } = useScaffoldReadContract({
+  contractName: "YourContract",
+  functionName: "purpose",
+});
+
+const { writeContractAsync } = useScaffoldWriteContract("YourContract");
+
+await writeContractAsync({
+  functionName: "setPurpose",
+  args: [newPurpose],
+});
+```
+
+Import those hooks from `~~/hooks/scaffold-eth`. Do not use the obsolete names `useScaffoldContractRead` or `useScaffoldContractWrite`.
+
+## Verification (2026-08-20)
+
+I checked the live npm registry: `create-eth@latest` resolves to **2.0.23**, publishes the `create-eth` executable, and its live `--help` accepts `-s, --solidity-framework`. I also checked the current official repository: its root scripts include `chain`, `deploy`, and `start`, and it requires Node `>=22.10.0`. The official quickstart documents the same three-terminal workflow: [Scaffold-ETH 2 repository and quickstart](https://github.com/scaffold-eth/scaffold-eth-2), [current root package scripts](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json).
+
+The current package name is **`create-eth`**. Avoid stale commands such as `create-eth-app` or `create-scaffold-eth`.

tokens used
22,579
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213525Z-codex-with-skill-1/workspace/answer.md) with verified Scaffold-ETH 2 setup commands and typed contract-call guidance.
