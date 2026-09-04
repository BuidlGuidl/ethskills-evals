# Launch runbook: Base mainnet

This is the ordered path from the current local-fork implementation to a public Base mainnet product. Follow the gates in order. A failed gate means **stop**; fix the issue, add a regression test where applicable, and restart that phase. Do not deploy a frontend publicly until Phase 8.

The commands assume the normal Scaffold-ETH 2 Foundry layout:

```
packages/foundry
packages/nextjs
```

Run all commands from the repository root unless a command starts with `cd`. Text in `<ANGLE_BRACKETS>` is a value the team must replace; do not literally publish or commit it. Keep a launch log containing the git commit, deployer address, contract address, transaction hashes, and the two-person approvals at every gate.

## 0. Assign roles and create the launch record

Before changing configuration, choose and record:

| Role | Responsibility | Must not be |
| --- | --- | --- |
| Operator | Holds the temporary deployer and executes commands | The sole approver |
| Reviewer | Independently checks addresses, code, and transactions before each irreversible action | The operator |
| Treasury owner | Multisig/safe that receives platform fees and is authorized to withdraw/administer them | A browser hot wallet |

Create a protected release branch and tag the exact commit to be deployed. The reviewer should clone that commit independently.

```bash
git switch -c release/base-mainnet-<YYYY-MM-DD>
git status --short
git rev-parse HEAD
```

**Gate:** `git status --short` is empty (apart from intentional, untracked local secret files) and both people record the same commit hash. Never use an unreviewed last-minute UI or contract change in this runbook.

## 1. Freeze the mainnet specification

Write these values in the launch log and make the deployment script take them explicitly (constructor arguments or checked environment variables), rather than relying on an address copied by hand during deployment.

| Item | Required mainnet value / decision |
| --- | --- |
| Chain | Base mainnet, chain ID `8453` |
| USDC | Native Circle USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913` |
| USDC units | `6` decimals; one USDC is `1_000_000` base units |
| Fee | `100` basis points (1%); write down the exact rounding rule |
| Fee recipient | `<TREASURY_SAFE_ADDRESS>`, checksum-validated and independently read aloud by both people |
| Admin/owner | preferably `<TREASURY_SAFE_ADDRESS>`; otherwise document every privileged method and its post-launch transfer to the Safe |
| Upgradeability | explicitly record immutable or proxy. If proxy, record proxy admin, implementation admin, timelock/multisig, and upgrade procedure |
| Creator onboarding | document whether every address can receive tips, creator approval is required, and how mistakes are reversed |

For a typical contract constructor, make the deployment script reject incorrect input before `vm.startBroadcast()`:

```solidity
address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913;
uint16 constant PLATFORM_FEE_BPS = 100;

require(block.chainid == 8453, "Base mainnet only");
require(address(usdc) == BASE_USDC, "wrong USDC");
require(feeBps == PLATFORM_FEE_BPS, "wrong fee");
require(feeRecipient != address(0), "zero recipient");
```

Use the contract's actual parameter names and types; do not add this snippet blindly if the design differs. If `feeBps` is mutable, enforce an upper bound in the contract and emit an event on every change. If it should not change, make it immutable/no setter.

**Gate:** the reviewer checks the deployed constructor arguments that the script will use against this table, including the exact fee recipient. The contract handles `0`, 1-base-unit, and normal 6-decimal amounts intentionally; it neither silently loses funds to rounding nor lets a tip bypass the fee.

## 2. Security and operational review before any public deployment

The local happy path is necessary but insufficient. Add/confirm Foundry tests for all behavior the public interface permits, including direct contract calls:

- 1% calculation and the selected rounding policy at `1`, `99`, `100`, `101`, `1_000_000`, and a large USDC amount;
- tip accounting: `gross = creator amount + platform amount`, no trapped remainder, and `total` conservation;
- USDC is exactly the Base address above, not a caller-supplied token or a look-alike;
- zero address creator/recipient, zero amount, self-tip (chosen policy), duplicate withdrawal, and all unauthorized/admin paths revert;
- malicious/non-standard ERC-20 behavior relevant to the integration (failed transfer, failed `transferFrom`, and reentrancy if the contract transfers before state is settled);
- allowance workflow, event fields, fee withdrawal/creator withdrawal, pause/emergency behavior, and ownership transfer;
- invariants/fuzzing that balances/accounting cannot become insolvent or overflow and that no actor can withdraw another actor's funds.

Run the full checks from the pinned release commit:

```bash
yarn install --immutable
yarn compile
yarn test
yarn lint
yarn next:check-types
yarn next:build
cd packages/foundry && forge fmt --check && forge test -vvv
```

Run static analysis if available in the project, and inspect all compiler warnings. Review every privileged function and every external call line-by-line. For an immutable contract accepting real money, get an independent Solidity/security review before mainnet; if one is not feasible, explicitly document the accepted risk and a maximum initial exposure.

**Gate:** all commands exit `0`, no critical/high issue is open, and both people approve the exact source and ABI. A frontend validation is never considered a security control: users and bots can call the contract directly.

## 3. Rehearse the exact release on a Base fork

Use a Base RPC endpoint from a provider account. Put secrets only in ignored local files. Do not put an RPC URL with a key in `scaffold.config.ts`, `foundry.toml`, a commit, CI logs, or a Vercel variable prefixed `NEXT_PUBLIC_`.

Create/update ignored local files from the project examples:

```bash
cp packages/foundry/.env.example packages/foundry/.env
cp packages/nextjs/.env.example packages/nextjs/.env.local 2>/dev/null || true
```

In `packages/foundry/.env`, set only local secret values appropriate to this release, for example:

```dotenv
BASE_RPC_URL=https://base-mainnet.<RPC_PROVIDER>/<SECRET>
DEPLOYER_PRIVATE_KEY=0x<NEW_DEDICATED_DEPLOYER_PRIVATE_KEY>
ETHERSCAN_API_KEY=<YOUR_BASESCAN_API_KEY_OR_TEMPLATE_VALUE>
```

Use the key name that the existing Foundry deploy script actually reads. If it reads `PRIVATE_KEY` rather than `DEPLOYER_PRIVATE_KEY`, set `PRIVATE_KEY` and do not change its semantics. Inspect it first:

```bash
sed -n '1,260p' packages/foundry/script/Deploy*.s.sol
sed -n '1,240p' packages/foundry/foundry.toml
sed -n '1,220p' packages/nextjs/scaffold.config.ts
git check-ignore -v packages/foundry/.env packages/nextjs/.env.local
```

In `packages/foundry/foundry.toml`, add Base only if absent, with an environment expansion rather than a literal credential:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
```

