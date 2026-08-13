# Executor transcript — 2026-08-13T120554Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120554Z-codex-with-skill-3

## session

````text
OpenAI Codex v0.146.0
--------
workdir: /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120554Z-codex-with-skill-3
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: medium
reasoning summaries: none
session id: 019ffb0c-a7da-70a1-9b78-877f8c32532a
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
I’m using the project’s orchestration guidance because this is specifically a Scaffold‑ETH 2 deployment/verification workflow. I’ll turn it into a concrete, launch-safe runbook and write it to `answer.md`.
exec
/bin/zsh -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md" in /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120554Z-codex-with-skill-3
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
/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120554Z-codex-with-skill-3/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..85c50afd891b106db2e62283f6dd5df2f662ceba
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,59 @@
+# Unblock the Base verification ticket
+
+Run this from the Scaffold-ETH 2 repository root:
+
+```bash
+yarn verify --network base
+```
+
+Run it **now**, not as part of the public-launch checklist.  In the
+Scaffold-ETH 2 Foundry workflow, verification belongs immediately after a
+successful `yarn deploy --network base`; it does not require an explorer API
+key.  The existing ticket should therefore be unblocked by removing the
+"waiting for ops" dependency and scheduling the command in the current
+release-maintenance window.
+
+## What must be available
+
+- The same repository revision (or, at minimum, the exact Solidity sources)
+  that produced the deployed bytecode, including any local dependencies.
+- The original compiler version, optimizer/via-IR settings, EVM version,
+  constructor arguments, libraries, and contract names.  In practice, use the
+  deploy commit and keep its Foundry configuration and deployment/broadcast
+  artifacts intact; changing these can make bytecode reproduction fail.
+- A working Base RPC/network configuration and normal developer tooling
+  installed (`yarn install`).
+- Internet access to the verification service/block explorer.  A funded
+  deployer wallet is *not* needed for verification because no transaction is
+  sent.
+
+Do not put an explorer, RPC, wallet, or other credential into source control.
+If the project has separately configured secrets, keep them only in ignored
+environment files; they are not a prerequisite for the standard SE2 verify
+command.
+
+## Suggested runbook
+
+1. Check out the commit used for the Base deployment and preserve its
+   deployment records.
+2. From the repo root, run `yarn install` if dependencies are not already
+   present.
+3. Run `yarn verify --network base`.
+4. Open BaseScan (or the explorer reported by the command) for every deployed
+   contract and confirm that source code, compiler settings, constructor
+   arguments, and proxy implementation (if applicable) are shown correctly.
+5. Record the verified explorer links in the release notes and close the
+   ticket. If it fails, save the full command output and resolve the
+   reproducibility mismatch while the deploy context is still fresh.
+
+## Why timing matters
+
+Verification is a Phase-2 deployment validation gate, whereas a public
+announcement is Phase 3.  Waiting adds no benefit and turns a small,
+diagnosable deployment follow-up into a launch-day dependency.  It also makes
+failure more likely to be expensive: build settings, artifact locations,
+library addresses, constructor inputs, and deploy knowledge can drift or be
+lost over weeks.  Verifying now gives users and reviewers readable source
+before public attention arrives, exposes an accidental wrong build or address
+early, and leaves the launch checklist focused on production frontend QA and
+communications rather than contract forensics.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..85c50afd891b106db2e62283f6dd5df2f662ceba
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,59 @@
+# Unblock the Base verification ticket
+
+Run this from the Scaffold-ETH 2 repository root:
+
+```bash
+yarn verify --network base
+```
+
+Run it **now**, not as part of the public-launch checklist.  In the
+Scaffold-ETH 2 Foundry workflow, verification belongs immediately after a
+successful `yarn deploy --network base`; it does not require an explorer API
+key.  The existing ticket should therefore be unblocked by removing the
+"waiting for ops" dependency and scheduling the command in the current
+release-maintenance window.
+
+## What must be available
+
+- The same repository revision (or, at minimum, the exact Solidity sources)
+  that produced the deployed bytecode, including any local dependencies.
+- The original compiler version, optimizer/via-IR settings, EVM version,
+  constructor arguments, libraries, and contract names.  In practice, use the
+  deploy commit and keep its Foundry configuration and deployment/broadcast
+  artifacts intact; changing these can make bytecode reproduction fail.
+- A working Base RPC/network configuration and normal developer tooling
+  installed (`yarn install`).
+- Internet access to the verification service/block explorer.  A funded
+  deployer wallet is *not* needed for verification because no transaction is
+  sent.
+
+Do not put an explorer, RPC, wallet, or other credential into source control.
+If the project has separately configured secrets, keep them only in ignored
+environment files; they are not a prerequisite for the standard SE2 verify
+command.
+
+## Suggested runbook
+
+1. Check out the commit used for the Base deployment and preserve its
+   deployment records.
+2. From the repo root, run `yarn install` if dependencies are not already
+   present.
+3. Run `yarn verify --network base`.
+4. Open BaseScan (or the explorer reported by the command) for every deployed
+   contract and confirm that source code, compiler settings, constructor
+   arguments, and proxy implementation (if applicable) are shown correctly.
+5. Record the verified explorer links in the release notes and close the
+   ticket. If it fails, save the full command output and resolve the
+   reproducibility mismatch while the deploy context is still fresh.
+
+## Why timing matters
+
+Verification is a Phase-2 deployment validation gate, whereas a public
+announcement is Phase 3.  Waiting adds no benefit and turns a small,
+diagnosable deployment follow-up into a launch-day dependency.  It also makes
+failure more likely to be expensive: build settings, artifact locations,
+library addresses, constructor inputs, and deploy knowledge can drift or be
+lost over weeks.  Verifying now gives users and reviewers readable source
+before public attention arrives, exposes an accidental wrong build or address
+early, and leaves the launch checklist focused on production frontend QA and
+communications rather than contract forensics.

exec
/bin/zsh -lc "sed -n '1,240p' answer.md && git diff --check" in /Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120554Z-codex-with-skill-3
 succeeded in 0ms:
# Unblock the Base verification ticket

Run this from the Scaffold-ETH 2 repository root:

```bash
yarn verify --network base
```

Run it **now**, not as part of the public-launch checklist.  In the
Scaffold-ETH 2 Foundry workflow, verification belongs immediately after a
successful `yarn deploy --network base`; it does not require an explorer API
key.  The existing ticket should therefore be unblocked by removing the
"waiting for ops" dependency and scheduling the command in the current
release-maintenance window.

## What must be available

- The same repository revision (or, at minimum, the exact Solidity sources)
  that produced the deployed bytecode, including any local dependencies.
- The original compiler version, optimizer/via-IR settings, EVM version,
  constructor arguments, libraries, and contract names.  In practice, use the
  deploy commit and keep its Foundry configuration and deployment/broadcast
  artifacts intact; changing these can make bytecode reproduction fail.
- A working Base RPC/network configuration and normal developer tooling
  installed (`yarn install`).
- Internet access to the verification service/block explorer.  A funded
  deployer wallet is *not* needed for verification because no transaction is
  sent.

Do not put an explorer, RPC, wallet, or other credential into source control.
If the project has separately configured secrets, keep them only in ignored
environment files; they are not a prerequisite for the standard SE2 verify
command.

## Suggested runbook

1. Check out the commit used for the Base deployment and preserve its
   deployment records.
2. From the repo root, run `yarn install` if dependencies are not already
   present.
3. Run `yarn verify --network base`.
4. Open BaseScan (or the explorer reported by the command) for every deployed
   contract and confirm that source code, compiler settings, constructor
   arguments, and proxy implementation (if applicable) are shown correctly.
5. Record the verified explorer links in the release notes and close the
   ticket. If it fails, save the full command output and resolve the
   reproducibility mismatch while the deploy context is still fresh.

## Why timing matters

Verification is a Phase-2 deployment validation gate, whereas a public
announcement is Phase 3.  Waiting adds no benefit and turns a small,
diagnosable deployment follow-up into a launch-day dependency.  It also makes
failure more likely to be expensive: build settings, artifact locations,
library addresses, constructor inputs, and deploy knowledge can drift or be
lost over weeks.  Verifying now gives users and reviewers readable source
before public attention arrives, exposes an accidental wrong build or address
early, and leaves the launch checklist focused on production frontend QA and
communications rather than contract forensics.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..85c50afd891b106db2e62283f6dd5df2f662ceba
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,59 @@
+# Unblock the Base verification ticket
+
+Run this from the Scaffold-ETH 2 repository root:
+
+```bash
+yarn verify --network base
+```
+
+Run it **now**, not as part of the public-launch checklist.  In the
+Scaffold-ETH 2 Foundry workflow, verification belongs immediately after a
+successful `yarn deploy --network base`; it does not require an explorer API
+key.  The existing ticket should therefore be unblocked by removing the
+"waiting for ops" dependency and scheduling the command in the current
+release-maintenance window.
+
+## What must be available
+
+- The same repository revision (or, at minimum, the exact Solidity sources)
+  that produced the deployed bytecode, including any local dependencies.
+- The original compiler version, optimizer/via-IR settings, EVM version,
+  constructor arguments, libraries, and contract names.  In practice, use the
+  deploy commit and keep its Foundry configuration and deployment/broadcast
+  artifacts intact; changing these can make bytecode reproduction fail.
+- A working Base RPC/network configuration and normal developer tooling
+  installed (`yarn install`).
+- Internet access to the verification service/block explorer.  A funded
+  deployer wallet is *not* needed for verification because no transaction is
+  sent.
+
+Do not put an explorer, RPC, wallet, or other credential into source control.
+If the project has separately configured secrets, keep them only in ignored
+environment files; they are not a prerequisite for the standard SE2 verify
+command.
+
+## Suggested runbook
+
+1. Check out the commit used for the Base deployment and preserve its
+   deployment records.
+2. From the repo root, run `yarn install` if dependencies are not already
+   present.
+3. Run `yarn verify --network base`.
+4. Open BaseScan (or the explorer reported by the command) for every deployed
+   contract and confirm that source code, compiler settings, constructor
+   arguments, and proxy implementation (if applicable) are shown correctly.
+5. Record the verified explorer links in the release notes and close the
+   ticket. If it fails, save the full command output and resolve the
+   reproducibility mismatch while the deploy context is still fresh.
+
+## Why timing matters
+
+Verification is a Phase-2 deployment validation gate, whereas a public
+announcement is Phase 3.  Waiting adds no benefit and turns a small,
+diagnosable deployment follow-up into a launch-day dependency.  It also makes
+failure more likely to be expensive: build settings, artifact locations,
+library addresses, constructor inputs, and deploy knowledge can drift or be
+lost over weeks.  Verifying now gives users and reviewers readable source
+before public attention arrives, exposes an accidental wrong build or address
+early, and leaves the launch checklist focused on production frontend QA and
+communications rather than contract forensics.

codex
Wrote the verification runbook to [answer.md](/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120554Z-codex-with-skill-3/answer.md). It specifies `yarn verify --network base`, explains no explorer API key is required in this SE2 workflow, and recommends verifying now rather than at launch.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..85c50afd891b106db2e62283f6dd5df2f662ceba
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,59 @@
+# Unblock the Base verification ticket
+
+Run this from the Scaffold-ETH 2 repository root:
+
+```bash
+yarn verify --network base
+```
+
+Run it **now**, not as part of the public-launch checklist.  In the
+Scaffold-ETH 2 Foundry workflow, verification belongs immediately after a
+successful `yarn deploy --network base`; it does not require an explorer API
+key.  The existing ticket should therefore be unblocked by removing the
+"waiting for ops" dependency and scheduling the command in the current
+release-maintenance window.
+
+## What must be available
+
+- The same repository revision (or, at minimum, the exact Solidity sources)
+  that produced the deployed bytecode, including any local dependencies.
+- The original compiler version, optimizer/via-IR settings, EVM version,
+  constructor arguments, libraries, and contract names.  In practice, use the
+  deploy commit and keep its Foundry configuration and deployment/broadcast
+  artifacts intact; changing these can make bytecode reproduction fail.
+- A working Base RPC/network configuration and normal developer tooling
+  installed (`yarn install`).
+- Internet access to the verification service/block explorer.  A funded
+  deployer wallet is *not* needed for verification because no transaction is
+  sent.
+
+Do not put an explorer, RPC, wallet, or other credential into source control.
+If the project has separately configured secrets, keep them only in ignored
+environment files; they are not a prerequisite for the standard SE2 verify
+command.
+
+## Suggested runbook
+
+1. Check out the commit used for the Base deployment and preserve its
+   deployment records.
+2. From the repo root, run `yarn install` if dependencies are not already
+   present.
+3. Run `yarn verify --network base`.
+4. Open BaseScan (or the explorer reported by the command) for every deployed
+   contract and confirm that source code, compiler settings, constructor
+   arguments, and proxy implementation (if applicable) are shown correctly.
+5. Record the verified explorer links in the release notes and close the
+   ticket. If it fails, save the full command output and resolve the
+   reproducibility mismatch while the deploy context is still fresh.
+
+## Why timing matters
+
+Verification is a Phase-2 deployment validation gate, whereas a public
+announcement is Phase 3.  Waiting adds no benefit and turns a small,
+diagnosable deployment follow-up into a launch-day dependency.  It also makes
+failure more likely to be expensive: build settings, artifact locations,
+library addresses, constructor inputs, and deploy knowledge can drift or be
+lost over weeks.  Verifying now gives users and reviewers readable source
+before public attention arrives, exposes an accidental wrong build or address
+early, and leaves the launch checklist focused on production frontend QA and
+communications rather than contract forensics.

tokens used
16 421
````

## final message

Wrote the verification runbook to [answer.md](/Users/liana/.cache/ethskills-evals/orchestration-quiz-001/2026-08-13T120554Z-codex-with-skill-3/answer.md). It specifies `yarn verify --network base`, explains no explorer API key is required in this SE2 workflow, and recommends verifying now rather than at launch.
