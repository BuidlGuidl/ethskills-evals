# Launch runbook: Creator tipping app on Base

This is the ordered path from a working local-fork Scaffold-ETH 2 Foundry app to real users on a public production URL.

Before running commands in the real repo, replace every `<...>` placeholder with a real value. Do not continue with literal angle-bracket placeholders in your shell, `.env`, Vercel, or Solidity files.

It assumes:

- The repo is a Scaffold-ETH 2 Foundry project with `packages/foundry` and `packages/nextjs`.
- The app lets fans tip creators in USDC and charges a 1% platform fee.
- Production chain is Base mainnet, chain id `8453`.
- Staging chain is Base Sepolia, chain id `84532`.
- Native USDC on Base mainnet is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Test USDC on Base Sepolia is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

Reference links checked on 2026-09-24:

- Scaffold-ETH 2 deploy flow: https://speedrunethereum.com/guides/build-an-ethereum-app-in-8-minutes
- Scaffold-ETH 2 repo/docs: https://github.com/scaffold-eth/scaffold-eth-2 and https://docs.scaffoldeth.io/
- Base chain ids: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Circle Base USDC: https://www.circle.com/multi-chain-usdc/base
- Foundry verification: https://getfoundry.sh/forge/reference/verify-contract/

## 0. Rules for this launch

Do not skip Base Sepolia. Do not deploy from a private key pasted into a `.env` file. Do not make the production frontend public until the mainnet contract is verified and a small real-USDC tip has passed.

Use two people:

- Operator: runs commands and controls the deployer keystore.
- Reviewer: reads every address aloud, compares it to this document, and signs off before any live transaction.

Use these canonical units:

- USDC has `6` decimals.
- `1 USDC = 1_000_000` raw units.
- `1% fee = 100` basis points.
- For a `1_000_000` raw-unit tip, expected fee is `10_000`, expected creator amount is `990_000`.

## 1. Create a launch branch and freeze scope

Run from the real app repo root:

```bash
git checkout main
git pull
git checkout -b launch/base-mainnet
git status --short
```

Check before moving on:

- `git status --short` only shows changes you expect.
- No feature work is included in this branch except launch configuration, deployment scripts, tests, and production hardening.

If this catches a problem:

- If there are unrelated changes, stop and split them out before continuing. The launch branch should be reviewable in one sitting.

## 2. Confirm toolchain and install dependencies

```bash
node --version
yarn --version
forge --version
cast --version
yarn install --immutable
```

Check before moving on:

- Node satisfies the repo's `package.json` `engines` field.
- `yarn install --immutable` exits cleanly.
- `forge` and `cast` are installed and callable.

If this catches a problem:

- Run `foundryup` for Foundry issues.
- Use the Node version expected by the repo before touching launch code.

## 3. Set launch constants in the shell

Keep these exports in the terminal used for checks. They do not replace repo config; they make the commands below copy-pasteable.

```bash
export BASE_CHAIN_ID=8453
export BASE_SEPOLIA_CHAIN_ID=84532
export BASE_MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
export PLATFORM_FEE_BPS=100

# Fill these with your real addresses before continuing.
export PLATFORM_FEE_RECIPIENT_BASE=<base-safe-or-fee-wallet>
export PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA=<base-sepolia-fee-wallet>
export CONTRACT_OWNER_BASE=<base-safe-or-owner-wallet>
export CONTRACT_OWNER_BASE_SEPOLIA=<base-sepolia-owner-wallet>

# Use the actual deployed contract name as it appears in Solidity.
export TIP_CONTRACT_NAME=<CreatorTippingContractName>
```

Check before moving on:

```bash
test "$PLATFORM_FEE_RECIPIENT_BASE" != "<base-safe-or-fee-wallet>"
test "$PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA" != "<base-sepolia-fee-wallet>"
test "$CONTRACT_OWNER_BASE" != "<base-safe-or-owner-wallet>"
test "$CONTRACT_OWNER_BASE_SEPOLIA" != "<base-sepolia-owner-wallet>"
test "$TIP_CONTRACT_NAME" != "<CreatorTippingContractName>"

cast to-check-sum-address $PLATFORM_FEE_RECIPIENT_BASE >/dev/null
cast to-check-sum-address $PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA >/dev/null
cast to-check-sum-address $CONTRACT_OWNER_BASE >/dev/null
cast to-check-sum-address $CONTRACT_OWNER_BASE_SEPOLIA >/dev/null
```

If this catches a problem:

- Decide the production fee recipient and production owner now. For a two-person team, use a Base Safe if the contract has owner/admin powers.

## 4. Verify Base and USDC facts from RPC

```bash
cast chain-id --rpc-url https://mainnet.base.org
cast chain-id --rpc-url https://sepolia.base.org

cast call $BASE_MAINNET_USDC "symbol()(string)" --rpc-url https://mainnet.base.org
cast call $BASE_MAINNET_USDC "decimals()(uint8)" --rpc-url https://mainnet.base.org
cast call $BASE_SEPOLIA_USDC "symbol()(string)" --rpc-url https://sepolia.base.org
cast call $BASE_SEPOLIA_USDC "decimals()(uint8)" --rpc-url https://sepolia.base.org
```

Check before moving on:

- Mainnet chain id output is `8453`.
- Sepolia chain id output is `84532`.
- Both token symbols are `USDC`.
- Both token decimals are `6`.

If this catches a problem:

- Stop. Do not deploy against an RPC or token address that does not return these values.

## 5. Add production RPC and verification config

Edit `packages/foundry/.env`:

```dotenv
ALCHEMY_API_KEY=<alchemy-api-key>
ETHERSCAN_API_KEY=<etherscan-v2-api-key>
BASE_RPC_URL=<paid-or-public-base-rpc-url>
BASE_SEPOLIA_RPC_URL=<paid-or-public-base-sepolia-rpc-url>
LOCALHOST_KEYSTORE_ACCOUNT=scaffold-eth-default
```

For quick setup, these RPC values are acceptable:

```dotenv
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

For production reliability, prefer a paid RPC with origin/app restrictions for frontend use and private dashboard monitoring for deploys.

Edit `packages/foundry/foundry.toml` so the Base endpoints are explicit:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
baseSepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base = { key = "${ETHERSCAN_API_KEY}" }
baseSepolia = { key = "${ETHERSCAN_API_KEY}" }
```

If the file already has other networks, keep them. Do not remove `localhost`.

Check before moving on:

```bash
cd packages/foundry
source .env
forge compile
cast chain-id --rpc-url base
cast chain-id --rpc-url baseSepolia
cd ../..
```

Expected:

- `forge compile` passes.
- `cast chain-id --rpc-url base` prints `8453`.
- `cast chain-id --rpc-url baseSepolia` prints `84532`.

If this catches a problem:

- Fix `foundry.toml` or `.env` before continuing. A bad RPC name here becomes a bad deployment target later.

## 6. Standardize contract deployment inputs

The deploy script must choose the USDC address, fee recipient, fee bps, and owner by chain id. This prevents accidental deployment with a localhost/fork address.

Edit the deploy script used by `packages/foundry/script/Deploy.s.sol`. If the repo already has a specific deploy script, import and call it from `Deploy.s.sol`; deploy mainnet through `Deploy.s.sol` so Scaffold-ETH ABI generation and `VerifyAll.s.sol` use the expected broadcast path.

Use this pattern inside the script that deploys the tipping contract, adapting only the constructor line to your real contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { console } from "forge-std/console.sol";
import "../contracts/<CreatorTippingContractName>.sol";

