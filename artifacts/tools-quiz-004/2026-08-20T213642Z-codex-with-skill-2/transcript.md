OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0211a-d8cb-7052-9f37-e7e6b969b7a8
--------
user
I have to get a full-stack Ethereum app in front of users by the end of the
week: one Solidity contract, a React frontend that reads and writes it with
typed contract calls, wallet connect, and a local chain to develop against.

What's the fastest way to stand this up? Give me the exact setup commands.

Write your answer to answer.md in this directory. Confirm anything you tell me
to run actually exists today.

2026-08-20T21:36:42.904962Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a0211a-d8cb-7052-9f37-e7e6b969b7a8.tmp-1787261802709657094: line 2547: syntax error near unexpected token `('

codex
I’m using the `tools` skill because this is a current Ethereum tooling and scaffold choice; I’ll verify the recommended commands against today’s package/docs before writing the file.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/tools/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace
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

exec
/bin/bash -lc 'npm view create-eth@latest version dist-tags --json && npm view create-eth@latest bin engines --json && npx --yes create-eth@latest --help' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace
 exited 1 in 737ms:
npm error code EROFS
npm error syscall open
npm error path /home/damu/.npm/_cacache/tmp/653321ba
npm error errno EROFS
npm error rofs Invalid response body while trying to fetch https://registry.npmjs.org/create-eth: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/653321ba'
npm error rofs Often virtualized file systems, or other file systems
npm error rofs that don't support symlinks, give this error.
{
  "error": {
    "code": "EROFS",
    "summary": "Invalid response body while trying to fetch https://registry.npmjs.org/create-eth: EROFS: read-only file system, open '/home/damu/.npm/_cacache/tmp/653321ba'",
    "detail": "Often virtualized file systems, or other file systems\nthat don't support symlinks, give this error."
  }
}
npm error Log files were not written due to an error writing to the directory: /home/damu/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal

web search: 
exec
/bin/bash -lc 'npm_config_cache=/tmp/tools-quiz-npm-cache npm view create-eth@latest version dist-tags bin engines --json' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace
 succeeded in 241ms:
{
  "version": "2.0.23",
  "dist-tags": {
    "beta": "0.0.0-beta-20260522101222",
    "latest": "2.0.23"
  },
  "bin": {
    "create-eth": "bin/create-dapp-se2.js"
  }
}

web search: site:docs.scaffoldeth.io quick start npx create-eth Scaffold-ETH 2 local chain yarn chain deploy start
2026-08-20T21:37:01.844061Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc 'npm_config_cache=/tmp/tools-quiz-npm-cache npx --yes create-eth@2.0.23 --help' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace
 succeeded in 2573ms:
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
    

2026-08-20T21:37:07.710121Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
web search: 
web search: https://docs.scaffoldeth.io/quick-start/installation
2026-08-20T21:37:13.900648Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
web search: 
web search: site:docs.scaffoldeth.io/quick-start Scaffold-ETH 2 yarn chain yarn deploy yarn start installation ...
2026-08-20T21:37:19.148532Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
The live registry resolves `create-eth@latest` to `2.0.23`, and its CLI currently exposes the Hardhat/Foundry scaffold choice. I’m writing the shortest supported path with the scaffold’s actual local-chain, deploy, and frontend commands.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
diff --git a/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8f1c684444b28150945b83e199a5f05644b6736d
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,62 @@
+# Fastest path: Scaffold-ETH 2
+
+Use **Scaffold-ETH 2**. It already combines a Solidity workspace, a Next.js/React TypeScript frontend, typed Wagmi/Viem contract hooks, RainbowKit wallet connection, and a local Hardhat chain. It also regenerates the frontend contract ABI/address after deployment, so you do not have to wire those pieces manually.
+
+## Setup
+
+Prerequisite: a current Node.js LTS release and Yarn. If `yarn --version` is unavailable but Node includes Corepack, enable it first:
+
+```bash
+corepack enable
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, enter a project name (the commands below assume `my-dapp`) and choose **Hardhat**. Accept the default base Scaffold-ETH 2 project and let it install dependencies. Then:
+
+```bash
+cd my-dapp
+```
+
+Run these in three terminals, all from `my-dapp`:
+
+```bash
+# Terminal 1: persistent local Ethereum chain
+yarn chain
+```
+
+```bash
+# Terminal 2: compile and deploy the contract to that chain
+yarn deploy
+```
+
+```bash
+# Terminal 3: start the React/Next.js frontend
+yarn start
+```
+
+Open `http://localhost:3000`. Keep `yarn chain` running while developing; rerun `yarn deploy` after contract changes.
+
+## Where to make the app
+
+- Replace the example contract at `packages/hardhat/contracts/YourContract.sol` with your contract.
+- Update its deployment script under `packages/hardhat/deploy/`.
+- Build the UI under `packages/nextjs/app/`.
+- Use Scaffold-ETH's `useScaffoldReadContract` and `useScaffoldWriteContract` hooks from `~~/hooks/scaffold-eth` for typed reads and writes. Their `contractName` and `functionName` types are inferred from the deployed contract metadata generated by `yarn deploy`.
+- The scaffold already includes the wallet-connect UI; on the local chain it also provides a burner wallet/faucet for quick testing.
+
+For a production preview later, configure a supported public network/RPC and deploy the contract before deploying `packages/nextjs`; the commands above deliberately optimize for getting the complete app working locally first.
+
+## Verification
+
+Verified on **2026-08-20**:
+
+- The npm registry resolves `create-eth@latest` to **2.0.23**, and the package exposes the `create-eth` executable.
+- `npx create-eth@2.0.23 --help` runs and lists `--solidity-framework` with Hardhat/Foundry selection.
+- The official [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/) confirms the current stack: Next.js, TypeScript, RainbowKit, Wagmi, Viem, and Hardhat or Foundry, including contract hot reload, wallet integration, and a local faucet.
+
+Do not substitute similarly named old generators such as `create-eth-app` or `create-scaffold-eth`; the live Scaffold-ETH 2 generator is `create-eth`.

