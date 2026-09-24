# PayoutVault on Polygon zkEVM: dashboard incident, Q3 plan, and the merchant money

## Summary

- **Your RPC providers are fine. The chain is what stopped.** Polygon zkEVM Mainnet Beta was sunset, and its sequencer stopped producing blocks around **2026-07-01**. Since then there have been no new blocks, submitted transactions never get included, and AggLayer withdrawals no longer process. Read calls still return the frozen final state. That matches all three symptoms: balances don't change, the block number doesn't move, and payouts never confirm. Swapping providers can't fix it, because every provider serves the same halted chain.
- **The Q3 plan as written can't ship on zkEVM.** No chain means no batch payouts there. Q3 also ends on **Sep 30, nine days from now**. This quarter's real work is recovering the money and choosing a new chain. Batch payouts ship on the new chain, and realistically that's Q4.
- **The ~$400k is the priority, and it is at real risk.** Polygon's sunset snapshot and claims process covers balances held in wallets. A balance held inside a contract, like PayoutVault, **has no routine exit**. Treat this as a fund-recovery incident starting today, not as a migration ticket.

---

## 1. The stuck dashboard: what to check

Spend about an hour confirming the diagnosis, then switch to incident mode.

1. **Confirm the halt independently of your stack.**
   - Call `eth_blockNumber` on two or three different endpoints, including a public one. Then call `eth_getBlockByNumber("latest")` and look at the `timestamp`. It should be around 2026-07-01, and it should match across endpoints.
   - Check the zkEVM block explorer and Polygon's official sunset / deprecation announcements. Get the exact final block number and time from Polygon's own sources rather than from this note.
2. **Check the timeline gap.** Ops says "stuck since the start of the month", but the chain stopped around July 1. If they mean September, then either the dashboard was masking the halt (cached data, or a fallback that looked healthy), or the halt went unnoticed for weeks. Either way, you need to know:
   - **which payouts merchants believe were made but never were, since ~July 1**
   - why monitoring didn't alert on a block height that stopped moving. Add a "latest block older than N minutes" alert to whatever chain you run on next.
3. **Stop submitting payouts to zkEVM now.** Pause the payout worker. Every submission fails silently.
4. **Reconcile your ledger against the chain.**
   - List every payout transaction submitted since the last block that was actually included.
   - Mark each one **not executed** in your internal ledger. The chain is final and they will never land.
   - Keep the signed raw transactions and nonces on record. If Polygon ever runs a recovery sequencer, you'll need to know which old signed transactions could still be replayed.
5. **Snapshot the final state now, while reads still work.** Public RPCs for a sunset chain will eventually go away. Capture:
   - the PayoutVault address, bytecode, owner/admin roles, and the token(s) it holds (native bridged USDC vs LxLy-bridged, and so on)
   - `balanceOf(PayoutVault)` for each token, and the per-merchant balances from the contract's own storage, all at the final block
   - `eth_getProof` for the vault's account and the relevant storage slots, against the final state root. If any recovery is based on the final state root, cryptographic proofs of the balances are what you'll be asked for.
   - your full event history (deposits and payouts) exported to your own storage

## 2. Q3 build plan: batch payouts and lower per-payout cost

### What changes

- **Nothing new gets built on Polygon zkEVM.** The chain is off.
- **Q3 has nine days left.** Here is what that allows:

| Window | Deliverable |
| --- | --- |
| This week | Fund-recovery incident (section 3). Merchant communication. Pay merchants who are owed from treasury where you can. |
| Rest of Q3 | Choose the target chain. Write and test the batch payout contract on testnet. Gas benchmarks on a fork of the chosen chain. |
| Q4 | Audit (this contract will hold hundreds of thousands in merchant funds). Mainnet deploy. Move merchant balances. Turn on batch payouts. |

Shipping a new vault to mainnet without an audit, days after an incident like this one, is the wrong trade.

### Choosing the replacement chain

Pick based on the constraint that actually binds, not a TVL ranking:

- **Stablecoin payouts to merchants who may hold no gas token:** Celo.
  - It's an Ethereum L2 (on the OP Stack since March 2025).
  - Gas can be paid in USDC or USDT through the CIP-64 fee-currency field, with no paymaster or bundler.
