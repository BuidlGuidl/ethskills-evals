# Executor transcript — 2026-08-27T152418Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a043d2-8ec6-73e2-b24b-be65fb80096d
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
I’m using the deployment-orchestration guidance because this is a public-chain launch plan. I’ll turn the current local-only state into a gated, copy/pasteable Base production runbook, including verification and rollback checks.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md && rg --files -g 'AGENTS.md' -g 'README*' -g 'package.json' -g 'foundry.toml' -g '.env*' ." in /ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001
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

**Nobody has to go and get a block explorer API key first.** SE-2 ships a working `ETHERSCAN_API_KEY` in `packages/foundry/.env.example` and copies it to `.env` on postinstall, so verification works on a fresh checkout; swap in your own key later if you want one. Verification blocked "waiting on a key" is a ticket to close, not a dependency. One real constraint: `yarn verify` replays `broadcast/run-latest.json`, so run it from the checkout that did the deploy.

## A live contract bug goes back to the start

Deployed bytecode cannot be edited, and the contract is a public API — a guard added in the frontend binds nobody, because direct calls, integrators and other frontends reach the same function. Shipping the UI clamp to buy hours is fine; calling it the fix is not.

The fix is the whole loop, in order: reproduce locally, correct the source, add the regression test that fails without the correction, redeploy (or upgrade in place, if it is behind a proxy), repoint the frontend if the address moved, and handle the state and users already there — migration or comms, your call. The loop is the same whether the bug surfaces before launch or with the app already public.

## SE-2 specifics worth having right

- **Fork the chain you are targeting rather than `yarn chain`** — `yarn fork --network base` gives you Uniswap, USDC, Aave and funded whales already deployed, so you write no mocks of things that exist. The flag is load-bearing: yarn swallows a bare positional argument, so `yarn fork base` silently forks Ethereum mainnet instead. In the hardhat flavor `yarn fork` ignores its argument entirely and always forks mainnet — change `forking.url` in `hardhat.config.ts` to fork anything else. Either way the fork answers chain id 31337, so the chain id never tells you what you forked: check for state only the target chain has, such as code at one of its token addresses.
- **`scaffold.config.ts` is committed.** An RPC or API key pasted into `rpcOverrides` or `alchemyApiKey` is a published key; read it from `process.env` and keep the value in `.env.local`. `wallets/SKILL.md` covers the rest of key handling.
- **A frontend-only ticket deploys nothing.** Do not stand up a chain and redeploy to regenerate `deployedContracts.ts` unless deploying was the ask.
./package.json

web search: 
web search: Scaffold-ETH 2 Foundry deploy verify Base yarn deploy --network base ...
2026-08-27T15:24:53.755131Z ERROR codex_core::tools::router: error=exec_command failed for `/bin/bash -lc 'git status --short && git ls-remote https://github.com/scaffold-eth/scaffold-eth-2.git HEAD && work_tmp=$(mktemp -d) && git clone --depth 1 --filter=blob:none --sparse https://github.com/scaffold-eth/scaffold-eth-2.git "$work_tmp/se2" >/dev/null 2>&1 && git -C "$work_tmp/se2" sparse-checkout set package.json packages/foundry packages/nextjs/scaffold.config.ts packages/nextjs/.env.example && sed -n '"'1,220p' \""'$work_tmp/se2/package.json" && sed -n '"'1,220p' \""'$work_tmp/se2/packages/foundry/package.json" && sed -n '"'1,220p' \""'$work_tmp/se2/packages/foundry/.env.example" && sed -n '"'1,220p' \""'$work_tmp/se2/packages/foundry/foundry.toml" && sed -n '"'1,180p' \""'$work_tmp/se2/packages/nextjs/scaffold.config.ts" && rm -rf "$work_tmp"'`: CreateProcess { message: "Rejected(\"`/bin/bash -lc 'git status --short && git ls-remote https://github.com/scaffold-eth/scaffold-eth-2.git HEAD && work_tmp=$(mktemp -d) && git clone --depth 1 --filter=blob:none --sparse https://github.com/scaffold-eth/scaffold-eth-2.git \\\"$work_tmp/se2\\\" >/dev/null 2>&1 && git -C \\\"$work_tmp/se2\\\" sparse-checkout set package.json packages/foundry packages/nextjs/scaffold.config.ts packages/nextjs/.env.example && sed -n '\\\"'1,220p' \\\\\\\"\\\"'$work_tmp/se2/package.json\\\" && sed -n '\\\"'1,220p' \\\\\\\"\\\"'$work_tmp/se2/packages/foundry/package.json\\\" && sed -n '\\\"'1,220p' \\\\\\\"\\\"'$work_tmp/se2/packages/foundry/.env.example\\\" && sed -n '\\\"'1,220p' \\\\\\\"\\\"'$work_tmp/se2/packages/foundry/foundry.toml\\\" && sed -n '\\\"'1,180p' \\\\\\\"\\\"'$work_tmp/se2/packages/nextjs/scaffold.config.ts\\\" && rm -rf \\\"$work_tmp\\\"'` rejected: rm -f style commands are not permitted. Use a safer approach\")" }
exec
/bin/bash -lc 'git status --short; git ls-remote https://github.com/scaffold-eth/scaffold-eth-2.git HEAD' in /ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 754ms:
6cdf354a4a02aded39c92d5e0d83cd24e4628239	HEAD

