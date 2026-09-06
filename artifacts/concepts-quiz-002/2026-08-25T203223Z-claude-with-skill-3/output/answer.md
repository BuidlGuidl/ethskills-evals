# USDC vault — operational read on month one

## Assumptions I priced against

Live mainnet data pulled today (2026-08-25), block 25,834,627:

- **ETH = $2,453.52** (Coinbase spot)
- **Base fee 0.54–0.65 gwei**, median priority tip 0.1–0.5 gwei. I price a call
  you want included promptly at **~1 gwei all-in**, and show 5 and 20 gwei as
  sensitivity — mainnet has spent plenty of its life there and will again.
- `harvest()` at **350,000 gas** (claim from the strategy + swap reward to USDC +
  redeposit). Range 250k–500k; nothing below changes if you land anywhere in it.
- Depositor path: `approve` 46k + `deposit` 180k + `withdraw` 230k = **456k round trip**.
- $8,000 TVL, 4% APY → **$0.88/day**, **$26.65/month**, **$320/year** of yield.

If your `harvest()` is materially cheaper than 350k — because the strategy pays
in USDC and there is no swap — say so and I'll rerun it. It moves the numbers but
not the conclusion.

---

## 1. What actually happens once it's live

**Deposits and withdrawals work fine.** Those are user-initiated: a depositor
wants in, so they pay their own gas. At today's ~1 gwei a full round trip costs
about **$1.12**. No problem.

**`harvest()` does not get called.** Not by a stranger, not once, in the entire
first month. Here is the arithmetic that decides it — the caller's reward and
the caller's gas, side by side in dollars:

| Wait since last harvest | Rewards claimed | Caller keeps 1% | Gas @1 gwei | Gas @5 gwei | Gas @20 gwei |
|---|---|---|---|---|---|
| 1 day | $0.88 | **$0.009** | $0.86 | $4.29 | $17.17 |
| 1 week | $6.14 | **$0.061** | $0.86 | $4.29 | $17.17 |
| 1 month | $26.65 | **$0.267** | $0.86 | $4.29 | $17.17 |
| 1 quarter | $79.78 | **$0.798** | $0.86 | $4.29 | $17.17 |
| 1 year | $320.00 | **$3.200** | $0.86 | $4.29 | $17.17 |

The caller's fee scales with your TVL. Their gas is a fixed dollar cost that has
nothing to do with your TVL. At $8,000 those two lines don't cross anywhere
inside month one — the best possible outcome, waiting the whole 30 days and
claiming everything, pays the caller **27 cents against 86 cents of gas**.

Break-even — the point where 1% of the accrued rewards finally equals one call's
gas:

| Gas price | Needs this much accrued | Which takes |
|---|---|---|
| 1 gwei | $85.87 | **98 days** |
| 5 gwei | $429.37 | **490 days** |
| 20 gwei | $1,717.46 | **5.4 years** |

And break-even isn't the bar. A searcher wants margin, not a coin flip against
gas volatility and a failed-tx risk. Realistically nobody bothers until the fee
is 3–5× gas, which at today's cheap gas is somewhere around **month nine**.

So: the transition you designed to be self-sustaining has no one behind it.
The function exists, it's permissionless, and it silently never runs.

**What runs instead is you.** Around week three someone on the team notices the
vault hasn't harvested, calls it manually, pays $0.86 in gas, and receives $0.27
of caller fee out of your own depositors' yield. Net **−$0.59 per harvest**, paid
by the team. You do that a few times and then stop.

**The one party with a profitable reason to touch this vault is an attacker.**
If `totalAssets()` does not count pending unharvested rewards — the common way
this gets built — then the share price jumps at the moment of harvest. Anyone
can deposit in the block before and withdraw in the block after:

| Attacker deposits | Captures from a $26.65 harvest | Their gas @1 gwei |
|---|---|---|
| $2,000 | $5.33 | ~$1.12 |
| $8,000 | $13.33 | ~$1.12 |
| $50,000 | $22.98 | ~$1.12 |

It's twelve dollars, not a heist. But note what it means: **the only positive-EV
interaction with your vault is the one that takes money from your depositors**,
and it takes it out of the exact pot the harvest was supposed to add to. That is
your incentive design pointing backwards.

---

## 2. What this means for your depositors

**They are basically fine, and that is luck, not design.** At ~1 gwei a $200
depositor pays $1.12 in gas to earn $8/year. They clear their own costs in about
seven weeks.

That result is entirely a function of gas being unusually cheap this week:

| Gas price | Depositor round trip | Deposit needed to break even over a year |
|---|---|---|
| 1 gwei | $1.12 | $28 |
| 5 gwei | $5.59 | $140 |
| 20 gwei | $22.38 | **$559** |

One busy fortnight during your launch month and the small depositors are
underwater on their own entry and exit. You have no margin here — you have
today's gas price.

