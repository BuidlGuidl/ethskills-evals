# Production launch runbook — Base USDC tipping app

This is the runbook to use once the application repository is available. It deliberately starts with Base Sepolia, then deploys the **same reviewed commit and bytecode** to Base mainnet. Do not replace a gate with a verbal check.

## Operating rules

* One person is the **operator** (types commands and controls the deployer); the other is the **witness** (reads every address, transaction, and recipient aloud, and records results). Neither person approves their own work unaided.
* Use a hardware wallet or a newly-created dedicated deployer account imported into Foundry's encrypted keystore. Do not paste a production private key into `.env`, a shell history, chat, CI, a hosting provider, or a browser form.
* `BASE_MAINNET_RPC_URL` must be a paid/dedicated RPC endpoint with an SLA; Base's public endpoint is rate-limited and is not a production application RPC. Keep a separate `BASE_SEPOLIA_RPC_URL`.
* All values written as `<LIKE_THIS>` below are required substitutions. Stop if a placeholder remains. Commands assume the standard Foundry Scaffold-ETH 2 layout: `packages/foundry` and `packages/nextjs`. If this repo has different directory or deploy-script names, substitute the discovered path once in the variables section—do not improvise later.
* Never use a faucet, localhost private key, browser burner wallet, or the testnet contract address on mainnet.

## 0. Freeze the release and create the launch record

From the application repository root, on the commit intended for release:

```sh
git switch main
git pull --ff-only
git status --short
git rev-parse HEAD
git switch -c launch/base-mainnet
```

**Gate:** `git status --short` is empty before starting, and the base CI is green. If a dependency lockfile is not committed, stop: repeatable builds are not established. Do **not** tag yet: Sections 1–2 may expose necessary production-configuration changes. The contract release is frozen only after those changes are committed and reviewed in Section 3.

Create a private password-manager entry/shared launch record with these fields, leaving addresses blank for now:

```text
release SHA / tag:
operator / witness:
deployer address:
Safe fee-recipient address and owners/threshold:
Base Sepolia contract / deployment tx / verified URL:
Base mainnet contract / deployment tx / verified URL:
artifact SHA256:
RPC provider and status URL:
production URL / DNS owner:
time of each approval and transaction:
```

## 1. Establish the exact production constants

Create `packages/foundry/.env.launch` locally (it must be ignored by Git; confirm with `git check-ignore -v packages/foundry/.env.launch`). It contains no private key:

```dotenv
BASE_SEPOLIA_RPC_URL=https://<DEDICATED_BASE_SEPOLIA_RPC>
BASE_MAINNET_RPC_URL=https://<DEDICATED_BASE_MAINNET_RPC>
ETHERSCAN_API_KEY=<BASESCAN_API_KEY>
FEE_RECIPIENT=0x<YOUR_GNOSIS_SAFE_ON_BASE>
SEPOLIA_FEE_RECIPIENT=0x<YOUR_CONTROLLED_SEPOLIA_SAFE_OR_TEST_ADDRESS>
BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7c
```

Add (or correct) the following entries in `packages/foundry/foundry.toml`. Preserve the repository's existing `src`, `test`, `libs`, compiler, optimizer, and EVM-version settings; changing them changes the bytecode.

```toml
[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
base_mainnet = "${BASE_MAINNET_RPC_URL}"

[etherscan]
base_sepolia = { key = "${ETHERSCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
base = { key = "${ETHERSCAN_API_KEY}", url = "https://api.basescan.org/api" }
```

Identify the actual contract and script once, then set these shell variables for the rest of this document:

```sh
cd packages/foundry
source .env.launch
forge build
find src script -type f -name '*.sol' | sort
forge inspect <SOURCE_PATH>:<TIP_CONTRACT_NAME> abi > /tmp/tip-abi.json
export TIP_CONTRACT='<SOURCE_PATH>:<TIP_CONTRACT_NAME>'
export DEPLOY_SCRIPT='<SCRIPT_PATH>:<SCRIPT_CONTRACT_NAME>'
```

