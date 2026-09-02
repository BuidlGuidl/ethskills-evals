# Executor transcript — 2026-08-13T120553Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120553Z-codex-with-skill-2

## session

````text
OpenAI Codex v0.146.0
--------
workdir: /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120553Z-codex-with-skill-2
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: medium
reasoning summaries: none
session id: 019ffb0c-a966-7430-911a-c5f89615bf56
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
I’m using the Scaffold‑ETH orchestration guidance here because the question is specifically about its deployment/verification workflow. I’ll translate it into an actionable Base-mainnet runbook and write it to `answer.md`.
exec
/bin/zsh -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md" in /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120553Z-codex-with-skill-2
 succeeded in 0ms:
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
/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120553Z-codex-with-skill-2/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..89cb52ca123a2091b0ddd101756c4d945ee58ee3
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Base mainnet contract verification
+
+The ticket is not blocked on an explorer API key.  In Scaffold-ETH 2's Foundry workflow, verification is handled by the project tooling; the prescribed command is:
+
+```bash
+# From the original Scaffold-ETH 2 project root
+yarn verify --network base
+```
+
+Run it **now**, against the contracts deployed three days ago.  It is a Phase-2 (live-contracts) task, not a launch-checklist item.  Once it succeeds, confirm each deployed Base address shows its source and compiler settings on the explorer, then close the ticket.  It can remain as a launch checklist *assertion* ("contracts are already verified"), but verification itself should not wait for launch.
+
+## What must be in place
+
+- Access to the original repository at the exact source revision used for the Base deployment, including the Foundry deploy scripts and generated deployment/build artifacts.  Do not attempt verification from a reconstructed or later-changed contract tree.
+- The project dependencies and environment needed to run its normal `yarn` scripts (including its configured Base network/RPC access).  Follow the repository's existing secret-loading pattern; do not put RPC credentials, private keys, or any other secrets in `scaffold.config.ts` or Git.
+- The deployed contract addresses and the exact compilation inputs that produced their bytecode: Solidity sources (including dependencies), compiler version/settings, constructor arguments, and any linked-library addresses.  The normal SE2 deploy/verification artifacts supply this when retained.
+- A reachable Base mainnet RPC and the contracts' deployment transactions finalized on Base.  They already are, given the working live app and three-day-old deployment.
+
+An API key from Basescan/another block explorer is **not** a prerequisite for this Scaffold-ETH 2 verification command.  Cancel or reclassify the ops-key dependency rather than waiting for next sprint.  If the command reports a concrete project-specific configuration error, capture that error and fix only that missing configuration; it is not a reason to defer verification wholesale.
+
+## Why the timing matters
+
+Verification proves that the published, human-readable source and compiler settings match the bytecode users are interacting with.  Doing it immediately while the deployment context is fresh makes the required constructor arguments, library addresses, compiler settings, and artifact files easy to recover and diagnose.  Delaying until launch increases the chance that source/dependencies/configuration have drifted, build or broadcast artifacts have been cleaned up, or the original deployer context is unavailable—turning a one-command post-deploy check into an incident during a time-critical launch window.
+
+It also gives users, integrators, security reviewers, and support staff a verified source of truth before publicity drives traffic.  If verification exposes a mismatch or omitted metadata, the team still has time to investigate and make a measured decision before the announcement.  Launch day should focus on frontend release and final QA, not on discovering whether the live contracts can be independently inspected.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..89cb52ca123a2091b0ddd101756c4d945ee58ee3
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Base mainnet contract verification
+
+The ticket is not blocked on an explorer API key.  In Scaffold-ETH 2's Foundry workflow, verification is handled by the project tooling; the prescribed command is:
+
+```bash
+# From the original Scaffold-ETH 2 project root
+yarn verify --network base
+```
+
+Run it **now**, against the contracts deployed three days ago.  It is a Phase-2 (live-contracts) task, not a launch-checklist item.  Once it succeeds, confirm each deployed Base address shows its source and compiler settings on the explorer, then close the ticket.  It can remain as a launch checklist *assertion* ("contracts are already verified"), but verification itself should not wait for launch.
+
+## What must be in place
+
+- Access to the original repository at the exact source revision used for the Base deployment, including the Foundry deploy scripts and generated deployment/build artifacts.  Do not attempt verification from a reconstructed or later-changed contract tree.
+- The project dependencies and environment needed to run its normal `yarn` scripts (including its configured Base network/RPC access).  Follow the repository's existing secret-loading pattern; do not put RPC credentials, private keys, or any other secrets in `scaffold.config.ts` or Git.
+- The deployed contract addresses and the exact compilation inputs that produced their bytecode: Solidity sources (including dependencies), compiler version/settings, constructor arguments, and any linked-library addresses.  The normal SE2 deploy/verification artifacts supply this when retained.
+- A reachable Base mainnet RPC and the contracts' deployment transactions finalized on Base.  They already are, given the working live app and three-day-old deployment.
+
+An API key from Basescan/another block explorer is **not** a prerequisite for this Scaffold-ETH 2 verification command.  Cancel or reclassify the ops-key dependency rather than waiting for next sprint.  If the command reports a concrete project-specific configuration error, capture that error and fix only that missing configuration; it is not a reason to defer verification wholesale.
+
+## Why the timing matters
+
+Verification proves that the published, human-readable source and compiler settings match the bytecode users are interacting with.  Doing it immediately while the deployment context is fresh makes the required constructor arguments, library addresses, compiler settings, and artifact files easy to recover and diagnose.  Delaying until launch increases the chance that source/dependencies/configuration have drifted, build or broadcast artifacts have been cleaned up, or the original deployer context is unavailable—turning a one-command post-deploy check into an incident during a time-critical launch window.
+
+It also gives users, integrators, security reviewers, and support staff a verified source of truth before publicity drives traffic.  If verification exposes a mismatch or omitted metadata, the team still has time to investigate and make a measured decision before the announcement.  Launch day should focus on frontend release and final QA, not on discovering whether the live contracts can be independently inspected.

