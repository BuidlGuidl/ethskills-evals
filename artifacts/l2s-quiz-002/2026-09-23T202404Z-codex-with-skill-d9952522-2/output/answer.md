# PayoutVault on Polygon zkEVM

## 1. What Ops should look at this week

This does not look like an RPC-provider or API-key problem. It looks like the expected external symptom of Polygon zkEVM Mainnet Beta being sunset.

Polygon's own zkEVM sunset page says the Polygon zkEVM Mainnet Beta sequencer was sunset on July 3, 2026. The network is no longer producing blocks, and Polygon/AggLayer withdrawals from zkEVM no longer process. A read-only RPC can still answer historical state, so a dashboard can continue to show the same balances and the same latest block forever, while newly submitted transactions never confirm.

Immediate checks:

1. Call `eth_blockNumber` and `eth_getBlockByNumber("latest", false)` against the RPC the dashboard uses.
2. Compare the returned block timestamp to July 3, 2026.
3. Check whether payout transaction hashes ever enter a canonical block. They should not, because there is no active sequencer accepting new blocks.
4. Stop rotating RPC providers. A different provider may expose the same frozen historical state, but it cannot make the chain produce blocks.
5. Disable new payout submissions on Polygon zkEVM in the app and mark the dashboard as showing final historical state, not live balances.

Useful official references:

- https://polygon.technology/polygon-zkevm
- https://support.polygon.technology/support/solutions/articles/82000927750-recovering-funds-from-polygon-zkevm-the-claims-interface
- https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice

## 2. What this means for merchant money

Treat the approximately $400,000 in PayoutVault as a fund-recovery incident, not a migration.

The critical distinction is where the assets were at the sunset snapshot:

- If assets were held directly by EOAs, the Polygon zkEVM Claims interface is the normal recovery path on Ethereum.
- If assets were held inside `PayoutVault`, a smart contract, the Claims interface does not provide a routine recovery path. Polygon's sunset material explicitly excludes assets held inside smart contracts, including protocol contracts and multisigs deployed on zkEVM.

So if the merchant balances are backed by tokens actually sitting in the PayoutVault contract on Polygon zkEVM, those funds are not currently spendable by us, not payable to merchants by sending another transaction, and not claimable through the standard EOA claims flow. The frozen chain state is still useful for proving who was owed what, but it is not a live payment rail.

Actions for the money:

1. Freeze the Polygon zkEVM payout path immediately.
2. Export and notarize the final PayoutVault state: token balances, merchant ledger balances, pending payout queue, contract addresses, deployment tx, and the final block used.
3. Reconcile the on-chain vault balances to the internal merchant ledger.
4. Contact Polygon support with the PayoutVault address, token addresses, balances, and proof that the contract is controlled/operated by us. Do not assume support can recover it, but start the process.
5. Decide internally how merchants are made whole if contract recovery is not available: treasury advance, insurance, reserve release, or a legal/commercial settlement process.
6. Communicate to merchants using owed balances from the final snapshot, not the stuck dashboard as if it were live.

## 3. Q3 build plan

Do not build batch payouts on Polygon zkEVM. The chain is off, and no product plan should depend on it producing another block.

Given today is September 23, 2026, there is only about a week left in Q3. The realistic Q3 outcome is: freeze and snapshot the old system, choose the new chain, deploy and test the new payout contracts, and run a limited pilot only if the implementation already exists or is very small. Full production migration should not be promised by September 30 unless the contract and audit work are already done.

Recommended target: move merchant payouts to an active, low-cost L2 suited to payments. I would shortlist Celo and Base:

- Celo is attractive for merchant payouts because it is now an Ethereum L2, has fast blocks, and supports paying gas in approved stablecoins such as USDC/USDT without running a paymaster or ERC-4337 stack.
- Base is attractive if merchant reach, exchange support, and fiat on/off-ramp coverage are more important than stablecoin gas payment.

Pick one target this week using actual current fee data for the payout token and route. Do not choose by old TVL rankings.

Batch payout design:

1. Deploy a new `PayoutVaultV2` on the chosen live chain.
2. Support `batchPay(address token, address[] recipients, uint256[] amounts, bytes32 batchId)` with a hard cap of 200 recipients.
3. Emit one event per recipient plus one batch summary event so accounting and merchant support can reconcile without scraping calldata.
4. Make `batchId` idempotent so a retried job cannot double-pay.
5. Use role-based controls: funding role, payout executor role, pause role, and emergency withdraw role.
6. Keep merchant balances in the off-chain ledger and only settle finalized payout batches on-chain. Do not recreate a large permanently locked merchant-balance vault unless there is a regulatory or custody reason to do so.
7. Add preflight checks before submission: vault token balance, array length, duplicate recipients, total amount, per-merchant limits, chain liveness, and gas estimate.
8. Add postflight checks: transaction inclusion, event reconciliation, merchant ledger update, and alerting if a batch remains unconfirmed past the chain-specific threshold.

Cost plan:

1. Batching gets the base transaction overhead shared across up to 200 merchants.
2. The remaining cost is mostly ERC-20 transfer execution and storage writes, so use one token per batch and avoid per-recipient on-chain metadata.
3. For very large batches, split by token and destination chain, not by merchant.
4. Benchmark 1, 10, 50, 100, and 200-recipient batches on the target chain before committing fee savings to merchants.
5. If merchants can tolerate a claim flow, evaluate a Merkle-distributor model for the next phase; it reduces operator batch settlement cost but shifts claim transactions to merchants and worsens UX.

Q3 delivery sequence:

1. By September 24: freeze Polygon zkEVM writes, snapshot PayoutVault, and publish an internal incident ledger.
2. By September 25: choose Celo or Base using live fee tests and merchant asset support.
3. By September 27: deploy `PayoutVaultV2` to testnet or fork tests, including idempotent batch execution and pause controls.
4. By September 29: deploy to the chosen mainnet with a small treasury-funded pilot batch.
5. By September 30: produce the merchant remediation plan for the old zkEVM funds and the production rollout checklist for the new payout rail.

Bottom line: the dashboard is stuck because Polygon zkEVM is sunset, not because Ops picked a bad RPC. The $400,000 in PayoutVault should be treated as potentially trapped smart-contract funds until proven otherwise. New merchant payouts need to move to a live L2, and the batch-payout build belongs on that new rail, not on Polygon zkEVM.
