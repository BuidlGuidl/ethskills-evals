# Launch Runbook: Creator Tipping on Base

This is the ordered path from "working on a local fork" to "real users on a public URL" for the Foundry flavor of Scaffold-ETH 2.

Do not skip the localhost-against-live-contracts stage. The launch has three separate gates:

1. Contracts work on a Base fork.
2. Contracts are live and verified on Base, while the frontend is still private on localhost.
3. The frontend is public, and one real transaction has succeeded from the public URL.

## 0. Fill in launch values once

Before running commands, replace these placeholders in this document or export them in your shell. Use the actual names from the repo.

```bash
export APP_REPO="<absolute path to the Scaffold-ETH 2 repo>"
export CONTRACT_NAME="<deployed tipping contract name, e.g. CreatorTips>"
export DEPLOY_SCRIPT="Deploy.s.sol"
export DEPLOYER_KEYSTORE="<foundry keystore name for deployer>"
export FEE_RECIPIENT="<0x address that receives the 1% platform fee>"
export BASE_RPC_URL="https://mainnet.base.org"
export BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export BASE_CHAIN_ID_DECIMAL="8453"
export BASE_CHAIN_ID_HEX="0x2105"
```

Base mainnet chain id is `8453` (`0x2105`). Native USDC on Base is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; do not use bridged `USDbC`.

Go/no-go: all placeholders above are real values, both teammates agree on the fee recipient, and `FEE_RECIPIENT` is not the deployer unless that is an intentional operating decision.

## 1. Create a release branch and freeze scope

```bash
cd "$APP_REPO"
git status --short
git switch -c launch/base-mainnet
yarn install --immutable || yarn install --frozen-lockfile || yarn install
```

Check before moving on:

- `git status --short` shows only expected app changes.
- No new features go into this branch after this point except launch fixes.
- Both teammates know which commit is the launch candidate:

```bash
git rev-parse HEAD
```

If something goes wrong: if the worktree has unrelated local changes, stop and move them to another branch before launching. Do not deploy from a mixed worktree.

## 2. Make production config explicit

### 2.1 Foundry RPC config

Open `packages/foundry/foundry.toml` and ensure Base exists:

```toml
[rpc_endpoints]
base = "https://mainnet.base.org"
```

If the repo already uses an env var based RPC, keep that pattern instead:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
```

Then create or update `packages/foundry/.env`:

```bash
cd "$APP_REPO"
touch packages/foundry/.env
grep -q '^BASE_RPC_URL=' packages/foundry/.env || printf 'BASE_RPC_URL=%s\n' "$BASE_RPC_URL" >> packages/foundry/.env
grep -q '^ETHERSCAN_API_KEY=' packages/foundry/.env || printf 'ETHERSCAN_API_KEY=\n' >> packages/foundry/.env
```

Scaffold-ETH 2 normally ships a usable default explorer API key through `.env.example`; use that if present. A team-owned key is recommended for production reliability, but it is not a blocker if verification works.

Check:

```bash
cast chain-id --rpc-url "$BASE_RPC_URL"
cast code "$BASE_USDC" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
```

Expected:

- `cast chain-id` prints `8453`.
- `cast code` returns non-empty bytecode, not `0x`.
- `decimals()` returns `6`.

If something goes wrong: a wrong chain id or empty USDC bytecode means the RPC is not Base mainnet. Fix RPC before any deploy.

### 2.2 Deployment script config

Open `packages/foundry/script/$DEPLOY_SCRIPT` and make the constructor or initializer use:

```solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
uint256 constant PLATFORM_FEE_BPS = 100; // 1%
address constant FEE_RECIPIENT = <FEE_RECIPIENT>;
```

Use the contract's existing constructor shape. The deployed contract must receive these production values:

- USDC token: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Platform fee: `100` basis points, or the contract's exact representation of 1%
- Fee recipient: `$FEE_RECIPIENT`
- Owner/admin: the intended operations wallet, not accidentally a local burner wallet

Check:

```bash
rg -n "USDC|USDbC|fee|basis|bps|recipient|owner|admin|initialize|constructor" packages/foundry/script packages/foundry/contracts
```

Go/no-go:

- No production deployment path references a mock token.
- No production deployment path references `USDbC` (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`).
- No production deployment path references an Anvil default account or local-only address.

