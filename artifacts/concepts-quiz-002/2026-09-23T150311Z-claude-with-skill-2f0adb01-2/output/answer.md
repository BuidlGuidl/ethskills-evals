# Operational read: USDC yield vault, first month on mainnet

**Short version:** the vault will work. `harvest()` will not. The 1% bounty is
worth about **$0.27** at the end of month one, and calling `harvest()` on mainnet
costs **$5–30**. No stranger will ever call it. You will call it, out of pocket,
at a loss — which means the permissionless part of your design is decorative.

Underneath that is a bigger problem: the whole vault produces **$26.67 in month
one**, and it costs more than that just to deploy the contracts.

---

## 1. The arithmetic

Everything below follows from these numbers. $8,000 TVL at 4% APY:

| | Amount |
|---|---|
| Yield per year | $320.00 |
| Yield per month | $26.67 |
| Yield per day | $0.88 |
| **Harvest bounty (1%) after a month of accrual** | **$0.27** |
| Harvest bounty after a full year of accrual | $3.20 |

And what things cost on mainnet (ETH at $3,000):

| Action | Gas | @5 gwei | @15 gwei | @30 gwei |
|---|---|---|---|---|
| `harvest()` (claim + swap + redeposit) | ~350k | $5.25 | $15.75 | $31.50 |
| Depositor round trip (approve+deposit+withdraw) | ~300k | $4.50 | $13.50 | $27.00 |
| Deploying vault + strategy | ~3M | $45 | $135 | $270 |

Put the two tables next to each other and the design falls over. The reward for
calling `harvest()` is 20–100x smaller than the cost of calling it.

---

## 2. What actually happens once it's live

A contract is a state machine. It sits still until someone pokes it and pays gas.
For every transition you have to be able to answer: *who pokes it, why, and is it
enough?* Here is that answer for each transition in your vault.

**Deposit** — Who: your depositors. Why: they want yield. Enough: *marginally*,
see §3. This one works.

**Withdraw** — Who: depositors. Why: they want their money. Works.

**`harvest()`** — Who: **nobody.** A searcher simulates the call, sees $0.27 in,
$15 out, and never calls it again. Bots are not altruists; they run exactly this
simulation. Your `harvest()` is dead code for the first month, and by the math
below, for the first several *years*.

So month one really goes like this:

- **Day 0** — You pay $45–270 in gas to deploy. That is 2–10 months of total
  vault yield spent before a single dollar is deposited.
- **Days 1–7** — Depositors arrive, each paying $4–13 in gas to get in.
- **Days 1–30** — The vault holds $8,000 and accrues $0.88/day. `harvest()` is
  callable by anyone the entire time. Nobody calls it. Not once.
- **Day 30** — $26.67 of yield exists. You call `harvest()` yourself, pay ~$15,
  and hand yourself a $0.27 bounty. Net to the vault: about $11.

You didn't build a hyperstructure. You built a service that you personally
subsidize, wearing a hyperstructure's clothes. That is a legitimate choice — but
know which one you shipped, and don't describe it to depositors as autonomous.

### When does permissionless harvest actually start working?

Break-even is when 1% of the claim covers the gas, i.e. **claim ≥ 100× gas cost**:

| Gas per harvest | Claim needed | TVL needed for *monthly* harvest to pay for itself |
|---|---|---|
| $5 (quiet) | $500 | $150,000 |
| $15 (normal) | $1,500 | $450,000 |
| $30 (busy) | $3,000 | $900,000 |

At $8,000 TVL you need to let rewards sit for **1.5–9 years** before a single
harvest breaks even. A rational searcher wants 2–5x margin over break-even, not
1.0x, so realistically permissionless harvest self-sustains somewhere north of
**$500k–$2M TVL**. You are 60–250x short.

### The part that makes this fine: compounding isn't worth much anyway

Monthly compounding vs. annual compounding on $8,000 at 4% is worth
**$5.93 per year**. That is less than one harvest's gas.

This is the useful reframe. At your size, harvesting is *not* about compounding
gains — the compounding is worth nothing. Harvest exists only to **realize** the
rewards. So harvest frequency should be driven by "do I need to claim this before
something bad happens to it," not by a calendar. Harvesting monthly would burn
$180/yr of gas to capture $6/yr of compounding, against $320/yr of gross yield.

---

## 3. What this means for your depositors

**The strategy question I need you to answer.** How does the yield accrue?

- **Exchange-rate / rebasing** (Aave aUSDC, Morpho, sDAI): the position grows in
  value on its own; `harvest()` only sweeps *extra* reward tokens. Then nobody
  calling harvest costs depositors almost nothing — they still get ~4%. **This is
  the good case, and you should make sure you're in it.**
