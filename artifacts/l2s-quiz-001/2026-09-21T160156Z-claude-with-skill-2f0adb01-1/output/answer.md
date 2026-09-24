# Celo → Ethereum Mainnet Treasury Sweep: Runbook Design

## 0. The fact the whole runbook depends on

**Celo is no longer its own L1.** It moved to an **OP Stack optimistic rollup on Ethereum** on
March 26, 2025 (block 31056500, chain ID 42220). So "moving CELO to mainnet" means an
**L2 → L1 withdrawal through the canonical OP Stack bridge**, not a third-party cross-chain hop.
That has three consequences for the runbook:

1. **Withdrawals take about 7 days.** Optimistic rollups hold a challenge window before L1 pays
   out. This isn't a matter of fees or congestion. You can't pay extra to go faster through the
   canonical bridge.
2. **The funds don't just arrive.** Someone has to send a **second and third transaction on
   Ethereum** (prove, then finalize). If nobody sends them, the money waits in the bridge
   indefinitely.
3. **What lands on mainnet is the CELO ERC-20 token.** You get CELO, not ETH or dollars. Your
   custodian must support that exact token contract on Ethereum. **Check this before anything
   else.** Get the L1 CELO token address from docs.celo.org, not from a block explorer search or
   a chat message.

---

## 1. How the canonical transfer works

| Stage | Chain | Who acts | What happens | Typical duration |
|---|---|---|---|---|
| **1. Initiate** | Celo (L2) | Operator (ops wallet signs) | Withdraw CELO through Celo's L2 bridge contracts (L2StandardBridge → L2ToL1MessagePasser), with the **mainnet treasury address as the explicit recipient**. CELO leaves the ops wallet right away. | Seconds (5s blocks), fee under $0.01 |
| **2. Wait for state proposal** | Ethereum | Nobody (automatic) | A proposer posts a state commitment (a dispute game) to L1 that covers the L2 block containing your withdrawal. You can't prove the withdrawal until this exists. | Usually ~1 hour, can be several. Read it with `getTimeToProve` and don't hard-code it. |
| **3. Prove** | Ethereum | **Operator** (any L1 account with a little ETH) | Submit the Merkle proof of the withdrawal against that proposal. **This starts the challenge clock.** | 1 L1 tx, cents to a few dollars |
| **4. Challenge window** | Ethereum | Nobody (you monitor) | Fault-proof window during which the proposal can be disputed. | **About 7 days.** It can run longer if the dispute game is challenged, and it resets if the game is invalidated. |
| **5. Finalize** | Ethereum | **Operator**, using the **same L1 account that proved** | Execute the withdrawal. The CELO ERC-20 is released to the treasury address. | 1 L1 tx, cents to a few dollars |
| **6. Confirm** | Ethereum | Operator + finance/custodian | Confirm the treasury balance on Etherscan and in the custodian's view, then book it. | Minutes to the custodian's reporting lag |

**Time in flight: about 7 days plus the proposal lag, so plan for 7.5 calendar days, and budget
8–10 because finalizing needs a person.** Money leaves the Celo books at stage 1 and reaches the
mainnet treasury at stage 5. In between, it isn't in either wallet. It's held in the bridge
contract on Ethereum (the OptimismPortal), so finance must book it as **"in transit / bridge
receivable."**

### Don't hard-code "7 days": read the timing on-chain
OP Stack chains set these values per chain, and upgrades can change them. The runbook should get
them at run time, not from this document:
- viem's OP Stack actions (`getWithdrawalStatus`, `getTimeToProve`, `getTimeToFinalize`) return
  the real status and ETA for a given withdrawal tx hash.
- On L1, the relevant parameters are `proofMaturityDelaySeconds` on the OptimismPortal and the
  dispute-game clock/finality delays. For pre-fault-proof configurations, it's
  `FINALIZATION_PERIOD_SECONDS`.