## 3. Run the local quality gate

```bash
cd "$APP_REPO"
yarn compile
yarn test
yarn lint
yarn next:build
```

If `yarn test` is split by package in this repo, run the equivalent package scripts too:

```bash
yarn --cwd packages/foundry test
yarn --cwd packages/nextjs lint
yarn --cwd packages/nextjs build
```

Check before moving on:

- Solidity compiles without warnings that affect launch behavior.
- Tests pass.
- Next.js production build passes.
- The UI still has a clear failed-transaction path: rejected approvals, insufficient USDC, insufficient ETH for gas, wrong network, and reverted tips all show user-readable errors.

If something goes wrong: fix it here, add or update the failing test, and restart this section. Do not carry a known failure into fork rehearsal.

## 4. Rehearse against a fresh Base fork

Start the Base fork in terminal 1:

```bash
cd "$APP_REPO"
yarn fork --network base
```

Important: use exactly `yarn fork --network base`. Do not use `yarn fork base` or `yarn fork --network=base`.

In terminal 2, prove the fork is actually Base state:

```bash
cd "$APP_REPO"
cast chain-id --rpc-url http://127.0.0.1:8545
cast code "$BASE_USDC" --rpc-url http://127.0.0.1:8545
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
```

Expected:

- Chain id is `31337` because Anvil forks answer as local chains.
- USDC bytecode is non-empty.
- USDC decimals are `6`.

Deploy to the fork:

```bash
cd "$APP_REPO"
yarn deploy
```

Check generated frontend contract metadata:

```bash
rg -n "$CONTRACT_NAME|8453|31337|address" packages/nextjs/contracts/deployedContracts.ts
```

For a fork/local deploy, `deployedContracts.ts` should contain local/fork chain metadata, usually chain id `31337`.

Start the frontend against the fork in terminal 3:

```bash
cd "$APP_REPO"
yarn start
```

Open `http://localhost:3000` and run the full user journey:

- Connect a browser wallet to Localhost `31337`.
- Give a fan account ETH for local gas using the local faucet or Anvil funded account.
- Give the fan forked USDC by impersonating a funded USDC holder or by using the repo's existing fork funding helper.
- Approve USDC for the tipping contract.
- Tip a creator.
- Confirm the creator receives 99% of the tip.
- Confirm `$FEE_RECIPIENT` receives 1%.
- Confirm repeated tips, small tips, and rejected approval paths behave correctly.