web search: 
web search: https://raw.githubusercontent.com/scaffold-eth/scaffold-eth-2/main/packages/foundry/.env.example
codex
I’ve confirmed the Scaffold-ETH 2 release flow: deploy and verify are separate immediate commands, and the generated `deployedContracts.ts` is the frontend’s contract-address source. The runbook will make the live-chain/local-UI checkpoint mandatory before any public deployment.
2026-08-27T15:26:36.404435Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 371, 'the public UI down immediately, use a verified on-chain pause only if that' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..2606e6ff437f8fe40c1acd6c741e37732a6e39a9
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,195 @@
+# Base Mainnet Launch Runbook — creator tips
+
+Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.
+
+## 0. Release sheet and responsibilities
+
+Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:
+
+    RELEASE_SHA=                 exact reviewed commit, never a branch
+    OPERATOR_ADDRESS=            new dedicated deployment EOA
+    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
+    APP_DOMAIN=                  e.g. tips.example.com
+    SUPPORT_CONTACT=             public support email/handle
+    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
+    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN
+
+Use these fixed Base mainnet values:
+
+    CHAIN_ID=8453
+    EXPLORER=https://basescan.org
+    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    USDC_DECIMALS=6
+    FEE_BPS=100
+    BPS_DENOMINATOR=10000
+
+This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.
+
+**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
+
+## 1. Freeze, test, and review the exact release
+
+    git fetch --tags origin
+    git checkout "$RELEASE_SHA"
+    git status --short
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn compile
+    yarn test
+    yarn lint
+    yarn next:build
+
+git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.
+
+The reviewer must inspect source, tests, and the deploy script and establish all of the following:
+
+- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
+- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
+- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
+- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
+- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
+- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.
+
+Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.
+
+**Gate:** all commands pass and both reviewers approve. Tag the SHA:
+
+    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
+    git push origin "launch-base-$(git rev-parse --short HEAD)"
+
+## 2. Make production configuration explicit
+
+Make and review these committed changes before tagging.
+
+1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
+2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):
+
+    targetNetworks: [chains.base],
+    rpcOverrides: {
+      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
+    },
+    burnerWalletMode: "disabled",
+
+3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
+4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
+
+Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:
+
+    cp packages/foundry/.env.example packages/foundry/.env
+    cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+
+Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:
+
+    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
+    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
+    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
+    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>
+
+If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:
+
+    yarn generate
+    yarn account
+
+Set these locally and in the host’s Production environment:
+
+    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
+    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
+    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
+    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>
+
+Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.
+
+**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
+
+## 3. Rehearse the exact release on a Base fork
+
+Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
+
+Terminal A:
+
+    yarn fork --network base
+
+Terminal B:
+
+    cast chain-id --rpc-url http://127.0.0.1:8545
+    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
+    yarn deploy
+    yarn test
+    yarn start
+
+The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.
+
+With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.
+
+**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
+
+## 4. Fund and protect accounts
+
+Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.
+
+Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.
+
+**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
+
+## 5. Deploy and verify on Base; UI stays private
+
+Close Anvil/fork terminals. From the tagged checkout:
+
+    git status --short
+    yarn compile
+    yarn deploy --network base
+    yarn verify --network base
+
+Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.
+
+Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
+
+**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
+    git commit -m "chore: record Base mainnet deployment"
+    git push origin HEAD
+
+If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.
+
+## 6. Private real-money acceptance test
+
+Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:
+
+    yarn next:build
+    yarn start
+
+Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.
+
+Replace these values and independently inspect post-transaction state:
+
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
+    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"
+
+Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.
+
+**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
+
+## 7. Publish the frontend
+
+Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:
+
+    yarn vercel:yolo --prod
+
+Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.
+
+**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
+
+## 8. First 24 hours and incident rules
+
+For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.
+
+For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.
+
+Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.
+
+Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.
+

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..2606e6ff437f8fe40c1acd6c741e37732a6e39a9
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,195 @@
+# Base Mainnet Launch Runbook — creator tips
+
+Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.
+
+## 0. Release sheet and responsibilities
+
+Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:
+
+    RELEASE_SHA=                 exact reviewed commit, never a branch
+    OPERATOR_ADDRESS=            new dedicated deployment EOA
+    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
+    APP_DOMAIN=                  e.g. tips.example.com
+    SUPPORT_CONTACT=             public support email/handle
+    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
+    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN
+
+Use these fixed Base mainnet values:
+
+    CHAIN_ID=8453
+    EXPLORER=https://basescan.org
+    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    USDC_DECIMALS=6
+    FEE_BPS=100
+    BPS_DENOMINATOR=10000
+
+This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.
+
+**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
+
+## 1. Freeze, test, and review the exact release
+
+    git fetch --tags origin
+    git checkout "$RELEASE_SHA"
+    git status --short
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn compile
+    yarn test
+    yarn lint
+    yarn next:build
+
+git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.
+
+The reviewer must inspect source, tests, and the deploy script and establish all of the following:
+
+- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
+- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
+- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
+- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
+- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
+- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.
+
+Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.
+
+**Gate:** all commands pass and both reviewers approve. Tag the SHA:
+
+    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
+    git push origin "launch-base-$(git rev-parse --short HEAD)"
+
+## 2. Make production configuration explicit
+
+Make and review these committed changes before tagging.
+
+1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
+2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):
+
+    targetNetworks: [chains.base],
+    rpcOverrides: {
+      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
+    },
+    burnerWalletMode: "disabled",
+
+3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
+4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
+
+Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:
+
+    cp packages/foundry/.env.example packages/foundry/.env
+    cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+
+Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:
+
+    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
+    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
+    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
+    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>
+
+If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:
+
+    yarn generate
+    yarn account
+
+Set these locally and in the host’s Production environment:
+
+    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
+    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
+    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
+    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>
+
+Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.
+
+**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
+
+## 3. Rehearse the exact release on a Base fork
+
+Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
+
+Terminal A:
+
+    yarn fork --network base
+
+Terminal B:
+
+    cast chain-id --rpc-url http://127.0.0.1:8545
+    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
+    yarn deploy
+    yarn test
+    yarn start
+
+The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.
+
+With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.
+
+**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
+
+## 4. Fund and protect accounts
+
+Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.
+
+Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.
+
+**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
+
+## 5. Deploy and verify on Base; UI stays private
+
+Close Anvil/fork terminals. From the tagged checkout:
+
+    git status --short
+    yarn compile
+    yarn deploy --network base
+    yarn verify --network base
+
+Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.
+
+Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
+
+**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
+    git commit -m "chore: record Base mainnet deployment"
+    git push origin HEAD
+
+If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.
+
+## 6. Private real-money acceptance test
+
+Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:
+
+    yarn next:build
+    yarn start
+
+Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.
+
+Replace these values and independently inspect post-transaction state:
+
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
+    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"
+
+Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.
+
+**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
+
+## 7. Publish the frontend
+
+Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:
+
+    yarn vercel:yolo --prod
+
+Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.
+
+**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
+
+## 8. First 24 hours and incident rules
+
+For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.
+
+For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.
+
+Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.
+
+Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.
+

