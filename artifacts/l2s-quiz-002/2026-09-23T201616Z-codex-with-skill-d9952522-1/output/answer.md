# PayoutVault / Polygon zkEVM note

As of September 23, 2026, this does not look like an RPC vendor or API-key issue. Polygon zkEVM Mainnet Beta was sunset on July 3, 2026: the sequencer stopped producing blocks, the network is no longer active, and AggLayer withdrawals from Polygon zkEVM no longer process.

Sources:
- Polygon zkEVM sunset page: https://www.polygon.technology/polygon-zkevm
- Polygon support recovery article: https://support.polygon.technology/support/solutions/articles/82000927750-recovering-funds-from-polygon-zkevm-the-claims-interface

## 1. What Ops should look at

Look at the chain, not the RPC provider.

The symptoms match a sunset chain exactly:

- Dashboard balances read the same every day because read-only RPCs can still answer against the final frozen zkEVM state.
- The displayed block number does not move because there are no new Polygon zkEVM blocks.
- Submitted payout transactions never confirm because there is no sequencer to include them.
- Switching RPC providers will not fix it; each provider is just exposing the same dead/final chain state.

Immediate checks:

1. Compare `eth_blockNumber` from every configured zkEVM RPC. It should be stuck at the same final range, not advancing.
2. Check any recent payout tx hash with `eth_getTransactionReceipt`; expect no receipt if it was submitted after the sequencer stopped.
3. Check whether any withdrawals were initiated before July 3, 2026. If a withdrawal message was already emitted before sunset, there may still be an L1-side completion path. If no withdrawal was initiated, do not assume one can be created now.
4. Snapshot PayoutVault state from the final zkEVM block and reconcile it against the internal merchant ledger.
5. Stop accepting deposits, payout requests, or operational retries on Polygon zkEVM immediately.

The important contract question: where were the assets at sunset? Polygon's claim interface covers assets held by EOAs at the snapshot. Polygon explicitly says assets held inside smart contracts on Polygon zkEVM at sunset cannot be recovered through the claims interface.

If PayoutVault itself held the roughly $400,000, this is not a normal migration. Treat it as a fund-recovery/accounting incident.

## 2. Q3 build plan for batch payouts and lower cost

Do not build the Q3 batch-payout feature on Polygon zkEVM. New work needs to move to a live chain.

Given this is merchant payout infrastructure, pick the next chain by the binding constraint:

- If merchant UX and stablecoin payments matter most, Celo is attractive because gas can be paid in approved stablecoins such as USDC/USDT, so merchants do not need to manage a separate gas token.
- If exchange/off-ramp support and consumer reach matter most, Base is a reasonable target, but note that Base is no longer part of the OP Stack/Superchain assumptions; treat it as its own stack.
- If avoiding multi-day L1 exits is a hard requirement, evaluate live ZK rollups such as Scroll, Linea, or zkSync Era, and verify current fees and bridge routes before committing.

Recommended quarter path:

1. Freeze zkEVM operations and redeploy `PayoutVaultV2` on the selected live chain.
2. Implement push-style batch payouts: one authorized transaction pays up to 200 merchants from vault-held stablecoin balances.
3. Keep the contract simple: `batchId`, token, recipients, amounts, total, and an executed-batch guard. Emit one event per recipient plus one batch summary event.
4. Decide failure semantics up front. For merchant payouts I would make each batch atomic: if any transfer fails, the whole batch reverts and Ops fixes the batch off-chain.
5. Add operational controls: pause, role-based batch submitter, daily/batch limits, emergency token rescue for non-ledger funds, and explicit chain-id/domain separation for signed approvals.
6. Reduce cost after correctness: benchmark a 200-recipient batch on the candidate chains, then consider packed calldata once the basic array version is tested. The big win is moving 200 payouts into one transaction and choosing a low-cost live chain; packing is the second-order optimization.
7. Migrate ledger balances by issuing new balances or direct payouts on the new chain from treasury/recovered funds, not by trying to move the old zkEVM contract in place.

Because today is already September 23, 2026, the realistic Q3 outcome is incident containment, chain decision, contract implementation, testnet/mainnet dry run, and the first limited production batches. Full merchant migration and cost tuning will likely continue into Q4 unless the replacement funding and audit path are already lined up.

## What this means for merchant money

The merchant balances are still your liability to merchants. But if the $400,000 was inside PayoutVault, a smart contract on Polygon zkEVM, it is not claimable through Polygon's normal recovery interface and it cannot be paid out by submitting new zkEVM transactions.

Practical implications:

- Merchant balances should be frozen as of the final zkEVM state plus any off-chain ledger adjustments you can prove.
- Do not tell merchants funds are merely delayed by RPC issues.
- If any funds were in EOAs at the sunset snapshot, claim them through the official Polygon zkEVM Claims interface before December 31, 2027.
- If funds were inside PayoutVault, assume no routine on-chain exit exists. Escalate to legal/accounting, Polygon support, and incident response, but plan to make merchants whole from treasury or other recoverable assets.
- The new batch-payout system should be funded on a live chain and should not depend on recovering the zkEVM vault first.
