# Executor transcript — 2026-08-13T120625Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3

## session

````text
OpenAI Codex v0.146.0
--------
workdir: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: medium
reasoning summaries: none
session id: 019ffb13-311e-7c50-bfe0-de5b54574016
--------
user
We're a two-person team with a working Scaffold-ETH 2 dApp (foundry
flavor): a creator-tipping app where fans tip creators in USDC and the
contract takes a 1% platform fee. Everything runs and passes tests on the
local fork — the full user journey works with a browser wallet against
localhost.

Nothing has touched a live network yet: no live deployment, no funded
accounts, nothing public. Target chain is Base. We want real users on a
public URL.

Write LAUNCH.md in this directory — the repo itself isn't checked out
here, the document is the whole deliverable: the complete ordered path
from where we are today to live in production — the exact commands and
config changes at each step, what we check before moving to the next
step, and, where something can go wrong, how we'd catch it before users
do. Assume we'll follow it verbatim, so order matters.

codex
I’ll use the Scaffold-ETH orchestration workflow to turn your local-ready state into a guarded Base mainnet launch runbook, and verify current Base and deployment details against primary documentation.
exec
/bin/zsh -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3
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

web search: 
web search: site:docs.base.org base mainnet chain ID 8453 RPC https://mainnet.base.org ...
exec
/bin/zsh -lc "ls -la && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -80" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3
 succeeded in 0ms:
total 16
drwxr-xr-x@  6 liana  staff  192 Aug 13 16:06 .
drwxr-xr-x@  8 liana  staff  256 Aug 13 16:06 ..
drwxr-xr-x@  3 liana  staff   96 Aug 13 16:06 .agents
drwxr-xr-x@ 12 liana  staff  384 Aug 13 16:06 .git
-rw-r--r--@  1 liana  staff  865 Aug 13 16:06 TASK.md
-rw-r--r--@  1 liana  staff   50 Aug 13 16:06 package.json
TASK.md
package.json

