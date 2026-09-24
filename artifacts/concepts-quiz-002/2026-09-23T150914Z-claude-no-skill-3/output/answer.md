# Operational read: USDC yield vault, first month on mainnet

## The short version

At $8,000 TVL on Ethereum mainnet, gas is not a cost line in this vault — it is
the dominant economic force, larger than the yield by one to two orders of
magnitude. Three things follow:

1. **`harvest()` will never be called by a third party.** The 1% bounty is worth
   ~$0.13 in month one against ~$12 of gas. The incentive is off by ~100x. You
   will be calling harvest yourself, out of pocket.
2. **Most depositors will lose money in month one**, net of their own gas. A
   $400 depositor needs ~10 months just to earn back the gas they spent getting
   in and out.
3. **The lumpy, rare harvests that mainnet economics force on you create a
   real attack** — a JIT depositor can step in one block before a harvest and
   capture nearly all of the accrued yield from your actual depositors.

The mechanism design is mostly fine. The chain is wrong. My primary
recommendation is to launch on an L2 (Base or Arbitrum) instead, where every
number below flips from "broken" to "works."

### Assumptions

All figures assume ETH ≈ $3,000 and show gas at 3 / 10 / 30 gwei. Swap in
current numbers before you ship; the conclusions are robust across that whole
range and don't depend on the exact price.

