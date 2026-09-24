# Base Mainnet Launch Runbook

This is the ordered path from the current state to production for a
Scaffold-ETH 2 Foundry creator-tipping dApp. Follow the gates in order.
If a gate fails, stop and fix it in the phase where the problem belongs.

Current state assumed:

- The app works on a local Base fork.
- Solidity tests pass locally.
- The full browser-wallet journey works against localhost.
- No live deployment, funded deployer, production URL, or public release exists yet.

Production target:

- Chain: Base Mainnet
- Chain ID: `8453` / `0x2105`
- Public RPC for checks: `https://mainnet.base.org`
- Production RPC: a monitored provider URL restricted by domain/quota where possible
- Native Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDC decimals: `6`
- Platform fee: `100` bps = `1%`

Do not edit `packages/nextjs/contracts/deployedContracts.ts` by hand. SE2
generates it after deploy.

## 0. One-Time Launch Shell

Run these from the actual dApp repo root, not this documentation directory.

```bash
cd /path/to/creator-tipping-repo
git status --short
corepack enable
yarn install

export BASE_CHAIN_ID="8453"
export BASE_RPC_URL="https://mainnet.base.org"
export BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export PLATFORM_FEE_BPS="100"
```

Create a launch branch:

```bash
git switch -c launch/base-mainnet
```

Gate:

- `git status --short` only shows expected local work.
- `yarn install` completes without lockfile surprises.
- Both teammates know this branch is the only branch being prepared for launch.

## 1. Pick Production Addresses Before Touching Mainnet

Decide and record the addresses below in a private launch note. Do not put
private keys in the note.

```bash
export FEE_RECIPIENT="<0xBaseSafeOrTreasuryAddress>"
export CREATOR_TEST_WALLET="<0xCreatorQaWallet>"
export FAN_TEST_WALLET="<0xFanQaWallet>"
```

Recommended:

- `FEE_RECIPIENT` is a Base Safe controlled by both teammates.
- The deployer is a fresh hot wallet funded only for deployment gas.
- QA wallets hold only small test funds.

If the contract has an owner/admin:

- Owner should be the Safe at or immediately after deploy.
- If ownership starts on the deployer, include an ownership transfer in the deploy script or perform it before public frontend launch.

Gate:

- `FEE_RECIPIENT` is final.
- Both teammates have checked it character by character.
- No contract deploy happens until this is settled.

## 2. Secret Safety Gate

Make sure secret files are ignored:

```bash
grep -nE '^\.env$|^\.env\.\*$|^packages/.*/\.env' .gitignore
```

If the grep does not show matching ignore rules, add these to `.gitignore`:

```gitignore
.env
.env.*
packages/*/.env
packages/*/.env.*
*.key
broadcast/
cache/
node_modules/
```

Check for obvious leaked keys before every commit:

```bash
rg -n "0x[a-fA-F0-9]{64}" packages --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.sol' || true
rg -n "g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+" packages --glob '*.ts' --glob '*.tsx' --glob '*.js' || true
git diff --cached --name-only | grep -Ei '(^|/)\.env|key|secret|private' && exit 1 || true
```

Gate:

- No private key appears in source, config, deploy scripts, shell history snippets, docs, or commits.
- RPC URLs with embedded provider keys are read from environment variables only.
- Public `NEXT_PUBLIC_*` values are treated as visible to users. Restrict provider keys at the provider dashboard.

## 3. Configure Base In Foundry

Open `packages/foundry/foundry.toml` and ensure Base exists:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
```

If the file already has `[rpc_endpoints]`, add only the `base` line.

Create or update `packages/foundry/.env` locally. This file must not be committed.

```bash
touch packages/foundry/.env
${EDITOR:-vi} packages/foundry/.env
```

Ensure it contains these values, with the real treasury/Safe address:

```bash
BASE_RPC_URL=https://mainnet.base.org
BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
PLATFORM_FEE_BPS=100
FEE_RECIPIENT=<0xBaseSafeOrTreasuryAddress>
```

Check that the deploy script does not hardcode local-only values:

```bash
rg -n "USDbC|0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA|localhost|31337|hardhat|anvil" packages/foundry packages/nextjs || true
rg -n "feeRecipient|platformFee|feeBps|100|833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" packages/foundry packages/nextjs
```

The deployment script should read constructor arguments from env, not from
local fork constants. The constructor wiring should be equivalent to:

```solidity
address usdc = vm.envAddress("BASE_USDC");
address feeRecipient = vm.envAddress("FEE_RECIPIENT");
uint16 platformFeeBps = uint16(vm.envUint("PLATFORM_FEE_BPS"));

