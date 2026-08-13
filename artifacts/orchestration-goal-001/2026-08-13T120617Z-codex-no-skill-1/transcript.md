# Executor transcript — 2026-08-13T120617Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1

## session

```text
OpenAI Codex v0.146.0
--------
workdir: /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: medium
reasoning summaries: none
session id: 019ffb13-3028-75d0-89eb-0f605db25d84
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
I’ll produce this as an operator-grade runbook, with explicit gates, rollback paths, and separate testnet rehearsal before Base mainnet. I’ll first inspect the available workspace and verify current Base/Farcaster-style deployment guidance from primary sources where details are time-sensitive.
exec
/bin/zsh -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200 && git status --short" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1
 succeeded in 0ms:
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1
TASK.md
package.json

exec
/bin/zsh -lc "sed -n '1,240p' TASK.md && sed -n '1,240p' package.json" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1
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
web search: site:docs.base.org deploy smart contract foundry base mainnet verify ...
web search: 
web search: site:docs.base.org deploy smart contract foundry base mainnet verify ...
codex
The workspace contains only the launch brief, so the runbook will deliberately avoid inventing contract names or constructor arguments. It will use one controlled configuration record and commands that force the team to extract those facts from the real checkout before any broadcast. I’ve confirmed Base mainnet is chain ID 8453 and the canonical native USDC address from Base and Circle’s primary documentation.
2026-08-13T12:25:26.748633Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 375, 'the receipt and for a second, independent Base RPC/explorer to show the same' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f783c747734a528a631445e6cfbe6139b523cca5
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,270 @@
+# Base mainnet launch runbook
+
+Follow this in order. A gate is a hard stop. Owner A executes; Owner B independently verifies every address, transaction, and gate. Never put seed phrases, keys, keystores, private RPC URLs, or .env files in git, chat, tickets, recordings, or public build variables.
+
+Base mainnet: **chain ID 8453**. Canonical native USDC: **0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913**. Use a paid/dedicated RPC; Base's public endpoint is rate-limited and not production-ready. Sources: [Base network configuration](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base Foundry deployment](https://docs.base.org/get-started/deploy-smart-contracts), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Foundry key management](https://getfoundry.sh/guides/best-practices/writing-scripts/).
+
+## 1. Freeze tested source and map the real app
+
+In the actual Scaffold-ETH 2 checkout:
+
+~~~sh
+export APP=/absolute/path/to/scaffold-eth-2-checkout
+cd "$APP"
+git status --short
+git rev-parse HEAD
+rg -n --glob '!node_modules' 'USDC|fee|platform|treasury|owner|withdraw|constructor|Deploy|deployedContracts|scaffold.config|localhost|31337'
+find . -name .env -o -name '.env.*' | sort
+~~~
+
+**Gate:** worktree is clean (or all changes are committed and understood), and the SHA is recorded. Both owners identify from source/tests:
+
+- contract source, fully-qualified deploy-script target, constructor/initializer arguments in order;
+- tip function signature, USDC units (native USDC has 6 decimals), and approval flow;
+- fee rounding, recipient, owner/admin/pause/withdraw/upgrade paths;
+- frontend files providing chains, wallet/RPC config, contract address, and ABI.
+
+If one fact is unknown, stop and resolve it from the repo. Do not guess contract names from this runbook.
+
+Create the private record; confirm it is ignored before adding values:
+
+~~~sh
+mkdir -p ops/production
+touch ops/production/base-mainnet.env
+chmod 600 ops/production/base-mainnet.env
+git check-ignore -v ops/production/base-mainnet.env || true
+~~~
+
+If unignored, add that path to .gitignore and commit the change. Add real values (never a private key):
+
+~~~dotenv
+BASE_MAINNET_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_SEPOLIA_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_MAINNET_CHAIN_ID=8453
+BASE_SEPOLIA_CHAIN_ID=84532
+BASE_MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+PLATFORM_TREASURY=0x<team-multisig-on-Base>
+PAUSE_GUARDIAN=0x<separate-hardware-wallet-or-multisig>
+DEPLOYER_ADDRESS=0x<hardware-backed-deployer>
+~~~
+
+Create a Base-compatible 2-of-2 (or stronger) multisig first. Use it for treasury and every durable owner/admin role. Personal browser wallets are not long-term owners. If the contract cannot transfer ownership/admin to it, make and review that change or stop.
+
+**Catch:** Owner B compares USDC character-for-character with Circle. A wrong-chain/look-alike token or 6-vs-18-decimal error blocks launch.
+
+## 2. Make the money path production-safe
+
+~~~sh
+cd "$APP"
+git switch -c release/base-mainnet
+~~~
+
+Adapt the discovered source/configuration until all hold:
+
+1. Contract accepts only configured canonical USDC; never identify it by symbol.
+2. Fee is exactly 100 basis points over 10,000. Test gross = fee + creator net under stated rounding.
+3. Script reads addresses from configuration, never keys, and logs contract, token, fee, treasury, roles, transaction.
+4. Tip transfers fail atomically on failed transfer/allowance, use safe ERC-20 transfer calls, and emit payer, creator, gross, fee, net.
+5. Privileged actions/role changes emit events. Transfer roles to multisig. Document/test pause, withdrawal and upgrade paths; if no pause exists, document this limitation.
+6. UI blocks wrong network, shows creator/gross/fee/net pre-signing, prevents double submissions, and reports success only after a successful receipt.
+7. Production selects Base mainnet only; preview selects Base Sepolia only. No localhost, chain 31337, or mock USDC enters production.
+8. NEXT_PUBLIC_*, VITE_*, etc. contain public values only. No key, secret RPC URL, webhook, or admin credential is client-side.
+
+Add or confirm tests for: zero; 1,000,000 units; non-round 6-decimal amount; fee rounding; insufficient balance/allowance; non-USDC; unauthorized admin calls; role transfer; events; contract recipients; rejected/pending UI; fuzz/invariants for conservation/no redirection.
+
+Run repository checks. Set FOUNDRY_DIR to the actual directory that contains foundry.toml:
+
+~~~sh
+export FOUNDRY_DIR="$APP/packages/foundry"
+test -f "$FOUNDRY_DIR/foundry.toml"
+cd "$FOUNDRY_DIR"
+forge fmt --check
+forge build
+forge test -vvv
+cd "$APP"
+yarn install --immutable || npm ci
+yarn lint || npm run lint
+yarn typecheck || npm run typecheck
+yarn test || npm test
+~~~
+
+Also run the real invariant selector (for example, forge test --match-test invariant -vvv) and Slither if installed. “No invariant tests found” is not a pass; record it.
+
+**Gate:** all checks pass. Owner B reviews diff, fee arithmetic, roles and addresses. Every static-analysis high/medium is fixed or has written reviewed rationale. Material money/access-control changes require independent smart-contract review before mainnet.
+
+## 3. Reproducible deployment and frontend artifact
+
+Discover real script names, then retain the mapping in the release record:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+find script -maxdepth 2 -type f -name '*.s.sol' -print
+rg -n 'contract .*Deploy|function run\(' script
+export DEPLOY_SCRIPT='script/<actual-file>.s.sol:<actual-contract>'
+export TIP_CONTRACT_FQN='src/<actual-file>.sol:<actual-contract>'
+export TIP_FUNCTION='<actual-tip-function>(address,uint256)'
+~~~
+
+Use one deploy script that reads config through Foundry environment helpers and has no hidden time/random/deployer-dependent input. It must not deploy mock USDC on Base.
+
+Commit a variable-name-only template at ops/production/base-mainnet.env.example and a documented command which creates the frontend's *existing single* address/ABI artifact from Foundry output. Its production entry encodes chain 8453, accepted deployment address, canonical USDC, and ABI from the exact tagged build.
+
+**Gate:** Owner B starts from a fresh clone, follows the setup, builds, and runs the local journey. This catches uncommitted artifacts and machine-only assumptions.
+
+## 4. Full Base Sepolia rehearsal
+
+Create a distinct encrypted Sepolia account. Mainnet uses hardware wallet or hardware-backed multisig, never raw private key environment variable.
+
+~~~sh
+cd "$FOUNDRY_DIR"
+cast wallet import tipapp-sepolia --interactive
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast balance "$(cast wallet address --account tipapp-sepolia)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Expected chain ID is 84532. Fund only that account with Base Sepolia ETH and test USDC. Confirm test USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
+
+Simulate against a controlled Sepolia treasury:
+
+~~~sh
+export PLATFORM_TREASURY=0x<controlled-sepolia-treasury>
+export USDC_ADDRESS="$BASE_SEPOLIA_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia -vvvv
+~~~
+
+**Gate:** dry run shows testnet chain/USDC and expected fee, treasury, roles. If a mainnet address appears, stop.
+
+Broadcast once gate passes:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia --broadcast --verify -vvvv
+export SEPOLIA_TIP_CONTRACT=0x<address-printed-by-script>
+cast code "$SEPOLIA_TIP_CONTRACT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Record transaction/address. If verification fails, do not redeploy: correct verification using exact compiler/optimizer/EVM/libraries/arguments/tag. Mismatched source is a stop.
+
+Configure a preview only with Base Sepolia, its address, and test USDC. On preview, with two browser wallets, record:
+
+1. Wrong-network block and switch.
+2. Approval then 1.23 USDC tip: creator 1.2177, treasury 0.0123, subject to documented rounding.
+3. Successful receipt/event and direct balances reconcile gross = fee + net.
+4. Cancelled signature, insufficient allowance/balance, repeat click, refresh/RPC interruption: no false success or duplicate tip.
+5. Second creator, rounding amount, all admin/role/emergency routes.
+6. A direct cast send test reconciles against UI/events.
+
+**Gate:** both owners repeat with different wallets/browsers and reconcile balances/events. Any source/config change means new Sepolia deployment and full rehearsal.
+
+## 5. Mainnet go/no-go and funding
+
+Merge via normal review policy, then tag the exact release:
+
+~~~sh
+cd "$APP"
+git switch main
+git merge --ff-only release/base-mainnet
+git tag -a base-mainnet-v1 -m 'Base mainnet launch'
+git push origin main --tags
+~~~
+
+Use a PR if policy requires it. Record SHA. In fresh terminal, independently confirm mainnet/USDC:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code "$BASE_MAINNET_USDC" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'decimals()(uint8)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'symbol()(string)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Expected: 8453, nonempty code, 6, USDC. Owner B independently verifies. Fund the Base-mainnet deployer with ETH for simulation estimate plus buffer; first send a small amount and verify network/arrival on hardware. USDC cannot pay gas.
+
+**Both owners sign:** tagged tested source; canonical USDC/100 bps; multisig roles; dedicated RPC/host billing and alerts; rehearsal passed; support/status path ready; hardware deployer confirmed on Base. Any false item stops launch.
+
+## 6. Deploy and accept onchain state
+
+Load only mainnet config. Owner B watches hardware network/output:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+export USDC_ADDRESS="$BASE_MAINNET_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger -vvvv
+~~~
+
+**Gate:** output is 8453, canonical USDC, exact fee/treasury/roles, no unexpected external calls. Stop on mismatch.
+
+Broadcast once, confirming hardware transaction details:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger --broadcast --verify -vvvv
+export TIP_CONTRACT=0x<address-printed-by-successful-broadcast>
+cast code "$TIP_CONTRACT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Record hash, nonce, block, address, tag SHA, script output and compiler settings. Wait for receipt and check with independent Base RPC/explorer. On timeout, find transaction by deployer nonce; **do not rerun** until its status is known.
+
+Read all actual public getters, for example:
+
+~~~sh
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+For proxy, read/verify EIP-1967 implementation too; otherwise record immutability. Confirm explorer source verification.
+
+**Gate:** nonempty runtime, verified source matches tag, all getters match record. Wrong role/treasury: only reviewed role-transfer process, then repeat. Wrong immutable USDC/fee logic: abandon address and never point users to it.
+
+## 7. Production public URL
+
+Find the web app using find . -name next.config.* -o -name vite.config.*. Generate address/ABI from tagged Foundry output. Set host production variables using the names the app actually reads; typical values:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT=0x<accepted-TIP_CONTRACT>
+NEXT_PUBLIC_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_RPC_URL=https://<public-client-rpc>
+NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<public-project-id-if-used>
+~~~
+
+Set Scaffold config/wagmi equivalent to Base-only production and Base-Sepolia-only preview. Build and scan:
+
+~~~sh
+cd "$APP/<frontend-directory>"
+yarn install --immutable || npm ci
+yarn build || npm run build
+rg -n --hidden --glob '!node_modules' --glob '!*.map' 'PRIVATE_KEY|mnemonic|BEGIN PRIVATE|BASE_MAINNET_RPC_URL' .next dist build 2>/dev/null || true
+~~~
+
+A real-secret match is stop-and-rotate. Deploy tagged code through CI/host. Vercel example after link/config:
+
+~~~sh
+vercel --prod
+~~~
+
+Attach domain, force HTTPS/canonical redirects, add CSP limited to actual wallet/RPC domains and retest wallets. Enable host error, uptime, RPC rate/error, and billing alerts.
+
+**Gate:** clean browser on real URL confirms 8453, accepted contract, canonical USDC. No localhost/Sepolia action may appear as production.
+
+## 8. Canary, release, and response
+
+Before announcement, use two team wallets in clean profiles for a small real-USDC canary (for example 1.23 USDC):
+
+1. Owner A verifies Base, creator, gross, 1% fee and net in wallet, approves and tips.
+2. Owner B checks receipt, explorer event, creator balance and treasury balance: exact gross = fee + net.
+3. Owner B repeats rounding amount, cancellation and insufficient allowance. No false success, duplicate, or unhandled error.
+4. Check host/RPC/client monitoring.
+
+**Launch gate:** both canaries reconcile, monitoring is green, verification public, both owners sign release record. Then publish URL, verified explorer link, Base native-USDC-only scope, 1% fee, support contact, irreversibility warning.
+
+For 72 hours, check every few hours on day one and daily thereafter: success/revert rate, host/RPC/client errors, events, fee-event versus treasury reconciliation, support. Alert on mismatch, unexpected admin event, revert spike/outage.
+
+Frontend/config issue: remove call-to-action or serve maintenance, stop traffic, fix/redeploy, repeat URL gate and two canaries. Suspected money movement: preserve hashes/logs, stop announcement, use only reviewed multisig pause if available and verify from second RPC, remove UI even without pause, assess events/balances, get independent review, communicate only verified facts and next update time. Never ask users for seeds or arbitrary recovery signatures.
+
+Retain permanently tag/artifact hash, private release record, deployment nonce/transaction, verified links, role addresses, and monitoring links.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f783c747734a528a631445e6cfbe6139b523cca5
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,270 @@
+# Base mainnet launch runbook
+
+Follow this in order. A gate is a hard stop. Owner A executes; Owner B independently verifies every address, transaction, and gate. Never put seed phrases, keys, keystores, private RPC URLs, or .env files in git, chat, tickets, recordings, or public build variables.
+
+Base mainnet: **chain ID 8453**. Canonical native USDC: **0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913**. Use a paid/dedicated RPC; Base's public endpoint is rate-limited and not production-ready. Sources: [Base network configuration](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base Foundry deployment](https://docs.base.org/get-started/deploy-smart-contracts), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Foundry key management](https://getfoundry.sh/guides/best-practices/writing-scripts/).
+
+## 1. Freeze tested source and map the real app
+
+In the actual Scaffold-ETH 2 checkout:
+
+~~~sh
+export APP=/absolute/path/to/scaffold-eth-2-checkout
+cd "$APP"
+git status --short
+git rev-parse HEAD
+rg -n --glob '!node_modules' 'USDC|fee|platform|treasury|owner|withdraw|constructor|Deploy|deployedContracts|scaffold.config|localhost|31337'
+find . -name .env -o -name '.env.*' | sort
+~~~
+
+**Gate:** worktree is clean (or all changes are committed and understood), and the SHA is recorded. Both owners identify from source/tests:
+
+- contract source, fully-qualified deploy-script target, constructor/initializer arguments in order;
+- tip function signature, USDC units (native USDC has 6 decimals), and approval flow;
+- fee rounding, recipient, owner/admin/pause/withdraw/upgrade paths;
+- frontend files providing chains, wallet/RPC config, contract address, and ABI.
+
+If one fact is unknown, stop and resolve it from the repo. Do not guess contract names from this runbook.
+
+Create the private record; confirm it is ignored before adding values:
+
+~~~sh
+mkdir -p ops/production
+touch ops/production/base-mainnet.env
+chmod 600 ops/production/base-mainnet.env
+git check-ignore -v ops/production/base-mainnet.env || true
+~~~
+
+If unignored, add that path to .gitignore and commit the change. Add real values (never a private key):
+
+~~~dotenv
+BASE_MAINNET_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_SEPOLIA_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_MAINNET_CHAIN_ID=8453
+BASE_SEPOLIA_CHAIN_ID=84532
+BASE_MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+PLATFORM_TREASURY=0x<team-multisig-on-Base>
+PAUSE_GUARDIAN=0x<separate-hardware-wallet-or-multisig>
+DEPLOYER_ADDRESS=0x<hardware-backed-deployer>
+~~~
+
+Create a Base-compatible 2-of-2 (or stronger) multisig first. Use it for treasury and every durable owner/admin role. Personal browser wallets are not long-term owners. If the contract cannot transfer ownership/admin to it, make and review that change or stop.
+
+**Catch:** Owner B compares USDC character-for-character with Circle. A wrong-chain/look-alike token or 6-vs-18-decimal error blocks launch.
+
+## 2. Make the money path production-safe
+
+~~~sh
+cd "$APP"
+git switch -c release/base-mainnet
+~~~
+
+Adapt the discovered source/configuration until all hold:
+
+1. Contract accepts only configured canonical USDC; never identify it by symbol.
+2. Fee is exactly 100 basis points over 10,000. Test gross = fee + creator net under stated rounding.
+3. Script reads addresses from configuration, never keys, and logs contract, token, fee, treasury, roles, transaction.
+4. Tip transfers fail atomically on failed transfer/allowance, use safe ERC-20 transfer calls, and emit payer, creator, gross, fee, net.
+5. Privileged actions/role changes emit events. Transfer roles to multisig. Document/test pause, withdrawal and upgrade paths; if no pause exists, document this limitation.
+6. UI blocks wrong network, shows creator/gross/fee/net pre-signing, prevents double submissions, and reports success only after a successful receipt.
+7. Production selects Base mainnet only; preview selects Base Sepolia only. No localhost, chain 31337, or mock USDC enters production.
+8. NEXT_PUBLIC_*, VITE_*, etc. contain public values only. No key, secret RPC URL, webhook, or admin credential is client-side.
+
+Add or confirm tests for: zero; 1,000,000 units; non-round 6-decimal amount; fee rounding; insufficient balance/allowance; non-USDC; unauthorized admin calls; role transfer; events; contract recipients; rejected/pending UI; fuzz/invariants for conservation/no redirection.
+
+Run repository checks. Set FOUNDRY_DIR to the actual directory that contains foundry.toml:
+
+~~~sh
+export FOUNDRY_DIR="$APP/packages/foundry"
+test -f "$FOUNDRY_DIR/foundry.toml"
+cd "$FOUNDRY_DIR"
+forge fmt --check
+forge build
+forge test -vvv
+cd "$APP"
+yarn install --immutable || npm ci
+yarn lint || npm run lint
+yarn typecheck || npm run typecheck
+yarn test || npm test
+~~~
+
+Also run the real invariant selector (for example, forge test --match-test invariant -vvv) and Slither if installed. “No invariant tests found” is not a pass; record it.
+
+**Gate:** all checks pass. Owner B reviews diff, fee arithmetic, roles and addresses. Every static-analysis high/medium is fixed or has written reviewed rationale. Material money/access-control changes require independent smart-contract review before mainnet.
+
+## 3. Reproducible deployment and frontend artifact
+
+Discover real script names, then retain the mapping in the release record:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+find script -maxdepth 2 -type f -name '*.s.sol' -print
+rg -n 'contract .*Deploy|function run\(' script
+export DEPLOY_SCRIPT='script/<actual-file>.s.sol:<actual-contract>'
+export TIP_CONTRACT_FQN='src/<actual-file>.sol:<actual-contract>'
+export TIP_FUNCTION='<actual-tip-function>(address,uint256)'
+~~~
+
+Use one deploy script that reads config through Foundry environment helpers and has no hidden time/random/deployer-dependent input. It must not deploy mock USDC on Base.
+
+Commit a variable-name-only template at ops/production/base-mainnet.env.example and a documented command which creates the frontend's *existing single* address/ABI artifact from Foundry output. Its production entry encodes chain 8453, accepted deployment address, canonical USDC, and ABI from the exact tagged build.
+
+**Gate:** Owner B starts from a fresh clone, follows the setup, builds, and runs the local journey. This catches uncommitted artifacts and machine-only assumptions.
+
+## 4. Full Base Sepolia rehearsal
+
+Create a distinct encrypted Sepolia account. Mainnet uses hardware wallet or hardware-backed multisig, never raw private key environment variable.
+
+~~~sh
+cd "$FOUNDRY_DIR"
+cast wallet import tipapp-sepolia --interactive
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast balance "$(cast wallet address --account tipapp-sepolia)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Expected chain ID is 84532. Fund only that account with Base Sepolia ETH and test USDC. Confirm test USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
+
+Simulate against a controlled Sepolia treasury:
+
+~~~sh
+export PLATFORM_TREASURY=0x<controlled-sepolia-treasury>
+export USDC_ADDRESS="$BASE_SEPOLIA_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia -vvvv
+~~~
+
+**Gate:** dry run shows testnet chain/USDC and expected fee, treasury, roles. If a mainnet address appears, stop.
+
+Broadcast once gate passes:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia --broadcast --verify -vvvv
+export SEPOLIA_TIP_CONTRACT=0x<address-printed-by-script>
+cast code "$SEPOLIA_TIP_CONTRACT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Record transaction/address. If verification fails, do not redeploy: correct verification using exact compiler/optimizer/EVM/libraries/arguments/tag. Mismatched source is a stop.
+
+Configure a preview only with Base Sepolia, its address, and test USDC. On preview, with two browser wallets, record:
+
+1. Wrong-network block and switch.
+2. Approval then 1.23 USDC tip: creator 1.2177, treasury 0.0123, subject to documented rounding.
+3. Successful receipt/event and direct balances reconcile gross = fee + net.
+4. Cancelled signature, insufficient allowance/balance, repeat click, refresh/RPC interruption: no false success or duplicate tip.
+5. Second creator, rounding amount, all admin/role/emergency routes.
+6. A direct cast send test reconciles against UI/events.
+
+**Gate:** both owners repeat with different wallets/browsers and reconcile balances/events. Any source/config change means new Sepolia deployment and full rehearsal.
+
+## 5. Mainnet go/no-go and funding
+
+Merge via normal review policy, then tag the exact release:
+
+~~~sh
+cd "$APP"
+git switch main
+git merge --ff-only release/base-mainnet
+git tag -a base-mainnet-v1 -m 'Base mainnet launch'
+git push origin main --tags
+~~~
+
+Use a PR if policy requires it. Record SHA. In fresh terminal, independently confirm mainnet/USDC:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code "$BASE_MAINNET_USDC" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'decimals()(uint8)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'symbol()(string)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Expected: 8453, nonempty code, 6, USDC. Owner B independently verifies. Fund the Base-mainnet deployer with ETH for simulation estimate plus buffer; first send a small amount and verify network/arrival on hardware. USDC cannot pay gas.
+
+**Both owners sign:** tagged tested source; canonical USDC/100 bps; multisig roles; dedicated RPC/host billing and alerts; rehearsal passed; support/status path ready; hardware deployer confirmed on Base. Any false item stops launch.
+
+## 6. Deploy and accept onchain state
+
+Load only mainnet config. Owner B watches hardware network/output:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+export USDC_ADDRESS="$BASE_MAINNET_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger -vvvv
+~~~
+
+**Gate:** output is 8453, canonical USDC, exact fee/treasury/roles, no unexpected external calls. Stop on mismatch.
+
+Broadcast once, confirming hardware transaction details:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger --broadcast --verify -vvvv
+export TIP_CONTRACT=0x<address-printed-by-successful-broadcast>
+cast code "$TIP_CONTRACT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Record hash, nonce, block, address, tag SHA, script output and compiler settings. Wait for receipt and check with independent Base RPC/explorer. On timeout, find transaction by deployer nonce; **do not rerun** until its status is known.
+
+Read all actual public getters, for example:
+
+~~~sh
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+For proxy, read/verify EIP-1967 implementation too; otherwise record immutability. Confirm explorer source verification.
+
+**Gate:** nonempty runtime, verified source matches tag, all getters match record. Wrong role/treasury: only reviewed role-transfer process, then repeat. Wrong immutable USDC/fee logic: abandon address and never point users to it.
+
+## 7. Production public URL
+
+Find the web app using find . -name next.config.* -o -name vite.config.*. Generate address/ABI from tagged Foundry output. Set host production variables using the names the app actually reads; typical values:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT=0x<accepted-TIP_CONTRACT>
+NEXT_PUBLIC_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_RPC_URL=https://<public-client-rpc>
+NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<public-project-id-if-used>
+~~~
+
+Set Scaffold config/wagmi equivalent to Base-only production and Base-Sepolia-only preview. Build and scan:
+
+~~~sh
+cd "$APP/<frontend-directory>"
+yarn install --immutable || npm ci
+yarn build || npm run build
+rg -n --hidden --glob '!node_modules' --glob '!*.map' 'PRIVATE_KEY|mnemonic|BEGIN PRIVATE|BASE_MAINNET_RPC_URL' .next dist build 2>/dev/null || true
+~~~
+
+A real-secret match is stop-and-rotate. Deploy tagged code through CI/host. Vercel example after link/config:
+
+~~~sh
+vercel --prod
+~~~
+
+Attach domain, force HTTPS/canonical redirects, add CSP limited to actual wallet/RPC domains and retest wallets. Enable host error, uptime, RPC rate/error, and billing alerts.
+
+**Gate:** clean browser on real URL confirms 8453, accepted contract, canonical USDC. No localhost/Sepolia action may appear as production.
+
+## 8. Canary, release, and response
+
+Before announcement, use two team wallets in clean profiles for a small real-USDC canary (for example 1.23 USDC):
+
+1. Owner A verifies Base, creator, gross, 1% fee and net in wallet, approves and tips.
+2. Owner B checks receipt, explorer event, creator balance and treasury balance: exact gross = fee + net.
+3. Owner B repeats rounding amount, cancellation and insufficient allowance. No false success, duplicate, or unhandled error.
+4. Check host/RPC/client monitoring.
+
+**Launch gate:** both canaries reconcile, monitoring is green, verification public, both owners sign release record. Then publish URL, verified explorer link, Base native-USDC-only scope, 1% fee, support contact, irreversibility warning.
+
+For 72 hours, check every few hours on day one and daily thereafter: success/revert rate, host/RPC/client errors, events, fee-event versus treasury reconciliation, support. Alert on mismatch, unexpected admin event, revert spike/outage.
+
+Frontend/config issue: remove call-to-action or serve maintenance, stop traffic, fix/redeploy, repeat URL gate and two canaries. Suspected money movement: preserve hashes/logs, stop announcement, use only reviewed multisig pause if available and verify from second RPC, remove UI even without pause, assess events/balances, get independent review, communicate only verified facts and next update time. Never ask users for seeds or arbitrary recovery signatures.
+
+Retain permanently tag/artifact hash, private release record, deployment nonce/transaction, verified links, role addresses, and monitoring links.

codex
The launch runbook is now written. I’m doing a final consistency pass on the file—especially the release gates, testnet/mainnet separation, and commands that could otherwise accidentally point at the wrong chain.
exec
/bin/zsh -lc "wc -l LAUNCH.md && git diff --check && git status --short && sed -n '1,80p' LAUNCH.md && sed -n '300,430p' LAUNCH.md" in /Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1
 succeeded in 0ms:
     270 LAUNCH.md
?? LAUNCH.md
# Base mainnet launch runbook

Follow this in order. A gate is a hard stop. Owner A executes; Owner B independently verifies every address, transaction, and gate. Never put seed phrases, keys, keystores, private RPC URLs, or .env files in git, chat, tickets, recordings, or public build variables.

Base mainnet: **chain ID 8453**. Canonical native USDC: **0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913**. Use a paid/dedicated RPC; Base's public endpoint is rate-limited and not production-ready. Sources: [Base network configuration](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base Foundry deployment](https://docs.base.org/get-started/deploy-smart-contracts), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Foundry key management](https://getfoundry.sh/guides/best-practices/writing-scripts/).

## 1. Freeze tested source and map the real app

In the actual Scaffold-ETH 2 checkout:

~~~sh
export APP=/absolute/path/to/scaffold-eth-2-checkout
cd "$APP"
git status --short
git rev-parse HEAD
rg -n --glob '!node_modules' 'USDC|fee|platform|treasury|owner|withdraw|constructor|Deploy|deployedContracts|scaffold.config|localhost|31337'
find . -name .env -o -name '.env.*' | sort
~~~

**Gate:** worktree is clean (or all changes are committed and understood), and the SHA is recorded. Both owners identify from source/tests:

- contract source, fully-qualified deploy-script target, constructor/initializer arguments in order;
- tip function signature, USDC units (native USDC has 6 decimals), and approval flow;
- fee rounding, recipient, owner/admin/pause/withdraw/upgrade paths;
- frontend files providing chains, wallet/RPC config, contract address, and ABI.

If one fact is unknown, stop and resolve it from the repo. Do not guess contract names from this runbook.

Create the private record; confirm it is ignored before adding values:

~~~sh
mkdir -p ops/production
touch ops/production/base-mainnet.env
chmod 600 ops/production/base-mainnet.env
git check-ignore -v ops/production/base-mainnet.env || true
~~~

If unignored, add that path to .gitignore and commit the change. Add real values (never a private key):

~~~dotenv
BASE_MAINNET_RPC_URL=https://<dedicated-provider>/<private-id>
BASE_SEPOLIA_RPC_URL=https://<dedicated-provider>/<private-id>
BASE_MAINNET_CHAIN_ID=8453
BASE_SEPOLIA_CHAIN_ID=84532
BASE_MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
PLATFORM_TREASURY=0x<team-multisig-on-Base>
PAUSE_GUARDIAN=0x<separate-hardware-wallet-or-multisig>
DEPLOYER_ADDRESS=0x<hardware-backed-deployer>
~~~

Create a Base-compatible 2-of-2 (or stronger) multisig first. Use it for treasury and every durable owner/admin role. Personal browser wallets are not long-term owners. If the contract cannot transfer ownership/admin to it, make and review that change or stop.

**Catch:** Owner B compares USDC character-for-character with Circle. A wrong-chain/look-alike token or 6-vs-18-decimal error blocks launch.

## 2. Make the money path production-safe

~~~sh
cd "$APP"
git switch -c release/base-mainnet
~~~

Adapt the discovered source/configuration until all hold:

1. Contract accepts only configured canonical USDC; never identify it by symbol.
2. Fee is exactly 100 basis points over 10,000. Test gross = fee + creator net under stated rounding.
3. Script reads addresses from configuration, never keys, and logs contract, token, fee, treasury, roles, transaction.
4. Tip transfers fail atomically on failed transfer/allowance, use safe ERC-20 transfer calls, and emit payer, creator, gross, fee, net.
5. Privileged actions/role changes emit events. Transfer roles to multisig. Document/test pause, withdrawal and upgrade paths; if no pause exists, document this limitation.
6. UI blocks wrong network, shows creator/gross/fee/net pre-signing, prevents double submissions, and reports success only after a successful receipt.
7. Production selects Base mainnet only; preview selects Base Sepolia only. No localhost, chain 31337, or mock USDC enters production.
8. NEXT_PUBLIC_*, VITE_*, etc. contain public values only. No key, secret RPC URL, webhook, or admin credential is client-side.

Add or confirm tests for: zero; 1,000,000 units; non-round 6-decimal amount; fee rounding; insufficient balance/allowance; non-USDC; unauthorized admin calls; role transfer; events; contract recipients; rejected/pending UI; fuzz/invariants for conservation/no redirection.

Run repository checks. Set FOUNDRY_DIR to the actual directory that contains foundry.toml:

~~~sh
export FOUNDRY_DIR="$APP/packages/foundry"
test -f "$FOUNDRY_DIR/foundry.toml"

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f783c747734a528a631445e6cfbe6139b523cca5
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,270 @@
+# Base mainnet launch runbook
+
+Follow this in order. A gate is a hard stop. Owner A executes; Owner B independently verifies every address, transaction, and gate. Never put seed phrases, keys, keystores, private RPC URLs, or .env files in git, chat, tickets, recordings, or public build variables.
+
+Base mainnet: **chain ID 8453**. Canonical native USDC: **0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913**. Use a paid/dedicated RPC; Base's public endpoint is rate-limited and not production-ready. Sources: [Base network configuration](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base Foundry deployment](https://docs.base.org/get-started/deploy-smart-contracts), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Foundry key management](https://getfoundry.sh/guides/best-practices/writing-scripts/).
+
+## 1. Freeze tested source and map the real app
+
+In the actual Scaffold-ETH 2 checkout:
+
+~~~sh
+export APP=/absolute/path/to/scaffold-eth-2-checkout
+cd "$APP"
+git status --short
+git rev-parse HEAD
+rg -n --glob '!node_modules' 'USDC|fee|platform|treasury|owner|withdraw|constructor|Deploy|deployedContracts|scaffold.config|localhost|31337'
+find . -name .env -o -name '.env.*' | sort
+~~~
+
+**Gate:** worktree is clean (or all changes are committed and understood), and the SHA is recorded. Both owners identify from source/tests:
+
+- contract source, fully-qualified deploy-script target, constructor/initializer arguments in order;
+- tip function signature, USDC units (native USDC has 6 decimals), and approval flow;
+- fee rounding, recipient, owner/admin/pause/withdraw/upgrade paths;
+- frontend files providing chains, wallet/RPC config, contract address, and ABI.
+
+If one fact is unknown, stop and resolve it from the repo. Do not guess contract names from this runbook.
+
+Create the private record; confirm it is ignored before adding values:
+
+~~~sh
+mkdir -p ops/production
+touch ops/production/base-mainnet.env
+chmod 600 ops/production/base-mainnet.env
+git check-ignore -v ops/production/base-mainnet.env || true
+~~~
+
+If unignored, add that path to .gitignore and commit the change. Add real values (never a private key):
+
+~~~dotenv
+BASE_MAINNET_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_SEPOLIA_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_MAINNET_CHAIN_ID=8453
+BASE_SEPOLIA_CHAIN_ID=84532
+BASE_MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+PLATFORM_TREASURY=0x<team-multisig-on-Base>
+PAUSE_GUARDIAN=0x<separate-hardware-wallet-or-multisig>
+DEPLOYER_ADDRESS=0x<hardware-backed-deployer>
+~~~
+
+Create a Base-compatible 2-of-2 (or stronger) multisig first. Use it for treasury and every durable owner/admin role. Personal browser wallets are not long-term owners. If the contract cannot transfer ownership/admin to it, make and review that change or stop.
+
+**Catch:** Owner B compares USDC character-for-character with Circle. A wrong-chain/look-alike token or 6-vs-18-decimal error blocks launch.
+
+## 2. Make the money path production-safe
+
+~~~sh
+cd "$APP"
+git switch -c release/base-mainnet
+~~~
+
+Adapt the discovered source/configuration until all hold:
+
+1. Contract accepts only configured canonical USDC; never identify it by symbol.
+2. Fee is exactly 100 basis points over 10,000. Test gross = fee + creator net under stated rounding.
+3. Script reads addresses from configuration, never keys, and logs contract, token, fee, treasury, roles, transaction.
+4. Tip transfers fail atomically on failed transfer/allowance, use safe ERC-20 transfer calls, and emit payer, creator, gross, fee, net.
+5. Privileged actions/role changes emit events. Transfer roles to multisig. Document/test pause, withdrawal and upgrade paths; if no pause exists, document this limitation.
+6. UI blocks wrong network, shows creator/gross/fee/net pre-signing, prevents double submissions, and reports success only after a successful receipt.
+7. Production selects Base mainnet only; preview selects Base Sepolia only. No localhost, chain 31337, or mock USDC enters production.
+8. NEXT_PUBLIC_*, VITE_*, etc. contain public values only. No key, secret RPC URL, webhook, or admin credential is client-side.
+
+Add or confirm tests for: zero; 1,000,000 units; non-round 6-decimal amount; fee rounding; insufficient balance/allowance; non-USDC; unauthorized admin calls; role transfer; events; contract recipients; rejected/pending UI; fuzz/invariants for conservation/no redirection.
+
+Run repository checks. Set FOUNDRY_DIR to the actual directory that contains foundry.toml:
+
+~~~sh
+export FOUNDRY_DIR="$APP/packages/foundry"
+test -f "$FOUNDRY_DIR/foundry.toml"
+cd "$FOUNDRY_DIR"
+forge fmt --check
+forge build
+forge test -vvv
+cd "$APP"
+yarn install --immutable || npm ci
+yarn lint || npm run lint
+yarn typecheck || npm run typecheck
+yarn test || npm test
+~~~
+
+Also run the real invariant selector (for example, forge test --match-test invariant -vvv) and Slither if installed. “No invariant tests found” is not a pass; record it.
+
+**Gate:** all checks pass. Owner B reviews diff, fee arithmetic, roles and addresses. Every static-analysis high/medium is fixed or has written reviewed rationale. Material money/access-control changes require independent smart-contract review before mainnet.
+
+## 3. Reproducible deployment and frontend artifact
+
+Discover real script names, then retain the mapping in the release record:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+find script -maxdepth 2 -type f -name '*.s.sol' -print
+rg -n 'contract .*Deploy|function run\(' script
+export DEPLOY_SCRIPT='script/<actual-file>.s.sol:<actual-contract>'
+export TIP_CONTRACT_FQN='src/<actual-file>.sol:<actual-contract>'
+export TIP_FUNCTION='<actual-tip-function>(address,uint256)'
+~~~
+
+Use one deploy script that reads config through Foundry environment helpers and has no hidden time/random/deployer-dependent input. It must not deploy mock USDC on Base.
+
+Commit a variable-name-only template at ops/production/base-mainnet.env.example and a documented command which creates the frontend's *existing single* address/ABI artifact from Foundry output. Its production entry encodes chain 8453, accepted deployment address, canonical USDC, and ABI from the exact tagged build.
+
+**Gate:** Owner B starts from a fresh clone, follows the setup, builds, and runs the local journey. This catches uncommitted artifacts and machine-only assumptions.
+
+## 4. Full Base Sepolia rehearsal
+
+Create a distinct encrypted Sepolia account. Mainnet uses hardware wallet or hardware-backed multisig, never raw private key environment variable.
+
+~~~sh
+cd "$FOUNDRY_DIR"
+cast wallet import tipapp-sepolia --interactive
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast balance "$(cast wallet address --account tipapp-sepolia)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Expected chain ID is 84532. Fund only that account with Base Sepolia ETH and test USDC. Confirm test USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
+
+Simulate against a controlled Sepolia treasury:
+
+~~~sh
+export PLATFORM_TREASURY=0x<controlled-sepolia-treasury>
+export USDC_ADDRESS="$BASE_SEPOLIA_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia -vvvv
+~~~
+
+**Gate:** dry run shows testnet chain/USDC and expected fee, treasury, roles. If a mainnet address appears, stop.
+
+Broadcast once gate passes:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia --broadcast --verify -vvvv
+export SEPOLIA_TIP_CONTRACT=0x<address-printed-by-script>
+cast code "$SEPOLIA_TIP_CONTRACT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Record transaction/address. If verification fails, do not redeploy: correct verification using exact compiler/optimizer/EVM/libraries/arguments/tag. Mismatched source is a stop.
+
+Configure a preview only with Base Sepolia, its address, and test USDC. On preview, with two browser wallets, record:
+
+1. Wrong-network block and switch.
+2. Approval then 1.23 USDC tip: creator 1.2177, treasury 0.0123, subject to documented rounding.
+3. Successful receipt/event and direct balances reconcile gross = fee + net.
+4. Cancelled signature, insufficient allowance/balance, repeat click, refresh/RPC interruption: no false success or duplicate tip.
+5. Second creator, rounding amount, all admin/role/emergency routes.
+6. A direct cast send test reconciles against UI/events.
+
+**Gate:** both owners repeat with different wallets/browsers and reconcile balances/events. Any source/config change means new Sepolia deployment and full rehearsal.
+
+## 5. Mainnet go/no-go and funding
+
+Merge via normal review policy, then tag the exact release:
+
+~~~sh
+cd "$APP"
+git switch main
+git merge --ff-only release/base-mainnet
+git tag -a base-mainnet-v1 -m 'Base mainnet launch'
+git push origin main --tags
+~~~
+
+Use a PR if policy requires it. Record SHA. In fresh terminal, independently confirm mainnet/USDC:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code "$BASE_MAINNET_USDC" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'decimals()(uint8)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'symbol()(string)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Expected: 8453, nonempty code, 6, USDC. Owner B independently verifies. Fund the Base-mainnet deployer with ETH for simulation estimate plus buffer; first send a small amount and verify network/arrival on hardware. USDC cannot pay gas.
+
+**Both owners sign:** tagged tested source; canonical USDC/100 bps; multisig roles; dedicated RPC/host billing and alerts; rehearsal passed; support/status path ready; hardware deployer confirmed on Base. Any false item stops launch.
+
+## 6. Deploy and accept onchain state
+
+Load only mainnet config. Owner B watches hardware network/output:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+export USDC_ADDRESS="$BASE_MAINNET_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger -vvvv
+~~~
+
+**Gate:** output is 8453, canonical USDC, exact fee/treasury/roles, no unexpected external calls. Stop on mismatch.
+
+Broadcast once, confirming hardware transaction details:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger --broadcast --verify -vvvv
+export TIP_CONTRACT=0x<address-printed-by-successful-broadcast>
+cast code "$TIP_CONTRACT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Record hash, nonce, block, address, tag SHA, script output and compiler settings. Wait for receipt and check with independent Base RPC/explorer. On timeout, find transaction by deployer nonce; **do not rerun** until its status is known.
+
+Read all actual public getters, for example:
+
+~~~sh
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+For proxy, read/verify EIP-1967 implementation too; otherwise record immutability. Confirm explorer source verification.
+
+**Gate:** nonempty runtime, verified source matches tag, all getters match record. Wrong role/treasury: only reviewed role-transfer process, then repeat. Wrong immutable USDC/fee logic: abandon address and never point users to it.
+
+## 7. Production public URL
+
+Find the web app using find . -name next.config.* -o -name vite.config.*. Generate address/ABI from tagged Foundry output. Set host production variables using the names the app actually reads; typical values:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT=0x<accepted-TIP_CONTRACT>
+NEXT_PUBLIC_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_RPC_URL=https://<public-client-rpc>
+NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<public-project-id-if-used>
+~~~
+
+Set Scaffold config/wagmi equivalent to Base-only production and Base-Sepolia-only preview. Build and scan:
+
+~~~sh
+cd "$APP/<frontend-directory>"
+yarn install --immutable || npm ci
+yarn build || npm run build
+rg -n --hidden --glob '!node_modules' --glob '!*.map' 'PRIVATE_KEY|mnemonic|BEGIN PRIVATE|BASE_MAINNET_RPC_URL' .next dist build 2>/dev/null || true
+~~~
+
+A real-secret match is stop-and-rotate. Deploy tagged code through CI/host. Vercel example after link/config:
+
+~~~sh
+vercel --prod
+~~~
+
+Attach domain, force HTTPS/canonical redirects, add CSP limited to actual wallet/RPC domains and retest wallets. Enable host error, uptime, RPC rate/error, and billing alerts.
+
+**Gate:** clean browser on real URL confirms 8453, accepted contract, canonical USDC. No localhost/Sepolia action may appear as production.
+
+## 8. Canary, release, and response
+
+Before announcement, use two team wallets in clean profiles for a small real-USDC canary (for example 1.23 USDC):
+
+1. Owner A verifies Base, creator, gross, 1% fee and net in wallet, approves and tips.
+2. Owner B checks receipt, explorer event, creator balance and treasury balance: exact gross = fee + net.
+3. Owner B repeats rounding amount, cancellation and insufficient allowance. No false success, duplicate, or unhandled error.
+4. Check host/RPC/client monitoring.
+
+**Launch gate:** both canaries reconcile, monitoring is green, verification public, both owners sign release record. Then publish URL, verified explorer link, Base native-USDC-only scope, 1% fee, support contact, irreversibility warning.
+
+For 72 hours, check every few hours on day one and daily thereafter: success/revert rate, host/RPC/client errors, events, fee-event versus treasury reconciliation, support. Alert on mismatch, unexpected admin event, revert spike/outage.
+
+Frontend/config issue: remove call-to-action or serve maintenance, stop traffic, fix/redeploy, repeat URL gate and two canaries. Suspected money movement: preserve hashes/logs, stop announcement, use only reviewed multisig pause if available and verify from second RPC, remove UI even without pause, assess events/balances, get independent review, communicate only verified facts and next update time. Never ask users for seeds or arbitrary recovery signatures.
+
+Retain permanently tag/artifact hash, private release record, deployment nonce/transaction, verified links, role addresses, and monitoring links.

codex
Created the complete production runbook: [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1/LAUNCH.md).

It covers source freeze, security gates, Sepolia rehearsal, hardware-backed Base deployment, verification, frontend production configuration, canary tips, monitoring, and incident response. It also includes the canonical Base USDC addresses and verified Base configuration references.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..f783c747734a528a631445e6cfbe6139b523cca5
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,270 @@
+# Base mainnet launch runbook
+
+Follow this in order. A gate is a hard stop. Owner A executes; Owner B independently verifies every address, transaction, and gate. Never put seed phrases, keys, keystores, private RPC URLs, or .env files in git, chat, tickets, recordings, or public build variables.
+
+Base mainnet: **chain ID 8453**. Canonical native USDC: **0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913**. Use a paid/dedicated RPC; Base's public endpoint is rate-limited and not production-ready. Sources: [Base network configuration](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base Foundry deployment](https://docs.base.org/get-started/deploy-smart-contracts), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Foundry key management](https://getfoundry.sh/guides/best-practices/writing-scripts/).
+
+## 1. Freeze tested source and map the real app
+
+In the actual Scaffold-ETH 2 checkout:
+
+~~~sh
+export APP=/absolute/path/to/scaffold-eth-2-checkout
+cd "$APP"
+git status --short
+git rev-parse HEAD
+rg -n --glob '!node_modules' 'USDC|fee|platform|treasury|owner|withdraw|constructor|Deploy|deployedContracts|scaffold.config|localhost|31337'
+find . -name .env -o -name '.env.*' | sort
+~~~
+
+**Gate:** worktree is clean (or all changes are committed and understood), and the SHA is recorded. Both owners identify from source/tests:
+
+- contract source, fully-qualified deploy-script target, constructor/initializer arguments in order;
+- tip function signature, USDC units (native USDC has 6 decimals), and approval flow;
+- fee rounding, recipient, owner/admin/pause/withdraw/upgrade paths;
+- frontend files providing chains, wallet/RPC config, contract address, and ABI.
+
+If one fact is unknown, stop and resolve it from the repo. Do not guess contract names from this runbook.
+
+Create the private record; confirm it is ignored before adding values:
+
+~~~sh
+mkdir -p ops/production
+touch ops/production/base-mainnet.env
+chmod 600 ops/production/base-mainnet.env
+git check-ignore -v ops/production/base-mainnet.env || true
+~~~
+
+If unignored, add that path to .gitignore and commit the change. Add real values (never a private key):
+
+~~~dotenv
+BASE_MAINNET_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_SEPOLIA_RPC_URL=https://<dedicated-provider>/<private-id>
+BASE_MAINNET_CHAIN_ID=8453
+BASE_SEPOLIA_CHAIN_ID=84532
+BASE_MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
+PLATFORM_TREASURY=0x<team-multisig-on-Base>
+PAUSE_GUARDIAN=0x<separate-hardware-wallet-or-multisig>
+DEPLOYER_ADDRESS=0x<hardware-backed-deployer>
+~~~
+
+Create a Base-compatible 2-of-2 (or stronger) multisig first. Use it for treasury and every durable owner/admin role. Personal browser wallets are not long-term owners. If the contract cannot transfer ownership/admin to it, make and review that change or stop.
+
+**Catch:** Owner B compares USDC character-for-character with Circle. A wrong-chain/look-alike token or 6-vs-18-decimal error blocks launch.
+
+## 2. Make the money path production-safe
+
+~~~sh
+cd "$APP"
+git switch -c release/base-mainnet
+~~~
+
+Adapt the discovered source/configuration until all hold:
+
+1. Contract accepts only configured canonical USDC; never identify it by symbol.
+2. Fee is exactly 100 basis points over 10,000. Test gross = fee + creator net under stated rounding.
+3. Script reads addresses from configuration, never keys, and logs contract, token, fee, treasury, roles, transaction.
+4. Tip transfers fail atomically on failed transfer/allowance, use safe ERC-20 transfer calls, and emit payer, creator, gross, fee, net.
+5. Privileged actions/role changes emit events. Transfer roles to multisig. Document/test pause, withdrawal and upgrade paths; if no pause exists, document this limitation.
+6. UI blocks wrong network, shows creator/gross/fee/net pre-signing, prevents double submissions, and reports success only after a successful receipt.
+7. Production selects Base mainnet only; preview selects Base Sepolia only. No localhost, chain 31337, or mock USDC enters production.
+8. NEXT_PUBLIC_*, VITE_*, etc. contain public values only. No key, secret RPC URL, webhook, or admin credential is client-side.
+
+Add or confirm tests for: zero; 1,000,000 units; non-round 6-decimal amount; fee rounding; insufficient balance/allowance; non-USDC; unauthorized admin calls; role transfer; events; contract recipients; rejected/pending UI; fuzz/invariants for conservation/no redirection.
+
+Run repository checks. Set FOUNDRY_DIR to the actual directory that contains foundry.toml:
+
+~~~sh
+export FOUNDRY_DIR="$APP/packages/foundry"
+test -f "$FOUNDRY_DIR/foundry.toml"
+cd "$FOUNDRY_DIR"
+forge fmt --check
+forge build
+forge test -vvv
+cd "$APP"
+yarn install --immutable || npm ci
+yarn lint || npm run lint
+yarn typecheck || npm run typecheck
+yarn test || npm test
+~~~
+
+Also run the real invariant selector (for example, forge test --match-test invariant -vvv) and Slither if installed. “No invariant tests found” is not a pass; record it.
+
+**Gate:** all checks pass. Owner B reviews diff, fee arithmetic, roles and addresses. Every static-analysis high/medium is fixed or has written reviewed rationale. Material money/access-control changes require independent smart-contract review before mainnet.
+
+## 3. Reproducible deployment and frontend artifact
+
+Discover real script names, then retain the mapping in the release record:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+find script -maxdepth 2 -type f -name '*.s.sol' -print
+rg -n 'contract .*Deploy|function run\(' script
+export DEPLOY_SCRIPT='script/<actual-file>.s.sol:<actual-contract>'
+export TIP_CONTRACT_FQN='src/<actual-file>.sol:<actual-contract>'
+export TIP_FUNCTION='<actual-tip-function>(address,uint256)'
+~~~
+
+Use one deploy script that reads config through Foundry environment helpers and has no hidden time/random/deployer-dependent input. It must not deploy mock USDC on Base.
+
+Commit a variable-name-only template at ops/production/base-mainnet.env.example and a documented command which creates the frontend's *existing single* address/ABI artifact from Foundry output. Its production entry encodes chain 8453, accepted deployment address, canonical USDC, and ABI from the exact tagged build.
+
+**Gate:** Owner B starts from a fresh clone, follows the setup, builds, and runs the local journey. This catches uncommitted artifacts and machine-only assumptions.
+
+## 4. Full Base Sepolia rehearsal
+
+Create a distinct encrypted Sepolia account. Mainnet uses hardware wallet or hardware-backed multisig, never raw private key environment variable.
+
+~~~sh
+cd "$FOUNDRY_DIR"
+cast wallet import tipapp-sepolia --interactive
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast balance "$(cast wallet address --account tipapp-sepolia)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Expected chain ID is 84532. Fund only that account with Base Sepolia ETH and test USDC. Confirm test USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
+
+Simulate against a controlled Sepolia treasury:
+
+~~~sh
+export PLATFORM_TREASURY=0x<controlled-sepolia-treasury>
+export USDC_ADDRESS="$BASE_SEPOLIA_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia -vvvv
+~~~
+
+**Gate:** dry run shows testnet chain/USDC and expected fee, treasury, roles. If a mainnet address appears, stop.
+
+Broadcast once gate passes:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" --account tipapp-sepolia --broadcast --verify -vvvv
+export SEPOLIA_TIP_CONTRACT=0x<address-printed-by-script>
+cast code "$SEPOLIA_TIP_CONTRACT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
+~~~
+
+Record transaction/address. If verification fails, do not redeploy: correct verification using exact compiler/optimizer/EVM/libraries/arguments/tag. Mismatched source is a stop.
+
+Configure a preview only with Base Sepolia, its address, and test USDC. On preview, with two browser wallets, record:
+
+1. Wrong-network block and switch.
+2. Approval then 1.23 USDC tip: creator 1.2177, treasury 0.0123, subject to documented rounding.
+3. Successful receipt/event and direct balances reconcile gross = fee + net.
+4. Cancelled signature, insufficient allowance/balance, repeat click, refresh/RPC interruption: no false success or duplicate tip.
+5. Second creator, rounding amount, all admin/role/emergency routes.
+6. A direct cast send test reconciles against UI/events.
+
+**Gate:** both owners repeat with different wallets/browsers and reconcile balances/events. Any source/config change means new Sepolia deployment and full rehearsal.
+
+## 5. Mainnet go/no-go and funding
+
+Merge via normal review policy, then tag the exact release:
+
+~~~sh
+cd "$APP"
+git switch main
+git merge --ff-only release/base-mainnet
+git tag -a base-mainnet-v1 -m 'Base mainnet launch'
+git push origin main --tags
+~~~
+
+Use a PR if policy requires it. Record SHA. In fresh terminal, independently confirm mainnet/USDC:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code "$BASE_MAINNET_USDC" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'decimals()(uint8)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_MAINNET_USDC" 'symbol()(string)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Expected: 8453, nonempty code, 6, USDC. Owner B independently verifies. Fund the Base-mainnet deployer with ETH for simulation estimate plus buffer; first send a small amount and verify network/arrival on hardware. USDC cannot pay gas.
+
+**Both owners sign:** tagged tested source; canonical USDC/100 bps; multisig roles; dedicated RPC/host billing and alerts; rehearsal passed; support/status path ready; hardware deployer confirmed on Base. Any false item stops launch.
+
+## 6. Deploy and accept onchain state
+
+Load only mainnet config. Owner B watches hardware network/output:
+
+~~~sh
+cd "$FOUNDRY_DIR"
+source "$APP/ops/production/base-mainnet.env"
+export USDC_ADDRESS="$BASE_MAINNET_USDC"
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger -vvvv
+~~~
+
+**Gate:** output is 8453, canonical USDC, exact fee/treasury/roles, no unexpected external calls. Stop on mismatch.
+
+Broadcast once, confirming hardware transaction details:
+
+~~~sh
+forge script "$DEPLOY_SCRIPT" --rpc-url "$BASE_MAINNET_RPC_URL" --ledger --broadcast --verify -vvvv
+export TIP_CONTRACT=0x<address-printed-by-successful-broadcast>
+cast code "$TIP_CONTRACT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Record hash, nonce, block, address, tag SHA, script output and compiler settings. Wait for receipt and check with independent Base RPC/explorer. On timeout, find transaction by deployer nonce; **do not rerun** until its status is known.
+
+Read all actual public getters, for example:
+
+~~~sh
+cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$TIP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+For proxy, read/verify EIP-1967 implementation too; otherwise record immutability. Confirm explorer source verification.
+
+**Gate:** nonempty runtime, verified source matches tag, all getters match record. Wrong role/treasury: only reviewed role-transfer process, then repeat. Wrong immutable USDC/fee logic: abandon address and never point users to it.
+
+## 7. Production public URL
+
+Find the web app using find . -name next.config.* -o -name vite.config.*. Generate address/ABI from tagged Foundry output. Set host production variables using the names the app actually reads; typical values:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT=0x<accepted-TIP_CONTRACT>
+NEXT_PUBLIC_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_RPC_URL=https://<public-client-rpc>
+NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<public-project-id-if-used>
+~~~
+
+Set Scaffold config/wagmi equivalent to Base-only production and Base-Sepolia-only preview. Build and scan:
+
+~~~sh
+cd "$APP/<frontend-directory>"
+yarn install --immutable || npm ci
+yarn build || npm run build
+rg -n --hidden --glob '!node_modules' --glob '!*.map' 'PRIVATE_KEY|mnemonic|BEGIN PRIVATE|BASE_MAINNET_RPC_URL' .next dist build 2>/dev/null || true
+~~~
+
+A real-secret match is stop-and-rotate. Deploy tagged code through CI/host. Vercel example after link/config:
+
+~~~sh
+vercel --prod
+~~~
+
+Attach domain, force HTTPS/canonical redirects, add CSP limited to actual wallet/RPC domains and retest wallets. Enable host error, uptime, RPC rate/error, and billing alerts.
+
+**Gate:** clean browser on real URL confirms 8453, accepted contract, canonical USDC. No localhost/Sepolia action may appear as production.
+
+## 8. Canary, release, and response
+
+Before announcement, use two team wallets in clean profiles for a small real-USDC canary (for example 1.23 USDC):
+
+1. Owner A verifies Base, creator, gross, 1% fee and net in wallet, approves and tips.
+2. Owner B checks receipt, explorer event, creator balance and treasury balance: exact gross = fee + net.
+3. Owner B repeats rounding amount, cancellation and insufficient allowance. No false success, duplicate, or unhandled error.
+4. Check host/RPC/client monitoring.
+
+**Launch gate:** both canaries reconcile, monitoring is green, verification public, both owners sign release record. Then publish URL, verified explorer link, Base native-USDC-only scope, 1% fee, support contact, irreversibility warning.
+
+For 72 hours, check every few hours on day one and daily thereafter: success/revert rate, host/RPC/client errors, events, fee-event versus treasury reconciliation, support. Alert on mismatch, unexpected admin event, revert spike/outage.
+
+Frontend/config issue: remove call-to-action or serve maintenance, stop traffic, fix/redeploy, repeat URL gate and two canaries. Suspected money movement: preserve hashes/logs, stop announcement, use only reviewed multisig pause if available and verify from second RPC, remove UI even without pause, assess events/balances, get independent review, communicate only verified facts and next update time. Never ask users for seeds or arbitrary recovery signatures.
+
+Retain permanently tag/artifact hash, private release record, deployment nonce/transaction, verified links, role addresses, and monitoring links.

tokens used
64 467
```

## final message

Created the complete production runbook: [LAUNCH.md](/Users/liana/.cache/ethskills-evals/orchestration-goal-001/2026-08-13T120617Z-codex-no-skill-1/LAUNCH.md).

It covers source freeze, security gates, Sepolia rehearsal, hardware-backed Base deployment, verification, frontend production configuration, canary tips, monitoring, and incident response. It also includes the canonical Base USDC addresses and verified Base configuration references.
