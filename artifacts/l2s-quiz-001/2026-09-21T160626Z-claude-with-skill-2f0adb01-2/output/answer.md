# Runbook: Monthly CELO sweep, Celo → Ethereum mainnet treasury

## 0. The fact that shapes everything else

**Celo is no longer an L1.** It became an OP Stack L2 on Ethereum on **March 26, 2025** (block 31056500). So "moving CELO to mainnet" means **withdrawing from an optimistic rollup**, and that has three properties:

1. **It takes about 7 days.** An optimistic rollup's state root has to survive a challenge window before L1 will release funds. You can't pay extra or push a button to skip it. The only fast routes use third-party liquidity (see §5).
2. **It is not automatic.** A canonical withdrawal needs **three transactions**: one on Celo and **two on Ethereum** (prove, then finalize), about 7 days apart. If nobody sends the finalize transaction, the money sits in the bridge contract forever. That is the main operational risk in this runbook.
3. **What arrives is CELO as an ERC-20 on Ethereum.** It is not ETH, not USD, and not "native" CELO. The custodian has to support and whitelist the **canonical L1 CELO token contract**. Get that address from docs.celo.org, not from a search engine, because other bridges have issued wrapped-CELO look-alikes.

> Verify before the first run: Celo's current withdrawal and proof parameters (docs.celo.org and the Celo page on l2beat.com). The OP Stack proof system gets upgraded from time to time, and the exact delays below are the standard OP Stack values, not a guarantee.

---

## 1. How the canonical transfer works

```
 Celo L2                                  Ethereum L1
 ───────                                  ───────────
 [1] initiate withdrawal (ops wallet)
      └─ burns/locks CELO on L2,
         records withdrawal message
                                          (sequencer batches + proposer
                                           posts an L2 state root to L1)
                                          [2] PROVE withdrawal  ← operator tx
                                               starts the ~7-day clock
                                          ...challenge window (~7 days)...
                                          [3] FINALIZE withdrawal ← operator tx
                                               OptimismPortal releases
                                               CELO ERC-20 → treasury address
```

| Step | Chain | Who | When it can happen | What it does |
|---|---|---|---|---|
| 1. Initiate | Celo | Ops wallet signers | Any time | Sends native CELO into the L2→L1 message passer (via the official bridge UI linked from docs.celo.org, or the contracts directly). Set `to` **explicitly** to the mainnet treasury address. |
| 2. Prove | Ethereum | Operator (the L1 "prover" key) | Once a state root covering the step-1 block has been posted to L1. Usually within about an hour, but it depends on proposer cadence, so allow a few hours. | Submits a Merkle proof that the withdrawal exists in that state root. **This starts the challenge clock.** |
| 3. Finalize | Ethereum | **Same address that proved** | About 7 days after the prove (plus dispute-game resolution) | Releases CELO ERC-20 on L1 to the `to` address. |

Gas is negligible. Step 1 costs well under $0.01 on Celo, and prove and finalize are a few hundred thousand gas each on mainnet, which is cents to low single-digit dollars at current prices. Keep a small ETH balance in the L1 operator wallet anyway, because it can't prove or finalize with zero ETH.

### Things that bite people
- **Use the same address for prove and finalize.** On current OP Stack fault-proof contracts, the default finalize path checks that the caller is the address that submitted the proof. Don't prove from one laptop's hot key and try to finalize from a different signer.
- **If the ops wallet is a Safe, don't rely on "same address on L1."** A Safe on Celo doesn't automatically exist at the same address on Ethereum. Always set the destination `to` explicitly to the treasury address, and test it.
- **A re-prove resets the clock.** If the dispute game you proved against is invalidated or blacklisted, or a bridge upgrade forces re-proving, you prove again and the ~7 days starts over. This is rare, but the runbook needs a branch for it (see §3, "Exceptions").
- **The trust model for a $2M sweep.** The official bridge is the right choice for large amounts because it adds no third party beyond the rollup itself. Still, have someone read Celo's L2Beat risk page once a quarter: proof system, data availability (Celo uses an alt-DA layer rather than posting all data to Ethereum blobs), and upgrade keys. Finance should know what they're trusting.
- **Price exposure.** The CELO is unhedged for more than a week. Using the headline $2M figure, a 10% move while in flight is $200k. See §4.

---

## 2. Timeline: how long the money is in flight

Everything counts in **calendar days**. The challenge window doesn't observe weekends.

| T+ | Event | Money is… |
|---|---|---|
| T+0 (last business day, morning) | Step 1 initiated on Celo | Off the Celo ops wallet, not yet on L1 |
| T+0, about 1–4 h later | Step 2 prove on Ethereum | In the bridge, clock running |
| T+7d (+ a few hours) | Step 3 finalize becomes possible | Still in the bridge until someone finalizes |
| T+7d, same day | Finalize sent → CELO ERC-20 in treasury wallet | Landed |
| T+7d to T+8d | Custodian credits and shows it in their dashboard | Visible to finance |

**Realistic in-flight time: 7–8 calendar days.** Worst case is about 14+ days if a re-prove is needed.

Worked example for this month: kick off Wednesday **Sep 30, 2026**, prove the same day, finalize around **Wednesday Oct 7**. That's about the 5th business day of October. The funds arrive in time if "books close" means the next month's close. They land **after** a typical BD3–BD5 close of the September books, and one re-prove would push past any close.

**Accounting consequence:** at period end (Sep 30) the CELO is in neither wallet. Finance needs an "in-transit, canonical bridge" line, supported by the step-1 tx hash and the withdrawal hash. Agree on this treatment with the controller before the first run.

---

## 3. Operator checklist

### Monthly prerequisites (by BD −3)
- [ ] Confirm the custodian still supports the canonical L1 CELO ERC-20 and that the treasury deposit address is unchanged. Get it confirmed in writing and compare it to the address book.
- [ ] L1 operator/prover wallet has enough ETH for two transactions, with 5–10× headroom.
- [ ] Ops wallet on Celo holds enough extra CELO for step-1 gas.
- [ ] Check docs.celo.org and l2beat for any changed withdrawal delay, bridge upgrade, or incident.
- [ ] Decide the sweep amount. Leave a float in the ops wallet for product operations.

### T+0: last business day, **before noon** so the prove lands during working hours
1. **First run only:** send a small test withdrawal (e.g. 10 CELO) to the treasury address through the full cycle, and have the custodian confirm they credited it. Do this a full cycle (7+ days) ahead of the first real sweep.
2. **Initiate** the withdrawal on Celo from the ops wallet (Safe signers approve). Record:
   - Celo tx hash, block number, amount, `to` address
   - Withdrawal hash (shown by the bridge UI, or derived from the `MessagePassed` event)
3. **Wait for provable.** Poll the status. Scriptable with viem's OP Stack actions (`getWithdrawalStatus`, `waitToProve`, `proveWithdrawal`, `getTimeToFinalize`, `finalizeWithdrawal`), or watch the bridge UI.
4. **Prove** on Ethereum from the designated L1 prover address. Record the L1 tx hash and the dispute-game address/index.
5. Post all hashes to the finance ticket. **Create a calendar event for the finalize** at prove-time + 7 days + 2 h, with a named primary and backup operator.

### T+1 … T+6: daily check (about 2 minutes)
- [ ] Withdrawal status is still "waiting to finalize". No re-prove is required, and the dispute game proven against has not been invalidated.
- [ ] No Celo bridge incident or upgrade announcement.

### T+7: finalize day. This may fall on a weekend, so staff it.
1. Confirm `getTimeToFinalize` = 0 or the UI shows "Ready to finalize".
2. **Finalize** from **the same address that proved**. Record the L1 tx hash.
3. Check on Etherscan that there is an ERC-20 `Transfer` of CELO from the bridge to the treasury address for the exact amount.
4. Notify finance and the custodian, and close the ticket once the custodian shows the credit.

