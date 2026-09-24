# Launch Runbook: Scaffold-ETH 2 Foundry App on Base

This is the ordered path from "works locally on a fork" to "real users can tip creators with USDC on a public URL".

Run the commands from the real app repo root, not from this evaluation directory. Stop at every gate until the check passes. Do not skip the Base Sepolia rehearsal; it is where we catch wrong-network, wrong-token, verification, wallet, and frontend deployment mistakes before they become mainnet mistakes.

## Production Constants

Canonical Base values checked on 2026-09-24:

```bash
export BASE_CHAIN_ID=8453
export BASE_SEPOLIA_CHAIN_ID=84532
export BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
export PLATFORM_FEE_BPS=100
```

`PLATFORM_FEE_BPS=100` means 1%. Native Base USDC has 6 decimals. The Base USDC address above is Circle-issued native USDC, not bridged USDbC.

Fill these once before starting:

```bash
export APP_REPO="$PWD"
export CONTRACT_NAME="CreatorTips"                  # Replace with the exact Solidity contract name.
export CONTRACT_FILE="packages/foundry/contracts/CreatorTips.sol"
export DEPLOY_SCRIPT="Deploy.s.sol"                 # Usually packages/foundry/script/Deploy.s.sol.
export FEE_RECIPIENT="0x..."                        # Production fee wallet, ideally a Base Safe.
export PROTOCOL_OWNER="0x..."                       # Production owner/admin, ideally a Base Safe.
export TEST_CREATOR="0x..."                         # Team-controlled creator wallet.
export TEST_FAN="0x..."                             # Team-controlled fan wallet.
export PROD_URL="https://your-domain.example"
```

## 1. Create the Production Operating Accounts

1. Create three wallets/accounts:
   - `DEPLOYER`: new EOA used only for deployment.
   - `PROTOCOL_OWNER`: Safe or hardware wallet account that owns admin powers.
   - `FEE_RECIPIENT`: Safe or finance wallet that receives the 1% platform fee.

2. Generate or import the deployer in the SE-2 repo:

```bash
yarn generate
yarn account
```

If you already have the deployer private key:

```bash
yarn account:import
yarn account
```

3. Put secrets in a password manager. Do not commit private keys or `.env` files.

Gate before continuing:

```bash
git status --short
rg -n "DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|mnemonic|seed phrase|0x[a-fA-F0-9]{64}" .
```

Expected:

- `git status --short` contains only intended source changes.
- `rg` does not find a real private key or seed phrase.

How this catches failures:

- Prevents launching with the default local account.
- Prevents a deployer key from being accidentally committed.

## 2. Create Provider, Explorer, Wallet, and Hosting Credentials

Create:

- Production Base RPC URL from Alchemy, Infura, QuickNode, Coinbase Developer Platform, or another provider. Do not depend on `https://mainnet.base.org` for production traffic; public endpoints are rate-limited.
- Base Sepolia RPC URL from the same provider.
- Basescan API key for verification.
- WalletConnect/Reown project id for RainbowKit wallet connections.
- Vercel project for the frontend.
- Optional custom domain.

Create root `.env` or package-specific `.env` files according to your repo pattern. For a stock SE-2 Foundry app, use:

```bash
cp packages/foundry/.env.example packages/foundry/.env 2>/dev/null || touch packages/foundry/.env
cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || touch packages/nextjs/.env.local
```

Put this in `packages/foundry/.env`:

```bash
DEPLOYER_PRIVATE_KEY=0x...
BASE_RPC_URL=https://your-provider.example/base-mainnet
BASE_SEPOLIA_RPC_URL=https://your-provider.example/base-sepolia
BASESCAN_API_KEY=...
FEE_RECIPIENT=0x...
PROTOCOL_OWNER=0x...
```

Put this in `packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
NEXT_PUBLIC_ALCHEMY_API_KEY=...
NEXT_PUBLIC_TARGET_NETWORK=baseSepolia
```

Gate:

```bash
source packages/foundry/.env
cast chain-id --rpc-url "$BASE_RPC_URL"
cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$BASE_USDC" "symbol()(string)" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_SEPOLIA_USDC" "symbol()(string)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$BASE_SEPOLIA_USDC" "decimals()(uint8)" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected:

- Mainnet chain id is `8453`.
- Sepolia chain id is `84532`.
- Both token symbols are `USDC`.
- Both token decimals are `6`.

How this catches failures:

- Finds a provider URL pointed at the wrong network.
- Finds accidental USDbC or mock-token configuration before deployment.

## 3. Add Base Networks to Foundry

Edit `packages/foundry/foundry.toml` so it has these sections:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
baseSepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api", chain = 8453 }
baseSepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api", chain = 84532 }
```

If the file already has `[rpc_endpoints]` or `[etherscan]`, merge these entries into the existing sections instead of creating duplicate sections.

Gate:

```bash
source packages/foundry/.env
cd packages/foundry
forge config
cast chain-id --rpc-url base
cast chain-id --rpc-url baseSepolia
cd ../..
```

Expected:

- `cast chain-id --rpc-url base` returns `8453`.
- `cast chain-id --rpc-url baseSepolia` returns `84532`.

## 4. Make Deployment Script Chain-Aware

Edit `packages/foundry/script/$DEPLOY_SCRIPT`.

The deploy script must:

- Read `DEPLOYER_PRIVATE_KEY` from env.
- Use native Base USDC on chain `8453`.
- Use Base Sepolia test USDC on chain `84532`.
- Set the fee to `100` basis points.
- Set owner/admin and fee recipient from env.
- Revert if any required address is zero.

Use this shape, adapted to your exact constructor:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {CreatorTips} from "../contracts/CreatorTips.sol";

contract Deploy is Script {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    uint16 internal constant PLATFORM_FEE_BPS = 100;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address protocolOwner = vm.envAddress("PROTOCOL_OWNER");

        require(feeRecipient != address(0), "FEE_RECIPIENT_ZERO");
        require(protocolOwner != address(0), "PROTOCOL_OWNER_ZERO");

        address usdc;
        if (block.chainid == 8453) {
            usdc = BASE_USDC;
        } else if (block.chainid == 84532) {
            usdc = BASE_SEPOLIA_USDC;
        } else {
            revert("UNSUPPORTED_CHAIN");
        }

        vm.startBroadcast(deployerPrivateKey);

        new CreatorTips(
            usdc,
            feeRecipient,
            PLATFORM_FEE_BPS,
            protocolOwner
        );

        vm.stopBroadcast();
    }
}
```

If your constructor does not take `protocolOwner`, deploy and then call the ownership setter/transfer in the same broadcast. Do not leave ownership on the deployer unless that is explicitly the production design.

Gate:

```bash
source packages/foundry/.env
cd packages/foundry
forge build
forge script "script/$DEPLOY_SCRIPT" --rpc-url "$BASE_SEPOLIA_RPC_URL" -vvvv
forge script "script/$DEPLOY_SCRIPT" --rpc-url "$BASE_RPC_URL" -vvvv
cd ../..
```

Expected:

- Both dry runs complete without broadcasting.
- The logs or traces show the constructor uses the expected USDC, fee recipient, owner, and fee.

How this catches failures:

- A wrong constructor argument is visible before it is immutable on mainnet.
- Unsupported chain ids fail closed instead of silently deploying with a local/mock address.

## 5. Add Frontend Network Configuration

Edit `packages/nextjs/scaffold.config.ts`.

For the Base Sepolia rehearsal:

```ts
import { baseSepolia } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [baseSepolia],
  pollingInterval: 30000,
  onlyLocalBurnerWallet: false,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
} as const satisfies ScaffoldConfig;
```

For production, later change `baseSepolia` to `base`:

```ts
import { base } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [base],
  pollingInterval: 30000,
  onlyLocalBurnerWallet: false,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
} as const satisfies ScaffoldConfig;
```

If your repo imports chains through `~~/utils/scaffold-eth/chains`, use the local pattern and keep the same values.

If the frontend uses USDC directly for balances or approvals, edit `packages/nextjs/contracts/externalContracts.ts` so both Base networks point to Circle USDC:

```ts
const erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const externalContracts = {
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: erc20Abi,
    },
  },
  84532: {
    USDC: {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      abi: erc20Abi,
    },
  },
} as const;

