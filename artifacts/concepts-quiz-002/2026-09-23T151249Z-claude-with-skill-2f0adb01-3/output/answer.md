# Operational read: USDC yield vault, first month

## Bottom line

The contracts will work. The **incentive that makes them work will not fire.**

At $8,000 TVL and 4% APY the vault produces **$26.67 of yield in month one**. The
harvest bounty on that is 1% — **27 cents**. A `harvest()` call on Ethereum
mainnet costs somewhere between $4 and $40 in gas. So nobody calls `harvest()`.
Not out of laziness — because calling it is a guaranteed loss of 15x to 150x the
reward.

Nothing onchain is automatic. There is no cron job, no scheduler, no background
process that compounds the vault. `harvest()` is a state transition, and every
state transition needs someone to pay gas and a reason to do it. You designed
the reason correctly (permissionless + 1% bounty is the right pattern, it's
Yearn's pattern) — but at this size the reward is smaller than the cost, so the
transition never happens and the vault sits in "rewards pending" forever.

The second problem is the same arithmetic applied to your depositors: at mainnet
gas, most of them will spend more on entering and exiting than the vault will
ever pay them.

---

## The numbers

Yield the whole vault generates, at $8,000 and 4%:

| Period | Total yield | Harvest bounty (1%) |
|---|---|---|
| Per day | $0.88 | $0.009 |
| Per month | $26.67 | $0.27 |
| Per year | $320.00 | $3.20 |

**The entire vault's first-year yield is $320.** That is the budget the whole
system has to work with. Your mainnet deployment transaction alone probably
costs $70–$400 of it.

### When does harvesting actually become profitable?

Assume a `harvest()` costs ~400k gas (claim + swap reward token + re-deposit;
could be more if the strategy touches several protocols) and ETH is ~$3,500.
A rational caller needs `1% of claim > gas`, i.e. **claim > 100x gas cost**:

| Base fee | harvest() gas cost | Claim needed to break even | TVL where that accrues monthly | How long *your* $8k vault needs to accrue it |
|---|---|---|---|---|
| 3 gwei | ~$4.20 | $420 | ~$126,000 | ~16 months |
| 10 gwei | ~$14 | $1,400 | ~$420,000 | ~4.4 years |
| 30 gwei | ~$42 | $4,200 | ~$1,260,000 | ~13 years |

So: **this design needs roughly $150k–$400k TVL before it becomes
self-operating.** You're launching at 2–5% of that. The bounty mechanism is
correct but it is switched off until you're ~20–50x bigger.

Note the bounty being a *percentage of the claim* does one nice thing: it makes
callers wait for a big enough claim rather than harvesting wastefully. That's
good design. It also means the harvest cadence self-selects to "once every 16
months" at your size, which is the same thing as "never" for month one.

---

## What actually happens, week by week

1. **Day 0** — you deploy. Vault is empty. (See the empty-vault share rounding
   issue below — do not leave it empty.)
2. **Days 1–30** — depositors trickle in, each paying gas to get in. Deposits
   reach ~$8,000.
3. **Days 1–30** — the strategy accrues rewards. Whether depositors *see* any
   of it depends entirely on the strategy type (next section).
4. **No point in month one** — `harvest()` is not called by a stranger. The
   mempool is watched by bots that model gas vs. reward precisely; they will
   see a 27-cent bounty against a $14 cost and skip it every time.
5. **End of month one** — either you called `harvest()` yourself out of pocket
   (in which case you are the operator, and this is a service, not a
   hyperstructure), or there is ~$27 of unclaimed rewards sitting in the
   strategy and the advertised APY has not materialized.
6. **First withdrawals** — anyone who exits before a harvest leaves their share
   of unclaimed rewards behind for whoever stays. Small in dollars, but it means
   early exits are silently penalized and the accounting doesn't match what
   users were told.

### The one question that changes this answer

**Does the strategy's 4% accrue into the vault's balance on its own, or does it
have to be claimed?**

- **Rebasing / accruing position** (Aave aUSDC, Compound cUSDC, sDAI-style):
  the balance grows without anyone poking it. Share price rises continuously,
  depositors earn their 4% even with `harvest()` never called. In that case
  `harvest()` is only compounding a *secondary* reward stream and the stall is
  cosmetic — annoying, not broken.
- **Emission rewards you must claim** (a gauge, a staking contract, a
  MerkleDistributor, anything paying out in a reward token): nothing accrues to
  depositors until `harvest()` runs. Realized APY in month one is **0%**, and
  your marketing number is wrong.

I can't tell which you have from the description. Answer this before launch —
it's the difference between "suboptimal" and "the product does not do the thing
we said it does."

If it's the claim-and-swap kind, there's a further problem: `harvest()` has to
**sell ~$27 of a reward token on a DEX**. At that size you'll eat fixed pool
costs and slippage, the swap is trivially sandwichable, and for many reward
tokens a $27 sale nets materially less than $27. Also decide what oracle or
slippage bound guards that swap — a hardcoded `amountOutMinimum: 0` is the
single most common way vaults get drained, and "the amounts are tiny" stops
being true the moment TVL grows.

---

## What this means for your depositors

Round-trip gas (approve + deposit + withdraw, ~240k gas total, ETH $3,500):

| Base fee | Round-trip gas cost | Deposit size where year-one yield just covers gas | Deposit size where gas is <10% of year-one yield |
|---|---|---|---|
| 3 gwei | ~$2.50 | ~$63 | ~$630 |
| 10 gwei | ~$8.40 | ~$210 | ~$2,100 |
| 30 gwei | ~$25 | ~$630 | ~$6,300 |

If $8,000 arrives from ~20 people, the average position is $400, earning **$1.33
a month**. At 10 gwei that depositor spends 6 months of yield on gas just to get
in and out. At 30 gwei, 19 months.

Put bluntly: **at typical mainnet gas, only depositors putting in more than
~$2,000 are meaningfully earning anything.** With $8,000 total, that's at most
three people. Everyone else is paying you (well, paying validators) for the
privilege of a rounding error. And if the strategy is the claim-type above, they
earn $0 while still paying full gas.

This is the part I'd feel worst about shipping. It isn't a bug, and it isn't
dishonest — but a depositor who puts in $250 and gets back $248 nine months
later will reasonably feel misled by "4% APY."

---

## Other things that bite at this size

**Empty-vault share inflation.** If the vault launches with zero supply, the
first depositor (or an attacker who front-runs them) can deposit 1 wei, donate a
large amount directly to the vault, and make the share price so high that the
next depositor's shares round to zero — their funds go to the attacker. Standard
ERC-4626 hazard. Fix: seed the vault yourself with a permanently locked deposit
(burn the shares), or use OpenZeppelin's ERC4626 with virtual shares/decimal
offset. Do this before anyone else can deposit.

**Harvest sandwiching.** If harvest lands profit as a lump sum, share price
jumps in one block. A bot can deposit in the block before the harvest and
withdraw in the block after, capturing yield it was never exposed to, diluting
everyone who actually sat there for the month. At $27 this is pennies; at $1M
TVL it's the main way vaults leak value to MEV. Cheap to fix now: drip profit in
over time (Yearn's locked-profit degradation), or accrue continuously rather
than in a lump.

**Who can stop this (CROPS).** If the vault has `Pausable` + `onlyOwner`, or an
upgradeable proxy, or an admin-set strategy address, then one key can freeze or
redirect depositor funds. That's a censorship vector and a single point of
failure — and it should be stated plainly in your docs, not just discoverable on
Etherscan. Decide deliberately: emergency powers with a timelock and a multisig
(defensible), or immutable (also defensible). "Owner is an EOA on a hot wallet"
is not.

**Everything is public.** Every depositor's address, amount, and timing is
visible forever. If you expect users who don't know that, tell them.

**If harvest never runs, do the rewards survive?** Some reward contracts have
claim windows, get migrated, or stop emitting. Sixteen months of "we'll harvest
eventually" is long enough for the reward source to change under you. Check the
specific strategy's claim semantics.

---

## What I'd change before launch

Ranked by how much it matters.

**1. Don't launch on Ethereum mainnet. Launch on an L2 — Base, Arbitrum, or
Optimism (all have native USDC).**

This fixes both problems at once and nothing else does. A 400k-gas transaction
on Base costs roughly $0.01–$0.10. Suddenly:

- The 27-cent monthly bounty comfortably clears the gas cost — `harvest()`
  actually gets called by strangers, monthly or better. Your incentive design
  starts working *at your actual size* instead of at 50x your size.
- Depositor round-trip gas drops to a few cents, so a $250 deposit keeps
  essentially all of its yield. The vault becomes honest for small depositors.

At $8,000 TVL, mainnet is not a neutral choice — it is the thing breaking the
design. Mainnet makes sense when you're at $1M+ and callers are competing for
real bounties. Ship on an L2, let it grow, deploy to mainnet later if the TVL
justifies it.

**2. If you must be on mainnet, stop pretending it's self-operating.** Pick one
and say so out loud:

- *You are the keeper.* Run a bot that calls `harvest()` on a schedule and eats
  the gas as a marketing cost (~$50–$170/year). Keep it permissionless so
  anyone can step in, but document that in practice the team pays. That's a
  service with a single point of failure, which is fine — just don't call it
  decentralized.
- *Piggyback on user gas.* Harvest inside `deposit()`/`withdraw()` when pending
  rewards exceed a threshold, so whoever is already paying gas absorbs the
  compounding. Careful: this taxes one unlucky user with the whole cost, and
  makes gas costs unpredictable. Set the threshold so it only triggers when the
  harvest is actually worth more than the gas it adds.
- *Raise the bounty.* 1% of $26 is nothing at any percentage — you'd need ~50%
  to clear gas, which isn't a product. A flat floor (e.g. "caller gets
  `max(1% of claim, 0.003 ETH)` from the treasury") works, but you're
  subsidizing it either way, so it's option one with extra steps.

**3. Set a minimum deposit, or at least warn at the UI level.** Show the user
the gas they're about to pay next to the yield they should expect at their
size, over a realistic holding period. If it's negative, say so before they
sign. This costs you a few small deposits and buys you every depositor's trust.

**4. Fix the two structural issues now while they're cheap:** seed the vault
against the first-depositor rounding attack, and drip harvested profit instead
of landing it in one block.

**5. Restate the APY honestly.** "4% APY" is a gross strategy number. Your
depositors receive 4%, minus 1% of it to the harvest caller, minus gas — and
minus 100% of it if `harvest()` is what unlocks the rewards and it never runs.
Publish a net figure at a realistic deposit size.

---

## The test to keep applying

For every state transition in the system, three questions: **who pokes it, why
would they, and is the incentive bigger than their gas?** You asked the first
two and got them right. The third is where this vault fails, and the fix is
mostly a matter of choosing a chain where gas is small enough that your existing
design works as intended.