exec
/bin/bash -lc "sed -n '1,260p' LAUNCH.md && git diff --check && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Base Mainnet Launch Runbook — creator tips

Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.

## 0. Release sheet and responsibilities

Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:

    RELEASE_SHA=                 exact reviewed commit, never a branch
    OPERATOR_ADDRESS=            new dedicated deployment EOA
    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
    APP_DOMAIN=                  e.g. tips.example.com
    SUPPORT_CONTACT=             public support email/handle
    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN

Use these fixed Base mainnet values:

    CHAIN_ID=8453
    EXPLORER=https://basescan.org
    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    USDC_DECIMALS=6
    FEE_BPS=100
    BPS_DENOMINATOR=10000

This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.

**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.

## 1. Freeze, test, and review the exact release

    git fetch --tags origin
    git checkout "$RELEASE_SHA"
    git status --short
    git rev-parse HEAD
    yarn install --immutable
    yarn compile
    yarn test
    yarn lint
    yarn next:build

git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.

The reviewer must inspect source, tests, and the deploy script and establish all of the following:

- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.

Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.

**Gate:** all commands pass and both reviewers approve. Tag the SHA:

    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
    git push origin "launch-base-$(git rev-parse --short HEAD)"

## 2. Make production configuration explicit

Make and review these committed changes before tagging.

1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):

    targetNetworks: [chains.base],
    rpcOverrides: {
      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
    },
    burnerWalletMode: "disabled",

3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.

Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:

    cp packages/foundry/.env.example packages/foundry/.env
    cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local

Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:

    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>

If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:

    yarn generate
    yarn account

Set these locally and in the host’s Production environment:

    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>

Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.

**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.

## 3. Rehearse the exact release on a Base fork

Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.

Terminal A:

    yarn fork --network base

Terminal B:

    cast chain-id --rpc-url http://127.0.0.1:8545
    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
    yarn deploy
    yarn test
    yarn start

The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.

With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.

**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.

## 4. Fund and protect accounts

Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.

Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.

**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.

## 5. Deploy and verify on Base; UI stays private

Close Anvil/fork terminals. From the tagged checkout:

    git status --short
    yarn compile
    yarn deploy --network base
    yarn verify --network base

Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.

Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.

**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:

    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
    git commit -m "chore: record Base mainnet deployment"
    git push origin HEAD

If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.

## 6. Private real-money acceptance test

Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:

    yarn next:build
    yarn start

Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.

Replace these values and independently inspect post-transaction state:

    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"

Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.

**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.

## 7. Publish the frontend

Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:

    yarn vercel:yolo --prod

Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.

**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.

## 8. First 24 hours and incident rules

For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.

For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.

Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.

Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.

?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..2606e6ff437f8fe40c1acd6c741e37732a6e39a9
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,195 @@
+# Base Mainnet Launch Runbook — creator tips
+
+Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.
+
+## 0. Release sheet and responsibilities
+
+Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:
+
+    RELEASE_SHA=                 exact reviewed commit, never a branch
+    OPERATOR_ADDRESS=            new dedicated deployment EOA
+    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
+    APP_DOMAIN=                  e.g. tips.example.com
+    SUPPORT_CONTACT=             public support email/handle
+    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
+    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN
+
+Use these fixed Base mainnet values:
+
+    CHAIN_ID=8453
+    EXPLORER=https://basescan.org
+    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    USDC_DECIMALS=6
+    FEE_BPS=100
+    BPS_DENOMINATOR=10000
+
+This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.
+
+**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
+
+## 1. Freeze, test, and review the exact release
+
+    git fetch --tags origin
+    git checkout "$RELEASE_SHA"
+    git status --short
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn compile
+    yarn test
+    yarn lint
+    yarn next:build
+
+git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.
+
+The reviewer must inspect source, tests, and the deploy script and establish all of the following:
+
+- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
+- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
+- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
+- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
+- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
+- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.
+
+Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.
+
+**Gate:** all commands pass and both reviewers approve. Tag the SHA:
+
+    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
+    git push origin "launch-base-$(git rev-parse --short HEAD)"
+
+## 2. Make production configuration explicit
+
+Make and review these committed changes before tagging.
+
+1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
+2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):
+
+    targetNetworks: [chains.base],
+    rpcOverrides: {
+      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
+    },
+    burnerWalletMode: "disabled",
+
+3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
+4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
+
+Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:
+
+    cp packages/foundry/.env.example packages/foundry/.env
+    cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+
+Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:
+
+    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
+    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
+    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
+    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>
+
+If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:
+
+    yarn generate
+    yarn account
+
+Set these locally and in the host’s Production environment:
+
+    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
+    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
+    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
+    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>
+
+Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.
+
+**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
+
+## 3. Rehearse the exact release on a Base fork
+
+Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
+
+Terminal A:
+
+    yarn fork --network base
+
+Terminal B:
+
+    cast chain-id --rpc-url http://127.0.0.1:8545
+    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
+    yarn deploy
+    yarn test
+    yarn start
+
+The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.
+
+With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.
+
+**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
+
+## 4. Fund and protect accounts
+
+Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.
+
+Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.
+
+**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
+
+## 5. Deploy and verify on Base; UI stays private
+
+Close Anvil/fork terminals. From the tagged checkout:
+
+    git status --short
+    yarn compile
+    yarn deploy --network base
+    yarn verify --network base
+
+Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.
+
+Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
+
+**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
+    git commit -m "chore: record Base mainnet deployment"
+    git push origin HEAD
+
+If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.
+
+## 6. Private real-money acceptance test
+
+Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:
+
+    yarn next:build
+    yarn start
+
+Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.
+
+Replace these values and independently inspect post-transaction state:
+
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
+    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"
+
+Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.
+
+**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
+
+## 7. Publish the frontend
+
+Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:
+
+    yarn vercel:yolo --prod
+
+Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.
+
+**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
+
+## 8. First 24 hours and incident rules
+
+For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.
+
+For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.
+
+Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.
+
+Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.
+

apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..7ab4ed1b3207b09b33c55a579b90c06fe74cf1af
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,199 @@
+# Base Mainnet Launch Runbook — creator tips
+
+Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.
+
+## 0. Release sheet and responsibilities
+
+Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:
+
+    RELEASE_SHA=                 exact reviewed commit, never a branch
+    OPERATOR_ADDRESS=            new dedicated deployment EOA
+    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
+    APP_DOMAIN=                  e.g. tips.example.com
+    SUPPORT_CONTACT=             public support email/handle
+    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
+    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN
+
+Use these fixed Base mainnet values:
+
+    CHAIN_ID=8453
+    EXPLORER=https://basescan.org
+    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    USDC_DECIMALS=6
+    FEE_BPS=100
+    BPS_DENOMINATOR=10000
+
+This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.
+
+Before commands below which contain shell variables, export the fixed address and the release-sheet RPC URL in the terminal that will run them:
+
+    export NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    export BASE_RPC_URL='<the exact BASE_RPC_URL from the restricted release sheet>'
+
+**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
+
+## 1. Freeze, test, and review the exact release
+
+    git fetch --tags origin
+    git checkout "$RELEASE_SHA"
+    git status --short
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn compile
+    yarn test
+    yarn lint
+    yarn next:build
+
+git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.
+
+The reviewer must inspect source, tests, and the deploy script and establish all of the following:
+
+- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
+- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
+- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
+- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
+- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
+- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.
+
+Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.
+
+**Gate:** all commands pass and both reviewers approve. Tag the SHA:
+
+    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
+    git push origin "launch-base-$(git rev-parse --short HEAD)"
+
+## 2. Make production configuration explicit
+
+Make and review these committed changes before tagging.
+
+1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
+2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):
+
+    targetNetworks: [chains.base],
+    rpcOverrides: {
+      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
+    },
+    burnerWalletMode: "disabled",
+
+3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
+4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
+
+Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:
+
+    cp packages/foundry/.env.example packages/foundry/.env
+    test -f packages/nextjs/.env.example && cp packages/nextjs/.env.example packages/nextjs/.env.local
+    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+
+Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:
+
+    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
+    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
+    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
+    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>
+
+If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:
+
+    yarn generate
+    yarn account
+
+Set these locally and in the host’s Production environment:
+
+    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
+    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
+    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
+    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>
+
+Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.
+
+**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
+
+## 3. Rehearse the exact release on a Base fork
+
+Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
+
+Terminal A:
+
+    yarn fork --network base
+
+Terminal B:
+
+    cast chain-id --rpc-url http://127.0.0.1:8545
+    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
+    yarn deploy
+    yarn test
+    yarn start
+
+The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.
+
+With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.
+
+**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
+
+## 4. Fund and protect accounts
+
+Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.
+
+Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.
+
+**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
+
+## 5. Deploy and verify on Base; UI stays private
+
+Close Anvil/fork terminals. From the tagged checkout:
+
+    git status --short
+    yarn compile
+    yarn deploy --network base
+    yarn verify --network base
+
+Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.
+
+Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
+
+**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
+    git commit -m "chore: record Base mainnet deployment"
+    git push origin HEAD
+
+If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.
+
+## 6. Private real-money acceptance test
+
+Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:
+
+    yarn next:build
+    yarn start
+
+Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.
+
+Replace these values and independently inspect post-transaction state:
+
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
+    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"
+
+Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.
+
+**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
+
+## 7. Publish the frontend
+
+Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:
+
+    yarn vercel:yolo --prod
+
+Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.
+
+**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
+
+## 8. First 24 hours and incident rules
+
+For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.
+
+For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.
+
+Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.
+
+Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..7ab4ed1b3207b09b33c55a579b90c06fe74cf1af
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,199 @@
+# Base Mainnet Launch Runbook — creator tips
+
+Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.
+
+## 0. Release sheet and responsibilities
+
+Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:
+
+    RELEASE_SHA=                 exact reviewed commit, never a branch
+    OPERATOR_ADDRESS=            new dedicated deployment EOA
+    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
+    APP_DOMAIN=                  e.g. tips.example.com
+    SUPPORT_CONTACT=             public support email/handle
+    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
+    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN
+
+Use these fixed Base mainnet values:
+
+    CHAIN_ID=8453
+    EXPLORER=https://basescan.org
+    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    USDC_DECIMALS=6
+    FEE_BPS=100
+    BPS_DENOMINATOR=10000
+
+This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.
+
+Before commands below which contain shell variables, export the fixed address and the release-sheet RPC URL in the terminal that will run them:
+
+    export NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    export BASE_RPC_URL='<the exact BASE_RPC_URL from the restricted release sheet>'
+
+**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
+
+## 1. Freeze, test, and review the exact release
+
+    git fetch --tags origin
+    git checkout "$RELEASE_SHA"
+    git status --short
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn compile
+    yarn test
+    yarn lint
+    yarn next:build
+
+git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.
+
+The reviewer must inspect source, tests, and the deploy script and establish all of the following:
+
+- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
+- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
+- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
+- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
+- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
+- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.
+
+Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.
+
+**Gate:** all commands pass and both reviewers approve. Tag the SHA:
+
+    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
+    git push origin "launch-base-$(git rev-parse --short HEAD)"
+
+## 2. Make production configuration explicit
+
+Make and review these committed changes before tagging.
+
+1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
+2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):
+
+    targetNetworks: [chains.base],
+    rpcOverrides: {
+      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
+    },
+    burnerWalletMode: "disabled",
+
+3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
+4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
+
+Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:
+
+    cp packages/foundry/.env.example packages/foundry/.env
+    test -f packages/nextjs/.env.example && cp packages/nextjs/.env.example packages/nextjs/.env.local
+    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+
+Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:
+
+    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
+    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
+    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
+    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>
+
+If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:
+
+    yarn generate
+    yarn account
+
+Set these locally and in the host’s Production environment:
+
+    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
+    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
+    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
+    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>
+
+Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.
+
+**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
+
+## 3. Rehearse the exact release on a Base fork
+
+Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
+
+Terminal A:
+
+    yarn fork --network base
+
+Terminal B:
+
+    cast chain-id --rpc-url http://127.0.0.1:8545
+    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
+    yarn deploy
+    yarn test
+    yarn start
+
+The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.
+
+With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.
+
+**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
+
+## 4. Fund and protect accounts
+
+Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.
+
+Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.
+
+**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
+
+## 5. Deploy and verify on Base; UI stays private
+
+Close Anvil/fork terminals. From the tagged checkout:
+
+    git status --short
+    yarn compile
+    yarn deploy --network base
+    yarn verify --network base
+
+Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.
+
+Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
+
+**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
+    git commit -m "chore: record Base mainnet deployment"
+    git push origin HEAD
+
+If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.
+
+## 6. Private real-money acceptance test
+
+Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:
+
+    yarn next:build
+    yarn start
+
+Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.
+
+Replace these values and independently inspect post-transaction state:
+
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
+    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"
+
+Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.
+
+**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
+
+## 7. Publish the frontend
+
+Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:
+
+    yarn vercel:yolo --prod
+
+Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.
+
+**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
+
+## 8. First 24 hours and incident rules
+
+For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.
+
+For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.
+
+Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.
+
+Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.

