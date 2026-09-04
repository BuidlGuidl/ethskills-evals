# Executor transcript — 2026-08-27T180856Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04469-4f17-7791-98a4-acc236337889
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
I’ll turn the current local-fork setup into a production runbook for Base, including deployment, verification, frontend hosting, and pre-launch checks. I’m using the project’s orchestration guidance because this is explicitly a live-network launch plan.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: orchestration
description: Use when a Scaffold-ETH 2 build leaves localhost — planning a launch or the order things go out in, deploying or verifying contracts on a live network, standing up a local fork of a real chain, or fixing a contract bug that is already onchain. Not for frontend implementation (`frontend-ux`), the pre-launch UI audit (`qa`), or IPFS/Vercel deploy mechanics (`frontend-playbook`).
---

# Shipping a dApp

Going live is three moves, never one: contracts local, then contracts live with the frontend still on localhost, then the frontend public. The middle move is the one that gets skipped and the one that catches everything — real chain, real gas, real decimals, a real wallet — while the UI is still yours alone to edit in seconds.

Name a go/no-go condition at each boundary, not just the commands. Three of them:

- **Before deploying to the live network:** contract tests pass and the deploy script runs clean against a local fork.
- **Before the frontend is reachable publicly:** you have walked the entire user journey against the live contracts with a real wallet and real money — $1-10 of your own — and every step worked.
- **After the frontend deploy:** you have loaded the public URL yourself and put one transaction through it.

A runbook that names the commands but not the conditions will keep going after something has already gone wrong.

## Verify in the same breath as deploy

`yarn verify --network base` (or your target chain) belongs immediately after `yarn deploy --network base`, not in a launch checklist weeks out. Until it runs, users and integrators are looking at opaque bytecode, and you are debugging a live contract without source on the explorer.

**Nobody has to go and get a block explorer API key first.** `packages/foundry/.env.example` already carries a working `ETHERSCAN_API_KEY` and postinstall copies it to `.env`, so `yarn verify` works on a fresh checkout. So a launch plan never lists "obtain an explorer key" among its steps, and never hands anyone an env template with a blank `ETHERSCAN_API_KEY=` to fill in: the value is already there, and a step that waits on that key waits for nothing. Swapping in your own is optional housekeeping afterwards, not a launch dependency. One real constraint: `yarn verify` replays `broadcast/run-latest.json`, so run it from the checkout that did the deploy.

## A live contract bug goes back to the start

Deployed bytecode cannot be edited, and the contract is a public API — a guard added in the frontend binds nobody, because direct calls, integrators and other frontends reach the same function. Shipping the UI clamp to buy hours is fine; calling it the fix is not.

The fix is the whole loop, in order: reproduce locally, correct the source, add the regression test that fails without the correction, redeploy (or upgrade in place, if it is behind a proxy), repoint the frontend if the address moved, and handle the state and users already there — migration or comms, your call. The loop is the same whether the bug surfaces before launch or with the app already public.

## SE-2 specifics worth having right

- **Fork the chain you are targeting rather than `yarn chain`** — `yarn fork --network base` gives you Uniswap, USDC, Aave and funded whales already deployed, so you write no mocks of things that exist. The flag is load-bearing: yarn swallows a bare positional argument, so `yarn fork base` silently forks Ethereum mainnet instead. In the hardhat flavor `yarn fork` ignores its argument entirely and always forks mainnet — change `forking.url` in `hardhat.config.ts` to fork anything else. Either way the fork answers chain id 31337, so the chain id never tells you what you forked: check for state only the target chain has, such as code at one of its token addresses.
- **`scaffold.config.ts` is committed.** An RPC or API key pasted into `rpcOverrides` or `alchemyApiKey` is a published key; read it from `process.env` and keep the value in `.env.local`. `wallets/SKILL.md` covers the rest of key handling.
- **A frontend-only ticket deploys nothing.** Do not stand up a chain and redeploy to regenerate `deployedContracts.ts` unless deploying was the ask.

