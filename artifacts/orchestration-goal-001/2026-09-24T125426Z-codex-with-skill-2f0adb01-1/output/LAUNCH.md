# Launch Runbook: Creator Tipping on Base

This is the ordered path from the current state, where the Scaffold-ETH 2 Foundry app works on a local Base fork, to real users on a public production URL.

Follow the gates in order. Do not deploy the frontend publicly until the Base mainnet contract has been deployed, verified, and tested through the local UI with real wallets and small real USDC tips.

## 0. Launch Rules

- Production chain: Base mainnet, chain ID `8453`.
- Gas token: ETH on Base.
- Payment token: native Circle USDC on Base, not bridged USDbC.
- Base native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Base Sepolia test USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Platform fee: `100` basis points, which is 1%.
- Production deployer must be a dedicated deployer account, not a personal daily wallet.
- Fee recipient and contract owner/admin should be a team-controlled address, preferably a Safe. Do not leave production fees controlled only by the deployer unless the contract has no admin/owner model.
- No private keys, RPC keys, explorer keys, WalletConnect project IDs, or service tokens are committed.

Use these docs as the reference points if a command changes in a future Scaffold-ETH release:

- Scaffold-ETH 2 deploy contracts: https://docs.scaffoldeth.io/deploying/deploy-smart-contracts
- Scaffold-ETH 2 deploy Next.js app: https://docs.scaffoldeth.io/deploying/deploy-nextjs-app
- Base chain IDs: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Circle Base USDC: https://www.circle.com/blog/usdc-now-available-natively-on-base
- Circle testnet faucet: https://faucet.circle.com/

## 1. Name the Release and Freeze Scope

Run these from the actual dApp repo, not from this documentation directory.

```bash
export APP_DIR="/absolute/path/to/the/scaffold-eth-2-repo"
export RELEASE_TAG="base-mainnet-launch-$(date +%Y%m%d)"
cd "$APP_DIR"

git status --short
git switch -c "$RELEASE_TAG"
```

Gate before continuing:

- `git status --short` contains only changes you understand.
- The app still targets local/fork config at this point.
- No new product scope enters this branch except launch fixes.

If this gate fails, stop and split unrelated work into another branch before continuing.

## 2. Define Production Values Once

Fill these values in the shell that will be used for deployment.

```bash
export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/REPLACE_WITH_PRODUCTION_KEY"
export BASE_SEPOLIA_RPC_URL="https://base-sepolia.g.alchemy.com/v2/REPLACE_WITH_TESTNET_KEY"
export ETHERSCAN_API_KEY="REPLACE_WITH_ETHERSCAN_OR_BASESCAN_COMPATIBLE_KEY"
export NEXT_PUBLIC_ALCHEMY_API_KEY="REPLACE_WITH_PRODUCTION_ALCHEMY_KEY"
export NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="REPLACE_WITH_WALLETCONNECT_PROJECT_ID"

export BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export BASE_SEPOLIA_USDC="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
export PLATFORM_FEE_BPS="100"

export DEPLOYER_KEYSTORE="creator-tip-base-deployer"
export FEE_RECIPIENT="0xREPLACE_WITH_TEAM_FEE_RECIPIENT_OR_SAFE"
export OWNER_ADDRESS="0xREPLACE_WITH_TEAM_OWNER_OR_SAFE"
export PROD_URL="https://REPLACE_WITH_PUBLIC_PRODUCTION_DOMAIN"

# Set these to the actual read function names if your contract differs.
export FEE_BPS_READ_SIG="platformFeeBps()(uint256)"
export USDC_READ_SIG="usdc()(address)"
export FEE_RECIPIENT_READ_SIG="feeRecipient()(address)"
export OWNER_READ_SIG="owner()(address)"
```

Gate before continuing:

- `FEE_RECIPIENT` is controlled by the team and can receive USDC on Base.
- `OWNER_ADDRESS` is controlled by the team if the contract has an owner/admin.
- `BASE_USDC` is the native USDC address above, not `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` USDbC.
- RPC URLs and keys are stored only in shell/env files, never in tracked source.

## 3. Prepare a Dedicated Deployer

Create or import the deployer into Foundry's encrypted keystore.

```bash
cast wallet import "$DEPLOYER_KEYSTORE" --interactive
cast wallet address --account "$DEPLOYER_KEYSTORE"
```

Fund the deployer:

- Base Sepolia: enough test ETH for deployment and verification rehearsal.
- Base mainnet: enough ETH for deployment plus at least 3 retry attempts. On Base this is usually modest, but use a buffer rather than exact gas.

Check balances:

```bash
export DEPLOYER_ADDRESS="$(cast wallet address --account "$DEPLOYER_KEYSTORE")"

cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Gate before continuing:

- The deployer has test ETH on Base Sepolia.
- The deployer has mainnet ETH on Base.
- The deployer has no unnecessary assets beyond launch funds.
- Both teammates know where the keystore backup/recovery procedure lives.

If the private key is ever pasted into a tracked file, terminal recording, chat, issue, or CI log, abandon that deployer immediately and create a new one.

## 4. Add Environment Files

Create or update `packages/foundry/.env`.

```bash
cat > packages/foundry/.env.example <<'EOF'
BASE_RPC_URL=
BASE_SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
USDC_ADDRESS=
FEE_RECIPIENT=
OWNER_ADDRESS=
PLATFORM_FEE_BPS=100
EOF
```

Manually create `packages/foundry/.env` with the real values:

```dotenv
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/REPLACE_WITH_PRODUCTION_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/REPLACE_WITH_TESTNET_KEY
ETHERSCAN_API_KEY=REPLACE_WITH_ETHERSCAN_OR_BASESCAN_COMPATIBLE_KEY
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
FEE_RECIPIENT=0xREPLACE_WITH_TEAM_FEE_RECIPIENT_OR_SAFE
OWNER_ADDRESS=0xREPLACE_WITH_TEAM_OWNER_OR_SAFE
PLATFORM_FEE_BPS=100
```

Create or update `packages/nextjs/.env.local.example`.

```bash
cat > packages/nextjs/.env.local.example <<'EOF'
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
NEXT_PUBLIC_BASE_RPC_URL=
EOF
```

Manually create `packages/nextjs/.env.local` with the real values:

```dotenv
NEXT_PUBLIC_ALCHEMY_API_KEY=REPLACE_WITH_PRODUCTION_ALCHEMY_KEY
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=REPLACE_WITH_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/REPLACE_WITH_PRODUCTION_KEY
```

Confirm env files are ignored:

```bash
git check-ignore packages/foundry/.env
git check-ignore packages/nextjs/.env.local
```

If either command prints nothing, add these entries to `.gitignore`:

```gitignore
.env
.env.*
packages/foundry/.env
packages/nextjs/.env.local
broadcast/
cache/
node_modules/
```

Gate before continuing:

- `.env.example` files contain no real secrets.
- `packages/foundry/.env` and `packages/nextjs/.env.local` are ignored by git.

## 5. Configure Foundry Networks

In `packages/foundry/foundry.toml`, ensure these entries exist. Keep existing local/anvil config intact.

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
baseSepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base = { key = "${ETHERSCAN_API_KEY}", url = "https://api.basescan.org/api" }
baseSepolia = { key = "${ETHERSCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
```

Check the RPCs respond with the expected chain IDs:

```bash
cast chain-id --rpc-url "$BASE_RPC_URL"
cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected:

```text
8453
84532
```

Gate before continuing:

- Mainnet RPC returns `8453`.
- Base Sepolia RPC returns `84532`.
- Network names are exactly `base` and `baseSepolia`, matching the later `yarn deploy --network ...` commands.

## 6. Configure the Deployment Script

Update the Foundry deploy script in `packages/foundry/script/`, usually `Deploy.s.sol`, so production parameters come from env vars instead of literals.

The deploy script should follow this shape, adjusted to the actual contract name and constructor:

```solidity
// packages/foundry/script/Deploy.s.sol
address usdc = vm.envAddress("USDC_ADDRESS");
address feeRecipient = vm.envAddress("FEE_RECIPIENT");
address owner = vm.envAddress("OWNER_ADDRESS");
uint256 feeBps = vm.envUint("PLATFORM_FEE_BPS");

CreatorTipping tipping = new CreatorTipping(usdc, feeRecipient, feeBps);

