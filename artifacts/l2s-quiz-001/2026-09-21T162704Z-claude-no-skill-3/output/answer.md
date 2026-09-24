# Runbook: Monthly CELO sweep, Celo → Ethereum mainnet treasury

## 0. What has to be true before you write anything

**Celo is an Ethereum L2 now, not a separate L1.** It moved to the OP Stack in March 2025. So the "official" way to move CELO to mainnet is the **native OP Stack withdrawal**, and native withdrawals have a **challenge period of about 7 days**. The whole runbook is shaped by that fact. Treat it as the base design and pick something else only on purpose.

Settle these three questions with finance and the custodian before the first run. Each one can change the design.

1. **Do they want CELO on mainnet, or dollars?** Revenue is in CELO, and CELO's price moves. A $2M sweep that spends 7+ days in flight is a $2M unhedged position for that whole time. If finance really wants USD value, the right move is usually to convert on Celo first and move a stablecoin (see §4). Don't bridge a volatile asset for a week just to sell it at the other end.
2. **Does the custodian support the canonical CELO ERC-20 on Ethereum?** The native bridge releases the canonical L1 CELO token. Third-party bridges often deliver a *wrapped* version instead, which the custodian may not recognize or value. Get the exact token contract address the custodian supports, in writing.
3. **Can the custodian just custody on Celo directly?** Some custodians support Celo. If yours does, or can, you don't need a bridge at all. Ask before building any of this.

Before each run, confirm the live parameters instead of trusting this document (or me). Check Celo's current docs and the L1 contracts (`OptimismPortal` proof-maturity/finalization delay, dispute game type, and whether output proposals are permissioned). Chain parameters and fault-proof setups do change.

---

## 1. How the native withdrawal works

One withdrawal takes **three transactions on two chains**:

| # | Step | Chain | Who pays gas | What happens |
|---|------|-------|--------------|--------------|
| 1 | **Initiate** | Celo (L2) | Ops wallet, in CELO | CELO is burned/locked on L2 and a withdrawal message is recorded in `L2ToL1MessagePasser`. **The recipient L1 address is set here.** |
| 2 | **Prove** | Ethereum (L1) | Any funded L1 wallet, in ETH | You wait until an L2 state root (output root / dispute game) covering your L2 block is posted to L1, usually on the order of an hour. Then you submit a Merkle proof of your withdrawal against it. **The ~7-day clock starts only when this proof lands.** |
| 3 | **Finalize** | Ethereum (L1) | Any funded L1 wallet, in ETH | After the challenge period, call finalize on `OptimismPortal`, which releases the CELO to the recipient set in step 1. Anyone can submit this transaction, but the funds only go to the recipient. |

