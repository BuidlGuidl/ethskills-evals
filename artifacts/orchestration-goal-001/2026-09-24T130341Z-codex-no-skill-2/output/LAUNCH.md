# Launch runbook: Scaffold-ETH 2 Foundry creator-tipping app on Base

This is the ordered path from "works on a local fork" to "real users can tip creators with USDC on a public URL." Follow the gates in order. Do not skip a stop/go check because most launch mistakes in this app class are wrong token address, wrong chain, stale frontend deployment data, unfunded deployer, or an app that still targets localhost.

## 0. Fill in launch constants once

Run these from the dApp repo root in every terminal used for launch:

```bash
export CONTRACT_NAME="CreatorTips"                         # replace with the deployed contract name used by SE-2
export DEPLOYER_KEYSTORE="creator-tips-deployer"           # replace with your Foundry keystore name
export PLATFORM_FEE_RECIPIENT="0x..."                      # replace with the team treasury / fee receiver
export BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export BASE_SEPOLIA_USDC="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
export BASE_RPC_URL="https://mainnet.base.org"             # ok for deploy checks; use a private provider for production reads
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export BASESCAN_URL="https://basescan.org"
export BASE_SEPOLIA_SCAN_URL="https://sepolia.basescan.org"
```

Use a production RPC provider for the public frontend, for example Alchemy, Infura, QuickNode, Neynar, Ankr, or your own Base node:

```bash
export NEXT_PUBLIC_BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/<key>"
export NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="<walletconnect-cloud-project-id>"
```

Stop/go check:

```bash
test "$CONTRACT_NAME" != "CreatorTips" || echo "If CreatorTips is not the real Solidity contract name, fix CONTRACT_NAME now."
cast chain-id --rpc-url "$BASE_RPC_URL"          # must print 8453
cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"  # must print 84532
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"          # must print 6
cast call "$BASE_USDC" "symbol()(string)" --rpc-url "$BASE_RPC_URL"           # must print USDC
cast call "$BASE_SEPOLIA_USDC" "decimals()(uint8)" --rpc-url "$BASE_SEPOLIA_RPC_URL" # must print 6
```

Known-good network facts as of 2026-09-24:

| Network | Chain ID | RPC | Explorer | Native USDC |
| --- | ---: | --- | --- | --- |
| Base | 8453 | `https://mainnet.base.org` | `https://basescan.org` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | `https://sepolia.base.org` | `https://sepolia.basescan.org` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Sources checked for these constants:

- Base chain IDs: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Base RPCs and explorers: https://docs.base.org/chain/network-information
- Native Base USDC and Base Sepolia USDC: https://www.circle.com/multi-chain-usdc/base
- Native vs bridged Base USDC warning: https://www.circle.com/blog/usdc-now-available-natively-on-base
- Scaffold-ETH 2 deploy flow: https://docs.scaffoldeth.io/deploying/deploy-smart-contracts
- Scaffold-ETH 2 Next.js deploy flow: https://docs.scaffoldeth.io/deploying/deploy-nextjs-app

## 1. Freeze the launch branch

```bash
git status --short
git checkout -b launch/base-mainnet
yarn install --immutable || yarn install --frozen-lockfile
foundryup
forge --version
node --version
yarn --version
```

Stop/go check:

- `git status --short` only shows intentional app changes before the branch is cut.
- `yarn install` succeeds without changing lockfiles unexpectedly. If the lockfile changes, stop and have both teammates review the diff.
- Record versions in the launch notes:

```bash
{
  echo "Launch versions: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "node: $(node --version)"
  echo "yarn: $(yarn --version)"
  echo "forge: $(forge --version)"
} | tee launch-versions.txt
git add launch-versions.txt
git commit -m "Record launch tool versions"
```

How this catches problems:

- A branch and recorded tool versions make it possible to recreate the exact launch state.
- Lockfile drift is caught before it becomes a production-only build change.

## 2. Run the local release gate

```bash
yarn foundry:test
yarn compile
yarn lint
yarn next:build
```

If your repo has additional scripts, run them now:

```bash
yarn test
yarn typecheck
```