contract DeployCreatorTipping is ScaffoldETHDeploy {
    uint256 internal constant BASE = 8453;
    uint256 internal constant BASE_SEPOLIA = 84532;

    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    uint16 internal constant PLATFORM_FEE_BPS = 100;

    function run() external ScaffoldEthDeployerRunner {
        address usdc;
        address feeRecipient;
        address owner;

        if (block.chainid == BASE) {
            usdc = BASE_USDC;
            feeRecipient = vm.envAddress("PLATFORM_FEE_RECIPIENT_BASE");
            owner = vm.envAddress("CONTRACT_OWNER_BASE");
        } else if (block.chainid == BASE_SEPOLIA) {
            usdc = BASE_SEPOLIA_USDC;
            feeRecipient = vm.envAddress("PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA");
            owner = vm.envAddress("CONTRACT_OWNER_BASE_SEPOLIA");
        } else {
            usdc = vm.envAddress("USDC_ADDRESS");
            feeRecipient = vm.envAddress("PLATFORM_FEE_RECIPIENT");
            owner = vm.envAddress("CONTRACT_OWNER");
        }

        <CreatorTippingContractName> app = new <CreatorTippingContractName>(
            usdc,
            feeRecipient,
            PLATFORM_FEE_BPS,
            owner
        );

        // Optional only if the constructor cannot set owner:
        // app.transferOwnership(owner);

        console.log("Creator tipping contract:", address(app));
        console.log("USDC:", usdc);
        console.log("Fee recipient:", feeRecipient);
        console.log("Fee bps:", PLATFORM_FEE_BPS);
        console.log("Owner:", owner);
    }
}
```

Then make `packages/foundry/script/Deploy.s.sol` call this deployment:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployCreatorTipping.s.sol";
import "./DeployHelpers.s.sol";

contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        DeployCreatorTipping deployCreatorTipping = new DeployCreatorTipping();
        deployCreatorTipping.run();
    }
}
```

Contract requirement for later checks:

- The deployed contract should expose public getters named `usdc()`, `feeRecipient()`, and `platformFeeBps()`.
- If it is owner-controlled, it should expose `owner()`.
- If your current names differ, add small view functions with these names before launch. It makes launch verification unambiguous.

Check before moving on:

```bash
PLATFORM_FEE_RECIPIENT_BASE=$PLATFORM_FEE_RECIPIENT_BASE \
PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA=$PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA \
CONTRACT_OWNER_BASE=$CONTRACT_OWNER_BASE \
CONTRACT_OWNER_BASE_SEPOLIA=$CONTRACT_OWNER_BASE_SEPOLIA \
yarn compile
```

If this catches a problem:

- Fix the deploy script now. Do not rely on manually editing constructor args during the mainnet deployment.

## 7. Harden the frontend for public users

Edit `packages/nextjs/scaffold.config.ts` for staging first:

```ts
import * as chains from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [chains.baseSepolia],
  pollingInterval: 3000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  rpcOverrides: {
    [chains.baseSepolia.id]: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  burnerWalletMode: "disabled",
} as const satisfies ScaffoldConfig;
```

Add `packages/nextjs/.env.local`:

```dotenv
NEXT_PUBLIC_ALCHEMY_API_KEY=<alchemy-api-key>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<walletconnect-project-id>
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=<base-sepolia-browser-rpc-url>
NEXT_PUBLIC_BASE_RPC_URL=<base-browser-rpc-url>
```

Remove or guard development-only pages from production:

- `/debug`
- `/blockexplorer`
- any faucet, mock-token mint, impersonation, or admin-only test page

Minimum acceptable guard: these routes return `404` when `process.env.NODE_ENV === "production"`.

Check before moving on:

```bash
yarn lint
yarn next:build
```

If this catches a problem:

- Fix TypeScript/build errors now. Production Vercel should not be the first real build.

## 8. Run the full local and fork test gate

Run the existing test suite:

```bash
yarn format
yarn lint
yarn compile
yarn test
yarn next:build
```

Run targeted invariant tests. Add them if they do not exist:

- USDC address cannot be zero.
- Fee bps is exactly `100`.
- Fee recipient cannot be zero.
- A `1_000_000` raw-unit tip sends `990_000` to creator and `10_000` to platform.
- Rounding behavior is tested for tiny amounts.
- Reverts when fan has not approved enough USDC.
- Reverts when fan has insufficient USDC.
- Reverts or handles paused/blacklisted USDC behavior if the app has relevant handling.
- Creator address cannot be zero.
- No public function can sweep user funds except the intended tip/fee flow.
- Owner/admin powers are tested and documented.

Run a Base fork journey:

```bash
# Terminal 1
cd packages/foundry
make fork FORK_URL=base
```

```bash
# Terminal 2
USDC_ADDRESS=$BASE_MAINNET_USDC \
PLATFORM_FEE_RECIPIENT=$PLATFORM_FEE_RECIPIENT_BASE \
CONTRACT_OWNER=$CONTRACT_OWNER_BASE \
yarn deploy
yarn start
```

In the browser at `http://localhost:3000`, complete:

- Connect wallet.
- Switch to local fork.
- Approve USDC.
- Tip a creator.
- Confirm the creator and platform fee balances changed by the expected raw units.
- Refresh the page and confirm the UI reads the chain state correctly.

Check before moving on:

- Every command exits cleanly.
- The full browser journey works on the fork.
- No console errors are visible during approve/tip/refresh.

If this catches a problem:

- Fix and rerun this whole step. Local fork passing once is not enough after edits.

## 9. Create and fund deployer keystore

Create a dedicated deployer keystore:

```bash
yarn account:generate
```

When prompted:

- Use keystore name: `creator-tips-deployer`.
- Use a new strong password stored in the team's password manager.
- Do not reuse a personal wallet.

Get the deployer address:

```bash
export DEPLOYER_KEYSTORE=creator-tips-deployer
export DEPLOYER_ADDRESS=$(cast wallet address --account $DEPLOYER_KEYSTORE)
echo $DEPLOYER_ADDRESS
```

Fund the deployer:

- Send Base Sepolia ETH to `$DEPLOYER_ADDRESS`.
- Send Base mainnet ETH to `$DEPLOYER_ADDRESS`. Start with enough for deployment plus retries; on Base this is usually small, but use at least `0.01 ETH` unless current gas estimates say otherwise.

Check balances:

```bash
cast balance $DEPLOYER_ADDRESS --ether --rpc-url https://sepolia.base.org
cast balance $DEPLOYER_ADDRESS --ether --rpc-url https://mainnet.base.org
```

Check before moving on:

- Sepolia balance is enough for staging deployment.
- Mainnet balance is enough for production deployment and one replacement transaction.
- Deployer holds no significant extra funds.

If this catches a problem:

- Fund the deployer before continuing. An underfunded deployer causes failed or stuck deployments at the worst moment.

## 10. Dry-run Base Sepolia deployment

```bash
cd packages/foundry
source .env

PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA=$PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA \
CONTRACT_OWNER_BASE_SEPOLIA=$CONTRACT_OWNER_BASE_SEPOLIA \
forge script script/Deploy.s.sol --rpc-url baseSepolia --ffi -vvvv

cd ../..
```

Check before moving on:

- The dry run succeeds.
- Logs show USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Logs show fee bps `100`.
- Logs show the expected Base Sepolia owner and fee recipient.

If this catches a problem:

- Fix the deploy script or env vars. Do not broadcast until the dry run logs are correct.

## 11. Deploy to Base Sepolia

```bash
PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA=$PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA \
CONTRACT_OWNER_BASE_SEPOLIA=$CONTRACT_OWNER_BASE_SEPOLIA \
yarn deploy --network baseSepolia --keystore $DEPLOYER_KEYSTORE
```

Record the deployed contract:

Manually open `packages/nextjs/contracts/deployedContracts.ts`, copy the `84532` address for `$TIP_CONTRACT_NAME`, then run:

```bash
export SEPOLIA_TIP_CONTRACT=<copied-base-sepolia-contract-address>
```

Check the deployed config:

```bash
cast call $SEPOLIA_TIP_CONTRACT "usdc()(address)" --rpc-url https://sepolia.base.org
cast call $SEPOLIA_TIP_CONTRACT "feeRecipient()(address)" --rpc-url https://sepolia.base.org
cast call $SEPOLIA_TIP_CONTRACT "platformFeeBps()(uint16)" --rpc-url https://sepolia.base.org
```

If the contract is owner-controlled, also run:

```bash
cast call $SEPOLIA_TIP_CONTRACT "owner()(address)" --rpc-url https://sepolia.base.org
```

Expected:

- `usdc()` returns `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- `feeRecipient()` returns `$PLATFORM_FEE_RECIPIENT_BASE_SEPOLIA`.
- `platformFeeBps()` returns `100`.
- `owner()` returns `$CONTRACT_OWNER_BASE_SEPOLIA`, if the contract is owner-controlled.

If this catches a problem:

- Abandon this staging deployment.
- Fix the script/config.
- Redeploy to Base Sepolia.
- Do not reuse a bad deployment address in the frontend.

## 12. Verify Base Sepolia contract on BaseScan

```bash
cd packages/foundry
source .env
make verify RPC_URL=baseSepolia
cd ../..
```

Check before moving on:

- The verifier reports success.
- `https://sepolia.basescan.org/address/$SEPOLIA_TIP_CONTRACT#code` shows verified source code.

If this catches a problem:

- Wait two minutes and rerun verification once.
- If it still fails, inspect `packages/foundry/broadcast/Deploy.s.sol/84532/run-latest.json`.
- Fix compiler settings or constructor args before mainnet. Mainnet verification should not be a new problem.

## 13. Publish a staging frontend preview

Confirm `packages/nextjs/scaffold.config.ts` targets `chains.baseSepolia`.

```bash
yarn vercel:login
yarn vercel link
```

Set preview/staging env vars in Vercel if prompted or through the dashboard:

```bash
yarn vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY preview
yarn vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID preview
yarn vercel env add NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL preview
```

Deploy the staging preview:

```bash
yarn next:build
yarn vercel
```

Check the preview URL:

- Wallet connects.
- Wallet is prompted for Base Sepolia, not localhost.
- No burner wallet is available.
- `/debug` and `/blockexplorer` are not publicly usable in production-mode builds.
- Approve test USDC.
- Tip a creator with test USDC.
- Creator receives `99%`.
- Fee recipient receives `1%`.
- Refresh shows the completed tip.
- Rejected wallet transactions show understandable UI errors.
- Insufficient allowance and insufficient balance are handled before users are confused.

If this catches a problem:

- Fix the app and redeploy staging preview.
- Do not proceed until both teammates complete the staging journey from separate wallets.

## 14. Prepare production frontend config

Change `packages/nextjs/scaffold.config.ts` from Base Sepolia to Base mainnet:

```ts
import * as chains from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [chains.base],
  pollingInterval: 3000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  rpcOverrides: {
    [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  burnerWalletMode: "disabled",
} as const satisfies ScaffoldConfig;
```

Run:

```bash
yarn lint
yarn next:build
```

Check before moving on:

- The build passes.
- The only target network is `chains.base`.
- No Base Sepolia contract address is hard-coded in the production UI.
- `packages/nextjs/contracts/deployedContracts.ts` may contain both `84532` and later `8453`; the active frontend must target `8453`.

If this catches a problem:

- Fix before mainnet deploy. Do not deploy a mainnet contract for a frontend that cannot build.

## 15. Dry-run Base mainnet deployment

```bash
cd packages/foundry
source .env

PLATFORM_FEE_RECIPIENT_BASE=$PLATFORM_FEE_RECIPIENT_BASE \
CONTRACT_OWNER_BASE=$CONTRACT_OWNER_BASE \
forge script script/Deploy.s.sol --rpc-url base --ffi -vvvv

cd ../..
```

Reviewer reads aloud:

- Chain is Base mainnet.
- USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Fee recipient is `$PLATFORM_FEE_RECIPIENT_BASE`.
- Fee bps is `100`.
- Owner is `$CONTRACT_OWNER_BASE`.

Check before moving on:

- Dry run succeeds.
- No address is zero.
- No Base Sepolia address appears in the mainnet dry-run logs.

If this catches a problem:

- Stop and fix. This is the final no-cost place to catch wrong-address mistakes.

## 16. Deploy to Base mainnet

Make sure both teammates are present.

```bash
PLATFORM_FEE_RECIPIENT_BASE=$PLATFORM_FEE_RECIPIENT_BASE \
CONTRACT_OWNER_BASE=$CONTRACT_OWNER_BASE \
yarn deploy --network base --keystore $DEPLOYER_KEYSTORE
```

Immediately copy the new `8453` address from `packages/nextjs/contracts/deployedContracts.ts`:

```bash
export BASE_TIP_CONTRACT=<copied-base-mainnet-contract-address>
```

Create a launch record:

```bash
cat > LAUNCH_RECORD.md <<EOF
# Production launch record

Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Chain: Base mainnet
Chain id: 8453
USDC: $BASE_MAINNET_USDC
Contract: $BASE_TIP_CONTRACT
Fee bps: $PLATFORM_FEE_BPS
Fee recipient: $PLATFORM_FEE_RECIPIENT_BASE
Owner: $CONTRACT_OWNER_BASE
Deployer: $DEPLOYER_ADDRESS
Deploy tx: <paste-from-terminal-or-basescan>
EOF
```

Check deployed config:

```bash
cast call $BASE_TIP_CONTRACT "usdc()(address)" --rpc-url https://mainnet.base.org
cast call $BASE_TIP_CONTRACT "feeRecipient()(address)" --rpc-url https://mainnet.base.org
cast call $BASE_TIP_CONTRACT "platformFeeBps()(uint16)" --rpc-url https://mainnet.base.org
```

If the contract is owner-controlled, also run:

```bash
cast call $BASE_TIP_CONTRACT "owner()(address)" --rpc-url https://mainnet.base.org
```

Expected:

- `usdc()` returns `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- `feeRecipient()` returns `$PLATFORM_FEE_RECIPIENT_BASE`.
- `platformFeeBps()` returns `100`.
- `owner()` returns `$CONTRACT_OWNER_BASE`, if the contract is owner-controlled.

If this catches a problem:

- Do not publish the frontend.
- If owner/admin can pause, pause immediately.
- Otherwise, deploy a fixed contract and only publish the fixed address.

## 17. Verify Base mainnet contract on BaseScan

```bash
cd packages/foundry
source .env
make verify RPC_URL=base
cd ../..
```

Check before moving on:

- `https://basescan.org/address/$BASE_TIP_CONTRACT#code` shows verified source code.
- Constructor args on BaseScan match the launch record.

If this catches a problem:

- Do not publish yet.
- Rerun after a short wait.
- If it still fails, verify manually with Foundry using the constructor args from `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json`.

## 18. Run one real-USDC production smoke test before public launch

Use three addresses:

- Fan wallet with a small amount of Base USDC and ETH for gas.
- Creator wallet controlled by the team.
- Fee recipient from `$PLATFORM_FEE_RECIPIENT_BASE`.

Record pre-balances:

```bash
export FAN_ADDRESS=<fan-wallet-address>
export CREATOR_ADDRESS=<creator-wallet-address>

cast call $BASE_MAINNET_USDC "balanceOf(address)(uint256)" $FAN_ADDRESS --rpc-url https://mainnet.base.org
cast call $BASE_MAINNET_USDC "balanceOf(address)(uint256)" $CREATOR_ADDRESS --rpc-url https://mainnet.base.org
cast call $BASE_MAINNET_USDC "balanceOf(address)(uint256)" $PLATFORM_FEE_RECIPIENT_BASE --rpc-url https://mainnet.base.org
```

