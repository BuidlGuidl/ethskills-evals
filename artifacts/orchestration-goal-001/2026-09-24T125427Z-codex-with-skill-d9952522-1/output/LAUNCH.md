# Base Mainnet Launch Runbook

This runbook takes the dApp from the current state, "working on a local Base fork", to production on Base mainnet with a public frontend URL.

Follow it in order. Do not skip the live-chain localhost walkthrough: contracts live plus frontend still local is the launch stage that catches wrong chain IDs, wrong token addresses, allowance issues, fee math mistakes, wallet UX failures, and deploy metadata problems before users see them.

## 0. Release Constants

Fill these values once at the start of the launch session. Keep this shell open for the whole session.

```bash
export APP_REPO="<absolute path to the Scaffold-ETH 2 repo>"
export RELEASE_BRANCH="launch/base-mainnet"

export BASE_CHAIN_ID="8453"
export BASE_RPC_URL="<Base mainnet RPC URL>"
export BASE_PUBLIC_RPC_URL="${BASE_RPC_URL}"
export BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54dA02913"

export TIPPING_CONTRACT_NAME="<exact contract name used by the frontend>"
export PLATFORM_FEE_BPS="100"
export PLATFORM_FEE_RECIPIENT="<0x platform fee wallet or Base Safe>"
export CONTRACT_OWNER="<0x owner/admin wallet or Base Safe>"
export WALLETCONNECT_PROJECT_ID="<WalletConnect project id>"

export LIVE_TEST_CREATOR="<0x creator wallet controlled by the team>"
export LIVE_TEST_FAN="<0x fan wallet controlled by the team>"
```

Use a private or account-owned RPC URL for deployment. The public frontend may use the same URL only if the provider key is safe to expose in browser traffic and is domain-restricted. Otherwise use a public Base RPC URL for `BASE_PUBLIC_RPC_URL`.

Reference facts checked for this runbook:

- Base mainnet chain ID is `8453` / `0x2105`: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId
- Native USDC on Base is ERC-20 at `0x833589fCD6eDb6E08f4c7C32D4f71b54dA02913`: https://www.circle.com/multi-chain-usdc/base
- Scaffold-ETH 2 Foundry deploy/verify commands are `yarn deploy --network <network>` and `yarn verify --network <network>`: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md

Go/no-go:

- Go only if `PLATFORM_FEE_RECIPIENT`, `CONTRACT_OWNER`, `LIVE_TEST_CREATOR`, and `LIVE_TEST_FAN` are real Base addresses controlled by the team.
- Go only if `WALLETCONNECT_PROJECT_ID` is set to a project owned by the team.
- No-go if the production owner is still an unbacked burner wallet or an address whose private key is committed anywhere.

## 1. Open a Clean Release Branch

```bash
cd "$APP_REPO"
git status --short
git checkout main
git pull --ff-only
git checkout -b "$RELEASE_BRANCH"
corepack enable
yarn install
```

Check:

```bash
test -d packages/foundry
test -d packages/nextjs
git status --short
```

Go/no-go:

- Go if `packages/foundry` and `packages/nextjs` both exist and the only changes are expected dependency install metadata, if any.
- No-go if there are unexplained local edits. Stop and either commit, stash, or discard them deliberately.

## 2. Confirm Base and USDC Before Editing Anything

Install/update Foundry if `cast` is unavailable:

```bash
command -v cast
```

If that fails:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Probe Base:

```bash
test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "$BASE_CHAIN_ID"
cast code --rpc-url "$BASE_RPC_URL" "$BASE_USDC"
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "symbol()(string)"
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "decimals()(uint8)"
```

Expected:

- `cast chain-id` prints `8453`.
- `cast code` prints non-empty bytecode, not `0x`.
- `symbol()` prints `USDC`.
- `decimals()` prints `6`.

How this catches failures:

- Wrong RPC: chain ID is not `8453`.
- Wrong token address or wrong chain: code is `0x`, symbol is not `USDC`, or decimals are not `6`.

Go/no-go:

- Go only if every expected value matches.

## 3. Make Production Deploy Parameters Explicit

Review the deployment script:

```bash
rg -n "new |USDC|usdc|fee|bps|owner|recipient|transferOwnership|vm.env" packages/foundry/script packages/foundry/contracts
```