// If the contract is Ownable or has an equivalent admin role:
tipping.transferOwnership(owner);
```

If the constructor does not currently accept `usdc`, `feeRecipient`, or `feeBps`, stop and make that explicit before launch. A USDC tipping contract should not rely on a hardcoded test token address or an implicit deployer fee recipient.

Gate before continuing:

- Constructor/deploy parameters are read from env vars.
- `PLATFORM_FEE_BPS` is `100`.
- The deployed contract will use native USDC for the target network.
- If the contract has owner/admin powers, ownership is transferred to `OWNER_ADDRESS` during deploy or immediately after deploy.

## 7. Configure Frontend Networks

Update `packages/nextjs/scaffold.config.ts` for the rehearsal step first:

```ts
import { baseSepolia } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [baseSepolia],
  pollingInterval: 30000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  onlyLocalBurnerWallet: true,
  walletAutoConnect: true,
} as const;

export default scaffoldConfig;
```

If the app uses USDC through `externalContracts.ts`, include both Base networks. The exact ABI import can follow the app's existing pattern; for a standard ERC-20 ABI, `erc20Abi` from `viem` is acceptable.

```ts
import { erc20Abi } from "viem";
import { base, baseSepolia } from "viem/chains";

const externalContracts = {
  [base.id]: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: erc20Abi,
    },
  },
  [baseSepolia.id]: {
    USDC: {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      abi: erc20Abi,
    },
  },
} as const;

export default externalContracts;
```

Gate before continuing:

- The frontend targets only `baseSepolia` for the rehearsal.
- Burner wallet is local-only.
- The frontend shows native USDC for Base mainnet and Base Sepolia test USDC for rehearsal.
- No production RPC key is hardcoded into `scaffold.config.ts`.

## 8. Run the Local Release Checks

Install and build from a clean dependency state.

```bash
yarn install --frozen-lockfile
yarn compile
yarn foundry:test
yarn lint
yarn next:build
```

Run a final local Base fork journey:

Terminal 1:

```bash
yarn fork --network base
```

Terminal 2:

```bash
yarn deploy
```

Terminal 3:

```bash
yarn start
```

In the browser at `http://localhost:3000`, complete the user journey with a browser wallet against the fork:

- Connect wallet.
- Switch network when prompted.
- Tip a creator with USDC.
- Confirm the app shows only one token action at a time: switch network, then approve, then tip.
- Confirm allowance is exact or intentionally bounded, not unlimited.
- Confirm creator receives 99%.
- Confirm fee recipient receives 1%.
- Confirm empty USDC balance, insufficient allowance, user rejection, wrong network, and insufficient gas all produce understandable UI states.

Gate before continuing:

- All commands pass.
- The local fork browser journey passes.
- No console errors appear during the journey.
- The deploy script used the env-driven parameters.

## 9. Run Security and Secret Checks

Run these before any live deploy.

```bash
git diff --check
git diff --cached --check

grep -rn "0x[a-fA-F0-9]\\{64\\}" packages/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.sol" || true
grep -rn "g.alchemy.com/v2/[A-Za-z0-9_-]" packages/ --include="*.ts" --include="*.tsx" --include="*.js" || true
grep -rn "infura.io/v3/[A-Za-z0-9_-]" packages/ --include="*.ts" --include="*.tsx" --include="*.js" || true
grep -rn "ETHERSCAN_API_KEY\\|BASESCAN_API_KEY\\|DEPLOYER_PRIVATE_KEY\\|PRIVATE_KEY" packages/ --exclude=".env" --exclude=".env.local" || true
```

Run static analysis if Slither is available:

```bash
slither packages/foundry --filter-paths "lib|test|script"
```

If Slither is not installed, install it outside the repo and rerun:

```bash
python3 -m pip install --user slither-analyzer
slither packages/foundry --filter-paths "lib|test|script"
```

Gate before continuing:

- No real secret appears in tracked files or diffs.
- Any private-key-like grep result is confirmed to be a harmless test fixture, not a real key.
- Slither findings are either fixed or explicitly accepted by both teammates in writing.
- At least one teammate who did not write the contract reviews fee math, token decimals, transfer/transferFrom handling, owner/admin powers, and withdraw logic.

## 10. Deploy the Base Sepolia Rehearsal Contract

Set rehearsal env values:

```bash
export USDC_ADDRESS="$BASE_SEPOLIA_USDC"
export PLATFORM_FEE_BPS="100"
```

Update `packages/foundry/.env` for the rehearsal so `USDC_ADDRESS` is the Base Sepolia test USDC address.

Deploy:

```bash
yarn deploy --network baseSepolia --keystore "$DEPLOYER_KEYSTORE"
```

Capture the deployed contract address from the deploy output:

```bash
export TIP_CONTRACT_SEPOLIA="0xREPLACE_WITH_BASE_SEPOLIA_DEPLOYED_CONTRACT"
```

