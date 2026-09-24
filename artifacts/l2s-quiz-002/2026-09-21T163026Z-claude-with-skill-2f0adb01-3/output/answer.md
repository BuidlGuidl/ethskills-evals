# PayoutVault on Polygon zkEVM: the stuck dashboard, the Q3 plan, and the merchant money

## TL;DR

- **The dashboard probably isn't broken. The chain may be.** In June 2025, three months after PayoutVault launched, Polygon announced it was **shutting down Polygon zkEVM** (chain ID 1101). Polygon is putting its effort into Polygon PoS and AggLayer instead. Here is what ops is seeing: the block height is frozen, every provider returns the same balances, and submitted transactions never get included. That is exactly what a halted sequencer looks like. It does not look like an RPC or API-key problem. Swapping providers can't help, because every provider reads the same stopped chain.
- **This is now an asset-recovery incident, not a dashboard ticket.** About $400k of merchant money sits in a contract on a chain that isn't producing blocks. The priority is getting that money out through the L1 exit path while that path still works. Building new features comes second.
- **Don't build batch payouts on zkEVM.** Build them on a live chain; recommendations are below. Also note the date. Today is **Sept 21**, so Q3 has about nine working days left. Batch payouts can't responsibly ship to production by Sept 30. The realistic plan for this quarter is to recover the funds, pick the new chain, and write the spec. Batch payouts ship in Q4.

---

## 1. The stuck dashboard: what to check (in this order, about an hour)

The goal is to confirm quickly whether the chain itself has stopped, then move straight to recovering the funds.

1. **Is the chain producing blocks at all?**
   - Call `eth_blockNumber` on chain 1101 from 2–3 unrelated providers, plus the public zkEVM RPC if it still answers. If they all return the **same frozen height**, the chain has halted. Your stack is fine.
   - Check the zkEVM block explorer and the chain's page on **L2Beat** (l2beat.com). Look at the timestamp of the latest block and the latest batch.
2. **Read Polygon's official channels.** Check the Polygon blog, docs.polygon.technology, status page, forum and X for the zkEVM sunset notice and its timeline. Look specifically for the date the **sequencer stopped** and the **instructions and deadline for withdrawals and exits**. I don't have reliable exact dates for the 2026 shutdown steps, so treat Polygon's published notice as the source of truth, not me. Assign one person to read it end to end today.
3. **Check L1 (Ethereum mainnet), because that's where the money actually lives.** zkEVM assets are escrowed in the LxLy bridge contract on Ethereum. Look at:
   - The last **verified** batch or state root the rollup contract accepted on L1. Anything that happened on L2 *after* the last verified batch may never be provable on L1.
   - The bridge contract's state, such as whether it is paused or in emergency state, and whether claims are still being processed.
   - (Verify every contract address against Polygon's docs before relying on it. Don't copy addresses from blog posts or chat.)
4. **Check our own pending transactions.** List every payout transaction submitted since the chain stopped, with nonce, hash, merchant and amount.
   - They were almost certainly **never included**. So those merchants have **not** been paid, even if our internal ledger marked the payouts as "sent".
   - **Stop the payout job now.** It shouldn't keep submitting to a dead chain, and a signer queue full of stale nonces will cause trouble later.
   - Make sure none of these payouts can execute later (for example if the chain comes back briefly for exits) and then get paid a second time on the new chain.
5. **Fix the monitoring gap for the future.** Add an alert for "head block not advancing for N minutes" and for "submitted tx not mined within N blocks". This outage was visible on day one, and it took three weeks and two provider swaps to escalate.

If steps 1–3 show that the chain is actually live and only our stack is stuck, then go back to normal debugging. Check that the dashboard isn't pinned to a cached block or a hard-coded block tag, check the indexer's health, and check the signer's nonce and gas settings. Given the public shutdown announcement, though, I'd bet heavily on the chain being down.

---

