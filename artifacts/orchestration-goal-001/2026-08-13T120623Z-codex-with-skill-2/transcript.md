# Executor transcript — 2026-08-13T120623Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2

## session

````text
OpenAI Codex v0.146.0
--------
workdir: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: medium
reasoning summaries: none
session id: 019ffb13-2d56-7b10-9798-a233c9ed14fd
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
I’m using the project’s Ethereum dApp orchestration guide to turn your local-only app into a guarded Base production launch runbook. I’ll verify the current Base, USDC, Scaffold-ETH, and hosting details before writing the document.
exec
/bin/zsh -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2
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
exec
/bin/zsh -lc "pwd && rg --files -g '"'!node_modules'"' -g '"'!*.lock'"' | head -80" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2
 succeeded in 0ms:
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2
TASK.md
package.json

web search: site:docs.scaffoldeth.io foundry deploy base yarn deploy network ...
exec
/bin/zsh -lc "sed -n '1,260p' TASK.md && sed -n '1,200p' package.json" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2
 succeeded in 0ms:
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
{
  "name": "eval-workspace",
  "private": true
}

web search: 
web search: 
codex
I confirmed the production constants: Base mainnet is chain ID 8453, and Circle’s native Base USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (six decimals). I’m writing this as a Sepolia rehearsal followed by a deliberately gated mainnet release, with Vercel as the public URL host.
2026-08-13T12:25:01.275412Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 106, 'git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)' && exit 1 || true' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31918aaf03edce065d5839b662717cbd8ecf06cb
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,281 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)' && exit 1 || true
+rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages && exit 1 || true
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet deployment and Vercel production build. No code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, and confirmed real-USDC canary with exact accounting. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the signed tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.
+

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31918aaf03edce065d5839b662717cbd8ecf06cb
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,281 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)' && exit 1 || true
+rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages && exit 1 || true
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet deployment and Vercel production build. No code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, and confirmed real-USDC canary with exact accounting. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the signed tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.
+

exec
/bin/zsh -lc 'rg -n "git ls-files|rg -n --glob|''^#|''^##|yarn deploy|yarn verify|yarn vercel" LAUNCH.md && wc -l LAUNCH.md && git diff --check -- LAUNCH.md' in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2
 succeeded in 0ms:
1:# Base production launch runbook
5:## Fixed production facts
18:## 0. Assign roles and make launch data explicit
33:## 1. Reproduce the known-good local state and inspect the security boundary
63:git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)' && exit 1 || true
64:rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages && exit 1 || true
71:## 2. Make configurations chain-specific and secret-free
123:## 3. Base Sepolia: execute a full deployment rehearsal
138:yarn deploy --network baseSepolia
139:yarn verify --network baseSepolia
142:If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
171:## 4. Prepare the immutable production release
205:## 5. Base mainnet deployment and verification
220:yarn deploy --network base
221:yarn verify --network base
232:## 6. Publish the frontend with Vercel
245:yarn vercel
253:yarn vercel --prod
260:## 7. Release and first-week operating procedure
273:### Incident rules
     281 LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31918aaf03edce065d5839b662717cbd8ecf06cb
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,281 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)' && exit 1 || true
+rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages && exit 1 || true
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet deployment and Vercel production build. No code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, and confirmed real-USDC canary with exact accounting. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the signed tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.
+

apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..05b82e2ff7e6312af98ef771e52b595b5ee92e29
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,280 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+! git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)'
+! rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet deployment and Vercel production build. No code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, and confirmed real-USDC canary with exact accounting. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the signed tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..05b82e2ff7e6312af98ef771e52b595b5ee92e29
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,280 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+! git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)'
+! rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet deployment and Vercel production build. No code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, and confirmed real-USDC canary with exact accounting. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the signed tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.

codex
The runbook is now in place. I also hardened its launch-time secret scan so it actually fails when tracked secrets or deployment artifacts are detected, rather than merely printing a warning.
exec
/bin/zsh -lc "git diff --check -- LAUNCH.md && git status --short && sed -n '1,90p' LAUNCH.md" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2
 succeeded in 0ms:
?? LAUNCH.md
# Base production launch runbook

This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.

## Fixed production facts

| Item | Value |
| --- | --- |
| Network | Base Mainnet, chain ID `8453` |
| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| USDC decimals | `6` |
| Rehearsal network | Base Sepolia, chain ID `84532` |
| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.

## 0. Assign roles and make launch data explicit

One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.

Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.

Choose and write down before proceeding:

* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
* `PROD_DOMAIN` — the final custom domain, if one is being used.
* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).

**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.

## 1. Reproduce the known-good local state and inspect the security boundary

Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.

```bash
git status --short
git pull --ff-only
yarn install --immutable
yarn format:check
yarn lint
yarn test
cd packages/foundry && forge test -vvv && forge coverage && cd ../..
```

If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.

Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:

* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.

Also run the repository secret check before the first commit:

```bash
git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
! git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)'
! rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages
```

The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.

**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.

## 2. Make configurations chain-specific and secret-free

Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.

1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:

   ```ts
   import { base, baseSepolia } from "viem/chains";

   targetNetworks: [baseSepolia],
   burnerWalletMode: "localNetworksOnly",
   rpcOverrides: {
     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
   },
   ```

   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..05b82e2ff7e6312af98ef771e52b595b5ee92e29
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,280 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+! git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)'
+! rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet deployment and Vercel production build. No code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, and confirmed real-USDC canary with exact accounting. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the signed tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.

apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..51f5db865e743637a8de50b9cee53a580ff3af07
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,295 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+! git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)'
+! rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet contract deployment. The only allowed post-deployment source change is Scaffold's generated mainnet address record, handled explicitly in Gate 5. No other code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+Commit the generated address record and nothing else. This is the source revision Vercel must build:
+
+```bash
+git status --short
+git diff -- packages/nextjs/contracts/deployedContracts.ts
+git diff --name-only
+git add packages/nextjs/contracts/deployedContracts.ts
+git diff --cached --check
+git commit -m "chore: record Base mainnet deployment"
+git tag -a v1.0.1 -m "Base mainnet address release"
+git push origin HEAD v1.0.1
+```
+
+Before `git add`, `git diff --name-only` must list only `packages/nextjs/contracts/deployedContracts.ts` (and, if this Scaffold version generates it, the corresponding reviewed deployment metadata file). It must not list `.env`, broadcast, cache, or application code. The reviewer checks the generated contract address and chain ID 8453 against the verified explorer page.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, confirmed real-USDC canary with exact accounting, and a reviewer-approved `v1.0.1` tag containing only the generated deployment record. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the reviewer-approved `v1.0.1` tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..51f5db865e743637a8de50b9cee53a580ff3af07
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,295 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+! git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)'
+! rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet contract deployment. The only allowed post-deployment source change is Scaffold's generated mainnet address record, handled explicitly in Gate 5. No other code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+Commit the generated address record and nothing else. This is the source revision Vercel must build:
+
+```bash
+git status --short
+git diff -- packages/nextjs/contracts/deployedContracts.ts
+git diff --name-only
+git add packages/nextjs/contracts/deployedContracts.ts
+git diff --cached --check
+git commit -m "chore: record Base mainnet deployment"
+git tag -a v1.0.1 -m "Base mainnet address release"
+git push origin HEAD v1.0.1
+```
+
+Before `git add`, `git diff --name-only` must list only `packages/nextjs/contracts/deployedContracts.ts` (and, if this Scaffold version generates it, the corresponding reviewed deployment metadata file). It must not list `.env`, broadcast, cache, or application code. The reviewer checks the generated contract address and chain ID 8453 against the verified explorer page.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, confirmed real-USDC canary with exact accounting, and a reviewer-approved `v1.0.1` tag containing only the generated deployment record. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the reviewer-approved `v1.0.1` tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.

