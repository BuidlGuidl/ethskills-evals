# Production launch runbook — Base USDC creator tips

This is a stop-the-line runbook. Do each numbered section in order; do not advance past a **Gate** until every check passes. The working tree used below is the actual Scaffold-ETH 2 (SE2), Foundry-flavour app repository, not the directory containing this document.

The production network is **Base Mainnet** (chain ID `8453`). The token is native USDC on Base:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
decimals: 6
```

Confirm that address from Base’s official documentation before each deployment; never copy a token address from a search result or social post. Base’s free public RPC is rate-limited and is not suitable for a production app, so this runbook uses a paid/reliable RPC provider for the website and deployment, kept only in environment variables.

## 0. Assign responsibility and create the two wallets

**Person A (deployer)** controls a new, dedicated deployment EOA. It has only enough Base ETH to deploy and verify. **Person B (operator)** controls the fee-recipient/owner address. For a contract with owner, withdrawal, pause, fee-update, or upgrade authority, this must be a 2-of-2 Safe controlled by both people before mainnet deployment. If the contract is deliberately immutable and has no privileged functions, write `IMMUTABLE — no admin` in the launch record instead.

Do not use a personal wallet, a seed phrase, or a long-lived treasury key as the deployer. Do not put either private key in a shell history, source code, a ticket, chat, or a hosted environment variable that the frontend can read.

In the repository root, record public values only:

```bash
git checkout -b launch/base-mainnet
git status --short
git log -1 --oneline
```

Create `docs/launch-record.md` (or an equivalent private launch ticket) with blank fields for the commit SHA, deployer address, admin/Safe address, fee-recipient address, Base Sepolia contract address, Base Mainnet contract address, deployment transaction hashes, bytecode hashes, and production URL. It must contain **no secrets**.

**Gate 0:** both people independently read the intended 1% fee rule and identify: (a) every privileged function, (b) who receives fees, (c) whether fees are automatically forwarded or retained and withdrawn, and (d) whether the deployed contract can be upgraded. Stop if those answers are not unambiguous in the Solidity code and tests.

## 1. Freeze and inspect the exact release

From the app repository root:

```bash
git status --short
git rev-parse HEAD
yarn install --immutable
yarn test
yarn lint
yarn format:check
yarn build
find packages/foundry/contracts packages/foundry/script packages/foundry/test -type f -print | sort
sed -n '1,240p' packages/nextjs/scaffold.config.ts
rg -n --glob '*.sol' --glob '*.ts' --glob '*.tsx' 'fee|USDC|withdraw|owner|pause|upgrade|transferFrom|approve|decimals' packages/foundry packages/nextjs
```

If this release has different package-script names, discover them once and use the equivalent commands in the rest of this runbook:

```bash
node -e 'console.log(require("./package.json").scripts)'
node -e 'console.log(require("./packages/foundry/package.json").scripts)'
node -e 'console.log(require("./packages/nextjs/package.json").scripts)'
```

Do not silently substitute a different deployment script. Open the script that `yarn deploy` invokes and write down the constructor arguments and their order. In particular, verify that its USDC address is not a local fork-only address and that the fee recipient/admin are explicit values.

Run the contract test suite with maximum useful detail and coverage:

```bash
cd packages/foundry
forge test -vvv
forge coverage
forge build --sizes
cd ../..
```

Add regression tests now, before testnet, for all of the following (using `6` decimal USDC amounts):

- a 1.00 USDC tip transfers exactly 0.99 USDC to the creator and 0.01 USDC to the configured fee recipient/fee accounting;
- tiny amounts and non-divisible amounts obey the documented rounding rule;
- zero amount, zero creator, a creator equal to the tipper, and insufficient USDC revert or behave exactly as specified;
- the contract cannot take more than the user-approved amount; the UI asks for an exact approval (or its documented bounded multiple), never `type(uint256).max`;
- only the documented admin can change a fee, withdraw, pause, or upgrade, and the fee cannot exceed its intended hard cap; and
- emitted event fields match the amounts and addresses shown in the UI.

**Gate 1:** `yarn test`, `yarn lint`, `yarn format:check`, `yarn build`, `forge test -vvv`, and `forge coverage` pass from a clean install. A second person reviews the fee arithmetic and privileged paths. Commit only then:

```bash
git add packages/foundry packages/nextjs docs
git diff --cached --check
if git diff --cached --name-only | grep -iE '(^|/)(\.env|.*key|.*secret|.*private)'; then
  echo "STOP: a likely secret-bearing file is staged"; exit 1
fi
git diff --cached
git commit -m "chore: prepare Base launch"
git rev-parse HEAD
```

The `grep` command returning no matches is expected. If it does match, remove the secret or unstage the file; do not commit it.

## 2. Make configuration production-safe (but do not deploy yet)

First make sure secrets can never be tracked:

```bash
rg -n '^(\.env|\.env\.\*|\*\.key|broadcast/|cache/|node_modules/)$' .gitignore || true
```

Ensure `.gitignore` contains these lines (add only missing lines):

```gitignore
.env
.env.*
!.env.example
*.key
broadcast/
cache/
node_modules/
```

In `packages/nextjs/scaffold.config.ts`, change the target from the local Foundry chain to Base and prevent the burner wallet from appearing outside local development. Preserve unrelated options. The resulting relevant lines must be equivalent to:

```ts
import { base } from "viem/chains";

const scaffoldConfig = {
  targetNetworks: [base],
  burnerWalletMode: "localNetworksOnly",
  rpcOverrides: {
    [base.id]: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
  },
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
};
```

Some SE2 versions name the burner setting `onlyLocalBurnerWallet: true`. If that is the property already present in your config, retain it rather than adding a second setting. It has the same required outcome: no burner wallet in a public build. Never edit `packages/nextjs/contracts/deployedContracts.ts`; SE2 regenerates it.

Ensure the production USDC address is a single chain-specific constant in the contract deployment configuration, not user input, and is exactly:

```ts
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
```

If your contract receives the USDC address in its constructor, pass this value from the Foundry deployment script for Base. If it uses an immutable constant, compare that constant to this address. The frontend’s external USDC ABI/address, if used, belongs in `packages/nextjs/contracts/externalContracts.ts` before building; it must be keyed by chain ID `8453` and use a minimal ERC-20 ABI including `allowance`, `approve`, `balanceOf`, and `decimals`.

Create local-only environment files; use the names your existing scripts already read:

```bash
touch .env.example
touch .env.local
touch packages/nextjs/.env.local
```

Put **names only** in `.env.example`:

```dotenv
DEPLOYER_PRIVATE_KEY=
BASE_RPC_URL=
NEXT_PUBLIC_BASE_RPC=
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=
```

Put the real deployer key and authenticated RPC only in the ignored root `.env.local` (or the existing ignored `.env` expected by the deploy task). Put only browser-safe values in `packages/nextjs/.env.local`:

```dotenv
NEXT_PUBLIC_BASE_RPC=https://YOUR-RPC-PROVIDER.example/YOUR_PUBLIC_OR_RESTRICTED_CLIENT_KEY
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_PUBLIC_PROJECT_ID
```

`NEXT_PUBLIC_*` values are shipped to browsers. Restrict the RPC key by allowed origin/domain and rate limit it; do not place a deployer key there. For deployment, prefer importing the deployer key into Foundry’s encrypted keystore and using the keystore account rather than setting a raw key in an environment variable:

```bash
cast wallet import base-launch-deployer --interactive
cast wallet address --account base-launch-deployer
```

If the current SE2 deploy script only supports `DEPLOYER_PRIVATE_KEY`, use a newly created low-balance deployer and place that value solely in the ignored deployment environment file. Do not alter it to a personal or treasury key merely for convenience.

**Gate 2:** inspect the staged patch and validate no secret is present:

```bash
git add .gitignore .env.example packages/nextjs/scaffold.config.ts packages/foundry/script packages/nextjs/contracts
git diff --cached --check
if git diff --cached --name-only | grep -E '(^|/)\.env(\.|$)' | grep -v '\.env\.example$'; then
  echo "STOP: an environment file other than .env.example is staged"; exit 1
fi
if git grep -nE '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]|infura\.io/v3/[A-Za-z0-9]' -- ':!*.lock'; then
  echo "STOP: possible credential in tracked source"; exit 1
fi
git diff --cached
git commit -m "config: target Base mainnet safely"
```

## 3. Rehearse on live Base Sepolia

Do not send the first live transaction to mainnet. Use the same release commit and deployment path on Base Sepolia first. Add `baseSepolia` beside `base` in `scaffold.config.ts` temporarily only if the app needs to render the testnet deployment; do not leave Base Sepolia as the production target.

Set the Sepolia RPC in the ignored deployment environment, fund the dedicated deployer with a small amount of Base Sepolia ETH from an official faucet, then verify the account and network **before** deployment:

```bash
export BASE_SEPOLIA_RPC_URL="https://YOUR-RELIABLE-RPC.example/BASE_SEPOLIA_KEY"
export DEPLOYER_ADDRESS="$(cast wallet address --account base-launch-deployer)"
cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

The first command must print `84532`; the balance must be non-zero. In the SE2 repo’s normal shell (where its ignored env file is available), deploy:

```bash
yarn deploy --network baseSepolia
```

Copy the contract address and deployment transaction hash into the launch record. Verify immediately using the repository’s verifier command:

```bash
yarn verify --network baseSepolia
```

If the project uses a different Foundry script name, use its exact script with `--rpc-url "$BASE_SEPOLIA_RPC_URL" --account base-launch-deployer`; the network gate above remains mandatory. Never use `--broadcast` until the displayed RPC chain ID has been checked.

Point the local frontend at Base Sepolia and start it:

```bash
yarn start
```

With two separately funded test wallets, manually test in a normal browser:

1. Connect both MetaMask and a WalletConnect-compatible wallet; verify the wrong-network state offers only **Switch network**.
2. On Base Sepolia, choose a creator and enter `1.00` USDC. Verify the UI offers only **Approve USDC**, asks for the exact/bounded documented amount, and displays 6-decimal amounts correctly.
3. Confirm the approval, wait for confirmation, refresh, and verify that the UI now offers only **Send tip**. Reject an approval once and confirm that the UI recovers without a false success state.
4. Send the tip. Reject once, then send it successfully. Refresh and check the Base explorer transaction logs and token balances: 0.99 USDC reaches the creator and 0.01 USDC reaches fee accounting/recipient for a 1.00 USDC tip, subject only to the documented rounding rule.
5. Try zero, below-minimum, insufficient-balance, and a deliberately stale allowance. Errors must be plain language; buttons must be disabled while a transaction is pending; no duplicate transaction may occur.
6. Exercise every admin action with the admin/Safe path and confirm a fan wallet cannot call it. If the contract retains fees, execute the documented withdrawal with a tiny amount and verify recipient and accounting.

**Gate 3:** the source is verified, the explorer shows the expected constructor arguments and bytecode, and both wallets complete the journey with correct balances. Any contract defect means: stop, write a failing local regression test, fix it, repeat sections 1–3, and deploy a new address. Do not patch a deployed contract unless its pre-reviewed upgrade process explicitly requires it.

## 4. Mainnet deployment ceremony

Choose a quiet release window. Freeze the release commit after Gate 3; any code/config change restarts the relevant gates.

Set up a reliable Base Mainnet RPC and fund the dedicated deployer with a small ETH buffer. Fund it from a wallet you control on Base; send a small test transfer first and verify it on the explorer. Do not fund it with USDC—the deployer needs ETH for gas. Then run:

```bash
export BASE_RPC_URL="https://YOUR-RELIABLE-RPC.example/BASE_MAINNET_KEY"
export DEPLOYER_ADDRESS="$(cast wallet address --account base-launch-deployer)"
cast chain-id --rpc-url "$BASE_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_RPC_URL"
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url "$BASE_RPC_URL"
```

**Hard stop:** those commands must respectively show `8453`, a sufficient non-zero ETH balance, and non-empty bytecode for USDC. Person B reads the displayed deployer, chain ID, USDC address, fee recipient, admin/Safe, and 1% fee aloud against the launch record. Person A then runs exactly one deployment:

```bash
yarn deploy --network base
```

Record the printed contract address and transaction hash. Wait for the transaction to be finalized/confirmed in the Base explorer, then verify without changing source or compiler settings:

```bash
yarn verify --network base
```

Immediately use `cast` against mainnet to independently inspect the deployment. Replace the placeholder function signatures with the exact public getter names identified in section 1; do not guess their names:

```bash
export TIPPING_ADDRESS=0xPASTE_DEPLOYED_CONTRACT_ADDRESS
cast code "$TIPPING_ADDRESS" --rpc-url "$BASE_RPC_URL"
# Examples only — use the contract’s actual ABI/getters:
cast call "$TIPPING_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
cast call "$TIPPING_ADDRESS" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
cast call "$TIPPING_ADDRESS" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
cast call "$TIPPING_ADDRESS" 'owner()(address)' --rpc-url "$BASE_RPC_URL"
```

**Gate 4:** verified source is visible on an explorer; live bytecode is non-empty; USDC is exactly the Base address above; fee is `100` basis points (or the contract’s mathematically equivalent 1% value); recipients and admin match the launch record. If any value is wrong, do **not** use the address or publish the frontend. Determine whether a safe pause is available; otherwise deploy a corrected new contract and abandon the wrong address publicly.

## 5. Mainnet canary before public hosting

Using a private local frontend configured for Base Mainnet, use wallets controlled by the team. Transfer only the small USDC needed for this canary. Do not ask an external user to test first.

```bash
cd packages/nextjs
NEXT_PUBLIC_BASE_RPC="$BASE_RPC_URL" yarn build
NEXT_PUBLIC_BASE_RPC="$BASE_RPC_URL" yarn start
```

