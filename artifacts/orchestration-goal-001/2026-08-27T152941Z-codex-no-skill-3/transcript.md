# Executor transcript — 2026-08-27T152941Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a043d7-6c5f-75c3-a672-8fd5638f8aa0
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
I’ll turn this into a production runbook with explicit gates and rollback checks. I’ll first confirm the current Base/Foundry deployment details from primary documentation, then write the ordered `LAUNCH.md`.
web search: 
web search: site:docs.base.org Base mainnet RPC chain id USDC contract address deployment verification ...
web search: 
web search: 
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,160p' && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001
TASK.md
package.json

web search: site:developers.circle.com USDC contract addresses Base mainnet official
web search: site:docs.scaffoldeth.io foundry deployment contracts deployedContracts.ts nextjs production deployment
exec
/bin/bash -lc "sed -n '1,240p' TASK.md && sed -n '1,160p' package.json" in /ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001
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

2026-08-27T15:32:03.460801Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 20, 'on the day of deployment. Base's public RPC is rate-limited, so it is only a' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..65083363700b73b30dafabc505b398722e69db23
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,330 @@
+# Base mainnet launch runbook
+
+Follow every gate in order. STOP means fix and repeat that gate. Never put a
+private key, API secret, or authenticated RPC URL in Git, browser variables,
+chat, recordings, or shell history. Never reuse an Anvil key.
+
+## Constants
+
+Confirm Circle's current official address list before deployment.
+
+~~~text
+Base chain ID: 8453
+Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+USDC decimals: 6
+~~~
+
+Use an authenticated production Base RPC for deployment/monitoring; the public
+Base RPC is rate limited. References: [Base network
+details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
+[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Replace angle-bracket placeholders only after Step 1.
+
+~~~bash
+export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
+export RELEASE_SHA=<approved-full-git-sha>
+export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
+export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
+export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
+export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
+~~~
+
+## 0. Freeze source and ownership
+
+Create a shared launch sheet, signed off independently by both people. Record:
+full immutable Git SHA; fully-qualified contract and constructor values; USDC
+address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
+or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
+deployer account; shared host/DNS/RPC/explorer access; support and incident
+contacts.
+
+~~~bash
+cd "$APP_ROOT"
+git fetch --tags origin
+git checkout --detach "$RELEASE_SHA"
+git status --short
+git rev-parse HEAD
+~~~
+
+**Gate:** no status output and printed SHA equals the sheet. Any change creates
+a new SHA and restarts at this step.
+
+## 1. Map the actual Foundry project
+
+~~~bash
+cd "$APP_ROOT"
+find . -name AGENTS.md -print
+find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
+rg -n --hidden -g '!node_modules' -g '!out' \
+ '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
+~~~
+
+Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
+tip contract name, and the one generated deployment ABI/address artifact the UI
+imports. Fill in the exports above.
+
+~~~bash
+test -f "$FOUNDRY_ROOT/foundry.toml"
+test -f "$WEB_ROOT/package.json"
+~~~
+
+**Gate:** every production frontend address comes from that generated artifact
+or explicit versioned config. No production path contains localhost, 31337,
+Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.
+
+## 2. Contract readiness gate
+
+Both people review code and tests. Confirm:
+
+- USDC is fixed to the native Base address; callers cannot replace it.
+- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
+  never uses JavaScript floating point or number for money.
+- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
+  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
+- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
+  protection; no failure leaves partial accounting; zero addresses are rejected.
+- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
+  or owner route that can move user funds. Every necessary privileged function
+  is authorization-tested, publicly documented, and Safe/hardware-controlled.
+- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
+  fee, creator and approval scope and handles rejection, wrong chain,
+  insufficient USDC/ETH, RPC error, and revert.
+
+Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
+allowance, failed transfer, event values, and creator plus fee equals gross.
+Test privileged functions too.
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge fmt --check
+forge build
+forge test -vvv
+~~~
+
+**Gate:** all commands exit zero; both approve fee rounding and privileged
+powers. For a novel or meaningful-balance contract, obtain an independent
+security review before mainnet.
+
+## 3. Secure credentials and configure Base
+
+Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:
+
+~~~bash
+cast wallet import base-sepolia-deployer --interactive
+cast wallet import base-mainnet-deployer --interactive
+cd "$FOUNDRY_ROOT"
+git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
+~~~
+
+Add actual values to the ignored Foundry .env:
+
+~~~dotenv
+BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
+BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
+BASESCAN_API_KEY=<basescan-api-key>
+~~~
+
+Merge this into foundry.toml without duplicate tables:
+
+~~~toml
+[rpc_endpoints]
+base_sepolia = "$" + "{BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "$" + "{BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+~~~
+
+Replace each displayed "$" + "{" with a literal dollar sign followed by an
+opening brace; the desired TOML value is an environment-variable expansion.
+
+~~~bash
+set -a
+. "$FOUNDRY_ROOT/.env"
+set +a
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
+bytecode is STOP. Update the deployment script to accept/log explicit USDC and
+fee-recipient values and reject unexpected chain/token rather than defaulting.
+
+## 4. Base Sepolia release candidate
+
+Simulate, without broadcast:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
+~~~
+
+**Gate:** it shows Sepolia USDC
+0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
+and constructor inputs. Then deploy this exact SHA:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
+ --broadcast --verify -vvvv
+export SEPOLIA_TIP=0x<address-printed-by-script>
+forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
+ --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+The verification command is harmless if already verified; run it if automatic
+verification did not finish. **Gate:** success transaction, non-empty code,
+verified source. Record address, transaction, args, compiler, optimizer.
+
+## 5. Staging testnet journey
+
+Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
+Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
+artifact; do not hand-copy ABI. Review its diff.
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm install --frozen-lockfile
+pnpm lint
+pnpm typecheck
+pnpm build
+npx vercel link
+npx vercel --prod=false
+~~~
+
+Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
+variables may contain public Sepolia chain/address values and public read-only
+RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
+authenticated RPC, BaseScan key, or WalletConnect secret.
+
+Using two independent browser wallets, record transaction hashes for wrong-chain
+UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
+rejected approval/tip and insufficient allowance; refresh; events; balances.
+
+**Gate:** both complete independently; integer accounting proves fan decrease =
+gross and creator increase + fee increase = gross. Any fix restarts at Step 0.
+
+## 6. Prepare mainnet wallet and production build
+
+~~~bash
+export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
+echo "$MAINNET_DEPLOYER"
+cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
+then repeat balance/nonce.
+
+**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
+nonce means STOP.
+
+Set host production environment, adapting names to source:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
+~~~
+
+Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
+Use shared DNS/host ownership, forced HTTPS, and a health route containing only
+build SHA, chain, and contract address.
+
+**Gate:** production build refuses placeholder/zero contract address instead of
+calling localhost; lint/typecheck/build are green. Do not publish yet.
+
+## 7. Mainnet deployment ceremony
+
+One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
+recipient, constructor args, compiler/optimizer, and deployer. Simulate:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge clean
+forge build
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+~~~
+
+**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
+Broadcast once:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
+ --broadcast --verify -vvvv
+export MAINNET_TIP=0x<address-printed-by-script>
+export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
+cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
+forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
+ --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+Run verify only when automatic verification is not complete. Read actual public
+getters; substitute actual names if necessary:
+
+~~~bash
+cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** successful explorer transaction, code, verified source and exact
+token/fee/recipient values. Both compare address character-for-character. A
+wrong deployment is never put in UI: document it and restart at Step 0.
+
+## 8. Restricted real-money smoke test
+
+Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
+not be deployer, recipient, or creator. Point a restricted preview at
+MAINNET_TIP, approve and tip a team-controlled creator. Record balances:
+
+~~~bash
+export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export TEST_FAN=0x<launch-test-fan>
+export TEST_CREATOR=0x<team-controlled-creator>
+export FEE_RECIPIENT=0x<approved-fee-recipient>
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** fan decrease = gross; creator increase + fee recipient increase =
+gross; fee matches formula. Check explorer events; rejected signature moves no
+funds. Any error takes preview down and requires a new release.
+
+## 9. Publish and operate
+
+Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
+the diff, set real production address, then:
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm lint && pnpm typecheck && pnpm build
+npx vercel --prod
+~~~
+
+Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
+contract and official USDC links, fee/recipient before signing, absence of
+local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
+health route SHA/8453/address.
+
+Only now tag deployed source:
+
+~~~bash
+cd "$APP_ROOT"
+git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
+git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
+~~~
+
+Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
+reconcile transfers. If only UI is wrong, remove domain/roll back and show a
+maintenance page requesting no signatures. If unexpected movement, wrong token
+or recipient, or vulnerability is suspected, remove public access immediately;
+if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
+hashes, notify users, obtain independent review before reopening, keep deployer
+keystore offline, and rotate leaked credentials.
+

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..65083363700b73b30dafabc505b398722e69db23
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,330 @@
+# Base mainnet launch runbook
+
+Follow every gate in order. STOP means fix and repeat that gate. Never put a
+private key, API secret, or authenticated RPC URL in Git, browser variables,
+chat, recordings, or shell history. Never reuse an Anvil key.
+
+## Constants
+
+Confirm Circle's current official address list before deployment.
+
+~~~text
+Base chain ID: 8453
+Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+USDC decimals: 6
+~~~
+
+Use an authenticated production Base RPC for deployment/monitoring; the public
+Base RPC is rate limited. References: [Base network
+details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
+[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Replace angle-bracket placeholders only after Step 1.
+
+~~~bash
+export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
+export RELEASE_SHA=<approved-full-git-sha>
+export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
+export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
+export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
+export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
+~~~
+
+## 0. Freeze source and ownership
+
+Create a shared launch sheet, signed off independently by both people. Record:
+full immutable Git SHA; fully-qualified contract and constructor values; USDC
+address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
+or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
+deployer account; shared host/DNS/RPC/explorer access; support and incident
+contacts.
+
+~~~bash
+cd "$APP_ROOT"
+git fetch --tags origin
+git checkout --detach "$RELEASE_SHA"
+git status --short
+git rev-parse HEAD
+~~~
+
+**Gate:** no status output and printed SHA equals the sheet. Any change creates
+a new SHA and restarts at this step.
+
+## 1. Map the actual Foundry project
+
+~~~bash
+cd "$APP_ROOT"
+find . -name AGENTS.md -print
+find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
+rg -n --hidden -g '!node_modules' -g '!out' \
+ '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
+~~~
+
+Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
+tip contract name, and the one generated deployment ABI/address artifact the UI
+imports. Fill in the exports above.
+
+~~~bash
+test -f "$FOUNDRY_ROOT/foundry.toml"
+test -f "$WEB_ROOT/package.json"
+~~~
+
+**Gate:** every production frontend address comes from that generated artifact
+or explicit versioned config. No production path contains localhost, 31337,
+Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.
+
+## 2. Contract readiness gate
+
+Both people review code and tests. Confirm:
+
+- USDC is fixed to the native Base address; callers cannot replace it.
+- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
+  never uses JavaScript floating point or number for money.
+- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
+  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
+- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
+  protection; no failure leaves partial accounting; zero addresses are rejected.
+- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
+  or owner route that can move user funds. Every necessary privileged function
+  is authorization-tested, publicly documented, and Safe/hardware-controlled.
+- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
+  fee, creator and approval scope and handles rejection, wrong chain,
+  insufficient USDC/ETH, RPC error, and revert.
+
+Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
+allowance, failed transfer, event values, and creator plus fee equals gross.
+Test privileged functions too.
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge fmt --check
+forge build
+forge test -vvv
+~~~
+
+**Gate:** all commands exit zero; both approve fee rounding and privileged
+powers. For a novel or meaningful-balance contract, obtain an independent
+security review before mainnet.
+
+## 3. Secure credentials and configure Base
+
+Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:
+
+~~~bash
+cast wallet import base-sepolia-deployer --interactive
+cast wallet import base-mainnet-deployer --interactive
+cd "$FOUNDRY_ROOT"
+git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
+~~~
+
+Add actual values to the ignored Foundry .env:
+
+~~~dotenv
+BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
+BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
+BASESCAN_API_KEY=<basescan-api-key>
+~~~
+
+Merge this into foundry.toml without duplicate tables:
+
+~~~toml
+[rpc_endpoints]
+base_sepolia = "$" + "{BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "$" + "{BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+~~~
+
+Replace each displayed "$" + "{" with a literal dollar sign followed by an
+opening brace; the desired TOML value is an environment-variable expansion.
+
+~~~bash
+set -a
+. "$FOUNDRY_ROOT/.env"
+set +a
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
+bytecode is STOP. Update the deployment script to accept/log explicit USDC and
+fee-recipient values and reject unexpected chain/token rather than defaulting.
+
+## 4. Base Sepolia release candidate
+
+Simulate, without broadcast:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
+~~~
+
+**Gate:** it shows Sepolia USDC
+0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
+and constructor inputs. Then deploy this exact SHA:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
+ --broadcast --verify -vvvv
+export SEPOLIA_TIP=0x<address-printed-by-script>
+forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
+ --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+The verification command is harmless if already verified; run it if automatic
+verification did not finish. **Gate:** success transaction, non-empty code,
+verified source. Record address, transaction, args, compiler, optimizer.
+
+## 5. Staging testnet journey
+
+Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
+Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
+artifact; do not hand-copy ABI. Review its diff.
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm install --frozen-lockfile
+pnpm lint
+pnpm typecheck
+pnpm build
+npx vercel link
+npx vercel --prod=false
+~~~
+
+Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
+variables may contain public Sepolia chain/address values and public read-only
+RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
+authenticated RPC, BaseScan key, or WalletConnect secret.
+
+Using two independent browser wallets, record transaction hashes for wrong-chain
+UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
+rejected approval/tip and insufficient allowance; refresh; events; balances.
+
+**Gate:** both complete independently; integer accounting proves fan decrease =
+gross and creator increase + fee increase = gross. Any fix restarts at Step 0.
+
+## 6. Prepare mainnet wallet and production build
+
+~~~bash
+export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
+echo "$MAINNET_DEPLOYER"
+cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
+then repeat balance/nonce.
+
+**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
+nonce means STOP.
+
+Set host production environment, adapting names to source:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
+~~~
+
+Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
+Use shared DNS/host ownership, forced HTTPS, and a health route containing only
+build SHA, chain, and contract address.
+
+**Gate:** production build refuses placeholder/zero contract address instead of
+calling localhost; lint/typecheck/build are green. Do not publish yet.
+
+## 7. Mainnet deployment ceremony
+
+One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
+recipient, constructor args, compiler/optimizer, and deployer. Simulate:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge clean
+forge build
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+~~~
+
+**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
+Broadcast once:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
+ --broadcast --verify -vvvv
+export MAINNET_TIP=0x<address-printed-by-script>
+export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
+cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
+forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
+ --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+Run verify only when automatic verification is not complete. Read actual public
+getters; substitute actual names if necessary:
+
+~~~bash
+cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** successful explorer transaction, code, verified source and exact
+token/fee/recipient values. Both compare address character-for-character. A
+wrong deployment is never put in UI: document it and restart at Step 0.
+
+## 8. Restricted real-money smoke test
+
+Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
+not be deployer, recipient, or creator. Point a restricted preview at
+MAINNET_TIP, approve and tip a team-controlled creator. Record balances:
+
+~~~bash
+export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export TEST_FAN=0x<launch-test-fan>
+export TEST_CREATOR=0x<team-controlled-creator>
+export FEE_RECIPIENT=0x<approved-fee-recipient>
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** fan decrease = gross; creator increase + fee recipient increase =
+gross; fee matches formula. Check explorer events; rejected signature moves no
+funds. Any error takes preview down and requires a new release.
+
+## 9. Publish and operate
+
+Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
+the diff, set real production address, then:
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm lint && pnpm typecheck && pnpm build
+npx vercel --prod
+~~~
+
+Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
+contract and official USDC links, fee/recipient before signing, absence of
+local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
+health route SHA/8453/address.
+
+Only now tag deployed source:
+
+~~~bash
+cd "$APP_ROOT"
+git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
+git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
+~~~
+
+Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
+reconcile transfers. If only UI is wrong, remove domain/roll back and show a
+maintenance page requesting no signatures. If unexpected movement, wrong token
+or recipient, or vulnerability is suspected, remove public access immediately;
+if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
+hashes, notify users, obtain independent review before reopening, keep deployer
+keystore offline, and rotate leaked credentials.
+

codex
The runbook is now in place. I’m doing a final pass on its literal commands/config snippets so the handoff doesn’t leave any ambiguous production values.
exec
/bin/bash -lc "sed -n '1,360p' LAUNCH.md && git diff --check && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Base mainnet launch runbook

Follow every gate in order. STOP means fix and repeat that gate. Never put a
private key, API secret, or authenticated RPC URL in Git, browser variables,
chat, recordings, or shell history. Never reuse an Anvil key.

## Constants

Confirm Circle's current official address list before deployment.

~~~text
Base chain ID: 8453
Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
USDC decimals: 6
~~~

Use an authenticated production Base RPC for deployment/monitoring; the public
Base RPC is rate limited. References: [Base network
details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).

Replace angle-bracket placeholders only after Step 1.

~~~bash
export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
export RELEASE_SHA=<approved-full-git-sha>
export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
~~~

## 0. Freeze source and ownership

Create a shared launch sheet, signed off independently by both people. Record:
full immutable Git SHA; fully-qualified contract and constructor values; USDC
address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
deployer account; shared host/DNS/RPC/explorer access; support and incident
contacts.

~~~bash
cd "$APP_ROOT"
git fetch --tags origin
git checkout --detach "$RELEASE_SHA"
git status --short
git rev-parse HEAD
~~~

**Gate:** no status output and printed SHA equals the sheet. Any change creates
a new SHA and restarts at this step.

## 1. Map the actual Foundry project

~~~bash
cd "$APP_ROOT"
find . -name AGENTS.md -print
find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
rg -n --hidden -g '!node_modules' -g '!out' \
 '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
~~~

Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
tip contract name, and the one generated deployment ABI/address artifact the UI
imports. Fill in the exports above.

~~~bash
test -f "$FOUNDRY_ROOT/foundry.toml"
test -f "$WEB_ROOT/package.json"
~~~

**Gate:** every production frontend address comes from that generated artifact
or explicit versioned config. No production path contains localhost, 31337,
Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.

## 2. Contract readiness gate

Both people review code and tests. Confirm:

- USDC is fixed to the native Base address; callers cannot replace it.
- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
  never uses JavaScript floating point or number for money.
- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
  protection; no failure leaves partial accounting; zero addresses are rejected.
- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
  or owner route that can move user funds. Every necessary privileged function
  is authorization-tested, publicly documented, and Safe/hardware-controlled.
- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
  fee, creator and approval scope and handles rejection, wrong chain,
  insufficient USDC/ETH, RPC error, and revert.

Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
allowance, failed transfer, event values, and creator plus fee equals gross.
Test privileged functions too.

~~~bash
cd "$FOUNDRY_ROOT"
forge fmt --check
forge build
forge test -vvv
~~~

**Gate:** all commands exit zero; both approve fee rounding and privileged
powers. For a novel or meaningful-balance contract, obtain an independent
security review before mainnet.

## 3. Secure credentials and configure Base

Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:

~~~bash
cast wallet import base-sepolia-deployer --interactive
cast wallet import base-mainnet-deployer --interactive
cd "$FOUNDRY_ROOT"
git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
~~~

Add actual values to the ignored Foundry .env:

~~~dotenv
BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
BASESCAN_API_KEY=<basescan-api-key>
~~~

Merge this into foundry.toml without duplicate tables:

~~~toml
[rpc_endpoints]
base_sepolia = "$" + "{BASE_SEPOLIA_RPC_URL}"
base_mainnet = "$" + "{BASE_MAINNET_RPC_URL}"

[etherscan]
base_sepolia = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
base = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
~~~

Replace each displayed "$" + "{" with a literal dollar sign followed by an
opening brace; the desired TOML value is an environment-variable expansion.

~~~bash
set -a
. "$FOUNDRY_ROOT/.env"
set +a
cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
~~~

**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
bytecode is STOP. Update the deployment script to accept/log explicit USDC and
fee-recipient values and reject unexpected chain/token rather than defaulting.

## 4. Base Sepolia release candidate

Simulate, without broadcast:

~~~bash
cd "$FOUNDRY_ROOT"
forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
~~~

**Gate:** it shows Sepolia USDC
0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
and constructor inputs. Then deploy this exact SHA:

~~~bash
forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
 --broadcast --verify -vvvv
export SEPOLIA_TIP=0x<address-printed-by-script>
forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
 --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
~~~

The verification command is harmless if already verified; run it if automatic
verification did not finish. **Gate:** success transaction, non-empty code,
verified source. Record address, transaction, args, compiler, optimizer.

## 5. Staging testnet journey

Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
artifact; do not hand-copy ABI. Review its diff.

~~~bash
cd "$WEB_ROOT"
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
npx vercel link
npx vercel --prod=false
~~~

Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
variables may contain public Sepolia chain/address values and public read-only
RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
authenticated RPC, BaseScan key, or WalletConnect secret.

Using two independent browser wallets, record transaction hashes for wrong-chain
UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
rejected approval/tip and insufficient allowance; refresh; events; balances.

**Gate:** both complete independently; integer accounting proves fan decrease =
gross and creator increase + fee increase = gross. Any fix restarts at Step 0.

## 6. Prepare mainnet wallet and production build

~~~bash
export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
echo "$MAINNET_DEPLOYER"
cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
~~~

Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
then repeat balance/nonce.

**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
nonce means STOP.

Set host production environment, adapting names to source:

~~~dotenv
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
~~~

Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
Use shared DNS/host ownership, forced HTTPS, and a health route containing only
build SHA, chain, and contract address.

**Gate:** production build refuses placeholder/zero contract address instead of
calling localhost; lint/typecheck/build are green. Do not publish yet.

## 7. Mainnet deployment ceremony

One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
recipient, constructor args, compiler/optimizer, and deployer. Simulate:

~~~bash
cd "$FOUNDRY_ROOT"
forge clean
forge build
forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
~~~

**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
Broadcast once:

~~~bash
forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
 --broadcast --verify -vvvv
export MAINNET_TIP=0x<address-printed-by-script>
export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
 --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
~~~

Run verify only when automatic verification is not complete. Read actual public
getters; substitute actual names if necessary:

~~~bash
cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
~~~

**Gate:** successful explorer transaction, code, verified source and exact
token/fee/recipient values. Both compare address character-for-character. A
wrong deployment is never put in UI: document it and restart at Step 0.

## 8. Restricted real-money smoke test

Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
not be deployer, recipient, or creator. Point a restricted preview at
MAINNET_TIP, approve and tip a team-controlled creator. Record balances:

~~~bash
export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export TEST_FAN=0x<launch-test-fan>
export TEST_CREATOR=0x<team-controlled-creator>
export FEE_RECIPIENT=0x<approved-fee-recipient>
cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
~~~

**Gate:** fan decrease = gross; creator increase + fee recipient increase =
gross; fee matches formula. Check explorer events; rejected signature moves no
funds. Any error takes preview down and requires a new release.

## 9. Publish and operate

Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
the diff, set real production address, then:

~~~bash
cd "$WEB_ROOT"
pnpm lint && pnpm typecheck && pnpm build
npx vercel --prod
~~~

Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
contract and official USDC links, fee/recipient before signing, absence of
local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
health route SHA/8453/address.

Only now tag deployed source:

~~~bash
cd "$APP_ROOT"
git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
~~~

Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
reconcile transfers. If only UI is wrong, remove domain/roll back and show a
maintenance page requesting no signatures. If unexpected movement, wrong token
or recipient, or vulnerability is suspected, remove public access immediately;
if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
hashes, notify users, obtain independent review before reopening, keep deployer
keystore offline, and rotate leaked credentials.

?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..65083363700b73b30dafabc505b398722e69db23
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,330 @@
+# Base mainnet launch runbook
+
+Follow every gate in order. STOP means fix and repeat that gate. Never put a
+private key, API secret, or authenticated RPC URL in Git, browser variables,
+chat, recordings, or shell history. Never reuse an Anvil key.
+
+## Constants
+
+Confirm Circle's current official address list before deployment.
+
+~~~text
+Base chain ID: 8453
+Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+USDC decimals: 6
+~~~
+
+Use an authenticated production Base RPC for deployment/monitoring; the public
+Base RPC is rate limited. References: [Base network
+details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
+[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Replace angle-bracket placeholders only after Step 1.
+
+~~~bash
+export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
+export RELEASE_SHA=<approved-full-git-sha>
+export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
+export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
+export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
+export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
+~~~
+
+## 0. Freeze source and ownership
+
+Create a shared launch sheet, signed off independently by both people. Record:
+full immutable Git SHA; fully-qualified contract and constructor values; USDC
+address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
+or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
+deployer account; shared host/DNS/RPC/explorer access; support and incident
+contacts.
+
+~~~bash
+cd "$APP_ROOT"
+git fetch --tags origin
+git checkout --detach "$RELEASE_SHA"
+git status --short
+git rev-parse HEAD
+~~~
+
+**Gate:** no status output and printed SHA equals the sheet. Any change creates
+a new SHA and restarts at this step.
+
+## 1. Map the actual Foundry project
+
+~~~bash
+cd "$APP_ROOT"
+find . -name AGENTS.md -print
+find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
+rg -n --hidden -g '!node_modules' -g '!out' \
+ '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
+~~~
+
+Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
+tip contract name, and the one generated deployment ABI/address artifact the UI
+imports. Fill in the exports above.
+
+~~~bash
+test -f "$FOUNDRY_ROOT/foundry.toml"
+test -f "$WEB_ROOT/package.json"
+~~~
+
+**Gate:** every production frontend address comes from that generated artifact
+or explicit versioned config. No production path contains localhost, 31337,
+Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.
+
+## 2. Contract readiness gate
+
+Both people review code and tests. Confirm:
+
+- USDC is fixed to the native Base address; callers cannot replace it.
+- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
+  never uses JavaScript floating point or number for money.
+- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
+  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
+- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
+  protection; no failure leaves partial accounting; zero addresses are rejected.
+- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
+  or owner route that can move user funds. Every necessary privileged function
+  is authorization-tested, publicly documented, and Safe/hardware-controlled.
+- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
+  fee, creator and approval scope and handles rejection, wrong chain,
+  insufficient USDC/ETH, RPC error, and revert.
+
+Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
+allowance, failed transfer, event values, and creator plus fee equals gross.
+Test privileged functions too.
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge fmt --check
+forge build
+forge test -vvv
+~~~
+
+**Gate:** all commands exit zero; both approve fee rounding and privileged
+powers. For a novel or meaningful-balance contract, obtain an independent
+security review before mainnet.
+
+## 3. Secure credentials and configure Base
+
+Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:
+
+~~~bash
+cast wallet import base-sepolia-deployer --interactive
+cast wallet import base-mainnet-deployer --interactive
+cd "$FOUNDRY_ROOT"
+git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
+~~~
+
+Add actual values to the ignored Foundry .env:
+
+~~~dotenv
+BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
+BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
+BASESCAN_API_KEY=<basescan-api-key>
+~~~
+
+Merge this into foundry.toml without duplicate tables:
+
+~~~toml
+[rpc_endpoints]
+base_sepolia = "$" + "{BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "$" + "{BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "$" + "{BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+~~~
+
+Replace each displayed "$" + "{" with a literal dollar sign followed by an
+opening brace; the desired TOML value is an environment-variable expansion.
+
+~~~bash
+set -a
+. "$FOUNDRY_ROOT/.env"
+set +a
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
+bytecode is STOP. Update the deployment script to accept/log explicit USDC and
+fee-recipient values and reject unexpected chain/token rather than defaulting.
+
+## 4. Base Sepolia release candidate
+
+Simulate, without broadcast:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
+~~~
+
+**Gate:** it shows Sepolia USDC
+0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
+and constructor inputs. Then deploy this exact SHA:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
+ --broadcast --verify -vvvv
+export SEPOLIA_TIP=0x<address-printed-by-script>
+forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
+ --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+The verification command is harmless if already verified; run it if automatic
+verification did not finish. **Gate:** success transaction, non-empty code,
+verified source. Record address, transaction, args, compiler, optimizer.
+
+## 5. Staging testnet journey
+
+Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
+Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
+artifact; do not hand-copy ABI. Review its diff.
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm install --frozen-lockfile
+pnpm lint
+pnpm typecheck
+pnpm build
+npx vercel link
+npx vercel --prod=false
+~~~
+
+Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
+variables may contain public Sepolia chain/address values and public read-only
+RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
+authenticated RPC, BaseScan key, or WalletConnect secret.
+
+Using two independent browser wallets, record transaction hashes for wrong-chain
+UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
+rejected approval/tip and insufficient allowance; refresh; events; balances.
+
+**Gate:** both complete independently; integer accounting proves fan decrease =
+gross and creator increase + fee increase = gross. Any fix restarts at Step 0.
+
+## 6. Prepare mainnet wallet and production build
+
+~~~bash
+export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
+echo "$MAINNET_DEPLOYER"
+cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
+then repeat balance/nonce.
+
+**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
+nonce means STOP.
+
+Set host production environment, adapting names to source:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
+~~~
+
+Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
+Use shared DNS/host ownership, forced HTTPS, and a health route containing only
+build SHA, chain, and contract address.
+
+**Gate:** production build refuses placeholder/zero contract address instead of
+calling localhost; lint/typecheck/build are green. Do not publish yet.
+
+## 7. Mainnet deployment ceremony
+
+One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
+recipient, constructor args, compiler/optimizer, and deployer. Simulate:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge clean
+forge build
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+~~~
+
+**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
+Broadcast once:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
+ --broadcast --verify -vvvv
+export MAINNET_TIP=0x<address-printed-by-script>
+export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
+cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
+forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
+ --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+Run verify only when automatic verification is not complete. Read actual public
+getters; substitute actual names if necessary:
+
+~~~bash
+cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** successful explorer transaction, code, verified source and exact
+token/fee/recipient values. Both compare address character-for-character. A
+wrong deployment is never put in UI: document it and restart at Step 0.
+
+## 8. Restricted real-money smoke test
+
+Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
+not be deployer, recipient, or creator. Point a restricted preview at
+MAINNET_TIP, approve and tip a team-controlled creator. Record balances:
+
+~~~bash
+export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export TEST_FAN=0x<launch-test-fan>
+export TEST_CREATOR=0x<team-controlled-creator>
+export FEE_RECIPIENT=0x<approved-fee-recipient>
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** fan decrease = gross; creator increase + fee recipient increase =
+gross; fee matches formula. Check explorer events; rejected signature moves no
+funds. Any error takes preview down and requires a new release.
+
+## 9. Publish and operate
+
+Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
+the diff, set real production address, then:
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm lint && pnpm typecheck && pnpm build
+npx vercel --prod
+~~~
+
+Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
+contract and official USDC links, fee/recipient before signing, absence of
+local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
+health route SHA/8453/address.
+
+Only now tag deployed source:
+
+~~~bash
+cd "$APP_ROOT"
+git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
+git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
+~~~
+
+Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
+reconcile transfers. If only UI is wrong, remove domain/roll back and show a
+maintenance page requesting no signatures. If unexpected movement, wrong token
+or recipient, or vulnerability is suspected, remove public access immediately;
+if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
+hashes, notify users, obtain independent review before reopening, keep deployer
+keystore offline, and rotate leaked credentials.
+

apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..a05e2e71fafd56e12654b3e9d564c6bdea6a60b8
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,326 @@
+# Base mainnet launch runbook
+
+Follow every gate in order. STOP means fix and repeat that gate. Never put a
+private key, API secret, or authenticated RPC URL in Git, browser variables,
+chat, recordings, or shell history. Never reuse an Anvil key.
+
+## Constants
+
+Confirm Circle's current official address list before deployment.
+
+~~~text
+Base chain ID: 8453
+Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+USDC decimals: 6
+~~~
+
+Use an authenticated production Base RPC for deployment/monitoring; the public
+Base RPC is rate limited. References: [Base network
+details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
+[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Replace angle-bracket placeholders only after Step 1.
+
+~~~bash
+export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
+export RELEASE_SHA=<approved-full-git-sha>
+export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
+export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
+export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
+export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
+~~~
+
+## 0. Freeze source and ownership
+
+Create a shared launch sheet, signed off independently by both people. Record:
+full immutable Git SHA; fully-qualified contract and constructor values; USDC
+address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
+or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
+deployer account; shared host/DNS/RPC/explorer access; support and incident
+contacts.
+
+~~~bash
+cd "$APP_ROOT"
+git fetch --tags origin
+git checkout --detach "$RELEASE_SHA"
+git status --short
+git rev-parse HEAD
+~~~
+
+**Gate:** no status output and printed SHA equals the sheet. Any change creates
+a new SHA and restarts at this step.
+
+## 1. Map the actual Foundry project
+
+~~~bash
+cd "$APP_ROOT"
+find . -name AGENTS.md -print
+find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
+rg -n --hidden -g '!node_modules' -g '!out' \
+ '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
+~~~
+
+Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
+tip contract name, and the one generated deployment ABI/address artifact the UI
+imports. Fill in the exports above.
+
+~~~bash
+test -f "$FOUNDRY_ROOT/foundry.toml"
+test -f "$WEB_ROOT/package.json"
+~~~
+
+**Gate:** every production frontend address comes from that generated artifact
+or explicit versioned config. No production path contains localhost, 31337,
+Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.
+
+## 2. Contract readiness gate
+
+Both people review code and tests. Confirm:
+
+- USDC is fixed to the native Base address; callers cannot replace it.
+- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
+  never uses JavaScript floating point or number for money.
+- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
+  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
+- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
+  protection; no failure leaves partial accounting; zero addresses are rejected.
+- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
+  or owner route that can move user funds. Every necessary privileged function
+  is authorization-tested, publicly documented, and Safe/hardware-controlled.
+- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
+  fee, creator and approval scope and handles rejection, wrong chain,
+  insufficient USDC/ETH, RPC error, and revert.
+
+Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
+allowance, failed transfer, event values, and creator plus fee equals gross.
+Test privileged functions too.
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge fmt --check
+forge build
+forge test -vvv
+~~~
+
+**Gate:** all commands exit zero; both approve fee rounding and privileged
+powers. For a novel or meaningful-balance contract, obtain an independent
+security review before mainnet.
+
+## 3. Secure credentials and configure Base
+
+Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:
+
+~~~bash
+cast wallet import base-sepolia-deployer --interactive
+cast wallet import base-mainnet-deployer --interactive
+cd "$FOUNDRY_ROOT"
+git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
+~~~
+
+Add actual values to the ignored Foundry .env:
+
+~~~dotenv
+BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
+BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
+BASESCAN_API_KEY=<basescan-api-key>
+~~~
+
+Merge this into foundry.toml without duplicate tables:
+
+~~~toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+~~~
+
+~~~bash
+set -a
+. "$FOUNDRY_ROOT/.env"
+set +a
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
+bytecode is STOP. Update the deployment script to accept/log explicit USDC and
+fee-recipient values and reject unexpected chain/token rather than defaulting.
+
+## 4. Base Sepolia release candidate
+
+Simulate, without broadcast:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
+~~~
+
+**Gate:** it shows Sepolia USDC
+0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
+and constructor inputs. Then deploy this exact SHA:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
+ --broadcast --verify -vvvv
+export SEPOLIA_TIP=0x<address-printed-by-script>
+forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
+ --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+The verification command is harmless if already verified; run it if automatic
+verification did not finish. **Gate:** success transaction, non-empty code,
+verified source. Record address, transaction, args, compiler, optimizer.
+
+## 5. Staging testnet journey
+
+Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
+Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
+artifact; do not hand-copy ABI. Review its diff.
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm install --frozen-lockfile
+pnpm lint
+pnpm typecheck
+pnpm build
+npx vercel link
+npx vercel --prod=false
+~~~
+
+Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
+variables may contain public Sepolia chain/address values and public read-only
+RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
+authenticated RPC, BaseScan key, or WalletConnect secret.
+
+Using two independent browser wallets, record transaction hashes for wrong-chain
+UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
+rejected approval/tip and insufficient allowance; refresh; events; balances.
+
+**Gate:** both complete independently; integer accounting proves fan decrease =
+gross and creator increase + fee increase = gross. Any fix restarts at Step 0.
+
+## 6. Prepare mainnet wallet and production build
+
+~~~bash
+export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
+echo "$MAINNET_DEPLOYER"
+cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
+then repeat balance/nonce.
+
+**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
+nonce means STOP.
+
+Set host production environment, adapting names to source:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
+~~~
+
+Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
+Use shared DNS/host ownership, forced HTTPS, and a health route containing only
+build SHA, chain, and contract address.
+
+**Gate:** production build refuses placeholder/zero contract address instead of
+calling localhost; lint/typecheck/build are green. Do not publish yet.
+
+## 7. Mainnet deployment ceremony
+
+One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
+recipient, constructor args, compiler/optimizer, and deployer. Simulate:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge clean
+forge build
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+~~~
+
+**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
+Broadcast once:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
+ --broadcast --verify -vvvv
+export MAINNET_TIP=0x<address-printed-by-script>
+export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
+cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
+forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
+ --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+Run verify only when automatic verification is not complete. Read actual public
+getters; substitute actual names if necessary:
+
+~~~bash
+cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** successful explorer transaction, code, verified source and exact
+token/fee/recipient values. Both compare address character-for-character. A
+wrong deployment is never put in UI: document it and restart at Step 0.
+
+## 8. Restricted real-money smoke test
+
+Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
+not be deployer, recipient, or creator. Point a restricted preview at
+MAINNET_TIP, approve and tip a team-controlled creator. Record balances:
+
+~~~bash
+export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export TEST_FAN=0x<launch-test-fan>
+export TEST_CREATOR=0x<team-controlled-creator>
+export FEE_RECIPIENT=0x<approved-fee-recipient>
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** fan decrease = gross; creator increase + fee recipient increase =
+gross; fee matches formula. Check explorer events; rejected signature moves no
+funds. Any error takes preview down and requires a new release.
+
+## 9. Publish and operate
+
+Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
+the diff, set real production address, then:
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm lint && pnpm typecheck && pnpm build
+npx vercel --prod
+~~~
+
+Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
+contract and official USDC links, fee/recipient before signing, absence of
+local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
+health route SHA/8453/address.
+
+Only now tag deployed source:
+
+~~~bash
+cd "$APP_ROOT"
+git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
+git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
+~~~
+
+Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
+reconcile transfers. If only UI is wrong, remove domain/roll back and show a
+maintenance page requesting no signatures. If unexpected movement, wrong token
+or recipient, or vulnerability is suspected, remove public access immediately;
+if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
+hashes, notify users, obtain independent review before reopening, keep deployer
+keystore offline, and rotate leaked credentials.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..a05e2e71fafd56e12654b3e9d564c6bdea6a60b8
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,326 @@
+# Base mainnet launch runbook
+
+Follow every gate in order. STOP means fix and repeat that gate. Never put a
+private key, API secret, or authenticated RPC URL in Git, browser variables,
+chat, recordings, or shell history. Never reuse an Anvil key.
+
+## Constants
+
+Confirm Circle's current official address list before deployment.
+
+~~~text
+Base chain ID: 8453
+Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+USDC decimals: 6
+~~~
+
+Use an authenticated production Base RPC for deployment/monitoring; the public
+Base RPC is rate limited. References: [Base network
+details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
+[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Replace angle-bracket placeholders only after Step 1.
+
+~~~bash
+export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
+export RELEASE_SHA=<approved-full-git-sha>
+export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
+export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
+export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
+export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
+~~~
+
+## 0. Freeze source and ownership
+
+Create a shared launch sheet, signed off independently by both people. Record:
+full immutable Git SHA; fully-qualified contract and constructor values; USDC
+address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
+or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
+deployer account; shared host/DNS/RPC/explorer access; support and incident
+contacts.
+
+~~~bash
+cd "$APP_ROOT"
+git fetch --tags origin
+git checkout --detach "$RELEASE_SHA"
+git status --short
+git rev-parse HEAD
+~~~
+
+**Gate:** no status output and printed SHA equals the sheet. Any change creates
+a new SHA and restarts at this step.
+
+## 1. Map the actual Foundry project
+
+~~~bash
+cd "$APP_ROOT"
+find . -name AGENTS.md -print
+find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
+rg -n --hidden -g '!node_modules' -g '!out' \
+ '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
+~~~
+
+Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
+tip contract name, and the one generated deployment ABI/address artifact the UI
+imports. Fill in the exports above.
+
+~~~bash
+test -f "$FOUNDRY_ROOT/foundry.toml"
+test -f "$WEB_ROOT/package.json"
+~~~
+
+**Gate:** every production frontend address comes from that generated artifact
+or explicit versioned config. No production path contains localhost, 31337,
+Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.
+
+## 2. Contract readiness gate
+
+Both people review code and tests. Confirm:
+
+- USDC is fixed to the native Base address; callers cannot replace it.
+- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
+  never uses JavaScript floating point or number for money.
+- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
+  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
+- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
+  protection; no failure leaves partial accounting; zero addresses are rejected.
+- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
+  or owner route that can move user funds. Every necessary privileged function
+  is authorization-tested, publicly documented, and Safe/hardware-controlled.
+- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
+  fee, creator and approval scope and handles rejection, wrong chain,
+  insufficient USDC/ETH, RPC error, and revert.
+
+Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
+allowance, failed transfer, event values, and creator plus fee equals gross.
+Test privileged functions too.
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge fmt --check
+forge build
+forge test -vvv
+~~~
+
+**Gate:** all commands exit zero; both approve fee rounding and privileged
+powers. For a novel or meaningful-balance contract, obtain an independent
+security review before mainnet.
+
+## 3. Secure credentials and configure Base
+
+Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:
+
+~~~bash
+cast wallet import base-sepolia-deployer --interactive
+cast wallet import base-mainnet-deployer --interactive
+cd "$FOUNDRY_ROOT"
+git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
+~~~
+
+Add actual values to the ignored Foundry .env:
+
+~~~dotenv
+BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
+BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
+BASESCAN_API_KEY=<basescan-api-key>
+~~~
+
+Merge this into foundry.toml without duplicate tables:
+
+~~~toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+~~~
+
+~~~bash
+set -a
+. "$FOUNDRY_ROOT/.env"
+set +a
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
+bytecode is STOP. Update the deployment script to accept/log explicit USDC and
+fee-recipient values and reject unexpected chain/token rather than defaulting.
+
+## 4. Base Sepolia release candidate
+
+Simulate, without broadcast:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
+~~~
+
+**Gate:** it shows Sepolia USDC
+0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
+and constructor inputs. Then deploy this exact SHA:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
+ --broadcast --verify -vvvv
+export SEPOLIA_TIP=0x<address-printed-by-script>
+forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
+ --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+The verification command is harmless if already verified; run it if automatic
+verification did not finish. **Gate:** success transaction, non-empty code,
+verified source. Record address, transaction, args, compiler, optimizer.
+
+## 5. Staging testnet journey
+
+Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
+Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
+artifact; do not hand-copy ABI. Review its diff.
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm install --frozen-lockfile
+pnpm lint
+pnpm typecheck
+pnpm build
+npx vercel link
+npx vercel --prod=false
+~~~
+
+Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
+variables may contain public Sepolia chain/address values and public read-only
+RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
+authenticated RPC, BaseScan key, or WalletConnect secret.
+
+Using two independent browser wallets, record transaction hashes for wrong-chain
+UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
+rejected approval/tip and insufficient allowance; refresh; events; balances.
+
+**Gate:** both complete independently; integer accounting proves fan decrease =
+gross and creator increase + fee increase = gross. Any fix restarts at Step 0.
+
+## 6. Prepare mainnet wallet and production build
+
+~~~bash
+export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
+echo "$MAINNET_DEPLOYER"
+cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
+then repeat balance/nonce.
+
+**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
+nonce means STOP.
+
+Set host production environment, adapting names to source:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
+~~~
+
+Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
+Use shared DNS/host ownership, forced HTTPS, and a health route containing only
+build SHA, chain, and contract address.
+
+**Gate:** production build refuses placeholder/zero contract address instead of
+calling localhost; lint/typecheck/build are green. Do not publish yet.
+
+## 7. Mainnet deployment ceremony
+
+One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
+recipient, constructor args, compiler/optimizer, and deployer. Simulate:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge clean
+forge build
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+~~~
+
+**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
+Broadcast once:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
+ --broadcast --verify -vvvv
+export MAINNET_TIP=0x<address-printed-by-script>
+export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
+cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
+forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
+ --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+Run verify only when automatic verification is not complete. Read actual public
+getters; substitute actual names if necessary:
+
+~~~bash
+cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** successful explorer transaction, code, verified source and exact
+token/fee/recipient values. Both compare address character-for-character. A
+wrong deployment is never put in UI: document it and restart at Step 0.
+
+## 8. Restricted real-money smoke test
+
+Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
+not be deployer, recipient, or creator. Point a restricted preview at
+MAINNET_TIP, approve and tip a team-controlled creator. Record balances:
+
+~~~bash
+export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export TEST_FAN=0x<launch-test-fan>
+export TEST_CREATOR=0x<team-controlled-creator>
+export FEE_RECIPIENT=0x<approved-fee-recipient>
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** fan decrease = gross; creator increase + fee recipient increase =
+gross; fee matches formula. Check explorer events; rejected signature moves no
+funds. Any error takes preview down and requires a new release.
+
+## 9. Publish and operate
+
+Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
+the diff, set real production address, then:
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm lint && pnpm typecheck && pnpm build
+npx vercel --prod
+~~~
+
+Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
+contract and official USDC links, fee/recipient before signing, absence of
+local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
+health route SHA/8453/address.
+
+Only now tag deployed source:
+
+~~~bash
+cd "$APP_ROOT"
+git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
+git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
+~~~
+
+Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
+reconcile transfers. If only UI is wrong, remove domain/roll back and show a
+maintenance page requesting no signatures. If unexpected movement, wrong token
+or recipient, or vulnerability is suspected, remove public access immediately;
+if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
+hashes, notify users, obtain independent review before reopening, keep deployer
+keystore offline, and rotate leaked credentials.

exec
/bin/bash -lc "git diff --check && rg -n '\"\\"'$" '"\\+|\\"'$'"\\{' LAUNCH.md && wc -l LAUNCH.md && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
132:base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
133:base_mainnet = "${BASE_MAINNET_RPC_URL}"
136:base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
137:base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
326 LAUNCH.md
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..a05e2e71fafd56e12654b3e9d564c6bdea6a60b8
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,326 @@
+# Base mainnet launch runbook
+
+Follow every gate in order. STOP means fix and repeat that gate. Never put a
+private key, API secret, or authenticated RPC URL in Git, browser variables,
+chat, recordings, or shell history. Never reuse an Anvil key.
+
+## Constants
+
+Confirm Circle's current official address list before deployment.
+
+~~~text
+Base chain ID: 8453
+Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+USDC decimals: 6
+~~~
+
+Use an authenticated production Base RPC for deployment/monitoring; the public
+Base RPC is rate limited. References: [Base network
+details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
+[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Replace angle-bracket placeholders only after Step 1.
+
+~~~bash
+export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
+export RELEASE_SHA=<approved-full-git-sha>
+export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
+export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
+export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
+export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
+~~~
+
+## 0. Freeze source and ownership
+
+Create a shared launch sheet, signed off independently by both people. Record:
+full immutable Git SHA; fully-qualified contract and constructor values; USDC
+address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
+or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
+deployer account; shared host/DNS/RPC/explorer access; support and incident
+contacts.
+
+~~~bash
+cd "$APP_ROOT"
+git fetch --tags origin
+git checkout --detach "$RELEASE_SHA"
+git status --short
+git rev-parse HEAD
+~~~
+
+**Gate:** no status output and printed SHA equals the sheet. Any change creates
+a new SHA and restarts at this step.
+
+## 1. Map the actual Foundry project
+
+~~~bash
+cd "$APP_ROOT"
+find . -name AGENTS.md -print
+find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
+rg -n --hidden -g '!node_modules' -g '!out' \
+ '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
+~~~
+
+Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
+tip contract name, and the one generated deployment ABI/address artifact the UI
+imports. Fill in the exports above.
+
+~~~bash
+test -f "$FOUNDRY_ROOT/foundry.toml"
+test -f "$WEB_ROOT/package.json"
+~~~
+
+**Gate:** every production frontend address comes from that generated artifact
+or explicit versioned config. No production path contains localhost, 31337,
+Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.
+
+## 2. Contract readiness gate
+
+Both people review code and tests. Confirm:
+
+- USDC is fixed to the native Base address; callers cannot replace it.
+- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
+  never uses JavaScript floating point or number for money.
+- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
+  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
+- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
+  protection; no failure leaves partial accounting; zero addresses are rejected.
+- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
+  or owner route that can move user funds. Every necessary privileged function
+  is authorization-tested, publicly documented, and Safe/hardware-controlled.
+- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
+  fee, creator and approval scope and handles rejection, wrong chain,
+  insufficient USDC/ETH, RPC error, and revert.
+
+Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
+allowance, failed transfer, event values, and creator plus fee equals gross.
+Test privileged functions too.
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge fmt --check
+forge build
+forge test -vvv
+~~~
+
+**Gate:** all commands exit zero; both approve fee rounding and privileged
+powers. For a novel or meaningful-balance contract, obtain an independent
+security review before mainnet.
+
+## 3. Secure credentials and configure Base
+
+Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:
+
+~~~bash
+cast wallet import base-sepolia-deployer --interactive
+cast wallet import base-mainnet-deployer --interactive
+cd "$FOUNDRY_ROOT"
+git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
+~~~
+
+Add actual values to the ignored Foundry .env:
+
+~~~dotenv
+BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
+BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
+BASESCAN_API_KEY=<basescan-api-key>
+~~~
+
+Merge this into foundry.toml without duplicate tables:
+
+~~~toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+~~~
+
+~~~bash
+set -a
+. "$FOUNDRY_ROOT/.env"
+set +a
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
+bytecode is STOP. Update the deployment script to accept/log explicit USDC and
+fee-recipient values and reject unexpected chain/token rather than defaulting.
+
+## 4. Base Sepolia release candidate
+
+Simulate, without broadcast:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
+~~~
+
+**Gate:** it shows Sepolia USDC
+0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
+and constructor inputs. Then deploy this exact SHA:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
+ --broadcast --verify -vvvv
+export SEPOLIA_TIP=0x<address-printed-by-script>
+forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
+ --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+The verification command is harmless if already verified; run it if automatic
+verification did not finish. **Gate:** success transaction, non-empty code,
+verified source. Record address, transaction, args, compiler, optimizer.
+
+## 5. Staging testnet journey
+
+Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
+Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
+artifact; do not hand-copy ABI. Review its diff.
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm install --frozen-lockfile
+pnpm lint
+pnpm typecheck
+pnpm build
+npx vercel link
+npx vercel --prod=false
+~~~
+
+Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
+variables may contain public Sepolia chain/address values and public read-only
+RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
+authenticated RPC, BaseScan key, or WalletConnect secret.
+
+Using two independent browser wallets, record transaction hashes for wrong-chain
+UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
+rejected approval/tip and insufficient allowance; refresh; events; balances.
+
+**Gate:** both complete independently; integer accounting proves fan decrease =
+gross and creator increase + fee increase = gross. Any fix restarts at Step 0.
+
+## 6. Prepare mainnet wallet and production build
+
+~~~bash
+export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
+echo "$MAINNET_DEPLOYER"
+cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
+then repeat balance/nonce.
+
+**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
+nonce means STOP.
+
+Set host production environment, adapting names to source:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
+~~~
+
+Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
+Use shared DNS/host ownership, forced HTTPS, and a health route containing only
+build SHA, chain, and contract address.
+
+**Gate:** production build refuses placeholder/zero contract address instead of
+calling localhost; lint/typecheck/build are green. Do not publish yet.
+
+## 7. Mainnet deployment ceremony
+
+One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
+recipient, constructor args, compiler/optimizer, and deployer. Simulate:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge clean
+forge build
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+~~~
+
+**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
+Broadcast once:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
+ --broadcast --verify -vvvv
+export MAINNET_TIP=0x<address-printed-by-script>
+export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
+cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
+forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
+ --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+Run verify only when automatic verification is not complete. Read actual public
+getters; substitute actual names if necessary:
+
+~~~bash
+cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** successful explorer transaction, code, verified source and exact
+token/fee/recipient values. Both compare address character-for-character. A
+wrong deployment is never put in UI: document it and restart at Step 0.
+
+## 8. Restricted real-money smoke test
+
+Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
+not be deployer, recipient, or creator. Point a restricted preview at
+MAINNET_TIP, approve and tip a team-controlled creator. Record balances:
+
+~~~bash
+export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export TEST_FAN=0x<launch-test-fan>
+export TEST_CREATOR=0x<team-controlled-creator>
+export FEE_RECIPIENT=0x<approved-fee-recipient>
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** fan decrease = gross; creator increase + fee recipient increase =
+gross; fee matches formula. Check explorer events; rejected signature moves no
+funds. Any error takes preview down and requires a new release.
+
+## 9. Publish and operate
+
+Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
+the diff, set real production address, then:
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm lint && pnpm typecheck && pnpm build
+npx vercel --prod
+~~~
+
+Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
+contract and official USDC links, fee/recipient before signing, absence of
+local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
+health route SHA/8453/address.
+
+Only now tag deployed source:
+
+~~~bash
+cd "$APP_ROOT"
+git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
+git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
+~~~
+
+Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
+reconcile transfers. If only UI is wrong, remove domain/roll back and show a
+maintenance page requesting no signatures. If unexpected movement, wrong token
+or recipient, or vulnerability is suspected, remove public access immediately;
+if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
+hashes, notify users, obtain independent review before reopening, keep deployer
+keystore offline, and rotate leaked credentials.

codex
Created the complete gated production runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001/LAUNCH.md).

It covers release freezing, code/security gates, Base Sepolia rehearsal, secure keystore/RPC setup, two-person Base mainnet deployment, verification, real-money smoke testing, public hosting, and first-day incident response.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..a05e2e71fafd56e12654b3e9d564c6bdea6a60b8
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,326 @@
+# Base mainnet launch runbook
+
+Follow every gate in order. STOP means fix and repeat that gate. Never put a
+private key, API secret, or authenticated RPC URL in Git, browser variables,
+chat, recordings, or shell history. Never reuse an Anvil key.
+
+## Constants
+
+Confirm Circle's current official address list before deployment.
+
+~~~text
+Base chain ID: 8453
+Native Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+USDC decimals: 6
+~~~
+
+Use an authenticated production Base RPC for deployment/monitoring; the public
+Base RPC is rate limited. References: [Base network
+details](https://docs.base.org/base-chain/quickstart/connecting-to-base) and
+[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
+
+Replace angle-bracket placeholders only after Step 1.
+
+~~~bash
+export APP_ROOT=/absolute/path/to/the/scaffold-eth-2-repository
+export RELEASE_SHA=<approved-full-git-sha>
+export FOUNDRY_ROOT="$APP_ROOT/<foundry-directory>"
+export WEB_ROOT="$APP_ROOT/<nextjs-directory>"
+export DEPLOY_SCRIPT='script/<actual-script>.s.sol:<actual-script-contract>'
+export TIP_CONTRACT='src/<actual-contract>.sol:<actual-contract-name>'
+~~~
+
+## 0. Freeze source and ownership
+
+Create a shared launch sheet, signed off independently by both people. Record:
+full immutable Git SHA; fully-qualified contract and constructor values; USDC
+address/decimals; fee as 100 bps and exact rounding rule; exact hardware-wallet
+or Safe fee recipient; every admin/pause/upgrade power and owner; dedicated
+deployer account; shared host/DNS/RPC/explorer access; support and incident
+contacts.
+
+~~~bash
+cd "$APP_ROOT"
+git fetch --tags origin
+git checkout --detach "$RELEASE_SHA"
+git status --short
+git rev-parse HEAD
+~~~
+
+**Gate:** no status output and printed SHA equals the sheet. Any change creates
+a new SHA and restarts at this step.
+
+## 1. Map the actual Foundry project
+
+~~~bash
+cd "$APP_ROOT"
+find . -name AGENTS.md -print
+find . -maxdepth 4 \( -name foundry.toml -o -name package.json -o -name '*.s.sol' \) -print
+rg -n --hidden -g '!node_modules' -g '!out' \
+ '31337|localhost|anvil|USDC|usdc|fee|basis|bps|deployedContracts|targetNetworks|chains' .
+~~~
+
+Read every AGENTS.md. Identify Foundry root, Next.js root, deployment script,
+tip contract name, and the one generated deployment ABI/address artifact the UI
+imports. Fill in the exports above.
+
+~~~bash
+test -f "$FOUNDRY_ROOT/foundry.toml"
+test -f "$WEB_ROOT/package.json"
+~~~
+
+**Gate:** every production frontend address comes from that generated artifact
+or explicit versioned config. No production path contains localhost, 31337,
+Anvil, mock USDC, burner wallet, or local faucet. STOP and make it unambiguous.
+
+## 2. Contract readiness gate
+
+Both people review code and tests. Confirm:
+
+- USDC is fixed to the native Base address; callers cannot replace it.
+- Amounts are integer micro-USDC. UI accepts at most six fractional digits and
+  never uses JavaScript floating point or number for money.
+- Gross G uses the agreed formula, normally fee = floor(G * 100 / 10,000) and
+  creator proceeds = G - fee. Disclose the rounding behavior for tiny tips.
+- Safe ERC-20 transfer calls check failure; external-call paths have reentrancy
+  protection; no failure leaves partial accounting; zero addresses are rejected.
+- There is no unrestricted withdrawal, arbitrary call, delegatecall, upgrade,
+  or owner route that can move user funds. Every necessary privileged function
+  is authorization-tested, publicly documented, and Safe/hardware-controlled.
+- Events identify fan, creator, gross, fee, and proceeds. UI exposes amount,
+  fee, creator and approval scope and handles rejection, wrong chain,
+  insufficient USDC/ETH, RPC error, and revert.
+
+Test amounts 1, 99, 100, 101, 1_000_000, a large value, zero/revert, missing
+allowance, failed transfer, event values, and creator plus fee equals gross.
+Test privileged functions too.
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge fmt --check
+forge build
+forge test -vvv
+~~~
+
+**Gate:** all commands exit zero; both approve fee rounding and privileged
+powers. For a novel or meaningful-balance contract, obtain an independent
+security review before mainnet.
+
+## 3. Secure credentials and configure Base
+
+Create separate Sepolia and mainnet deployers in Foundry encrypted keystore:
+
+~~~bash
+cast wallet import base-sepolia-deployer --interactive
+cast wallet import base-mainnet-deployer --interactive
+cd "$FOUNDRY_ROOT"
+git check-ignore -v .env || { echo '.env must be ignored first'; exit 1; }
+~~~
+
+Add actual values to the ignored Foundry .env:
+
+~~~dotenv
+BASE_SEPOLIA_RPC_URL=https://<authenticated-provider>/base-sepolia
+BASE_MAINNET_RPC_URL=https://<authenticated-provider>/base-mainnet
+BASESCAN_API_KEY=<basescan-api-key>
+~~~
+
+Merge this into foundry.toml without duplicate tables:
+
+~~~toml
+[rpc_endpoints]
+base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
+base_mainnet = "${BASE_MAINNET_RPC_URL}"
+
+[etherscan]
+base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
+base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
+~~~
+
+~~~bash
+set -a
+. "$FOUNDRY_ROOT/.env"
+set +a
+cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
+cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url "$BASE_SEPOLIA_RPC_URL"
+cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** output is 84532, 8453, and non-empty bytecode. Wrong chain or 0x
+bytecode is STOP. Update the deployment script to accept/log explicit USDC and
+fee-recipient values and reject unexpected chain/token rather than defaulting.
+
+## 4. Base Sepolia release candidate
+
+Simulate, without broadcast:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia -vvvv
+~~~
+
+**Gate:** it shows Sepolia USDC
+0x036CbD53842c5426634e7929541eC2318f3dCF7e, reviewed fee recipient, 100 bps,
+and constructor inputs. Then deploy this exact SHA:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account base-sepolia-deployer \
+ --broadcast --verify -vvvv
+export SEPOLIA_TIP=0x<address-printed-by-script>
+forge verify-contract "$SEPOLIA_TIP" "$TIP_CONTRACT" \
+ --chain-id 84532 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+The verification command is harmless if already verified; run it if automatic
+verification did not finish. **Gate:** success transaction, non-empty code,
+verified source. Record address, transaction, args, compiler, optimizer.
+
+## 5. Staging testnet journey
+
+Configure a non-indexed preview with baseSepolia, chain 84532, SEPOLIA_TIP, and
+Sepolia USDC. Regenerate the repository's existing Scaffold-ETH deployment
+artifact; do not hand-copy ABI. Review its diff.
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm install --frozen-lockfile
+pnpm lint
+pnpm typecheck
+pnpm build
+npx vercel link
+npx vercel --prod=false
+~~~
+
+Use npm ci or yarn frozen install if that lockfile is authoritative. Preview
+variables may contain public Sepolia chain/address values and public read-only
+RPC only. Every NEXT_PUBLIC value is public: no private key, API token,
+authenticated RPC, BaseScan key, or WalletConnect secret.
+
+Using two independent browser wallets, record transaction hashes for wrong-chain
+UX; no-USDC/no-ETH errors; approval and 1.00-USDC tip; rounding-boundary tip;
+rejected approval/tip and insufficient allowance; refresh; events; balances.
+
+**Gate:** both complete independently; integer accounting proves fan decrease =
+gross and creator increase + fee increase = gross. Any fix restarts at Step 0.
+
+## 6. Prepare mainnet wallet and production build
+
+~~~bash
+export MAINNET_DEPLOYER=$(cast wallet address --account base-mainnet-deployer)
+echo "$MAINNET_DEPLOYER"
+cast balance "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast nonce "$MAINNET_DEPLOYER" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+Both compare the address to the sheet. Send a pre-agreed modest Base ETH amount,
+then repeat balance/nonce.
+
+**Gate:** sufficient gas margin and expected nonce, normally zero. Unexpected
+nonce means STOP.
+
+Set host production environment, adapting names to source:
+
+~~~dotenv
+NEXT_PUBLIC_CHAIN_ID=8453
+NEXT_PUBLIC_TIP_CONTRACT_ADDRESS=__FILL_AFTER_STEP_7__
+NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+NEXT_PUBLIC_BASE_RPC_URL=https://<public-read-only-rpc>
+~~~
+
+Configure production wagmi/RainbowKit for base; remove/hide burner/local faucet.
+Use shared DNS/host ownership, forced HTTPS, and a health route containing only
+build SHA, chain, and contract address.
+
+**Gate:** production build refuses placeholder/zero contract address instead of
+calling localhost; lint/typecheck/build are green. Do not publish yet.
+
+## 7. Mainnet deployment ceremony
+
+One operates; one reads aloud release SHA, chain, USDC, 100 bps/rounding, fee
+recipient, constructor args, compiler/optimizer, and deployer. Simulate:
+
+~~~bash
+cd "$FOUNDRY_ROOT"
+forge clean
+forge build
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer -vvvv
+~~~
+
+**Gate:** chain 8453 and all reviewed inputs appear; no transaction sent.
+Broadcast once:
+
+~~~bash
+forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account base-mainnet-deployer \
+ --broadcast --verify -vvvv
+export MAINNET_TIP=0x<address-printed-by-script>
+export MAINNET_DEPLOY_TX=0x<transaction-hash-printed-by-script>
+cast code "$MAINNET_TIP" --rpc-url "$BASE_MAINNET_RPC_URL"
+forge verify-contract "$MAINNET_TIP" "$TIP_CONTRACT" \
+ --chain-id 8453 --watch --etherscan-api-key "$BASESCAN_API_KEY"
+~~~
+
+Run verify only when automatic verification is not complete. Read actual public
+getters; substitute actual names if necessary:
+
+~~~bash
+cast call "$MAINNET_TIP" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$MAINNET_TIP" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** successful explorer transaction, code, verified source and exact
+token/fee/recipient values. Both compare address character-for-character. A
+wrong deployment is never put in UI: document it and restart at Step 0.
+
+## 8. Restricted real-money smoke test
+
+Fund a dedicated launch-test fan wallet with small Base ETH and USDC. It must
+not be deployer, recipient, or creator. Point a restricted preview at
+MAINNET_TIP, approve and tip a team-controlled creator. Record balances:
+
+~~~bash
+export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
+export TEST_FAN=0x<launch-test-fan>
+export TEST_CREATOR=0x<team-controlled-creator>
+export FEE_RECIPIENT=0x<approved-fee-recipient>
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_FAN" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$TEST_CREATOR" --rpc-url "$BASE_MAINNET_RPC_URL"
+cast call "$BASE_USDC" 'balanceOf(address)(uint256)' "$FEE_RECIPIENT" --rpc-url "$BASE_MAINNET_RPC_URL"
+~~~
+
+**Gate:** fan decrease = gross; creator increase + fee recipient increase =
+gross; fee matches formula. Check explorer events; rejected signature moves no
+funds. Any error takes preview down and requires a new release.
+
+## 9. Publish and operate
+
+Regenerate the one frontend artifact/config for MAINNET_TIP and 8453, review
+the diff, set real production address, then:
+
+~~~bash
+cd "$WEB_ROOT"
+pnpm lint && pnpm typecheck && pnpm build
+npx vercel --prod
+~~~
+
+Use clean desktop/mobile browsers to check HTTPS, Base-only flow, verified
+contract and official USDC links, fee/recipient before signing, absence of
+local/Sepolia/mock/burner controls, absence of secrets in bundle/network, and
+health route SHA/8453/address.
+
+Only now tag deployed source:
+
+~~~bash
+cd "$APP_ROOT"
+git tag -a "mainnet-base-$(date -u +%Y-%m-%d)" "$RELEASE_SHA" -m "Base mainnet launch"
+git push origin "mainnet-base-$(date -u +%Y-%m-%d)"
+~~~
+
+Monitor errors, RPC limits, reverts, support and BaseScan for 24 hours; sample
+reconcile transfers. If only UI is wrong, remove domain/roll back and show a
+maintenance page requesting no signatures. If unexpected movement, wrong token
+or recipient, or vulnerability is suspected, remove public access immediately;
+if the reviewed contract has pause, its Safe/hardware owner pauses it. Preserve
+hashes, notify users, obtain independent review before reopening, keep deployer
+keystore offline, and rotate leaked credentials.

tokens used
68,753
```

## final message

Created the complete gated production runbook: [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T152941Z-codex-no-skill-3/orchestration-goal-001/LAUNCH.md).

It covers release freezing, code/security gates, Base Sepolia rehearsal, secure keystore/RPC setup, two-person Base mainnet deployment, verification, real-money smoke testing, public hosting, and first-day incident response.