### Exceptions
- **Not provable after 12 h:** check the Celo status page and proposer activity on L1. Escalate to Celo via their support/Discord. Funds are safe but stuck in the pending state.
- **Re-prove required:** prove again right away from the same address and tell finance the new ETA (+7 days). Don't wait for business hours.
- **Finalize reverts:** most likely it's being sent from the wrong address or before the delay has elapsed. Don't retry blindly; compare against the recorded prover address and timestamp.
- **Custodian doesn't credit:** the funds are on-chain in the treasury address. This is a custodian token-support issue, not a bridge issue.

### Automation (recommended at $2M)
Run a small job, for example a viem script on a cron with an alerting hook, that watches every open withdrawal hash. It should page when a withdrawal becomes provable, when it becomes finalizable, and when any withdrawal has been in the same state longer than expected. It can hold the prover key in a KMS/HSM and do the prove and finalize automatically. Those two transactions can only send funds to the `to` address fixed in step 1, so automating them is low-risk. Keep step 1, the part that decides amount and destination, under multisig human approval.

---

## 4. The question to put back to finance: do they want CELO, or money?

"Finance wants it in the treasury where the custodian can see it" usually means they want **dollars**, not a volatile token. If that's the case, the better design is often:

**Swap CELO → USDC on Celo first, then move USDC to mainnet.**
- Celo has native Circle-issued USDC. Circle's CCTP burns USDC on the source chain and mints native USDC on Ethereum, with no 7-day challenge window: minutes on the standard path, faster on CCTP V2's fast path. **Verify that Celo is currently a supported CCTP domain** before building on this. If it isn't, the fallbacks are Circle Mint, the custodian, or an exchange (below).
- Price risk goes away as soon as the swap executes, rather than 7+ days later.
- The custodian receives USDC, which they almost certainly support already.
- Costs: DEX slippage and fees. At $2M of CELO, check on-chain depth on Celo DEXes and Mento first. You'll probably need to split the swap over hours or days, or use an OTC desk, instead of making one market swap.

This isn't only a speed optimization. It's likely the right answer for a treasury process regardless.

---

## 5. If finance needs it same-week

With the canonical CELO bridge, **same-week is not possible**. The 7 days is a protocol floor. Options, in order of preference:

| Option | Time to mainnet | Trade-off |
|---|---|---|
| **A. Custodian supports the Celo network directly** | Minutes, no bridge | Easiest if available. Ask them first. The custodian may already support Celo, in which case the bridge isn't needed at all. |
| **B. Swap to USDC on Celo → CCTP to Ethereum** (§4) | Minutes to about an hour | Slippage on a large swap. Requires CCTP support for Celo (verify). Removes price risk. |
| **C. Exchange / OTC desk** | Same day | Deposit CELO on the Celo network to an institutional exchange or OTC desk, then either sell to USD/USDC or withdraw on Ethereum. This adds counterparty and KYC/onboarding requirements, but is standard for treasury flows of this size. |
| **D. Intent / fast bridges** (Across, Stargate, etc.) | Seconds to minutes | Only if they support the Celo route and the asset. CELO liquidity on these is thin, so a $2M CELO transfer likely exceeds route limits. Fees run about 0.05–0.3%, and you add the bridge's trust assumptions. Better suited to USDC than CELO. |
| **E. Keep the canonical bridge but pipeline it** | Money arrives every week, each tranche still takes 7 days | Initiate a weekly withdrawal of the prior week's revenue. At month-end only the last week is in flight. It doesn't make any single tranche faster. It shrinks the in-transit amount and the price exposure. |
| **F. Keep the canonical bridge but move the cutoff** | 7 days | Kick off around the 20th–22nd for revenue to date, so it lands before month-end, and roll late-month revenue into the next sweep. Cheapest change to the process. |

**My recommendation:** Ask the custodian about option A this week. If they can't do it, redesign the close as **B, with C as the fallback for size**: sell to USDC on Celo during the last week of the month, move it via CCTP, and have USDC in the treasury the same day. Keep the canonical CELO bridge in this runbook as the documented path when finance really does want to hold CELO. It has no third-party dependency, but plan it as a 7–8 day process with a staffed finalize step.
