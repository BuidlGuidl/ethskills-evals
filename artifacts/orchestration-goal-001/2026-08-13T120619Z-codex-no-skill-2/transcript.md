# Executor transcript — 2026-08-13T120619Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120619Z-codex-no-skill-2

## session

````text
OpenAI Codex v0.146.0
--------
workdir: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120619Z-codex-no-skill-2
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: medium
reasoning summaries: none
session id: 019ffb13-2e27-7e01-8b3b-85ebbc9808f3
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
I’ll write this as an execution runbook with explicit stop/go gates, using Base’s current official network details and production deployment guidance so the commands are safe to follow in order.
web search: 
web search: site:docs.base.org Base mainnet chain id RPC deploy contract verification Basescan 2026 ...
web search: 
web search: site:docs.base.org Base mainnet chain id RPC deploy contract verification Basescan ...
web search: 
web search: site:developers.circle.com USDC Base mainnet contract address Base Sepolia USDC address ...
apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120619Z-codex-no-skill-2/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..15acc96c9f957cfe8ec841fece7ea4ac4513b06c
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,299 @@
+# Production launch runbook — Base USDC tipping
+
+This is a **gated** release procedure. Complete a numbered section in order and do not continue if its `GO` condition is not met. All commands below are run from the root of the real Scaffold-ETH 2 repository, not from the directory containing this document. Replace values in `ALL_CAPS` exactly once, record them in the release log, and never put a private key in a shell history, `.env*` file tracked by Git, CI log, screenshot, or chat.
+
+The contract is an irreversible financial system. “The local journey works” is not a sufficient production gate: a bad constructor argument, token address, fee recipient, allowance flow, or frontend address can still permanently misdirect real USDC.
+
+## 0. Make the release decision and assign responsibilities
+
+Before touching Base, write and both sign off on this release record (a private issue or password-manager secure note):
+
+| Field | Record |
+| --- | --- |
+| Git commit to ship | `GIT_SHA` |
+| Contract source and fully-qualified deployment target | `CONTRACT_PATH:CONTRACT_NAME` / `SCRIPT_PATH:SCRIPT_NAME` |
+| Contract constructor/init arguments in their on-chain units | `CONSTRUCTOR_ARGS` |
+| Mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Fee rate | `100` basis points (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` (a 2-of-2 Safe, not either developer’s EOA) |
+| Deployer address | `DEPLOYER_ADDRESS` (a dedicated, single-purpose EOA) |
+| Owner/admin address(es) | `ADMIN_ADDRESS` / Safe address |
+| Public hostname | `APP_DOMAIN` |
+| RPC provider endpoint and dashboard owner | `BASE_MAINNET_RPC_URL` |
+
+Create the Safe first, verify its threshold is 2-of-2 and that both people can see it, then use its address for every privileged owner/fee-recipient value. If the contract has no admin or cannot send/withdraw the fee to the Safe, stop and change/audit the contract before launch. Do not use a personal wallet as a temporary substitute.
+
+**GO:** Both people independently compare the recorded USDC and Safe addresses character-for-character. Circle’s official Base USDC address is the value above; it has 6 decimals. Base Mainnet is chain ID `8453`. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Base](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+## 1. Freeze and independently review the release candidate
+
+```sh
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+git rev-parse HEAD
+git submodule status
+forge --version
+node --version
+pnpm --version # use npm/yarn here instead only if that is the committed lockfile
+```
+
+`git status --short` must be empty before making the intentional configuration changes below. Pin the current Foundry and Node versions in the release record. Install dependencies strictly from the committed lockfile:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+cd ../..
+```
+
+If this repository uses different package names/scripts, list them first rather than guessing:
+
+```sh
+find . -maxdepth 3 -name package.json -o -name foundry.toml
+pnpm --dir packages/nextjs run
+```
+
+Run static analysis and dependency checks, saving results with the release record:
+
+```sh
+cd packages/foundry
+slither . --exclude-dependencies
+forge fmt --check
+cd ../nextjs
+pnpm audit --prod
+cd ../..
+```
+
+Have the other teammate review the Solidity diff line-by-line, specifically: constructor arguments, immutable addresses, access control, reentrancy/external token calls, `transferFrom` return handling, USDC’s 6-decimal arithmetic, rounding (who receives the dust), zero/self/invalid creator addresses, duplicate/failed transfers, pause/escape-hatch behavior, and every method that can move accumulated fees. Get an independent smart-contract security review before mainnet if any funds can be held or any privileged parameter can change; no automated check replaces this.
+
+Add or confirm tests that assert these invariants, using `1_000_000` as one USDC:
+
+1. `tip(1_000_000)` credits creator `990_000`, fee recipient `10_000`, and never creates or loses USDC.
+2. Amounts below one cent and awkward amounts have a documented, tested rounding rule; the sum of transfers is exactly the input.
+3. A fan cannot tip without enough balance/allowance; a failed call leaves all balances/accounting unchanged.
+4. Only the intended role can change fee/recipient/pause or withdraw; a zero/wrong-token/wrong-recipient configuration reverts.
+5. A malicious ERC-20/reentrant recipient cannot double-spend or alter accounting, if the contract accepts arbitrary tokens/callbacks.
+
+**STOP:** Do not proceed on a compiler warning, skipped/failing test, unreviewed privilege, or a result that requires explaining away. **GO:** clean build/tests/lint/typecheck, reproducible production build, recorded review approval, and no unresolved high/critical finding.
+
+## 2. Make production configuration explicit (never infer localhost)
+
+Use a paid/dedicated Base RPC provider for the application; Base’s public RPC is rate-limited and explicitly not for production. Keep provider API secrets server-side where possible; a browser-visible `NEXT_PUBLIC_*` RPC URL must be a restricted public client endpoint, never an admin key. [Base RPC guidance](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+In `packages/foundry/foundry.toml` (or the repository’s actual Foundry config), add only these named endpoints and verification configuration; do not replace the local endpoint:
+
+```toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+```
+
+Create `packages/foundry/.env.example` and `packages/nextjs/.env.example` with variable *names only*; add the real `.env` files to `.gitignore` and verify they are ignored:
+
+```sh
+git check-ignore -v packages/foundry/.env packages/nextjs/.env
+git grep -nE '(PRIVATE_KEY|mnemonic|0x[0-9a-fA-F]{64})' -- ':!**/.env.example'
+```
+
+Use these values in the deployment operator’s untracked environment, preferably injected by a password manager/CI secret store rather than typed into a file:
+
+```dotenv
+# packages/foundry/.env (untracked)
+BASE_SEPOLIA_RPC_URL=https://YOUR_DEDICATED_BASE_SEPOLIA_RPC
+BASE_MAINNET_RPC_URL=https://YOUR_DEDICATED_BASE_MAINNET_RPC
+BASESCAN_API_KEY=YOUR_KEY
+DEPLOYER_ADDRESS=0xYOUR_DEDICATED_DEPLOYER
+
+# packages/nextjs/.env.production (untracked locally; configure equivalent host env vars)
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=0xSET_ONLY_AFTER_MAINNET_DEPLOYMENT
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_APP_URL=https://APP_DOMAIN
+NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_RESTRICTED_BROWSER_RPC
+```
+
+Import the dedicated deployer key into Foundry’s encrypted keystore interactively; it is stored outside Git:
+
+```sh
+cast wallet import base-mainnet-deployer --interactive
+cast wallet address --account base-mainnet-deployer
+```
+
+Compare the output with `DEPLOYER_ADDRESS`. Fund only that address with a small, pre-agreed amount of ETH **on Base Mainnet** for deployment; do not send any USDC to it. Confirm the chain and balance from the RPC:
+
+```sh
+set -a; source packages/foundry/.env; set +a
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+```
+
+The first output must be `8453`. **GO:** no secret is tracked, the frontend explicitly permits only `base`/8453 (not localhost/default chains), the configured USDC is Circle’s address, and the deployer is funded on Base—not Ethereum.
+
+## 3. Deploy and exercise the exact release on Base Sepolia
+
+Set the testnet token address in the deployment script/config to Circle’s Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is deliberately different from mainnet. Do not use a mock token on this gate. Fund two fresh test wallets with Base Sepolia ETH and test USDC from official faucets.
+
+Make the deploy command match the project’s existing script target. First inspect it and run a dry simulation; do not substitute a guessed script name:
+
+```sh
+cd packages/foundry
+find script -name '*.s.sol' -maxdepth 3 -print
+sed -n '1,240p' script/YOUR_DEPLOY_SCRIPT.s.sol
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer -vvvv
+```
+
+The simulation output must show the Sepolia USDC, intended Safe/test Safe, fee `100`, expected bytecode, and no unexpected transaction. Then broadcast and verify:
+
+```sh
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer \
+  --broadcast --verify -vvvv
+```
+
+Record the Sepolia address and transaction hash. Read every immutable/config getter using the actual ABI signatures from the contract (replace only the names below):
+
+```sh
+export TIP_CONTRACT=0xSEPOLIA_DEPLOYED_ADDRESS
+export TEST_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+cast code "$TIP_CONTRACT" --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_sepolia
+```
+
+Replace getter names to exactly match the source. For each read, compare output with the release record; nonempty bytecode and verified source must be visible in the explorer. Then run the public build against Sepolia (set chain ID `84532`, Sepolia contract and USDC addresses in the hosting preview environment) and perform this browser-wallet acceptance test with a fan wallet and a creator wallet:
+
+1. Connect on Base Sepolia; deliberately choose another chain first and confirm the UI requests a switch and cannot submit.
+2. Confirm displayed token is `USDC`, six-decimal formatted, and its address matches `TEST_USDC` in the wallet/explorer.
+3. Tip exactly `1.00` USDC. If using a separate approval, approve only the requested amount—never an unlimited default—then submit the tip.
+4. From explorer/ERC-20 transfer logs and balances, prove fan decrease is `1,000,000`, creator increase is `990,000`, fee recipient increase is `10,000`, and contract balance/accounting changed exactly as designed.
+5. Repeat with an awkward amount and the documented minimum. Test rejected wallet signature, insufficient balance, insufficient allowance, disconnect/reload during confirmation, and a reverted transaction. The UI must show an actionable error and must not display success or stale balances.
+6. Test each admin/withdrawal/pause action only from the Safe process and verify an unauthorized wallet fails.
+
+**GO:** both people independently complete and sign this acceptance test from the deployed Sepolia app, and the contract source is verified. Fix any finding in source, re-run Sections 1–3 from the new commit.
+
+## 4. Final mainnet preflight (the last reversible point)
+
+Create a production environment in the host (for example Vercel) but do **not** promote it. Add the frontend variables from Section 2, except leave `NEXT_PUBLIC_TIP_CONTRACT_ADDRESS` unset until deployment. Configure `APP_DOMAIN` as the production domain, HTTPS-only, and the dedicated Base RPC. Do not expose deployer, Basescan, Safe signer, or provider admin credentials as `NEXT_PUBLIC_*` variables.
+
+In a clean clone/CI runner at the recorded `GIT_SHA`, rerun:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+```
+
+Re-run the deployment simulation against mainnet, with mainnet config loaded but without `--broadcast`:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+```
+
+The two people must independently inspect the printed calldata/arguments and say “approve” only if all are exact: chain `8453`, Circle Base USDC address, `100` bps, Safe fee recipient/owner, expected deployer nonce/address, and expected contract bytecode. Capture `cast nonce "$DEPLOYER_ADDRESS" --rpc-url base_mainnet` and the simulation gas estimate in the release record. No code/config/nonce change is permitted between this approval and broadcast.
+
+**STOP:** A change requires a new SHA and repetition of Sections 1–4. **GO:** two-person written approval and sufficient Base ETH including a buffer for a replacement transaction.
+
+## 5. Deploy, verify, and prove mainnet configuration
+
+One operator broadcasts while the second watches the terminal and compares values. This is the only broadcast command:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer \
+  --broadcast --verify -vvvv | tee /private/tmp/base-mainnet-deploy-YYYY-MM-DD.log
+```
+
+Record address, transaction hash, block, gas used, compiler version, optimizer/via-IR settings, constructor arguments, and the full log in the release record. Do not fund or advertise the contract yet. Wait until the explorer marks the transaction successful and verification completes. If verification fails, do not redeploy: preserve the address and retry source verification with the exact build settings/artifacts; a second deployment creates a different public contract and needs a new approval.
+
+Read and check code/config via both the dedicated provider and a second independent Base RPC/explorer:
+
+```sh
+export MAINNET_TIP_CONTRACT=0xMAINNET_DEPLOYED_ADDRESS
+export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+cast chain-id --rpc-url base_mainnet
+cast code "$MAINNET_TIP_CONTRACT" --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'usdc()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
+```
+
+Expected values are `8453`, nonempty code, the mainnet USDC address, `100`, the Safe address, and `6`. Also open the verified source and transaction in BaseScan, confirm the deployer and constructor arguments, and ensure the contract is not accidentally paused/owned by the deployer. **GO:** every check matches in two independent views and both people sign the recorded deployed address.
+
+## 6. Ship the frontend with the immutable deployed address
+
+Change the production frontend config/source exactly once to use the recorded mainnet address, `base` (chain ID 8453), and Circle USDC. Update the Scaffold deployment/ABI artifact consumed by the UI as required by this repository; do not hand-copy an ABI unless the project is designed for that. Search for stale local/testnet values before committing:
+
+```sh
+rg -n '31337|localhost|anvil|84532|036CbD53842c5426634e7929541eC2318f3dCF7e|YOUR_' packages/nextjs packages/foundry
+rg -n '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|8453|MAINNET_TIP_CONTRACT' packages/nextjs packages/foundry
+pnpm --dir packages/nextjs lint
+pnpm --dir packages/nextjs typecheck
+pnpm --dir packages/nextjs build
+git diff --check
+git status --short
+git add -A && git commit -m 'chore: configure Base mainnet launch'
+git rev-parse HEAD
+```
+
+The first search must produce no live code path configured to localhost, Anvil, Base Sepolia, placeholder text, or test USDC. A test-only reference is acceptable only if it is excluded from the production bundle. Have the second person review the production diff and inspect the built site’s network configuration in a preview.
+
+Deploy the exact commit to a password-protected/unguessable preview first. With Vercel CLI this is:
+
+```sh
+cd packages/nextjs
+npx vercel link
+npx vercel --prebuilt   # after `npx vercel build`, or use `npx vercel` for the preview build path
+```
+
+Alternatively use the Git-connected host’s preview deployment for that exact commit. Configure the host’s production environment variables separately from preview; the command must never substitute `.env.local` secrets into production.
+
+**GO:** Preview is HTTPS, has the correct canonical origin, contains the exact verified address, accepts only Base, has no console/runtime errors, and its deployed bundle has no secrets. Use a fresh browser profile and no development wallet state to check this.
+
+## 7. Controlled mainnet canary, then public production
+
+Before routing the public domain, use two fresh small-value wallets and real Base USDC (only an amount you are willing to lose). In the preview on Base Mainnet, repeat the Section 3 browser-wallet journey with a `1.00` USDC tip. Verify on BaseScan and by `balanceOf` that the fan/creator/Safe deltas are exactly 1,000,000 / 990,000 / 10,000 units. Verify the displayed explorer links point to BaseScan and the UI refreshes only after a confirmed transaction.
+
+If the user must approve USDC, inspect the wallet request: spender must be the verified tip contract, chain must be Base, and approval must be the exact tip amount. If it is unlimited, change the UI to default to exact approval and repeat the test. Confirm that a rejected signature, rejected approval, reverted transaction, wrong network, disconnected RPC, and an RPC rate-limit response all present a safe error without treating the tip as successful.
+
+Only after both teammates sign the canary result, promote the already-tested commit:
+
+```sh
+cd packages/nextjs
+npx vercel --prod
+```
+
+Attach `APP_DOMAIN` in the host dashboard, enforce HTTPS, configure one canonical hostname with redirects, and update `NEXT_PUBLIC_APP_URL` if a redeploy is required. Re-run the canary at the final domain—not merely the provider URL. **GO:** the final domain serves the expected commit, all wallet flows use 8453/the verified contract, and the explorer results prove split settlement.
+
+## 8. Announce only after monitoring is live
+
+Before publishing the URL, set monitoring from an independent uptime service for `https://APP_DOMAIN` and a scripted 8453 RPC health check. Enable frontend error reporting (with transaction hashes and chain IDs, never wallet secrets), configure host build/error alerts for both people, and create a shared runbook contact channel. Watch the verified contract’s `Tip`/fee/withdraw/admin events in BaseScan or an indexer; alert on failed transactions, unexpected configuration events, failed deployments, RPC errors, and a contract USDC balance that is inconsistent with the intended design.
+
+Publish a short public support page that states: “Base Mainnet only”, verified tip-contract address, official USDC address, fees (1%), whether approval is required, what a successful transaction looks like, and support contact. Link the contract through BaseScan. Never ask users for seed phrases, private keys, or token transfers to a support wallet.
+
+For the first 24 hours, check the final domain, RPC health, frontend error rate, and the first real tips at least hourly; reconcile each tip from the transaction logs to the creator and Safe. Reconcile daily thereafter: total fan debits = creator credits + platform fees (+ documented rounding), and investigate any difference before it compounds.
+
+## 9. Incident response and rollback limits
+
+Frontend rollback is possible: immediately redeploy the prior known-good frontend commit, disable new tips in the UI, and publish a status notice. Contract rollback is **not** possible after deployment. If the contract has an audited `pause` function, use the Safe to pause it and verify the pause transaction; do not invent an emergency transaction or change owner keys under pressure. If it has no pause, remove the public UI and warn users while obtaining security advice.
+
+Never deploy a “fixed” replacement and point the UI at it without repeating this entire runbook, verification, and canary. Preserve transaction hashes, screenshots, logs, and balances for incident reconciliation. Rotate any credential that appeared in logs or a public repository immediately, then revoke/restrict the affected RPC/API key in its provider dashboard.
+
+## References used for network constants
+
+- [Base network connection and production-RPC warning](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+- [Circle official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+- [Base Foundry deployment and encrypted-keystore example](https://docs.base.org/get-started/deploy-smart-contracts)
+- [Base’s Foundry verification configuration example](https://docs.base.org/get-started/launch-token)

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..15acc96c9f957cfe8ec841fece7ea4ac4513b06c
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,299 @@
+# Production launch runbook — Base USDC tipping
+
+This is a **gated** release procedure. Complete a numbered section in order and do not continue if its `GO` condition is not met. All commands below are run from the root of the real Scaffold-ETH 2 repository, not from the directory containing this document. Replace values in `ALL_CAPS` exactly once, record them in the release log, and never put a private key in a shell history, `.env*` file tracked by Git, CI log, screenshot, or chat.
+
+The contract is an irreversible financial system. “The local journey works” is not a sufficient production gate: a bad constructor argument, token address, fee recipient, allowance flow, or frontend address can still permanently misdirect real USDC.
+
+## 0. Make the release decision and assign responsibilities
+
+Before touching Base, write and both sign off on this release record (a private issue or password-manager secure note):
+
+| Field | Record |
+| --- | --- |
+| Git commit to ship | `GIT_SHA` |
+| Contract source and fully-qualified deployment target | `CONTRACT_PATH:CONTRACT_NAME` / `SCRIPT_PATH:SCRIPT_NAME` |
+| Contract constructor/init arguments in their on-chain units | `CONSTRUCTOR_ARGS` |
+| Mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Fee rate | `100` basis points (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` (a 2-of-2 Safe, not either developer’s EOA) |
+| Deployer address | `DEPLOYER_ADDRESS` (a dedicated, single-purpose EOA) |
+| Owner/admin address(es) | `ADMIN_ADDRESS` / Safe address |
+| Public hostname | `APP_DOMAIN` |
+| RPC provider endpoint and dashboard owner | `BASE_MAINNET_RPC_URL` |
+
+Create the Safe first, verify its threshold is 2-of-2 and that both people can see it, then use its address for every privileged owner/fee-recipient value. If the contract has no admin or cannot send/withdraw the fee to the Safe, stop and change/audit the contract before launch. Do not use a personal wallet as a temporary substitute.
+
+**GO:** Both people independently compare the recorded USDC and Safe addresses character-for-character. Circle’s official Base USDC address is the value above; it has 6 decimals. Base Mainnet is chain ID `8453`. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Base](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+## 1. Freeze and independently review the release candidate
+
+```sh
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+git rev-parse HEAD
+git submodule status
+forge --version
+node --version
+pnpm --version # use npm/yarn here instead only if that is the committed lockfile
+```
+
+`git status --short` must be empty before making the intentional configuration changes below. Pin the current Foundry and Node versions in the release record. Install dependencies strictly from the committed lockfile:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+cd ../..
+```
+
+If this repository uses different package names/scripts, list them first rather than guessing:
+
+```sh
+find . -maxdepth 3 -name package.json -o -name foundry.toml
+pnpm --dir packages/nextjs run
+```
+
+Run static analysis and dependency checks, saving results with the release record:
+
+```sh
+cd packages/foundry
+slither . --exclude-dependencies
+forge fmt --check
+cd ../nextjs
+pnpm audit --prod
+cd ../..
+```
+
+Have the other teammate review the Solidity diff line-by-line, specifically: constructor arguments, immutable addresses, access control, reentrancy/external token calls, `transferFrom` return handling, USDC’s 6-decimal arithmetic, rounding (who receives the dust), zero/self/invalid creator addresses, duplicate/failed transfers, pause/escape-hatch behavior, and every method that can move accumulated fees. Get an independent smart-contract security review before mainnet if any funds can be held or any privileged parameter can change; no automated check replaces this.
+
+Add or confirm tests that assert these invariants, using `1_000_000` as one USDC:
+
+1. `tip(1_000_000)` credits creator `990_000`, fee recipient `10_000`, and never creates or loses USDC.
+2. Amounts below one cent and awkward amounts have a documented, tested rounding rule; the sum of transfers is exactly the input.
+3. A fan cannot tip without enough balance/allowance; a failed call leaves all balances/accounting unchanged.
+4. Only the intended role can change fee/recipient/pause or withdraw; a zero/wrong-token/wrong-recipient configuration reverts.
+5. A malicious ERC-20/reentrant recipient cannot double-spend or alter accounting, if the contract accepts arbitrary tokens/callbacks.
+
+**STOP:** Do not proceed on a compiler warning, skipped/failing test, unreviewed privilege, or a result that requires explaining away. **GO:** clean build/tests/lint/typecheck, reproducible production build, recorded review approval, and no unresolved high/critical finding.
+
+## 2. Make production configuration explicit (never infer localhost)
+
+Use a paid/dedicated Base RPC provider for the application; Base’s public RPC is rate-limited and explicitly not for production. Keep provider API secrets server-side where possible; a browser-visible `NEXT_PUBLIC_*` RPC URL must be a restricted public client endpoint, never an admin key. [Base RPC guidance](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+In `packages/foundry/foundry.toml` (or the repository’s actual Foundry config), add only these named endpoints and verification configuration; do not replace the local endpoint:
+
+```toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+```
+
+Create `packages/foundry/.env.example` and `packages/nextjs/.env.example` with variable *names only*; add the real `.env` files to `.gitignore` and verify they are ignored:
+
+```sh
+git check-ignore -v packages/foundry/.env packages/nextjs/.env
+git grep -nE '(PRIVATE_KEY|mnemonic|0x[0-9a-fA-F]{64})' -- ':!**/.env.example'
+```
+
+Use these values in the deployment operator’s untracked environment, preferably injected by a password manager/CI secret store rather than typed into a file:
+
+```dotenv
+# packages/foundry/.env (untracked)
+BASE_SEPOLIA_RPC_URL=https://YOUR_DEDICATED_BASE_SEPOLIA_RPC
+BASE_MAINNET_RPC_URL=https://YOUR_DEDICATED_BASE_MAINNET_RPC
+BASESCAN_API_KEY=YOUR_KEY
+DEPLOYER_ADDRESS=0xYOUR_DEDICATED_DEPLOYER
+
+# packages/nextjs/.env.production (untracked locally; configure equivalent host env vars)
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=0xSET_ONLY_AFTER_MAINNET_DEPLOYMENT
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_APP_URL=https://APP_DOMAIN
+NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_RESTRICTED_BROWSER_RPC
+```
+
+Import the dedicated deployer key into Foundry’s encrypted keystore interactively; it is stored outside Git:
+
+```sh
+cast wallet import base-mainnet-deployer --interactive
+cast wallet address --account base-mainnet-deployer
+```
+
+Compare the output with `DEPLOYER_ADDRESS`. Fund only that address with a small, pre-agreed amount of ETH **on Base Mainnet** for deployment; do not send any USDC to it. Confirm the chain and balance from the RPC:
+
+```sh
+set -a; source packages/foundry/.env; set +a
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+```
+
+The first output must be `8453`. **GO:** no secret is tracked, the frontend explicitly permits only `base`/8453 (not localhost/default chains), the configured USDC is Circle’s address, and the deployer is funded on Base—not Ethereum.
+
+## 3. Deploy and exercise the exact release on Base Sepolia
+
+Set the testnet token address in the deployment script/config to Circle’s Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is deliberately different from mainnet. Do not use a mock token on this gate. Fund two fresh test wallets with Base Sepolia ETH and test USDC from official faucets.
+
+Make the deploy command match the project’s existing script target. First inspect it and run a dry simulation; do not substitute a guessed script name:
+
+```sh
+cd packages/foundry
+find script -name '*.s.sol' -maxdepth 3 -print
+sed -n '1,240p' script/YOUR_DEPLOY_SCRIPT.s.sol
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer -vvvv
+```
+
+The simulation output must show the Sepolia USDC, intended Safe/test Safe, fee `100`, expected bytecode, and no unexpected transaction. Then broadcast and verify:
+
+```sh
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer \
+  --broadcast --verify -vvvv
+```
+
+Record the Sepolia address and transaction hash. Read every immutable/config getter using the actual ABI signatures from the contract (replace only the names below):
+
+```sh
+export TIP_CONTRACT=0xSEPOLIA_DEPLOYED_ADDRESS
+export TEST_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+cast code "$TIP_CONTRACT" --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_sepolia
+```
+
+Replace getter names to exactly match the source. For each read, compare output with the release record; nonempty bytecode and verified source must be visible in the explorer. Then run the public build against Sepolia (set chain ID `84532`, Sepolia contract and USDC addresses in the hosting preview environment) and perform this browser-wallet acceptance test with a fan wallet and a creator wallet:
+
+1. Connect on Base Sepolia; deliberately choose another chain first and confirm the UI requests a switch and cannot submit.
+2. Confirm displayed token is `USDC`, six-decimal formatted, and its address matches `TEST_USDC` in the wallet/explorer.
+3. Tip exactly `1.00` USDC. If using a separate approval, approve only the requested amount—never an unlimited default—then submit the tip.
+4. From explorer/ERC-20 transfer logs and balances, prove fan decrease is `1,000,000`, creator increase is `990,000`, fee recipient increase is `10,000`, and contract balance/accounting changed exactly as designed.
+5. Repeat with an awkward amount and the documented minimum. Test rejected wallet signature, insufficient balance, insufficient allowance, disconnect/reload during confirmation, and a reverted transaction. The UI must show an actionable error and must not display success or stale balances.
+6. Test each admin/withdrawal/pause action only from the Safe process and verify an unauthorized wallet fails.
+
+**GO:** both people independently complete and sign this acceptance test from the deployed Sepolia app, and the contract source is verified. Fix any finding in source, re-run Sections 1–3 from the new commit.
+
+## 4. Final mainnet preflight (the last reversible point)
+
+Create a production environment in the host (for example Vercel) but do **not** promote it. Add the frontend variables from Section 2, except leave `NEXT_PUBLIC_TIP_CONTRACT_ADDRESS` unset until deployment. Configure `APP_DOMAIN` as the production domain, HTTPS-only, and the dedicated Base RPC. Do not expose deployer, Basescan, Safe signer, or provider admin credentials as `NEXT_PUBLIC_*` variables.
+
+In a clean clone/CI runner at the recorded `GIT_SHA`, rerun:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+```
+
+Re-run the deployment simulation against mainnet, with mainnet config loaded but without `--broadcast`:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+```
+
+The two people must independently inspect the printed calldata/arguments and say “approve” only if all are exact: chain `8453`, Circle Base USDC address, `100` bps, Safe fee recipient/owner, expected deployer nonce/address, and expected contract bytecode. Capture `cast nonce "$DEPLOYER_ADDRESS" --rpc-url base_mainnet` and the simulation gas estimate in the release record. No code/config/nonce change is permitted between this approval and broadcast.
+
+**STOP:** A change requires a new SHA and repetition of Sections 1–4. **GO:** two-person written approval and sufficient Base ETH including a buffer for a replacement transaction.
+
+## 5. Deploy, verify, and prove mainnet configuration
+
+One operator broadcasts while the second watches the terminal and compares values. This is the only broadcast command:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer \
+  --broadcast --verify -vvvv | tee /private/tmp/base-mainnet-deploy-YYYY-MM-DD.log
+```
+
+Record address, transaction hash, block, gas used, compiler version, optimizer/via-IR settings, constructor arguments, and the full log in the release record. Do not fund or advertise the contract yet. Wait until the explorer marks the transaction successful and verification completes. If verification fails, do not redeploy: preserve the address and retry source verification with the exact build settings/artifacts; a second deployment creates a different public contract and needs a new approval.
+
+Read and check code/config via both the dedicated provider and a second independent Base RPC/explorer:
+
+```sh
+export MAINNET_TIP_CONTRACT=0xMAINNET_DEPLOYED_ADDRESS
+export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+cast chain-id --rpc-url base_mainnet
+cast code "$MAINNET_TIP_CONTRACT" --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'usdc()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
+```
+
+Expected values are `8453`, nonempty code, the mainnet USDC address, `100`, the Safe address, and `6`. Also open the verified source and transaction in BaseScan, confirm the deployer and constructor arguments, and ensure the contract is not accidentally paused/owned by the deployer. **GO:** every check matches in two independent views and both people sign the recorded deployed address.
+
+## 6. Ship the frontend with the immutable deployed address
+
+Change the production frontend config/source exactly once to use the recorded mainnet address, `base` (chain ID 8453), and Circle USDC. Update the Scaffold deployment/ABI artifact consumed by the UI as required by this repository; do not hand-copy an ABI unless the project is designed for that. Search for stale local/testnet values before committing:
+
+```sh
+rg -n '31337|localhost|anvil|84532|036CbD53842c5426634e7929541eC2318f3dCF7e|YOUR_' packages/nextjs packages/foundry
+rg -n '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|8453|MAINNET_TIP_CONTRACT' packages/nextjs packages/foundry
+pnpm --dir packages/nextjs lint
+pnpm --dir packages/nextjs typecheck
+pnpm --dir packages/nextjs build
+git diff --check
+git status --short
+git add -A && git commit -m 'chore: configure Base mainnet launch'
+git rev-parse HEAD
+```
+
+The first search must produce no live code path configured to localhost, Anvil, Base Sepolia, placeholder text, or test USDC. A test-only reference is acceptable only if it is excluded from the production bundle. Have the second person review the production diff and inspect the built site’s network configuration in a preview.
+
+Deploy the exact commit to a password-protected/unguessable preview first. With Vercel CLI this is:
+
+```sh
+cd packages/nextjs
+npx vercel link
+npx vercel --prebuilt   # after `npx vercel build`, or use `npx vercel` for the preview build path
+```
+
+Alternatively use the Git-connected host’s preview deployment for that exact commit. Configure the host’s production environment variables separately from preview; the command must never substitute `.env.local` secrets into production.
+
+**GO:** Preview is HTTPS, has the correct canonical origin, contains the exact verified address, accepts only Base, has no console/runtime errors, and its deployed bundle has no secrets. Use a fresh browser profile and no development wallet state to check this.
+
+## 7. Controlled mainnet canary, then public production
+
+Before routing the public domain, use two fresh small-value wallets and real Base USDC (only an amount you are willing to lose). In the preview on Base Mainnet, repeat the Section 3 browser-wallet journey with a `1.00` USDC tip. Verify on BaseScan and by `balanceOf` that the fan/creator/Safe deltas are exactly 1,000,000 / 990,000 / 10,000 units. Verify the displayed explorer links point to BaseScan and the UI refreshes only after a confirmed transaction.
+
+If the user must approve USDC, inspect the wallet request: spender must be the verified tip contract, chain must be Base, and approval must be the exact tip amount. If it is unlimited, change the UI to default to exact approval and repeat the test. Confirm that a rejected signature, rejected approval, reverted transaction, wrong network, disconnected RPC, and an RPC rate-limit response all present a safe error without treating the tip as successful.
+
+Only after both teammates sign the canary result, promote the already-tested commit:
+
+```sh
+cd packages/nextjs
+npx vercel --prod
+```
+
+Attach `APP_DOMAIN` in the host dashboard, enforce HTTPS, configure one canonical hostname with redirects, and update `NEXT_PUBLIC_APP_URL` if a redeploy is required. Re-run the canary at the final domain—not merely the provider URL. **GO:** the final domain serves the expected commit, all wallet flows use 8453/the verified contract, and the explorer results prove split settlement.
+
+## 8. Announce only after monitoring is live
+
+Before publishing the URL, set monitoring from an independent uptime service for `https://APP_DOMAIN` and a scripted 8453 RPC health check. Enable frontend error reporting (with transaction hashes and chain IDs, never wallet secrets), configure host build/error alerts for both people, and create a shared runbook contact channel. Watch the verified contract’s `Tip`/fee/withdraw/admin events in BaseScan or an indexer; alert on failed transactions, unexpected configuration events, failed deployments, RPC errors, and a contract USDC balance that is inconsistent with the intended design.
+
+Publish a short public support page that states: “Base Mainnet only”, verified tip-contract address, official USDC address, fees (1%), whether approval is required, what a successful transaction looks like, and support contact. Link the contract through BaseScan. Never ask users for seed phrases, private keys, or token transfers to a support wallet.
+
+For the first 24 hours, check the final domain, RPC health, frontend error rate, and the first real tips at least hourly; reconcile each tip from the transaction logs to the creator and Safe. Reconcile daily thereafter: total fan debits = creator credits + platform fees (+ documented rounding), and investigate any difference before it compounds.
+
+## 9. Incident response and rollback limits
+
+Frontend rollback is possible: immediately redeploy the prior known-good frontend commit, disable new tips in the UI, and publish a status notice. Contract rollback is **not** possible after deployment. If the contract has an audited `pause` function, use the Safe to pause it and verify the pause transaction; do not invent an emergency transaction or change owner keys under pressure. If it has no pause, remove the public UI and warn users while obtaining security advice.
+
+Never deploy a “fixed” replacement and point the UI at it without repeating this entire runbook, verification, and canary. Preserve transaction hashes, screenshots, logs, and balances for incident reconciliation. Rotate any credential that appeared in logs or a public repository immediately, then revoke/restrict the affected RPC/API key in its provider dashboard.
+
+## References used for network constants
+
+- [Base network connection and production-RPC warning](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+- [Circle official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+- [Base Foundry deployment and encrypted-keystore example](https://docs.base.org/get-started/deploy-smart-contracts)
+- [Base’s Foundry verification configuration example](https://docs.base.org/get-started/launch-token)

codex
The runbook is drafted with a public-Sepolia rehearsal, a two-person mainnet preflight, an on-chain canary, and post-launch reconciliation. I’m doing a final consistency pass for command order and production constants.
exec
/bin/zsh -lc "wc -l LAUNCH.md && rg -n 'Base Mainnet|833589|036CbD|forge script|--broadcast|GO:|STOP:' LAUNCH.md && git diff --check && git status --short" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120619Z-codex-no-skill-2
 succeeded in 0ms:
     299 LAUNCH.md
16:| Mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
26:**GO:** Both people independently compare the recorded USDC and Safe addresses character-for-character. Circle’s official Base USDC address is the value above; it has 6 decimals. Base Mainnet is chain ID `8453`. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Base](https://docs.base.org/base-chain/quickstart/connecting-to-base)
77:**STOP:** Do not proceed on a compiler warning, skipped/failing test, unreviewed privilege, or a result that requires explaining away. **GO:** clean build/tests/lint/typecheck, reproducible production build, recorded review approval, and no unresolved high/critical finding.
114:NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
126:Compare the output with `DEPLOYER_ADDRESS`. Fund only that address with a small, pre-agreed amount of ETH **on Base Mainnet** for deployment; do not send any USDC to it. Confirm the chain and balance from the RPC:
134:The first output must be `8453`. **GO:** no secret is tracked, the frontend explicitly permits only `base`/8453 (not localhost/default chains), the configured USDC is Circle’s address, and the deployer is funded on Base—not Ethereum.
138:Set the testnet token address in the deployment script/config to Circle’s Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is deliberately different from mainnet. Do not use a mock token on this gate. Fund two fresh test wallets with Base Sepolia ETH and test USDC from official faucets.
147:forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
154:forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
156:  --broadcast --verify -vvvv
163:export TEST_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
179:**GO:** both people independently complete and sign this acceptance test from the deployed Sepolia app, and the contract source is verified. Fix any finding in source, re-run Sections 1–3 from the new commit.
193:Re-run the deployment simulation against mainnet, with mainnet config loaded but without `--broadcast`:
198:forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
204:**STOP:** A change requires a new SHA and repetition of Sections 1–4. **GO:** two-person written approval and sufficient Base ETH including a buffer for a replacement transaction.
213:forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
215:  --broadcast --verify -vvvv | tee /private/tmp/base-mainnet-deploy-YYYY-MM-DD.log
224:export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
233:Expected values are `8453`, nonempty code, the mainnet USDC address, `100`, the Safe address, and `6`. Also open the verified source and transaction in BaseScan, confirm the deployer and constructor arguments, and ensure the contract is not accidentally paused/owned by the deployer. **GO:** every check matches in two independent views and both people sign the recorded deployed address.
240:rg -n '31337|localhost|anvil|84532|036CbD53842c5426634e7929541eC2318f3dCF7e|YOUR_' packages/nextjs packages/foundry
241:rg -n '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|8453|MAINNET_TIP_CONTRACT' packages/nextjs packages/foundry
263:**GO:** Preview is HTTPS, has the correct canonical origin, contains the exact verified address, accepts only Base, has no console/runtime errors, and its deployed bundle has no secrets. Use a fresh browser profile and no development wallet state to check this.
267:Before routing the public domain, use two fresh small-value wallets and real Base USDC (only an amount you are willing to lose). In the preview on Base Mainnet, repeat the Section 3 browser-wallet journey with a `1.00` USDC tip. Verify on BaseScan and by `balanceOf` that the fan/creator/Safe deltas are exactly 1,000,000 / 990,000 / 10,000 units. Verify the displayed explorer links point to BaseScan and the UI refreshes only after a confirmed transaction.
278:Attach `APP_DOMAIN` in the host dashboard, enforce HTTPS, configure one canonical hostname with redirects, and update `NEXT_PUBLIC_APP_URL` if a redeploy is required. Re-run the canary at the final domain—not merely the provider URL. **GO:** the final domain serves the expected commit, all wallet flows use 8453/the verified contract, and the explorer results prove split settlement.
284:Publish a short public support page that states: “Base Mainnet only”, verified tip-contract address, official USDC address, fees (1%), whether approval is required, what a successful transaction looks like, and support contact. Link the contract through BaseScan. Never ask users for seed phrases, private keys, or token transfers to a support wallet.
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..15acc96c9f957cfe8ec841fece7ea4ac4513b06c
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,299 @@
+# Production launch runbook — Base USDC tipping
+
+This is a **gated** release procedure. Complete a numbered section in order and do not continue if its `GO` condition is not met. All commands below are run from the root of the real Scaffold-ETH 2 repository, not from the directory containing this document. Replace values in `ALL_CAPS` exactly once, record them in the release log, and never put a private key in a shell history, `.env*` file tracked by Git, CI log, screenshot, or chat.
+
+The contract is an irreversible financial system. “The local journey works” is not a sufficient production gate: a bad constructor argument, token address, fee recipient, allowance flow, or frontend address can still permanently misdirect real USDC.
+
+## 0. Make the release decision and assign responsibilities
+
+Before touching Base, write and both sign off on this release record (a private issue or password-manager secure note):
+
+| Field | Record |
+| --- | --- |
+| Git commit to ship | `GIT_SHA` |
+| Contract source and fully-qualified deployment target | `CONTRACT_PATH:CONTRACT_NAME` / `SCRIPT_PATH:SCRIPT_NAME` |
+| Contract constructor/init arguments in their on-chain units | `CONSTRUCTOR_ARGS` |
+| Mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Fee rate | `100` basis points (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` (a 2-of-2 Safe, not either developer’s EOA) |
+| Deployer address | `DEPLOYER_ADDRESS` (a dedicated, single-purpose EOA) |
+| Owner/admin address(es) | `ADMIN_ADDRESS` / Safe address |
+| Public hostname | `APP_DOMAIN` |
+| RPC provider endpoint and dashboard owner | `BASE_MAINNET_RPC_URL` |
+
+Create the Safe first, verify its threshold is 2-of-2 and that both people can see it, then use its address for every privileged owner/fee-recipient value. If the contract has no admin or cannot send/withdraw the fee to the Safe, stop and change/audit the contract before launch. Do not use a personal wallet as a temporary substitute.
+
+**GO:** Both people independently compare the recorded USDC and Safe addresses character-for-character. Circle’s official Base USDC address is the value above; it has 6 decimals. Base Mainnet is chain ID `8453`. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Base](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+## 1. Freeze and independently review the release candidate
+
+```sh
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+git rev-parse HEAD
+git submodule status
+forge --version
+node --version
+pnpm --version # use npm/yarn here instead only if that is the committed lockfile
+```
+
+`git status --short` must be empty before making the intentional configuration changes below. Pin the current Foundry and Node versions in the release record. Install dependencies strictly from the committed lockfile:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+cd ../..
+```
+
+If this repository uses different package names/scripts, list them first rather than guessing:
+
+```sh
+find . -maxdepth 3 -name package.json -o -name foundry.toml
+pnpm --dir packages/nextjs run
+```
+
+Run static analysis and dependency checks, saving results with the release record:
+
+```sh
+cd packages/foundry
+slither . --exclude-dependencies
+forge fmt --check
+cd ../nextjs
+pnpm audit --prod
+cd ../..
+```
+
+Have the other teammate review the Solidity diff line-by-line, specifically: constructor arguments, immutable addresses, access control, reentrancy/external token calls, `transferFrom` return handling, USDC’s 6-decimal arithmetic, rounding (who receives the dust), zero/self/invalid creator addresses, duplicate/failed transfers, pause/escape-hatch behavior, and every method that can move accumulated fees. Get an independent smart-contract security review before mainnet if any funds can be held or any privileged parameter can change; no automated check replaces this.
+
+Add or confirm tests that assert these invariants, using `1_000_000` as one USDC:
+
+1. `tip(1_000_000)` credits creator `990_000`, fee recipient `10_000`, and never creates or loses USDC.
+2. Amounts below one cent and awkward amounts have a documented, tested rounding rule; the sum of transfers is exactly the input.
+3. A fan cannot tip without enough balance/allowance; a failed call leaves all balances/accounting unchanged.
+4. Only the intended role can change fee/recipient/pause or withdraw; a zero/wrong-token/wrong-recipient configuration reverts.
+5. A malicious ERC-20/reentrant recipient cannot double-spend or alter accounting, if the contract accepts arbitrary tokens/callbacks.
+
+**STOP:** Do not proceed on a compiler warning, skipped/failing test, unreviewed privilege, or a result that requires explaining away. **GO:** clean build/tests/lint/typecheck, reproducible production build, recorded review approval, and no unresolved high/critical finding.
+
+## 2. Make production configuration explicit (never infer localhost)
+
+Use a paid/dedicated Base RPC provider for the application; Base’s public RPC is rate-limited and explicitly not for production. Keep provider API secrets server-side where possible; a browser-visible `NEXT_PUBLIC_*` RPC URL must be a restricted public client endpoint, never an admin key. [Base RPC guidance](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+In `packages/foundry/foundry.toml` (or the repository’s actual Foundry config), add only these named endpoints and verification configuration; do not replace the local endpoint:
+
+```toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+```
+
+Create `packages/foundry/.env.example` and `packages/nextjs/.env.example` with variable *names only*; add the real `.env` files to `.gitignore` and verify they are ignored:
+
+```sh
+git check-ignore -v packages/foundry/.env packages/nextjs/.env
+git grep -nE '(PRIVATE_KEY|mnemonic|0x[0-9a-fA-F]{64})' -- ':!**/.env.example'
+```
+
+Use these values in the deployment operator’s untracked environment, preferably injected by a password manager/CI secret store rather than typed into a file:
+
+```dotenv
+# packages/foundry/.env (untracked)
+BASE_SEPOLIA_RPC_URL=https://YOUR_DEDICATED_BASE_SEPOLIA_RPC
+BASE_MAINNET_RPC_URL=https://YOUR_DEDICATED_BASE_MAINNET_RPC
+BASESCAN_API_KEY=YOUR_KEY
+DEPLOYER_ADDRESS=0xYOUR_DEDICATED_DEPLOYER
+
+# packages/nextjs/.env.production (untracked locally; configure equivalent host env vars)
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=0xSET_ONLY_AFTER_MAINNET_DEPLOYMENT
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_APP_URL=https://APP_DOMAIN
+NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_RESTRICTED_BROWSER_RPC
+```
+
+Import the dedicated deployer key into Foundry’s encrypted keystore interactively; it is stored outside Git:
+
+```sh
+cast wallet import base-mainnet-deployer --interactive
+cast wallet address --account base-mainnet-deployer
+```
+
+Compare the output with `DEPLOYER_ADDRESS`. Fund only that address with a small, pre-agreed amount of ETH **on Base Mainnet** for deployment; do not send any USDC to it. Confirm the chain and balance from the RPC:
+
+```sh
+set -a; source packages/foundry/.env; set +a
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+```
+
+The first output must be `8453`. **GO:** no secret is tracked, the frontend explicitly permits only `base`/8453 (not localhost/default chains), the configured USDC is Circle’s address, and the deployer is funded on Base—not Ethereum.
+
+## 3. Deploy and exercise the exact release on Base Sepolia
+
+Set the testnet token address in the deployment script/config to Circle’s Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is deliberately different from mainnet. Do not use a mock token on this gate. Fund two fresh test wallets with Base Sepolia ETH and test USDC from official faucets.
+
+Make the deploy command match the project’s existing script target. First inspect it and run a dry simulation; do not substitute a guessed script name:
+
+```sh
+cd packages/foundry
+find script -name '*.s.sol' -maxdepth 3 -print
+sed -n '1,240p' script/YOUR_DEPLOY_SCRIPT.s.sol
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer -vvvv
+```
+
+The simulation output must show the Sepolia USDC, intended Safe/test Safe, fee `100`, expected bytecode, and no unexpected transaction. Then broadcast and verify:
+
+```sh
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer \
+  --broadcast --verify -vvvv
+```
+
+Record the Sepolia address and transaction hash. Read every immutable/config getter using the actual ABI signatures from the contract (replace only the names below):
+
+```sh
+export TIP_CONTRACT=0xSEPOLIA_DEPLOYED_ADDRESS
+export TEST_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+cast code "$TIP_CONTRACT" --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_sepolia
+```
+
+Replace getter names to exactly match the source. For each read, compare output with the release record; nonempty bytecode and verified source must be visible in the explorer. Then run the public build against Sepolia (set chain ID `84532`, Sepolia contract and USDC addresses in the hosting preview environment) and perform this browser-wallet acceptance test with a fan wallet and a creator wallet:
+
+1. Connect on Base Sepolia; deliberately choose another chain first and confirm the UI requests a switch and cannot submit.
+2. Confirm displayed token is `USDC`, six-decimal formatted, and its address matches `TEST_USDC` in the wallet/explorer.
+3. Tip exactly `1.00` USDC. If using a separate approval, approve only the requested amount—never an unlimited default—then submit the tip.
+4. From explorer/ERC-20 transfer logs and balances, prove fan decrease is `1,000,000`, creator increase is `990,000`, fee recipient increase is `10,000`, and contract balance/accounting changed exactly as designed.
+5. Repeat with an awkward amount and the documented minimum. Test rejected wallet signature, insufficient balance, insufficient allowance, disconnect/reload during confirmation, and a reverted transaction. The UI must show an actionable error and must not display success or stale balances.
+6. Test each admin/withdrawal/pause action only from the Safe process and verify an unauthorized wallet fails.
+
+**GO:** both people independently complete and sign this acceptance test from the deployed Sepolia app, and the contract source is verified. Fix any finding in source, re-run Sections 1–3 from the new commit.
+
+## 4. Final mainnet preflight (the last reversible point)
+
+Create a production environment in the host (for example Vercel) but do **not** promote it. Add the frontend variables from Section 2, except leave `NEXT_PUBLIC_TIP_CONTRACT_ADDRESS` unset until deployment. Configure `APP_DOMAIN` as the production domain, HTTPS-only, and the dedicated Base RPC. Do not expose deployer, Basescan, Safe signer, or provider admin credentials as `NEXT_PUBLIC_*` variables.
+
+In a clean clone/CI runner at the recorded `GIT_SHA`, rerun:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+```
+
+Re-run the deployment simulation against mainnet, with mainnet config loaded but without `--broadcast`:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+```
+
+The two people must independently inspect the printed calldata/arguments and say “approve” only if all are exact: chain `8453`, Circle Base USDC address, `100` bps, Safe fee recipient/owner, expected deployer nonce/address, and expected contract bytecode. Capture `cast nonce "$DEPLOYER_ADDRESS" --rpc-url base_mainnet` and the simulation gas estimate in the release record. No code/config/nonce change is permitted between this approval and broadcast.
+
+**STOP:** A change requires a new SHA and repetition of Sections 1–4. **GO:** two-person written approval and sufficient Base ETH including a buffer for a replacement transaction.
+
+## 5. Deploy, verify, and prove mainnet configuration
+
+One operator broadcasts while the second watches the terminal and compares values. This is the only broadcast command:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer \
+  --broadcast --verify -vvvv | tee /private/tmp/base-mainnet-deploy-YYYY-MM-DD.log
+```
+
+Record address, transaction hash, block, gas used, compiler version, optimizer/via-IR settings, constructor arguments, and the full log in the release record. Do not fund or advertise the contract yet. Wait until the explorer marks the transaction successful and verification completes. If verification fails, do not redeploy: preserve the address and retry source verification with the exact build settings/artifacts; a second deployment creates a different public contract and needs a new approval.
+
+Read and check code/config via both the dedicated provider and a second independent Base RPC/explorer:
+
+```sh
+export MAINNET_TIP_CONTRACT=0xMAINNET_DEPLOYED_ADDRESS
+export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+cast chain-id --rpc-url base_mainnet
+cast code "$MAINNET_TIP_CONTRACT" --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'usdc()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
+```
+
+Expected values are `8453`, nonempty code, the mainnet USDC address, `100`, the Safe address, and `6`. Also open the verified source and transaction in BaseScan, confirm the deployer and constructor arguments, and ensure the contract is not accidentally paused/owned by the deployer. **GO:** every check matches in two independent views and both people sign the recorded deployed address.
+
+## 6. Ship the frontend with the immutable deployed address
+
+Change the production frontend config/source exactly once to use the recorded mainnet address, `base` (chain ID 8453), and Circle USDC. Update the Scaffold deployment/ABI artifact consumed by the UI as required by this repository; do not hand-copy an ABI unless the project is designed for that. Search for stale local/testnet values before committing:
+
+```sh
+rg -n '31337|localhost|anvil|84532|036CbD53842c5426634e7929541eC2318f3dCF7e|YOUR_' packages/nextjs packages/foundry
+rg -n '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|8453|MAINNET_TIP_CONTRACT' packages/nextjs packages/foundry
+pnpm --dir packages/nextjs lint
+pnpm --dir packages/nextjs typecheck
+pnpm --dir packages/nextjs build
+git diff --check
+git status --short
+git add -A && git commit -m 'chore: configure Base mainnet launch'
+git rev-parse HEAD
+```
+
+The first search must produce no live code path configured to localhost, Anvil, Base Sepolia, placeholder text, or test USDC. A test-only reference is acceptable only if it is excluded from the production bundle. Have the second person review the production diff and inspect the built site’s network configuration in a preview.
+
+Deploy the exact commit to a password-protected/unguessable preview first. With Vercel CLI this is:
+
+```sh
+cd packages/nextjs
+npx vercel link
+npx vercel --prebuilt   # after `npx vercel build`, or use `npx vercel` for the preview build path
+```
+
+Alternatively use the Git-connected host’s preview deployment for that exact commit. Configure the host’s production environment variables separately from preview; the command must never substitute `.env.local` secrets into production.
+
+**GO:** Preview is HTTPS, has the correct canonical origin, contains the exact verified address, accepts only Base, has no console/runtime errors, and its deployed bundle has no secrets. Use a fresh browser profile and no development wallet state to check this.
+
+## 7. Controlled mainnet canary, then public production
+
+Before routing the public domain, use two fresh small-value wallets and real Base USDC (only an amount you are willing to lose). In the preview on Base Mainnet, repeat the Section 3 browser-wallet journey with a `1.00` USDC tip. Verify on BaseScan and by `balanceOf` that the fan/creator/Safe deltas are exactly 1,000,000 / 990,000 / 10,000 units. Verify the displayed explorer links point to BaseScan and the UI refreshes only after a confirmed transaction.
+
+If the user must approve USDC, inspect the wallet request: spender must be the verified tip contract, chain must be Base, and approval must be the exact tip amount. If it is unlimited, change the UI to default to exact approval and repeat the test. Confirm that a rejected signature, rejected approval, reverted transaction, wrong network, disconnected RPC, and an RPC rate-limit response all present a safe error without treating the tip as successful.
+
+Only after both teammates sign the canary result, promote the already-tested commit:
+
+```sh
+cd packages/nextjs
+npx vercel --prod
+```
+
+Attach `APP_DOMAIN` in the host dashboard, enforce HTTPS, configure one canonical hostname with redirects, and update `NEXT_PUBLIC_APP_URL` if a redeploy is required. Re-run the canary at the final domain—not merely the provider URL. **GO:** the final domain serves the expected commit, all wallet flows use 8453/the verified contract, and the explorer results prove split settlement.
+
+## 8. Announce only after monitoring is live
+
+Before publishing the URL, set monitoring from an independent uptime service for `https://APP_DOMAIN` and a scripted 8453 RPC health check. Enable frontend error reporting (with transaction hashes and chain IDs, never wallet secrets), configure host build/error alerts for both people, and create a shared runbook contact channel. Watch the verified contract’s `Tip`/fee/withdraw/admin events in BaseScan or an indexer; alert on failed transactions, unexpected configuration events, failed deployments, RPC errors, and a contract USDC balance that is inconsistent with the intended design.
+
+Publish a short public support page that states: “Base Mainnet only”, verified tip-contract address, official USDC address, fees (1%), whether approval is required, what a successful transaction looks like, and support contact. Link the contract through BaseScan. Never ask users for seed phrases, private keys, or token transfers to a support wallet.
+
+For the first 24 hours, check the final domain, RPC health, frontend error rate, and the first real tips at least hourly; reconcile each tip from the transaction logs to the creator and Safe. Reconcile daily thereafter: total fan debits = creator credits + platform fees (+ documented rounding), and investigate any difference before it compounds.
+
+## 9. Incident response and rollback limits
+
+Frontend rollback is possible: immediately redeploy the prior known-good frontend commit, disable new tips in the UI, and publish a status notice. Contract rollback is **not** possible after deployment. If the contract has an audited `pause` function, use the Safe to pause it and verify the pause transaction; do not invent an emergency transaction or change owner keys under pressure. If it has no pause, remove the public UI and warn users while obtaining security advice.
+
+Never deploy a “fixed” replacement and point the UI at it without repeating this entire runbook, verification, and canary. Preserve transaction hashes, screenshots, logs, and balances for incident reconciliation. Rotate any credential that appeared in logs or a public repository immediately, then revoke/restrict the affected RPC/API key in its provider dashboard.
+
+## References used for network constants
+
+- [Base network connection and production-RPC warning](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+- [Circle official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+- [Base Foundry deployment and encrypted-keystore example](https://docs.base.org/get-started/deploy-smart-contracts)
+- [Base’s Foundry verification configuration example](https://docs.base.org/get-started/launch-token)

2026-08-13T12:25:51.432975Z ERROR codex_models_manager::manager: failed to refresh available models: timeout waiting for child process to exit
apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120619Z-codex-no-skill-2/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..0ee00946d30502e35f329086289cd824eee5c558
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,300 @@
+# Production launch runbook — Base USDC tipping
+
+This is a **gated** release procedure. Complete a numbered section in order and do not continue if its `GO` condition is not met. All commands below are run from the root of the real Scaffold-ETH 2 repository, not from the directory containing this document. Replace values in `ALL_CAPS` exactly once, record them in the release log, and never put a private key in a shell history, `.env*` file tracked by Git, CI log, screenshot, or chat.
+
+The contract is an irreversible financial system. “The local journey works” is not a sufficient production gate: a bad constructor argument, token address, fee recipient, allowance flow, or frontend address can still permanently misdirect real USDC.
+
+## 0. Make the release decision and assign responsibilities
+
+Before touching Base, write and both sign off on this release record (a private issue or password-manager secure note):
+
+| Field | Record |
+| --- | --- |
+| Git commit to ship | `GIT_SHA` |
+| Contract source and fully-qualified deployment target | `CONTRACT_PATH:CONTRACT_NAME` / `SCRIPT_PATH:SCRIPT_NAME` |
+| Contract constructor/init arguments in their on-chain units | `CONSTRUCTOR_ARGS` |
+| Mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Fee rate | `100` basis points (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` (a 2-of-2 Safe, not either developer’s EOA) |
+| Deployer address | `DEPLOYER_ADDRESS` (a dedicated, single-purpose EOA) |
+| Owner/admin address(es) | `ADMIN_ADDRESS` / Safe address |
+| Public hostname | `APP_DOMAIN` |
+| RPC provider endpoint and dashboard owner | `BASE_MAINNET_RPC_URL` |
+
+Create the Safe first, verify its threshold is 2-of-2 and that both people can see it, then use its address for every privileged owner/fee-recipient value. If the contract has no admin or cannot send/withdraw the fee to the Safe, stop and change/audit the contract before launch. Do not use a personal wallet as a temporary substitute.
+
+**GO:** Both people independently compare the recorded USDC and Safe addresses character-for-character. Circle’s official Base USDC address is the value above; it has 6 decimals. Base Mainnet is chain ID `8453`. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Base](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+## 1. Freeze and independently review the release candidate
+
+```sh
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+git rev-parse HEAD
+git submodule status
+forge --version
+node --version
+pnpm --version # use npm/yarn here instead only if that is the committed lockfile
+```
+
+`git status --short` must be empty before making the intentional configuration changes below. Pin the current Foundry and Node versions in the release record. Install dependencies strictly from the committed lockfile:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+cd ../..
+```
+
+If this repository uses different package names/scripts, list them first rather than guessing:
+
+```sh
+find . -maxdepth 3 -name package.json -o -name foundry.toml
+pnpm --dir packages/nextjs run
+```
+
+Run static analysis and dependency checks, saving results with the release record:
+
+```sh
+cd packages/foundry
+slither . --exclude-dependencies
+forge fmt --check
+cd ../nextjs
+pnpm audit --prod
+cd ../..
+```
+
+Have the other teammate review the Solidity diff line-by-line, specifically: constructor arguments, immutable addresses, access control, reentrancy/external token calls, `transferFrom` return handling, USDC’s 6-decimal arithmetic, rounding (who receives the dust), zero/self/invalid creator addresses, duplicate/failed transfers, pause/escape-hatch behavior, and every method that can move accumulated fees. Get an independent smart-contract security review before mainnet if any funds can be held or any privileged parameter can change; no automated check replaces this.
+
+Add or confirm tests that assert these invariants, using `1_000_000` as one USDC:
+
+1. `tip(1_000_000)` credits creator `990_000`, fee recipient `10_000`, and never creates or loses USDC.
+2. Amounts below one cent and awkward amounts have a documented, tested rounding rule; the sum of transfers is exactly the input.
+3. A fan cannot tip without enough balance/allowance; a failed call leaves all balances/accounting unchanged.
+4. Only the intended role can change fee/recipient/pause or withdraw; a zero/wrong-token/wrong-recipient configuration reverts.
+5. A malicious ERC-20/reentrant recipient cannot double-spend or alter accounting, if the contract accepts arbitrary tokens/callbacks.
+
+**STOP:** Do not proceed on a compiler warning, skipped/failing test, unreviewed privilege, or a result that requires explaining away. **GO:** clean build/tests/lint/typecheck, reproducible production build, recorded review approval, and no unresolved high/critical finding.
+
+## 2. Make production configuration explicit (never infer localhost)
+
+Use a paid/dedicated Base RPC provider for the application; Base’s public RPC is rate-limited and explicitly not for production. Keep provider API secrets server-side where possible; a browser-visible `NEXT_PUBLIC_*` RPC URL must be a restricted public client endpoint, never an admin key. [Base RPC guidance](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+In `packages/foundry/foundry.toml` (or the repository’s actual Foundry config), add only these named endpoints and verification configuration; do not replace the local endpoint:
+
+```toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+```
+
+Create `packages/foundry/.env.example` and `packages/nextjs/.env.example` with variable *names only*; add the real `.env` files to `.gitignore` and verify they are ignored:
+
+```sh
+git check-ignore -v packages/foundry/.env packages/nextjs/.env
+git grep -nE '(PRIVATE_KEY|mnemonic|0x[0-9a-fA-F]{64})' -- ':!**/.env.example'
+```
+
+Use these values in the deployment operator’s untracked environment, preferably injected by a password manager/CI secret store rather than typed into a file:
+
+```dotenv
+# packages/foundry/.env (untracked)
+BASE_SEPOLIA_RPC_URL=https://YOUR_DEDICATED_BASE_SEPOLIA_RPC
+BASE_MAINNET_RPC_URL=https://YOUR_DEDICATED_BASE_MAINNET_RPC
+BASESCAN_API_KEY=YOUR_KEY
+DEPLOYER_ADDRESS=0xYOUR_DEDICATED_DEPLOYER
+
+# packages/nextjs/.env.production (untracked locally; configure equivalent host env vars)
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=0xSET_ONLY_AFTER_MAINNET_DEPLOYMENT
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_APP_URL=https://APP_DOMAIN
+NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_RESTRICTED_BROWSER_RPC
+```
+
+Import the dedicated deployer key into Foundry’s encrypted keystore interactively; it is stored outside Git:
+
+```sh
+cast wallet import base-mainnet-deployer --interactive
+cast wallet address --account base-mainnet-deployer
+```
+
+Compare the output with `DEPLOYER_ADDRESS`. Fund only that address with a small, pre-agreed amount of ETH **on Base Mainnet** for deployment; do not send any USDC to it. Confirm the chain and balance from the RPC:
+
+```sh
+set -a; source packages/foundry/.env; set +a
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+```
+
+The first output must be `8453`. **GO:** no secret is tracked, the frontend explicitly permits only `base`/8453 (not localhost/default chains), the configured USDC is Circle’s address, and the deployer is funded on Base—not Ethereum.
+
+## 3. Deploy and exercise the exact release on Base Sepolia
+
+Set the testnet token address in the deployment script/config to Circle’s Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is deliberately different from mainnet. Do not use a mock token on this gate. Fund two fresh test wallets with Base Sepolia ETH and test USDC from official faucets.
+
+Make the deploy command match the project’s existing script target. First inspect it and run a dry simulation; do not substitute a guessed script name:
+
+```sh
+cd packages/foundry
+find script -name '*.s.sol' -maxdepth 3 -print
+sed -n '1,240p' script/YOUR_DEPLOY_SCRIPT.s.sol
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer -vvvv
+```
+
+The simulation output must show the Sepolia USDC, intended Safe/test Safe, fee `100`, expected bytecode, and no unexpected transaction. Then broadcast and verify:
+
+```sh
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer \
+  --broadcast --verify -vvvv
+```
+
+Record the Sepolia address and transaction hash. Read every immutable/config getter using the actual ABI signatures from the contract (replace only the names below):
+
+```sh
+export TIP_CONTRACT=0xSEPOLIA_DEPLOYED_ADDRESS
+export TEST_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+cast code "$TIP_CONTRACT" --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_sepolia
+```
+
+Replace getter names to exactly match the source. For each read, compare output with the release record; nonempty bytecode and verified source must be visible in the explorer. Then run the public build against Sepolia (set chain ID `84532`, Sepolia contract and USDC addresses in the hosting preview environment) and perform this browser-wallet acceptance test with a fan wallet and a creator wallet:
+
+1. Connect on Base Sepolia; deliberately choose another chain first and confirm the UI requests a switch and cannot submit.
+2. Confirm displayed token is `USDC`, six-decimal formatted, and its address matches `TEST_USDC` in the wallet/explorer.
+3. Tip exactly `1.00` USDC. If using a separate approval, approve only the requested amount—never an unlimited default—then submit the tip.
+4. From explorer/ERC-20 transfer logs and balances, prove fan decrease is `1,000,000`, creator increase is `990,000`, fee recipient increase is `10,000`, and contract balance/accounting changed exactly as designed.
+5. Repeat with an awkward amount and the documented minimum. Test rejected wallet signature, insufficient balance, insufficient allowance, disconnect/reload during confirmation, and a reverted transaction. The UI must show an actionable error and must not display success or stale balances.
+6. Test each admin/withdrawal/pause action only from the Safe process and verify an unauthorized wallet fails.
+
+**GO:** both people independently complete and sign this acceptance test from the deployed Sepolia app, and the contract source is verified. Fix any finding in source, re-run Sections 1–3 from the new commit.
+
+## 4. Final mainnet preflight (the last reversible point)
+
+Create a production environment in the host (for example Vercel) but do **not** promote it. Add the frontend variables from Section 2, except leave `NEXT_PUBLIC_TIP_CONTRACT_ADDRESS` unset until deployment. Configure `APP_DOMAIN` as the production domain, HTTPS-only, and the dedicated Base RPC. Do not expose deployer, Basescan, Safe signer, or provider admin credentials as `NEXT_PUBLIC_*` variables.
+
+In a clean clone/CI runner at the recorded `GIT_SHA`, rerun:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+```
+
+Re-run the deployment simulation against mainnet, with mainnet config loaded but without `--broadcast`:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+```
+
+The two people must independently inspect the printed calldata/arguments and say “approve” only if all are exact: chain `8453`, Circle Base USDC address, `100` bps, Safe fee recipient/owner, expected deployer nonce/address, and expected contract bytecode. Capture `cast nonce "$DEPLOYER_ADDRESS" --rpc-url base_mainnet` and the simulation gas estimate in the release record. No code/config/nonce change is permitted between this approval and broadcast.
+
+**STOP:** A change requires a new SHA and repetition of Sections 1–4. **GO:** two-person written approval and sufficient Base ETH including a buffer for a replacement transaction.
+
+## 5. Deploy, verify, and prove mainnet configuration
+
+One operator broadcasts while the second watches the terminal and compares values. This is the only broadcast command:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer \
+  --broadcast --verify -vvvv | tee /private/tmp/base-mainnet-deploy-YYYY-MM-DD.log
+```
+
+Record address, transaction hash, block, gas used, compiler version, optimizer/via-IR settings, constructor arguments, and the full log in the release record. Do not fund or advertise the contract yet. Wait until the explorer marks the transaction successful and verification completes. If verification fails, do not redeploy: preserve the address and retry source verification with the exact build settings/artifacts; a second deployment creates a different public contract and needs a new approval.
+
+Read and check code/config via both the dedicated provider and a second independent Base RPC/explorer:
+
+```sh
+export MAINNET_TIP_CONTRACT=0xMAINNET_DEPLOYED_ADDRESS
+export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+cast chain-id --rpc-url base_mainnet
+cast code "$MAINNET_TIP_CONTRACT" --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'usdc()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
+```
+
+Expected values are `8453`, nonempty code, the mainnet USDC address, `100`, the Safe address, and `6`. Also open the verified source and transaction in BaseScan, confirm the deployer and constructor arguments, and ensure the contract is not accidentally paused/owned by the deployer. **GO:** every check matches in two independent views and both people sign the recorded deployed address.
+
+## 6. Ship the frontend with the immutable deployed address
+
+Change the production frontend config/source exactly once to use the recorded mainnet address, `base` (chain ID 8453), and Circle USDC. Update the Scaffold deployment/ABI artifact consumed by the UI as required by this repository; do not hand-copy an ABI unless the project is designed for that. Search for stale local/testnet values before committing:
+
+```sh
+rg -n '31337|localhost|anvil|84532|036CbD53842c5426634e7929541eC2318f3dCF7e|YOUR_' packages/nextjs packages/foundry
+rg -n '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|8453|MAINNET_TIP_CONTRACT' packages/nextjs packages/foundry
+pnpm --dir packages/nextjs lint
+pnpm --dir packages/nextjs typecheck
+pnpm --dir packages/nextjs build
+git diff --check
+git status --short
+git add -A && git commit -m 'chore: configure Base mainnet launch'
+git rev-parse HEAD
+```
+
+The first search must produce no live code path configured to localhost, Anvil, Base Sepolia, placeholder text, or test USDC. A test-only reference is acceptable only if it is excluded from the production bundle. Have the second person review the production diff and inspect the built site’s network configuration in a preview.
+
+Deploy the exact commit to a password-protected/unguessable preview first. With Vercel CLI this is:
+
+```sh
+cd packages/nextjs
+npx vercel link
+npx vercel build
+npx vercel deploy --prebuilt
+```
+
+Alternatively use the Git-connected host’s preview deployment for that exact commit. Configure the host’s production environment variables separately from preview; the command must never substitute `.env.local` secrets into production.
+
+**GO:** Preview is HTTPS, has the correct canonical origin, contains the exact verified address, accepts only Base, has no console/runtime errors, and its deployed bundle has no secrets. Use a fresh browser profile and no development wallet state to check this.
+
+## 7. Controlled mainnet canary, then public production
+
+Before routing the public domain, use two fresh small-value wallets and real Base USDC (only an amount you are willing to lose). In the preview on Base Mainnet, repeat the Section 3 browser-wallet journey with a `1.00` USDC tip. Verify on BaseScan and by `balanceOf` that the fan/creator/Safe deltas are exactly 1,000,000 / 990,000 / 10,000 units. Verify the displayed explorer links point to BaseScan and the UI refreshes only after a confirmed transaction.
+
+If the user must approve USDC, inspect the wallet request: spender must be the verified tip contract, chain must be Base, and approval must be the exact tip amount. If it is unlimited, change the UI to default to exact approval and repeat the test. Confirm that a rejected signature, rejected approval, reverted transaction, wrong network, disconnected RPC, and an RPC rate-limit response all present a safe error without treating the tip as successful.
+
+Only after both teammates sign the canary result, promote the already-tested commit:
+
+```sh
+cd packages/nextjs
+npx vercel --prod
+```
+
+Attach `APP_DOMAIN` in the host dashboard, enforce HTTPS, configure one canonical hostname with redirects, and update `NEXT_PUBLIC_APP_URL` if a redeploy is required. Re-run the canary at the final domain—not merely the provider URL. **GO:** the final domain serves the expected commit, all wallet flows use 8453/the verified contract, and the explorer results prove split settlement.
+
+## 8. Announce only after monitoring is live
+
+Before publishing the URL, set monitoring from an independent uptime service for `https://APP_DOMAIN` and a scripted 8453 RPC health check. Enable frontend error reporting (with transaction hashes and chain IDs, never wallet secrets), configure host build/error alerts for both people, and create a shared runbook contact channel. Watch the verified contract’s `Tip`/fee/withdraw/admin events in BaseScan or an indexer; alert on failed transactions, unexpected configuration events, failed deployments, RPC errors, and a contract USDC balance that is inconsistent with the intended design.
+
+Publish a short public support page that states: “Base Mainnet only”, verified tip-contract address, official USDC address, fees (1%), whether approval is required, what a successful transaction looks like, and support contact. Link the contract through BaseScan. Never ask users for seed phrases, private keys, or token transfers to a support wallet.
+
+For the first 24 hours, check the final domain, RPC health, frontend error rate, and the first real tips at least hourly; reconcile each tip from the transaction logs to the creator and Safe. Reconcile daily thereafter: total fan debits = creator credits + platform fees (+ documented rounding), and investigate any difference before it compounds.
+
+## 9. Incident response and rollback limits
+
+Frontend rollback is possible: immediately redeploy the prior known-good frontend commit, disable new tips in the UI, and publish a status notice. Contract rollback is **not** possible after deployment. If the contract has an audited `pause` function, use the Safe to pause it and verify the pause transaction; do not invent an emergency transaction or change owner keys under pressure. If it has no pause, remove the public UI and warn users while obtaining security advice.
+
+Never deploy a “fixed” replacement and point the UI at it without repeating this entire runbook, verification, and canary. Preserve transaction hashes, screenshots, logs, and balances for incident reconciliation. Rotate any credential that appeared in logs or a public repository immediately, then revoke/restrict the affected RPC/API key in its provider dashboard.
+
+## References used for network constants
+
+- [Base network connection and production-RPC warning](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+- [Circle official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+- [Base Foundry deployment and encrypted-keystore example](https://docs.base.org/get-started/deploy-smart-contracts)
+- [Base’s Foundry verification configuration example](https://docs.base.org/get-started/launch-token)

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..0ee00946d30502e35f329086289cd824eee5c558
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,300 @@
+# Production launch runbook — Base USDC tipping
+
+This is a **gated** release procedure. Complete a numbered section in order and do not continue if its `GO` condition is not met. All commands below are run from the root of the real Scaffold-ETH 2 repository, not from the directory containing this document. Replace values in `ALL_CAPS` exactly once, record them in the release log, and never put a private key in a shell history, `.env*` file tracked by Git, CI log, screenshot, or chat.
+
+The contract is an irreversible financial system. “The local journey works” is not a sufficient production gate: a bad constructor argument, token address, fee recipient, allowance flow, or frontend address can still permanently misdirect real USDC.
+
+## 0. Make the release decision and assign responsibilities
+
+Before touching Base, write and both sign off on this release record (a private issue or password-manager secure note):
+
+| Field | Record |
+| --- | --- |
+| Git commit to ship | `GIT_SHA` |
+| Contract source and fully-qualified deployment target | `CONTRACT_PATH:CONTRACT_NAME` / `SCRIPT_PATH:SCRIPT_NAME` |
+| Contract constructor/init arguments in their on-chain units | `CONSTRUCTOR_ARGS` |
+| Mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Fee rate | `100` basis points (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` (a 2-of-2 Safe, not either developer’s EOA) |
+| Deployer address | `DEPLOYER_ADDRESS` (a dedicated, single-purpose EOA) |
+| Owner/admin address(es) | `ADMIN_ADDRESS` / Safe address |
+| Public hostname | `APP_DOMAIN` |
+| RPC provider endpoint and dashboard owner | `BASE_MAINNET_RPC_URL` |
+
+Create the Safe first, verify its threshold is 2-of-2 and that both people can see it, then use its address for every privileged owner/fee-recipient value. If the contract has no admin or cannot send/withdraw the fee to the Safe, stop and change/audit the contract before launch. Do not use a personal wallet as a temporary substitute.
+
+**GO:** Both people independently compare the recorded USDC and Safe addresses character-for-character. Circle’s official Base USDC address is the value above; it has 6 decimals. Base Mainnet is chain ID `8453`. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Base](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+## 1. Freeze and independently review the release candidate
+
+```sh
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+git rev-parse HEAD
+git submodule status
+forge --version
+node --version
+pnpm --version # use npm/yarn here instead only if that is the committed lockfile
+```
+
+`git status --short` must be empty before making the intentional configuration changes below. Pin the current Foundry and Node versions in the release record. Install dependencies strictly from the committed lockfile:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+cd ../..
+```
+
+If this repository uses different package names/scripts, list them first rather than guessing:
+
+```sh
+find . -maxdepth 3 -name package.json -o -name foundry.toml
+pnpm --dir packages/nextjs run
+```
+
+Run static analysis and dependency checks, saving results with the release record:
+
+```sh
+cd packages/foundry
+slither . --exclude-dependencies
+forge fmt --check
+cd ../nextjs
+pnpm audit --prod
+cd ../..
+```
+
+Have the other teammate review the Solidity diff line-by-line, specifically: constructor arguments, immutable addresses, access control, reentrancy/external token calls, `transferFrom` return handling, USDC’s 6-decimal arithmetic, rounding (who receives the dust), zero/self/invalid creator addresses, duplicate/failed transfers, pause/escape-hatch behavior, and every method that can move accumulated fees. Get an independent smart-contract security review before mainnet if any funds can be held or any privileged parameter can change; no automated check replaces this.
+
+Add or confirm tests that assert these invariants, using `1_000_000` as one USDC:
+
+1. `tip(1_000_000)` credits creator `990_000`, fee recipient `10_000`, and never creates or loses USDC.
+2. Amounts below one cent and awkward amounts have a documented, tested rounding rule; the sum of transfers is exactly the input.
+3. A fan cannot tip without enough balance/allowance; a failed call leaves all balances/accounting unchanged.
+4. Only the intended role can change fee/recipient/pause or withdraw; a zero/wrong-token/wrong-recipient configuration reverts.
+5. A malicious ERC-20/reentrant recipient cannot double-spend or alter accounting, if the contract accepts arbitrary tokens/callbacks.
+
+**STOP:** Do not proceed on a compiler warning, skipped/failing test, unreviewed privilege, or a result that requires explaining away. **GO:** clean build/tests/lint/typecheck, reproducible production build, recorded review approval, and no unresolved high/critical finding.
+
+## 2. Make production configuration explicit (never infer localhost)
+
+Use a paid/dedicated Base RPC provider for the application; Base’s public RPC is rate-limited and explicitly not for production. Keep provider API secrets server-side where possible; a browser-visible `NEXT_PUBLIC_*` RPC URL must be a restricted public client endpoint, never an admin key. [Base RPC guidance](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+In `packages/foundry/foundry.toml` (or the repository’s actual Foundry config), add only these named endpoints and verification configuration; do not replace the local endpoint:
+
+```toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+```
+
+Create `packages/foundry/.env.example` and `packages/nextjs/.env.example` with variable *names only*; add the real `.env` files to `.gitignore` and verify they are ignored:
+
+```sh
+git check-ignore -v packages/foundry/.env packages/nextjs/.env
+git grep -nE '(PRIVATE_KEY|mnemonic|0x[0-9a-fA-F]{64})' -- ':!**/.env.example'
+```
+
+Use these values in the deployment operator’s untracked environment, preferably injected by a password manager/CI secret store rather than typed into a file:
+
+```dotenv
+# packages/foundry/.env (untracked)
+BASE_SEPOLIA_RPC_URL=https://YOUR_DEDICATED_BASE_SEPOLIA_RPC
+BASE_MAINNET_RPC_URL=https://YOUR_DEDICATED_BASE_MAINNET_RPC
+BASESCAN_API_KEY=YOUR_KEY
+DEPLOYER_ADDRESS=0xYOUR_DEDICATED_DEPLOYER
+
+# packages/nextjs/.env.production (untracked locally; configure equivalent host env vars)
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=0xSET_ONLY_AFTER_MAINNET_DEPLOYMENT
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_APP_URL=https://APP_DOMAIN
+NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_RESTRICTED_BROWSER_RPC
+```
+
+Import the dedicated deployer key into Foundry’s encrypted keystore interactively; it is stored outside Git:
+
+```sh
+cast wallet import base-mainnet-deployer --interactive
+cast wallet address --account base-mainnet-deployer
+```
+
+Compare the output with `DEPLOYER_ADDRESS`. Fund only that address with a small, pre-agreed amount of ETH **on Base Mainnet** for deployment; do not send any USDC to it. Confirm the chain and balance from the RPC:
+
+```sh
+set -a; source packages/foundry/.env; set +a
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+```
+
+The first output must be `8453`. **GO:** no secret is tracked, the frontend explicitly permits only `base`/8453 (not localhost/default chains), the configured USDC is Circle’s address, and the deployer is funded on Base—not Ethereum.
+
+## 3. Deploy and exercise the exact release on Base Sepolia
+
+Set the testnet token address in the deployment script/config to Circle’s Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is deliberately different from mainnet. Do not use a mock token on this gate. Fund two fresh test wallets with Base Sepolia ETH and test USDC from official faucets.
+
+Make the deploy command match the project’s existing script target. First inspect it and run a dry simulation; do not substitute a guessed script name:
+
+```sh
+cd packages/foundry
+find script -name '*.s.sol' -maxdepth 3 -print
+sed -n '1,240p' script/YOUR_DEPLOY_SCRIPT.s.sol
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer -vvvv
+```
+
+The simulation output must show the Sepolia USDC, intended Safe/test Safe, fee `100`, expected bytecode, and no unexpected transaction. Then broadcast and verify:
+
+```sh
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer \
+  --broadcast --verify -vvvv
+```
+
+Record the Sepolia address and transaction hash. Read every immutable/config getter using the actual ABI signatures from the contract (replace only the names below):
+
+```sh
+export TIP_CONTRACT=0xSEPOLIA_DEPLOYED_ADDRESS
+export TEST_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+cast code "$TIP_CONTRACT" --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_sepolia
+```
+
+Replace getter names to exactly match the source. For each read, compare output with the release record; nonempty bytecode and verified source must be visible in the explorer. Then run the public build against Sepolia (set chain ID `84532`, Sepolia contract and USDC addresses in the hosting preview environment) and perform this browser-wallet acceptance test with a fan wallet and a creator wallet:
+
+1. Connect on Base Sepolia; deliberately choose another chain first and confirm the UI requests a switch and cannot submit.
+2. Confirm displayed token is `USDC`, six-decimal formatted, and its address matches `TEST_USDC` in the wallet/explorer.
+3. Tip exactly `1.00` USDC. If using a separate approval, approve only the requested amount—never an unlimited default—then submit the tip.
+4. From explorer/ERC-20 transfer logs and balances, prove fan decrease is `1,000,000`, creator increase is `990,000`, fee recipient increase is `10,000`, and contract balance/accounting changed exactly as designed.
+5. Repeat with an awkward amount and the documented minimum. Test rejected wallet signature, insufficient balance, insufficient allowance, disconnect/reload during confirmation, and a reverted transaction. The UI must show an actionable error and must not display success or stale balances.
+6. Test each admin/withdrawal/pause action only from the Safe process and verify an unauthorized wallet fails.
+
+**GO:** both people independently complete and sign this acceptance test from the deployed Sepolia app, and the contract source is verified. Fix any finding in source, re-run Sections 1–3 from the new commit.
+
+## 4. Final mainnet preflight (the last reversible point)
+
+Create a production environment in the host (for example Vercel) but do **not** promote it. Add the frontend variables from Section 2, except leave `NEXT_PUBLIC_TIP_CONTRACT_ADDRESS` unset until deployment. Configure `APP_DOMAIN` as the production domain, HTTPS-only, and the dedicated Base RPC. Do not expose deployer, Basescan, Safe signer, or provider admin credentials as `NEXT_PUBLIC_*` variables.
+
+In a clean clone/CI runner at the recorded `GIT_SHA`, rerun:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+```
+
+Re-run the deployment simulation against mainnet, with mainnet config loaded but without `--broadcast`:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+```
+
+The two people must independently inspect the printed calldata/arguments and say “approve” only if all are exact: chain `8453`, Circle Base USDC address, `100` bps, Safe fee recipient/owner, expected deployer nonce/address, and expected contract bytecode. Capture `cast nonce "$DEPLOYER_ADDRESS" --rpc-url base_mainnet` and the simulation gas estimate in the release record. No code/config/nonce change is permitted between this approval and broadcast.
+
+**STOP:** A change requires a new SHA and repetition of Sections 1–4. **GO:** two-person written approval and sufficient Base ETH including a buffer for a replacement transaction.
+
+## 5. Deploy, verify, and prove mainnet configuration
+
+One operator broadcasts while the second watches the terminal and compares values. This is the only broadcast command:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer \
+  --broadcast --verify -vvvv | tee /private/tmp/base-mainnet-deploy-YYYY-MM-DD.log
+```
+
+Record address, transaction hash, block, gas used, compiler version, optimizer/via-IR settings, constructor arguments, and the full log in the release record. Do not fund or advertise the contract yet. Wait until the explorer marks the transaction successful and verification completes. If verification fails, do not redeploy: preserve the address and retry source verification with the exact build settings/artifacts; a second deployment creates a different public contract and needs a new approval.
+
+Read and check code/config via both the dedicated provider and a second independent Base RPC/explorer:
+
+```sh
+export MAINNET_TIP_CONTRACT=0xMAINNET_DEPLOYED_ADDRESS
+export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+cast chain-id --rpc-url base_mainnet
+cast code "$MAINNET_TIP_CONTRACT" --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'usdc()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
+```
+
+Expected values are `8453`, nonempty code, the mainnet USDC address, `100`, the Safe address, and `6`. Also open the verified source and transaction in BaseScan, confirm the deployer and constructor arguments, and ensure the contract is not accidentally paused/owned by the deployer. **GO:** every check matches in two independent views and both people sign the recorded deployed address.
+
+## 6. Ship the frontend with the immutable deployed address
+
+Change the production frontend config/source exactly once to use the recorded mainnet address, `base` (chain ID 8453), and Circle USDC. Update the Scaffold deployment/ABI artifact consumed by the UI as required by this repository; do not hand-copy an ABI unless the project is designed for that. Search for stale local/testnet values before committing:
+
+```sh
+rg -n '31337|localhost|anvil|84532|036CbD53842c5426634e7929541eC2318f3dCF7e|YOUR_' packages/nextjs packages/foundry
+rg -n '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|8453|MAINNET_TIP_CONTRACT' packages/nextjs packages/foundry
+pnpm --dir packages/nextjs lint
+pnpm --dir packages/nextjs typecheck
+pnpm --dir packages/nextjs build
+git diff --check
+git status --short
+git add -A && git commit -m 'chore: configure Base mainnet launch'
+git rev-parse HEAD
+```
+
+The first search must produce no live code path configured to localhost, Anvil, Base Sepolia, placeholder text, or test USDC. A test-only reference is acceptable only if it is excluded from the production bundle. Have the second person review the production diff and inspect the built site’s network configuration in a preview.
+
+Deploy the exact commit to a password-protected/unguessable preview first. With Vercel CLI this is:
+
+```sh
+cd packages/nextjs
+npx vercel link
+npx vercel build
+npx vercel deploy --prebuilt
+```
+
+Alternatively use the Git-connected host’s preview deployment for that exact commit. Configure the host’s production environment variables separately from preview; the command must never substitute `.env.local` secrets into production.
+
+**GO:** Preview is HTTPS, has the correct canonical origin, contains the exact verified address, accepts only Base, has no console/runtime errors, and its deployed bundle has no secrets. Use a fresh browser profile and no development wallet state to check this.
+
+## 7. Controlled mainnet canary, then public production
+
+Before routing the public domain, use two fresh small-value wallets and real Base USDC (only an amount you are willing to lose). In the preview on Base Mainnet, repeat the Section 3 browser-wallet journey with a `1.00` USDC tip. Verify on BaseScan and by `balanceOf` that the fan/creator/Safe deltas are exactly 1,000,000 / 990,000 / 10,000 units. Verify the displayed explorer links point to BaseScan and the UI refreshes only after a confirmed transaction.
+
+If the user must approve USDC, inspect the wallet request: spender must be the verified tip contract, chain must be Base, and approval must be the exact tip amount. If it is unlimited, change the UI to default to exact approval and repeat the test. Confirm that a rejected signature, rejected approval, reverted transaction, wrong network, disconnected RPC, and an RPC rate-limit response all present a safe error without treating the tip as successful.
+
+Only after both teammates sign the canary result, promote the already-tested commit:
+
+```sh
+cd packages/nextjs
+npx vercel --prod
+```
+
+Attach `APP_DOMAIN` in the host dashboard, enforce HTTPS, configure one canonical hostname with redirects, and update `NEXT_PUBLIC_APP_URL` if a redeploy is required. Re-run the canary at the final domain—not merely the provider URL. **GO:** the final domain serves the expected commit, all wallet flows use 8453/the verified contract, and the explorer results prove split settlement.
+
+## 8. Announce only after monitoring is live
+
+Before publishing the URL, set monitoring from an independent uptime service for `https://APP_DOMAIN` and a scripted 8453 RPC health check. Enable frontend error reporting (with transaction hashes and chain IDs, never wallet secrets), configure host build/error alerts for both people, and create a shared runbook contact channel. Watch the verified contract’s `Tip`/fee/withdraw/admin events in BaseScan or an indexer; alert on failed transactions, unexpected configuration events, failed deployments, RPC errors, and a contract USDC balance that is inconsistent with the intended design.
+
+Publish a short public support page that states: “Base Mainnet only”, verified tip-contract address, official USDC address, fees (1%), whether approval is required, what a successful transaction looks like, and support contact. Link the contract through BaseScan. Never ask users for seed phrases, private keys, or token transfers to a support wallet.
+
+For the first 24 hours, check the final domain, RPC health, frontend error rate, and the first real tips at least hourly; reconcile each tip from the transaction logs to the creator and Safe. Reconcile daily thereafter: total fan debits = creator credits + platform fees (+ documented rounding), and investigate any difference before it compounds.
+
+## 9. Incident response and rollback limits
+
+Frontend rollback is possible: immediately redeploy the prior known-good frontend commit, disable new tips in the UI, and publish a status notice. Contract rollback is **not** possible after deployment. If the contract has an audited `pause` function, use the Safe to pause it and verify the pause transaction; do not invent an emergency transaction or change owner keys under pressure. If it has no pause, remove the public UI and warn users while obtaining security advice.
+
+Never deploy a “fixed” replacement and point the UI at it without repeating this entire runbook, verification, and canary. Preserve transaction hashes, screenshots, logs, and balances for incident reconciliation. Rotate any credential that appeared in logs or a public repository immediately, then revoke/restrict the affected RPC/API key in its provider dashboard.
+
+## References used for network constants
+
+- [Base network connection and production-RPC warning](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+- [Circle official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+- [Base Foundry deployment and encrypted-keystore example](https://docs.base.org/get-started/deploy-smart-contracts)
+- [Base’s Foundry verification configuration example](https://docs.base.org/get-started/launch-token)

codex
Created the complete ordered production runbook: [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120619Z-codex-no-skill-2/LAUNCH.md).

It covers secure key setup, Base Sepolia rehearsal, two-person mainnet approval, deployment/verification, frontend configuration, controlled real-USDC canary, monitoring, reconciliation, and incident handling.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..0ee00946d30502e35f329086289cd824eee5c558
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,300 @@
+# Production launch runbook — Base USDC tipping
+
+This is a **gated** release procedure. Complete a numbered section in order and do not continue if its `GO` condition is not met. All commands below are run from the root of the real Scaffold-ETH 2 repository, not from the directory containing this document. Replace values in `ALL_CAPS` exactly once, record them in the release log, and never put a private key in a shell history, `.env*` file tracked by Git, CI log, screenshot, or chat.
+
+The contract is an irreversible financial system. “The local journey works” is not a sufficient production gate: a bad constructor argument, token address, fee recipient, allowance flow, or frontend address can still permanently misdirect real USDC.
+
+## 0. Make the release decision and assign responsibilities
+
+Before touching Base, write and both sign off on this release record (a private issue or password-manager secure note):
+
+| Field | Record |
+| --- | --- |
+| Git commit to ship | `GIT_SHA` |
+| Contract source and fully-qualified deployment target | `CONTRACT_PATH:CONTRACT_NAME` / `SCRIPT_PATH:SCRIPT_NAME` |
+| Contract constructor/init arguments in their on-chain units | `CONSTRUCTOR_ARGS` |
+| Mainnet USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Fee rate | `100` basis points (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` (a 2-of-2 Safe, not either developer’s EOA) |
+| Deployer address | `DEPLOYER_ADDRESS` (a dedicated, single-purpose EOA) |
+| Owner/admin address(es) | `ADMIN_ADDRESS` / Safe address |
+| Public hostname | `APP_DOMAIN` |
+| RPC provider endpoint and dashboard owner | `BASE_MAINNET_RPC_URL` |
+
+Create the Safe first, verify its threshold is 2-of-2 and that both people can see it, then use its address for every privileged owner/fee-recipient value. If the contract has no admin or cannot send/withdraw the fee to the Safe, stop and change/audit the contract before launch. Do not use a personal wallet as a temporary substitute.
+
+**GO:** Both people independently compare the recorded USDC and Safe addresses character-for-character. Circle’s official Base USDC address is the value above; it has 6 decimals. Base Mainnet is chain ID `8453`. [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Base](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+## 1. Freeze and independently review the release candidate
+
+```sh
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+git rev-parse HEAD
+git submodule status
+forge --version
+node --version
+pnpm --version # use npm/yarn here instead only if that is the committed lockfile
+```
+
+`git status --short` must be empty before making the intentional configuration changes below. Pin the current Foundry and Node versions in the release record. Install dependencies strictly from the committed lockfile:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+cd ../..
+```
+
+If this repository uses different package names/scripts, list them first rather than guessing:
+
+```sh
+find . -maxdepth 3 -name package.json -o -name foundry.toml
+pnpm --dir packages/nextjs run
+```
+
+Run static analysis and dependency checks, saving results with the release record:
+
+```sh
+cd packages/foundry
+slither . --exclude-dependencies
+forge fmt --check
+cd ../nextjs
+pnpm audit --prod
+cd ../..
+```
+
+Have the other teammate review the Solidity diff line-by-line, specifically: constructor arguments, immutable addresses, access control, reentrancy/external token calls, `transferFrom` return handling, USDC’s 6-decimal arithmetic, rounding (who receives the dust), zero/self/invalid creator addresses, duplicate/failed transfers, pause/escape-hatch behavior, and every method that can move accumulated fees. Get an independent smart-contract security review before mainnet if any funds can be held or any privileged parameter can change; no automated check replaces this.
+
+Add or confirm tests that assert these invariants, using `1_000_000` as one USDC:
+
+1. `tip(1_000_000)` credits creator `990_000`, fee recipient `10_000`, and never creates or loses USDC.
+2. Amounts below one cent and awkward amounts have a documented, tested rounding rule; the sum of transfers is exactly the input.
+3. A fan cannot tip without enough balance/allowance; a failed call leaves all balances/accounting unchanged.
+4. Only the intended role can change fee/recipient/pause or withdraw; a zero/wrong-token/wrong-recipient configuration reverts.
+5. A malicious ERC-20/reentrant recipient cannot double-spend or alter accounting, if the contract accepts arbitrary tokens/callbacks.
+
+**STOP:** Do not proceed on a compiler warning, skipped/failing test, unreviewed privilege, or a result that requires explaining away. **GO:** clean build/tests/lint/typecheck, reproducible production build, recorded review approval, and no unresolved high/critical finding.
+
+## 2. Make production configuration explicit (never infer localhost)
+
+Use a paid/dedicated Base RPC provider for the application; Base’s public RPC is rate-limited and explicitly not for production. Keep provider API secrets server-side where possible; a browser-visible `NEXT_PUBLIC_*` RPC URL must be a restricted public client endpoint, never an admin key. [Base RPC guidance](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+
+In `packages/foundry/foundry.toml` (or the repository’s actual Foundry config), add only these named endpoints and verification configuration; do not replace the local endpoint:
+
+```toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+```
+
+Create `packages/foundry/.env.example` and `packages/nextjs/.env.example` with variable *names only*; add the real `.env` files to `.gitignore` and verify they are ignored:
+
+```sh
+git check-ignore -v packages/foundry/.env packages/nextjs/.env
+git grep -nE '(PRIVATE_KEY|mnemonic|0x[0-9a-fA-F]{64})' -- ':!**/.env.example'
+```
+
+Use these values in the deployment operator’s untracked environment, preferably injected by a password manager/CI secret store rather than typed into a file:
+
+```dotenv
+# packages/foundry/.env (untracked)
+BASE_SEPOLIA_RPC_URL=https://YOUR_DEDICATED_BASE_SEPOLIA_RPC
+BASE_MAINNET_RPC_URL=https://YOUR_DEDICATED_BASE_MAINNET_RPC
+BASESCAN_API_KEY=YOUR_KEY
+DEPLOYER_ADDRESS=0xYOUR_DEDICATED_DEPLOYER
+
+# packages/nextjs/.env.production (untracked locally; configure equivalent host env vars)
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=0xSET_ONLY_AFTER_MAINNET_DEPLOYMENT
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_APP_URL=https://APP_DOMAIN
+NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_RESTRICTED_BROWSER_RPC
+```
+
+Import the dedicated deployer key into Foundry’s encrypted keystore interactively; it is stored outside Git:
+
+```sh
+cast wallet import base-mainnet-deployer --interactive
+cast wallet address --account base-mainnet-deployer
+```
+
+Compare the output with `DEPLOYER_ADDRESS`. Fund only that address with a small, pre-agreed amount of ETH **on Base Mainnet** for deployment; do not send any USDC to it. Confirm the chain and balance from the RPC:
+
+```sh
+set -a; source packages/foundry/.env; set +a
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+```
+
+The first output must be `8453`. **GO:** no secret is tracked, the frontend explicitly permits only `base`/8453 (not localhost/default chains), the configured USDC is Circle’s address, and the deployer is funded on Base—not Ethereum.
+
+## 3. Deploy and exercise the exact release on Base Sepolia
+
+Set the testnet token address in the deployment script/config to Circle’s Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is deliberately different from mainnet. Do not use a mock token on this gate. Fund two fresh test wallets with Base Sepolia ETH and test USDC from official faucets.
+
+Make the deploy command match the project’s existing script target. First inspect it and run a dry simulation; do not substitute a guessed script name:
+
+```sh
+cd packages/foundry
+find script -name '*.s.sol' -maxdepth 3 -print
+sed -n '1,240p' script/YOUR_DEPLOY_SCRIPT.s.sol
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer -vvvv
+```
+
+The simulation output must show the Sepolia USDC, intended Safe/test Safe, fee `100`, expected bytecode, and no unexpected transaction. Then broadcast and verify:
+
+```sh
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_sepolia --account base-mainnet-deployer \
+  --broadcast --verify -vvvv
+```
+
+Record the Sepolia address and transaction hash. Read every immutable/config getter using the actual ABI signatures from the contract (replace only the names below):
+
+```sh
+export TIP_CONTRACT=0xSEPOLIA_DEPLOYED_ADDRESS
+export TEST_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+cast code "$TIP_CONTRACT" --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_sepolia
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_sepolia
+```
+
+Replace getter names to exactly match the source. For each read, compare output with the release record; nonempty bytecode and verified source must be visible in the explorer. Then run the public build against Sepolia (set chain ID `84532`, Sepolia contract and USDC addresses in the hosting preview environment) and perform this browser-wallet acceptance test with a fan wallet and a creator wallet:
+
+1. Connect on Base Sepolia; deliberately choose another chain first and confirm the UI requests a switch and cannot submit.
+2. Confirm displayed token is `USDC`, six-decimal formatted, and its address matches `TEST_USDC` in the wallet/explorer.
+3. Tip exactly `1.00` USDC. If using a separate approval, approve only the requested amount—never an unlimited default—then submit the tip.
+4. From explorer/ERC-20 transfer logs and balances, prove fan decrease is `1,000,000`, creator increase is `990,000`, fee recipient increase is `10,000`, and contract balance/accounting changed exactly as designed.
+5. Repeat with an awkward amount and the documented minimum. Test rejected wallet signature, insufficient balance, insufficient allowance, disconnect/reload during confirmation, and a reverted transaction. The UI must show an actionable error and must not display success or stale balances.
+6. Test each admin/withdrawal/pause action only from the Safe process and verify an unauthorized wallet fails.
+
+**GO:** both people independently complete and sign this acceptance test from the deployed Sepolia app, and the contract source is verified. Fix any finding in source, re-run Sections 1–3 from the new commit.
+
+## 4. Final mainnet preflight (the last reversible point)
+
+Create a production environment in the host (for example Vercel) but do **not** promote it. Add the frontend variables from Section 2, except leave `NEXT_PUBLIC_TIP_CONTRACT_ADDRESS` unset until deployment. Configure `APP_DOMAIN` as the production domain, HTTPS-only, and the dedicated Base RPC. Do not expose deployer, Basescan, Safe signer, or provider admin credentials as `NEXT_PUBLIC_*` variables.
+
+In a clean clone/CI runner at the recorded `GIT_SHA`, rerun:
+
+```sh
+pnpm install --frozen-lockfile
+cd packages/foundry && forge build --force && forge test -vvv
+cd ../nextjs && pnpm lint && pnpm typecheck && pnpm build
+```
+
+Re-run the deployment simulation against mainnet, with mainnet config loaded but without `--broadcast`:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+```
+
+The two people must independently inspect the printed calldata/arguments and say “approve” only if all are exact: chain `8453`, Circle Base USDC address, `100` bps, Safe fee recipient/owner, expected deployer nonce/address, and expected contract bytecode. Capture `cast nonce "$DEPLOYER_ADDRESS" --rpc-url base_mainnet` and the simulation gas estimate in the release record. No code/config/nonce change is permitted between this approval and broadcast.
+
+**STOP:** A change requires a new SHA and repetition of Sections 1–4. **GO:** two-person written approval and sufficient Base ETH including a buffer for a replacement transaction.
+
+## 5. Deploy, verify, and prove mainnet configuration
+
+One operator broadcasts while the second watches the terminal and compares values. This is the only broadcast command:
+
+```sh
+cd packages/foundry
+set -a; source .env; set +a
+forge script script/YOUR_DEPLOY_SCRIPT.s.sol:YOUR_SCRIPT_NAME \
+  --rpc-url base_mainnet --account base-mainnet-deployer \
+  --broadcast --verify -vvvv | tee /private/tmp/base-mainnet-deploy-YYYY-MM-DD.log
+```
+
+Record address, transaction hash, block, gas used, compiler version, optimizer/via-IR settings, constructor arguments, and the full log in the release record. Do not fund or advertise the contract yet. Wait until the explorer marks the transaction successful and verification completes. If verification fails, do not redeploy: preserve the address and retry source verification with the exact build settings/artifacts; a second deployment creates a different public contract and needs a new approval.
+
+Read and check code/config via both the dedicated provider and a second independent Base RPC/explorer:
+
+```sh
+export MAINNET_TIP_CONTRACT=0xMAINNET_DEPLOYED_ADDRESS
+export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+cast chain-id --rpc-url base_mainnet
+cast code "$MAINNET_TIP_CONTRACT" --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'usdc()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url base_mainnet
+cast call "$MAINNET_TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url base_mainnet
+cast call "$MAINNET_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
+```
+
+Expected values are `8453`, nonempty code, the mainnet USDC address, `100`, the Safe address, and `6`. Also open the verified source and transaction in BaseScan, confirm the deployer and constructor arguments, and ensure the contract is not accidentally paused/owned by the deployer. **GO:** every check matches in two independent views and both people sign the recorded deployed address.
+
+## 6. Ship the frontend with the immutable deployed address
+
+Change the production frontend config/source exactly once to use the recorded mainnet address, `base` (chain ID 8453), and Circle USDC. Update the Scaffold deployment/ABI artifact consumed by the UI as required by this repository; do not hand-copy an ABI unless the project is designed for that. Search for stale local/testnet values before committing:
+
+```sh
+rg -n '31337|localhost|anvil|84532|036CbD53842c5426634e7929541eC2318f3dCF7e|YOUR_' packages/nextjs packages/foundry
+rg -n '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|8453|MAINNET_TIP_CONTRACT' packages/nextjs packages/foundry
+pnpm --dir packages/nextjs lint
+pnpm --dir packages/nextjs typecheck
+pnpm --dir packages/nextjs build
+git diff --check
+git status --short
+git add -A && git commit -m 'chore: configure Base mainnet launch'
+git rev-parse HEAD
+```
+
+The first search must produce no live code path configured to localhost, Anvil, Base Sepolia, placeholder text, or test USDC. A test-only reference is acceptable only if it is excluded from the production bundle. Have the second person review the production diff and inspect the built site’s network configuration in a preview.
+
+Deploy the exact commit to a password-protected/unguessable preview first. With Vercel CLI this is:
+
+```sh
+cd packages/nextjs
+npx vercel link
+npx vercel build
+npx vercel deploy --prebuilt
+```
+
+Alternatively use the Git-connected host’s preview deployment for that exact commit. Configure the host’s production environment variables separately from preview; the command must never substitute `.env.local` secrets into production.
+
+**GO:** Preview is HTTPS, has the correct canonical origin, contains the exact verified address, accepts only Base, has no console/runtime errors, and its deployed bundle has no secrets. Use a fresh browser profile and no development wallet state to check this.
+
+## 7. Controlled mainnet canary, then public production
+
+Before routing the public domain, use two fresh small-value wallets and real Base USDC (only an amount you are willing to lose). In the preview on Base Mainnet, repeat the Section 3 browser-wallet journey with a `1.00` USDC tip. Verify on BaseScan and by `balanceOf` that the fan/creator/Safe deltas are exactly 1,000,000 / 990,000 / 10,000 units. Verify the displayed explorer links point to BaseScan and the UI refreshes only after a confirmed transaction.
+
+If the user must approve USDC, inspect the wallet request: spender must be the verified tip contract, chain must be Base, and approval must be the exact tip amount. If it is unlimited, change the UI to default to exact approval and repeat the test. Confirm that a rejected signature, rejected approval, reverted transaction, wrong network, disconnected RPC, and an RPC rate-limit response all present a safe error without treating the tip as successful.
+
+Only after both teammates sign the canary result, promote the already-tested commit:
+
+```sh
+cd packages/nextjs
+npx vercel --prod
+```
+
+Attach `APP_DOMAIN` in the host dashboard, enforce HTTPS, configure one canonical hostname with redirects, and update `NEXT_PUBLIC_APP_URL` if a redeploy is required. Re-run the canary at the final domain—not merely the provider URL. **GO:** the final domain serves the expected commit, all wallet flows use 8453/the verified contract, and the explorer results prove split settlement.
+
+## 8. Announce only after monitoring is live
+
+Before publishing the URL, set monitoring from an independent uptime service for `https://APP_DOMAIN` and a scripted 8453 RPC health check. Enable frontend error reporting (with transaction hashes and chain IDs, never wallet secrets), configure host build/error alerts for both people, and create a shared runbook contact channel. Watch the verified contract’s `Tip`/fee/withdraw/admin events in BaseScan or an indexer; alert on failed transactions, unexpected configuration events, failed deployments, RPC errors, and a contract USDC balance that is inconsistent with the intended design.
+
+Publish a short public support page that states: “Base Mainnet only”, verified tip-contract address, official USDC address, fees (1%), whether approval is required, what a successful transaction looks like, and support contact. Link the contract through BaseScan. Never ask users for seed phrases, private keys, or token transfers to a support wallet.
+
+For the first 24 hours, check the final domain, RPC health, frontend error rate, and the first real tips at least hourly; reconcile each tip from the transaction logs to the creator and Safe. Reconcile daily thereafter: total fan debits = creator credits + platform fees (+ documented rounding), and investigate any difference before it compounds.
+
+## 9. Incident response and rollback limits
+
+Frontend rollback is possible: immediately redeploy the prior known-good frontend commit, disable new tips in the UI, and publish a status notice. Contract rollback is **not** possible after deployment. If the contract has an audited `pause` function, use the Safe to pause it and verify the pause transaction; do not invent an emergency transaction or change owner keys under pressure. If it has no pause, remove the public UI and warn users while obtaining security advice.
+
+Never deploy a “fixed” replacement and point the UI at it without repeating this entire runbook, verification, and canary. Preserve transaction hashes, screenshots, logs, and balances for incident reconciliation. Rotate any credential that appeared in logs or a public repository immediately, then revoke/restrict the affected RPC/API key in its provider dashboard.
+
+## References used for network constants
+
+- [Base network connection and production-RPC warning](https://docs.base.org/base-chain/quickstart/connecting-to-base)
+- [Circle official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
+- [Base Foundry deployment and encrypted-keystore example](https://docs.base.org/get-started/deploy-smart-contracts)
+- [Base’s Foundry verification configuration example](https://docs.base.org/get-started/launch-token)

tokens used
65 524
````

## final message

Created the complete ordered production runbook: [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120619Z-codex-no-skill-2/LAUNCH.md).

It covers secure key setup, Base Sepolia rehearsal, two-person mainnet approval, deployment/verification, frontend configuration, controlled real-USDC canary, monitoring, reconciliation, and incident handling.