exec
/bin/bash -lc "rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,200p'; git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 0ms:
exec
/bin/bash -lc "sed -n '1,240p' TASK.md && sed -n '1,240p' package.json && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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
web search: site:docs.scaffoldeth.io foundry deployment yarn deploy --network base Scaffold-ETH 2 ...
web search: 
web search: site:docs.scaffoldeth.io foundry deployment yarn deploy --network base Scaffold-ETH 2 ...
web search: 
web search: 
codex
The runbook will include a Base Sepolia dress rehearsal before mainnet, then a private localhost session against the deployed Base contracts before the frontend becomes public. That sequence is the main protection against treating a local fork as a production test.
web search: 
web search: site:docs.base.org Base mainnet chain id 8453 Base Sepolia chain id 84532 ...
2026-08-27T18:11:30.249776Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 306, 'after and inspect the decoded contract event/transaction on BaseScan. The' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..920e873ac28418d57e2ae15a5b7d0228451c0a02
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,322 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| \`USDC_BASE\` | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, Circle native USDC on Base |
+| \`FEE_RECIPIENT\` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| \`OWNER\` | Intended contract admin, preferably the Safe if there is an admin role |
+| \`DEPLOYER\` | New dedicated deployer EOA, separate from treasury and users |
+| \`FAN\`, \`CREATOR\` | Separate browser wallets for acceptance tests |
+| \`TIP_CONTRACT\` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is \`1000000\`, and a 1% fee on it is
+\`10000\`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+\`84532\` and Base mainnet \`8453\`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   \`\`\`bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   \`\`\`
+
+   **GO:** \`git status --short\` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   \`\`\`bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   \`\`\`
+
+   Configure the script/constructor/initializer to use \`USDC_BASE\`,
+   \`FEE_RECIPIENT\`, and \`OWNER\`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   \`\`\`bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   \`\`\`
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory \`--network base\` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   \`USDC_BASE\` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   \`\`\`bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   \`\`\`
+
+2. Ensure \`packages/foundry/foundry.toml\` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   \`\`\`toml
+   [rpc_endpoints]
+   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
+   base = "\${BASE_RPC_URL}"
+   \`\`\`
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually \`DEPLOYER_PRIVATE_KEY\`):
+
+   \`\`\`bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   \`\`\`
+
+   Never commit that file or put a private key in shell history,
+   \`scaffold.config.ts\`, \`NEXT_PUBLIC_*\`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for \`yarn verify\`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change \`packages/nextjs/scaffold.config.ts\`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   \`\`\`ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   \`\`\`
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every \`NEXT_PUBLIC_*\` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   \`\`\`bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   \`\`\`
+
+   **GO:** outputs include \`6\` and \`USDC\`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund \`DEPLOYER\` with Base Sepolia ETH and \`FAN\` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   \`\`\`bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   \`\`\`
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   \`USDC_BASE\` for this deployment. Then:
+
+   \`\`\`bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   \`\`\`
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's \`broadcast/.../run-latest.json\`, so run it immediately
+   from this same checkout and preserve \`broadcast\`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   \`deployedContracts.ts\` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run \`yarn start\` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: \`USDC_BASE\`,
+   \`FEE_RECIPIENT\`, and \`OWNER\`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund \`FAN\` with $1–10 USDC plus Base ETH.
+
+   \`\`\`bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   \`\`\`
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   \`\`\`bash
+   yarn deploy --network base
+   yarn verify --network base
+   \`\`\`
+
+   Save the printed contract address as \`TIP_CONTRACT\`, transaction hash, and
+   \`broadcast\` output. Commit the generated
+   \`packages/nextjs/contracts/deployedContracts.ts\` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is \`TIP_CONTRACT\). Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   \`deployedContracts.ts\`; common names are shown below:
+
+   \`\`\`bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   \`\`\`
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals \`USDC_BASE\`, recipient
+   equals \`FEE_RECIPIENT\`, owner/admin equals \`OWNER\`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet \`deployedContracts.ts\` and
+write local browser-safe values:
+
+\`\`\`bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+\`\`\`
+
+At \`http://localhost:3000\`, connect \`FAN\` on Base. Confirm the UI says
+Base and links to \`TIP_CONTRACT\`, not localhost. Submit one real $1–10 USDC
+tip to \`CREATOR\`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   \`\`\`text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   \`\`\`
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set \`DEPLOYER_PRIVATE_KEY\` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   \`\`\`bash
+   yarn vercel:login
+   yarn vercel
+   \`\`\`
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   \`\`\`bash
+   yarn vercel:yolo --prod
+   \`\`\`
+
+   In an incognito browser, load the final URL, connect \`FAN\`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).
+

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..920e873ac28418d57e2ae15a5b7d0228451c0a02
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,322 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| \`USDC_BASE\` | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, Circle native USDC on Base |
+| \`FEE_RECIPIENT\` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| \`OWNER\` | Intended contract admin, preferably the Safe if there is an admin role |
+| \`DEPLOYER\` | New dedicated deployer EOA, separate from treasury and users |
+| \`FAN\`, \`CREATOR\` | Separate browser wallets for acceptance tests |
+| \`TIP_CONTRACT\` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is \`1000000\`, and a 1% fee on it is
+\`10000\`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+\`84532\` and Base mainnet \`8453\`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   \`\`\`bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   \`\`\`
+
+   **GO:** \`git status --short\` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   \`\`\`bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   \`\`\`
+
+   Configure the script/constructor/initializer to use \`USDC_BASE\`,
+   \`FEE_RECIPIENT\`, and \`OWNER\`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   \`\`\`bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   \`\`\`
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory \`--network base\` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   \`USDC_BASE\` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   \`\`\`bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   \`\`\`
+
+2. Ensure \`packages/foundry/foundry.toml\` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   \`\`\`toml
+   [rpc_endpoints]
+   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
+   base = "\${BASE_RPC_URL}"
+   \`\`\`
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually \`DEPLOYER_PRIVATE_KEY\`):
+
+   \`\`\`bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   \`\`\`
+
+   Never commit that file or put a private key in shell history,
+   \`scaffold.config.ts\`, \`NEXT_PUBLIC_*\`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for \`yarn verify\`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change \`packages/nextjs/scaffold.config.ts\`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   \`\`\`ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   \`\`\`
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every \`NEXT_PUBLIC_*\` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   \`\`\`bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   \`\`\`
+
+   **GO:** outputs include \`6\` and \`USDC\`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund \`DEPLOYER\` with Base Sepolia ETH and \`FAN\` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   \`\`\`bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   \`\`\`
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   \`USDC_BASE\` for this deployment. Then:
+
+   \`\`\`bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   \`\`\`
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's \`broadcast/.../run-latest.json\`, so run it immediately
+   from this same checkout and preserve \`broadcast\`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   \`deployedContracts.ts\` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run \`yarn start\` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: \`USDC_BASE\`,
+   \`FEE_RECIPIENT\`, and \`OWNER\`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund \`FAN\` with $1–10 USDC plus Base ETH.
+
+   \`\`\`bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   \`\`\`
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   \`\`\`bash
+   yarn deploy --network base
+   yarn verify --network base
+   \`\`\`
+
+   Save the printed contract address as \`TIP_CONTRACT\`, transaction hash, and
+   \`broadcast\` output. Commit the generated
+   \`packages/nextjs/contracts/deployedContracts.ts\` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is \`TIP_CONTRACT\). Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   \`deployedContracts.ts\`; common names are shown below:
+
+   \`\`\`bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   \`\`\`
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals \`USDC_BASE\`, recipient
+   equals \`FEE_RECIPIENT\`, owner/admin equals \`OWNER\`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet \`deployedContracts.ts\` and
+write local browser-safe values:
+
+\`\`\`bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+\`\`\`
+
+At \`http://localhost:3000\`, connect \`FAN\` on Base. Confirm the UI says
+Base and links to \`TIP_CONTRACT\`, not localhost. Submit one real $1–10 USDC
+tip to \`CREATOR\`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   \`\`\`text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   \`\`\`
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set \`DEPLOYER_PRIVATE_KEY\` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   \`\`\`bash
+   yarn vercel:login
+   yarn vercel
+   \`\`\`
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   \`\`\`bash
+   yarn vercel:yolo --prod
+   \`\`\`
+
+   In an incognito browser, load the final URL, connect \`FAN\`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).
+

exec
/bin/bash -lc "rg -n '\\\\[)]|TODO|YOUR_|"'^#|'"\\*\\*GO' LAUNCH.md && sed -n '190,280p' LAUNCH.md && git diff --check && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 13ms:
1:# Launch runbook — Base production
3:Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
11:## Values to agree before touching mainnet
31:## 0. Freeze and prove the release candidate
42:   **GO:** \`git status --short\` has no output except deliberate reviewed
74:   **GO:** all commands exit 0. The mandatory \`--network base\` flag was
80:## 1. Configure RPCs and secrets
143:   **GO:** outputs include \`6\` and \`USDC\`. Wrong chain ID, absent bytecode,
146:## 2. Base Sepolia dress rehearsal
173:   **GO:** verified source and inputs are correct on the explorer, and
185:   **GO:** both people complete the happy path and negative cases. Any failure
189:## 3. Deploy the Base mainnet contract
205:   **GO:** correct addresses are independently confirmed, balances suffice, and
219:   **GO:** verification succeeds; the explorer source is verified; and the
220:   generated file's 8453 entry is \`TIP_CONTRACT\). Verification failure is a
237:   **GO:** every immutable/configured value is correct. A bad live parameter
241:## 4. Mandatory private mainnet acceptance
248:NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
249:NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
261:**GO:** every transaction has the expected chain, contract, token, recipient,
267:## 5. Publish the frontend
274:   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
275:   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
276:   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
293:   **GO:** preview is from the tagged commit, has no localhost/31337 address,
305:   **GO:** the public URL—not preview or localhost—works correctly. Only then
308:## 6. First 24 hours and rollback

1. Put production inputs back into the script: \`USDC_BASE\`,
   \`FEE_RECIPIENT\`, and \`OWNER\`. Both people compare those values
   character-for-character. Fund the deployer with deployment ETH plus a small
   buffer, and fund \`FAN\` with $1–10 USDC plus Base ETH.

   \`\`\`bash
   source packages/foundry/.env
   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
   git diff --check
   yarn test && yarn lint && yarn next:check-types && yarn next:build
   \`\`\`

   **GO:** correct addresses are independently confirmed, balances suffice, and
   checks are clean. Otherwise do not transact.

2. Deploy exactly once and verify in the same working tree:

   \`\`\`bash
   yarn deploy --network base
   yarn verify --network base
   \`\`\`

   Save the printed contract address as \`TIP_CONTRACT\`, transaction hash, and
   \`broadcast\` output. Commit the generated
   \`packages/nextjs/contracts/deployedContracts.ts\` to the release branch.

   **GO:** verification succeeds; the explorer source is verified; and the
   generated file's 8453 entry is \`TIP_CONTRACT\). Verification failure is a
   stop, not a backlog item.

3. Make read-only onchain assertions. Get exact getter names from the ABI in
   \`deployedContracts.ts\`; common names are shown below:

   \`\`\`bash
   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
   \`\`\`

   Substitute only a differently spelled ABI getter; do not omit the
   assertion. Confirm non-empty code, USDC equals \`USDC_BASE\`, recipient
   equals \`FEE_RECIPIENT\`, owner/admin equals \`OWNER\`, and fee is 100 bps.

   **GO:** every immutable/configured value is correct. A bad live parameter
   demands an explicit abandon/communication/redeploy decision; a second
   deployment does not fix the first address.

## 4. Mandatory private mainnet acceptance

Keep the site private. Use the committed mainnet \`deployedContracts.ts\` and
write local browser-safe values:

\`\`\`bash
cat > packages/nextjs/.env.local <<'EOF'
NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
EOF
yarn start
\`\`\`

At \`http://localhost:3000\`, connect \`FAN\` on Base. Confirm the UI says
Base and links to \`TIP_CONTRACT\`, not localhost. Submit one real $1–10 USDC
tip to \`CREATOR\`; use exact approval if supported. Record approval and tip
hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
transaction, refresh/reconnect, then repeat in another browser while testing
rejection and wrong-network behavior.

**GO:** every transaction has the expected chain, contract, token, recipient,
and exact 1% split; state remains correct after refresh; both people approve
the release. If it fails, halt. A frontend clamp is not a contract fix:
preserve evidence, add regression coverage, correct source, then redeploy (or
use the already-audited upgrade path) and repoint deliberately.

## 5. Publish the frontend

1. Commit reviewed non-secret config plus the generated deployment artifact and
   push the tagged release. In Vercel, set these **Production** variables
   before building:

   \`\`\`text
   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
   \`\`\`

   Restrict keys to production origins and add production/preview domains to
   WalletConnect. Never set \`DEPLOYER_PRIVATE_KEY\` in Vercel.
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..920e873ac28418d57e2ae15a5b7d0228451c0a02
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,322 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| \`USDC_BASE\` | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, Circle native USDC on Base |
+| \`FEE_RECIPIENT\` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| \`OWNER\` | Intended contract admin, preferably the Safe if there is an admin role |
+| \`DEPLOYER\` | New dedicated deployer EOA, separate from treasury and users |
+| \`FAN\`, \`CREATOR\` | Separate browser wallets for acceptance tests |
+| \`TIP_CONTRACT\` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is \`1000000\`, and a 1% fee on it is
+\`10000\`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+\`84532\` and Base mainnet \`8453\`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   \`\`\`bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   \`\`\`
+
+   **GO:** \`git status --short\` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   \`\`\`bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   \`\`\`
+
+   Configure the script/constructor/initializer to use \`USDC_BASE\`,
+   \`FEE_RECIPIENT\`, and \`OWNER\`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   \`\`\`bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   \`\`\`
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory \`--network base\` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   \`USDC_BASE\` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   \`\`\`bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   \`\`\`
+
+2. Ensure \`packages/foundry/foundry.toml\` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   \`\`\`toml
+   [rpc_endpoints]
+   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
+   base = "\${BASE_RPC_URL}"
+   \`\`\`
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually \`DEPLOYER_PRIVATE_KEY\`):
+
+   \`\`\`bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   \`\`\`
+
+   Never commit that file or put a private key in shell history,
+   \`scaffold.config.ts\`, \`NEXT_PUBLIC_*\`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for \`yarn verify\`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change \`packages/nextjs/scaffold.config.ts\`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   \`\`\`ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   \`\`\`
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every \`NEXT_PUBLIC_*\` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   \`\`\`bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   \`\`\`
+
+   **GO:** outputs include \`6\` and \`USDC\`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund \`DEPLOYER\` with Base Sepolia ETH and \`FAN\` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   \`\`\`bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   \`\`\`
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   \`USDC_BASE\` for this deployment. Then:
+
+   \`\`\`bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   \`\`\`
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's \`broadcast/.../run-latest.json\`, so run it immediately
+   from this same checkout and preserve \`broadcast\`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   \`deployedContracts.ts\` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run \`yarn start\` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: \`USDC_BASE\`,
+   \`FEE_RECIPIENT\`, and \`OWNER\`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund \`FAN\` with $1–10 USDC plus Base ETH.
+
+   \`\`\`bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   \`\`\`
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   \`\`\`bash
+   yarn deploy --network base
+   yarn verify --network base
+   \`\`\`
+
+   Save the printed contract address as \`TIP_CONTRACT\`, transaction hash, and
+   \`broadcast\` output. Commit the generated
+   \`packages/nextjs/contracts/deployedContracts.ts\` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is \`TIP_CONTRACT\). Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   \`deployedContracts.ts\`; common names are shown below:
+
+   \`\`\`bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   \`\`\`
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals \`USDC_BASE\`, recipient
+   equals \`FEE_RECIPIENT\`, owner/admin equals \`OWNER\`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet \`deployedContracts.ts\` and
+write local browser-safe values:
+
+\`\`\`bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+\`\`\`
+
+At \`http://localhost:3000\`, connect \`FAN\` on Base. Confirm the UI says
+Base and links to \`TIP_CONTRACT\`, not localhost. Submit one real $1–10 USDC
+tip to \`CREATOR\`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   \`\`\`text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   \`\`\`
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set \`DEPLOYER_PRIVATE_KEY\` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   \`\`\`bash
+   yarn vercel:login
+   yarn vercel
+   \`\`\`
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   \`\`\`bash
+   yarn vercel:yolo --prod
+   \`\`\`
+
+   In an incognito browser, load the final URL, connect \`FAN\`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).
+

exec
/bin/bash -lc "sed -n '1,360p' LAUNCH.md" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Launch runbook — Base production

Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
mainnet contracts with a localhost frontend, then a public frontend.

Run commands from the application's checkout root, not this document's
directory. Record output, transaction hashes, contract addresses, and both
people's sign-off in one release ticket.

## Values to agree before touching mainnet

| Variable | Value |
| --- | --- |
| \`USDC_BASE\` | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, Circle native USDC on Base |
| \`FEE_RECIPIENT\` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
| \`OWNER\` | Intended contract admin, preferably the Safe if there is an admin role |
| \`DEPLOYER\` | New dedicated deployer EOA, separate from treasury and users |
| \`FAN\`, \`CREATOR\` | Separate browser wallets for acceptance tests |
| \`TIP_CONTRACT\` | Mainnet address printed by deployment; do not guess it beforehand |

USDC uses 6 decimals: $1.00 is \`1000000\`, and a 1% fee on it is
\`10000\`. The contract must use an exact integer 1% formula (normally 100
basis points); it must never use a frontend-only fee rule or 18-decimal ETH
helpers.

Use a production RPC provider for deployment and the public app. Base's
public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
\`84532\` and Base mainnet \`8453\`.

## 0. Freeze and prove the release candidate

1. Create the release branch/tag and require a clean tree.

   \`\`\`bash
   git switch -c release/base-v1
   git status --short
   git log -1 --oneline
   git tag -a base-v1-rc1 -m "Base v1 release candidate"
   \`\`\`

   **GO:** \`git status --short\` has no output except deliberate reviewed
   changes. A late contract change means add a regression test, make a new
   tag, and restart this stage.

2. Inspect the actual contract and deployment inputs; do not assume names.

   \`\`\`bash
   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
   \`\`\`

   Configure the script/constructor/initializer to use \`USDC_BASE\`,
   \`FEE_RECIPIENT\`, and \`OWNER\`. If any are hard-coded, change source or
   script now, add a test for the value, and review the diff. A frontend
   setting cannot secure a contract.

3. Re-run all release checks and a clean fork rehearsal.

   \`\`\`bash
   yarn install --immutable
   yarn compile
   yarn test
   yarn lint
   yarn next:check-types
   yarn next:build
   yarn fork --network base
   \`\`\`

   In another terminal, use the local frontend to repeat the whole journey:
   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
   fee-recipient deltas. Stop the fork afterwards.

   **GO:** all commands exit 0. The mandatory \`--network base\` flag was
   used; a fork reports chain ID 31337, so confirm it has code at
   \`USDC_BASE\` rather than treating 31337 as proof of Base. Tests must cover
   1% routing, six-decimal amounts, invalid tips, and the existing rounding
   rule.

## 1. Configure RPCs and secrets

1. Inspect instead of replacing project config.

   \`\`\`bash
   sed -n '1,240p' packages/foundry/foundry.toml
   sed -n '1,200p' packages/nextjs/scaffold.config.ts
   sed -n '1,160p' packages/foundry/.env.example
   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
   \`\`\`

2. Ensure \`packages/foundry/foundry.toml\` has endpoints matching the
   wrapper's network names (retain the project names if they differ):

   \`\`\`toml
   [rpc_endpoints]
   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
   base = "\${BASE_RPC_URL}"
   \`\`\`

   Copy the existing template, then edit only the ignored copy with a reliable
   RPC URL and deployer credential in the exact variable name used by the
   script (usually \`DEPLOYER_PRIVATE_KEY\`):

   \`\`\`bash
   cp packages/foundry/.env.example packages/foundry/.env
   \`\`\`

   Never commit that file or put a private key in shell history,
   \`scaffold.config.ts\`, \`NEXT_PUBLIC_*\`, Vercel, or a screenshot. Prefer a
   Foundry keystore if the existing script supports it. The template already
   supplies the key needed for \`yarn verify\`; acquiring an explorer key is
   not a launch dependency.

3. Change \`packages/nextjs/scaffold.config.ts\`. Preserve imports/types; make
   its effective production configuration equivalent to:

   \`\`\`ts
   targetNetworks: [chains.base],
   pollingInterval: 1_000,
   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
     : {},
   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
   burnerWalletMode: "disabled",
   \`\`\`

   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
   to the production domain. Every \`NEXT_PUBLIC_*\` value is visible to
   visitors; it cannot contain a secret.

4. Prove the endpoints and token before deploying:

   \`\`\`bash
   source packages/foundry/.env
   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
   \`\`\`

   **GO:** outputs include \`6\` and \`USDC\`. Wrong chain ID, absent bytecode,
   wrong decimals, leaked secret, or unreviewed config is a hard stop.

## 2. Base Sepolia dress rehearsal

This is a real public testnet deploy: it catches RPC, deployer, verification,
wallet, and generated-artifact failures that a fork cannot.

1. Fund \`DEPLOYER\` with Base Sepolia ETH and \`FAN\` with test USDC/ETH.
   Confirm balances without revealing keys:

   \`\`\`bash
   yarn account
   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
   \`\`\`

2. Set the script's token input to the issuer's current official Base Sepolia
   test-USDC address and use test recipient/owner addresses. Do not use
   \`USDC_BASE\` for this deployment. Then:

   \`\`\`bash
   yarn deploy --network base_sepolia
   yarn verify --network base_sepolia
   git diff -- packages/nextjs/contracts/deployedContracts.ts
   \`\`\`

   Record deploy hashes, contract addresses, and verification URLs. Verification
   replays Foundry's \`broadcast/.../run-latest.json\`, so run it immediately
   from this same checkout and preserve \`broadcast\`.

   **GO:** verified source and inputs are correct on the explorer, and
   \`deployedContracts.ts\` has chain ID 84532 and the new address—not a
   localhost address.

3. Run \`yarn start\` and use normal wallets on Base Sepolia to connect,
   switch networks, approve, and send an exact 1.00 test-USDC tip. After
   confirmation and refresh, use explorer and balance reads to prove fan
   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
   (or the documented tested rounding result). Deliberately test wrong
   network, insufficient allowance, invalid/zero tip, and rejected wallet
   signature. Each must transfer nothing and produce a usable error.

   **GO:** both people complete the happy path and negative cases. Any failure
   requires source/UI correction, a regression test, a fresh tag, and restart
   at stage 0.

## 3. Deploy the Base mainnet contract

1. Put production inputs back into the script: \`USDC_BASE\`,
   \`FEE_RECIPIENT\`, and \`OWNER\`. Both people compare those values
   character-for-character. Fund the deployer with deployment ETH plus a small
   buffer, and fund \`FAN\` with $1–10 USDC plus Base ETH.

   \`\`\`bash
   source packages/foundry/.env
   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
   git diff --check
   yarn test && yarn lint && yarn next:check-types && yarn next:build
   \`\`\`

   **GO:** correct addresses are independently confirmed, balances suffice, and
   checks are clean. Otherwise do not transact.

2. Deploy exactly once and verify in the same working tree:

   \`\`\`bash
   yarn deploy --network base
   yarn verify --network base
   \`\`\`

   Save the printed contract address as \`TIP_CONTRACT\`, transaction hash, and
   \`broadcast\` output. Commit the generated
   \`packages/nextjs/contracts/deployedContracts.ts\` to the release branch.

   **GO:** verification succeeds; the explorer source is verified; and the
   generated file's 8453 entry is \`TIP_CONTRACT\). Verification failure is a
   stop, not a backlog item.

3. Make read-only onchain assertions. Get exact getter names from the ABI in
   \`deployedContracts.ts\`; common names are shown below:

   \`\`\`bash
   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
   \`\`\`

   Substitute only a differently spelled ABI getter; do not omit the
   assertion. Confirm non-empty code, USDC equals \`USDC_BASE\`, recipient
   equals \`FEE_RECIPIENT\`, owner/admin equals \`OWNER\`, and fee is 100 bps.

   **GO:** every immutable/configured value is correct. A bad live parameter
   demands an explicit abandon/communication/redeploy decision; a second
   deployment does not fix the first address.

## 4. Mandatory private mainnet acceptance

Keep the site private. Use the committed mainnet \`deployedContracts.ts\` and
write local browser-safe values:

\`\`\`bash
cat > packages/nextjs/.env.local <<'EOF'
NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
EOF
yarn start
\`\`\`

At \`http://localhost:3000\`, connect \`FAN\` on Base. Confirm the UI says
Base and links to \`TIP_CONTRACT\`, not localhost. Submit one real $1–10 USDC
tip to \`CREATOR\`; use exact approval if supported. Record approval and tip
hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
transaction, refresh/reconnect, then repeat in another browser while testing
rejection and wrong-network behavior.

**GO:** every transaction has the expected chain, contract, token, recipient,
and exact 1% split; state remains correct after refresh; both people approve
the release. If it fails, halt. A frontend clamp is not a contract fix:
preserve evidence, add regression coverage, correct source, then redeploy (or
use the already-audited upgrade path) and repoint deliberately.

## 5. Publish the frontend

1. Commit reviewed non-secret config plus the generated deployment artifact and
   push the tagged release. In Vercel, set these **Production** variables
   before building:

   \`\`\`text
   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
   \`\`\`

   Restrict keys to production origins and add production/preview domains to
   WalletConnect. Never set \`DEPLOYER_PRIVATE_KEY\` in Vercel.

2. Build a preview and test the built artifact:

   \`\`\`bash
   yarn vercel:login
   yarn vercel
   \`\`\`

   In the preview, inspect console/Network for RPC failures; connect on Base;
   check the contract address, USDC 6-decimal display, wrong-network state,
   and rejected-signature state.

   **GO:** preview is from the tagged commit, has no localhost/31337 address,
   uses Base successfully, and exposes no private key.

3. Deploy production and add the custom domain only after TLS is active:

   \`\`\`bash
   yarn vercel:yolo --prod
   \`\`\`

   In an incognito browser, load the final URL, connect \`FAN\`, and send one
   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.

   **GO:** the public URL—not preview or localhost—works correctly. Only then
   announce it.

## 6. First 24 hours and rollback

For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
first unrelated user tip for chain, token, contract, fee, and creator amount.
Set low-balance alerts on deployer and fee recipient.

The frontend can be rolled back by promoting the prior Vercel deployment or
removing domain routing. A contract cannot. For a contract defect: stop
promotion/marketing, preserve hashes and addresses, reproduce locally, add
the failing test, fix, redeploy or use the audited upgrade path, verify,
repoint, and communicate a plan for funds/users at the old address. Never
silently replace a public contract address.

References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).


apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..edf0e5e0f7f02a233f2e608c04137d4a9d3297b5
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,321 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
+   base = "\${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`.. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..edf0e5e0f7f02a233f2e608c04137d4a9d3297b5
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,321 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
+   base = "\${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`.. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