Verify immediately:

```bash
yarn verify --network baseSepolia
```

Check deployed parameters.

```bash
cast call "$TIP_CONTRACT_SEPOLIA" "$FEE_BPS_READ_SIG" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$TIP_CONTRACT_SEPOLIA" "$USDC_READ_SIG" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$TIP_CONTRACT_SEPOLIA" "$FEE_RECIPIENT_READ_SIG" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected:

- Fee bps is `100`.
- USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Fee recipient is `FEE_RECIPIENT`.

Confirm the generated frontend deployment file includes the new Base Sepolia address:

```bash
grep -rn "$TIP_CONTRACT_SEPOLIA" packages/nextjs/contracts/deployedContracts.ts
```

Gate before continuing:

- Contract source is verified on Base Sepolia Basescan.
- Constructor or initialization values match the intended rehearsal config.
- Deployment artifacts generated by SE2 are present and were not manually edited.

## 11. Test Base Sepolia with Local UI

Keep `packages/nextjs/scaffold.config.ts` targeting `baseSepolia`.

Get Base Sepolia test USDC for the test wallet from the Circle faucet:

```text
https://faucet.circle.com/
```

Run the frontend locally:

```bash
yarn start
```

Complete the full browser-wallet journey at `http://localhost:3000` on Base Sepolia:

- Connect a normal wallet, not the deployer.
- Switch to Base Sepolia.
- Approve the exact test USDC amount.
- Tip a creator.
- Confirm creator test USDC balance increases by 99%.
- Confirm fee recipient test USDC balance increases by 1%.
- Refresh the page and confirm state is still correct from chain reads.
- Repeat with a second wallet if possible.

Use `cast` to verify balances independently:

```bash
export TEST_FAN="0xREPLACE_WITH_TEST_FAN"
export TEST_CREATOR="0xREPLACE_WITH_TEST_CREATOR"

cast call "$BASE_SEPOLIA_USDC" "balanceOf(address)(uint256)" "$TEST_FAN" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$BASE_SEPOLIA_USDC" "balanceOf(address)(uint256)" "$TEST_CREATOR" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$BASE_SEPOLIA_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Gate before continuing:

- Base Sepolia succeeds end to end with a real browser wallet.
- Fee math is correct for USDC's 6 decimals.
- Event/history views, if present, show the tip correctly.
- Error states are acceptable.
- No console errors occur.

If this gate fails, fix on the branch, add or update a regression test, and go back to section 8.

## 12. Switch Config to Base Mainnet

Update `packages/foundry/.env`:

```dotenv
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
PLATFORM_FEE_BPS=100
```

Update `packages/nextjs/scaffold.config.ts`:

```ts
import { base } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [base],
  pollingInterval: 30000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  onlyLocalBurnerWallet: true,
  walletAutoConnect: true,
} as const;

export default scaffoldConfig;
```

Run build checks again:

```bash
yarn compile
yarn foundry:test
yarn lint
yarn next:build
```

Gate before continuing:

- Frontend targets only `base`.
- Foundry env uses Base native USDC.
- All checks pass after switching from Base Sepolia to Base.

## 13. Deploy Base Mainnet Contract

Do one last deployer balance check:

```bash
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Deploy:

```bash
yarn deploy --network base --keystore "$DEPLOYER_KEYSTORE"
```

Capture the production contract address from the deploy output:

```bash
export TIP_CONTRACT_BASE="0xREPLACE_WITH_BASE_MAINNET_DEPLOYED_CONTRACT"
```

Verify immediately:

```bash
yarn verify --network base
```

Check deployed parameters:

```bash
cast call "$TIP_CONTRACT_BASE" "$FEE_BPS_READ_SIG" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT_BASE" "$USDC_READ_SIG" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT_BASE" "$FEE_RECIPIENT_READ_SIG" --rpc-url "$BASE_RPC_URL"
```

Expected:

- Fee bps is `100`.
- USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Fee recipient is `FEE_RECIPIENT`.

If the contract has an owner/admin, check it:

```bash
cast call "$TIP_CONTRACT_BASE" "$OWNER_READ_SIG" --rpc-url "$BASE_RPC_URL"
```

Expected:

- Owner is `OWNER_ADDRESS`.

Confirm the generated frontend deployment file includes the Base mainnet address:

```bash
grep -rn "$TIP_CONTRACT_BASE" packages/nextjs/contracts/deployedContracts.ts
```

