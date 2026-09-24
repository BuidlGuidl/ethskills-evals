# Polygon zkEVM PayoutVault Assessment

As of September 23, 2026, this looks like a chain-lifecycle incident, not an RPC or API-key incident.

Polygon zkEVM Mainnet Beta has been sunset. Polygon says the sequencer was sunset on July 3, 2026, the network is no longer producing blocks, and withdrawals from Polygon zkEVM can no longer be processed through the AggLayer Bridge. Alchemy also ended Polygon zkEVM support on July 1, 2026 because the network was shut down.

Sources:
- https://polygon.technology/polygon-zkevm
- https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020
- https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856
- https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice

## 1. What Ops Should Look At

Stop treating this as a provider rotation issue. If every provider returns the same block and submitted payouts never confirm, that matches a read-only, non-producing chain.

Immediate checks:

1. Confirm the current Polygon zkEVM block height from at least two public/read-only sources and compare it to the dashboard's displayed block. Expect it to be frozen.
2. Check whether the RPC endpoints still answer `eth_call` and `eth_getLogs` but never advance `eth_blockNumber` and never mine submitted transactions. That is consistent with post-sunset read-only behavior.
3. Pull every payout transaction hash submitted since the dashboard froze. Classify them as not executed unless they appear in finalized zkEVM history before the final block.
4. Freeze new deposits and payout submissions on Polygon zkEVM immediately. Do not let the product mark payouts as pending-confirmation forever, and do not debit merchant balances for transactions that were never included.
5. Snapshot `PayoutVault` at the final zkEVM state: token balances held by the vault, merchant balance accounting, pending payout intents, admin roles, pause state, and all bridge/withdrawal events before sunset.
6. Check whether any funds were held directly in an EOA rather than in `PayoutVault`. EOA-held assets are the category Polygon says can use the zkEVM Claims interface on Ethereum.
7. If the $400,000 is actually held by the `PayoutVault` smart contract, escalate immediately to Polygon support / Polygon DeFi contacts and counsel. Polygon's public claim page says assets held inside smart contracts on Polygon zkEVM at sunset cannot be recovered through the standard Claims interface.

What this means operationally: new payout transactions sent to Polygon zkEVM are not going to confirm. The dashboard is stale because the chain is stale. The most important thing now is to preserve evidence, stop creating new failed payout state, and determine whether any recovery path exists for the exact vault-held assets.

## 2. Q3 Build Plan

Do not build batch payouts on Polygon zkEVM. The chain is no longer a viable production rail.

The Q3 plan should become: migrate the payout product to a live chain, ship batch payout contracts there, and handle zkEVM balances as a recovery and customer-liability incident in parallel.

Recommended destination: Polygon PoS / Polygon Chain for this use case. It is where Polygon is focusing payments and stablecoin settlement, and Polygon has published recent payment-oriented upgrades: 1.5s blocks, higher block gas limits, low predictable fees, and large payment throughput. Base is a reasonable backup if your merchant ecosystem is more Coinbase/Ethereum-app centered, but for "merchant payouts currently on Polygon" I would default to Polygon PoS unless compliance, treasury, or merchant wallet support points elsewhere.

Contract plan:

1. Deploy a new `BatchPayoutVault` on the destination chain.
2. Support `batchPayout(token, recipients, amounts, batchId)` with a hard cap of 200 recipients.
3. Use `SafeERC20`, `Pausable`, `ReentrancyGuard`, role-based access control, and custom errors.
4. Make batches idempotent with a consumed `batchId` mapping so retries cannot double-pay.
5. Emit one batch event plus per-recipient payout events so finance, support, and merchants can reconcile without relying on dashboard-only state.
6. Prefer one token per batch, especially for USDC/USDT-style stablecoin payouts. Mixed-token batches are more complex and usually not worth the operational risk.
7. Define failure semantics clearly. I would make the first version atomic: if any transfer fails, the whole batch reverts. Add a separate retry path for corrected batches.
8. Avoid per-merchant storage writes during payout unless onchain merchant balances must be authoritative. If the treasury system is the source of truth, use signed/offchain payout manifests plus onchain batch execution events.
9. Add a Merkle-claim fallback for unusual cases where pushing to 200 recipients is undesirable, but do not make that the main merchant UX if merchants expect you to pay them.

Cost plan:

1. Batching reduces per-payout overhead by amortizing the transaction base cost, access-control checks, token lookup, nonce/idempotency write, and event indexing over up to 200 recipients.
2. The dominant remaining cost is the ERC-20 transfer itself. Keep batches single-token and avoid extra vault accounting writes in the hot loop.
3. Use calldata arrays, custom errors, immutable token allowlist pointers where useful, and unchecked loop increments after bounds checks.
4. Run gas snapshots for 1, 10, 50, 100, and 200 recipients before launch. Set the production max below the point where transaction inclusion becomes unreliable under normal fee conditions.
5. Add a batch builder that groups payouts by token, destination chain, and urgency, then submits at predictable fee windows.

Delivery plan for the rest of Q3:

1. This week: freeze zkEVM writes, complete final-state reconciliation, notify internal support/finance, choose destination chain, and decide whether treasury will pre-fund merchant payouts while recovery is pursued.
2. Week 1: implement `BatchPayoutVault`, batch builder, idempotency model, dashboard chain switch, and operational runbooks.
3. Week 2: unit tests, fork tests on the destination chain, fuzz tests for batch limits/idempotency/reverts, gas snapshots, and external review of the payout contract.
4. Week 3: deploy with a small funded limit, run pilot payouts for internal/test merchants, monitor confirmations and reconciliation, then gradually raise limits.
5. By quarter end: stop all Polygon zkEVM product paths, publish the new payout rail to merchants, and keep a separate incident ledger for any unrecovered zkEVM balances.

## Meaning For Merchant Money

The merchant money should be treated as frozen and potentially impaired until proven otherwise.

If assets were held directly in your company's EOA on Polygon zkEVM at sunset, they should be claimable on Ethereum through Polygon's zkEVM Claims interface until December 31, 2027.

If assets were held by `PayoutVault`, the situation is much worse. Polygon's public guidance says smart-contract-held assets are not recoverable through the standard Claims interface. Because the sequencer is stopped, you cannot simply call the vault now to withdraw, batch pay, or bridge out. You need a recovery escalation with Polygon and legal/accounting review, but you should not promise merchants that those contract-held funds are immediately accessible.

For merchant communications and finance, separate two facts:

1. Onchain execution: Polygon zkEVM payouts submitted after shutdown did not settle.
2. Customer liability: if your ledger says merchants are owed balances, the company still needs a plan to make them whole, even if the old vault funds are stuck.

Practical recommendation: fund the new payout vault on the replacement chain from treasury, insurance, or a credit facility and resume merchant payouts there, while pursuing any zkEVM contract-fund recovery as a separate recovery asset. That is the cleanest way to protect merchants without waiting on an uncertain post-sunset smart-contract recovery path.