I've also assumed the 4% arrives as a **separate reward token** that `harvest()`
claims and swaps to USDC — that's what "claims the strategy's rewards" implies.
If instead the 4% is native USDC supply interest (Aave/Compound style) that
accrues to the balance automatically, then `harvest()` has nothing meaningful to
claim, and you should confirm what it's actually doing before launch. See
[Open question](#open-question-what-is-harvest-actually-claiming) at the end.

---

## 1. The yield, in absolute dollars

| | Amount |
|---|---|
| $8,000 at 4% APY, per year | **$320.00** |
| per month | **$26.67** |
| per day | **$0.88** |

First month realistically earns less than $26.67, because deposits arrive over
the month rather than on day one. At a linear ramp, average TVL is ~$4,000 and
**month-one yield is about $13.33** across all depositors combined.

Hold that number next to the gas table.

## 2. Gas, in the same dollars

| Action | ~Gas | @3 gwei | @10 gwei | @30 gwei |
|---|---|---|---|---|
| `approve` | 46k | $0.41 | $1.38 | $4.14 |
| `deposit` (incl. push to strategy) | 180k | $1.62 | $5.40 | $16.20 |
| `withdraw` (incl. pull from strategy) | 200k | $1.80 | $6.00 | $18.00 |
| `harvest` (claim + swap + redeposit) | 400k | $3.60 | $12.00 | $36.00 |
| Deploy vault + strategy | 4M | $36.00 | $120.00 | $360.00 |
| **Depositor round trip** (approve+dep+wd) | 426k | **$3.83** | **$12.78** | **$38.34** |

A single harvest at 10 gwei costs **$12.00**. The entire vault earns **$13.33**
in month one. One harvest eats ninety percent of the first month's yield.

Deployment alone costs 11% to 113% of the vault's *entire first year* of yield.

---

## 3. What happens to `harvest()`

The bounty is 1% of what that call claims. A rational caller harvests when
`0.01 × accrued ≥ their gas`.

At 10 gwei that means **accrued rewards must reach $1,200** before calling
`harvest()` is profitable. At $320/year of accrual, that takes **3.75 years**.

The mechanism doesn't malfunction — it correctly computes "don't bother." No one
harvests. Ever. Not out of apathy, out of arithmetic.

The general rule, at $12/harvest:

> **Permissionless harvest needs roughly `$30,000 × (harvests per year)` of TVL
> to self-sustain.**

| Cadence | Minimum TVL for the bounty to cover gas |
|---|---|
| Daily | $10,950,000 |
| Weekly | $1,560,000 |
| Monthly | $360,000 |
| Quarterly | $120,000 |
| Annually | $30,000 |

You are at $8,000. You don't clear the bar at *any* cadence — you're below even
the once-a-year threshold by nearly 4x.

**Consequence:** you are the keeper. Budget for it explicitly, and make sure
someone owns the job — with no third-party caller, an unharvested vault is
nobody's alarm.

### How often should *you* harvest?

Less than your instinct says. The value of compounding more often is almost
nothing at this size:

| Compounding frequency | Annual yield on $8,000 |
|---|---|
| Annual | $320.00 |
| Monthly | $325.93 |
| Continuous (theoretical max) | $326.49 |

**The entire lifetime value of compounding more frequently than once a year is
$6.49.** Monthly harvesting costs $144/year in gas to capture $5.93 of it. Every
harvest past the first is value-destructive by 2x–25x.

Harvest as rarely as the strategy safely permits — realistically **once or twice
in year one** — and let the rewards sit. The only reasons to harvest sooner are
operational, not economic:

- The reward token has a **claim deadline** or forfeits/resets on some trigger.
  Check the emissions contract for this before you decide to sit on rewards for
  a year; some drop unclaimed rewards on balance changes.
- The reward token is **volatile** and you'd rather be in USDC. Sitting on an
  unclaimed reward token for a year is an unhedged directional bet you probably
  didn't mean to take. This is a real argument for harvesting on a schedule, and
  it likely dominates the $6.49 of compounding value — just make the decision
  deliberately rather than by default.

---

## 4. What this means for depositors

This is the part I'd want the team aligned on before marketing goes out.

**Break-even hold time**, i.e. how long a depositor must stay to earn back their
own round-trip gas:

| Deposit | @10 gwei | @30 gwei |
|---|---|---|
| $100 | 3.2 years | 9.6 years |
| $400 | 9.6 months | 2.4 years |
| $1,000 | 3.8 months | 11.5 months |
| $3,000 | 1.3 months | 3.8 months |
| $8,000 | 2 weeks | 6 weeks |

If your $8,000 arrives as ~20 depositors at ~$400 each, **every one of them is
underwater for most of the first year**, and all of them are deeply underwater
at the end of month one. Someone who deposits $100 to try it out and withdraws
after a month is down roughly 10% of their principal, having earned $0.33.

For gas to be a tolerable ≤10% drag on first-year yield, minimum deposit is
**~$1,000 at 3 gwei, ~$3,200 at 10 gwei, ~$9,600 at 30 gwei**.

**Recommendations:**

- **Publish net-of-gas numbers, not "4% APY."** Advertising 4% while the median
  depositor nets negative in year one is the kind of thing that costs you trust
  permanently, and it's avoidable.
- **Set and display a suggested minimum deposit** (~$1,000, with the reasoning).
  A UI hint showing estimated break-even time at current gas would do more for
  depositor outcomes than anything else on this list.
- Expect support tickets from small depositors who got back less than they put
  in. Have an answer written before launch.

---

## 5. Security items worth fixing before you ship

These are ordered by how likely they are to actually bite you.

### 5.1 Harvest sandwiching / JIT deposits — **the one I'd block launch on**

Because harvests are rare and lumpy, each one is a **step change in share
price**. Anyone can deposit in the block before your harvest and redeem in the
block after, capturing a pro-rata slice of yield they were never exposed to.

At $8,000 TVL this is trivially cheap to exploit: someone depositing $400,000
ahead of your harvest takes **~98% of everything your real depositors earned
since the last harvest**, and walks away for the price of two transactions. They
also collect the 1% bounty for calling `harvest()` themselves, which conveniently
lets them control the timing. If deposit and redeem are permitted in the same
transaction, a flash loan removes the capital requirement entirely.

Low TVL makes this *worse*, not better — the smaller your honest deposit base,
the larger the attacker's share of the split.

**Fix (pick at least one):**
- **Locked-profit degradation** — vest each harvest's profit into share price
  linearly over ~7 days (the Yearn pattern). This is the standard fix and it
  composes well with rare harvests.
- Block deposit-and-withdraw within the same block or a short cooldown.
- An exit fee that decays with hold time.

Profit vesting is the right call here because it directly cancels the lumpiness
that rare harvesting forces on you.

### 5.2 Caller-supplied slippage on a permissionless harvest

If `harvest()` swaps the reward token and takes `minAmountOut` from the caller,
a permissionless caller can pass `minOut = 0` and sandwich their own harvest,
extracting far more than the 1% you intended to pay them. At $8,000 the absolute
loss is pocket change; the bug scales linearly with TVL and will quietly eat the
strategy's entire yield later.

**Fix:** derive the minimum out from an on-chain oracle (Chainlink, or a TWAP
with sane bounds) inside the contract. Never trust a permissionless caller's
slippage parameter.

### 5.3 ERC-4626 inflation / donation attack on the first deposit

Standard low-TVL vault hazard, and you are about as low-TVL as it gets. An
attacker front-runs the first real deposit, mints 1 wei of shares, donates USDC
directly to the vault to inflate share price, and the victim's deposit rounds
down to zero shares.

**Fix:** use OpenZeppelin's ERC4626 with the virtual-shares/decimal offset
(v4.9+), or seed dead shares yourself at deployment. Also confirm every
`preview*` function rounds in the vault's favor, not the user's.

### 5.4 Keeper ownership

With the bounty dead, there is no external party watching this vault. If your
harvest is the only one that ever happens, an unmonitored failure — a reverting
claim, a stale reward contract, a changed strategy interface — goes unnoticed
indefinitely. Put a monitor on "time since last successful harvest" and assign
it to a person.

### 5.5 Keep the bounty — it isn't the problem

Worth stating explicitly: the 1%-of-claimed design is sound. Because the bounty
is *proportional*, harvest-spamming can't drain you — a thousand tiny harvests
still cost the vault 1% total. It just doesn't activate at your TVL. Leave it in
as a fallback for when someone else is willing to pay gas, and as the mechanism
that will carry you at scale. Don't count on it for year one.

---

## 6. The business arithmetic

Worth saying out loud:

| Year 1, at $8,000 TVL | |
|---|---|
| Gross yield | +$320 |
| Deployment gas (one-time) | −$120 |
| Harvest gas (2 calls) | −$24 |
| Harvest bounty (1%) | −$3 |
| **Net to depositors** | **~$293** |
| **Net to you** | **−$144**, before audit, monitoring, or any dev time |

There's no fee mentioned accruing to the team. Even a 10% performance fee is
**$32/year** — it doesn't fund a Slack channel, let alone an audit. This vault
cannot pay for its own existence on mainnet at this size, and that's structural,
not a tuning problem.

That's fine if the goal is a dress rehearsal with real money. It is not fine if
anyone upstairs thinks month one is a revenue test. Be clear internally about
which one this is.

---

## 7. What I'd change before launch

**Ranked.**

1. **Deploy to an L2 (Base or Arbitrum) instead of mainnet.** Gas drops by
   roughly 1000x. Harvest costs ~$0.01–0.05, so the permissionless bounty
   actually activates at your TVL and starts working as designed. Depositor
   round trip drops to cents, so a $100 deposit becomes reasonable and your
   break-even table stops being embarrassing. Frequent harvesting becomes
   affordable, which also shrinks the §5.1 sandwich window. This single change
   fixes most of this document. Bridge friction and a thinner reward-token DEX
   market are the real trade-offs — check that the strategy and its reward
   token's liquidity exist there before committing.
2. **Add locked-profit vesting (~7 days).** Required on mainnet, still good
   practice on L2. This is the depositor-harm item.
3. **Move slippage protection on-chain** — oracle-derived `minOut`, not
   caller-supplied.
4. **Use OZ ERC4626 with virtual shares**, or seed dead shares at deploy.
5. **Add a minimum-claim threshold to `harvest()`** so it reverts below some
   floor. Prevents wasting gas on dust and makes the "don't harvest weekly"
   policy enforced by the contract rather than by discipline.
6. **Own the keeper role explicitly.** Fund it (~$150–400 for year one on
   mainnet), schedule it, monitor time-since-last-harvest.
7. **Publish net-of-gas returns and a suggested minimum deposit.** Don't
   advertise 4%.

If mainnet is non-negotiable for reasons outside this analysis — an integration
that only exists there, a partner requirement — then items 2 through 7 are all
still required, and I'd additionally recommend either waiting until you have
meaningful TVL committed, or being upfront with your first depositors that
month one is a trial run and they should not expect to profit.

---

## Open question: what is `harvest()` actually claiming?

I've assumed the 4% comes as a separate reward token. Confirm this, because the
two cases diverge sharply:

- **Separate reward token** (assumed): everything above applies. The swap makes
  §5.2 live, and §4's "you're holding an unhedged reward token for a year" is a
  genuine decision to make.
- **Native USDC supply interest** (Aave/Compound): interest accrues to the
  balance automatically, `harvest()` has nothing to claim, and the bounty is
  paid for no work. In that case the compounding argument is moot — the position
  already compounds — and you should find out what the function is really doing
  before shipping it.

Either way: the gas arithmetic in §1–4, the JIT-deposit exposure in §5.1, and
the recommendation to move to an L2 are unchanged.
