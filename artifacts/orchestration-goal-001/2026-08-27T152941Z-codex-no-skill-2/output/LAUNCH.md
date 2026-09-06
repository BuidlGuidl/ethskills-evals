# Base production launch runbook

This ordered runbook takes the existing Foundry-flavour Scaffold-ETH 2 tip app
from a working local fork to a public Base mainnet URL. Do not skip a gate. A
gate passes only when its commands succeed and the listed result is inspected.

The app accepts native USDC, sends 99% of each tip to its creator, and sends a
1% (100 basis points) platform fee to a fee recipient. This runbook assumes an
immutable contract. If it is upgradeable, stop and arrange a separate proxy,
admin-key, and timelock/multisig review before launch.

## 0. Set the release rules and accounts

Create a private password-manager record named `Tip app / Base launch`. It is
the only place private keys, RPC credentials, API keys, recovery phrases, and
deployment records may live. Never put a private key in Git, an `.env` file
that can be committed, the frontend, Vercel, a deployment script, shell
history, CI logs, chat, or an issue.

Use three different accounts:

| Role | Variable | Use |
| --- | --- | --- |
| Deployer | `DEPLOYER_ADDRESS` | broadcasts one deployment; no continuing authority |
| Owner | `OWNER_ADDRESS` | admin control; preferably a Safe |
| Fee recipient | `FEE_RECIPIENT_ADDRESS` | receives the 1% fee; preferably a Safe |

Use the following constants. The public Base RPC is for an occasional
read-only check only; it is rate-limited and not for production traffic. Use an
authenticated provider endpoint for deploying and for app reads.

| Value | Base Sepolia rehearsal | Base mainnet production |
| --- | --- | --- |
| chain ID | `84532` | `8453` |
| RPC variable | `BASE_SEPOLIA_RPC_URL` | `BASE_MAINNET_RPC_URL` |
| native USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7` | `0x833589fCD6Edb6E08f4c7C32D4f71b54bdA02913` |
| explorer | `https://sepolia.basescan.org` | `https://basescan.org` |

Before code work, both people record and agree on: the creator onboarding
model; whether an emergency pause exists and who can use it; the owner and fee
Safe addresses; support email; terms, privacy, finality, fee and risk
disclosures; and a tiny internal mainnet pilot cap and the person permitted to
raise it. Get legal advice appropriate to the jurisdiction and business model
before accepting public payments.

**Gate 0:** both people approve the above. There is a plan to obtain real USDC
and ETH for a two-wallet Sepolia rehearsal. Sepolia USDC is not mainnet USDC.

## 1. Freeze a reproducible release candidate

From the root of the actual app repository (not the directory containing this
file), create the launch branch and discover the real paths and commands.

```bash
git switch -c chore/base-mainnet-launch
corepack enable
yarn install --immutable
git status --short
find packages -maxdepth 3 -type f \( -name foundry.toml -o -name package.json \) -print
rg -n --hidden -g '!node_modules' -g '!broadcast' \
  'localhost|31337|anvil|sepolia|mainnet|base|USDC|fee|basis|bps|deployedContracts' \
  packages README.md .env.example 2>/dev/null || true
```

Identify the Foundry directory, Solidity deploy script and contract identifier,
Next.js directory, and the generated deployment artifact. In the normal
Scaffold-ETH layout these are `packages/foundry`, `script/Deploy.s.sol`, and
`packages/nextjs/generated/deployedContracts.ts`, but use what the command
finds. Set these **non-secret** values once in the current shell:

```bash
export FOUNDRY_DIR="$PWD/packages/foundry"
export NEXTJS_DIR="$PWD/packages/nextjs"
export DEPLOY_SCRIPT='script/Deploy.s.sol:Deploy'
export TIP_CONTRACT='src/CreatorTips.sol:CreatorTips'
export USDC_SEPOLIA='0x036CbD53842c5426634e7929541eC2318f3dCF7'
export USDC_BASE='0x833589fCD6Edb6E08f4c7C32D4f71b54bdA02913'
export OWNER_ADDRESS='0xREPLACE_WITH_CHECKSUMMED_OWNER'
export FEE_RECIPIENT_ADDRESS='0xREPLACE_WITH_CHECKSUMMED_FEE_SAFE'
export DEPLOYER_ADDRESS='0xREPLACE_WITH_CHECKSUMMED_DEPLOYER'
export BASE_SEPOLIA_RPC_URL='https://REPLACE_WITH_PROVIDER_BASE_SEPOLIA_RPC'
export BASE_MAINNET_RPC_URL='https://REPLACE_WITH_PROVIDER_BASE_MAINNET_RPC'
```

Use a fresh deployer key funded only for deployment. Store it in Foundry's
encrypted local keystore, not in a shell variable or command argument. In a
dedicated deployment shell, disable history and import it interactively; choose
a strong one-time keystore password and record that password separately:

```bash
cd "$FOUNDRY_DIR"
set +o history
cast wallet import launch-deployer --interactive
read -r -s -p 'BaseScan API key: ' ETHERSCAN_API_KEY; echo
export ETHERSCAN_API_KEY
```

Foundry will prompt for the encrypted-keystore password on broadcasts and uses
`ETHERSCAN_API_KEY` for the verification commands below. Do not pass either
secret as a command-line flag.

Add `.env.example` with names only; put real local secret files in
`.gitignore`. Check that no secrets or prior broadcasts are tracked:

```bash
rg -n '^\.env|\.vercel|broadcast|cache' .gitignore packages/*/.gitignore
git check-ignore -v .env .env.local packages/foundry/.env packages/nextjs/.env.local
git ls-files | rg '(^|/)(\.env|\.env\.local|broadcast/|cache/)' && exit 1 || true
```

If a secret was committed, stop, rotate it, and remove it from history using
the approved repository procedure. Adding `.gitignore` alone is not a fix.

**Gate 1:** clean dependency install, known real paths, and no tracked secret.
Both people agree on the exact deploy-script constructor/configuration inputs.

## 2. Make the contract release-worthy

Pin the Solidity compiler, optimizer runs, EVM version, and remappings in
`foundry.toml`; do not use a floating compiler. Preserve existing pinned
settings. Build and test the exact configuration that will deploy:

```bash
cd "$FOUNDRY_DIR"
forge --version
forge config
forge clean
forge build --sizes
forge test -vvv
forge test --gas-report
slither . --exclude-dependencies
```

Add missing tests before continuing. They must prove:

1. A 1,000,000-unit USDC tip (1 USDC) moves 990,000 to the creator and 10,000
   to the fee recipient, with no unexpected contract balance.
2. Smallest allowed, non-divisible-by-100, and largest allowed amounts have a
   deliberately defined rounding result. The UI shows that same result.
3. Zero recipient/amount, invalid recipient, insufficient balance/allowance,
   and failed token transfer revert without money moving.
4. Only the intended admin may change settings; fee is fixed at 100 bps or has
   a tested maximum and event.
5. Reentrancy and non-standard/false-return ERC-20 behavior cannot create a
   false success or take extra funds.
6. Every tip and administrative money-flow change emits an event containing
   all values the frontend/operations depend on.

Review every Slither finding. Fix high/medium issues or record a concrete,
signed-off false-positive rationale. The teammate who did not author the
contract reviews the final commit, specifically USDC wiring, `transferFrom`
payer, fee arithmetic, access control, events, rescue/withdraw functions and
reentrancy. For material value, obtain an independent contract audit before
mainnet.

**Gate 2:** all checks pass on a clean commit; bytecode is within EIP-170;
review is recorded; and the script receives USDC, owner, and fee-recipient
addresses as inputs—not localhost or a developer wallet.

## 3. Make wrong-network production impossible