Edit `packages/foundry/script/Deploy.s.sol` so the Base deployment gets every production-sensitive value from environment variables. The exact constructor call must match the contract, but the deployment data source should look like this:

```solidity
address usdc = vm.envAddress("BASE_USDC");
address platformFeeRecipient = vm.envAddress("PLATFORM_FEE_RECIPIENT");
uint256 platformFeeBps = vm.envUint("PLATFORM_FEE_BPS");
address contractOwner = vm.envAddress("CONTRACT_OWNER");

YourTippingContract tipping = new YourTippingContract(
    usdc,
    platformFeeRecipient,
    platformFeeBps
);

if (contractOwner != address(0) && contractOwner != msg.sender) {
    tipping.transferOwnership(contractOwner);
}
```

Use your actual contract type and constructor arguments. Do not hardcode the USDC address, fee recipient, owner, or fee rate in the script.

If the contract does not expose readable production invariants, add or confirm these public getters before launch:

```solidity
function usdc() external view returns (address);
function platformFeeBps() external view returns (uint256);
function platformFeeRecipient() external view returns (address);
function owner() external view returns (address);
```

Check:

```bash
git diff -- packages/foundry/script packages/foundry/contracts
yarn compile
cd packages/foundry
forge test -vvv
cd ../..
```

Go/no-go:

- Go if compile and tests pass and the diff shows production values coming from env variables.
- No-go if a deploy parameter is still hardcoded to a local fork/mock value.

## 4. Configure Foundry for Base

Open `packages/foundry/foundry.toml` and make sure it contains a Base RPC endpoint. Add this if missing:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
```

If an `[rpc_endpoints]` section already exists, add only the `base` line inside it.

If an `[etherscan]` section is missing, add:

```toml
[etherscan]
base = { key = "${ETHERSCAN_API_KEY}", url = "https://api.basescan.org/api", chain = 8453 }
```

Scaffold-ETH 2 normally copies a working `ETHERSCAN_API_KEY` into `packages/foundry/.env`; replacing it with your own key is optional housekeeping, not a launch blocker.

Check:

```bash
git diff -- packages/foundry/foundry.toml
```

Go/no-go:

- Go if `base` is present under `rpc_endpoints`.
- No-go if any private RPC key or private key is committed to `foundry.toml`.

## 5. Create the Deployer and Fund It on Base

Generate a deployer account:

```bash
yarn generate
yarn account
```

Record the deployer address printed by `yarn account`:

```bash
export DEPLOYER_ADDRESS="<0x deployer address printed by yarn account>"
```

Set the deploy environment in `packages/foundry/.env`. This file must stay gitignored.

```bash
printf '\nBASE_RPC_URL=%s\nBASE_USDC=%s\nPLATFORM_FEE_BPS=%s\nPLATFORM_FEE_RECIPIENT=%s\nCONTRACT_OWNER=%s\n' "$BASE_RPC_URL" "$BASE_USDC" "$PLATFORM_FEE_BPS" "$PLATFORM_FEE_RECIPIENT" "$CONTRACT_OWNER" >> packages/foundry/.env
```

Fund `DEPLOYER_ADDRESS` with Base ETH for gas. Fund only enough for deployment and verification retry headroom.

Check funding:

```bash
cast balance --ether --rpc-url "$BASE_RPC_URL" "$DEPLOYER_ADDRESS"
yarn account
```

Go/no-go:

- Go if the deployer has Base ETH and `packages/foundry/.env` is not shown by `git status --short`.
- No-go if the deployer has ETH on Ethereum mainnet, Base Sepolia, or localhost but not Base mainnet.

## 6. Rehearse the Exact Deployment on a Fresh Base Fork

Start a fresh Base fork in terminal A:

```bash
cd "$APP_REPO"
yarn fork --network base
```

In terminal B, deploy to that fork:

```bash
cd "$APP_REPO"
yarn deploy
```

Keep terminal A running and start the frontend against the fork:

```bash
yarn start
```

Open `http://localhost:3000` and walk the whole flow with browser wallets:

1. Connect the fan wallet.
2. Confirm the app shows the local/fork network, not Base mainnet.
3. Approve a small USDC spend.
4. Tip `LIVE_TEST_CREATOR`.
5. Confirm creator receives 99% and `PLATFORM_FEE_RECIPIENT` receives 1%.
6. Refresh the page and confirm the UI reads the same state from chain.

Check the fork actually contains Base USDC:

```bash
cast chain-id --rpc-url http://127.0.0.1:8545
cast call --rpc-url http://127.0.0.1:8545 "$BASE_USDC" "decimals()(uint8)"
```

Expected:

- Fork chain ID is `31337`.
- USDC decimals are still `6`.

How this catches failures:

- If `yarn fork` was called incorrectly, the fork may be Ethereum mainnet while still reporting `31337`. The USDC check catches that.
- If deploy script args are wrong, the app fails locally before any live transaction.
- If the UI still assumes mock/local USDC decimals, the approval/tip flow breaks here.

Go/no-go:

- Go only after a full tip succeeds on a fresh Base fork.

## 7. Commit the Launch Configuration Before Live Deployment

Stop the fork and frontend. Then:

```bash
cd "$APP_REPO"
git status --short
git diff
yarn compile
cd packages/foundry
forge test -vvv
cd ../..
yarn lint
yarn next:build
```

Commit only source/config files, never `.env` files:

```bash
git status --short
git add packages/foundry packages/nextjs
git status --short
git commit -m "Configure Base mainnet launch"
```

Go/no-go:

- Go if tests, lint, and frontend build pass.
- No-go if `git status --short` includes `packages/foundry/.env`, `packages/nextjs/.env.local`, private keys, or RPC secrets.

## 8. Deploy Contracts to Base Mainnet

This is the first live-network mutation.

```bash
cd "$APP_REPO"
yarn deploy --network base
```

Immediately verify from the same checkout that performed the deploy:

```bash
yarn verify --network base
```

Find and record the deployed contract address:

```bash
rg -n "$TIPPING_CONTRACT_NAME|8453|address" packages/nextjs/contracts/deployedContracts.ts packages/foundry/deployments packages/foundry/broadcast
```

Export it:

```bash
export TIPPING_CONTRACT_ADDRESS="<0x deployed Base contract address>"
```

Check source verification and bytecode:

```bash
cast code --rpc-url "$BASE_RPC_URL" "$TIPPING_CONTRACT_ADDRESS"
cast call --rpc-url "$BASE_RPC_URL" "$TIPPING_CONTRACT_ADDRESS" "usdc()(address)"
cast call --rpc-url "$BASE_RPC_URL" "$TIPPING_CONTRACT_ADDRESS" "platformFeeBps()(uint256)"
cast call --rpc-url "$BASE_RPC_URL" "$TIPPING_CONTRACT_ADDRESS" "platformFeeRecipient()(address)"
cast call --rpc-url "$BASE_RPC_URL" "$TIPPING_CONTRACT_ADDRESS" "owner()(address)"
```

Expected:

- Contract code is non-empty.
- `usdc()` returns `0x833589fCD6eDb6E08f4c7C32D4f71b54dA02913`.
- `platformFeeBps()` returns `100`.
- `platformFeeRecipient()` returns `PLATFORM_FEE_RECIPIENT`.
- `owner()` returns `CONTRACT_OWNER`, if the contract is ownable.
- Basescan shows verified source for the contract.

If a getter has a different name, run the equivalent getter from your ABI and record the exact command in the launch notes before continuing.

How this catches failures:

- Wrong constructor args are caught before the frontend is public.
- Wrong owner/fee recipient is caught before any user funds move.
- Failed verification is caught while the deploy artifacts are still local and fresh.

Go/no-go:

- Go only if `yarn verify --network base` succeeds and every invariant matches.
- No-go if any invariant is wrong. Do not patch around it in the frontend. Fix the deploy script/contract, add a regression test, redeploy, and repoint the frontend to the replacement contract.

## 9. Point the Frontend at Base Mainnet

Edit `packages/nextjs/scaffold.config.ts`.

Use `viem/chains` and set the production target network to Base:

```ts
import * as chains from "viem/chains";
```

In `scaffoldConfig`, set:

```ts
targetNetworks: [chains.base],
pollingInterval: 30000,
rpcOverrides: {
  [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
},
onlyLocalBurnerWallet: false,
```