Gate before continuing:

- Contract is deployed on Base mainnet.
- Contract source is verified on Basescan.
- Contract address is recorded in the release notes.
- Ownership/admin, USDC, fee recipient, and fee bps are correct.
- No one has tipped through the public frontend yet.

If any production parameter is wrong, do not publish the frontend. Redeploy a corrected contract and only proceed with the corrected address.

## 14. Test Base Mainnet Contract with Local UI

Run the frontend locally with `targetNetworks: [base]`.

```bash
yarn start
```

Use a normal user wallet with a small amount of Base ETH and USDC. Do not use the deployer for this smoke test.

Mainnet smoke test:

- Tip exactly `1.00` USDC or the smallest amount the UI allows.
- Confirm approval is exact or intentionally bounded.
- Confirm transaction succeeds.
- Confirm creator receives `0.99` USDC.
- Confirm fee recipient receives `0.01` USDC.
- Confirm the app refreshes to the correct post-transaction state.
- Confirm Basescan shows the transaction against `TIP_CONTRACT_BASE`.

Independent balance checks:

```bash
export MAINNET_FAN="0xREPLACE_WITH_MAINNET_TEST_FAN"
export MAINNET_CREATOR="0xREPLACE_WITH_MAINNET_TEST_CREATOR"

cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$MAINNET_FAN" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$MAINNET_CREATOR" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
```

Gate before continuing:

- Real Base mainnet USDC tip succeeds through the local UI.
- Fee split is correct.
- No console errors occur.
- No UI copy says testnet, localhost, sample contract, burner wallet, faucet, or debug.
- Debug-only pages/components are removed or hidden from normal navigation.

If this gate fails, fix with local UI against the production contract. If the bug is in contract behavior, stop the launch, deploy a new corrected contract, and repeat from section 13.

## 15. Prepare Public Frontend Metadata

Update production metadata in the Next.js app:

- App name and title.
- Description.
- Favicon.
- Open Graph image, ideally `1200x630`.
- Public URL/canonical URL using `PROD_URL`.
- Any footer/legal/support links.
- Any visible contract address or "verified contract" link.

Run:

```bash
yarn lint
yarn next:build
```

Gate before continuing:

- Browser title, social preview metadata, and favicon are production-ready.
- Public pages do not expose deployer addresses, private operational notes, or testnet addresses.
- Contract address shown to users, if shown, is `TIP_CONTRACT_BASE`.

## 16. Configure Vercel Production Environment

Login once:

```bash
yarn vercel:login
```

Create or link the Vercel project:

```bash
yarn vercel
```

When prompted:

- Scope: the team's Vercel scope.
- Link to existing project: yes if it exists, otherwise no.
- Project directory: `packages/nextjs` if prompted.
- Build command: keep the Scaffold-ETH default unless the repo has customized it.
- Output directory: keep the Scaffold-ETH default unless the repo has customized it.

Set production environment variables in Vercel:

```bash
yarn vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY production
yarn vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
yarn vercel env add NEXT_PUBLIC_BASE_RPC_URL production
```

Paste the production values when prompted.

Pull Vercel env locally only if needed to validate the linked project:

```bash
yarn vercel env pull packages/nextjs/.env.vercel.local
```

Make sure pulled Vercel env files are ignored:

```bash
git check-ignore packages/nextjs/.env.vercel.local
```

Gate before continuing:

- Vercel has production env vars set.
- No Vercel env file is tracked.
- The Vercel project points at the intended repo/project.

## 17. Deploy a Preview URL

Deploy a preview first:

```bash
yarn vercel
```

Open the preview URL and run the same checks as production without inviting users:

- Page loads.
- Wallet connects.
- Network switch goes to Base.
- Contract reads show production data.
- A very small Base mainnet USDC tip succeeds if the preview is intended to be a true final smoke.
- No console errors.
- Mobile layout works.

Gate before continuing:

- Preview works against the verified Base mainnet contract.
- Both teammates approve the preview URL.

If preview fails because of frontend-only behavior, fix and redeploy preview. If preview exposes a contract issue, stop and return to section 13.

## 18. Deploy Production URL

Deploy production:

```bash
yarn vercel --prod
```

If the custom domain is not already attached, add it in Vercel and point DNS as instructed by Vercel. Then confirm:

```bash
curl -I "$PROD_URL"
```

Expected:

- HTTP status is `200`, `301`, or `308`.
- Redirects land on the intended canonical production URL.