Useful fork balance checks:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "<fan address>" --rpc-url http://127.0.0.1:8545
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "<creator address>" --rpc-url http://127.0.0.1:8545
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url http://127.0.0.1:8545
```

Go/no-go:

- The fork run uses the Base USDC contract, not a mock.
- The exact production deploy script succeeds.
- The browser flow succeeds on localhost.
- On-chain balances prove the 99%/1% split.
- Both teammates can explain how a failed USDC approval, a failed transfer, and a wrong-network wallet appear to users.

If something goes wrong: fix the contract, deploy script, or frontend, add a regression test for the failure, and restart at section 3.

## 5. Prepare the deployer account

Generate a new Foundry keystore deployer, or import an existing team-controlled deployer.

Generate:

```bash
cd "$APP_REPO"
yarn generate
```

Import:

```bash
cd "$APP_REPO"
yarn account:import
```

Then inspect the account:

```bash
cd "$APP_REPO"
yarn account
```

Fund the deployer with ETH on Base mainnet. Use enough for contract deployment, verification retries, and first admin actions. Base gas is usually low, but fund with a margin; for a small app, `0.01 ETH` on Base is a practical starting minimum.

Check:

```bash
export DEPLOYER_ADDRESS="<address printed by yarn account>"
cast balance "$DEPLOYER_ADDRESS" --ether --rpc-url "$BASE_RPC_URL"
```

Go/no-go:

- Deployer has Base ETH.
- Deployer private key or keystore password is not committed, pasted into frontend env, or shared in chat.
- Both teammates know who controls the deployer and who controls `$FEE_RECIPIENT`.

If something goes wrong: if the deployer has ETH on the wrong chain, bridge or transfer ETH to Base before deploy. Do not point the deployment at another chain to "use the funds there."

## 6. Deploy to Base mainnet

Final preflight:

```bash
cd "$APP_REPO"
git status --short
yarn compile
yarn test
cast chain-id --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
```

Expected:

- `git status --short` contains only intentional launch changes.
- Tests pass.
- Chain id is `8453`.
- USDC decimals are `6`.

Deploy:

```bash
cd "$APP_REPO"
yarn deploy --network base --keystore "$DEPLOYER_KEYSTORE"
```

If the repo's SE-2 version prompts for keystore selection instead of accepting `--keystore`, run:

```bash
yarn deploy --network base
```

and select `$DEPLOYER_KEYSTORE` when prompted.

Immediately verify from the same checkout:

```bash
cd "$APP_REPO"
yarn verify --network base
```

Do not postpone verification. Foundry verification uses the deployment broadcast from this checkout.

Record the deployed contract address:

```bash
rg -n "$CONTRACT_NAME|8453|address" packages/nextjs/contracts/deployedContracts.ts
export TIP_CONTRACT="<0x deployed $CONTRACT_NAME address on Base>"
```

Check on Base:

```bash
cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT" "owner()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT" "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT" "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT" "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
```

If the contract uses different getter names, run the equivalent getters. Expected values:

- Code is non-empty.
- Owner/admin is the intended operations wallet.
- USDC is `$BASE_USDC`.
- Platform fee is 1%, represented as `100` bps if the contract uses basis points.
- Fee recipient is `$FEE_RECIPIENT`.

Open:

```text
https://basescan.org/address/<TIP_CONTRACT>
```

Go/no-go:

- Contract is verified on BaseScan.
- Constructor/admin values are correct.
- `packages/nextjs/contracts/deployedContracts.ts` contains the Base deployment for chain id `8453`.
- No live transaction has revealed an unexpected revert.

If something goes wrong:

- If deployment failed before a contract address was created, fix the cause and rerun deploy.
- If deployment succeeded with wrong constructor values, treat it as a bad live contract. Do not patch around it in the frontend. Fix the deploy script, redeploy, verify the new contract, and point the frontend to the new address.
- If verification fails, fix it immediately from this checkout while the broadcast files are still present.

## 7. Point the frontend at Base, still locally

Open `packages/nextjs/scaffold.config.ts`. The production configuration should include Base as the target network and should not use public committed secrets.

Use this shape:

```ts
import * as chains from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [chains.base],
  pollingInterval: 3000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
  onlyLocalBurnerWallet: true,
  walletAutoConnect: true,
} as const;

export default scaffoldConfig;
```

If the repo imports chains directly from `viem/chains`, use the existing local pattern:

```ts
import { base } from "viem/chains";

