# PayoutVault on Polygon zkEVM: stalled dashboard, Q3 plan, and the merchant money

**Short version:** This is very likely not a dashboard or RPC problem. Polygon zkEVM itself has probably stopped producing blocks. In June 2025, Polygon Labs announced that **Polygon zkEVM Mainnet Beta would be deprecated and shut down in 2026**, and told users to move their funds off it. Several signs point to the chain itself being frozen:

- Three different RPC providers return the same frozen block height.
- Balances never change.
- Transactions never get included.

If that's right, the Q3 batch-payout plan should not be built on zkEVM at all. The urgent work is getting the ~$400k of merchant balances out, not cutting gas costs.

(There is no code in this repo, only the task description. So everything below is a plan for how to check this and what to do, not a finding from reading PayoutVault's source. Confirm the sunset status and dates in Polygon's official announcements and docs before acting. Don't rely on my summary of them.)

---

## 1. What ops should look at (in this order)

Stop swapping RPC providers. Two swaps that both show the same frozen height already tell you the problem is upstream of the RPC.

1. **Check the chain itself, not your node.**
   - Open the public zkEVM explorer and Polygon's status page. Compare the latest block and its timestamp with what your dashboard shows. If the explorer is also stuck around the start of the month, the network is halted.
   - Run `eth_blockNumber` and `eth_getBlockByNumber("latest")` against a couple of public endpoints. Look at the block **timestamp**, not only the number.
2. **Check the L1 side on Ethereum mainnet. This is the source of truth for your funds.**
   - Find the zkEVM rollup's entry in Polygon's rollup manager / bridge contracts on Etherscan. Get the addresses from Polygon's docs.
   - Look at when the last batch was **sequenced** and when the last batch was **verified** (proven) on L1. The last verified state is what can be withdrawn from. Anything after it is not final.
   - Note the exact last-verified batch and the L2 block it corresponds to. You'll need it for the money section below.
3. **Read Polygon's official comms.** Check the Polygon blog, docs, forum and governance posts, and their X account for the zkEVM deprecation/sunset timeline. Look for anything about a final shutdown date, a withdrawal-only window, and how to exit after sequencing stops.
4. **Only if the chain turns out to be live:** then look at the local causes:
   - a dashboard indexer stuck on a cached block or a dead websocket subscription
   - a hard-coded RPC URL in some other service
   - a nonce gap on the payout signer (one stuck low-nonce tx blocks every later one)
   - the signer being out of gas (ETH on zkEVM)
   - a paused vault.

   Given the symptoms, I'd bet strongly against these.
5. **Inventory the in-flight payouts now.** For every payout that "never confirmed", record the tx hash, signer, nonce, merchant and amount. Treat all of them as **not paid**. But they may still sit in some mempool or sequencer queue and could execute if the chain ever comes back. This matters a lot for step 3 of the money plan below.

## 2. What this means for the merchant money (~$400k)

The balances live in PayoutVault's storage on L2. They only leave through two routes:

- a transaction executing on zkEVM (a payout or a bridge withdrawal), or
- an L1 escape path against the last *verified* state.

If the sequencer has stopped, neither of your normal paths works. Treat this as an incident, not a ticket.

1. **Freeze the ledger.** Take a per-merchant balance snapshot at the last L1-verified L2 block (see 1.2). Reconcile it against your internal off-chain ledger. From now on, that reconciled snapshot is what you owe merchants.
2. **Find out what exit path exists, and get it in writing.** Contact Polygon Labs directly (support, and BD if you have a contact) with your vault address and the balance at stake. Ask:
   - Is there a withdrawal window or a restart for exits?
   - Does the zkEVM **forced-batch / escape-hatch** mechanism on L1 work for your case? Historically it was restricted on zkEVM, and it only helps if the forced transactions still get proven.
   - Are tokens already bridged out and verified on L1 still claimable through the unified bridge?

   Note: funds sitting *inside your contract* can only reach L1 through a transaction that PayoutVault permits, such as an admin withdraw or sweep to the bridge. Check that the vault actually has such a function and who holds the key. If it doesn't, say so plainly to Polygon and to your leadership.
3. **Prevent double payment.** If you repay merchants from treasury on another chain (next point), any stuck zkEVM payout that later executes pays those merchants a second time. Mitigations:
   - Keep the signer keys safe.
   - If the chain resumes even briefly, the **first** actions should be:
     - pause PayoutVault, or
     - send replacement transactions from the payout signer at the stuck nonces (e.g. 0-value self-transfers) to cancel the queued payouts,
     - then sweep the vault to the bridge.

   Prepare those transactions in advance.
4. **Decide whether to make merchants whole now.** The business question is whether you fund the owed balances from treasury on a live chain now and take on the recovery risk yourself, or tell merchants their funds are delayed. From a merchant-trust point of view, paying from treasury against the frozen snapshot is usually the right call if you can afford ~$400k of float. Loop in legal and finance, because this is customer money.
5. **Communicate.** Tell merchants that payouts are paused because of an upstream network shutdown, that their balances are recorded, and when they'll hear more. Don't let them find out from the explorer.
6. **Post-mortem item.** Deploying customer funds in March 2025 on a network explicitly labelled "Mainnet **Beta**" was a risk. The June 2025 deprecation announcement should have triggered a migration then. Add chain-health and vendor-deprecation monitoring (block-age alerts, L1 verification lag, a watch on the chain's official announcements) to whatever chain you pick next.

## 3. Q3 build plan: batch payouts and lower per-payout cost

**Reality check:** Q3 ends on 30 Sept, nine days from today. The realistic Q3 goals are recovering and migrating the funds and getting payouts running again on a live chain. Batch payouts can ship in the first weeks of Q4 on top of that. **Do not build or deploy anything new on zkEVM.**

### Step 1: pick the new chain (this week)
Pick an established, actively maintained network with deep native USDC (Circle-issued, not bridged) and the stablecoins your merchants use. Candidates: Base, Arbitrum One, OP Mainnet, or Polygon PoS if you want to stay in the Polygon ecosystem.

Criteria:
- native stablecoin liquidity
- the chain's rollup maturity / "stage" on L2BEAT (forced-inclusion or escape-hatch guarantees)
- a documented deprecation policy
- fees
- off-ramp support for your merchants

### Step 2: PayoutVault v2 (days 1–7, in parallel with recovery)
Design lessons from this incident:

- **An emergency exit.** An admin `sweep(token, to)` behind a multisig and timelock, plus `pause()` that is separate from routine operations, so funds can always be moved if the chain is being wound down.
- **Idempotent payouts.** Each payout carries a unique `payoutId`, and the contract rejects any `payoutId` it has already processed. Retries, and stuck transactions that land later, can then never double-pay.
- **A multisig owner** (e.g. a Safe). Keep a separate hot key that can only submit payouts, capped per call and per day.

### Step 3: batch payouts (up to 200 merchants per transaction)
There are two viable designs. Choose based on who should pay the gas.

**A. Push batch (you pay, merchants receive automatically)**
- `batchPayout(PayoutItem[] items)` where each item is `{payoutId, merchant, token, amount}`. The function checks that each `payoutId` is unused, then does a `transfer` for each item.
- Cost: roughly 30–55k gas per ERC-20 transfer, depending on whether the recipient's balance slot is already non-zero, plus about 21k base per transaction. 200 recipients ≈ 7–11M gas, which fits within block limits on major L2s. Measure this on your target chain and settle on a safe maximum batch size, e.g. 150–200.
- Savings come from amortizing the 21k base cost and the L1 data cost across 200 payouts. Pack calldata tightly: use `uint96` amounts and a merchant index instead of 20-byte addresses if you keep an on-chain registry.
- Failure isolation: one blocked recipient (e.g. a USDC-blacklisted address) must not revert the whole batch. Use a `try`/low-level call per item, record failures in an event, and credit a pull balance instead.
- Tests:
  - gas snapshot at 1, 50 and 200 recipients
  - duplicate `payoutId` rejected
  - a blacklisted recipient doesn't revert the batch
  - reentrancy on non-standard tokens
  - a fuzz check that the sum of the amounts equals the vault's balance change

**B. Merkle claim (cheapest for you)**
- For each settlement cycle, post one Merkle root of `(merchant, amount, cycleId)`. That is a single ~50–70k gas transaction whether there are 200 merchants or 20,000. Each merchant then claims with a proof, or a relayer claims for them.
- Per-payout cost to you is close to zero, but merchants have to take an action, or you pay for the claims through a relayer. That works well for long-tail or small merchants.

**Recommendation:** use A for the regular settlement run, since merchants expect funds to arrive without doing anything. Keep B in reserve if merchant count or frequency grows beyond what push batches handle cheaply.

### Step 4: the rest of the per-payout cost
- Settle less often: one batch per cycle instead of one transaction per payout.
- On a rollup, most of the fee is L1 data. Smaller calldata (packed items, merchant indexes) and chains with blob-based data posting matter more than execution-side gas tweaks.
- Keep a small, monitored gas balance on the payout key, and alert on block age and L1 settlement lag, which is the monitoring you were missing this month.

### Suggested timeline
| When | What |
|---|---|
| This week | Confirm the zkEVM status (section 1), freeze the ledger, contact Polygon, prepare the cancel/sweep transactions, communicate with merchants |
| By 30 Sept | Choose the new chain; deploy and test Vault v2 (sweep, pause, `payoutId` idempotency); treasury-funded or recovered balances available on the new chain; single payouts working again |
| Oct, weeks 1–3 | Batch payouts (design A), gas benchmarks, external review/audit of the vault changes, staged rollout (10 → 50 → 200 recipients) |
| Oct onward | Merkle claim (B) if needed; chain-health and deprecation monitoring |

## Bottom line for the merchant money
The ~$400k is most likely not lost, but it is **stuck** until you use an L1 exit path that Polygon supports. Your payout pipeline can't move it right now, and no RPC change will fix that. Protect it this way:

- Snapshot and reconcile the balances.
- Get Polygon's exit path in writing.
- Make sure stuck payouts can't double-pay.
- Decide quickly whether to make merchants whole from treasury.

Then rebuild on a live chain with an emergency-exit function, idempotent payout IDs and batch settlement, so the next deprecation isn't another incident.