new CreatorTips(usdc, feeRecipient, platformFeeBps);
```

Gate:

- The deploy script uses native Base USDC.
- It passes `100` bps.
- It passes the final `FEE_RECIPIENT`.
- No Base deploy command has been run yet.

## 4. Configure The Next.js App For Base

Open `packages/nextjs/scaffold.config.ts`.

Set the target network to Base and keep burner wallets local-only:

```ts
import { base } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [base],
  pollingInterval: 4000,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "",
  rpcOverrides: {
    [base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
  },
  burnerWalletMode: "localNetworksOnly",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
```

Preserve any existing unrelated fields. If your SE2 version uses a different
burner-wallet field name, set the equivalent value so burner wallets appear
only on local networks.

Open `packages/nextjs/contracts/externalContracts.ts` and make sure Base USDC
is defined before building:

```ts
import { erc20Abi } from "viem";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: erc20Abi,
    },
  },
} as const satisfies GenericContractsDeclaration;

export default externalContracts;
```

If the file already contains other networks/contracts, add the `8453.USDC`
entry without deleting the rest.

Create or update local frontend env. This file must not be committed:

```bash
touch packages/nextjs/.env.local
${EDITOR:-vi} packages/nextjs/.env.local
```

Ensure it contains:

```bash
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<walletconnect_project_id>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Gate:

- The app targets Base, not local Anvil, Sepolia, Ethereum mainnet, or Base Sepolia.
- The app uses native USDC, not USDbC.
- Burner wallet is not available on Base.
- No secret value is committed.

## 5. Re-Run Local Quality Gates

Run static and contract checks:

```bash
yarn compile
cd packages/foundry
forge test -vvv
cd ../..
yarn lint
yarn next:build
```

Run the forked local journey one last time in three terminals:

```bash
yarn fork --network base
```

```bash
yarn deploy
```

```bash
yarn start
```

Manual browser QA on `http://localhost:3000`:

- Wrong-network wallet shows only "Switch Network".
- Correct-network wallet shows "Approve USDC" only when allowance is insufficient.
- "Tip" appears only after network and allowance are correct.
- Approve amount is exact or bounded, not infinite.
- Tip uses 6-decimal USDC math.
- Pending transaction buttons are disabled.
- User rejection, insufficient ETH for gas, insufficient USDC, and reverted execution display understandable errors.
- Creator and fee balances update after confirmation.

Gate:

- All commands pass.
- The browser-wallet journey passes on the fork.
- If anything fails here, fix it locally and repeat this section.

## 6. Create And Fund The Deployer

Generate a fresh deployer:

```bash
yarn generate
yarn account
```

Record the generated address:

```bash
export DEPLOYER_ADDRESS="<0xGeneratedDeployerAddress>"
```

Fund it with Base ETH from a trusted wallet or exchange. Start with enough for
deployment plus verification and ownership/admin calls. A small app on Base is
usually cheap, but use a margin such as `0.02` ETH.

Check the funded balance:

```bash
cast chain-id --rpc-url "$BASE_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
```

Expected:

- `cast chain-id` prints `8453`.
- Deployer balance is non-zero and comfortably above expected deploy gas.

Gate:

- The deployer is funded on Base, not Ethereum mainnet, not Base Sepolia.
- The deployer private key remains in ignored local env/keystore only.
- If the deployer received too much ETH, plan to sweep leftover ETH after launch.

## 7. Verify Live Network Constants Before Deploy

Check the chain and USDC contract directly:

```bash
cast chain-id --rpc-url "$BASE_RPC_URL"
cast code "$BASE_USDC" --rpc-url "$BASE_RPC_URL" | wc -c
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "symbol()(string)" --rpc-url "$BASE_RPC_URL"
```

Expected:

- Chain ID: `8453`
- USDC code length: greater than `2`
- Decimals: `6`
- Symbol: `USDC`

Gate:

- If any expected value differs, stop. The RPC or token address is wrong.

## 8. Deploy Contracts To Base

Run from repo root:

```bash
source packages/foundry/.env
BASE_RPC_URL="$BASE_RPC_URL" \
BASE_USDC="$BASE_USDC" \
FEE_RECIPIENT="$FEE_RECIPIENT" \
PLATFORM_FEE_BPS="$PLATFORM_FEE_BPS" \
yarn deploy --network base
```

