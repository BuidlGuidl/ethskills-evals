# Executor transcript — 2026-09-03T190411Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a068aa-b0f1-7c91-b9b1-c48f1440c169
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
I’m using the launch-orchestration guidance because this is the transition from a local Scaffold-ETH app to a public Base deployment. I’ll turn it into a runbook with stop/go checks and rollback safeguards.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: orchestration
description: Use when a Scaffold-ETH 2 build leaves localhost — planning a launch or the order things go out in, deploying or verifying contracts on a live network, standing up a local fork of a real chain, or fixing a contract bug that is already onchain. Not for frontend implementation (`frontend-ux`), the pre-launch UI audit (`qa`), or IPFS/Vercel deploy mechanics (`frontend-playbook`).
---

# Shipping a dApp

Going live is three moves, never one: contracts local, then contracts live with the frontend still on localhost, then the frontend public. The middle move is the one that gets skipped and the one that catches everything — real chain, real gas, real decimals, a real wallet — while the UI is still yours alone to edit in seconds.

Name a go/no-go condition at each boundary, not just the commands. Three of them:

- **Before deploying to the live network:** contract tests pass, the deploy script runs clean against a local fork, and there is a funded deployer — `yarn generate` creates one and writes the key to a gitignored `packages/foundry/.env`, `yarn account` prints its address and its balance on each chain, and it needs real ETH on the target chain before the deploy, not after it fails.
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

- **Fork the chain you are targeting rather than `yarn chain`** — `yarn fork --network base` gives you Uniswap, USDC, Aave and funded whales already deployed, so you write no mocks of things that exist. Two tokens, and that is the whole rule: yarn binds the first token after the script name to `$0`, whatever it looks like, so the script's `$1` is only set if you pass something before the value. `yarn fork base` and `yarn fork --network=base` both leave `$1` empty and silently fork Ethereum mainnet; `yarn fork --network base`, `yarn fork -n base` and `yarn fork -- base` all work. In the hardhat flavor `yarn fork` ignores its argument entirely and always forks mainnet — change `forking.url` in `hardhat.config.ts` to fork anything else. Either way the fork answers chain id 31337, so the chain id never tells you what you forked: check for state only the target chain has, such as code at one of its token addresses.
- **`scaffold.config.ts` is committed.** An RPC or API key pasted into `rpcOverrides` or `alchemyApiKey` is a published key; read it from `process.env` and keep the value in `.env.local`. `wallets/SKILL.md` covers the rest of key handling.
- **The frontend goes to the live chain only when you say so.** `scaffold.config.ts` `targetNetworks` still names the local chain after the contracts are live, and a frontend built before that switch reads a chain nobody is on. Change it in the same step that repoints the frontend at the deployed addresses, and not before — during fork work it belongs on `chains.foundry`, since the fork answers 31337 whatever it forked (`frontend-playbook` has the detail).
- **A frontend-only ticket deploys nothing.** Do not stand up a chain and redeploy to regenerate `deployedContracts.ts` unless deploying was the ask.

exec
/bin/bash -lc "rg --files -uu | sed -n '1,200p'; git status --short" in /home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001
 succeeded in 47ms:
.git/hooks/applypatch-msg.sample
TASK.md
.git/hooks/pre-applypatch.sample
.git/hooks/sendemail-validate.sample
.git/COMMIT_EDITMSG
.git/hooks/pre-merge-commit.sample
.git/info/exclude
.git/hooks/pre-push.sample
.git/hooks/post-update.sample
.git/hooks/pre-commit.sample
.git/hooks/push-to-checkout.sample
.git/hooks/update.sample
.git/hooks/pre-rebase.sample
.git/hooks/prepare-commit-msg.sample
.git/hooks/fsmonitor-watchman.sample
.git/hooks/commit-msg.sample
.git/hooks/pre-receive.sample
.git/HEAD
package.json
.git/config
.git/logs/HEAD
.git/index
.git/logs/refs/heads/main
.agents/skills/orchestration/SKILL.md
.git/description
.git/objects/18/5457b1e52fc237aaf807487c7a6120112d5e93
.git/objects/65/56d7f37984cb3d56930498ceb8598b46c9dc40
.git/objects/48/c0e14d893a45d6a82cc715169844a678401224
.git/objects/df/75f81e4edb574894d7e11dd37edefe98c4be40
.git/objects/03/7c0031f8d7c06fdcdb6efd2a56ecf39f002265
.git/objects/92/ad1ee83eea1448f4289c256b300c5467d21689
.git/objects/89/88b52a8e6b2d2f794a5ac773630ef157abb672
.git/refs/heads/main
.git/objects/c6/8dcfef3cf54497bc1b6d6e65041d1f4762a400

exec
/bin/bash -lc "sed -n '1,240p' TASK.md; sed -n '1,160p' package.json; git log --oneline --decorate -5" in /home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001
 succeeded in 2ms:
codex
I found this workspace contains only the assignment, so the runbook will use Scaffold-ETH 2’s Foundry commands and make every application-specific value an explicit, verified placeholder (rather than pretending to know unseen contract names or constructor inputs).
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..719012f3b974f61c3070bd78fbfcb71b0436bc7d
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,345 @@
+# Production launch runbook — Base USDC creator tips
+
+This is the ordered production path for the Foundry flavor of Scaffold-ETH 2.
+Perform it from a clean checkout of the application repository, not from this
+directory.  Replace values in angle brackets exactly once, record them in the
+launch record, and do not silently substitute a similarly named address.
+
+**Launch record (fill in before Step 1)**
+
+| Item | Production value |
+| --- | --- |
+| Git commit to release | `<COMMIT_SHA>` |
+| Deployer address | `<DEPLOYER_ADDRESS>` |
+| Base fee-recipient/multisig | `<FEE_RECIPIENT>` |
+| Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Contract name / deployed address | `<TIP_CONTRACT_NAME>` / `<TIP_CONTRACT_ADDRESS>` |
+| Public domain | `https://<DOMAIN>` |
+| Base RPC endpoint (server-side) | `<BASE_RPC_URL>` |
+| Base block explorer | `https://basescan.org` |
+
+The fee recipient must be a two-person-controlled multisig, not either
+developer's wallet.  Confirm that its signers and recovery process are known
+before it is made immutable in a deployment.
+
+## 1. Freeze the exact release and agree the irreversible settings
+
+On a fresh branch in the dApp repository:
+
+```bash
+git checkout <COMMIT_SHA>
+git status --short
+yarn install --immutable
+```
+
+`git status --short` must print nothing, and the install must succeed.  Stop if
+it does not: deployment artifacts generated from a dirty tree cannot be
+reproduced.
+
+Read the tip contract, its deployment script, and tests together.  Write the
+following production values in the launch record and have both teammates review
+them:
+
+* the Base native-USDC address above (it has 6 decimals);
+* the exact 1% representation used by the contract (for example, `100` when
+  the denominator is `10_000`);
+* the fee-recipient multisig;
+* every constructor or initializer argument, including owner/admin and any
+  pause role;
+* whether tips are paid by `transferFrom`, and the intended behavior for a
+  USDC approval of `0`, a tiny tip, and a `1_000_000`-unit ($1) tip.
+
+If any of those are literals in the deploy script, edit that script now.  For a
+typical `packages/foundry/script/Deploy.s.sol`, the deployment must use the
+Base USDC address and `<FEE_RECIPIENT>`; do not leave a mock-token, an Anvil
+address, a test EOA, or a local-chain conditional in its production path.  If
+the script uses environment variables, make the required values explicit with
+`vm.envAddress(...)`/`vm.envUint(...)` rather than supplying unsafe defaults.
+
+Also inspect the withdrawal/admin paths.  They must either be protected by the
+multisig/role above or deliberately unavailable.  A public `setFeeRecipient`,
+`withdraw`, upgrade authorization, or arbitrary-token sweep is a launch
+blocker until its access control and tests are correct.
+
+Update or add Foundry tests for all of these cases before proceeding:
+
+```bash
+cd packages/foundry
+forge test -vvv
+cd ../..
+yarn test
+```
+
+The suite must prove, in USDC's six-decimal units, that a $1.00 tip transfers
+`990000` to the creator and `10000` to the fee recipient (or the contract's
+documented equivalent), that total received equals the tip, that unauthorized
+admin calls revert, and that zero/rounding behavior is intentional.  It must
+also cover failed/insufficient allowance and a USDC transfer failure.  Do not
+continue on a passing happy-path-only suite: these are the failures that an
+otherwise valid browser transaction exposes to users.
+
+Commit the reviewed release:
+
+```bash
+git add packages/foundry
+git commit -m "Configure Base production deployment"
+git rev-parse HEAD
+```
+
+Copy the final hash into `<COMMIT_SHA>`.  Do **not** commit `.env`, `.env.local`,
+private keys, RPC credentials, or deployment seed phrases.
+
+## 2. Create and fund the isolated Base deployer
+
+Use a dedicated hot deployer; it must not be a multisig owner, the fee
+recipient, or a personal day-to-day wallet.  From the repository root:
+
+```bash
+yarn generate
+yarn account --network base
+```
+
+`yarn generate` writes the generated key to the gitignored
+`packages/foundry/.env`.  Record the address printed by `yarn account` as
+`<DEPLOYER_ADDRESS>`, then send it a conservative amount of real ETH on **Base
+mainnet** (enough for deployment, verification retries, and an emergency pause
+if the design has one).  Never paste the key into a chat, shell history, or
+frontend environment file.
+
+Configure the server-side Base RPC in `packages/foundry/.env` using the variable
+name already referenced by `packages/foundry/foundry.toml` (normally
+`BASE_RPC_URL`):
+
+```dotenv
+BASE_RPC_URL=<BASE_RPC_URL>
+```
+
+Keep the existing `ETHERSCAN_API_KEY` that Scaffold-ETH copied from
+`.env.example`; it is already suitable for the immediate verification command.
+Do not replace it with a blank placeholder or delay launch waiting for an
+explorer key.
+
+Re-run:
+
+```bash
+yarn account --network base
+```
+
+**Go/no-go:** it must print `<DEPLOYER_ADDRESS>`, a nonzero Base ETH balance,
+and the Base network/chain ID `8453`.  In the wallet and RPC dashboard, verify
+the funding transaction is on Base—not Ethereum, Base Sepolia, or a local
+network.  Stop and correct the RPC/funding destination if any of these differ.
+
+## 3. Rehearse the exact production deploy on a Base fork
+
+In terminal A, from the repository root, start the target-chain fork using this
+exact argument form:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+form both can leave the argument in the wrong position and silently fork
+Ethereum mainnet.  A fork still reports chain ID `31337`, so that ID does not
+identify what was forked.
+
+Before deploying, prove it is Base by checking code at Base USDC.  In terminal
+B, use the local RPC URL printed by the fork (normally `http://127.0.0.1:8545`):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must be non-empty bytecode.  Empty output is a hard stop: kill the
+fork and restart it with the command above.
+
+Temporarily point the Foundry deployment configuration at that local RPC only
+if its network entry requires it; do not change the source's production USDC
+or fee-recipient values.  Run the same deploy entry point used for production:
+
+```bash
+yarn deploy --network localhost
+```
+
+If this project names the local Foundry network `foundry` rather than
+`localhost`, use `yarn deploy --network foundry`; use the existing network name
+in `foundry.toml`, not a new one.  Save the resulting address, inspect the
+broadcast receipt, and use `cast call` or the project's read script to confirm
+the stored USDC, fee recipient, and fee rate exactly match the launch record.
+
+Then run the frontend against this fork and execute all of the following with a
+browser wallet connected to `http://127.0.0.1:8545` / chain `31337`:
+
+1. import a funded fork account only for the rehearsal;
+2. choose a real Base creator address;
+3. approve USDC, make a $1 tip, and wait for confirmation;
+4. verify creator balance increases by `$0.99`, fee recipient by `$0.01`, and
+   the contract retains no unexpected balance; and
+5. retry with no/too-small approval and verify the UI gives a useful failure
+   state without claiming the tip succeeded.
+
+**Go/no-go:** the script, constructor values, deployed-contract artifact, and
+the browser journey must all succeed.  Any failure means fix source/config,
+add a regression test, commit, and repeat Steps 1–3.  Do not work around a
+contract defect in the UI; direct callers can bypass the UI.
+
+## 4. Deploy and verify on Base while the frontend remains private
+
+Stop the fork and restore any temporary local-RPC configuration.  Confirm the
+checkout is still the reviewed release and the deployer still points to Base:
+
+```bash
+git status --short
+yarn account --network base
+```
+
+Both checks must meet Step 1/2's conditions.  Then deploy once:
+
+```bash
+yarn deploy --network base
+```
+
+Copy the deployed address from the broadcast output into `<TIP_CONTRACT_ADDRESS>`.
+Immediately, from the **same checkout that made the deployment**, verify the
+published source and constructor arguments:
+
+```bash
+yarn verify --network base
+```
+
+Open `https://basescan.org/address/<TIP_CONTRACT_ADDRESS>` and confirm the
+explorer reports verified source, the transaction's sender is
+`<DEPLOYER_ADDRESS>`, and its decoded constructor/initialization values match
+the launch record.  Use contract reads (the explorer's Read Contract tab or
+`cast call` with the ABI) to independently re-check USDC address, fee recipient,
+fee rate, owner/roles, and pause state.
+
+**Go/no-go:** a successful deploy transaction alone is insufficient.  Do not
+make a public frontend until verification and every readback match.  If the
+wrong immutable value was deployed, stop: fix the source and repeat the full
+test → Base-fork → new Base-deploy loop, then discard the wrong address from
+the frontend and record it as never launched.  Never point users at it.
+
+## 5. Point a private frontend at the live contract
+
+`yarn deploy --network base` should regenerate the frontend deployment artifact
+(commonly `packages/nextjs/contracts/deployedContracts.ts`).  Inspect its Base
+entry: it must contain `<TIP_CONTRACT_ADDRESS>`, chain ID `8453`, and the ABI
+with the tip function.  If the project deliberately stores addresses elsewhere,
+update that one tracked production address mapping instead; there must be only
+one source of truth.
+
+In `packages/nextjs/scaffold.config.ts`, make this production change only now:
+
+```ts
+import { base } from "viem/chains";
+
+// ...
+targetNetworks: [base],
+```
+
+Remove `chains.foundry` from the production `targetNetworks` list.  Do not put
+an authenticated RPC URL or API key in this committed file.  If `rpcOverrides`
+is needed, read a public endpoint from an environment variable, for example:
+
+```ts
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org",
+},
+```
+
+Put the value in gitignored `packages/nextjs/.env.local`; any
+`NEXT_PUBLIC_*` value is visible to every browser, so use only a deliberately
+public/quota-limited endpoint there.  Keep a separate authenticated
+`BASE_RPC_URL` solely in `packages/foundry/.env` for deployment/operations.
+
+Run the app locally with the production frontend configuration, but do not
+publish it:
+
+```bash
+cd packages/nextjs
+yarn dev
+```
+
+Connect a normal browser wallet to Base mainnet (chain ID `8453`) and send a
+real $1–$10 tip from a team-controlled fan wallet.  Do not use a deployer or
+fork impersonation account.  Confirm in the wallet and BaseScan that the
+transaction targets `<TIP_CONTRACT_ADDRESS>`, calls the expected function,
+and is confirmed on Base.  Confirm USDC balances in BaseScan: the creator gets
+99%, `<FEE_RECIPIENT>` gets 1%, and there is no duplicate debit or unexplained
+contract balance.  Test the insufficient-allowance path once as well.
+
+**Go/no-go:** this is the live-chain acceptance test.  The public launch is
+blocked until the full real-wallet, real-USDC journey succeeds and the app
+cannot offer localhost/chain 31337 as a production target.  If a deployed
+contract bug is found, the fix is source + regression test + fork rehearsal +
+new deployment + new address artifact + this acceptance test; a UI-only guard
+does not repair a public contract.
+
+## 6. Publish the frontend only after live acceptance
+
+Commit the Base network and deployed-address artifact after reviewing the
+diff:
+
+```bash
+git add packages/nextjs/scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git diff --cached --check
+git commit -m "Point frontend at verified Base tipping contract"
+```
+
+If filenames differ, stage the equivalent tracked configuration/artifact files.
+Before deploying the web host, configure its production environment to use the
+same public Base RPC value as the successful local acceptance test, and set the
+public domain/allowed-wallet-origin values required by this app.  Do not add a
+private key, Foundry `.env`, deployer credential, or multisig signer secret to
+the frontend host.
+
+Use the repository's existing frontend deployment command (check its
+`packages/nextjs/package.json` rather than inventing a provider command), for
+example one of:
+
+```bash
+cd packages/nextjs
+yarn build
+<PROJECT_FRONTEND_DEPLOY_COMMAND>
+```
+
+The production build must pass before the host deploy.  Configure the custom
+domain, HTTPS, and redirect from `www`/non-`www` as chosen by the team.  Do not
+publish a preview URL as the canonical launch URL until it has passed Step 7.
+
+## 7. Smoke-test the public URL, then announce
+
+On a device/browser profile with no development wallet network preselected,
+open `https://<DOMAIN>` over HTTPS.  Check:
+
+1. the wallet prompt requests Base (8453), never localhost (31337);
+2. the displayed USDC amounts have six-decimal-safe formatting and the 1% fee
+   is explained accurately;
+3. the connect, approve, tip, pending, confirmed, rejected, and insufficient
+   balance/allowance states are legible;
+4. the contract link resolves to the verified BaseScan address; and
+5. one further small real tip reaches the same verified contract and splits
+   exactly 99%/1% on-chain.
+
+Keep the BaseScan transaction links and before/after USDC balances in the
+launch record.  Only after all five checks pass may the team announce
+`https://<DOMAIN>`.
+
+## 8. First-day operations and failure rule
+
+For the first 24 hours, one teammate watches BaseScan for transactions to the
+contract and the hosting provider's error/uptime logs; the other checks creator
+and fee-recipient receipts against sampled transaction inputs.  Investigate
+immediately if a transaction has an unexpected split, a frontend error after a
+confirmed transaction, an RPC outage, or a contract balance that should have
+been forwarded.
+
+If the frontend is wrong but the contract is correct, take the public site down
+or show maintenance, correct it, run the private live acceptance test again,
+then redeploy.  If the contract is wrong, do not claim a frontend patch fixed
+it: pause it only if the deployed design authorizes the multisig to do so,
+preserve the evidence, fix and test the source, rehearse on a Base fork,
+redeploy/upgrade according to the actual contract architecture, repoint the
+frontend, and communicate the affected address and any migration to users.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..719012f3b974f61c3070bd78fbfcb71b0436bc7d
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,345 @@
+# Production launch runbook — Base USDC creator tips
+
+This is the ordered production path for the Foundry flavor of Scaffold-ETH 2.
+Perform it from a clean checkout of the application repository, not from this
+directory.  Replace values in angle brackets exactly once, record them in the
+launch record, and do not silently substitute a similarly named address.
+
+**Launch record (fill in before Step 1)**
+
+| Item | Production value |
+| --- | --- |
+| Git commit to release | `<COMMIT_SHA>` |
+| Deployer address | `<DEPLOYER_ADDRESS>` |
+| Base fee-recipient/multisig | `<FEE_RECIPIENT>` |
+| Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Contract name / deployed address | `<TIP_CONTRACT_NAME>` / `<TIP_CONTRACT_ADDRESS>` |
+| Public domain | `https://<DOMAIN>` |
+| Base RPC endpoint (server-side) | `<BASE_RPC_URL>` |
+| Base block explorer | `https://basescan.org` |
+
+The fee recipient must be a two-person-controlled multisig, not either
+developer's wallet.  Confirm that its signers and recovery process are known
+before it is made immutable in a deployment.
+
+## 1. Freeze the exact release and agree the irreversible settings
+
+On a fresh branch in the dApp repository:
+
+```bash
+git checkout <COMMIT_SHA>
+git status --short
+yarn install --immutable
+```
+
+`git status --short` must print nothing, and the install must succeed.  Stop if
+it does not: deployment artifacts generated from a dirty tree cannot be
+reproduced.
+
+Read the tip contract, its deployment script, and tests together.  Write the
+following production values in the launch record and have both teammates review
+them:
+
+* the Base native-USDC address above (it has 6 decimals);
+* the exact 1% representation used by the contract (for example, `100` when
+  the denominator is `10_000`);
+* the fee-recipient multisig;
+* every constructor or initializer argument, including owner/admin and any
+  pause role;
+* whether tips are paid by `transferFrom`, and the intended behavior for a
+  USDC approval of `0`, a tiny tip, and a `1_000_000`-unit ($1) tip.
+
+If any of those are literals in the deploy script, edit that script now.  For a
+typical `packages/foundry/script/Deploy.s.sol`, the deployment must use the
+Base USDC address and `<FEE_RECIPIENT>`; do not leave a mock-token, an Anvil
+address, a test EOA, or a local-chain conditional in its production path.  If
+the script uses environment variables, make the required values explicit with
+`vm.envAddress(...)`/`vm.envUint(...)` rather than supplying unsafe defaults.
+
+Also inspect the withdrawal/admin paths.  They must either be protected by the
+multisig/role above or deliberately unavailable.  A public `setFeeRecipient`,
+`withdraw`, upgrade authorization, or arbitrary-token sweep is a launch
+blocker until its access control and tests are correct.
+
+Update or add Foundry tests for all of these cases before proceeding:
+
+```bash
+cd packages/foundry
+forge test -vvv
+cd ../..
+yarn test
+```
+
+The suite must prove, in USDC's six-decimal units, that a $1.00 tip transfers
+`990000` to the creator and `10000` to the fee recipient (or the contract's
+documented equivalent), that total received equals the tip, that unauthorized
+admin calls revert, and that zero/rounding behavior is intentional.  It must
+also cover failed/insufficient allowance and a USDC transfer failure.  Do not
+continue on a passing happy-path-only suite: these are the failures that an
+otherwise valid browser transaction exposes to users.
+
+Commit the reviewed release:
+
+```bash
+git add packages/foundry
+git commit -m "Configure Base production deployment"
+git rev-parse HEAD
+```
+
+Copy the final hash into `<COMMIT_SHA>`.  Do **not** commit `.env`, `.env.local`,
+private keys, RPC credentials, or deployment seed phrases.
+
+## 2. Create and fund the isolated Base deployer
+
+Use a dedicated hot deployer; it must not be a multisig owner, the fee
+recipient, or a personal day-to-day wallet.  From the repository root:
+
+```bash
+yarn generate
+yarn account --network base
+```
+
+`yarn generate` writes the generated key to the gitignored
+`packages/foundry/.env`.  Record the address printed by `yarn account` as
+`<DEPLOYER_ADDRESS>`, then send it a conservative amount of real ETH on **Base
+mainnet** (enough for deployment, verification retries, and an emergency pause
+if the design has one).  Never paste the key into a chat, shell history, or
+frontend environment file.
+
+Configure the server-side Base RPC in `packages/foundry/.env` using the variable
+name already referenced by `packages/foundry/foundry.toml` (normally
+`BASE_RPC_URL`):
+
+```dotenv
+BASE_RPC_URL=<BASE_RPC_URL>
+```
+
+Keep the existing `ETHERSCAN_API_KEY` that Scaffold-ETH copied from
+`.env.example`; it is already suitable for the immediate verification command.
+Do not replace it with a blank placeholder or delay launch waiting for an
+explorer key.
+
+Re-run:
+
+```bash
+yarn account --network base
+```
+
+**Go/no-go:** it must print `<DEPLOYER_ADDRESS>`, a nonzero Base ETH balance,
+and the Base network/chain ID `8453`.  In the wallet and RPC dashboard, verify
+the funding transaction is on Base—not Ethereum, Base Sepolia, or a local
+network.  Stop and correct the RPC/funding destination if any of these differ.
+
+## 3. Rehearse the exact production deploy on a Base fork
+
+In terminal A, from the repository root, start the target-chain fork using this
+exact argument form:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+form both can leave the argument in the wrong position and silently fork
+Ethereum mainnet.  A fork still reports chain ID `31337`, so that ID does not
+identify what was forked.
+
+Before deploying, prove it is Base by checking code at Base USDC.  In terminal
+B, use the local RPC URL printed by the fork (normally `http://127.0.0.1:8545`):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must be non-empty bytecode.  Empty output is a hard stop: kill the
+fork and restart it with the command above.
+
+Temporarily point the Foundry deployment configuration at that local RPC only
+if its network entry requires it; do not change the source's production USDC
+or fee-recipient values.  Run the same deploy entry point used for production:
+
+```bash
+yarn deploy --network localhost
+```
+
+If this project names the local Foundry network `foundry` rather than
+`localhost`, use `yarn deploy --network foundry`; use the existing network name
+in `foundry.toml`, not a new one.  Save the resulting address, inspect the
+broadcast receipt, and use `cast call` or the project's read script to confirm
+the stored USDC, fee recipient, and fee rate exactly match the launch record.
+
+Then run the frontend against this fork and execute all of the following with a
+browser wallet connected to `http://127.0.0.1:8545` / chain `31337`:
+
+1. import a funded fork account only for the rehearsal;
+2. choose a real Base creator address;
+3. approve USDC, make a $1 tip, and wait for confirmation;
+4. verify creator balance increases by `$0.99`, fee recipient by `$0.01`, and
+   the contract retains no unexpected balance; and
+5. retry with no/too-small approval and verify the UI gives a useful failure
+   state without claiming the tip succeeded.
+
+**Go/no-go:** the script, constructor values, deployed-contract artifact, and
+the browser journey must all succeed.  Any failure means fix source/config,
+add a regression test, commit, and repeat Steps 1–3.  Do not work around a
+contract defect in the UI; direct callers can bypass the UI.
+
+## 4. Deploy and verify on Base while the frontend remains private
+
+Stop the fork and restore any temporary local-RPC configuration.  Confirm the
+checkout is still the reviewed release and the deployer still points to Base:
+
+```bash
+git status --short
+yarn account --network base
+```
+
+Both checks must meet Step 1/2's conditions.  Then deploy once:
+
+```bash
+yarn deploy --network base
+```
+
+Copy the deployed address from the broadcast output into `<TIP_CONTRACT_ADDRESS>`.
+Immediately, from the **same checkout that made the deployment**, verify the
+published source and constructor arguments:
+
+```bash
+yarn verify --network base
+```
+
+Open `https://basescan.org/address/<TIP_CONTRACT_ADDRESS>` and confirm the
+explorer reports verified source, the transaction's sender is
+`<DEPLOYER_ADDRESS>`, and its decoded constructor/initialization values match
+the launch record.  Use contract reads (the explorer's Read Contract tab or
+`cast call` with the ABI) to independently re-check USDC address, fee recipient,
+fee rate, owner/roles, and pause state.
+
+**Go/no-go:** a successful deploy transaction alone is insufficient.  Do not
+make a public frontend until verification and every readback match.  If the
+wrong immutable value was deployed, stop: fix the source and repeat the full
+test → Base-fork → new Base-deploy loop, then discard the wrong address from
+the frontend and record it as never launched.  Never point users at it.
+
+## 5. Point a private frontend at the live contract
+
+`yarn deploy --network base` should regenerate the frontend deployment artifact
+(commonly `packages/nextjs/contracts/deployedContracts.ts`).  Inspect its Base
+entry: it must contain `<TIP_CONTRACT_ADDRESS>`, chain ID `8453`, and the ABI
+with the tip function.  If the project deliberately stores addresses elsewhere,
+update that one tracked production address mapping instead; there must be only
+one source of truth.
+
+In `packages/nextjs/scaffold.config.ts`, make this production change only now:
+
+```ts
+import { base } from "viem/chains";
+
+// ...
+targetNetworks: [base],
+```
+
+Remove `chains.foundry` from the production `targetNetworks` list.  Do not put
+an authenticated RPC URL or API key in this committed file.  If `rpcOverrides`
+is needed, read a public endpoint from an environment variable, for example:
+
+```ts
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org",
+},
+```
+
+Put the value in gitignored `packages/nextjs/.env.local`; any
+`NEXT_PUBLIC_*` value is visible to every browser, so use only a deliberately
+public/quota-limited endpoint there.  Keep a separate authenticated
+`BASE_RPC_URL` solely in `packages/foundry/.env` for deployment/operations.
+
+Run the app locally with the production frontend configuration, but do not
+publish it:
+
+```bash
+cd packages/nextjs
+yarn dev
+```
+
+Connect a normal browser wallet to Base mainnet (chain ID `8453`) and send a
+real $1–$10 tip from a team-controlled fan wallet.  Do not use a deployer or
+fork impersonation account.  Confirm in the wallet and BaseScan that the
+transaction targets `<TIP_CONTRACT_ADDRESS>`, calls the expected function,
+and is confirmed on Base.  Confirm USDC balances in BaseScan: the creator gets
+99%, `<FEE_RECIPIENT>` gets 1%, and there is no duplicate debit or unexplained
+contract balance.  Test the insufficient-allowance path once as well.
+
+**Go/no-go:** this is the live-chain acceptance test.  The public launch is
+blocked until the full real-wallet, real-USDC journey succeeds and the app
+cannot offer localhost/chain 31337 as a production target.  If a deployed
+contract bug is found, the fix is source + regression test + fork rehearsal +
+new deployment + new address artifact + this acceptance test; a UI-only guard
+does not repair a public contract.
+
+## 6. Publish the frontend only after live acceptance
+
+Commit the Base network and deployed-address artifact after reviewing the
+diff:
+
+```bash
+git add packages/nextjs/scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git diff --cached --check
+git commit -m "Point frontend at verified Base tipping contract"
+```
+
+If filenames differ, stage the equivalent tracked configuration/artifact files.
+Before deploying the web host, configure its production environment to use the
+same public Base RPC value as the successful local acceptance test, and set the
+public domain/allowed-wallet-origin values required by this app.  Do not add a
+private key, Foundry `.env`, deployer credential, or multisig signer secret to
+the frontend host.
+
+Use the repository's existing frontend deployment command (check its
+`packages/nextjs/package.json` rather than inventing a provider command), for
+example one of:
+
+```bash
+cd packages/nextjs
+yarn build
+<PROJECT_FRONTEND_DEPLOY_COMMAND>
+```
+
+The production build must pass before the host deploy.  Configure the custom
+domain, HTTPS, and redirect from `www`/non-`www` as chosen by the team.  Do not
+publish a preview URL as the canonical launch URL until it has passed Step 7.
+
+## 7. Smoke-test the public URL, then announce
+
+On a device/browser profile with no development wallet network preselected,
+open `https://<DOMAIN>` over HTTPS.  Check:
+
+1. the wallet prompt requests Base (8453), never localhost (31337);
+2. the displayed USDC amounts have six-decimal-safe formatting and the 1% fee
+   is explained accurately;
+3. the connect, approve, tip, pending, confirmed, rejected, and insufficient
+   balance/allowance states are legible;
+4. the contract link resolves to the verified BaseScan address; and
+5. one further small real tip reaches the same verified contract and splits
+   exactly 99%/1% on-chain.
+
+Keep the BaseScan transaction links and before/after USDC balances in the
+launch record.  Only after all five checks pass may the team announce
+`https://<DOMAIN>`.
+
+## 8. First-day operations and failure rule
+
+For the first 24 hours, one teammate watches BaseScan for transactions to the
+contract and the hosting provider's error/uptime logs; the other checks creator
+and fee-recipient receipts against sampled transaction inputs.  Investigate
+immediately if a transaction has an unexpected split, a frontend error after a
+confirmed transaction, an RPC outage, or a contract balance that should have
+been forwarded.
+
+If the frontend is wrong but the contract is correct, take the public site down
+or show maintenance, correct it, run the private live acceptance test again,
+then redeploy.  If the contract is wrong, do not claim a frontend patch fixed
+it: pause it only if the deployed design authorizes the multisig to do so,
+preserve the evidence, fix and test the source, rehearse on a Base fork,
+redeploy/upgrade according to the actual contract architecture, repoint the
+frontend, and communicate the affected address and any migration to users.