diff --git a/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8f1c684444b28150945b83e199a5f05644b6736d
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,62 @@
+# Fastest path: Scaffold-ETH 2
+
+Use **Scaffold-ETH 2**. It already combines a Solidity workspace, a Next.js/React TypeScript frontend, typed Wagmi/Viem contract hooks, RainbowKit wallet connection, and a local Hardhat chain. It also regenerates the frontend contract ABI/address after deployment, so you do not have to wire those pieces manually.
+
+## Setup
+
+Prerequisite: a current Node.js LTS release and Yarn. If `yarn --version` is unavailable but Node includes Corepack, enable it first:
+
+```bash
+corepack enable
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, enter a project name (the commands below assume `my-dapp`) and choose **Hardhat**. Accept the default base Scaffold-ETH 2 project and let it install dependencies. Then:
+
+```bash
+cd my-dapp
+```
+
+Run these in three terminals, all from `my-dapp`:
+
+```bash
+# Terminal 1: persistent local Ethereum chain
+yarn chain
+```
+
+```bash
+# Terminal 2: compile and deploy the contract to that chain
+yarn deploy
+```
+
+```bash
+# Terminal 3: start the React/Next.js frontend
+yarn start
+```
+
+Open `http://localhost:3000`. Keep `yarn chain` running while developing; rerun `yarn deploy` after contract changes.
+
+## Where to make the app
+
+- Replace the example contract at `packages/hardhat/contracts/YourContract.sol` with your contract.
+- Update its deployment script under `packages/hardhat/deploy/`.
+- Build the UI under `packages/nextjs/app/`.
+- Use Scaffold-ETH's `useScaffoldReadContract` and `useScaffoldWriteContract` hooks from `~~/hooks/scaffold-eth` for typed reads and writes. Their `contractName` and `functionName` types are inferred from the deployed contract metadata generated by `yarn deploy`.
+- The scaffold already includes the wallet-connect UI; on the local chain it also provides a burner wallet/faucet for quick testing.
+
+For a production preview later, configure a supported public network/RPC and deploy the contract before deploying `packages/nextjs`; the commands above deliberately optimize for getting the complete app working locally first.
+
+## Verification
+
+Verified on **2026-08-20**:
+
+- The npm registry resolves `create-eth@latest` to **2.0.23**, and the package exposes the `create-eth` executable.
+- `npx create-eth@2.0.23 --help` runs and lists `--solidity-framework` with Hardhat/Foundry selection.
+- The official [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/) confirms the current stack: Next.js, TypeScript, RainbowKit, Wagmi, Viem, and Hardhat or Foundry, including contract hot reload, wallet integration, and a local faucet.
+
+Do not substitute similarly named old generators such as `create-eth-app` or `create-scaffold-eth`; the live Scaffold-ETH 2 generator is `create-eth`.

