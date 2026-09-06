# Launch runbook — Creator Tips on Base mainnet

This is the release order.  Do not make the public frontend reachable until
step 6.  A green local fork is necessary, but it does not prove that the
configured deployer, native Base USDC, contract addresses, or a real wallet
will work on mainnet.

**Roles (write the actual addresses here before doing anything irreversible):**

| Purpose | Address | Control |
| --- | --- | --- |
| `DEPLOYER` | `0x...` | New, dedicated deployment key; never a developer's everyday wallet |
| `TREASURY` | `0x...` | A 2-of-2 Safe controlled by both team members; receives the 1% fee |
| `CREATOR_SMOKE` | `0x...` | Team-controlled wallet that will receive the launch smoke tip |
| `FAN_SMOKE` | `0x...` | Separate team-controlled wallet that will send it |

Base mainnet is chain ID `8453` (`0x2105`).  The only USDC this app may accept
is Circle native Base USDC:
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, with **6 decimals**.  Do not
substitute the old bridged USDbC address.  Circle publishes this address
[here](https://developers.circle.com/stablecoins/usdc-contract-addresses), and
Base publishes its network settings [here](https://docs.base.org/base-chain/quickstart/connecting-to-base).
For the Sepolia rehearsal only, use Circle's valueless Base Sepolia test USDC
at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; it is intentionally a
different address from the production token.

`<repo>` below means the actual Scaffold-ETH 2 checkout.  Run commands from
its repository root unless the command explicitly changes directory.  Do not
put a seed phrase or private key in a shell history, committed file, Vercel
environment variable, or chat.  Use a password manager/secret manager to
create and retain the deployment key, and a hardware wallet/Safe for treasury
control.

## 1. Freeze an auditable release candidate

1. From the currently passing local-fork commit, create a release branch and
   record its immutable commit ID:

   ```bash
   cd <repo>
   git switch -c release/base-mainnet
   git status --short
   git rev-parse HEAD
   yarn install --immutable
   yarn compile
   yarn foundry:test
   yarn lint
   yarn next:build
   ```

   If this version does not define `foundry:test`, use its existing Foundry
   test script (`yarn test` is common); confirm the command with
   `yarn run | rg 'test|foundry'` rather than inventing a new one.  Save the
   commit ID, compiler version, and passing command output in the release
   notes.

2. Do a two-person line-by-line review of every contract the deployment script
   will deploy and of all constructor/initializer arguments.  The reviewer who
   did not write the code must independently confirm:

   - token is the exact native-USDC address above and amounts use 6-decimal
     units (`1 USDC == 1_000_000`), not `parseEther`/18 decimals;
   - fee is exactly `100` basis points out of `10_000`, cannot round to more
     than one cent on small tips unless that is intentionally documented, and
     `tipAmount == creatorAmount + feeAmount` for every representable amount;
   - a zero creator, zero amount, self-tip (if undesired), invalid token, and
     unauthorized fee withdrawal/parameter change all revert;
   - all USDC transfers check their return value via `SafeERC20`, state changes
     happen before external transfers, and reentrancy is prevented where an
     external call is made;
   - the treasury/fee recipient is `TREASURY`, and any owner/admin/upgrade role
     is either the Safe or deliberately absent.  There must be no hidden EOA
     that can redirect fees or drain tips;
   - the product behavior is unambiguous: tips either go directly to creators
     or are held by the contract.  If held, withdrawal, accounting, emergency
     paths, and insolvency behavior are tested; if direct, verify the contract
     cannot retain user tips accidentally.

3. Add tests for every finding from that review, including boundary amounts
   (1, 9, 10, 99, 100, 101 micro-USDC), fee conservation, roles, pause/upgrade
   behavior if present, and failing USDC transfers.  Make the complete journey
   pass on a Base fork, not a mock token:

   ```bash
   yarn fork --network base
   # In another terminal, with the fork still running:
   yarn foundry:test
   yarn deploy
   yarn start
   ```

   Confirm the fork really is Base: its RPC chain ID will still be `31337`, so
   inspect code at the native-USDC address rather than trusting chain ID:

   ```bash
   cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://127.0.0.1:8545
   ```

**Gate 1 — stop unless:** the working tree is clean except intended release
files; compile, all tests, lint, and production build pass; the independent
review has no unresolved critical/high issue; and the local Base-fork journey
shows an exact 1% fee with the displayed amounts matching on-chain amounts.
Do not “patch it in the UI”: a contract bug requires a source fix, regression
test, new deployment, and a new pass through this runbook.

## 2. Make the application mainnet-configurable without exposing secrets

1. Check what this checkout calls its network and env variables:

   ```bash
   rg -n 'base|sepolia|rpc_endpoints|targetNetworks|NEXT_PUBLIC|USDC|fee' \
     packages/foundry/foundry.toml packages/foundry/.env.example \
     packages/nextjs/scaffold.config.ts packages/nextjs 2>/dev/null
   ```

2. In `packages/foundry/foundry.toml`, ensure the Foundry endpoint names used
   by `yarn deploy --network base` and `yarn verify --network base` exist.  Add
   this if they do not (keep any existing entries):

   ```toml
   [rpc_endpoints]
   base = "${BASE_RPC_URL}"
   base_sepolia = "${BASE_SEPOLIA_RPC_URL}"
   ```

   Put the actual URLs only in the untracked `packages/foundry/.env`:

   ```dotenv
   BASE_RPC_URL=https://<your-authenticated-Base-mainnet-RPC>
   BASE_SEPOLIA_RPC_URL=https://<your-authenticated-Base-Sepolia-RPC>
   DEPLOYER_PRIVATE_KEY=0x<new-dedicated-deployer-private-key>
   ETHERSCAN_API_KEY=<your-Basescan/Etherscan-key>
   BASE_MAINNET_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
   ```

   Use an authenticated production RPC provider, not Base's public endpoint;
   Base marks the public endpoint rate-limited and unsuitable for production.
   Verify the variable name for the key in this template's deployment script
   with `rg -n 'PRIVATE_KEY|envUint|envString' packages/foundry/script` and
   rename the `.env` variable to match if necessary.  Never edit a committed
   config to paste RPC/API keys; `git check-ignore -v packages/foundry/.env`
   must report that it is ignored.

3. In `packages/nextjs/scaffold.config.ts`, make Base the only production
   target network and use L2 polling.  In a standard SE-2 config the relevant
   portion is:

   ```ts
   import { base } from "viem/chains";

   const scaffoldConfig = {
     targetNetworks: [base],
     pollingInterval: 4_000,
     // existing rpcOverrides may use process.env.NEXT_PUBLIC_BASE_RPC_URL
   };
   ```

   Do not place a secret provider URL in this committed file.  If the frontend
   needs an RPC override, use a deliberately public, restricted client key in
   `packages/nextjs/.env.local` / the host's environment as
   `NEXT_PUBLIC_BASE_RPC_URL`; apply origin, rate, and spending limits at the
   provider.  The deployed contract address and ABI are generated after
   deployment, not manually copied from a local deployment.

4. Make the deployment script select the token by `block.chainid` and reject
   every unknown chain *before broadcast*: `8453` must select
   `BASE_MAINNET_USDC`, and `84532` must select `BASE_SEPOLIA_USDC`.  Add
   script assertions that the selected address and `TREASURY` match the
   reviewed values.  The production contract must be constructed with the
   literal native-mainnet address, never an arbitrary caller-supplied token.
   Log deployed address, selected USDC, treasury, fee bps, deployer, chain ID,
   git commit, and deployment transaction hash.

5. Validate credentials and network before spending anything:

   ```bash
   set -a; source packages/foundry/.env; set +a
   cast chain-id --rpc-url "$BASE_RPC_URL"
   cast balance "$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")" --rpc-url "$BASE_RPC_URL"
   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'decimals()(uint8)' --rpc-url "$BASE_RPC_URL"
   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 'symbol()(string)' --rpc-url "$BASE_RPC_URL"
   ```

**Gate 2 — stop unless:** chain ID prints `8453`; the address derived from the
key is exactly `DEPLOYER`; it has enough Base ETH for deployment plus several
retries but no unneeded funds; calls return `6` and `USDC`; the configuration
contains no localhost/31337/local-contract address; and `TREASURY` has been
confirmed by both people.  Fund the deployer with a small, pre-agreed ETH
amount only after this gate.  Fund `FAN_SMOKE` with a small amount of ETH and
native Base USDC (for example $5–10); keep `CREATOR_SMOKE` distinct.

## 3. Rehearse on public Base Sepolia

This makes the first wallet/RPC/explorer deployment public but keeps it
valueless.  Do not skip it merely because the local fork was green.

1. Change only the network flag, not the release code or deploy arguments.
   The chain-aware deployment script from step 2 must select
   `BASE_SEPOLIA_USDC`:

   ```bash
   yarn deploy --network base_sepolia
   yarn verify --network base_sepolia
   git status --short
   ```

   Read `packages/foundry/broadcast/*/base_sepolia/run-latest.json` (or the
   matching broadcast path printed by the command) and record the deployed
   address and transaction hash.  `yarn verify` must be executed from this
   same checkout because it replays that broadcast file.

2. Start the frontend locally, with the generated contract artifact left by
   that deployment present:

   ```bash
   yarn start
   ```

   In a browser using a separate Base Sepolia fan wallet, connect, select Base
   Sepolia, using Circle's Base Sepolia test USDC (obtain it through Circle's
   current test-token faucet), approve exactly the displayed test-USDC amount, tip
   `CREATOR_SMOKE`, and inspect the transaction and emitted event in the
   explorer.  Check: contract received/sent the expected amount; creator gets
   99%; `TREASURY` gets 1%; allowance is not infinite unless that was a
   deliberate, prominently disclosed product decision; rejected/insufficient
   allowance has a readable error; and refresh/reconnect displays the same
   chain and contract.

**Gate 3 — stop unless:** deployment transaction succeeded on chain, source
is verified, the browser used the just-deployed address, and the Sepolia
journey passed using two real browser wallets.  A verification error, wrong
address, stale `deployedContracts.ts`, a chain-switch failure, or a mismatch
between UI and event/accounting is a release blocker; fix it, add a regression
test if relevant, and restart at step 1.

## 4. Deploy Base mainnet contracts — frontend remains private

1. Reconfirm the exact mainnet deployment inputs aloud between both people:

   ```text
   chain:     Base mainnet (8453)
   USDC:      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   fee:       100 / 10,000 (1%)
   treasury:  TREASURY address written at the top of this file
   deployer:  DEPLOYER address written at the top of this file
   commit:    recorded release commit
   ```

2. From that exact checkout, with no frontend public deployment running:

   ```bash
   git status --short
   yarn compile
   yarn foundry:test
   yarn deploy --network base
   yarn verify --network base
   ```

   Do not re-run `yarn deploy` to solve a frontend generation issue: it may
   deploy a second contract.  Preserve the first `run-latest.json`, tx hash,
   deployed address, and generated `packages/nextjs/contracts/deployedContracts.ts`.
   If contract verification is pending, wait and rerun only `yarn verify --network base`.

3. Independently inspect the mainnet deployment on Basescan/Blockscout and
   call its read methods using the production RPC.  Substitute the address
   printed by deployment for `$TIPPING_CONTRACT`:

   ```bash
   export TIPPING_CONTRACT=0x<printed-mainnet-contract-address>
   cast code "$TIPPING_CONTRACT" --rpc-url "$BASE_RPC_URL"
   cast receipt 0x<deployment-transaction-hash> --rpc-url "$BASE_RPC_URL"
   ```

   Use the contract's actual getter signatures (find them first with
   `rg -n 'function (usdc|treasury|fee|owner|paused)' packages/foundry/contracts`)
   to read back USDC, treasury, fee, owner/admin, and paused state.  Do not
   guess a write function or call it just to test it on mainnet.