- **Claimable reward tokens** (emissions, staking rewards): yield is only real
  once claimed. Then a vault nobody harvests earns depositors **0%**, and you're
  personally the single point of failure for the entire return. Worse if the
  rewards decay or expire unclaimed.

Everything else in this doc holds either way, but this determines whether "nobody
calls harvest" is an annoyance or a total failure.

**Gas eats most depositors alive.** A $4.50–13.50 round trip against 4% APY:

| Deposit | Yield/yr | Round-trip gas | Months to break even on gas |
|---|---|---|---|
| $100 | $4.00 | ~$8 | never — loses money |
| $400 | $16.00 | ~$8 | 6 months |
| $2,000 | $80.00 | ~$8 | 1.2 months |
| $8,000 | $320.00 | ~$8 | 0.3 months |

For gas to stay under 10% of a depositor's first-year yield, they need to deposit
**~$2,000+** and hold **6+ months**. So: your $8,000 is fine if it's 2–4 large
depositors. If it's 20 people at $400 each, most of them will lose money on this,
and in month one — before any harvest — essentially *all* of them are underwater.

**Things they can't see that you should tell them.** Every deposit, amount, and
withdrawal is permanently public; if these are friends and early users, they're
exposing their balances to each other. If there's a `Pausable`/`onlyOwner` in
there, one key can freeze their funds — put it behind a multisig and say so. And
$8,000 of TVL cannot justify a $15k–50k audit, which means you are shipping
unaudited custom vault code. The honest framing for depositors: the risk of a bug
taking 100% dwarfs $320/yr of upside.

---

## 4. Two bugs to fix before you ship

**ERC-4626 inflation / donation attack.** If you're using a standard 4626 vault,
the first-depositor attack is live and *cheap at your size*: attacker deposits
1 wei, `transfer()`s USDC directly to the vault to inflate the share price, and
the next depositor's shares round down to zero — their deposit is absorbed. Cost
to attack scales with the victim's deposit, so at $8k it's trivially affordable.
Fix both ways: OpenZeppelin's `_decimalsOffset()` (virtual shares) **and** a seed
deposit burned at deployment.

**Harvest front-running.** `harvest()` is permissionless and books profit into the
share price instantly, so anyone can watch for a pending harvest, deposit just
ahead of it, and capture yield they didn't earn. Stream harvested profit linearly
over a lock period (Yearn's `lockedProfit` pattern) instead of recognizing it in
one block. Cheap to add now, impossible to add later if the vault is immutable.

---

## 5. What I'd change before launch

**1. Deploy to Base or Arbitrum instead of mainnet.** This is the recommendation;
everything else is secondary. Gas drops to roughly $0.01–0.05 a transaction, and
the entire analysis above inverts: the $0.27 bounty now comfortably beats a ~$0.02
harvest, so **permissionless harvest actually works as designed** and strangers
really will poke your vault for you. Depositor round trips go from $8 to pennies,
so $100 depositors stop losing money. USDC is native on both, and Aave and Morpho
are on both. At $8,000 TVL there is no argument for mainnet that survives contact
with these numbers.

**2. If mainnet is genuinely non-negotiable:** change the bounty from a flat
percentage to `max(1% of claimed, gas reimbursement + small premium)`. But be
clear-eyed that this makes harvest a *vault expense* — ~$10–15 against $26.67/mo
of yield. Which just brings you back to harvesting rarely.

**3. Add a minimum-claim threshold** — `require(claimable >= MIN_HARVEST)` at
roughly 100x expected gas. Without it, harvest can be called on dust; combined
with gas reimbursement (#2) that's a live drain vector.

**4. Fix the two bugs in §4** — virtual shares, seed deposit, locked profit.

**5. Set harvest cadence by threshold, not schedule.** On mainnet: harvest when
claimable exceeds ~$500, or quarterly, whichever comes first. Not monthly.

**6. Don't publish "4% APY" bare.** Publish it net of gas, with the break-even
deposit size and holding period ($2,000 / 6 months on mainnet). A depositor who
puts in $200, sees "4%," and loses money to gas will reasonably feel misled.

**7. Answer the strategy-type question in §3** and write the answer down. If it's
claimable-rewards, budget for team-paid harvests and tell depositors the yield
depends on you showing up.

---

## The one-line version

At $8,000 on mainnet, gas costs more than the yield — to deploy it, to harvest
it, and for small depositors to enter it. Move to an L2 and the design you've
already described works exactly as you intended.
