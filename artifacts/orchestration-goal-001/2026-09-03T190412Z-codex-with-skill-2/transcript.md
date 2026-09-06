# Executor transcript — 2026-09-03T190412Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a068ac-8bf5-70c2-824c-d07ac7612b40
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
I’m using the deployment-orchestration guidance because this is a Scaffold-ETH 2 launch from localhost to a public Base deployment. I’ll turn the current state into a runbook with explicit gates and rollback checks.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/orchestration/SKILL.md && printf '\\n--- workspace ---\\n' && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200" in /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 3ms:
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,260p' TASK.md && printf '\\n--- package ---\\n' && sed -n '1,240p' package.json && printf '\\n--- git ---\\n' && git status --short && git log -1 --oneline" in /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 3ms:
codex
The repository contains only the brief, so I’m making the runbook intentionally repo-agnostic where names differ, while anchoring it to the Foundry Scaffold-ETH 2 commands and Base’s canonical USDC address. It will include a private live-chain acceptance phase before the public frontend release.
2026-09-03T19:10:50.693869Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 317, 'do not publicly launch or try to “fix” it in the UI; assess redeployment and' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c06f6620acc502ed1b198d42a29e97e4b620f252
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,280 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+\`\`\`bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --immutable
+git rev-parse HEAD
+\`\`\`
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+\`\`\`solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+\`\`\`
+
+If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+\`\`\`bash
+yarn fork --network base
+\`\`\`
+
+Leave the fork running. In another terminal:
+
+\`\`\`bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+\`\`\`
+
+The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (\`1000000\` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** \`yarn test\` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+\`\`\`bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+\`\`\`
+
+Put a fresh dedicated deployer key and the Base RPC URL into \`packages/foundry/.env\`, using **the variable names already read by this repository** (check \`foundry.toml\`, its scripts, and root package scripts). A typical shape is:
+
+\`\`\`dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+\`\`\`
+
+Preserve \`ETHERSCAN_API_KEY\` supplied by \`.env.example\`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a \`NEXT_PUBLIC_*\` variable.
+
+Validate the real account and RPC:
+
+\`\`\`bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return \`8453\`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and \`git status --short\` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed \`scaffold.config.ts\` target from the local network to Base:
+
+\`\`\`ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+\`\`\`
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset \`USDC\` (not \`USDC.e\`), displays six-decimal amounts correctly, and contains no fallback local contract address. If \`scaffold.config.ts\` needs an RPC setting, read it from \`process.env\`; the value belongs in \`.env.local\`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+\`\`\`bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+\`\`\`
+
+If that workspace identifier differs, inspect \`packages/nextjs/package.json\` and run its defined \`lint\` and \`build\` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+\`\`\`bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+\`\`\`
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by \`yarn account --network base\`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+\`\`\`bash
+yarn verify --network base
+\`\`\`
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+\`\`\`bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The standard \`yarn deploy\` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly \`packages/nextjs/contracts/deployedContracts.ts\`). Commit the generated address and the Base target together:
+
+\`\`\`bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+\`\`\`
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and \`yarn verify --network base\` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+\`\`\`bash
+yarn start
+\`\`\`
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+\`\`\`bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+\`\`\`
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+\`\`\`bash
+npx vercel@latest --prod
+\`\`\`
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+\`\`\`text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+\`\`\`
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.
+

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c06f6620acc502ed1b198d42a29e97e4b620f252
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,280 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+\`\`\`bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --immutable
+git rev-parse HEAD
+\`\`\`
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+\`\`\`solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+\`\`\`
+
+If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+\`\`\`bash
+yarn fork --network base
+\`\`\`
+
+Leave the fork running. In another terminal:
+
+\`\`\`bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+\`\`\`
+
+The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (\`1000000\` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** \`yarn test\` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+\`\`\`bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+\`\`\`
+
+Put a fresh dedicated deployer key and the Base RPC URL into \`packages/foundry/.env\`, using **the variable names already read by this repository** (check \`foundry.toml\`, its scripts, and root package scripts). A typical shape is:
+
+\`\`\`dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+\`\`\`
+
+Preserve \`ETHERSCAN_API_KEY\` supplied by \`.env.example\`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a \`NEXT_PUBLIC_*\` variable.
+
+Validate the real account and RPC:
+
+\`\`\`bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return \`8453\`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and \`git status --short\` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed \`scaffold.config.ts\` target from the local network to Base:
+
+\`\`\`ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+\`\`\`
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset \`USDC\` (not \`USDC.e\`), displays six-decimal amounts correctly, and contains no fallback local contract address. If \`scaffold.config.ts\` needs an RPC setting, read it from \`process.env\`; the value belongs in \`.env.local\`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+\`\`\`bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+\`\`\`
+
+If that workspace identifier differs, inspect \`packages/nextjs/package.json\` and run its defined \`lint\` and \`build\` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+\`\`\`bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+\`\`\`
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by \`yarn account --network base\`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+\`\`\`bash
+yarn verify --network base
+\`\`\`
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+\`\`\`bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The standard \`yarn deploy\` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly \`packages/nextjs/contracts/deployedContracts.ts\`). Commit the generated address and the Base target together:
+
+\`\`\`bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+\`\`\`
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and \`yarn verify --network base\` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+\`\`\`bash
+yarn start
+\`\`\`
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+\`\`\`bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+\`\`\`
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+\`\`\`bash
+npx vercel@latest --prod
+\`\`\`
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+\`\`\`text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+\`\`\`
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.
+

exec
/bin/bash -lc "git diff --check && wc -l LAUNCH.md && sed -n '1,80p' LAUNCH.md && git status --short" in /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 33ms:
280 LAUNCH.md
# Base Mainnet Launch Runbook

This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.

Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.

## 0. Assign roles and freeze the release candidate

Agree explicitly on:

| Responsibility | Production choice |
| --- | --- |
| Deployer | New dedicated EOA, used only for deployment |
| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
| Release approval | The team member who is not broadcasting |
| Incident owner | Both team members |

Freeze and identify the exact source:

\`\`\`bash
git switch -c release/base-mainnet-YYYY-MM-DD
git status --short
yarn install --immutable
git rev-parse HEAD
\`\`\`

Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.

**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.

**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.

## 1. Lock the parameters that will be immutable

Write and have both people sign off on this table before configuring a wallet:

| Parameter | Required value |
| --- | --- |
| Network | Base mainnet, 8453 |
| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
| Token decimals | 6 |
| Fee | 100 basis points / 1% |
| Fee recipient | The approved address from stage 0 |
| Privileged authority | The approved address from stage 0 |

Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):

\`\`\`solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
uint16 constant PLATFORM_FEE_BPS = 100;
\`\`\`

If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.

**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.

**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.

## 2. Final test pass against a Base fork

Use the real Base state instead of mocks. The exact command form matters:

\`\`\`bash
yarn fork --network base
\`\`\`

Leave the fork running. In another terminal:

\`\`\`bash
yarn start
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
yarn test
\`\`\`

The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.

With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:

?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c06f6620acc502ed1b198d42a29e97e4b620f252
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,280 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+\`\`\`bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --immutable
+git rev-parse HEAD
+\`\`\`
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+\`\`\`solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+\`\`\`
+
+If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+\`\`\`bash
+yarn fork --network base
+\`\`\`
+
+Leave the fork running. In another terminal:
+
+\`\`\`bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+\`\`\`
+
+The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (\`1000000\` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** \`yarn test\` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+\`\`\`bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+\`\`\`
+
+Put a fresh dedicated deployer key and the Base RPC URL into \`packages/foundry/.env\`, using **the variable names already read by this repository** (check \`foundry.toml\`, its scripts, and root package scripts). A typical shape is:
+
+\`\`\`dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+\`\`\`
+
+Preserve \`ETHERSCAN_API_KEY\` supplied by \`.env.example\`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a \`NEXT_PUBLIC_*\` variable.
+
+Validate the real account and RPC:
+
+\`\`\`bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return \`8453\`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and \`git status --short\` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed \`scaffold.config.ts\` target from the local network to Base:
+
+\`\`\`ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+\`\`\`
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset \`USDC\` (not \`USDC.e\`), displays six-decimal amounts correctly, and contains no fallback local contract address. If \`scaffold.config.ts\` needs an RPC setting, read it from \`process.env\`; the value belongs in \`.env.local\`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+\`\`\`bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+\`\`\`
+
+If that workspace identifier differs, inspect \`packages/nextjs/package.json\` and run its defined \`lint\` and \`build\` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+\`\`\`bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+\`\`\`
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by \`yarn account --network base\`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+\`\`\`bash
+yarn verify --network base
+\`\`\`
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+\`\`\`bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The standard \`yarn deploy\` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly \`packages/nextjs/contracts/deployedContracts.ts\`). Commit the generated address and the Base target together:
+
+\`\`\`bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+\`\`\`
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and \`yarn verify --network base\` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+\`\`\`bash
+yarn start
+\`\`\`
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+\`\`\`bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+\`\`\`
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+\`\`\`bash
+npx vercel@latest --prod
+\`\`\`
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+\`\`\`text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+\`\`\`
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.
+

exec
/bin/bash -lc "sed -n '1,"'$p'"' LAUNCH.md" in /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Base Mainnet Launch Runbook

This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.

Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.

## 0. Assign roles and freeze the release candidate

Agree explicitly on:

| Responsibility | Production choice |
| --- | --- |
| Deployer | New dedicated EOA, used only for deployment |
| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
| Release approval | The team member who is not broadcasting |
| Incident owner | Both team members |

Freeze and identify the exact source:

\`\`\`bash
git switch -c release/base-mainnet-YYYY-MM-DD
git status --short
yarn install --immutable
git rev-parse HEAD
\`\`\`

Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.

**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.

**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.

## 1. Lock the parameters that will be immutable

Write and have both people sign off on this table before configuring a wallet:

| Parameter | Required value |
| --- | --- |
| Network | Base mainnet, 8453 |
| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
| Token decimals | 6 |
| Fee | 100 basis points / 1% |
| Fee recipient | The approved address from stage 0 |
| Privileged authority | The approved address from stage 0 |

Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):

\`\`\`solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
uint16 constant PLATFORM_FEE_BPS = 100;
\`\`\`

If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.

**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.

**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.

## 2. Final test pass against a Base fork

Use the real Base state instead of mocks. The exact command form matters:

\`\`\`bash
yarn fork --network base
\`\`\`

Leave the fork running. In another terminal:

\`\`\`bash
yarn start
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
yarn test
\`\`\`

The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.

With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:

- 1.00 USDC (\`1000000\` units) and the smallest permitted amount/fee-rounding boundary;
- insufficient balance and insufficient allowance;
- rejected signature and reverted transaction;
- wrong-chain wallet;
- creator amount plus fee equals gross amount;
- every withdrawal, pause, or privileged method, including an unauthorized call.

**Go only if:** \`yarn test\` exits 0 and the browser journey works using the canonical Base USDC state on the fork.

**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.

## 3. Add secrets, verify chain access, and fund test accounts

Create local secret files from the repository templates:

\`\`\`bash
cp packages/foundry/.env.example packages/foundry/.env
cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
chmod 600 packages/foundry/.env
git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
\`\`\`

Put a fresh dedicated deployer key and the Base RPC URL into \`packages/foundry/.env\`, using **the variable names already read by this repository** (check \`foundry.toml\`, its scripts, and root package scripts). A typical shape is:

\`\`\`dotenv
DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
\`\`\`

Preserve \`ETHERSCAN_API_KEY\` supplied by \`.env.example\`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a \`NEXT_PUBLIC_*\` variable.

Validate the real account and RPC:

\`\`\`bash
yarn account --network base
cast chain-id --rpc-url "$BASE_RPC_URL"
\`\`\`

The account command must show the intended deployer with nonzero Base ETH. The cast command must return \`8453\`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.

**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and \`git status --short\` does not list the secret files.

**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.

## 4. Configure the production frontend, without publishing it

After the fork phase, change the committed \`scaffold.config.ts\` target from the local network to Base:

\`\`\`ts
import { chains } from "viem";

const scaffoldConfig = {
  targetNetworks: [chains.base],
  // retain this repository's existing settings
};
\`\`\`

Ensure the app only enables approve/tip after a wallet is on Base, labels the asset \`USDC\` (not \`USDC.e\`), displays six-decimal amounts correctly, and contains no fallback local contract address. If \`scaffold.config.ts\` needs an RPC setting, read it from \`process.env\`; the value belongs in \`.env.local\`, never in the committed config.

Run the production frontend checks. In a standard SE-2 checkout:

\`\`\`bash
yarn workspace @se-2/nextjs lint
yarn workspace @se-2/nextjs build
\`\`\`

If that workspace identifier differs, inspect \`packages/nextjs/package.json\` and run its defined \`lint\` and \`build\` scripts.

**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.

**Catch now:** inspect every old-network hit and remove unintended ones:

\`\`\`bash
rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
\`\`\`

## 5. Independent pre-broadcast review

Prepare, but do not yet execute:

\`\`\`bash
yarn deploy --network base
\`\`\`

The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by \`yarn account --network base\`.

**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.

**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.

## 6. Deploy, verify, and read back configuration

Broadcast once:

\`\`\`bash
yarn deploy --network base
\`\`\`

Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):

\`\`\`bash
yarn verify --network base
\`\`\`

Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:

\`\`\`bash
cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
\`\`\`

The standard \`yarn deploy\` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly \`packages/nextjs/contracts/deployedContracts.ts\`). Commit the generated address and the Base target together:

\`\`\`bash
git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
git commit -m "chore: configure Base mainnet deployment"
git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
\`\`\`

If this checkout generates another path, substitute that exact imported artifact, not an unused file.

**Go only if:** deployment and \`yarn verify --network base\` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.

**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.

## 7. Private live-chain acceptance

Keep the frontend local/private while it points to the generated Base deployment:

\`\`\`bash
yarn start
\`\`\`

Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:

1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
2. Check USDC balance and allowance are presented in six decimals.
3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
4. Send a small tip, wait for confirmation, refresh, and reconnect.
5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.

For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.

**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.

**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.

## 8. Preview, then publish the frontend

Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.

For a standard Next.js SE-2 site on Vercel, create a preview:

\`\`\`bash
cd packages/nextjs
npx vercel@latest login
npx vercel@latest
\`\`\`

Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.

Promote the same tested commit:

\`\`\`bash
npx vercel@latest --prod
\`\`\`

For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.

**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.

**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.

## 9. Public confirmation and operating watch

Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.

For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:

\`\`\`text
fan USDC debit = creator amount + platform fee
platform fee / gross tip = 1% (using documented integer rounding)
event token, creator, and amounts match UI and intended recipients
\`\`\`

Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.

## Incident rules

- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.

Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.


2026-09-03T19:12:23.137820Z ERROR codex_core::tools::router: error=apply_patch verification failed: Failed to find expected lines in /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md:
stty: 'standard input': Inappropriate ioctl for device
# Base Mainnet Launch Runbook

This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.

Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.

## 0. Assign roles and freeze the release candidate

Agree explicitly on:

| Responsibility | Production choice |
| --- | --- |
| Deployer | New dedicated EOA, used only for deployment |
| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
| Release approval | The team member who is not broadcasting |
| Incident owner | Both team members |

Freeze and identify the exact source:

\`\`\`bash
git switch -c release/base-mainnet-YYYY-MM-DD
git status --short
yarn install --immutable
git rev-parse HEAD
\`\`\`

Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.

**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.

**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.

## 1. Lock the parameters that will be immutable

Write and have both people sign off on this table before configuring a wallet:

| Parameter | Required value |
| --- | --- |
| Network | Base mainnet, 8453 |
| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
| Token decimals | 6 |
| Fee | 100 basis points / 1% |
| Fee recipient | The approved address from stage 0 |
| Privileged authority | The approved address from stage 0 |

Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):

\`\`\`solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
uint16 constant PLATFORM_FEE_BPS = 100;
\`\`\`

If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.

**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.

**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.

## 2. Final test pass against a Base fork

Use the real Base state instead of mocks. The exact command form matters:

\`\`\`bash
yarn fork --network base
\`\`\`

Leave the fork running. In another terminal:

\`\`\`bash
yarn start
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
yarn test
\`\`\`

The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.

With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:

- 1.00 USDC (\`1000000\` units) and the smallest permitted amount/fee-rounding boundary;
- insufficient balance and insufficient allowance;
- rejected signature and reverted transaction;
- wrong-chain wallet;
- creator amount plus fee equals gross amount;
- every withdrawal, pause, or privileged method, including an unauthorized call.

**Go only if:** \`yarn test\` exits 0 and the browser journey works using the canonical Base USDC state on the fork.

**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.

## 3. Add secrets, verify chain access, and fund test accounts

Create local secret files from the repository templates:

\`\`\`bash
cp packages/foundry/.env.example packages/foundry/.env
cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
chmod 600 packages/foundry/.env
git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
\`\`\`

Put a fresh dedicated deployer key and the Base RPC URL into \`packages/foundry/.env\`, using **the variable names already read by this repository** (check \`foundry.toml\`, its scripts, and root package scripts). A typical shape is:

\`\`\`dotenv
DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
\`\`\`

Preserve \`ETHERSCAN_API_KEY\` supplied by \`.env.example\`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a \`NEXT_PUBLIC_*\` variable.

Validate the real account and RPC:

\`\`\`bash
yarn account --network base
cast chain-id --rpc-url "$BASE_RPC_URL"
\`\`\`

The account command must show the intended deployer with nonzero Base ETH. The cast command must return \`8453\`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.

**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and \`git status --short\` does not list the secret files.

**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.

## 4. Configure the production frontend, without publishing it

After the fork phase, change the committed \`scaffold.config.ts\` target from the local network to Base:

\`\`\`ts
import { chains } from "viem";

const scaffoldConfig = {
  targetNetworks: [chains.base],
  // retain this repository's existing settings
};
\`\`\`

Ensure the app only enables approve/tip after a wallet is on Base, labels the asset \`USDC\` (not \`USDC.e\`), displays six-decimal amounts correctly, and contains no fallback local contract address. If \`scaffold.config.ts\` needs an RPC setting, read it from \`process.env\`; the value belongs in \`.env.local\`, never in the committed config.

Run the production frontend checks. In a standard SE-2 checkout:

\`\`\`bash
yarn workspace @se-2/nextjs lint
yarn workspace @se-2/nextjs build
\`\`\`

If that workspace identifier differs, inspect \`packages/nextjs/package.json\` and run its defined \`lint\` and \`build\` scripts.

**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.

**Catch now:** inspect every old-network hit and remove unintended ones:

\`\`\`bash
rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
\`\`\`

## 5. Independent pre-broadcast review

Prepare, but do not yet execute:

\`\`\`bash
yarn deploy --network base
\`\`\`

The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by \`yarn account --network base\`.

**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.

**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.

## 6. Deploy, verify, and read back configuration

Broadcast once:

\`\`\`bash
yarn deploy --network base
\`\`\`

Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):

\`\`\`bash
yarn verify --network base
\`\`\`

Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:

\`\`\`bash
cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
\`\`\`

The standard \`yarn deploy\` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly \`packages/nextjs/contracts/deployedContracts.ts\`). Commit the generated address and the Base target together:

\`\`\`bash
git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
git commit -m "chore: configure Base mainnet deployment"
git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
\`\`\`

If this checkout generates another path, substitute that exact imported artifact, not an unused file.

**Go only if:** deployment and \`yarn verify --network base\` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.

**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.

## 7. Private live-chain acceptance

Keep the frontend local/private while it points to the generated Base deployment:

\`\`\`bash
yarn start
\`\`\`

Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:

1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
2. Check USDC balance and allowance are presented in six decimals.
3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
4. Send a small tip, wait for confirmation, refresh, and reconnect.
5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.

For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.

**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.

**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.

## 8. Preview, then publish the frontend

Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.

For a standard Next.js SE-2 site on Vercel, create a preview:

\`\`\`bash
cd packages/nextjs
npx vercel@latest login
npx vercel@latest
\`\`\`

Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.

Promote the same tested commit:

\`\`\`bash
npx vercel@latest --prod
\`\`\`

For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.

**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.

**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.

## 9. Public confirmation and operating watch

Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.

For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:

\`\`\`text
fan USDC debit = creator amount + platform fee
platform fee / gross tip = 1% (using documented integer rounding)
event token, creator, and amounts match UI and intended recipients
\`\`\`

Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.

## Incident rules

- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.

Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..c06f6620acc502ed1b198d42a29e97e4b620f252
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,280 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+\`\`\`bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --immutable
+git rev-parse HEAD
+\`\`\`
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+\`\`\`solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+\`\`\`
+
+If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+\`\`\`bash
+yarn fork --network base
+\`\`\`
+
+Leave the fork running. In another terminal:
+
+\`\`\`bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+\`\`\`
+
+The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (\`1000000\` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** \`yarn test\` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+\`\`\`bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+\`\`\`
+
+Put a fresh dedicated deployer key and the Base RPC URL into \`packages/foundry/.env\`, using **the variable names already read by this repository** (check \`foundry.toml\`, its scripts, and root package scripts). A typical shape is:
+
+\`\`\`dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+\`\`\`
+
+Preserve \`ETHERSCAN_API_KEY\` supplied by \`.env.example\`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a \`NEXT_PUBLIC_*\` variable.
+
+Validate the real account and RPC:
+
+\`\`\`bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return \`8453\`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and \`git status --short\` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed \`scaffold.config.ts\` target from the local network to Base:
+
+\`\`\`ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+\`\`\`
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset \`USDC\` (not \`USDC.e\`), displays six-decimal amounts correctly, and contains no fallback local contract address. If \`scaffold.config.ts\` needs an RPC setting, read it from \`process.env\`; the value belongs in \`.env.local\`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+\`\`\`bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+\`\`\`
+
+If that workspace identifier differs, inspect \`packages/nextjs/package.json\` and run its defined \`lint\` and \`build\` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+\`\`\`bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+\`\`\`
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by \`yarn account --network base\`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+\`\`\`bash
+yarn deploy --network base
+\`\`\`
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+\`\`\`bash
+yarn verify --network base
+\`\`\`
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+\`\`\`bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+\`\`\`
+
+The standard \`yarn deploy\` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly \`packages/nextjs/contracts/deployedContracts.ts\`). Commit the generated address and the Base target together:
+
+\`\`\`bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+\`\`\`
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and \`yarn verify --network base\` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+\`\`\`bash
+yarn start
+\`\`\`
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+\`\`\`bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+\`\`\`
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+\`\`\`bash
+npx vercel@latest --prod
+\`\`\`
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+\`\`\`text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+\`\`\`
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.
+

exec
/bin/bash -c "sed -n '1,"'$p'"' LAUNCH.md" in /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 0ms:
# Base Mainnet Launch Runbook

This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with \`packages/foundry\` and \`packages/nextjs\`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.

Base mainnet is chain ID \`8453\`. The canonical native USDC contract on Base is \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`, and it has 6 decimals.

## 0. Assign roles and freeze the release candidate

Agree explicitly on:

| Responsibility | Production choice |
| --- | --- |
| Deployer | New dedicated EOA, used only for deployment |
| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
| Release approval | The team member who is not broadcasting |
| Incident owner | Both team members |

Freeze and identify the exact source:

\`\`\`bash
git switch -c release/base-mainnet-YYYY-MM-DD
git status --short
yarn install --immutable
git rev-parse HEAD
\`\`\`

Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.

**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.

**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never \`1e18\`.

## 1. Lock the parameters that will be immutable

Write and have both people sign off on this table before configuring a wallet:

| Parameter | Required value |
| --- | --- |
| Network | Base mainnet, 8453 |
| Payment token | \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\` |
| Token decimals | 6 |
| Fee | 100 basis points / 1% |
| Fee recipient | The approved address from stage 0 |
| Privileged authority | The approved address from stage 0 |

Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):

\`\`\`solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
uint16 constant PLATFORM_FEE_BPS = 100;
\`\`\`

If the script reads environment variables instead, keep the same values in \`packages/foundry/.env\`; do not duplicate values in a second script. Use checksummed addresses.

**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.

**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.

## 2. Final test pass against a Base fork

Use the real Base state instead of mocks. The exact command form matters:

\`\`\`bash
yarn fork --network base
\`\`\`

Leave the fork running. In another terminal:

\`\`\`bash
yarn start
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
yarn test
\`\`\`

The \`cast code\` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.

With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:

- 1.00 USDC (\`1000000\` units) and the smallest permitted amount/fee-rounding boundary;
- insufficient balance and insufficient allowance;
- rejected signature and reverted transaction;
- wrong-chain wallet;
- creator amount plus fee equals gross amount;
- every withdrawal, pause, or privileged method, including an unauthorized call.

**Go only if:** \`yarn test\` exits 0 and the browser journey works using the canonical Base USDC state on the fork.

**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.

## 3. Add secrets, verify chain access, and fund test accounts

Create local secret files from the repository templates:

\`\`\`bash
cp packages/foundry/.env.example packages/foundry/.env
cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
chmod 600 packages/foundry/.env
git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
\`\`\`

Put a fresh dedicated deployer key and the Base RPC URL into \`packages/foundry/.env\`, using **the variable names already read by this repository** (check \`foundry.toml\`, its scripts, and root package scripts). A typical shape is:

\`\`\`dotenv
DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
\`\`\`

Preserve \`ETHERSCAN_API_KEY\` supplied by \`.env.example\`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a \`NEXT_PUBLIC_*\` variable.

Validate the real account and RPC:

\`\`\`bash
yarn account --network base
cast chain-id --rpc-url "$BASE_RPC_URL"
\`\`\`

The account command must show the intended deployer with nonzero Base ETH. The cast command must return \`8453\`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.

**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and \`git status --short\` does not list the secret files.

**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.

## 4. Configure the production frontend, without publishing it

After the fork phase, change the committed \`scaffold.config.ts\` target from the local network to Base:

\`\`\`ts
import { chains } from "viem";

const scaffoldConfig = {
  targetNetworks: [chains.base],
  // retain this repository's existing settings
};
\`\`\`

Ensure the app only enables approve/tip after a wallet is on Base, labels the asset \`USDC\` (not \`USDC.e\`), displays six-decimal amounts correctly, and contains no fallback local contract address. If \`scaffold.config.ts\` needs an RPC setting, read it from \`process.env\`; the value belongs in \`.env.local\`, never in the committed config.

Run the production frontend checks. In a standard SE-2 checkout:

\`\`\`bash
yarn workspace @se-2/nextjs lint
yarn workspace @se-2/nextjs build
\`\`\`

If that workspace identifier differs, inspect \`packages/nextjs/package.json\` and run its defined \`lint\` and \`build\` scripts.

**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.

**Catch now:** inspect every old-network hit and remove unintended ones:

\`\`\`bash
rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
\`\`\`

## 5. Independent pre-broadcast review

Prepare, but do not yet execute:

\`\`\`bash
yarn deploy --network base
\`\`\`

The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by \`yarn account --network base\`.

**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.

**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.

## 6. Deploy, verify, and read back configuration

Broadcast once:

\`\`\`bash
yarn deploy --network base
\`\`\`

Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):

\`\`\`bash
yarn verify --network base
\`\`\`

Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:

\`\`\`bash
cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
\`\`\`

The standard \`yarn deploy\` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly \`packages/nextjs/contracts/deployedContracts.ts\`). Commit the generated address and the Base target together:

\`\`\`bash
git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
git commit -m "chore: configure Base mainnet deployment"
git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
\`\`\`

If this checkout generates another path, substitute that exact imported artifact, not an unused file.

**Go only if:** deployment and \`yarn verify --network base\` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.

**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.

## 7. Private live-chain acceptance

Keep the frontend local/private while it points to the generated Base deployment:

\`\`\`bash
yarn start
\`\`\`

Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:

1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
2. Check USDC balance and allowance are presented in six decimals.
3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
4. Send a small tip, wait for confirmation, refresh, and reconnect.
5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.

For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.

**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.

**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.

## 8. Preview, then publish the frontend

Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.

For a standard Next.js SE-2 site on Vercel, create a preview:

\`\`\`bash
cd packages/nextjs
npx vercel@latest login
npx vercel@latest
\`\`\`

Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.

Promote the same tested commit:

\`\`\`bash
npx vercel@latest --prod
\`\`\`

For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.

**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.

**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.

## 9. Public confirmation and operating watch

Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.

For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:

\`\`\`text
fan USDC debit = creator amount + platform fee
platform fee / gross tip = 1% (using documented integer rounding)
event token, creator, and amounts match UI and intended recipients
\`\`\`

Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.

## Incident rules

- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.

Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.


apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f22e81431610e7f6cb14367eb32380bb865dd1e4
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,279 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with `packages/foundry` and `packages/nextjs`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID `8453`. The canonical native USDC contract on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+```bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --immutable
+git rev-parse HEAD
+```
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never `1e18`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+```solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+```
+
+If the script reads environment variables instead, keep the same values in `packages/foundry/.env`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+```bash
+yarn fork --network base
+```
+
+Leave the fork running. In another terminal:
+
+```bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+```
+
+The `cast code` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (`1000000` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** `yarn test` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+```bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+```
+
+Put a fresh dedicated deployer key and the Base RPC URL into `packages/foundry/.env`, using **the variable names already read by this repository** (check `foundry.toml`, its scripts, and root package scripts). A typical shape is:
+
+```dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+```
+
+Preserve `ETHERSCAN_API_KEY` supplied by `.env.example`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a `NEXT_PUBLIC_*` variable.
+
+Validate the real account and RPC:
+
+```bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+```
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return `8453`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and `git status --short` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed `scaffold.config.ts` target from the local network to Base:
+
+```ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+```
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset `USDC` (not `USDC.e`), displays six-decimal amounts correctly, and contains no fallback local contract address. If `scaffold.config.ts` needs an RPC setting, read it from `process.env`; the value belongs in `.env.local`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+```bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+```
+
+If that workspace identifier differs, inspect `packages/nextjs/package.json` and run its defined `lint` and `build` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+```bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+```
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+```bash
+yarn deploy --network base
+```
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by `yarn account --network base`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+```bash
+yarn deploy --network base
+```
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+```bash
+yarn verify --network base
+```
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+```bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+```
+
+The standard `yarn deploy` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly `packages/nextjs/contracts/deployedContracts.ts`). Commit the generated address and the Base target together:
+
+```bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+```
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and `yarn verify --network base` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+```bash
+yarn start
+```
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+```bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+```
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+```bash
+npx vercel@latest --prod
+```
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+```text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+```
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f22e81431610e7f6cb14367eb32380bb865dd1e4
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,279 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with `packages/foundry` and `packages/nextjs`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID `8453`. The canonical native USDC contract on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+```bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --immutable
+git rev-parse HEAD
+```
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never `1e18`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+```solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+```
+
+If the script reads environment variables instead, keep the same values in `packages/foundry/.env`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+```bash
+yarn fork --network base
+```
+
+Leave the fork running. In another terminal:
+
+```bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+```
+
+The `cast code` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (`1000000` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** `yarn test` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+```bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+```
+
+Put a fresh dedicated deployer key and the Base RPC URL into `packages/foundry/.env`, using **the variable names already read by this repository** (check `foundry.toml`, its scripts, and root package scripts). A typical shape is:
+
+```dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+```
+
+Preserve `ETHERSCAN_API_KEY` supplied by `.env.example`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a `NEXT_PUBLIC_*` variable.
+
+Validate the real account and RPC:
+
+```bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+```
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return `8453`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and `git status --short` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed `scaffold.config.ts` target from the local network to Base:
+
+```ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+```
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset `USDC` (not `USDC.e`), displays six-decimal amounts correctly, and contains no fallback local contract address. If `scaffold.config.ts` needs an RPC setting, read it from `process.env`; the value belongs in `.env.local`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+```bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+```
+
+If that workspace identifier differs, inspect `packages/nextjs/package.json` and run its defined `lint` and `build` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+```bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+```
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+```bash
+yarn deploy --network base
+```
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by `yarn account --network base`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+```bash
+yarn deploy --network base
+```
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+```bash
+yarn verify --network base
+```
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+```bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+```
+
+The standard `yarn deploy` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly `packages/nextjs/contracts/deployedContracts.ts`). Commit the generated address and the Base target together:
+
+```bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+```
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and `yarn verify --network base` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+```bash
+yarn start
+```
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+```bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+```
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+```bash
+npx vercel@latest --prod
+```
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+```text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+```
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.

exec
/bin/bash -c "git diff --check && rg -n '\\\\\\"'`|''^## '"' LAUNCH.md && git status --short" in /home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 0ms:
7:## 0. Assign roles and freeze the release candidate
34:## 1. Lock the parameters that will be immutable
61:## 2. Final test pass against a Base fork
92:## 3. Add secrets, verify chain access, and fund test accounts
125:## 4. Configure the production frontend, without publishing it
157:## 5. Independent pre-broadcast review
171:## 6. Deploy, verify, and read back configuration
208:## 7. Private live-chain acceptance
231:## 8. Preview, then publish the frontend
257:## 9. Public confirmation and operating watch
271:## Incident rules
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f22e81431610e7f6cb14367eb32380bb865dd1e4
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,279 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with `packages/foundry` and `packages/nextjs`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID `8453`. The canonical native USDC contract on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+```bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --immutable
+git rev-parse HEAD
+```
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never `1e18`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+```solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+```
+
+If the script reads environment variables instead, keep the same values in `packages/foundry/.env`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+```bash
+yarn fork --network base
+```
+
+Leave the fork running. In another terminal:
+
+```bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+```
+
+The `cast code` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (`1000000` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** `yarn test` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+```bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+```
+
+Put a fresh dedicated deployer key and the Base RPC URL into `packages/foundry/.env`, using **the variable names already read by this repository** (check `foundry.toml`, its scripts, and root package scripts). A typical shape is:
+
+```dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+```
+
+Preserve `ETHERSCAN_API_KEY` supplied by `.env.example`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a `NEXT_PUBLIC_*` variable.
+
+Validate the real account and RPC:
+
+```bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+```
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return `8453`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and `git status --short` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed `scaffold.config.ts` target from the local network to Base:
+
+```ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+```
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset `USDC` (not `USDC.e`), displays six-decimal amounts correctly, and contains no fallback local contract address. If `scaffold.config.ts` needs an RPC setting, read it from `process.env`; the value belongs in `.env.local`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+```bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+```
+
+If that workspace identifier differs, inspect `packages/nextjs/package.json` and run its defined `lint` and `build` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+```bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+```
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+```bash
+yarn deploy --network base
+```
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by `yarn account --network base`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+```bash
+yarn deploy --network base
+```
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+```bash
+yarn verify --network base
+```
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+```bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+```
+
+The standard `yarn deploy` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly `packages/nextjs/contracts/deployedContracts.ts`). Commit the generated address and the Base target together:
+
+```bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+```
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and `yarn verify --network base` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+```bash
+yarn start
+```
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+```bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+```
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+```bash
+npx vercel@latest --prod
+```
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+```text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+```
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.

apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..1be6fc9ff5a7f116c8b7e174f41df45a23430f50
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,279 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with `packages/foundry` and `packages/nextjs`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID `8453`. The canonical native USDC contract on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+```bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --frozen-lockfile
+git rev-parse HEAD
+```
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never `1e18`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+```solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+```
+
+If the script reads environment variables instead, keep the same values in `packages/foundry/.env`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+```bash
+yarn fork --network base
+```
+
+Leave the fork running. In another terminal:
+
+```bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+```
+
+The `cast code` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (`1000000` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** `yarn test` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+```bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+```
+
+Put a fresh dedicated deployer key and the Base RPC URL into `packages/foundry/.env`, using **the variable names already read by this repository** (check `foundry.toml`, its scripts, and root package scripts). A typical shape is:
+
+```dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+```
+
+Preserve `ETHERSCAN_API_KEY` supplied by `.env.example`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a `NEXT_PUBLIC_*` variable.
+
+Validate the real account and RPC:
+
+```bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+```
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return `8453`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and `git status --short` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed `scaffold.config.ts` target from the local network to Base:
+
+```ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+```
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset `USDC` (not `USDC.e`), displays six-decimal amounts correctly, and contains no fallback local contract address. If `scaffold.config.ts` needs an RPC setting, read it from `process.env`; the value belongs in `.env.local`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+```bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+```
+
+If that workspace identifier differs, inspect `packages/nextjs/package.json` and run its defined `lint` and `build` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+```bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+```
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+```bash
+yarn deploy --network base
+```
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by `yarn account --network base`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+```bash
+yarn deploy --network base
+```
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+```bash
+yarn verify --network base
+```
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+```bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+```
+
+The standard `yarn deploy` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly `packages/nextjs/contracts/deployedContracts.ts`). Commit the generated address and the Base target together:
+
+```bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+```
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and `yarn verify --network base` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+```bash
+yarn start
+```
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+```bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+```
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+```bash
+npx vercel@latest --prod
+```
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+```text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+```
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..1be6fc9ff5a7f116c8b7e174f41df45a23430f50
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,279 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with `packages/foundry` and `packages/nextjs`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID `8453`. The canonical native USDC contract on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+```bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --frozen-lockfile
+git rev-parse HEAD
+```
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never `1e18`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+```solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+```
+
+If the script reads environment variables instead, keep the same values in `packages/foundry/.env`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+```bash
+yarn fork --network base
+```
+
+Leave the fork running. In another terminal:
+
+```bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+```
+
+The `cast code` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (`1000000` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** `yarn test` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+```bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+```
+
+Put a fresh dedicated deployer key and the Base RPC URL into `packages/foundry/.env`, using **the variable names already read by this repository** (check `foundry.toml`, its scripts, and root package scripts). A typical shape is:
+
+```dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+```
+
+Preserve `ETHERSCAN_API_KEY` supplied by `.env.example`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a `NEXT_PUBLIC_*` variable.
+
+Validate the real account and RPC:
+
+```bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+```
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return `8453`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and `git status --short` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed `scaffold.config.ts` target from the local network to Base:
+
+```ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+```
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset `USDC` (not `USDC.e`), displays six-decimal amounts correctly, and contains no fallback local contract address. If `scaffold.config.ts` needs an RPC setting, read it from `process.env`; the value belongs in `.env.local`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+```bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+```
+
+If that workspace identifier differs, inspect `packages/nextjs/package.json` and run its defined `lint` and `build` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+```bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+```
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+```bash
+yarn deploy --network base
+```
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by `yarn account --network base`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+```bash
+yarn deploy --network base
+```
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+```bash
+yarn verify --network base
+```
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+```bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+```
+
+The standard `yarn deploy` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly `packages/nextjs/contracts/deployedContracts.ts`). Commit the generated address and the Base target together:
+
+```bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+```
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and `yarn verify --network base` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+```bash
+yarn start
+```
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+```bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+```
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+```bash
+npx vercel@latest --prod
+```
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+```text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+```
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.