exec
/bin/zsh -lc "sed -n '1,240p' answer.md" in /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120553Z-codex-with-skill-2
 succeeded in 0ms:
# Base mainnet contract verification

The ticket is not blocked on an explorer API key.  In Scaffold-ETH 2's Foundry workflow, verification is handled by the project tooling; the prescribed command is:

```bash
# From the original Scaffold-ETH 2 project root
yarn verify --network base
```

Run it **now**, against the contracts deployed three days ago.  It is a Phase-2 (live-contracts) task, not a launch-checklist item.  Once it succeeds, confirm each deployed Base address shows its source and compiler settings on the explorer, then close the ticket.  It can remain as a launch checklist *assertion* ("contracts are already verified"), but verification itself should not wait for launch.

## What must be in place

- Access to the original repository at the exact source revision used for the Base deployment, including the Foundry deploy scripts and generated deployment/build artifacts.  Do not attempt verification from a reconstructed or later-changed contract tree.
- The project dependencies and environment needed to run its normal `yarn` scripts (including its configured Base network/RPC access).  Follow the repository's existing secret-loading pattern; do not put RPC credentials, private keys, or any other secrets in `scaffold.config.ts` or Git.
- The deployed contract addresses and the exact compilation inputs that produced their bytecode: Solidity sources (including dependencies), compiler version/settings, constructor arguments, and any linked-library addresses.  The normal SE2 deploy/verification artifacts supply this when retained.
- A reachable Base mainnet RPC and the contracts' deployment transactions finalized on Base.  They already are, given the working live app and three-day-old deployment.

An API key from Basescan/another block explorer is **not** a prerequisite for this Scaffold-ETH 2 verification command.  Cancel or reclassify the ops-key dependency rather than waiting for next sprint.  If the command reports a concrete project-specific configuration error, capture that error and fix only that missing configuration; it is not a reason to defer verification wholesale.

## Why the timing matters

Verification proves that the published, human-readable source and compiler settings match the bytecode users are interacting with.  Doing it immediately while the deployment context is fresh makes the required constructor arguments, library addresses, compiler settings, and artifact files easy to recover and diagnose.  Delaying until launch increases the chance that source/dependencies/configuration have drifted, build or broadcast artifacts have been cleaned up, or the original deployer context is unavailable—turning a one-command post-deploy check into an incident during a time-critical launch window.

