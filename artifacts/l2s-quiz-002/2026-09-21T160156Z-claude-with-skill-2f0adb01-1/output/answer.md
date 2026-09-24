# PayoutVault on Polygon zkEVM: what's going on and what to do

## Short version

**Your dashboard is fine. The chain is the problem.** In June 2025 Polygon announced it was shutting down Polygon zkEVM (chain ID 1101) and moving its focus to Polygon PoS and AggLayer. PayoutVault went live in March 2025, a few months before that. Your symptoms are what a chain looks like when it has stopped making blocks:

- the block number doesn't move,
- balances read back the same every day, because nothing can change state,
- payouts sit unconfirmed, because no sequencer is putting them in blocks.

Every RPC provider is reading the same frozen chain. That's why swapping providers twice and re-checking API keys did nothing. Stop spending time on the RPC layer.

**What this means for the merchant money:** the ~$400k is probably not lost. It is **stuck**, and the work now is getting it out through Ethereum L1. There is no batch-payout feature to ship on zkEVM this quarter. The Q3 plan becomes "move to a chain that's running, then ship batch payouts there."

---

## 1. What to look at (in this order)

Before acting, confirm each of these against current primary sources. I'm working from the June 2025 announcement, and the exact shutdown dates and exit steps have to come from Polygon's current material.

1. **Confirm the chain has stopped, independent of your stack.**
   - Open the public zkEVM explorer and L2Beat's Polygon zkEVM page. Compare the latest block and its timestamp with what your dashboard shows. If they match and the timestamp is from around the start of the month, it's the chain, not you.
   - Call `eth_blockNumber` twice, a few minutes apart, against two unrelated RPCs. The same number both times confirms it.
2. **Read Polygon's official sunset material:** the Polygon blog, docs.polygon.technology, the forum, and status pages. Find:
   - the announced dates for sequencer shutdown and the end of bridge support,
   - the **official withdrawal / exit steps** after the sequencer stops, and any deadline for claims on L1.
3. **Check the L1 side, which is the part that matters for funds.** zkEVM state is settled on Ethereum through Polygon's rollup/bridge contracts. Find out:
   - the **last batch that was verified on L1**, and whether it includes the PayoutVault balances you expect. Only L1-verified state can be withdrawn,
   - whether PayoutVault's funds (and the merchant balances inside it) are withdrawable under the documented exit steps. That's easy if the contract can bridge its own funds out. It's hard if it can only move funds when an admin calls it on L2.
4. **Take stock of your own contract.**
   - Which token is it holding? It's probably bridged USDC/USDT on zkEVM, not a native issuer token. How is that token redeemed on L1?
   - Who controls the admin/owner keys? Is there an `emergencyWithdraw` or similar function? Is the contract upgradeable?
   - Do any of those help once no new L2 transactions can land? If they can't be executed now, they only matter for the exit plan.
5. **Take stock of your queue of payouts that never landed.**
   - List every payout submitted since the stall, with its nonce and payout ID. None of them confirmed, so none of them paid. **Treat them all as unpaid.**
   - Stop the payout job from resubmitting. Pending transactions stuck in a node's mempool could land if the chain ever came back. You don't want those executing alongside whatever settlement you do elsewhere, because that's how merchants get paid twice.

## 2. Merchant money: what to do this week

- **Freeze your ledger as of the last L1-verified state** and reconcile it against your internal books, merchant by merchant. From now until the migration is finished, that snapshot is what you owe each merchant.
- **Tell merchants now.** Say what happened (the chain was shut down), that balances are being reconciled, and when they'll hear more. They've already had silent failed payouts for weeks.
- **Get legal/finance involved.** You're holding third-party funds that you can't currently pay out. Depending on your licenses and contracts, that may trigger notice or reporting duties.
- **Decide whether to front payouts.** If merchants need to be paid before the L1 exit clears, consider paying them from company treasury on the new chain. Pay against the frozen ledger, and reimburse the treasury when the zkEVM funds are recovered. That separates what merchants experience from how long the exit takes.
- **Run the exit through the official route only.** Follow Polygon's documented process through the canonical bridge/L1 contracts. Do a small test withdrawal first. Use your multisig for the larger amounts. Don't use a third-party "fast bridge" or anyone offering to help recover funds. At a $400k balance on a chain being wound down, those are a counterparty or scam risk you don't need.
- **Keep a paper trail.** Record L1 transaction hashes, the batch number of the snapshot, and the reconciliation sheet, for auditors and merchants.