codex
I confirmed the production constants that matter most: Base mainnet is chain ID 8453, and native USDC on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. I’m making the runbook deliberately stop at verification gates rather than treating deployment as the finish line.
apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..1138bfa021f3fa5d0595ac6d9685950cd6b3c1bf
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,420 @@
+# Base Mainnet Launch Runbook — creator tipping
+
+This is the ordered launch procedure for the existing Scaffold-ETH 2
+**Foundry** project. Perform it from a fresh clone of the application repo
+root; this directory contains only this runbook. Do not skip a stop condition.
+
+Two people are assumed:
+
+* **Operator** owns the deployment/key-management steps and never shares a
+  private key or seed phrase.
+* **Verifier** independently checks addresses, transactions, contract source,
+  and the public site using a separate wallet.
+
+Neither person should use their daily wallet for deployment or testing. Create
+three separate wallets: an offline/SAFE **fee-recipient** wallet, a minimal
+balance **deployer** wallet, and a **test-fan** wallet. The deployer must have
+only enough Base ETH to deploy and verify. Do not put the fee-recipient key in
+a browser extension or `.env` file.
+
+## Production values (write these down before editing)
+
+| Item | Required value |
+| --- | --- |
+| Network | Base Mainnet |
+| Chain ID | `8453` |
+| Native gas token | ETH |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Platform fee | `100` basis points (`1%`) |
+| Base Sepolia chain ID | `84532` |
+| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use a paid, production-grade RPC provider for the application and deployment;
+the public `https://mainnet.base.org` endpoint is rate limited and is not a
+production endpoint. The canonical USDC values above come from Circle, not a
+token list. Confirm them again against Circle's USDC address page on launch
+day.
+
+## 0. Freeze the candidate and prepare secure access
+
+1. Clone the exact candidate that passed the local-fork journey, install its
+   locked dependencies, and record the commit.
+
+   ```bash
+   git clone <REPOSITORY_URL> creator-tips
+   cd creator-tips
+   git checkout <APPROVED_COMMIT_SHA>
+   yarn install --immutable
+   git rev-parse HEAD
+   ```
+
+   If the project does not use a committed Yarn lockfile, stop and create one;
+   do not launch from floating dependencies.
+
+2. Make the deployment account only on a hardware wallet or in Foundry's
+   encrypted keystore. The following creates a local encrypted key entry and
+   prompts for the private key and a password; it does **not** print it.
+
+   ```bash
+   cast wallet import base-deployer --interactive
+   cast wallet address --account base-deployer
+   ```
+
+   Send a modest amount of Base ETH to that displayed address from a separate
+   funding wallet. Start with more than the estimated deployment gas plus a
+   conservative buffer, not with the project treasury. Verify the recipient
+   character-for-character in the hardware wallet before sending.
+
+3. Have the Verifier fund the test-fan wallet with a small amount of Base ETH
+   and a deliberately tiny amount of *canonical* Base USDC (for example,
+   $2–$5). They must independently check the token contract address before the
+   transfer. Never test a real tip with a large balance.
+
+4. Create local secret files. Replace every angle-bracket value, then restrict
+   file permissions. The RPC URL may contain a secret; it must never enter a
+   source file, terminal recording, screenshot, or commit.
+
+   ```bash
+   umask 077
+   cp .env.example .env.local 2>/dev/null || touch .env.local
+   ```
+
+   Put only the variables actually consumed by this project in `.env.local`.
+   Typical values are:
+
+   ```dotenv
+   BASE_RPC_URL="https://<YOUR-PRODUCTION-RPC>/..."
+   NEXT_PUBLIC_BASE_RPC="https://<YOUR-PRODUCTION-RPC>/..."
+   ```
+
+   If the Foundry deploy script reads `PRIVATE_KEY`, do **not** add one. Change
+   that script to use `--account base-deployer` / the encrypted keystore before
+   proceeding. A private key must not appear in a project environment file.
+
+5. Confirm secrets cannot be committed:
+
+   ```bash
+   rg -n --hidden -g '!node_modules' -g '!broadcast' -g '!cache' \
+     '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]|infura\.io/v3/[A-Za-z0-9]' .
+   rg -n --hidden '^\.env(\.|$)|^broadcast/$|^cache/$|^\*\.key$' .gitignore
+   git status --short
+   ```
+
+   The first command must return no secrets. `.gitignore` must include `.env`,
+   `.env.*`, `*.key`, `broadcast/`, `cache/`, and `node_modules/`. If it does
+   not, add the missing entries now, then rerun the check. Never commit
+   `.env.local`.
+
+**Gate 0:** Operator and Verifier agree on the recorded commit, deployer
+address, fee-recipient address, canonical USDC address, and test-fan address.
+All three keys are separate. If any key was pasted into a file, shell history,
+chat, or git, abandon/rotate it before continuing.
+
+## 1. Production-readiness audit (before any public deployment)
+
+1. Open the Solidity contracts, deploy script, and tests. The Verifier checks
+   these facts in the actual code—not just the UI:
+
+   * Constructor/configuration pins the Base **canonical** USDC address above;
+     it cannot accept an arbitrary caller-supplied token.
+   * All USDC amounts use `6` decimals. A $1.00 tip is `1_000_000`, never
+     `1e18`.
+   * Fee math is integer-safe and exact: `fee = amount * 100 / 10_000`;
+     payout and fee add back to `amount`; define and test the rounding outcome
+     for tiny tips.
+   * The fee recipient is the agreed Safe/offline address, not the deployer;
+     changing it (if supported) is access-controlled and emits an event.
+   * The tip transfer uses a safe ERC-20 transfer method, checks its result,
+     and follows checks-effects-interactions / reentrancy protection. No funds
+     can be trapped by a failing recipient path.
+   * Creator withdrawal/tip payout behavior, duplicate creator registration,
+     zero address, zero amount, paused state, and unauthorized admin calls are
+     explicitly tested. If there is an owner/admin, document its powers in the
+     UI and set it to a Safe or restricted operational wallet—not an EOA used
+     for deployment.
+   * No upgrade proxy, delegatecall, unrestricted withdrawal, or token rescue
+     function exists unless it is intentional, documented, access-controlled,
+     and covered by tests.
+
+2. Add a regression test for every finding. At a minimum add tests for a
+   $1.00 tip, the smallest allowed tip, a non-round fee, exact fee/payout
+   accounting, wrong-token rejection, failed USDC transfer, invalid recipient,
+   unauthorized configuration, and reentrancy attempt. Run the actual suite:
+
+   ```bash
+   yarn test
+   cd packages/foundry
+   forge test -vvv
+   forge coverage
+   cd ../..
+   yarn lint
+   yarn build
+   ```
+
+   Use the repository's equivalent commands only if its `package.json` names
+   differ. Do not waive a failing test, lint warning that affects runtime, or
+   production build error. Commit the resulting audit/test fixes and repeat
+   Gate 0's secret scan before every commit.
+
+3. Inspect the frontend's production configuration:
+
+   * In `packages/nextjs/scaffold.config.ts`, set
+     `targetNetworks: [chains.base]` (using the project's imported `base`
+     chain) and `burnerWalletMode: "localNetworksOnly"`.
+   * Configure RPC overrides from environment variables only, for example:
+
+     ```ts
+     rpcOverrides: {
+       [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
+     },
+     ```
+
+     The fallback is acceptable for development only; production must set
+     `NEXT_PUBLIC_BASE_RPC` to the paid provider URL. Because `NEXT_PUBLIC_`
+     values are shipped to browsers, use a publishable client endpoint/key only
+     and enforce origin/rate limits in the RPC-provider dashboard.
+   * Do not edit `packages/nextjs/contracts/deployedContracts.ts`; it is
+     generated by deployment. Ensure the UI uses the generated contract entry
+     and that `externalContracts.ts`, if used for USDC, contains this exact
+     mainnet address and a `6`-decimal ABI definition.
+   * The tip UI must show one action at a time: Switch network → Approve exact
+     amount (or a documented limited multiple) → Send tip. It must display fee,
+     creator payout, token symbol, recipient address, transaction-pending
+     state, and clear rejection/revert/insufficient-balance errors. No infinite
+     approval.
+   * Replace development metadata/branding, add a 1200×630 Open Graph image,
+     legal/contact/support URLs, and a clear disclosure that payments are final
+     onchain and a 1% platform fee applies.
+
+4. Ask an independent Solidity reviewer to review the final diff and the fee
+   and withdrawal flows. For a contract holding user funds, do not treat local
+   tests as a substitute for review. Resolve every high/critical finding and
+   add a regression test before continuing.
+
+**Gate 1:** all commands pass, independent review is signed off, production
+config targets only Base, burner wallet is local-only, and the verified fee
+recipient/USDC addresses match the table. A contract-design change after this
+gate restarts at step 1.
+
+## 2. Rehearse on Base Sepolia
+
+This catches deployment wiring and wallet/provider behavior without risking
+funds. Temporarily configure the deployment script's *network-specific* token
+address for Base Sepolia only; never use the mainnet address on Sepolia or vice
+versa. Use a separate encrypted `base-sepolia-deployer` account.
+
+1. Add/confirm Base Sepolia in the Foundry RPC configuration and deploy using
+   the repository's Scaffold command:
+
+   ```bash
+   yarn deploy --network baseSepolia
+   yarn verify --network baseSepolia
+   ```
+
+   If this project registers the network as `base-sepolia` or uses a Foundry
+   script directly, use that documented name instead. First print available
+   commands with `yarn --help` / inspect `package.json`; do not guess a network
+   name and accidentally target mainnet.
+
+2. Record the Sepolia contract address and inspect the deploy transaction in a
+   block explorer. Confirm constructor arguments: Sepolia USDC, fee recipient,
+   and 100 bps. Confirm source verification reports the expected compiler and
+   source, not merely a successful transaction.
+
+3. Run the local frontend against the Sepolia deployment and the test-fan
+   wallet:
+
+   ```bash
+   yarn start
+   ```
+
+   Execute exactly one small full journey: connect → switch to Base Sepolia →
+   approve the amount → tip → wait for confirmation → verify both creator and
+   fee balances/event values in the explorer. Exercise wallet rejection,
+   insufficient USDC, wrong network, and refresh/reconnect paths. Test mobile
+   browser wallet as well as desktop.
+
+**Gate 2:** source verified; all real testnet checks pass; onchain accounting
+matches `amount = creator payout + fee`; no console errors; and the two people
+sign off on the UI's displayed address and amounts. Any deployment/config bug
+returns to step 1; do not patch source after the rehearsal without rerunning it.
+
+## 3. Deploy the immutable Base mainnet contract
+
+1. Restore/confirm the mainnet production values in the code and environment.
+   Run these preflight commands from the approved commit:
+
+   ```bash
+   git diff --exit-code
+   yarn test
+   cd packages/foundry && forge test -vvv && cd ../..
+   yarn build
+   cast chain-id --rpc-url "$BASE_RPC_URL"
+   cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Expected final three outputs: `8453`, non-empty bytecode, and `6`. If any
+   differs, stop: wrong RPC endpoints and fake USDC are launch blockers.
+
+2. Have the Verifier read the exact deploy-script constructor values on the
+   same commit. Operator then deploys once, from the encrypted keystore:
+
+   ```bash
+   yarn deploy --network base
+   ```
+
+   If the project exposes the key explicitly, the safe form is an account alias
+   / hardware-wallet flag, for example `--account base-deployer`; do not pass a
+   raw private key on the command line. Do not retry blindly if the terminal
+   disconnects—first look up the deployer nonce and submitted transaction in
+   the explorer/RPC to prevent duplicate deployment.
+
+3. Immediately copy the printed contract address and transaction hash to the
+   launch record, then verify source before any public URL is shared:
+
+   ```bash
+   yarn verify --network base
+   ```
+
+   Independently open the verified explorer page and confirm address, bytecode,
+   compiler settings, constructor arguments (canonical USDC, approved fee
+   recipient, 100 bps), owner/admin, and emitted deployment/config events.
+   Run read-only calls against the mainnet address using the contract's actual
+   getter names to confirm the same values; for example, replace the placeholder
+   function names below with your ABI's names:
+
+   ```bash
+   cast call <MAINNET_TIP_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   If verification fails, do not announce or use the contract. Fix the exact
+   source/compiler/config mismatch, redeploy only after Gate 1, and treat the
+   first address as permanently unused.
+
+4. The deployment must regenerate the application artifacts. Confirm the
+   generated `packages/nextjs/contracts/deployedContracts.ts` now contains the
+   exact `<MAINNET_TIP_CONTRACT>` under chain `8453`; do not hand-edit it.
+   Commit only generated non-secret artifacts and source/config changes:
+
+   ```bash
+   rg -n '<MAINNET_TIP_CONTRACT>|8453' packages/nextjs/contracts/deployedContracts.ts
+   git status --short
+   git diff --cached --name-only | rg -i '\.env|key|secret|private' && exit 1 || true
+   ```
+
+**Gate 3:** mainnet source is verified; the independent onchain reads match all
+production values; generated frontend artifacts reference exactly that address;
+and no secret is staged. A wrong immutable address means redeploy correctly;
+never redirect users to it.
+
+## 4. Mainnet canary before publishing
+
+1. Keep the frontend local but point it at Base mainnet and the newly deployed
+   contract. Run a clean production build/start, not development mode:
+
+   ```bash
+   yarn build
+   yarn start
+   ```
+
+2. The Verifier, on the funded test-fan wallet, completes one minimal real
+   USDC tip. They compare the UI amount, approval amount, recipient, fee, and
+   creator payout with the wallet's transaction simulation before signing.
+   After confirmation they check the decoded event and token balance changes in
+   the explorer. The accounting must exactly match the fee rule.
+
+3. On a second wallet/browser, test connect, Base network switch, rejection of
+   approval, rejection of tip, insufficient USDC, page reload while pending,
+   and disconnect/reconnect. Check desktop MetaMask, a WalletConnect/Rainbow
+   flow, and mobile. Inspect browser console and network tabs for errors or
+   leaked environment secrets.
+
+**Gate 4:** the actual mainnet canary is confirmed by both people, all expected
+balance changes are correct, UI contract/address text is correct, and no error
+or burner wallet appears. If the contract is wrong, stop public launch and go
+back to step 1; frontend-only defects return to this step after a fix.
+
+## 5. Publish the frontend and domain
+
+Vercel is the recommended production target for a normal Next.js Scaffold-ETH
+app. Do not use IPFS if the project depends on SSR, server routes, API routes,
+or runtime environment variables. If it is fully static and decentralized
+hosting is intentional, replace this section with `yarn ipfs` and perform the
+same checks on the resulting CID URL.
+
+1. In the Vercel project, import the approved repository commit and set its root
+directory to `packages/nextjs` if required by the monorepo configuration. Use
+the repo's existing build command (normally `yarn build`) and output settings.
+Set Production environment variables there—at minimum:
+
+   ```dotenv
+   NEXT_PUBLIC_BASE_RPC=https://<PUBLISHABLE-PRODUCTION-RPC>/...
+   ```
+
+   Add only public-safe values prefixed `NEXT_PUBLIC_`; never add a deployer
+   key, fee-recipient key, private RPC credential, or admin secret. Configure
+   allowed origins/rate limits at the RPC provider for the production domain.
+
+2. Deploy a preview first, then run the full Gate 4 check against the preview
+   URL. After it passes, deploy the same commit to production:
+
+   ```bash
+   yarn vercel
+   ```
+
+   If the command is not present in this Scaffold version, use the Vercel
+   dashboard's production deployment for that exact commit. Never rebuild a
+   different unreviewed commit to production.
+
+3. Attach the custom domain in Vercel, set the DNS records Vercel supplies,
+   wait for TLS to show valid, and make the canonical domain redirect policy
+   consistent (`www` or apex). Update the wallet/RPC provider allowed origins
+   to include both the preview and canonical production domain only as needed.
+
+4. From an incognito desktop browser and a real phone on cellular data, open
+   the canonical HTTPS URL. Repeat the one-minimal-tip journey. Validate Open
+   Graph metadata with a social-preview debugger, page title/favicon, all links,
+   404 behavior, and mobile layout. Check Vercel deployment/runtime logs and
+   browser console—both must be clean.
+
+**Gate 5 (public launch):** custom domain has valid HTTPS; mainnet connect,
+approval, tip, balances and events work from the canonical URL; no errors,
+burner wallet, or secrets are exposed; and Operator plus Verifier record the
+contract address, deploy transaction, verified explorer URL, production URL,
+timestamp, and canary transaction hash in the launch record. Only then share
+the URL publicly.
+
+## 6. First 72 hours and incident rules
+
+1. Monitor Vercel errors, RPC error/rate-limit dashboards, Base explorer events
+and contract USDC balance, and user support inbox at least several times per
+day. Alert on failed tip calls, unexpected fee/contract transfers, elevated
+RPC errors, or a UI build that references another contract.
+
+2. Keep a small, separate operational ETH balance only for necessary admin
+actions. Reconcile the contract's USDC accounting daily against emitted tip/
+withdrawal events and expected platform fee totals. Do not move funds from the
+deployer wallet into the contract.
+
+3. A frontend fault: immediately roll back the Vercel alias to the last
+verified deployment, fix locally, run the appropriate Gate 4 checks against
+the unchanged verified contract, then redeploy.
+
+4. A suspected contract/accounting/security fault: immediately remove public
+   calls-to-action and point the site to a maintenance page; if a tested pause
+   function exists, have the authorized Safe execute it. Preserve transaction
+   hashes/logs, notify affected users truthfully, and get an independent review.
+   Do not improvise a contract upgrade or deploy a replacement under pressure.
+   A contract fix requires regression tests, review, a new verified deployment,
+   fresh frontend artifacts, and this runbook from step 1.
+
+## Authoritative references
+
+* [Base network connection details](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+* [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview)
+* [Circle's official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+* [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/)

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..1138bfa021f3fa5d0595ac6d9685950cd6b3c1bf
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,420 @@
+# Base Mainnet Launch Runbook — creator tipping
+
+This is the ordered launch procedure for the existing Scaffold-ETH 2
+**Foundry** project. Perform it from a fresh clone of the application repo
+root; this directory contains only this runbook. Do not skip a stop condition.
+
+Two people are assumed:
+
+* **Operator** owns the deployment/key-management steps and never shares a
+  private key or seed phrase.
+* **Verifier** independently checks addresses, transactions, contract source,
+  and the public site using a separate wallet.
+
+Neither person should use their daily wallet for deployment or testing. Create
+three separate wallets: an offline/SAFE **fee-recipient** wallet, a minimal
+balance **deployer** wallet, and a **test-fan** wallet. The deployer must have
+only enough Base ETH to deploy and verify. Do not put the fee-recipient key in
+a browser extension or `.env` file.
+
+## Production values (write these down before editing)
+
+| Item | Required value |
+| --- | --- |
+| Network | Base Mainnet |
+| Chain ID | `8453` |
+| Native gas token | ETH |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Platform fee | `100` basis points (`1%`) |
+| Base Sepolia chain ID | `84532` |
+| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use a paid, production-grade RPC provider for the application and deployment;
+the public `https://mainnet.base.org` endpoint is rate limited and is not a
+production endpoint. The canonical USDC values above come from Circle, not a
+token list. Confirm them again against Circle's USDC address page on launch
+day.
+
+## 0. Freeze the candidate and prepare secure access
+
+1. Clone the exact candidate that passed the local-fork journey, install its
+   locked dependencies, and record the commit.
+
+   ```bash
+   git clone <REPOSITORY_URL> creator-tips
+   cd creator-tips
+   git checkout <APPROVED_COMMIT_SHA>
+   yarn install --immutable
+   git rev-parse HEAD
+   ```
+
+   If the project does not use a committed Yarn lockfile, stop and create one;
+   do not launch from floating dependencies.
+
+2. Make the deployment account only on a hardware wallet or in Foundry's
+   encrypted keystore. The following creates a local encrypted key entry and
+   prompts for the private key and a password; it does **not** print it.
+
+   ```bash
+   cast wallet import base-deployer --interactive
+   cast wallet address --account base-deployer
+   ```
+
+   Send a modest amount of Base ETH to that displayed address from a separate
+   funding wallet. Start with more than the estimated deployment gas plus a
+   conservative buffer, not with the project treasury. Verify the recipient
+   character-for-character in the hardware wallet before sending.
+
+3. Have the Verifier fund the test-fan wallet with a small amount of Base ETH
+   and a deliberately tiny amount of *canonical* Base USDC (for example,
+   $2–$5). They must independently check the token contract address before the
+   transfer. Never test a real tip with a large balance.
+
+4. Create local secret files. Replace every angle-bracket value, then restrict
+   file permissions. The RPC URL may contain a secret; it must never enter a
+   source file, terminal recording, screenshot, or commit.
+
+   ```bash
+   umask 077
+   cp .env.example .env.local 2>/dev/null || touch .env.local
+   ```
+
+   Put only the variables actually consumed by this project in `.env.local`.
+   Typical values are:
+
+   ```dotenv
+   BASE_RPC_URL="https://<YOUR-PRODUCTION-RPC>/..."
+   NEXT_PUBLIC_BASE_RPC="https://<YOUR-PRODUCTION-RPC>/..."
+   ```
+
+   If the Foundry deploy script reads `PRIVATE_KEY`, do **not** add one. Change
+   that script to use `--account base-deployer` / the encrypted keystore before
+   proceeding. A private key must not appear in a project environment file.
+
+5. Confirm secrets cannot be committed:
+
+   ```bash
+   rg -n --hidden -g '!node_modules' -g '!broadcast' -g '!cache' \
+     '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]|infura\.io/v3/[A-Za-z0-9]' .
+   rg -n --hidden '^\.env(\.|$)|^broadcast/$|^cache/$|^\*\.key$' .gitignore
+   git status --short
+   ```
+
+   The first command must return no secrets. `.gitignore` must include `.env`,
+   `.env.*`, `*.key`, `broadcast/`, `cache/`, and `node_modules/`. If it does
+   not, add the missing entries now, then rerun the check. Never commit
+   `.env.local`.
+
+**Gate 0:** Operator and Verifier agree on the recorded commit, deployer
+address, fee-recipient address, canonical USDC address, and test-fan address.
+All three keys are separate. If any key was pasted into a file, shell history,
+chat, or git, abandon/rotate it before continuing.
+
+## 1. Production-readiness audit (before any public deployment)
+
+1. Open the Solidity contracts, deploy script, and tests. The Verifier checks
+   these facts in the actual code—not just the UI:
+
+   * Constructor/configuration pins the Base **canonical** USDC address above;
+     it cannot accept an arbitrary caller-supplied token.
+   * All USDC amounts use `6` decimals. A $1.00 tip is `1_000_000`, never
+     `1e18`.
+   * Fee math is integer-safe and exact: `fee = amount * 100 / 10_000`;
+     payout and fee add back to `amount`; define and test the rounding outcome
+     for tiny tips.
+   * The fee recipient is the agreed Safe/offline address, not the deployer;
+     changing it (if supported) is access-controlled and emits an event.
+   * The tip transfer uses a safe ERC-20 transfer method, checks its result,
+     and follows checks-effects-interactions / reentrancy protection. No funds
+     can be trapped by a failing recipient path.
+   * Creator withdrawal/tip payout behavior, duplicate creator registration,
+     zero address, zero amount, paused state, and unauthorized admin calls are
+     explicitly tested. If there is an owner/admin, document its powers in the
+     UI and set it to a Safe or restricted operational wallet—not an EOA used
+     for deployment.
+   * No upgrade proxy, delegatecall, unrestricted withdrawal, or token rescue
+     function exists unless it is intentional, documented, access-controlled,
+     and covered by tests.
+
+2. Add a regression test for every finding. At a minimum add tests for a
+   $1.00 tip, the smallest allowed tip, a non-round fee, exact fee/payout
+   accounting, wrong-token rejection, failed USDC transfer, invalid recipient,
+   unauthorized configuration, and reentrancy attempt. Run the actual suite:
+
+   ```bash
+   yarn test
+   cd packages/foundry
+   forge test -vvv
+   forge coverage
+   cd ../..
+   yarn lint
+   yarn build
+   ```
+
+   Use the repository's equivalent commands only if its `package.json` names
+   differ. Do not waive a failing test, lint warning that affects runtime, or
+   production build error. Commit the resulting audit/test fixes and repeat
+   Gate 0's secret scan before every commit.
+
+3. Inspect the frontend's production configuration:
+
+   * In `packages/nextjs/scaffold.config.ts`, set
+     `targetNetworks: [chains.base]` (using the project's imported `base`
+     chain) and `burnerWalletMode: "localNetworksOnly"`.
+   * Configure RPC overrides from environment variables only, for example:
+
+     ```ts
+     rpcOverrides: {
+       [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
+     },
+     ```
+
+     The fallback is acceptable for development only; production must set
+     `NEXT_PUBLIC_BASE_RPC` to the paid provider URL. Because `NEXT_PUBLIC_`
+     values are shipped to browsers, use a publishable client endpoint/key only
+     and enforce origin/rate limits in the RPC-provider dashboard.
+   * Do not edit `packages/nextjs/contracts/deployedContracts.ts`; it is
+     generated by deployment. Ensure the UI uses the generated contract entry
+     and that `externalContracts.ts`, if used for USDC, contains this exact
+     mainnet address and a `6`-decimal ABI definition.
+   * The tip UI must show one action at a time: Switch network → Approve exact
+     amount (or a documented limited multiple) → Send tip. It must display fee,
+     creator payout, token symbol, recipient address, transaction-pending
+     state, and clear rejection/revert/insufficient-balance errors. No infinite
+     approval.
+   * Replace development metadata/branding, add a 1200×630 Open Graph image,
+     legal/contact/support URLs, and a clear disclosure that payments are final
+     onchain and a 1% platform fee applies.
+
+4. Ask an independent Solidity reviewer to review the final diff and the fee
+   and withdrawal flows. For a contract holding user funds, do not treat local
+   tests as a substitute for review. Resolve every high/critical finding and
+   add a regression test before continuing.
+
+**Gate 1:** all commands pass, independent review is signed off, production
+config targets only Base, burner wallet is local-only, and the verified fee
+recipient/USDC addresses match the table. A contract-design change after this
+gate restarts at step 1.
+
+## 2. Rehearse on Base Sepolia
+
+This catches deployment wiring and wallet/provider behavior without risking
+funds. Temporarily configure the deployment script's *network-specific* token
+address for Base Sepolia only; never use the mainnet address on Sepolia or vice
+versa. Use a separate encrypted `base-sepolia-deployer` account.
+
+1. Add/confirm Base Sepolia in the Foundry RPC configuration and deploy using
+   the repository's Scaffold command:
+
+   ```bash
+   yarn deploy --network baseSepolia
+   yarn verify --network baseSepolia
+   ```
+
+   If this project registers the network as `base-sepolia` or uses a Foundry
+   script directly, use that documented name instead. First print available
+   commands with `yarn --help` / inspect `package.json`; do not guess a network
+   name and accidentally target mainnet.
+
+2. Record the Sepolia contract address and inspect the deploy transaction in a
+   block explorer. Confirm constructor arguments: Sepolia USDC, fee recipient,
+   and 100 bps. Confirm source verification reports the expected compiler and
+   source, not merely a successful transaction.
+
+3. Run the local frontend against the Sepolia deployment and the test-fan
+   wallet:
+
+   ```bash
+   yarn start
+   ```
+
+   Execute exactly one small full journey: connect → switch to Base Sepolia →
+   approve the amount → tip → wait for confirmation → verify both creator and
+   fee balances/event values in the explorer. Exercise wallet rejection,
+   insufficient USDC, wrong network, and refresh/reconnect paths. Test mobile
+   browser wallet as well as desktop.
+
+**Gate 2:** source verified; all real testnet checks pass; onchain accounting
+matches `amount = creator payout + fee`; no console errors; and the two people
+sign off on the UI's displayed address and amounts. Any deployment/config bug
+returns to step 1; do not patch source after the rehearsal without rerunning it.
+
+## 3. Deploy the immutable Base mainnet contract
+
+1. Restore/confirm the mainnet production values in the code and environment.
+   Run these preflight commands from the approved commit:
+
+   ```bash
+   git diff --exit-code
+   yarn test
+   cd packages/foundry && forge test -vvv && cd ../..
+   yarn build
+   cast chain-id --rpc-url "$BASE_RPC_URL"
+   cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Expected final three outputs: `8453`, non-empty bytecode, and `6`. If any
+   differs, stop: wrong RPC endpoints and fake USDC are launch blockers.
+
+2. Have the Verifier read the exact deploy-script constructor values on the
+   same commit. Operator then deploys once, from the encrypted keystore:
+
+   ```bash
+   yarn deploy --network base
+   ```
+
+   If the project exposes the key explicitly, the safe form is an account alias
+   / hardware-wallet flag, for example `--account base-deployer`; do not pass a
+   raw private key on the command line. Do not retry blindly if the terminal
+   disconnects—first look up the deployer nonce and submitted transaction in
+   the explorer/RPC to prevent duplicate deployment.
+
+3. Immediately copy the printed contract address and transaction hash to the
+   launch record, then verify source before any public URL is shared:
+
+   ```bash
+   yarn verify --network base
+   ```
+
+   Independently open the verified explorer page and confirm address, bytecode,
+   compiler settings, constructor arguments (canonical USDC, approved fee
+   recipient, 100 bps), owner/admin, and emitted deployment/config events.
+   Run read-only calls against the mainnet address using the contract's actual
+   getter names to confirm the same values; for example, replace the placeholder
+   function names below with your ABI's names:
+
+   ```bash
+   cast call <MAINNET_TIP_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   If verification fails, do not announce or use the contract. Fix the exact
+   source/compiler/config mismatch, redeploy only after Gate 1, and treat the
+   first address as permanently unused.
+
+4. The deployment must regenerate the application artifacts. Confirm the
+   generated `packages/nextjs/contracts/deployedContracts.ts` now contains the
+   exact `<MAINNET_TIP_CONTRACT>` under chain `8453`; do not hand-edit it.
+   Commit only generated non-secret artifacts and source/config changes:
+
+   ```bash
+   rg -n '<MAINNET_TIP_CONTRACT>|8453' packages/nextjs/contracts/deployedContracts.ts
+   git status --short
+   git diff --cached --name-only | rg -i '\.env|key|secret|private' && exit 1 || true
+   ```
+
+**Gate 3:** mainnet source is verified; the independent onchain reads match all
+production values; generated frontend artifacts reference exactly that address;
+and no secret is staged. A wrong immutable address means redeploy correctly;
+never redirect users to it.
+
+## 4. Mainnet canary before publishing
+
+1. Keep the frontend local but point it at Base mainnet and the newly deployed
+   contract. Run a clean production build/start, not development mode:
+
+   ```bash
+   yarn build
+   yarn start
+   ```
+
+2. The Verifier, on the funded test-fan wallet, completes one minimal real
+   USDC tip. They compare the UI amount, approval amount, recipient, fee, and
+   creator payout with the wallet's transaction simulation before signing.
+   After confirmation they check the decoded event and token balance changes in
+   the explorer. The accounting must exactly match the fee rule.
+
+3. On a second wallet/browser, test connect, Base network switch, rejection of
+   approval, rejection of tip, insufficient USDC, page reload while pending,
+   and disconnect/reconnect. Check desktop MetaMask, a WalletConnect/Rainbow
+   flow, and mobile. Inspect browser console and network tabs for errors or
+   leaked environment secrets.
+
+**Gate 4:** the actual mainnet canary is confirmed by both people, all expected
+balance changes are correct, UI contract/address text is correct, and no error
+or burner wallet appears. If the contract is wrong, stop public launch and go
+back to step 1; frontend-only defects return to this step after a fix.
+
+## 5. Publish the frontend and domain
+
+Vercel is the recommended production target for a normal Next.js Scaffold-ETH
+app. Do not use IPFS if the project depends on SSR, server routes, API routes,
+or runtime environment variables. If it is fully static and decentralized
+hosting is intentional, replace this section with `yarn ipfs` and perform the
+same checks on the resulting CID URL.
+
+1. In the Vercel project, import the approved repository commit and set its root
+directory to `packages/nextjs` if required by the monorepo configuration. Use
+the repo's existing build command (normally `yarn build`) and output settings.
+Set Production environment variables there—at minimum:
+
+   ```dotenv
+   NEXT_PUBLIC_BASE_RPC=https://<PUBLISHABLE-PRODUCTION-RPC>/...
+   ```
+
+   Add only public-safe values prefixed `NEXT_PUBLIC_`; never add a deployer
+   key, fee-recipient key, private RPC credential, or admin secret. Configure
+   allowed origins/rate limits at the RPC provider for the production domain.
+
+2. Deploy a preview first, then run the full Gate 4 check against the preview
+   URL. After it passes, deploy the same commit to production:
+
+   ```bash
+   yarn vercel
+   ```
+
+   If the command is not present in this Scaffold version, use the Vercel
+   dashboard's production deployment for that exact commit. Never rebuild a
+   different unreviewed commit to production.
+
+3. Attach the custom domain in Vercel, set the DNS records Vercel supplies,
+   wait for TLS to show valid, and make the canonical domain redirect policy
+   consistent (`www` or apex). Update the wallet/RPC provider allowed origins
+   to include both the preview and canonical production domain only as needed.
+
+4. From an incognito desktop browser and a real phone on cellular data, open
+   the canonical HTTPS URL. Repeat the one-minimal-tip journey. Validate Open
+   Graph metadata with a social-preview debugger, page title/favicon, all links,
+   404 behavior, and mobile layout. Check Vercel deployment/runtime logs and
+   browser console—both must be clean.
+
+**Gate 5 (public launch):** custom domain has valid HTTPS; mainnet connect,
+approval, tip, balances and events work from the canonical URL; no errors,
+burner wallet, or secrets are exposed; and Operator plus Verifier record the
+contract address, deploy transaction, verified explorer URL, production URL,
+timestamp, and canary transaction hash in the launch record. Only then share
+the URL publicly.
+
+## 6. First 72 hours and incident rules
+
+1. Monitor Vercel errors, RPC error/rate-limit dashboards, Base explorer events
+and contract USDC balance, and user support inbox at least several times per
+day. Alert on failed tip calls, unexpected fee/contract transfers, elevated
+RPC errors, or a UI build that references another contract.
+
+2. Keep a small, separate operational ETH balance only for necessary admin
+actions. Reconcile the contract's USDC accounting daily against emitted tip/
+withdrawal events and expected platform fee totals. Do not move funds from the
+deployer wallet into the contract.
+
+3. A frontend fault: immediately roll back the Vercel alias to the last
+verified deployment, fix locally, run the appropriate Gate 4 checks against
+the unchanged verified contract, then redeploy.
+
+4. A suspected contract/accounting/security fault: immediately remove public
+   calls-to-action and point the site to a maintenance page; if a tested pause
+   function exists, have the authorized Safe execute it. Preserve transaction
+   hashes/logs, notify affected users truthfully, and get an independent review.
+   Do not improvise a contract upgrade or deploy a replacement under pressure.
+   A contract fix requires regression tests, review, a new verified deployment,
+   fresh frontend artifacts, and this runbook from step 1.
+
+## Authoritative references
+
+* [Base network connection details](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+* [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview)
+* [Circle's official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+* [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/)

exec
/bin/zsh -lc "git diff --check && wc -l LAUNCH.md && sed -n '1,80p' LAUNCH.md && git status --short" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3
 succeeded in 0ms:
     420 LAUNCH.md
# Base Mainnet Launch Runbook — creator tipping

This is the ordered launch procedure for the existing Scaffold-ETH 2
**Foundry** project. Perform it from a fresh clone of the application repo
root; this directory contains only this runbook. Do not skip a stop condition.

Two people are assumed:

* **Operator** owns the deployment/key-management steps and never shares a
  private key or seed phrase.
* **Verifier** independently checks addresses, transactions, contract source,
  and the public site using a separate wallet.

Neither person should use their daily wallet for deployment or testing. Create
three separate wallets: an offline/SAFE **fee-recipient** wallet, a minimal
balance **deployer** wallet, and a **test-fan** wallet. The deployer must have
only enough Base ETH to deploy and verify. Do not put the fee-recipient key in
a browser extension or `.env` file.

## Production values (write these down before editing)

| Item | Required value |
| --- | --- |
| Network | Base Mainnet |
| Chain ID | `8453` |
| Native gas token | ETH |
| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC decimals | `6` |
| Platform fee | `100` basis points (`1%`) |
| Base Sepolia chain ID | `84532` |
| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Use a paid, production-grade RPC provider for the application and deployment;
the public `https://mainnet.base.org` endpoint is rate limited and is not a
production endpoint. The canonical USDC values above come from Circle, not a
token list. Confirm them again against Circle's USDC address page on launch
day.

## 0. Freeze the candidate and prepare secure access

1. Clone the exact candidate that passed the local-fork journey, install its
   locked dependencies, and record the commit.

   ```bash
   git clone <REPOSITORY_URL> creator-tips
   cd creator-tips
   git checkout <APPROVED_COMMIT_SHA>
   yarn install --immutable
   git rev-parse HEAD
   ```

   If the project does not use a committed Yarn lockfile, stop and create one;
   do not launch from floating dependencies.

2. Make the deployment account only on a hardware wallet or in Foundry's
   encrypted keystore. The following creates a local encrypted key entry and
   prompts for the private key and a password; it does **not** print it.

   ```bash
   cast wallet import base-deployer --interactive
   cast wallet address --account base-deployer
   ```

   Send a modest amount of Base ETH to that displayed address from a separate
   funding wallet. Start with more than the estimated deployment gas plus a
   conservative buffer, not with the project treasury. Verify the recipient
   character-for-character in the hardware wallet before sending.

3. Have the Verifier fund the test-fan wallet with a small amount of Base ETH
   and a deliberately tiny amount of *canonical* Base USDC (for example,
   $2–$5). They must independently check the token contract address before the
   transfer. Never test a real tip with a large balance.

4. Create local secret files. Replace every angle-bracket value, then restrict
   file permissions. The RPC URL may contain a secret; it must never enter a
   source file, terminal recording, screenshot, or commit.

   ```bash
   umask 077
   cp .env.example .env.local 2>/dev/null || touch .env.local
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..1138bfa021f3fa5d0595ac6d9685950cd6b3c1bf
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,420 @@
+# Base Mainnet Launch Runbook — creator tipping
+
+This is the ordered launch procedure for the existing Scaffold-ETH 2
+**Foundry** project. Perform it from a fresh clone of the application repo
+root; this directory contains only this runbook. Do not skip a stop condition.
+
+Two people are assumed:
+
+* **Operator** owns the deployment/key-management steps and never shares a
+  private key or seed phrase.
+* **Verifier** independently checks addresses, transactions, contract source,
+  and the public site using a separate wallet.
+
+Neither person should use their daily wallet for deployment or testing. Create
+three separate wallets: an offline/SAFE **fee-recipient** wallet, a minimal
+balance **deployer** wallet, and a **test-fan** wallet. The deployer must have
+only enough Base ETH to deploy and verify. Do not put the fee-recipient key in
+a browser extension or `.env` file.
+
+## Production values (write these down before editing)
+
+| Item | Required value |
+| --- | --- |
+| Network | Base Mainnet |
+| Chain ID | `8453` |
+| Native gas token | ETH |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Platform fee | `100` basis points (`1%`) |
+| Base Sepolia chain ID | `84532` |
+| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use a paid, production-grade RPC provider for the application and deployment;
+the public `https://mainnet.base.org` endpoint is rate limited and is not a
+production endpoint. The canonical USDC values above come from Circle, not a
+token list. Confirm them again against Circle's USDC address page on launch
+day.
+
+## 0. Freeze the candidate and prepare secure access
+
+1. Clone the exact candidate that passed the local-fork journey, install its
+   locked dependencies, and record the commit.
+
+   ```bash
+   git clone <REPOSITORY_URL> creator-tips
+   cd creator-tips
+   git checkout <APPROVED_COMMIT_SHA>
+   yarn install --immutable
+   git rev-parse HEAD
+   ```
+
+   If the project does not use a committed Yarn lockfile, stop and create one;
+   do not launch from floating dependencies.
+
+2. Make the deployment account only on a hardware wallet or in Foundry's
+   encrypted keystore. The following creates a local encrypted key entry and
+   prompts for the private key and a password; it does **not** print it.
+
+   ```bash
+   cast wallet import base-deployer --interactive
+   cast wallet address --account base-deployer
+   ```
+
+   Send a modest amount of Base ETH to that displayed address from a separate
+   funding wallet. Start with more than the estimated deployment gas plus a
+   conservative buffer, not with the project treasury. Verify the recipient
+   character-for-character in the hardware wallet before sending.
+
+3. Have the Verifier fund the test-fan wallet with a small amount of Base ETH
+   and a deliberately tiny amount of *canonical* Base USDC (for example,
+   $2–$5). They must independently check the token contract address before the
+   transfer. Never test a real tip with a large balance.
+
+4. Create local secret files. Replace every angle-bracket value, then restrict
+   file permissions. The RPC URL may contain a secret; it must never enter a
+   source file, terminal recording, screenshot, or commit.
+
+   ```bash
+   umask 077
+   cp .env.example .env.local 2>/dev/null || touch .env.local
+   ```
+
+   Put only the variables actually consumed by this project in `.env.local`.
+   Typical values are:
+
+   ```dotenv
+   BASE_RPC_URL="https://<YOUR-PRODUCTION-RPC>/..."
+   NEXT_PUBLIC_BASE_RPC="https://<YOUR-PRODUCTION-RPC>/..."
+   ```
+
+   If the Foundry deploy script reads `PRIVATE_KEY`, do **not** add one. Change
+   that script to use `--account base-deployer` / the encrypted keystore before
+   proceeding. A private key must not appear in a project environment file.
+
+5. Confirm secrets cannot be committed:
+
+   ```bash
+   rg -n --hidden -g '!node_modules' -g '!broadcast' -g '!cache' \
+     '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]|infura\.io/v3/[A-Za-z0-9]' .
+   rg -n --hidden '^\.env(\.|$)|^broadcast/$|^cache/$|^\*\.key$' .gitignore
+   git status --short
+   ```
+
+   The first command must return no secrets. `.gitignore` must include `.env`,
+   `.env.*`, `*.key`, `broadcast/`, `cache/`, and `node_modules/`. If it does
+   not, add the missing entries now, then rerun the check. Never commit
+   `.env.local`.
+
+**Gate 0:** Operator and Verifier agree on the recorded commit, deployer
+address, fee-recipient address, canonical USDC address, and test-fan address.
+All three keys are separate. If any key was pasted into a file, shell history,
+chat, or git, abandon/rotate it before continuing.
+
+## 1. Production-readiness audit (before any public deployment)
+
+1. Open the Solidity contracts, deploy script, and tests. The Verifier checks
+   these facts in the actual code—not just the UI:
+
+   * Constructor/configuration pins the Base **canonical** USDC address above;
+     it cannot accept an arbitrary caller-supplied token.
+   * All USDC amounts use `6` decimals. A $1.00 tip is `1_000_000`, never
+     `1e18`.
+   * Fee math is integer-safe and exact: `fee = amount * 100 / 10_000`;
+     payout and fee add back to `amount`; define and test the rounding outcome
+     for tiny tips.
+   * The fee recipient is the agreed Safe/offline address, not the deployer;
+     changing it (if supported) is access-controlled and emits an event.
+   * The tip transfer uses a safe ERC-20 transfer method, checks its result,
+     and follows checks-effects-interactions / reentrancy protection. No funds
+     can be trapped by a failing recipient path.
+   * Creator withdrawal/tip payout behavior, duplicate creator registration,
+     zero address, zero amount, paused state, and unauthorized admin calls are
+     explicitly tested. If there is an owner/admin, document its powers in the
+     UI and set it to a Safe or restricted operational wallet—not an EOA used
+     for deployment.
+   * No upgrade proxy, delegatecall, unrestricted withdrawal, or token rescue
+     function exists unless it is intentional, documented, access-controlled,
+     and covered by tests.
+
+2. Add a regression test for every finding. At a minimum add tests for a
+   $1.00 tip, the smallest allowed tip, a non-round fee, exact fee/payout
+   accounting, wrong-token rejection, failed USDC transfer, invalid recipient,
+   unauthorized configuration, and reentrancy attempt. Run the actual suite:
+
+   ```bash
+   yarn test
+   cd packages/foundry
+   forge test -vvv
+   forge coverage
+   cd ../..
+   yarn lint
+   yarn build
+   ```
+
+   Use the repository's equivalent commands only if its `package.json` names
+   differ. Do not waive a failing test, lint warning that affects runtime, or
+   production build error. Commit the resulting audit/test fixes and repeat
+   Gate 0's secret scan before every commit.
+
+3. Inspect the frontend's production configuration:
+
+   * In `packages/nextjs/scaffold.config.ts`, set
+     `targetNetworks: [chains.base]` (using the project's imported `base`
+     chain) and `burnerWalletMode: "localNetworksOnly"`.
+   * Configure RPC overrides from environment variables only, for example:
+
+     ```ts
+     rpcOverrides: {
+       [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
+     },
+     ```
+
+     The fallback is acceptable for development only; production must set
+     `NEXT_PUBLIC_BASE_RPC` to the paid provider URL. Because `NEXT_PUBLIC_`
+     values are shipped to browsers, use a publishable client endpoint/key only
+     and enforce origin/rate limits in the RPC-provider dashboard.
+   * Do not edit `packages/nextjs/contracts/deployedContracts.ts`; it is
+     generated by deployment. Ensure the UI uses the generated contract entry
+     and that `externalContracts.ts`, if used for USDC, contains this exact
+     mainnet address and a `6`-decimal ABI definition.
+   * The tip UI must show one action at a time: Switch network → Approve exact
+     amount (or a documented limited multiple) → Send tip. It must display fee,
+     creator payout, token symbol, recipient address, transaction-pending
+     state, and clear rejection/revert/insufficient-balance errors. No infinite
+     approval.
+   * Replace development metadata/branding, add a 1200×630 Open Graph image,
+     legal/contact/support URLs, and a clear disclosure that payments are final
+     onchain and a 1% platform fee applies.
+
+4. Ask an independent Solidity reviewer to review the final diff and the fee
+   and withdrawal flows. For a contract holding user funds, do not treat local
+   tests as a substitute for review. Resolve every high/critical finding and
+   add a regression test before continuing.
+
+**Gate 1:** all commands pass, independent review is signed off, production
+config targets only Base, burner wallet is local-only, and the verified fee
+recipient/USDC addresses match the table. A contract-design change after this
+gate restarts at step 1.
+
+## 2. Rehearse on Base Sepolia
+
+This catches deployment wiring and wallet/provider behavior without risking
+funds. Temporarily configure the deployment script's *network-specific* token
+address for Base Sepolia only; never use the mainnet address on Sepolia or vice
+versa. Use a separate encrypted `base-sepolia-deployer` account.
+
+1. Add/confirm Base Sepolia in the Foundry RPC configuration and deploy using
+   the repository's Scaffold command:
+
+   ```bash
+   yarn deploy --network baseSepolia
+   yarn verify --network baseSepolia
+   ```
+
+   If this project registers the network as `base-sepolia` or uses a Foundry
+   script directly, use that documented name instead. First print available
+   commands with `yarn --help` / inspect `package.json`; do not guess a network
+   name and accidentally target mainnet.
+
+2. Record the Sepolia contract address and inspect the deploy transaction in a
+   block explorer. Confirm constructor arguments: Sepolia USDC, fee recipient,
+   and 100 bps. Confirm source verification reports the expected compiler and
+   source, not merely a successful transaction.
+
+3. Run the local frontend against the Sepolia deployment and the test-fan
+   wallet:
+
+   ```bash
+   yarn start
+   ```
+
+   Execute exactly one small full journey: connect → switch to Base Sepolia →
+   approve the amount → tip → wait for confirmation → verify both creator and
+   fee balances/event values in the explorer. Exercise wallet rejection,
+   insufficient USDC, wrong network, and refresh/reconnect paths. Test mobile
+   browser wallet as well as desktop.
+
+**Gate 2:** source verified; all real testnet checks pass; onchain accounting
+matches `amount = creator payout + fee`; no console errors; and the two people
+sign off on the UI's displayed address and amounts. Any deployment/config bug
+returns to step 1; do not patch source after the rehearsal without rerunning it.
+
+## 3. Deploy the immutable Base mainnet contract
+
+1. Restore/confirm the mainnet production values in the code and environment.
+   Run these preflight commands from the approved commit:
+
+   ```bash
+   git diff --exit-code
+   yarn test
+   cd packages/foundry && forge test -vvv && cd ../..
+   yarn build
+   cast chain-id --rpc-url "$BASE_RPC_URL"
+   cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Expected final three outputs: `8453`, non-empty bytecode, and `6`. If any
+   differs, stop: wrong RPC endpoints and fake USDC are launch blockers.
+
+2. Have the Verifier read the exact deploy-script constructor values on the
+   same commit. Operator then deploys once, from the encrypted keystore:
+
+   ```bash
+   yarn deploy --network base
+   ```
+
+   If the project exposes the key explicitly, the safe form is an account alias
+   / hardware-wallet flag, for example `--account base-deployer`; do not pass a
+   raw private key on the command line. Do not retry blindly if the terminal
+   disconnects—first look up the deployer nonce and submitted transaction in
+   the explorer/RPC to prevent duplicate deployment.
+
+3. Immediately copy the printed contract address and transaction hash to the
+   launch record, then verify source before any public URL is shared:
+
+   ```bash
+   yarn verify --network base
+   ```
+
+   Independently open the verified explorer page and confirm address, bytecode,
+   compiler settings, constructor arguments (canonical USDC, approved fee
+   recipient, 100 bps), owner/admin, and emitted deployment/config events.
+   Run read-only calls against the mainnet address using the contract's actual
+   getter names to confirm the same values; for example, replace the placeholder
+   function names below with your ABI's names:
+
+   ```bash
+   cast call <MAINNET_TIP_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   If verification fails, do not announce or use the contract. Fix the exact
+   source/compiler/config mismatch, redeploy only after Gate 1, and treat the
+   first address as permanently unused.
+
+4. The deployment must regenerate the application artifacts. Confirm the
+   generated `packages/nextjs/contracts/deployedContracts.ts` now contains the
+   exact `<MAINNET_TIP_CONTRACT>` under chain `8453`; do not hand-edit it.
+   Commit only generated non-secret artifacts and source/config changes:
+
+   ```bash
+   rg -n '<MAINNET_TIP_CONTRACT>|8453' packages/nextjs/contracts/deployedContracts.ts
+   git status --short
+   git diff --cached --name-only | rg -i '\.env|key|secret|private' && exit 1 || true
+   ```
+
+**Gate 3:** mainnet source is verified; the independent onchain reads match all
+production values; generated frontend artifacts reference exactly that address;
+and no secret is staged. A wrong immutable address means redeploy correctly;
+never redirect users to it.
+
+## 4. Mainnet canary before publishing
+
+1. Keep the frontend local but point it at Base mainnet and the newly deployed
+   contract. Run a clean production build/start, not development mode:
+
+   ```bash
+   yarn build
+   yarn start
+   ```
+
+2. The Verifier, on the funded test-fan wallet, completes one minimal real
+   USDC tip. They compare the UI amount, approval amount, recipient, fee, and
+   creator payout with the wallet's transaction simulation before signing.
+   After confirmation they check the decoded event and token balance changes in
+   the explorer. The accounting must exactly match the fee rule.
+
+3. On a second wallet/browser, test connect, Base network switch, rejection of
+   approval, rejection of tip, insufficient USDC, page reload while pending,
+   and disconnect/reconnect. Check desktop MetaMask, a WalletConnect/Rainbow
+   flow, and mobile. Inspect browser console and network tabs for errors or
+   leaked environment secrets.
+
+**Gate 4:** the actual mainnet canary is confirmed by both people, all expected
+balance changes are correct, UI contract/address text is correct, and no error
+or burner wallet appears. If the contract is wrong, stop public launch and go
+back to step 1; frontend-only defects return to this step after a fix.
+
+## 5. Publish the frontend and domain
+
+Vercel is the recommended production target for a normal Next.js Scaffold-ETH
+app. Do not use IPFS if the project depends on SSR, server routes, API routes,
+or runtime environment variables. If it is fully static and decentralized
+hosting is intentional, replace this section with `yarn ipfs` and perform the
+same checks on the resulting CID URL.
+
+1. In the Vercel project, import the approved repository commit and set its root
+directory to `packages/nextjs` if required by the monorepo configuration. Use
+the repo's existing build command (normally `yarn build`) and output settings.
+Set Production environment variables there—at minimum:
+
+   ```dotenv
+   NEXT_PUBLIC_BASE_RPC=https://<PUBLISHABLE-PRODUCTION-RPC>/...
+   ```
+
+   Add only public-safe values prefixed `NEXT_PUBLIC_`; never add a deployer
+   key, fee-recipient key, private RPC credential, or admin secret. Configure
+   allowed origins/rate limits at the RPC provider for the production domain.
+
+2. Deploy a preview first, then run the full Gate 4 check against the preview
+   URL. After it passes, deploy the same commit to production:
+
+   ```bash
+   yarn vercel
+   ```
+
+   If the command is not present in this Scaffold version, use the Vercel
+   dashboard's production deployment for that exact commit. Never rebuild a
+   different unreviewed commit to production.
+
+3. Attach the custom domain in Vercel, set the DNS records Vercel supplies,
+   wait for TLS to show valid, and make the canonical domain redirect policy
+   consistent (`www` or apex). Update the wallet/RPC provider allowed origins
+   to include both the preview and canonical production domain only as needed.
+
+4. From an incognito desktop browser and a real phone on cellular data, open
+   the canonical HTTPS URL. Repeat the one-minimal-tip journey. Validate Open
+   Graph metadata with a social-preview debugger, page title/favicon, all links,
+   404 behavior, and mobile layout. Check Vercel deployment/runtime logs and
+   browser console—both must be clean.
+
+**Gate 5 (public launch):** custom domain has valid HTTPS; mainnet connect,
+approval, tip, balances and events work from the canonical URL; no errors,
+burner wallet, or secrets are exposed; and Operator plus Verifier record the
+contract address, deploy transaction, verified explorer URL, production URL,
+timestamp, and canary transaction hash in the launch record. Only then share
+the URL publicly.
+
+## 6. First 72 hours and incident rules
+
+1. Monitor Vercel errors, RPC error/rate-limit dashboards, Base explorer events
+and contract USDC balance, and user support inbox at least several times per
+day. Alert on failed tip calls, unexpected fee/contract transfers, elevated
+RPC errors, or a UI build that references another contract.
+
+2. Keep a small, separate operational ETH balance only for necessary admin
+actions. Reconcile the contract's USDC accounting daily against emitted tip/
+withdrawal events and expected platform fee totals. Do not move funds from the
+deployer wallet into the contract.
+
+3. A frontend fault: immediately roll back the Vercel alias to the last
+verified deployment, fix locally, run the appropriate Gate 4 checks against
+the unchanged verified contract, then redeploy.
+
+4. A suspected contract/accounting/security fault: immediately remove public
+   calls-to-action and point the site to a maintenance page; if a tested pause
+   function exists, have the authorized Safe execute it. Preserve transaction
+   hashes/logs, notify affected users truthfully, and get an independent review.
+   Do not improvise a contract upgrade or deploy a replacement under pressure.
+   A contract fix requires regression tests, review, a new verified deployment,
+   fresh frontend artifacts, and this runbook from step 1.
+
+## Authoritative references
+
+* [Base network connection details](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+* [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview)
+* [Circle's official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+* [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/)

codex
Created the complete, gated Base mainnet launch runbook: [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3/LAUNCH.md).

It covers secure key setup, contract/UI audits, Base Sepolia rehearsal, verified mainnet deployment, real-money canary, Vercel/domain release, and 72-hour incident handling—with explicit stop gates throughout.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..1138bfa021f3fa5d0595ac6d9685950cd6b3c1bf
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,420 @@
+# Base Mainnet Launch Runbook — creator tipping
+
+This is the ordered launch procedure for the existing Scaffold-ETH 2
+**Foundry** project. Perform it from a fresh clone of the application repo
+root; this directory contains only this runbook. Do not skip a stop condition.
+
+Two people are assumed:
+
+* **Operator** owns the deployment/key-management steps and never shares a
+  private key or seed phrase.
+* **Verifier** independently checks addresses, transactions, contract source,
+  and the public site using a separate wallet.
+
+Neither person should use their daily wallet for deployment or testing. Create
+three separate wallets: an offline/SAFE **fee-recipient** wallet, a minimal
+balance **deployer** wallet, and a **test-fan** wallet. The deployer must have
+only enough Base ETH to deploy and verify. Do not put the fee-recipient key in
+a browser extension or `.env` file.
+
+## Production values (write these down before editing)
+
+| Item | Required value |
+| --- | --- |
+| Network | Base Mainnet |
+| Chain ID | `8453` |
+| Native gas token | ETH |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Platform fee | `100` basis points (`1%`) |
+| Base Sepolia chain ID | `84532` |
+| Base Sepolia USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use a paid, production-grade RPC provider for the application and deployment;
+the public `https://mainnet.base.org` endpoint is rate limited and is not a
+production endpoint. The canonical USDC values above come from Circle, not a
+token list. Confirm them again against Circle's USDC address page on launch
+day.
+
+## 0. Freeze the candidate and prepare secure access
+
+1. Clone the exact candidate that passed the local-fork journey, install its
+   locked dependencies, and record the commit.
+
+   ```bash
+   git clone <REPOSITORY_URL> creator-tips
+   cd creator-tips
+   git checkout <APPROVED_COMMIT_SHA>
+   yarn install --immutable
+   git rev-parse HEAD
+   ```
+
+   If the project does not use a committed Yarn lockfile, stop and create one;
+   do not launch from floating dependencies.
+
+2. Make the deployment account only on a hardware wallet or in Foundry's
+   encrypted keystore. The following creates a local encrypted key entry and
+   prompts for the private key and a password; it does **not** print it.
+
+   ```bash
+   cast wallet import base-deployer --interactive
+   cast wallet address --account base-deployer
+   ```
+
+   Send a modest amount of Base ETH to that displayed address from a separate
+   funding wallet. Start with more than the estimated deployment gas plus a
+   conservative buffer, not with the project treasury. Verify the recipient
+   character-for-character in the hardware wallet before sending.
+
+3. Have the Verifier fund the test-fan wallet with a small amount of Base ETH
+   and a deliberately tiny amount of *canonical* Base USDC (for example,
+   $2–$5). They must independently check the token contract address before the
+   transfer. Never test a real tip with a large balance.
+
+4. Create local secret files. Replace every angle-bracket value, then restrict
+   file permissions. The RPC URL may contain a secret; it must never enter a
+   source file, terminal recording, screenshot, or commit.
+
+   ```bash
+   umask 077
+   cp .env.example .env.local 2>/dev/null || touch .env.local
+   ```
+
+   Put only the variables actually consumed by this project in `.env.local`.
+   Typical values are:
+
+   ```dotenv
+   BASE_RPC_URL="https://<YOUR-PRODUCTION-RPC>/..."
+   NEXT_PUBLIC_BASE_RPC="https://<YOUR-PRODUCTION-RPC>/..."
+   ```
+
+   If the Foundry deploy script reads `PRIVATE_KEY`, do **not** add one. Change
+   that script to use `--account base-deployer` / the encrypted keystore before
+   proceeding. A private key must not appear in a project environment file.
+
+5. Confirm secrets cannot be committed:
+
+   ```bash
+   rg -n --hidden -g '!node_modules' -g '!broadcast' -g '!cache' \
+     '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]|infura\.io/v3/[A-Za-z0-9]' .
+   rg -n --hidden '^\.env(\.|$)|^broadcast/$|^cache/$|^\*\.key$' .gitignore
+   git status --short
+   ```
+
+   The first command must return no secrets. `.gitignore` must include `.env`,
+   `.env.*`, `*.key`, `broadcast/`, `cache/`, and `node_modules/`. If it does
+   not, add the missing entries now, then rerun the check. Never commit
+   `.env.local`.
+
+**Gate 0:** Operator and Verifier agree on the recorded commit, deployer
+address, fee-recipient address, canonical USDC address, and test-fan address.
+All three keys are separate. If any key was pasted into a file, shell history,
+chat, or git, abandon/rotate it before continuing.
+
+## 1. Production-readiness audit (before any public deployment)
+
+1. Open the Solidity contracts, deploy script, and tests. The Verifier checks
+   these facts in the actual code—not just the UI:
+
+   * Constructor/configuration pins the Base **canonical** USDC address above;
+     it cannot accept an arbitrary caller-supplied token.
+   * All USDC amounts use `6` decimals. A $1.00 tip is `1_000_000`, never
+     `1e18`.
+   * Fee math is integer-safe and exact: `fee = amount * 100 / 10_000`;
+     payout and fee add back to `amount`; define and test the rounding outcome
+     for tiny tips.
+   * The fee recipient is the agreed Safe/offline address, not the deployer;
+     changing it (if supported) is access-controlled and emits an event.
+   * The tip transfer uses a safe ERC-20 transfer method, checks its result,
+     and follows checks-effects-interactions / reentrancy protection. No funds
+     can be trapped by a failing recipient path.
+   * Creator withdrawal/tip payout behavior, duplicate creator registration,
+     zero address, zero amount, paused state, and unauthorized admin calls are
+     explicitly tested. If there is an owner/admin, document its powers in the
+     UI and set it to a Safe or restricted operational wallet—not an EOA used
+     for deployment.
+   * No upgrade proxy, delegatecall, unrestricted withdrawal, or token rescue
+     function exists unless it is intentional, documented, access-controlled,
+     and covered by tests.
+
+2. Add a regression test for every finding. At a minimum add tests for a
+   $1.00 tip, the smallest allowed tip, a non-round fee, exact fee/payout
+   accounting, wrong-token rejection, failed USDC transfer, invalid recipient,
+   unauthorized configuration, and reentrancy attempt. Run the actual suite:
+
+   ```bash
+   yarn test
+   cd packages/foundry
+   forge test -vvv
+   forge coverage
+   cd ../..
+   yarn lint
+   yarn build
+   ```
+
+   Use the repository's equivalent commands only if its `package.json` names
+   differ. Do not waive a failing test, lint warning that affects runtime, or
+   production build error. Commit the resulting audit/test fixes and repeat
+   Gate 0's secret scan before every commit.
+
+3. Inspect the frontend's production configuration:
+
+   * In `packages/nextjs/scaffold.config.ts`, set
+     `targetNetworks: [chains.base]` (using the project's imported `base`
+     chain) and `burnerWalletMode: "localNetworksOnly"`.
+   * Configure RPC overrides from environment variables only, for example:
+
+     ```ts
+     rpcOverrides: {
+       [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
+     },
+     ```
+
+     The fallback is acceptable for development only; production must set
+     `NEXT_PUBLIC_BASE_RPC` to the paid provider URL. Because `NEXT_PUBLIC_`
+     values are shipped to browsers, use a publishable client endpoint/key only
+     and enforce origin/rate limits in the RPC-provider dashboard.
+   * Do not edit `packages/nextjs/contracts/deployedContracts.ts`; it is
+     generated by deployment. Ensure the UI uses the generated contract entry
+     and that `externalContracts.ts`, if used for USDC, contains this exact
+     mainnet address and a `6`-decimal ABI definition.
+   * The tip UI must show one action at a time: Switch network → Approve exact
+     amount (or a documented limited multiple) → Send tip. It must display fee,
+     creator payout, token symbol, recipient address, transaction-pending
+     state, and clear rejection/revert/insufficient-balance errors. No infinite
+     approval.
+   * Replace development metadata/branding, add a 1200×630 Open Graph image,
+     legal/contact/support URLs, and a clear disclosure that payments are final
+     onchain and a 1% platform fee applies.
+
+4. Ask an independent Solidity reviewer to review the final diff and the fee
+   and withdrawal flows. For a contract holding user funds, do not treat local
+   tests as a substitute for review. Resolve every high/critical finding and
+   add a regression test before continuing.
+
+**Gate 1:** all commands pass, independent review is signed off, production
+config targets only Base, burner wallet is local-only, and the verified fee
+recipient/USDC addresses match the table. A contract-design change after this
+gate restarts at step 1.
+
+## 2. Rehearse on Base Sepolia
+
+This catches deployment wiring and wallet/provider behavior without risking
+funds. Temporarily configure the deployment script's *network-specific* token
+address for Base Sepolia only; never use the mainnet address on Sepolia or vice
+versa. Use a separate encrypted `base-sepolia-deployer` account.
+
+1. Add/confirm Base Sepolia in the Foundry RPC configuration and deploy using
+   the repository's Scaffold command:
+
+   ```bash
+   yarn deploy --network baseSepolia
+   yarn verify --network baseSepolia
+   ```
+
+   If this project registers the network as `base-sepolia` or uses a Foundry
+   script directly, use that documented name instead. First print available
+   commands with `yarn --help` / inspect `package.json`; do not guess a network
+   name and accidentally target mainnet.
+
+2. Record the Sepolia contract address and inspect the deploy transaction in a
+   block explorer. Confirm constructor arguments: Sepolia USDC, fee recipient,
+   and 100 bps. Confirm source verification reports the expected compiler and
+   source, not merely a successful transaction.
+
+3. Run the local frontend against the Sepolia deployment and the test-fan
+   wallet:
+
+   ```bash
+   yarn start
+   ```
+
+   Execute exactly one small full journey: connect → switch to Base Sepolia →
+   approve the amount → tip → wait for confirmation → verify both creator and
+   fee balances/event values in the explorer. Exercise wallet rejection,
+   insufficient USDC, wrong network, and refresh/reconnect paths. Test mobile
+   browser wallet as well as desktop.
+
+**Gate 2:** source verified; all real testnet checks pass; onchain accounting
+matches `amount = creator payout + fee`; no console errors; and the two people
+sign off on the UI's displayed address and amounts. Any deployment/config bug
+returns to step 1; do not patch source after the rehearsal without rerunning it.
+
+## 3. Deploy the immutable Base mainnet contract
+
+1. Restore/confirm the mainnet production values in the code and environment.
+   Run these preflight commands from the approved commit:
+
+   ```bash
+   git diff --exit-code
+   yarn test
+   cd packages/foundry && forge test -vvv && cd ../..
+   yarn build
+   cast chain-id --rpc-url "$BASE_RPC_URL"
+   cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Expected final three outputs: `8453`, non-empty bytecode, and `6`. If any
+   differs, stop: wrong RPC endpoints and fake USDC are launch blockers.
+
+2. Have the Verifier read the exact deploy-script constructor values on the
+   same commit. Operator then deploys once, from the encrypted keystore:
+
+   ```bash
+   yarn deploy --network base
+   ```
+
+   If the project exposes the key explicitly, the safe form is an account alias
+   / hardware-wallet flag, for example `--account base-deployer`; do not pass a
+   raw private key on the command line. Do not retry blindly if the terminal
+   disconnects—first look up the deployer nonce and submitted transaction in
+   the explorer/RPC to prevent duplicate deployment.
+
+3. Immediately copy the printed contract address and transaction hash to the
+   launch record, then verify source before any public URL is shared:
+
+   ```bash
+   yarn verify --network base
+   ```
+
+   Independently open the verified explorer page and confirm address, bytecode,
+   compiler settings, constructor arguments (canonical USDC, approved fee
+   recipient, 100 bps), owner/admin, and emitted deployment/config events.
+   Run read-only calls against the mainnet address using the contract's actual
+   getter names to confirm the same values; for example, replace the placeholder
+   function names below with your ABI's names:
+
+   ```bash
+   cast call <MAINNET_TIP_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+   cast call <MAINNET_TIP_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+   ```
+
+   If verification fails, do not announce or use the contract. Fix the exact
+   source/compiler/config mismatch, redeploy only after Gate 1, and treat the
+   first address as permanently unused.
+
+4. The deployment must regenerate the application artifacts. Confirm the
+   generated `packages/nextjs/contracts/deployedContracts.ts` now contains the
+   exact `<MAINNET_TIP_CONTRACT>` under chain `8453`; do not hand-edit it.
+   Commit only generated non-secret artifacts and source/config changes:
+
+   ```bash
+   rg -n '<MAINNET_TIP_CONTRACT>|8453' packages/nextjs/contracts/deployedContracts.ts
+   git status --short
+   git diff --cached --name-only | rg -i '\.env|key|secret|private' && exit 1 || true
+   ```
+
+**Gate 3:** mainnet source is verified; the independent onchain reads match all
+production values; generated frontend artifacts reference exactly that address;
+and no secret is staged. A wrong immutable address means redeploy correctly;
+never redirect users to it.
+
+## 4. Mainnet canary before publishing
+
+1. Keep the frontend local but point it at Base mainnet and the newly deployed
+   contract. Run a clean production build/start, not development mode:
+
+   ```bash
+   yarn build
+   yarn start
+   ```
+
+2. The Verifier, on the funded test-fan wallet, completes one minimal real
+   USDC tip. They compare the UI amount, approval amount, recipient, fee, and
+   creator payout with the wallet's transaction simulation before signing.
+   After confirmation they check the decoded event and token balance changes in
+   the explorer. The accounting must exactly match the fee rule.
+
+3. On a second wallet/browser, test connect, Base network switch, rejection of
+   approval, rejection of tip, insufficient USDC, page reload while pending,
+   and disconnect/reconnect. Check desktop MetaMask, a WalletConnect/Rainbow
+   flow, and mobile. Inspect browser console and network tabs for errors or
+   leaked environment secrets.
+
+**Gate 4:** the actual mainnet canary is confirmed by both people, all expected
+balance changes are correct, UI contract/address text is correct, and no error
+or burner wallet appears. If the contract is wrong, stop public launch and go
+back to step 1; frontend-only defects return to this step after a fix.
+
+## 5. Publish the frontend and domain
+
+Vercel is the recommended production target for a normal Next.js Scaffold-ETH
+app. Do not use IPFS if the project depends on SSR, server routes, API routes,
+or runtime environment variables. If it is fully static and decentralized
+hosting is intentional, replace this section with `yarn ipfs` and perform the
+same checks on the resulting CID URL.
+
+1. In the Vercel project, import the approved repository commit and set its root
+directory to `packages/nextjs` if required by the monorepo configuration. Use
+the repo's existing build command (normally `yarn build`) and output settings.
+Set Production environment variables there—at minimum:
+
+   ```dotenv
+   NEXT_PUBLIC_BASE_RPC=https://<PUBLISHABLE-PRODUCTION-RPC>/...
+   ```
+
+   Add only public-safe values prefixed `NEXT_PUBLIC_`; never add a deployer
+   key, fee-recipient key, private RPC credential, or admin secret. Configure
+   allowed origins/rate limits at the RPC provider for the production domain.
+
+2. Deploy a preview first, then run the full Gate 4 check against the preview
+   URL. After it passes, deploy the same commit to production:
+
+   ```bash
+   yarn vercel
+   ```
+
+   If the command is not present in this Scaffold version, use the Vercel
+   dashboard's production deployment for that exact commit. Never rebuild a
+   different unreviewed commit to production.
+
+3. Attach the custom domain in Vercel, set the DNS records Vercel supplies,
+   wait for TLS to show valid, and make the canonical domain redirect policy
+   consistent (`www` or apex). Update the wallet/RPC provider allowed origins
+   to include both the preview and canonical production domain only as needed.
+
+4. From an incognito desktop browser and a real phone on cellular data, open
+   the canonical HTTPS URL. Repeat the one-minimal-tip journey. Validate Open
+   Graph metadata with a social-preview debugger, page title/favicon, all links,
+   404 behavior, and mobile layout. Check Vercel deployment/runtime logs and
+   browser console—both must be clean.
+
+**Gate 5 (public launch):** custom domain has valid HTTPS; mainnet connect,
+approval, tip, balances and events work from the canonical URL; no errors,
+burner wallet, or secrets are exposed; and Operator plus Verifier record the
+contract address, deploy transaction, verified explorer URL, production URL,
+timestamp, and canary transaction hash in the launch record. Only then share
+the URL publicly.
+
+## 6. First 72 hours and incident rules
+
+1. Monitor Vercel errors, RPC error/rate-limit dashboards, Base explorer events
+and contract USDC balance, and user support inbox at least several times per
+day. Alert on failed tip calls, unexpected fee/contract transfers, elevated
+RPC errors, or a UI build that references another contract.
+
+2. Keep a small, separate operational ETH balance only for necessary admin
+actions. Reconcile the contract's USDC accounting daily against emitted tip/
+withdrawal events and expected platform fee totals. Do not move funds from the
+deployer wallet into the contract.
+
+3. A frontend fault: immediately roll back the Vercel alias to the last
+verified deployment, fix locally, run the appropriate Gate 4 checks against
+the unchanged verified contract, then redeploy.
+
+4. A suspected contract/accounting/security fault: immediately remove public
+   calls-to-action and point the site to a maintenance page; if a tested pause
+   function exists, have the authorized Safe execute it. Preserve transaction
+   hashes/logs, notify affected users truthfully, and get an independent review.
+   Do not improvise a contract upgrade or deploy a replacement under pressure.
+   A contract fix requires regression tests, review, a new verified deployment,
+   fresh frontend artifacts, and this runbook from step 1.
+
+## Authoritative references
+
+* [Base network connection details](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+* [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview)
+* [Circle's official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+* [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io/)

tokens used
50 106
````

## final message

Created the complete, gated Base mainnet launch runbook: [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120625Z-codex-with-skill-3/LAUNCH.md).

It covers secure key setup, contract/UI audits, Base Sepolia rehearsal, verified mainnet deployment, real-money canary, Vercel/domain release, and 72-hour incident handling—with explicit stop gates throughout.