Confirm that the actual `yarn deploy --network base` implementation maps `base` to that endpoint before proceeding. Then start the fork (the `--network` flag is required):

```bash
yarn fork --network base
```

In another terminal, prove this is Base even though the local fork reports chain ID `31337`:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913 --rpc-url http://127.0.0.1:8545
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913 'decimals()(uint8)' --rpc-url http://127.0.0.1:8545
```

The first command must return non-empty code and the second exactly `6`. Impersonate/fund only on the fork as needed to execute the whole journey. Deploy using the project script against the fork, then run the frontend locally configured for the fork:

```bash
yarn deploy
yarn start
```

Perform the full product flow: connect a fresh wallet, approve the exact USDC amount, tip a creator, inspect transaction logs/balances, withdraw or collect fees using only the intended role, retry/reject malformed actions, and refresh/reconnect the browser. Save screenshots and transaction hashes.

**Gate:** the code and decimals prove Base USDC was used; balances and events exactly match the fee/accounting specification; the generated `packages/nextjs/contracts/deployedContracts.ts` contains the fork deployment and correct ABI; all browser errors are understandable. If any check fails, fix source/tests and repeat Phases 2–3.

## 4. Do a Base Sepolia dress rehearsal

This phase exercises remote RPC, wallets, verification, explorer propagation, and frontend configuration without risking mainnet funds. Configure a **separate** `baseSepolia` endpoint in `foundry.toml` and a matching chain in `packages/nextjs/scaffold.config.ts`; use the network names already defined by the project if they differ.

For the frontend configuration, ensure `targetNetworks` includes Base Sepolia for this rehearsal and Base for production. Keep keys server-side/env-driven:

```ts
import { base, baseSepolia } from "viem/chains";