**The harvest failure costs them almost nothing.** This is the genuinely
reassuring part, and it's worth being clear about because it changes what you
should do. Compounding is nearly worthless at this size:

| Compounding cadence | Year-one yield on $8,000 |
|---|---|
| never (harvest never runs) | $320.00 |
| quarterly | $324.83 |
| monthly | $325.93 |
| daily | $326.47 |

**The entire value of harvesting monthly instead of never is $5.93 a year.**
Twelve monthly harvests cost about $10.30 of gas to produce it. The maintenance
machinery you built costs more to operate than the thing it produces is worth.

One thing I can't check from here and you must: **do the strategy's rewards
expire or stop accruing if unclaimed?** Most reward controllers accrue
indefinitely, but emission programs have end dates and a few have claim windows.
If yours does, "harvest never runs" stops being a $6 problem and becomes a real
loss. Check this before you ship.

**The 1% caller fee is doing nothing for anyone.** Its ceiling is $3.20 a year.
It doesn't fund the caller, it doesn't fund you, and it's a line item you'd have
to explain to depositors. It is a percentage-shaped fee pointed at a fixed-cost
problem, which is why it can't work at any TVL you'll see this year.

---

## 3. What should change before launch

Ranked by how much they matter.

**1. Drop `harvest()` and pick an auto-accruing strategy.** Aave's aUSDC, sUSDS,
or an existing ERC-4626 wrapper: the balance grows on its own and value accrues
at read time from the underlying. No maintenance transaction exists, so there is
nothing to fail to get called, no caller fee to design, and no share-price jump
to sandwich. This is one change that deletes the entire problem, and given that
harvesting is worth $6/year, you are giving up nothing to get it.

**2. If you keep `harvest()`, make `totalAssets()` include pending rewards.**
Read the claimable amount from the strategy and add it. The share price then
moves continuously instead of jumping, which kills the sandwich, makes harvest
cadence economically irrelevant, and means a depositor who exits before a harvest
still gets their accrued share. Do this even if you take nothing else here.

**3. Consider Base or Arbitrum rather than mainnet.** Not because today's gas is
unaffordable — it isn't — but because every margin in this document is roughly
1× and mainnet gas moves 30×. On an L2 the depositor round trip is a couple of
cents, a harvest is a fraction of a cent, and none of the tables above have a
column that goes bad. The one real argument for mainnet is that your strategy
only exists there; if that's the case, say so and stay, and accept that a gas
spike during launch month is a thing your depositors eat.

**4. Replace the 1% with something that can cover a fixed cost, or drop it.**
If a permissionless harvest genuinely matters to you later at higher TVL, the
shapes that work are: reimburse the caller's actual gas plus a bonus, or set a
minimum-claim threshold so calls only become possible once they're worth making.
At $8,000 the honest answer is to drop the fee, accept that the team calls
harvest, and **write that down publicly** — including what happens to the vault
when whoever holds that key stops showing up. An unadvertised owner-operated
maintenance function is the failure mode; a documented one is a choice.

**5. Set a minimum deposit, around $250–500.** Below that, at anything but
today's gas, a depositor pays more to get in and out than the vault will ever
pay them. Turning them away is kinder than taking their money.

---

## 4. What this design gives up

Worth writing into the README before launch, whether or not anyone asks.

**Can anyone be stopped from using it?** I can't answer this from the four bullet
points — it depends on the contract, and you should answer it explicitly before
you ship. Name every operator power you actually shipped: `Pausable`, any
`onlyOwner` reach over user funds or user access, an upgradeable proxy, a
strategy setter. Note especially that **whoever can change the strategy can move
every depositor's USDC**, which is a far larger power than anything in the
harvest design and deserves top billing over it. For each one, say what it lets
you do to a depositor and what becomes of depositors if that key is lost. If you
shipped none of them, say that — it's a strong answer.

**Could someone else run it?** The vault contract and its state are public and
forkable, and a depositor can call `withdraw` straight from Etherscan without
you. That half survives you. Your frontend, any APY display, any subgraph or
indexer, and any allowlist check you run offchain do not. Make sure the withdraw
path needs nothing but the contract — and confirm the same for the strategy you
sit on top of, because your vault is only as durable as the protocol underneath it.

**What does an observer learn?** Everything. On mainnet, every depositor's
address, deposit amount, timestamp, and every withdrawal is public forever and
already indexed by Etherscan, Nansen and Arkham. For a first-month vault this
size, the depositors are likely people who know each other — and each of them
will be able to see exactly what the others put in, plus every other holding and
counterparty attached to those addresses. Say this out loud to them before they
deposit. Nobody expects it and everybody minds.

**What does "audited" cover?** If you get one: a point-in-time review of a fixed
scope. It says nothing about the code running after your next change, and nothing
at all about the strategy you deposit into.
