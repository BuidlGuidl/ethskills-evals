# Creator Tipping dApp Base Launch Runbook

This is the ordered path from the current state, where the app works on a local Base fork, to real users on a public URL. Run it from the real Scaffold-ETH 2 repo root, not from this documentation-only directory.

Target production chain:

- Base Mainnet chain id: `8453`
- Base RPC: `https://mainnet.base.org`
- Native Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDC decimals: `6`
- Platform fee: `100` basis points, meaning `1%` if the contract denominator is `10_000`

Use this runbook literally. If a checkpoint fails, stop there and fix it before moving on.

## 0. Assign launch roles

One person is the driver and runs commands. One person is the checker and reads every diff, command output, transaction prompt, and deployed address before the driver continues.

Record these production values before editing anything:

```bash
export BASE_RPC_URL="https://mainnet.base.org"
export BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export PLATFORM_FEE_BPS="100"
export DEPLOYER_KEYSTORE="creator-tips-base-deployer"
export CONTRACT_NAME="CreatorTips" # replace with the actual contractName in your broadcast JSON
export CREATOR_SMOKE_ADDRESS="0x..." # creator wallet controlled by the team for smoke tests
export FAN_SMOKE_ADDRESS="0x..." # browser wallet controlled by the team for smoke tests
export FEE_RECIPIENT_ADDRESS="0x..." # production fee recipient, not the deployer unless intentional
export CONTRACT_OWNER_ADDRESS="0x..." # production owner/admin, ideally a Base Safe if the contract has ownership
```

Checkpoint:

- `CREATOR_SMOKE_ADDRESS`, `FAN_SMOKE_ADDRESS`, `FEE_RECIPIENT_ADDRESS`, and `CONTRACT_OWNER_ADDRESS` are real Base addresses.
- The deployer is not a user wallet.
- The smoke fan wallet can safely spend `$1-$10` of USDC on Base.

## 1. Freeze the repo state

```bash
git status --short
git switch -c launch/base-mainnet
yarn install
yarn compile
yarn test
yarn lint
yarn next:build
```

Checkpoint:

- `git status --short` only shows changes you expect.
- Compile, tests, lint, and frontend build all pass.
- If anything fails, fix it before touching production config.

How this catches issues:

- Broken TypeScript, stale ABIs, formatter drift, and failing Foundry tests are caught before real funds or live contracts are involved.

## 2. Check contract production invariants

Find the exact deploy script and constructor arguments:

```bash
sed -n '1,240p' packages/foundry/script/Deploy.s.sol
rg -n "USDC|usdc|fee|bps|recipient|owner|admin|new " packages/foundry/contracts packages/foundry/script packages/foundry/test
```

Update `packages/foundry/script/Deploy.s.sol` so the production deploy uses native Base USDC and the 1% fee. The exact constructor names may differ in your repo, but the deployed values must be equivalent to this. Replace the placeholder owner and fee recipient with the real production addresses recorded in step 0:

```solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
address constant FEE_RECIPIENT = 0x1111111111111111111111111111111111111111; // replace
address constant CONTRACT_OWNER = 0x2222222222222222222222222222222222222222; // replace
uint16 constant PLATFORM_FEE_BPS = 100;

// Example only. Match your actual constructor.
new CreatorTips(BASE_USDC, FEE_RECIPIENT, PLATFORM_FEE_BPS, CONTRACT_OWNER);
```

If the deploy script cannot read shell environment variables, hard-code only public addresses and constants in the deploy script. Never hard-code private keys or secret RPC keys.

Run the targeted checks:

```bash
yarn compile
yarn test
```

Manually confirm the contract logic:

- USDC amounts are parsed and formatted with `6` decimals in the frontend.
- The fee denominator is `10_000`, so `100` means `1%`.
- A `1_000_000` unit tip, meaning `1 USDC`, sends `10_000` units to the platform and `990_000` units to the creator, before any intentionally documented rounding behavior.
- The contract uses safe ERC20 handling or checks the return value from USDC transfers.
- The fee recipient and owner/admin are not accidentally zero addresses.
- If the contract has owner-only withdrawal or admin functions, tests cover who can and cannot call them.

