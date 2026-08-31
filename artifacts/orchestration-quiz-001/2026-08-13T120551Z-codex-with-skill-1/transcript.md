# Executor transcript — 2026-08-13T120551Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1

## session

````text
OpenAI Codex v0.146.0
--------
workdir: /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: medium
reasoning summaries: none
session id: 019ffb0a-3379-7f93-89b0-ea464985481f
--------
user
Our two-person team shipped the contracts for a Scaffold-ETH 2 (foundry
flavor) dApp to Base mainnet three days ago — `yarn deploy --network base`
went fine and the app works against the live contracts. Contract
verification is still an open ticket, currently marked blocked: "waiting
on a block explorer API key from ops (ETA next sprint)". A teammate
suggests we just fold verification into the launch checklist and run it
right before the public announcement next month, all in one go.

Unblock this ticket: what exactly would we run, what do we actually need
in place for it to work, and when should it happen — now or at launch —
and why does the timing matter? The repo isn't checked out here, so write
the answer rather than trying to run anything. Write your answer to
answer.md in this directory.

codex
I’m using the Scaffold-ETH orchestration guidance because this is specifically about verification workflow and release timing. I’ll write a concrete unblock note in `answer.md`.
exec
/bin/zsh -lc "pwd && sed -n '1,240p' .agents/skills/orchestration/SKILL.md" in /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1
 succeeded in 0ms:
/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1
---
name: orchestration
description: How an AI agent plans, builds, and deploys a complete Ethereum dApp. The three-phase build system for Scaffold-ETH 2 projects. Use when building a full application on Ethereum — from contracts to frontend to production deployment on IPFS.
---

# dApp Orchestration

## What You Probably Got Wrong

**SE2 has specific patterns you must follow.** Generic "build a dApp" advice won't work. SE2 auto-generates `deployedContracts.ts` — DON'T edit it. Use Scaffold hooks, NOT raw wagmi. External contracts go in `externalContracts.ts` BEFORE building the frontend.

**There are three phases. Never skip or combine them.** Contracts → Frontend → Production. Each has validation gates.

## The Three-Phase Build System

| Phase | Environment | What Happens |
|-------|-------------|-------------|
| **Phase 1** | Local fork | Contracts + UI on localhost. Iterate fast. |
| **Phase 2** | Live network + local UI | Deploy contracts to mainnet/L2. Test with real state. Polish UI. |
| **Phase 3** | Production | Deploy frontend to IPFS/Vercel. Final QA. |

## Phase 1: Scaffold (Local)

### 1.1 Contracts

```bash
npx create-eth@latest my-dapp
cd my-dapp && yarn install
yarn fork --network base  # Terminal 1: fork of real chain (or mainnet, your target chain)
yarn deploy               # Terminal 2: deploy contracts
```

> **Always fork, never `yarn chain`.** `yarn fork` does everything `yarn chain` does AND gives you real protocol state — Uniswap, USDC, Aave, whale balances, everything already deployed (verified addresses: `addresses/SKILL.md`). `yarn chain` gives you an empty chain that tempts you into writing mock contracts you don't need. Don't mock what already exists onchain — just fork it.

**Critical steps:**
1. Write contracts in `packages/foundry/contracts/` (or `packages/hardhat/contracts/`)
2. Write deploy script
3. Add ALL external contracts to `packages/nextjs/contracts/externalContracts.ts` — BEFORE Phase 1.2
4. Write tests (≥90% coverage)
5. Audit contracts before moving to frontend — fetch [audit/SKILL.md](https://ethskills.com/audit/SKILL.md) and run through it

**Validate:** `yarn deploy` succeeds. `deployedContracts.ts` auto-generated. Tests pass.

### 1.2 Frontend

```bash
yarn fork --network base  # Terminal 1: fork of real chain (has Uniswap, USDC, etc.)
yarn deploy --watch       # Terminal 2: auto-redeploy on changes
yarn start                # Terminal 3: Next.js at localhost:3000
```

**USE SCAFFOLD HOOKS, NOT RAW WAGMI:**

```typescript
// Read
const { data } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "balanceOf",
  args: [address],
  watch: true,
});

// Write
const { writeContractAsync, isMining } = useScaffoldWriteContract("YourContract");
await writeContractAsync({
  functionName: "swap",
  args: [tokenIn, tokenOut, amount],
  onBlockConfirmation: (receipt) => console.log("Done!", receipt),
});

// Events
const { data: events } = useScaffoldEventHistory({
  contractName: "YourContract",
  eventName: "SwapExecuted",
  fromBlock: 0n,
  watch: true,
});
```

### The Three-Button Flow (MANDATORY)

Any token interaction shows ONE button at a time:
1. **Switch Network** (if wrong chain)
2. **Approve Token** (if allowance insufficient)
3. **Execute Action** (only after 1 & 2 satisfied)

Never show Approve and Execute simultaneously.

### UX Rules

- **Human-readable amounts:** `formatEther()` / `formatUnits()` for display, `parseEther()` / `parseUnits()` for contracts
- **Loading states everywhere:** `isLoading`, `isMining` on all async operations
- **Disable buttons during pending txs** (blockchains take 5-12s)
- **Never use infinite approvals** — approve exact amount or 3-5x
- **Helpful errors:** Parse "insufficient funds," "user rejected," "execution reverted" into plain language

**Validate:** Full user journey works with real wallet on localhost. All edge cases handled.

## 🚨 NEVER COMMIT SECRETS TO GIT

**Before touching Phase 2, read this.** AI agents are the #1 source of leaked credentials on GitHub. Bots scrape repos in real-time and exploit leaked secrets within seconds.

**This means ALL secrets — not just wallet private keys:**
- **Wallet private keys** — funds drained in seconds
- **API keys** — Alchemy, Infura, Etherscan, WalletConnect project IDs
- **RPC URLs with embedded keys** — e.g. `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- **OAuth tokens, passwords, bearer tokens**

**⚠️ Common SE2 Trap: `scaffold.config.ts`**

`rpcOverrides` and `alchemyApiKey` in `scaffold.config.ts` are committed to Git. **NEVER paste API keys directly into this file.** Use environment variables:

```typescript
// ❌ WRONG — key committed to public repo
rpcOverrides: {
  [chains.base.id]: "https://base-mainnet.g.alchemy.com/v2/8GVG8WjDs-LEAKED",
},

// ✅ RIGHT — key stays in .env.local
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
},
```

**Before every `git add` or `git commit`:**
```bash
# Check for leaked secrets
git diff --cached --name-only | grep -iE '\.env|key|secret|private'
grep -rn "0x[a-fA-F0-9]\{64\}" packages/ --include="*.ts" --include="*.js" --include="*.sol"
# Check for hardcoded API keys in config files
grep -rn "g.alchemy.com/v2/[A-Za-z0-9]" packages/ --include="*.ts" --include="*.js"
grep -rn "infura.io/v3/[A-Za-z0-9]" packages/ --include="*.ts" --include="*.js"
# If ANYTHING matches, STOP. Move the secret to .env and add .env to .gitignore.
```

**Your `.gitignore` MUST include:**
```
.env
.env.*
*.key
broadcast/
cache/
node_modules/
```

**SE2 handles deployer keys by default** — `yarn generate` creates a `.env` with the deployer key, and `.gitignore` excludes it. **Don't override this pattern.** Don't copy keys into scripts, config files, or deploy logs. This includes RPC keys, API keys, and any credential — not just wallet keys.

See `wallets/SKILL.md` for full key safety guide, what to do if you've already leaked a key, and safe patterns for deployment.

## Phase 2: Live Contracts + Local UI

1. Update `scaffold.config.ts`: `targetNetworks: [mainnet]` (or your L2)
2. Fund deployer: `yarn generate` → `yarn account` → send real ETH
3. Deploy: `yarn deploy --network mainnet`
4. Verify immediately after deploy: `yarn verify --network mainnet`
   - **No block explorer API key needed** — SE2 handles this for you
   - Run it right after deploy, not later. Don't skip it.
5. Test with real wallet, small amounts ($1-10)
6. Polish UI — remove SE2 branding, custom styling

**Design rule:** NO LLM SLOP. No generic purple gradients. Make it unique.

**Validate:** Contracts verified on block explorer. Full journey works with real contracts.

## Phase 3: Production Deploy

### Pre-deploy Checklist
- `burnerWalletMode: "localNetworksOnly"` in scaffold.config.ts (prevents burner wallet on prod)
- Update metadata (title, description, OG image 1200x630px)
- Restore any test values to production values
- Run a full frontend QA audit — fetch [qa/SKILL.md](https://ethskills.com/qa/SKILL.md) and give it to a separate agent before deploying

### Deploy

**IPFS** — use [BGIPFS](https://www.bgipfs.com/SKILL.md) for decentralized deploys (fetch that skill for full details). It's built into SE2 — no setup needed:
```bash
yarn ipfs
# → https://{CID}.ipfs.community.bgipfs.com/
```
Note: IPFS only works with static content — no server-side rendering, API endpoints, or functions.

**Vercel:**
```bash
yarn vercel
```

### Production QA
- [ ] App loads on public URL
- [ ] Wallet connects, network switching works
- [ ] Read + write contract operations work
- [ ] No console errors
- [ ] Burner wallet NOT showing
- [ ] OG image works in link previews
- [ ] Mobile responsive
- [ ] Tested with MetaMask, Rainbow, WalletConnect

## Phase Transition Rules

**Phase 3 bug → go back to Phase 2** (fix with local UI + prod contracts)
**Phase 2 contract bug → go back to Phase 1** (fix locally, write regression test, redeploy)
**Never hack around bugs in production.**

## Key SE2 Directories

```
packages/
├── foundry/contracts/          # Solidity contracts
├── foundry/script/             # Deploy scripts
├── foundry/test/               # Tests
└── nextjs/
    ├── app/                    # Pages
    ├── components/             # React components
    ├── contracts/
    │   ├── deployedContracts.ts   # AUTO-GENERATED (don't edit)
    │   └── externalContracts.ts   # YOUR external contracts (edit this)
    ├── hooks/scaffold-eth/     # USE THESE hooks
    └── scaffold.config.ts      # Main config