2026-08-20T21:37:38.641245Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Fastest path: Scaffold-ETH 2

Use **Scaffold-ETH 2**. It already combines a Solidity workspace, a Next.js/React TypeScript frontend, typed Wagmi/Viem contract hooks, RainbowKit wallet connection, and a local Hardhat chain. It also regenerates the frontend contract ABI/address after deployment, so you do not have to wire those pieces manually.

## Setup

Prerequisite: a current Node.js LTS release and Yarn. If `yarn --version` is unavailable but Node includes Corepack, enable it first:

```bash
corepack enable
```

Create the app:

```bash
npx create-eth@latest
```

At the prompts, enter a project name (the commands below assume `my-dapp`) and choose **Hardhat**. Accept the default base Scaffold-ETH 2 project and let it install dependencies. Then:

```bash
cd my-dapp
```

Run these in three terminals, all from `my-dapp`:

```bash
# Terminal 1: persistent local Ethereum chain
yarn chain
```

```bash
# Terminal 2: compile and deploy the contract to that chain
yarn deploy
```

```bash
# Terminal 3: start the React/Next.js frontend
yarn start
```

Open `http://localhost:3000`. Keep `yarn chain` running while developing; rerun `yarn deploy` after contract changes.

## Where to make the app

- Replace the example contract at `packages/hardhat/contracts/YourContract.sol` with your contract.
- Update its deployment script under `packages/hardhat/deploy/`.
- Build the UI under `packages/nextjs/app/`.
- Use Scaffold-ETH's `useScaffoldReadContract` and `useScaffoldWriteContract` hooks from `~~/hooks/scaffold-eth` for typed reads and writes. Their `contractName` and `functionName` types are inferred from the deployed contract metadata generated by `yarn deploy`.
- The scaffold already includes the wallet-connect UI; on the local chain it also provides a burner wallet/faucet for quick testing.

For a production preview later, configure a supported public network/RPC and deploy the contract before deploying `packages/nextjs`; the commands above deliberately optimize for getting the complete app working locally first.

## Verification

Verified on **2026-08-20**:

- The npm registry resolves `create-eth@latest` to **2.0.23**, and the package exposes the `create-eth` executable.
- `npx create-eth@2.0.23 --help` runs and lists `--solidity-framework` with Hardhat/Foundry selection.
- The official [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/) confirms the current stack: Next.js, TypeScript, RainbowKit, Wagmi, Viem, and Hardhat or Foundry, including contract hot reload, wallet integration, and a local faucet.

Do not substitute similarly named old generators such as `create-eth-app` or `create-scaffold-eth`; the live Scaffold-ETH 2 generator is `create-eth`.

diff --git a/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8f1c684444b28150945b83e199a5f05644b6736d
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,62 @@
+# Fastest path: Scaffold-ETH 2
+
+Use **Scaffold-ETH 2**. It already combines a Solidity workspace, a Next.js/React TypeScript frontend, typed Wagmi/Viem contract hooks, RainbowKit wallet connection, and a local Hardhat chain. It also regenerates the frontend contract ABI/address after deployment, so you do not have to wire those pieces manually.
+
+## Setup
+
+Prerequisite: a current Node.js LTS release and Yarn. If `yarn --version` is unavailable but Node includes Corepack, enable it first:
+
+```bash
+corepack enable
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, enter a project name (the commands below assume `my-dapp`) and choose **Hardhat**. Accept the default base Scaffold-ETH 2 project and let it install dependencies. Then:
+
+```bash
+cd my-dapp
+```
+
+Run these in three terminals, all from `my-dapp`:
+
+```bash
+# Terminal 1: persistent local Ethereum chain
+yarn chain
+```
+
+```bash
+# Terminal 2: compile and deploy the contract to that chain
+yarn deploy
+```
+
+```bash
+# Terminal 3: start the React/Next.js frontend
+yarn start
+```
+
+Open `http://localhost:3000`. Keep `yarn chain` running while developing; rerun `yarn deploy` after contract changes.
+
+## Where to make the app
+
+- Replace the example contract at `packages/hardhat/contracts/YourContract.sol` with your contract.
+- Update its deployment script under `packages/hardhat/deploy/`.
+- Build the UI under `packages/nextjs/app/`.
+- Use Scaffold-ETH's `useScaffoldReadContract` and `useScaffoldWriteContract` hooks from `~~/hooks/scaffold-eth` for typed reads and writes. Their `contractName` and `functionName` types are inferred from the deployed contract metadata generated by `yarn deploy`.
+- The scaffold already includes the wallet-connect UI; on the local chain it also provides a burner wallet/faucet for quick testing.
+
+For a production preview later, configure a supported public network/RPC and deploy the contract before deploying `packages/nextjs`; the commands above deliberately optimize for getting the complete app working locally first.
+
+## Verification
+
+Verified on **2026-08-20**:
+
+- The npm registry resolves `create-eth@latest` to **2.0.23**, and the package exposes the `create-eth` executable.
+- `npx create-eth@2.0.23 --help` runs and lists `--solidity-framework` with Hardhat/Foundry selection.
+- The official [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/) confirms the current stack: Next.js, TypeScript, RainbowKit, Wagmi, Viem, and Hardhat or Foundry, including contract hot reload, wallet integration, and a local faucet.
+
+Do not substitute similarly named old generators such as `create-eth-app` or `create-scaffold-eth`; the live Scaffold-ETH 2 generator is `create-eth`.

