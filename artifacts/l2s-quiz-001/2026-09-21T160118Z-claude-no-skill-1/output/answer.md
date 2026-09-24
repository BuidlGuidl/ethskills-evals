# Runbook: Monthly CELO sweep, Celo → Ethereum mainnet treasury

## 0. What you're actually doing

Since the L2 migration in March 2025, Celo has been an **OP Stack L2 on Ethereum**. Two things follow from that:

1. **CELO's canonical token lives on Ethereum L1** as an ERC-20. On Celo, CELO is the native gas token, and it's backed by L1 CELO locked in the Celo bridge contracts (OptimismPortal and the standard bridge) on Ethereum.
2. **Moving CELO from Celo to Ethereum means a native L2→L1 withdrawal.** This is the standard OP Stack three-step flow: *initiate on L2 → prove on L1 → wait out the challenge period → finalize on L1*. It is not a transfer. It's a message that L1 has to verify, and the fraud-proof security model adds a delay of about **7 days**.

The canonical bridge is the right default for this: nothing wrapped, no third-party custody, and the only extra trust is in Celo's own rollup contracts. Its cost is time. The money is in flight for roughly **7 days plus a few hours**, and nobody can speed that up.

> **Verify before the first run. Don't copy these from this doc.** Get the current values from Celo's docs and read them on-chain from the L1 contracts:
> - L1 CELO token address (this is what the custodian has to whitelist)
> - `OptimismPortal` / `L2ToL1MessagePasser` / `L2StandardBridge` addresses
> - `OptimismPortal.proofMaturityDelaySeconds()` and `disputeGameFinalityDelaySeconds()`, which give the real wait
> - `respectedGameType()` and how often output roots or dispute games are proposed
>
> Celo has a published roadmap to ZK proofs (Succinct / OP Succinct) that would cut the withdrawal wait from about 7 days to about 1 hour. If that has shipped by the time you run this, the timelines below get much shorter. Check the parameters every quarter.

---

## 1. Step-by-step flow and operator actions

Assume the **ops wallet on Celo** is a Safe multisig and the **treasury on L1** is the custodian's address. You also need an **L1 "relayer" hot wallet** holding a little ETH to submit the prove and finalize transactions. Anyone can submit those, and the funds still go only to the recipient named in step 1.

| Stage | When | Who / what | Operator action |
|---|---|---|---|
| **Pre-flight** | T-3 business days | Treasury ops | Confirm the custodian has the **L1 CELO ERC-20 contract** whitelisted on the treasury address, since they won't credit a token they don't recognise. Confirm the Safe signers are available on T0. Top up the relayer with enough ETH for 2 L1 transactions at current gas plus headroom (budget roughly $50–150). Keep enough CELO in the ops wallet for L2 gas. Record the Celo balance for the month-end cut-off. |
| **1. Initiate** | T0 (last business day, **morning**) | Safe on Celo | Withdraw native CELO with the recipient set to the **L1 treasury address**. Use the official Celo bridge UI (Superbridge) or an SDK (viem `op-stack` actions / `withdrawTo` on `L2StandardBridge`, or `L2ToL1MessagePasser.initiateWithdrawal`). Sign it, execute it, and **record the L2 tx hash**. Everything downstream depends on that hash, so put it in the close ticket. The balance leaves the Celo wallet at this point. |
| **2. Wait for state root** | T0 + ~1 h (varies) | Protocol | The proposer has to post an output root / dispute game on L1 that covers your L2 block. You can't prove until it does. Poll the bridge UI or `getWithdrawalStatus` until the status is `ready-to-prove`. |
| **3. Prove** | Same day once ready (T0 + 1–2 h) | Relayer on L1 | Submit `proveWithdrawalTransaction`. **Record the L1 tx hash and the timestamp.** The ~7-day clock starts here, not at initiation. If you prove late, you finalize late. |
| **4. Challenge period** | T0 → T0 + 7 d | Protocol | Nothing to do except monitor. Set a daily check that the dispute game your proof points to hasn't been invalidated or blacklisted, and that `respectedGameType` hasn't changed. If either happens, you have to **re-prove**, and the 7-day clock restarts. Rare, but that's exactly the case that makes a close late without anyone noticing. |
| **5. Finalize** | ≥ 7 d after the prove tx (and after the game resolves) | Relayer on L1 | Submit `finalizeWithdrawalTransaction`. If you submit too early, it reverts and only wastes gas. Once it lands, L1 CELO is transferred to the treasury address. **Finalization doesn't happen automatically.** If nobody sends this transaction, the funds stay unclaimed in the portal indefinitely. Put it on the calendar with an owner and a backup. |
| **6. Reconcile** | Finalize day | Treasury ops + custodian | Confirm the custodian credited the treasury. Match the amount against the L2 initiation (it should be exact, since gas is paid separately). Close the ticket with all 3 tx hashes attached. |

### Timeline for a typical month

