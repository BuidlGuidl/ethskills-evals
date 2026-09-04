# Base Mainnet Launch Runbook — creator tips

Run every command from the application repository root. This is three hard boundaries: fork rehearsal; Base deployment with a private UI; public frontend. Stop at every failed gate. A frontend change cannot fix a live contract because users can call it directly.

## 0. Release sheet and responsibilities

Assign one operator (executes commands) and one reviewer (reads every result and wallet prompt). In a restricted release ticket, fill these once:

    RELEASE_SHA=                 exact reviewed commit, never a branch
    OPERATOR_ADDRESS=            new dedicated deployment EOA
    PLATFORM_FEE_RECIPIENT=      team-controlled multisig
    APP_DOMAIN=                  e.g. tips.example.com
    SUPPORT_CONTACT=             public support email/handle
    BASE_RPC_URL=                authenticated Base-mainnet HTTPS RPC
    WALLETCONNECT_PROJECT_ID=    restricted to APP_DOMAIN

Use these fixed Base mainnet values:

    CHAIN_ID=8453
    EXPLORER=https://basescan.org
    NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    USDC_DECIMALS=6
    FEE_BPS=100
    BPS_DENOMINATOR=10000

This is Circle native USDC on Base, not bridged USDbC and not a creator-supplied token. Independently confirm the address, symbol USDC, six decimals, and issuer before proceeding.

Before commands below which contain shell variables, export the fixed address and the release-sheet RPC URL in the terminal that will run them:

    export NATIVE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    export BASE_RPC_URL='<the exact BASE_RPC_URL from the restricted release sheet>'

**Gate:** both people approve the SHA, Base USDC address, fee recipient, domain, and support contact. A wrong constructor/initializer value requires a new deployment.

## 1. Freeze, test, and review the exact release

    git fetch --tags origin
    git checkout "$RELEASE_SHA"
    git status --short
    git rev-parse HEAD
    yarn install --immutable
    yarn compile
    yarn test
    yarn lint
    yarn next:build

git status --short must be empty and git rev-parse HEAD must equal RELEASE_SHA. If root yarn test is not defined, use the Foundry test script listed by yarn run (normally yarn workspace @se-2/foundry test). Do not alter the SHA after this point without restarting this phase.

The reviewer must inspect source, tests, and the deploy script and establish all of the following:

- Deployment passes only NATIVE_USDC, never a localhost address, a bridged token, or user input.
- Fee calculation is exactly fee = amount * 100 / 10_000 in integer, six-decimal USDC units. That rounds down; document that a one-unit tip has zero fee.
- The creator gets amount - fee, the platform multisig gets fee, and all ERC-20 transfers use SafeERC20.
- Zero amount/creator, failed transfer, wrong token, insufficient balance/allowance, unauthorized withdrawal, double withdrawal, reentrancy, and all privileged functions are tested.
- The UI uses parseUnits(input, 6) and formatUnits(value, 6), shows fee and net before signing, and has no local-network fallback.
- The contract is recorded as non-upgradeable, or proxy, implementation, admin, initializer and upgrade governance are explicitly reviewed.

Add/retain a successful real-USDC fork test for 1 USDC: creator delta is 990000 and fee-recipient delta is 10000 base units. If this exact code has not received independent security review, stop for one before it holds user funds.

**Gate:** all commands pass and both reviewers approve. Tag the SHA:

    git tag -a "launch-base-$(git rev-parse --short HEAD)" -m "Base mainnet launch"
    git push origin "launch-base-$(git rev-parse --short HEAD)"

## 2. Make production configuration explicit

Make and review these committed changes before tagging.

1. In packages/foundry/script/Deploy*.s.sol, read USDC_ADDRESS and PLATFORM_FEE_RECIPIENT using vm.envAddress; pass them to the constructor/one-time initializer. When block.chainid == 8453, require the USDC value equals 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. Remove localhost/default production values.
2. In packages/nextjs/scaffold.config.ts, set the network and client-safe RPC override exactly as follows (preserve the existing imports and use chains.base):

    targetNetworks: [chains.base],
    rpcOverrides: {
      [chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
    },
    burnerWalletMode: "disabled",

3. Keep alchemyApiKey and walletConnectProjectId environment-backed. Add visible wrong-network, rejected/pending/confirmed transaction states, explorer links, and a disabled submit button while approval/tip is pending.
4. Never edit packages/nextjs/contracts/deployedContracts.ts manually. yarn deploy --network base generates its Base (8453) entry.

Create ignored secret files; values beginning NEXT_PUBLIC_ are browser-visible and must be client-safe:

    cp packages/foundry/.env.example packages/foundry/.env
    test -f packages/nextjs/.env.example && cp packages/nextjs/.env.example packages/nextjs/.env.local
    git check-ignore -v packages/foundry/.env packages/nextjs/.env.local

Use the account variables already supplied by this checkout. Current Scaffold-ETH 2 Foundry uses an encrypted keystore, typically:

    ETH_KEYSTORE_ACCOUNT=base-launch-deployer
    ETH_KEYSTORE_PASSWORD=<unique password in password manager>
    ETHERSCAN_API_KEY=<Basescan/Etherscan V2 key>
    USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    PLATFORM_FEE_RECIPIENT=<PLATFORM_FEE_RECIPIENT>

If this project instead has PRIVATE_KEY or DEPLOYER_PRIVATE_KEY, use its existing name. Keep the dedicated deployer key only in the ignored file/secret store—never terminal history, chat, Git, or frontend hosting. Create/import and inspect the dedicated account with the project’s scripts:

    yarn generate
    yarn account

Set these locally and in the host’s Production environment:

    NEXT_PUBLIC_BASE_RPC_URL=<BASE_RPC_URL>
    NEXT_PUBLIC_ALCHEMY_API_KEY=<client-safe provider key, if used>
    NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WALLETCONNECT_PROJECT_ID>
    NEXT_PUBLIC_SUPPORT_CONTACT=<SUPPORT_CONTACT>

Restrict the RPC and WalletConnect projects to APP_DOMAIN. Never put credentials with write access in NEXT_PUBLIC_ values, scaffold.config.ts, or foundry.toml.

**Gate:** secret files are ignored, the app selects only Base 8453, and the script visibly records the intended USDC, multisig and 100 bps before broadcast.

## 3. Rehearse the exact release on a Base fork

Use current Base state and keep the production frontend private. The flag is required: yarn fork base is not equivalent.

Terminal A:

    yarn fork --network base

Terminal B:

    cast chain-id --rpc-url http://127.0.0.1:8545
    cast code "$NATIVE_USDC" --rpc-url http://127.0.0.1:8545
    yarn deploy
    yarn test
    yarn start

The fork should return chain ID 31337; that does not prove which chain it forked. The USDC code check must be non-empty. Record fork block number and local deployment address.

With a fork-funded Base-USDC account, complete the browser journey: connect; choose creator; enter 1 USDC; approve; tip; wait; open the receipt; check balances. Also reject a wallet request, enter more than six decimals, exceed balance/allowance, and switch to a wrong chain.

**Gate:** for a 1,000,000-unit USDC tip, creator delta is exactly 990,000 and platform delta exactly 10,000; all negative cases fail safely and clearly; nothing in the production build points to localhost or 31337. Failure returns to Phase 1.

## 4. Fund and protect accounts

Use a dedicated deployer EOA and a separate team multisig for fee destination and every privileged role. Fund the deployer with only enough Base ETH for deployment, verification retries, and private smoke testing—no USDC and no ongoing admin duties.

Before funding, independently compare chain 8453 and OPERATOR_ADDRESS in the wallet. Send a small ETH test transfer, wait for it to appear on Basescan, then fund the required amount. Enable balance and transaction alerts.

**Gate:** funding is visible on Base, address/balance match the release ticket, and no seed phrase/private key left the password manager or hardware wallet.

## 5. Deploy and verify on Base; UI stays private

Close Anvil/fork terminals. From the tagged checkout:

    git status --short
    yarn compile
    yarn deploy --network base
    yarn verify --network base

Before approving the deployment transaction, compare the printed constructor/initializer values to the release ticket: chain 8453, native USDC, fee multisig, and 100 bps. Reject any mismatch. Record deploy transaction hash, block, deployed address, deployer, and proxy/implementation if applicable.

Run verification immediately from the same checkout: it uses the deployment broadcast artifact. If the explorer has not indexed the transaction, wait and rerun only yarn verify --network base. A source/constructor mismatch is a stop condition, not a task to postpone.

**Gate:** the contract (and implementation, if any) is verified on Basescan; on-chain parameters match the release ticket; and generated packages/nextjs/contracts/deployedContracts.ts has the new Base 8453 address and correct ABI. Commit generated deployment output but never secrets:

    git add packages/nextjs/contracts/deployedContracts.ts packages/foundry/broadcast
    git commit -m "chore: record Base mainnet deployment"
    git push origin HEAD

If broadcast/ is intentionally ignored, commit only deployedContracts.ts and store broadcast JSON in the restricted release archive.

## 6. Private real-money acceptance test

Build the deployment commit locally, with the Base production environment values, and do not publish a preview URL:

    yarn next:build
    yarn start

Using a non-privileged wallet with $1–10 Base USDC and Base ETH, submit a 1 USDC tip. Inspect the approval spender in the wallet: it must be the verified tip contract, never an EOA. Prefer exact approval unless unlimited approval is a separately reviewed product decision.

Replace these values and independently inspect post-transaction state:

    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$CREATOR" --rpc-url "$BASE_RPC_URL"
    cast call "$NATIVE_USDC" "balanceOf(address)(uint256)" "$FEE_RECIPIENT" --rpc-url "$BASE_RPC_URL"
    cast receipt "$TIP_TX" --rpc-url "$BASE_RPC_URL"

Compare deltas, not absolute balances: a 1 USDC tip must increase creator balance by 990000 and platform balance by 10000 units. Test a rejected prompt and a balance/allowance failure with a separate wallet.

**Gate:** UI, receipt, events, and token-balance deltas agree; approval targets the contract; errors recover cleanly; and both people approve the result. Contract failure means a new deploy/address and repeat Phases 5–6.

## 7. Publish the frontend

Configure the production host with the Phase 2 environment values only for Production. Attach the custom domain, enforce HTTPS, restrict provider origins to it, and publish support, terms, and privacy pages. Deploy the exact deployment commit. For the default Scaffold-ETH 2 Vercel setup:

    yarn vercel:yolo --prod

Use the approved equivalent only if this repository uses another host. In a fresh browser profile, confirm: canonical HTTPS domain; no console/mixed-content errors; Base requested by wallet; correct verified Basescan address; six-decimal USDC display; and no localhost/31337 references. Then make one small real tip through the public URL and verify its split as in Phase 6.

**Gate:** public URL serves the intended commit, only targets Base, and the public-URL smoke tip is correct. Only then announce it.

## 8. First 24 hours and incident rules

For 24 hours, monitor uptime, client errors, RPC rate limits, reverted tips, contract events, platform-fee balance, and support. Alert both team members on failed health checks, unusual reverts, or unexpected privileged calls.

For a frontend-only incident, disable submissions or take down the site, fix on a new commit, repeat the public smoke test, then deploy. For a suspected accounting/security incident, take the UI down immediately; use an on-chain pause only if it was reviewed and is multisig-controlled; preserve transaction hashes/logs; and notify affected users.

Immutable-contract remediation is always: reproduce on a Base fork; fix source; add regression test; review; deploy and verify a new contract; migrate only through reviewed on-chain mechanisms; update address; repeat private and public real-money tests; and clearly communicate old/new addresses. Never describe a UI-only guard as a contract fix.

Keep a restricted launch record: SHA/tag, approvals, accounts, deployment and verification hashes, Basescan links, addresses, broadcast JSON, two smoke-test hashes and balance deltas, public URL, host deployment commit, and incident/support contacts.
