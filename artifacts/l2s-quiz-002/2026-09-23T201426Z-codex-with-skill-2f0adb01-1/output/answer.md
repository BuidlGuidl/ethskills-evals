# Polygon zkEVM payout status

As of today, September 23, 2026, I would stop treating this as an RPC/provider incident. Polygon zkEVM Mainnet Beta has been sunset. Polygon says that as of July 3, 2026 the sequencer is no longer producing blocks, and withdrawals can no longer be processed through the Agglayer Bridge. Alchemy also ended Polygon zkEVM mainnet support on July 1, 2026 because the network was shut down.

That explains the exact symptoms Ops is seeing:

- The dashboard block number does not move because Polygon zkEVM is no longer producing new blocks.
- Merchant balances read back the same every day because contract state is frozen at the last produced block.
- Submitted payouts never confirm because there is no live sequencer to include them.
- Swapping RPC providers and API keys will not fix this. A working provider can at most read historical chain state.

## What to look at now

1. Confirm the dashboard is connected to chain ID 1101 and compare its displayed block number against multiple read-only Polygon zkEVM endpoints and the explorer. If they all return the same height, that is expected post-sunset behavior.

2. Stop submitting new payout transactions on Polygon zkEVM immediately. They should be marked failed/unsendable in our payout system, not pending.

3. Identify where the $400,000 actually sat at sunset:
   - If funds were held by an EOA wallet, they may be recoverable on Ethereum through Polygon's zkEVM Claims interface, available through December 31, 2027.
   - If funds were held inside `PayoutVault`, a smart contract, this is the dangerous case. Polygon's current guidance says assets held in smart contracts, including DeFi protocols, multisigs, bridges, and similar contract custody, cannot be recovered through the Claims interface.

4. Reconcile our internal merchant ledger against the final zkEVM state:
   - final `PayoutVault` token balances
   - per-merchant balances in the vault
   - payout transactions confirmed before sunset
   - payout attempts submitted after sunset
   - any deposits accepted after we should have frozen the system

5. Escalate to Polygon support/Polygon DeFi contacts with the vault address, token addresses, deployment date, current balances, and proof that the contract holds merchant funds. This is not a normal withdrawal path anymore, so we should treat it as a recovery/legal/vendor escalation, not an engineering retry loop.

## What this means for merchant money

The merchant balances are not moving because the chain is no longer live. If the $400,000 is really inside `PayoutVault` on Polygon zkEVM, then the funds are not currently usable for merchant payouts.

The key distinction is custody form at sunset. EOA-held funds have a published claim process. Smart-contract-held funds do not. If `PayoutVault` held the funds at sunset, we should assume the money is stuck unless Polygon or another recovery process gives us a specific path. Internally, the merchant balances remain our liability even if the onchain funds are impaired. Product, finance, legal, and support should prepare merchant comms and decide whether treasury fronts the balances while recovery is pursued.

## Q3 build plan

Do not build batch payouts on Polygon zkEVM. The Q3 plan should pivot to recovery plus redeployment on a live settlement chain.

Recommended target: Polygon PoS if the priority is stablecoin merchant payouts inside the Polygon ecosystem. It is where Polygon is focusing payments, stablecoins, and real-world transaction volume. Base is also a good low-cost alternative if we want Coinbase distribution and a broader L2 consumer ecosystem. Pick one primary chain first; avoid a multi-chain relaunch until payouts are stable again.

Plan:

1. Week 1: incident containment and chain decision
   - Freeze zkEVM deposits and payout submissions.
   - Publish an internal incident ledger with final zkEVM balances.
   - Choose the replacement chain, token standard, bridge/on-ramp path, and explorer/RPC providers.
   - Decide whether treasury will pre-fund merchant balances on the new chain while recovery is unresolved.

2. Weeks 1-2: design `PayoutVaultV2`
   - `batchPayout(token, recipients, amounts, batchId)` with a hard cap of 200 recipients.
   - Role-gated payout executor, pause switch, reentrancy protection, SafeERC20 transfers, duplicate `batchId` protection, and full event emission for reconciliation.
   - Atomic batches by default: if one transfer is invalid, the whole batch reverts. Pre-validate offchain to avoid partial accounting.
   - Keep merchant accounting offchain unless there is a hard regulatory/product need to store balances onchain. Onchain storage per merchant will raise cost and operational risk.

3. Weeks 2-4: cost reduction
   - Net invoices before payout so each merchant receives at most one transfer per batch window.
   - Use one native stablecoin on the target chain, not multiple wrapped variants.
   - Avoid onchain merchant registries and per-merchant storage writes in the hot path.
   - Use compact calldata arrays, custom errors, immutable config where appropriate, and no unnecessary enumerable data structures.
   - Benchmark 1, 10, 50, 100, and 200-recipient batches on a fork/testnet before mainnet deployment.

4. Weeks 4-6: security and launch
   - Unit tests, invariant tests, fork tests with the real token contract, and signer/key-management tests.
   - External review or focused audit of the batch payout path.
   - Deploy with a small limit, run parallel reconciliation, then raise limits.

5. End of quarter: cutover
   - New payouts only on the replacement chain.
   - Dashboard reads from the new vault and labels zkEVM balances as frozen/recovery.
   - Merchant support gets exact status per merchant: paid on new chain, pending treasury-funded payout, or affected by zkEVM recovery.

For even lower per-payout cost later, evaluate a Merkle distributor model: one transaction posts a payout root and merchants claim individually, with optional gas sponsorship. That is cheaper for us when recipients can tolerate claiming, but it is a different UX than "one transaction sends money to 200 merchants," so I would not make it the first relaunch path.

Sources:

- Polygon zkEVM sunset page: https://www.polygon.technology/polygon-zkevm
- Polygon June 2025 sunset announcement: https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020
- Polygon April 2026 claim/reminder announcement: https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856
- Alchemy deprecation notice: https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice
