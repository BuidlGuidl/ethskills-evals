# USDC yield vault — operational read on month one

## The one-line version

At $8,000 TVL on mainnet, this vault produces about **$26 of yield in its first
month**, and a single `harvest()` call costs **$2–$30 of gas**. Nobody will ever
call `harvest()` for the 1% fee, because the fee on a month of accrual is **27
cents**. You will call it yourself, out of pocket, and your gas bill for doing so
will be roughly the same size as the entire yield the vault generates. Meanwhile
your depositors, at realistic ticket sizes, lose more to entry and exit gas than
they earn.

Nothing here is a bug in the code. It is a scale-and-venue mismatch. The fix is
mostly "not Ethereum mainnet."

---

## 1. Nothing runs itself — so who moves this state machine?

A contract does nothing between transactions. No cron, no timer, no background
job. "Compounds the rewards" describes a transaction a specific someone has to
send and pay for. So, function by function:

| Transition | Who sends it | Why would they | Does it actually happen? |
|---|---|---|---|
| `deposit()` | the depositor | they want the yield | Yes — self-interest, works |
| `withdraw()` | the depositor | they want their money | Yes — self-interest, works |
| `harvest()` | anyone, for 1% of the claim | the 1% | **No. See below.** |

Two out of three is not a passing grade when the third one is the entire
product. Without `harvest()`, rewards sit unclaimed at the strategy and the
vault's share price does not move. The thing your depositors are buying is
`harvest()` being called.

### The harvest math

Assume a realistic `harvest()` — claim rewards, swap to USDC, deposit back into
the strategy, update accounting — at roughly **250,000 gas**. (Check your own
number once you have the contract; anything with a DEX swap in it lands between
200k and 400k.)

Cost of one call, at ETH ≈ $4,000:

| Gas price | Cost of one `harvest()` |
|---|---|
| 2 gwei (quiet night) | ~$2 |
| 5 gwei (typical) | ~$5 |
| 10 gwei | ~$10 |
| 30 gwei (busy) | ~$30 |
| 60 gwei (mint / liquidation cascade) | ~$60 |

What the caller earns, at $8,000 TVL and 4% APY (= $320/yr = $0.88/day of
rewards), keeping 1% of whatever that call claims:

| Time since last harvest | Rewards claimed | Caller keeps (1%) |
|---|---|---|
| 1 day | $0.88 | **$0.009** |
| 1 week | $6.14 | **$0.06** |
| 1 month | $26.30 | **$0.27** |
| 1 year | $320 | **$3.20** |

Let the rewards accrue for a **full year** and the bounty still does not cover a
single call at the cheapest gas price on the table. The incentive is off by
roughly **20× to 200×**, depending on gas.

Put it the other way round, which is the number worth pinning to a wall:

> **Break-even TVL ≈ (gas cost of one harvest) × 30,000**, for a monthly harvest.
> **Break-even TVL ≈ (gas cost of one harvest) × 912,500**, for a daily harvest.

| Gas cost per call | TVL needed for monthly harvest to pay | TVL for daily |
|---|---|---|
| $2 | $60,000 | $1.8M |
| $5 | $150,000 | $4.6M |
| $10 | $300,000 | $9.1M |
| $30 | $900,000 | $27M |

You are launching at $8,000. You need somewhere between **7× and 100× more
deposits** before a stranger's `harvest()` transaction is worth sending — and
that is before they account for the reward token swap slippage on a $26 trade,
and before they compete with anyone else for the same bounty.

### So what actually happens in month one

You call `harvest()` yourself from an ops wallet, because you have to. Call it
weekly and you spend ~$20–$120 in gas over the month to compound ~$26 of yield.
Call it once at the end of the month and you spend $5–$30 to compound $26,
minus the $0.27 you pay yourself, and the vault's share price sat flat for
thirty days while depositors watched. Either way your operating cost is the
same order of magnitude as the product's entire output.

That is fine as a deliberate subsidy while you bootstrap. It is not fine as an
unexamined assumption, and it is not "permissionless" — it is an owner-run
maintenance job with a decorative bounty attached. If you ship it this way, the
honest description is: *harvesting currently depends on us paying for it, and it
stops the day we stop.*

---

## 2. What this means for your depositors

This is the part that has gotten less attention than the harvest problem, and it
is worse.

A depositor pays gas twice: `approve` + `deposit` in, `withdraw` out. Call it
**~350,000 gas** for the round trip.

| Gas price | Depositor's round-trip cost |
|---|---|
| 5 gwei | ~$7 |
| 15 gwei | ~$21 |
| 30 gwei | ~$42 |

Against 4% APY, the deposit size needed just to **break even** on that gas:

| Holding period | At $7 round trip | At $42 round trip |
|---|---|---|
| 1 month | $2,100 | $12,600 |
| 6 months | $350 | $2,100 |
| 1 year | $175 | $1,050 |

Read the top-left cell against your own forecast. You expect **$8,000 total**. A
depositor who joins, holds a month, and leaves needs to be putting in **$2,100 on
a quiet day** — a quarter of your entire projected TVL — merely to not lose
money. Anyone depositing $200 or $500, which is what "small vault, first month"
usually means in practice, is underwater from the moment they click confirm and
will not recover for years.

Three follow-ons:

- **USDC has 6 decimals.** At small balances, a single depositor's share of a
  single harvest rounds to zero. Someone with $200 in the vault earns $0.0219 a
  day. If your share accounting rounds against the user anywhere, they can
  accrue literally nothing for days at a time.
- **The yield is invisible.** $26/month spread across everyone means most
  depositors see their balance move by cents. There is no dopamine, and no
  reason to come back.
- **They will notice.** The first person who does this arithmetic posts it, and
  "this vault costs more to use than it pays" is a sticky first impression for a
  product you presumably want to still be running in year two.

---

## 3. Design issues that are independent of scale

These are real at $8,000 and still real at $8,000,000, so fix them regardless of
what you decide about venue.

**Harvest timing is capturable.** `harvest()` is permissionless and compounds a
lump sum into the share price. That means an attacker chooses the moment. In one
transaction: `deposit()` → `harvest()` → `withdraw()`. They capture a pro-rata
slice of rewards that accrued before they ever deposited, and the honest holders
eat the dilution. At your size this steals pennies, so nobody bothers; the day it
is worth a stranger's gas, it becomes worth their gas *every single harvest*.
The standard fix is to **vest harvested profit linearly over a period** (a
"locked profit degradation" ramp, 6–24 hours is typical) so a single block's
gain is never claimable in that block. Do this before launch — it is much harder
to retrofit into live share accounting.

**First-depositor share inflation.** A brand-new vault with no shares
outstanding is the textbook setup: attacker mints 1 wei of shares, donates USDC
directly to the vault to move the exchange rate, and the next depositor's shares
round to zero. Use OpenZeppelin's ERC-4626 with the virtual-shares/decimal
offset, **and** seed the vault with a small non-withdrawable deposit in the same
transaction as deployment. Do not leave the vault empty between deploy and first
user.

**Consider a strategy that does not need harvesting at all.** The best version of
this design has no scheduled transaction in it. If the strategy is something like
Aave, value accrues into a balance the vault can simply *read* — `totalAssets()`
goes up on its own, no claim, no swap, no caller, no bounty, nothing to subsidise.
If your strategy emits a separate reward token that must be claimed and sold,
you have bought yourself a permanent operational liability in exchange for
(probably) a slightly higher headline APY. At $8,000 TVL that trade is clearly
wrong. Picking an accrual-on-read strategy makes the entire harvest problem
disappear rather than making it cheaper.

---

## 4. What I'd change before launch

**Ranked, most important first.**

### 1. Deploy to an L2, not Ethereum mainnet.

This is the whole answer. Base, Arbitrum, or Optimism, where a transaction costs
cents rather than dollars. Everything above inverts:

- A `harvest()` costs roughly **$0.01–$0.05**. The 1% bounty on a month of
  accrual is $0.27 — so the permissionless incentive **actually works**, at your
  actual launch size, with no subsidy from you. Break-even TVL for a monthly
  harvest drops from $150,000 to around **$1,500**.
- A depositor's round trip costs pennies, so a $200 deposit is a real product
  instead of a trap.
- You can harvest daily instead of monthly, which compounds better and makes the
  share price visibly move.

USDC is native on all three. Your strategy probably exists there. If it does not,
that is the thing to go solve — it is a smaller problem than the one mainnet
hands you. **If you change one thing on this list, change this one.**

### 2. If mainnet is genuinely non-negotiable, say out loud what you're signing up for.

Then do all of the following:
- Budget the harvest gas as a real line item: **$250–$1,500/yr** depending on
  cadence and gas, against $320/yr of yield at current TVL. Know that you are
  paying more than the vault earns until TVL is north of ~$150k.