- Check the current proof system and risk profile for Celo on L2Beat. Celo uses an alternative
  data-availability layer (EigenDA) rather than only Ethereum blobs, and treasury risk owners
  should know that at $2M scale.

---

## 2. Monthly-close runbook (canonical bridge)

Example using the October 2026 close. Oct 30 is a Friday and the last business day.

### T-30 days (one time, before the first production run)
- [ ] **Custodian confirms** it supports the CELO ERC-20 on Ethereum at the documented address and
      will show it in the treasury view.
- [ ] **Run a test withdrawal end to end** (a small amount, e.g. 10 CELO) through all 3
      transactions to the real treasury address. The first real run shouldn't be the first time
      you run the prove/finalize tooling. The test takes a week, so start it early.
- [ ] Set up a **dedicated L1 "relayer" EOA** funded with ~0.05 ETH for prove/finalize gas. It
      never holds treasury funds. It only needs to be the same account for prove and finalize.
      (Under fault proofs, `finalizeWithdrawalTransaction` looks up the proof by
      `msg.sender`. If you finalize from a different account, use
      `finalizeWithdrawalTransactionExternalProof`.)
- [ ] Put the treasury address in the script/config as a **constant reviewed by two people**.
      Never use "same address as the ops wallet." **If the ops wallet is a Safe or another smart
      contract wallet, its address on Celo may not exist or may belong to someone else on
      mainnet.** Always set the L1 recipient explicitly.
- [ ] Write the tooling as a script (viem OP Stack actions, or the Celo-documented bridge UI such
      as Superbridge as a fallback). Save the L2 tx hash, since every later step is keyed off it.

### Day 0: last business day (Fri Oct 30), morning
- [ ] Snapshot the ops wallet balance. Decide the sweep amount and leave a CELO buffer for Celo
      gas and operations.
- [ ] Get approval from finance and a second signer (Safe multisig recommended at $2M scale).
- [ ] **Stage 1: initiate the withdrawal on Celo.** Record the tx hash, amount, block number and
      timestamp in the close ticket.
- [ ] Tell finance: "X CELO in transit, expected on mainnet about Nov 6–7." Finance books it as
      in-transit at month-end.

### Day 0, +1 to a few hours
- [ ] Poll `getWithdrawalStatus` until it reads `ready-to-prove`.
- [ ] **Stage 3: prove on Ethereum** from the relayer EOA. Record the L1 tx hash and the
      finalization ETA from `getTimeToFinalize`.
- [ ] Set a calendar alert and an on-call page for the ETA.

### Days 1–7: monitor
- [ ] Check status once a day. Alert if the dispute game backing your proof is challenged,
      blacklisted, or resolved invalid. **If it's invalidated, re-prove against a newer game**, and
      the clock restarts. Tell finance the new ETA.

### Day ~7 (≈ Fri Nov 6, or the next business day if the ETA lands on a weekend)
- [ ] When the status reads `ready-to-finalize`, run **Stage 5: finalize** from the same relayer
      EOA.
- [ ] Confirm the CELO ERC-20 balance increase in the treasury on Etherscan. Get the custodian to
      confirm it on their side, then close the ticket with all 3 tx hashes.

### The timing problem with the current plan
If you start on the last business day, the money lands on **about business day 5 of the next
month** at best. One weekend, one holiday, a missed finalize, or a re-prove pushes it past a
typical close. The fix costs nothing: **move the cutoff, not the bridge.**
- **Sweep on about day 20 of the month** (or run a rolling weekly sweep). Month-end revenue then
  waits for the next cycle, but every withdrawal you've started has finished before close.
- Or keep the last-day sweep and accept that finance books it as "in transit" at month-end. In
  both cases, the custodian sees it before the *next* close, not the current one.

---

## 3. Before this becomes a $2M sweep: the bigger risk is the asset, not the bridge

The canonical bridge is the **safest** route: no extra trust in intermediaries, only Ethereum and
the rollup's proof system. It works well for large amounts. What it doesn't address:

- **Price exposure:** You hold a volatile token for 7+ days while it's in flight. CELO can move
  double-digit percentages in a week. On a $2M sweep, that's a six-figure swing in the number
  finance books.
- **Liquidity at the destination:** If finance ultimately wants dollars, turning a large CELO
  position into USD on mainnet may be harder than doing it on Celo or at an exchange.

**Recommendation:** ask finance whether they want **CELO** in the treasury or **the dollar value
of the revenue**. It's almost certainly the dollar value. If so, convert CELO to a stablecoin
**on Celo** first (sub-cent gas, Mento/DEX liquidity; for size, split the swap over time or get
an OTC quote, and set a max slippage in the runbook). Then move the stablecoin. That also opens up
the faster routes below.

---

## 4. If finance needs it same-week

The canonical bridge **can't** be sped up. The ~7-day window is how optimistic rollups stay
secure. Your options, from most to least recommended:

1. **Convert to native USDC on Celo, then use Circle CCTP to Ethereum** (if CCTP supports Celo
   when you implement this; check Circle's supported-chains list). It burns on Celo and mints
   on Ethereum, with no liquidity pool and no 7-day wait. It takes minutes, or seconds with
   CCTP V2 Fast Transfer, and you get native USDC, which every custodian supports. The only
   added trust is Circle, which you already trust by holding USDC. If CCTP doesn't cover Celo,
   use Circle Mint or your custodian's own on/off-ramp to redeem USDC on Celo and receive it on
   Ethereum. **Native USDC can't go through the OP canonical bridge**, which only handles
   bridged tokens. This is the right answer at $2M scale.
2. **Exchange or custodian route:** deposit CELO or stablecoins to an institutional exchange or
   your custodian **on the Celo network**, then sell and/or withdraw on Ethereum. This takes
   hours. The trade-off is counterparty and operational risk. Confirm the venue credits Celo
   deposits on the correct network and ask about withdrawal limits for a transfer this size.
3. **Intent/fast bridges (e.g., Across):** these finish in seconds to minutes for a
   ~0.05–0.3% fee, but they add solver/protocol trust. **Route support and liquidity for CELO
   specifically are thin or missing**, so this only works for stablecoins/ETH. For more than
   ~$100K, split into capped tranches (e.g., ≤$250K each) and confirm each one lands before
   sending the next. Treat this as a fallback, not the main path.
4. **Keep the canonical bridge but pipeline it:** start a withdrawal every week (or every day).
   Once the pipeline is full, a matured withdrawal finalizes every week, so "the money arrives
   this week" is always true, even though each piece took 7 days. This works well if finance
   cares about *regular arrivals* rather than *this month's revenue arriving this week*. The
   trade-off is more prove/finalize operations (a few dollars each) and more open items to track.

**Changes to the runbook for same-week:**
- Add a "convert on Celo" step at Day 0 (swap CELO→USDC, recording slippage limit, executed
  rate, and tx hash).
- Replace stages 2–5 with a single CCTP (or exchange) leg. It finishes the same day, so there's no
  in-transit line at month-end and it can run on the last business day as finance wants.
- Keep the canonical bridge documented as the **fallback** when a third party is unavailable.
- Add per-transfer caps, two-person approval, and a test transfer of the new route before the
  first production run.

---

## 5. Controls checklist (any route)
- [ ] Treasury address hard-coded, verified by two people, and confirmed by a small test transfer.
- [ ] Multisig approval on the source wallet for sweeps over a threshold.
- [ ] Every tx hash (L2 initiate, L1 prove, L1 finalize, or swap + CCTP) recorded in the close
      ticket.
- [ ] A named owner and a backup for the finalize step. It's the step most likely to get
      forgotten.
- [ ] Contract addresses (L1 CELO token, bridge contracts, USDC) taken only from official
      Celo/Circle documentation and pinned in config.
- [ ] Re-check timing parameters and Celo's proof system on L2Beat each quarter. OP Stack
      upgrades change them.