## 3. Q3 plan: batch payouts at lower per-payout cost

### Step 0: Pick a live chain (weeks 1–2)

Don't build anything new on Polygon zkEVM. Options:

| Option | Why |
|---|---|
| **Polygon PoS** | Polygon is putting its payments/stablecoin effort here. It's the least disruptive move if you want to stay in that ecosystem. |
| **Base** | Among the cheapest major L2s. Native USDC, Coinbase on/off-ramp. |
| **Arbitrum** | Deep liquidity and infrastructure, similar fees. |
| **Ethereum mainnet** | At current gas, a batch of 200 is affordable even on L1. Worth pricing if you want the strongest settlement guarantees. |

Choose based on where merchants want to receive funds and your on/off-ramp. Also choose a chain where **the stablecoin issuer mints natively** (for example, Circle's native USDC). The token you hold on zkEVM is a bridged version, and redeeming it is now tied to how the chain winds down. Don't repeat that setup. Check L2Beat for the new chain's risk profile and upgrade/exit guarantees.

### Step 1: PayoutVault v2 (weeks 2–7)

- **`batchPayout(PayoutItem[] items)` where each item is `{payoutId, merchant, amount}`**, capped at 200 items.
  - One transaction, one base transaction cost, one signature. The fixed cost is shared across up to 200 transfers. That's where most of the per-payout saving comes from.
  - A rough estimate for 200 ERC-20 transfers is a few million gas, which fits comfortably in a single L2 block. Benchmark the real number in Foundry with your token. Transfers to new holders cost more than transfers to existing ones.
- **Idempotency:** store each `payoutId` in `mapping(bytes32 => bool) paid` and skip or revert on repeats. That makes retries safe and prevents double pays, including during the migration.
- **One bad merchant must not revert the whole batch.** USDC can block addresses, and a contract recipient can revert. Two ways to handle it:
  - Use a low-level/try-style transfer per item. On failure, credit the amount to the merchant's claimable balance, emit an event, and keep going.
  - Or use a **pull model**: the batch only credits balances, and merchants (or a relayer) call `claim()`. Crediting is cheaper than transferring. As an even cheaper variant for very large batches, post one Merkle root and let merchants claim with a proof.
- **Gas hygiene:** use calldata arrays, cache storage reads, emit one event per item (the dashboard and reconciliation need them), avoid unbounded loops, and use custom errors.
- **Controls:**
  - a multisig owner,
  - a payout-operator role separate from the admin role,
  - per-batch and per-day limits,
  - a pause switch,
  - and an **exit path you can use without a working admin key**, such as merchants being able to withdraw their own credited balance directly. That's the lesson from zkEVM.
- **Dashboard:** show the chain head's **timestamp and how old it is**, not just the block number, and alert if the head goes stale for more than a few minutes. Health checks should look at chain liveness, not just whether the RPC answers.

### Step 2: Audit and testnet (weeks 7–10)

- Fuzz and invariant tests. Key invariant: total credited plus total paid never exceeds deposits. Also test that a `payoutId` can never pay twice, and that a failed recipient doesn't block anyone else.
- An external audit or at least a focused review of v2. This contract holds all merchant balances.
- Load test on the target testnet with full 200-merchant batches.

### Step 3: Migration and cutover (weeks 10–13)

1. Deploy v2 on the new chain. Seed it with the reconciled ledger balances, either from treasury or as recovered zkEVM funds arrive.
2. Settle merchants from the frozen snapshot, with each `payoutId` set to its old one so none can be paid twice.
3. Run the new chain in parallel with small real batches, then switch fully.
4. Close out the zkEVM books: recovered amount vs. snapshot owed. Treasury covers any gap.

### Expected cost

After EIP-4844, typical L2 transfers cost fractions of a cent (roughly $0.0003–$0.003). With 200 payouts in one batch, the per-payout cost is mostly the marginal cost of one transfer and one storage write. Depending on the chain, that should be **well under a cent per merchant**. Benchmark it on the chosen chain before committing to a number.

---

## Bottom line for the merchant money

- The ~$400k was never on a chain that Polygon planned to keep running. It's currently frozen at the chain's last state.
- Recovery goes through Ethereum L1, following Polygon's official exit steps. Find the timelines and deadlines **now**.
- Treat every "submitted" payout since the stall as **unpaid**. Freeze and reconcile the ledger, and tell merchants.
- Build v2 with batch payouts, idempotent payout IDs, and an exit path merchants can use themselves, on a chain that is running and has native stablecoins. Then settle everyone from the snapshot.