// targetNetworks: [baseSepolia] during rehearsal; [base] for production
// rpcOverrides: { [base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL } only if
// your frontend genuinely requires a public client RPC URL. Restrict that key.
```

Do not copy the mainnet USDC address into a testnet constructor. Obtain the official Base Sepolia USDC address from Circle/Base documentation at launch time, record the source and address in the log, and make the script assert that testnet value. Fund a throwaway Sepolia deployer from the official faucet, then:

```bash
yarn deploy --network baseSepolia
yarn verify --network baseSepolia
yarn start
```

Connect a wallet switched to Base Sepolia, use test USDC from the token's official faucet/source, and repeat every user and admin flow. Independently open the verified explorer pages for the deployment transaction and contract, check constructor values and event decoding, and ensure the frontend generated deployment is under the expected chain ID.

**Gate:** the dress rehearsal succeeds end-to-end, verification succeeds, and the reviewer finds no mismatch among source commit, bytecode/metadata, constructor arguments, UI chain, token, decimal display, and events. A failure here blocks mainnet.

## 5. Prepare mainnet keys, money, and configuration

1. Create a dedicated deployer wallet on an offline/hardware-backed process. It is not the treasury Safe and is never used as a customer wallet.
2. Configure the deploy script to give every long-term privilege to `<TREASURY_SAFE_ADDRESS>` at deployment time. If the script cannot, prewrite and rehearse the ownership/role transfer calls and do them immediately after deployment.
3. Fund the deployer with a deliberately limited Base ETH amount sufficient for deployment, verification-related transactions if any, and the private acceptance test. Do not send USDC to it unless the acceptance test needs it. Record balance and funder transaction hash.
4. Re-open `packages/foundry/.env`, `foundry.toml`, the deployment script, `packages/nextjs/scaffold.config.ts`, and `.gitignore`. Run:

```bash
git status --short
git diff --check
git ls-files packages/foundry/.env packages/nextjs/.env.local
rg -n --hidden --glob '!node_modules/**' '(0x[a-fA-F0-9]{64}|BASE_RPC_URL|PRIVATE_KEY|API_KEY)' .
```

The first command must not show secrets; the third must print nothing. Review any `rg` result: public RPC URLs and explicitly public IDs can be intentional, but secret keys must not be present.

5. Change the committed frontend config from the rehearsal target to Base production:

```ts
import { base } from "viem/chains";