codex
Created [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2/LAUNCH.md).

It provides a gated Base Sepolia rehearsal → verified Base mainnet deployment → real-USDC canary → Vercel public launch, including exact configuration targets, commands, ownership handling, secret checks, and rollback/incident procedures. Verified formatting with `git diff --check`.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..51f5db865e743637a8de50b9cee53a580ff3af07
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,295 @@
+# Base production launch runbook
+
+This is the ordered production path for the Foundry-flavour Scaffold-ETH 2 creator-tipping app. Run every command from the **root of the checked-out app repository** (not this document's directory) unless a command says otherwise. There are two hard stops: the Base Sepolia rehearsal must pass, and the two people on the team must independently sign off immediately before the Base mainnet deployment. Do not substitute a mainnet deployment for the rehearsal.
+
+## Fixed production facts
+
+| Item | Value |
+| --- | --- |
+| Network | Base Mainnet, chain ID `8453` |
+| Public fallback RPC (not suitable for production traffic) | `https://mainnet.base.org` |
+| Official Circle USDC on Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| USDC decimals | `6` |
+| Rehearsal network | Base Sepolia, chain ID `84532` |
+| Official Circle test USDC on Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
+
+Use only the Circle USDC addresses above. Do not use a token called “USDC” found through a wallet search or copy an Ethereum/bridged-USDC address into Base configuration.
+
+## 0. Assign roles and make launch data explicit
+
+One person is **deployer**: they hold the temporary deployment EOA and run the transactions. The other is **reviewer**: they independently check every address, transaction, configuration diff, and explorer page before a gate is passed. Neither person posts a seed phrase, private key, RPC credential, or Vercel token in chat, a ticket, a shell history, a screenshot, or git.
+
+Create a two-of-two Safe on Base *before* mainnet deployment. This Safe owns any owner/admin/fee-recipient control in the app after deployment. Record its checksummed address as `SAFE_ADDRESS`. If the current contract has no privileged functions and sends the fee directly to an immutable address, record that in the release notes instead; do not invent an ownership transfer.
+
+Choose and write down before proceeding:
+
+* `SAFE_ADDRESS` — the two-of-two Safe address on Base.
+* `FEE_RECIPIENT` — normally `SAFE_ADDRESS`; it must not be a personal EOA.
+* `PROD_DOMAIN` — the final custom domain, if one is being used.
+* The launch limits: maximum tip accepted by the UI, maximum fee withdrawal per transaction (if applicable), and the small real-USDC amount for the canary tip (suggested: `1.00` USDC).
+
+**Gate 0:** both people approve those values in writing. If the contract cannot send platform fees to a Safe or cannot have its privileged role transferred, stop here and make that a contract change with tests; do not deploy a contract whose money/control remains tied to a personal wallet.
+
+## 1. Reproduce the known-good local state and inspect the security boundary
+
+Use the exact locked dependencies in the repository. Do not upgrade packages as part of a launch.
+
+```bash
+git status --short
+git pull --ff-only
+yarn install --immutable
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && forge coverage && cd ../..
+```
+
+If this Scaffold version does not provide one of `format:check`, `lint`, or `test`, run `yarn run` once, record the equivalent script in the release notes, and run it. Do not silently skip it. `forge coverage` is a report, not a pass/fail gate: the reviewer must compare it with the established local baseline and ensure every money-moving branch is covered.
+
+Review the deployed contract and its tests together. Confirm all of the following from code, not from the UI:
+
+* The token address is either immutable/constructor-configured or selected by an explicit chain-ID mapping. It is never arbitrary user input.
+* The mainnet mapping is the native Base USDC address above and the Sepolia mapping is the test address above. The token uses six decimal units.
+* A tip of `amount` transfers exactly `amount - floor(amount * 100 / 10_000)` to the creator and `floor(amount * 100 / 10_000)` to the fee recipient (or document the contract's explicitly tested rounding rule). The two transfers sum exactly to `amount`.
+* `amount == 0`, a non-creator/zero creator, an unregistered creator, failed USDC transfer/transferFrom, insufficient allowance/balance, and reentrancy all revert or behave exactly as intended. Add a regression test for any untested case now.
+* Fee withdrawal, fee-recipient changes, pauses, upgrades, and ownership (if they exist) are access controlled and covered by positive and negative tests. An upgradeable proxy requires the proxy admin to be the Safe and an explicit upgrade/timelock policy; otherwise stop and get a focused external review.
+* Events include enough data to reconstruct creator, fan, gross tip, creator amount, and fee. The UI does not trust an event before the transaction is confirmed.
+* The UI uses `parseUnits(value, 6)` / `formatUnits(value, 6)`, exact or bounded USDC approvals (never unlimited), one action at a time (switch network → approve → tip), and disables its controls while a transaction is pending.
+
+Also run the repository secret check before the first commit:
+
+```bash
+git check-ignore -v .env .env.local packages/foundry/broadcast packages/foundry/cache
+! git ls-files | rg '(^|/)(\.env|.*\.key|broadcast|cache)(/|$)'
+! rg -n --glob '*.{ts,tsx,js,sol,json,yml,yaml}' '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+' packages
+```
+
+The first command must show ignore rules for secrets and Foundry artifacts. The last two commands must produce no match. If a private key or credential has *ever* been committed or pushed, assume it is compromised: revoke/rotate it, create a new deployer key, and only then continue.
+
+**Gate 1:** clean worktree except for reviewed launch changes; all tests and checks pass; the reviewer signs off on the money-flow/access-control review.
+
+## 2. Make configurations chain-specific and secret-free
+
+Do this in a reviewable branch. Do not edit `packages/nextjs/contracts/deployedContracts.ts`; Scaffold-ETH generates it.
+
+1. In `packages/nextjs/contracts/externalContracts.ts`, add the ERC-20 ABI needed by the UI (`allowance`, `approve`, `balanceOf`, `decimals`, `symbol`) for **both** chain IDs. Set the Base and Base Sepolia addresses to the two constants above. This file is the only frontend external-contract registry.
+2. In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`, set the target initially to the rehearsal network, and prevent burner wallets on public networks:
+
+   ```ts
+   import { base, baseSepolia } from "viem/chains";
+
+   targetNetworks: [baseSepolia],
+   burnerWalletMode: "localNetworksOnly",
+   rpcOverrides: {
+     [base.id]: process.env.NEXT_PUBLIC_BASE_RPC ?? "https://mainnet.base.org",
+     [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
+   },
+   ```
+
+   Preserve unrelated existing settings. `NEXT_PUBLIC_*` values are public by design; use an RPC provider's browser-safe, domain-restricted key or the public fallback. Never put a deployer key in a `NEXT_PUBLIC_*` variable.
+3. Make the Foundry deployment script read the USDC address and fee recipient from environment variables, validate they are nonzero, and emit/record the values. It must not contain mainnet addresses copied into a test-only script without a chain-ID check. Its constructor arguments must be identical in the Sepolia and mainnet runs except for chain-specific addresses.
+4. Add `.env.example` with variable *names only*, and ensure `.env`, `.env.*`, `*.key`, `packages/foundry/broadcast/`, and `packages/foundry/cache/` are in `.gitignore`. Do not add actual `.env` files.
+
+Create the private local configuration from the example (replace values only in your local, ignored file):
+
+```bash
+cp .env.example .env
+chmod 600 .env
+```
+
+It must contain, at minimum:
+
+```dotenv
+BASE_SEPOLIA_RPC_URL=<authenticated-Base-Sepolia-RPC>
+BASE_RPC_URL=<authenticated-Base-mainnet-RPC>
+NEXT_PUBLIC_BASE_SEPOLIA_RPC=<browser-safe-Base-Sepolia-RPC>
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+FEE_RECIPIENT=<SAFE_ADDRESS>
+```
+
+Use a hardware-wallet account or a Foundry encrypted keystore for the deployer; do not place `PRIVATE_KEY` in `.env`. For a keystore named `base-launch-deployer`:
+
+```bash
+cast wallet import base-launch-deployer --interactive
+cast wallet address --account base-launch-deployer
+```
+
+Fund only that displayed address with a small amount of Base Sepolia ETH for the rehearsal. The reviewer compares every address and chain ID independently.
+
+**Gate 2:** a code review confirms the config is secret-free, `externalContracts.ts` contains the correct USDC address for each network, and no production config can expose a burner wallet.
+
+## 3. Base Sepolia: execute a full deployment rehearsal
+
+Base Sepolia is a public network, so it catches RPC, wallet, explorer, constructor, UI build, and real ERC-20 integration problems without risking money. Obtain test ETH from a current Base-listed faucet. Obtain Circle test USDC only from Circle's current supported test flow; never buy or accept a lookalike token.
+
+Start by proving the RPC endpoint is actually Base Sepolia and that the Circle token at the configured address has six decimals:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+test "$(cast call "$USDC_BASE_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "6"
+```
+
+Deploy using the repository's standard Scaffold wrapper so that contract artifacts and `deployedContracts.ts` are produced consistently:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+If the existing project maps network names differently, run `yarn deploy --help` before deploying and use the exact listed Base Sepolia name. Do not fall back to raw `forge script` unless the project has no wrapper; if it has no wrapper, document the existing deployment script path and run it with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer --broadcast`.
+
+Save the deployment transaction hash, contract address, compiler/optimizer settings, constructor arguments, and verified explorer URL in a private release record. Then prove the live deployment, replacing `<TIP_CONTRACT>` with the address emitted by the deployment:
+
+```bash
+cast code <TIP_CONTRACT> --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast call <TIP_CONTRACT> '<READ_THE_ACTUAL_OWNER_OR_FEE_GETTER_SIGNATURE>' --rpc-url "$BASE_SEPOLIA_RPC_URL"
+```
+
+The first response must not be `0x`; the second must match the expected Safe or fee recipient. Use the contract's actual public getter name, not a guessed one. The reviewer opens the explorer verification page and checks the source, compiler settings, constructor arguments, USDC address, and deployed bytecode match the local artifact.
+
+Build and serve the rehearsal UI against Sepolia:
+
+```bash
+yarn build
+yarn start
+```
+
+With two separate browser wallets, execute and record all of these on `http://localhost:3000`:
+
+1. Wrong-network connect shows only **Switch Network**; switching selects Base Sepolia.
+2. With no allowance, only **Approve** appears; approve a bounded amount.
+3. Tip a test amount with a nonzero fee (for example `1.00` test USDC). Verify the USDC `Transfer` logs and balances: creator receives `0.99`, fee recipient receives `0.01`, and the contract retains only what its documented design requires.
+4. Retry with insufficient balance, insufficient allowance, a rejected wallet request, a disconnected wallet, malformed amount, and duplicate click. Each has a human error, no stuck spinner, and no unintended transfer.
+5. If creator registration, fee withdrawal, pause, or administration exists, exercise the permitted operation with the Safe and confirm a non-owner fails.
+6. Refresh during a pending/confirmed transaction, test mobile width, and test MetaMask plus one WalletConnect-compatible wallet.
+
+**Gate 3:** every test passes on the public Sepolia chain, the source is verified, the UI is production-built, and no console error or failed network request remains. A failed gate means fix it locally, add a regression test, and repeat this entire phase with a fresh Sepolia deployment.
+
+## 4. Prepare the immutable production release
+
+Only after Gate 3, make a small release PR containing the finished contract, tests, UI, external-contract registry, and production metadata. It must set the UI target to Base mainnet:
+
+```ts
+targetNetworks: [base],
+burnerWalletMode: "localNetworksOnly",
+```
+
+Set the application title, description, favicon, and a 1200×630 Open Graph image. State clearly in the UI that tips are USDC on Base, show the exact 1% fee before approval, and link the contract address to Basescan after it is known. Do not claim custody, investment returns, tax treatment, or a refund policy that the contract cannot deliver.
+
+From the exact commit proposed for production, run:
+
+```bash
+git diff --check
+yarn install --immutable
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+git status --short
+```
+
+Review the Vercel build output and the `.next` build locally. Confirm the frontend obtains its contract address from generated `deployedContracts.ts`, not a Sepolia address copied into a component. Confirm no `NEXT_PUBLIC_` value contains a secret or a deployer private key.
+
+Merge only after both people approve the exact commit SHA. Tag it:
+
+```bash
+git tag -a v1.0.0 -m "Base mainnet launch"
+git push origin v1.0.0
+```
+
+**Gate 4:** the signed-off tag is the sole source for the mainnet contract deployment. The only allowed post-deployment source change is Scaffold's generated mainnet address record, handled explicitly in Gate 5. No other code/config changes after this point without going back through the appropriate gate.
+
+## 5. Base mainnet deployment and verification
+
+Create/fund the deployer **only now**. Send enough ETH for deployment plus a large buffer, but no USDC. Verify its balances and network before broadcasting:
+
+```bash
+set -a; source .env; set +a
+test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+cast wallet address --account base-launch-deployer
+cast balance "$(cast wallet address --account base-launch-deployer)" --rpc-url "$BASE_RPC_URL"
+test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL")" = "6"
+```
+
+The reviewer compares the displayed addresses byte-for-byte with this runbook, the Safe, and the release record. Then deploy exactly once:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+Do not continue if deployment or verification fails. Record the transaction hash and contract address. Check on Basescan that the contract is verified and that constructor arguments/initial state point to the official Base USDC and the Safe. Call each critical read-only getter using `cast call` and verify fee rate (`100` basis points), fee recipient, owner/admin, token address, pause state, and creator registry state against the release record.
+
+If the deployer initially owns the contract, transfer ownership/admin to the Safe now using the contract's documented procedure, then have both Safe owners execute/accept any two-step transfer. Verify the deployer can no longer perform the privileged action. If that transfer cannot be completed, do not launch the frontend; treat the deployment as a failed rehearsal and redeploy only after a tested fix.
+
+Run a private, real-money canary before public hosting. Use a team-controlled fan wallet and creator wallet; fund the fan with only the chosen small USDC amount. On a locally served production build, make one `1.00` USDC tip. The reviewer verifies confirmed onchain USDC balance deltas and logs: creator `+0.99` USDC; Safe/fee recipient `+0.01` USDC; fan `-1.00` USDC (plus ETH gas). Also check the UI receipt links to the correct Base explorer.
+
+Commit the generated address record and nothing else. This is the source revision Vercel must build:
+
+```bash
+git status --short
+git diff -- packages/nextjs/contracts/deployedContracts.ts
+git diff --name-only
+git add packages/nextjs/contracts/deployedContracts.ts
+git diff --cached --check
+git commit -m "chore: record Base mainnet deployment"
+git tag -a v1.0.1 -m "Base mainnet address release"
+git push origin HEAD v1.0.1
+```
+
+Before `git add`, `git diff --name-only` must list only `packages/nextjs/contracts/deployedContracts.ts` (and, if this Scaffold version generates it, the corresponding reviewed deployment metadata file). It must not list `.env`, broadcast, cache, or application code. The reviewer checks the generated contract address and chain ID 8453 against the verified explorer page.
+
+**Gate 5:** verified source, correct immutable/initial state, Safe control, confirmed real-USDC canary with exact accounting, and a reviewer-approved `v1.0.1` tag containing only the generated deployment record. Any discrepancy means stop public release, remove the pending frontend deployment, and investigate.
+
+## 6. Publish the frontend with Vercel
+
+Vercel is chosen for a stable public URL, preview deployments, custom-domain TLS, and rollback. Import the repository into the team-owned Vercel project; do not use a personal account as the only owner. Configure its root/build settings for the existing `packages/nextjs` app. In Vercel, set **Production** environment variables only for the public RPC values used by the frontend:
+
+```dotenv
+NEXT_PUBLIC_BASE_RPC=<browser-safe-Base-mainnet-RPC>
+```
+
+Add any existing public WalletConnect project ID only if the app already needs it; restrict it to `PROD_DOMAIN` and Vercel preview domains. Never add Foundry RPC credentials, a keystore password, `PRIVATE_KEY`, or Safe signer material to Vercel.
+
+Create a preview from the reviewer-approved `v1.0.1` tag/commit, then validate it before promoting:
+
+```bash
+yarn vercel
+```
+
+Use the output preview URL to repeat the UI portion of the canary with a second small funded wallet: connect, switch network, approve a bounded amount, tip, wait for confirmation, refresh, and inspect console/network tabs. Confirm the deployed app reads chain ID 8453 and the exact mainnet contract address.
+
+When that is clean, deploy the same SHA to production:
+
+```bash
+yarn vercel --prod
+```
+
+Attach `PROD_DOMAIN`, complete the Vercel DNS instructions, and wait until its TLS certificate is valid. Test both the Vercel production URL and the custom domain; one must redirect consistently to the canonical URL. Do not point an existing marketing domain at the app until this test passes.
+
+**Gate 6:** the public URL has valid HTTPS, connects wallets, requests Base mainnet, uses the verified contract, has no burner wallet, and passes the real-money canary without browser-console errors.
+
+## 7. Release and first-week operating procedure
+
+Publish the canonical URL, Base chain ID, verified Basescan contract link, fee (`1%`), and support contact. Do not publish deployer or Safe operational details beyond the public Safe address. Keep a release record containing the tag SHA, contract address, deployment/ownership transaction hashes, Safe, fee recipient, USDC address, Vercel deployment URL, and both canary hashes.
+
+For the first seven days, one team member checks at least daily:
+
+* Vercel availability/error logs and browser console errors.
+* The Base explorer for failed transactions, unexpected admin calls, and tip events whose gross/creator/fee totals do not reconcile.
+* The Safe's USDC balance and only the contract's documented fee withdrawals.
+* RPC rate-limit errors and WalletConnect connection failures.
+
+Set alerts where available for the contract address, Safe transactions, Vercel deployment failures, and high client-side error rate. Keep the deployer key funded only for a possible recovery deployment, never as the fee recipient or contract owner.
+
+### Incident rules
+
+* **Frontend-only bug:** immediately roll Vercel back to the prior known-good deployment, reproduce against the still-live contract locally, fix, test, preview, and re-promote.
+* **Suspicious approval/UI behavior:** remove the public URL from promotion, pause the contract only through the Safe if that capability was designed and tested, tell users not to approve/tip, and investigate from transaction logs.
+* **Contract accounting or authorization bug:** do not “patch” it in the UI. Pause through the Safe if safely available; publish a clear incident notice; add a local regression test; obtain review; deploy a new verified contract; perform a new canary; then release a frontend that points to it.
+* **Credential exposure:** rotate/revoke the credential immediately. For a deployer private-key exposure, move any remaining ETH, abandon that EOA, and never use it for privileged control.
+
+Base documents chain IDs and RPC information at https://docs.base.org/base-chain/quickstart/connecting-to-base and Circle publishes the authoritative USDC addresses at https://developers.circle.com/stablecoins/usdc-contract-addresses. Re-check both sources on launch day before Gate 5.

tokens used
59 101
````

## final message

Created [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120623Z-codex-with-skill-2/LAUNCH.md).

It provides a gated Base Sepolia rehearsal → verified Base mainnet deployment → real-USDC canary → Vercel public launch, including exact configuration targets, commands, ownership handling, secret checks, and rollback/incident procedures. Verified formatting with `git diff --check`.