Update the app's Wagmi/Scaffold configuration to include `base` and
`baseSepolia` from `viem/chains`. Production must default to Base, use an
authenticated RPC, reject transactions when `chain.id !== 8453`, offer
“Switch to Base,” and contain neither `hardhat` nor `localhost` in its
production chain list.

The production frontend must use only public values like these (adapt the
variable names if this app already has an established convention):

```dotenv
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://REPLACE_WITH_PROVIDER_PUBLIC_BASE_MAINNET_RPC
NEXT_PUBLIC_TIP_CONTRACT=0xREPLACE_AFTER_MAINNET_DEPLOYMENT
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6Edb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_BASESCAN_URL=https://basescan.org
NEXT_PUBLIC_PLATFORM_FEE_BPS=100
NEXT_PUBLIC_SUPPORT_EMAIL=support@REPLACE_WITH_YOUR_DOMAIN
```

A `NEXT_PUBLIC_` variable is visible to every visitor. It must never contain
a private key or privileged provider token. Configure provider origin/rate
limits for the public client key, and separate server-only credentials only if
a server actually needs one.

The UI must read and require `decimals() == 6` and `symbol() == "USDC"`
before enabling tipping. It must show connected chain, USDC address, tip to
creator, 1.00% fee, total, contract address and transaction state. It must
disable duplicate clicks and say success only after a successful receipt whose
event matches payer, creator, gross amount and fee. Request exact per-tip
allowance (or only the allowance deficit), never `MaxUint256`, and link users
to revoke an allowance.

Commit a production-config check that fails unless mainnet ID, USDC code and
contract getters match expected values. Start by proving the token:

```bash
cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL"
cast code "$USDC_BASE" --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_MAINNET_RPC_URL"
```

Extend it with the real getter signatures, e.g. `usdc()(address)`,
`owner()(address)`, `feeRecipient()(address)`, and
`platformFeeBps()(uint256)`. Run it in CI before a production deploy.

**Gate 3:** no production build input references localhost, 31337, Sepolia, or
a Sepolia address; config check passes against a known Base deployment; UI fee
matches rounding tests; teammate reviews compiled public configuration.

## 4. Mandatory Base Sepolia dress rehearsal

Fund only the Sepolia deployer with test ETH. Verify network and token before
broadcasting:

```bash
cd "$FOUNDRY_DIR"
test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = 84532
test "$(cast code "$USDC_SEPOLIA" --rpc-url "$BASE_SEPOLIA_RPC_URL")" != 0x
test "$(cast call "$USDC_SEPOLIA" 'decimals()(uint8)' --rpc-url "$BASE_SEPOLIA_RPC_URL")" = 6
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Set the deploy-script inputs to `$USDC_SEPOLIA`, `$OWNER_ADDRESS`, and
`$FEE_RECIPIENT_ADDRESS`. Inspect the rendered inputs with the script's
dry-run option if it has one. Then broadcast once:

```bash
forge script "$DEPLOY_SCRIPT" \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --account launch-deployer \
  --broadcast -vvvv
```

Copy the printed deployed address, transaction hash, and block number; do not
infer the address. Verify code and source:

```bash
export TIP_CONTRACT_ADDRESS='0xPASTE_DEPLOYED_SEPOLIA_ADDRESS'
test "$(cast code "$TIP_CONTRACT_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL")" != 0x
cast codehash "$TIP_CONTRACT_ADDRESS" --rpc-url "$BASE_SEPOLIA_RPC_URL"
forge verify-contract --chain-id 84532 \
  "$TIP_CONTRACT_ADDRESS" "$TIP_CONTRACT" \
  --watch
