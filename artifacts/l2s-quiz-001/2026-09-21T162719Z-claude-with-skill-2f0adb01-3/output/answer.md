# Runbook: Monthly CELO sweep, Celo → Ethereum mainnet treasury

## 0. What you're working with

- **Celo is no longer an L1.** It migrated to an **OP Stack L2 on Ethereum on March 26, 2025** (block 31056500, chain ID 42220). You don't need a third-party "Celo ↔ Ethereum" bridge. The canonical route is the chain's **native OP Stack withdrawal bridge**, which settles to Ethereum.
- **A native L2→L1 withdrawal on an optimistic rollup takes about 7 days.** No fee buys a shorter wait on the official bridge. The delay is the fraud-proof challenge window.
- **The withdrawal doesn't finish on its own.** It has three transactions: *initiate* on Celo, then *prove* on Ethereum, then *finalize* on Ethereum. If nobody sends the prove and finalize transactions, the funds sit locked in the bridge contract on L1. **The 7-day clock starts when the withdrawal is proven, not when it's initiated.** For the runbook, this is the most important point.

## 1. Step-by-step flow (canonical bridge)

| # | Stage | Chain | Who / what | When | Duration |
|---|---|---|---|---|---|
| 1 | **Initiate withdrawal** of X CELO from the ops wallet to the treasury address | Celo | Ops-wallet signers (multisig) | T0 | Seconds; costs well under $0.01 |
| 2 | **Wait for an output proposal** that covers the Celo block holding your withdrawal to be posted to L1 | — | Nobody. Poll the status | T0 → T0 + ~1h (can be several hours) | Proposer cadence |
| 3 | **Prove withdrawal** by submitting the Merkle proof to the OptimismPortal on L1. **This starts the 7-day clock** | Ethereum | Operator, from any L1 account with a little ETH for gas | As soon as status = `ready-to-prove` | One tx, a few hundred k gas |
| 4 | **Challenge window**: the proof matures, and the dispute game covering it must resolve and pass the finality delay | — | Nobody. Monitor it | 7 days | Fixed |
| 5 | **Finalize withdrawal**. The portal releases the funds to the treasury address | Ethereum | Operator. Same L1 account that proved it, or use `finalizeWithdrawalTransactionExternalProof` | As soon as status = `ready-to-finalize` | One tx |
| 6 | **Custodian credit / reconciliation** | Ethereum | Custodian, finance | After step 5 | Custodian's confirmation policy, usually minutes to hours |

**Total time in flight: about 7 days plus a few hours**, if the operator acts promptly at steps 3 and 5. Every hour the operator waits before step 3 or step 5 gets added to the total.

### Tooling
- The UI is **Superbridge** (the Superchain bridge frontend, which supports Celo ↔ Ethereum). Use it for the pilot and for manual fallback.
- For automation, use **viem's OP Stack actions**:
  - `initiateWithdrawal`
  - `getWithdrawalStatus`, which returns `waiting-to-prove` / `ready-to-prove` / `waiting-to-finalize` / `ready-to-finalize` / `finalized`
  - `getTimeToProve`, `getTimeToFinalize`
  - `proveWithdrawal`, `finalizeWithdrawal`
- Run a small watcher job that polls `getWithdrawalStatus` every 15 minutes and pages the on-call operator (or sends prove/finalize itself) when the status changes. The prove and finalize transactions are **permissionless**: any L1 account can send them, and the funds still go only to the recipient fixed at step 1. So a low-value hot "relayer" key can do it. It doesn't need to be the treasury key or the ops multisig.

### Things to verify before the first run (don't take these from memory, including mine)
1. **Which token lands on L1.** CELO is Celo's native gas token. On L1 it's represented by an ERC-20 CELO contract released by the Celo OptimismPortal. Get the L1 token address from docs.celo.org or the portal contract. Then **confirm that the custodian supports and displays that exact contract**. If they don't, the funds land but the custodian can't see them.
2. **Celo's current withdrawal/proof parameters.** Celo's L2 setup isn't identical to OP Mainnet: it uses alternative data availability, and its proof system has been evolving. Read the portal's `proofMaturityDelaySeconds()` and the dispute game finality delay on-chain, and check Celo's page on L2Beat. Assume 7 days until the chain itself tells you otherwise.
3. **Treasury address works as an L1 recipient.** If it's a Safe or other contract, check it can receive the ERC-20. The custodian must control that exact address on Ethereum, and the ops multisig on Celo must be able to call the withdrawal.
4. **Pilot it.** Send a small amount (for example 100 CELO) end to end a full cycle ahead of the first real close. The pilot also takes 7 days, so schedule it now.

## 2. Operator calendar for a month-end close

Worked example: the last business day of September 2026 is **Wed 30 Sep**.

