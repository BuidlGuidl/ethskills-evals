# Launch Runbook: Creator Tipping on Base

This is the ordered path from "working on a local Base fork" to "real users can tip creators with USDC on a public URL." Follow it in order. Do not skip the Base Sepolia rehearsal: it is where we catch live-network, wallet, explorer, env, and frontend-public-URL mistakes before mainnet funds are involved.

Assumptions:

- Repo is Scaffold-ETH 2, Foundry flavor.
- Contracts live in `packages/foundry`.
- Frontend lives in `packages/nextjs`.
- Fans tip in native Circle USDC on Base, not bridged USDbC.
- Production chain is Base mainnet, chain ID `8453`.
- Staging chain is Base Sepolia, chain ID `84532`.
- Native Base USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Base Sepolia test USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- USDC has `6` decimals. All code, tests, UI formatting, and deployment args must use 6 decimals.

## 0. Team Roles and Stop Rules

Pick one deployer and one reviewer for the whole launch.

- Deployer: runs commands, controls deployer wallet, owns env files.
- Reviewer: watches terminal output, checks diffs, verifies addresses, performs wallet QA.

Stop immediately if any of these happen:

- A private key, RPC key, WalletConnect project ID, or API token appears in `git diff`, terminal scrollback intended for sharing, screenshots, issue comments, or chat.
- A deployed contract constructor arg, owner, fee recipient, USDC address, fee bps, or chain ID is different from the expected value.
- The frontend public URL points at any chain other than the intended chain for that stage.
- A real transaction moves more than the planned smoke-test amount.

## 1. Prepare the Repo

Start from a clean branch.

```bash
git checkout main
git pull --ff-only
git checkout -b launch/base-production
yarn install --immutable
git status --short
```

Gate before continuing:

- `git status --short` shows only intentional changes.
- `yarn install --immutable` succeeds.
- Both people know which local checkout is the source of truth for launch.

How we catch problems:

- If install fails, fix dependency or lockfile drift before touching deployment config.
- If the branch has unrelated changes, stop and split them out. Launch changes should be easy to audit.

## 2. Confirm Production Constants

Create a launch constants note in the PR description or team doc. Do not put secrets in it.

```text
Base mainnet chain ID: 8453
Base mainnet RPC fallback: https://mainnet.base.org
Base mainnet explorer: https://basescan.org
Base native USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Base Sepolia chain ID: 84532
Base Sepolia RPC fallback: https://sepolia.base.org
Base Sepolia explorer: https://sepolia.basescan.org
Base Sepolia test USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
USDC decimals: 6
Platform fee: 100 bps
Production fee recipient: <PLATFORM_FEE_RECIPIENT_ADDRESS>
Contract owner/admin: <OWNER_OR_MULTISIG_ADDRESS>
```

Use `cast` to verify token metadata on both live networks.

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url https://mainnet.base.org
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" --rpc-url https://mainnet.base.org
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "symbol()(string)" --rpc-url https://sepolia.base.org
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "decimals()(uint8)" --rpc-url https://sepolia.base.org
```

Expected:

- Both `symbol()` calls return `USDC`.
- Both `decimals()` calls return `6`.

Gate before continuing:

- The reviewer confirms the constants.
- The production fee recipient is a wallet or multisig the team controls.
- The owner/admin address is not an individual hot wallet unless the team has explicitly accepted that risk.

How we catch problems:

- If `symbol()` or `decimals()` fails, the RPC is bad or the address is wrong. Do not deploy.
- If the app uses `parseEther`, `formatEther`, or `1e18` for USDC amounts, fix that before continuing.

```bash
rg "parseEther|formatEther|1e18|10\\s*\\*\\*\\s*18|ether" packages/foundry packages/nextjs
```

Allowed matches must be unrelated to USDC amounts, such as ETH gas display.

## 3. Secret Hygiene Before Any Live Network Work

Confirm secrets are ignored.

```bash
printf '\n# local secrets\n.env\n.env.*\n!.env.example\n*.key\nbroadcast/\ncache/\n' >> .gitignore
git diff -- .gitignore
```

If the lines already exist, revert the duplicate edit manually and keep one copy.

Create or update root `.env` for Foundry/deployment. Never commit it.

```bash
cp .env.example .env 2>/dev/null || touch .env
$EDITOR .env
```

Root `.env` must contain real values:

```bash
DEPLOYER_PRIVATE_KEY=<PRIVATE_KEY_WITHOUT_0x_IF_YOUR_SE2_TEMPLATE_EXPECTS_THAT>
BASE_RPC_URL=<PRIVATE_RPC_URL_FOR_BASE_MAINNET>
BASE_SEPOLIA_RPC_URL=<PRIVATE_RPC_URL_FOR_BASE_SEPOLIA>
BASESCAN_API_KEY=<BASESCAN_API_KEY_IF_VERIFY_REQUIRES_ONE>
ETHERSCAN_API_KEY=<SAME_AS_BASESCAN_API_KEY_IF_THE_VERIFY_SCRIPT_READS_ETHERSCAN_API_KEY>
```

Create or update frontend local env.

```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || touch packages/nextjs/.env.local
$EDITOR packages/nextjs/.env.local
```

`packages/nextjs/.env.local` must contain:

```bash
NEXT_PUBLIC_BASE_RPC_URL=<PUBLIC_OR_RATE_LIMITED_BASE_RPC_URL>
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=<PUBLIC_OR_RATE_LIMITED_BASE_SEPOLIA_RPC_URL>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
```

Security scan before continuing:

```bash
git status --short
git diff -- .gitignore
git diff --cached --name-only
rg -n "PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|BASE_RPC_URL|BASE_SEPOLIA_RPC_URL|BASESCAN_API_KEY|ETHERSCAN_API_KEY|WALLET_CONNECT|g.alchemy.com/v2/|infura.io/v3/|0x[a-fA-F0-9]{64}" .
```

Expected:

- `.env` and `packages/nextjs/.env.local` are not shown as tracked changes.
- The `rg` command may find variable names in examples or docs, but must not reveal actual secret values.

Gate before continuing:

- Reviewer confirms no secret value appears in Git output.
- Deployer confirms deployer wallet private key is new or otherwise isolated from personal funds.

How we catch problems:

- If a secret appears in a tracked file, remove it, rotate that secret, and restart this step.
- If the deployer private key has ever been committed or pasted into a shared tool, discard it and create a new deployer.

## 4. Configure Networks

Update `packages/foundry/foundry.toml`. Add missing RPC endpoints only; keep existing project settings.

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
baseSepolia = "${BASE_SEPOLIA_RPC_URL}"
```

If the repo's verification setup needs explicit explorer config, add this too:

```toml
[etherscan]
base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
baseSepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
```

Update `packages/nextjs/scaffold.config.ts`.

Required imports:

```ts
import { base, baseSepolia } from "viem/chains";
```

For staging, set:

```ts
targetNetworks: [baseSepolia],
pollingInterval: 30000,
burnerWalletMode: "localNetworksOnly",
rpcOverrides: {
  [baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
},
```

For production later, this will become:

```ts
targetNetworks: [base],
pollingInterval: 30000,
burnerWalletMode: "localNetworksOnly",
rpcOverrides: {
  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
},
```

If the config already has `alchemyApiKey`, leave it env-based. Do not paste API keys into `scaffold.config.ts`.

Gate before continuing:

- `targetNetworks` contains exactly one live target for the current stage.
- `burnerWalletMode` is `"localNetworksOnly"`.
- `rpcOverrides` reads from `process.env` and has a public fallback.
- No live API key is committed.

How we catch problems:

```bash
rg -n "targetNetworks|burnerWalletMode|rpcOverrides|alchemyApiKey" packages/nextjs/scaffold.config.ts
rg -n "g.alchemy.com/v2/[A-Za-z0-9_-]+|infura.io/v3/[A-Za-z0-9_-]+|PRIVATE_KEY|0x[a-fA-F0-9]{64}" packages
```

The second command must not reveal secrets.

## 5. Parameterize Deployment for USDC and Fees

Find the deploy script.

```bash
ls packages/foundry/script
rg -n "new .*\\(|USDC|fee|owner|platform|recipient|100" packages/foundry/script packages/foundry/contracts
```