2026-08-20T21:37:42.239394Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md) with verified Scaffold-ETH 2 setup commands and current package details.
diff --git a/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..8f1c684444b28150945b83e199a5f05644b6736d
--- /dev/null
+++ b/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md
@@ -0,0 +1,62 @@
+# Fastest path: Scaffold-ETH 2
+
+Use **Scaffold-ETH 2**. It already combines a Solidity workspace, a Next.js/React TypeScript frontend, typed Wagmi/Viem contract hooks, RainbowKit wallet connection, and a local Hardhat chain. It also regenerates the frontend contract ABI/address after deployment, so you do not have to wire those pieces manually.
+
+## Setup
+
+Prerequisite: a current Node.js LTS release and Yarn. If `yarn --version` is unavailable but Node includes Corepack, enable it first:
+
+```bash
+corepack enable
+```
+
+Create the app:
+
+```bash
+npx create-eth@latest
+```
+
+At the prompts, enter a project name (the commands below assume `my-dapp`) and choose **Hardhat**. Accept the default base Scaffold-ETH 2 project and let it install dependencies. Then:
+
+```bash
+cd my-dapp
+```
+
+Run these in three terminals, all from `my-dapp`:
+
+```bash
+# Terminal 1: persistent local Ethereum chain
+yarn chain
+```
+
+```bash
+# Terminal 2: compile and deploy the contract to that chain
+yarn deploy
+```
+
+```bash
+# Terminal 3: start the React/Next.js frontend
+yarn start
+```
+
+Open `http://localhost:3000`. Keep `yarn chain` running while developing; rerun `yarn deploy` after contract changes.
+
+## Where to make the app
+
+- Replace the example contract at `packages/hardhat/contracts/YourContract.sol` with your contract.
+- Update its deployment script under `packages/hardhat/deploy/`.
+- Build the UI under `packages/nextjs/app/`.
+- Use Scaffold-ETH's `useScaffoldReadContract` and `useScaffoldWriteContract` hooks from `~~/hooks/scaffold-eth` for typed reads and writes. Their `contractName` and `functionName` types are inferred from the deployed contract metadata generated by `yarn deploy`.
+- The scaffold already includes the wallet-connect UI; on the local chain it also provides a burner wallet/faucet for quick testing.
+
+For a production preview later, configure a supported public network/RPC and deploy the contract before deploying `packages/nextjs`; the commands above deliberately optimize for getting the complete app working locally first.
+
+## Verification
+
+Verified on **2026-08-20**:
+
+- The npm registry resolves `create-eth@latest` to **2.0.23**, and the package exposes the `create-eth` executable.
+- `npx create-eth@2.0.23 --help` runs and lists `--solidity-framework` with Hardhat/Foundry selection.
+- The official [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/) confirms the current stack: Next.js, TypeScript, RainbowKit, Wagmi, Viem, and Hardhat or Foundry, including contract hot reload, wallet integration, and a local faucet.
+
+Do not substitute similarly named old generators such as `create-eth-app` or `create-scaffold-eth`; the live Scaffold-ETH 2 generator is `create-eth`.

tokens used
18,525
Created [answer.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/tools-quiz-004/2026-08-20T213642Z-codex-with-skill-2/workspace/answer.md) with verified Scaffold-ETH 2 setup commands and current package details.
