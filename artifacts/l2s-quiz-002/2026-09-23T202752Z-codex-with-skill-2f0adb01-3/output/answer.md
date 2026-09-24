# Polygon zkEVM payout status

This is almost certainly not an RPC-provider or API-key problem. Polygon zkEVM Mainnet Beta has been sunset. Polygon's current zkEVM page says that as of **July 3, 2026** the sequencer has been sunset, the network is no longer producing blocks, and withdrawals from zkEVM can no longer be processed through the AggLayer bridge.

That exactly matches the symptoms Ops is seeing:

- the dashboard's latest block number does not move because the chain is no longer advancing;
- merchant balances read back the same values because the L2 state is frozen at the last produced block;
- submitted payout transactions never confirm because there is no live sequencer including them in blocks;
- swapping RPC providers only changes which read-only view of the frozen chain you are querying.

What to look at first:

1. Confirm the app is still pointed at Polygon zkEVM chain ID `1101`, not Polygon PoS or another Polygon network.
2. Compare the dashboard's last indexed block with Polygon zkEVM's last produced block from a public explorer/read-only RPC.
3. Check whether the "submitted" payout txs have hashes on chain. They probably never landed; if they were submitted after the sunset, they are pending locally/provider-side, not settled payouts.
4. Identify exactly where the $400k sits: EOA, multisig contract, PayoutVault contract, bridge contract, or a DeFi position.
5. Pull an accounting snapshot at the last indexed zkEVM block: vault token balances, merchant ledger balances, pending payout queue, and any txs submitted before the last block.

## Meaning for the merchant money

This is the bad part: if the $400k is held by `PayoutVault` as a smart contract on Polygon zkEVM, it is not the simple recovery case.

Polygon's claims flow is for EOA-held funds after the sunset. Polygon's public guidance says assets held inside smart contracts on Polygon zkEVM at the time of sunset cannot be recovered through the claims interface. That category explicitly includes protocol contracts and multisigs deployed on zkEVM.

So the working assumption should be:

- Merchant balances did not disappear from the frozen zkEVM state.
- Payouts submitted after the chain stopped did not execute and should not be treated as paid.
- The business still owes merchants according to its offchain/legal ledger.
- The onchain funds in `PayoutVault` may be practically inaccessible unless Polygon Labs can provide a special recovery path or the vault had some pre-existing L1 escape/recovery mechanism.

Immediate actions:

- Freeze new payout attempts on Polygon zkEVM.
- Stop showing the dashboard as live settlement data; label it as a frozen zkEVM snapshot.
- Open an incident with Polygon support and specifically state that funds are held in a Polygon zkEVM smart contract, not an EOA.
- Have finance/legal decide whether to make merchants whole from treasury while recovery is pursued.
- Preserve all evidence: vault address, token addresses, deployment tx, last block indexed, merchant balance snapshot, failed payout tx hashes, and bridge history.

## Q3 build plan

Do not build batch payouts on Polygon zkEVM. The Q3 plan has to become: recover/triage, migrate, then ship batch payouts on a supported network.

Given today is September 23, 2026, Q3 ends on September 30. If the batch-payout code is not already mostly built, a production rollout this quarter is not realistic. The achievable Q3 deliverable is an incident response, target-chain decision, audited design, and testnet/mainnet staging. Production batch payouts should be gated on recovery, audit, and a clean migration.

Recommended target:

- If staying in the Polygon ecosystem for stablecoin payments: migrate to **Polygon PoS**, not Polygon zkEVM.
- If cheapest major Ethereum L2 plus broad infra support matters more: evaluate **Base**.
- In either case, keep the architecture chain-portable so you are not locked into one sequencer/lifecycle decision again.

Build `PayoutVaultV2`:

- `batchPayout(batchId, token, recipients[], amounts[])` with a hard cap of 200 recipients.
- All-or-revert semantics, so a partial failed merchant batch cannot create ambiguous accounting.
- `batchId` replay protection and emitted events for each merchant payout plus a batch summary event.
- Role-separated controls: treasury depositor, payout executor, pauser, recovery/admin multisig.
- Pausable payouts, emergency withdrawal/recovery path, and documented chain shutdown/runbook assumptions.
- Offchain preflight that checks token balance, allowance, gas estimate, duplicate merchants, sanctions/compliance holds, and recipient validity before signing.
- Batch-size tuning from real gas measurements. Start with 50/100/200-recipient test batches and set the production max from observed worst-case gas, not hope.

Cost reduction path:

- Keep funds already on the payout chain; avoid bridging per payout.
- Net merchant obligations offchain and settle only final payable amounts on chain.
- Use one ERC-20 transfer loop per batch instead of one transaction per merchant.
- Chunk large runs into deterministic batches, for example 200 merchants per tx or lower if token gas behavior requires it.
- Prefer a chain with low fees, stable RPC/indexer support, deep stablecoin liquidity, and a clear operating roadmap.

Success criteria before turning it on:

- Old zkEVM payout route disabled.
- Merchant balances reconciled against the frozen zkEVM snapshot.
- New vault deployed on the replacement chain.
- Test batch paid successfully and reconciled from events.
- Monitoring tracks latest block, sequencer/chain status, stale indexer lag, failed batches, and pending signed transactions.
- Merchant comms clearly distinguish "owed balance" from "funds already recovered from zkEVM."

Sources:

- Polygon zkEVM Mainnet Beta sunset and claims page: https://www.polygon.technology/polygon-zkevm
- Polygon community reminder before sunset: https://forum.polygon.technology/t/polygon-zkevm-mainnet-beta-sunset-claim-your-funds/21856
- Original Polygon zkEVM sunset announcement: https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020