The deploy script must derive chain-specific values from `block.chainid`, not from manual edits right before deployment.

Use this pattern in the relevant `packages/foundry/script/*.s.sol` file, adapted to the actual contract name and constructor:

```solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
uint16 constant PLATFORM_FEE_BPS = 100;

function _usdcForChain() internal view returns (address) {
    if (block.chainid == 8453) return BASE_USDC;
    if (block.chainid == 84532) return BASE_SEPOLIA_USDC;
    revert("Unsupported chain");
}
```

Deployment must pass:

```solidity
address usdc = _usdcForChain();
address feeRecipient = vm.envAddress("PLATFORM_FEE_RECIPIENT");
address owner = vm.envAddress("OWNER_ADDRESS");

// Example only; replace CreatorTips with the real contract/constructor.
CreatorTips tips = new CreatorTips(usdc, feeRecipient, PLATFORM_FEE_BPS, owner);
```

Add to root `.env`:

```bash
PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT_ADDRESS>
OWNER_ADDRESS=<OWNER_OR_MULTISIG_ADDRESS>
```

Add a deployment invariant test if it does not exist:

```bash
rg -n "fee|bps|USDC|owner|constructor" packages/foundry/test
```

Required test coverage:

- Constructor rejects unsupported zero addresses.
- Fee bps is exactly `100`.
- Tip amount uses 6-decimal USDC units.
- Fee calculation sends 1% to the fee recipient and 99% to the creator.
- Rounding behavior is explicit for small tips.
- Non-standard or failing ERC20 transfers cannot produce false success.
- Owner/admin-only functions are covered.

Gate before continuing:

- The deploy script cannot accidentally deploy Base mainnet with Base Sepolia USDC.
- The deploy script cannot deploy to unknown chain IDs.
- Fee recipient and owner come from env or a reviewed constant, not from an unreviewed hot-wallet default.

How we catch problems:

```bash
yarn compile
yarn foundry:test
```

Both must pass.

## 6. Re-run Local Fork as Final Baseline

Use a fresh local fork of Base mainnet.

Terminal 1:

```bash
yarn fork --network base
```

Terminal 2:

```bash
yarn deploy
yarn start
```

In the browser:

- Connect a wallet to localhost.
- Confirm the app asks for Base fork/local network as expected.
- Tip a creator with a small forked USDC amount.
- Confirm approval is exact or bounded, not infinite.
- Confirm the UI shows one action button at a time: switch network, approve USDC, then tip.
- Confirm creator receives 99% and fee recipient receives 1%.
- Confirm transaction success and failure notifications are readable.

Gate before continuing:

- Full local journey passes on a fresh fork.
- No console errors.
- No broken mobile layout in browser responsive mode.

How we catch problems:

- Any contract behavior bug returns to tests in Step 5.
- Any wallet or UI bug is fixed before deploying to a live network.

## 7. Create and Fund the Live Deployer

Generate or import the deployer using the repo's SE2 account scripts.

For a new isolated deployer:

```bash
yarn generate
yarn account
```

For an existing isolated deployer:

```bash
yarn account:import
yarn account
```

Record the deployer public address only:

```bash
export DEPLOYER_ADDRESS=<DEPLOYER_PUBLIC_ADDRESS>
cast balance "$DEPLOYER_ADDRESS" --rpc-url https://sepolia.base.org
cast balance "$DEPLOYER_ADDRESS" --rpc-url https://mainnet.base.org
```

Fund it in this order:

1. Base Sepolia ETH for staging gas.
2. Base mainnet ETH for production deployment and smoke tests.
3. A small amount of Base mainnet native USDC for production smoke testing, held in a separate tester wallet, not necessarily the deployer.

Gate before continuing:

- Deployer has enough Base Sepolia ETH.
- Deployer has enough Base mainnet ETH.
- Tester wallet has enough Base mainnet ETH for gas and a tiny amount of native USDC.
- Reviewer checks the explorer for both balances.

How we catch problems:

```bash
cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast chain-id --rpc-url "$BASE_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Expected chain IDs: `84532` and `8453`.

## 8. Deploy to Base Sepolia

Make sure `packages/nextjs/scaffold.config.ts` is still set to `targetNetworks: [baseSepolia]`.

Compile and test immediately before deploying.

```bash
yarn compile
yarn foundry:test
yarn deploy --network baseSepolia
```

Capture the deployed contract address from terminal output and from `packages/nextjs/contracts/deployedContracts.ts`.

```bash
git diff -- packages/nextjs/contracts/deployedContracts.ts
rg -n "84532|Creator|Tip|USDC|address" packages/nextjs/contracts/deployedContracts.ts
```

Verify the contract.

```bash
yarn verify --network baseSepolia
```

If verification asks for or fails because of an explorer API key, set `BASESCAN_API_KEY` and `ETHERSCAN_API_KEY` in root `.env`, confirm they are not committed, then rerun the same command.

Read deployment state onchain. Replace `<CONTRACT_ADDRESS>` and function names with the actual contract API.

```bash
export STAGING_CONTRACT=<CONTRACT_ADDRESS>
cast call "$STAGING_CONTRACT" "usdc()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$STAGING_CONTRACT" "platformFeeBps()(uint16)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$STAGING_CONTRACT" "feeRecipient()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$STAGING_CONTRACT" "owner()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected:

- `usdc()` is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- `platformFeeBps()` is `100`.
- `feeRecipient()` is the reviewed staging fee recipient.
- `owner()` is the reviewed owner/admin.
- Source is verified on Sepolia BaseScan.

Gate before continuing:

- Contract is deployed, verified, and has correct constructor/config values.
- `deployedContracts.ts` contains chain ID `84532`.
- Reviewer independently opens the contract on `https://sepolia.basescan.org`.

How we catch problems:

- If constructor/config values are wrong, do not use this deployment. Fix deploy script/tests and redeploy to a new address.
- If `deployedContracts.ts` did not update, the frontend will point at the wrong address. Stop and fix deployment artifact generation.

## 9. Test Base Sepolia Contract with Local UI

Run the frontend locally against the Base Sepolia deployment.

```bash
yarn start
```

Open `http://localhost:3000`.

Wallet QA:

- Connect MetaMask or Rabby.
- Switch to Base Sepolia.
- Use Circle faucet test USDC for the tester wallet.
- Tip a test creator.
- Reject an approval and confirm the app handles it cleanly.
- Approve and tip.
- Refresh and confirm event/history/balances update.

Onchain checks:

```bash
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "balanceOf(address)(uint256)" <CREATOR_ADDRESS> --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call 0x036CbD53842c5426634e7929541eC2318f3dCF7e "balanceOf(address)(uint256)" <FEE_RECIPIENT_ADDRESS> --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Gate before continuing:

- UI works with a real browser wallet on Base Sepolia.
- Approval/tip transaction sequence works.
- Creator and fee recipient balances change as expected.
- Failed/rejected transactions do not leave the UI stuck.
- No console errors.

How we catch problems:

- If wallet connection works locally but reads fail, check `targetNetworks`, `rpcOverrides`, and `deployedContracts.ts`.
- If approval succeeds but tip fails, check allowance amount, USDC decimals, recipient registration, and contract revert reason.

## 10. Deploy a Staging Public Frontend

Keep frontend target on Base Sepolia for this step.

Build locally first.

```bash
yarn lint
yarn next:build
```

Deploy staging to the chosen host.

Vercel staging:

```bash
yarn vercel
```

IPFS staging, only if the app is fully static and has no API routes/server actions required at runtime:

```bash
yarn ipfs
```

Set staging host environment variables:

```bash
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=<PUBLIC_OR_RATE_LIMITED_BASE_SEPOLIA_RPC_URL>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
```

If using Vercel, set them in the project dashboard or CLI, then redeploy.

```bash
vercel env pull packages/nextjs/.env.vercel.local
yarn vercel
```

Gate before continuing:

- Staging URL loads publicly.
- Wallet connects from the public URL.
- Public URL targets Base Sepolia only.
- Test tip works from the public URL.
- No burner wallet appears.
- No console errors.
- Mobile viewport is usable.

How we catch problems:

- If it works locally but not on public URL, compare local `.env.local` to host env settings.
- If WalletConnect fails only on public URL, check allowed domains/project settings in WalletConnect.
- If the app points to localhost RPC, a build-time env or config fallback is wrong.

## 11. Mainnet Readiness Review

Open a PR containing all launch changes except uncommitted env files.

```bash
git status --short
git diff --stat
git diff -- packages/foundry packages/nextjs .gitignore
```

Run the full pre-mainnet suite.

```bash
yarn compile
yarn foundry:test
yarn lint
yarn next:build
```

Run secret scans.

```bash
rg -n "PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|BASE_RPC_URL|BASE_SEPOLIA_RPC_URL|BASESCAN_API_KEY|ETHERSCAN_API_KEY|WALLET_CONNECT|g.alchemy.com/v2/|infura.io/v3/|0x[a-fA-F0-9]{64}" .
git diff --cached --name-only | grep -Ei "\\.env|key|secret|private" || true
```

Reviewer checklist:

- Contract fee is 1% exactly.
- Fee recipient is correct.
- Owner/admin is correct.
- Native Base USDC address is used for Base mainnet.
- Base Sepolia USDC address is used only for Base Sepolia.
- No infinite approval is requested.
- Frontend does not expose test-only copy, localhost RPCs, or local contract addresses.
- Burner wallet is disabled outside local networks.
- Metadata is production-ready in `packages/nextjs/app/layout.tsx` or equivalent.
- App title, description, favicon, and Open Graph image are real.
- Support/contact path exists for users.
- Terms/risk copy is present if the app takes fees from user payments.

Gate before continuing:

- PR approved by the reviewer.
- All commands pass.
- No high/medium launch blocker remains open.

How we catch problems:

- Any contract issue returns to Step 5 and repeats Base Sepolia deployment.
- Any frontend issue returns to Step 9 and repeats staging public QA.

## 12. Switch Config to Base Mainnet

Update `packages/nextjs/scaffold.config.ts` from Base Sepolia to Base mainnet:

```ts
import { base } from "viem/chains";

targetNetworks: [base],
pollingInterval: 30000,
burnerWalletMode: "localNetworksOnly",
rpcOverrides: {
  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
},
```

If both `base` and `baseSepolia` imports remain because other code needs them, that is fine. `targetNetworks` must contain only `base` for production.

Check the diff.

```bash
git diff -- packages/nextjs/scaffold.config.ts
rg -n "baseSepolia|84532|sepolia" packages/nextjs packages/foundry
```

Expected:

- `baseSepolia` may still appear in deploy-script chain selection or historical deployment artifacts.
- Production frontend config must not target Base Sepolia.

Gate before continuing:

- Reviewer confirms production config points at Base mainnet.
- Secrets still do not appear in diffs.

## 13. Deploy to Base Mainnet

Final preflight:

```bash
cast chain-id --rpc-url "$BASE_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
yarn compile
yarn foundry:test
```

Expected chain ID: `8453`.

Deploy:

```bash
yarn deploy --network base
```

Capture the deployed address.

```bash
git diff -- packages/nextjs/contracts/deployedContracts.ts
rg -n "8453|Creator|Tip|USDC|address" packages/nextjs/contracts/deployedContracts.ts
```

Verify immediately:

```bash
yarn verify --network base
```

If verification asks for or fails because of an explorer API key, set `BASESCAN_API_KEY` and `ETHERSCAN_API_KEY` in root `.env`, confirm they are not committed, then rerun the same command.

Read mainnet deployment state. Replace `<CONTRACT_ADDRESS>` and function names with the actual contract API.

```bash
export PRODUCTION_CONTRACT=<CONTRACT_ADDRESS>
cast call "$PRODUCTION_CONTRACT" "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$PRODUCTION_CONTRACT" "platformFeeBps()(uint16)" --rpc-url "$BASE_RPC_URL"
cast call "$PRODUCTION_CONTRACT" "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$PRODUCTION_CONTRACT" "owner()(address)" --rpc-url "$BASE_RPC_URL"
```

Expected:

- `usdc()` is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- `platformFeeBps()` is `100`.
- `feeRecipient()` is the reviewed production fee recipient.
- `owner()` is the reviewed owner/admin.
- Source is verified on `https://basescan.org`.
- `deployedContracts.ts` contains chain ID `8453` and the production address.

