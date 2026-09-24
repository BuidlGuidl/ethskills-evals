## Short version

This is almost certainly not an RPC-provider problem. Polygon zkEVM Mainnet Beta has been sunset. Polygon says that as of July 3, 2026 the zkEVM sequencer is no longer producing blocks and withdrawals can no longer be processed through the Agglayer Bridge. Alchemy separately ended Polygon zkEVM support on July 1, 2026 because the network was shut down.

So the dashboard symptoms line up exactly: a fixed block number, unchanged balances, and submitted payout transactions that never confirm. If our dashboard only appeared stuck from September 1, that is a monitoring/data-provider detail; the underlying live chain had already stopped in early July.

Sources:

- Polygon zkEVM sunset page: https://polygon.technology/polygon-zkevm
- Polygon June 11, 2025 deprecation announcement: https://forum.polygon.technology/t/sunsetting-polygon-zkevm-mainnet-beta-in-2026/21020
- Alchemy deprecation notice: https://www.alchemy.com/docs/reference/polygon-zkevm-deprecation-notice

## What Ops should look at now

Stop rotating RPC providers. The thing to check is whether we are querying a live chain or a read-only historical endpoint for a chain whose sequencer has stopped.

Immediate checks:

1. Confirm the chain status against Polygon's sunset notice, not just provider health pages.
2. Compare the dashboard block number to the last zkEVM block from multiple sources. If all providers return the same frozen height, that is expected after sequencer shutdown.
3. Pull the last successful PayoutVault transaction, the last successful deposit, and all pending payout submissions. Treat anything submitted after the sequencer stopped as not executed.
4. Identify where the $400k was held at sunset:
   - If it was in EOAs, Polygon's claims interface may allow recovery on Ethereum until December 31, 2027.
   - If it was inside PayoutVault, a multisig deployed on zkEVM, a bridge contract, or another smart contract, Polygon says those assets cannot be recovered through the claims interface.
5. Freeze new deposits and payout submissions on Polygon zkEVM in product, APIs, cron jobs, and runbooks.
6. Snapshot the final zkEVM state we can read: PayoutVault token balances, per-merchant accounting, pending payout intents, nonces, roles, and event logs.
7. Escalate to Polygon support immediately with the PayoutVault address, token addresses, final block, and proof that the funds are merchant balances held in our contract.

## What this means for merchant money

This is the critical part: merchant money is not moving on Polygon zkEVM anymore.

If the $400k is held by the PayoutVault smart contract on Polygon zkEVM, it should be treated as stranded until proven otherwise. The balances may still be visible in historical state, but the contract cannot process normal payout transactions because no new zkEVM blocks are being produced. Polygon's public claims path is for EOA-held assets and explicitly does not recover assets locked in smart contracts.

Operationally, we should:

1. Stop representing these balances as immediately withdrawable.
2. Create an incident ledger that separates:
   - final zkEVM contractual balances,
   - payouts submitted but never executed,
   - any recoverable EOA-held funds,
   - smart-contract-held funds requiring exceptional recovery or company-funded make-good.
3. Decide whether we will front liquidity to merchants while pursuing recovery. If merchants are owed balances and the vault assets are not recoverable in time, this becomes a treasury/liability decision, not an engineering queue item.
4. Communicate with merchants using exact dates: Polygon zkEVM stopped producing blocks on July 3, 2026; normal payouts from the zkEVM PayoutVault are not confirming; we are reconciling final balances and moving payout operations to a supported network.

## Q3 build plan

Do not build batch payouts on Polygon zkEVM. The Q3 plan should be a migration plus batching plan.

### Phase 1: Stabilize and reconcile

- Disable zkEVM payout creation and deposits.
- Produce a signed final-balance report from PayoutVault logs and state at the final readable block.
- Reconcile the off-chain merchant ledger against on-chain vault balances.
- Classify funds by custody type: EOA-recoverable, smart-contract-held, already bridged, or operationally missing.
- Open Polygon support/escalation for any smart-contract-held assets.

### Phase 2: Pick the replacement rail

For this quarter, choose a supported chain with reliable RPC/indexing, exchange support, stablecoin liquidity, and low fees. Polygon PoS is the obvious first candidate if we want to stay in the Polygon ecosystem; another production L2 is also reasonable if finance, compliance, and merchant wallets already support it.

Selection criteria:

- native or widely accepted stablecoin support,
- low transfer cost under peak load,
- mature block explorers and indexers,
- bridge/off-ramp availability,
- provider SLAs from at least two RPC vendors,
- clear deprecation and incident monitoring.

### Phase 3: Ship PayoutVault v2 with batching

Build a new PayoutVault on the replacement chain with:

- `batchPayout(token, recipients, amounts, batchId)` capped at 200 recipients,
- role-based submitter/approver controls,
- replay protection by `batchId`,
- pause and emergency withdrawal controls,
- per-recipient and per-batch events for accounting,
- explicit partial-failure policy. Prefer all-or-nothing unless finance wants failed recipients skipped and retried,
- test coverage for array mismatch, duplicate merchants, fee-on-transfer tokens, insufficient balance, reentrancy, pause behavior, and max batch size.

For cost reduction:

- net merchant balances off-chain before settlement,
- batch by token and destination chain,
- run scheduled payout windows instead of one transaction per merchant,
- use direct ERC-20 batch transfers for actual push payouts,
- consider a Merkle-claim distributor only for merchants who can self-claim, because it lowers our transaction cost but pushes gas and UX complexity to merchants.

### Phase 4: Launch safely

- Deploy on testnet/fork and run 200-recipient gas tests.
- Run a small production pilot with internal merchants or low-value payouts.
- Compare actual per-recipient cost against the old one-payout-one-transaction path.
- Turn on monitoring for finality lag, RPC divergence, stuck nonces, contract balance drift, and unexecuted payout batches.
- Migrate merchants in waves after they confirm destination addresses on the new chain.

## Bottom line

The dashboard is frozen because Polygon zkEVM is frozen. The old payout rail is not reliable or live, and swapping RPC providers will not make merchant payouts confirm.

For merchant funds, the decisive question is whether the $400k was in EOAs or in PayoutVault at the time of sunset. EOA funds may be claimable through Polygon's process until December 31, 2027. Funds locked in PayoutVault are not covered by that claims path and should be treated as at-risk/stranded while we escalate recovery and decide whether to front liquidity to merchants.
