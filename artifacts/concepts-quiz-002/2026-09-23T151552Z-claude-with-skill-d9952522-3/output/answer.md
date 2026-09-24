# USDC yield vault — operational read on month one

## The short version

At $8,000 TVL on Ethereum mainnet, `harvest()` never gets called. Not "rarely" —
the 1% caller fee is worth cents and the transaction costs dollars, so no rational
stranger ever sends it. Rewards sit unclaimed in the strategy, depositors see 0%
realized yield, and the gas each depositor spends getting in and out is larger
than a year of their yield. The design is sound; the chain and the TVL are wrong
for it.

Two changes fix almost all of it: **deploy to an L2** and **vest harvested rewards
over a few days** instead of crediting them instantly.

**Assumptions used below.** ETH at $3,000; mainnet base fee at 5 / 15 / 40 gwei to
bracket quiet, normal and busy. `harvest()` at ~300k gas (claim + swap + redeposit),
deposit ~150k, withdraw ~120k, ERC-20 approve ~46k. Re-run the tables with live
numbers the day you deploy — the conclusion is not close, but the exact figures move.

---

## 1. What the vault actually earns

| | |
|---|---|
| TVL | $8,000 |
| Gross yield at 4% APY | $320 / year |
| | $26.67 / month |
| | **$0.88 / day** |

Every number in this document is a fraction of $0.88 a day. That is the constraint
the whole design has to live inside.

## 2. `harvest()` never fires

`harvest()` is a state transition, so ask the three questions about it:

- **Who sends it?** Anyone — it's permissionless. Good.
- **Why would they?** They keep 1% of what the call claims. Good shape.
- **Is that enough?** No. Put the reward and the gas next to each other:

| Accrual since last harvest | Claimed | Caller keeps (1%) | Gas @5 gwei | Gas @15 gwei | Gas @40 gwei |
|---|---|---|---|---|---|
| 1 day | $0.88 | **$0.009** | $4.50 | $13.50 | $36.00 |
| 1 week | $6.14 | **$0.06** | $4.50 | $13.50 | $36.00 |
| 1 month | $26.67 | **$0.27** | $4.50 | $13.50 | $36.00 |
| 1 year | $320 | **$3.20** | $4.50 | $13.50 | $36.00 |

The caller is underwater by 15–50x at the end of month one, and still underwater
after a **full year** of accrual at every gas price shown. The fee only clears gas
once the vault has accumulated:

- **$450** of unharvested rewards at 5 gwei — about **17 months** of accrual at this TVL
- **$1,350** at 15 gwei — about **4.2 years**
- **$3,600** at 40 gwei — about **11 years**

Flip it around and ask what TVL this design needs to work as intended:

| Harvest cadence | TVL needed @5 gwei | @15 gwei |
|---|---|---|
| Daily | $4.1M | $12.3M |
| Monthly | $137k | $410k |
| Quarterly | $46k | $137k |

To get even *quarterly* harvests at normal mainnet gas you need ~17x the TVL you're
expecting. At $8,000, the honest statement is: **this vault does not compound. It is
a contract that holds USDC.**

The failure is silent. Nothing reverts, no alert fires, nobody is notified. The
vault just sits there looking fine while rewards pile up unclaimed in the strategy.

**One thing to check first:** if the strategy's yield accrues in an exchange rate or
a rebasing balance (Aave aUSDC, a 4626 wrapper) rather than in a separate claimable
reward token, then `harvest()` is only doing the compounding *bookkeeping* and
depositors are still earning in the meantime — the vault's share price rises on its
own and the yield is real whether or not anyone calls. That is much less bad, and
it is the shape you want: **accrue at read time from state that's already there,
and settle when someone next touches the contract.** If instead rewards only exist
once `claim()` is called on some rewards distributor, then yield genuinely does not
accrue for your depositors until a harvest lands, and the number above is 0%. Which
of the two this is should be the first line of your launch notes.

## 3. What this means for a depositor

Split $8,000 across ~20 people and the average deposit is $400, earning **$16/year,
$1.33/month**. Now their costs:

| Action | Gas | @5 gwei | @15 gwei | @40 gwei |
|---|---|---|---|---|
| approve USDC | 46k | $0.69 | $2.07 | $5.52 |
| deposit | 150k | $2.25 | $6.75 | $18.00 |
| withdraw | 120k | $1.80 | $5.40 | $14.40 |
| **Round trip** | | **$4.74** | **$14.22** | **$37.92** |

A $400 depositor at normal gas pays $14.22 to earn $16 in a year. They are
**net-negative for the first ~10.7 months** and clear about $1.78 in year one — if
harvests happen, which they don't. Hit a busy day and they never break even at all.

For gas to stay under 10% of first-year yield, a depositor needs to bring roughly
**$3,500** at 15 gwei. Which means your $8,000 is realistically two or three large
depositors, not twenty small ones — and a retail "small vault" pitch to small
depositors on mainnet is, in gas terms, selling them a loss. Say the round-trip cost
and the break-even deposit size in your front-end copy before someone finds out the
expensive way.

Also fold in deployment: vault + strategy is ~4M gas, roughly **$60 / $180 / $480**
at the three gas levels. At 15 gwei you spend **seven months of the vault's entire
gross yield** just putting it onchain.

## 4. The free-rider problem on the first harvest