exec
/bin/bash -lc "git diff --check && wc -l LAUNCH.md && sed -n '1,80p' LAUNCH.md && git status --short" in /home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001
 succeeded in 0ms:
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..719012f3b974f61c3070bd78fbfcb71b0436bc7d
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,345 @@
+# Production launch runbook — Base USDC creator tips
+
+This is the ordered production path for the Foundry flavor of Scaffold-ETH 2.
+Perform it from a clean checkout of the application repository, not from this
+directory.  Replace values in angle brackets exactly once, record them in the
+launch record, and do not silently substitute a similarly named address.
+
+**Launch record (fill in before Step 1)**
+
+| Item | Production value |
+| --- | --- |
+| Git commit to release | `<COMMIT_SHA>` |
+| Deployer address | `<DEPLOYER_ADDRESS>` |
+| Base fee-recipient/multisig | `<FEE_RECIPIENT>` |
+| Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Contract name / deployed address | `<TIP_CONTRACT_NAME>` / `<TIP_CONTRACT_ADDRESS>` |
+| Public domain | `https://<DOMAIN>` |
+| Base RPC endpoint (server-side) | `<BASE_RPC_URL>` |
+| Base block explorer | `https://basescan.org` |
+
+The fee recipient must be a two-person-controlled multisig, not either
+developer's wallet.  Confirm that its signers and recovery process are known
+before it is made immutable in a deployment.
+
+## 1. Freeze the exact release and agree the irreversible settings
+
+On a fresh branch in the dApp repository:
+
+```bash
+git checkout <COMMIT_SHA>
+git status --short
+yarn install --immutable
+```
+
+`git status --short` must print nothing, and the install must succeed.  Stop if
+it does not: deployment artifacts generated from a dirty tree cannot be
+reproduced.
+
+Read the tip contract, its deployment script, and tests together.  Write the
+following production values in the launch record and have both teammates review
+them:
+
+* the Base native-USDC address above (it has 6 decimals);
+* the exact 1% representation used by the contract (for example, `100` when
+  the denominator is `10_000`);
+* the fee-recipient multisig;
+* every constructor or initializer argument, including owner/admin and any
+  pause role;
+* whether tips are paid by `transferFrom`, and the intended behavior for a
+  USDC approval of `0`, a tiny tip, and a `1_000_000`-unit ($1) tip.
+
+If any of those are literals in the deploy script, edit that script now.  For a
+typical `packages/foundry/script/Deploy.s.sol`, the deployment must use the
+Base USDC address and `<FEE_RECIPIENT>`; do not leave a mock-token, an Anvil
+address, a test EOA, or a local-chain conditional in its production path.  If
+the script uses environment variables, make the required values explicit with
+`vm.envAddress(...)`/`vm.envUint(...)` rather than supplying unsafe defaults.
+
+Also inspect the withdrawal/admin paths.  They must either be protected by the
+multisig/role above or deliberately unavailable.  A public `setFeeRecipient`,
+`withdraw`, upgrade authorization, or arbitrary-token sweep is a launch
+blocker until its access control and tests are correct.
+
+Update or add Foundry tests for all of these cases before proceeding:
+
+```bash
+cd packages/foundry
+forge test -vvv
+cd ../..
+yarn test
+```
+
+The suite must prove, in USDC's six-decimal units, that a $1.00 tip transfers
+`990000` to the creator and `10000` to the fee recipient (or the contract's
+documented equivalent), that total received equals the tip, that unauthorized
+admin calls revert, and that zero/rounding behavior is intentional.  It must
+also cover failed/insufficient allowance and a USDC transfer failure.  Do not
+continue on a passing happy-path-only suite: these are the failures that an
+otherwise valid browser transaction exposes to users.
+
+Commit the reviewed release:
+
+```bash
+git add packages/foundry
+git commit -m "Configure Base production deployment"
+git rev-parse HEAD
+```
+
+Copy the final hash into `<COMMIT_SHA>`.  Do **not** commit `.env`, `.env.local`,
+private keys, RPC credentials, or deployment seed phrases.
+
+## 2. Create and fund the isolated Base deployer
+
+Use a dedicated hot deployer; it must not be a multisig owner, the fee
+recipient, or a personal day-to-day wallet.  From the repository root:
+
+```bash
+yarn generate
+yarn account --network base
+```
+
+`yarn generate` writes the generated key to the gitignored
+`packages/foundry/.env`.  Record the address printed by `yarn account` as
+`<DEPLOYER_ADDRESS>`, then send it a conservative amount of real ETH on **Base
+mainnet** (enough for deployment, verification retries, and an emergency pause
+if the design has one).  Never paste the key into a chat, shell history, or
+frontend environment file.
+
+Configure the server-side Base RPC in `packages/foundry/.env` using the variable
+name already referenced by `packages/foundry/foundry.toml` (normally
+`BASE_RPC_URL`):
+
+```dotenv
+BASE_RPC_URL=<BASE_RPC_URL>
+```
+
+Keep the existing `ETHERSCAN_API_KEY` that Scaffold-ETH copied from
+`.env.example`; it is already suitable for the immediate verification command.
+Do not replace it with a blank placeholder or delay launch waiting for an
+explorer key.
+
+Re-run:
+
+```bash
+yarn account --network base
+```
+
+**Go/no-go:** it must print `<DEPLOYER_ADDRESS>`, a nonzero Base ETH balance,
+and the Base network/chain ID `8453`.  In the wallet and RPC dashboard, verify
+the funding transaction is on Base—not Ethereum, Base Sepolia, or a local
+network.  Stop and correct the RPC/funding destination if any of these differ.
+
+## 3. Rehearse the exact production deploy on a Base fork
+
+In terminal A, from the repository root, start the target-chain fork using this
+exact argument form:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+form both can leave the argument in the wrong position and silently fork
+Ethereum mainnet.  A fork still reports chain ID `31337`, so that ID does not
+identify what was forked.
+
+Before deploying, prove it is Base by checking code at Base USDC.  In terminal
+B, use the local RPC URL printed by the fork (normally `http://127.0.0.1:8545`):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must be non-empty bytecode.  Empty output is a hard stop: kill the
+fork and restart it with the command above.
+
+Temporarily point the Foundry deployment configuration at that local RPC only
+if its network entry requires it; do not change the source's production USDC
+or fee-recipient values.  Run the same deploy entry point used for production:
+
+```bash
+yarn deploy --network localhost
+```
+
+If this project names the local Foundry network `foundry` rather than
+`localhost`, use `yarn deploy --network foundry`; use the existing network name
+in `foundry.toml`, not a new one.  Save the resulting address, inspect the
+broadcast receipt, and use `cast call` or the project's read script to confirm
+the stored USDC, fee recipient, and fee rate exactly match the launch record.
+
+Then run the frontend against this fork and execute all of the following with a
+browser wallet connected to `http://127.0.0.1:8545` / chain `31337`:
+
+1. import a funded fork account only for the rehearsal;
+2. choose a real Base creator address;
+3. approve USDC, make a $1 tip, and wait for confirmation;
+4. verify creator balance increases by `$0.99`, fee recipient by `$0.01`, and
+   the contract retains no unexpected balance; and
+5. retry with no/too-small approval and verify the UI gives a useful failure
+   state without claiming the tip succeeded.
+
+**Go/no-go:** the script, constructor values, deployed-contract artifact, and
+the browser journey must all succeed.  Any failure means fix source/config,
+add a regression test, commit, and repeat Steps 1–3.  Do not work around a
+contract defect in the UI; direct callers can bypass the UI.
+
+## 4. Deploy and verify on Base while the frontend remains private
+
+Stop the fork and restore any temporary local-RPC configuration.  Confirm the
+checkout is still the reviewed release and the deployer still points to Base:
+
+```bash
+git status --short
+yarn account --network base
+```
+
+Both checks must meet Step 1/2's conditions.  Then deploy once:
+
+```bash
+yarn deploy --network base
+```
+
+Copy the deployed address from the broadcast output into `<TIP_CONTRACT_ADDRESS>`.
+Immediately, from the **same checkout that made the deployment**, verify the
+published source and constructor arguments:
+
+```bash
+yarn verify --network base
+```
+
+Open `https://basescan.org/address/<TIP_CONTRACT_ADDRESS>` and confirm the
+explorer reports verified source, the transaction's sender is
+`<DEPLOYER_ADDRESS>`, and its decoded constructor/initialization values match
+the launch record.  Use contract reads (the explorer's Read Contract tab or
+`cast call` with the ABI) to independently re-check USDC address, fee recipient,
+fee rate, owner/roles, and pause state.
+
+**Go/no-go:** a successful deploy transaction alone is insufficient.  Do not
+make a public frontend until verification and every readback match.  If the
+wrong immutable value was deployed, stop: fix the source and repeat the full
+test → Base-fork → new Base-deploy loop, then discard the wrong address from
+the frontend and record it as never launched.  Never point users at it.
+
+## 5. Point a private frontend at the live contract
+
+`yarn deploy --network base` should regenerate the frontend deployment artifact
+(commonly `packages/nextjs/contracts/deployedContracts.ts`).  Inspect its Base
+entry: it must contain `<TIP_CONTRACT_ADDRESS>`, chain ID `8453`, and the ABI
+with the tip function.  If the project deliberately stores addresses elsewhere,
+update that one tracked production address mapping instead; there must be only
+one source of truth.
+
+In `packages/nextjs/scaffold.config.ts`, make this production change only now:
+
+```ts
+import { base } from "viem/chains";
+
+// ...
+targetNetworks: [base],
+```
+
+Remove `chains.foundry` from the production `targetNetworks` list.  Do not put
+an authenticated RPC URL or API key in this committed file.  If `rpcOverrides`
+is needed, read a public endpoint from an environment variable, for example:
+
+```ts
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org",
+},
+```
+
+Put the value in gitignored `packages/nextjs/.env.local`; any
+`NEXT_PUBLIC_*` value is visible to every browser, so use only a deliberately
+public/quota-limited endpoint there.  Keep a separate authenticated
+`BASE_RPC_URL` solely in `packages/foundry/.env` for deployment/operations.
+
+Run the app locally with the production frontend configuration, but do not
+publish it:
+
+```bash
+cd packages/nextjs
+yarn dev
+```
+
+Connect a normal browser wallet to Base mainnet (chain ID `8453`) and send a
+real $1–$10 tip from a team-controlled fan wallet.  Do not use a deployer or
+fork impersonation account.  Confirm in the wallet and BaseScan that the
+transaction targets `<TIP_CONTRACT_ADDRESS>`, calls the expected function,
+and is confirmed on Base.  Confirm USDC balances in BaseScan: the creator gets
+99%, `<FEE_RECIPIENT>` gets 1%, and there is no duplicate debit or unexplained
+contract balance.  Test the insufficient-allowance path once as well.
+
+**Go/no-go:** this is the live-chain acceptance test.  The public launch is
+blocked until the full real-wallet, real-USDC journey succeeds and the app
+cannot offer localhost/chain 31337 as a production target.  If a deployed
+contract bug is found, the fix is source + regression test + fork rehearsal +
+new deployment + new address artifact + this acceptance test; a UI-only guard
+does not repair a public contract.
+
+## 6. Publish the frontend only after live acceptance
+
+Commit the Base network and deployed-address artifact after reviewing the
+diff:
+
+```bash
+git add packages/nextjs/scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git diff --cached --check
+git commit -m "Point frontend at verified Base tipping contract"
+```
+
+If filenames differ, stage the equivalent tracked configuration/artifact files.
+Before deploying the web host, configure its production environment to use the
+same public Base RPC value as the successful local acceptance test, and set the
+public domain/allowed-wallet-origin values required by this app.  Do not add a
+private key, Foundry `.env`, deployer credential, or multisig signer secret to
+the frontend host.
+
+Use the repository's existing frontend deployment command (check its
+`packages/nextjs/package.json` rather than inventing a provider command), for
+example one of:
+
+```bash
+cd packages/nextjs
+yarn build
+<PROJECT_FRONTEND_DEPLOY_COMMAND>
+```
+
+The production build must pass before the host deploy.  Configure the custom
+domain, HTTPS, and redirect from `www`/non-`www` as chosen by the team.  Do not
+publish a preview URL as the canonical launch URL until it has passed Step 7.
+
+## 7. Smoke-test the public URL, then announce
+
+On a device/browser profile with no development wallet network preselected,
+open `https://<DOMAIN>` over HTTPS.  Check:
+
+1. the wallet prompt requests Base (8453), never localhost (31337);
+2. the displayed USDC amounts have six-decimal-safe formatting and the 1% fee
+   is explained accurately;
+3. the connect, approve, tip, pending, confirmed, rejected, and insufficient
+   balance/allowance states are legible;
+4. the contract link resolves to the verified BaseScan address; and
+5. one further small real tip reaches the same verified contract and splits
+   exactly 99%/1% on-chain.
+
+Keep the BaseScan transaction links and before/after USDC balances in the
+launch record.  Only after all five checks pass may the team announce
+`https://<DOMAIN>`.
+
+## 8. First-day operations and failure rule
+
+For the first 24 hours, one teammate watches BaseScan for transactions to the
+contract and the hosting provider's error/uptime logs; the other checks creator
+and fee-recipient receipts against sampled transaction inputs.  Investigate
+immediately if a transaction has an unexpected split, a frontend error after a
+confirmed transaction, an RPC outage, or a contract balance that should have
+been forwarded.
+
+If the frontend is wrong but the contract is correct, take the public site down
+or show maintenance, correct it, run the private live acceptance test again,
+then redeploy.  If the contract is wrong, do not claim a frontend patch fixed
+it: pause it only if the deployed design authorizes the multisig to do so,
+preserve the evidence, fix and test the source, rehearse on a Base fork,
+redeploy/upgrade according to the actual contract architecture, repoint the
+frontend, and communicate the affected address and any migration to users.