exec
/bin/bash -lc "sed -n '1,335p' LAUNCH.md && git diff --check && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Launch runbook — Base production

Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
mainnet contracts with a localhost frontend, then a public frontend.

Run commands from the application's checkout root, not this document's
directory. Record output, transaction hashes, contract addresses, and both
people's sign-off in one release ticket.

## Values to agree before touching mainnet

| Variable | Value |
| --- | --- |
| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |

USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
`10000`. The contract must use an exact integer 1% formula (normally 100
basis points); it must never use a frontend-only fee rule or 18-decimal ETH
helpers.

Use a production RPC provider for deployment and the public app. Base's
public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
`84532` and Base mainnet `8453`.

## 0. Freeze and prove the release candidate

1. Create the release branch/tag and require a clean tree.

   ```bash
   git switch -c release/base-v1
   git status --short
   git log -1 --oneline
   git tag -a base-v1-rc1 -m "Base v1 release candidate"
   ```

   **GO:** `git status --short` has no output except deliberate reviewed
   changes. A late contract change means add a regression test, make a new
   tag, and restart this stage.

2. Inspect the actual contract and deployment inputs; do not assume names.

   ```bash
   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
   ```

   Configure the script/constructor/initializer to use `USDC_BASE`,
   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
   script now, add a test for the value, and review the diff. A frontend
   setting cannot secure a contract.