- **Consumer reach and a direct fiat on-ramp:** Base.
- **If a multi-day exit to L1 is unacceptable:** a ZK rollup (zkSync Era, Scroll, Linea).
  - Scroll and Linea deploy standard `solc` bytecode, just like mainnet.
  - On zkSync Era, decide up front between the EVM interpreter and native `zksolc`.
  - Optimistic chains (Celo, Base) have about a 7-day L1 exit. On Celo, the proof-maturity gate outweighs the 3.5-day challenge window.

Before you commit to a chain, confirm it is live and that USDC on it is the canonical issuer's version. Given what just happened, add one more requirement: **the chain must have a published deprecation and exit policy that covers contract-held balances.**

### Batch payout contract design

**Entry point.** `payoutBatch(bytes32 batchId, Payout[] payouts)`, capped at 200 per call.
- `batchId` is recorded onchain, so a retried batch can never pay twice. After the silent failures on zkEVM, idempotency is not optional.
- Debit the internal ledger, then transfer.

**Per-recipient failures must not revert the whole batch.** A single USDC-blacklisted or otherwise failing recipient would otherwise block all 200.
- Wrap each transfer and, on failure, credit that merchant's amount to a withdrawable balance.
- Emit a `PayoutFailed` event.

**Cut cost where it actually lives.**
- On a rollup, a large share of the fee is the L1 data cost of your calldata. Pack each `(recipient, amount)` into a single 32-byte word: 20-byte address plus a 12-byte amount, which is plenty for 6-decimal USDC.
- Or use recipient indices from an onchain registry, which shrinks calldata further.
- Keep the vault's own accounting to one storage write per merchant.
- Recipients that have never held the token cost more (a fresh storage slot). Expect that in the numbers.

**Alternative: Merkle claims.**
- Post one root per settlement cycle, and merchants claim their own payouts.
- This gives the lowest operator cost, but it moves gas and effort onto merchants. It only makes sense if merchants are comfortable onchain, or on Celo with gas paid in stablecoins.

**Measure; don't quote remembered numbers.**
- Benchmark 1, 50 and 200-recipient batches against a fork of the target chain and read the real L2 execution and L1 data fees.
- Fees on L2s move month to month.
- Confirm 200 recipients fits comfortably under the block gas limit.

**Build in operational safety.**
- Use `block.timestamp`, not `block.number`, for any time logic.
- Include a pause and an emergency-withdraw path to merchants, so the vault itself never becomes the kind of trap PayoutVault is now.
- Monitor block height and inclusion latency.

## 3. What this means for the merchant money

**The ~$400k in PayoutVault is not reachable through normal means.**
- You can't send any transaction on zkEVM, and that includes admin or withdraw calls.
- The canonical AggLayer exit no longer processes.
- Polygon's sunset snapshot and claims interface covers **wallet-held balances**. A contract-held balance has **no routine exit**. The funds exist in the final state, but nothing standard moves them out.

**What to do, starting today:**

1. **Open a case with Polygon Labs immediately.** Go through official support and your account or BD contacts if you have them. Bring:
   - the contract address and chain ID
   - the token(s) and final balances
   - the per-merchant breakdown and the state proofs from section 1

   Ask plainly whether any recovery path covers contract-held balances, and if so, what the deadline is. If there is a claims deadline, **it is the most important date you have**.
2. **Treat the balances as a liability you owe merchants, whatever happens onchain.**
   - Finance and legal should decide now whether to pay merchants from treasury and pursue recovery of the stuck funds afterwards.
   - Merchants have probably been unpaid since around July 1. That is a business and legal exposure regardless of what Polygon can do.
3. **Tell merchants what happened.** Say that the settlement network was shut down by its operator, that their balances are recorded and provable, and what you're doing about it and when they'll be paid. Don't promise a recovery timeline you don't control.
4. **Don't pay anyone who says they can "recover" the funds.** Only act on instructions from Polygon's official channels. Sunset events attract scams.
5. **Post-mortem items:**
   - No monitoring alerted on block height.
   - Nobody tracked the chain's deprecation notice, even though the sunset was announced ahead of time.
   - The vault had no exit path that works without the chain being live.

   Fix all three before any money goes into the replacement vault.
