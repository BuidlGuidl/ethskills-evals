# Executor transcript — 2026-09-03T190413Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a068b0-4a6d-74a2-a663-25420695454d
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
I’m using the launch-orchestration guidance because this is a live Base deployment plan. I’ll turn the current local-fork milestone into a verbatim, gated production runbook.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md && printf '\\n--- workspace ---\\n' && rg --files -g 'AGENTS.md' -g 'README*' -g 'package.json' -g 'foundry.toml' -g '.env*' | sed -n '1,160p'" in /home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 29ms:
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

--- workspace ---
package.json

exec
/bin/bash -lc "sed -n '1,260p' package.json && find . -maxdepth 3 -type f -not -path './.git/*' -printf '%p\\n' | sort | sed -n '1,240p' && rg -n \"(Base|base|Foundry|Vercel|deploy|verify|USDC|scaffold)\" . --glob '"'!**/.git/**'"' --glob '"'!LAUNCH.md'"' | sed -n '1,260p'" in /home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 10ms:
./TASK.md
./package.json
./TASK.md:2:flavor): a creator-tipping app where fans tip creators in USDC and the
./TASK.md:7:Nothing has touched a live network yet: no live deployment, no funded
./TASK.md:8:accounts, nothing public. Target chain is Base. We want real users on a

exec
/bin/bash -lc "sed -n '1,220p' TASK.md && find .agents/skills -type f -name 'SKILL.md' -printf '%p\\n' | sort" in /home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001
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
.agents/skills/orchestration/SKILL.md

codex
The key launch boundary is deliberate: deploy and verify on Base first, then exercise the live contract from localhost with small real transfers, and only then publish the frontend. I’m capturing that as hard stop/go gates rather than a loose checklist.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..3b69dde92bde5eb2fdd6ce54220e9bd3269ffb34
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,462 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 8.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install --immutable
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+git checkout -b release/base-mainnet-$(date +%F) RELEASE_SHA
+git status --short
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal (strongly recommended gate)
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the exact `RELEASE_SHA` plus only fixes made during the rehearsal.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Commit the reviewed generated `deployedContracts.ts` and Base-only frontend
+configuration (never either `.env` file), then run the same CI-equivalent
+checks once more:
+
+```bash
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+yarn format:check
+yarn lint
+yarn test
+yarn build
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..3b69dde92bde5eb2fdd6ce54220e9bd3269ffb34
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,462 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 8.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install --immutable
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+git checkout -b release/base-mainnet-$(date +%F) RELEASE_SHA
+git status --short
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal (strongly recommended gate)
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the exact `RELEASE_SHA` plus only fixes made during the rehearsal.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Commit the reviewed generated `deployedContracts.ts` and Base-only frontend
+configuration (never either `.env` file), then run the same CI-equivalent
+checks once more:
+
+```bash
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+yarn format:check
+yarn lint
+yarn test
+yarn build
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

exec
/bin/bash -lc "rg -n \"format:check|RELEASE_SHA|BASE_RPC_URL\" LAUNCH.md && sed -n '1,120p' LAUNCH.md && sed -n '260,440p' LAUNCH.md && git diff --check && git status --short" in /home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 9ms:
| Network / chain ID | Base / `8453` |
| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
| Token decimals | `6` |
| Platform fee | `100` basis points of `10_000` (= 1%) |
| Fee recipient | `FEE_RECIPIENT` Safe address |
| Owner/admin | `OWNER_ADDRESS` |
| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |

Run the final commands, with the fork still available if the deployment script
needs the last local replay:

```bash
git status --short
yarn format:check
yarn lint
yarn test
cd packages/foundry && forge test -vvv && cd ../..
yarn account --network base
```

Confirm the deployed artifact directory contains no old mainnet deployment
that the frontend might accidentally use.  Confirm the platform Safe is a
contract/address the team controls on Base and not an EOA copied from another
chain.  Estimate the deployment using the configured Base RPC if the project
has a dry-run command; otherwise the funded-balance requirement above is the
preflight.

**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
are green, `git status` contains no secret, and the deployer is funded on
Base.  **STOP:** a value is inferred from memory, a recipient cannot be
verified, the deployment account changes, or anything changed after review.

## 6. Deploy the immutable production contract

From the release checkout whose `packages/foundry/.env` contains the approved
mainnet values, run exactly:

```bash
yarn deploy --network base
```

