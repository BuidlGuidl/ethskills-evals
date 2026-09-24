# PayoutVault on Polygon zkEVM: stuck dashboard, Q3 plan, and the merchant money

## Summary

- **Your dashboard is probably fine. The chain it reads from has most likely stopped.** Polygon announced in June 2025 that it is shutting down Polygon zkEVM (chain ID 1101) and moving its focus to Polygon PoS and AggLayer. Your symptoms fit a chain that is no longer making blocks: the block number is frozen, balances never change, and transactions never get included. The same thing happening across three RPC providers rules out an RPC or API-key problem.
- **Stop building on Polygon zkEVM.** The batch-payout work should ship on a chain that is still running. Moving the vault is now the main Q3 project, and batch payouts should be built as part of the new vault.
- **The $400k is a recovery problem now, not an operations problem.** Merchant funds held by a contract on a stopped chain can only come out through the Ethereum (L1) bridge exit process that Polygon provides for the shutdown. You still owe your merchants that money no matter how long recovery takes. Treat this as an incident today.

One caveat: I can't see your chain from here. The steps below prove or rule out the shutdown in about 15 minutes. Please run them before you act on anything else in this document.

---

## 1. The stuck dashboard: what to check

### Why RPC isn't the cause
If an RPC provider is broken, you get errors, timeouts, or data that differs between providers. You are seeing the same frozen block height from three providers, with reads that succeed and writes that never confirm. That means the providers are correctly serving the last state of a chain that has stopped producing blocks. The sequencer is not taking new transactions, so every read returns the same last state. Stop swapping providers.

### Checks, in order

1. **Compare block height and timestamp across providers**
   ```bash
   for RPC in $RPC_A $RPC_B https://zkevm-rpc.com; do
     cast block latest --rpc-url $RPC --field number
     cast block latest --rpc-url $RPC --field timestamp
   done
   ```
   If every provider shows the same height and a timestamp from around the start of the month, the chain has halted.
2. **Check a public block explorer for Polygon zkEVM.** Look at whether any new blocks or transactions appear anywhere, not just for your contracts.
3. **Read Polygon's official channels and L2Beat.** Look at the Polygon blog, the forum/governance posts, and status pages for the zkEVM sunset timeline. You need four facts from them:
   - when the sequencer stopped or will stop
   - whether the chain is in emergency / forced-withdrawal mode
   - the **last batch that was verified on L1**
   - the official withdrawal or claim process and **its deadline**

   Check L2Beat's Polygon zkEVM page for the same information.
4. **Check the L1 side (Ethereum mainnet).** Look at the zkEVM rollup and bridge contracts on Etherscan. Find when the last batch was sequenced and verified, and whether an emergency state is active. This tells you which L2 state is actually final and can be withdrawn.
5. **Find your pending payouts.** List every payout transaction you submitted since the stall began, with its nonce and hash. Assume none of them happened. **Do not resubmit or re-pay these on another rail yet.** If the chain resumes, even briefly, any queued transaction could still land, and a second payment would pay those merchants twice. Before paying anyone off-chain, invalidate the pending transactions: send a replacement using the same nonce, or pause the vault if it has a pause function and the chain is still live.

If step 1 shows blocks still moving, then this is not the shutdown. In that case, look at your indexer or cache layer (for example a stale `latest` cache or a stuck subgraph) and at your signer (nonce gap, empty gas balance). The results you described make that unlikely.

---

## 2. Q3 plan: batch payouts and lower cost per payout

### Timing
Today is **21 Sep 2026**. If Q3 means the calendar quarter, it ends in 9 days. That is enough time to start the migration and the fund recovery, but not enough to also ship a new audited payout contract. I suggest this schedule:

| When | Work |
|---|---|
| This week (priority) | Incident response and fund recovery (section 3). Choose the destination chain. |
| Rest of Q3 | Write the new `PayoutVault` with batch payouts. Test it on the target chain's testnet. |
| Early Q4 | Audit or review, deploy, move merchant balances over, and switch payouts to the new vault. |

If your fiscal Q3 runs later than the calendar quarter, use the same order of work.

### Choosing the destination chain
Do **not** deploy anything new on Polygon zkEVM.

| Option | Why |
|---|---|
| **Polygon PoS** | Polygon's own focus for payments and stablecoins. Your team already knows the Polygon ecosystem. |
| **Base** | Cheapest major L2, and it has a direct Coinbase on-ramp for USDC. |
| **Arbitrum** | Most mature L2 with deep liquidity. |
| Ethereum mainnet | Currently only a few cents per transfer. Worth pricing out, because it removes rollup-shutdown risk entirely. |

Things to require on whichever chain you pick:
- A **native** USDC deployment, not a bridged version, so balances don't depend on a bridge.
- Solc bytecode compatibility, so your existing contract code moves over unchanged.

