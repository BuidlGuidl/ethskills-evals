# PayoutVault on Polygon zkEVM: stuck dashboard, the Q3 plan, and the merchant money

## The short version

The dashboard is probably not broken. **The chain itself has most likely stopped.**
In June 2025, three months after PayoutVault launched, Polygon Labs announced that
**Polygon zkEVM Mainnet Beta would be deprecated and shut down during 2026**. What ops
is seeing matches a halted sequencer exactly:

- The block number doesn't move because no new L2 blocks are being produced.
- Balances read the same every day because the state is frozen at the last block.
  Every RPC provider serves that same last state, which is why switching providers
  changed nothing.
- Submitted payouts never confirm because there is no sequencer to include them.
  The RPC may still accept them, but they will never be mined.

Rotating RPCs and API keys can't fix this. The only fix is getting off this chain.

That makes both of this week's items the same problem. **About $400k of merchant
money is sitting in a contract on a chain that no longer processes transactions.**
Recovering it is the top priority, ahead of the Q3 feature work.

> I'm confident about the June 2025 deprecation announcement. I don't have reliable
> details on the final shutdown date or on any exit or escape-hatch process Polygon
> published afterward. Confirm those from Polygon's official channels (blog, docs,
> status page, Discord or support) today. Don't rely on my summary or on your RPC vendors.

---

## 1. What to check (in order, mostly today)

**A. Confirm it's the chain and not your stack (about 15 minutes)**
1. Call `eth_blockNumber` and `eth_getBlockByNumber("latest")` on 2–3 unrelated
   endpoints, including Polygon's public RPC. Compare with the zkEVM block explorer.
   If they all show the same block, with a timestamp around the start of the month,
   the chain has halted.
2. Take one of your "pending" payout hashes and call `eth_getTransactionByHash` and
   `eth_getTransactionReceipt`. If the tx exists but has no receipt and the latest
   block never advances, that confirms it. Stop resubmitting. Stuck duplicates only
   create reconciliation work later.
3. Check Polygon's official announcements and status page for the zkEVM sunset
   timeline, and whether the chain has formally reached end of life.

**B. Check the source of truth on Ethereum L1**
zkEVM settles to Ethereum, so L1 shows what state is final and what exit paths remain:
4. On the Polygon rollup manager contract on Ethereum, find the zkEVM rollup's
   **last sequenced batch and last verified batch**, and when each was last updated.
   The verified batch shows which L2 state has been proven on L1. Any balance changes
   after that point are not final.
5. On the LxLy bridge contract on Ethereum, look for recent `ClaimEvent`/`BridgeEvent`
   activity from zkEVM and for any emergency-state changes. This tells you whether
   L2→L1 withdrawals are still being honoured.
6. Check whether any **forced-batch or escape-hatch** mechanism is enabled for zkEVM
   (a way to get an L2 transaction included through L1 without the sequencer). This
   is the difference between recovering the vault ourselves and depending entirely
   on Polygon.

**C. Inventory what's actually in the vault**
7. Record exactly which assets PayoutVault holds, as of the last verified state:
   - Is it LxLy-bridged USDC (USDC.e), native USDC, or something else?
   - Where is each asset's backing held? Assets bridged from Ethereum are backed by
     tokens locked in the L1 bridge. Anything minted natively on zkEVM may have no
     L1 backing at all.
8. Review the PayoutVault code for owner or admin withdraw paths, pause functions,
   and upgradeability. **A contract can't sign a withdrawal or claim an escape hatch
   on its own.** Any exit Polygon provides for EOAs (for example, proofs against a
   final state snapshot) may not work for a contract's balances unless the vault
   has a function that can be called to move the funds. Also confirm who holds the
   admin keys.

**D. Fix the dashboard's honesty now**
9. Add a staleness check: if `now − latestBlock.timestamp` exceeds a few minutes,
   show "CHAIN HALTED / DATA STALE" instead of balances. For weeks it has shown
   frozen numbers as if they were live. Also alert on "submitted but unconfirmed for
   more than N minutes". Ops lost weeks because nothing distinguished a dead chain
   from a quiet one.

---

## 2. The Q3 plan: batch payouts and lower cost per payout

**Don't build it on Polygon zkEVM.** Q3 ends on 30 September, 9 days from now, and
the target chain isn't running. The Q3 plan should be **migrate first, then batch
on the new chain**. Batching can mostly be built in parallel and ship with the
migration.