codex
Created [LAUNCH.md](/home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md).

It provides the ordered Base mainnet runbook: parameter lock, Base-fork preflight, secure funding/config, deploy + immediate verification, private real-money acceptance, preview-to-production frontend release, monitoring, and incident paths. I also validated the document for patch/whitespace errors.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..1be6fc9ff5a7f116c8b7e174f41df45a23430f50
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,279 @@
+# Base Mainnet Launch Runbook
+
+This is the complete production sequence for the Foundry version of Scaffold-ETH 2. Run commands from the application repository root (the directory with `packages/foundry` and `packages/nextjs`). A failed **Go** gate means stop: correct the issue, add a regression test where appropriate, then repeat that stage. Do not make the frontend public before stage 8.
+
+Base mainnet is chain ID `8453`. The canonical native USDC contract on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and it has 6 decimals.
+
+## 0. Assign roles and freeze the release candidate
+
+Agree explicitly on:
+
+| Responsibility | Production choice |
+| --- | --- |
+| Deployer | New dedicated EOA, used only for deployment |
+| Platform-fee recipient | Approved independently controlled address, preferably a multisig |
+| Admin / pause / upgrade authority, if any | Approved production address/multisig, never a throwaway deployer |
+| Release approval | The team member who is not broadcasting |
+| Incident owner | Both team members |
+
+Freeze and identify the exact source:
+
+```bash
+git switch -c release/base-mainnet-YYYY-MM-DD
+git status --short
+yarn install --frozen-lockfile
+git rev-parse HEAD
+```
+
+Record the resulting SHA in release notes. Both people review the Solidity contracts and the deploy script at that SHA.
+
+**Go only if:** the worktree is clean, tests are known to pass from the current candidate, and both people have reviewed it.
+
+**Catch now:** search the contracts/scripts for test addresses, local/mock USDC, unrestricted withdrawal methods, development owners, and upgrade/pausing powers. Confirm all user-facing USDC calculations use six decimals, never `1e18`.
+
+## 1. Lock the parameters that will be immutable
+
+Write and have both people sign off on this table before configuring a wallet:
+
+| Parameter | Required value |
+| --- | --- |
+| Network | Base mainnet, 8453 |
+| Payment token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
+| Token decimals | 6 |
+| Fee | 100 basis points / 1% |
+| Fee recipient | The approved address from stage 0 |
+| Privileged authority | The approved address from stage 0 |
+
+Inspect the actual constructor and deployment script. Make the intended values visible in it (use the repository's real contract and variable names):
+
+```solidity
+address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
+address constant FEE_RECIPIENT = 0xYourApprovedMultisig;
+uint16 constant PLATFORM_FEE_BPS = 100;
+```
+
+If the script reads environment variables instead, keep the same values in `packages/foundry/.env`; do not duplicate values in a second script. Use checksummed addresses.
+
+**Go only if:** a second person independently verifies every address; 1 USDC is 1,000,000 units; and the documented rounding rule makes creator amount + platform fee equal gross tip.
+
+**Stop for:** a mutable fee above 1%, a silently substituted local/mock token, or admin authority capable of unexpected fund movement. Resolve the product/security issue before continuing.
+
+## 2. Final test pass against a Base fork
+
+Use the real Base state instead of mocks. The exact command form matters:
+
+```bash
+yarn fork --network base
+```
+
+Leave the fork running. In another terminal:
+
+```bash
+yarn start
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+yarn test
+```
+
+The `cast code` result must be non-empty. A Foundry fork reports chain ID 31337 even when it is correctly forking Base, so do not use the chain ID to prove its source.
+
+With the browser wallet, repeat the complete journey on the fork: connect, choose a creator, approve USDC, tip, wait for confirmation, refresh, and read the balances/events. Cover these cases in tests and UI:
+
+- 1.00 USDC (`1000000` units) and the smallest permitted amount/fee-rounding boundary;
+- insufficient balance and insufficient allowance;
+- rejected signature and reverted transaction;
+- wrong-chain wallet;
+- creator amount plus fee equals gross amount;
+- every withdrawal, pause, or privileged method, including an unauthorized call.
+
+**Go only if:** `yarn test` exits 0 and the browser journey works using the canonical Base USDC state on the fork.
+
+**Catch now:** inspect contract balances and emitted events after a tip. A UI success message is insufficient proof that the fee reached the correct recipient. Every discovered error gets a regression test; never rely on a frontend-only validation for a Solidity defect.
+
+## 3. Add secrets, verify chain access, and fund test accounts
+
+Create local secret files from the repository templates:
+
+```bash
+cp packages/foundry/.env.example packages/foundry/.env
+cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
+chmod 600 packages/foundry/.env
+git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
+```
+
+Put a fresh dedicated deployer key and the Base RPC URL into `packages/foundry/.env`, using **the variable names already read by this repository** (check `foundry.toml`, its scripts, and root package scripts). A typical shape is:
+
+```dotenv
+DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
+BASE_RPC_URL=https://<authenticated-base-rpc-endpoint>
+```
+
+Preserve `ETHERSCAN_API_KEY` supplied by `.env.example`; standard SE-2 has a working default. It is not necessary to obtain a separate explorer key before launch. Do not commit any secret or put a privileged key in a `NEXT_PUBLIC_*` variable.
+
+Validate the real account and RPC:
+
+```bash
+yarn account --network base
+cast chain-id --rpc-url "$BASE_RPC_URL"
+```
+
+The account command must show the intended deployer with nonzero Base ETH. The cast command must return `8453`. Fund the deployer with enough Base ETH for deployment and a modest reserve. Separately fund two browser-wallet acceptance accounts with small Base ETH and $1–10 total in Base USDC.
+
+**Go only if:** all production addresses match stage 0, the deployer is funded before broadcast, the RPC returns 8453, and `git status --short` does not list the secret files.
+
+**Catch now:** make a harmless read against the same RPC. Wrong endpoints and unfunded deployers are the usual first-broadcast failures.
+
+## 4. Configure the production frontend, without publishing it
+
+After the fork phase, change the committed `scaffold.config.ts` target from the local network to Base:
+
+```ts
+import { chains } from "viem";
+
+const scaffoldConfig = {
+  targetNetworks: [chains.base],
+  // retain this repository's existing settings
+};
+```
+
+Ensure the app only enables approve/tip after a wallet is on Base, labels the asset `USDC` (not `USDC.e`), displays six-decimal amounts correctly, and contains no fallback local contract address. If `scaffold.config.ts` needs an RPC setting, read it from `process.env`; the value belongs in `.env.local`, never in the committed config.
+
+Run the production frontend checks. In a standard SE-2 checkout:
+
+```bash
+yarn workspace @se-2/nextjs lint
+yarn workspace @se-2/nextjs build
+```
+
+If that workspace identifier differs, inspect `packages/nextjs/package.json` and run its defined `lint` and `build` scripts.
+
+**Go only if:** the production build passes and Base is the sole transaction target. It is expected not to have a live contract address until stage 6.
+
+**Catch now:** inspect every old-network hit and remove unintended ones:
+
+```bash
+rg -n "31337|localhost|USDC\\.e|<old-local-contract-address>" . -g '!node_modules' -g '!*.lock'
+```
+
+## 5. Independent pre-broadcast review
+
+Prepare, but do not yet execute:
+
+```bash
+yarn deploy --network base
+```
+
+The non-deployer compares the exact constructor/deploy-script values with the stage-1 table, the recorded source SHA, and the address printed by `yarn account --network base`.
+
+**Go only if:** token, fee recipient, fee bps, privileged authority, and network all match exactly. The team accepts that this bytecode is a public, effectively immutable API unless a reviewed proxy design says otherwise.
+
+**Stop for:** unknown arguments, testnet addresses, a last-minute contract edit, or an unresolved test result. Correct it and restart the relevant earlier stage.
+
+## 6. Deploy, verify, and read back configuration
+
+Broadcast once:
+
+```bash
+yarn deploy --network base
+```
+
+Record the deployment transaction hash, contract address, deployer, source SHA, constructor values, and timestamp. From that same checkout, immediately verify source (verification replays its broadcast artifact):
+
+```bash
+yarn verify --network base
+```
+
+Open the Base explorer transaction and contract. Confirm chain 8453, success, the intended deployer, exact contract address, and verified source. Read the deployed configuration through the contract's real public getters. For example, replacing signatures with the actual ABI:
+
+```bash
+cast code 0x<DEPLOYED_TIPPING_CONTRACT> --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "usdc()(address)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
+cast call 0x<DEPLOYED_TIPPING_CONTRACT> "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
+```
+
+The standard `yarn deploy` generates the frontend's deployed-contract data. Confirm that the file actually imported by the app has a Base/8453 entry for this exact address (commonly `packages/nextjs/contracts/deployedContracts.ts`). Commit the generated address and the Base target together:
+
+```bash
+git add scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
+git commit -m "chore: configure Base mainnet deployment"
+git tag -a base-mainnet-YYYY-MM-DD -m "Base mainnet launch candidate"
+```
+
+If this checkout generates another path, substitute that exact imported artifact, not an unused file.
+
+**Go only if:** deployment and `yarn verify --network base` exit 0; explorer source is verified; bytecode exists; and each getter equals the stage-1 table.
+
+**Catch now:** a successful deployment can still have the wrong token, fee, or recipient. Getter read-backs catch those before anyone can tip. If anything differs, do not launch or mask it in the UI; assess a corrected redeployment and restart at stage 1.
+
+## 7. Private live-chain acceptance
+
+Keep the frontend local/private while it points to the generated Base deployment:
+
+```bash
+yarn start
+```
+
+Both team members use their own browser wallets on Base and use $1–10 total risk. Perform and record:
+
+1. Connect a fan wallet; a non-Base wallet must be blocked or prompted to switch.
+2. Check USDC balance and allowance are presented in six decimals.
+3. Approve only the intended amount, or the deliberate documented bounded allowance—never an accidental unlimited approval.
+4. Send a small tip, wait for confirmation, refresh, and reconnect.
+5. Independently inspect explorer transaction/events, creator amount, and fee-recipient transfer or accrued-fee accounting.
+6. Reject a signature; also test insufficient allowance if safe. The UI must show a useful failure and must not show success.
+
+For a 1.00 USDC tip, expected accounting is 1,000,000 units: 10,000 fee and 990,000 creator amount where the fee is deducted from the tip. Use the contract's explicit rounding rule for other amounts.
+
+**Go only if:** both people agree the observed chain data matches all expected amounts and recipients, and pending/rejected/reverted/confirmed UI states are accurate.
+
+**Stop for:** unexpected approval target, unapproved unlimited allowance, incorrect decimals, wrong recipient, or false success state. Contract faults require fix → regression test → redeploy → regenerate address → repeat stages 2–7; a UI patch does not repair live bytecode.
+
+## 8. Preview, then publish the frontend
+
+Configure only public non-secret frontend variables in the host. The build must use the tagged commit, Base target, and the generated contract artifact. Never place the deployer key, privileged key, or authenticated deploy RPC credentials in frontend hosting variables.
+
+For a standard Next.js SE-2 site on Vercel, create a preview:
+
+```bash
+cd packages/nextjs
+npx vercel@latest login
+npx vercel@latest
+```
+
+Open the preview in an incognito window with a browser wallet. Confirm the URL uses Base 8453 and the verified address, then repeat connect, wrong-network, balance/read, approval, and a small tip if the preview's configuration is identical to production.
+
+Promote the same tested commit:
+
+```bash
+npx vercel@latest --prod
+```
+
+For another host, use its equivalent preview-and-promote flow; do not create a new untested production build. Configure the custom domain and HTTPS before promotion, then confirm the domain resolves to the promoted build.
+
+**Go live only if:** preview passes, production is the tagged commit, HTTPS works, production references the verified Base contract, and a fresh browser cannot transact on localhost or another chain.
+
+**Catch now:** always test a fresh/incognito session. Cached local storage and development addresses often hide a bad production target.
+
+## 9. Public confirmation and operating watch
+
+Immediately load the public URL in a fresh session and send one final small real tip through that public URL. Inspect it on the Base explorer and save the hash. Publish the verified contract address, “Base network,” “USDC,” “1% platform fee,” and a support contact.
+
+For 24 hours, check app errors and explorer activity after each of the first 10 tips and at scheduled intervals thereafter. For each, compare:
+
+```text
+fan USDC debit = creator amount + platform fee
+platform fee / gross tip = 1% (using documented integer rounding)
+event token, creator, and amounts match UI and intended recipients
+```
+
+Alert on failed transactions, frontend-error spikes, unexpected fee transfers, or an accounting mismatch.
+
+## Incident rules
+
+- **Before public launch:** stop; fix source; add a regression test; redeploy; verify; regenerate frontend address; repeat private acceptance.
+- **Wrong live configuration before users:** do not use it. Correct and deploy a new address; point the app only at that address.
+- **Contract bug after users:** frontend validation is not a contract fix. Use an already-reviewed pause process if available; otherwise temporarily remove public access as harm reduction, communicate clearly, then execute the full fix/redeploy (or reviewed upgrade)/migration plan.
+- **Frontend-only incident:** roll the host back to the prior tagged, known-good release; confirm its Base target and contract address; fix via a new preview and acceptance test.
+- **Deployer-key compromise:** treat it as permanently compromised. Rotate secrets and move remaining operational authority/funds through the approved security process. Never deploy from it again.
+
+Preserve deployment artifacts, release notes, explorer links, and transaction hashes: they are the audit record of exactly what users are using.

tokens used
38,087
````

## final message

Created [LAUNCH.md](/home/damu/.cache/ethskills-evals/2026-09-03T190412Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md).

It provides the ordered Base mainnet runbook: parameter lock, Base-fork preflight, secure funding/config, deploy + immediate verification, private real-money acceptance, preview-to-production frontend release, monitoring, and incident paths. I also validated the document for patch/whitespace errors.