- **Last business day (e.g. Wed 30th)**: initiate at 10:00, prove by about 12:00.
- **Wed 7th of the next month, ~12:00+**: finalize. Funds appear in the treasury within minutes.
- **Total in flight: about 7 days and a few hours.** If the last business day is a Friday, finalization falls on the following Friday. That's fine because the transactions are on-chain and don't depend on business days, but staff the finalize step.

This fits "before the next month's books close" only if your close takes at least 7–8 calendar days. If finance closes on business day 3–5, it **won't fit**. Either move T0 earlier (see §3) or book it as in-transit.

### Accounting note for finance

At month end the CELO is **in neither wallet**. It's sitting in the bridge contracts as a pending withdrawal. Finance needs an explicit **"digital assets in transit"** line, with the L2 initiation tx as evidence of existence and the finalize tx as evidence of receipt. Agree on this with the auditors before the first close, not afterwards.

### Controls

- **Test first.** Before the first real sweep, run a small withdrawal (e.g. 10 CELO) end-to-end to the actual treasury address. It confirms the recipient address, the token the custodian sees, and your tooling. Re-run it whenever addresses or contracts change.
- **Recipient address** comes from a whitelist and gets checked by two people. A wrong L1 recipient is **irrecoverable**.
- **One withdrawal per month.** Splitting doesn't reduce time and does multiply operator steps. If you want to limit how much is exposed to a single bad transaction at $2M, the test transfer already covers it.
- Keep a runbook entry for **"proof invalidated → re-prove"** and for **"relayer out of ETH"**.

---

## 2. The risk nobody asked about: price exposure

The money is in flight for 7+ days **as CELO, not as dollars**. CELO is a volatile small-cap asset. At a rough 60–80% annualised volatility, a one-standard-deviation move over 7 days is about **8–11%**. On a $2M sweep that's **roughly ±$200k per month**, before anyone even gets to sell it. Finance should decide explicitly whether the treasury wants CELO exposure at all. If it wants USD, the whole design changes (next section), and it also fixes the speed problem.

Also check L1 liquidity. If the plan is to sell on mainnet afterwards, CELO trades much more deeply on Celo itself and on CEXs than as an ERC-20 on Ethereum DEXs. Bridging $2M of CELO to L1 in order to sell it there is the wrong order of operations.

---

## 3. If finance says "same-week"

The native bridge **cannot** do same-week unless Celo's ZK-proof upgrade has shipped. Your options, best first:

1. **Ask whether it needs to move at all.** Most institutional custodians (Anchorage, BitGo, Coinbase Prime, Fireblocks-based setups) support Celo natively. If the custodian can see a Celo address, the "sweep" becomes an ordinary Celo transfer that settles in seconds, with no bridge involved. This is the cheapest fix, so check it first.

2. **Convert to USDC on Celo, then move dollars instead of CELO** *(recommended if finance wants USD)*.
   - Sell CELO for native USDC on Celo, via an OTC desk for $2M-size clips, or via on-chain DEX / Mento routing with TWAP-style chunks to limit slippage.
   - Move the USDC to Ethereum through **Circle CCTP** if it supports Celo at the time you run this (minutes, burn-and-mint, no wrapped token). Otherwise use a **Circle Mint account**: redeem on Celo and mint or withdraw on Ethereum (hours, business-day dependent).
   - This removes the 7-day lag *and* the price risk at the same time. The custodian receives canonical USDC on mainnet.

3. **Route through an institutional exchange or OTC desk.** Deposit CELO on the Celo network and either withdraw on Ethereum (as ERC-20 CELO, or as USDC after selling). This takes minutes to hours. Your costs are counterparty exposure while the funds are on the venue, KYB onboarding, and withdrawal limits you'll need raised ahead of time for $2M.

4. **Keep the native bridge but move T0 earlier.** Cut revenue off around the 20th and initiate then, so funds land before month end. Or sweep **weekly** on a rolling basis, so that at close only the last few days of revenue are in transit. Still a 7-day lag, but it stops being a close problem. This makes a good complement to options 1–3.

**Not recommended at $2M:** third-party fast bridges or intent/solver bridges for CELO. Solver liquidity for ERC-20 CELO on L1 is thin, so you'd pay large spreads or get partial fills. Lock-and-mint bridges (e.g. Wormhole-wrapped CELO) give you a **non-canonical wrapped token** that the custodian may not recognise, and they add a bridge's security assumptions to $2M a month.

### My recommendation

- **Now (monthly, CELO):** native bridge using this runbook, T0 moved about 8 days before the close deadline or treated as in-transit, with owners named for the prove and finalize steps.
- **Before it reaches $2M:** have finance decide on CELO vs USD. If USD, switch to *sell on Celo → USDC → CCTP/Circle Mint*. That's same-day, has no bridge delay, and removes the ±$200k/month price swing. If they want to keep CELO, first ask the custodian whether they can hold it on Celo directly.
