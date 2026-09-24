# Operational read: USDC yield vault, first month on mainnet

## Short version

The vault will work exactly as written, and that is the problem. `harvest()` will
never be called by a stranger, because at $8,000 TVL the 1% bounty is worth about
a cent and the gas to claim it costs several dollars. Rewards accrue and sit there.
Depositors see 0% until someone eats the cost out of pocket — which means you, which
means you are the operator of a system you designed to not need one.

Separately, on mainnet the gas to enter and exit the vault is larger than a year of
yield for any depositor under roughly $250. Most of your first-month depositors will
lose money by using the product even if everything functions perfectly.

The highest-leverage change is deploying to an L2 instead of mainnet. That single
change takes the incentive design from broken to working, without touching the
contract.

---

## The numbers this all rests on

| Quantity | Value |
|---|---|
| TVL, first month | $8,000 |
| Strategy APY | 4% |
| Gross yield, per year | $320 |
| Gross yield, per month | $26.67 |
| Gross yield, per day | **$0.88** |
| Harvester's cut (1%) of one day's accrual | **$0.0088** |

That last number is the whole analysis. A harvester who calls the function once a day
earns **under one cent**.

Assumptions used below: a `harvest()` call costs ~250,000 gas (claim from strategy +
swap/compound + share accounting; adjust if yours is heavier, which it probably is),
ETH at $3,000. I've run the sensitivity because these assumptions do move the answer —
see the table.

---

## 1. Nobody calls `harvest()`

A smart contract is a state machine. It sits in one state and moves to the next only
when somebody pokes it and pays gas. There is no scheduler, no cron, no background
process. So for the transition "rewards accrued → rewards compounded," you have to be
able to answer three questions:

1. **Who pokes it?** Anyone — it's permissionless. Good.
2. **Why would they?** They keep 1% of the claim. Good in principle.
3. **Is the incentive sufficient?** No. This is where it falls apart.

A rational caller harvests when `1% of pending rewards > gas cost`. Rearranged, the
pot has to reach **100× the gas cost** before the first call is even break-even — and
break-even isn't a reason to act, so realistically it needs to be a multiple of that.

At $0.88/day of accrual:

| Gas price | Cost of one harvest | Pot needed to break even | Time to get there |
|---|---|---|---|
| 1 gwei | $0.75 | $75 | ~2.8 months |
| 5 gwei | $3.75 | $375 | ~14 months |
| 10 gwei | $7.50 | $750 | ~28 months |
| 30 gwei | $22.50 | $2,250 | ~7 years |

At any normal mainnet gas price, the first economically rational harvest is **years**
away. In your first month, the pot reaches $26.67 and the bounty reaches 27 cents
against a $7.50 gas bill. No searcher, no bot, no altruist with a working spreadsheet
calls it.

This is not a bug in your incentive mechanism. The mechanism is correct — it's the same
one Yearn uses. It's a **scale mismatch**. A 1% harvest bounty works for Yearn because
a Yearn vault holds tens of millions, so a harvest claims tens of thousands of dollars
and 1% is a real payday. Your vault is ~1,000–6,000× smaller than the design that
number was borrowed from. Percentage-only bounties have a floor below which they stop
being incentives and become decoration.

**What TVL would you need for the mechanism to work as written?** For a caller to clear
a $7.50 gas bill from a 1% cut, the claim must be $750:

- **Daily** harvests → needs ~$6.8M TVL
- **Weekly** harvests → needs ~$975k TVL
- **Monthly** harvests → needs ~$225k TVL

Even the loosest of those is ~28× the deposits you're expecting, and it only buys you
*break-even* monthly harvests.

## 2. So what do depositors actually experience?

Depends on one implementation detail I can't check without the contract:

- **If share price only increases on `harvest()`** (the common design): depositors see a
  flat, unmoving balance. The advertised 4% APY delivers **0%**, indefinitely. The
  rewards exist, they're just stuck on the strategy side of the line, uncompounded.
- **If the vault marks pending rewards into share price continuously**: depositors see
  the yield accrue on paper, but it isn't compounding, so they get simple interest
  rather than 4% APY — a smaller gap, but still under-delivery, and they still can't
  withdraw the uncompounded portion until someone harvests.

Either way: **check which one you built before launch**, because the first case means
your headline number is off by 100%.

## 3. Depositor gas economics kill the product independently

Set harvest aside entirely and assume 4% is delivered perfectly. On mainnet:

- ERC-20 `approve` + `deposit`: ~170,000 gas ≈ **$5** at 10 gwei
- `withdraw`: ~120,000 gas ≈ **$3.60**
- Round trip: **~$8.60**

If $8,000 arrives from ~40 depositors, that's $200 each, earning **$8/year**. They spend
$8.60 to earn $8. A one-year hold is a net loss.

**Break-even deposit for a one-year hold is roughly $250**, and that's only break-even —
to earn anything worth the trouble a depositor needs $1,000+, held for a year, with
harvests actually running. Anyone depositing $100 "to try it out" is down 9% on day one
and will never recover it.

This is the part I'd be most uncomfortable shipping quietly. If your frontend shows
"4% APY" next to a deposit button, that number is false for the majority of people who
will click it. It should show **net-of-gas APY for the amount they typed in**, and it
should warn below the break-even size.

## 4. If you decide to run the keeper yourself, price it first

The obvious patch is "we'll just call harvest ourselves." Do the arithmetic before
committing:

- Daily harvests: 365 × $7.50 = **$2,700/year** to generate **$320/year** of yield.
  You'd spend 8.4× the vault's entire gross output.
- Weekly: 52 × $7.50 = **$390/year**, still more than the $320 the vault produces.
- Monthly: 12 × $7.50 = **$90/year**, or 28% of gross yield burned on gas — survivable,
  but it means your real delivered APY is ~2.9%, and monthly compounding at this size is
  barely distinguishable from not compounding.