**Step 1: Choose a new chain (this week).**
Pick a live, well-supported chain where your stablecoin exists natively (native USDC
from Circle, not a bridged wrapper) and your off-ramps and merchants already operate.
Reasonable options:
- **An Ethereum L2 with a long track record:** Base, Arbitrum One or OP Mainnet.
- **Polygon PoS**, if you want to stay in the Polygon ecosystem. It's a different
  chain from zkEVM and has native USDC.

Check the chain's L2BEAT risk profile, how long its withdrawal window is, and its
history of outages. Avoid reusing a zkEVM-style "beta" chain for the same product.

**Step 2: Redesign PayoutVault (roughly 1–2 weeks of build).**
- **Batch payouts.** Add `payoutBatch(address[] recipients, uint256[] amounts,
  bytes32 batchId)`, capped at 200 recipients:
  - Pass the data as calldata. Check `recipients.length == amounts.length` and that
    the sum doesn't exceed the available balance.
  - Emit a single event per batch (plus per-recipient events if your accounting
    needs them), and use `batchId` for idempotency so a resubmission can't pay twice.
  - Cost estimate: an ERC-20 transfer to a new holder costs about 30–55k gas, so
    200 recipients ≈ 6–11M gas. That fits comfortably under L2 block limits.
- **Decide how a failing recipient is handled.** A reverting or blocklisted address
  (USDC has a blocklist) must not revert the whole batch. Either catch the failure
  and credit that merchant's internal balance, or use a pull model.
- **Consider a pull model for scale.** Post one Merkle root per payout cycle and let
  merchants `claim()` their share, or let a relayer claim for them. Your posting
  cost becomes constant no matter how many merchants there are. This is the
  cheapest design at hundreds of merchants.
- **Build in the exit paths we're missing today:**
  - An owner `emergencyWithdraw` behind a multisig and timelock.
  - A pause function.
  - If you make it upgradeable, keep the upgrade authority on a multisig.
  - Hold only a working float on-chain, not the whole merchant book.
- Get an external review or audit of the new vault before it holds meaningful money.

**Step 3: Understand cost per payout.**
Since EIP-4844, most L2 cost is the L1 data fee, and it's small. On a mainstream L2,
a single transfer typically costs fractions of a cent to a few cents. Batching
spreads the fixed transaction overhead across 200 payouts, and the Merkle-claim
model cuts it further. Measure it: run 1, 50 and 200-recipient batches on the new
chain's testnet and record cost per payout. Don't assume a figure.

**Step 4: Cut over.**
- Run the old and new systems' reconciliation in parallel.
- Migrate merchant ledgers from your off-chain records. Don't rely on frozen zkEVM
  reads that may not be final.
- Fund the new vault and switch the dashboard with the new staleness monitoring.
- Add a **chain-risk watch** to ops: sequencer or blocks-produced alerts, and a
  subscription to the chain's governance and deprecation announcements. The zkEVM
  sunset was announced publicly more than a year ago and nobody here acted on it.

---

## 3. What this means for the merchant money

1. **Stop all new deposits and payouts to PayoutVault on zkEVM right now.** Treat
   the pending payouts as not sent.
2. **The $400k is at risk, not necessarily lost.** How much you recover depends on:
   - what state is **verified on L1**
   - which assets are held, and whether they're backed on L1
   - whether an exit path exists that a **contract** can use, through its admin
     functions, a forced batch, or a Polygon-run migration or claim process
3. **Contact Polygon Labs directly today.** Name the contract address, the amount
   and the assets, and ask specifically how contract-held balances get out. Treat
   any published deadline as hard.
4. **Your obligation to merchants hasn't changed.** They're owed $400k whether or
   not the chain runs. Decide with finance and legal:
   - whether to pay merchants from treasury on the new chain now and recover the
     zkEVM funds later, which protects the merchant relationship
   - whether to hold payouts until recovery, which is cheaper but riskier
   - which legal, contractual or regulatory notification duties apply to a payout
     delay of this length
5. **Reconcile from your off-chain ledger.** Anything submitted after the last
   verified L1 batch must be treated as not having happened.
6. **Tell merchants proactively.** Say payouts are delayed because of an
   infrastructure (chain) shutdown, give an ETA, and state that their balances are
   recorded and owed.

**Bottom line:** the "stuck dashboard" is a dead chain holding $400k of other
people's money. This week: confirm the halt, work the exit with Polygon, and freeze
the zkEVM vault. The Q3 plan becomes a migration to a live chain with a batch-capable
vault that has a withdrawal path.