exec
/bin/bash -lc 'git diff --check && rg -n "''^## |'"\\*\\*Gate:\\*\\*|yarn (fork|deploy|verify)|NATIVE_USDC|targetNetworks\" LAUNCH.md && wc -l LAUNCH.md && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
5:## 0. Release sheet and responsibilities
21:    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
30:    export NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
33:**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
35:## 1. Freeze, test, and review the exact release
51:- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
60:**Gate:** all commands pass and both reviewers approve. Tag the SHA:
65:## 2. Make production configuration explicit
72:    targetNetworks: [chains.base],
79:4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
109:**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
111:## 3. Rehearse the exact release on a Base fork
113:Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
117:    yarn fork --network base
122:    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
123:    yarn deploy
131:**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
133:## 4. Fund and protect accounts
139:**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
141:## 5. Deploy and verify on Base; UI stays private
147:    yarn deploy --network base
148:    yarn verify --network base
152:Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
154:**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
162:## 6. Private real-money acceptance test
173:    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
174:    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
179:**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
181:## 7. Publish the frontend
189:**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
191:## 8. First 24 hours and incident rules
199 LAUNCH.md
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..7ab4ed1b3207b09b33c55a579b90c06fe74cf1af
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,199 @@
+# Base Mainnet Launch Runbook — creator tips
+
+Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.
+
+## 0. Release sheet and responsibilities
+
+Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:
+
+    RELEASE_SHA=                 exact reviewed commit, never a branch
+    OPERATOR_ADDRESS=            new dedicated deployment EOA
+    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
+    APP_DOMAIN=                  e.g. tips.example.com
+    SUPPORT_CONTACT=             public support email/handle
+    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
+    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN
+
+Use these fixed Base mainnet values:
+
+    CHAIN_ID=8453
+    EXPLORER=https://basescan.org
+    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    USDC_DECIMALS=6
+    FEE_BPS=100
+    BPS_DENOMINATOR=10000
+
+This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.
+
+Before commands below which contain shell variables, export the fixed address and the release-sheet RPC URL in the terminal that will run them:
+
+    export NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    export BASE_RPC_URL='<the exact BASE_RPC_URL from the restricted release sheet>'
+
+**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
+
+## 1. Freeze, test, and review the exact release
+
+    git fetch --tags origin
+    git checkout "$RELEASE_SHA"
+    git status --short
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn compile
+    yarn test
+    yarn lint
+    yarn next:build
+
+git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.
+
+The reviewer must inspect source, tests, and the deploy script and establish all of the following:
+
+- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
+- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
+- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
+- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
+- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
+- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.
+
+Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.
+
+**Gate:** all commands pass and both reviewers approve. Tag the SHA:
+
+    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
+    git push origin "launch-base-$(git rev-parse --short HEAD)"
+
+## 2. Make production configuration explicit
+
+Make and review these committed changes before tagging.
+
+1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
+2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):
+
+    targetNetworks: [chains.base],
+    rpcOverrides: {
+      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
+    },
+    burnerWalletMode: "disabled",
+
+3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
+4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
+
+Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:
+
+    cp packages/foundry/.env.example packages/foundry/.env
+    test -f packages/nextjs/.env.example && cp packages/nextjs/.env.example packages/nextjs/.env.local
+    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+
+Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:
+
+    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
+    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
+    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
+    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>
+
+If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:
+
+    yarn generate
+    yarn account
+
+Set these locally and in the host’s Production environment:
+
+    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
+    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
+    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
+    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>
+
+Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.
+
+**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
+
+## 3. Rehearse the exact release on a Base fork
+
+Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
+
+Terminal A:
+
+    yarn fork --network base
+
+Terminal B:
+
+    cast chain-id --rpc-url http://127.0.0.1:8545
+    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
+    yarn deploy
+    yarn test
+    yarn start
+
+The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.
+
+With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.
+
+**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
+
+## 4. Fund and protect accounts
+
+Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.
+
+Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.
+
+**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
+
+## 5. Deploy and verify on Base; UI stays private
+
+Close Anvil/fork terminals. From the tagged checkout:
+
+    git status --short
+    yarn compile
+    yarn deploy --network base
+    yarn verify --network base
+
+Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.
+
+Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
+
+**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
+    git commit -m "chore: record Base mainnet deployment"
+    git push origin HEAD
+
+If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.
+
+## 6. Private real-money acceptance test
+
+Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:
+
+    yarn next:build
+    yarn start
+
+Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.
+
+Replace these values and independently inspect post-transaction state:
+
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
+    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"
+
+Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.
+
+**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
+
+## 7. Publish the frontend
+
+Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:
+
+    yarn vercel:yolo --prod
+
+Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.
+
+**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
+
+## 8. First 24 hours and incident rules
+
+For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.
+
+For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.
+
+Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.
+
+Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.

