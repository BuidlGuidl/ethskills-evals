# Runbook: Monthly CELO sweep, Celo ops wallet → Ethereum mainnet treasury

## 0. Get the premise right first

- **Celo is an Ethereum L2, not a separate L1.** It moved to the OP Stack on 2025-03-26. The canonical way to move CELO to mainnet is Celo's own **L2→L1 withdrawal** through its bridge contracts on Ethereum. Don't use a third-party wrapped-asset bridge.
- **CELO is the gas token on Celo and a normal ERC-20 on Ethereum.** The treasury receives the L1 CELO ERC-20. It does not receive ETH or a wrapped IOU. Before the first run, confirm the custodian supports that exact token contract. Take the address from Celo's docs, not from memory or a search result.
- **The canonical exit takes about a week.** It is not a single transfer. It is three transactions on two chains, and our operator has to submit the two Ethereum-side steps. Nothing completes on its own.

Every number below is a snapshot. **Read the current values from the chain on the day of each run** (see §4). The figures are from Celo's OptimismPortal as read on 2026-08-24, and a Celo hardfork can change them.

---

## 1. How the transfer works

| # | Chain | Action | Who can submit it | When it can happen |
|---|---|---|---|---|
| 1 | Celo | **Initiate** the withdrawal. Send CELO to the L2 withdrawal contract and set the mainnet treasury (or an L1 staging address, see §3) as the recipient. | Only the ops wallet, because it holds the funds | Any time. Celo produces a block about every 1s, so this confirms in seconds |
| 2 | Ethereum | **Prove** the withdrawal against a dispute game (output proposal) that covers the initiation block | Anyone. This is permissionless, so a separate L1 gas wallet can do it | Once a game that covers your block has been posted. Usually hours; check with `getTimeToProve` |
| 3 | Ethereum | **Finalize.** The portal/bridge releases the CELO ERC-20 to the recipient | Anyone (permissionless) | After **both** gates below have passed |

**The clock starts at prove, not at initiation.** Every hour between initiating and proving adds an hour to the whole transfer.

Finalizing is blocked until both of these gates have passed. Whichever passes later decides the date:

- `proofMaturityDelaySeconds` = **604,800 (7 days)**, counted from your prove transaction.
- The dispute game has to resolve: OP Succinct `maxChallengeDuration` = 302,400 (3.5 days). Then `disputeGameFinalityDelaySeconds` adds another 302,400 (3.5 days) after resolution. That is about 7 days from when the game was *posted*.

In practice the 7-day proof-maturity gate decides the date. **The figure "Celo exits in 3.5 days" is wrong for planning.** It is the challenge window on its own. The actual wait is about 7 days after prove.

### How long the money is in flight

| Stage | Typical duration | Where the funds are |
|---|---|---|
| Initiate → provable | Minutes to a few hours (read it live) | Burned/locked on Celo. **Not in the ops wallet and not in the treasury** |
| Prove → finalizable | **≥ 7 days** | Pending in the Ethereum portal |
| Finalize → custodian credits it | Minutes, plus the custodian's own crediting time | Treasury |
| **Total** | **About 7–8 calendar days** | |

**Finance needs an "in transit" line for this.** For roughly a week the custodian can't see the funds, and neither can the Celo wallet. At $2M, that is also a week of unhedged CELO price exposure (see §5).

---

## 2. Operator timeline for the monthly close

Assume kickoff on the last business day (T0). Finalizing is only possible about 7 days after prove, so the money lands around **business day 5–6 of the next month**. If finance closes on BD3–5, this schedule misses the close in some months. Weekends and holidays don't shorten the wait, and they can push the finalize step to a day when nobody is on shift.

**Recommendation:** change the cutoff rather than the bridge. Sweep the revenue accrued up to about the 20th, and kick off the sweep on the ~22nd. It then finalizes before month end, with margin for a retry. Revenue after the cutoff goes out in the next cycle. If finance insists on sweeping on the last business day, write BD6 into the close calendar as the date the funds land, not "before close".

### Pre-flight (T0 − 2 business days)
- [ ] Confirm the ops wallet balance on Celo and agree the sweep amount with finance. Leave a CELO reserve for gas.
- [ ] Confirm the L1 gas wallet holds enough ETH for the prove and finalize transactions. Both are ordinary L1 transactions; check current gas.
- [ ] Read the live gate values (§4) and **work out the expected finalize date before initiating.** If it falls on a holiday, assign a named owner for that day.
- [ ] Check Celo's status page and forum for scheduled hardforks or portal upgrades in the next 10 days. An upgrade during the window can change contracts or invalidate pending proofs.
- [ ] Re-confirm the treasury address, the custodian's support for the L1 CELO token, and that the custodian **credits token transfers that arrive through a contract call** (see §3).

### T0 — Initiate (Celo)
- [ ] Get sign-off from the ops wallet multisig (Safe on Celo). At this size the wallet should not be a single EOA.
- [ ] Submit the withdrawal with the exact amount and recipient. Record the Celo tx hash and block number, and the withdrawal hash.
- [ ] Post the details to the close ticket and change the status to **In transit – awaiting prove**.

### T0 + hours — Prove (Ethereum)
- [ ] Poll `getWithdrawalStatus` / `getTimeToProve` until the status is `ready-to-prove`.
- [ ] Submit the prove transaction from the L1 gas wallet and record the tx hash.
- [ ] **Calculate and record the finalize-eligible time: prove block timestamp + 7 days.** Recalculate it with `getTimeToFinalize`, because that call also checks the game-resolution gate.
- [ ] Put a calendar hold on that time for the operator and a backup.
- [ ] Target: prove on the same day as initiation. Each hour of delay here moves the landing date by an hour.

### Prove + 0…7 days — Monitor (daily, 5 min)
- [ ] Check that the withdrawal status is still `waiting-to-finalize`.
- [ ] **If the dispute game has been challenged, invalidated or blacklisted,** re-prove against a newer valid game. **This restarts the 7-day clock.** Escalate to finance at once with the new landing date.
- [ ] If the portal has been paused by the guardian, escalate. There is nothing to do until it is unpaused.

### Prove + 7 days — Finalize (Ethereum)
- [ ] Check that `getWithdrawalStatus` = `ready-to-finalize`.
- [ ] Submit the finalize transaction and record the tx hash.
- [ ] Check that the recipient's L1 CELO ERC-20 balance went up by the exact amount.
- [ ] If CELO landed in an L1 staging address, forward it to the custodian with a plain ERC-20 transfer.
- [ ] Get the custodian's credit confirmation. Close the "in transit" entry with the three tx hashes.