**Gate 4 — stop unless:** bytecode exists; deployment receipt has `status: 1`;
source is verified; on-chain USDC/treasury/fee/roles exactly equal the reviewed
inputs; generated frontend data contains this *8453* address and no localhost
fallback; and no public URL is pointing to it yet.  A wrong immutable argument
means abandon that address (unless the contract's verified design has a safe
remedy), correct source/script, and begin again at step 1.  Never send user
funds to a known-bad deployment.

## 5. Mainnet smoke test from localhost

1. With `yarn start` running locally from the same checkout, open only
   `http://localhost:3000`.  Disable/avoid the SE-2 burner wallet: use the
   funded `FAN_SMOKE` browser wallet on Base mainnet and the separate
   `CREATOR_SMOKE` address.

2. Complete the exact customer path with $1–10 of native Base USDC:

   1. Connect wallet; reject any wrong-chain state and switch to Base.
   2. Enter/select `CREATOR_SMOKE`; ensure the UI refuses an invalid and zero
      address before enabling the transaction.
   3. Enter a tip amount that exercises the app's rounding rule (record the
      integer micro-USDC amount displayed in wallet confirmation).
   4. Approve only that amount, then send the tip.  Confirm both transactions
      in Basescan and wait for a successful receipt, not merely wallet
      submission.
   5. Compare balances and/or contract events: fan decrease equals tip amount;
      creator credit/receipt equals 99%; treasury receives/accrues exactly 1%;
      no residual amount is unaccounted for.  The actual expected numbers must
      match the documented rounding rule.
   6. Refresh, disconnect/reconnect, and repeat with a second small amount;
      test a cancellation and an insufficient-USDC/allowance error without
      broadcasting a failing transaction if simulation catches it.