There's no harvest cadence on mainnet at $8,000 TVL where the gas is a sane fraction of
the yield. And note that when you call `harvest()`, you also pay yourself the 1% bounty —
harmless, but it means your accounting shouldn't treat that 1% as revenue.

The deeper issue is architectural. If the vault only produces yield while you're
subsidizing it, then:

- the permissionless `harvest()` is cosmetic, not a real decentralization property, and
  saying otherwise in your docs is a misrepresentation;
- you have a single point of failure — you lose the key, run out of runway, or get bored,
  and depositor yield silently stops with no alarm and no fallback;
- you've built a **service**, not a hyperstructure. That's a legitimate choice, but make
  it deliberately and tell users, rather than discovering it in month three.

## 5. The bug that actually loses money: harvest-timing sandwich

This one is worth fixing regardless of what you decide about chains.

If `harvest()` books the entire claimed profit into share price **instantly**, then rare
harvests create a large, publicly visible, predictable jump in share price. Anyone can
front-run it:

1. Watch the pending-rewards balance until a harvest is imminent (or just watch the
   mempool for the harvest tx).
2. Deposit a large amount in the block before.
3. Harvest lands; share price jumps; the attacker now owns most of the shares that
   absorbed it.
4. Withdraw in the next block.

Concretely: suppose you self-harvest once after 12 months, claiming $320 on $8,000 TVL —
a 4% share-price jump in a single block. An attacker deposits $100,000 immediately
before, captures ~92% of that $320, withdraws, and walks with ~$295 for maybe $20 of gas.
Your actual depositors, who held for the full year, get the remaining $25.

Note that **your situation makes this worse, not better.** The fix for scale-mismatched
bounties is "harvest less often," and infrequent harvests mean a bigger pot landing in
one block against a small TVL — i.e. a bigger, juicier jump. The two problems compound.

Mitigations, in order of preference:

- **Stream the profit.** Yearn's locked-profit-degradation pattern: recognize harvested
  gains linearly over a few days instead of instantly. Removes the arbitrage entirely,
  because there's no single block to sandwich. This is the right fix.
- Deposit/withdraw fee, or a minimum lock. Blunter, worse UX, but effective.
- Harvest via a private mempool (Flashbots) — helps against mempool watchers, does
  nothing against someone simply watching pending rewards grow.

While you're in there, also confirm: `harvest()` is `nonReentrant`; the 1% fee uses a
`mulDiv` that can't round the caller's cut to zero on dust claims (with 6-decimal USDC
you're fine at these sizes, but check the reward token's decimals); and `harvest()`
reverts or no-ops cleanly on a zero-value claim so it can't be spammed.

---

## Recommendations, ranked

**1. Deploy to an L2, not Ethereum mainnet.** Single highest-leverage change, and it needs
no contract modifications. On Base/Arbitrum/OP, a harvest costs roughly $0.01–0.05.
Break-even pot becomes $1–5, which the vault accrues in **1–6 days** — so your 1% bounty
starts doing the job it was designed to do, called by actual strangers, with no keeper.
Depositor round-trip gas drops to a few cents, so the break-even deposit falls from ~$250
to roughly $2, and small depositors stop being harmed. Every problem in this document
except the sandwich either disappears or becomes negligible. Mainnet is the wrong venue
for an $8,000 vault; the L1 security premium is not something an $8,000 vault is buying
anything with.

**2. Add a floor to the harvest bounty.** Percentage-only bounties break at small scale.
Pay `max(1% of claim, gasUsed × tx.gasprice + tip)`. Because a flat floor can be drained
by spam, gate it: `require(pendingRewards >= MIN_HARVEST)` plus a cooldown, so a caller
can only claim the floor when there's genuinely something to compound. Keep the 1% term
so the incentive still scales up if you grow.

**3. Harvest opportunistically inside `deposit()`/`withdraw()`.** If pending rewards exceed
a threshold when a user interacts, harvest as part of their transaction. The user is
already paying gas and already waiting; the marginal cost is small. This gives you a
second, independent path to compounding that doesn't depend on any bounty being
attractive — belt and braces.

**4. Stream harvested profit rather than booking it instantly** (see §5). Do this one
whatever else you decide.

**5. Fix the advertised number.** Show net-of-gas APY computed for the deposit size the
user has actually entered, and warn below the break-even amount. If you stay on mainnet,
publish a minimum recommended deposit.

**6. Decide out loud whether this is a hyperstructure or a service.** If you're running a
keeper, say so in the docs, budget it explicitly, and set up alerting for "no harvest in
N days" — because the failure mode is silent. If you want it to be self-sustaining,
recommendation 1 is how you get there.

## Two things I couldn't check

- **Is there an owner/pause/upgrade path?** Not mentioned above. If there is, that's a key
  that can freeze depositor funds, and it belongs in your docs and ideally behind a
  multisig with a timelock. If there isn't, the flip side is you cannot fix the issues in
  §5 after deployment — worth settling deliberately rather than by default.
- **Everything here is public.** Every depositor address, balance, deposit time and exit is
  visible on a block explorer forever, and at 40 depositors the set is small enough to
  deanonymize. Fine, but your users should know.

## Bottom line

Nothing above is a coding error — the mechanism is a faithful copy of a design that
works. It's borrowed at a scale where the economics invert: a bounty smaller than its own
gas cost, and entry costs larger than a year of returns. Moving to an L2 fixes most of it
for free. Add a bounty floor and profit streaming and you have a vault that genuinely runs
itself. Ship it to mainnet as-is and you have a contract that sits in one state forever
while you quietly pay to move it.