3. Re-run all release checks and a clean fork rehearsal.

   ```bash
   yarn install --immutable
   yarn compile
   yarn test
   yarn lint
   yarn next:check-types
   yarn next:build
   yarn fork --network base
   ```

   In another terminal, use the local frontend to repeat the whole journey:
   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
   fee-recipient deltas. Stop the fork afterwards.

   **GO:** all commands exit 0. The mandatory `--network base` flag was
   used; a fork reports chain ID 31337, so confirm it has code at
   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
   1% routing, six-decimal amounts, invalid tips, and the existing rounding
   rule.

## 1. Configure RPCs and secrets

1. Inspect instead of replacing project config.

   ```bash
   sed -n '1,240p' packages/foundry/foundry.toml
   sed -n '1,200p' packages/nextjs/scaffold.config.ts
   sed -n '1,160p' packages/foundry/.env.example
   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
   ```

2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
   wrapper's network names (retain the project names if they differ):

   ```toml
   [rpc_endpoints]
   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
   base = "\${BASE_RPC_URL}"
   ```

   Copy the existing template, then edit only the ignored copy with a reliable
   RPC URL and deployer credential in the exact variable name used by the
   script (usually `DEPLOYER_PRIVATE_KEY`):

   ```bash
   cp packages/foundry/.env.example packages/foundry/.env
   ```

   Never commit that file or put a private key in shell history,
   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
   Foundry keystore if the existing script supports it. The template already
   supplies the key needed for `yarn verify`; acquiring an explorer key is
   not a launch dependency.