```

## Resources

- **SE2 Docs:** https://docs.scaffoldeth.io/
- **SE2 Skill:** https://docs.scaffoldeth.io/SKILL.md
- **UI Components:** https://ui.scaffoldeth.io/
- **SE2 AGENTS.md:** https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md

apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f83389e9682766a0ddbdca3f2e6f1f2267db959d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,57 @@
+# Contract-verification ticket: unblocked
+
+Run this from the Scaffold-ETH 2 repository (with the same project sources
+and Foundry configuration used for the deployment):
+
+```sh
+yarn verify --network base
+```
+
+For this Foundry-flavor Scaffold-ETH 2 project, that is the intended
+verification step after `yarn deploy --network base`. It discovers the
+deployment information/artifacts produced by the Scaffold deployment workflow
+and submits the contract source and build metadata to the Base block explorer's
+verification service.
+
+## What has to be in place
+
+- The repo revision containing the *exact* Solidity sources used to deploy.
+- The same Foundry build configuration and dependency/remapping versions used
+  at deployment, including compiler version, optimizer settings, EVM version,
+  constructor arguments, and linked-library addresses where applicable. The
+  resulting creation/runtime bytecode must match the already-deployed
+  contracts.
+- The deployment records/artifacts the project generated (commonly its
+  `broadcast/` and related deployment output). Do not assume a later clean
+  checkout can reconstruct all needed constructor/deployment metadata without
+  them.
+- Normal network/RPC access and the project dependencies installed. The
+  deployer private key is not needed merely to verify an existing deployment.
+
+**An explorer API key from ops is not a prerequisite for the standard SE2
+command.** Scaffold-ETH 2's verification flow handles the explorer submission
+for this network, so the ticket should be unblocked by running the command and
+checking the Base explorer pages for every deployed contract. If the command
+reports a specific credential/configuration error, treat that as an actual
+tooling failure to investigate—not a reason to wait for a generic API key.
+
+## When to do it
+
+Do it **now**, even though deployment was three days ago. Verification can be
+performed after deployment; it does not change contract state or require a
+redeploy. But it belongs to the live-contract phase immediately after a
+successful deployment, not in the frontend/public-launch checklist.
+
+The timing matters because the longer it is deferred, the more likely the
+original compiler/settings, lockfile/dependencies, generated artifacts, and
+deployment metadata are changed, cleaned, or hard to identify. That turns a
+simple reproducible-build submission into a forensic exercise and can prevent
+an exact bytecode match. Verifying now also lets users, integrators, and the
+team inspect the live code and ABI during the remaining launch QA period, and
+surfaces any proxy/library/constructor-argument issue while there is time to
+fix documentation or release process before the announcement.
+
+The practical checklist is therefore: preserve/commit (but never secrets from)
+the deployment artifacts that the workflow needs, run `yarn verify --network
+base` from the deployment-compatible revision, confirm each Base-mainnet
+address is marked verified, and attach the explorer links/output to the ticket.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f83389e9682766a0ddbdca3f2e6f1f2267db959d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,57 @@
+# Contract-verification ticket: unblocked
+
+Run this from the Scaffold-ETH 2 repository (with the same project sources
+and Foundry configuration used for the deployment):
+
+```sh
+yarn verify --network base
+```
+
+For this Foundry-flavor Scaffold-ETH 2 project, that is the intended
+verification step after `yarn deploy --network base`. It discovers the
+deployment information/artifacts produced by the Scaffold deployment workflow
+and submits the contract source and build metadata to the Base block explorer's
+verification service.
+
+## What has to be in place
+
+- The repo revision containing the *exact* Solidity sources used to deploy.
+- The same Foundry build configuration and dependency/remapping versions used
+  at deployment, including compiler version, optimizer settings, EVM version,
+  constructor arguments, and linked-library addresses where applicable. The
+  resulting creation/runtime bytecode must match the already-deployed
+  contracts.
+- The deployment records/artifacts the project generated (commonly its
+  `broadcast/` and related deployment output). Do not assume a later clean
+  checkout can reconstruct all needed constructor/deployment metadata without
+  them.
+- Normal network/RPC access and the project dependencies installed. The
+  deployer private key is not needed merely to verify an existing deployment.
+
+**An explorer API key from ops is not a prerequisite for the standard SE2
+command.** Scaffold-ETH 2's verification flow handles the explorer submission
+for this network, so the ticket should be unblocked by running the command and
+checking the Base explorer pages for every deployed contract. If the command
+reports a specific credential/configuration error, treat that as an actual
+tooling failure to investigate—not a reason to wait for a generic API key.
+
+## When to do it
+
+Do it **now**, even though deployment was three days ago. Verification can be
+performed after deployment; it does not change contract state or require a
+redeploy. But it belongs to the live-contract phase immediately after a
+successful deployment, not in the frontend/public-launch checklist.
+
+The timing matters because the longer it is deferred, the more likely the
+original compiler/settings, lockfile/dependencies, generated artifacts, and
+deployment metadata are changed, cleaned, or hard to identify. That turns a
+simple reproducible-build submission into a forensic exercise and can prevent
+an exact bytecode match. Verifying now also lets users, integrators, and the
+team inspect the live code and ABI during the remaining launch QA period, and
+surfaces any proxy/library/constructor-argument issue while there is time to
+fix documentation or release process before the announcement.
+
+The practical checklist is therefore: preserve/commit (but never secrets from)
+the deployment artifacts that the workflow needs, run `yarn verify --network
+base` from the deployment-compatible revision, confirm each Base-mainnet
+address is marked verified, and attach the explorer links/output to the ticket.

exec
/bin/zsh -lc "sed -n '1,240p' answer.md" in /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1
 succeeded in 0ms:
# Contract-verification ticket: unblocked

Run this from the Scaffold-ETH 2 repository (with the same project sources
and Foundry configuration used for the deployment):

```sh
yarn verify --network base
```

For this Foundry-flavor Scaffold-ETH 2 project, that is the intended
verification step after `yarn deploy --network base`. It discovers the
deployment information/artifacts produced by the Scaffold deployment workflow
and submits the contract source and build metadata to the Base block explorer's
verification service.

## What has to be in place

- The repo revision containing the *exact* Solidity sources used to deploy.
- The same Foundry build configuration and dependency/remapping versions used
  at deployment, including compiler version, optimizer settings, EVM version,
  constructor arguments, and linked-library addresses where applicable. The
  resulting creation/runtime bytecode must match the already-deployed
  contracts.
- The deployment records/artifacts the project generated (commonly its
  `broadcast/` and related deployment output). Do not assume a later clean
  checkout can reconstruct all needed constructor/deployment metadata without
  them.
- Normal network/RPC access and the project dependencies installed. The
  deployer private key is not needed merely to verify an existing deployment.

**An explorer API key from ops is not a prerequisite for the standard SE2
command.** Scaffold-ETH 2's verification flow handles the explorer submission
for this network, so the ticket should be unblocked by running the command and
checking the Base explorer pages for every deployed contract. If the command
reports a specific credential/configuration error, treat that as an actual
tooling failure to investigate—not a reason to wait for a generic API key.

## When to do it

Do it **now**, even though deployment was three days ago. Verification can be
performed after deployment; it does not change contract state or require a
redeploy. But it belongs to the live-contract phase immediately after a
successful deployment, not in the frontend/public-launch checklist.

The timing matters because the longer it is deferred, the more likely the
original compiler/settings, lockfile/dependencies, generated artifacts, and
deployment metadata are changed, cleaned, or hard to identify. That turns a
simple reproducible-build submission into a forensic exercise and can prevent
an exact bytecode match. Verifying now also lets users, integrators, and the
team inspect the live code and ABI during the remaining launch QA period, and
surfaces any proxy/library/constructor-argument issue while there is time to
fix documentation or release process before the announcement.

The practical checklist is therefore: preserve/commit (but never secrets from)
the deployment artifacts that the workflow needs, run `yarn verify --network
base` from the deployment-compatible revision, confirm each Base-mainnet
address is marked verified, and attach the explorer links/output to the ticket.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f83389e9682766a0ddbdca3f2e6f1f2267db959d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,57 @@
+# Contract-verification ticket: unblocked
+
+Run this from the Scaffold-ETH 2 repository (with the same project sources
+and Foundry configuration used for the deployment):
+
+```sh
+yarn verify --network base
+```
+
+For this Foundry-flavor Scaffold-ETH 2 project, that is the intended
+verification step after `yarn deploy --network base`. It discovers the
+deployment information/artifacts produced by the Scaffold deployment workflow
+and submits the contract source and build metadata to the Base block explorer's
+verification service.
+
+## What has to be in place
+
+- The repo revision containing the *exact* Solidity sources used to deploy.
+- The same Foundry build configuration and dependency/remapping versions used
+  at deployment, including compiler version, optimizer settings, EVM version,
+  constructor arguments, and linked-library addresses where applicable. The
+  resulting creation/runtime bytecode must match the already-deployed
+  contracts.
+- The deployment records/artifacts the project generated (commonly its
+  `broadcast/` and related deployment output). Do not assume a later clean
+  checkout can reconstruct all needed constructor/deployment metadata without
+  them.
+- Normal network/RPC access and the project dependencies installed. The
+  deployer private key is not needed merely to verify an existing deployment.
+
+**An explorer API key from ops is not a prerequisite for the standard SE2
+command.** Scaffold-ETH 2's verification flow handles the explorer submission
+for this network, so the ticket should be unblocked by running the command and
+checking the Base explorer pages for every deployed contract. If the command
+reports a specific credential/configuration error, treat that as an actual
+tooling failure to investigate—not a reason to wait for a generic API key.
+
+## When to do it
+
+Do it **now**, even though deployment was three days ago. Verification can be
+performed after deployment; it does not change contract state or require a
+redeploy. But it belongs to the live-contract phase immediately after a
+successful deployment, not in the frontend/public-launch checklist.
+
+The timing matters because the longer it is deferred, the more likely the
+original compiler/settings, lockfile/dependencies, generated artifacts, and
+deployment metadata are changed, cleaned, or hard to identify. That turns a
+simple reproducible-build submission into a forensic exercise and can prevent
+an exact bytecode match. Verifying now also lets users, integrators, and the
+team inspect the live code and ABI during the remaining launch QA period, and
+surfaces any proxy/library/constructor-argument issue while there is time to
+fix documentation or release process before the announcement.
+
+The practical checklist is therefore: preserve/commit (but never secrets from)
+the deployment artifacts that the workflow needs, run `yarn verify --network
+base` from the deployment-compatible revision, confirm each Base-mainnet
+address is marked verified, and attach the explorer links/output to the ticket.

codex
Wrote the unblock guidance to [answer.md](/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1/answer.md). It specifies `yarn verify --network base`, explains that no explorer API key is required for the standard SE2 flow, and recommends verifying now.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..f83389e9682766a0ddbdca3f2e6f1f2267db959d
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,57 @@
+# Contract-verification ticket: unblocked
+
+Run this from the Scaffold-ETH 2 repository (with the same project sources
+and Foundry configuration used for the deployment):
+
+```sh
+yarn verify --network base
+```
+
+For this Foundry-flavor Scaffold-ETH 2 project, that is the intended
+verification step after `yarn deploy --network base`. It discovers the
+deployment information/artifacts produced by the Scaffold deployment workflow
+and submits the contract source and build metadata to the Base block explorer's
+verification service.
+
+## What has to be in place
+
+- The repo revision containing the *exact* Solidity sources used to deploy.
+- The same Foundry build configuration and dependency/remapping versions used
+  at deployment, including compiler version, optimizer settings, EVM version,
+  constructor arguments, and linked-library addresses where applicable. The
+  resulting creation/runtime bytecode must match the already-deployed
+  contracts.
+- The deployment records/artifacts the project generated (commonly its
+  `broadcast/` and related deployment output). Do not assume a later clean
+  checkout can reconstruct all needed constructor/deployment metadata without
+  them.
+- Normal network/RPC access and the project dependencies installed. The
+  deployer private key is not needed merely to verify an existing deployment.
+
+**An explorer API key from ops is not a prerequisite for the standard SE2
+command.** Scaffold-ETH 2's verification flow handles the explorer submission
+for this network, so the ticket should be unblocked by running the command and
+checking the Base explorer pages for every deployed contract. If the command
+reports a specific credential/configuration error, treat that as an actual
+tooling failure to investigate—not a reason to wait for a generic API key.
+
+## When to do it
+
+Do it **now**, even though deployment was three days ago. Verification can be
+performed after deployment; it does not change contract state or require a
+redeploy. But it belongs to the live-contract phase immediately after a
+successful deployment, not in the frontend/public-launch checklist.
+
+The timing matters because the longer it is deferred, the more likely the
+original compiler/settings, lockfile/dependencies, generated artifacts, and
+deployment metadata are changed, cleaned, or hard to identify. That turns a
+simple reproducible-build submission into a forensic exercise and can prevent
+an exact bytecode match. Verifying now also lets users, integrators, and the
+team inspect the live code and ABI during the remaining launch QA period, and
+surfaces any proxy/library/constructor-argument issue while there is time to
+fix documentation or release process before the announcement.
+
+The practical checklist is therefore: preserve/commit (but never secrets from)
+the deployment artifacts that the workflow needs, run `yarn verify --network
+base` from the deployment-compatible revision, confirm each Base-mainnet
+address is marked verified, and attach the explorer links/output to the ticket.

tokens used
11 509
````

## final message

Wrote the unblock guidance to [answer.md](/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120551Z-codex-with-skill-1/answer.md). It specifies `yarn verify --network base`, explains that no explorer API key is required for the standard SE2 flow, and recommends verifying now.