On the local production build, connect the fan wallet:

```bash
yarn start
```

Then in the browser:

- Open `http://localhost:3000`.
- Confirm the wallet is on Base mainnet.
- Tip exactly `1.00 USDC` to the creator wallet.
- Confirm the approval transaction.
- Confirm the tip transaction.

Record post-balances:

```bash
cast call $BASE_MAINNET_USDC "balanceOf(address)(uint256)" $FAN_ADDRESS --rpc-url https://mainnet.base.org
cast call $BASE_MAINNET_USDC "balanceOf(address)(uint256)" $CREATOR_ADDRESS --rpc-url https://mainnet.base.org
cast call $BASE_MAINNET_USDC "balanceOf(address)(uint256)" $PLATFORM_FEE_RECIPIENT_BASE --rpc-url https://mainnet.base.org
```

Expected:

- Fan USDC decreases by `1_000_000`, ignoring any separate approval effects because approval does not move USDC.
- Creator USDC increases by `990_000`.
- Fee recipient USDC increases by `10_000`.
- The UI shows the completed tip after refresh.
- The transaction is visible on BaseScan.

If this catches a problem:

- Do not publish.
- If possible, pause the contract.
- Fix and redeploy. Treat wrong accounting on mainnet as a launch blocker even if the amount is small.

## 19. Commit production deployment artifacts

`yarn deploy` should have regenerated:

- `packages/nextjs/contracts/deployedContracts.ts`
- Foundry broadcast/deployment files under `packages/foundry/broadcast` or `packages/foundry/deployments`, depending on repo settings

Review:

```bash
git status --short
git diff -- packages/nextjs/contracts/deployedContracts.ts packages/nextjs/scaffold.config.ts packages/foundry/foundry.toml packages/foundry/script
```

Commit:

```bash
git add packages/nextjs/contracts/deployedContracts.ts \
  packages/nextjs/scaffold.config.ts \
  packages/foundry/foundry.toml \
  packages/foundry/script \
  LAUNCH_RECORD.md

git commit -m "Launch Base mainnet deployment"
```

Check before moving on:

- The committed `8453` contract address is `$BASE_TIP_CONTRACT`.
- No `.env`, private key, keystore, or secret was added.

If this catches a problem:

- Remove secrets from the index immediately with `git restore --staged <file>`.
- Rotate any secret that was accidentally committed, even if not pushed.

## 20. Deploy production frontend to public URL

Set production env vars in Vercel:

```bash
yarn vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY production
yarn vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
yarn vercel env add NEXT_PUBLIC_BASE_RPC_URL production
```

Deploy:

```bash
yarn vercel:yolo --prod
```

After Vercel returns a production URL:

```bash
export PRODUCTION_URL=<vercel-production-url>
curl -I $PRODUCTION_URL
curl -I $PRODUCTION_URL/debug
curl -I $PRODUCTION_URL/blockexplorer
```

Check before moving on:

- Production URL returns `200`.
- `/debug` and `/blockexplorer` return `404`, redirect away, or are otherwise inaccessible in production.
- The UI connects to Base mainnet.
- The contract address in the UI is `$BASE_TIP_CONTRACT`.
- A wallet on the wrong chain is prompted to switch to Base.
- A wallet without USDC sees a clear insufficient-balance path.

If this catches a problem:

- Roll back the Vercel deployment or redeploy with the fixed config.
- Do not announce the URL until this passes.

## 21. Final live smoke test on public URL

On `$PRODUCTION_URL`, repeat the `1.00 USDC` smoke test from a non-deployer fan wallet.

Check:

- Approval works.
- Tip works.
- Creator receives `990_000` raw units.
- Fee recipient receives `10_000` raw units.
- UI refresh reflects the transaction.
- BaseScan transaction matches the expected contract and USDC token.

If this catches a problem:

- Roll back or hide the public URL.
- If possible, pause the contract.
- Fix before telling users.

## 22. Monitoring and user-facing checks