- Add a **minimum-claim threshold** to `harvest()` so it reverts unless pending
  rewards exceed some floor (say $500). This stops anyone — including you —
  burning gas on a dust compound, and it makes the economics self-documenting.
- Drop the pretence that the 1% makes it permissionless. Keep the function open
  (it costs nothing and becomes real if you grow), but write in the docs that the
  team currently funds harvesting and that it stops if the team does.
- Raise the caller share, or add a flat bounty floor, for the day it matters. Be
  aware there is no percentage that works at $8k: 100% of the yield still would
  not pay for the gas.

### 3. Set a minimum deposit, and show the break-even.

Whatever chain you land on, put the number in the UI: *"at current gas, a deposit
below $X will not earn back its transaction costs within a year."* Either enforce
a floor in the contract or show the math at deposit time. This is the difference
between a vault people trust and one people feel tricked by.

### 4. Vest harvested profit, and fix the first-depositor case.

Per section 3. Both are pre-launch changes.

### 5. Recheck every dollar figure here against live prices on deploy day.

I used **ETH ≈ $4,000** and the gas prices in the tables. The *shape* of the
conclusion is robust — the harvest incentive is short by one to two orders of
magnitude, not by 20% — but the exact break-even TVL moves with ETH and gas.
Re-run it the morning you ship.

---

## 5. What this design gives up

Worth writing down now, while it is still cheap to change. Some of this belongs
in your public docs, not just this file.

**Can anyone be stopped from using it?**
Answer this about the contracts you are *actually* shipping. If there is a
`Pausable`, an `onlyOwner` that can touch user funds or migrate the strategy, or
an upgradeable proxy, then you can freeze withdrawals or change where the money
goes, and depositors are trusting your key — name each power in the README and
say what happens to users if that key is lost. Shipping none of them is a
perfectly good answer; say *that* instead. Scaffolding them and not mentioning
them is the failure mode.

Two powers you have that are not yours to remove, and should be disclosed either
way: **Circle can blacklist the vault's address**, freezing every depositor's
USDC permanently — that is inherent to USDC, not something you chose, but your
depositors are exposed to it. And **the underlying strategy can be paused,
drained, or upgraded by its own team**, which stops your vault dead no matter how
clean your code is.

**Could someone else run it?**
Split the stack honestly. Verified contracts on Etherscan are not the answer to
this question — that is where most teams stop. The contracts and all vault state
are public, forkable, and callable by anyone with an RPC: if you disappear
tomorrow, depositors can still call `withdraw()` directly from a block explorer
and get their money out. That is the part that survives you. What does not: the
frontend, any APY indexer or subgraph, and — critically — **harvesting, which on
mainnet depends entirely on you paying for it**. So the honest statement is
*"your funds are always withdrawable without us; your yield is not."* On an L2
where the bounty works, that second clause goes away, which is its own argument
for point 1.

**What does an observer learn?**
Everything, permanently. Every depositor's address, exact balance, deposit and
withdrawal times, and the wallets they came from are public forever. With ~$8,000
across a handful of addresses, anyone can trivially identify individual
depositors and size their positions; anyone can see your exact TVL and calculate
your revenue; a competitor can watch your growth curve in real time. Nothing
about a vault is private, and no access control on your own frontend changes
this — that is a different question. Do not let anyone deposit believing
otherwise.

**On "audited":**
If you get one, it is a point-in-time review of a fixed scope. It is not a
standing guarantee about the code running next month, it does not cover the
strategy you deposit into, and it does not cover the economics in this document —
every number in section 1 is exactly the kind of thing an audit will not flag,
because nothing here is a coding error.

---

## Summary

- `harvest()` will not be called by strangers at $8,000 TVL — the bounty is
  27¢/month against $5–$30 of gas. You will fund it yourself, at roughly the cost
  of the vault's entire yield.
- Depositors under ~$2,000 lose money to entry/exit gas on a one-month hold. At
  your projected size, that is most of them.
- Vest harvested profit and handle the first-depositor case regardless of what
  you decide next; both are scale-independent and both are cheaper to fix now.
- **Deploying to an L2 fixes the first two problems outright and makes the
  permissionless design work as intended at the size you are actually launching
  at.** Mainnet at $8,000 TVL is the decision to revisit, not the fee parameter.