Checkpoint:

- The deploy script is production-ready.
- Unit tests still pass after constructor/config changes.
- The checker has read the deployment diff.

How this catches issues:

- Wrong token address, wrong decimals, a 100% fee caused by denominator confusion, and deployer-as-owner mistakes are caught before any contract is broadcast.

## 3. Configure Base RPC and verification

Open `packages/foundry/foundry.toml` and ensure Base exists:

```toml
[rpc_endpoints]
base = "https://mainnet.base.org"
baseSepolia = "https://sepolia.base.org"
localhost = "http://127.0.0.1:8545"
```

If your `foundry.toml` has an `[etherscan]` section, ensure it includes Base. The Scaffold-ETH template `.env.example` includes a working `ETHERSCAN_API_KEY`; using your own key is optional housekeeping, not a launch blocker.

```toml
[etherscan]
base = { key = "${ETHERSCAN_API_KEY}" }
```

Check the generated Foundry env:

```bash
sed -n '1,200p' packages/foundry/.env
```

It should include values equivalent to:

```bash
ALCHEMY_API_KEY=...
ETHERSCAN_API_KEY=...
LOCALHOST_KEYSTORE_ACCOUNT=scaffold-eth-default
```

Do not put private keys into committed files. Current Scaffold-ETH Foundry templates use Foundry keystores for live deploys. Older repos may have `DEPLOYER_PRIVATE_KEY` in `packages/foundry/.env`; if yours does, confirm `packages/foundry/.env` is gitignored before generating or importing a key.

Run:

```bash
git check-ignore packages/foundry/.env || true
git diff -- packages/foundry/foundry.toml packages/foundry/.env packages/nextjs/scaffold.config.ts
```

Checkpoint:

- `packages/foundry/.env` is not committed.
- Base RPC is configured as `base`.
- No private key, secret RPC key, or secret API key appears in `git diff`.

How this catches issues:

- The deployment command will fail fast if `base` is missing from `foundry.toml`.
- Secret leakage is caught before pushing the launch branch.

## 4. Create and fund the deployer

Generate the deployer keystore:

```bash
yarn generate
```

When prompted, name it exactly:

```text
creator-tips-base-deployer
```

Print its address:

```bash
cast wallet address --account "$DEPLOYER_KEYSTORE"
```

Save the address:

```bash
export DEPLOYER_ADDRESS="$(cast wallet address --account "$DEPLOYER_KEYSTORE")"
echo "$DEPLOYER_ADDRESS"
```

Fund `DEPLOYER_ADDRESS` with Base ETH only. Use a small but comfortable amount for deploy gas, for example `0.01 ETH` on Base. Do not fund it on Ethereum mainnet by mistake.

Check the deployer balance:

```bash
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
yarn account
```

Checkpoint:

- `cast balance` shows nonzero ETH on Base.
- `yarn account` shows the same deployer address and a Base balance.
- The deployer private key or keystore password is stored in the team password manager.

How this catches issues:

- The most common first live deploy failure is funding the right address on the wrong chain.

## 5. Prepare the smoke-test wallets

Fund the fan smoke wallet with small Base balances:

- Base ETH for gas.
- Native Base USDC for one or more real tips.

Check both balances:

```bash
cast balance "$FAN_SMOKE_ADDRESS" --rpc-url "$BASE_RPC_URL" --ether
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FAN_SMOKE_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url "$BASE_RPC_URL"
```

Checkpoint:

- The fan smoke wallet has ETH on Base.
- `balanceOf` is at least `1000000` for a `1 USDC` smoke tip.
- `decimals()` returns `6`.

How this catches issues:

- You prove you are using native Base USDC before the app asks users for approvals.

## 6. Rehearse against a fresh Base fork

Start a new Base fork in terminal 1:

```bash
yarn fork --network base
```

Keep that process running. In terminal 2, verify the fork is actually Base state, even though Anvil reports chain id `31337`:

```bash
cast chain-id --rpc-url http://127.0.0.1:8545
cast code "$BASE_USDC" --rpc-url http://127.0.0.1:8545
cast call "$BASE_USDC" "decimals()(uint8)" --rpc-url http://127.0.0.1:8545
```

Fund the smoke fan with local gas on the fork:

```bash
cast rpc anvil_setBalance "$FAN_SMOKE_ADDRESS" 0x3635C9ADC5DEA00000 --rpc-url http://127.0.0.1:8545
cast balance "$FAN_SMOKE_ADDRESS" --rpc-url http://127.0.0.1:8545 --ether
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FAN_SMOKE_ADDRESS" --rpc-url http://127.0.0.1:8545
```

Deploy to the fork:

```bash
yarn deploy
```

Confirm `deployedContracts.ts` has a local fork entry:

```bash
rg -n "31337|$CONTRACT_NAME|$BASE_USDC" packages/nextjs/contracts/deployedContracts.ts
```

Start the frontend in terminal 3:

```bash
yarn start
```

Open `http://localhost:3000`, connect the fan smoke wallet to the local Anvil network, and run the complete user journey:

1. Creator profile or creator address is visible.
2. Fan approves native Base USDC.
3. Fan tips a small amount.
4. Creator receives 99%.
5. Fee recipient receives 1%.
6. The UI shows the confirmed transaction and updated balances.

Checkpoint:

- The fork output says it forked `https://mainnet.base.org`.
- The USDC address has bytecode on the fork.
- The whole user journey works on the fork with the production USDC address and production fee config.
- No console error indicates wrong chain, missing contract, rejected allowance, bad decimals, or failed reads.

How this catches issues:

- This is the last cheap place to catch constructor, token, allowance, and UI chain-config problems while the frontend still points at localhost.

## 7. Commit the deploy-ready state

Review the diff:

```bash
git diff
git status --short
```

Commit only source/config changes that belong in the repo:

```bash
git add packages/foundry/script packages/foundry/contracts packages/foundry/test packages/foundry/foundry.toml packages/nextjs
git diff --cached
git commit -m "Prepare Base mainnet launch"
```

Checkpoint:

- `packages/foundry/.env` is not staged.
- Local fork broadcast files are not staged unless your repo intentionally tracks them.
- The checker has reviewed the exact deploy-ready commit.

How this catches issues:

- The live deployment is reproducible from a clean commit, and secrets stay out of git.

## 8. Deploy contracts to Base Mainnet

Stop and read this before continuing:

- This step creates immutable public bytecode.
- Confirm your wallet prompt says Base, not localhost, Base Sepolia, Ethereum, or another chain.
- Confirm the deployer address is the funded launch deployer.

Run from the repo root:

```bash
yarn deploy --network base --keystore "$DEPLOYER_KEYSTORE"
```

If your Scaffold-ETH Foundry package does not support `--keystore`, run:

```bash
yarn deploy --network base
```

and select `creator-tips-base-deployer` when prompted.

Immediately capture the deployed contract address:

```bash
export TIP_CONTRACT="$(
  jq -r --arg name "$CONTRACT_NAME" \
    '.transactions[] | select(.transactionType == "CREATE" and .contractName == $name) | .contractAddress' \
    packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json | tail -n 1
)"
echo "$TIP_CONTRACT"
```

If `TIP_CONTRACT` is empty, inspect the broadcast file and set it manually:

```bash
jq '.transactions[] | {contractName, transactionType, contractAddress}' packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json
export TIP_CONTRACT="0x..."
```

Checkpoint:

- `yarn deploy` exits successfully.
- `TIP_CONTRACT` is a nonzero address.
- BaseScan shows a contract creation transaction for `TIP_CONTRACT`.
- `packages/nextjs/contracts/deployedContracts.ts` now includes chain `8453`.

How this catches issues:

- You confirm the frontend artifact points at the exact live address that was just deployed.

## 9. Verify the live contract immediately

Run verification from the same checkout that performed the deploy, because verification replays `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json`.

For current Scaffold-ETH Foundry templates:

```bash
yarn verify base
```

If your repo's verify script accepts the documented network flag, this equivalent command is acceptable:

```bash
yarn verify --network base
```