cast call "$TIP_CONTRACT_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$TIP_CONTRACT_ADDRESS" 'owner()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$TIP_CONTRACT_ADDRESS" 'feeRecipient()(address)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
cast call "$TIP_CONTRACT_ADDRESS" 'platformFeeBps()(uint256)' --rpc-url "$BASE_SEPOLIA_RPC_URL"
```

Replace the getter signatures with this contract's ABI where necessary. The
values must be Sepolia USDC, intended owner, intended fee recipient, and 100.

Deploy a private frontend preview configured for Sepolia. In two fresh browser
profiles/wallets, obtain test USDC and perform:

1. unsupported chain → clear switch prompt; Base Sepolia → connect;
2. invalid inputs → no wallet prompt; valid amount → exact approval then tip;
   reject each prompt once → honest error and safe retry;
3. receipt/event and both token balance deltas agree with every rounding case;
4. reload and use another wallet; no localhost address/RPC survives;
5. duplicate click, low ETH, insufficient USDC and a revert never show false
   success or a permanently stuck state;
6. applicable owner action proves the intended owner, not a random wallet, has
   authority.

**Gate 4:** source verified on the explorer; codehash and deployment record are
saved; the two people independently pass the journey. Any money-flow or
configuration defect means fix it and repeat this whole rehearsal.

## 5. One controlled Base mainnet deployment

Create and push the final review tag. Mainnet source must be byte-for-byte the
reviewed source; only network settings and constructor arguments may differ.

```bash
git status --short
git rev-parse HEAD
git tag -a base-mainnet-launch-candidate -m 'Reviewed Base mainnet candidate'
git push origin HEAD --follow-tags
cd "$FOUNDRY_DIR"
forge clean && forge build && forge test -vvv
```

Fund the new deployer with a conservative amount of Base ETH from a controlled
wallet. Before entering its key, prove every input:

```bash
test "$(cast chain-id --rpc-url "$BASE_MAINNET_RPC_URL")" = 8453
test "$(cast code "$USDC_BASE" --rpc-url "$BASE_MAINNET_RPC_URL")" != 0x
test "$(cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_MAINNET_RPC_URL")" = 6
test "$(cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_MAINNET_RPC_URL")" = '"USDC"'
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
```

Set script arguments to `$USDC_BASE`, `$OWNER_ADDRESS`, and
`$FEE_RECIPIENT_ADDRESS`. The second person reads those exact rendered values
and the command output. Then broadcast exactly once:

```bash
forge script "$DEPLOY_SCRIPT" \
  --rpc-url "$BASE_MAINNET_RPC_URL" \
  --account launch-deployer \
  --broadcast -vvvv
```

Record transaction hash, block, timestamp, deployed address, deployer, owner,
fee recipient, USDC, Git commit, `forge --version`, `forge config`, and
codehash. Verify immediately:

```bash
export TIP_CONTRACT_ADDRESS='0xPASTE_DEPLOYED_MAINNET_ADDRESS'
test "$(cast code "$TIP_CONTRACT_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL")" != 0x
cast codehash "$TIP_CONTRACT_ADDRESS" --rpc-url "$BASE_MAINNET_RPC_URL"
forge verify-contract --chain-id 8453 \
  "$TIP_CONTRACT_ADDRESS" "$TIP_CONTRACT" \
  --watch
cast call "$TIP_CONTRACT_ADDRESS" 'usdc()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$TIP_CONTRACT_ADDRESS" 'owner()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$TIP_CONTRACT_ADDRESS" 'feeRecipient()(address)' --rpc-url "$BASE_MAINNET_RPC_URL"
cast call "$TIP_CONTRACT_ADDRESS" 'platformFeeBps()(uint256)' --rpc-url "$BASE_MAINNET_RPC_URL"
```

**Gate 5:** explorer source verification and every getter exactly match
mainnet USDC, the reviewed owner, fee recipient and 100 bps. If one value
differs, stop. Do not hastily deploy a replacement or point users at it.
Determine whether the contract is safely unusable, correct the script, repeat
review/rehearsal gates, then publish only the verified address. If needed,
transfer ongoing ownership to the intended Safe and verify its receipt; remove
unused ETH from the hot deployer.

## 6. Public frontend and mainnet canary

Regenerate the Scaffold deployment artifact from the verified deployment using
the repo's supported generator; do not manually type an ABI. Set every frontend
value to the verified mainnet address. Check build inputs before hosting:

```bash
cd "$NEXTJS_DIR"
rg -n --hidden -g '!node_modules' \
  'localhost|127\.0\.0\.1|31337|84532|036CbD53842c5426634e7929541eC2318f3dCF7' .
