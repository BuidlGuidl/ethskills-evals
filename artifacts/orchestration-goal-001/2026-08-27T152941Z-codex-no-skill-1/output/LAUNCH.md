# Base mainnet launch runbook

Follow this in order. The repository is assumed to be a standard Scaffold-ETH 2 Foundry project: `packages/foundry`, `packages/nextjs`, Yarn workspaces. Where its wrapper names differ, run `yarn run` and use the equivalent existing command—never guess a deployment command on mainnet.

Use two separate people. The **deployer** operates a newly-created, single-purpose deployer wallet. The **reviewer** independently checks each address and every hardware-wallet signing screen, and performs acceptance testing. Never put a seed phrase or private key in Git, chat, shell history, a browser variable, or a `NEXT_PUBLIC_*` variable.

## 1. Freeze the candidate

In the dApp repo:

```bash
git switch -c release/base-mainnet-$(date +%Y-%m-%d)
git status --short
yarn install --frozen-lockfile
yarn compile
yarn foundry:test
yarn lint
yarn next:build
git diff --check
git status --short
git commit -am "Prepare Base mainnet release" # only intended changes
git tag -a <tag> -m "Base mainnet release"
git push origin HEAD --tags
```

**Gate:** all commands exit 0, the final status is clean except ignored local secrets, and both people review the tagged diff. Before moving on, read the Solidity contract and actual deploy script together and record:

- the exact tip path, recipients, rounding rule, and expected results for 1, 99, 100, 101, and 1,000,001 USDC base units (USDC has 6 decimals);
- the USDC source (constructor/config versus hard-coded), exact fee recipient, all owner/admin/pause/upgrade/withdraw paths, and every role holder;
- that UI recipient, amount, fee, chain, and USDC spender match transaction calldata; typed or URL-supplied addresses must be validated;
- whether the contract ever holds USDC/ETH and its tested recovery path.

**Stop and fix:** unbounded/default-max approvals, incorrect rounding, unchecked token transfers, reentrancy around token movement, unexpected privilege, upgradeability without an independently reviewed storage/timelock plan, or UI/calldata disagreement. Get an independent security review before allowing meaningful value; a two-person review is not a substitute.

## 2. Create real identities, keys, and services

Create new accounts, never local Anvil defaults:

| Label | Purpose | Rule |
| --- | --- | --- |
| `DEPLOYER_ADDRESS` | deploy/verify once | minimal Base ETH; key removed from daily use afterward |
| `FEE_RECIPIENT_ADDRESS` | 1% platform fee | not the deployer EOA |
| `OWNER_ADDRESS` | admin, only if contract needs one | 2-of-2 (or stronger) multisig controlled by both people |
| `TESTER_A_ADDRESS`, `TESTER_B_ADDRESS` | acceptance testing | small Base ETH and USDC only |

Record addresses—not secrets—in the release issue. Reviewer compares them character-for-character with the hardware-wallet display. Fund deployer/testers with small **Base Mainnet ETH** amounts and the testers with small official Base USDC amounts; verify receipt in the wallet and explorer. Confirm the withdrawal/bridge target says Base, not Ethereum or a testnet.

Create a paid production RPC provider (HTTPS plus WSS), a Basescan API key, and a production Vercel project. Base says its public RPC is rate limited, so do not use it for public-user traffic.

```bash
export BASE_MAINNET_RPC_URL='https://<production-rpc>'
export DEPLOYER_ADDRESS='0x...'
cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_MAINNET_RPC_URL"
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'name()(string)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url "$BASE_MAINNET_RPC_URL"
```

**Gate:** chain ID is `8453`; USDC bytecode is non-empty; name is `USDC`; decimals are `6`. The official Circle Base address is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; re-check it against Circle on launch day. A look-alike or legacy token is a hard stop.

## 3. Make configuration explicit

In `packages/foundry/foundry.toml`, add named endpoints (preserve existing settings):

```toml
[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
base = "${BASE_MAINNET_RPC_URL}"
```

In `packages/nextjs/scaffold.config.ts`, import `base` and `baseSepolia` from `viem/chains`. During rehearsal use:

```ts
targetNetworks: [baseSepolia, base],
pollingInterval: 4_000,
```

For the production build use `targetNetworks: [base]`. Disable any public local faucet, burner wallet, Debug Contracts route, and localhost default. The UI must disable approve/tip on any chain except 8453 and prompt “Switch to Base Mainnet.”

Create ignored `packages/nextjs/.env.production.local` (match variable names to the app):

```dotenv
NEXT_PUBLIC_RPC_URL=https://<production-rpc>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<production-id>
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_TIPPING_CONTRACT_ADDRESS=0x<set-after-mainnet-deploy>
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_BASESCAN_URL=https://basescan.org
```

Only public values may be prefixed `NEXT_PUBLIC_`. Keep deployer keys, explorer keys, signing secrets, and backend credentials server-only.

```bash
rg -n --hidden -g '!node_modules' -g '!*.lock' 'localhost|31337|hardhat|anvil|8453|84532|USDC|TIPPING_CONTRACT|PRIVATE_KEY|DEPLOYER'
git check-ignore packages/nextjs/.env.production.local
git ls-files | rg '(^|/)(\.env|.*secret|.*key)'
yarn next:build
```

**Gate:** no production consumer points to localhost/31337, no secret is tracked, build passes, and reviewer confirms amounts use `parseUnits(value, 6)` (not `parseEther`).

## 4. Mandatory Base Sepolia rehearsal

Use the exact tagged candidate. Base Sepolia USDC is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

```bash
export BASE_SEPOLIA_RPC_URL='https://<sepolia-rpc>'
export ETHERSCAN_API_KEY='<basescan-api-key>'
export PRIVATE_KEY='<new-sepolia-deployer-private-key>'
export SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
yarn deploy --help
yarn deploy --network base_sepolia
```

If the project wrapper does not support `--network`, use the confirmed script and class instead:

```bash
cd packages/foundry
forge script script/<ActualDeployScript>.s.sol:<ActualScriptContract> \
  --rpc-url base_sepolia --broadcast --verify -vvvv
cd ../..
```

The rehearsal constructor/initializer must receive `SEPOLIA_USDC` and a known test fee recipient. Capture the deployment address, tx hash, constructor arguments, compiler settings, bytecode hash and generated `packages/nextjs/contracts/deployedContracts.ts` in the release issue; commit generated artifacts if this repository tracks them.

Run the frontend configured only with those Sepolia values:

```bash
NEXT_PUBLIC_CHAIN_ID=84532 NEXT_PUBLIC_TIPPING_CONTRACT_ADDRESS="$SEPOLIA_TIPPING_ADDRESS" \
NEXT_PUBLIC_USDC_ADDRESS="$SEPOLIA_USDC" yarn workspace nextjs start
```

**Acceptance:** Reviewer connects an independent wallet, rejects a request once, verifies the wrong-network guard, approves only a small exact amount (or documented permit), sends a tip, and waits for the receipt. Decode the explorer transaction: contract and token are correct; creator receives `amount - floor(amount/100)`; fee recipient receives `floor(amount/100)`; no unexpected ETH/token transfer. Test below 100 base units and ensure UI fee matches the contract. Tester B repeats and verifies a refresh/reconnect.

**Stop:** failed source verification, incorrect constructor argument, address/amount/event mismatch, RPC errors, UI success before confirmation, or failed wallet reconnect. Fix, retag, and repeat steps 1–4.

## 5. Mainnet deployment ceremony

Begin only with Sepolia acceptance recorded. On the deployer machine:

```bash
git fetch --tags && git checkout <tag>
yarn install --frozen-lockfile
yarn compile && yarn foundry:test && yarn lint && yarn next:build

export BASE_MAINNET_RPC_URL='https://<production-rpc>'
export ETHERSCAN_API_KEY='<basescan-api-key>'
export PRIVATE_KEY='<new-mainnet-deployer-private-key>'
export MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export FEE_RECIPIENT_ADDRESS='0x<reviewed-address>'
export OWNER_ADDRESS='0x<reviewed-multisig-or-none>'
cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
```

The script must print and consume those exact values and include `require(block.chainid == 8453)`. If it cannot, add that guard, test it, retag, and rehearse again. First simulate, then have the reviewer compare every printed argument before the one broadcast:

```bash
cd packages/foundry
forge script script/<ActualDeployScript>.s.sol:<ActualScriptContract> --rpc-url base -vvvv
forge script script/<ActualDeployScript>.s.sol:<ActualScriptContract> \
  --rpc-url base --broadcast --verify -vvvv
cd ../..
```

At the hardware-wallet screen reviewer checks Base Mainnet, `DEPLOYER_ADDRESS`, and create data. Never retry a timeout before looking up the deployer nonce/transaction on Basescan. If broadcast succeeded but verification failed, verify the existing address; never redeploy just to get a new address.

Record `MAINNET_TIPPING_ADDRESS`, creation hash/block, verified Basescan URL, deployer, compiler settings, constructor data and bytecode hash. On two RPC providers verify bytecode and actual getters:

```bash
export MAINNET_TIPPING_ADDRESS='0x<deployed-address>'
cast code "$MAINNET_TIPPING_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$MAINNET_TIPPING_ADDRESS" '<actualUsdcGetter>()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$MAINNET_TIPPING_ADDRESS" '<actualFeeRecipientGetter>()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$MAINNET_TIPPING_ADDRESS" '<actualFeeGetter>()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
```

**Gate:** bytecode exists; token is canonical USDC; recipient equals reviewed address; fee equals 100 basis points (or the documented contract equivalent). Transfer ownership/admin to `OWNER_ADDRESS` if needed, verify its receipt/getter, and remove deployer privileges. Any difference is a stop.

## 6. Deploy frontend, smoke test, then announce

Set Vercel **Production** variables to the exact mainnet values above (not Preview). Build locally:

```bash
cd packages/nextjs
yarn build && yarn start
cd ../..
yarn vercel:yolo --prod
```

On local production build, then the Vercel URL, test incognito and mobile wallet: HTTPS, no console errors/secrets, verified explorer contract link, wrong-chain guard, rejected connect/approval errors, reconnect, and an approval whose spender is exactly `MAINNET_TIPPING_ADDRESS`. Default approval must be exact/clearly bounded, never `MaxUint256` without an explicit user choice.

Configure custom domain, Vercel DNS/HTTPS, canonical redirect, WalletConnect allowed origin, RPC-provider origin allowlist, analytics/error-monitoring and backend CORS. Do this only after the temporary URL passes. Then Tester A and B each make one small public-URL tip—use `1.00 USDC` so expected splits are `0.99` creator and `0.01` platform—and independently compare wallet calldata, UI receipt, explorer decoding, and both USDC balance deltas.

**Go/no-go:** announce only when both transactions pass and both people sign the release issue. On failure, halt promotion and disable tip UI with a Vercel rollback/redeploy; preserve hashes/logs. Frontend rollback cannot undo a completed transfer. Invoke an on-chain pause only if it exists, is multisig controlled, and was tested.

## 7. Operate safely

Before announcement create alerts for failed frontend deployments, browser errors, RPC/rate-limit failures, contract tip/admin events, owner/implementation/fee-recipient changes, and fee-recipient USDC balance. Both people receive them. Retire the deployer key after deployment.

For the first seven days, record daily URL/domain availability, RPC success, latest verified events, a low-value tip check, and invariant configuration. Publish a support/status page saying tips use USDC on Base, the 1% fee and rounding, transaction finality, wallets supported, and support contact.

If funds appear at risk: stop promotion and disable spending; use only the pre-tested multisig pause if available; preserve tx hashes, blocks, logs, and affected addresses; give users factual status with explorer links; fix, retag, and redo the Sepolia-to-mainnet process. Never perform an emergency deployment/admin call based solely on a chat instruction.

## Current reference values

- Base Mainnet: chain ID `8453`; public RPC `https://mainnet.base.org` is rate limited.
- Base Sepolia: chain ID `84532`; test USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Circle Base mainnet USDC (6 decimals): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

Sources: [Base network configuration](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC overview](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Base Foundry deployment](https://docs.base.org/get-started/deploy-smart-contracts), and [Scaffold-ETH 2 Foundry layout](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