codex
Created the complete ordered production runbook: [LAUNCH.md](/home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001/LAUNCH.md).

It covers Base deployer funding, fork rehearsal, exact deploy/verify sequence, live-but-private wallet acceptance, frontend repointing and publishing, plus stop/go checks and first-day incident handling. `git diff --check` passes.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..719012f3b974f61c3070bd78fbfcb71b0436bc7d
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,345 @@
+# Production launch runbook — Base USDC creator tips
+
+This is the ordered production path for the Foundry flavor of Scaffold-ETH 2.
+Perform it from a clean checkout of the application repository, not from this
+directory.  Replace values in angle brackets exactly once, record them in the
+launch record, and do not silently substitute a similarly named address.
+
+**Launch record (fill in before Step 1)**
+
+| Item | Production value |
+| --- | --- |
+| Git commit to release | `<COMMIT_SHA>` |
+| Deployer address | `<DEPLOYER_ADDRESS>` |
+| Base fee-recipient/multisig | `<FEE_RECIPIENT>` |
+| Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Contract name / deployed address | `<TIP_CONTRACT_NAME>` / `<TIP_CONTRACT_ADDRESS>` |
+| Public domain | `https://<DOMAIN>` |
+| Base RPC endpoint (server-side) | `<BASE_RPC_URL>` |
+| Base block explorer | `https://basescan.org` |
+
+The fee recipient must be a two-person-controlled multisig, not either
+developer's wallet.  Confirm that its signers and recovery process are known
+before it is made immutable in a deployment.
+
+## 1. Freeze the exact release and agree the irreversible settings
+
+On a fresh branch in the dApp repository:
+
+```bash
+git checkout <COMMIT_SHA>
+git status --short
+yarn install --immutable
+```
+
+`git status --short` must print nothing, and the install must succeed.  Stop if
+it does not: deployment artifacts generated from a dirty tree cannot be
+reproduced.
+
+Read the tip contract, its deployment script, and tests together.  Write the
+following production values in the launch record and have both teammates review
+them:
+
+* the Base native-USDC address above (it has 6 decimals);
+* the exact 1% representation used by the contract (for example, `100` when
+  the denominator is `10_000`);
+* the fee-recipient multisig;
+* every constructor or initializer argument, including owner/admin and any
+  pause role;
+* whether tips are paid by `transferFrom`, and the intended behavior for a
+  USDC approval of `0`, a tiny tip, and a `1_000_000`-unit ($1) tip.
+
+If any of those are literals in the deploy script, edit that script now.  For a
+typical `packages/foundry/script/Deploy.s.sol`, the deployment must use the
+Base USDC address and `<FEE_RECIPIENT>`; do not leave a mock-token, an Anvil
+address, a test EOA, or a local-chain conditional in its production path.  If
+the script uses environment variables, make the required values explicit with
+`vm.envAddress(...)`/`vm.envUint(...)` rather than supplying unsafe defaults.
+
+Also inspect the withdrawal/admin paths.  They must either be protected by the
+multisig/role above or deliberately unavailable.  A public `setFeeRecipient`,
+`withdraw`, upgrade authorization, or arbitrary-token sweep is a launch
+blocker until its access control and tests are correct.
+
+Update or add Foundry tests for all of these cases before proceeding:
+
+```bash
+cd packages/foundry
+forge test -vvv
+cd ../..
+yarn test
+```
+
+The suite must prove, in USDC's six-decimal units, that a $1.00 tip transfers
+`990000` to the creator and `10000` to the fee recipient (or the contract's
+documented equivalent), that total received equals the tip, that unauthorized
+admin calls revert, and that zero/rounding behavior is intentional.  It must
+also cover failed/insufficient allowance and a USDC transfer failure.  Do not
+continue on a passing happy-path-only suite: these are the failures that an
+otherwise valid browser transaction exposes to users.
+
+Commit the reviewed release:
+
+```bash
+git add packages/foundry
+git commit -m "Configure Base production deployment"
+git rev-parse HEAD
+```
+
+Copy the final hash into `<COMMIT_SHA>`.  Do **not** commit `.env`, `.env.local`,
+private keys, RPC credentials, or deployment seed phrases.
+
+## 2. Create and fund the isolated Base deployer
+
+Use a dedicated hot deployer; it must not be a multisig owner, the fee
+recipient, or a personal day-to-day wallet.  From the repository root:
+
+```bash
+yarn generate
+yarn account --network base
+```
+
+`yarn generate` writes the generated key to the gitignored
+`packages/foundry/.env`.  Record the address printed by `yarn account` as
+`<DEPLOYER_ADDRESS>`, then send it a conservative amount of real ETH on **Base
+mainnet** (enough for deployment, verification retries, and an emergency pause
+if the design has one).  Never paste the key into a chat, shell history, or
+frontend environment file.
+
+Configure the server-side Base RPC in `packages/foundry/.env` using the variable
+name already referenced by `packages/foundry/foundry.toml` (normally
+`BASE_RPC_URL`):
+
+```dotenv
+BASE_RPC_URL=<BASE_RPC_URL>
+```
+
+Keep the existing `ETHERSCAN_API_KEY` that Scaffold-ETH copied from
+`.env.example`; it is already suitable for the immediate verification command.
+Do not replace it with a blank placeholder or delay launch waiting for an
+explorer key.
+
+Re-run:
+
+```bash
+yarn account --network base
+```
+
+**Go/no-go:** it must print `<DEPLOYER_ADDRESS>`, a nonzero Base ETH balance,
+and the Base network/chain ID `8453`.  In the wallet and RPC dashboard, verify
+the funding transaction is on Base—not Ethereum, Base Sepolia, or a local
+network.  Stop and correct the RPC/funding destination if any of these differ.
+
+## 3. Rehearse the exact production deploy on a Base fork
+
+In terminal A, from the repository root, start the target-chain fork using this
+exact argument form:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+form both can leave the argument in the wrong position and silently fork
+Ethereum mainnet.  A fork still reports chain ID `31337`, so that ID does not
+identify what was forked.
+
+Before deploying, prove it is Base by checking code at Base USDC.  In terminal
+B, use the local RPC URL printed by the fork (normally `http://127.0.0.1:8545`):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must be non-empty bytecode.  Empty output is a hard stop: kill the
+fork and restart it with the command above.
+
+Temporarily point the Foundry deployment configuration at that local RPC only
+if its network entry requires it; do not change the source's production USDC
+or fee-recipient values.  Run the same deploy entry point used for production:
+
+```bash
+yarn deploy --network localhost
+```
+
+If this project names the local Foundry network `foundry` rather than
+`localhost`, use `yarn deploy --network foundry`; use the existing network name
+in `foundry.toml`, not a new one.  Save the resulting address, inspect the
+broadcast receipt, and use `cast call` or the project's read script to confirm
+the stored USDC, fee recipient, and fee rate exactly match the launch record.
+
+Then run the frontend against this fork and execute all of the following with a
+browser wallet connected to `http://127.0.0.1:8545` / chain `31337`:
+
+1. import a funded fork account only for the rehearsal;
+2. choose a real Base creator address;
+3. approve USDC, make a $1 tip, and wait for confirmation;
+4. verify creator balance increases by `$0.99`, fee recipient by `$0.01`, and
+   the contract retains no unexpected balance; and
+5. retry with no/too-small approval and verify the UI gives a useful failure
+   state without claiming the tip succeeded.
+
+**Go/no-go:** the script, constructor values, deployed-contract artifact, and
+the browser journey must all succeed.  Any failure means fix source/config,
+add a regression test, commit, and repeat Steps 1–3.  Do not work around a
+contract defect in the UI; direct callers can bypass the UI.
+
+## 4. Deploy and verify on Base while the frontend remains private
+
+Stop the fork and restore any temporary local-RPC configuration.  Confirm the
+checkout is still the reviewed release and the deployer still points to Base:
+
+```bash
+git status --short
+yarn account --network base
+```
+
+Both checks must meet Step 1/2's conditions.  Then deploy once:
+
+```bash
+yarn deploy --network base
+```
+
+Copy the deployed address from the broadcast output into `<TIP_CONTRACT_ADDRESS>`.
+Immediately, from the **same checkout that made the deployment**, verify the
+published source and constructor arguments:
+
+```bash
+yarn verify --network base
+```
+
+Open `https://basescan.org/address/<TIP_CONTRACT_ADDRESS>` and confirm the
+explorer reports verified source, the transaction's sender is
+`<DEPLOYER_ADDRESS>`, and its decoded constructor/initialization values match
+the launch record.  Use contract reads (the explorer's Read Contract tab or
+`cast call` with the ABI) to independently re-check USDC address, fee recipient,
+fee rate, owner/roles, and pause state.
+
+**Go/no-go:** a successful deploy transaction alone is insufficient.  Do not
+make a public frontend until verification and every readback match.  If the
+wrong immutable value was deployed, stop: fix the source and repeat the full
+test → Base-fork → new Base-deploy loop, then discard the wrong address from
+the frontend and record it as never launched.  Never point users at it.
+
+## 5. Point a private frontend at the live contract
+
+`yarn deploy --network base` should regenerate the frontend deployment artifact
+(commonly `packages/nextjs/contracts/deployedContracts.ts`).  Inspect its Base
+entry: it must contain `<TIP_CONTRACT_ADDRESS>`, chain ID `8453`, and the ABI
+with the tip function.  If the project deliberately stores addresses elsewhere,
+update that one tracked production address mapping instead; there must be only
+one source of truth.
+
+In `packages/nextjs/scaffold.config.ts`, make this production change only now:
+
+```ts
+import { base } from "viem/chains";
+
+// ...
+targetNetworks: [base],
+```
+
+Remove `chains.foundry` from the production `targetNetworks` list.  Do not put
+an authenticated RPC URL or API key in this committed file.  If `rpcOverrides`
+is needed, read a public endpoint from an environment variable, for example:
+
+```ts
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org",
+},
+```
+
+Put the value in gitignored `packages/nextjs/.env.local`; any
+`NEXT_PUBLIC_*` value is visible to every browser, so use only a deliberately
+public/quota-limited endpoint there.  Keep a separate authenticated
+`BASE_RPC_URL` solely in `packages/foundry/.env` for deployment/operations.
+
+Run the app locally with the production frontend configuration, but do not
+publish it:
+
+```bash
+cd packages/nextjs
+yarn dev
+```
+
+Connect a normal browser wallet to Base mainnet (chain ID `8453`) and send a
+real $1–$10 tip from a team-controlled fan wallet.  Do not use a deployer or
+fork impersonation account.  Confirm in the wallet and BaseScan that the
+transaction targets `<TIP_CONTRACT_ADDRESS>`, calls the expected function,
+and is confirmed on Base.  Confirm USDC balances in BaseScan: the creator gets
+99%, `<FEE_RECIPIENT>` gets 1%, and there is no duplicate debit or unexplained
+contract balance.  Test the insufficient-allowance path once as well.
+
+**Go/no-go:** this is the live-chain acceptance test.  The public launch is
+blocked until the full real-wallet, real-USDC journey succeeds and the app
+cannot offer localhost/chain 31337 as a production target.  If a deployed
+contract bug is found, the fix is source + regression test + fork rehearsal +
+new deployment + new address artifact + this acceptance test; a UI-only guard
+does not repair a public contract.
+
+## 6. Publish the frontend only after live acceptance
+
+Commit the Base network and deployed-address artifact after reviewing the
+diff:
+
+```bash
+git add packages/nextjs/scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git diff --cached --check
+git commit -m "Point frontend at verified Base tipping contract"
+```
+
+If filenames differ, stage the equivalent tracked configuration/artifact files.
+Before deploying the web host, configure its production environment to use the
+same public Base RPC value as the successful local acceptance test, and set the
+public domain/allowed-wallet-origin values required by this app.  Do not add a
+private key, Foundry `.env`, deployer credential, or multisig signer secret to
+the frontend host.
+
+Use the repository's existing frontend deployment command (check its
+`packages/nextjs/package.json` rather than inventing a provider command), for
+example one of:
+
+```bash
+cd packages/nextjs
+yarn build
+<PROJECT_FRONTEND_DEPLOY_COMMAND>
+```
+
+The production build must pass before the host deploy.  Configure the custom
+domain, HTTPS, and redirect from `www`/non-`www` as chosen by the team.  Do not
+publish a preview URL as the canonical launch URL until it has passed Step 7.
+
+## 7. Smoke-test the public URL, then announce
+
+On a device/browser profile with no development wallet network preselected,
+open `https://<DOMAIN>` over HTTPS.  Check:
+
+1. the wallet prompt requests Base (8453), never localhost (31337);
+2. the displayed USDC amounts have six-decimal-safe formatting and the 1% fee
+   is explained accurately;
+3. the connect, approve, tip, pending, confirmed, rejected, and insufficient
+   balance/allowance states are legible;
+4. the contract link resolves to the verified BaseScan address; and
+5. one further small real tip reaches the same verified contract and splits
+   exactly 99%/1% on-chain.
+
+Keep the BaseScan transaction links and before/after USDC balances in the
+launch record.  Only after all five checks pass may the team announce
+`https://<DOMAIN>`.
+
+## 8. First-day operations and failure rule
+
+For the first 24 hours, one teammate watches BaseScan for transactions to the
+contract and the hosting provider's error/uptime logs; the other checks creator
+and fee-recipient receipts against sampled transaction inputs.  Investigate
+immediately if a transaction has an unexpected split, a frontend error after a
+confirmed transaction, an RPC outage, or a contract balance that should have
+been forwarded.
+
+If the frontend is wrong but the contract is correct, take the public site down
+or show maintenance, correct it, run the private live acceptance test again,
+then redeploy.  If the contract is wrong, do not claim a frontend patch fixed
+it: pause it only if the deployed design authorizes the multisig to do so,
+preserve the evidence, fix and test the source, rehearse on a Base fork,
+redeploy/upgrade according to the actual contract architecture, repoint the
+frontend, and communicate the affected address and any migration to users.

tokens used
21,583
````

## final message

Created the complete ordered production runbook: [LAUNCH.md](/home/damu/.cache/ethskills-evals/2026-09-03T190411Z-codex-with-skill-1/orchestration-goal-001/LAUNCH.md).

It covers Base deployer funding, fork rehearsal, exact deploy/verify sequence, live-but-private wallet acceptance, frontend repointing and publishing, plus stop/go checks and first-day incident handling. `git diff --check` passes.