export default externalContracts;
```

Gate:

```bash
rg -n "31337|localhost|hardhat|MockUSDC|USDbC|0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" packages
yarn lint
yarn next:build
```

Expected:

- No production path references local chain id `31337`, localhost, mock USDC, or USDbC.
- Lint and build pass.

If `rg` finds local-only code in tests or docs, that is fine. If it finds local-only code in app runtime, fix it before continuing.

## 6. Run the Full Local Quality Gate

Run:

```bash
yarn install --immutable
yarn compile
yarn test
yarn lint
yarn next:build
cd packages/foundry
forge test -vvv
forge coverage
cd ../..
```

Add or confirm tests for these invariants:

- Tipping `1_000_000` USDC units sends `990_000` to the creator and `10_000` to the platform fee recipient.
- Fee math is exact for small tips and does not round the total above the user's input.
- Contract rejects zero creator, zero amount, and unsupported token/chain assumptions.
- Owner-only functions cannot be called by fan or creator accounts.
- The contract does not retain USDC unexpectedly after a normal tip, unless escrow is intentional.

Gate:

- All commands pass.
- Coverage is acceptable for the money path. For a two-person team, do not ship the tip/fee path unless it has direct unit tests.

How this catches failures:

- Catches fee math and access-control bugs before testnet.
- Catches frontend type/config issues before deployment.

## 7. Fund Testnet Wallets and Rehearse on Base Sepolia

Fund:

- `DEPLOYER` with Base Sepolia ETH.
- `TEST_FAN` with Base Sepolia ETH and Base Sepolia test USDC.
- `TEST_CREATOR` with Base Sepolia ETH only if the UI needs creator actions.

Check balances:

```bash
source packages/foundry/.env
export DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL" --ether
cast balance "$TEST_FAN" --erc20 "$BASE_SEPOLIA_USDC" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast balance "$TEST_CREATOR" --erc20 "$BASE_SEPOLIA_USDC" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast balance "$FEE_RECIPIENT" --erc20 "$BASE_SEPOLIA_USDC" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Gate:

- Deployer has enough testnet ETH for deployment.
- Fan has enough testnet USDC for at least three tips.
- Creator and fee recipient balances are recorded before the smoke test.

## 8. Deploy to Base Sepolia

Run from repo root:

```bash
source packages/foundry/.env
yarn deploy --network baseSepolia
yarn verify --network baseSepolia
```

If `yarn deploy --network baseSepolia` does not work, stop and fix the SE-2 Foundry network config or package script until it does. Do not bypass it with a raw `forge script --broadcast` unless you also have a repo-specific artifact sync step; the frontend must receive the generated deployment data.

After fixing the config, rerun the two commands above.

Gate:

```bash
rg -n "84532|baseSepolia|$BASE_SEPOLIA_USDC" packages/nextjs/contracts packages/foundry/broadcast packages/foundry/deployments
git diff -- packages/nextjs/contracts/deployedContracts.ts
```

Expected:

- A new Base Sepolia deployment address exists.
- `packages/nextjs/contracts/deployedContracts.ts` contains chain id `84532`.
- The deployed contract is verified on Base Sepolia explorer.

How this catches failures:

- Prevents deploying contracts while the frontend still points to old/local artifacts.
- Prevents shipping an unverified contract that users cannot inspect.

## 9. Rehearse the Public Frontend on a Vercel Preview URL

Set Vercel environment variables for Preview:

```bash
set -a
source packages/nextjs/.env.local
set +a
cd packages/nextjs
npx vercel@latest login
npx vercel@latest link
printf "%s" "$NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID" | npx vercel@latest env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID preview
printf "%s" "$NEXT_PUBLIC_ALCHEMY_API_KEY" | npx vercel@latest env add NEXT_PUBLIC_ALCHEMY_API_KEY preview
printf "%s" "baseSepolia" | npx vercel@latest env add NEXT_PUBLIC_TARGET_NETWORK preview
npx vercel@latest env pull .env.local
cd ../..
```