### Batch payout design (up to 200 merchants per transaction)

**Option A: push batch.** One function call pays a list of merchants.
```solidity
function payoutBatch(address[] calldata to, uint256[] calldata amt) external onlyOperator {
    require(to.length == amt.length && to.length <= 200);
    for (uint256 i; i < to.length; ++i) {
        // one bad recipient must not revert the other 199
        (bool ok, bytes memory ret) = address(token).call(
            abi.encodeCall(IERC20.transfer, (to[i], amt[i])));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            owed[to[i]] += amt[i];               // credit instead; merchant claims later
            emit PayoutDeferred(to[i], amt[i]);
        } else emit Paid(to[i], amt[i]);
    }
}
```
- **Gas:** about 30–55k gas per recipient. Paying a USDC address for the first time costs more than paying one that already holds USDC. A full batch of 200 comes to roughly 6–11M gas. That fits the block gas limit on Base, Arbitrum, and PoS, but test the worst case: 200 recipients who have never held USDC.
- **Cost:** the batch saves the 21k base transaction cost and the signature on 199 of the 200 payouts. On an L2 that brings a payout down to fractions of a cent.
- **Guardrails:**
  - Make every batch idempotent: a `batchId` that can only be used once, stored as `mapping(bytes32 => bool) settled`. A retried batch then can't pay anyone twice.
  - Add a pause function.
  - Put the operator key behind a multisig, or give it a limit on how much it can pay per batch.

**Option B: Merkle claim (cheapest to post).** Each cycle, the operator posts one Merkle root of `(merchant, amount, cycle)` and merchants claim their own payout.
- Posting costs the same whether the batch has 200 merchants or 20,000.
- Each claim costs the merchant, or you if you sponsor claims through a paymaster, about 60–80k gas.
- The trade-off is that merchants have to act to get paid.

**My recommendation:** use Option A as the default, because merchants expect to be paid without doing anything. Include the `owed[]` / `claim()` fallback from Option B so a single bad recipient never blocks the other 199.

**Ways to cut cost further on an L2**
- On rollups, most of the fee is posting data to L1. Keep calldata small: pack the amount and recipient index into one `uint256`, or keep a merchant registry and send short IDs instead of 20-byte addresses.
- Run payouts on a schedule (for example daily) so batches are close to full.
- Before and after each batch, check that the vault's token balance still covers the sum of all merchant balances.

**Build in a way to leave any chain.** This incident happened because the vault had no exit plan. The new vault should have:
- a documented, tested procedure to move all balances to another address or chain
- a merchant-balance ledger that you can rebuild from events
- an alert that fires when the chain head stops moving for more than about 5 minutes

With that alert, a halt like this one gets noticed in minutes instead of three weeks.

---

## 3. What this means for the merchant money

1. **The on-chain balance may be stuck, but you still owe it.** $400k of merchant balances is a liability to your merchants whatever state the chain is in. Tell finance, legal, and leadership now. Decide whether to pay merchants from treasury on the new chain while recovery runs. If you do, first cancel the pending zkEVM payouts as described in section 1, step 5.
2. **How the money comes out depends on Polygon's shutdown process.** On a ZK rollup, the only final state is the last batch verified on Ethereum. The money leaves through the L1 bridge using that state.
   - **Funds held by a contract are harder to get out than wallet funds.** If PayoutVault holds the money, the vault contract itself has to start the withdrawal, and a stopped chain can't run it. Ask Polygon directly whether the shutdown process covers balances held by contracts, and how: a snapshot of state, a forced exit, or a manual claim process.
   - Some claim processes have deadlines. Find out whether this one does before anything else.
3. **Know which token you actually hold.** USDC on Polygon zkEVM was typically the **bridged** version through Polygon's LxLy bridge, not Circle's native USDC. What you can redeem depends on that bridge's escrow on L1. Confirm the exact token contract address the vault holds.
4. **Reconstruct and freeze the ledger.**
   - Rebuild each merchant's balance from the vault's events up to the last L1-verified batch.
   - Mark every payout submitted after that point as **not paid**.
   - Get this ledger signed off, because it is what you will pay out from.
5. **Tell your merchants.** Explain that payouts are paused because the network was shut down by its operator, that their balances are recorded and owed, and when they can expect payment on the new chain. Silence makes the situation look worse than it is.
6. **Operator funds are stuck too.** Any ETH or gas balance and any treasury funds on zkEVM follow the same recovery path. Include them in your claim.

**Action list for this week:**
1. Run the checks in section 1 to confirm the halt.
2. Get Polygon's official exit process and deadline.
3. Freeze the ledger at the last verified batch.
4. Cancel or neutralize the pending payouts.
5. Brief finance and legal.
6. Choose the new chain.
7. Start the new vault with batch payouts and a tested exit procedure.