Then check bytecode and source:

```bash
cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
```

Open:

```text
https://basescan.org/address/$TIP_CONTRACT#code
```

Checkpoint:

- Verification succeeds.
- BaseScan shows the contract source.
- `cast code` returns bytecode, not `0x`.

If verification fails:

- Do not deploy the public frontend.
- Confirm you are in the checkout that created `run-latest.json`.
- Confirm `ETHERSCAN_API_KEY` exists in `packages/foundry/.env`.
- Confirm `packages/foundry/foundry.toml` includes Base under `[rpc_endpoints]` and, if needed, `[etherscan]`.
- Rerun `yarn verify base`.

How this catches issues:

- You avoid launching a public UI against opaque bytecode that users cannot inspect.

## 10. Read live contract config before touching the frontend

Use your real getter names. These examples assume conventional getters:

```bash
cast call "$TIP_CONTRACT" "usdc()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT" "platformFeeBps()(uint256)" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT" "feeRecipient()(address)" --rpc-url "$BASE_RPC_URL"
cast call "$TIP_CONTRACT" "owner()(address)" --rpc-url "$BASE_RPC_URL"
```

Also confirm the frontend artifact:

```bash
rg -n "8453|$TIP_CONTRACT|$CONTRACT_NAME" packages/nextjs/contracts/deployedContracts.ts
```

Checkpoint:

- Contract USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Fee is `100` basis points.
- Fee recipient is `FEE_RECIPIENT_ADDRESS`.
- Owner/admin is `CONTRACT_OWNER_ADDRESS`, if the contract has one.
- `deployedContracts.ts` includes the same `TIP_CONTRACT` under chain `8453`.

If any value is wrong:

- Stop. Do not patch this in the frontend.
- Fix the deploy script and/or contract.
- Add or update the regression test.
- Redeploy a new contract.
- Verify the new contract.
- Repoint the frontend to the new deployed address generated by `yarn deploy`.

How this catches issues:

- Frontend guards cannot fix a bad live contract. This step catches bad immutable config before users see it.

## 11. Switch the frontend to Base

Edit `packages/nextjs/scaffold.config.ts`.

Required production shape:

```ts
import * as chains from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [chains.base],
  pollingInterval: 3000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  rpcOverrides: {
    [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
  },
  walletConnectProjectId:
    process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  burnerWalletMode: "disabled",
} as const satisfies ScaffoldConfig;
```

If your repo has an older config with `onlyLocalBurnerWallet`, keep it production-safe:

```ts
onlyLocalBurnerWallet: true,
```

Create or update local frontend env:

```bash
cat > packages/nextjs/.env.local.example <<'EOF'
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
EOF
```

Then create your actual local env file manually:

```bash
cp -n packages/nextjs/.env.local.example packages/nextjs/.env.local
```

Fill `packages/nextjs/.env.local` with production frontend values. `NEXT_PUBLIC_*` values are public in the browser; do not put private secrets there.

Run:

```bash
yarn lint
yarn next:build
```

Checkpoint:

- `targetNetworks` is `[chains.base]`.
- Burner wallets are disabled or local-only.
- `packages/nextjs/contracts/deployedContracts.ts` contains chain `8453`.
- Lint and frontend build pass.
- No private secret appears in `git diff`.

How this catches issues:

- A common launch mistake is deploying contracts to Base but shipping a frontend still pointed at Anvil chain `31337`.

## 12. Test live contracts from localhost

Start the frontend locally:

```bash
yarn start
```

Open `http://localhost:3000`, connect the fan smoke wallet to Base Mainnet, and run a real small tip.

Before the tip, record balances:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_SMOKE_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Perform the UI journey:

1. Connect wallet.
2. Confirm the app requests Base.
3. Approve only the intended small USDC amount.
4. Send a small tip.
5. Wait for confirmation in the UI and wallet.

After the tip, record balances again:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_SMOKE_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Checkpoint:

- The wallet prompts show Base Mainnet.
- The approval spender is `TIP_CONTRACT`.
- The tip transaction succeeds.
- Creator USDC increases by 99% of the tip amount, allowing for known rounding rules.
- Fee recipient USDC increases by 1% of the tip amount, allowing for known rounding rules.
- No frontend console errors appear during connect, approve, tip, receipt, or balance refresh.