Deploy Preview:

```bash
cd packages/nextjs
npx vercel@latest
cd ../..
```

Gate on the preview URL:

```bash
export PREVIEW_URL="https://the-preview-url.vercel.app"
curl -fsSL "$PREVIEW_URL" >/tmp/creator-tips-preview.html
rg -n "localhost|31337|hardhat|MockUSDC|USDbC|0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" /tmp/creator-tips-preview.html
```

Expected:

- Page loads over HTTPS.
- Wallet connects to Base Sepolia.
- No local chain or wrong USDC references appear in the rendered HTML.

Then complete the human smoke test:

1. Connect `TEST_FAN`.
2. Confirm the wallet prompts for Base Sepolia, not mainnet.
3. Tip `TEST_CREATOR` with `1.00` test USDC.
4. Confirm exactly two transactions if your flow is approve-then-tip, or one if allowance already exists.
5. Confirm wallet simulation shows USDC, not ETH.
6. Confirm success UI only after the transaction is mined.

Check balances:

```bash
cast balance "$TEST_CREATOR" --erc20 "$BASE_SEPOLIA_USDC" --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast balance "$FEE_RECIPIENT" --erc20 "$BASE_SEPOLIA_USDC" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Expected for a `1.00` USDC tip:

- Creator receives `0.99` USDC, or `990000` raw units.
- Fee recipient receives `0.01` USDC, or `10000` raw units.
- No unexpected USDC remains trapped in the contract unless that is the product design.

How this catches failures:

- Finds wallet-network mismatch, bad ABIs, bad deployed addresses, wrong token decimals, approval issues, and broken success states.

## 10. Mainnet Go/No-Go Review

Do this together, live, with both team members looking at the same screen.

Run:

```bash
git status --short
git diff -- packages/foundry packages/nextjs
yarn compile
yarn test
yarn lint
yarn next:build
cd packages/foundry
forge test -vvv
cd ../..
source packages/foundry/.env
cast chain-id --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "symbol()(string)" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
```

Verify manually:

- `FEE_RECIPIENT` is correct and controlled by the team.
- `PROTOCOL_OWNER` is correct and controlled by the team.
- `DEPLOYER_PRIVATE_KEY` belongs to the deployment EOA, not a personal wallet with unrelated funds.
- `BASE_RPC_URL` is a production provider URL, not the public rate-limited endpoint.
- Frontend production config will use `base`, not `baseSepolia`.
- Native Base USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Fee is `100` bps.
- Sepolia smoke test passed end-to-end.

Go only if both people agree. If anything feels off, stop.

## 11. Fund Mainnet Wallets

Fund:

- `DEPLOYER` with enough ETH on Base for deployment and verification retries.
- `TEST_FAN` with a small amount of Base ETH and native Base USDC.
- `TEST_CREATOR` with Base ETH only if needed.

Recommended first funding: keep it small. For example, fund deployer with enough ETH for a few deployments and fund `TEST_FAN` with `2.00` to `5.00` USDC for smoke tests.

Check:

```bash
source packages/foundry/.env
export DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
cast balance "$TEST_FAN" --rpc-url "$BASE_RPC_URL" --ether
cast balance "$TEST_FAN" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
cast balance "$TEST_CREATOR" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
cast balance "$FEE_RECIPIENT" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
```

Gate:

- Deployer has Base ETH.
- Fan has Base ETH and native Base USDC.
- Creator and fee recipient pre-test balances are recorded.

How this catches failures:

- Prevents failed deployment from insufficient gas.
- Prevents a smoke test with bridged USDbC or funds on the wrong chain.

## 12. Deploy to Base Mainnet

Dry run one final time:

```bash
source packages/foundry/.env
cd packages/foundry
forge script "script/$DEPLOY_SCRIPT" --rpc-url "$BASE_RPC_URL" -vvvv
cd ../..
```

Broadcast through SE-2:

```bash
source packages/foundry/.env
yarn deploy --network base
yarn verify --network base
```

If verification fails because the explorer lags, wait two minutes and retry:

```bash
yarn verify --network base
```

Gate:

```bash
rg -n "8453|base|$BASE_USDC" packages/nextjs/contracts packages/foundry/broadcast packages/foundry/deployments
git diff -- packages/nextjs/contracts/deployedContracts.ts
```

Expected:

- A Base mainnet contract address exists.
- `packages/nextjs/contracts/deployedContracts.ts` contains chain id `8453`.
- The contract is verified on Basescan or Base Blockscout.
- The deployed constructor/config values match `BASE_USDC`, `FEE_RECIPIENT`, `PROTOCOL_OWNER`, and `100` bps.

If your contract exposes config getters, read them:

```bash
export TIPS_CONTRACT="0x..." # mainnet deployed contract
cast call "$TIPS_CONTRACT" "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$TIPS_CONTRACT" "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$TIPS_CONTRACT" "platformFeeBps()(uint16)" --rpc-url "$BASE_RPC_URL"
```

If getter names differ, use the actual names. Do not proceed until the deployed config is read back from chain.

## 13. Switch Frontend to Production Base

Edit `packages/nextjs/scaffold.config.ts`:

```ts
import { base } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [base],
  pollingInterval: 30000,
  onlyLocalBurnerWallet: false,
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
} as const satisfies ScaffoldConfig;
```

Edit `packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_TARGET_NETWORK=base
```

Run:

```bash
yarn lint
yarn next:build
rg -n "baseSepolia|84532|localhost|31337|hardhat" packages/nextjs/scaffold.config.ts packages/nextjs/.env.local
rg -n "MockUSDC|USDbC|0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" packages/nextjs/app packages/nextjs/components packages/nextjs/hooks packages/nextjs/contracts
```

Expected:

- `scaffold.config.ts` and `.env.local` do not point at Base Sepolia or local networks.
- Runtime app code does not point at mock USDC or USDbC.
- `externalContracts.ts` may still contain a Base Sepolia USDC entry for future preview deployments; that is fine as long as `targetNetworks` is production Base.

Commit the release:

```bash
git status --short
git add packages/foundry packages/nextjs
git commit -m "Deploy creator tipping app to Base"
git tag "base-mainnet-$(date +%Y%m%d-%H%M)"
```

## 14. Configure Production Hosting

Set Vercel production env vars:

```bash
set -a
source packages/nextjs/.env.local
set +a
cd packages/nextjs
printf "%s" "$NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID" | npx vercel@latest env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
printf "%s" "$NEXT_PUBLIC_ALCHEMY_API_KEY" | npx vercel@latest env add NEXT_PUBLIC_ALCHEMY_API_KEY production
printf "%s" "base" | npx vercel@latest env add NEXT_PUBLIC_TARGET_NETWORK production
npx vercel@latest env pull .env.local
cd ../..
```

If using a custom domain:

```bash
cd packages/nextjs
npx vercel@latest domains add your-domain.example
cd ../..
```

Deploy production:

```bash
cd packages/nextjs
npx vercel@latest --prod
cd ../..
```

If your SE-2 repo uses the built-in script and it is already configured, this is also acceptable:

```bash
yarn vercel:yolo --prod
```

Gate:

```bash
curl -fsSL "$PROD_URL" >/tmp/creator-tips-prod.html
rg -n "baseSepolia|84532|localhost|31337|hardhat|MockUSDC|USDbC|0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" /tmp/creator-tips-prod.html
```

Expected:

- Production URL loads.
- No testnet/local/wrong-token strings appear in rendered HTML.
- WalletConnect works from the production domain.

How this catches failures:

- Finds missing Vercel env vars.
- Finds accidental deployment of the Sepolia build.
- Finds domain restrictions in wallet/RPC provider dashboards.

## 15. Mainnet Smoke Test Before Announcement

Use tiny real funds. Do this before posting the URL publicly.

1. Open `PROD_URL` in a clean browser profile.
2. Connect `TEST_FAN`.
3. Confirm wallet is on Base mainnet.
4. Confirm the UI shows native USDC and the production contract address.
5. Tip `TEST_CREATOR` with `1.00` USDC.
6. Wait for final UI success and explorer confirmation.

Record balances before and after:

```bash
cast balance "$TEST_CREATOR" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
cast balance "$FEE_RECIPIENT" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
```

Expected for a `1.00` USDC tip:

- Creator receives `0.99` USDC, or `990000` raw units.
- Fee recipient receives `0.01` USDC, or `10000` raw units.
- If the contract should not hold funds, its USDC balance is zero:

```bash
cast balance "$TIPS_CONTRACT" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
```

Also test failure states:

- Try tipping more USDC than the fan has. UI should show a readable failure and not claim success.
- Reject the approve transaction. UI should recover.
- Reject the tip transaction. UI should recover.
- Switch wallet to the wrong network. UI should prompt for Base.

Gate:

- Mainnet tiny-tip path passes.
- Failure states are understandable.
- No unexpected balances remain in the contract.

## 16. Turn On Basic Monitoring

Before public announcement:

1. In the RPC provider dashboard, set usage and error-rate alerts.
2. In Vercel, confirm production deployment logs are clean.
3. In Basescan or your monitoring tool, watch:
   - Production contract address.
   - `FEE_RECIPIENT`.
   - Any admin/owner address.
4. Add a team bookmark folder:
   - Production URL.
   - Basescan contract page.
   - Vercel deployment.
   - RPC provider dashboard.
   - WalletConnect/Reown dashboard.

Minimum recurring canary:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
cast block-number --rpc-url "$BASE_RPC_URL"
```