codex
Created the complete gated Base production runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md).

It covers exact release configuration, Base fork rehearsal, deployment/verification, private real-money acceptance, public deployment, and first-day incident handling. `git diff --check` passes.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..7ab4ed1b3207b09b33c55a579b90c06fe74cf1af
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,199 @@
+# Base Mainnet Launch Runbook — creator tips
+
+Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.
+
+## 0. Release sheet and responsibilities
+
+Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:
+
+    RELEASE_SHA=                 exact reviewed commit, never a branch
+    OPERATOR_ADDRESS=            new dedicated deployment EOA
+    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
+    APP_DOMAIN=                  e.g. tips.example.com
+    SUPPORT_CONTACT=             public support email/handle
+    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
+    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN
+
+Use these fixed Base mainnet values:
+
+    CHAIN_ID=8453
+    EXPLORER=https://basescan.org
+    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    USDC_DECIMALS=6
+    FEE_BPS=100
+    BPS_DENOMINATOR=10000
+
+This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.
+
+Before commands below which contain shell variables, export the fixed address and the release-sheet RPC URL in the terminal that will run them:
+
+    export NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    export BASE_RPC_URL='<the exact BASE_RPC_URL from the restricted release sheet>'
+
+**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.
+
+## 1. Freeze, test, and review the exact release
+
+    git fetch --tags origin
+    git checkout "$RELEASE_SHA"
+    git status --short
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn compile
+    yarn test
+    yarn lint
+    yarn next:build
+
+git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.
+
+The reviewer must inspect source, tests, and the deploy script and establish all of the following:
+
+- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
+- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
+- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
+- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
+- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
+- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.
+
+Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.
+
+**Gate:** all commands pass and both reviewers approve. Tag the SHA:
+
+    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
+    git push origin "launch-base-$(git rev-parse --short HEAD)"
+
+## 2. Make production configuration explicit
+
+Make and review these committed changes before tagging.
+
+1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
+2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):
+
+    targetNetworks: [chains.base],
+    rpcOverrides: {
+      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
+    },
+    burnerWalletMode: "disabled",
+
+3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
+4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.
+
+Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:
+
+    cp packages/foundry/.env.example packages/foundry/.env
+    test -f packages/nextjs/.env.example && cp packages/nextjs/.env.example packages/nextjs/.env.local
+    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+
+Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:
+
+    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
+    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
+    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
+    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>
+
+If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:
+
+    yarn generate
+    yarn account
+
+Set these locally and in the host’s Production environment:
+
+    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
+    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
+    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
+    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>
+
+Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.
+
+**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.
+
+## 3. Rehearse the exact release on a Base fork
+
+Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.
+
+Terminal A:
+
+    yarn fork --network base
+
+Terminal B:
+
+    cast chain-id --rpc-url http://127.0.0.1:8545
+    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
+    yarn deploy
+    yarn test
+    yarn start
+
+The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.
+
+With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.
+
+**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.
+
+## 4. Fund and protect accounts
+
+Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.
+
+Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.
+
+**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.
+
+## 5. Deploy and verify on Base; UI stays private
+
+Close Anvil/fork terminals. From the tagged checkout:
+
+    git status --short
+    yarn compile
+    yarn deploy --network base
+    yarn verify --network base
+
+Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.
+
+Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.
+
+**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
+    git commit -m "chore: record Base mainnet deployment"
+    git push origin HEAD
+
+If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.
+
+## 6. Private real-money acceptance test
+
+Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:
+
+    yarn next:build
+    yarn start
+
+Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.
+
+Replace these values and independently inspect post-transaction state:
+
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
+    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
+    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"
+
+Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.
+
+**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.
+
+## 7. Publish the frontend
+
+Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:
+
+    yarn vercel:yolo --prod
+
+Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.
+
+**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.
+
+## 8. First 24 hours and incident rules
+
+For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.
+
+For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.
+
+Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.
+
+Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.

tokens used
51,045
```

## final message

Created the complete gated Base production runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T152418Z-codex-with-skill-3/orchestration-goal-001/LAUNCH.md).

It covers exact release configuration, Base fork rehearsal, deployment/verification, private real-money acceptance, public deployment, and first-day incident handling. `git diff --check` passes.