Keep API keys out of committed code. Put browser-safe frontend values in `packages/nextjs/.env.local`:

```bash
printf 'NEXT_PUBLIC_BASE_RPC_URL=%s\n' "$BASE_PUBLIC_RPC_URL" > packages/nextjs/.env.local
printf 'NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=%s\n' "$WALLETCONNECT_PROJECT_ID" >> packages/nextjs/.env.local
```

Check that the generated deployment data contains chain ID `8453`:

```bash
rg -n "8453|$TIPPING_CONTRACT_NAME|$TIPPING_CONTRACT_ADDRESS" packages/nextjs/contracts/deployedContracts.ts
yarn lint
yarn next:build
```

Go/no-go:

- Go if `deployedContracts.ts` contains the Base deployment, lint passes, and the frontend builds.
- No-go if `targetNetworks` still points at `chains.foundry`, `chains.hardhat`, or any local chain.

## 10. Walk the Live Contract With Localhost Frontend

Start the frontend locally with Base mainnet config:

```bash
cd "$APP_REPO"
yarn start
```

Open `http://localhost:3000`.

Before the tip, record balances:

```bash
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$LIVE_TEST_CREATOR"
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$PLATFORM_FEE_RECIPIENT"
```

Run a real small-money walkthrough:

1. Connect `LIVE_TEST_FAN`.
2. Confirm the wallet is on Base mainnet, chain ID `8453`.
3. Confirm the UI shows the deployed Base contract address.
4. Approve exactly the intended test tip amount in USDC.
5. Tip `LIVE_TEST_CREATOR` with `1.00` USDC, or the smallest amount that exercises fee rounding correctly.
6. Wait for the transaction receipt.
7. Refresh the page.
8. Confirm the UI shows the completed tip.

After the tip, record balances again:

```bash
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$LIVE_TEST_CREATOR"
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$PLATFORM_FEE_RECIPIENT"
```

Expected for a `1.00` USDC tip with 6 decimals and a 1% fee:

- Tip amount raw units: `1000000`.
- Platform fee raw units: `10000`.
- Creator net raw units: `990000`.

Also confirm the transaction on Basescan.

How this catches failures:

- Wallet network mismatch appears before users arrive.
- Missing deployment data appears as a frontend contract lookup failure.
- Bad allowance UX appears while only the team is testing.
- Fee rounding mistakes are caught with real USDC before public launch.
- RPC/CORS/rate-limit issues appear in local browser logs.

Go/no-go:

- Go only after a real Base mainnet tip succeeds through localhost and the on-chain balances match the expected fee split.
- No-go if the contract works from `cast` but the UI fails. Fix the UI and repeat this whole section.

## 11. Commit the Base Frontend Switch

Stop the local frontend. Then:

```bash
cd "$APP_REPO"
git status --short
git diff
yarn lint
yarn next:build
git add packages/nextjs packages/foundry
git status --short
git commit -m "Point frontend to Base mainnet deployment"
```

Go/no-go:

- Go if only intended source/config/deployment artifact files are staged.
- No-go if `.env.local`, `.env`, private keys, or secret RPC URLs are staged.

## 12. Deploy the Frontend to a Public URL

This runbook uses Vercel because Scaffold-ETH 2 ships a Vercel deployment script.

Login and link the project if this has not been done before:

```bash
cd "$APP_REPO"
npx vercel login
npx vercel link
```

Set production environment variables:

```bash
printf '%s' "$BASE_PUBLIC_RPC_URL" | npx vercel env add NEXT_PUBLIC_BASE_RPC_URL production
printf '%s' "$WALLETCONNECT_PROJECT_ID" | npx vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
```

Deploy production:

```bash
yarn vercel:yolo --prod
```

Record the production URL printed by Vercel:

```bash
export PRODUCTION_URL="<https://...vercel.app or custom domain>"
```

Check:

```bash
curl -I "$PRODUCTION_URL"
```

Expected:

- HTTP status is `200`, `301`, or `308`.
- The URL is reachable from a browser outside localhost.

Go/no-go:

- Go if the public URL loads and the browser console has no startup errors.
- No-go if the public build points at a previous contract address or a local chain. Fix env/config and redeploy before sharing the URL.

## 13. Production Smoke Test

Open `PRODUCTION_URL` in a clean browser profile or incognito window.

Before the production smoke tip, record balances:

```bash
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$LIVE_TEST_CREATOR"
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$PLATFORM_FEE_RECIPIENT"
```

Run the same real-money tip through the public URL:

1. Connect `LIVE_TEST_FAN`.
2. Confirm wallet chain is Base mainnet.
3. Confirm the displayed/debug contract address is `TIPPING_CONTRACT_ADDRESS`.
4. Tip `LIVE_TEST_CREATOR` with a small amount.
5. Wait for the receipt.
6. Refresh the page and confirm the state is still correct.

After the smoke tip:

```bash
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$LIVE_TEST_CREATOR"
cast call --rpc-url "$BASE_RPC_URL" "$BASE_USDC" "balanceOf(address)(uint256)" "$PLATFORM_FEE_RECIPIENT"
```

Go/no-go:

- Go public if the transaction succeeds from the production URL and balances move by the expected 99% / 1% split.
- No-go if the public URL behaves differently from localhost. Do not announce. Fix and redeploy the frontend, then repeat this section.

## 14. Announce Soft Launch

Before posting broadly:

```bash
git status --short
git log --oneline -5
```

Create a release note with:

- Production URL.
- Base contract address.
- Basescan verified-source link.
- USDC token address used.
- Known support contact.
- Date and time of launch.

Share first with a small allowlist or friendly users. Keep both team members available for the first hour.

Go/no-go:

- Go if both team members can reproduce the production URL and contract address from the release note.
- No-go if support/comms cannot identify the live contract address unambiguously.

## 15. First-Hour Monitoring

Watch these during the first hour:

```bash
cast block-number --rpc-url "$BASE_RPC_URL"
cast logs --rpc-url "$BASE_RPC_URL" --address "$TIPPING_CONTRACT_ADDRESS" --from-block latest
```

Also keep open:

- Vercel production logs.
- Browser console on the production URL.
- Basescan page for `TIPPING_CONTRACT_ADDRESS`.
- Fee recipient USDC balance.
- Team support inbox/chat.

Catch before users do:

- If Vercel logs show repeated RPC failures, switch `NEXT_PUBLIC_BASE_RPC_URL` to a healthier browser-safe RPC and redeploy.
- If users report wallet connection failures, reproduce in a clean profile before changing code.
- If tips are reverting, stop promotion immediately and reproduce with `cast call` or a fork at the failing block.
- If fee math is wrong, treat it as a contract bug, not a frontend bug.

## 16. Rollback and Incident Rules

Frontend rollback:

```bash
npx vercel rollback
```

Use this if the frontend is broken but the contract invariants are correct.

Contract issue:

1. Stop promotion.
2. If the contract has `pause()`, call it from `CONTRACT_OWNER`.
3. Remove or disable the tipping entry point in the frontend and redeploy.
4. Reproduce the issue locally or on a fork.
5. Add the regression test that fails on the deployed behavior.
6. Fix the contract.
7. Redeploy or upgrade only through the intended contract mechanism.
8. Repoint the frontend if the address changes.
9. Communicate clearly about affected transactions.

Do not call a frontend-only clamp a contract fix. The live contract is callable directly by wallets, scripts, and other frontends.

## Final Launch Checklist

All boxes must be checked before broad public announcement:

- [ ] Base RPC returns chain ID `8453`.
- [ ] Base USDC address returns symbol `USDC` and decimals `6`.
- [ ] Deployer has Base ETH.
- [ ] Deploy parameters come from env, not local constants.
- [ ] Fresh Base fork deploy and browser walkthrough passed.
- [ ] `yarn compile`, `forge test -vvv`, `yarn lint`, and `yarn next:build` passed.
- [ ] `yarn deploy --network base` completed.
- [ ] `yarn verify --network base` completed from the deploy checkout.
- [ ] On-chain invariant checks match USDC, 1% fee, fee recipient, and owner.
- [ ] Localhost frontend completed a real Base USDC tip.
- [ ] Frontend `targetNetworks` is `[chains.base]`.
- [ ] Production frontend deployed to a public URL.
- [ ] Public URL completed a real Base USDC tip.
- [ ] Release note records URL, contract address, Basescan link, and support contact.