If the repo has multiple Foundry deploy scripts and the creator-tipping deploy
is not the default, use the specific SE2 file flag:

```bash
yarn deploy --network base --file DeployCreatorTips.s.sol
```

Immediately capture deployment output:

```bash
find packages/foundry/broadcast -path '*/8453/run-latest.json' -print
git diff -- packages/nextjs/contracts/deployedContracts.ts
```

Set the deployed contract address:

```bash
export TIPPING_CONTRACT="<0xDeployedCreatorTipsContract>"
```

Gate:

- `packages/nextjs/contracts/deployedContracts.ts` now contains a Base `8453` entry.
- The deployed address in `deployedContracts.ts` matches the transaction receipt.
- The deploy transaction is confirmed on Base.
- If the deploy transaction fails or reverts, do not retry blindly. Inspect the revert, fix in Phase 1, rerun tests, and redeploy.

## 9. Verify Source On The Explorer

Run verification immediately:

```bash
yarn verify --network base
```

Open the deployed contract on Basescan or Base Blockscout and confirm:

- Source code is verified.
- Constructor arguments match Base USDC, fee recipient, and `100` bps.
- Contract name and compiler version are correct.

Gate:

- Do not launch a public frontend until the contract is verified.
- If verification fails because constructor args or compiler settings are wrong, fix verification before frontend production deploy.

## 10. Post-Deploy Onchain Sanity Checks

Use the actual getter names in your contract. These commands assume common
getter names:

```bash
cast call "$TIPPING_CONTRACT" "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$TIPPING_CONTRACT" "platformFeeBps()(uint16)" --rpc-url "$BASE_RPC_URL"
cast call "$TIPPING_CONTRACT" "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
```

If the contract is ownable:

```bash
cast call "$TIPPING_CONTRACT" "owner()(address)" --rpc-url "$BASE_RPC_URL"
```

Expected:

- `usdc()` equals `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- `platformFeeBps()` equals `100`.
- `feeRecipient()` equals `FEE_RECIPIENT`.
- `owner()` is the Safe, or ownership transfer is the next step.

If ownership must be transferred after deploy, do it before any public launch:

```bash
test -n "$DEPLOYER_PRIVATE_KEY"

cast send "$TIPPING_CONTRACT" "transferOwnership(address)" "$FEE_RECIPIENT" \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY"

cast call "$TIPPING_CONTRACT" "owner()(address)" --rpc-url "$BASE_RPC_URL"
```

Gate:

- The live contract's immutable/configured values are correct.
- Admin ownership is correct.
- If any value is wrong, do not patch the frontend around it. Fix/redeploy the contract.

## 11. Commit The Production Contract Artifacts

Run the secret scan again:

```bash
rg -n "0x[a-fA-F0-9]{64}" packages --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.sol' || true
rg -n "g\.alchemy\.com/v2/[A-Za-z0-9_-]+|infura\.io/v3/[A-Za-z0-9_-]+" packages --glob '*.ts' --glob '*.tsx' --glob '*.js' || true
git status --short
```

Commit only source/config/generated frontend contract data. Do not commit
`.env`, private keys, or local cache.

```bash
git add packages/foundry/foundry.toml \
  packages/foundry/script \
  packages/nextjs/scaffold.config.ts \
  packages/nextjs/contracts/externalContracts.ts \
  packages/nextjs/contracts/deployedContracts.ts

git diff --cached --stat
git diff --cached --name-only | grep -Ei '(^|/)\.env|key|secret|private' && exit 1 || true
git commit -m "Configure Base mainnet launch"
```

Gate:

- `deployedContracts.ts` is committed with the Base address.
- No secret or local `.env` file is staged.

## 12. Test Local UI Against Live Base Contracts

Start the frontend locally against Base:

```bash
NEXT_PUBLIC_BASE_RPC="$BASE_RPC_URL" \
NEXT_PUBLIC_APP_URL="http://localhost:3000" \
yarn start
```

Fund QA wallets:

- `FAN_TEST_WALLET`: small Base ETH for gas and small native Base USDC.
- `CREATOR_TEST_WALLET`: no special funding required.
- `FEE_RECIPIENT`: observe only.

Record balances before a test tip:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FAN_TEST_WALLET" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_TEST_WALLET" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address,address)(uint256)" "$FAN_TEST_WALLET" "$TIPPING_CONTRACT" --rpc-url "$BASE_RPC_URL"
```

In the browser, tip exactly `1.00` USDC from the fan QA wallet to the creator
QA wallet.

Expected token-unit deltas:

- Fan: `-1000000`
- Creator: `+990000`
- Fee recipient: `+10000`
- Contract USDC balance: unchanged or `0`, unless the design intentionally holds funds.

Check after:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FAN_TEST_WALLET" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_TEST_WALLET" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$TIPPING_CONTRACT" --rpc-url "$BASE_RPC_URL"
```

Also test:

- `0.01` USDC, to catch rounding/minimum-tip behavior.
- Insufficient allowance.
- Insufficient USDC.
- Insufficient ETH for gas.
- User rejects approval.
- User rejects tip.
- Wrong chain.
- Page refresh after approval but before tip.

Gate:

- The full live-contract journey works locally.
- Balance deltas match the intended fee math.
- Errors are understandable.
- No console errors are present.
- If a live-contract bug appears, return to local fork, add a regression test, redeploy, and repeat from Section 8.

## 13. Production Frontend Metadata And Safety

Set production metadata:

- `packages/nextjs/app/layout.tsx`: title, description, and open graph metadata.
- Public app name/logo/URLs are final.
- Link preview image is production-ready.
- Any debug page, sample contract UI, faucet, local account display, or scaffold demo content is removed or hidden.

Confirm the app has no local-only assumptions:

```bash
rg -n "localhost|127\.0\.0\.1|31337|anvil|hardhat|sepolia|debug|faucet|YourContract|example" packages/nextjs || true
rg -n "burner|localNetworksOnly|targetNetworks|rpcOverrides|WalletConnect|walletConnectProjectId" packages/nextjs/scaffold.config.ts
```

Run production build:

```bash
yarn next:build
```

Gate:

- Build passes.
- Burner wallet is absent for Base.
- No localhost/fork/testnet value remains in production UI.
- Legal/support links are present if the public app needs them.

## 14. Deploy A Preview URL First

Use Vercel for the first public URL because it gives previews, logs, and quick
rollback.

Install/login if needed:

```bash
yarn vercel:login
```

Create or link the Vercel project:

```bash
yarn vercel
```

Add production and preview environment variables in Vercel:

```bash
npx vercel env add NEXT_PUBLIC_BASE_RPC preview
npx vercel env add NEXT_PUBLIC_BASE_RPC production
npx vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID preview
npx vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_APP_URL preview
npx vercel env add NEXT_PUBLIC_APP_URL production
```

Use:

- `NEXT_PUBLIC_BASE_RPC`: monitored Base RPC URL or `https://mainnet.base.org`
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`: WalletConnect project ID
- `NEXT_PUBLIC_APP_URL`: preview URL for preview, final production domain for production

Deploy a preview:

```bash
yarn vercel
```

Set:

```bash
export PREVIEW_URL="<https://preview-url.vercel.app>"
```

Gate:

- Preview URL loads.
- It connects to Base `8453`.
- It reads the deployed Base contract address from committed `deployedContracts.ts`.
- It does not show burner wallet, local faucet, or local chain prompts.

## 15. Preview QA Against Real Contracts

On the preview URL, repeat the live flow with small funds:

- MetaMask wallet.
- Rainbow wallet.
- WalletConnect mobile wallet.
- Desktop viewport.
- Mobile viewport.
- Fresh browser profile with no cached approvals.

Check browser console and Vercel logs:

```bash
npx vercel logs "$PREVIEW_URL" --since 1h
```

Run read checks while the preview is open:

```bash
cast call "$BASE_USDC" "allowance(address,address)(uint256)" "$FAN_TEST_WALLET" "$TIPPING_CONTRACT" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_TEST_WALLET" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
```

Gate:

- At least one successful small tip is completed from the preview URL.
- WalletConnect works.
- Mobile layout is usable.
- Console/logs do not show runtime errors.
- No wrong-chain, wrong-contract, wrong-token, stale-ABI, or stale-address issue appears.

## 16. Deploy Production URL

When preview QA passes, deploy production:

```bash
yarn vercel --prod
```

If the repo uses SE2's yolo wrapper instead of forwarding `--prod`, run:

```bash
yarn vercel:yolo --prod
```

Set:

```bash
export PROD_URL="<https://production-url>"
```

If using a custom domain, attach it in Vercel and update:

```bash
npx vercel env rm NEXT_PUBLIC_APP_URL production
npx vercel env add NEXT_PUBLIC_APP_URL production
yarn vercel --prod
```

Gate:

- Production URL loads over HTTPS.
- Production URL is the value of `NEXT_PUBLIC_APP_URL`.
- The production deployment was built from the commit that contains the Base contract address.

## 17. Production Smoke Test Before Announcing

Before posting the URL publicly, run one more smoke test on production:

- Connect wallet.
- Switch to Base.
- Approve `1.00` USDC.
- Tip `1.00` USDC.
- Confirm creator receives `0.99` USDC and fee recipient receives `0.01` USDC.
- Refresh page and confirm displayed state remains correct.
- Open the production URL on mobile.
- Open link preview in Slack/Discord/Twitter draft and confirm metadata looks right.

Commands:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FAN_TEST_WALLET" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_TEST_WALLET" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
npx vercel logs "$PROD_URL" --since 30m
```