## 2. What this means for the merchant money (about $400k)

**Where the money is:** it is **not** in the dashboard and **not** at the RPC provider. The tokens PayoutVault holds were bridged into zkEVM, and their backing sits in the zkEVM bridge on **Ethereum L1**. A merchant's claim is therefore: PayoutVault's internal balance, then PayoutVault's token balance on L2, then the tokens escrowed in the L1 bridge. The L2 claim can only be exercised through whatever exit mechanism Polygon supports.

**What decides whether we get it all back:**

| Question | Why it matters |
|---|---|
| Is Polygon still offering a withdrawal/exit path, and until when? | Shutdowns normally include an exit window. **Missing the deadline is the biggest avoidable risk.** |
| Does the exit need a normal L2 transaction (a `bridgeAsset` call from the holder)? | If yes, and the sequencer is off, we depend on Polygon's shutdown process. Examples would be a final window where transactions are accepted again, forced inclusion, or a snapshot-based claim. Find out which one applies. |
| **Who holds the tokens: PayoutVault (a contract) or merchants' own wallets?** | If the vault holds them, *the vault itself* has to start the bridge-out. Does PayoutVault have an admin or owner function that can move funds or call the bridge? If it only lets merchants withdraw to their own L2 address, every merchant would have to exit individually. Pull the contract source and the multisig/owner keys **today**. |
| Is the vault's latest state inside a **verified** batch on L1? | Balance changes after the last verified batch may not be provable. Reconcile the internal ledger to the last verified L2 state, not to "what we sent". |
| Which token is it (bridged USDC.e, USDT, ETH…)? | That decides what we receive on L1 and how we move it to the new chain. For USDC, use Circle's CCTP or the official bridge. For $400k, avoid fast bridges that add third-party trust assumptions. |

**Actions, in order:**

1. **Freeze.** Stop new deposits, credits and payouts on zkEVM. Stop the payout workers.
2. **Reconcile.** Build a per-merchant ledger as of the last confirmed on-chain state. Mark every "submitted but never mined" payout as **unpaid**. Sum it and compare against the vault's token balance.
3. **Exit.** Follow Polygon's official withdrawal procedure to move the vault's funds to L1 into a company-controlled multisig. The ZK exit doesn't have a 7-day challenge period, so once a batch is verified, the claim on L1 is quick. The deadline is what matters.
4. **Re-home.** Move the funds to the new chain (section 3) and restore merchant balances there from the reconciled ledger. Or pay merchants out directly from L1. At current gas prices, about 200 L1 ERC-20 transfers cost a few dollars in total.
5. **Communicate.** Merchants haven't received payouts for about three weeks. Tell them what happened, confirm their balances are recorded and being migrated, and give them a date. Have legal/finance look at it too: we are holding customer funds, and delayed settlement can bring contractual and regulatory obligations.

**Bottom line:** the money is *very likely recoverable*, because the assets are escrowed on Ethereum L1 and the rollup's verified state is proven there. But recovery is **time-boxed and depends on how Polygon's shutdown works**, and on whether PayoutVault can move its own funds. Treat it as a P0 until the funds are back on L1.

---

## 3. Batch payouts and lower cost: the plan

### Chain choice (not zkEVM)

| Option | Why | Caveat |
|---|---|---|
| **Base** | Cheapest major L2 (~$0.0003 for a transfer), native USDC, Coinbase on/off-ramp for merchants | 7-day withdrawal to L1 through the official bridge (irrelevant if merchants cash out through Coinbase or CCTP) |
| **Arbitrum** | Deep liquidity, native USDC, mature | Same 7-day withdrawal window |
| **Polygon PoS** | Polygon's own focus for payments and stablecoins; the smallest change of ecosystem for us | Different security model (a PoS sidechain, not a rollup) |
| **Ethereum L1** | ~$0.004 per transfer at today's gas; strongest guarantees | Higher and more variable cost per payout |