Stop/go check:

- All commands pass from a clean checkout.
- No skipped or focused tests remain:

```bash
rg -n "it\\.only|describe\\.only|test\\.only|skip\\(" packages || true
```

Expected result: no matches except intentional comments.

How this catches problems:

- `yarn foundry:test` catches contract regressions.
- `yarn next:build` catches frontend ABI/type issues before Vercel does.
- The `rg` command catches accidental focused tests that can make the suite look healthier than it is.

## 3. Add Base networks to Foundry

Edit `packages/foundry/foundry.toml`.

Add or update the RPC section:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
baseSepolia = "${BASE_SEPOLIA_RPC_URL}"
```

If the file already has `[rpc_endpoints]`, merge these two lines into that existing section rather than creating a second section.

Stop/go check:

```bash
forge build --root packages/foundry
cast chain-id --rpc-url "$BASE_RPC_URL"
cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected:

- build succeeds
- Base prints `8453`
- Base Sepolia prints `84532`

How this catches problems:

- A wrong env var or typo in `foundry.toml` is caught before deployment.

## 4. Add Base networks to the frontend

Edit `packages/nextjs/scaffold.config.ts`.

For the testnet rehearsal, set the target network to Base Sepolia:

```ts
import { baseSepolia } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [baseSepolia],
  pollingInterval: 30_000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  onlyLocalBurnerWallet: true,
  walletAutoConnect: true,
} as const satisfies ScaffoldConfig;
```

If your file imports chains as `* as chains`, use this shape instead:

```ts
targetNetworks: [chains.baseSepolia],
```

If your app has custom token config, add explicit USDC addresses and decimals:

```ts
usdc: {
  [baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
},
```

Only include `base` in that snippet if `base` is imported from `viem/chains`.

Create or update `packages/nextjs/.env.local`:

```bash
cat > packages/nextjs/.env.local.example <<'EOF'
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_BASE_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=84532
EOF
```

Do not commit the real `.env.local` if it contains provider keys.

Stop/go check:

```bash
yarn next:build
rg -n "localhost|hardhat|31337|burner|anvil|USDbC|0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" packages/nextjs packages/foundry
```

Expected:

- build succeeds
- no production path targets `localhost`, Hardhat chain `31337`, or bridged USDbC
- any `burner` matches are config-only and `onlyLocalBurnerWallet` remains `true`

How this catches problems:

- Users cannot accidentally connect to the local chain.
- The app does not ask users for Base bridged USDbC instead of native Circle USDC.

## 5. Confirm constructor and admin values before any public deployment

Open `packages/foundry/script/Deploy.s.sol` and confirm the deployment arguments use:

- Base Sepolia rehearsal: `BASE_SEPOLIA_USDC`
- Mainnet: `BASE_USDC`
- `PLATFORM_FEE_RECIPIENT`
- fee numerator/denominator equal to exactly 1%, for example `100 / 10_000`, `1 / 100`, or `100` basis points, depending on the contract
- owner/admin set to the intended team multisig or controlled admin wallet, not the deployer hot wallet unless that is deliberate

Recommended config pattern in `Deploy.s.sol`:

```solidity
address usdc = vm.envAddress(block.chainid == 8453 ? "BASE_USDC" : "BASE_SEPOLIA_USDC");
address platformFeeRecipient = vm.envAddress("PLATFORM_FEE_RECIPIENT");
uint16 platformFeeBps = 100;
```

If your deployment script does not read env vars, hard-code the correct address for the current deployment and review the diff before deploying.

Stop/go check:

```bash
rg -n "USDC|fee|Fee|owner|Owner|admin|Admin|recipient|treasury|basis|bps|100|10000" packages/foundry/script packages/foundry/contracts
```

Two-person review:

- Teammate A reads constructor/admin/fee/token values from the deploy script.
- Teammate B reads the expected values from this runbook.
- They must match exactly before continuing.

How this catches problems:

- Wrong token and wrong fee recipient bugs are expensive because users can approve and transfer real USDC before anyone notices.

## 6. Create or import the deployer keystore