Do not run it twice because a transaction looks slow.  Wait for the command
to return a transaction hash and contract address, then confirm on
BaseScan that the transaction succeeded on chain `8453`, the `from` address
is `DEPLOYER_ADDRESS`, and the created address is non-empty.

Immediately, from this same checkout and before another deployment changes
the broadcast record, verify source:

```bash
yarn verify --network base
```

`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
from a different checkout or after a second deployment can verify the wrong
contract.  On BaseScan, check the verified source, compiler/optimizer
settings, constructor arguments, and read methods/state for the token,
100-bps fee, fee recipient, owner, and initial creator configuration.  Save
the transaction hash, contract address, verified BaseScan URL, block number,
and artifact checksum in the private release record.

If the contract has post-deploy admin setup (creator allowlist, ownership
transfer, pause state), submit it from the approved Safe only after each team
member decodes the calldata and compares it to the release record.  Confirm
each transaction and reread contract state before the next one.

**GO:** exactly one intended contract is deployed, source is verified,
on-chain constructor/state values match the table, and post-deploy setup is
confirmed.  **STOP:** verification fails, the address/arguments are wrong,
or an unapproved transaction is broadcast.  Do not point any frontend at it.
For a wrong immutable deployment, correct source/config, add a regression
test, deploy a new contract, and treat the wrong address as abandoned.

## 7. Private live-contract acceptance from localhost

This is the required middle stage.  The contract is live, but the frontend is
still only on `localhost`, so the team can fix UI issues without exposing
users to them.

Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
generated `packages/nextjs/contracts/deployedContracts.ts` contains the
address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
Base RPC URL.  Generate the artifact through the normal deploy process; if
the project did not generate it automatically, use its existing generator or
update only the deployment entry with the verified ABI/address--never invent
an ABI by hand.  Then run:

```bash
yarn build
yarn start
```

At `http://localhost:3000`, connect the first fan test wallet and confirm the
wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
creator test wallet.  Use the actual displayed USDC balance/decimal format;
do not use a test token.  In the wallet, inspect the spender before approval:
it must be the verified production contract address.  If the UI supports an
exact approval, approve only the tip amount; if it requests a larger
allowance, stop and decide whether that UX is acceptable before public launch.

After confirmation, independently inspect the BaseScan receipt and read
balances with a second method (wallet, BaseScan token tab, or `cast`):

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
  --rpc-url "$BASE_RPC_URL"
```

For the tip amount `A` (USDC base units), the creator receives the contract's
documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
the reviewed rounding rule.  Confirm all emitted events and UI messages match
the confirmed transaction, not merely submission.

Repeat with the second fan wallet and cover: wallet rejection, wrong-network
prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
failing/invalid creator action.  Confirm each failure is comprehensible and
no funds leave the wallet.  Load the app in an incognito window and mobile
wallet browser as a final wallet/RPC/CORS check.

**GO:** two real users have completed live transactions; creator and Safe
balances/events reconcile; every tested failure is safe and clear; no local
address, testnet label, or secret is exposed.  **STOP:** any mismatch in
token, fee, recipient, spender, event, network, or UI state.  Fix it before
publishing.  A frontend validation can improve UX, but it cannot fix a
contract bug because users and integrators can call the contract directly.

## 8. Publish the frontend

Commit the reviewed generated `deployedContracts.ts` and Base-only frontend
configuration (never either `.env` file), then run the same CI-equivalent
checks once more:

```bash
git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
git commit -m "chore: configure verified Base production deployment"
git status --short
yarn format:check
yarn lint
yarn test
yarn build
```

Set production environment variables with your host.  For Vercel, from
`packages/nextjs`, link the correct project and add the browser-safe values:

```bash
cd packages/nextjs
vercel link
vercel env add NEXT_PUBLIC_BASE_RPC_URL production
vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
vercel --prod
```

Enter the restricted browser RPC URL and WalletConnect ID only if the app
uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
Vercel project, wait for the DNS/SSL checks to pass, and make the intended
domain the production domain.  If another host is used, set the same public
variables in its production environment, build there, and deploy its
production artifact; the security boundary is the same.

**GO:** the host reports a successful production build, custom-domain DNS and
TLS are healthy, and its environment contains only browser-safe settings.
**STOP:** build differs from the local production build, a secret reached the
host, or the public build references a local/testnet/wrong contract address.

## 9. Public smoke test and release

Before announcing, open the final `https://<production-domain>` yourself in
an incognito desktop browser and a mobile wallet browser.  Check the network
is Base, the displayed contract address links to the verified BaseScan page,
the token is canonical USDC, and the fee disclosure says 1%.

Put one final small real transaction through the **public URL** using the
second fan wallet.  Confirm the wallet spender, confirmation, receipt,
creator balance, Safe balance, event, and user-facing success/failure state
exactly as in step 7.  Save the receipt URL in the release record.

Only after this passes, publish the canonical URL, verified contract/BaseScan
link, Base chain requirement, USDC token address, fee disclosure, and a
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..3b69dde92bde5eb2fdd6ce54220e9bd3269ffb34
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,462 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 8.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install --immutable
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+git checkout -b release/base-mainnet-$(date +%F) RELEASE_SHA
+git status --short
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal (strongly recommended gate)
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the exact `RELEASE_SHA` plus only fixes made during the rehearsal.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format:check
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Commit the reviewed generated `deployedContracts.ts` and Base-only frontend
+configuration (never either `.env` file), then run the same CI-equivalent
+checks once more:
+
+```bash
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+yarn format:check
+yarn lint
+yarn test
+yarn build
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..78500fb091fff6b347b9f406b34fcddddc941008
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,464 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal (strongly recommended gate)
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the exact `RELEASE_SHA` plus only fixes made during the rehearsal.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Commit the reviewed generated `deployedContracts.ts` and Base-only frontend
+configuration (never either `.env` file), then run the same CI-equivalent
+checks once more:
+
+```bash
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+yarn format
+yarn lint
+yarn test
+yarn build
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..78500fb091fff6b347b9f406b34fcddddc941008
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,464 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal (strongly recommended gate)
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the exact `RELEASE_SHA` plus only fixes made during the rehearsal.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Commit the reviewed generated `deployedContracts.ts` and Base-only frontend
+configuration (never either `.env` file), then run the same CI-equivalent
+checks once more:
+
+```bash
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+yarn format
+yarn lint
+yarn test
+yarn build
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

exec
/bin/bash -lc 'git diff --check && rg -n "''^## |format:check|step 8|RELEASE_SHA|yarn format|set -a" LAUNCH.md && wc -l LAUNCH.md && git diff -- LAUNCH.md | sed -n '"'1,80p'" in /home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 8ms:
20:## 0. Roles, accounts, and a release record
31:| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
57:and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
60:## 1. Freeze and review the release
66:export RELEASE_SHA="$(git rev-parse HEAD)"
67:git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
69:yarn format
108:## 2. Make the Base configuration explicit (without committing secrets)
183:## 3. Re-run the final source against a fresh Base fork
229:## 4. Base Sepolia rehearsal (strongly recommended gate)
253:## 5. Mainnet preflight: final parameters and money
255:Return to the exact `RELEASE_SHA` plus only fixes made during the rehearsal.
274:yarn format
293:## 6. Deploy the immutable production contract
334:## 7. Private live-contract acceptance from localhost
365:set -a; source packages/foundry/.env; set +a
389:## 8. Publish the frontend
399:yarn format
429:## 9. Public smoke test and release
449:## 10. First-day monitoring and incident rule
464 LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..78500fb091fff6b347b9f406b34fcddddc941008
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,464 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal (strongly recommended gate)
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the exact `RELEASE_SHA` plus only fixes made during the rehearsal.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Commit the reviewed generated `deployedContracts.ts` and Base-only frontend
+configuration (never either `.env` file), then run the same CI-equivalent
+checks once more:
+
+```bash
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+yarn format
+yarn lint
+yarn test
+yarn build
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31875316c97a0937fcf186704ee475067e8ad317
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,468 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the release branch.  If the rehearsal required a fix, commit only
+the reviewed fix and its regression test, then update the release record with
+the new commit as `RELEASE_SHA`; both people re-approve it.  If no fix was
+needed, retain the existing `RELEASE_SHA`.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Run the same CI-equivalent checks, then commit the reviewed generated
+`deployedContracts.ts` and Base-only frontend configuration (never either
+`.env` file):
+
+```bash
+yarn format
+yarn lint
+yarn test
+yarn build
+git diff --check
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31875316c97a0937fcf186704ee475067e8ad317
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,468 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the release branch.  If the rehearsal required a fix, commit only
+the reviewed fix and its regression test, then update the release record with
+the new commit as `RELEASE_SHA`; both people re-approve it.  If no fix was
+needed, retain the existing `RELEASE_SHA`.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Run the same CI-equivalent checks, then commit the reviewed generated
+`deployedContracts.ts` and Base-only frontend configuration (never either
+`.env` file):
+
+```bash
+yarn format
+yarn lint
+yarn test
+yarn build
+git diff --check
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

codex
I’ve completed the runbook draft and am doing a final consistency pass on the command order, handoff artifacts, and the non-negotiable live-contract-before-public-URL gate.
web search: 
web search: https://docs.base.org/docs/apps/verified-contracts/
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31875316c97a0937fcf186704ee475067e8ad317
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,468 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the release branch.  If the rehearsal required a fix, commit only
+the reviewed fix and its regression test, then update the release record with
+the new commit as `RELEASE_SHA`; both people re-approve it.  If no fix was
+needed, retain the existing `RELEASE_SHA`.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Run the same CI-equivalent checks, then commit the reviewed generated
+`deployedContracts.ts` and Base-only frontend configuration (never either
+`.env` file):
+
+```bash
+yarn format
+yarn lint
+yarn test
+yarn build
+git diff --check
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

web search: 
web search: site:docs.base.org USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31875316c97a0937fcf186704ee475067e8ad317
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,468 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the release branch.  If the rehearsal required a fix, commit only
+the reviewed fix and its regression test, then update the release record with
+the new commit as `RELEASE_SHA`; both people re-approve it.  If no fix was
+needed, retain the existing `RELEASE_SHA`.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Run the same CI-equivalent checks, then commit the reviewed generated
+`deployedContracts.ts` and Base-only frontend configuration (never either
+`.env` file):
+
+```bash
+yarn format
+yarn lint
+yarn test
+yarn build
+git diff --check
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

codex
Created [LAUNCH.md](/home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md).