**Recommendation: Base or Arbitrum with native USDC.** Pick based on where merchants cash out. Keep the contract bytecode-portable, using standard `solc` and no chain-specific opcodes. Deploy with CREATE2 so a future move doesn't require new addresses. That way the next migration is a redeploy rather than a fire drill.

### Batch payout design (up to 200 merchants per tx)

Two proven patterns:

1. **Push batch (`payoutBatch(address[] to, uint256[] amounts)`).**
   - 200 ERC-20 transfers is about 5–7M gas, well within L2 block limits. On Base or Arbitrum that is **a few cents for the whole batch**, or fractions of a cent per merchant.
   - **Don't let one bad recipient revert the whole batch.** A USDC-blacklisted address or a contract that rejects the transfer would do that. Use low-level/`try` transfers. On failure, credit the amount to an internal `owed[merchant]` balance the merchant can pull later, and emit a `PayoutFailed` event.
   - Take an idempotency key (batch ID) and reject any batch ID we've already processed. That prevents double-paying when the payout job retries. It also fixes the class of bug that the stuck-tx situation above exposes.
   - Pack the calldata (for example `uint160` address + `uint96` amount in one word) to cut the L1 data cost, which is the largest part of L2 fees.
2. **Merkle distributor (post one root, merchants claim).**
   - We pay one tiny transaction per payout cycle no matter how many merchants there are. Merchants (or a relayer or paymaster we fund) pay to claim.
   - This is best if the merchant count grows well past 200, or if merchants don't need funds pushed to them.

**Recommendation:** start with the push batch plus the pull fallback for failures. It matches today's UX. At L2 prices, per-payout cost stops being a meaningful line item. Most of the savings come from leaving zkEVM and amortizing the fixed per-transaction overhead across 200 payouts.

Standard safety features: role-separated signer vs. admin (multisig), a pause switch, per-batch and per-day caps, an **emergency `sweep`/migrate function controlled by a timelocked multisig** (the feature whose absence may be hurting us right now), and a chain-liveness check in the payout worker.

### Timeline (being honest about "this quarter")

Q3 ends **Sept 30**, nine days from now. A new contract holding customer funds needs build, test, audit and a staged rollout. It won't be production-ready by then.

| When | Deliverable |
|---|---|
| **This week (Q3)** | P0: confirm the halt, freeze payouts, reconcile the ledger, start the exit from zkEVM, notify merchants. Decide on the chain. |
| **By Sept 30 (Q3)** | Funds back on L1 or in progress, ledger signed off by finance, batch payout spec approved |
| **Q4 weeks 1–3** | Build `PayoutVault v2` (batch + pull fallback + idempotency + caps + emergency migrate); fork tests with 200-recipient batches, including failing recipients; liveness monitoring |
| **Q4 weeks 3–6** | External audit; testnet dry runs; small-cap mainnet launch (for example a $10k cap), then raise the caps |
| **Q4 weeks 6+** | Move merchant balances into v2 and make batch payouts the default |

If leadership insists on shipping something in Q3, the only responsible option is an **interim manual path**: pay the reconciled merchant balances from a multisig on the new chain or L1 using an audited, off-the-shelf batch-transfer tool. Custom v2 code should wait until the audit is done.

---

## One-paragraph summary for leadership

Polygon announced in June 2025 that it is shutting down Polygon zkEVM, the chain our payout vault runs on. The "stuck dashboard" is almost certainly that chain no longer producing blocks, not an RPC problem. About $400k of merchant money is on it. The backing funds are escrowed on Ethereum and should be recoverable, but only through Polygon's exit process and before its deadline. Recovery is this week's priority. Merchant payouts submitted this month did not go through, and merchants need to be told. Batch payouts will be rebuilt on a live, cheaper chain (Base or Arbitrum). At a few cents per 200-merchant batch, per-payout cost becomes negligible. That work is realistically a Q4 delivery, after an audit.
