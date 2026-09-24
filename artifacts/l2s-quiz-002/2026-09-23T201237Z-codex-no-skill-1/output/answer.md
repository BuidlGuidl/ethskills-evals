# Polygon zkEVM payout status

As of September 23, 2026, this looks like a chain-sunset incident, not an RPC-provider incident.

Polygon says the Polygon zkEVM Mainnet Beta sequencer was sunset on July 3, 2026, the network is no longer producing blocks, and withdrawals can no longer be processed through the AggLayer Bridge. Alchemy also ended Polygon zkEVM support on July 1, 2026 because the network was shut down. That matches every symptom Ops is seeing: the dashboard keeps reading the same balances, the displayed block number does not move, and submitted payouts never confirm because there is no sequencer producing blocks to include them.

What to look at immediately:

1. Confirm the dashboard is pointed at Polygon zkEVM mainnet, not Polygon PoS / Polygon Chain. Check `chainId` and the network name in config.
2. Call `eth_blockNumber` and `eth_getBlockByNumber("latest")` against every configured RPC. If the latest block and timestamp are frozen across providers, the app is seeing the final zkEVM state.
3. Stop the payout submitter and retry workers for zkEVM. Retrying will not make transactions confirm and may create confusing internal pending state.
4. Reconcile three numbers: merchant ledger balances, PayoutVault token balances at the last zkEVM block, and submitted-but-unconfirmed payout intents.
5. Inspect PayoutVault for any recovery path that does not require a new zkEVM transaction. If the only way to move funds is by calling the vault on zkEVM, that path is blocked.
6. Contact Polygon support with the PayoutVault address, token addresses, balances, and deployment history, but treat this as an escalation for exceptional help rather than a normal bridge/withdrawal process.

## What this means for merchant money

The merchant entitlements still exist in our ledger, but the on-chain funds in PayoutVault are not operational liquidity right now.

This distinction matters: Polygon's claim flow is for assets held by self-custodied EOAs at sunset. Polygon's own sunset page says assets held inside smart contracts on Polygon zkEVM cannot be recovered through the Claims interface. PayoutVault is a smart contract, so the roughly $400,000 should be treated as impaired or inaccessible unless Polygon provides a specific protocol recovery route or the vault already has an off-chain/L1 escape mechanism.

Operationally, we should freeze zkEVM payouts, stop showing those funds as available settlement liquidity, notify finance/legal, and decide whether merchants are made whole from company treasury while recovery is pursued. The merchant balances should not be silently zeroed or rewritten; they are claims against us even if the zkEVM funds are stuck.

## Q3 build plan

Do not build batch payouts on Polygon zkEVM. That network is no longer a viable execution environment.

Also, as of September 23, 2026, Q3 has only one week left, so the honest Q3 goal is not "ship a fully audited new payout rail from scratch." The Q3 goal should be: contain the incident, choose the replacement rail, design and start implementation, and only pilot if we can do it without skipping controls.

Plan:

1. This week: freeze zkEVM, reconcile balances, document merchant exposure, open the Polygon support escalation, and pick a replacement chain based on stablecoin liquidity, exchange/off-ramp support, gas cost, finality, RPC quality, and deprecation risk. Candidate rails should include Polygon PoS / Polygon Chain and at least one other mature L2 such as Base, Arbitrum, or Optimism.
2. Contract design: deploy `PayoutVaultV2` on the new chain, not an upgrade of the stranded zkEVM vault. Use OpenZeppelin `SafeERC20`, `AccessControl`, `Pausable`, `ReentrancyGuard`, idempotent `batchId`s, per-recipient payout events, and an emergency pause/sweep policy that is legally and operationally pre-approved.
3. Batch payout interface: support `batchPay(token, recipients, amounts, batchId)` with up to 200 recipients when gas measurements prove it fits. Make the batch atomic by default so accounting is simple: either every transfer succeeds or the batch reverts. If some merchant tokens are nonstandard, isolate them into smaller batches.
4. Cost reduction: batching amortizes the base transaction cost and signer/relayer overhead across up to 200 merchants. Further reduce cost with compact calldata, custom errors, no per-recipient strings, immutable token allowlists where possible, and batch sizing based on measured gas. Do not promise a 200-recipient max until mainnet-fork gas tests pass for the actual token.
5. Indexing and ops: rebuild the dashboard around events from `PayoutVaultV2`, not repeated balance reads alone. Add stale-block alerts, provider quorum checks, chain-status monitoring, finality thresholds per chain, and alerts for protocol deprecation notices.
6. Testing and rollout: run unit tests, fuzz tests for array length / duplicate recipient / zero amount / failing token behavior, mainnet-fork gas benchmarks, and a small merchant pilot. Ramp batch sizes from 10 to 50 to 100 to 200 only after successful production runs.

The uncomfortable summary: the Q3 payout-cost work is now secondary to a custody incident. First protect merchants and recover or replace the stranded liquidity; then launch batch payouts on a live, supported chain.

Sources:

- Polygon zkEVM sunset page: https://polygon.technology/polygon-zkevm
- Polygon forum final reminder: https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856
- Alchemy Polygon zkEVM deprecation notice: https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice
