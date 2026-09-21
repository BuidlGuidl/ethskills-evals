# Monthly CELO sweep: Celo → Ethereum mainnet treasury

## 0. Framing that changes the design

- **Celo is an Ethereum L2 now, not a separate L1.** It moved to the OP Stack on 2025-03-26. So the canonical way to move funds to mainnet is Celo's own **L2→L1 withdrawal** through its OptimismPortal. You don't need a third-party wrapped-asset bridge. CELO is the gas token on Celo and a normal ERC-20 on Ethereum. The withdrawal releases the real L1 CELO ERC-20, not a wrapped IOU.
- **A withdrawal takes three transactions on two chains, not one send.** You initiate it on Celo, then **prove** it on L1, then **finalize** it on L1. Nothing on L1 happens by itself. Your operator (or a script) has to submit both L1 transactions. If nobody does, the money just waits in the portal.
- **The money is in flight for about 7 days, and the 7 days start at the prove step, not at initiation.** Figures read off Celo's portal on 2026-08-24:
  - `proofMaturityDelaySeconds` = 604,800 → **7 days from your prove transaction**.
  - The OP Succinct dispute game has `maxChallengeDuration` = 302,400 (3.5 days), then a further `disputeGameFinalityDelaySeconds` = 302,400 (3.5 days) after the game resolves.
  - You can finalize only once **both** gates have passed, so the later one sets the wait: about 7 days. The "Celo exits in 3.5 days" figure you'll see quoted is just the challenge window on its own. Don't put 3.5 days in the runbook.
  - These are governance parameters and can change. The runbook should **read them live every month** instead of hardcoding them. viem's OP Stack actions `getTimeToProve` / `getTimeToFinalize` read them from Celo's own contracts.
- **Check that the custodian supports the CELO ERC-20 on Ethereum** (contract address from Celo's official docs) and credits deposits of it. Do this before anything else. If they don't, the canonical route delivers an asset the custodian can't see, and the design in §5 becomes the main plan, not the fallback.
- **Finance is holding CELO price risk for the whole ~8 days** from the snapshot to landing. At $2M that is a real P&L exposure. Ask finance whether they want *CELO* in the treasury or *dollars*. The answer drives most of §5.

## 1. What the transfer actually is

| Stage | Chain | Who acts | What happens | Typical wait before the next stage |
|---|---|---|---|---|
| 1. Initiate | Celo | Ops wallet signer(s) | Withdrawal tx sends CELO into the L2→L1 message passer / bridge, with the **L1 recipient set to the treasury address** | Until a dispute game covering that L2 block is posted on L1 (usually on the order of an hour; read live with `getTimeToProve`) |
| 2. Prove | Ethereum | Operator (any funded EOA/relayer) | `proveWithdrawalTransaction`: Merkle proof of the withdrawal against the posted game's output root. **Starts the 7-day clock.** | About 7 days (the later of proof maturity and game resolution + finality delay) |
| 3. Finalize | Ethereum | Operator | `finalizeWithdrawalTransaction`: portal releases the L1 CELO to the treasury address | None. The funds are in the treasury wallet in the same block |

Notes that belong in the runbook:

- **Set the recipient explicitly.** If the Celo ops wallet is a Safe or any other contract wallet, the same address on mainnet may not exist, or may be controlled by someone else. Always pass the treasury address as the L1 `to`. Don't rely on the "withdraw to myself" default in a bridge UI.
- **Prove and finalize don't need the treasury/custodian key.** Any funded mainnet account can submit them, and the funds still go to the recipient fixed at initiation. Use a small ops EOA on mainnet that holds ETH for gas. The custodian never signs anything.
- **Finalize from the same account that proved.** On current OP Stack portals, `finalizeWithdrawalTransaction` looks up the proof recorded for `msg.sender`. If a different account finalizes, it has to use `finalizeWithdrawalTransactionExternalProof(tx, prover)`.
- **Keep gas funded:** CELO on the Celo ops wallet (tiny), and ETH on the mainnet ops EOA for prove and finalize. Proving is the heavier call. Budget a few hundred thousand gas for each call and check the current base fee.
- **Tooling:** viem's OP Stack actions (`buildInitiateWithdrawal` / `initiateWithdrawal`, `waitToProve`, `proveWithdrawal`, `waitToFinalize`, `finalizeWithdrawal`) with the `celo` chain definition. Alternatively, use the bridge UI Celo's docs point to. Take the portal and bridge addresses **only from Celo's official docs** and pin them in the runbook. Check the pinned addresses against the docs each quarter.
- **One withdrawal or several:** a single withdrawal is fine at this size. The proof cost is the same for any amount. Splitting into 2–3 lets you run a small first tranche as a canary, which is worth it for the first live runs.

## 2. Timeline for a monthly close

Worked example: the last business day is Friday, 30 Oct 2026.

| When | Step | Operator action |
|---|---|---|
| T-5 business days | Pre-flight | Confirm the custodian credits the CELO ERC-20 at the treasury address. Check that the Celo ops wallet holds CELO for gas and the mainnet ops EOA holds ETH. Read the live `proofMaturityDelaySeconds`, `maxChallengeDuration`, `disputeGameFinalityDelaySeconds` and portal pause status. Get the sweep amount approved (balance minus an operating float for gas and refunds). |
| T0 (Fri 30 Oct, morning, US hours) | Initiate on Celo | Submit the withdrawal (multisig if the ops wallet is a Safe). Record the L2 tx hash, block number and withdrawal hash in the close ticket. Finance books the amount as "in transit" at this point. |
| T0 + ~1–few hours | Prove on L1 | Once `getTimeToProve` hits zero (a game covering the block is posted), submit the prove tx. Record the tx hash, the dispute game address and the **earliest finalize time** (from `getTimeToFinalize`). Put a calendar hold for that time. |
| T0 → finalize | Monitor | Check daily that the game used for the proof hasn't been challenged, resolved against, or blacklisted by the Guardian, and that the portal isn't paused. If the game fails, you must **re-prove against a newer game, and the 7-day clock restarts.** Put this in the runbook as an escalation path. |
| ≈ Fri 6 Nov, same time of day as the prove | Finalize on L1 | Submit the finalize tx (same account as the prover). Confirm the ERC-20 `Transfer` to the treasury in the tx receipt. |
| Finalize + custodian SLA | Custodian credit | Confirm the custodian shows the balance. Finance clears "in transit" and reconciles the amount against the L2 initiation. |

**How long the money is in flight:** about **7 days plus 1–few hours** from initiation to mainnet. Add operator latency on top (weekends, time zones) and the custodian's crediting lag. Plan on **8 calendar days**. The fixed piece is the 7 days after prove, and no operator effort can shorten it.

**Does it fit the close?** The funds land around the 6th–8th calendar day of the next month. If the books close at business day 5 or later, it usually fits, but with little slack. A challenged game, a missed finalize over a weekend, or a portal pause will push it past close. Two ways to add margin:

1. **Move the cut-off earlier.** Sweep the balance as of T-5 business days, and carry the last few days of revenue in the next month's sweep. The sweep then lands around the 1st–3rd.
2. **Make it continuous:** initiate a withdrawal every week (or every day), not once a month. A small number of withdrawals is always in the pipeline, and at close only the last ~8 days are in transit. This costs a few more L1 prove/finalize transactions, which is trivial next to a $2M balance. It also cuts the CELO price exposure per tranche.

Automate the two L1 steps. A script or keeper that polls `getTimeToProve` / `getTimeToFinalize` and submits as soon as each is ready takes the "someone forgot to finalize on Friday night" risk out of the close. The human steps are the initiation sign-off and reconciliation.

## 3. Failure modes to write down

- **Proof game invalidated:** re-prove against a newer game. The clock restarts, so expect +7 days.
- **Portal paused by the Guardian:** nothing to do but wait. Escalate to finance that the close may slip.
- **Wrong recipient:** can't be undone after initiation. Require a second-person check of the L1 `to` address against the treasury address on file.
- **Mainnet ops EOA out of ETH:** prove or finalize stalls. Put a balance alert on it.
- **Custodian doesn't credit the token:** caught by the pre-flight check and a first-month canary tranche (e.g. 100 CELO run through the whole flow a week earlier).

## 4. What changes at $2M

The canonical route doesn't care about size: same three transactions, same ~7 days, and no liquidity or relayer limits. It stays the right default at $2M **if finance wants CELO on mainnet and can live with about a week in transit.** What grows with size is the **price exposure** during the transit week and the **operational blast radius** of a mistake. Answer both with the weekly cadence, the canary tranche, the two-person recipient check, and automated prove/finalize.

## 5. If finance needs it same-week

The canonical exit alone can't meet "same-week" from a last-business-day start. The 7-day floor is built into the protocol. The options, in the order I'd recommend them:

1. **Pipeline the canonical route (no new trust).** Initiate withdrawals daily or weekly all month. At any close, everything except the last ~8 days' revenue is already on mainnet. If "same-week" means "most of the month's revenue is visible at close", this solves it with no new trust assumptions. It doesn't help with a one-off lump that has to move fast.

2. **Convert to dollars on Celo, then move a stablecoin natively (minutes to hours).** If finance really wants USD, swap CELO → USDC on Celo, then move the USDC to mainnet on Circle's native burn-and-mint route (CCTP), if it is live for Celo. Check Circle's current supported-chains list before you commit. It takes minutes, and the added trust is in Circle, not in a bridge. It also removes the CELO price exposure and the question of whether the custodian supports CELO. The catch: **slippage on the CELO→USDC swap at $2M.** Measure the actual depth on Celo's DEXes/Mento at that size and spread the conversion over days (TWAP) if needed. Better still, convert daily as revenue comes in. That combines well with option 1.

3. **Fast/intent bridge (Across, Squid, LayerZero/CCIP routes, etc.).** It buys back the 7 days for a fee. The added trust is in the relayer or solver network and the messaging layer's verifiers, not just Ethereum. At $2M in **CELO**, a long-tail gas token, relayer inventory is where this breaks. Get a real quote for the actual asset and the actual size before relying on it. Expect partial fills or bad pricing, and don't assume a route exists because the chain is listed.

4. **Exchange hop.** Deposit CELO to an exchange on the Celo network and withdraw on Ethereum (as CELO, or as USDC after selling). Usually hours. The added trust is custody by the exchange while the funds sit there. You also get KYC/withdrawal limits and deposit-confirmation policies. It's viable if the company already has an institutional account, but it's the one option that puts $2M in someone else's custody.

**My recommendation:** keep the canonical withdrawal as the default and run it on a **weekly cadence with automated prove/finalize**. That alone makes the monthly close comfortable. If finance says "same-week" and means dollars, switch to **daily CELO→USDC conversion on Celo plus native USDC transfer to mainnet**, after checking that the route is live for Celo and measuring the swap depth at $2M. Keep fast bridges for small top-ups, and state their trust assumption in the runbook whenever they're used.

## 6. Values to re-read every run (don't hardcode)

- `proofMaturityDelaySeconds`, `disputeGameFinalityDelaySeconds` (OptimismPortal / AnchorStateRegistry)
- The dispute game's `maxChallengeDuration`, and the status of the game used for your proof
- Portal pause status
- Portal, bridge and L1 CELO token addresses (from Celo's official docs)
- `getTimeToProve` / `getTimeToFinalize` for the specific withdrawal
- Custodian support for the delivered asset