3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
   its effective production configuration equivalent to:

   ```ts
   targetNetworks: [chains.base],
   pollingInterval: 1_000,
   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
     : {},
   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
   burnerWalletMode: "disabled",
   ```

   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
   visitors; it cannot contain a secret.

4. Prove the endpoints and token before deploying:

   ```bash
   source packages/foundry/.env
   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
   ```

   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
   wrong decimals, leaked secret, or unreviewed config is a hard stop.

## 2. Base Sepolia dress rehearsal

This is a real public testnet deploy: it catches RPC, deployer, verification,
wallet, and generated-artifact failures that a fork cannot.

1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
   Confirm balances without revealing keys:

   ```bash
   yarn account
   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
   ```

2. Set the script's token input to the issuer's current official Base Sepolia
   test-USDC address and use test recipient/owner addresses. Do not use
   `USDC_BASE` for this deployment. Then:

   ```bash
   yarn deploy --network base_sepolia
   yarn verify --network base_sepolia
   git diff -- packages/nextjs/contracts/deployedContracts.ts
   ```

   Record deploy hashes, contract addresses, and verification URLs. Verification
   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
   from this same checkout and preserve `broadcast`.

   **GO:** verified source and inputs are correct on the explorer, and
   `deployedContracts.ts` has chain ID 84532 and the new address—not a
   localhost address.

