# PayoutVault on Polygon zkEVM: stuck dashboard, the Q3 plan, and the merchant money

## TL;DR

**Polygon zkEVM no longer exists as a working chain.** Polygon shut it down. The sequencer was
switched off on **July 1–3, 2026**, and the chain has produced no blocks since. Bridge withdrawals
through the Agglayer bridge stopped at the same time. The dashboard isn't broken and neither are
the RPC providers. The chain itself is frozen.

- **Dashboard:** there's nothing to fix. A frozen block number, balances that never change and
  payouts that never confirm are exactly what a chain with no sequencer looks like. Changing RPC
  providers or API keys can't help, because every provider serves the same frozen final state.
- **The ~$400k:** it's held **inside a smart contract** (PayoutVault). Polygon's recovery process
  covers wallet-held (EOA) balances only. Polygon says plainly that assets held inside smart
  contracts at sunset (DeFi positions, **multisigs**, other contracts) **cannot be recovered
  through the Claims interface**. Right now there's no known on-chain path to that money. Treat
  it as an incident starting today.
- **Q3 plan:** don't build anything more on zkEVM. Q3 ends Sept 30, nine days from now. Spend
  what's left of Q3 on recovering the funds and choosing a new chain. Move batch payouts to Q4
  on the new chain.

Also note the timeline: the chain stopped in early July, but ops noticed "at the start of the
month" (September). That's a monitoring failure too. See item 4 under Part 2.

---

## Part 1: What to look at (the "stuck dashboard")

Stop debugging the RPC layer. Check these instead:

1. **Confirm the chain is halted.** Look at the latest block timestamp from any zkEVM RPC or
   explorer. It should date from around July 1–3, 2026. Polygon's sunset page:
   https://polygon.technology/polygon-zkevm
2. **Check how long the dashboard has been wrong.** It likely didn't really start this month.
   Find the last block it indexed and compare against your internal ledger. Were balances shown
   to merchants, or payouts marked "submitted", after July 3? Every payout submitted since the
   halt went nowhere. Find out whether any of them were treated as paid internally, sent to
   merchants as receipts, or offset against other payments.
3. **Get the exact frozen state of PayoutVault at the final block.** The chain's final state
   still exists and a read-only RPC still serves it. Record:
   - the vault's token balances (which tokens: USDC.e/bridged USDC, USDT, ETH, etc.)
   - every merchant's balance inside the vault (the per-merchant mapping)
   - the owner/admin/role addresses on the vault, and whether each is an EOA or a multisig
   - the block number, the state root, and ideally storage proofs for these values

   This snapshot is the evidence for any recovery request, and it's the ledger you'll use to
   pay merchants back. Store it somewhere permanent.
4. **Check your own EOAs on zkEVM.** Did the hot wallet, the fee payer or an admin EOA hold any
   tokens at sunset? Those balances **can** be claimed at https://zkevm-claims.polygon.technology
   until **December 31, 2027**. Claim them early.
5. **Check your pending payout queue.** Stop the service that keeps submitting transactions to
   zkEVM. It's burning ops time, and it may be marking payouts as "pending" when they will never
   land.

## Part 2: What this means for the merchant money

### Where the $400k stands

- The tokens are still recorded in PayoutVault's storage in the chain's final state. **No one
  can move them.** No blocks are being produced, so no transaction can execute: not a merchant
  withdrawal, not an admin sweep, nothing.
- **Polygon's Claims interface won't cover them**, because they're held by a contract rather
  than a wallet. Polygon's guidance is that users with funds in a contract should go to "the
  protocol or contract operator". **For PayoutVault, that operator is you.** Merchants will be
  coming to you.
- **Your debt to merchants hasn't changed.** Whether or not the chain works, you owe them their
  balances. Legally and commercially this is a $400k liability, now backed by an asset that may
  never be recovered.

### Do this now (this week)

1. **Open an incident and escalate to leadership, finance and legal today.** This is a treasury
   event and a customer-funds event. It isn't an ops ticket.
2. **Contact Polygon Labs directly** (https://support.polygon.technology, plus any BD or
   partnership contact you have). Give them the vault address, the final-state balances and
   proof that you control the admin keys. Ask whether they have, or will create, a path for
   contract-held funds, e.g. a claim tied to the contract's owner or deployer, or a manual
   process for protocol operators. Nothing public promises this, so don't count on it. But
   Polygon controls the exit-certificate process, and a documented, operator-controlled payout
   contract is the strongest case you can make. Ask soon: the claims program ends Dec 31, 2027,
   and you want to be heard while the team is still engaged.
3. **Contact the token issuers** if the vault held bridged stablecoins. Tell them what happened
   and ask whether they offer any remediation for tokens stranded on a sunset chain. It's a long
   shot, but it costs nothing to ask.
4. **Tell merchants before they find out elsewhere.** Say that their balances are recorded and
   owed, that you're paying them out from another source, and give a date. Base each merchant's
   amount on the final-state snapshot, reconciled against your off-chain ledger.
5. **Plan to pay merchants from company funds on the new chain** or through fiat rails. Book any
   later recovery from Polygon as a reimbursement to the company. Don't make merchants wait on
   a recovery that may never come.
6. **Check your compliance and legal duties.** Depending on your licensing (money transmission,
   e-money, custody), stranded customer funds may trigger reporting or safeguarding
   requirements. Legal needs to answer this this week.

### Why it happened, and the lessons to carry forward

Polygon announced the sunset in mid-2025, a few months after PayoutVault launched. It gave about
a year of notice and sent repeated "withdraw before July 1, 2026" reminders. Three separate
safeguards failed:

- **No one watched the chain's deprecation notices.** Any chain you hold customer funds on needs
  an owner who follows the chain's announcements and L2Beat risk and status pages.
- **The vault had no exit plan.** Funds sat in a contract with no process to move them out ahead
  of a known shutdown.
- **No monitoring of whether the chain was alive.** A simple "latest block is more than N
  minutes old" alert would have fired on July 3. Instead the problem surfaced about two months
  later.

---

## Part 3: Q3 build plan (batch payouts and cheaper payouts), rewritten

The original plan assumed zkEVM, and that's no longer possible. Q3 ends Sept 30. Here's a
realistic plan:

### Rest of Q3 (now to Sept 30): recovery and decisions

- Everything in Part 2: incident, final-state snapshot, contacting Polygon, telling merchants,
  paying merchants back.
- **Choose the new chain.** Criteria:
  - **Native USDC** (Circle-issued, not bridged) and deep liquidity or off-ramps for merchants
  - **Mature and not being wound down**; check the chain's risk and stage rating on L2Beat
  - Fees low and steady enough that a 200-merchant batch costs very little
  - Good infrastructure: several RPC providers, indexers, account abstraction or paymasters if
    you sponsor gas

  Good candidates: **Base, Arbitrum One, OP Mainnet, Polygon PoS**. All have native USDC and are
  actively developed. Pick one main chain. Keep the contracts chain-agnostic so a second chain is
  a redeploy rather than a rewrite.
- Make the decision and write it down, including who owns watching this chain's health and
  deprecation notices.

### Q4: batch payouts on the new chain

**Contract design (a new PayoutVault v2):**

1. **Batch push payouts:** `payoutBatch(address[] merchants, uint256[] amounts)` settles up to
   200 merchants in one transaction.
   - Each ERC-20 transfer costs about 30–55k gas (more for a recipient seen for the first time).
     200 of them is about 6–11M gas. That fits in one transaction on the L2s above, but test it
     against the chosen chain's block and transaction gas limits.
   - Pack the input (e.g. 20-byte address + a uint96 amount per payout, in one `bytes` blob) to
     cut calldata, which is the main cost on a rollup.
   - Decide how a single failed transfer affects the batch (e.g. a blocklisted USDC recipient).
     Either skip it and emit an event, or revert the whole batch. Skip-and-log is usually the
     better choice for payouts.
   - Emit one event per payout so the indexer can reconcile the batch.
2. **Alternative or complement: Merkle "pull" claims.** Post one Merkle root per payout cycle,
   and merchants (or a relayer) claim against it. This costs the operator almost nothing per
   merchant and scales past 200. It fits well if merchants can claim on their own or you sponsor
   their gas through a paymaster.
3. **Hold less money in the contract.** Settle each cycle and push funds out to merchants'
   own addresses, so the vault holds only the current cycle's float. Had merchants held their
   balances in their own wallets on zkEVM, they could have recovered them through Polygon's
   Claims interface.
4. **An operator exit path:** an admin function (behind a multisig and a timelock) that moves all
   vault funds to a pre-set L1 or treasury address. It's needed for chain migrations and
   emergencies. A clear migration runbook is part of this.

**Getting the per-payout cost down:**

- Batching spreads the base transaction cost (21k gas plus fixed overhead) across up to 200
  payouts. That's most of the savings.
- Use packed calldata instead of ABI-encoded arrays. Since EIP-4844, L2 fees mostly track the
  amount of data posted.
- Keep storage writes warm and avoid unneeded SSTOREs. Don't record each payout in storage when
  an event will do.
- Schedule batches for times when the chain is cheaper if the chain's fee pattern allows it.
- On a mainstream L2, a 200-merchant batch should cost somewhere between cents and a few dollars
  in total, depending on L1 blob prices. Measure it on a testnet or fork before promising a
  number.

**Operations (required, not optional):**

- **Chain liveness alerts:** alert when the latest block is more than X minutes old, when a
  submitted transaction isn't included within Y minutes, and when RPC providers disagree on the
  latest block.
- **Daily reconciliation:** on-chain vault balance vs. internal ledger vs. dashboard. Alert on
  any drift, including "no change at all for 24h", which should have fired here.
- **Chain risk owner:** a named person who follows the chain's announcements and reviews the
  chain's risk every quarter.
- Audit the v2 contract before it holds merchant funds.

---

## Summary for leadership

| Item | Status |
|---|---|
| Dashboard "stuck" | Not a bug. Polygon zkEVM was shut down on July 1–3, 2026 and makes no new blocks |
| ~$400k in PayoutVault | Stuck in a contract on a dead chain; **not covered** by Polygon's Claims interface (wallets only) |
| Your company EOAs on zkEVM | Claimable at zkevm-claims.polygon.technology until Dec 31, 2027 |
| Merchant liability | Still $400k and owed in full; plan to pay from company funds, pursue recovery separately |
| Q3 batch-payout plan | Can't be done on zkEVM; spend Q3 on recovery and choosing a chain, build batch payouts in Q4 |

Sources:
- [Polygon zkEVM Mainnet Beta Sunset & Fund Claims (official)](https://polygon.technology/polygon-zkevm)
- [QuickSwap sunset reminder (July 1, 2026 deadline)](https://x.com/QuickswapDEX/status/2066515050932715648)
- [Bitget: Polygon zkEVM to cease operations July 1](https://www.bitget.com/news/detail/12560605460859)
- [The Crypto Times: Polygon shuts down zkEVM on July 1](https://www.cryptotimes.io/2026/07/01/polygon-shuts-down-its-once-flagship-250m-zkevm-on-july-1/)
- [PancakeSwap: Sunsetting support on Polygon zkEVM](https://blog.pancakeswap.finance/articles/PolygonzkEVMSunset)