Read `/tmp/tip-abi.json` and the deployment script together. Record every constructor/initializer argument and every privileged function. In particular record whether the implementation makes the USDC address, fee recipient, and 1% fee immutable; whether funds are forwarded immediately or held for withdrawal; and all owner/pause/upgrade roles. Replace any hard-coded local-fork USDC address with a constructor/config argument. Do not make the frontend choose the USDC address at runtime.

**Mandatory production values:** Base mainnet's native USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; it has 6 decimals. The fee recipient must be a Base-deployed multisig (not either developer's EOA), with the owners and threshold documented. Use its checksummed address. Confirm the token's `symbol`, `decimals`, and `name` directly on the selected RPC:

```sh
cast call "$BASE_USDC" 'symbol()(string)' --rpc-url base_mainnet
cast call "$BASE_USDC" 'name()(string)' --rpc-url base_mainnet
cast call "$BASE_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
cast code "$BASE_USDC" --rpc-url base_mainnet | wc -c
cast chain-id --rpc-url base_mainnet
cast chain-id --rpc-url base_sepolia
```

**Gate:** output is `USDC`, `USD Coin`, `6`, non-empty code, mainnet chain ID `8453`, and Sepolia `84532`. A mismatch means wrong RPC or token—stop. Confirm the USDC address against Circle's official Base address page as a second source before deployment.

## 2. Remove local-only behavior and make the frontend fail closed