Gate before continuing:

- Mainnet contract is correct and verified.
- Reviewer independently opens the address on BaseScan.
- Contract address is recorded in the launch notes.

How we catch problems:

- If constructor/config values are wrong, do not launch the frontend. Fix and redeploy a new contract.
- If verification fails because constructor args do not match, verify the deployed bytecode and deployment script before proceeding.
- If deployer balance is unexpectedly low or there are unknown transactions, stop and investigate the deployer key.

## 14. Mainnet Contract Smoke Test with Local UI

Run local frontend against the mainnet deployment before making any public URL point at it.

```bash
yarn start
```

Open `http://localhost:3000`.

Use a tester wallet with a tiny amount of native Base USDC and Base ETH.

Smoke test:

1. Connect wallet.
2. Confirm wallet network is Base mainnet.
3. Confirm UI displays the production contract address if the app has a debug/about panel.
4. Tip a test creator with the smallest product-acceptable amount, for example `0.10` USDC.
5. Confirm approval amount is exact or bounded.
6. Confirm creator receives 99%.
7. Confirm fee recipient receives 1%.
8. Confirm events/history update.

Onchain checks:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <CREATOR_ADDRESS> --rpc-url "$BASE_RPC_URL"
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <FEE_RECIPIENT_ADDRESS> --rpc-url "$BASE_RPC_URL"
```

Gate before continuing:

- Mainnet smoke tip succeeds.
- Amounts are correct to 6 decimals.
- UI does not show staging labels, Sepolia, faucet language, burner wallet, or debug-only controls.
- No console errors.

How we catch problems:

- If smoke test fails, do not deploy production frontend. Fix locally against mainnet contract, then repeat this step.
- If funds moved incorrectly, pause launch and assess whether a new contract deployment is required.

## 15. Deploy Production Frontend

Build production locally.

```bash
yarn lint
yarn next:build
```

Set production host environment variables:

```bash
NEXT_PUBLIC_BASE_RPC_URL=<PUBLIC_OR_RATE_LIMITED_BASE_RPC_URL>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
```

Deploy with the chosen host.

Vercel production:

```bash
yarn vercel:yolo --prod
```

If the repo uses plain Vercel scripts instead:

```bash
yarn vercel --prod
```

IPFS production, only if the app is fully static and does not need server runtime:

```bash
yarn ipfs
```

Record:

```text
Production URL: <PUBLIC_URL>
Production contract: <PRODUCTION_CONTRACT>
BaseScan: https://basescan.org/address/<PRODUCTION_CONTRACT>
Commit SHA: <COMMIT_SHA>
Deployment time: <UTC_TIMESTAMP>
```

Gate before continuing:

- Public URL loads.
- Public URL is the production URL intended for users.
- Host env vars are set in the production environment, not only preview/staging.
- The deployed frontend was built from the reviewed commit.

How we catch problems:

- If the public URL shows old code, check host deployment commit SHA and redeploy.
- If RPC calls fail in production only, check host env vars and RPC provider domain restrictions.

## 16. Production QA on Public URL

Run this on the public production URL, not localhost.

Desktop wallet matrix:

- MetaMask on Base mainnet.
- Rabby or Coinbase Wallet on Base mainnet.
- WalletConnect mobile wallet if supported by the app.

QA flow:

1. Load public URL in a private/incognito browser.
2. Confirm no console errors on first load.
3. Connect wallet.
4. If wallet starts on the wrong chain, confirm the app shows "Switch Network" before any approval/tip action.
5. Switch to Base.
6. Confirm the app shows "Approve USDC" only when allowance is insufficient.
7. Reject approval; app recovers.
8. Approve exact or bounded amount.
9. Tip a real test creator with a tiny amount.
10. Confirm success notification links to the BaseScan transaction.
11. Refresh the page; balances/history still show correctly.
12. Test mobile viewport at 390px width.
13. Paste production URL into a social preview checker; title/image/description are correct.

Onchain confirmation:

```bash
cast receipt <TIP_TX_HASH> --rpc-url "$BASE_RPC_URL"
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <CREATOR_ADDRESS> --rpc-url "$BASE_RPC_URL"
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <FEE_RECIPIENT_ADDRESS> --rpc-url "$BASE_RPC_URL"
```

Gate before announcing:

- Two team members can complete the flow from the public URL.
- At least one test uses a wallet that did not deploy the contract.
- No console errors.
- No user-facing staging/test labels.
- No unexpected contract approvals.
- BaseScan verified contract link is public.

How we catch problems:

- If only one wallet fails, capture wallet, browser, chain, tx hash, and console error before fixing.
- If all wallets fail reads, suspect frontend env/RPC/deployedContracts.
- If writes fail, suspect allowance, chain mismatch, contract config, paused state, or USDC amount conversion.

## 17. Cutover and Announcement

Only after Step 16 passes:

```bash
git status --short
git add .gitignore packages/foundry packages/nextjs
git diff --cached --stat
git diff --cached --name-only | grep -Ei "\\.env|key|secret|private" && exit 1 || true
git commit -m "Launch creator tipping app on Base"
git push origin launch/base-production
```

Merge using the team's normal protected-branch process.

If the production host deploys from `main`, confirm the post-merge deployment URL is the same intended production URL and repeat a tiny public-URL smoke test.

Announcement checklist:

- Public URL.
- BaseScan verified contract URL.
- Native Base USDC only; warn users not to send USDbC or tokens directly to the contract unless the app explicitly supports recovery.
- Minimum supported wallet/network instructions.
- Support/contact channel.

Gate:

- Announcement links are checked by both team members.
- Public URL still passes connect/read/write smoke test after merge.

## 18. First 24 Hours of Monitoring

Keep a shared launch log with timestamps, tx hashes, and issues.

Every 30 minutes for the first 2 hours, then every few hours for 24 hours:

```bash
cast block-number --rpc-url "$BASE_RPC_URL"
cast call "$PRODUCTION_CONTRACT" "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$PRODUCTION_CONTRACT" "platformFeeBps()(uint16)" --rpc-url "$BASE_RPC_URL"
```

Also check:

- Host analytics or logs for frontend errors.
- RPC provider dashboard for rate limits.
- WalletConnect dashboard for connection errors.
- BaseScan contract transactions for failed or suspicious patterns.
- Fee recipient USDC balance.
- Support channel for user reports.

If the contract has pause controls and a severe issue appears:

```bash
cast send "$PRODUCTION_CONTRACT" "pause()" --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$BASE_RPC_URL"
```

Only use the exact pause command if the production contract has that API and the deployer/admin is authorized. Otherwise use the repo's admin script. Record the tx hash and immediately update the public status/support channel.

Severity guide:

- Critical: funds at risk, wrong fee recipient, wrong token, unauthorized withdrawals, repeated failed tips after approval. Pause if available; remove public links; investigate.
- High: public URL cannot complete tips for most users. Roll back frontend to last working deployment if contract is sound.
- Medium: one wallet/browser has issues. Add a known issue and patch normally.
- Low: copy/layout/metadata bug. Patch normally.

## 19. Rollback Rules

Frontend rollback:

- Safe when contract is correct and only UI/env/static assets are wrong.
- Use the host's previous deployment rollback or redeploy the last known good commit.
- After rollback, repeat Step 16 read/connect/tiny-tip smoke test.

Contract rollback:

- Contracts are not rolled back. Deploy a new fixed contract.
- Update `deployedContracts.ts` through `yarn deploy --network base`.
- Verify the new contract.
- Repeat Steps 13 through 16.
- Publicly mark the old contract as deprecated in docs/support channels.

Do not:

- Reuse a known-bad contract address.
- Hot-edit `deployedContracts.ts` by hand.
- Point production frontend at an unverified contract.
- Ask users to approve or send USDC while the team is unsure which contract is canonical.

## 20. Source Links Checked While Writing This Runbook

- Base chain ID docs: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Circle Base USDC announcement and native-vs-bridged addresses: https://www.circle.com/blog/usdc-now-available-natively-on-base
- Circle testnet faucet: https://faucet.circle.com/
- Scaffold-ETH 2 docs: https://docs.scaffoldeth.io/
- Scaffold-ETH 2 agent/deployment command reference: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md