### Tooling
- Script all of this with viem's OP Stack actions against Celo's own contracts: `initiateWithdrawal`, `getWithdrawalStatus`, `getTimeToProve`, `proveWithdrawal`, `getTimeToFinalize`, `finalizeWithdrawal`.
- Make the script idempotent. It should read the status and perform only the next step, so a re-run can't double-submit.
- Keep a bridge UI that supports Celo withdrawals (Celo's own, or Superbridge) as the manual fallback. It can prove or finalize a withdrawal that the script initiated.

---

## 3. Controls and gotchas at $2M

- **Canary run.** The first time, and after any Celo hardfork, run a small withdrawal of about 10 CELO all the way through to the custodian before sending the full amount.
- **How the custodian receives the funds.** At finalize, the CELO reaches the recipient through a *contract call* from the bridge, not as a normal transfer. Some custodian deposit addresses don't credit these automatically.
  - If the canary doesn't get credited cleanly, send the withdrawal to an L1 address you control and forward it from there.
  - Forwarding adds one transfer, and it also means you aren't depending on the custodian for the finalize step.
- **Wrong recipient cannot be fixed.** Whatever address is set at initiation is where the funds land. Use a checksummed allowlist address in the script, not something pasted in by hand.
- **Key separation.** The ops multisig signs only the initiation. Prove and finalize are permissionless, so they run from a low-value L1 gas wallet with no treasury authority.
- **One withdrawal or several.** Splitting the sweep doesn't make it faster. One withdrawal is simpler to reconcile. You could split it in 2–3 only to limit how much one stuck proof can hold up; that doesn't change the timing.

---

## 4. Read these live on every run, not from this document

| Value | Where to read it |
|---|---|
| Proof maturity delay | `OptimismPortal.proofMaturityDelaySeconds()` on Ethereum |
| Game challenge window and finality delay | The dispute game's `maxChallengeDuration`, and `disputeGameFinalityDelaySeconds` on the portal |
| Actual time to prove / finalize this withdrawal | viem `getTimeToProve` / `getTimeToFinalize` |
| Bridge and token contract addresses | Celo docs (the canonical deployment list), checked against the canary |

If any of these differ from the numbers above, the value on the chain is correct. Update this runbook.

---

## 5. If finance needs it the same week

The canonical route can't be made faster than the ~7-day proof maturity. That is the security model of an optimistic rollup, not something we can tune. To hit a same-week deadline, you either **leave the canonical bridge** or **start earlier.** The options, in the order I'd look at them:

1. **Ask whether the custodian can hold Celo directly.** Several institutional custodians support Celo natively. If the custodian can see a Celo address, finance's visibility requirement is met with no bridging at all. Moving it to mainnet then becomes a treasury decision rather than a month-end deadline.

2. **Pipeline the canonical route (no new trust assumptions).** Initiate a withdrawal **every week**, or daily, rather than once a month. Each week's withdrawal lands a week later, so treasury receives funds every week. Combined with the ~20th cutoff, the month is in the mainnet wallet before close. Revenue from the last days of the month moves to the next cycle or goes through option 3. This costs more L1 gas (two L1 transactions per withdrawal) and more operator time; scripting and alerting make that manageable.

3. **Fast route for the remainder: convert on Celo, then use a burn/mint route.**
   - Swap CELO → native USDC on Celo, then move the USDC with a route that burns and mints, if Celo is supported on that route when you check. Circle CCTP is the first one to check.
   - This settles in minutes to hours, and the treasury receives stablecoins. That also removes the week of CELO price exposure, which at $2M finance may prefer anyway.
   - Trust assumption: the issuer's attestation service (Circle) instead of Ethereum's fraud-proof window.
   - Costs: slippage on the swap. **Measure the depth of the CELO/USDC pool on Celo at the actual trade size before relying on it.** Seven figures of a gas token can move a DEX pool a lot, so split the order or use an aggregator or RFQ.

4. **Intent / fast bridge (Across, Squid, LayerZero or CCIP routes).**
   - A relayer pays you on mainnet right away and collects the canonical withdrawal later.
   - Trust assumption: the bridge's relayer or oracle set, on top of Ethereum.
   - **Check route depth for CELO specifically at $2M.** Relayer inventory for a long-tail gas token commonly runs out well before seven figures. You may only be able to move part of the sweep, or only a stablecoin, this way.

5. **Exchange hop.** Deposit CELO on the Celo network to an exchange or OTC desk, sell it or keep it as CELO, and withdraw on Ethereum.
   - This takes hours and gives the best depth at size.
   - Trust assumption: counterparty custody while the funds are on the exchange, plus KYC, withdrawal limits, and whether withdrawals are open that day.
   - For $2M, an OTC desk with a pre-agreed settlement process is cleaner than an exchange order book.

**My recommendation:**
- Use option 1 if the custodian allows it.
- Otherwise, use **option 2 as the default process.** It keeps the canonical bridge and gets the month on mainnet before close.
- Use **option 3 for the tail and for months when finance needs stablecoins.** It is the fast route I trust most and handles the size best, and it deals with price risk as well as speed.
- Keep options 4 and 5 as documented break-glass paths. Each one must be approved by finance and security, the trust assumption must be written down, and the size must be checked against the route's actual depth.
