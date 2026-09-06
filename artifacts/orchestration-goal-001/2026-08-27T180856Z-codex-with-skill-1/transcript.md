# Executor transcript — 2026-08-27T180856Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04469-505d-7790-a20d-998df2f1ebb9
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
I’m using the deployment-orchestration guidance because this is the point where the dApp leaves localhost. I’ll turn your current local-fork state into a production runbook with gated checks and rollback-aware sequencing.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001
 succeeded in 6ms:
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,260p' package.json; find . -maxdepth 3 -type f -not -path './.git/*' -not -path './.agents/*' -print | sort" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
{
  "name": "eval-workspace",
  "private": true
}
./TASK.md
./package.json

web search: 
web search: site:docs.scaffoldeth.io Scaffold-ETH 2 Foundry deploy base yarn deploy verify ...
web search: 
web search: site:docs.scaffoldeth.io Scaffold-ETH 2 Foundry deploy base yarn deploy verify ...
codex
The directory only contains the task scaffold rather than the application repository, so the runbook will use the standard Scaffold-ETH 2 Foundry layout and explicitly flag the few project-specific values that must be filled from the actual checkout before any transaction is signed.
apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..b8ae6fc24f01d2d5db38da23e162a4691053d187
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,385 @@
+# Base Mainnet launch runbook — USDC creator tipping
+
+This runbook starts from a working Scaffold-ETH 2 **Foundry** project whose full
+flow already works against a local Base fork.  It deliberately has two release
+boundaries:
+
+1. Deploy and validate the immutable contracts on Base mainnet while the web
+   app is still private on `localhost`.
+2. Only after a real-wallet, real-USDC walkthrough succeeds, publish the
+   frontend.
+
+Do not combine those boundaries.  A public frontend pointed at an unvalidated
+mainnet contract is a production incident waiting to happen.
+
+## 0. Assign roles and freeze the release candidate
+
+One person is the **deployer**: they alone handle the deployer key and sign
+the deployment.  The other is the **release verifier**: they independently
+perform the user walkthrough and approve the public frontend release.  Both
+must approve each gate below.
+
+In a fresh clone of the exact commit intended for release:
+
+```bash
+git status --short
+git rev-parse HEAD
+yarn install --immutable
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn lint
+yarn build
+```
+
+If this project does not define one of `lint` or `build`, use the equivalent
+script shown by `yarn run`; do not silently skip its check.  Record the commit
+SHA in the release notes and tag it only after all checks pass:
+
+```bash
+git tag -a vYYYY.MM.DD.1 -m "Base mainnet launch"
+git push origin vYYYY.MM.DD.1
+```
+
+**Go/no-go:** the working tree is clean; every test, lint, and production build
+passes from this commit.  A failure stops the launch.  Fix it, add a regression
+test where applicable, and repeat this section.
+
+## 1. Complete the launch worksheet before funding anything
+
+Create a private, access-controlled release note (never commit it) containing
+these exact values.  Two people should independently read back the addresses.
+
+| Item | Required value / check |
+| --- | --- |
+| Target network | `base`, chain ID `8453` |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Contract constructor/initializer arguments | Exact recipients, fee recipient, token address, and any owner/admin address |
+| Platform fee | `100` basis points (1%); document the contract's fee denominator and rounding rule |
+| Deployer | A new, dedicated EOA or hardware-wallet address — not a personal daily-use wallet |
+| Operational owner/fee recipient | Separate address or multisig, if the contract supports it |
+| RPC URL | A dedicated Base-mainnet HTTPS RPC, held only in ignored local env files / host secrets |
+| Explorer | `https://basescan.org` |
+| Frontend host/project | The production hosting project and its protected environment settings |
+| Release test accounts | One funded tester wallet plus a creator-recipient wallet controlled by the team |
+
+For the USDC address, verify on BaseScan that it is a contract and reports
+six decimals.  Do not accept a token address copied from a search ad, a wallet
+UI, or another chain.  Also write down the expected recipient amount for a
+test tip: for a `10.00 USDC` tip, with a 1% fee and whole-atomic-unit rounding,
+the expected fee is `0.10 USDC` and recipient amount is `9.90 USDC`.
+
+Inspect the contract and deployment script together.  Confirm, in writing:
+
+- USDC is passed/stored as the worksheet's Base address and all frontend
+  amounts use **6** decimals (not 18).
+- The fee is exactly 100 bps, cannot accidentally exceed the intended cap, and
+  the fee recipient is the worksheet address.
+- `tip` handles USDC's `transferFrom` result safely (for example via
+  OpenZeppelin `SafeERC20`), validates zero/invalid inputs, and cannot be
+  reentered around token movement/accounting.
+- The deployer cannot change user funds or fee terms unexpectedly.  If there
+  are admin functions, the owner and transfer/renounce process are understood;
+  do not deploy until the intended operational owner is available.
+- Events contain sufficient fields to reconcile tipper, creator, gross amount,
+  fee, and net amount.  The frontend waits for a successful receipt and shows
+  failed/rejected transactions accurately.
+- The deployment script uses the Base USDC address and production recipients
+  explicitly—never a localhost mock, an Anvil account, or a `31337` address.
+
+**Go/no-go:** both people agree on every worksheet item and the contract review
+matches it.  Any ambiguity about owner powers, rounding, or token handling is
+a contract change: return to Section 0 rather than trying to solve it in the
+frontend.
+
+## 2. Make the production configuration safe and explicit
+
+From the repository root, inspect the actual scripts and configuration before
+editing.  These commands prevent guessing at a project-specific file name:
+
+```bash
+yarn run
+rg -n "base|mainnet|DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|rpcOverrides|walletClient|USDC|usdc|31337|localhost" \
+  packages/foundry packages/nextjs package.json yarn.lock
+sed -n '1,240p' packages/nextjs/scaffold.config.ts
+sed -n '1,260p' packages/foundry/foundry.toml
+```
+
+Make these configuration changes in the release commit:
+
+1. In `packages/nextjs/scaffold.config.ts`, include `base` in `targetNetworks`
+   and set `defaultNetwork`/`targetNetworks` so the production build reads Base
+   (`base.id === 8453`), not `localhost` or `hardhat`.  Preserve test networks
+   only if the UI makes their status unmistakable.
+2. Keep RPC credentials out of the committed config.  If the config needs an
+   override, use `process.env.NEXT_PUBLIC_BASE_RPC_URL`; put its value in
+   `packages/nextjs/.env.local` locally and in the hosting provider's
+   environment settings.  A public `NEXT_PUBLIC_*` RPC URL is acceptable only
+   if it is intended to be public and is rate/domain restricted; a deployer key
+   never is.
+3. Ensure the frontend's external contract map uses the canonical USDC address
+   above for Base.  Make no address change to generated deployed-contract data
+   yet—that must be generated by the actual Base deployment.
+4. Ensure the UI rejects the wrong chain before rendering a payable action and
+   offers a switch to Base.  It must use `parseUnits(value, 6)` (or the USDC
+   contract's queried decimals), not `parseEther`.
+5. In `packages/foundry/.env` (ignored by git), set only the variables the
+   repository's config/script actually reads.  A typical Foundry flavor needs:
+
+   ```dotenv
+   DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+   BASE_RPC_URL=https://<dedicated-base-mainnet-rpc>
+   ```
+
+   Do not paste the key in a terminal command, shell history, chat, committed
+   `.env.example`, `scaffold.config.ts`, or a frontend/hosting variable.  Set
+   file permissions and confirm it is ignored:
+
+   ```bash
+   chmod 600 packages/foundry/.env
+   git check-ignore -v packages/foundry/.env
+   git diff --check
+   git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/contracts
+   ```
+
+**Go/no-go:** the diff contains no secret; the frontend production config
+selects chain 8453; no payable flow can submit on 31337; and all Base USDC
+references are canonical.  If `git check-ignore` prints nothing, stop: the
+secret file is not safely ignored.
+
+## 3. Rehearse the exact release candidate on a Base fork
+
+Start a fork in terminal A from the repository root:
+
+```bash
+yarn fork --network base
+```
+
+The `--network` flag is required; `yarn fork base` can silently use the wrong
+network.  In terminal B, prove this is a Base fork despite Anvil reporting
+chain ID 31337:
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
+```
+
+The first command must return non-empty code and the second must return `6`.
+Then run the deployment and frontend locally against that fork using the
+repository's normal commands (in a standard Foundry SE-2 checkout these are):
+
+```bash
+yarn deploy --network localhost
+yarn start
+```
+
+Use two browser wallets/accounts and a fork-funded USDC holder as appropriate.
+Walk every production-relevant path: connect, wrong-network recovery, enter
+`10.00`, approve the exact requested USDC amount, tip, wait for confirmation,
+and inspect balances/events.  Test rejection in the wallet, insufficient USDC,
+insufficient allowance, a zero/invalid amount, and a second tip after an
+existing allowance.  Confirm the displayed gross/fee/net figures equal the
+contract's 6-decimal arithmetic.
+
+**Go/no-go:** the production deployment script runs clean on a Base fork and
+every happy and failure path is correct.  A mismatch in value, fee, recipients,
+chain, or event is a stop-ship contract/frontend defect—fix, test, and restart
+at Section 0.
+
+## 4. Rehearse the operational procedure on Base Sepolia
+
+This step is strongly recommended because it exposes hardware-wallet, RPC,
+explorer, and hosting configuration errors without putting money at risk.
+
+Change only environment values to use an explicitly named `baseSepolia` network
+already defined by this version of the project; do not rename Base mainnet's
+`base` entry.  Fund the dedicated deployer with Base Sepolia ETH, deploy, and
+verify using the repository's discovered commands:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Point a local frontend at the resulting Sepolia address, perform a full wallet
+flow, and then restore the production config before committing.  Do not use a
+testnet deployment address in any Base mainnet config.
+
+**Go/no-go:** the team can sign, deploy, verify, switch the wallet's network,
+and use the app on an external chain.  Failure here is cheap practice, not a
+reason to skip the mainnet gate.
+
+## 5. Fund and preflight the Base-mainnet deployer
+
+Use the wallet/hardware wallet to reveal the dedicated deployer address without
+revealing its key.  Send a small, deliberate amount of Base ETH sufficient for
+deployment, verification retry, and an emergency owner-transfer transaction;
+use current gas estimates from the chosen RPC/wallet rather than a fixed value.
+Never send USDC to the deployer unless the deployment script specifically
+requires it.
+
+In the actual release checkout, with its private `.env` loaded as its scripts
+expect, check identity, network, balance, and USDC code:
+
+```bash
+cd packages/foundry
+cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY"
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast balance "$(cast wallet address --private-key \"$DEPLOYER_PRIVATE_KEY\")" --rpc-url "$BASE_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Expected chain ID is `8453`, the shown account is the worksheet deployer, the
+ETH balance is non-zero and adequate, and USDC code is non-empty.  If your
+shell does not load `packages/foundry/.env`, export values only in the current
+private shell session or use the project's documented env loader; never place
+the key after `--private-key` in shell history.
+
+**Go/no-go:** all four expected values match the worksheet.  A wrong chain ID,
+wrong address, empty code, or low balance means stop and correct configuration
+or funding; do not “try a deployment” to see what happens.
+
+## 6. Deploy to Base mainnet, then verify immediately
+
+Stop local dev processes that might be watching or overwriting generated
+contract files.  From the same checked-out commit and terminal whose broadcast
+artifacts will remain intact:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+The second command must run immediately from the same checkout: Scaffold-ETH
+Foundry verification reuses `packages/foundry/broadcast/run-latest.json`.
+Do not regenerate, delete, or copy that broadcast file between the two commands.
+
+Record the transaction hash and deployed contract address printed by the deploy
+command.  Independently validate before touching the frontend:
+
+```bash
+cd packages/foundry
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_USDC>()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_BPS>()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_RECIPIENT>()(address)" --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Replace the three ABI signatures with the contract's actual public getter
+signatures before launch (for example, `usdc()(address)`, `platformFeeBps()(uint256)`,
+and `feeRecipient()(address)`).  Compare every returned value with the
+worksheet.  On BaseScan, confirm the transaction succeeded, source code and
+constructor arguments are verified, compiler settings match, and the contract
+address is the address generated into the frontend's deployed-contract data.
+
+If verification fails due to explorer indexing, wait for indexing and rerun
+only `yarn verify --network base` from this same checkout.  If bytecode,
+constructor arguments, or any getter differs, **do not publish**.  Immutable
+contract bytecode cannot be patched: determine whether the deployment is
+unusable, fix source/tests, then redeploy and record the new address.
+
+**Go/no-go:** successful deployment, verified source, and independent on-chain
+getter checks all match.  The Base contract is live but the app remains private.
+
+## 7. Point a localhost frontend at the live contract and perform a paid acceptance test
+
+Commit the generated Base address data produced by `yarn deploy --network base`
+(typically under `packages/nextjs/contracts/deployedContracts.ts`) along with
+the reviewed Base configuration.  Inspect the diff: it must contain the actual
+Base contract address and chain ID `8453`, not localhost/31337 addresses.
+
+Run the production-mode frontend locally, not a development-only build:
+
+```bash
+yarn workspace nextjs build
+yarn workspace nextjs start
+```
+
+If the workspace name differs, use the root script discovered in Section 2
+(often `yarn next:build` / `yarn next:start`); the non-negotiable requirement
+is a production build served locally with the Base configuration.
+
+Using a real browser wallet on Base and a team-controlled creator address:
+
+1. Connect the tester wallet. Confirm the UI shows Base mainnet and the exact
+   verified tipping-contract address (provide an Explorer link in the UI or
+   inspect its network call/config).
+2. Give the tester wallet only `1–10 USDC` for this acceptance test plus a
+   small Base ETH balance. Ensure no old unlimited USDC approval exists.
+3. Submit a `10.00 USDC` tip (or another amount in that range). Inspect the
+   wallet confirmation: spender must be the verified tipping contract; token
+   must be canonical Base USDC; approval must be the exact tip amount or a
+   clearly intentional, reviewed policy—never an accidental unlimited approval.
+4. Wait for both transaction receipts. On BaseScan, confirm successful USDC
+   transfers/events and verify balances: tipper decreases by gross; fee
+   recipient receives exactly 1%; creator receives the remainder.  Verify the
+   app's transaction status and displayed amounts agree.
+5. Refresh, reconnect, switch temporarily to a wrong network and back, and
+   repeat a small tip to test allowance reuse and state refresh.  Reject one
+   transaction in the wallet and confirm the UI never reports it as successful.
+
+Save transaction hashes, screenshots, and the expected/actual accounting in
+the private release note.
+
+**Go/no-go:** a real user journey with real money works from the private
+production build, including correct 6-decimal accounting and error states.
+Any mismatch means leave the public site offline, diagnose from transaction
+hashes, and restart at the relevant earlier section.  A frontend guard is not
+a remedy for an on-chain defect.
+
+## 8. Publish the frontend only after the acceptance gate
+
+Put only non-secret client configuration in the hosting provider's Production
+environment—at minimum the intended public, rate-limited Base RPC URL if the
+project requires it.  Put no deployer key, Foundry `.env`, or admin credential
+there.  Set the custom domain only after its HTTPS certificate and DNS are
+ready.  Use the host's preview deployment first and repeat the connect/wrong
+network/read-only checks there.
+
+From the approved, tagged commit, deploy with the repository's configured host
+command.  For a typical Vercel-connected Scaffold-ETH checkout, this is either
+a production Git deployment from the tagged commit or:
+
+```bash
+yarn workspace nextjs vercel --prod
+```
+
+Do not run a guessed host command.  First use `yarn run` and the host project
+settings to identify the actual production command.  Require a deployment
+preview/URL tied to the recorded commit SHA.
+
+Before announcing the URL, use a fresh browser profile and a mobile wallet if
+supported to check: HTTPS/custom domain, wallet connection, chain switching,
+contract address, no console/runtime errors, correct USDC decimals, readable
+transaction links, and no secret in downloaded JavaScript or page source.
+Then put one final small Base-USDC tip through the **public URL** and reconcile
+it as in Section 7.
+
+**Go/no-go:** the public URL serves the approved SHA and its final live
+transaction succeeds with correct accounting.  Only now announce the app.
+
+## 9. First-week operations and incident response
+
+For the first 24 hours, both teammates monitor BaseScan events, failed user
+reports, RPC/hosting errors, and fee/creator balance reconciliation.  Reconcile
+each tip's gross, fee, and net from events/transfers at least daily for the
+first week.  Keep the verified contract address, deployment transaction, ABI,
+release SHA, owner address, and acceptance-test hashes in the release note.
+
+If the frontend is wrong but contracts are safe, immediately disable payable
+controls or unpublish/roll back the frontend to the last known-safe frontend;
+state clearly that the contracts remain on Base.  Then reproduce against the
+live address, fix, test on a Base fork, deploy a preview, and repeat Sections
+7–8.
+
+If an immutable-contract defect puts funds or accounting at risk, stop
+directing users to the contract immediately (unpublish/disable the UI and post
+a status notice), assess whether any built-in pause/owner control is safe and
+documented, and do not improvise privileged calls.  The permanent fix is:
+reproduce, correct source, add a regression test, deploy a new verified
+contract (or execute the pre-reviewed proxy upgrade), migrate/communicate as
+needed, repoint the frontend, and repeat the entire private-live and public
+acceptance sequence.  A frontend-only validation does not fix a public smart
+contract API.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..b8ae6fc24f01d2d5db38da23e162a4691053d187
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,385 @@
+# Base Mainnet launch runbook — USDC creator tipping
+
+This runbook starts from a working Scaffold-ETH 2 **Foundry** project whose full
+flow already works against a local Base fork.  It deliberately has two release
+boundaries:
+
+1. Deploy and validate the immutable contracts on Base mainnet while the web
+   app is still private on `localhost`.
+2. Only after a real-wallet, real-USDC walkthrough succeeds, publish the
+   frontend.
+
+Do not combine those boundaries.  A public frontend pointed at an unvalidated
+mainnet contract is a production incident waiting to happen.
+
+## 0. Assign roles and freeze the release candidate
+
+One person is the **deployer**: they alone handle the deployer key and sign
+the deployment.  The other is the **release verifier**: they independently
+perform the user walkthrough and approve the public frontend release.  Both
+must approve each gate below.
+
+In a fresh clone of the exact commit intended for release:
+
+```bash
+git status --short
+git rev-parse HEAD
+yarn install --immutable
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn lint
+yarn build
+```
+
+If this project does not define one of `lint` or `build`, use the equivalent
+script shown by `yarn run`; do not silently skip its check.  Record the commit
+SHA in the release notes and tag it only after all checks pass:
+
+```bash
+git tag -a vYYYY.MM.DD.1 -m "Base mainnet launch"
+git push origin vYYYY.MM.DD.1
+```
+
+**Go/no-go:** the working tree is clean; every test, lint, and production build
+passes from this commit.  A failure stops the launch.  Fix it, add a regression
+test where applicable, and repeat this section.
+
+## 1. Complete the launch worksheet before funding anything
+
+Create a private, access-controlled release note (never commit it) containing
+these exact values.  Two people should independently read back the addresses.
+
+| Item | Required value / check |
+| --- | --- |
+| Target network | `base`, chain ID `8453` |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Contract constructor/initializer arguments | Exact recipients, fee recipient, token address, and any owner/admin address |
+| Platform fee | `100` basis points (1%); document the contract's fee denominator and rounding rule |
+| Deployer | A new, dedicated EOA or hardware-wallet address — not a personal daily-use wallet |
+| Operational owner/fee recipient | Separate address or multisig, if the contract supports it |
+| RPC URL | A dedicated Base-mainnet HTTPS RPC, held only in ignored local env files / host secrets |
+| Explorer | `https://basescan.org` |
+| Frontend host/project | The production hosting project and its protected environment settings |
+| Release test accounts | One funded tester wallet plus a creator-recipient wallet controlled by the team |
+
+For the USDC address, verify on BaseScan that it is a contract and reports
+six decimals.  Do not accept a token address copied from a search ad, a wallet
+UI, or another chain.  Also write down the expected recipient amount for a
+test tip: for a `10.00 USDC` tip, with a 1% fee and whole-atomic-unit rounding,
+the expected fee is `0.10 USDC` and recipient amount is `9.90 USDC`.
+
+Inspect the contract and deployment script together.  Confirm, in writing:
+
+- USDC is passed/stored as the worksheet's Base address and all frontend
+  amounts use **6** decimals (not 18).
+- The fee is exactly 100 bps, cannot accidentally exceed the intended cap, and
+  the fee recipient is the worksheet address.
+- `tip` handles USDC's `transferFrom` result safely (for example via
+  OpenZeppelin `SafeERC20`), validates zero/invalid inputs, and cannot be
+  reentered around token movement/accounting.
+- The deployer cannot change user funds or fee terms unexpectedly.  If there
+  are admin functions, the owner and transfer/renounce process are understood;
+  do not deploy until the intended operational owner is available.
+- Events contain sufficient fields to reconcile tipper, creator, gross amount,
+  fee, and net amount.  The frontend waits for a successful receipt and shows
+  failed/rejected transactions accurately.
+- The deployment script uses the Base USDC address and production recipients
+  explicitly—never a localhost mock, an Anvil account, or a `31337` address.
+
+**Go/no-go:** both people agree on every worksheet item and the contract review
+matches it.  Any ambiguity about owner powers, rounding, or token handling is
+a contract change: return to Section 0 rather than trying to solve it in the
+frontend.
+
+## 2. Make the production configuration safe and explicit
+
+From the repository root, inspect the actual scripts and configuration before
+editing.  These commands prevent guessing at a project-specific file name:
+
+```bash
+yarn run
+rg -n "base|mainnet|DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|rpcOverrides|walletClient|USDC|usdc|31337|localhost" \
+  packages/foundry packages/nextjs package.json yarn.lock
+sed -n '1,240p' packages/nextjs/scaffold.config.ts
+sed -n '1,260p' packages/foundry/foundry.toml
+```
+
+Make these configuration changes in the release commit:
+
+1. In `packages/nextjs/scaffold.config.ts`, include `base` in `targetNetworks`
+   and set `defaultNetwork`/`targetNetworks` so the production build reads Base
+   (`base.id === 8453`), not `localhost` or `hardhat`.  Preserve test networks
+   only if the UI makes their status unmistakable.
+2. Keep RPC credentials out of the committed config.  If the config needs an
+   override, use `process.env.NEXT_PUBLIC_BASE_RPC_URL`; put its value in
+   `packages/nextjs/.env.local` locally and in the hosting provider's
+   environment settings.  A public `NEXT_PUBLIC_*` RPC URL is acceptable only
+   if it is intended to be public and is rate/domain restricted; a deployer key
+   never is.
+3. Ensure the frontend's external contract map uses the canonical USDC address
+   above for Base.  Make no address change to generated deployed-contract data
+   yet—that must be generated by the actual Base deployment.
+4. Ensure the UI rejects the wrong chain before rendering a payable action and
+   offers a switch to Base.  It must use `parseUnits(value, 6)` (or the USDC
+   contract's queried decimals), not `parseEther`.
+5. In `packages/foundry/.env` (ignored by git), set only the variables the
+   repository's config/script actually reads.  A typical Foundry flavor needs:
+
+   ```dotenv
+   DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+   BASE_RPC_URL=https://<dedicated-base-mainnet-rpc>
+   ```
+
+   Do not paste the key in a terminal command, shell history, chat, committed
+   `.env.example`, `scaffold.config.ts`, or a frontend/hosting variable.  Set
+   file permissions and confirm it is ignored:
+
+   ```bash
+   chmod 600 packages/foundry/.env
+   git check-ignore -v packages/foundry/.env
+   git diff --check
+   git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/contracts
+   ```
+
+**Go/no-go:** the diff contains no secret; the frontend production config
+selects chain 8453; no payable flow can submit on 31337; and all Base USDC
+references are canonical.  If `git check-ignore` prints nothing, stop: the
+secret file is not safely ignored.
+
+## 3. Rehearse the exact release candidate on a Base fork
+
+Start a fork in terminal A from the repository root:
+
+```bash
+yarn fork --network base
+```
+
+The `--network` flag is required; `yarn fork base` can silently use the wrong
+network.  In terminal B, prove this is a Base fork despite Anvil reporting
+chain ID 31337:
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
+```
+
+The first command must return non-empty code and the second must return `6`.
+Then run the deployment and frontend locally against that fork using the
+repository's normal commands (in a standard Foundry SE-2 checkout these are):
+
+```bash
+yarn deploy --network localhost
+yarn start
+```
+
+Use two browser wallets/accounts and a fork-funded USDC holder as appropriate.
+Walk every production-relevant path: connect, wrong-network recovery, enter
+`10.00`, approve the exact requested USDC amount, tip, wait for confirmation,
+and inspect balances/events.  Test rejection in the wallet, insufficient USDC,
+insufficient allowance, a zero/invalid amount, and a second tip after an
+existing allowance.  Confirm the displayed gross/fee/net figures equal the
+contract's 6-decimal arithmetic.
+
+**Go/no-go:** the production deployment script runs clean on a Base fork and
+every happy and failure path is correct.  A mismatch in value, fee, recipients,
+chain, or event is a stop-ship contract/frontend defect—fix, test, and restart
+at Section 0.
+
+## 4. Rehearse the operational procedure on Base Sepolia
+
+This step is strongly recommended because it exposes hardware-wallet, RPC,
+explorer, and hosting configuration errors without putting money at risk.
+
+Change only environment values to use an explicitly named `baseSepolia` network
+already defined by this version of the project; do not rename Base mainnet's
+`base` entry.  Fund the dedicated deployer with Base Sepolia ETH, deploy, and
+verify using the repository's discovered commands:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Point a local frontend at the resulting Sepolia address, perform a full wallet
+flow, and then restore the production config before committing.  Do not use a
+testnet deployment address in any Base mainnet config.
+
+**Go/no-go:** the team can sign, deploy, verify, switch the wallet's network,
+and use the app on an external chain.  Failure here is cheap practice, not a
+reason to skip the mainnet gate.
+
+## 5. Fund and preflight the Base-mainnet deployer
+
+Use the wallet/hardware wallet to reveal the dedicated deployer address without
+revealing its key.  Send a small, deliberate amount of Base ETH sufficient for
+deployment, verification retry, and an emergency owner-transfer transaction;
+use current gas estimates from the chosen RPC/wallet rather than a fixed value.
+Never send USDC to the deployer unless the deployment script specifically
+requires it.
+
+In the actual release checkout, with its private `.env` loaded as its scripts
+expect, check identity, network, balance, and USDC code:
+
+```bash
+cd packages/foundry
+cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY"
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast balance "$(cast wallet address --private-key \"$DEPLOYER_PRIVATE_KEY\")" --rpc-url "$BASE_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Expected chain ID is `8453`, the shown account is the worksheet deployer, the
+ETH balance is non-zero and adequate, and USDC code is non-empty.  If your
+shell does not load `packages/foundry/.env`, export values only in the current
+private shell session or use the project's documented env loader; never place
+the key after `--private-key` in shell history.
+
+**Go/no-go:** all four expected values match the worksheet.  A wrong chain ID,
+wrong address, empty code, or low balance means stop and correct configuration
+or funding; do not “try a deployment” to see what happens.
+
+## 6. Deploy to Base mainnet, then verify immediately
+
+Stop local dev processes that might be watching or overwriting generated
+contract files.  From the same checked-out commit and terminal whose broadcast
+artifacts will remain intact:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+The second command must run immediately from the same checkout: Scaffold-ETH
+Foundry verification reuses `packages/foundry/broadcast/run-latest.json`.
+Do not regenerate, delete, or copy that broadcast file between the two commands.
+
+Record the transaction hash and deployed contract address printed by the deploy
+command.  Independently validate before touching the frontend:
+
+```bash
+cd packages/foundry
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_USDC>()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_BPS>()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_RECIPIENT>()(address)" --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Replace the three ABI signatures with the contract's actual public getter
+signatures before launch (for example, `usdc()(address)`, `platformFeeBps()(uint256)`,
+and `feeRecipient()(address)`).  Compare every returned value with the
+worksheet.  On BaseScan, confirm the transaction succeeded, source code and
+constructor arguments are verified, compiler settings match, and the contract
+address is the address generated into the frontend's deployed-contract data.
+
+If verification fails due to explorer indexing, wait for indexing and rerun
+only `yarn verify --network base` from this same checkout.  If bytecode,
+constructor arguments, or any getter differs, **do not publish**.  Immutable
+contract bytecode cannot be patched: determine whether the deployment is
+unusable, fix source/tests, then redeploy and record the new address.
+
+**Go/no-go:** successful deployment, verified source, and independent on-chain
+getter checks all match.  The Base contract is live but the app remains private.
+
+## 7. Point a localhost frontend at the live contract and perform a paid acceptance test
+
+Commit the generated Base address data produced by `yarn deploy --network base`
+(typically under `packages/nextjs/contracts/deployedContracts.ts`) along with
+the reviewed Base configuration.  Inspect the diff: it must contain the actual
+Base contract address and chain ID `8453`, not localhost/31337 addresses.
+
+Run the production-mode frontend locally, not a development-only build:
+
+```bash
+yarn workspace nextjs build
+yarn workspace nextjs start
+```
+
+If the workspace name differs, use the root script discovered in Section 2
+(often `yarn next:build` / `yarn next:start`); the non-negotiable requirement
+is a production build served locally with the Base configuration.
+
+Using a real browser wallet on Base and a team-controlled creator address:
+
+1. Connect the tester wallet. Confirm the UI shows Base mainnet and the exact
+   verified tipping-contract address (provide an Explorer link in the UI or
+   inspect its network call/config).
+2. Give the tester wallet only `1–10 USDC` for this acceptance test plus a
+   small Base ETH balance. Ensure no old unlimited USDC approval exists.
+3. Submit a `10.00 USDC` tip (or another amount in that range). Inspect the
+   wallet confirmation: spender must be the verified tipping contract; token
+   must be canonical Base USDC; approval must be the exact tip amount or a
+   clearly intentional, reviewed policy—never an accidental unlimited approval.
+4. Wait for both transaction receipts. On BaseScan, confirm successful USDC
+   transfers/events and verify balances: tipper decreases by gross; fee
+   recipient receives exactly 1%; creator receives the remainder.  Verify the
+   app's transaction status and displayed amounts agree.
+5. Refresh, reconnect, switch temporarily to a wrong network and back, and
+   repeat a small tip to test allowance reuse and state refresh.  Reject one
+   transaction in the wallet and confirm the UI never reports it as successful.
+
+Save transaction hashes, screenshots, and the expected/actual accounting in
+the private release note.
+
+**Go/no-go:** a real user journey with real money works from the private
+production build, including correct 6-decimal accounting and error states.
+Any mismatch means leave the public site offline, diagnose from transaction
+hashes, and restart at the relevant earlier section.  A frontend guard is not
+a remedy for an on-chain defect.
+
+## 8. Publish the frontend only after the acceptance gate
+
+Put only non-secret client configuration in the hosting provider's Production
+environment—at minimum the intended public, rate-limited Base RPC URL if the
+project requires it.  Put no deployer key, Foundry `.env`, or admin credential
+there.  Set the custom domain only after its HTTPS certificate and DNS are
+ready.  Use the host's preview deployment first and repeat the connect/wrong
+network/read-only checks there.
+
+From the approved, tagged commit, deploy with the repository's configured host
+command.  For a typical Vercel-connected Scaffold-ETH checkout, this is either
+a production Git deployment from the tagged commit or:
+
+```bash
+yarn workspace nextjs vercel --prod
+```
+
+Do not run a guessed host command.  First use `yarn run` and the host project
+settings to identify the actual production command.  Require a deployment
+preview/URL tied to the recorded commit SHA.
+
+Before announcing the URL, use a fresh browser profile and a mobile wallet if
+supported to check: HTTPS/custom domain, wallet connection, chain switching,
+contract address, no console/runtime errors, correct USDC decimals, readable
+transaction links, and no secret in downloaded JavaScript or page source.
+Then put one final small Base-USDC tip through the **public URL** and reconcile
+it as in Section 7.
+
+**Go/no-go:** the public URL serves the approved SHA and its final live
+transaction succeeds with correct accounting.  Only now announce the app.
+
+## 9. First-week operations and incident response
+
+For the first 24 hours, both teammates monitor BaseScan events, failed user
+reports, RPC/hosting errors, and fee/creator balance reconciliation.  Reconcile
+each tip's gross, fee, and net from events/transfers at least daily for the
+first week.  Keep the verified contract address, deployment transaction, ABI,
+release SHA, owner address, and acceptance-test hashes in the release note.
+
+If the frontend is wrong but contracts are safe, immediately disable payable
+controls or unpublish/roll back the frontend to the last known-safe frontend;
+state clearly that the contracts remain on Base.  Then reproduce against the
+live address, fix, test on a Base fork, deploy a preview, and repeat Sections
+7–8.
+
+If an immutable-contract defect puts funds or accounting at risk, stop
+directing users to the contract immediately (unpublish/disable the UI and post
+a status notice), assess whether any built-in pause/owner control is safe and
+documented, and do not improvise privileged calls.  The permanent fix is:
+reproduce, correct source, add a regression test, deploy a new verified
+contract (or execute the pre-reviewed proxy upgrade), migrate/communicate as
+needed, repoint the frontend, and repeat the entire private-live and public
+acceptance sequence.  A frontend-only validation does not fix a public smart
+contract API.

apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9a2e151410f775add52be1c90c4e47214fa20b7
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,386 @@
+# Base Mainnet launch runbook — USDC creator tipping
+
+This runbook starts from a working Scaffold-ETH 2 **Foundry** project whose full
+flow already works against a local Base fork.  It deliberately has two release
+boundaries:
+
+1. Deploy and validate the immutable contracts on Base mainnet while the web
+   app is still private on `localhost`.
+2. Only after a real-wallet, real-USDC walkthrough succeeds, publish the
+   frontend.
+
+Do not combine those boundaries.  A public frontend pointed at an unvalidated
+mainnet contract is a production incident waiting to happen.
+
+## 0. Assign roles and freeze the release candidate
+
+One person is the **deployer**: they alone handle the deployer key and sign
+the deployment.  The other is the **release verifier**: they independently
+perform the user walkthrough and approve the public frontend release.  Both
+must approve each gate below.
+
+In a fresh clone of the exact commit intended for release:
+
+```bash
+git status --short
+git rev-parse HEAD
+yarn install --immutable
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn lint
+yarn build
+```
+
+If this project does not define one of `lint` or `build`, use the equivalent
+script shown by `yarn run`; do not silently skip its check.  Record the commit
+SHA in the release notes and tag it only after all checks pass:
+
+```bash
+git tag -a vYYYY.MM.DD.1 -m "Base mainnet launch"
+git push origin vYYYY.MM.DD.1
+```
+
+**Go/no-go:** the working tree is clean; every test, lint, and production build
+passes from this commit.  A failure stops the launch.  Fix it, add a regression
+test where applicable, and repeat this section.
+
+## 1. Complete the launch worksheet before funding anything
+
+Create a private, access-controlled release note (never commit it) containing
+these exact values.  Two people should independently read back the addresses.
+
+| Item | Required value / check |
+| --- | --- |
+| Target network | `base`, chain ID `8453` |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Contract constructor/initializer arguments | Exact recipients, fee recipient, token address, and any owner/admin address |
+| Platform fee | `100` basis points (1%); document the contract's fee denominator and rounding rule |
+| Deployer | A new, dedicated EOA or hardware-wallet address — not a personal daily-use wallet |
+| Operational owner/fee recipient | Separate address or multisig, if the contract supports it |
+| RPC URL | A dedicated Base-mainnet HTTPS RPC, held only in ignored local env files / host secrets |
+| Explorer | `https://basescan.org` |
+| Frontend host/project | The production hosting project and its protected environment settings |
+| Release test accounts | One funded tester wallet plus a creator-recipient wallet controlled by the team |
+
+For the USDC address, verify on BaseScan that it is a contract and reports
+six decimals.  Do not accept a token address copied from a search ad, a wallet
+UI, or another chain.  Also write down the expected recipient amount for a
+test tip: for a `10.00 USDC` tip, with a 1% fee and whole-atomic-unit rounding,
+the expected fee is `0.10 USDC` and recipient amount is `9.90 USDC`.
+
+Inspect the contract and deployment script together.  Confirm, in writing:
+
+- USDC is passed/stored as the worksheet's Base address and all frontend
+  amounts use **6** decimals (not 18).
+- The fee is exactly 100 bps, cannot accidentally exceed the intended cap, and
+  the fee recipient is the worksheet address.
+- `tip` handles USDC's `transferFrom` result safely (for example via
+  OpenZeppelin `SafeERC20`), validates zero/invalid inputs, and cannot be
+  reentered around token movement/accounting.
+- The deployer cannot change user funds or fee terms unexpectedly.  If there
+  are admin functions, the owner and transfer/renounce process are understood;
+  do not deploy until the intended operational owner is available.
+- Events contain sufficient fields to reconcile tipper, creator, gross amount,
+  fee, and net amount.  The frontend waits for a successful receipt and shows
+  failed/rejected transactions accurately.
+- The deployment script uses the Base USDC address and production recipients
+  explicitly—never a localhost mock, an Anvil account, or a `31337` address.
+
+**Go/no-go:** both people agree on every worksheet item and the contract review
+matches it.  Any ambiguity about owner powers, rounding, or token handling is
+a contract change: return to Section 0 rather than trying to solve it in the
+frontend.
+
+## 2. Make the production configuration safe and explicit
+
+From the repository root, inspect the actual scripts and configuration before
+editing.  These commands prevent guessing at a project-specific file name:
+
+```bash
+yarn run
+rg -n "base|mainnet|DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|rpcOverrides|walletClient|USDC|usdc|31337|localhost" \
+  packages/foundry packages/nextjs package.json yarn.lock
+sed -n '1,240p' packages/nextjs/scaffold.config.ts
+sed -n '1,260p' packages/foundry/foundry.toml
+```
+
+Make these configuration changes in the release commit:
+
+1. In `packages/nextjs/scaffold.config.ts`, include `base` in `targetNetworks`
+   and set `defaultNetwork`/`targetNetworks` so the production build reads Base
+   (`base.id === 8453`), not `localhost` or `hardhat`.  Preserve test networks
+   only if the UI makes their status unmistakable.
+2. Keep RPC credentials out of the committed config.  If the config needs an
+   override, use `process.env.NEXT_PUBLIC_BASE_RPC_URL`; put its value in
+   `packages/nextjs/.env.local` locally and in the hosting provider's
+   environment settings.  A public `NEXT_PUBLIC_*` RPC URL is acceptable only
+   if it is intended to be public and is rate/domain restricted; a deployer key
+   never is.
+3. Ensure the frontend's external contract map uses the canonical USDC address
+   above for Base.  Make no address change to generated deployed-contract data
+   yet—that must be generated by the actual Base deployment.
+4. Ensure the UI rejects the wrong chain before rendering a payable action and
+   offers a switch to Base.  It must use `parseUnits(value, 6)` (or the USDC
+   contract's queried decimals), not `parseEther`.
+5. In `packages/foundry/.env` (ignored by git), set only the variables the
+   repository's config/script actually reads.  A typical Foundry flavor needs:
+
+   ```dotenv
+   DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+   BASE_RPC_URL=https://<dedicated-base-mainnet-rpc>
+   ```
+
+   Do not paste the key in a terminal command, shell history, chat, committed
+   `.env.example`, `scaffold.config.ts`, or a frontend/hosting variable.  Set
+   file permissions and confirm it is ignored:
+
+   ```bash
+   chmod 600 packages/foundry/.env
+   git check-ignore -v packages/foundry/.env
+   git diff --check
+   git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/contracts
+   ```
+
+**Go/no-go:** the diff contains no secret; the frontend production config
+selects chain 8453; no payable flow can submit on 31337; and all Base USDC
+references are canonical.  If `git check-ignore` prints nothing, stop: the
+secret file is not safely ignored.
+
+## 3. Rehearse the exact release candidate on a Base fork
+
+Start a fork in terminal A from the repository root:
+
+```bash
+yarn fork --network base
+```
+
+The `--network` flag is required; `yarn fork base` can silently use the wrong
+network.  In terminal B, prove this is a Base fork despite Anvil reporting
+chain ID 31337:
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
+```
+
+The first command must return non-empty code and the second must return `6`.
+Then run the deployment and frontend locally against that fork using the
+repository's normal commands (in a standard Foundry SE-2 checkout these are):
+
+```bash
+yarn deploy --network localhost
+yarn start
+```
+
+Use two browser wallets/accounts and a fork-funded USDC holder as appropriate.
+Walk every production-relevant path: connect, wrong-network recovery, enter
+`10.00`, approve the exact requested USDC amount, tip, wait for confirmation,
+and inspect balances/events.  Test rejection in the wallet, insufficient USDC,
+insufficient allowance, a zero/invalid amount, and a second tip after an
+existing allowance.  Confirm the displayed gross/fee/net figures equal the
+contract's 6-decimal arithmetic.
+
+**Go/no-go:** the production deployment script runs clean on a Base fork and
+every happy and failure path is correct.  A mismatch in value, fee, recipients,
+chain, or event is a stop-ship contract/frontend defect—fix, test, and restart
+at Section 0.
+
+## 4. Rehearse the operational procedure on Base Sepolia
+
+This step is strongly recommended because it exposes hardware-wallet, RPC,
+explorer, and hosting configuration errors without putting money at risk.
+
+Change only environment values to use an explicitly named `baseSepolia` network
+already defined by this version of the project; do not rename Base mainnet's
+`base` entry.  Fund the dedicated deployer with Base Sepolia ETH, deploy, and
+verify using the repository's discovered commands:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Point a local frontend at the resulting Sepolia address, perform a full wallet
+flow, and then restore the production config before committing.  Do not use a
+testnet deployment address in any Base mainnet config.
+
+**Go/no-go:** the team can sign, deploy, verify, switch the wallet's network,
+and use the app on an external chain.  Failure here is cheap practice, not a
+reason to skip the mainnet gate.
+
+## 5. Fund and preflight the Base-mainnet deployer
+
+Use the wallet/hardware wallet to reveal the dedicated deployer address without
+revealing its key.  Send a small, deliberate amount of Base ETH sufficient for
+deployment, verification retry, and an emergency owner-transfer transaction;
+use current gas estimates from the chosen RPC/wallet rather than a fixed value.
+Never send USDC to the deployer unless the deployment script specifically
+requires it.
+
+In the actual release checkout, with its private `.env` loaded as its scripts
+expect, check identity, network, balance, and USDC code:
+
+```bash
+cd packages/foundry
+DEPLOYER_ADDRESS=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
+printf '%s\n' "$DEPLOYER_ADDRESS"
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Expected chain ID is `8453`, the shown account is the worksheet deployer, the
+ETH balance is non-zero and adequate, and USDC code is non-empty.  If your
+shell does not load `packages/foundry/.env`, export values only in the current
+private shell session or use the project's documented env loader; never place
+the key after `--private-key` in shell history.
+
+**Go/no-go:** all four expected values match the worksheet.  A wrong chain ID,
+wrong address, empty code, or low balance means stop and correct configuration
+or funding; do not “try a deployment” to see what happens.
+
+## 6. Deploy to Base mainnet, then verify immediately
+
+Stop local dev processes that might be watching or overwriting generated
+contract files.  From the same checked-out commit and terminal whose broadcast
+artifacts will remain intact:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+The second command must run immediately from the same checkout: Scaffold-ETH
+Foundry verification reuses `packages/foundry/broadcast/run-latest.json`.
+Do not regenerate, delete, or copy that broadcast file between the two commands.
+
+Record the transaction hash and deployed contract address printed by the deploy
+command.  Independently validate before touching the frontend:
+
+```bash
+cd packages/foundry
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_USDC>()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_BPS>()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_RECIPIENT>()(address)" --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Replace the three ABI signatures with the contract's actual public getter
+signatures before launch (for example, `usdc()(address)`, `platformFeeBps()(uint256)`,
+and `feeRecipient()(address)`).  Compare every returned value with the
+worksheet.  On BaseScan, confirm the transaction succeeded, source code and
+constructor arguments are verified, compiler settings match, and the contract
+address is the address generated into the frontend's deployed-contract data.
+
+If verification fails due to explorer indexing, wait for indexing and rerun
+only `yarn verify --network base` from this same checkout.  If bytecode,
+constructor arguments, or any getter differs, **do not publish**.  Immutable
+contract bytecode cannot be patched: determine whether the deployment is
+unusable, fix source/tests, then redeploy and record the new address.
+
+**Go/no-go:** successful deployment, verified source, and independent on-chain
+getter checks all match.  The Base contract is live but the app remains private.
+
+## 7. Point a localhost frontend at the live contract and perform a paid acceptance test
+
+Commit the generated Base address data produced by `yarn deploy --network base`
+(typically under `packages/nextjs/contracts/deployedContracts.ts`) along with
+the reviewed Base configuration.  Inspect the diff: it must contain the actual
+Base contract address and chain ID `8453`, not localhost/31337 addresses.
+
+Run the production-mode frontend locally, not a development-only build:
+
+```bash
+yarn workspace nextjs build
+yarn workspace nextjs start
+```
+
+If the workspace name differs, use the root script discovered in Section 2
+(often `yarn next:build` / `yarn next:start`); the non-negotiable requirement
+is a production build served locally with the Base configuration.
+
+Using a real browser wallet on Base and a team-controlled creator address:
+
+1. Connect the tester wallet. Confirm the UI shows Base mainnet and the exact
+   verified tipping-contract address (provide an Explorer link in the UI or
+   inspect its network call/config).
+2. Give the tester wallet only `1–10 USDC` for this acceptance test plus a
+   small Base ETH balance. Ensure no old unlimited USDC approval exists.
+3. Submit a `10.00 USDC` tip (or another amount in that range). Inspect the
+   wallet confirmation: spender must be the verified tipping contract; token
+   must be canonical Base USDC; approval must be the exact tip amount or a
+   clearly intentional, reviewed policy—never an accidental unlimited approval.
+4. Wait for both transaction receipts. On BaseScan, confirm successful USDC
+   transfers/events and verify balances: tipper decreases by gross; fee
+   recipient receives exactly 1%; creator receives the remainder.  Verify the
+   app's transaction status and displayed amounts agree.
+5. Refresh, reconnect, switch temporarily to a wrong network and back, and
+   repeat a small tip to test allowance reuse and state refresh.  Reject one
+   transaction in the wallet and confirm the UI never reports it as successful.
+
+Save transaction hashes, screenshots, and the expected/actual accounting in
+the private release note.
+
+**Go/no-go:** a real user journey with real money works from the private
+production build, including correct 6-decimal accounting and error states.
+Any mismatch means leave the public site offline, diagnose from transaction
+hashes, and restart at the relevant earlier section.  A frontend guard is not
+a remedy for an on-chain defect.
+
+## 8. Publish the frontend only after the acceptance gate
+
+Put only non-secret client configuration in the hosting provider's Production
+environment—at minimum the intended public, rate-limited Base RPC URL if the
+project requires it.  Put no deployer key, Foundry `.env`, or admin credential
+there.  Set the custom domain only after its HTTPS certificate and DNS are
+ready.  Use the host's preview deployment first and repeat the connect/wrong
+network/read-only checks there.
+
+From the approved, tagged commit, deploy with the repository's configured host
+command.  For a typical Vercel-connected Scaffold-ETH checkout, this is either
+a production Git deployment from the tagged commit or:
+
+```bash
+yarn workspace nextjs vercel --prod
+```
+
+Do not run a guessed host command.  First use `yarn run` and the host project
+settings to identify the actual production command.  Require a deployment
+preview/URL tied to the recorded commit SHA.
+
+Before announcing the URL, use a fresh browser profile and a mobile wallet if
+supported to check: HTTPS/custom domain, wallet connection, chain switching,
+contract address, no console/runtime errors, correct USDC decimals, readable
+transaction links, and no secret in downloaded JavaScript or page source.
+Then put one final small Base-USDC tip through the **public URL** and reconcile
+it as in Section 7.
+
+**Go/no-go:** the public URL serves the approved SHA and its final live
+transaction succeeds with correct accounting.  Only now announce the app.
+
+## 9. First-week operations and incident response
+
+For the first 24 hours, both teammates monitor BaseScan events, failed user
+reports, RPC/hosting errors, and fee/creator balance reconciliation.  Reconcile
+each tip's gross, fee, and net from events/transfers at least daily for the
+first week.  Keep the verified contract address, deployment transaction, ABI,
+release SHA, owner address, and acceptance-test hashes in the release note.
+
+If the frontend is wrong but contracts are safe, immediately disable payable
+controls or unpublish/roll back the frontend to the last known-safe frontend;
+state clearly that the contracts remain on Base.  Then reproduce against the
+live address, fix, test on a Base fork, deploy a preview, and repeat Sections
+7–8.
+
+If an immutable-contract defect puts funds or accounting at risk, stop
+directing users to the contract immediately (unpublish/disable the UI and post
+a status notice), assess whether any built-in pause/owner control is safe and
+documented, and do not improvise privileged calls.  The permanent fix is:
+reproduce, correct source, add a regression test, deploy a new verified
+contract (or execute the pre-reviewed proxy upgrade), migrate/communicate as
+needed, repoint the frontend, and repeat the entire private-live and public
+acceptance sequence.  A frontend-only validation does not fix a public smart
+contract API.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9a2e151410f775add52be1c90c4e47214fa20b7
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,386 @@
+# Base Mainnet launch runbook — USDC creator tipping
+
+This runbook starts from a working Scaffold-ETH 2 **Foundry** project whose full
+flow already works against a local Base fork.  It deliberately has two release
+boundaries:
+
+1. Deploy and validate the immutable contracts on Base mainnet while the web
+   app is still private on `localhost`.
+2. Only after a real-wallet, real-USDC walkthrough succeeds, publish the
+   frontend.
+
+Do not combine those boundaries.  A public frontend pointed at an unvalidated
+mainnet contract is a production incident waiting to happen.
+
+## 0. Assign roles and freeze the release candidate
+
+One person is the **deployer**: they alone handle the deployer key and sign
+the deployment.  The other is the **release verifier**: they independently
+perform the user walkthrough and approve the public frontend release.  Both
+must approve each gate below.
+
+In a fresh clone of the exact commit intended for release:
+
+```bash
+git status --short
+git rev-parse HEAD
+yarn install --immutable
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn lint
+yarn build
+```
+
+If this project does not define one of `lint` or `build`, use the equivalent
+script shown by `yarn run`; do not silently skip its check.  Record the commit
+SHA in the release notes and tag it only after all checks pass:
+
+```bash
+git tag -a vYYYY.MM.DD.1 -m "Base mainnet launch"
+git push origin vYYYY.MM.DD.1
+```
+
+**Go/no-go:** the working tree is clean; every test, lint, and production build
+passes from this commit.  A failure stops the launch.  Fix it, add a regression
+test where applicable, and repeat this section.
+
+## 1. Complete the launch worksheet before funding anything
+
+Create a private, access-controlled release note (never commit it) containing
+these exact values.  Two people should independently read back the addresses.
+
+| Item | Required value / check |
+| --- | --- |
+| Target network | `base`, chain ID `8453` |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Contract constructor/initializer arguments | Exact recipients, fee recipient, token address, and any owner/admin address |
+| Platform fee | `100` basis points (1%); document the contract's fee denominator and rounding rule |
+| Deployer | A new, dedicated EOA or hardware-wallet address — not a personal daily-use wallet |
+| Operational owner/fee recipient | Separate address or multisig, if the contract supports it |
+| RPC URL | A dedicated Base-mainnet HTTPS RPC, held only in ignored local env files / host secrets |
+| Explorer | `https://basescan.org` |
+| Frontend host/project | The production hosting project and its protected environment settings |
+| Release test accounts | One funded tester wallet plus a creator-recipient wallet controlled by the team |
+
+For the USDC address, verify on BaseScan that it is a contract and reports
+six decimals.  Do not accept a token address copied from a search ad, a wallet
+UI, or another chain.  Also write down the expected recipient amount for a
+test tip: for a `10.00 USDC` tip, with a 1% fee and whole-atomic-unit rounding,
+the expected fee is `0.10 USDC` and recipient amount is `9.90 USDC`.
+
+Inspect the contract and deployment script together.  Confirm, in writing:
+
+- USDC is passed/stored as the worksheet's Base address and all frontend
+  amounts use **6** decimals (not 18).
+- The fee is exactly 100 bps, cannot accidentally exceed the intended cap, and
+  the fee recipient is the worksheet address.
+- `tip` handles USDC's `transferFrom` result safely (for example via
+  OpenZeppelin `SafeERC20`), validates zero/invalid inputs, and cannot be
+  reentered around token movement/accounting.
+- The deployer cannot change user funds or fee terms unexpectedly.  If there
+  are admin functions, the owner and transfer/renounce process are understood;
+  do not deploy until the intended operational owner is available.
+- Events contain sufficient fields to reconcile tipper, creator, gross amount,
+  fee, and net amount.  The frontend waits for a successful receipt and shows
+  failed/rejected transactions accurately.
+- The deployment script uses the Base USDC address and production recipients
+  explicitly—never a localhost mock, an Anvil account, or a `31337` address.
+
+**Go/no-go:** both people agree on every worksheet item and the contract review
+matches it.  Any ambiguity about owner powers, rounding, or token handling is
+a contract change: return to Section 0 rather than trying to solve it in the
+frontend.
+
+## 2. Make the production configuration safe and explicit
+
+From the repository root, inspect the actual scripts and configuration before
+editing.  These commands prevent guessing at a project-specific file name:
+
+```bash
+yarn run
+rg -n "base|mainnet|DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|rpcOverrides|walletClient|USDC|usdc|31337|localhost" \
+  packages/foundry packages/nextjs package.json yarn.lock
+sed -n '1,240p' packages/nextjs/scaffold.config.ts
+sed -n '1,260p' packages/foundry/foundry.toml
+```
+
+Make these configuration changes in the release commit:
+
+1. In `packages/nextjs/scaffold.config.ts`, include `base` in `targetNetworks`
+   and set `defaultNetwork`/`targetNetworks` so the production build reads Base
+   (`base.id === 8453`), not `localhost` or `hardhat`.  Preserve test networks
+   only if the UI makes their status unmistakable.
+2. Keep RPC credentials out of the committed config.  If the config needs an
+   override, use `process.env.NEXT_PUBLIC_BASE_RPC_URL`; put its value in
+   `packages/nextjs/.env.local` locally and in the hosting provider's
+   environment settings.  A public `NEXT_PUBLIC_*` RPC URL is acceptable only
+   if it is intended to be public and is rate/domain restricted; a deployer key
+   never is.
+3. Ensure the frontend's external contract map uses the canonical USDC address
+   above for Base.  Make no address change to generated deployed-contract data
+   yet—that must be generated by the actual Base deployment.
+4. Ensure the UI rejects the wrong chain before rendering a payable action and
+   offers a switch to Base.  It must use `parseUnits(value, 6)` (or the USDC
+   contract's queried decimals), not `parseEther`.
+5. In `packages/foundry/.env` (ignored by git), set only the variables the
+   repository's config/script actually reads.  A typical Foundry flavor needs:
+
+   ```dotenv
+   DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+   BASE_RPC_URL=https://<dedicated-base-mainnet-rpc>
+   ```
+
+   Do not paste the key in a terminal command, shell history, chat, committed
+   `.env.example`, `scaffold.config.ts`, or a frontend/hosting variable.  Set
+   file permissions and confirm it is ignored:
+
+   ```bash
+   chmod 600 packages/foundry/.env
+   git check-ignore -v packages/foundry/.env
+   git diff --check
+   git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/contracts
+   ```
+
+**Go/no-go:** the diff contains no secret; the frontend production config
+selects chain 8453; no payable flow can submit on 31337; and all Base USDC
+references are canonical.  If `git check-ignore` prints nothing, stop: the
+secret file is not safely ignored.
+
+## 3. Rehearse the exact release candidate on a Base fork
+
+Start a fork in terminal A from the repository root:
+
+```bash
+yarn fork --network base
+```
+
+The `--network` flag is required; `yarn fork base` can silently use the wrong
+network.  In terminal B, prove this is a Base fork despite Anvil reporting
+chain ID 31337:
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
+```
+
+The first command must return non-empty code and the second must return `6`.
+Then run the deployment and frontend locally against that fork using the
+repository's normal commands (in a standard Foundry SE-2 checkout these are):
+
+```bash
+yarn deploy --network localhost
+yarn start
+```
+
+Use two browser wallets/accounts and a fork-funded USDC holder as appropriate.
+Walk every production-relevant path: connect, wrong-network recovery, enter
+`10.00`, approve the exact requested USDC amount, tip, wait for confirmation,
+and inspect balances/events.  Test rejection in the wallet, insufficient USDC,
+insufficient allowance, a zero/invalid amount, and a second tip after an
+existing allowance.  Confirm the displayed gross/fee/net figures equal the
+contract's 6-decimal arithmetic.
+
+**Go/no-go:** the production deployment script runs clean on a Base fork and
+every happy and failure path is correct.  A mismatch in value, fee, recipients,
+chain, or event is a stop-ship contract/frontend defect—fix, test, and restart
+at Section 0.
+
+## 4. Rehearse the operational procedure on Base Sepolia
+
+This step is strongly recommended because it exposes hardware-wallet, RPC,
+explorer, and hosting configuration errors without putting money at risk.
+
+Change only environment values to use an explicitly named `baseSepolia` network
+already defined by this version of the project; do not rename Base mainnet's
+`base` entry.  Fund the dedicated deployer with Base Sepolia ETH, deploy, and
+verify using the repository's discovered commands:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Point a local frontend at the resulting Sepolia address, perform a full wallet
+flow, and then restore the production config before committing.  Do not use a
+testnet deployment address in any Base mainnet config.
+
+**Go/no-go:** the team can sign, deploy, verify, switch the wallet's network,
+and use the app on an external chain.  Failure here is cheap practice, not a
+reason to skip the mainnet gate.
+
+## 5. Fund and preflight the Base-mainnet deployer
+
+Use the wallet/hardware wallet to reveal the dedicated deployer address without
+revealing its key.  Send a small, deliberate amount of Base ETH sufficient for
+deployment, verification retry, and an emergency owner-transfer transaction;
+use current gas estimates from the chosen RPC/wallet rather than a fixed value.
+Never send USDC to the deployer unless the deployment script specifically
+requires it.
+
+In the actual release checkout, with its private `.env` loaded as its scripts
+expect, check identity, network, balance, and USDC code:
+
+```bash
+cd packages/foundry
+DEPLOYER_ADDRESS=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
+printf '%s\n' "$DEPLOYER_ADDRESS"
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Expected chain ID is `8453`, the shown account is the worksheet deployer, the
+ETH balance is non-zero and adequate, and USDC code is non-empty.  If your
+shell does not load `packages/foundry/.env`, export values only in the current
+private shell session or use the project's documented env loader; never place
+the key after `--private-key` in shell history.
+
+**Go/no-go:** all four expected values match the worksheet.  A wrong chain ID,
+wrong address, empty code, or low balance means stop and correct configuration
+or funding; do not “try a deployment” to see what happens.
+
+## 6. Deploy to Base mainnet, then verify immediately
+
+Stop local dev processes that might be watching or overwriting generated
+contract files.  From the same checked-out commit and terminal whose broadcast
+artifacts will remain intact:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+The second command must run immediately from the same checkout: Scaffold-ETH
+Foundry verification reuses `packages/foundry/broadcast/run-latest.json`.
+Do not regenerate, delete, or copy that broadcast file between the two commands.
+
+Record the transaction hash and deployed contract address printed by the deploy
+command.  Independently validate before touching the frontend:
+
+```bash
+cd packages/foundry
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_USDC>()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_BPS>()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_RECIPIENT>()(address)" --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Replace the three ABI signatures with the contract's actual public getter
+signatures before launch (for example, `usdc()(address)`, `platformFeeBps()(uint256)`,
+and `feeRecipient()(address)`).  Compare every returned value with the
+worksheet.  On BaseScan, confirm the transaction succeeded, source code and
+constructor arguments are verified, compiler settings match, and the contract
+address is the address generated into the frontend's deployed-contract data.
+
+If verification fails due to explorer indexing, wait for indexing and rerun
+only `yarn verify --network base` from this same checkout.  If bytecode,
+constructor arguments, or any getter differs, **do not publish**.  Immutable
+contract bytecode cannot be patched: determine whether the deployment is
+unusable, fix source/tests, then redeploy and record the new address.
+
+**Go/no-go:** successful deployment, verified source, and independent on-chain
+getter checks all match.  The Base contract is live but the app remains private.
+
+## 7. Point a localhost frontend at the live contract and perform a paid acceptance test
+
+Commit the generated Base address data produced by `yarn deploy --network base`
+(typically under `packages/nextjs/contracts/deployedContracts.ts`) along with
+the reviewed Base configuration.  Inspect the diff: it must contain the actual
+Base contract address and chain ID `8453`, not localhost/31337 addresses.
+
+Run the production-mode frontend locally, not a development-only build:
+
+```bash
+yarn workspace nextjs build
+yarn workspace nextjs start
+```
+
+If the workspace name differs, use the root script discovered in Section 2
+(often `yarn next:build` / `yarn next:start`); the non-negotiable requirement
+is a production build served locally with the Base configuration.
+
+Using a real browser wallet on Base and a team-controlled creator address:
+
+1. Connect the tester wallet. Confirm the UI shows Base mainnet and the exact
+   verified tipping-contract address (provide an Explorer link in the UI or
+   inspect its network call/config).
+2. Give the tester wallet only `1–10 USDC` for this acceptance test plus a
+   small Base ETH balance. Ensure no old unlimited USDC approval exists.
+3. Submit a `10.00 USDC` tip (or another amount in that range). Inspect the
+   wallet confirmation: spender must be the verified tipping contract; token
+   must be canonical Base USDC; approval must be the exact tip amount or a
+   clearly intentional, reviewed policy—never an accidental unlimited approval.
+4. Wait for both transaction receipts. On BaseScan, confirm successful USDC
+   transfers/events and verify balances: tipper decreases by gross; fee
+   recipient receives exactly 1%; creator receives the remainder.  Verify the
+   app's transaction status and displayed amounts agree.
+5. Refresh, reconnect, switch temporarily to a wrong network and back, and
+   repeat a small tip to test allowance reuse and state refresh.  Reject one
+   transaction in the wallet and confirm the UI never reports it as successful.
+
+Save transaction hashes, screenshots, and the expected/actual accounting in
+the private release note.
+
+**Go/no-go:** a real user journey with real money works from the private
+production build, including correct 6-decimal accounting and error states.
+Any mismatch means leave the public site offline, diagnose from transaction
+hashes, and restart at the relevant earlier section.  A frontend guard is not
+a remedy for an on-chain defect.
+
+## 8. Publish the frontend only after the acceptance gate
+
+Put only non-secret client configuration in the hosting provider's Production
+environment—at minimum the intended public, rate-limited Base RPC URL if the
+project requires it.  Put no deployer key, Foundry `.env`, or admin credential
+there.  Set the custom domain only after its HTTPS certificate and DNS are
+ready.  Use the host's preview deployment first and repeat the connect/wrong
+network/read-only checks there.
+
+From the approved, tagged commit, deploy with the repository's configured host
+command.  For a typical Vercel-connected Scaffold-ETH checkout, this is either
+a production Git deployment from the tagged commit or:
+
+```bash
+yarn workspace nextjs vercel --prod
+```
+
+Do not run a guessed host command.  First use `yarn run` and the host project
+settings to identify the actual production command.  Require a deployment
+preview/URL tied to the recorded commit SHA.
+
+Before announcing the URL, use a fresh browser profile and a mobile wallet if
+supported to check: HTTPS/custom domain, wallet connection, chain switching,
+contract address, no console/runtime errors, correct USDC decimals, readable
+transaction links, and no secret in downloaded JavaScript or page source.
+Then put one final small Base-USDC tip through the **public URL** and reconcile
+it as in Section 7.
+
+**Go/no-go:** the public URL serves the approved SHA and its final live
+transaction succeeds with correct accounting.  Only now announce the app.
+
+## 9. First-week operations and incident response
+
+For the first 24 hours, both teammates monitor BaseScan events, failed user
+reports, RPC/hosting errors, and fee/creator balance reconciliation.  Reconcile
+each tip's gross, fee, and net from events/transfers at least daily for the
+first week.  Keep the verified contract address, deployment transaction, ABI,
+release SHA, owner address, and acceptance-test hashes in the release note.
+
+If the frontend is wrong but contracts are safe, immediately disable payable
+controls or unpublish/roll back the frontend to the last known-safe frontend;
+state clearly that the contracts remain on Base.  Then reproduce against the
+live address, fix, test on a Base fork, deploy a preview, and repeat Sections
+7–8.
+
+If an immutable-contract defect puts funds or accounting at risk, stop
+directing users to the contract immediately (unpublish/disable the UI and post
+a status notice), assess whether any built-in pause/owner control is safe and
+documented, and do not improvise privileged calls.  The permanent fix is:
+reproduce, correct source, add a regression test, deploy a new verified
+contract (or execute the pre-reviewed proxy upgrade), migrate/communicate as
+needed, repoint the frontend, and repeat the entire private-live and public
+acceptance sequence.  A frontend-only validation does not fix a public smart
+contract API.

exec
/bin/bash -lc "git diff --check && wc -l LAUNCH.md && sed -n '1,80p' LAUNCH.md && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
386 LAUNCH.md
# Base Mainnet launch runbook — USDC creator tipping

This runbook starts from a working Scaffold-ETH 2 **Foundry** project whose full
flow already works against a local Base fork.  It deliberately has two release
boundaries:

1. Deploy and validate the immutable contracts on Base mainnet while the web
   app is still private on `localhost`.
2. Only after a real-wallet, real-USDC walkthrough succeeds, publish the
   frontend.

Do not combine those boundaries.  A public frontend pointed at an unvalidated
mainnet contract is a production incident waiting to happen.

## 0. Assign roles and freeze the release candidate

One person is the **deployer**: they alone handle the deployer key and sign
the deployment.  The other is the **release verifier**: they independently
perform the user walkthrough and approve the public frontend release.  Both
must approve each gate below.

In a fresh clone of the exact commit intended for release:

```bash
git status --short
git rev-parse HEAD
yarn install --immutable
yarn test
cd packages/foundry && forge test -vvv && cd ../..
yarn lint
yarn build
```

If this project does not define one of `lint` or `build`, use the equivalent
script shown by `yarn run`; do not silently skip its check.  Record the commit
SHA in the release notes and tag it only after all checks pass:

```bash
git tag -a vYYYY.MM.DD.1 -m "Base mainnet launch"
git push origin vYYYY.MM.DD.1
```

**Go/no-go:** the working tree is clean; every test, lint, and production build
passes from this commit.  A failure stops the launch.  Fix it, add a regression
test where applicable, and repeat this section.

## 1. Complete the launch worksheet before funding anything

Create a private, access-controlled release note (never commit it) containing
these exact values.  Two people should independently read back the addresses.

| Item | Required value / check |
| --- | --- |
| Target network | `base`, chain ID `8453` |
| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Contract constructor/initializer arguments | Exact recipients, fee recipient, token address, and any owner/admin address |
| Platform fee | `100` basis points (1%); document the contract's fee denominator and rounding rule |
| Deployer | A new, dedicated EOA or hardware-wallet address — not a personal daily-use wallet |
| Operational owner/fee recipient | Separate address or multisig, if the contract supports it |
| RPC URL | A dedicated Base-mainnet HTTPS RPC, held only in ignored local env files / host secrets |
| Explorer | `https://basescan.org` |
| Frontend host/project | The production hosting project and its protected environment settings |
| Release test accounts | One funded tester wallet plus a creator-recipient wallet controlled by the team |

For the USDC address, verify on BaseScan that it is a contract and reports
six decimals.  Do not accept a token address copied from a search ad, a wallet
UI, or another chain.  Also write down the expected recipient amount for a
test tip: for a `10.00 USDC` tip, with a 1% fee and whole-atomic-unit rounding,
the expected fee is `0.10 USDC` and recipient amount is `9.90 USDC`.

Inspect the contract and deployment script together.  Confirm, in writing:

- USDC is passed/stored as the worksheet's Base address and all frontend
  amounts use **6** decimals (not 18).
- The fee is exactly 100 bps, cannot accidentally exceed the intended cap, and
  the fee recipient is the worksheet address.
- `tip` handles USDC's `transferFrom` result safely (for example via
  OpenZeppelin `SafeERC20`), validates zero/invalid inputs, and cannot be
  reentered around token movement/accounting.
- The deployer cannot change user funds or fee terms unexpectedly.  If there
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9a2e151410f775add52be1c90c4e47214fa20b7
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,386 @@
+# Base Mainnet launch runbook — USDC creator tipping
+
+This runbook starts from a working Scaffold-ETH 2 **Foundry** project whose full
+flow already works against a local Base fork.  It deliberately has two release
+boundaries:
+
+1. Deploy and validate the immutable contracts on Base mainnet while the web
+   app is still private on `localhost`.
+2. Only after a real-wallet, real-USDC walkthrough succeeds, publish the
+   frontend.
+
+Do not combine those boundaries.  A public frontend pointed at an unvalidated
+mainnet contract is a production incident waiting to happen.
+
+## 0. Assign roles and freeze the release candidate
+
+One person is the **deployer**: they alone handle the deployer key and sign
+the deployment.  The other is the **release verifier**: they independently
+perform the user walkthrough and approve the public frontend release.  Both
+must approve each gate below.
+
+In a fresh clone of the exact commit intended for release:
+
+```bash
+git status --short
+git rev-parse HEAD
+yarn install --immutable
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn lint
+yarn build
+```
+
+If this project does not define one of `lint` or `build`, use the equivalent
+script shown by `yarn run`; do not silently skip its check.  Record the commit
+SHA in the release notes and tag it only after all checks pass:
+
+```bash
+git tag -a vYYYY.MM.DD.1 -m "Base mainnet launch"
+git push origin vYYYY.MM.DD.1
+```
+
+**Go/no-go:** the working tree is clean; every test, lint, and production build
+passes from this commit.  A failure stops the launch.  Fix it, add a regression
+test where applicable, and repeat this section.
+
+## 1. Complete the launch worksheet before funding anything
+
+Create a private, access-controlled release note (never commit it) containing
+these exact values.  Two people should independently read back the addresses.
+
+| Item | Required value / check |
+| --- | --- |
+| Target network | `base`, chain ID `8453` |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Contract constructor/initializer arguments | Exact recipients, fee recipient, token address, and any owner/admin address |
+| Platform fee | `100` basis points (1%); document the contract's fee denominator and rounding rule |
+| Deployer | A new, dedicated EOA or hardware-wallet address — not a personal daily-use wallet |
+| Operational owner/fee recipient | Separate address or multisig, if the contract supports it |
+| RPC URL | A dedicated Base-mainnet HTTPS RPC, held only in ignored local env files / host secrets |
+| Explorer | `https://basescan.org` |
+| Frontend host/project | The production hosting project and its protected environment settings |
+| Release test accounts | One funded tester wallet plus a creator-recipient wallet controlled by the team |
+
+For the USDC address, verify on BaseScan that it is a contract and reports
+six decimals.  Do not accept a token address copied from a search ad, a wallet
+UI, or another chain.  Also write down the expected recipient amount for a
+test tip: for a `10.00 USDC` tip, with a 1% fee and whole-atomic-unit rounding,
+the expected fee is `0.10 USDC` and recipient amount is `9.90 USDC`.
+
+Inspect the contract and deployment script together.  Confirm, in writing:
+
+- USDC is passed/stored as the worksheet's Base address and all frontend
+  amounts use **6** decimals (not 18).
+- The fee is exactly 100 bps, cannot accidentally exceed the intended cap, and
+  the fee recipient is the worksheet address.
+- `tip` handles USDC's `transferFrom` result safely (for example via
+  OpenZeppelin `SafeERC20`), validates zero/invalid inputs, and cannot be
+  reentered around token movement/accounting.
+- The deployer cannot change user funds or fee terms unexpectedly.  If there
+  are admin functions, the owner and transfer/renounce process are understood;
+  do not deploy until the intended operational owner is available.
+- Events contain sufficient fields to reconcile tipper, creator, gross amount,
+  fee, and net amount.  The frontend waits for a successful receipt and shows
+  failed/rejected transactions accurately.
+- The deployment script uses the Base USDC address and production recipients
+  explicitly—never a localhost mock, an Anvil account, or a `31337` address.
+
+**Go/no-go:** both people agree on every worksheet item and the contract review
+matches it.  Any ambiguity about owner powers, rounding, or token handling is
+a contract change: return to Section 0 rather than trying to solve it in the
+frontend.
+
+## 2. Make the production configuration safe and explicit
+
+From the repository root, inspect the actual scripts and configuration before
+editing.  These commands prevent guessing at a project-specific file name:
+
+```bash
+yarn run
+rg -n "base|mainnet|DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|rpcOverrides|walletClient|USDC|usdc|31337|localhost" \
+  packages/foundry packages/nextjs package.json yarn.lock
+sed -n '1,240p' packages/nextjs/scaffold.config.ts
+sed -n '1,260p' packages/foundry/foundry.toml
+```
+
+Make these configuration changes in the release commit:
+
+1. In `packages/nextjs/scaffold.config.ts`, include `base` in `targetNetworks`
+   and set `defaultNetwork`/`targetNetworks` so the production build reads Base
+   (`base.id === 8453`), not `localhost` or `hardhat`.  Preserve test networks
+   only if the UI makes their status unmistakable.
+2. Keep RPC credentials out of the committed config.  If the config needs an
+   override, use `process.env.NEXT_PUBLIC_BASE_RPC_URL`; put its value in
+   `packages/nextjs/.env.local` locally and in the hosting provider's
+   environment settings.  A public `NEXT_PUBLIC_*` RPC URL is acceptable only
+   if it is intended to be public and is rate/domain restricted; a deployer key
+   never is.
+3. Ensure the frontend's external contract map uses the canonical USDC address
+   above for Base.  Make no address change to generated deployed-contract data
+   yet—that must be generated by the actual Base deployment.
+4. Ensure the UI rejects the wrong chain before rendering a payable action and
+   offers a switch to Base.  It must use `parseUnits(value, 6)` (or the USDC
+   contract's queried decimals), not `parseEther`.
+5. In `packages/foundry/.env` (ignored by git), set only the variables the
+   repository's config/script actually reads.  A typical Foundry flavor needs:
+
+   ```dotenv
+   DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+   BASE_RPC_URL=https://<dedicated-base-mainnet-rpc>
+   ```
+
+   Do not paste the key in a terminal command, shell history, chat, committed
+   `.env.example`, `scaffold.config.ts`, or a frontend/hosting variable.  Set
+   file permissions and confirm it is ignored:
+
+   ```bash
+   chmod 600 packages/foundry/.env
+   git check-ignore -v packages/foundry/.env
+   git diff --check
+   git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/contracts
+   ```
+
+**Go/no-go:** the diff contains no secret; the frontend production config
+selects chain 8453; no payable flow can submit on 31337; and all Base USDC
+references are canonical.  If `git check-ignore` prints nothing, stop: the
+secret file is not safely ignored.
+
+## 3. Rehearse the exact release candidate on a Base fork
+
+Start a fork in terminal A from the repository root:
+
+```bash
+yarn fork --network base
+```
+
+The `--network` flag is required; `yarn fork base` can silently use the wrong
+network.  In terminal B, prove this is a Base fork despite Anvil reporting
+chain ID 31337:
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
+```
+
+The first command must return non-empty code and the second must return `6`.
+Then run the deployment and frontend locally against that fork using the
+repository's normal commands (in a standard Foundry SE-2 checkout these are):
+
+```bash
+yarn deploy --network localhost
+yarn start
+```
+
+Use two browser wallets/accounts and a fork-funded USDC holder as appropriate.
+Walk every production-relevant path: connect, wrong-network recovery, enter
+`10.00`, approve the exact requested USDC amount, tip, wait for confirmation,
+and inspect balances/events.  Test rejection in the wallet, insufficient USDC,
+insufficient allowance, a zero/invalid amount, and a second tip after an
+existing allowance.  Confirm the displayed gross/fee/net figures equal the
+contract's 6-decimal arithmetic.
+
+**Go/no-go:** the production deployment script runs clean on a Base fork and
+every happy and failure path is correct.  A mismatch in value, fee, recipients,
+chain, or event is a stop-ship contract/frontend defect—fix, test, and restart
+at Section 0.
+
+## 4. Rehearse the operational procedure on Base Sepolia
+
+This step is strongly recommended because it exposes hardware-wallet, RPC,
+explorer, and hosting configuration errors without putting money at risk.
+
+Change only environment values to use an explicitly named `baseSepolia` network
+already defined by this version of the project; do not rename Base mainnet's
+`base` entry.  Fund the dedicated deployer with Base Sepolia ETH, deploy, and
+verify using the repository's discovered commands:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Point a local frontend at the resulting Sepolia address, perform a full wallet
+flow, and then restore the production config before committing.  Do not use a
+testnet deployment address in any Base mainnet config.
+
+**Go/no-go:** the team can sign, deploy, verify, switch the wallet's network,
+and use the app on an external chain.  Failure here is cheap practice, not a
+reason to skip the mainnet gate.
+
+## 5. Fund and preflight the Base-mainnet deployer
+
+Use the wallet/hardware wallet to reveal the dedicated deployer address without
+revealing its key.  Send a small, deliberate amount of Base ETH sufficient for
+deployment, verification retry, and an emergency owner-transfer transaction;
+use current gas estimates from the chosen RPC/wallet rather than a fixed value.
+Never send USDC to the deployer unless the deployment script specifically
+requires it.
+
+In the actual release checkout, with its private `.env` loaded as its scripts
+expect, check identity, network, balance, and USDC code:
+
+```bash
+cd packages/foundry
+DEPLOYER_ADDRESS=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
+printf '%s\n' "$DEPLOYER_ADDRESS"
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Expected chain ID is `8453`, the shown account is the worksheet deployer, the
+ETH balance is non-zero and adequate, and USDC code is non-empty.  If your
+shell does not load `packages/foundry/.env`, export values only in the current
+private shell session or use the project's documented env loader; never place
+the key after `--private-key` in shell history.
+
+**Go/no-go:** all four expected values match the worksheet.  A wrong chain ID,
+wrong address, empty code, or low balance means stop and correct configuration
+or funding; do not “try a deployment” to see what happens.
+
+## 6. Deploy to Base mainnet, then verify immediately
+
+Stop local dev processes that might be watching or overwriting generated
+contract files.  From the same checked-out commit and terminal whose broadcast
+artifacts will remain intact:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+The second command must run immediately from the same checkout: Scaffold-ETH
+Foundry verification reuses `packages/foundry/broadcast/run-latest.json`.
+Do not regenerate, delete, or copy that broadcast file between the two commands.
+
+Record the transaction hash and deployed contract address printed by the deploy
+command.  Independently validate before touching the frontend:
+
+```bash
+cd packages/foundry
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_USDC>()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_BPS>()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_RECIPIENT>()(address)" --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Replace the three ABI signatures with the contract's actual public getter
+signatures before launch (for example, `usdc()(address)`, `platformFeeBps()(uint256)`,
+and `feeRecipient()(address)`).  Compare every returned value with the
+worksheet.  On BaseScan, confirm the transaction succeeded, source code and
+constructor arguments are verified, compiler settings match, and the contract
+address is the address generated into the frontend's deployed-contract data.
+
+If verification fails due to explorer indexing, wait for indexing and rerun
+only `yarn verify --network base` from this same checkout.  If bytecode,
+constructor arguments, or any getter differs, **do not publish**.  Immutable
+contract bytecode cannot be patched: determine whether the deployment is
+unusable, fix source/tests, then redeploy and record the new address.
+
+**Go/no-go:** successful deployment, verified source, and independent on-chain
+getter checks all match.  The Base contract is live but the app remains private.
+
+## 7. Point a localhost frontend at the live contract and perform a paid acceptance test
+
+Commit the generated Base address data produced by `yarn deploy --network base`
+(typically under `packages/nextjs/contracts/deployedContracts.ts`) along with
+the reviewed Base configuration.  Inspect the diff: it must contain the actual
+Base contract address and chain ID `8453`, not localhost/31337 addresses.
+
+Run the production-mode frontend locally, not a development-only build:
+
+```bash
+yarn workspace nextjs build
+yarn workspace nextjs start
+```
+
+If the workspace name differs, use the root script discovered in Section 2
+(often `yarn next:build` / `yarn next:start`); the non-negotiable requirement
+is a production build served locally with the Base configuration.
+
+Using a real browser wallet on Base and a team-controlled creator address:
+
+1. Connect the tester wallet. Confirm the UI shows Base mainnet and the exact
+   verified tipping-contract address (provide an Explorer link in the UI or
+   inspect its network call/config).
+2. Give the tester wallet only `1–10 USDC` for this acceptance test plus a
+   small Base ETH balance. Ensure no old unlimited USDC approval exists.
+3. Submit a `10.00 USDC` tip (or another amount in that range). Inspect the
+   wallet confirmation: spender must be the verified tipping contract; token
+   must be canonical Base USDC; approval must be the exact tip amount or a
+   clearly intentional, reviewed policy—never an accidental unlimited approval.
+4. Wait for both transaction receipts. On BaseScan, confirm successful USDC
+   transfers/events and verify balances: tipper decreases by gross; fee
+   recipient receives exactly 1%; creator receives the remainder.  Verify the
+   app's transaction status and displayed amounts agree.
+5. Refresh, reconnect, switch temporarily to a wrong network and back, and
+   repeat a small tip to test allowance reuse and state refresh.  Reject one
+   transaction in the wallet and confirm the UI never reports it as successful.
+
+Save transaction hashes, screenshots, and the expected/actual accounting in
+the private release note.
+
+**Go/no-go:** a real user journey with real money works from the private
+production build, including correct 6-decimal accounting and error states.
+Any mismatch means leave the public site offline, diagnose from transaction
+hashes, and restart at the relevant earlier section.  A frontend guard is not
+a remedy for an on-chain defect.
+
+## 8. Publish the frontend only after the acceptance gate
+
+Put only non-secret client configuration in the hosting provider's Production
+environment—at minimum the intended public, rate-limited Base RPC URL if the
+project requires it.  Put no deployer key, Foundry `.env`, or admin credential
+there.  Set the custom domain only after its HTTPS certificate and DNS are
+ready.  Use the host's preview deployment first and repeat the connect/wrong
+network/read-only checks there.
+
+From the approved, tagged commit, deploy with the repository's configured host
+command.  For a typical Vercel-connected Scaffold-ETH checkout, this is either
+a production Git deployment from the tagged commit or:
+
+```bash
+yarn workspace nextjs vercel --prod
+```
+
+Do not run a guessed host command.  First use `yarn run` and the host project
+settings to identify the actual production command.  Require a deployment
+preview/URL tied to the recorded commit SHA.
+
+Before announcing the URL, use a fresh browser profile and a mobile wallet if
+supported to check: HTTPS/custom domain, wallet connection, chain switching,
+contract address, no console/runtime errors, correct USDC decimals, readable
+transaction links, and no secret in downloaded JavaScript or page source.
+Then put one final small Base-USDC tip through the **public URL** and reconcile
+it as in Section 7.
+
+**Go/no-go:** the public URL serves the approved SHA and its final live
+transaction succeeds with correct accounting.  Only now announce the app.
+
+## 9. First-week operations and incident response
+
+For the first 24 hours, both teammates monitor BaseScan events, failed user
+reports, RPC/hosting errors, and fee/creator balance reconciliation.  Reconcile
+each tip's gross, fee, and net from events/transfers at least daily for the
+first week.  Keep the verified contract address, deployment transaction, ABI,
+release SHA, owner address, and acceptance-test hashes in the release note.
+
+If the frontend is wrong but contracts are safe, immediately disable payable
+controls or unpublish/roll back the frontend to the last known-safe frontend;
+state clearly that the contracts remain on Base.  Then reproduce against the
+live address, fix, test on a Base fork, deploy a preview, and repeat Sections
+7–8.
+
+If an immutable-contract defect puts funds or accounting at risk, stop
+directing users to the contract immediately (unpublish/disable the UI and post
+a status notice), assess whether any built-in pause/owner control is safe and
+documented, and do not improvise privileged calls.  The permanent fix is:
+reproduce, correct source, add a regression test, deploy a new verified
+contract (or execute the pre-reviewed proxy upgrade), migrate/communicate as
+needed, repoint the frontend, and repeat the entire private-live and public
+acceptance sequence.  A frontend-only validation does not fix a public smart
+contract API.

codex
Created the complete gated launch runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001/LAUNCH.md).

It covers Base fork rehearsal, Base Sepolia operational rehearsal, secured mainnet configuration/funding, deploy-and-immediate-verification, private live-wallet USDC acceptance testing, public hosting, and incident response. `git diff --check` passes.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c9a2e151410f775add52be1c90c4e47214fa20b7
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,386 @@
+# Base Mainnet launch runbook — USDC creator tipping
+
+This runbook starts from a working Scaffold-ETH 2 **Foundry** project whose full
+flow already works against a local Base fork.  It deliberately has two release
+boundaries:
+
+1. Deploy and validate the immutable contracts on Base mainnet while the web
+   app is still private on `localhost`.
+2. Only after a real-wallet, real-USDC walkthrough succeeds, publish the
+   frontend.
+
+Do not combine those boundaries.  A public frontend pointed at an unvalidated
+mainnet contract is a production incident waiting to happen.
+
+## 0. Assign roles and freeze the release candidate
+
+One person is the **deployer**: they alone handle the deployer key and sign
+the deployment.  The other is the **release verifier**: they independently
+perform the user walkthrough and approve the public frontend release.  Both
+must approve each gate below.
+
+In a fresh clone of the exact commit intended for release:
+
+```bash
+git status --short
+git rev-parse HEAD
+yarn install --immutable
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn lint
+yarn build
+```
+
+If this project does not define one of `lint` or `build`, use the equivalent
+script shown by `yarn run`; do not silently skip its check.  Record the commit
+SHA in the release notes and tag it only after all checks pass:
+
+```bash
+git tag -a vYYYY.MM.DD.1 -m "Base mainnet launch"
+git push origin vYYYY.MM.DD.1
+```
+
+**Go/no-go:** the working tree is clean; every test, lint, and production build
+passes from this commit.  A failure stops the launch.  Fix it, add a regression
+test where applicable, and repeat this section.
+
+## 1. Complete the launch worksheet before funding anything
+
+Create a private, access-controlled release note (never commit it) containing
+these exact values.  Two people should independently read back the addresses.
+
+| Item | Required value / check |
+| --- | --- |
+| Target network | `base`, chain ID `8453` |
+| Canonical Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Contract constructor/initializer arguments | Exact recipients, fee recipient, token address, and any owner/admin address |
+| Platform fee | `100` basis points (1%); document the contract's fee denominator and rounding rule |
+| Deployer | A new, dedicated EOA or hardware-wallet address — not a personal daily-use wallet |
+| Operational owner/fee recipient | Separate address or multisig, if the contract supports it |
+| RPC URL | A dedicated Base-mainnet HTTPS RPC, held only in ignored local env files / host secrets |
+| Explorer | `https://basescan.org` |
+| Frontend host/project | The production hosting project and its protected environment settings |
+| Release test accounts | One funded tester wallet plus a creator-recipient wallet controlled by the team |
+
+For the USDC address, verify on BaseScan that it is a contract and reports
+six decimals.  Do not accept a token address copied from a search ad, a wallet
+UI, or another chain.  Also write down the expected recipient amount for a
+test tip: for a `10.00 USDC` tip, with a 1% fee and whole-atomic-unit rounding,
+the expected fee is `0.10 USDC` and recipient amount is `9.90 USDC`.
+
+Inspect the contract and deployment script together.  Confirm, in writing:
+
+- USDC is passed/stored as the worksheet's Base address and all frontend
+  amounts use **6** decimals (not 18).
+- The fee is exactly 100 bps, cannot accidentally exceed the intended cap, and
+  the fee recipient is the worksheet address.
+- `tip` handles USDC's `transferFrom` result safely (for example via
+  OpenZeppelin `SafeERC20`), validates zero/invalid inputs, and cannot be
+  reentered around token movement/accounting.
+- The deployer cannot change user funds or fee terms unexpectedly.  If there
+  are admin functions, the owner and transfer/renounce process are understood;
+  do not deploy until the intended operational owner is available.
+- Events contain sufficient fields to reconcile tipper, creator, gross amount,
+  fee, and net amount.  The frontend waits for a successful receipt and shows
+  failed/rejected transactions accurately.
+- The deployment script uses the Base USDC address and production recipients
+  explicitly—never a localhost mock, an Anvil account, or a `31337` address.
+
+**Go/no-go:** both people agree on every worksheet item and the contract review
+matches it.  Any ambiguity about owner powers, rounding, or token handling is
+a contract change: return to Section 0 rather than trying to solve it in the
+frontend.
+
+## 2. Make the production configuration safe and explicit
+
+From the repository root, inspect the actual scripts and configuration before
+editing.  These commands prevent guessing at a project-specific file name:
+
+```bash
+yarn run
+rg -n "base|mainnet|DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|rpcOverrides|walletClient|USDC|usdc|31337|localhost" \
+  packages/foundry packages/nextjs package.json yarn.lock
+sed -n '1,240p' packages/nextjs/scaffold.config.ts
+sed -n '1,260p' packages/foundry/foundry.toml
+```
+
+Make these configuration changes in the release commit:
+
+1. In `packages/nextjs/scaffold.config.ts`, include `base` in `targetNetworks`
+   and set `defaultNetwork`/`targetNetworks` so the production build reads Base
+   (`base.id === 8453`), not `localhost` or `hardhat`.  Preserve test networks
+   only if the UI makes their status unmistakable.
+2. Keep RPC credentials out of the committed config.  If the config needs an
+   override, use `process.env.NEXT_PUBLIC_BASE_RPC_URL`; put its value in
+   `packages/nextjs/.env.local` locally and in the hosting provider's
+   environment settings.  A public `NEXT_PUBLIC_*` RPC URL is acceptable only
+   if it is intended to be public and is rate/domain restricted; a deployer key
+   never is.
+3. Ensure the frontend's external contract map uses the canonical USDC address
+   above for Base.  Make no address change to generated deployed-contract data
+   yet—that must be generated by the actual Base deployment.
+4. Ensure the UI rejects the wrong chain before rendering a payable action and
+   offers a switch to Base.  It must use `parseUnits(value, 6)` (or the USDC
+   contract's queried decimals), not `parseEther`.
+5. In `packages/foundry/.env` (ignored by git), set only the variables the
+   repository's config/script actually reads.  A typical Foundry flavor needs:
+
+   ```dotenv
+   DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+   BASE_RPC_URL=https://<dedicated-base-mainnet-rpc>
+   ```
+
+   Do not paste the key in a terminal command, shell history, chat, committed
+   `.env.example`, `scaffold.config.ts`, or a frontend/hosting variable.  Set
+   file permissions and confirm it is ignored:
+
+   ```bash
+   chmod 600 packages/foundry/.env
+   git check-ignore -v packages/foundry/.env
+   git diff --check
+   git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/contracts
+   ```
+
+**Go/no-go:** the diff contains no secret; the frontend production config
+selects chain 8453; no payable flow can submit on 31337; and all Base USDC
+references are canonical.  If `git check-ignore` prints nothing, stop: the
+secret file is not safely ignored.
+
+## 3. Rehearse the exact release candidate on a Base fork
+
+Start a fork in terminal A from the repository root:
+
+```bash
+yarn fork --network base
+```
+
+The `--network` flag is required; `yarn fork base` can silently use the wrong
+network.  In terminal B, prove this is a Base fork despite Anvil reporting
+chain ID 31337:
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
+```
+
+The first command must return non-empty code and the second must return `6`.
+Then run the deployment and frontend locally against that fork using the
+repository's normal commands (in a standard Foundry SE-2 checkout these are):
+
+```bash
+yarn deploy --network localhost
+yarn start
+```
+
+Use two browser wallets/accounts and a fork-funded USDC holder as appropriate.
+Walk every production-relevant path: connect, wrong-network recovery, enter
+`10.00`, approve the exact requested USDC amount, tip, wait for confirmation,
+and inspect balances/events.  Test rejection in the wallet, insufficient USDC,
+insufficient allowance, a zero/invalid amount, and a second tip after an
+existing allowance.  Confirm the displayed gross/fee/net figures equal the
+contract's 6-decimal arithmetic.
+
+**Go/no-go:** the production deployment script runs clean on a Base fork and
+every happy and failure path is correct.  A mismatch in value, fee, recipients,
+chain, or event is a stop-ship contract/frontend defect—fix, test, and restart
+at Section 0.
+
+## 4. Rehearse the operational procedure on Base Sepolia
+
+This step is strongly recommended because it exposes hardware-wallet, RPC,
+explorer, and hosting configuration errors without putting money at risk.
+
+Change only environment values to use an explicitly named `baseSepolia` network
+already defined by this version of the project; do not rename Base mainnet's
+`base` entry.  Fund the dedicated deployer with Base Sepolia ETH, deploy, and
+verify using the repository's discovered commands:
+
+```bash
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Point a local frontend at the resulting Sepolia address, perform a full wallet
+flow, and then restore the production config before committing.  Do not use a
+testnet deployment address in any Base mainnet config.
+
+**Go/no-go:** the team can sign, deploy, verify, switch the wallet's network,
+and use the app on an external chain.  Failure here is cheap practice, not a
+reason to skip the mainnet gate.
+
+## 5. Fund and preflight the Base-mainnet deployer
+
+Use the wallet/hardware wallet to reveal the dedicated deployer address without
+revealing its key.  Send a small, deliberate amount of Base ETH sufficient for
+deployment, verification retry, and an emergency owner-transfer transaction;
+use current gas estimates from the chosen RPC/wallet rather than a fixed value.
+Never send USDC to the deployer unless the deployment script specifically
+requires it.
+
+In the actual release checkout, with its private `.env` loaded as its scripts
+expect, check identity, network, balance, and USDC code:
+
+```bash
+cd packages/foundry
+DEPLOYER_ADDRESS=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
+printf '%s\n' "$DEPLOYER_ADDRESS"
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Expected chain ID is `8453`, the shown account is the worksheet deployer, the
+ETH balance is non-zero and adequate, and USDC code is non-empty.  If your
+shell does not load `packages/foundry/.env`, export values only in the current
+private shell session or use the project's documented env loader; never place
+the key after `--private-key` in shell history.
+
+**Go/no-go:** all four expected values match the worksheet.  A wrong chain ID,
+wrong address, empty code, or low balance means stop and correct configuration
+or funding; do not “try a deployment” to see what happens.
+
+## 6. Deploy to Base mainnet, then verify immediately
+
+Stop local dev processes that might be watching or overwriting generated
+contract files.  From the same checked-out commit and terminal whose broadcast
+artifacts will remain intact:
+
+```bash
+yarn deploy --network base
+yarn verify --network base
+```
+
+The second command must run immediately from the same checkout: Scaffold-ETH
+Foundry verification reuses `packages/foundry/broadcast/run-latest.json`.
+Do not regenerate, delete, or copy that broadcast file between the two commands.
+
+Record the transaction hash and deployed contract address printed by the deploy
+command.  Independently validate before touching the frontend:
+
+```bash
+cd packages/foundry
+cast chain-id --rpc-url "$BASE_RPC_URL"
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_USDC>()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_BPS>()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "<READ_METHOD_FOR_FEE_RECIPIENT>()(address)" --rpc-url "$BASE_RPC_URL"
+cd ../..
+```
+
+Replace the three ABI signatures with the contract's actual public getter
+signatures before launch (for example, `usdc()(address)`, `platformFeeBps()(uint256)`,
+and `feeRecipient()(address)`).  Compare every returned value with the
+worksheet.  On BaseScan, confirm the transaction succeeded, source code and
+constructor arguments are verified, compiler settings match, and the contract
+address is the address generated into the frontend's deployed-contract data.
+
+If verification fails due to explorer indexing, wait for indexing and rerun
+only `yarn verify --network base` from this same checkout.  If bytecode,
+constructor arguments, or any getter differs, **do not publish**.  Immutable
+contract bytecode cannot be patched: determine whether the deployment is
+unusable, fix source/tests, then redeploy and record the new address.
+
+**Go/no-go:** successful deployment, verified source, and independent on-chain
+getter checks all match.  The Base contract is live but the app remains private.
+
+## 7. Point a localhost frontend at the live contract and perform a paid acceptance test
+
+Commit the generated Base address data produced by `yarn deploy --network base`
+(typically under `packages/nextjs/contracts/deployedContracts.ts`) along with
+the reviewed Base configuration.  Inspect the diff: it must contain the actual
+Base contract address and chain ID `8453`, not localhost/31337 addresses.
+
+Run the production-mode frontend locally, not a development-only build:
+
+```bash
+yarn workspace nextjs build
+yarn workspace nextjs start
+```
+
+If the workspace name differs, use the root script discovered in Section 2
+(often `yarn next:build` / `yarn next:start`); the non-negotiable requirement
+is a production build served locally with the Base configuration.
+
+Using a real browser wallet on Base and a team-controlled creator address:
+
+1. Connect the tester wallet. Confirm the UI shows Base mainnet and the exact
+   verified tipping-contract address (provide an Explorer link in the UI or
+   inspect its network call/config).
+2. Give the tester wallet only `1–10 USDC` for this acceptance test plus a
+   small Base ETH balance. Ensure no old unlimited USDC approval exists.
+3. Submit a `10.00 USDC` tip (or another amount in that range). Inspect the
+   wallet confirmation: spender must be the verified tipping contract; token
+   must be canonical Base USDC; approval must be the exact tip amount or a
+   clearly intentional, reviewed policy—never an accidental unlimited approval.
+4. Wait for both transaction receipts. On BaseScan, confirm successful USDC
+   transfers/events and verify balances: tipper decreases by gross; fee
+   recipient receives exactly 1%; creator receives the remainder.  Verify the
+   app's transaction status and displayed amounts agree.
+5. Refresh, reconnect, switch temporarily to a wrong network and back, and
+   repeat a small tip to test allowance reuse and state refresh.  Reject one
+   transaction in the wallet and confirm the UI never reports it as successful.
+
+Save transaction hashes, screenshots, and the expected/actual accounting in
+the private release note.
+
+**Go/no-go:** a real user journey with real money works from the private
+production build, including correct 6-decimal accounting and error states.
+Any mismatch means leave the public site offline, diagnose from transaction
+hashes, and restart at the relevant earlier section.  A frontend guard is not
+a remedy for an on-chain defect.
+
+## 8. Publish the frontend only after the acceptance gate
+
+Put only non-secret client configuration in the hosting provider's Production
+environment—at minimum the intended public, rate-limited Base RPC URL if the
+project requires it.  Put no deployer key, Foundry `.env`, or admin credential
+there.  Set the custom domain only after its HTTPS certificate and DNS are
+ready.  Use the host's preview deployment first and repeat the connect/wrong
+network/read-only checks there.
+
+From the approved, tagged commit, deploy with the repository's configured host
+command.  For a typical Vercel-connected Scaffold-ETH checkout, this is either
+a production Git deployment from the tagged commit or:
+
+```bash
+yarn workspace nextjs vercel --prod
+```
+
+Do not run a guessed host command.  First use `yarn run` and the host project
+settings to identify the actual production command.  Require a deployment
+preview/URL tied to the recorded commit SHA.
+
+Before announcing the URL, use a fresh browser profile and a mobile wallet if
+supported to check: HTTPS/custom domain, wallet connection, chain switching,
+contract address, no console/runtime errors, correct USDC decimals, readable
+transaction links, and no secret in downloaded JavaScript or page source.
+Then put one final small Base-USDC tip through the **public URL** and reconcile
+it as in Section 7.
+
+**Go/no-go:** the public URL serves the approved SHA and its final live
+transaction succeeds with correct accounting.  Only now announce the app.
+
+## 9. First-week operations and incident response
+
+For the first 24 hours, both teammates monitor BaseScan events, failed user
+reports, RPC/hosting errors, and fee/creator balance reconciliation.  Reconcile
+each tip's gross, fee, and net from events/transfers at least daily for the
+first week.  Keep the verified contract address, deployment transaction, ABI,
+release SHA, owner address, and acceptance-test hashes in the release note.
+
+If the frontend is wrong but contracts are safe, immediately disable payable
+controls or unpublish/roll back the frontend to the last known-safe frontend;
+state clearly that the contracts remain on Base.  Then reproduce against the
+live address, fix, test on a Base fork, deploy a preview, and repeat Sections
+7–8.
+
+If an immutable-contract defect puts funds or accounting at risk, stop
+directing users to the contract immediately (unpublish/disable the UI and post
+a status notice), assess whether any built-in pause/owner control is safe and
+documented, and do not improvise privileged calls.  The permanent fix is:
+reproduce, correct source, add a regression test, deploy a new verified
+contract (or execute the pre-reviewed proxy upgrade), migrate/communicate as
+needed, repoint the frontend, and repeat the entire private-live and public
+acceptance sequence.  A frontend-only validation does not fix a public smart
+contract API.

tokens used
35,915
````

## final message

Created the complete gated launch runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-1/orchestration-goal-001/LAUNCH.md).

It covers Base fork rehearsal, Base Sepolia operational rehearsal, secured mainnet configuration/funding, deploy-and-immediate-verification, private live-wallet USDC acceptance testing, public hosting, and incident response. `git diff --check` passes.