In `packages/nextjs/scaffold.config.ts` (or the project's wagmi config), configure production wallets for **Base only** and staging for **Base Sepolia only**. Do not include `localhost`, Anvil, or a burner wallet in production. A safe pattern is:

```ts
// production build configuration
targetNetworks: [chains.base],
```

Use a committed, chain-keyed contract configuration—not an unreviewed environment value—for the deployed contract address and ABI. In the normal Scaffold-ETH 2 generated file this is `packages/nextjs/contracts/deployedContracts.ts`; preserve its generation convention and add/update only the `8453` and `84532` entries from actual deployments. The UI must render its tipping controls only when all of these are true:

1. `chain.id === 8453` (or `84532` in the Sepolia build);
2. the configured tip contract address has bytecode on that same chain;
3. the configured USDC address equals the chain's approved constant; and
4. the contract reads report the expected USDC, fee recipient, and fee rate.

On any failure show a non-transactional message such as “Wrong network/configuration—tipping is unavailable,” and hide/disable both `approve` and `tip`. Never fall back to localhost or send a transaction using a guessed address.

Before allowing a tip, validate a positive amount in **USDC's six-decimal base units**, show “You approve USDC to this contract” with the exact spender address, and show the recipient/creator, gross amount, 1% platform fee, and creator net. Define and test the rounding rule in the UI to exactly match Solidity (for integer math this is normally `fee = amount * 100 / 10_000`; do not display rounded-up cents if the contract rounds down). Refresh token allowance/balance and transaction receipt after every confirmation; handle user rejection, insufficient USDC, insufficient Base ETH, RPC errors, a reverted approval/tip, and replacement transactions without claiming success.

Add a production kill switch that defaults to `false`, e.g. `NEXT_PUBLIC_TIPPING_ENABLED=false`. It must disable the two transaction buttons even if the contract exists. Keep this public variable non-secret and configure it independently for Preview and Production on the host. A server-side/edge kill switch is preferable if the app has server infrastructure; otherwise document that disabling this static variable requires a redeploy.

Add these network and UI tests before proceeding:

* wrong chain and missing contract code disable transactions;
* the app refuses an address other than official Base USDC;
* 1, 99, 100, 101, one USDC (`1_000_000`), and a large amount produce the exact contract fee/net; zero and more than six decimal places are rejected;
* allowance is requested for the tip contract, not the creator or fee Safe; approval rejection and tip revert do not show success;
* displayed fee recipient, creator, and transaction-explorer chain all match the chain configuration.

Select the matching command set from the committed lockfile (exactly one must exist); then run it and its production build:

```sh
cd ../nextjs
# package-lock.json
npm ci && npm test && npm run lint && npm run build
# OR yarn.lock
yarn install --immutable && yarn test && yarn lint && yarn build
# OR pnpm-lock.yaml
pnpm install --frozen-lockfile && pnpm test && pnpm lint && pnpm build
```

**Gate:** no production build references `localhost`, `127.0.0.1`, Anvil chain ID `31337`, a private key, or testnet USDC. Check it:

```sh
rg -n -i 'localhost|127\.0\.0\.1|31337|private.?key|sepolia.*833589|mainnet.*036cbd' .next
```

The command must produce no matches (aside from third-party source maps that contain no executable configuration; inspect any result rather than waive it).

Commit the production-readiness changes now, before auditing or deploying:

```sh
cd ../..
git add packages/foundry/foundry.toml packages/foundry/script packages/foundry/test packages/nextjs
git commit -m 'Prepare Base production configuration and safety checks'
git push -u origin launch/base-mainnet
```

Do not commit `.env.launch`, private keys, API keys, or the local launch record. The witness reviews this commit in a PR.

## 3. Security and release review

Do this before moving a real asset or publishing a mainnet address.

1. Pin the Foundry and Solidity versions used by the launch-branch build: `forge --version`, `solc --version`, `git submodule status`, `forge build --sizes`, and `shasum -a 256 out/<TipContract>.sol/<TipContract>.json`. Put the outputs in the launch record.
2. Run the full suite on a Base mainnet fork, against the native USDC address:

   ```sh
   cd packages/foundry
   source .env.launch
   forge test -vvv --fork-url "$BASE_MAINNET_RPC_URL"
   ```

   Tests must include real-USDC fork cases (use storage deal/whale impersonation only in tests): happy-path transfer split, exact 1% accounting, zero/small/large amounts, fee-on-transfer assumptions, insufficient allowance/balance, USDC returning false/reverting, reentrancy by malicious creator/recipient if any external call is made, duplicate/failed withdrawal if funds are retained, and every privileged function/role.
3. Run static analysis if installed (`slither .` or the repository's security command) and resolve or explicitly document every finding. A compiler warning is a failed gate.
4. Each teammate independently traces the transfer path: fan → contract → creator plus Safe; validates that total received equals total sent and there is no route to change the 1% or redirect fees without the documented multisig authority.
5. Obtain an independent Solidity security review. For a contract holding/funneling user USDC, do not self-certify. The reviewer receives the exact launch-branch SHA, deployment script, compiler settings, and intended constructor arguments. Fix findings, recommit, and repeat this section if bytecode changes.

**Gate:** both reviewers sign the launch record; no unresolved high/critical issues; the deployed configuration is either immutable or its admin/upgrade authority is a documented Safe with a pause/incident policy. If there is no emergency control, explicitly accept that a discovered bug cannot be stopped before mainnet.

Now freeze the audited contract release; all following contract deployments use this exact tag:

```sh
git switch launch/base-mainnet
git status --short
git tag -a v1.0.0-contract -m 'Audited Base contract launch release'
git push origin launch/base-mainnet v1.0.0-contract
git switch --detach v1.0.0-contract
```

**Gate:** the tag's CI is green and its SHA, compiler version, and artifact hash are in the launch record. A change to Solidity, compiler settings, deployment script, or constructor inputs after this point invalidates the tag and requires Sections 3–5 again.

## 4. Create the deployment identities and fund only what is needed

On the operator's secure machine:

```sh
cast wallet new
# Record the printed address only. Store the private key in a hardware wallet/password manager;
# then import it without putting the key in a file:
cast wallet import tip-deployer --interactive
cast wallet address --account tip-deployer
```

Create the fee Safe on Base (same owner set/threshold as approved) and verify its chain is Base. Do a Safe transaction that proves the owners can execute, if it is a new Safe. Fund the deployer with a small Base ETH amount sufficient for deployment plus retry margin, from a controlled account. Do not fund it with USDC and do not reuse it as a fee recipient.

Check the addresses—not only the wallet UI:

```sh
export DEPLOYER=$(cast wallet address --account tip-deployer)
cast balance "$DEPLOYER" --rpc-url base_mainnet
cast balance "$FEE_RECIPIENT" --rpc-url base_mainnet
```

**Gate:** witness compares the printed deployer and Safe addresses character-for-character with the launch record; deployer has Base ETH and no unexpected token balance; Safe is the intended multisig. If the deployment mechanism includes an owner/admin argument, it is the Safe, never the deployer EOA.

## 5. Base Sepolia dress rehearsal

Run this from the immutable release tag. The deployment script must consume explicit `USDC`, `FEE_RECIPIENT`, and optional owner arguments from environment variables or script parameters; inspect it first. If it currently silently uses Anvil defaults, change it and repeat Sections 2–3.

```sh
cd packages/foundry
source .env.launch
export USDC="$BASE_SEPOLIA_USDC"
export DEPLOY_FEE_RECIPIENT="$SEPOLIA_FEE_RECIPIENT"
forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account tip-deployer -vvvv
# The preceding line is simulation only. Read its predicted address, constructor values and gas.
forge script "$DEPLOY_SCRIPT" --rpc-url base_sepolia --account tip-deployer --broadcast --verify -vvvv
```

Copy the emitted contract address and deployment transaction into `SEPOLIA_TIP_CONTRACT` and verify it independently:

```sh
export SEPOLIA_TIP_CONTRACT=0x<PRINTED_DEPLOYED_ADDRESS>
cast code "$SEPOLIA_TIP_CONTRACT" --rpc-url base_sepolia | wc -c
cast call "$SEPOLIA_TIP_CONTRACT" '<USDC_GETTER>()(address)' --rpc-url base_sepolia
cast call "$SEPOLIA_TIP_CONTRACT" '<FEE_RECIPIENT_GETTER>()(address)' --rpc-url base_sepolia
cast call "$SEPOLIA_TIP_CONTRACT" '<FEE_BPS_GETTER>()(uint256)' --rpc-url base_sepolia
```

Substitute the actual public getter signatures discovered in Step 1. **Gate:** bytecode is nonempty, getters return Sepolia USDC, rehearsal fee recipient, and `100`; Basescan shows a verified source and a successful creation transaction. If verification is pending, poll it; if it fails, fix the exact compiler/settings/constructor arguments—do not publish an unverified mainnet contract.

Configure `deployedContracts.ts` with the `84532` address and deploy a Preview environment where `NEXT_PUBLIC_TIPPING_ENABLED=true`, chain list is Base Sepolia only, and no mainnet address exists. Test from two fresh browser wallets with actual Base Sepolia USDC:

1. Fan approves exactly one USDC, tips a creator, and sees one successful on-chain receipt.
2. Check USDC balances before/after: for a 1.000000 USDC tip, creator receives `0.990000` and the rehearsal fee recipient receives `0.010000` (or the exact documented rounding for a non-divisible amount).
3. Re-run with insufficient allowance, insufficient balance, wrong network, rejected wallet signature, and a deliberately disabled kill switch. None may cause a transfer or false success message.
4. Confirm explorer links point to Base Sepolia and no secrets appear in page source, build logs, or browser network requests.

Record the results, UX screenshots, receipt hashes, and the deployment artifact SHA. **Gate:** both people complete the full journey on the hosted preview and all negative tests fail safely. Any Solidity, deployment-script, compiler-setting, or constructor-input change after this gate requires a new contract tag and a new rehearsal.

## 6. Mainnet deployment decision and transaction

Before broadcasting, reconfirm the tag is still the reviewed tag and run a clean build; its artifact hash must equal the recorded rehearsal hash except for deliberately chain-specific constructor arguments. Prepare, but do not broadcast, with mainnet values:

```sh
cd packages/foundry
git status --short
git rev-parse HEAD
source .env.launch
export USDC="$BASE_USDC"
export DEPLOY_FEE_RECIPIENT="$FEE_RECIPIENT"
forge build
shasum -a 256 out/<TipContract>.sol/<TipContract>.json
forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account tip-deployer -vvvv
```

The witness compares the simulation's chain (`8453`), deployer, USDC, Safe, 100 bps, constructor arguments, contract creation bytecode/hash, predicted address, and maximum gas cost to the launch record. Check the RPC status page and current Base explorer before sending. Only then broadcast once:

```sh
forge script "$DEPLOY_SCRIPT" --rpc-url base_mainnet --account tip-deployer --broadcast --verify -vvvv
```

Do not rerun a timed-out broadcast blindly. First find the transaction by deployer nonce on BaseScan / `cast nonce "$DEPLOYER" --rpc-url base_mainnet`; use Foundry's generated `broadcast/` transaction file and the same nonce to determine whether it is pending, mined, or absent. Escalate to the RPC provider if unknown.

**Immediate post-deploy gate:** wait for the creation receipt and sufficient Base finality per your incident policy, then verify:

```sh
export MAINNET_TIP_CONTRACT=0x<PRINTED_DEPLOYED_ADDRESS>
cast code "$MAINNET_TIP_CONTRACT" --rpc-url base_mainnet | wc -c
cast call "$MAINNET_TIP_CONTRACT" '<USDC_GETTER>()(address)' --rpc-url base_mainnet
cast call "$MAINNET_TIP_CONTRACT" '<FEE_RECIPIENT_GETTER>()(address)' --rpc-url base_mainnet
cast call "$MAINNET_TIP_CONTRACT" '<FEE_BPS_GETTER>()(uint256)' --rpc-url base_mainnet
cast call "$BASE_USDC" 'decimals()(uint8)' --rpc-url base_mainnet
```

Values must be nonempty code, `BASE_USDC`, fee Safe, `100`, and `6`. Open both creation and verification pages on BaseScan. Record the address, tx hash, block number, verified-source URL, compiler settings, and ownership/admin state. If any value is wrong, **do not point a frontend at it**: leave tipping disabled, publish nothing, and use the pre-agreed pause/incident process; deployment is immutable and cannot be “corrected” by editing a frontend setting.

## 7. Build and release the public frontend

Update the chain-keyed generated frontend contract config with `MAINNET_TIP_CONTRACT` under chain `8453`; configure its USDC constant to `BASE_USDC`; retain the Sepolia entry only for preview builds. Commit these source/configuration changes to a release branch and get the witness's PR approval:

```sh
cd packages/nextjs
git switch launch/base-mainnet
git add contracts/deployedContracts.ts scaffold.config.ts <OTHER_CHANGED_CONFIG_FILES>
git commit -m 'Configure Base mainnet tipping deployment'
git tag -a v1.0.0-web -m 'Base mainnet web release'
git push origin launch/base-mainnet v1.0.0-web
```

Use Vercel for the public Next.js host (or an equivalent host with Preview and Production environments). In Vercel, import the Git repository; set `packages/nextjs` as Root Directory; set production branch to `main`; attach the custom production domain; and require repository CI/deployment checks. Add these **Production** environment variables in the dashboard, never a deployer secret:

```dotenv
NEXT_PUBLIC_TIPPING_ENABLED=false
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_TIP_CONTRACT=0x<MAINNET_TIP_CONTRACT> # only if the app requires it; source config is preferred
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 # only if the app requires it
NEXT_PUBLIC_RPC_URL=https://<DEDICATED_READONLY_BASE_RPC>
```

Set separate Preview variables to Base Sepolia and its contract. Do not set production to mainnet until the Preview test passes. Configure security headers at the host or in `next.config.js`: HTTPS only, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP that permits only required wallet/RPC origins. Do not use `unsafe-eval`/wildcard `connect-src` unless justified and tested. Add the domain's DNS records exactly as Vercel shows, enable automatic TLS, and verify HTTPS before release.

Deploy the `launch/base-mainnet` branch as a Preview. With a test wallet, first prove mainnet controls are disabled; then inspect the Preview page source/configuration and test the same chain-mismatch and kill-switch behavior. Merge to `main` only after the witness approves that Preview. Vercel will create the Production build; use its dashboard/CLI to ensure it used the approved `v1.0.0-web` SHA.

Before enabling real tips, visit the production custom URL from a clean browser profile and test connect/disconnect, Base network switching, responsive layout, and all read-only creator pages. Confirm the favicon/site metadata/domain have no staging wording and the custom domain has a valid certificate. Watch build/runtime logs for errors.

**Gate:** production serves the verified SHA, displays the mainnet contract/Safe correctly, has no secret in its JavaScript, and the UI will not create a transaction while the kill switch is false.

## 8. Controlled enablement and public launch

Turn on `NEXT_PUBLIC_TIPPING_ENABLED=true` in **Production** and trigger a new production deployment. If the value is compiled at build time (as Next.js public variables normally are), changing it alone does not change the currently served JavaScript: verify the new deployment SHA and inspect its loaded JS/config. Wait for the domain to serve that deployment.

Conduct a capped mainnet canary before announcing the URL:

1. Fan wallet holds a deliberately small amount of Base USDC and ETH. Tip a team-controlled creator `1.000000` USDC.
2. On BaseScan and with `cast call` to `balanceOf`, verify creator +`0.990000` USDC and fee Safe +`0.010000` USDC, exactly once. Verify the app's receipt link and amount display.
3. Use a second wallet to test rejected approval, insufficient allowance, wrong chain, and a second small successful tip. Check that no approvals are made to any address except `MAINNET_TIP_CONTRACT`.
4. Check the fee Safe has received funds and requires its configured threshold to move them; do not attempt a withdrawal unless that is an intended, reviewed user flow.

If any canary check differs, immediately set the production kill switch false and redeploy (and call the contract pause function through the Safe if available). Post no announcement. Preserve transaction hashes and investigate from the chain state first.

When all canaries pass, announce the custom HTTPS URL, Base network requirement, the verified contract address/BaseScan link, native USDC requirement, 1% fee, fee-recipient policy, and a support/incident contact. Never ask users to send USDC directly to the contract address; the UI is the supported path.

## 9. First-week operation, monitoring, and rollback

For the first 72 hours, one teammate owns a daily check (and both are paged for alerts): hosted uptime/error rate, RPC error/latency/rate-limit signals, failed/reverted tip rate, contract `Tip`/fee events compared with UI success logs, USDC balance changes at the fee Safe, unexpected approvals, and Base/RPC-provider status. Set alerts for frontend 5xx/JS error spikes, RPC failures, failed transactions above the agreed baseline, any privileged contract event, and any fee-recipient/implementation/admin change.

Reconcile daily from chain events, not only application analytics: total gross tips = creators' net receipts + Safe fees + any explicitly documented dust/rounding. An unexplained difference is an incident.

The rollback order is:

1. Disable tipping in the host and redeploy; verify from a clean browser that buttons are disabled.
2. If the contract has a reviewed pause, execute it through the Safe and verify the pause state onchain.
3. Preserve logs, deployment artifacts, receipt hashes, and affected addresses; do not delete or overwrite evidence.
4. Tell users the service is paused, with no speculation; do not ask them to retry or approve again.
5. Fix on a branch, repeat the entire Sepolia rehearsal and review for any bytecode/config change, deploy a new mainnet contract only after the same gates, and migrate only through an explicitly reviewed user-facing plan.

The frontend can be rolled back in Vercel to the last known-good deployment, but that cannot undo an onchain transaction or a published immutable contract. Keeping the kill switch off by default on every new environment is the primary containment mechanism.

## Authoritative references

Network IDs/endpoints and the warning that Base public RPC is rate-limited: [Base network connection guide](https://docs.base.org/base-chain/quickstart/connecting-to-base). Foundry Base configuration/deployment/verification example: [Base deployment guide](https://docs.base.org/get-started/deploy-smart-contracts). Foundry keystore and verification behavior: [Foundry deployment docs](https://getfoundry.sh/forge/deploying). Vercel Preview/Production behavior: [Vercel environments](https://vercel.com/docs/deployments/environments) and [CLI deployment guide](https://vercel.com/docs/projects/deploy-from-cli). Confirm native USDC addresses immediately before launch using [Circle's official supported-blockchains documentation](https://developers.circle.com/stablecoins/usdc-on-main-networks).
