# Launch runbook — Base production

Follow these stages in order. Do not pass a **GO** gate on verbal assurance.
The safe sequence is: Base fork (already done), Base Sepolia rehearsal, Base
mainnet contracts with a localhost frontend, then a public frontend.

Run commands from the application's checkout root, not this document's
directory. Record output, transaction hashes, contract addresses, and both
people's sign-off in one release ticket.

## Values to agree before touching mainnet

| Variable | Value |
| --- | --- |
| `USDC_BASE` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, Circle native USDC on Base |
| `FEE_RECIPIENT` | Team-controlled recipient, preferably a Safe; never an exchange deposit address |
| `OWNER` | Intended contract admin, preferably the Safe if there is an admin role |
| `DEPLOYER` | New dedicated deployer EOA, separate from treasury and users |
| `FAN`, `CREATOR` | Separate browser wallets for acceptance tests |
| `TIP_CONTRACT` | Mainnet address printed by deployment; do not guess it beforehand |

USDC uses 6 decimals: $1.00 is `1000000`, and a 1% fee on it is
`10000`. The contract must use an exact integer 1% formula (normally 100
basis points); it must never use a frontend-only fee rule or 18-decimal ETH
helpers.

At the start of each terminal session that uses the commands below, set the
non-secret shell values from the signed-off table (replace only the angle
brackets):

```bash
export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export DEPLOYER=<dedicated_deployer_address>
export FAN=<acceptance_fan_address>
export CREATOR=<acceptance_creator_address>
export FEE_RECIPIENT=<safe_fee_recipient_address>
export OWNER=<safe_owner_address>
```

Use a production RPC provider for deployment and the public app. Base's
public RPC is rate-limited and not for production. Chain IDs are Base Sepolia
`84532` and Base mainnet `8453`.

## 0. Freeze and prove the release candidate

1. Create the release branch/tag and require a clean tree.

   ```bash
   git switch -c release/base-v1
   git status --short
   git log -1 --oneline
   git tag -a base-v1-rc1 -m "Base v1 release candidate"
   ```

   **GO:** `git status --short` has no output except deliberate reviewed
   changes. A late contract change means add a regression test, make a new
   tag, and restart this stage.

2. Inspect the actual contract and deployment inputs; do not assume names.

   ```bash
   rg -n --glob '*.sol' 'constructor|USDC|usdc|fee|Fee|recipient|owner|withdraw|tip' packages/foundry/contracts packages/foundry/script packages/foundry/test
   sed -n '1,240p' packages/foundry/script/Deploy*.s.sol
   ```

   Configure the script/constructor/initializer to use `USDC_BASE`,
   `FEE_RECIPIENT`, and `OWNER`. If any are hard-coded, change source or
   script now, add a test for the value, and review the diff. A frontend
   setting cannot secure a contract.

3. Re-run all release checks and a clean fork rehearsal.

   ```bash
   yarn install --immutable
   yarn compile
   yarn test
   yarn lint
   yarn next:check-types
   yarn next:build
   yarn fork --network base
   ```

   In another terminal, use the local frontend to repeat the whole journey:
   connect fan, approve the real Base USDC, tip, and inspect fan, creator, and
   fee-recipient deltas. Stop the fork afterwards.

   **GO:** all commands exit 0. The mandatory `--network base` flag was
   used; a fork reports chain ID 31337, so confirm it has code at
   `USDC_BASE` rather than treating 31337 as proof of Base. Tests must cover
   1% routing, six-decimal amounts, invalid tips, and the existing rounding
   rule.

## 1. Configure RPCs and secrets

1. Inspect instead of replacing project config.

   ```bash
   sed -n '1,240p' packages/foundry/foundry.toml
   sed -n '1,200p' packages/nextjs/scaffold.config.ts
   sed -n '1,160p' packages/foundry/.env.example
   git check-ignore -v packages/foundry/.env packages/nextjs/.env.local || true
   ```

2. Ensure `packages/foundry/foundry.toml` has endpoints matching the
   wrapper's network names (retain the project names if they differ):

   ```toml
   [rpc_endpoints]
   base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
   base = "${BASE_RPC_URL}"
   ```

   Copy the existing template, then edit only the ignored copy with a reliable
   RPC URL and deployer credential in the exact variable name used by the
   script (usually `DEPLOYER_PRIVATE_KEY`):

   ```bash
   cp packages/foundry/.env.example packages/foundry/.env
   ```

   Never commit that file or put a private key in shell history,
   `scaffold.config.ts`, `NEXT_PUBLIC_*`, Vercel, or a screenshot. Prefer a
   Foundry keystore if the existing script supports it. The template already
   supplies the key needed for `yarn verify`; acquiring an explorer key is
   not a launch dependency.