This one is independent of gas, and it's the part I'd fix regardless of which chain
you pick.

If harvested rewards are credited to the share price all at once, then the yield
earned over weeks lands in a single block. Whoever holds shares *in that block*
captures it, regardless of how long they've been there. And `harvest()` is
permissionless, so the attacker picks the block:

1. Wait until a meaningful reward balance has accrued.
2. Deposit $80,000 — 10x your TVL — into the vault.
3. Call `harvest()` in the same transaction. Now they own ~91% of the shares, so
   they take ~91% of the entire period's rewards, plus the 1% caller fee.
4. Withdraw in the same transaction. Flash-loan the $80k and it costs them nothing
   but gas.

Your actual depositors, who sat there for the whole month, get ~9% of what they
earned. At $8,000 TVL the absolute loss is small ($24, once) — but it is
unconditionally repeatable on every harvest forever, it scales with TVL, and it is
a bad first headline. Milder unintentional versions happen constantly: anyone who
withdraws the day before a harvest forfeits their accrued share to whoever's left.

**Fix:** vest harvested rewards linearly into the share price over a lock period
(7 days is the common choice — Yearn and Beefy both do a version of this). The
sandwich stops working because there is nothing to capture in a single block, and
the reward for holding goes back to the people actually holding.

## 5. Two more, briefly

- **First-depositor share inflation.** An empty ERC-4626 vault lets the first
  depositor mint 1 wei of shares then donate USDC directly to the vault to inflate
  the share price and round the next depositor's shares to zero. With $8,000 of TVL
  you are the small vault this gets done to. Use OpenZeppelin's ERC4626 with decimal
  offset, or seed the vault yourself with a dead-address deposit at deploy. Full
  contract-safety review is `/security`'s job, not this document's — but don't ship
  without that one closed.
- **The 1% caller fee comes out of depositor yield.** It's the right mechanism; just
  note that once it *does* start clearing gas, harvests become a competitive race and
  the fee is real drag, not free. Budget it in your advertised APY: 4% gross with
  daily harvesting is ~3.96% net of the keeper fee before any of your own fee.

---

## 6. What to change before launch

**Deploy to Base or Arbitrum, not Ethereum mainnet.** This is the one that matters.
A harvest there costs on the order of a few cents rather than $13.50, which moves
the break-even from "$1,350 of accrued rewards" to "about $3" — roughly three days
of accrual at $8,000 TVL. The permissionless-caller design you already wrote starts
working exactly as intended, at the TVL you actually have. Depositor round trips go
from $14 to under a dime, so a $400 deposit stops being a joke. Same USDC (native
on both), same strategy availability, same code. There is no version of these
numbers where $8,000 of TVL belongs on mainnet.

**Vest harvested rewards over ~7 days.** Kills the deposit-harvest-withdraw
sandwich and makes the yield accrue to people who held rather than to whoever was
present in one block.

**Confirm whether the strategy accrues continuously or only on claim.** If it's
claim-based, your depositors earn literally nothing between harvests and that has to
be in the docs. If it's exchange-rate-based, say so — it's the far better answer and
it means a missed harvest costs compounding, not principal yield.

**Put a floor under the caller fee.** `max(1% of claimed, small fixed amount)`, or a
small fixed bounty on top of the 1%, funded from the vault. Cheap insurance for the
days gas spikes, and it keeps the cadence regular instead of bursty.

**If mainnet is non-negotiable:** then plan for an owner-run harvest, budget ~$160/yr
of gas against $320/yr of gross yield, and write down plainly that harvesting stops
the day you stop — including what happens to depositor funds if that key is lost.
An operator-dependent maintenance function is a real answer, it's just one you have
to disclose rather than discover.

---

## 7. What this design gives up — for your README

Write these in plain words before launch; they're what a depositor is entitled to
know and what you'll be asked in the first hour.

**Can anyone be stopped from using it?** Name every operator power you actually
shipped: a `Pausable` modifier, any `onlyOwner` function that touches user funds or
the strategy address, an upgradeable proxy, any allowlist. For each, say what it
lets you do to a depositor who is already in, and say what happens to depositors if
that key is lost — can they still withdraw with nobody at the wheel? If you shipped
none of these, say that explicitly; it's a strong claim and it deserves to be stated
rather than inferred. The failure mode is scaffolding an owner with sweeping powers
and never mentioning it.

**Could someone else run it?** A verified contract on Etherscan is not this. Split
it: the vault contract and onchain balances anyone can read, fork and keep
withdrawing from, versus the front-end, the RPC key, the subgraph and any APY
calculation that only runs on your server. Say which half survives you walking away
and what a depositor can concretely still do in that world — "withdraw by calling
`redeem()` directly on Etherscan" is a real answer if it's true.

**What does an observer learn?** Everything. Every depositor address, every deposit
amount and timestamp, every withdrawal, current balances, and the full strategy
position — all public forever, to competitors and to anyone profiling your users.
There is no private tier to a vault. That's separate from access control on your own
API; it holds even if your front-end never shows a thing.

**What does "audited" cover?** If you get a review, it's a point-in-time look at one
commit of a fixed scope — not a standing guarantee about the code running after your
next deploy. Say which commit and which files.

There is no randomness anywhere in this design, so no VRF or commit-reveal is needed.
Worth noting explicitly in the handoff so nobody later reaches for `block.timestamp`
to break a tie.
