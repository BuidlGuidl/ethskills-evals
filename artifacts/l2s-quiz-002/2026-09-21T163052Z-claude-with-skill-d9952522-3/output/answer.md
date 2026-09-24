# PayoutVault on Polygon zkEVM: what's happening and what to do

## Short version

**Polygon zkEVM has been shut down.** Polygon sunset the zkEVM Mainnet Beta, and the sequencer stopped producing blocks around **2026-07-01**. Since then the chain produces no new blocks and submitted transactions never confirm. AggLayer bridge withdrawals are no longer processed. RPC nodes still answer reads, but they return the **frozen final state**.

That matches everything ops is seeing:

| Symptom | Cause |
| --- | --- |
| Balances read the same numbers every day | The state is frozen. No transaction can change it. |
| The displayed block number doesn't move | No new blocks are being produced. |
| Submitted payouts never confirm | No sequencer is including transactions. |
| Swapping RPC providers didn't help | Every provider serves the same halted chain. |

This isn't an RPC, API key or dashboard problem. Nothing ops changes on our side will fix it.

That changes both items on your list:

1. **The dashboard issue** is really a fund-recovery incident, not an outage.
2. **The Q3 batch-payout plan can't be built on Polygon zkEVM.** It has to go on a different, live chain.

---

## 1. The "stuck dashboard": what to look at

### Confirm it (about 30 minutes)

- **Check the latest block's timestamp, not just its number.** Call `eth_getBlockByNumber("latest")` against two or three independent RPCs and the public explorer. If they all agree on the same last block with a timestamp around early July 2026, that settles it.
- **Read Polygon's own zkEVM sunset notice and docs.** Get the official shutdown date, the snapshot block, and the claims process and deadline from there, not from this memo or from memory. These details are dated, and the deadline matters.
- **Resolve the timing gap.** Ops says the dashboard has been stuck "since the start of the month" (September), but the chain stopped around July 1. Either nobody noticed for about two months (for example, low volume, or a dashboard that only alerts on RPC errors), or ops has the date wrong. Find out which, because it affects the next step.

### Stop the bleeding (today)

- **Stop submitting payouts to zkEVM.** Turn off the payout job and any retry loop. Nothing will confirm, and a pile of pending transactions confuses reconciliation.
- **List every payout we submitted after the last real block.** For each one, record the tx hash, merchant, amount and nonce. **None of them happened.** If our internal ledger or the merchant-facing UI marked any as "sent" or "paid", those records are wrong and need correcting.
- **Treat the $400,000 figure as a frozen snapshot.** It's the vault's state at the last block, not a live balance. Use it as the starting point for reconciliation, not as proof the money is reachable.

### Fix monitoring so this can't go unnoticed again

- Alert when the chain head is stale, e.g. when the latest block's timestamp is more than N minutes old. A dead chain still returns HTTP 200, so error-rate alerts never fire.
- Alert on how long submitted transactions have been pending, not just on errors.
- Subscribe to announcements from every chain we hold money on. This shutdown was announced publicly well in advance.

---

## 2. What this means for the merchant money

This is the important part.

- **The roughly $400,000 sits inside a contract, and that's the hard case.** Polygon's sunset snapshot and claims interface are built for **wallet-held balances** (EOAs). A balance held inside a contract like PayoutVault has **no routine exit**. Its withdraw and payout functions can't run, because the chain no longer executes transactions. The bridge won't process a withdrawal either, even if we could start one.
- **We still owe merchants the money.** The chain shutting down doesn't cancel what we owe them. Legally and commercially, the $400k is still merchant money we have to pay.

What to do, in order:

1. **Open a recovery case with Polygon now.** Before any claims deadline, send them the vault address, the token(s) and amounts at the final state, the per-merchant breakdown, and proof we control the vault's owner/admin keys. Ask directly whether and how contract-held balances are covered by the snapshot/claims process, or by a separate arrangement. Don't assume either answer. Get it in writing.
2. **Reconstruct per-merchant balances from the final state.** Use the vault's storage and events up to the last block, and cross-check them against our internal ledger. That gives us the definitive list of what each merchant is owed, whatever recovery path we end up with.
3. **Check how the vault's tokens were bridged.** Bridged USDC, native USDC or something else changes who can make holders whole. Include it in the Polygon case, and contact the token issuer too if relevant.
4. **Decide, as a business, whether to pay merchants from our own treasury on the new chain while recovery runs.** Recovery could be slow, partial or unavailable. This is a finance and legal decision, but it's what merchants will judge us on. Get legal and finance involved this week.
5. **Tell merchants honestly and soon.** Tell them the chain was shut down, their balances are recorded, and payouts are paused. Tell them what we're doing and when they'll hear from us next. Don't promise a recovery date we don't control.

Worth taking forward: we deployed in March 2025 onto a chain labelled "Mainnet Beta" and held merchant funds there. Before holding customer money on any chain, check that it is live and supported, how mature it is, and how funds exit it. Recheck all of that every quarter, not only at launch.

---

## 3. Q3 build plan: batch payouts and lower per-payout cost

### Be realistic about "this quarter"

Today is 2026-09-21, so Q3 has **nine days left**. A new payout contract that holds merchant money must not go to mainnet unaudited in nine days. Realistic Q3 deliverables:

- the incident response above, completed
- a target chain chosen and confirmed live
- the batch-payout contract specified, written and tested on testnet
- an audit booked

Launch with real funds early in Q4, after the audit.

### Step 1: Choose the chain (by what actually constrains us)

Polygon zkEVM is out. Pick based on what a payout product needs, then **confirm the chain is live and the features we rely on are on its mainnet** before committing. Chains and features have both been shut down or delayed within the last year.

| If this matters most… | Look at |
| --- | --- |
| Native USDC, a direct fiat on-ramp, where merchants already are | **Base** (chain id 8453; still an Ethereum L2, now on its own Base Stack rather than the OP Stack) |
| Merchants and recipients who hold no gas token; mobile payments | **Celo** (an Ethereum L2 since March 2025). Gas can be paid in USDC/USDT/Mento stablecoins through the fee-currency field (CIP-64), with no paymaster or bundler needed. |
| Fast exit to Ethereum L1 without a multi-day wait | A ZK rollup: **zkSync Era, Scroll, Linea** |

**My recommendation: Base.** It has native USDC, the most straightforward on- and off-ramping for merchants, and it deploys like mainnet (standard `solc`, same bytecode). If our merchants are mostly mobile or emerging-market recipients who won't hold ETH, look seriously at Celo.

The trade-off of an optimistic rollup like Base: exiting treasury funds to L1 through the canonical bridge takes about a week. It's three transactions: initiate on L2, then prove on L1, then finalize on L1 after the challenge window. Plan treasury rebalancing around that, or use a fast bridge and name the extra trust assumption that comes with it.

### Step 2: Design the batch contract

**Push batches (what merchants asked for).** `payoutBatch(batchId, recipients[], amounts[])` settles up to 200 merchants in one transaction.

- **Isolate failures.** A single USDC-blacklisted address or a reverting recipient must not revert the other 199 payouts. Wrap each transfer (e.g. a low-level call or `try/catch`). If one fails, credit that amount to a claimable internal balance and emit an event, rather than reverting the batch.
- **Make batches idempotent.** Record each `batchId` as used, so a retried or resubmitted batch can't pay twice. This matters more after this incident, where we have transactions that were submitted but never confirmed.
- **Add an invariant check.** Total paid plus total credited must equal the batch total, and the vault's balance must cover it.
- **Measure the gas limit, don't guess it.** 200 ERC-20 transfers is several million gas. Measure the worst case (first-time recipients whose token balance slots are cold and zero) against the target chain's block gas limit, and cap the batch size to fit with margin.
- **Access control:** a payout role on a multisig or a hot key with a spending cap, separate from the admin/upgrade role. Add a pause function.
- **Keep an admin escape hatch that works while the chain is live.** An owner-only `emergencyWithdraw` to a pre-committed treasury address, behind a timelock, lets us pull funds out ourselves if we ever get advance warning of another shutdown.
- **Use `block.timestamp` for any time logic, not `block.number`.** Block rates differ per L2.

**Pull or Merkle claims (an option for the biggest cost cut).** Post a single Merkle root per settlement period, and merchants (or a relayer we run) claim against it. Settling costs almost nothing no matter how many merchants there are, and the per-merchant cost moves to claim time and can be paid in batches. This is a good fit for small, frequent payouts. It can coexist with push batches.

### Step 3: Reduce the per-payout cost

On an L2 the bill has two parts: L2 execution gas, and the L1 data fee for posting our calldata to Ethereum. Both scale with how much each payout costs us.

1. **Batching itself.** It spreads the roughly 21k base transaction cost and the per-transaction overhead across up to 200 payouts. This is the biggest single win.
2. **Shrink the calldata.** Replace 20-byte addresses with a registered `merchantId` (uint32), and pack id + amount into a single `uint256` word per payout. This directly cuts the L1 data component.
3. **Keep recipient storage warm where possible.** Transfers to addresses holding a zero token balance cost the most. Internal-ledger designs (credit a balance in the vault, and let the merchant withdraw when they choose) avoid a token transfer on every payout.
4. **Emit events, not storage.** Keep the per-payout audit trail in events and write only the essential state.
5. **Measure it.** Benchmark cost per payout on the target chain's testnet at batch sizes 1/50/100/200, then read live gas and blob prices before quoting a number to anyone. Fee levels change too fast to hard-code.

### Step 4: Protect against the next chain failure

- Deploy with CREATE2 through a known factory, so the vault can be redeployed at the same address on another chain if we ever need to.
- Treat the payout ledger as ours, and the chain as a settlement layer we might have to replace. Keep per-merchant balances reconstructable off-chain at all times.
- Add stale-head monitoring and pending-age monitoring (from §1), plus a quarterly review of each chain's status.

---

## Actions this week

| Owner | Action |
| --- | --- |
| Eng | Confirm the halt: last block timestamp from independent RPCs plus Polygon's sunset docs. Stop payout jobs. |
| Eng / Finance | Snapshot per-merchant balances from the final state. Reconcile against our ledger. List the unconfirmed payouts. |
| Leadership | Open a recovery case with Polygon about contract-held funds before any claims deadline. Loop in legal. |
| Finance / Legal | Decide whether to pay merchants from treasury while recovery is pending. |
| Comms | Notify merchants. |
| Eng | Pick the chain (Base recommended), confirm it's live, spec and build the batch contract on testnet, book an audit. Mainnet in early Q4. |