3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
   switch networks, approve, and send an exact 1.00 test-USDC tip. After
   confirmation and refresh, use explorer and balance reads to prove fan
   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
   (or the documented tested rounding result). Deliberately test wrong
   network, insufficient allowance, invalid/zero tip, and rejected wallet
   signature. Each must transfer nothing and produce a usable error.

   **GO:** both people complete the happy path and negative cases. Any failure
   requires source/UI correction, a regression test, a fresh tag, and restart
   at stage 0.

## 3. Deploy the Base mainnet contract

1. Put production inputs back into the script: `USDC_BASE`,
   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
   character-for-character. Fund the deployer with deployment ETH plus a small
   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.

   ```bash
   source packages/foundry/.env
   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
   git diff --check
   yarn test && yarn lint && yarn next:check-types && yarn next:build
   ```

   **GO:** correct addresses are independently confirmed, balances suffice, and
   checks are clean. Otherwise do not transact.

2. Deploy exactly once and verify in the same working tree:

   ```bash
   yarn deploy --network base
   yarn verify --network base
   ```

   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
   `broadcast` output. Commit the generated
   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.

   **GO:** verification succeeds; the explorer source is verified; and the
   generated file's 8453 entry is `TIP_CONTRACT`.. Verification failure is a
   stop, not a backlog item.

3. Make read-only onchain assertions. Get exact getter names from the ABI in
   `deployedContracts.ts`; common names are shown below:

   ```bash
   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
   ```

   Substitute only a differently spelled ABI getter; do not omit the
   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.

   **GO:** every immutable/configured value is correct. A bad live parameter
   demands an explicit abandon/communication/redeploy decision; a second
   deployment does not fix the first address.

## 4. Mandatory private mainnet acceptance

Keep the site private. Use the committed mainnet `deployedContracts.ts` and
write local browser-safe values:

```bash
cat > packages/nextjs/.env.local <<'EOF'
NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
EOF
yarn start
```

At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
tip to `CREATOR`; use exact approval if supported. Record approval and tip
hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
transaction, refresh/reconnect, then repeat in another browser while testing
rejection and wrong-network behavior.

**GO:** every transaction has the expected chain, contract, token, recipient,
and exact 1% split; state remains correct after refresh; both people approve
the release. If it fails, halt. A frontend clamp is not a contract fix:
preserve evidence, add regression coverage, correct source, then redeploy (or
use the already-audited upgrade path) and repoint deliberately.

## 5. Publish the frontend

1. Commit reviewed non-secret config plus the generated deployment artifact and
   push the tagged release. In Vercel, set these **Production** variables
   before building:

   ```text
   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
   ```

   Restrict keys to production origins and add production/preview domains to
   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.