3. If funds are stored in the contract, perform its intended creator and
   treasury withdrawal paths with the smoke wallets and confirm neither can
   withdraw another party's balance.  If tips transfer directly, verify the
   contract's USDC balance cannot accumulate unexpectedly.

**Gate 5 — stop unless:** every mainnet smoke transaction succeeded, its
explorer data agrees with the UI and 1% accounting, the generated frontend uses
the verified address, and both people sign off on the public behavior.  This
is the last inexpensive point to stop: if it fails, the frontend stays private
while you fix and redeploy/repoint as required.

## 6. Publish the frontend only after the mainnet smoke passes

1. Remove developer-only UI before building: local faucet, burner-wallet
   promotion, debug pages, deployment/admin pages, test creator addresses,
   arbitrary token input, and any link that can make a user approve a token
   other than native Base USDC.  Ensure production errors do not expose RPC
   secrets.  Review all public environment variables with:

   ```bash
   rg -n 'NEXT_PUBLIC_|localhost|31337|anvil|hardhat|burner|faucet|private.?key|API_KEY' packages/nextjs
   yarn next:build
   ```

2. In the chosen hosting provider's **production** environment (not committed
   `.env`), set only the frontend variables your build needs, e.g.:

   ```dotenv
   NEXT_PUBLIC_BASE_RPC_URL=https://<restricted-public-client-RPC>
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<public-WalletConnect-project-id>
   ```

   Set provider restrictions to the final HTTPS domain(s), not `*`.  Do not
   set `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY`, treasury credentials, or a
   server-side privileged key in the frontend host.  Add the final custom
   domain, force HTTPS, and configure its canonical `https://` URL before
   launch.