It provides a gated, ordered Base mainnet launch path: release review, secret/account setup, Base fork rerun, Sepolia rehearsal, deploy + immediate verification, localhost acceptance with real Base USDC, Vercel publication, public smoke transaction, and first-day monitoring/incident handling.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..31875316c97a0937fcf186704ee475067e8ad317
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,468 @@
+# Base production launch runbook
+
+This is the runbook for the Foundry flavour of Scaffold-ETH 2.  It assumes
+the current application already passes its tests and the complete flow works
+against a Base fork on `localhost`.  Do the steps in order.  A **STOP** means
+do not continue, do not publish the frontend, and do not try to repair a
+deployed implementation with a UI-only change.
+
+The production chain is **Base mainnet** (`chainId: 8453`), not Base Sepolia.
+The canonical Base USDC address is
+`0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913`; it has **6 decimals**.  Copy
+that address from the [official Base USDC documentation](https://docs.base.org/docs/apps/verified-contracts/)
+when doing the on-screen confirmations as a defence against clipboard and
+look-alike-token mistakes.
+
+The final, public contract address is deliberately not known until step 6.
+Never put a guessed address in a frontend, deployment script, DNS record, or
+social post.
+
+## 0. Roles, accounts, and a release record
+
+Do this before changing the repository.  The two people should agree in
+writing on these values and save them in the private release record:
+
+| Purpose | Value to record | Rule |
+| --- | --- | --- |
+| Deployment EOA | `DEPLOYER_ADDRESS` | A new dedicated EOA, never a personal everyday wallet. |
+| Platform-fee recipient | `FEE_RECIPIENT` | A Base 2-of-2 Safe controlled one signer each. |
+| Emergency/owner address | `OWNER_ADDRESS` | The Safe unless the contract's design has a documented, tested alternative. |
+| Initial creators | Creator addresses and payout addresses | Each creator confirms the exact address out-of-band. |
+| Release commit | `RELEASE_SHA` | Both people review and sign off on this immutable git commit. |
+
+Create the 2-of-2 Safe on **Base mainnet** before deployment, and verify its
+chain in the wallet.  Fund the dedicated deployer with enough real Base ETH
+for deployment plus at least 50% headroom.  Fund two independent fan test
+wallets with $1--10 USDC each and enough Base ETH for approval and tip
+transactions.  Fund a creator test wallet with a little Base ETH as well.
+
+From the repository root, create the Scaffold deployer only if one does not
+already exist:
+
+```bash
+yarn install
+yarn generate
+yarn account
+yarn account --network base
+```
+
+`yarn generate` writes the private key to `packages/foundry/.env`.  Confirm
+that this file is ignored and that `git status --ignored` lists it as ignored;
+do not paste its contents into chat, issues, Vercel, or a shared document.
+`yarn account --network base` must print `DEPLOYER_ADDRESS` and a non-zero
+Base ETH balance.  A native-ETH balance on Ethereum, or a balance on Base
+Sepolia, does not count.
+
+**GO:** both people can identify the Safe, deployer, test-wallet balances,
+and `RELEASE_SHA`; `packages/foundry/.env` is ignored.  **STOP:** any role is
+a personal wallet, the account is unfunded on Base, or a secret is tracked.
+
+## 1. Freeze and review the release
+
+Create the release branch/tag from the tested commit, then make no unrelated
+product changes during this runbook:
+
+```bash
+export RELEASE_SHA="$(git rev-parse HEAD)"
+git checkout -b release/base-mainnet-$(date +%F) "$RELEASE_SHA"
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+```
+
+If this project uses a different script name for formatting or tests, run the
+script named in its `package.json`; do not silently skip a missing command.
+
+The two reviewers now inspect the deployed contract constructor and every
+external/state-changing function.  Record the answers:
+
+- The contract hard-codes or receives the canonical USDC address above, not a
+  user-supplied token address; it uses `IERC20Metadata(token).decimals()` or
+  treats USDC amounts as 6-decimal units.  No amount is converted through a
+  JavaScript floating point number.
+- The fee calculation is `amount * 100 / 10_000` (1%), with an explicitly
+  tested rounding policy.  The creator and fee transfers sum exactly to the
+  amount received, including at the smallest supported tip.
+- USDC transfers use OpenZeppelin `SafeERC20`; neither approval nor transfer
+  assumes that an ERC-20 returns `true` in an unsafe way.
+- Only the intended authority can change the fee, fee recipient, owner,
+  pause state, or creator records.  If any of these settings are immutable,
+  both people explicitly accept that fact.  If they are mutable, the Safe is
+  the authority and each admin path has an event and a test.
+- Reentrancy, zero address/zero amount, duplicate or invalid creator,
+  pause/withdrawal behavior, and failure of an ERC-20 transfer have tests.
+- Events contain enough indexed data to attribute a tip, creator payout, and
+  platform fee.  The UI does not claim success merely because a wallet opened;
+  it waits for a confirmed receipt and handles rejection/revert/replacement.
+
+Add a regression test for every issue found, then rerun the commands above.
+
+**GO:** clean worktree apart from intentional release files, all checks pass,
+and both people approve the constructor arguments, USDC address, fee math,
+and admin model.  **STOP:** a reviewer cannot explain an admin path, decimal
+handling, or the fee split.  Fix source and tests first; do not defer it to
+the frontend.
+
+## 2. Make the Base configuration explicit (without committing secrets)
+
+In `packages/foundry/.env` (ignored), set the private RPC and deployer values
+used by the Foundry scripts.  Preserve the existing `ETHERSCAN_API_KEY` copied
+from `packages/foundry/.env.example`; Scaffold-ETH 2 supplies a usable value
+for verification, so acquiring a new explorer key is not a launch blocker.
+
+```dotenv
+# packages/foundry/.env -- never commit
+DEPLOYER_PRIVATE_KEY=0x<dedicated-deployer-private-key>
+BASE_RPC_URL=https://<your-authenticated-base-rpc-endpoint>
+USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913
+FEE_RECIPIENT=0x<the-2-of-2-safe>
+OWNER_ADDRESS=0x<the-approved-owner>
+```
+
+Use the variable names that the existing deployment script reads.  If it
+currently has literal constructor arguments, replace them with the exact
+environment reads required by its constructor, for example:
+
+```solidity
+address usdc = vm.envAddress("USDC_ADDRESS");
+address feeRecipient = vm.envAddress("FEE_RECIPIENT");
+address owner = vm.envAddress("OWNER_ADDRESS");
+// deploy with usdc, feeRecipient, owner and the literal fee 100 (basis points)
+```
+
+Do not add a private RPC URL or API key to the committed
+`scaffold.config.ts`.  For the Next.js app, create the ignored file
+`packages/nextjs/.env.local`:
+
+```dotenv
+# This endpoint will be read by browsers.  Use a separate read-only Base key
+# restricted by allowed origin/quota; it is not the Foundry deployment RPC key.
+NEXT_PUBLIC_BASE_RPC_URL=https://<browser-safe-base-rpc-endpoint>
+NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<existing-or-new-project-id-if-the-app-uses-it>
+```
+
+Edit `packages/nextjs/scaffold.config.ts` so the production build will use
+Base and the browser-safe RPC value.  Retain the rest of the app's existing
+configuration:
+
+```ts
+import { base } from "viem/chains";
+
+// inside the exported scaffold configuration
+targetNetworks: [base],
+rpcOverrides: {
+  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
+},
+```
+
+Use the import form already used by the installed Scaffold-ETH version (some
+versions import `chains` and use `chains.base`).  Do not change
+`targetNetworks` to Base during fork testing; make this edit only after the
+local fork checks in step 3 have completed.
+
+Update the deploy script so it writes generated deployment artifacts, rather
+than hand-editing them.  The expected Scaffold artifact is
+`packages/nextjs/contracts/deployedContracts.ts`.  Keep it committed, because
+the frontend needs the exact ABI and address.  Search for stale addresses:
+
+```bash
+rg -n "31337|localhost|hardhat|0x[0-9a-fA-F]{40}" packages/nextjs packages/foundry
+```
+
+Replace only intentional configuration/address entries.  In particular,
+remove a localhost-only contract address and never use a local chain ID to
+identify a Base fork: all Anvil forks report `31337`.
+
+**GO:** Base config uses `8453`, the canonical USDC address, the Safe, and
+environment-supplied endpoints; no secret appears in `git diff` or `rg` over
+tracked config.  **STOP:** any live RPC credential is about to be committed,
+or the deploy script cannot be shown to pass the reviewed constructor values.
+
+## 3. Re-run the final source against a fresh Base fork
+
+The already-passing fork test is a useful starting point, but repeat it after
+the release/configuration changes.  Terminal A:
+
+```bash
+yarn fork --network base
+```
+
+Do **not** use `yarn fork base` or `yarn fork --network=base`: in this script
+those can silently fork Ethereum mainnet.  In terminal B, prove the fork is
+Base by checking code at canonical Base USDC (not just chain ID):
+
+```bash
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 --rpc-url http://127.0.0.1:8545
+```
+
+The result must not be `0x`.  Then run the project’s deploy and full test
+journey against that running fork (use the existing local deployment account
+or impersonation setup):
+
+```bash
+yarn deploy --network localhost
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn build
+```
+
+Start the web app and perform the entire flow with the browser wallet:
+
+```bash
+yarn start
+```
+
+On the fork, verify one normal tip, a minimum permitted tip, rejection of an
+approval, rejection of a tip, and a deliberately insufficient-USDC attempt.
+For the successful tip, inspect the receipt and balances: fan decrease equals
+creator increase plus fee-recipient increase; the fee is exactly 1% under the
+documented rounding rule; and the emitted event has the expected addresses
+and USDC base units.  Also confirm the UI says it is on the local fork and
+does not present this as production.
+
+**GO:** every command passes, Base USDC exists on the fork, and receipts and
+balances match.  **STOP:** a test needs a mock rather than real Base USDC, a
+network label is misleading, or regenerated artifacts differ unexpectedly.
+
+## 4. Base Sepolia rehearsal
+
+Use the same dedicated deployer or a separate dedicated rehearsal EOA, funded
+with Base Sepolia ETH.  Create a separate ignored environment file with test
+addresses; never reuse mainnet USDC or the mainnet Safe address on Sepolia.
+
+```bash
+yarn account --network baseSepolia
+yarn deploy --network baseSepolia
+yarn verify --network baseSepolia
+```
+
+Immediately inspect the deployment transaction on Base Sepolia Explorer,
+check constructor arguments, and use a browser wallet on Base Sepolia to walk
+the same approve/tip/receipt/balance path.  Use the actual token address and
+decimals used by the app's testnet configuration; do not assume mainnet USDC
+exists at the mainnet address there.
+
+**GO:** deployment, verification, wallet switching, approval, tip, failure
+states, and event/balance checks all work on an externally reachable chain.
+**STOP:** any network-specific config or wallet issue occurs.  Correct it,
+add a regression test where applicable, repeat steps 1--4, and only then
+return to mainnet.
+
+## 5. Mainnet preflight: final parameters and money
+
+Return to the release branch.  If the rehearsal required a fix, commit only
+the reviewed fix and its regression test, then update the release record with
+the new commit as `RELEASE_SHA`; both people re-approve it.  If no fix was
+needed, retain the existing `RELEASE_SHA`.
+Before broadcasting, both people independently fill in and compare this
+table from source and runtime config:
+
+| Field | Required mainnet value |
+| --- | --- |
+| Network / chain ID | Base / `8453` |
+| Token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913` |
+| Token decimals | `6` |
+| Platform fee | `100` basis points of `10_000` (= 1%) |
+| Fee recipient | `FEE_RECIPIENT` Safe address |
+| Owner/admin | `OWNER_ADDRESS` |
+| Deployer shown by `yarn account --network base` | `DEPLOYER_ADDRESS` |
+
+Run the final commands, with the fork still available if the deployment script
+needs the last local replay:
+
+```bash
+git status --short
+yarn format
+yarn lint
+yarn test
+cd packages/foundry && forge test -vvv && cd ../..
+yarn account --network base
+```
+
+Confirm the deployed artifact directory contains no old mainnet deployment
+that the frontend might accidentally use.  Confirm the platform Safe is a
+contract/address the team controls on Base and not an EOA copied from another
+chain.  Estimate the deployment using the configured Base RPC if the project
+has a dry-run command; otherwise the funded-balance requirement above is the
+preflight.
+
+**GO:** both reviewers agree byte-for-byte on the parameter table, all checks
+are green, `git status` contains no secret, and the deployer is funded on
+Base.  **STOP:** a value is inferred from memory, a recipient cannot be
+verified, the deployment account changes, or anything changed after review.
+
+## 6. Deploy the immutable production contract
+
+From the release checkout whose `packages/foundry/.env` contains the approved
+mainnet values, run exactly:
+
+```bash
+yarn deploy --network base
+```
+
+Do not run it twice because a transaction looks slow.  Wait for the command
+to return a transaction hash and contract address, then confirm on
+BaseScan that the transaction succeeded on chain `8453`, the `from` address
+is `DEPLOYER_ADDRESS`, and the created address is non-empty.
+
+Immediately, from this same checkout and before another deployment changes
+the broadcast record, verify source:
+
+```bash
+yarn verify --network base
+```
+
+`yarn verify` uses `packages/foundry/broadcast/run-latest.json`; running it
+from a different checkout or after a second deployment can verify the wrong
+contract.  On BaseScan, check the verified source, compiler/optimizer
+settings, constructor arguments, and read methods/state for the token,
+100-bps fee, fee recipient, owner, and initial creator configuration.  Save
+the transaction hash, contract address, verified BaseScan URL, block number,
+and artifact checksum in the private release record.
+
+If the contract has post-deploy admin setup (creator allowlist, ownership
+transfer, pause state), submit it from the approved Safe only after each team
+member decodes the calldata and compares it to the release record.  Confirm
+each transaction and reread contract state before the next one.
+
+**GO:** exactly one intended contract is deployed, source is verified,
+on-chain constructor/state values match the table, and post-deploy setup is
+confirmed.  **STOP:** verification fails, the address/arguments are wrong,
+or an unapproved transaction is broadcast.  Do not point any frontend at it.
+For a wrong immutable deployment, correct source/config, add a regression
+test, deploy a new contract, and treat the wrong address as abandoned.
+
+## 7. Private live-contract acceptance from localhost
+
+This is the required middle stage.  The contract is live, but the frontend is
+still only on `localhost`, so the team can fix UI issues without exposing
+users to them.
+
+Ensure `packages/nextjs/scaffold.config.ts` has `targetNetworks: [base]`, the
+generated `packages/nextjs/contracts/deployedContracts.ts` contains the
+address from step 6 and chain ID `8453`, and `.env.local` has the browser-safe
+Base RPC URL.  Generate the artifact through the normal deploy process; if
+the project did not generate it automatically, use its existing generator or
+update only the deployment entry with the verified ABI/address--never invent
+an ABI by hand.  Then run:
+
+```bash
+yarn build
+yarn start
+```
+
+At `http://localhost:3000`, connect the first fan test wallet and confirm the
+wallet network is Base mainnet.  Complete one real $1--10 USDC tip to the
+creator test wallet.  Use the actual displayed USDC balance/decimal format;
+do not use a test token.  In the wallet, inspect the spender before approval:
+it must be the verified production contract address.  If the UI supports an
+exact approval, approve only the tip amount; if it requests a larger
+allowance, stop and decide whether that UX is acceptable before public launch.
+
+After confirmation, independently inspect the BaseScan receipt and read
+balances with a second method (wallet, BaseScan token tab, or `cast`):
+
+```bash
+set -a; source packages/foundry/.env; set +a
+cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bDA02913 \
+  'balanceOf(address)(uint256)' 0x<fan-or-creator-or-safe-address> \
+  --rpc-url "$BASE_RPC_URL"
+```
+
+For the tip amount `A` (USDC base units), the creator receives the contract's
+documented payout and the Safe receives `floor(A * 100 / 10_000)` when that is
+the reviewed rounding rule.  Confirm all emitted events and UI messages match
+the confirmed transaction, not merely submission.
+
+Repeat with the second fan wallet and cover: wallet rejection, wrong-network
+prompt, no/insufficient USDC, insufficient ETH for gas, and a deliberately
+failing/invalid creator action.  Confirm each failure is comprehensible and
+no funds leave the wallet.  Load the app in an incognito window and mobile
+wallet browser as a final wallet/RPC/CORS check.
+
+**GO:** two real users have completed live transactions; creator and Safe
+balances/events reconcile; every tested failure is safe and clear; no local
+address, testnet label, or secret is exposed.  **STOP:** any mismatch in
+token, fee, recipient, spender, event, network, or UI state.  Fix it before
+publishing.  A frontend validation can improve UX, but it cannot fix a
+contract bug because users and integrators can call the contract directly.
+
+## 8. Publish the frontend
+
+Run the same CI-equivalent checks, then commit the reviewed generated
+`deployedContracts.ts` and Base-only frontend configuration (never either
+`.env` file):
+
+```bash
+yarn format
+yarn lint
+yarn test
+yarn build
+git diff --check
+git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+git commit -m "chore: configure verified Base production deployment"
+git status --short
+```
+
+Set production environment variables with your host.  For Vercel, from
+`packages/nextjs`, link the correct project and add the browser-safe values:
+
+```bash
+cd packages/nextjs
+vercel link
+vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
+vercel --prod
+```
+
+Enter the restricted browser RPC URL and WalletConnect ID only if the app
+uses WalletConnect.  Do not add `DEPLOYER_PRIVATE_KEY`, `BASE_RPC_URL`, or
+`packages/foundry/.env` values to Vercel.  Configure the custom domain in the
+Vercel project, wait for the DNS/SSL checks to pass, and make the intended
+domain the production domain.  If another host is used, set the same public
+variables in its production environment, build there, and deploy its
+production artifact; the security boundary is the same.
+
+**GO:** the host reports a successful production build, custom-domain DNS and
+TLS are healthy, and its environment contains only browser-safe settings.
+**STOP:** build differs from the local production build, a secret reached the
+host, or the public build references a local/testnet/wrong contract address.
+
+## 9. Public smoke test and release
+
+Before announcing, open the final `https://<production-domain>` yourself in
+an incognito desktop browser and a mobile wallet browser.  Check the network
+is Base, the displayed contract address links to the verified BaseScan page,
+the token is canonical USDC, and the fee disclosure says 1%.
+
+Put one final small real transaction through the **public URL** using the
+second fan wallet.  Confirm the wallet spender, confirmation, receipt,
+creator balance, Safe balance, event, and user-facing success/failure state
+exactly as in step 7.  Save the receipt URL in the release record.
+
+Only after this passes, publish the canonical URL, verified contract/BaseScan
+link, Base chain requirement, USDC token address, fee disclosure, and a
+support contact.  Do not publish a deployer key, RPC key, or an unverified
+contract link.
+
+**GO / launch complete:** the public URL has successfully sent a real tip to
+the verified Base contract and all balances/events reconcile.
+
+## 10. First-day monitoring and incident rule
+
+For the first 24 hours, both people monitor BaseScan activity/events and the
+hosting error logs at least at launch, +1 hour, +4 hours, and +24 hours.
+Reconcile a sample of tips: USDC received, creator payout, platform fee,
+event data, and UI confirmation.  Watch RPC errors, failed transactions,
+wrong-chain reports, and unexpected allowance complaints.
+
+If a live contract defect appears, pause it only if the reviewed contract has
+that authority and the Safe can do so.  Preserve transaction hashes and
+state.  Then follow the full repair loop: reproduce locally, fix source, add
+a failing regression test, repeat this runbook's fork/rehearsal gates,
+redeploy (or perform the contract's tested upgrade procedure), update the
+frontend to the new verified address, privately accept it with real funds,
+and communicate the migration/status to affected users.  Do not claim that a
+frontend-only clamp fixes a smart-contract vulnerability.

tokens used
47,101
````

## final message

Created [LAUNCH.md](/home/damu/.cache/ethskills-evals/2026-09-03T190413Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md).

It provides a gated, ordered Base mainnet launch path: release review, secret/account setup, Base fork rerun, Sepolia rehearsal, deploy + immediate verification, localhost acceptance with real Base USDC, Vercel publication, public smoke transaction, and first-day monitoring/incident handling.