2. Build a preview and test the built artifact:

   ```bash
   yarn vercel:login
   yarn vercel
   ```

   In the preview, inspect console/Network for RPC failures; connect on Base;
   check the contract address, USDC 6-decimal display, wrong-network state,
   and rejected-signature state.

   **GO:** preview is from the tagged commit, has no localhost/31337 address,
   uses Base successfully, and exposes no private key.

3. Deploy production and add the custom domain only after TLS is active:

   ```bash
   yarn vercel:yolo --prod
   ```

   In an incognito browser, load the final URL, connect `FAN`, and send one
   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.

   **GO:** the public URL—not preview or localhost—works correctly. Only then
   announce it.

## 6. First 24 hours and rollback

For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
first unrelated user tip for chain, token, contract, fee, and creator amount.
Set low-balance alerts on deployer and fee recipient.

The frontend can be rolled back by promoting the prior Vercel deployment or
removing domain routing. A contract cannot. For a contract defect: stop
promotion/marketing, preserve hashes and addresses, reproduce locally, add
the failing test, fix, redeploy or use the audited upgrade path, verify,
repoint, and communicate a plan for funds/users at the old address. Never
silently replace a public contract address.

References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..edf0e5e0f7f02a233f2e608c04137d4a9d3297b5
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,321 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "\${BASE_SEPOLIA_RPC_URL}"
+   base = "\${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`.. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f3f2d42ad1c54960108de32db82e230e98bff34a
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,321 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+   base = "${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f3f2d42ad1c54960108de32db82e230e98bff34a
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,321 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+   base = "${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..ea4430802f8b307d5bfcaf654ca785e555258889
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,336 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+At the start of each terminal session that uses the commands below, set the
+non-secret shell values from the signed-off table (replace only the angle
+brackets):
+
+```bash
+export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export DEPLOYER=<dedicated_deployer_address>
+export FAN=<acceptance_fan_address>
+export CREATOR=<acceptance_creator_address>
+export FEE_RECIPIENT=<safe_fee_recipient_address>
+export OWNER=<safe_owner_address>
+```
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+   base = "${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..ea4430802f8b307d5bfcaf654ca785e555258889
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,336 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+At the start of each terminal session that uses the commands below, set the
+non-secret shell values from the signed-off table (replace only the angle
+brackets):
+
+```bash
+export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export DEPLOYER=<dedicated_deployer_address>
+export FAN=<acceptance_fan_address>
+export CREATOR=<acceptance_creator_address>
+export FEE_RECIPIENT=<safe_fee_recipient_address>
+export OWNER=<safe_owner_address>
+```
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+   base = "${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

codex
The runbook is written and validated for formatting/whitespace. It contains explicit stop gates for release freeze, testnet, verified mainnet deployment, private real-money acceptance, preview, and public production acceptance.
codex
Created the complete launch runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md).