Perform the same six browser tests from Gate 3, including an approval rejection and a successful small tip. Confirm every transaction in the Base explorer, both final USDC balances, event fields, and the 1% fee. Test wrong network and wallet disconnect/reconnect. Open DevTools and require no errors, failed RPC calls, hydration errors, or secrets in the network responses/source maps.

**Gate 5:** both people sign off on the exact mainnet tip transaction hash, the balance arithmetic, and the live contract address. Freeze that address in the frontend; do not accept it from query parameters, local storage, or user input.

## 6. Build and deploy the public frontend

Use Vercel for this dynamic Next.js deployment; it provides a stable URL, TLS, previews, and rollback. (Use `yarn ipfs` only if `yarn build` is fully static and the app has no server routes, SSR, API routes, or runtime environment dependency.)

Before deployment, set the production metadata in the existing Next.js layout/metadata file:

- accurate title and description that say tips are USDC on Base;
- canonical production URL and 1200×630 Open Graph image;
- a support/contact and terms/privacy link appropriate to collecting a platform fee; and
- no localhost URL, testnet address, test funds, or SE2 branding.

Build from the release commit, with production values but no deployer key:

```bash
git status --short
git rev-parse HEAD
cd packages/nextjs
NEXT_PUBLIC_BASE_RPC="https://YOUR-PRODUCTION-RPC.example/CLIENT_KEY" \
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_PUBLIC_PROJECT_ID" \
yarn build
```

In Vercel, import the repository and set the Root Directory to `packages/nextjs` if it is a monorepo. Add these **Production** environment variables (and their Preview equivalents if you want functional previews):

```dotenv
NEXT_PUBLIC_BASE_RPC=https://YOUR-PRODUCTION-RPC.example/CLIENT_KEY
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_PUBLIC_PROJECT_ID
```

Set the provider’s allowed origins to the Vercel production domain and the custom domain before launching. Do not configure `DEPLOYER_PRIVATE_KEY`, an admin key, or an unrestricted RPC credential in Vercel. Deploy a preview first:

```bash
cd ../..
yarn vercel
```

On the preview URL test wallet connect, Base switching, reads, formatting, mobile layout, and the UI’s no-burner-wallet behavior. Then promote only the tested commit:

```bash
yarn vercel --prod
```

Attach the custom domain in Vercel, update DNS exactly as Vercel specifies, and wait for TLS to become valid. Add that canonical URL to the WalletConnect and RPC-provider allowlists.

**Gate 6:** production URL serves HTTPS; browser source contains the mainnet contract address but no private key; wallet connect/switch/read works; the canary tip works from the public URL; link-preview metadata renders; and the site is usable at 320px width. Test MetaMask plus one WalletConnect wallet on desktop and mobile.

## 7. Public release, monitoring, and rollback

Publish only after Gate 6. Announce the exact canonical URL and Base network. Never announce an unverified contract address or a URL that has not passed a real mainnet canary.

For the first 48 hours, both people monitor:

- RPC/provider error rate and quota, Vercel function/client errors, and browser-console reports;
- failed/abandoned approval and tip transactions, duplicate tips, and user reports of wrong-network or wallet-connect failures;
- `Tip` events, USDC balances, and fee-accounting reconciliation at least daily; and
- the deployer wallet. After deployment, move any surplus ETH out; never reuse this hot key for admin or treasury actions.

Record every incident, transaction hash, and resolution in the launch record. Enable provider/Vercel spending and error alerts before the public announcement.

For a **frontend-only** fault, immediately remove the public announcement, roll Vercel back to the last known-good deployment, and keep the contract address unchanged. Test the rollback URL before re-announcing it.

For a suspected **contract or fund-safety** fault, immediately stop promotion and, if the contract has a pre-reviewed pause switch, have the admin/Safe pause it. Publish a clear status notice. Do not improvise an upgrade or a withdrawal. Reproduce on the Base fork, add a regression test, obtain a new two-person review, deploy/verify a corrected contract, run the full canary again, then change the frontend only after it points to the verified replacement address.

## Reference checks

Before performing this runbook, re-check these primary sources for current network details: [Base network connection details](https://docs.base.org/base-chain/quickstart/connecting-to-base), which lists Mainnet chain ID 8453 and notes the public RPC is rate-limited; [Base USDC example](https://docs.base.org/base-account/reference/prolink-utilities/encodeProlink), which shows the Base USDC address used above; and [Base’s Foundry deployment guide](https://docs.base.org/get-started/deploy-smart-contracts), which documents protected Foundry keystore use.