Tooling: use Superbridge (Celo's bridge front end) for manual runs. For scripted runs, use viem's OP Stack actions (`initiateWithdrawal`, `getWithdrawalStatus`, `proveWithdrawal`, `finalizeWithdrawal`) or the Optimism SDK, pointed at Celo's published contract addresses. Whatever you use, the operator needs the **L2 initiate tx hash**. It's the key for everything after step 1.

### Time in flight

- Initiate → provable: about 1 hour, sometimes longer, depending on how often Celo posts proposals to L1.
- Prove → finalizable: about **7 days** (the challenge period).
- Finalize → in the wallet: minutes.
- **Total: about 7 days plus a few hours, if the operator proves promptly.** Every hour you delay the prove step is an hour added to the end.

Two ways it can take longer:
- **The operator forgets to prove.** The withdrawal just sits there. No clock is running, and nothing fails loudly.
- **Fault-proof games.** If the dispute game you proved against is later challenged successfully or blacklisted, you have to **re-prove against a newer game, and the 7-day clock restarts.** This is rare, but it's why the runbook includes monitoring.

---

## 2. Operator runbook, monthly close

### Standing prerequisites (keep these true all month)
- The ops wallet on Celo has enough CELO for gas beyond the sweep amount. Don't sweep to zero.
- An L1 "relayer" wallet holds ETH for the prove and finalize gas. Budget for two contract calls at mainnet gas prices, with headroom. The prove call is the heavy one.
- The **treasury recipient address is on an allowlist** and has been verified out of band with the custodian (voice or second channel, never an emailed address).
- **If the ops wallet is a Safe or other smart contract wallet:** never assume "same address on L1". Contract wallet addresses don't carry across chains. Always pass the treasury address as the explicit L1 recipient in step 1.
- **First time, and after any change to address, tooling, or contracts:** do a small test withdrawal, run it all the way through finalize, and confirm the custodian credits it before sending the full amount.

### Day 0: last business day (T)
1. **Freeze the amount.** Record the ops-wallet CELO balance at a fixed cut-off time, minus the gas reserve. Get finance to sign off on the amount and the recipient (maker/checker, two people).
2. **Initiate on Celo.** Sign with the ops wallet's approval flow (multisig recommended at $2M). Record the L2 tx hash, amount, recipient, and timestamp in the close ticket.
3. **Check** the L2 tx succeeded and the ops-wallet balance dropped by the right amount.
4. **Wait until the withdrawal is provable**, usually about an hour. Poll `getWithdrawalStatus` (it moves from `waiting-to-prove` to `ready-to-prove`) or watch in Superbridge.
5. **Prove on L1 the same day.** Record the L1 prove tx hash and timestamp, then compute the **earliest finalize time = prove time + challenge period.** Put a calendar hold and an alert on it for both the primary and the backup operator.
   - If Day 0 is running late, the prove step can be done by anyone with the tx hash and an ETH-funded wallet, including out of hours. Don't let it slip to the next business day, because every delay pushes the arrival date back.

### Days 1–7: in flight
6. **Daily check** (can be automated): status should read `waiting-to-finalize`, and the proven game should not be challenged or blacklisted. If it is, re-prove right away and reset the finalize date. Escalate to treasury, since the landing date just moved.
7. **Month-end accounting:** on the balance-sheet date the funds are **in transit**. They're on neither chain's wallet balance. Give accounting the L2 initiate tx, the L1 prove tx, and the expected finalize date as supporting evidence. Agree the treatment (such as a "digital assets in transit" line) with the controller once, not every month.

### Day ~7 (T + 7 days + a few hours)
8. **Finalize on L1** as soon as `ready-to-finalize` shows. Record the tx hash.
9. **Confirm receipt:** the treasury wallet's canonical CELO ERC-20 balance went up by the swept amount, and the **custodian confirms the credit**. Close the ticket with all three tx hashes.

### Does this fit the close calendar?
Kicking off on the last business day means funds land about 7–8 calendar days into the next month, which is roughly business day 5–6. If the books close around business day 5, **this is too tight.** Weekends, holidays, one missed prove, or one re-prove will cause a miss. Options:
- **Move the cut-off earlier**, for example initiate about 10 calendar days before month-end. CELO accrued after the cut-off rolls into next month's sweep, and funds arrive before month-end with nothing in transit on the balance-sheet date. This is the cleanest option for the books.
- Or keep the last-business-day kickoff and accept an in-transit balance at every month-end, with the evidence pack above.

---

## 3. Controls for a $2M sweep

- **Market risk is the biggest risk, bigger than bridge risk.** About 7 days of CELO price exposure on $2M is real P&L variance. Either finance explicitly accepts it, or you hedge, or you convert first (§4).
- The native bridge is the trust-minimized path. It has no liquidity cap and no third-party custody, which is why it's the default at this size. You're relying on Ethereum plus the OP Stack contracts and Celo's upgrade keys, not on a bridge operator's multisig.
- Multisig on the ops wallet and on the L1 relayer if possible. Allowlisted recipient. Two-person sign-off on amount and address.
- Automate the prove and finalize steps with a bot. They need no special key, since anyone can prove or finalize and the funds still only go to the recipient. Keep a human for initiation and sign-off.
- Alerting on: the provable state not being proved within N hours, dispute game status changes, finalize-ready, and custodian credit not being confirmed within N hours of finalize.

---

## 4. If finance says "we need it same-week"

The ~7-day native challenge period can't be shortened, so a same-week target means **not using the native withdrawal for the full amount.** In order of what I'd recommend:

1. **Ask the custodian to hold on Celo, or add Celo support.** This removes the bridge entirely. The funds are "visible to the custodian" as soon as the sweep lands, in minutes.
2. **If finance actually wants dollars: convert on Celo, then move a stablecoin by a fast route.** Sell CELO for native USDC (or USDT) on Celo through an OTC desk, or through DEX liquidity in tranches (check slippage at $2M, since DEX depth may not support it in one go). Then move the stablecoin to mainnet by a route that doesn't wait on the OP challenge period. For USDC, that means Circle's native cross-chain transfer if it supports Celo at the time, or a Circle Mint / exchange redeem-and-reissue. This also removes the week of CELO price exposure, which is probably what finance should want anyway.
3. **Exchange or OTC desk as the "bridge".** Deposit CELO on the Celo network to an institutional exchange or OTC counterparty, then withdraw to the Ethereum treasury, as canonical CELO if the venue supports that, or as USD/USDC. This takes hours, not days. The costs are counterparty and custody risk while funds sit at the venue, KYB/onboarding, and withdrawal limits. It's fine at $2M with an established institutional account. Confirm limits in advance.
4. **Fast / intent-based bridges** (liquidity networks where a relayer fronts you funds on L1 and waits out the challenge period itself). These take minutes to hours, for a fee. The caveats at $2M: check liquidity depth and per-transfer caps (you'll likely need to split into tranches), confirm the asset delivered is the **canonical** CELO ERC-20 and not a wrapped token, and review the bridge's security model (this is where most historical bridge losses came from). Only use one the custodian has confirmed it accepts on the receiving side.
5. **Hybrid (a good default if they won't convert):** keep the native bridge for the bulk, but start it earlier (the cut-off move in §2) so the 7 days fit. Use a fast route only for the leftover amount that has to land same-week.

**My recommendation:** push back on the premise first. Check with finance whether the target is "CELO on mainnet" or "USD at the custodian". If it's USD, convert on Celo and move stablecoins, which is fast and has no week of price exposure. If it must be CELO on mainnet, keep the native bridge, move the kickoff about 10 days before month-end, and automate the prove and finalize steps. Only reach for fast bridges or exchanges for the same-week exceptions, with tranche limits and a custodian-confirmed token address.