It covers Base Sepolia rehearsal, mainnet deployment and verification, private real-money UI acceptance, Vercel publication, go/no-go gates, and first-day rollback handling.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..ea4430802f8b307d5bfcaf654ca785e555258889
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,336 @@
+# Launch runbook — Base production
+
+Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
+The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
+mainnet contracts with a localhost frontend, then a public frontend.
+
+Run commands from the application's checkout root, not this document's
+directory. Record output, transaction hashes, contract addresses, and both
+people's sign-off in one release ticket.
+
+## Values to agree before touching mainnet
+
+| Variable | Value |
+| --- | --- |
+| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
+| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
+| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
+| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
+| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
+| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |
+
+USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
+`10000`. The contract must use an exact integer 1% formula (normally 100
+basis points); it must never use a frontend-only fee rule or 18-decimal ETH
+helpers.
+
+At the start of each terminal session that uses the commands below, set the
+non-secret shell values from the signed-off table (replace only the angle
+brackets):
+
+```bash
+export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export DEPLOYER=<dedicated_deployer_address>
+export FAN=<acceptance_fan_address>
+export CREATOR=<acceptance_creator_address>
+export FEE_RECIPIENT=<safe_fee_recipient_address>
+export OWNER=<safe_owner_address>
+```
+
+Use a production RPC provider for deployment and the public app. Base's
+public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
+`84532` and Base mainnet `8453`.
+
+## 0. Freeze and prove the release candidate
+
+1. Create the release branch/tag and require a clean tree.
+
+   ```bash
+   git switch -c release/base-v1
+   git status --short
+   git log -1 --oneline
+   git tag -a base-v1-rc1 -m "Base v1 release candidate"
+   ```
+
+   **GO:** `git status --short` has no output except deliberate reviewed
+   changes. A late contract change means add a regression test, make a new
+   tag, and restart this stage.
+
+2. Inspect the actual contract and deployment inputs; do not assume names.
+
+   ```bash
+   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
+   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
+   ```
+
+   Configure the script/constructor/initializer to use `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
+   script now, add a test for the value, and review the diff. A frontend
+   setting cannot secure a contract.
+
+3. Re-run all release checks and a clean fork rehearsal.
+
+   ```bash
+   yarn install --immutable
+   yarn compile
+   yarn test
+   yarn lint
+   yarn next:check-types
+   yarn next:build
+   yarn fork --network base
+   ```
+
+   In another terminal, use the local frontend to repeat the whole journey:
+   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
+   fee-recipient deltas. Stop the fork afterwards.
+
+   **GO:** all commands exit 0. The mandatory `--network base` flag was
+   used; a fork reports chain ID 31337, so confirm it has code at
+   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
+   1% routing, six-decimal amounts, invalid tips, and the existing rounding
+   rule.
+
+## 1. Configure RPCs and secrets
+
+1. Inspect instead of replacing project config.
+
+   ```bash
+   sed -n '1,240p' packages/foundry/foundry.toml
+   sed -n '1,200p' packages/nextjs/scaffold.config.ts
+   sed -n '1,160p' packages/foundry/.env.example
+   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
+   ```
+
+2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
+   wrapper's network names (retain the project names if they differ):
+
+   ```toml
+   [rpc_endpoints]
+   base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+   base = "${BASE_RPC_URL}"
+   ```
+
+   Copy the existing template, then edit only the ignored copy with a reliable
+   RPC URL and deployer credential in the exact variable name used by the
+   script (usually `DEPLOYER_PRIVATE_KEY`):
+
+   ```bash
+   cp packages/foundry/.env.example packages/foundry/.env
+   ```
+
+   Never commit that file or put a private key in shell history,
+   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
+   Foundry keystore if the existing script supports it. The template already
+   supplies the key needed for `yarn verify`; acquiring an explorer key is
+   not a launch dependency.
+
+3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
+   its effective production configuration equivalent to:
+
+   ```ts
+   targetNetworks: [chains.base],
+   pollingInterval: 1_000,
+   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
+   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
+     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
+     : {},
+   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
+   burnerWalletMode: "disabled",
+   ```
+
+   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
+   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
+   visitors; it cannot contain a secret.
+
+4. Prove the endpoints and token before deploying:
+
+   ```bash
+   source packages/foundry/.env
+   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
+   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
+   wrong decimals, leaked secret, or unreviewed config is a hard stop.
+
+## 2. Base Sepolia dress rehearsal
+
+This is a real public testnet deploy: it catches RPC, deployer, verification,
+wallet, and generated-artifact failures that a fork cannot.
+
+1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
+   Confirm balances without revealing keys:
+
+   ```bash
+   yarn account
+   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+   ```
+
+2. Set the script's token input to the issuer's current official Base Sepolia
+   test-USDC address and use test recipient/owner addresses. Do not use
+   `USDC_BASE` for this deployment. Then:
+
+   ```bash
+   yarn deploy --network base_sepolia
+   yarn verify --network base_sepolia
+   git diff -- packages/nextjs/contracts/deployedContracts.ts
+   ```
+
+   Record deploy hashes, contract addresses, and verification URLs. Verification
+   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
+   from this same checkout and preserve `broadcast`.
+
+   **GO:** verified source and inputs are correct on the explorer, and
+   `deployedContracts.ts` has chain ID 84532 and the new address—not a
+   localhost address.
+
+3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
+   switch networks, approve, and send an exact 1.00 test-USDC tip. After
+   confirmation and refresh, use explorer and balance reads to prove fan
+   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
+   (or the documented tested rounding result). Deliberately test wrong
+   network, insufficient allowance, invalid/zero tip, and rejected wallet
+   signature. Each must transfer nothing and produce a usable error.
+
+   **GO:** both people complete the happy path and negative cases. Any failure
+   requires source/UI correction, a regression test, a fresh tag, and restart
+   at stage 0.
+
+## 3. Deploy the Base mainnet contract
+
+1. Put production inputs back into the script: `USDC_BASE`,
+   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
+   character-for-character. Fund the deployer with deployment ETH plus a small
+   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.
+
+   ```bash
+   source packages/foundry/.env
+   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
+   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
+   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
+   git diff --check
+   yarn test && yarn lint && yarn next:check-types && yarn next:build
+   ```
+
+   **GO:** correct addresses are independently confirmed, balances suffice, and
+   checks are clean. Otherwise do not transact.
+
+2. Deploy exactly once and verify in the same working tree:
+
+   ```bash
+   yarn deploy --network base
+   yarn verify --network base
+   ```
+
+   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
+   `broadcast` output. Commit the generated
+   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.
+
+   **GO:** verification succeeds; the explorer source is verified; and the
+   generated file's 8453 entry is `TIP_CONTRACT`. Verification failure is a
+   stop, not a backlog item.
+
+3. Make read-only onchain assertions. Get exact getter names from the ABI in
+   `deployedContracts.ts`; common names are shown below:
+
+   ```bash
+   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+   ```
+
+   Substitute only a differently spelled ABI getter; do not omit the
+   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
+   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.
+
+   **GO:** every immutable/configured value is correct. A bad live parameter
+   demands an explicit abandon/communication/redeploy decision; a second
+   deployment does not fix the first address.
+
+## 4. Mandatory private mainnet acceptance
+
+Keep the site private. Use the committed mainnet `deployedContracts.ts` and
+write local browser-safe values:
+
+```bash
+cat > packages/nextjs/.env.local <<'EOF'
+NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
+EOF
+yarn start
+```
+
+At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
+Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
+tip to `CREATOR`; use exact approval if supported. Record approval and tip
+hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
+transaction, refresh/reconnect, then repeat in another browser while testing
+rejection and wrong-network behavior.
+
+**GO:** every transaction has the expected chain, contract, token, recipient,
+and exact 1% split; state remains correct after refresh; both people approve
+the release. If it fails, halt. A frontend clamp is not a contract fix:
+preserve evidence, add regression coverage, correct source, then redeploy (or
+use the already-audited upgrade path) and repoint deliberately.
+
+## 5. Publish the frontend
+
+1. Commit reviewed non-secret config plus the generated deployment artifact and
+   push the tagged release. In Vercel, set these **Production** variables
+   before building:
+
+   ```text
+   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
+   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
+   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
+   ```
+
+   Restrict keys to production origins and add production/preview domains to
+   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.
+
+2. Build a preview and test the built artifact:
+
+   ```bash
+   yarn vercel:login
+   yarn vercel
+   ```
+
+   In the preview, inspect console/Network for RPC failures; connect on Base;
+   check the contract address, USDC 6-decimal display, wrong-network state,
+   and rejected-signature state.
+
+   **GO:** preview is from the tagged commit, has no localhost/31337 address,
+   uses Base successfully, and exposes no private key.
+
+3. Deploy production and add the custom domain only after TLS is active:
+
+   ```bash
+   yarn vercel:yolo --prod
+   ```
+
+   In an incognito browser, load the final URL, connect `FAN`, and send one
+   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.
+
+   **GO:** the public URL—not preview or localhost—works correctly. Only then
+   announce it.
+
+## 6. First 24 hours and rollback
+
+For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
+first unrelated user tip for chain, token, contract, fee, and creator amount.
+Set low-balance alerts on deployer and fee recipient.
+
+The frontend can be rolled back by promoting the prior Vercel deployment or
+removing domain routing. A contract cannot. For a contract defect: stop
+promotion/marketing, preserve hashes and addresses, reproduce locally, add
+the failing test, fix, redeploy or use the audited upgrade path, verify,
+repoint, and communicate a plan for funds/users at the old address. Never
+silently replace a public contract address.
+
+References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

tokens used
71,323
````

## final message

Created the complete launch runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md).

It covers Base Sepolia rehearsal, mainnet deployment and verification, private real-money UI acceptance, Vercel publication, go/no-go gates, and first-day rollback handling.