Before announcing, set up the minimum monitoring:

- Bookmark `https://basescan.org/address/$BASE_TIP_CONTRACT`.
- Bookmark `https://basescan.org/token/$BASE_MAINNET_USDC?a=$BASE_TIP_CONTRACT`.
- Add uptime monitoring for `$PRODUCTION_URL`.
- Add frontend error monitoring if the app already has a tool for it.
- Add an alert for Vercel deployment failures.
- Add a simple daily check that `usdc()`, `feeRecipient()`, `platformFeeBps()`, and `owner()` still return expected values.

Daily check command:

```bash
cast call $BASE_TIP_CONTRACT "usdc()(address)" --rpc-url https://mainnet.base.org
cast call $BASE_TIP_CONTRACT "feeRecipient()(address)" --rpc-url https://mainnet.base.org
cast call $BASE_TIP_CONTRACT "platformFeeBps()(uint16)" --rpc-url https://mainnet.base.org
curl -fsS $PRODUCTION_URL >/dev/null
```

If the contract is owner-controlled, add:

```bash
cast call $BASE_TIP_CONTRACT "owner()(address)" --rpc-url https://mainnet.base.org
```

## 23. Announcement gate

Only announce after all are true:

- Base mainnet contract is deployed.
- Base mainnet contract is verified on BaseScan.
- Production frontend points to Base mainnet only.
- Production URL passes the public smoke test.
- Fee recipient received the expected real-USDC fee.
- Creator received the expected real-USDC tip.
- Deployer key is not used by the frontend or stored in Vercel.
- Both teammates have reviewed `LAUNCH_RECORD.md`.

Then tag the launch:

```bash
git tag base-mainnet-launch-$(date -u +"%Y%m%d")
git push origin launch/base-mainnet
git push origin --tags
```

## 24. If something goes wrong after launch

Wrong frontend deployment:

```bash
yarn vercel rollback
```

If Vercel rollback is not configured, redeploy the last known good commit:

```bash
git checkout <last-good-commit>
yarn vercel:yolo --prod
git checkout launch/base-mainnet
```

Wrong contract config but no user funds at risk:

- Hide or roll back frontend immediately.
- Deploy a corrected contract.
- Verify it.
- Update `deployedContracts.ts`.
- Run the real-USDC smoke test again.
- Redeploy frontend.

Wrong contract config with user funds at risk:

- If the contract has `pause()`, pause it from the owner wallet/Safe.
- Remove the public frontend route or put the app in maintenance mode.
- Post a clear status update with the affected contract address and time window.
- Do not ask users to interact with a replacement contract until it is verified and smoke-tested.

Stuck deploy transaction:

```bash
cast nonce $DEPLOYER_ADDRESS --rpc-url https://mainnet.base.org
cast tx <stuck-tx-hash> --rpc-url https://mainnet.base.org
```

- If it is pending, replace/cancel from the deployer wallet with the same nonce and a higher fee.
- If it is mined but failed, inspect the revert, fix the cause, and redeploy.
- Do not rerun deploy blindly without checking nonce and broadcast output.

Verification failure:

- Confirm `ETHERSCAN_API_KEY` is valid.
- Confirm `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json` exists.
- Confirm compiler version, optimizer, and `via_ir` settings match the deployed bytecode.
- Retry `make verify RPC_URL=base`.

RPC outage:

- Switch frontend `NEXT_PUBLIC_BASE_RPC_URL` to a healthy provider.
- Redeploy frontend.
- Keep contract address unchanged.

## 25. Post-launch cleanup

Within 24 hours:

```bash
git checkout main
git merge --no-ff launch/base-mainnet
git push origin main
```

Then:

- Move leftover ETH off the deployer, leaving only dust for future admin transactions if needed.
- Store deployer keystore recovery instructions in the team password manager.
- Review Vercel project access.
- Review RPC key restrictions.
- Open issues for anything deferred during launch.
- Schedule a small external security review before increasing traffic or handling larger creator volume.