| When | Action |
|---|---|
| **T−3 business days** | Check that the relayer L1 account has ETH for gas, the watcher is running, and the recipient address is on the allowlist. Finance confirms the sweep amount. Leave a CELO buffer in the ops wallet for Celo gas and operating float. |
| **T0: Wed 30 Sep, morning (not late afternoon)** | Ops multisig signs `initiateWithdrawal(amount, to = treasury)`. Record the Celo tx hash and the **withdrawal hash** in the close ticket. Second person checks the recipient address against the allowlist before signing. |
| **T0 + ~1–4h (same day)** | Status goes to `ready-to-prove`. **Operator sends the prove transaction on Ethereum.** Record the L1 tx hash and the timestamp; the 7-day clock starts here. If this slips to the next morning, the landing date slips by the same amount. |
| **T0 + 1d → +7d** | Watcher runs with no action needed. Alert if the dispute game for your proposal is **challenged or invalidated**, or if the chain's proof system is upgraded (for example the respected game type changes). In those cases the withdrawal must be **re-proven** and the 7-day clock restarts. This has happened on OP Stack chains during upgrades. |
| **Wed 7 Oct, around the same hour as the prove** | Status goes to `ready-to-finalize`. **Operator sends the finalize transaction.** Funds are in the treasury wallet. |
| **Wed 7–Thu 8 Oct** | Custodian confirms receipt, and finance reconciles L1 amount = Celo amount (gas is paid separately and doesn't reduce the principal). |

**Landing is about business day 5 of the new month** (Oct 1 is BD1, Oct 7 is BD5). If books close around BD5, you have **no slack**. A Friday month-end with no weekend on-call for step 3 pushes it to about BD7. If step 3 is missed until Monday, it's later still.

### Accounting point to raise with finance
At the month-end cutoff the CELO is **in neither wallet**. It's locked in the Celo bridge contract on Ethereum. Finance needs an explicit **"in transit – bridge"** line and policy, or the balance sheet for the closing month shows a gap. Also, **CELO price moves during those 7+ days hit the P&L**. At a $2M sweep in a volatile, relatively thin-liquidity token, that's real exposure, and it's unhedged by default.

### Recommended change even at monthly cadence
**Initiate around the 20th, not the last business day.** Sweep revenue accrued through the cutoff, and let the remainder roll to next month. The funds then land around the 27th–28th, inside the same month. You get no in-transit balance at month-end, slack for a missed prove or a re-prove, and books close on schedule. Or, if finance insists on sweeping on the last business day, accept that the money lands around BD5–7 and book it as in-transit.

## 3. Controls for a $2M sweep

- The ops wallet on Celo is a **multisig** (at least 2-of-3) with a named signer rotation for close day. A single hot key shouldn't be able to move $2M.
- **The recipient can't be changed after initiation.** A wrong address means a permanent loss 7 days later. Hard-code the treasury address in the script and allowlist it, verify it with a second person, and test it with the pilot.
- The relayer (prove/finalize) key holds only gas ETH. Compromising it can't redirect funds.
- Keep the Celo tx hash, withdrawal hash, prove tx, finalize tx, and custodian receipt in the close ticket as the audit trail.
- Consider splitting into 2–4 tranches initiated minutes apart. That doesn't make it faster, but it limits how much one bad transaction can affect.
- Use the **official bridge for this size**. Third-party fast bridges add trust assumptions (liquidity providers, relayers, messaging layers). Use them for large amounts only after deliberate risk sign-off (see below).

## 4. If finance needs it same-week

The canonical bridge can't do that: 7 days is the floor. The options, in the order I'd recommend them:

1. **Ask whether the custodian supports the Celo network directly.** This makes the problem go away. Several institutional custodians support Celo. If the custodian can hold assets on Celo, "the custodian can see it" is solved in seconds by a plain transfer to a custodian-controlled Celo address, with no bridge. Ask this first.

2. **Pipeline the canonical bridge (rolling withdrawals).** Initiate a withdrawal **every week (or every day)** instead of once a month. After the first 7-day warm-up, a tranche lands every week, so finance gets money weekly. It's always about 7 days behind revenue, but it keeps the trust-minimized route. Once the watcher is automated, the operator cost is small. **This is my default recommendation if the requirement is "funds arrive every week"** rather than "this specific dollar arrives in hours".

3. **Convert on Celo, then move a stablecoin, or sell through an exchange or OTC desk.** If finance actually wants **dollars** in the treasury rather than CELO (at $2M it probably should), then:
   - swap CELO to USDC on Celo (on-chain liquidity for $2M of CELO may be thin, so use RFQ/OTC or split it over time), then move the USDC to Ethereum through Circle's rails (check CCTP support for Celo; otherwise redeem and re-mint through a Circle Mint account); **or**
   - deposit CELO on the Celo network to an exchange or OTC desk the company already has an account with, sell it, and withdraw USDC on Ethereum to the treasury.

   Either way the money arrives in hours instead of 7 days, and it also **removes the 7-day CELO price exposure**. The trade-off is counterparty and execution risk, plus trading fees and slippage.

4. **Fast / intent-based bridges** (Across, Stargate/LayerZero, etc., if they support CELO or USDC on Celo at the time). A solver or liquidity provider fronts you funds on L1 in minutes for a fee of roughly 0.05–0.5%. Downsides: route support and liquidity depth for $2M in CELO specifically are doubtful, so you may be forced into many small tranches. You're also trusting the bridge's contracts and messaging, which is not appropriate for a treasury at this size without explicit risk sign-off and per-transfer caps.

**Summary for finance:** the official bridge is safe but takes about 7 days, plus a few hours, plus operator attention at two points. Kick it off around the 20th and it lands inside the month. If they need it same-week, first ask whether the custodian can hold on Celo. Otherwise, run rolling weekly withdrawals for predictable weekly arrivals, or convert to USDC through an exchange or OTC desk for arrival within hours. The conversion option is also the right answer to the price-risk question finance hasn't asked yet.