Use a dedicated deployer wallet. Do not use a personal wallet with unrelated assets.

To generate a fresh deployer:

```bash
yarn generate
```

To import an existing deployer key:

```bash
yarn account:import
```

Use the keystore name from `DEPLOYER_KEYSTORE`.

Check the account:

```bash
yarn account
cast wallet address --account "$DEPLOYER_KEYSTORE"
export DEPLOYER_ADDRESS="$(cast wallet address --account "$DEPLOYER_KEYSTORE")"
echo "$DEPLOYER_ADDRESS"
```

Stop/go check:

- The deployer address is saved in the team password manager.
- The keystore password is saved in the team password manager.
- The private key is not pasted into Slack, GitHub, a ticket, or `.env`.
- The deployer has no unexpected token balances.

How this catches problems:

- Separating deployer from treasury/admin limits the blast radius if a laptop or keystore is compromised.

## 7. Fund testnet and mainnet deployer wallets

For Base Sepolia, fund:

- Base Sepolia ETH for gas
- Base Sepolia USDC for end-to-end user journey tests, if a fan test wallet needs it

Use faucets from Coinbase/Base/Circle as available, then verify:

```bash
export DEPLOYER_ADDRESS="$(cast wallet address --account "$DEPLOYER_KEYSTORE")"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL" --ether
cast call "$BASE_SEPOLIA_USDC" "balanceOf(address)(uint256)" "$DEPLOYER_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

For Base mainnet, fund only enough ETH for deployment, verification retries, and emergency admin calls. Suggested initial amount: `0.01 ETH` on Base, then top up if gas estimates require it.

```bash
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
```

Stop/go check:

- Base Sepolia deployer has enough test ETH for at least two deployments.
- Base mainnet deployer has Base ETH, not Ethereum L1 ETH.
- No real mainnet USDC is sent to the contract before mainnet deployment and smoke tests.

How this catches problems:

- Funding the wrong chain is common. `cast balance --rpc-url "$BASE_RPC_URL"` proves funds are on Base.

## 8. Deploy to Base Sepolia

Make sure `packages/nextjs/scaffold.config.ts` still targets `baseSepolia`.

Deploy:

```bash
export BASE_USDC="$BASE_USDC"
export BASE_SEPOLIA_USDC="$BASE_SEPOLIA_USDC"
export PLATFORM_FEE_RECIPIENT="$PLATFORM_FEE_RECIPIENT"
yarn deploy --network baseSepolia --keystore "$DEPLOYER_KEYSTORE"
```

If your deployment file is not the default `Deploy.s.sol`, run:

```bash
yarn deploy --network baseSepolia --keystore "$DEPLOYER_KEYSTORE" --file DeployYourContract.s.sol
```

Capture the deployed address:

```bash
export BASE_SEPOLIA_TIPPING_ADDRESS="$(node - <<'NODE'
const fs = require("fs");
const name = process.env.CONTRACT_NAME;
const text = fs.readFileSync("./packages/nextjs/contracts/deployedContracts.ts", "utf8");
const chainAt = text.search(/84532\s*:/);
if (chainAt < 0) throw new Error("Missing chain 84532 in deployedContracts.ts");
const rest = text.slice(chainAt);
const contractAt = Math.max(rest.indexOf(`${name}:`), rest.indexOf(`"${name}":`), rest.indexOf(`'${name}':`));
if (contractAt < 0) throw new Error(`Missing ${name} deployment for chain 84532`);
const match = rest.slice(contractAt).match(/address\s*:\s*["'](0x[a-fA-F0-9]{40})["']/);
if (!match) throw new Error(`Missing ${name} address for chain 84532`);
console.log(match[1]);
NODE
)"
echo "$BASE_SEPOLIA_TIPPING_ADDRESS"
```

If the extractor cannot handle your generated file shape, open `packages/nextjs/contracts/deployedContracts.ts` and copy the `84532 -> $CONTRACT_NAME -> address` value:

```bash
rg -n "84532|$CONTRACT_NAME|address" packages/nextjs/contracts/deployedContracts.ts
```

Stop/go check:

```bash
test -n "$BASE_SEPOLIA_TIPPING_ADDRESS"
cast code "$BASE_SEPOLIA_TIPPING_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL" | wc -c
cast call "$BASE_SEPOLIA_TIPPING_ADDRESS" "owner()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL" || true
cast call "$BASE_SEPOLIA_TIPPING_ADDRESS" "platformFeeBps()(uint256)" --rpc-url "$BASE_SEPOLIA_RPC_URL" || true
cast call "$BASE_SEPOLIA_TIPPING_ADDRESS" "usdc()(address)" --rpc-url "$BASE_SEPOLIA_RPC_URL" || true
```

Expected:

- `cast code` byte count is greater than `3`
- any available getter returns the expected owner, `100` bps or equivalent, and `BASE_SEPOLIA_USDC`
- `packages/nextjs/contracts/deployedContracts.ts` changed and contains chain `84532`

How this catches problems:

- The generated frontend deployment file is the source used by Scaffold-ETH hooks. If it is stale, the UI can point at an old or missing contract.

## 9. Verify the Base Sepolia contract

Add `BASESCAN_API_KEY` to the environment. A single Basescan API key is normally used for Base and Base Sepolia.

```bash
export BASESCAN_API_KEY="<basescan-api-key>"
yarn verify --network baseSepolia
```

Stop/go check:

```bash
open "$BASE_SEPOLIA_SCAN_URL/address/$BASE_SEPOLIA_TIPPING_ADDRESS#code" || true
```

If `open` is unavailable, paste this into a browser:

```bash
echo "$BASE_SEPOLIA_SCAN_URL/address/$BASE_SEPOLIA_TIPPING_ADDRESS#code"
```

Expected:

- Explorer shows verified source code.
- Constructor args match the intended USDC, fee recipient, and fee.

How this catches problems:

- Verification makes it much easier for the team and users to inspect what was deployed before real funds are involved.

## 10. Run the complete public-testnet journey

Start the frontend locally against Base Sepolia:

```bash
yarn start
```

In a browser wallet:

- Switch to Base Sepolia, chain ID `84532`.
- Use a fan test wallet with Base Sepolia ETH and test USDC.
- Use a creator test wallet with no special permissions.
- Approve exactly one small USDC tip amount.
- Send a tip.
- Withdraw/claim as the creator if the app has that flow.
- Confirm the platform fee arrives at `PLATFORM_FEE_RECIPIENT`.

CLI checks after the journey:

```bash
cast call "$BASE_SEPOLIA_USDC" "balanceOf(address)(uint256)" "$PLATFORM_FEE_RECIPIENT" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast logs --address "$BASE_SEPOLIA_TIPPING_ADDRESS" --from-block latest --rpc-url "$BASE_SEPOLIA_RPC_URL" || true
```

Stop/go check:

- User can connect with a normal browser wallet.
- UI displays Base Sepolia, not localhost.
- USDC approval amount is understandable and not unlimited unless you deliberately designed it that way.
- Tip succeeds.
- Creator receives 99%.
- Platform receives 1%.
- Duplicate clicks do not create duplicate tips without the user signing twice.
- Rejected wallet transactions leave the UI recoverable.
- Refreshing the page still shows the deployed contract state.

How this catches problems:

- This reproduces the actual user journey on public infrastructure before any live funds are at risk.

## 11. Deploy a Vercel preview against Base Sepolia

Install/login if needed:

```bash
yarn vercel:login
```

Set preview env vars:

```bash
yarn vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID preview
yarn vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY preview
yarn vercel env add NEXT_PUBLIC_BASE_RPC_URL preview
yarn vercel env add NEXT_PUBLIC_CHAIN_ID preview
```

Use these values:

- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `NEXT_PUBLIC_ALCHEMY_API_KEY=<your provider key if the app uses Alchemy>`
- `NEXT_PUBLIC_BASE_RPC_URL=<private Base Sepolia RPC if your app supports it, otherwise omit>`
- `NEXT_PUBLIC_CHAIN_ID=84532`

Deploy preview:

```bash
yarn vercel
```

Stop/go check:

- Preview URL opens from a clean browser profile.
- WalletConnect works on mobile and desktop.
- The preview app still targets Base Sepolia.
- The full tip journey succeeds on the preview URL.
- Browser console has no unhandled errors during connect, approve, tip, and receipt confirmation.

How this catches problems:

- Vercel env and browser-wallet domain issues often appear only on the hosted URL, not on localhost.

## 12. Final mainnet readiness review

Before touching Base mainnet, create a single launch issue or shared document with:

- Git commit SHA to deploy
- Deployer address
- Admin/owner address
- Fee recipient address
- Base native USDC address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Intended fee: `1%`
- Base Sepolia contract address
- Base Sepolia preview URL
- Mainnet RPC provider URL host, not the secret key
- Rollback plan: revert Vercel production to previous deployment, pause contract if supported, or hide tipping UI if contract has no pause

Commands:

```bash
git status --short
git rev-parse HEAD
yarn foundry:test
yarn lint
yarn next:build
cast chain-id --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "symbol()(string)" --rpc-url "$BASE_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
```

Stop/go check:

- Two people approve the exact commit SHA.
- Mainnet deployer has Base ETH.
- No uncommitted changes except local `.env` files.
- Rollback owner knows how to revert Vercel before mainnet deployment starts.

How this catches problems:

- The team agrees on what is being launched while there is still time to stop.

## 13. Switch config from Base Sepolia to Base mainnet

Edit `packages/nextjs/scaffold.config.ts`.

Change:

```ts
import { base } from "viem/chains";

targetNetworks: [base],
```

If using `* as chains`:

```ts
targetNetworks: [chains.base],
```

Update frontend env defaults/examples:

```bash
perl -0pi -e 's/NEXT_PUBLIC_CHAIN_ID=84532/NEXT_PUBLIC_CHAIN_ID=8453/g' packages/nextjs/.env.local.example
```

Review the diff:

```bash
git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/.env.local.example packages/foundry/foundry.toml packages/foundry/script
```

Stop/go check:

- `scaffold.config.ts` targets `base`, not `baseSepolia`, `hardhat`, or localhost.
- deploy script will use `BASE_USDC` for chain `8453`.
- fee/admin values are unchanged from the readiness review.

How this catches problems:

- This is the exact moment the app changes from rehearsal mode to real money mode.

## 14. Deploy to Base mainnet

Deploy:

```bash
export BASE_USDC="$BASE_USDC"
export BASE_SEPOLIA_USDC="$BASE_SEPOLIA_USDC"
export PLATFORM_FEE_RECIPIENT="$PLATFORM_FEE_RECIPIENT"
yarn deploy --network base --keystore "$DEPLOYER_KEYSTORE"
```

If your deployment file is not the default:

```bash
yarn deploy --network base --keystore "$DEPLOYER_KEYSTORE" --file DeployYourContract.s.sol
```

Capture the deployed mainnet address:

```bash
export BASE_TIPPING_ADDRESS="$(node - <<'NODE'
const fs = require("fs");
const name = process.env.CONTRACT_NAME;
const text = fs.readFileSync("./packages/nextjs/contracts/deployedContracts.ts", "utf8");
const chainAt = text.search(/8453\s*:/);
if (chainAt < 0) throw new Error("Missing chain 8453 in deployedContracts.ts");
const rest = text.slice(chainAt);
const contractAt = Math.max(rest.indexOf(`${name}:`), rest.indexOf(`"${name}":`), rest.indexOf(`'${name}':`));
if (contractAt < 0) throw new Error(`Missing ${name} deployment for chain 8453`);
const match = rest.slice(contractAt).match(/address\s*:\s*["'](0x[a-fA-F0-9]{40})["']/);
if (!match) throw new Error(`Missing ${name} address for chain 8453`);
console.log(match[1]);
NODE
)"
echo "$BASE_TIPPING_ADDRESS"
```

If the extractor cannot handle your generated file shape:

```bash
rg -n "8453|$CONTRACT_NAME|address" packages/nextjs/contracts/deployedContracts.ts
```

Stop/go check:

```bash
test -n "$BASE_TIPPING_ADDRESS"
cast code "$BASE_TIPPING_ADDRESS" --rpc-url "$BASE_RPC_URL" | wc -c
cast call "$BASE_TIPPING_ADDRESS" "owner()(address)" --rpc-url "$BASE_RPC_URL" || true
cast call "$BASE_TIPPING_ADDRESS" "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL" || true
cast call "$BASE_TIPPING_ADDRESS" "usdc()(address)" --rpc-url "$BASE_RPC_URL" || true
git diff -- packages/nextjs/contracts/deployedContracts.ts
```

Expected:

- `cast code` byte count is greater than `3`
- getters, if present, match the approved owner/admin, 1% fee, and `BASE_USDC`
- `deployedContracts.ts` contains chain `8453` and the new contract address

How this catches problems:

- It confirms that the address the frontend will use actually has deployed bytecode on Base mainnet.

## 15. Verify the Base mainnet contract

```bash
export BASESCAN_API_KEY="<basescan-api-key>"
yarn verify --network base
```

Stop/go check:

```bash
echo "$BASESCAN_URL/address/$BASE_TIPPING_ADDRESS#code"
```

Expected:

- Basescan shows verified source.
- Constructor args match the approved values.
- Contract tab can read public getters.

How this catches problems:

- Public verification catches accidental wrong constructor args before the production frontend points users at the contract.

## 16. Commit the mainnet deployment artifacts

```bash
git status --short
git add packages/foundry/foundry.toml packages/foundry/script packages/nextjs/scaffold.config.ts packages/nextjs/.env.local.example packages/nextjs/contracts/deployedContracts.ts
git commit -m "Deploy creator tipping app to Base"
git tag "base-mainnet-$(date -u +%Y%m%d-%H%M)"
```

Stop/go check:

```bash
git show --stat --oneline HEAD
git status --short
```

Expected:

- commit contains the deployment artifact and intentional config changes
- no secrets committed
- working tree is clean except ignored `.env` files

How this catches problems:

- The public frontend build must be reproducible from Git, including the generated `deployedContracts.ts`.

## 17. Deploy a production preview against Base mainnet

Set Vercel production env vars:

```bash
yarn vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
yarn vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY production
yarn vercel env add NEXT_PUBLIC_BASE_RPC_URL production
yarn vercel env add NEXT_PUBLIC_CHAIN_ID production
```

Use these values:

- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `NEXT_PUBLIC_ALCHEMY_API_KEY=<mainnet provider key if used>`
- `NEXT_PUBLIC_BASE_RPC_URL=$NEXT_PUBLIC_BASE_RPC_URL`
- `NEXT_PUBLIC_CHAIN_ID=8453`

Create a non-production Vercel preview from the mainnet config first:

```bash
yarn vercel
```

Stop/go check on the preview URL:

- App displays Base mainnet.
- It points to `$BASE_TIPPING_ADDRESS`.
- Wallet connect works.
- Read-only creator/profile pages load.
- No user-facing copy says "testnet", "localhost", "Sepolia", or "fork".
- Do not send a real tip yet from the preview unless both teammates agree.

How this catches problems:

- This checks production config without burning the production domain cutover.

## 18. Production deploy

Deploy to the production URL:

```bash
yarn vercel --prod
```

If the build fails only because of a known non-user-facing type/lint issue, fix it instead of using `yarn vercel:yolo --prod`. Only use `yarn vercel:yolo --prod` if both teammates explicitly approve the risk in the launch issue.

Capture the production URL:

```bash
yarn vercel ls
```

Stop/go check:

- Production URL opens in a clean browser profile.
- App shows Base mainnet.
- App uses `$BASE_TIPPING_ADDRESS`.
- Browser console has no connect or contract-read errors.
- Mobile wallet connection works.

How this catches problems:

- Users see the same URL and env vars you just tested.

## 19. Mainnet smoke test with real USDC

Use tiny amounts. Suggested first tip: `0.10 USDC`.

Set up:

- fan wallet: small Base ETH for gas and `0.10-1.00 USDC`
- creator wallet: separate wallet
- platform fee recipient: approved treasury wallet

Browser flow:

- Connect fan wallet on production URL.
- Confirm wallet shows Base, chain ID `8453`.
- Approve exactly the smoke-test USDC amount if possible.
- Send the tiny tip.
- Wait for the receipt in the UI.
- Check creator balance/claim flow.
- Check platform fee balance.

CLI checks:

```bash
export FAN_ADDRESS="0x..."       # smoke-test fan wallet
export CREATOR_ADDRESS="0x..."   # smoke-test creator wallet

cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FAN_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$PLATFORM_FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
```

Stop/go check:

- Tip transaction succeeds from production URL.
- Creator receives 99% or can claim 99%, depending on app design.
- Platform receives 1%.
- UI state updates after confirmation.
- Repeated refresh shows the same on-chain state.
- Basescan shows expected USDC `Transfer` events involving native `BASE_USDC`, not USDbC.

How this catches problems:

- This catches the last class of issues: real wallet, real USDC allowance, real Base mainnet, real hosted domain.

## 20. Post-launch monitoring for the first hour

For the first hour after production smoke test, one teammate watches app behavior and one watches on-chain activity.

App checks:

```bash
yarn vercel logs --prod
```

On-chain checks:

```bash
watch -n 15 "cast block-number --rpc-url '$BASE_RPC_URL' && cast balance '$DEPLOYER_ADDRESS' --rpc-url '$BASE_RPC_URL' --ether"
```

Explorer checks:

- `$BASESCAN_URL/address/$BASE_TIPPING_ADDRESS`
- `$BASESCAN_URL/token/$BASE_USDC?a=$BASE_TIPPING_ADDRESS`
- Vercel analytics/errors, if enabled
- RPC provider dashboard for rate limits and failed requests

Stop/go check:

- No unexpected reverts in normal tip flow.
- No spike of failed RPC requests.
- No complaints that users are asked for the wrong network or wrong token.
- Contract USDC balance behavior matches the app design.

How this catches problems:

- You catch misconfiguration and provider limits while the user count is still small.

## 21. Rollback and incident actions

Use this only if smoke tests or early monitoring find a production-impacting issue.

Frontend-only issue:

```bash
yarn vercel rollback
```

Or use the Vercel dashboard to promote the last known-good deployment.

Wrong frontend contract address:

```bash
git revert HEAD
git push origin launch/base-mainnet
yarn vercel --prod
```

Contract has a pause switch:

```bash
cast send "$BASE_TIPPING_ADDRESS" "pause()" --account "$DEPLOYER_KEYSTORE" --rpc-url "$BASE_RPC_URL"
```

Contract has owner-controlled fee recipient and it is wrong:

```bash
cast send "$BASE_TIPPING_ADDRESS" "setPlatformFeeRecipient(address)" "$PLATFORM_FEE_RECIPIENT" --account "$DEPLOYER_KEYSTORE" --rpc-url "$BASE_RPC_URL"
```

Contract has no pause and wrong immutable constructor values:

- Remove/hide the tipping UI in the frontend.
- Deploy a corrected contract.
- Verify it.
- Update `packages/nextjs/contracts/deployedContracts.ts`.
- Redeploy production.
- Post a short public note if any real user transaction was affected.

Stop/go check:

- Do not delete the bad deployment artifact from Git. Keep it for auditability.
- Do not ask users to approve or tip again until the corrected production URL has passed the mainnet smoke test.

## 22. Clean handoff

After launch is healthy:

```bash
git push origin launch/base-mainnet --tags
git status --short
```

Store in the team password manager or launch issue:

- production URL
- Base contract address
- Basescan verified contract URL
- deployer address
- admin/owner address
- fee recipient address
- Vercel project link
- RPC provider dashboard link
- WalletConnect project link
- exact smoke-test transaction hash

Final stop/go check:

- Both teammates can independently find the production contract, production URL, and rollback control.
- At least one teammate who did not deploy can complete a read-only app check from a clean browser.