Gate before continuing:

- `PROD_URL` loads from a clean/incognito browser.
- It is the production deployment, not a preview deployment.
- It talks to `TIP_CONTRACT_BASE` on Base.

## 19. Production QA Before Announcing

Run this checklist on `PROD_URL`:

- Chrome desktop.
- Safari or Firefox desktop.
- iOS Safari or Android Chrome.
- MetaMask.
- Rainbow or Coinbase Wallet.
- WalletConnect flow.
- Wrong network state.
- No wallet connected state.
- Insufficient ETH for gas.
- Insufficient USDC.
- User rejects approval.
- User rejects tip.
- Successful small tip.
- Page refresh after successful tip.
- Creator and fee recipient balances independently checked onchain.
- No burner wallet visible.
- No local faucet/debug UI visible.
- No console errors.
- No layout overlap on mobile.
- Link preview image works in Slack/Discord/Twitter or equivalent preview tool.

Gate before announcing:

- Every item above passes.
- The team has the production contract address, production URL, deployer address, fee recipient, owner/admin, and release commit in one shared note.

## 20. Announce Softly, Then Monitor

First announce to a small group. Watch for 30-60 minutes before broader announcement.

Monitor:

```bash
printf 'Contract: https://basescan.org/address/%s\n' "$TIP_CONTRACT_BASE"
printf 'Fee recipient: https://basescan.org/address/%s\n' "$FEE_RECIPIENT"
```

Check:

- Tips arrive as expected.
- Fee recipient receives 1%.
- No repeated failed transaction reports.
- RPC/provider quota is healthy.
- Vercel function/build logs have no errors.
- WalletConnect traffic is normal.

If everything is stable, broaden the announcement.

## 21. Rollback and Incident Paths

Frontend-only issue:

```bash
yarn vercel rollback
```

Or use the Vercel dashboard to promote the last known-good deployment.

Bad production env var:

```bash
yarn vercel env rm VARIABLE_NAME production
yarn vercel env add VARIABLE_NAME production
yarn vercel --prod
```

Contract issue:

- If the contract has a pause/disable function, pause immediately from `OWNER_ADDRESS`.
- If it does not have a pause/disable function, remove tipping entry points from the frontend and deploy the disabled UI.
- Do not hide the old contract address; publish the corrected address after redeploy.
- Fix locally, add a regression test, redeploy a new contract, verify it, test with local UI, and then redeploy frontend.

Example pause command if the contract exposes `pause()`:

```bash
cast send "$TIP_CONTRACT_BASE" "pause()" --account "$DEPLOYER_KEYSTORE" --rpc-url "$BASE_RPC_URL"
```

If `OWNER_ADDRESS` is a Safe, execute the equivalent transaction from the Safe UI instead of `cast send`.

## 22. Commit the Launch Changes

Only commit non-secret source/config/template changes.

```bash
git status --short
git diff -- packages/foundry/foundry.toml packages/foundry/script packages/nextjs/scaffold.config.ts packages/nextjs/contracts packages/nextjs/app packages/nextjs/components .gitignore

git add \
  packages/foundry/.env.example \
  packages/nextjs/.env.local.example \
  packages/foundry/foundry.toml \
  packages/foundry/script \
  packages/nextjs/scaffold.config.ts \
  packages/nextjs/contracts \
  packages/nextjs/app \
  packages/nextjs/components \
  .gitignore

git diff --cached --check
grep -rn "g.alchemy.com/v2/[A-Za-z0-9_-]" . --exclude-dir=node_modules --exclude-dir=.git || true
grep -rn "0x[a-fA-F0-9]\\{64\\}" . --exclude-dir=node_modules --exclude-dir=.git || true

git commit -m "Prepare Base production launch"
git tag "$RELEASE_TAG"
```

Gate:

- Commit contains no `.env`, `.env.local`, private key, API key, or production secret.
- `deployedContracts.ts` was generated by SE2 deploy commands, not manually edited.

## 23. Final Launch Record

Record these values in the team launch note:

```text
Release tag:
Release commit:
Production URL:
Base chain ID: 8453
Base contract:
Base native USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Platform fee bps: 100
Fee recipient:
Owner/admin:
Deployer:
Basescan contract URL:
Vercel production deployment URL:
Base Sepolia rehearsal contract:
```

The launch is complete only after the production URL passes QA and at least one real Base mainnet USDC tip has succeeded through the public URL.