It also gives users, integrators, security reviewers, and support staff a verified source of truth before publicity drives traffic.  If verification exposes a mismatch or omitted metadata, the team still has time to investigate and make a measured decision before the announcement.  Launch day should focus on frontend release and final QA, not on discovering whether the live contracts can be independently inspected.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..89cb52ca123a2091b0ddd101756c4d945ee58ee3
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Base mainnet contract verification
+
+The ticket is not blocked on an explorer API key.  In Scaffold-ETH 2's Foundry workflow, verification is handled by the project tooling; the prescribed command is:
+
+```bash
+# From the original Scaffold-ETH 2 project root
+yarn verify --network base
+```
+
+Run it **now**, against the contracts deployed three days ago.  It is a Phase-2 (live-contracts) task, not a launch-checklist item.  Once it succeeds, confirm each deployed Base address shows its source and compiler settings on the explorer, then close the ticket.  It can remain as a launch checklist *assertion* ("contracts are already verified"), but verification itself should not wait for launch.
+
+## What must be in place
+
+- Access to the original repository at the exact source revision used for the Base deployment, including the Foundry deploy scripts and generated deployment/build artifacts.  Do not attempt verification from a reconstructed or later-changed contract tree.
+- The project dependencies and environment needed to run its normal `yarn` scripts (including its configured Base network/RPC access).  Follow the repository's existing secret-loading pattern; do not put RPC credentials, private keys, or any other secrets in `scaffold.config.ts` or Git.
+- The deployed contract addresses and the exact compilation inputs that produced their bytecode: Solidity sources (including dependencies), compiler version/settings, constructor arguments, and any linked-library addresses.  The normal SE2 deploy/verification artifacts supply this when retained.
+- A reachable Base mainnet RPC and the contracts' deployment transactions finalized on Base.  They already are, given the working live app and three-day-old deployment.
+
+An API key from Basescan/another block explorer is **not** a prerequisite for this Scaffold-ETH 2 verification command.  Cancel or reclassify the ops-key dependency rather than waiting for next sprint.  If the command reports a concrete project-specific configuration error, capture that error and fix only that missing configuration; it is not a reason to defer verification wholesale.
+
+## Why the timing matters
+
+Verification proves that the published, human-readable source and compiler settings match the bytecode users are interacting with.  Doing it immediately while the deployment context is fresh makes the required constructor arguments, library addresses, compiler settings, and artifact files easy to recover and diagnose.  Delaying until launch increases the chance that source/dependencies/configuration have drifted, build or broadcast artifacts have been cleaned up, or the original deployer context is unavailable—turning a one-command post-deploy check into an incident during a time-critical launch window.
+
+It also gives users, integrators, security reviewers, and support staff a verified source of truth before publicity drives traffic.  If verification exposes a mismatch or omitted metadata, the team still has time to investigate and make a measured decision before the announcement.  Launch day should focus on frontend release and final QA, not on discovering whether the live contracts can be independently inspected.

codex
Wrote the verification runbook to [answer.md](/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120553Z-codex-with-skill-2/answer.md). It identifies `yarn verify --network base`, explains why an explorer API key is not the blocker, and recommends verifying immediately rather than at launch.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..89cb52ca123a2091b0ddd101756c4d945ee58ee3
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,25 @@
+# Base mainnet contract verification
+
+The ticket is not blocked on an explorer API key.  In Scaffold-ETH 2's Foundry workflow, verification is handled by the project tooling; the prescribed command is:
+
+```bash
+# From the original Scaffold-ETH 2 project root
+yarn verify --network base
+```
+
+Run it **now**, against the contracts deployed three days ago.  It is a Phase-2 (live-contracts) task, not a launch-checklist item.  Once it succeeds, confirm each deployed Base address shows its source and compiler settings on the explorer, then close the ticket.  It can remain as a launch checklist *assertion* ("contracts are already verified"), but verification itself should not wait for launch.
+
+## What must be in place
+
+- Access to the original repository at the exact source revision used for the Base deployment, including the Foundry deploy scripts and generated deployment/build artifacts.  Do not attempt verification from a reconstructed or later-changed contract tree.
+- The project dependencies and environment needed to run its normal `yarn` scripts (including its configured Base network/RPC access).  Follow the repository's existing secret-loading pattern; do not put RPC credentials, private keys, or any other secrets in `scaffold.config.ts` or Git.
+- The deployed contract addresses and the exact compilation inputs that produced their bytecode: Solidity sources (including dependencies), compiler version/settings, constructor arguments, and any linked-library addresses.  The normal SE2 deploy/verification artifacts supply this when retained.
+- A reachable Base mainnet RPC and the contracts' deployment transactions finalized on Base.  They already are, given the working live app and three-day-old deployment.
+
+An API key from Basescan/another block explorer is **not** a prerequisite for this Scaffold-ETH 2 verification command.  Cancel or reclassify the ops-key dependency rather than waiting for next sprint.  If the command reports a concrete project-specific configuration error, capture that error and fix only that missing configuration; it is not a reason to defer verification wholesale.
+
+## Why the timing matters
+
+Verification proves that the published, human-readable source and compiler settings match the bytecode users are interacting with.  Doing it immediately while the deployment context is fresh makes the required constructor arguments, library addresses, compiler settings, and artifact files easy to recover and diagnose.  Delaying until launch increases the chance that source/dependencies/configuration have drifted, build or broadcast artifacts have been cleaned up, or the original deployer context is unavailable—turning a one-command post-deploy check into an incident during a time-critical launch window.
+
+It also gives users, integrators, security reviewers, and support staff a verified source of truth before publicity drives traffic.  If verification exposes a mismatch or omitted metadata, the team still has time to investigate and make a measured decision before the announcement.  Launch day should focus on frontend release and final QA, not on discovering whether the live contracts can be independently inspected.

tokens used
11 753
````

## final message

Wrote the verification runbook to [answer.md](/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120553Z-codex-with-skill-2/answer.md). It identifies `yarn verify --network base`, explains why an explorer API key is not the blocker, and recommends verifying immediately rather than at launch.