targetNetworks: [base],
```

Create or update `packages/nextjs/.env.local`:

```bash
cd "$APP_REPO"
touch packages/nextjs/.env.local
grep -q '^NEXT_PUBLIC_ALCHEMY_API_KEY=' packages/nextjs/.env.local || printf 'NEXT_PUBLIC_ALCHEMY_API_KEY=<team Alchemy key or empty if using public RPC>\n' >> packages/nextjs/.env.local
grep -q '^NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=' packages/nextjs/.env.local || printf 'NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<team WalletConnect project id>\n' >> packages/nextjs/.env.local
```

If using a custom RPC override in `scaffold.config.ts`, read it from env:

```ts
rpcOverrides: {
  [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL,
},
```

and set:

```bash
grep -q '^NEXT_PUBLIC_BASE_RPC_URL=' packages/nextjs/.env.local || printf 'NEXT_PUBLIC_BASE_RPC_URL=%s\n' "$BASE_RPC_URL" >> packages/nextjs/.env.local
```

Check the config:

```bash
rg -n "targetNetworks|foundry|localhost|31337|base|alchemyApiKey|walletConnectProjectId|rpcOverrides|onlyLocalBurnerWallet" packages/nextjs/scaffold.config.ts packages/nextjs/.env.local
yarn next:build
```

Go/no-go:

- `targetNetworks` points to Base, not `chains.foundry`.
- Browser burner wallet is not enabled on Base.
- No private key, deployer mnemonic, or secret server-side key is in `packages/nextjs`.
- Production build passes.

If something goes wrong: if the frontend still asks wallets for Localhost `31337`, stop and fix `targetNetworks` before any public deploy.

## 8. Private live-chain QA from localhost

Start the frontend locally:

```bash
cd "$APP_REPO"
yarn start
```

Open `http://localhost:3000` and use a real wallet on Base mainnet. Use small real money: `$1` to `$10` of USDC and enough ETH for gas.

Run the full live journey:

- Connect wallet and confirm the app requests Base mainnet.
- Confirm the contract address shown in the UI or explorer link is `$TIP_CONTRACT`.
- Approve a small USDC amount.
- Tip a creator wallet controlled by the team.
- Confirm the creator wallet receives 99%.
- Confirm `$FEE_RECIPIENT` receives 1%.
- Refresh the app and confirm the new on-chain state/events render correctly.
- Try one expected failure, such as canceling approval or entering a value above the wallet's USDC balance, and confirm the UI reports it cleanly.

On-chain balance checks:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "<fan address>" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "<creator address>" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
cast logs --address "$TIP_CONTRACT" --from-block "<deployment block>" --to-block latest --rpc-url "$BASE_RPC_URL"
```

Go/no-go:

- At least one real Base USDC tip succeeds through the localhost UI.
- The platform fee is exactly 1%.
- The UI is reading the verified Base contract, not a stale fork/local deployment.
- Errors are understandable enough that support will not be blind on day one.

If something goes wrong:

- Contract behavior wrong: fix source, add regression test, redeploy, verify, update frontend metadata, restart section 7.
- Frontend behavior wrong but contract correct: fix frontend, rebuild, restart this section.
- Wallet/RPC flakiness: set a reliable team RPC in env and verify the production host will receive the same env var.

## 9. Prepare production hosting

This runbook assumes Vercel because SE-2 ships Vercel commands. If the team uses another host, keep the same build/env checks and replace only the deployment command.

Set production env vars in Vercel:

```bash
cd "$APP_REPO"
yarn vercel:login
yarn vercel link
yarn vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY production
yarn vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
yarn vercel env add NEXT_PUBLIC_BASE_RPC_URL production
```

Use the same public values that passed localhost QA. Do not add deployer private keys to the frontend host.

Preview deploy first:

```bash
cd "$APP_REPO"
yarn vercel
```

Open the preview URL and check:

- The app loads without build/runtime errors.
- Wallet connect opens.
- The requested network is Base.
- The contract links point to BaseScan and `$TIP_CONTRACT`.

Do not process a real user tip on an unshared preview URL unless both teammates intend that preview to touch production contracts. The preview is still production-chain capable.

Go/no-go:

- Preview loads cleanly.
- Env vars are present in the hosted environment.
- No secret deployer material is configured in Vercel.
- Both teammates approve publishing the same commit that passed localhost live-chain QA.

If something goes wrong: fix env or build config and redeploy preview. Do not publish production until the preview is clean.

## 10. Publish the frontend

Commit the launch state:

```bash
cd "$APP_REPO"
git status --short
yarn compile
yarn test
yarn lint
yarn next:build
git add packages/foundry packages/nextjs
git commit -m "Configure Base production launch"
git rev-parse HEAD
```

Deploy production:

```bash
cd "$APP_REPO"
yarn vercel --prod
```

If the team intentionally accepts skipping type/build checks in the deploy command because the checks above already passed, this is available:

```bash
yarn vercel:yolo --prod
```

Prefer `yarn vercel --prod`.

Record:

```bash
export PRODUCTION_URL="<Vercel production URL>"
```

Go/no-go:

- Production deploy completes.
- The URL is final enough to share publicly.
- The deployed commit matches the commit that passed local live-chain QA.

If something goes wrong: if the deployment failed, keep the app private and fix the build/env issue. If the wrong commit deployed, roll Vercel back to the previous safe deployment or redeploy the correct commit before sharing.

## 11. Post-publish smoke test

Open `$PRODUCTION_URL` in a fresh browser profile or incognito window.

Run one real transaction:

- Connect a real wallet on Base.
- Tip a team-controlled creator with a small amount of real USDC.
- Confirm success in the UI.
- Open the transaction on BaseScan.
- Confirm creator receives 99%.
- Confirm `$FEE_RECIPIENT` receives 1%.

Commands:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "<creator address>" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
```

Go/no-go:

- One real tip succeeds from the public URL.
- No console errors block the happy path.
- BaseScan shows the expected contract and token transfers.

Only after this passes, share the public URL with real users.

If something goes wrong:

- Frontend-only issue: fix, redeploy, repeat this section.
- Contract issue: stop public sharing, fix source and tests, redeploy and verify, repoint frontend, repeat sections 7-11.
- Env/RPC issue: update Vercel env, redeploy, repeat this section.

## 12. Launch monitoring for the first 24 hours

Keep these running during the initial launch window:

```bash
cast block-number --rpc-url "$BASE_RPC_URL"
cast logs --address "$TIP_CONTRACT" --from-block "<deployment block>" --to-block latest --rpc-url "$BASE_RPC_URL"
```

Operational checks:

- Watch Vercel runtime/build logs.
- Watch BaseScan for failed transactions against `$TIP_CONTRACT`.
- Watch USDC balances for `$FEE_RECIPIENT` and the first few creators.
- Keep one teammate available to triage UI issues and one available for contract/admin decisions.

Support checklist for reports:

- Ask for transaction hash first.
- Check whether the user was on Base mainnet.
- Check whether they approved USDC and then submitted the tip transaction.
- Check whether they held native USDC, not bridged USDbC.
- Check whether they had ETH on Base for gas.

If a live bug appears:

- Do not call a frontend guard the fix for a contract bug.
- Reproduce locally.
- Add the regression test.
- Fix source.
- Rehearse on Base fork.
- Redeploy or upgrade if the system is explicitly upgradeable.
- Verify.
- Repoint frontend if the address changed.
- Communicate clearly to affected users if any funds or state need migration.

## 13. Final launch record

Create a short internal record:

```text
Launch commit:
Base contract address:
Deployment transaction:
Verification URL:
Production URL:
First public smoke-test transaction:
Deployer address:
Fee recipient:
Emergency contacts:
```

Store it somewhere both teammates can reach. Do not include private keys, seed phrases, keystore passwords, or deployer secrets.

## Reference facts used in this runbook

- Scaffold-ETH 2 Foundry live deploy: `yarn deploy --network <network>`.
- Scaffold-ETH 2 contract verification: `yarn verify --network <network>`.
- Scaffold-ETH 2 Vercel deploy: `yarn vercel`, then `yarn vercel --prod`.
- Base mainnet chain id: `8453` / `0x2105`.
- Native USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
