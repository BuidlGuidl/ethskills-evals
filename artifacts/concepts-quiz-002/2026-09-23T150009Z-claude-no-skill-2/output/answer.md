# Operational read: USDC vault, month 1, Ethereum mainnet

## The short version

At $8,000 TVL on mainnet, this vault spends more on gas in its first month than it
earns in yield — by roughly an order of magnitude. That is not a tuning problem, it
is a consequence of putting an $8k position on a chain where a transaction costs
$5–15. Two things follow:

1. **The permissionless 1% harvest bounty will never fire.** It is worth ~$0.27/month
   against a ~$12 gas cost. No keeper will touch it. You will be the keeper, out of
   your own pocket, and you should plan and budget for that explicitly.
2. **Most of your depositors will lose money in year one**, because their own
   entry/exit gas exceeds the yield their deposit earns.

The highest-leverage change before launch is the chain, not the contract. On Base or
Arbitrum every number below improves by 2–3 orders of magnitude and the design you
described works as intended. If mainnet is non-negotiable, the rest of this document
is what you are signing up for.

---

## Assumptions used

| Input | Value | Note |
|---|---|---|
| TVL, month 1 | $8,000 | your figure |
| Strategy APY | 4% | your figure; variable, not a promise |
| ETH price | $3,000 | sensitivity below |
| Base fee | 10 gwei | typical; spikes to 30–50 gwei happen |
| `harvest()` gas | ~400k | claim + (swap?) + redeposit + accounting |
| `approve` + `deposit` | ~166k | 46k + 120k |
| `redeem` / `withdraw` | ~100k | |

Derived costs at 10 gwei / $3,000 ETH: **harvest ≈ $12**, **depositor entry ≈ $5**,
**depositor exit ≈ $3**, **round trip ≈ $8**. At 30 gwei those triple. Everything
below scales linearly with gas price, so treat these as a mid-case, not a floor.

Yield at $8,000 × 4%: **$320/year, $26.67/month, $6.14/week, $0.88/day.**

---

## What actually happens once it's live

**Day 0 — deployment.** If the vault is a stock ERC-4626 with no virtual-share offset
and no seed deposit, there is a window between deployment and your first real deposit
where the classic inflation/donation attack is live: someone mints 1 wei of shares,
transfers USDC directly into the vault, and the next depositor's shares round to zero.
At $8k scale this is cheap to execute. See fix #6.

**Week 1.** Deposits trickle in. Say 20–30 wallets averaging $270–400. Each one pays
~$5 in gas to get in, and several of them have to acquire ETH first, which is its own
friction and its own cost. Collectively the depositor cohort has now spent ~$100–150
on gas to enter a pool that will generate $26 this month.

Nobody calls `harvest()`. Not because they haven't noticed yet — because no keeper bot
on mainnet has your vault in its registry, and if one did, the math would tell it not
to bother.

**Weeks 2–4.** Claimable rewards accrue toward ~$26. The bounty on a full-month harvest
peaks at **$0.27** against a **$12** gas cost — a keeper calling it loses ~98% of their
money. The bounty would need roughly **$360,000 of TVL** to break even on a monthly
cadence, and closer to **$1M** before a rational keeper finds it worth automating. You
are 45× below the break-even point.

So you call it yourself. You pay $12 of gas to move $26 of yield into the share price
and pay yourself a $0.27 bounty out of your depositors' returns.

There's a subtlety here worth being precise about: **the value of `harvest()` is not
compounding, it's realization.** Compounding monthly instead of annually at 4% is worth
4.074% vs 4.000% — seven basis points, or **$6 per year** on $8k, less than one harvest
transaction. If your strategy's yield accrues into an exchange rate (aToken-style), the
4% is already in the share price and harvest frequency is nearly irrelevant. If the
rewards are a *separate token that must be claimed*, then until someone harvests, your
vault's share price is flat and depositors see **0% APY**, no matter what the strategy
is earning. Know which of those two you're shipping — it changes whether an unharvested
vault is merely suboptimal or visibly broken.

**Month-end reckoning.**

| | |
|---|---|
| Gross yield generated | +$26.67 |
| Protocol gas (1–2 harvests) | −$12 to −$24 |
| Depositor entry gas (20–30 txs) | −$100 to −$150 |
| **Net value to the depositor cohort, month 1** | **≈ −$100 to −$150** |

And the first person to withdraw pays another $3–5 to find out their $300 deposit
earned $1.

---

## What this means for your depositors

A deposit of size *D* needs to be held for **$8 ÷ (D × 0.04)** years just to repay its
own round-trip gas:

| Deposit | Yield/yr | Break-even hold |
|---|---|---|
| $100 | $4 | 2.0 years |
| $250 | $10 | 9.6 months |
| $500 | $20 | 4.8 months |
| $1,000 | $40 | 2.4 months |
| $5,000 | $200 | 15 days |

At a $8,000 total across a realistic number of wallets, your **median depositor is in
the top half of that table** — they are underwater for most of the first year, and if
they enter or exit during a 40 gwei window, longer. For gas to be a tolerable <5% drag
on the first year's return, a mainnet depositor needs a ticket of roughly **$4,000+**.

That's the product you're actually building on mainnet: a **$5k-minimum-ticket,
$1M+-TVL** vault. The $8k-with-small-tickets version is a Base/Arbitrum product. These
are not the same launch.

If some of this first $8k is friends and family, say this to them out loud before they
deposit. Someone putting in $200 as a favor should know it's net negative.

---

## Design issues worth fixing regardless of chain

**Just-in-time harvest extraction.** `harvest()` compounds a lump sum, which steps the
share price up instantaneously. Anyone can deposit in the block before and redeem in
the block after, capturing a pro-rata slice of yield they never earned. At $8k TVL with
a $26 harvest, an attacker depositing $800k captures ~99% of it — about $18 net of gas.
Not worth anyone's time *today*, which is exactly why you should fix it today: at $10M
TVL with weekly harvests it's real money, and it costs nothing to add now. The standard
fix is to release harvested profit linearly over a lock window (Yearn's locked-profit
degradation) rather than in a step, which also has the nice side effect of smoothing
your reported APY.

**Harvest dust and the swap path.** If `harvest()` routes reward tokens through a DEX,
a $26 swap is an awkward size: fixed slippage guards can revert on dust, routers quote
small amounts poorly, and the gas of the swap leg is a large fraction of the proceeds.
Gate harvest on a **minimum claimable value**, not a timer.

**Unaudited code is binary risk.** $8k of TVL doesn't justify a $30–80k audit, and
nobody expects you to get one at this size. But the code you skip auditing at $8k is
the same code holding $2M later, and by then it has depositors who assume someone
looked. Bound the exposure explicitly instead: a hard on-chain deposit cap sized to
what you could afford to make people whole on.

---

## Recommendations, ranked

1. **Deploy to Base or Arbitrum instead of mainnet.** Harvest goes from $12 to a couple
   of cents; the 1% bounty becomes economically live at a few thousand dollars of TVL
   instead of $360k; depositor round-trip gas goes from $8 to ~$0.02, so a $200 deposit
   is viable. Every quantified problem in this document is a mainnet problem. If the
   strategy only exists on mainnet, that's a real constraint — but then it should drive
   the decision consciously, not by default.

2. **Stop treating the permissionless bounty as your harvest mechanism.** Below ~$350k
   TVL it is decorative. Plan to run the keeper yourself, budget the gas as an operating
   expense (~$50–150/year at a sane cadence), and say in your docs that harvests are
   currently team-operated. Leave the permissionless path in — it costs nothing and
   becomes real if you grow — but don't depend on it.

3. **Harvest quarterly, gated on claimable value.** Only harvest when claimable exceeds
   ~5× expected gas. Weekly harvesting at this TVL costs ~$624/year against $320/year of
   yield — strictly value-destroying. Quarterly costs ~$48/year (15% of yield). Remember
   you are harvesting to *realize* rewards, not to compound them; compounding is worth
   $6/year here.

4. **Set a minimum deposit (~$500–1,000), or at minimum show a gas break-even
   calculator** on the deposit screen. Don't let someone silently deposit $150 on
   mainnet.

5. **Stream harvested profit** over 6 hours to 7 days instead of stepping the share
   price, to close the JIT window before it's worth exploiting.

6. **Use OpenZeppelin's ERC-4626 with the decimals offset, and seed the vault yourself
   in the deployment transaction** (a small self-funded deposit whose shares you never
   redeem). Closes the donation/inflation attack.

7. **Ship the safety rails now:** on-chain deposit cap, pause, emergency withdraw, owner
   set to a 2-of-3 multisig rather than the deployer EOA, and a timelock if anything is
   upgradeable. Decide *before* launch who is on call and what the runbook is when the
   underlying lending market freezes at 3am.

8. **Don't publish "4% APY."** It's a spot rate on a variable strategy. Publish realized
   7- and 30-day APY net of the harvest bounty and any fees, and show a net-of-gas
   figure for a representative deposit size. The gap between the two is the honest
   number, and at this size it's most of the number.

## The one-line version

The vault will work mechanically and lose money economically: nobody will call
`harvest()`, you'll pay for it yourself, and your depositors' own gas will exceed their
yield for most of year one. Move it to an L2, or reframe it as a large-ticket mainnet
product — and either way fix the JIT-harvest and first-deposit issues before there's
anything in it worth taking.