3. Deploy a preview first and test it with a wallet in an incognito/new browser
   profile.  Confirm the built asset still reads chain 8453 and the exact
   `$TIPPING_CONTRACT` address (not merely whatever a local dev server had):

   ```bash
   yarn vercel:login
   yarn vercel
   ```

   If this repository uses another host, use its preview command instead; the
   required check is the same.  Do not create a fresh contract deployment.

4. When preview passes, deploy that same git commit to production:

   ```bash
   yarn vercel:yolo --prod
   ```

   Record the production URL, deployment ID, commit ID, contract address, and
   deployment/verification transaction hashes in the release notes.  Set the
   custom domain to this production deployment only after its hostname works.

**Gate 6 — stop unless:** the preview and production builds are the reviewed
commit; HTTPS/canonical domain work; wallet connection offers Base; all calls
point to the verified mainnet contract; and no secret appears in page source,
client bundle, repository, or host logs.  If the target address is stale,
rebuild/redeploy the frontend only—never redeploy the contract merely to
regenerate a file.

## 7. Production proof and operating handoff

1. Immediately after production becomes reachable, use the public custom URL
   in a clean browser profile and put one final $1–10 real-USDC tip through it
   using a fresh/low-balance team fan wallet.  Verify the receipt, event,
   creator result, fee result, wrong-network behavior, and post-refresh state.
   This is a real launch requirement, not a monitoring substitute.

2. Publish a small trust page or footer containing: Base mainnet, the verified
   contract address (linked to the explorer), the native-USDC contract address,
   the 1% fee and rounding policy, the treasury/fee-recipient policy, a clear
   support contact, and the instruction that users should never approve a
   different token or an unexpected amount.  Do not claim an audit unless one
   actually occurred.

3. Before announcing, assign ownership:

   | Owner | Daily/weekly responsibility |
   | --- | --- |
   | Team member A | Watch production URL, RPC error rate, wallet/transaction failures, and new `Tip` events/receipts. |
   | Team member B | Reconcile events against creator and treasury accounting; monitor the Safe and support channel. |
   | Both | Require two-person approval for admin/Safe actions, upgrades, pauses, fee changes, or a replacement deployment. |

   Keep an event/reconciliation record from the deployment block onward.  Alert
   on reverted customer transactions, a missing/mismatched fee, unexpected
   contract USDC balance, unknown admin calls, verification loss, or sustained
   RPC failures.  Test the alert path with the launch smoke transaction.

4. Incident rule: if a funds/security/accounting defect is found, stop public
   promotion, use only the contract's pre-reviewed emergency control (if it
   has one), preserve transaction hashes and balances, communicate clearly to
   affected users, then reproduce locally, add a regression test, fix source,
   redeploy or perform the verified upgrade, run this document again from step
   1, and only then repoint the frontend.  A frontend validation change does
   not protect against direct calls to the live contract.

**Launch complete only when:** the public-URL transaction in step 7 succeeds
and both team members have the release record, operational access, and the
ability to respond to an incident without sharing private keys.
