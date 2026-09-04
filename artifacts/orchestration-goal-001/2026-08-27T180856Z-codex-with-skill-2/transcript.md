# Executor transcript — 2026-08-27T180856Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04469-4f49-7d51-bb88-1551fa2f1286
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
I’m using the project’s orchestration guidance because this is a live Base launch plan. I’ll make the runbook self-contained and ordered, including deployment gates and rollback/incident checks.
exec
/bin/bash -lc "pwd && sed -n '1,240p' .agents/skills/orchestration/SKILL.md && rg --files -g 'AGENTS.md' -g 'package.json' -g 'foundry.toml' -g '.env*' -g 'README*' . 2>/dev/null | head -80" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 5ms:
./package.json

exec
/bin/bash -lc "sed -n '1,240p' package.json && find . -maxdepth 2 -type f -not -path './.git/*' -print | sort" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
{
  "name": "eval-workspace",
  "private": true
}
./TASK.md
./package.json

web search: 
web search: site:docs.base.org Base mainnet chain id RPC URL ...
web search: 
web search: site:docs.base.org Base mainnet chain id RPC URL ...
2026-08-27T18:11:05.059431Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 69, 'printf '\nNEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID\n' >> .env.local' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..47500453ee35ea837efbb1844358e54efab89a20
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,194 @@
+# Production launch runbook — Base USDC creator tips
+
+This runbook deploys a new immutable Base-mainnet contract and only then makes the frontend public. Do not expose a public URL until the live-contract acceptance test passes: frontend changes cannot stop direct calls to deployed bytecode.
+
+Two roles: the operator runs commands; the reviewer independently checks every address, parameter, receipt, and gate. Neither proceeds alone.
+
+## 0. Launch worksheet
+
+Create an untracked secure note and fill it before any live action:
+
+| Item | Required value |
+| --- | --- |
+| Chain | Base mainnet, chain ID 8453 (0x2105) |
+| Native USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
+| USDC decimals | 6 |
+| Fee | 100 bps / denominator 10,000 |
+| Fee recipient | team-controlled Base address |
+| Owner | intended production Safe/hardware-wallet address, not deployer |
+| Deployer | fresh, single-purpose Base EOA |
+| App contract | exact Solidity contract, tip function, and argument order |
+| Test accounts | separate Base EOAs: FAN_TEST and CREATOR_TEST |
+
+Reviewer reads the constructor/initializer and deploy script, records exact arguments and whether the flow is approve, permit, or Permit2. Confirm there is no privileged pathway the team does not understand. Do not use mock or bridged/legacy USDC.
+
+**Gate 0:** both people approve token, owner, fee recipient, fee calculation, and deploy arguments. Base mainnet is 8453; use an authenticated production RPC rather than a rate-limited public endpoint. [Base network settings](https://docs.base.org/base-chain/quickstart/connecting-to-base) and [Base’s USDC example](https://docs.base.org/base-account/reference/prolink-utilities/encodeProlink).
+
+## 1. Freeze and test the release
+
+From a clean application checkout:
+
+    git status --short
+    git switch -c launch/base-mainnet-YYYY-MM-DD
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn format
+    yarn lint
+    yarn test
+    cd packages/foundry && forge test -vvv && forge build --sizes
+    cd ../..
+
+If this repo uses pnpm/npm, use `pnpm install --frozen-lockfile` / `npm ci` instead. Save commit hash, Node/Foundry versions, and logs.
+
+Tests must prove: a 1,000,000-unit (1 USDC) tip sends creator 990,000 and fee recipient 10,000; smallest-tip rounding is explicit; zero/invalid creator, insufficient balance/allowance, wrong token, and unauthorized admin actions fail; no user spends beyond allowance; admin setters reject zero addresses and emit events; UI uses bigint/`parseUnits(value, 6)`; events reveal fan, creator, gross, fee, and net.
+
+**Gate 1:** clean tree, all tests pass, size is below 24,576 bytes, and the reviewer sees the fee invariant in a test. Any failure goes back to source and test—not a UI patch.
+
+## 2. Test the actual Base integration on a local fork
+
+Store RPC values only in ignored files:
+
+    cd packages/foundry
+    cp -n .env.example .env
+    printf '%s\n' 'BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env
+    cd ../..
+    printf '%s\n' 'NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env.local
+    yarn fork --network base
+
+In another terminal, prove upstream state rather than relying on fork chain ID 31337:
+
+    cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+    cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+
+Expect non-`0x` code and `6`. Use `yarn fork --network base`, never `yarn fork base`. On the fork only, impersonate/fund test wallets, deploy the actual script, and walk the browser flow:
+
+    yarn deploy --network localhost
+    yarn start
+
+Connect, approve/permit, tip, check balances/events, and test every failure path.
+
+**Gate 2:** the unchanged deploy script succeeds against Base state; the UI reads the fork address; native Base USDC is present; success and error paths work.
+
+## 3. Prepare accounts and secrets
+
+Create/fund a fresh deployer EOA with Base ETH for deployment, verification, and buffer. Fund FAN_TEST with tiny Base ETH and USDC. Keep the intended owner in a hardware wallet/Safe.
+
+    export BASE_RPC_URL='https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID'
+    export DEPLOYER_ADDRESS='0xDEPLOYER'
+    export USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
+    cast chain-id --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+Chain ID must be 8453. Put BASE_RPC_URL and only the deploy script’s existing private-key variable (inspect it; often DEPLOYER_PRIVATE_KEY/PRIVATE_KEY) in ignored `packages/foundry/.env` or a secret manager. If supported by the script:
+
+    cast wallet import base-launch-deployer --interactive
+
+Never commit `.env`, `.env.local`, seeds, or private keys. `NEXT_PUBLIC_*` is public; keep secrets out of `scaffold.config.ts`.
+
+**Gate 3:** both people independently confirm Base, funded addresses, intended deployer, and no secret in git/profile/history.
+
+## 4. Configure the private production frontend
+
+In `packages/nextjs/scaffold.config.ts` (or equivalent), set the sole production target to Base:
+
+    import { base } from "viem/chains";
+    targetNetworks: [base],
+
+Do not put an RPC/API key in this committed file. Use generated `packages/nextjs/contracts/deployedContracts.ts` for chain 8453, not a component literal. If the project already uses a variable, make `NEXT_PUBLIC_APP_CONTRACT_ADDRESS` the sole validated address source. Ensure wrong-chain blocking, 6-decimal display, gross/fee/net preview, receipt-based success, and useful rejected/reverted/allowance errors.
+
+    yarn workspace @se-2/nextjs build
+
+If the workspace name differs, use the root script that builds `packages/nextjs`.
+
+**Gate 4:** build passes; exactly one contract-address source targets 8453; no localhost setting/private secret is bundled.
+
+## 5. Final deploy preflight
+
+Reviewer compares the final deploy script’s arguments to the worksheet: canonical USDC, fee recipient, owner, 100 bps. Run its exact `--dry-run` if supported; otherwise deploy it against the Base fork again from this final commit. Then:
+
+    cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+
+Disable any other use of this deployer.
+
+**Gate 5:** final simulation/fork run passes, every input is independently checked, and nonce is expected. If nonce differs, stop, identify the transaction, repeat this phase.
+
+## 6. Deploy and verify—no public site yet
+
+From the same clean checkout:
+
+    yarn deploy --network base
+    yarn verify --network base
+
+Run verify immediately. Keep `packages/foundry/broadcast/`: verification replays its `broadcast/run-latest.json` from this checkout. Record tx hash and contract:
+
+    export APP_CONTRACT='0xDEPLOYED_CONTRACT'
+    cast code "$APP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+
+Substitute actual ABI getters only if needed. Expect nonempty bytecode, canonical USDC, agreed recipient/owner, and 100. Confirm verified explorer source, compiler/settings, constructor args, and proxy implementation (if any) match the release.
+
+Commit generated metadata/config—not private env files:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+    git commit -m 'deploy: point frontend at Base mainnet tipping contract'
+    git status --short
+
+**Gate 6:** direct reads and verified source match worksheet; committed frontend targets exactly this contract on 8453. Mismatch means no launch: fix/test/redeploy (or documented proxy upgrade).
+
+## 7. Acceptance test live contracts through localhost
+
+From the commit containing Base metadata, without fork/local chain:
+
+    yarn start
+
+In a clean browser profile with FAN_TEST on Base, execute 1.000000 USDC:
+
+1. Verify wrong network is blocked.
+2. Enter CREATOR_TEST; preview must show fee 0.010000 and net 0.990000 USDC.
+3. Approve only needed amount (or approved permit). Spender must be APP_CONTRACT; submit.
+4. Wait for receipt. Verify fan -1,000,000; creator +990,000; fee recipient +10,000 USDC units. Gas is ETH.
+5. Reload; check persistent success/history. Exercise invalid/zero and wrong-network paths.
+
+    cast balance "$FAN_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$CREATOR_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$FEE_RECIPIENT" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+**Gate 7:** both people independently verify a live receipt, exact 99/1 split, correct spender/address/chain, and failure handling. Otherwise remain private and repeat full fix → regression test → deploy → verify → acceptance.
+
+## 8. Publish frontend
+
+Deploy preview first. For Vercel, from `packages/nextjs`:
+
+    npx vercel login
+    npx vercel link
+    npx vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+    npx vercel --prod
+
+Enter the reviewed Base RPC. If explicit address configuration is used:
+
+    npx vercel env add NEXT_PUBLIC_APP_CONTRACT_ADDRESS production
+
+Enter exact deployed address. Configure custom domain, HTTPS-only, and protected previews in hosting dashboard. Verify once more:
+
+    yarn build
+
+**Gate 8:** host built approved commit; env equals worksheet; domain HTTPS is valid; public bundle contains no localhost configuration/private secret.
+
+## 9. Public smoke test and monitoring
+
+In a fresh profile visit `https://YOUR_DOMAIN`; verify Base 8453, address, and amount; submit one extra tiny FAN_TEST tip; verify receipt/event/99–1 split. Check mobile and another wallet. Then announce URL, verified explorer, contract address, 1% policy, and support contact.
+
+For one hour monitor frontend/RPC errors, reverts, unexpected approvals, events, and creator/fee reconciliation. Record release commit, URL, contract, verification URL, and tx hashes.
+
+**Gate 9:** launch is complete only after the public URL completes the verified real-wallet transaction.
+
+## Incident rules
+
+- Before public launch: stop, preserve evidence, reproduce locally/Base fork, fix source, add regression, redeploy/verify, repoint metadata, repeat phases 6–9. UI-only fixes do not repair contracts.
+- After public launch, wrong chain/address/fee or suspicious behavior: immediately disable tipping controls/site and post support notice. Direct calls remain possible. Invoke pause only if intentionally provided and both people review the exact owner call.
+- Provider outage: switch only to a pre-vetted frontend RPC variable, redeploy frontend, repeat public smoke test—never redeploy contract.
+- Compromised deployer: remove privileges where possible and transfer ownership to Safe/hardware wallet. If immutable ownership cannot be secured, treat as incident and plan redeploy/migration.

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..47500453ee35ea837efbb1844358e54efab89a20
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,194 @@
+# Production launch runbook — Base USDC creator tips
+
+This runbook deploys a new immutable Base-mainnet contract and only then makes the frontend public. Do not expose a public URL until the live-contract acceptance test passes: frontend changes cannot stop direct calls to deployed bytecode.
+
+Two roles: the operator runs commands; the reviewer independently checks every address, parameter, receipt, and gate. Neither proceeds alone.
+
+## 0. Launch worksheet
+
+Create an untracked secure note and fill it before any live action:
+
+| Item | Required value |
+| --- | --- |
+| Chain | Base mainnet, chain ID 8453 (0x2105) |
+| Native USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
+| USDC decimals | 6 |
+| Fee | 100 bps / denominator 10,000 |
+| Fee recipient | team-controlled Base address |
+| Owner | intended production Safe/hardware-wallet address, not deployer |
+| Deployer | fresh, single-purpose Base EOA |
+| App contract | exact Solidity contract, tip function, and argument order |
+| Test accounts | separate Base EOAs: FAN_TEST and CREATOR_TEST |
+
+Reviewer reads the constructor/initializer and deploy script, records exact arguments and whether the flow is approve, permit, or Permit2. Confirm there is no privileged pathway the team does not understand. Do not use mock or bridged/legacy USDC.
+
+**Gate 0:** both people approve token, owner, fee recipient, fee calculation, and deploy arguments. Base mainnet is 8453; use an authenticated production RPC rather than a rate-limited public endpoint. [Base network settings](https://docs.base.org/base-chain/quickstart/connecting-to-base) and [Base’s USDC example](https://docs.base.org/base-account/reference/prolink-utilities/encodeProlink).
+
+## 1. Freeze and test the release
+
+From a clean application checkout:
+
+    git status --short
+    git switch -c launch/base-mainnet-YYYY-MM-DD
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn format
+    yarn lint
+    yarn test
+    cd packages/foundry && forge test -vvv && forge build --sizes
+    cd ../..
+
+If this repo uses pnpm/npm, use `pnpm install --frozen-lockfile` / `npm ci` instead. Save commit hash, Node/Foundry versions, and logs.
+
+Tests must prove: a 1,000,000-unit (1 USDC) tip sends creator 990,000 and fee recipient 10,000; smallest-tip rounding is explicit; zero/invalid creator, insufficient balance/allowance, wrong token, and unauthorized admin actions fail; no user spends beyond allowance; admin setters reject zero addresses and emit events; UI uses bigint/`parseUnits(value, 6)`; events reveal fan, creator, gross, fee, and net.
+
+**Gate 1:** clean tree, all tests pass, size is below 24,576 bytes, and the reviewer sees the fee invariant in a test. Any failure goes back to source and test—not a UI patch.
+
+## 2. Test the actual Base integration on a local fork
+
+Store RPC values only in ignored files:
+
+    cd packages/foundry
+    cp -n .env.example .env
+    printf '%s\n' 'BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env
+    cd ../..
+    printf '%s\n' 'NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env.local
+    yarn fork --network base
+
+In another terminal, prove upstream state rather than relying on fork chain ID 31337:
+
+    cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+    cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+
+Expect non-`0x` code and `6`. Use `yarn fork --network base`, never `yarn fork base`. On the fork only, impersonate/fund test wallets, deploy the actual script, and walk the browser flow:
+
+    yarn deploy --network localhost
+    yarn start
+
+Connect, approve/permit, tip, check balances/events, and test every failure path.
+
+**Gate 2:** the unchanged deploy script succeeds against Base state; the UI reads the fork address; native Base USDC is present; success and error paths work.
+
+## 3. Prepare accounts and secrets
+
+Create/fund a fresh deployer EOA with Base ETH for deployment, verification, and buffer. Fund FAN_TEST with tiny Base ETH and USDC. Keep the intended owner in a hardware wallet/Safe.
+
+    export BASE_RPC_URL='https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID'
+    export DEPLOYER_ADDRESS='0xDEPLOYER'
+    export USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
+    cast chain-id --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+Chain ID must be 8453. Put BASE_RPC_URL and only the deploy script’s existing private-key variable (inspect it; often DEPLOYER_PRIVATE_KEY/PRIVATE_KEY) in ignored `packages/foundry/.env` or a secret manager. If supported by the script:
+
+    cast wallet import base-launch-deployer --interactive
+
+Never commit `.env`, `.env.local`, seeds, or private keys. `NEXT_PUBLIC_*` is public; keep secrets out of `scaffold.config.ts`.
+
+**Gate 3:** both people independently confirm Base, funded addresses, intended deployer, and no secret in git/profile/history.
+
+## 4. Configure the private production frontend
+
+In `packages/nextjs/scaffold.config.ts` (or equivalent), set the sole production target to Base:
+
+    import { base } from "viem/chains";
+    targetNetworks: [base],
+
+Do not put an RPC/API key in this committed file. Use generated `packages/nextjs/contracts/deployedContracts.ts` for chain 8453, not a component literal. If the project already uses a variable, make `NEXT_PUBLIC_APP_CONTRACT_ADDRESS` the sole validated address source. Ensure wrong-chain blocking, 6-decimal display, gross/fee/net preview, receipt-based success, and useful rejected/reverted/allowance errors.
+
+    yarn workspace @se-2/nextjs build
+
+If the workspace name differs, use the root script that builds `packages/nextjs`.
+
+**Gate 4:** build passes; exactly one contract-address source targets 8453; no localhost setting/private secret is bundled.
+
+## 5. Final deploy preflight
+
+Reviewer compares the final deploy script’s arguments to the worksheet: canonical USDC, fee recipient, owner, 100 bps. Run its exact `--dry-run` if supported; otherwise deploy it against the Base fork again from this final commit. Then:
+
+    cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+
+Disable any other use of this deployer.
+
+**Gate 5:** final simulation/fork run passes, every input is independently checked, and nonce is expected. If nonce differs, stop, identify the transaction, repeat this phase.
+
+## 6. Deploy and verify—no public site yet
+
+From the same clean checkout:
+
+    yarn deploy --network base
+    yarn verify --network base
+
+Run verify immediately. Keep `packages/foundry/broadcast/`: verification replays its `broadcast/run-latest.json` from this checkout. Record tx hash and contract:
+
+    export APP_CONTRACT='0xDEPLOYED_CONTRACT'
+    cast code "$APP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+
+Substitute actual ABI getters only if needed. Expect nonempty bytecode, canonical USDC, agreed recipient/owner, and 100. Confirm verified explorer source, compiler/settings, constructor args, and proxy implementation (if any) match the release.
+
+Commit generated metadata/config—not private env files:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+    git commit -m 'deploy: point frontend at Base mainnet tipping contract'
+    git status --short
+
+**Gate 6:** direct reads and verified source match worksheet; committed frontend targets exactly this contract on 8453. Mismatch means no launch: fix/test/redeploy (or documented proxy upgrade).
+
+## 7. Acceptance test live contracts through localhost
+
+From the commit containing Base metadata, without fork/local chain:
+
+    yarn start
+
+In a clean browser profile with FAN_TEST on Base, execute 1.000000 USDC:
+
+1. Verify wrong network is blocked.
+2. Enter CREATOR_TEST; preview must show fee 0.010000 and net 0.990000 USDC.
+3. Approve only needed amount (or approved permit). Spender must be APP_CONTRACT; submit.
+4. Wait for receipt. Verify fan -1,000,000; creator +990,000; fee recipient +10,000 USDC units. Gas is ETH.
+5. Reload; check persistent success/history. Exercise invalid/zero and wrong-network paths.
+
+    cast balance "$FAN_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$CREATOR_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$FEE_RECIPIENT" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+**Gate 7:** both people independently verify a live receipt, exact 99/1 split, correct spender/address/chain, and failure handling. Otherwise remain private and repeat full fix → regression test → deploy → verify → acceptance.
+
+## 8. Publish frontend
+
+Deploy preview first. For Vercel, from `packages/nextjs`:
+
+    npx vercel login
+    npx vercel link
+    npx vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+    npx vercel --prod
+
+Enter the reviewed Base RPC. If explicit address configuration is used:
+
+    npx vercel env add NEXT_PUBLIC_APP_CONTRACT_ADDRESS production
+
+Enter exact deployed address. Configure custom domain, HTTPS-only, and protected previews in hosting dashboard. Verify once more:
+
+    yarn build
+
+**Gate 8:** host built approved commit; env equals worksheet; domain HTTPS is valid; public bundle contains no localhost configuration/private secret.
+
+## 9. Public smoke test and monitoring
+
+In a fresh profile visit `https://YOUR_DOMAIN`; verify Base 8453, address, and amount; submit one extra tiny FAN_TEST tip; verify receipt/event/99–1 split. Check mobile and another wallet. Then announce URL, verified explorer, contract address, 1% policy, and support contact.
+
+For one hour monitor frontend/RPC errors, reverts, unexpected approvals, events, and creator/fee reconciliation. Record release commit, URL, contract, verification URL, and tx hashes.
+
+**Gate 9:** launch is complete only after the public URL completes the verified real-wallet transaction.
+
+## Incident rules
+
+- Before public launch: stop, preserve evidence, reproduce locally/Base fork, fix source, add regression, redeploy/verify, repoint metadata, repeat phases 6–9. UI-only fixes do not repair contracts.
+- After public launch, wrong chain/address/fee or suspicious behavior: immediately disable tipping controls/site and post support notice. Direct calls remain possible. Invoke pause only if intentionally provided and both people review the exact owner call.
+- Provider outage: switch only to a pre-vetted frontend RPC variable, redeploy frontend, repeat public smoke test—never redeploy contract.
+- Compromised deployer: remove privileges where possible and transfer ownership to Safe/hardware wallet. If immutable ownership cannot be secured, treat as incident and plan redeploy/migration.

codex
The runbook is written. I’m doing a final consistency pass now, especially around the live-network checkpoints and the Scaffold-ETH command order.
exec
/bin/bash -lc "sed -n '1,260p' LAUNCH.md && git diff --check && git status --short" in /ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Production launch runbook — Base USDC creator tips

This runbook deploys a new immutable Base-mainnet contract and only then makes the frontend public. Do not expose a public URL until the live-contract acceptance test passes: frontend changes cannot stop direct calls to deployed bytecode.

Two roles: the operator runs commands; the reviewer independently checks every address, parameter, receipt, and gate. Neither proceeds alone.

## 0. Launch worksheet

Create an untracked secure note and fill it before any live action:

| Item | Required value |
| --- | --- |
| Chain | Base mainnet, chain ID 8453 (0x2105) |
| Native USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| USDC decimals | 6 |
| Fee | 100 bps / denominator 10,000 |
| Fee recipient | team-controlled Base address |
| Owner | intended production Safe/hardware-wallet address, not deployer |
| Deployer | fresh, single-purpose Base EOA |
| App contract | exact Solidity contract, tip function, and argument order |
| Test accounts | separate Base EOAs: FAN_TEST and CREATOR_TEST |

Reviewer reads the constructor/initializer and deploy script, records exact arguments and whether the flow is approve, permit, or Permit2. Confirm there is no privileged pathway the team does not understand. Do not use mock or bridged/legacy USDC.

**Gate 0:** both people approve token, owner, fee recipient, fee calculation, and deploy arguments. Base mainnet is 8453; use an authenticated production RPC rather than a rate-limited public endpoint. [Base network settings](https://docs.base.org/base-chain/quickstart/connecting-to-base) and [Base’s USDC example](https://docs.base.org/base-account/reference/prolink-utilities/encodeProlink).

## 1. Freeze and test the release

From a clean application checkout:

    git status --short
    git switch -c launch/base-mainnet-YYYY-MM-DD
    git rev-parse HEAD
    yarn install --immutable
    yarn format
    yarn lint
    yarn test
    cd packages/foundry && forge test -vvv && forge build --sizes
    cd ../..

If this repo uses pnpm/npm, use `pnpm install --frozen-lockfile` / `npm ci` instead. Save commit hash, Node/Foundry versions, and logs.

Tests must prove: a 1,000,000-unit (1 USDC) tip sends creator 990,000 and fee recipient 10,000; smallest-tip rounding is explicit; zero/invalid creator, insufficient balance/allowance, wrong token, and unauthorized admin actions fail; no user spends beyond allowance; admin setters reject zero addresses and emit events; UI uses bigint/`parseUnits(value, 6)`; events reveal fan, creator, gross, fee, and net.

**Gate 1:** clean tree, all tests pass, size is below 24,576 bytes, and the reviewer sees the fee invariant in a test. Any failure goes back to source and test—not a UI patch.

## 2. Test the actual Base integration on a local fork

Store RPC values only in ignored files:

    cd packages/foundry
    cp -n .env.example .env
    printf '%s\n' 'BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env
    cd ../..
    printf '%s\n' 'NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env.local
    yarn fork --network base

In another terminal, prove upstream state rather than relying on fork chain ID 31337:

    cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
    cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url http://127.0.0.1:8545

Expect non-`0x` code and `6`. Use `yarn fork --network base`, never `yarn fork base`. On the fork only, impersonate/fund test wallets, deploy the actual script, and walk the browser flow:

    yarn deploy --network localhost
    yarn start

Connect, approve/permit, tip, check balances/events, and test every failure path.

**Gate 2:** the unchanged deploy script succeeds against Base state; the UI reads the fork address; native Base USDC is present; success and error paths work.

## 3. Prepare accounts and secrets

Create/fund a fresh deployer EOA with Base ETH for deployment, verification, and buffer. Fund FAN_TEST with tiny Base ETH and USDC. Keep the intended owner in a hardware wallet/Safe.

    export BASE_RPC_URL='https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID'
    export DEPLOYER_ADDRESS='0xDEPLOYER'
    export USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    cast chain-id --rpc-url "$BASE_RPC_URL"
    cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
    cast balance "$DEPLOYER_ADDRESS" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"

Chain ID must be 8453. Put BASE_RPC_URL and only the deploy script’s existing private-key variable (inspect it; often DEPLOYER_PRIVATE_KEY/PRIVATE_KEY) in ignored `packages/foundry/.env` or a secret manager. If supported by the script:

    cast wallet import base-launch-deployer --interactive

Never commit `.env`, `.env.local`, seeds, or private keys. `NEXT_PUBLIC_*` is public; keep secrets out of `scaffold.config.ts`.

**Gate 3:** both people independently confirm Base, funded addresses, intended deployer, and no secret in git/profile/history.

## 4. Configure the private production frontend

In `packages/nextjs/scaffold.config.ts` (or equivalent), set the sole production target to Base:

    import { base } from "viem/chains";
    targetNetworks: [base],

Do not put an RPC/API key in this committed file. Use generated `packages/nextjs/contracts/deployedContracts.ts` for chain 8453, not a component literal. If the project already uses a variable, make `NEXT_PUBLIC_APP_CONTRACT_ADDRESS` the sole validated address source. Ensure wrong-chain blocking, 6-decimal display, gross/fee/net preview, receipt-based success, and useful rejected/reverted/allowance errors.

    yarn workspace @se-2/nextjs build

If the workspace name differs, use the root script that builds `packages/nextjs`.

**Gate 4:** build passes; exactly one contract-address source targets 8453; no localhost setting/private secret is bundled.

## 5. Final deploy preflight

Reviewer compares the final deploy script’s arguments to the worksheet: canonical USDC, fee recipient, owner, 100 bps. Run its exact `--dry-run` if supported; otherwise deploy it against the Base fork again from this final commit. Then:

    cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"

Disable any other use of this deployer.

**Gate 5:** final simulation/fork run passes, every input is independently checked, and nonce is expected. If nonce differs, stop, identify the transaction, repeat this phase.

## 6. Deploy and verify—no public site yet

From the same clean checkout:

    yarn deploy --network base
    yarn verify --network base

Run verify immediately. Keep `packages/foundry/broadcast/`: verification replays its `broadcast/run-latest.json` from this checkout. Record tx hash and contract:

    export APP_CONTRACT='0xDEPLOYED_CONTRACT'
    cast code "$APP_CONTRACT" --rpc-url "$BASE_RPC_URL"
    cast call "$APP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
    cast call "$APP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
    cast call "$APP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_RPC_URL"
    cast call "$APP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"

Substitute actual ABI getters only if needed. Expect nonempty bytecode, canonical USDC, agreed recipient/owner, and 100. Confirm verified explorer source, compiler/settings, constructor args, and proxy implementation (if any) match the release.

Commit generated metadata/config—not private env files:

    git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
    git commit -m 'deploy: point frontend at Base mainnet tipping contract'
    git status --short

**Gate 6:** direct reads and verified source match worksheet; committed frontend targets exactly this contract on 8453. Mismatch means no launch: fix/test/redeploy (or documented proxy upgrade).

## 7. Acceptance test live contracts through localhost

From the commit containing Base metadata, without fork/local chain:

    yarn start

In a clean browser profile with FAN_TEST on Base, execute 1.000000 USDC:

1. Verify wrong network is blocked.
2. Enter CREATOR_TEST; preview must show fee 0.010000 and net 0.990000 USDC.
3. Approve only needed amount (or approved permit). Spender must be APP_CONTRACT; submit.
4. Wait for receipt. Verify fan -1,000,000; creator +990,000; fee recipient +10,000 USDC units. Gas is ETH.
5. Reload; check persistent success/history. Exercise invalid/zero and wrong-network paths.

    cast balance "$FAN_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
    cast balance "$CREATOR_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
    cast balance "$FEE_RECIPIENT" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"

**Gate 7:** both people independently verify a live receipt, exact 99/1 split, correct spender/address/chain, and failure handling. Otherwise remain private and repeat full fix → regression test → deploy → verify → acceptance.

## 8. Publish frontend

Deploy preview first. For Vercel, from `packages/nextjs`:

    npx vercel login
    npx vercel link
    npx vercel env add NEXT_PUBLIC_BASE_RPC_URL production
    npx vercel --prod

Enter the reviewed Base RPC. If explicit address configuration is used:

    npx vercel env add NEXT_PUBLIC_APP_CONTRACT_ADDRESS production

Enter exact deployed address. Configure custom domain, HTTPS-only, and protected previews in hosting dashboard. Verify once more:

    yarn build

**Gate 8:** host built approved commit; env equals worksheet; domain HTTPS is valid; public bundle contains no localhost configuration/private secret.

## 9. Public smoke test and monitoring

In a fresh profile visit `https://YOUR_DOMAIN`; verify Base 8453, address, and amount; submit one extra tiny FAN_TEST tip; verify receipt/event/99–1 split. Check mobile and another wallet. Then announce URL, verified explorer, contract address, 1% policy, and support contact.

For one hour monitor frontend/RPC errors, reverts, unexpected approvals, events, and creator/fee reconciliation. Record release commit, URL, contract, verification URL, and tx hashes.

**Gate 9:** launch is complete only after the public URL completes the verified real-wallet transaction.

## Incident rules

- Before public launch: stop, preserve evidence, reproduce locally/Base fork, fix source, add regression, redeploy/verify, repoint metadata, repeat phases 6–9. UI-only fixes do not repair contracts.
- After public launch, wrong chain/address/fee or suspicious behavior: immediately disable tipping controls/site and post support notice. Direct calls remain possible. Invoke pause only if intentionally provided and both people review the exact owner call.
- Provider outage: switch only to a pre-vetted frontend RPC variable, redeploy frontend, repeat public smoke test—never redeploy contract.
- Compromised deployer: remove privileges where possible and transfer ownership to Safe/hardware wallet. If immutable ownership cannot be secured, treat as incident and plan redeploy/migration.
?? LAUNCH.md

diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..47500453ee35ea837efbb1844358e54efab89a20
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,194 @@
+# Production launch runbook — Base USDC creator tips
+
+This runbook deploys a new immutable Base-mainnet contract and only then makes the frontend public. Do not expose a public URL until the live-contract acceptance test passes: frontend changes cannot stop direct calls to deployed bytecode.
+
+Two roles: the operator runs commands; the reviewer independently checks every address, parameter, receipt, and gate. Neither proceeds alone.
+
+## 0. Launch worksheet
+
+Create an untracked secure note and fill it before any live action:
+
+| Item | Required value |
+| --- | --- |
+| Chain | Base mainnet, chain ID 8453 (0x2105) |
+| Native USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
+| USDC decimals | 6 |
+| Fee | 100 bps / denominator 10,000 |
+| Fee recipient | team-controlled Base address |
+| Owner | intended production Safe/hardware-wallet address, not deployer |
+| Deployer | fresh, single-purpose Base EOA |
+| App contract | exact Solidity contract, tip function, and argument order |
+| Test accounts | separate Base EOAs: FAN_TEST and CREATOR_TEST |
+
+Reviewer reads the constructor/initializer and deploy script, records exact arguments and whether the flow is approve, permit, or Permit2. Confirm there is no privileged pathway the team does not understand. Do not use mock or bridged/legacy USDC.
+
+**Gate 0:** both people approve token, owner, fee recipient, fee calculation, and deploy arguments. Base mainnet is 8453; use an authenticated production RPC rather than a rate-limited public endpoint. [Base network settings](https://docs.base.org/base-chain/quickstart/connecting-to-base) and [Base’s USDC example](https://docs.base.org/base-account/reference/prolink-utilities/encodeProlink).
+
+## 1. Freeze and test the release
+
+From a clean application checkout:
+
+    git status --short
+    git switch -c launch/base-mainnet-YYYY-MM-DD
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn format
+    yarn lint
+    yarn test
+    cd packages/foundry && forge test -vvv && forge build --sizes
+    cd ../..
+
+If this repo uses pnpm/npm, use `pnpm install --frozen-lockfile` / `npm ci` instead. Save commit hash, Node/Foundry versions, and logs.
+
+Tests must prove: a 1,000,000-unit (1 USDC) tip sends creator 990,000 and fee recipient 10,000; smallest-tip rounding is explicit; zero/invalid creator, insufficient balance/allowance, wrong token, and unauthorized admin actions fail; no user spends beyond allowance; admin setters reject zero addresses and emit events; UI uses bigint/`parseUnits(value, 6)`; events reveal fan, creator, gross, fee, and net.
+
+**Gate 1:** clean tree, all tests pass, size is below 24,576 bytes, and the reviewer sees the fee invariant in a test. Any failure goes back to source and test—not a UI patch.
+
+## 2. Test the actual Base integration on a local fork
+
+Store RPC values only in ignored files:
+
+    cd packages/foundry
+    cp -n .env.example .env
+    printf '%s\n' 'BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env
+    cd ../..
+    printf '%s\n' 'NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env.local
+    yarn fork --network base
+
+In another terminal, prove upstream state rather than relying on fork chain ID 31337:
+
+    cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+    cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+
+Expect non-`0x` code and `6`. Use `yarn fork --network base`, never `yarn fork base`. On the fork only, impersonate/fund test wallets, deploy the actual script, and walk the browser flow:
+
+    yarn deploy --network localhost
+    yarn start
+
+Connect, approve/permit, tip, check balances/events, and test every failure path.
+
+**Gate 2:** the unchanged deploy script succeeds against Base state; the UI reads the fork address; native Base USDC is present; success and error paths work.
+
+## 3. Prepare accounts and secrets
+
+Create/fund a fresh deployer EOA with Base ETH for deployment, verification, and buffer. Fund FAN_TEST with tiny Base ETH and USDC. Keep the intended owner in a hardware wallet/Safe.
+
+    export BASE_RPC_URL='https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID'
+    export DEPLOYER_ADDRESS='0xDEPLOYER'
+    export USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
+    cast chain-id --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+Chain ID must be 8453. Put BASE_RPC_URL and only the deploy script’s existing private-key variable (inspect it; often DEPLOYER_PRIVATE_KEY/PRIVATE_KEY) in ignored `packages/foundry/.env` or a secret manager. If supported by the script:
+
+    cast wallet import base-launch-deployer --interactive
+
+Never commit `.env`, `.env.local`, seeds, or private keys. `NEXT_PUBLIC_*` is public; keep secrets out of `scaffold.config.ts`.
+
+**Gate 3:** both people independently confirm Base, funded addresses, intended deployer, and no secret in git/profile/history.
+
+## 4. Configure the private production frontend
+
+In `packages/nextjs/scaffold.config.ts` (or equivalent), set the sole production target to Base:
+
+    import { base } from "viem/chains";
+    targetNetworks: [base],
+
+Do not put an RPC/API key in this committed file. Use generated `packages/nextjs/contracts/deployedContracts.ts` for chain 8453, not a component literal. If the project already uses a variable, make `NEXT_PUBLIC_APP_CONTRACT_ADDRESS` the sole validated address source. Ensure wrong-chain blocking, 6-decimal display, gross/fee/net preview, receipt-based success, and useful rejected/reverted/allowance errors.
+
+    yarn workspace @se-2/nextjs build
+
+If the workspace name differs, use the root script that builds `packages/nextjs`.
+
+**Gate 4:** build passes; exactly one contract-address source targets 8453; no localhost setting/private secret is bundled.
+
+## 5. Final deploy preflight
+
+Reviewer compares the final deploy script’s arguments to the worksheet: canonical USDC, fee recipient, owner, 100 bps. Run its exact `--dry-run` if supported; otherwise deploy it against the Base fork again from this final commit. Then:
+
+    cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+
+Disable any other use of this deployer.
+
+**Gate 5:** final simulation/fork run passes, every input is independently checked, and nonce is expected. If nonce differs, stop, identify the transaction, repeat this phase.
+
+## 6. Deploy and verify—no public site yet
+
+From the same clean checkout:
+
+    yarn deploy --network base
+    yarn verify --network base
+
+Run verify immediately. Keep `packages/foundry/broadcast/`: verification replays its `broadcast/run-latest.json` from this checkout. Record tx hash and contract:
+
+    export APP_CONTRACT='0xDEPLOYED_CONTRACT'
+    cast code "$APP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+
+Substitute actual ABI getters only if needed. Expect nonempty bytecode, canonical USDC, agreed recipient/owner, and 100. Confirm verified explorer source, compiler/settings, constructor args, and proxy implementation (if any) match the release.
+
+Commit generated metadata/config—not private env files:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+    git commit -m 'deploy: point frontend at Base mainnet tipping contract'
+    git status --short
+
+**Gate 6:** direct reads and verified source match worksheet; committed frontend targets exactly this contract on 8453. Mismatch means no launch: fix/test/redeploy (or documented proxy upgrade).
+
+## 7. Acceptance test live contracts through localhost
+
+From the commit containing Base metadata, without fork/local chain:
+
+    yarn start
+
+In a clean browser profile with FAN_TEST on Base, execute 1.000000 USDC:
+
+1. Verify wrong network is blocked.
+2. Enter CREATOR_TEST; preview must show fee 0.010000 and net 0.990000 USDC.
+3. Approve only needed amount (or approved permit). Spender must be APP_CONTRACT; submit.
+4. Wait for receipt. Verify fan -1,000,000; creator +990,000; fee recipient +10,000 USDC units. Gas is ETH.
+5. Reload; check persistent success/history. Exercise invalid/zero and wrong-network paths.
+
+    cast balance "$FAN_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$CREATOR_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$FEE_RECIPIENT" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+**Gate 7:** both people independently verify a live receipt, exact 99/1 split, correct spender/address/chain, and failure handling. Otherwise remain private and repeat full fix → regression test → deploy → verify → acceptance.
+
+## 8. Publish frontend
+
+Deploy preview first. For Vercel, from `packages/nextjs`:
+
+    npx vercel login
+    npx vercel link
+    npx vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+    npx vercel --prod
+
+Enter the reviewed Base RPC. If explicit address configuration is used:
+
+    npx vercel env add NEXT_PUBLIC_APP_CONTRACT_ADDRESS production
+
+Enter exact deployed address. Configure custom domain, HTTPS-only, and protected previews in hosting dashboard. Verify once more:
+
+    yarn build
+
+**Gate 8:** host built approved commit; env equals worksheet; domain HTTPS is valid; public bundle contains no localhost configuration/private secret.
+
+## 9. Public smoke test and monitoring
+
+In a fresh profile visit `https://YOUR_DOMAIN`; verify Base 8453, address, and amount; submit one extra tiny FAN_TEST tip; verify receipt/event/99–1 split. Check mobile and another wallet. Then announce URL, verified explorer, contract address, 1% policy, and support contact.
+
+For one hour monitor frontend/RPC errors, reverts, unexpected approvals, events, and creator/fee reconciliation. Record release commit, URL, contract, verification URL, and tx hashes.
+
+**Gate 9:** launch is complete only after the public URL completes the verified real-wallet transaction.
+
+## Incident rules
+
+- Before public launch: stop, preserve evidence, reproduce locally/Base fork, fix source, add regression, redeploy/verify, repoint metadata, repeat phases 6–9. UI-only fixes do not repair contracts.
+- After public launch, wrong chain/address/fee or suspicious behavior: immediately disable tipping controls/site and post support notice. Direct calls remain possible. Invoke pause only if intentionally provided and both people review the exact owner call.
+- Provider outage: switch only to a pre-vetted frontend RPC variable, redeploy frontend, repeat public smoke test—never redeploy contract.
+- Compromised deployer: remove privileges where possible and transfer ownership to Safe/hardware wallet. If immutable ownership cannot be secured, treat as incident and plan redeploy/migration.

codex
Created [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md).

It provides the ordered Base mainnet launch path, exact commands/config points, independent go/no-go gates, live-money localhost acceptance testing before publication, verification, public smoke tests, and incident handling.
diff --git a/LAUNCH.md b/LAUNCH.md
new file mode 100644
index 0000000000000000000000000000000000000000..47500453ee35ea837efbb1844358e54efab89a20
--- /dev/null
+++ b/LAUNCH.md
@@ -0,0 +1,194 @@
+# Production launch runbook — Base USDC creator tips
+
+This runbook deploys a new immutable Base-mainnet contract and only then makes the frontend public. Do not expose a public URL until the live-contract acceptance test passes: frontend changes cannot stop direct calls to deployed bytecode.
+
+Two roles: the operator runs commands; the reviewer independently checks every address, parameter, receipt, and gate. Neither proceeds alone.
+
+## 0. Launch worksheet
+
+Create an untracked secure note and fill it before any live action:
+
+| Item | Required value |
+| --- | --- |
+| Chain | Base mainnet, chain ID 8453 (0x2105) |
+| Native USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
+| USDC decimals | 6 |
+| Fee | 100 bps / denominator 10,000 |
+| Fee recipient | team-controlled Base address |
+| Owner | intended production Safe/hardware-wallet address, not deployer |
+| Deployer | fresh, single-purpose Base EOA |
+| App contract | exact Solidity contract, tip function, and argument order |
+| Test accounts | separate Base EOAs: FAN_TEST and CREATOR_TEST |
+
+Reviewer reads the constructor/initializer and deploy script, records exact arguments and whether the flow is approve, permit, or Permit2. Confirm there is no privileged pathway the team does not understand. Do not use mock or bridged/legacy USDC.
+
+**Gate 0:** both people approve token, owner, fee recipient, fee calculation, and deploy arguments. Base mainnet is 8453; use an authenticated production RPC rather than a rate-limited public endpoint. [Base network settings](https://docs.base.org/base-chain/quickstart/connecting-to-base) and [Base’s USDC example](https://docs.base.org/base-account/reference/prolink-utilities/encodeProlink).
+
+## 1. Freeze and test the release
+
+From a clean application checkout:
+
+    git status --short
+    git switch -c launch/base-mainnet-YYYY-MM-DD
+    git rev-parse HEAD
+    yarn install --immutable
+    yarn format
+    yarn lint
+    yarn test
+    cd packages/foundry && forge test -vvv && forge build --sizes
+    cd ../..
+
+If this repo uses pnpm/npm, use `pnpm install --frozen-lockfile` / `npm ci` instead. Save commit hash, Node/Foundry versions, and logs.
+
+Tests must prove: a 1,000,000-unit (1 USDC) tip sends creator 990,000 and fee recipient 10,000; smallest-tip rounding is explicit; zero/invalid creator, insufficient balance/allowance, wrong token, and unauthorized admin actions fail; no user spends beyond allowance; admin setters reject zero addresses and emit events; UI uses bigint/`parseUnits(value, 6)`; events reveal fan, creator, gross, fee, and net.
+
+**Gate 1:** clean tree, all tests pass, size is below 24,576 bytes, and the reviewer sees the fee invariant in a test. Any failure goes back to source and test—not a UI patch.
+
+## 2. Test the actual Base integration on a local fork
+
+Store RPC values only in ignored files:
+
+    cd packages/foundry
+    cp -n .env.example .env
+    printf '%s\n' 'BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env
+    cd ../..
+    printf '%s\n' 'NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID' >> .env.local
+    yarn fork --network base
+
+In another terminal, prove upstream state rather than relying on fork chain ID 31337:
+
+    cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
+    cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
+
+Expect non-`0x` code and `6`. Use `yarn fork --network base`, never `yarn fork base`. On the fork only, impersonate/fund test wallets, deploy the actual script, and walk the browser flow:
+
+    yarn deploy --network localhost
+    yarn start
+
+Connect, approve/permit, tip, check balances/events, and test every failure path.
+
+**Gate 2:** the unchanged deploy script succeeds against Base state; the UI reads the fork address; native Base USDC is present; success and error paths work.
+
+## 3. Prepare accounts and secrets
+
+Create/fund a fresh deployer EOA with Base ETH for deployment, verification, and buffer. Fund FAN_TEST with tiny Base ETH and USDC. Keep the intended owner in a hardware wallet/Safe.
+
+    export BASE_RPC_URL='https://YOUR_BASE_RPC_PROVIDER/PROJECT_ID'
+    export DEPLOYER_ADDRESS='0xDEPLOYER'
+    export USDC='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
+    cast chain-id --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+    cast balance "$DEPLOYER_ADDRESS" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+Chain ID must be 8453. Put BASE_RPC_URL and only the deploy script’s existing private-key variable (inspect it; often DEPLOYER_PRIVATE_KEY/PRIVATE_KEY) in ignored `packages/foundry/.env` or a secret manager. If supported by the script:
+
+    cast wallet import base-launch-deployer --interactive
+
+Never commit `.env`, `.env.local`, seeds, or private keys. `NEXT_PUBLIC_*` is public; keep secrets out of `scaffold.config.ts`.
+
+**Gate 3:** both people independently confirm Base, funded addresses, intended deployer, and no secret in git/profile/history.
+
+## 4. Configure the private production frontend
+
+In `packages/nextjs/scaffold.config.ts` (or equivalent), set the sole production target to Base:
+
+    import { base } from "viem/chains";
+    targetNetworks: [base],
+
+Do not put an RPC/API key in this committed file. Use generated `packages/nextjs/contracts/deployedContracts.ts` for chain 8453, not a component literal. If the project already uses a variable, make `NEXT_PUBLIC_APP_CONTRACT_ADDRESS` the sole validated address source. Ensure wrong-chain blocking, 6-decimal display, gross/fee/net preview, receipt-based success, and useful rejected/reverted/allowance errors.
+
+    yarn workspace @se-2/nextjs build
+
+If the workspace name differs, use the root script that builds `packages/nextjs`.
+
+**Gate 4:** build passes; exactly one contract-address source targets 8453; no localhost setting/private secret is bundled.
+
+## 5. Final deploy preflight
+
+Reviewer compares the final deploy script’s arguments to the worksheet: canonical USDC, fee recipient, owner, 100 bps. Run its exact `--dry-run` if supported; otherwise deploy it against the Base fork again from this final commit. Then:
+
+    cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
+
+Disable any other use of this deployer.
+
+**Gate 5:** final simulation/fork run passes, every input is independently checked, and nonce is expected. If nonce differs, stop, identify the transaction, repeat this phase.
+
+## 6. Deploy and verify—no public site yet
+
+From the same clean checkout:
+
+    yarn deploy --network base
+    yarn verify --network base
+
+Run verify immediately. Keep `packages/foundry/broadcast/`: verification replays its `broadcast/run-latest.json` from this checkout. Record tx hash and contract:
+
+    export APP_CONTRACT='0xDEPLOYED_CONTRACT'
+    cast code "$APP_CONTRACT" --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'owner()(address)' --rpc-url "$BASE_RPC_URL"
+    cast call "$APP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
+
+Substitute actual ABI getters only if needed. Expect nonempty bytecode, canonical USDC, agreed recipient/owner, and 100. Confirm verified explorer source, compiler/settings, constructor args, and proxy implementation (if any) match the release.
+
+Commit generated metadata/config—not private env files:
+
+    git add packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts
+    git commit -m 'deploy: point frontend at Base mainnet tipping contract'
+    git status --short
+
+**Gate 6:** direct reads and verified source match worksheet; committed frontend targets exactly this contract on 8453. Mismatch means no launch: fix/test/redeploy (or documented proxy upgrade).
+
+## 7. Acceptance test live contracts through localhost
+
+From the commit containing Base metadata, without fork/local chain:
+
+    yarn start
+
+In a clean browser profile with FAN_TEST on Base, execute 1.000000 USDC:
+
+1. Verify wrong network is blocked.
+2. Enter CREATOR_TEST; preview must show fee 0.010000 and net 0.990000 USDC.
+3. Approve only needed amount (or approved permit). Spender must be APP_CONTRACT; submit.
+4. Wait for receipt. Verify fan -1,000,000; creator +990,000; fee recipient +10,000 USDC units. Gas is ETH.
+5. Reload; check persistent success/history. Exercise invalid/zero and wrong-network paths.
+
+    cast balance "$FAN_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$CREATOR_TEST" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+    cast balance "$FEE_RECIPIENT" --erc20 "$USDC" --rpc-url "$BASE_RPC_URL"
+
+**Gate 7:** both people independently verify a live receipt, exact 99/1 split, correct spender/address/chain, and failure handling. Otherwise remain private and repeat full fix → regression test → deploy → verify → acceptance.
+
+## 8. Publish frontend
+
+Deploy preview first. For Vercel, from `packages/nextjs`:
+
+    npx vercel login
+    npx vercel link
+    npx vercel env add NEXT_PUBLIC_BASE_RPC_URL production
+    npx vercel --prod
+
+Enter the reviewed Base RPC. If explicit address configuration is used:
+
+    npx vercel env add NEXT_PUBLIC_APP_CONTRACT_ADDRESS production
+
+Enter exact deployed address. Configure custom domain, HTTPS-only, and protected previews in hosting dashboard. Verify once more:
+
+    yarn build
+
+**Gate 8:** host built approved commit; env equals worksheet; domain HTTPS is valid; public bundle contains no localhost configuration/private secret.
+
+## 9. Public smoke test and monitoring
+
+In a fresh profile visit `https://YOUR_DOMAIN`; verify Base 8453, address, and amount; submit one extra tiny FAN_TEST tip; verify receipt/event/99–1 split. Check mobile and another wallet. Then announce URL, verified explorer, contract address, 1% policy, and support contact.
+
+For one hour monitor frontend/RPC errors, reverts, unexpected approvals, events, and creator/fee reconciliation. Record release commit, URL, contract, verification URL, and tx hashes.
+
+**Gate 9:** launch is complete only after the public URL completes the verified real-wallet transaction.
+
+## Incident rules
+
+- Before public launch: stop, preserve evidence, reproduce locally/Base fork, fix source, add regression, redeploy/verify, repoint metadata, repeat phases 6–9. UI-only fixes do not repair contracts.
+- After public launch, wrong chain/address/fee or suspicious behavior: immediately disable tipping controls/site and post support notice. Direct calls remain possible. Invoke pause only if intentionally provided and both people review the exact owner call.
+- Provider outage: switch only to a pre-vetted frontend RPC variable, redeploy frontend, repeat public smoke test—never redeploy contract.
+- Compromised deployer: remove privileges where possible and transfer ownership to Safe/hardware wallet. If immutable ownership cannot be secured, treat as incident and plan redeploy/migration.

tokens used
44,770
```

## final message

Created [LAUNCH.md](/ssd/workspace/eval-workspaces/2026-08-27T180856Z-codex-with-skill-2/orchestration-goal-001/LAUNCH.md).

It provides the ordered Base mainnet launch path, exact commands/config points, independent go/no-go gates, live-money localhost acceptance testing before publication, verification, public smoke tests, and incident handling.
