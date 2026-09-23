# Polygon zkEVM payout status

The first thing to look at is not the RPC vendor. Polygon zkEVM Mainnet Beta has been sunset. Polygon says the sequencer stopped on July 3, 2026, the network is no longer producing blocks, and the Agglayer Bridge no longer processes withdrawals from zkEVM. Alchemy also ended Polygon zkEVM support on July 1, 2026. That matches the symptoms: `eth_blockNumber` does not advance, balance reads return the same historical state, and submitted payout transactions never get sequenced.

Refs:
- https://www.polygon.technology/polygon-zkevm
- https://support.polygon.technology/support/solutions/articles/82000927750-recovering-funds-from-polygon-zkevm-the-claims-interface
- https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice

## What Ops should check this week

1. Confirm the dashboard's displayed block number against `eth_blockNumber` from every configured zkEVM endpoint. If it is stuck around the final chain height, treat the endpoint as historical/read-only.
2. Pull the payout tx hashes from the submitter logs. Expect either provider rejection or hashes that never appear in canonical blocks, because there is no live sequencer to include them.
3. Stop retrying payouts on Polygon zkEVM. Retrying only burns operational time and may create misleading internal states.
4. Snapshot the final onchain state for `PayoutVault`: token balances held by the vault address, per-merchant balances, pending payout records, admin roles, pause state, and any escape/recovery methods.
5. Reconcile that snapshot to the internal merchant ledger and mark the zkEVM-backed balance as frozen until a real recovery path is confirmed.
6. Pause new deposits and payout creation on Polygon zkEVM in product, API, cron jobs, and treasury runbooks.
7. Contact Polygon support with the vault address and token list, but do not assume the standard claims UI will solve this.

## What this means for merchant money

The money is not missing because an RPC provider failed. It is stuck because the chain that hosts `PayoutVault` is no longer live.

Polygon's claims interface is for assets that were held in self-custodied EOAs at sunset. Polygon explicitly says assets held inside smart contracts, including protocol contracts and multisigs, cannot be recovered through that interface. Since merchant balances are in `PayoutVault`, a smart contract, the standard claim path likely does not recover the roughly $400,000.

So the correct internal posture is:

- Do not represent these funds as normally liquid.
- Treat the zkEVM vault balance as frozen/possibly impaired until counsel, Polygon support, and engineering confirm otherwise.
- Keep the merchant ledger intact: each merchant's claim against us still exists even if the backing funds are stranded.
- Decide whether to make merchants whole from treasury/liquidity reserves while recovery is pursued.
- Communicate in plain terms: balances are recorded, normal zkEVM payouts are unavailable, and new payouts will move to a supported network.

## Q3 build plan

Do not build batch payouts on Polygon zkEVM. The Q3 plan should be a migration plus a new payout rail.

This week:
- Pick the replacement network based on stablecoin liquidity, exchange/off-ramp support, fees, provider support, and operational maturity. Polygon PoS, Base, Arbitrum, and Optimism are plausible candidates; choose using actual merchant corridor and stablecoin requirements.
- Freeze zkEVM payout code paths and deploy fresh treasury liquidity to the new rail.
- Write a one-page migration/risk memo for finance: amount frozen, merchant exposure, replacement liquidity, and recovery owner.

By end of Q3:
- Deploy `PayoutVaultV2` on the selected live chain.
- Add `batchPay(token, recipients, amounts, batchId)` with a hard cap of 200 recipients, idempotency by batch id/hash, role-based execution, pause support, reentrancy protection, and clear batch/per-recipient events.
- Make batches atomic unless product explicitly accepts partial settlement. Atomic settlement keeps accounting simpler: either the whole batch pays or nothing does.
- Add preflight checks in the payout service: token allowance/balance, recipient validation, duplicate merchant detection, gas estimate, chain id check, nonce management, and dry-run simulation.
- Build reconciliation from emitted events, not dashboard reads alone.
- Benchmark gas on a fork/testnet before launch. If 200 ERC-20 transfers is too close to block gas limits or too expensive, set the production cap lower and split automatically.
- For larger future savings, evaluate a Merkle-claim or relayed-claim model. A push batch still performs one token transfer per merchant; it saves overhead and operations work, but it does not make 200 transfers free.

Launch criteria:
- Successful fork test and testnet batch of 200 recipients.
- Runbook for failed/reverted batches and stuck nonces.
- Monitoring for block freshness, sequencer/RPC health, confirmation latency, and balance drift.
- Merchant-facing chain migration notice and new deposit addresses disabled/enabled in the right order.

Bottom line: the dashboard is stuck because Polygon zkEVM is retired. New merchant payouts need to move off zkEVM immediately. The existing $400,000 in `PayoutVault` should be treated as frozen smart-contract-held funds, not as available payout liquidity, until a specific recovery path is proven.