3. Change `packages/nextjs/scaffold.config.ts`. Preserve imports/types; make
   its effective production configuration equivalent to:

   ```ts
   targetNetworks: [chains.base],
   pollingInterval: 1_000,
   alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
   rpcOverrides: process.env.NEXT_PUBLIC_BASE_RPC_URL
     ? { [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL }
     : {},
   walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",
   burnerWalletMode: "disabled",
   ```

   Use an app-specific WalletConnect ID and a browser-safe RPC key restricted
   to the production domain. Every `NEXT_PUBLIC_*` value is visible to
   visitors; it cannot contain a secret.

4. Prove the endpoints and token before deploying:

   ```bash
   source packages/foundry/.env
   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   test "$(cast chain-id --rpc-url "$BASE_SEPOLIA_RPC_URL")" = "84532"
   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
   test "$(cast code "$USDC_BASE" --rpc-url "$BASE_RPC_URL")" != "0x"
   cast call "$USDC_BASE" 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
   cast call "$USDC_BASE" 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
   ```

   **GO:** outputs include `6` and `USDC`. Wrong chain ID, absent bytecode,
   wrong decimals, leaked secret, or unreviewed config is a hard stop.

## 2. Base Sepolia dress rehearsal

This is a real public testnet deploy: it catches RPC, deployer, verification,
wallet, and generated-artifact failures that a fork cannot.

1. Fund `DEPLOYER` with Base Sepolia ETH and `FAN` with test USDC/ETH.
   Confirm balances without revealing keys:

   ```bash
   yarn account
   cast balance "$DEPLOYER" --rpc-url "$BASE_SEPOLIA_RPC_URL"
   ```

2. Set the script's token input to the issuer's current official Base Sepolia
   test-USDC address and use test recipient/owner addresses. Do not use
   `USDC_BASE` for this deployment. Then:

   ```bash
   yarn deploy --network base_sepolia
   yarn verify --network base_sepolia
   git diff -- packages/nextjs/contracts/deployedContracts.ts
   ```

   Record deploy hashes, contract addresses, and verification URLs. Verification
   replays Foundry's `broadcast/.../run-latest.json`, so run it immediately
   from this same checkout and preserve `broadcast`.

   **GO:** verified source and inputs are correct on the explorer, and
   `deployedContracts.ts` has chain ID 84532 and the new address—not a
   localhost address.

3. Run `yarn start` and use normal wallets on Base Sepolia to connect,
   switch networks, approve, and send an exact 1.00 test-USDC tip. After
   confirmation and refresh, use explorer and balance reads to prove fan
   decreases 1,000,000, fee recipient gets 10,000, and creator gets 990,000
   (or the documented tested rounding result). Deliberately test wrong
   network, insufficient allowance, invalid/zero tip, and rejected wallet
   signature. Each must transfer nothing and produce a usable error.

   **GO:** both people complete the happy path and negative cases. Any failure
   requires source/UI correction, a regression test, a fresh tag, and restart
   at stage 0.

## 3. Deploy the Base mainnet contract

1. Put production inputs back into the script: `USDC_BASE`,
   `FEE_RECIPIENT`, and `OWNER`. Both people compare those values
   character-for-character. Fund the deployer with deployment ETH plus a small
   buffer, and fund `FAN` with $1–10 USDC plus Base ETH.

   ```bash
   source packages/foundry/.env
   export USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   test "$(cast chain-id --rpc-url "$BASE_RPC_URL")" = "8453"
   cast balance "$DEPLOYER" --rpc-url "$BASE_RPC_URL"
   cast call "$USDC_BASE" 'balanceOf(address)(uint256)' "$FAN" --rpc-url "$BASE_RPC_URL"
   git diff --check
   yarn test && yarn lint && yarn next:check-types && yarn next:build
   ```

   **GO:** correct addresses are independently confirmed, balances suffice, and
   checks are clean. Otherwise do not transact.