Gate:

- Production smoke test passes.
- No console or Vercel runtime errors.
- Both teammates approve announcement.

## 18. Announce And Watch The First Hour

Keep both teammates available for the first hour.

Watch:

```bash
npx vercel logs "$PROD_URL" --since 1h
cast block-number --rpc-url "$BASE_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
```

Also keep these tabs open:

- Production URL
- Vercel deployment logs
- Deployed contract on Basescan/Base Blockscout
- Fee recipient address on explorer
- WalletConnect/project dashboard
- RPC provider dashboard

For the first real user transactions, check:

- Tips settle.
- Fee math remains correct.
- There are no unexpected contract USDC balances.
- No spike in failed transactions.
- RPC provider is not rate-limiting.

## 19. Rollback And Incident Rules

Frontend-only bug:

```bash
npx vercel rollback "$PROD_URL"
```

Then fix on a branch, redeploy preview, QA, and promote again.

Wrong frontend config:

- Remove the public announcement link if possible.
- Fix env/config.
- Redeploy production.
- Confirm contract address and chain ID on production.

Contract bug before public usage:

- Remove/hide the production frontend immediately.
- Fix on the local fork.
- Add a regression test.
- Redeploy a new contract.
- Verify source.
- Commit regenerated `deployedContracts.ts`.
- Repeat live local QA, preview QA, and production smoke test.

Contract bug after public usage:

- If the contract has `pause()`, pause it from the Safe/admin.
- If no pause exists, disable the frontend write path and publish a status note.
- Do not redeploy silently. Record affected tx hashes and balances.
- Prepare a migration/remediation plan before sending users to a new contract.

Compromised deployer:

- Transfer any remaining ETH out if safe.
- If deployer still owns the contract, transfer ownership to the Safe immediately.
- Rotate RPC and WalletConnect/provider credentials.
- Do not reuse the deployer.

## 20. Sweep And Archive

After launch is stable:

```bash
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
```

Sweep leftover deployer ETH to the Safe/treasury if the deployer is no longer
needed.

Tag the launch commit:

```bash
git tag base-mainnet-launch-$(date +%Y%m%d)
git status --short
```

Archive privately:

- Production URL
- Contract address
- Deploy tx hash
- Verify URL
- Launch commit hash
- Fee recipient address
- Owner/admin address
- First successful production smoke-test tx hash

## Common Failure Checks

| Risk | How to catch before users |
| --- | --- |
| Wrong chain | `cast chain-id --rpc-url "$BASE_RPC_URL"` must be `8453`; UI must request Base. |
| Wrong token | `decimals()` must be `6`, `symbol()` must be `USDC`, address must be native Base USDC. |
| USDbC used by mistake | Search for `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` and `USDbC`; neither should be used for production tips. |
| Fee recipient typo | Check deploy env, constructor args, `feeRecipient()` getter, and first smoke-test fee balance delta. |
| Fee math bug | Use exact 1 USDC smoke test: fan `-1000000`, creator `+990000`, fee `+10000`. |
| Infinite approval | Inspect UI approval call and wallet prompt; approve exact/bounded amount only. |
| Stale contract address | Production build must include committed `deployedContracts.ts` with chain `8453`. |
| Burner wallet on prod | Open production on Base; burner wallet must not appear. |
| Verification skipped | Explorer source tab must show verified source before public launch. |
| RPC rate limiting | Use monitored provider dashboard during preview and first hour. |
| Leaked key | Run secret scans before commits and never commit `.env` files. |
| Mobile/wallet breakage | Preview QA with MetaMask, Rainbow, WalletConnect, desktop, and mobile before production. |

## References Checked For This Runbook

- Base chain ID docs: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Circle USDC on Base page: https://www.circle.com/multi-chain-usdc/base
- Scaffold-ETH 2 agent/deploy guidance: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md