If this fails:

- Do not deploy the public frontend.
- If the failure is a contract bug, go back to tests and redeploy.
- If the failure is frontend config, fix config, rebuild, and repeat this localhost-live test.

How this catches issues:

- This is the critical middle stage: real chain, real USDC, real wallet, but a local frontend you can still fix quickly.

## 13. Commit the live frontend config and deployment artifacts

Review and commit:

```bash
git status --short
git diff
git add packages/nextjs/scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts packages/nextjs/.env.local.example
git diff --cached
git commit -m "Point frontend to Base deployment"
```

If your repo intentionally tracks `packages/foundry/broadcast` or `packages/foundry/deployments`, commit the Base deployment artifacts too:

```bash
git add packages/foundry/broadcast packages/foundry/deployments
git diff --cached
git commit --amend --no-edit
```

If those paths are ignored, do not force-add them. At minimum, make sure `packages/nextjs/contracts/deployedContracts.ts` is committed with chain `8453`.

Checkpoint:

- `packages/nextjs/.env.local` is not staged.
- The committed frontend artifact contains the live Base address.
- The branch has one commit for deploy preparation and one commit for frontend-to-Base wiring.

How this catches issues:

- Vercel or any other host builds the same Base configuration you just tested locally.

## 14. Deploy the frontend to a public URL

This runbook assumes Vercel because Scaffold-ETH 2 ships Vercel scripts.

Log in and link the project once:

```bash
yarn vercel:login
yarn vercel
```

Set production environment variables in Vercel:

```bash
vercel env add NEXT_PUBLIC_BASE_RPC_URL production
vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY production
vercel env add NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID production
vercel env ls production
```

Use:

```text
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

If you use Alchemy and WalletConnect production keys, paste those when prompted. They are browser-public keys, but they should still be scoped in the provider dashboards.

Deploy production:

```bash
yarn vercel:yolo --prod
```

Save the production URL:

```bash
export PRODUCTION_URL="https://..."
echo "$PRODUCTION_URL"
```

Checkpoint:

- Vercel build succeeds.
- The deployed URL loads over HTTPS.
- The loaded app is built from the commit that contains `targetNetworks: [chains.base]`.

How this catches issues:

- Hosting env vars and build-time config problems are caught before announcing the URL.

## 15. Smoke test the public URL

Open `PRODUCTION_URL` in a clean browser profile or incognito window.

Run the same real Base tip journey with the smoke fan wallet:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_SMOKE_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Then use the public URL to approve and tip.

After confirmation:

```bash
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$CREATOR_SMOKE_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Checkpoint:

- The public app loads.
- Wallet connect works.
- The wallet is on Base Mainnet.
- Approval spender is `TIP_CONTRACT`.
- The tip succeeds from the public URL.
- Creator and fee recipient balances change as expected.
- The transaction appears on BaseScan.

If this fails:

- If contracts still work from localhost, roll back the Vercel deployment or redeploy the previous frontend.
- If the contract itself is wrong, remove public links, communicate internally, and redeploy fixed contracts before relaunching.

How this catches issues:

- You test the exact asset users will load, not only the local dev server.

## 16. Remove launch-only exposure before announcing

Check public pages and routes:

```bash
rg -n "Debug Contracts|debug|localhost|31337|hardhat|anvil|burner|faucet" packages/nextjs/app packages/nextjs/components packages/nextjs/scaffold.config.ts
```

If the default Scaffold-ETH Debug Contracts page is still reachable and you do not want users there, remove the route or hide its navigation before announcing.

Rebuild and redeploy if anything changes:

```bash
yarn lint
yarn next:build
git add packages/nextjs
git commit -m "Hide development routes for production"
yarn vercel:yolo --prod
```

Checkpoint:

- No visible production UI points users to localhost, a faucet, burner wallets, or a debug-only page unless you intentionally want that.
- The public URL still passes the smoke test after any cleanup redeploy.