rg -n --hidden -g '!node_modules' "$TIP_CONTRACT_ADDRESS|$USDC_BASE|8453" .
yarn build
```

On Vercel (or the chosen host), add the Step 3 public values for **Preview**
and **Production**. Do not add a deployer key, explorer key, Safe credential,
or privileged RPC credential. A Vercel CLI flow is:

```bash
npm i -g vercel
vercel login
cd "$NEXTJS_DIR"
vercel link
vercel env add NEXT_PUBLIC_CHAIN_ID preview
vercel env add NEXT_PUBLIC_TIP_CONTRACT preview
vercel env add NEXT_PUBLIC_USDC_ADDRESS preview
vercel env add NEXT_PUBLIC_RPC_URL preview
vercel env add NEXT_PUBLIC_CHAIN_ID production
vercel env add NEXT_PUBLIC_TIP_CONTRACT production
vercel env add NEXT_PUBLIC_USDC_ADDRESS production
vercel env add NEXT_PUBLIC_RPC_URL production
vercel env ls
PREVIEW_URL="$(vercel deploy --logs)"
printf '%s\n' "$PREVIEW_URL"
```

At each prompt enter the audited value. Add support, Basescan and fee-bps
variables too if used. Environment changes need a new deployment. Test the
preview in two clean browser profiles with the tiny internal mainnet pilot
wallets; inspect receipt, event, creator balance and fee Safe balance on
Basescan.

Add the custom domain and configure exactly the DNS records reported by Vercel:

```bash
vercel domains add app.REPLACE_WITH_YOUR_DOMAIN <project-name>
vercel domains inspect app.REPLACE_WITH_YOUR_DOMAIN
```

Set one canonical HTTPS hostname with redirects; enable host MFA; restrict
project access to the two people; enable RPC/host spend and error alerts; keep
production previews restricted.

**Gate 6:** compiled preview contains only Base mainnet config, the verified
Basescan contract link, working legal/support pages and valid HTTPS. The pilot
tip's balances/events agree exactly. Both people approve the exact commit and
preview URL.

Release that exact commit, check logs, then use the canonical domain with a
fresh Base wallet for one last tiny canary tip:

```bash
PRODUCTION_URL="$(vercel deploy --prod --logs)"
printf '%s\n' "$PRODUCTION_URL"
vercel curl / --deployment "$PRODUCTION_URL"
vercel logs --environment production --level error --since 5m
```

Do not announce until the canary receipt succeeds and creator/fee deltas equal
the UI's displayed amounts. Then publish the URL, verified contract link, 1%
fee disclosure, finality notice and support address.

## 7. First 72 hours and incident response

For 72 hours, check daily: host errors/uptime; RPC quota/errors; Basescan tip
and fee events; pilot/canary creator and fee balance deltas; support reports;
and owner/Safe activity. Maintain a ledger with hash, gross amount, expected
fee, actual fee, creator delta, and incident notes.

Frontend rollback is reversible: redeploy the last known-good hosted deployment
only after confirming it still targets the correct verified contract. Contract
deployment is not reversible. If accounting or contract safety is suspect,
remove the tip action and public promotion, show an incident/support message,
invoke the agreed pause only if it exists, preserve hashes/logs, and never
claim onchain transfers can be reversed. For a key compromise, use the
Safe/account recovery procedure, rotate deployer and provider credentials,
revoke host access, and treat pending admin operations as untrusted until
verified onchain.

## References

[Base network values and production-RPC warning](https://docs.base.org/base-chain/quickstart/connecting-to-base).
[Foundry verification workflow](https://docs.blockscout.com/devs/verification/foundry-verification).
[Vercel CLI: link, preview, logs and production deploy](https://vercel.com/docs/projects/deploy-from-cli).