Gate:

- Both team members know where to see frontend errors, RPC errors, and on-chain transactions.

## 17. Publish

Only after the mainnet smoke test passes:

1. Remove any "testnet", "beta funds", or "localhost" copy from the UI.
2. Publish the URL.
3. Keep both team members available for the first hour.
4. Watch the first real user transaction from connect through confirmation.

First-hour checks:

```bash
cast block-number --rpc-url "$BASE_RPC_URL"
cast balance "$FEE_RECIPIENT" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
cast balance "$TIPS_CONTRACT" --erc20 "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
```

Expected:

- RPC is healthy.
- Fees arrive at `FEE_RECIPIENT`.
- Contract does not accumulate USDC unexpectedly.

## 18. If Something Goes Wrong

Frontend-only issue:

1. Do not redeploy contracts.
2. Fix frontend.
3. Run `yarn lint && yarn next:build`.
4. Deploy a new Vercel production build.
5. Smoke test again.

Wrong frontend network:

1. Update `packages/nextjs/scaffold.config.ts` to `base`.
2. Confirm `deployedContracts.ts` has chain id `8453`.
3. Rebuild and redeploy frontend.

Verification failure:

1. Confirm constructor args and compiler settings.
2. Retry `yarn verify --network base`.
3. If needed, use the exact `forge verify-contract` command printed by Foundry or Basescan.
4. Do not announce until source is verified.

Wrong immutable constructor value on mainnet:

1. Stop launch.
2. Do not point the frontend at the bad contract.
3. Fix deploy config.
4. Redeploy a new contract.
5. Verify it.
6. Update `deployedContracts.ts`.
7. Repeat the mainnet smoke test.

Compromised deployer key:

1. Stop using it immediately.
2. Move any remaining ETH out if possible.
3. Generate a new deployer.
4. If the deployer owns any live admin role, transfer that role to `PROTOCOL_OWNER`.

Fee recipient or owner wrong:

1. If contract has setters and the current owner is safe, correct it immediately.
2. If immutable or not recoverable, stop launch and redeploy.
3. Do not accept user funds through a contract with unrecoverable wrong fee/admin configuration.

## Source References

- Base chain ids: `8453` mainnet and `84532` Sepolia: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Base RPC/network information and production caveat for public endpoints: https://basehub.org/api-reference/rpc-overview/
- Circle USDC contract addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Scaffold-ETH 2 Foundry layout and deploy commands: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md