How this catches issues:

- Users do not land in Scaffold-ETH development surfaces that were helpful locally but confusing in production.

## 17. Add minimum monitoring

At minimum, set these up before announcing broadly:

- Vercel deployment notifications for failed builds.
- A public URL uptime check.
- Wallet/RPC error logging in the frontend, for example Sentry or your existing logger.
- A watched BaseScan address page for `TIP_CONTRACT`.
- A team-owned incident channel where both people see failed smoke tests or user reports.

Manual launch watch commands:

```bash
cast block-number --rpc-url "$BASE_RPC_URL"
cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
cast call "$BASE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT_ADDRESS" --rpc-url "$BASE_RPC_URL"
```

Checkpoint:

- Both team members can see frontend deploy failures.
- Both team members know the contract address and BaseScan link.
- At least one person is watching the first real user transactions.

How this catches issues:

- If RPC, hosting, or transaction errors spike, you learn before the support queue does.

## 18. Announce in phases

Phase 1: private link to a tiny group.

```text
Production URL: $PRODUCTION_URL
Contract: https://basescan.org/address/$TIP_CONTRACT
Token: native Base USDC, 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

Ask the first testers to use small tips.

Phase 2: public announcement after the first external transaction succeeds.

Checkpoint:

- At least one non-team user has completed the intended journey.
- No unexplained failed transactions are visible.
- No frontend error spike is visible.

## 19. If something goes wrong

Frontend-only issue:

1. Reproduce on the public URL.
2. Reproduce locally against Base.
3. Fix frontend config or UI.
4. Run `yarn lint` and `yarn next:build`.
5. Test locally against Base with the smoke wallet.
6. Deploy with `yarn vercel:yolo --prod`.
7. Smoke test the public URL again.

Contract issue before users:

1. Do not announce.
2. Reproduce with a Foundry test.
3. Fix the contract or deploy script.
4. Run `yarn test`.
5. Rehearse on a fresh Base fork.
6. Deploy a new contract to Base.
7. Verify immediately.
8. Repoint the frontend through `deployedContracts.ts`.
9. Repeat localhost-live and public smoke tests.

Contract issue after users:

1. Stop announcements and remove or banner the public URL if users can lose funds.
2. Do not pretend a frontend guard fixes the contract.
3. Reproduce locally.
4. Add the regression test.
5. Fix and redeploy, or upgrade only if the contract is intentionally behind a proxy.
6. Repoint the frontend if the address moved.
7. Decide how to handle existing state and users: migration, refund, notice, or support path.
8. Publish the corrected contract address and BaseScan link.

Wrong contract address in frontend:

1. Revert or redeploy the previous known-good frontend.
2. Confirm `packages/nextjs/contracts/deployedContracts.ts` has chain `8453` and `TIP_CONTRACT`.
3. Rebuild.
4. Redeploy.
5. Public smoke test.

Wrong USDC address:

1. Stop.
2. Redeploy the contract with native Base USDC.
3. Verify the new contract.
4. Repoint the frontend.
5. Run all smoke tests again.

## 20. Final launch checklist

Do not announce until every item is checked:

- `yarn test` passed after production deploy config changes.
- `yarn lint` passed.
- `yarn next:build` passed.
- Base fork rehearsal passed.
- Base deploy succeeded.
- Base verification succeeded.
- Live contract getters match native Base USDC, 1% fee, fee recipient, and owner/admin.
- `deployedContracts.ts` contains chain `8453` and the live contract address.
- Localhost frontend worked against live Base contracts with real USDC.
- Public URL worked against live Base contracts with real USDC.
- Burner/local/debug surfaces are removed or intentionally hidden.
- Monitoring and an incident channel exist.
- Both team members have the production URL, contract address, deploy commit, and BaseScan link.

## References

- Scaffold-ETH 2 commands and Foundry flavor conventions: `https://github.com/scaffold-eth/scaffold-eth-2`
- Scaffold-ETH 2 docs: `https://docs.scaffoldeth.io/`
- Base chain id documentation: `https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId`
- Native USDC on Base: `https://usdc.org/usdc/base`