2. Deploy exactly once and verify in the same working tree:

   ```bash
   yarn deploy --network base
   yarn verify --network base
   ```

   Save the printed contract address as `TIP_CONTRACT`, transaction hash, and
   `broadcast` output. Commit the generated
   `packages/nextjs/contracts/deployedContracts.ts` to the release branch.

   **GO:** verification succeeds; the explorer source is verified; and the
   generated file's 8453 entry is `TIP_CONTRACT`. Verification failure is a
   stop, not a backlog item.

3. Make read-only onchain assertions. Get exact getter names from the ABI in
   `deployedContracts.ts`; common names are shown below:

   ```bash
   cast code "$TIP_CONTRACT" --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'usdc()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeRecipient()(address)' --rpc-url "$BASE_RPC_URL"
   cast call "$TIP_CONTRACT" 'feeBps()(uint256)' --rpc-url "$BASE_RPC_URL"
   ```

   Substitute only a differently spelled ABI getter; do not omit the
   assertion. Confirm non-empty code, USDC equals `USDC_BASE`, recipient
   equals `FEE_RECIPIENT`, owner/admin equals `OWNER`, and fee is 100 bps.

   **GO:** every immutable/configured value is correct. A bad live parameter
   demands an explicit abandon/communication/redeploy decision; a second
   deployment does not fix the first address.

## 4. Mandatory private mainnet acceptance

Keep the site private. Use the committed mainnet `deployedContracts.ts` and
write local browser-safe values:

```bash
cat > packages/nextjs/.env.local <<'EOF'
NEXT_PUBLIC_BASE_RPC_URL="https://YOUR_BROWSER_SAFE_BASE_RPC"
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="YOUR_OWN_PROJECT_ID"
EOF
yarn start
```

At `http://localhost:3000`, connect `FAN` on Base. Confirm the UI says
Base and links to `TIP_CONTRACT`, not localhost. Submit one real $1–10 USDC
tip to `CREATOR`; use exact approval if supported. Record approval and tip
hashes. Independently inspect pre/post USDC balances and the decoded BaseScan
transaction, refresh/reconnect, then repeat in another browser while testing
rejection and wrong-network behavior.

**GO:** every transaction has the expected chain, contract, token, recipient,
and exact 1% split; state remains correct after refresh; both people approve
the release. If it fails, halt. A frontend clamp is not a contract fix:
preserve evidence, add regression coverage, correct source, then redeploy (or
use the already-audited upgrade path) and repoint deliberately.

## 5. Publish the frontend

1. Commit reviewed non-secret config plus the generated deployment artifact and
   push the tagged release. In Vercel, set these **Production** variables
   before building:

   ```text
   NEXT_PUBLIC_BASE_RPC_URL=https://YOUR_BROWSER_SAFE_BASE_RPC
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_OWN_PROJECT_ID
   NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_BROWSER_SAFE_KEY_IF_USED
   ```

   Restrict keys to production origins and add production/preview domains to
   WalletConnect. Never set `DEPLOYER_PRIVATE_KEY` in Vercel.

2. Build a preview and test the built artifact:

   ```bash
   yarn vercel:login
   yarn vercel
   ```

   In the preview, inspect console/Network for RPC failures; connect on Base;
   check the contract address, USDC 6-decimal display, wrong-network state,
   and rejected-signature state.

   **GO:** preview is from the tagged commit, has no localhost/31337 address,
   uses Base successfully, and exposes no private key.

3. Deploy production and add the custom domain only after TLS is active:

   ```bash
   yarn vercel:yolo --prod
   ```

   In an incognito browser, load the final URL, connect `FAN`, and send one
   last small USDC tip. Verify it on BaseScan and check fee/creator deltas.

   **GO:** the public URL—not preview or localhost—works correctly. Only then
   announce it.

## 6. First 24 hours and rollback

For 24 hours, watch BaseScan, RPC/Vercel errors, and support; inspect the
first unrelated user tip for chain, token, contract, fee, and creator amount.
Set low-balance alerts on deployer and fee recipient.

The frontend can be rolled back by promoting the prior Vercel deployment or
removing domain routing. A contract cannot. For a contract defect: stop
promotion/marketing, preserve hashes and addresses, reproduce locally, add
the failing test, fix, redeploy or use the audited upgrade path, verify,
repoint, and communicate a plan for funds/users at the old address. Never
silently replace a public contract address.

References: [Base network details](https://docs.base.org/base-chain/quickstart/connecting-to-base), [Base RPC guidance](https://docs.base.org/base-chain/api-reference/rpc-overview), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses), and [Scaffold-ETH 2 commands](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).