// packages/nextjs/scaffold.config.ts
targetNetworks: [base],
```

If the project uses `chains` rather than `targetNetworks`, make the equivalent change. Set the L2 polling interval to a sensible short value (for example 3–5 seconds) only after confirming provider rate limits. Make the UI reject the wrong chain before enabling approve/tip, display `USDC` and a fixed 6-decimal conversion (not ETH's 18 decimals), and show the exact network and contract address in an advanced/details view.

**Gate:** both people perform a final address ceremony: compare the USDC address, Safe address, fee (`100` bps), expected contract name, chain (`8453`), deployer address, and release commit in the terminal and launch log. The deployer has enough Base ETH but no unnecessary assets. No secrets are tracked or exposed in build-time public variables.

## 6. Deploy to Base mainnet — contracts only

Do this with the frontend still private/local. From the same checkout and release commit that will be verified:

```bash
yarn compile
cd packages/foundry && forge test -vvv
cd ../..
yarn deploy --network base
```

Do not re-run a deploy command just because output is slow or a terminal disconnects. First inspect the deployer's Base nonce, balance, and the provider/explorer transaction history; an accidental second deployment creates a competing production address.

Record from command output and `packages/foundry/broadcast/`:

- deployer address and transaction hash;
- deployed contract address(es) and, if applicable, proxy and implementation separately;
- exact constructor arguments, block number, gas used, and release commit;
- the regenerated `packages/nextjs/contracts/deployedContracts.ts` diff, confirming the address is under chain ID `8453`.

Immediately verify from the same checkout (verification replays the just-created Foundry broadcast artifact):

```bash
yarn verify --network base
```

If verification reports a transient explorer/indexing error, wait for the deployment to be indexed and retry **only `yarn verify --network base`**, never the deployment. If it reports a compilation/constructor mismatch, stop; investigate against the saved broadcast data before any UI is pointed at the contract.

**Gate:** deployment succeeded once, source is verified on BaseScan, and the reviewer independently checks on BaseScan that contract address, creator/deployer, bytecode/verified source, constructor arguments, USDC, fee recipient, and fee are exactly the recorded values. If ownership/roles need transfer, complete it now, verify the receipts/events, and prove the deployer no longer holds permanent privilege.

## 7. Mandatory private mainnet acceptance test

Do not make a public deployment yet. Point the local frontend at the newly generated Base deployment and run it locally:

```bash
yarn next:build
yarn start
```

Use a real browser wallet on Base mainnet and two team-controlled accounts: a fan account with $1–10 worth of USDC and a distinct creator account. The fan must have enough Base ETH for approval and tip gas. Before sending anything, confirm in the wallet that the connected chain is Base, token is native USDC at `0x8335…2913`, spender is the deployed contract, and the amount is 6-decimal USDC.

Execute and record:

1. Fan approves the chosen USDC amount (prefer exact amount rather than unlimited approval).
2. Fan tips the creator.
3. Refresh and reconnect both wallets; verify all displayed values against BaseScan/token balances and contract event logs.
4. Verify gross amount, creator amount, platform amount, and rounding match the written formula exactly.
5. Execute the intended creator withdrawal/claim and treasury fee collection, if these are part of the design; verify each recipient's actual USDC balance change.
6. Try safe negative cases in the UI (wrong network, zero/too-small amount, insufficient allowance) and confirm they fail before or with a clear on-chain error, without moved funds.

If a test fails after a mainnet deployment, do **not** declare a frontend-only clamp a fix. Pause public launch, reproduce on the fork, correct the contract if the defect is on-chain, add a regression test, deploy a new version (or use the documented proxy upgrade process), verify it, then repeat this phase. Decide and document how any money/state in the old address is handled.

**Gate:** every transaction is final and reconciles on-chain; both people sign the acceptance record; the deployer has no unintended privilege; and the only production address the frontend will use is the one just tested.

## 8. Publish the frontend

Commit only the intended non-secret production configuration and generated Base deployment file. Review before pushing:

```bash
git diff -- packages/nextjs/scaffold.config.ts packages/nextjs/contracts/deployedContracts.ts
yarn lint
yarn next:check-types
yarn next:build
```

Set the hosting provider's production environment variables. Required names depend on the existing app; inspect them first:

```bash
rg -n --glob '!node_modules/**' 'process\.env\.|NEXT_PUBLIC_' packages/nextjs
```

Set only values actually read by the app. A client RPC URL may be `NEXT_PUBLIC_*` because browser code needs it, but use a restricted, domain-allowlisted, rate-limited key. Never expose private keys, admin keys, a BaseScan secret, or a server-only API key as `NEXT_PUBLIC_*`.

For Vercel using the Scaffold command, authenticate and deploy from the reviewed commit:

```bash
yarn vercel:login
yarn vercel:yolo --prod
```

If using another provider, deploy `packages/nextjs` with the same Node/Yarn versions locked in the repository, production environment variables above, build command `yarn next:build`, and the resulting Next.js application. Attach the custom domain only after the provider URL passes the checks below; enable HTTPS and redirect the alternate host to the canonical domain.

**Gate before announcing:** load the provider production URL in a clean browser profile (no localhost state), inspect the build/deployment commit, and confirm it is the reviewed release. Verify the app offers Base, reads chain ID `8453`, shows the verified production address, and has no testnet/local contract address or developer-only controls. Confirm CSP/headers, 404/500 behavior, analytics/error reporting, and no browser console error that hides transaction failure.

## 9. Public-URL smoke test and announcement

Before sharing the domain, use the real public URL in a clean browser and execute one small real tip from the fan to the creator. This is a new transaction, not a reused Phase 7 result. Verify its receipt, UI state after refresh, and creator/fee accounting against BaseScan. Then test a wrong-network wallet and the mobile layout if mobile users are in scope.

**Go/no-go:** only announce after this public-URL transaction works. If it does not, remove public calls-to-action or take the host offline while diagnosing; do not leave users pointed at an unproven payment flow.

Publish a short transparency/support page containing the Base chain, verified contract address/link, canonical USDC address, fee (1%), supported wallet/network, confirmation that tips are on-chain and irreversible, and a support/contact path. Do not publish admin or deployer details beyond what is necessarily public on-chain.

## 10. First-week operations and incident response

For the first 24 hours, the operator and reviewer independently watch the verified contract address, BaseScan transactions/events, RPC error rate, frontend error monitoring, and treasury/creator accounting. Reconcile at least daily:

```
sum(tips gross) = sum(creator liabilities/paid) + sum(platform liabilities/paid) + permitted rounding remainder
```

Alert on unknown admin/role events, changed fee recipient/fee, failed user transactions above a threshold, unexpected token transfers, a UI chain/address mismatch, and RPC failures. Keep a small, documented support reserve only if business policy requires it; do not leave deployer keys funded indefinitely. Once ownership is safely in the Safe, move residual ETH out of the deployer and securely retire its key according to the team's key-management policy.

If a user-impacting defect is found: stop promotion, clearly warn users, and use a contract pause only if the already-reviewed contract has that capability and its consequences are understood. Preserve transaction hashes and state; reproduce on a Base fork; fix source; add a regression test; run Phases 2–7 for the new version; verify; repoint the UI only after private acceptance. For immutable contracts, communicate the old and replacement addresses and the migration/state treatment explicitly.

## Launch log template

Copy this into the team's private launch record and complete it before announcing:

```
Release commit / tag:
Operator / reviewer:
Treasury Safe:
Base USDC (must be 0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913):
Fee and rounding policy:
Deployer address / funding tx:
Base deployment tx / block:
Contract address (proxy / implementation if applicable):
BaseScan verification link:
Ownership/role-transfer txs and final privileges:
Private mainnet acceptance txs (approve, tip, claim/withdraw, fee collection):
Public URL / host deployment commit:
Public URL smoke-tip tx:
Monitoring owner and support contact:
Operator approval / timestamp:
Reviewer approval / timestamp:
```
