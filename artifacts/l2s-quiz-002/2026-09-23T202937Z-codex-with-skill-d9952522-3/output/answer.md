As of September 23, 2026, this is not an RPC-provider problem. Polygon zkEVM Mainnet Beta has been sunset. Polygon's own zkEVM page says the sequencer stopped on July 3, 2026, the network no longer produces blocks, and AggLayer withdrawals from zkEVM no longer process. That exactly matches the symptoms Ops is seeing: reads return the same frozen final state, the displayed block number does not advance, and submitted payout transactions never confirm.

Source: https://polygon.technology/polygon-zkevm

## 1. What to look at this week

First verify we are really pointed at Polygon zkEVM, not Polygon PoS / Polygon Chain:

- chain id should be Polygon zkEVM Mainnet Beta, not Polygon PoS;
- `eth_blockNumber` will be stuck at the sunset height;
- the block timestamp for `latest` will be around the shutdown period;
- submitted tx hashes will not appear in newly produced blocks because there are no new blocks;
- changing RPC providers will only change which read-only mirror of the frozen state we are querying.

Then inspect the PayoutVault asset location, not just the merchant ledger:

- Which token balances are actually held by the PayoutVault contract?
- Were any funds sitting in EOAs at sunset?
- Does the dashboard show accounting balances from our database, onchain token balances, or both?
- Did any payout tx after July 3, 2026 ever make it into a block? Assume no unless the explorer proves otherwise.
- Are there pending internal payout records that we must reverse, mark failed, or re-run on a new rail?

The key operational fact: Polygon's claims interface is for wallet-held / EOA-held assets. Polygon's page explicitly says assets held inside smart contracts on Polygon zkEVM at sunset cannot be recovered through the Claims interface. If the merchant balances are truly inside PayoutVault, then the normal claim path does not get them out.

Immediate actions:

- Freeze new deposits and payout submissions on the zkEVM deployment.
- Take a signed incident snapshot: vault address, token addresses, final block, token balances, merchant liabilities, submitted-but-unconfirmed payout ids.
- Stop representing pending zkEVM payouts as "processing"; mark them blocked by chain sunset.
- Open a Polygon support / ecosystem escalation for contract-held funds, but do not plan around routine recovery.
- Prepare a customer-money make-good plan from treasury or insurance if the vault funds are unrecoverable on the required timeline.

## 2. Q3 build plan for batch payouts and lower cost

Do not build anything new on Polygon zkEVM. The replacement rail should be selected this week. For merchant payouts where low cost and stablecoin support are the binding constraints, Polygon PoS / Polygon Chain is the practical default to evaluate first. Polygon is actively positioning that chain for payments, and recent official material cites sub-cent stablecoin transfer costs and payment-focused reliability upgrades. If we require a stricter Ethereum L2 security model instead, evaluate Base, Arbitrum, Scroll, or Linea, but that is a different tradeoff and should not be confused with the dead zkEVM deployment.

Source: https://polygon.technology/learn/payments/stablecoins-for-global-payouts

Build the new payout system as a fresh deployment:

- `BatchPayoutVault` holds merchant payout liquidity on the new chain.
- `batchPayout(token, recipients, amounts, batchId)` settles up to 200 merchants in one transaction.
- The contract enforces array length equality, a 200-recipient cap, nonzero recipients, sufficient vault balance, idempotent `batchId`, and role-gated payout operators.
- Use `SafeERC20`, a reentrancy guard, pause controls, and event logs for every batch and every recipient.
- Do not store per-recipient payout state onchain unless we need merchants to claim later; storage writes are the expensive part.
- Keep the source of truth for scheduled liabilities in our ledger, and use onchain events as settlement receipts.
- Simulate every batch before submission and automatically split a batch if gas exceeds the target.

Cost path:

- One transaction for up to 200 ERC-20 transfers amortizes base transaction overhead.
- Use calldata arrays, avoid redundant storage writes, cache loop values, and use `unchecked` loop increments after bounds checks.
- Prefer native USDC/USDT on the chosen chain over bridged long-tail assets.
- Fund the vault in larger treasury sweeps rather than per-payout top-ups.
- Add retry-by-batch-id and deterministic reconciliation so failed batches can be safely reissued.

Schedule for the remainder of Q3 2026:

- September 23-24: incident freeze, final zkEVM state snapshot, merchant liability export, replacement-chain decision.
- September 25-27: implement `BatchPayoutVault`, deployment scripts, fork tests, gas benchmarks for 50/100/200-recipient batches, and monitoring hooks.
- September 28: security review focused on authorization, idempotency, token-transfer edge cases, and reconciliation.
- September 29: deploy to the new chain, seed with a small treasury amount, run a pilot batch against internal or low-risk merchants.
- September 30: ramp production batches only after reconciliation proves that ledger debits, token transfers, and merchant receipts match.

## What this means for merchant money

The merchant balances are not moving because the chain they are on is no longer moving. If the $400,000 is held by the PayoutVault smart contract on Polygon zkEVM, it still exists in the frozen zkEVM state, but it is not currently liquid or payable through normal transactions, bridges, or Polygon's EOA claims interface.

That means we should treat the onchain vault balance as impaired until proven recoverable. The company likely still owes merchants their balances; the chain shutdown does not make the merchant liability disappear. The practical path is to make merchants whole on a live rail, while separately pursuing any possible recovery of the frozen contract-held assets.
