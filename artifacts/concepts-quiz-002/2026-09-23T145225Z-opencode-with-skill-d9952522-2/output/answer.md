# Operational read: first month on mainnet

Live chain data used below (2026-09-23): mainnet gas ~1.3 gwei, ETH ~$2,666, USDC ≈ $1.
I assume a harvest costs ~300k gas (claim from the reward source + compound back into the
vault; adjust if yours is heavier). Gas is volatile, so I bracket everything with 5 and
10 gwei scenarios — those are normal mainnet conditions, not pessimism.

## What the vault actually earns

$8,000 at 4% APY is **$0.88 a day, $26.67 a month — total, across every depositor**.
Everything downstream is small because this number is small.

## What actually happens once it's live

**Deposits.** Each depositor pays their own mainnet gas to get in (~150k gas ≈ $0.50
today). If $8k spreads over ~20 wallets, the average $400 position earns $1.33/month.
A deposit + withdraw round trip is ~$1.10–1.50 at today's gas — about a month of that
depositor's yield — and ~$8 if gas returns to 10 gwei, about six months of it.

**harvest(): the transaction nobody sends.** A contract is a state machine; it moves only
when someone pays to move it. Ask it of harvest: who sends it, why would they, and is
their reward bigger than their gas?

- Who *can*: anyone. Permissionless is right — no dependency on a keeper or your key.
- Why they *would*: the 1% tip. On a full month of accrual that's 1% × $26.67 = **$0.27**.
- What it *costs them*: **~$1.03** today, $4 at 5 gwei, $8 at 10 gwei.

A stranger breaks even only when the claim is 100× the gas cost. That means:

| Gas | Break-even claim | Accrual time |
|-----|-----------------|--------------|
| 1.3 gwei | $103 | ~4 months |
| 5 gwei | $400 | ~15 months |
| 10 gwei | $800 | ~2.5 years |

Nobody runs a bot to make a dollar a quarter. Month one — and for a long while after —
**harvest only happens if your team sends it and eats the gas**. At today's gas a monthly
team harvest realizes $26.67 for a net cost of ~$0.76 (the 1% comes back to the caller):
a ~3% haircut on the month's yield. At 5 gwei that's ~$3.73/month, a ~15% haircut; at 10
gwei, ~$7.73, a ~29% haircut.

**What depositors observe.** Share price only moves when harvest compounds. Between
harvests the strategy earns but the vault reads flat. So a depositor checking a month in
sees **0% APY regardless of what the strategy earns**. "4% APY" is a claim about harvest
frequency at least as much as about the strategy.

**The early-exit leak.** Someone who withdraws between harvests exits at the pre-harvest
share price — their accrued-but-unharvested yield stays behind for whoever remains. With
months between harvests that's real, if small: it quietly favors patient depositors and
costs anyone who leaves early. Say it out loud in your docs.

**Nothing gets griefed or MEV'd.** Spamming harvest only burns the spammer's gas. If
harvest swaps a reward token through an AMM, that swap is public and sandwichable in
principle — at $27 a claim it's irrelevant, but it's the only place this vault touches
MEV.

**Everything is public forever.** Every depositor address and size, the harvest cadence,
who calls harvest — competitors can read all of it onchain. That's not a problem to fix,
just a fact to publish.

## What this means for depositors

- Realized APY in month one is entirely a function of how often *you* harvest: ~3.96%
  with monthly team compounding, 0% visible with none.
- Per-depositor gas is on the order of one month to six months of their yield, depending
  on gas. Anyone under ~$250 is net-negative on a round trip in every scenario.
- Yield arrives in lumps (at harvest), not as a curve, and leaving early forfeits accrued
  yield to whoever stays.

## Should anything change before launch?

1. **The chain, not the 1%.** At $8k AUM the permissionless-harvest design cannot pay a
   stranger on mainnet: for the 1% to cover gas on a monthly claim you need ~$31k AUM at
   today's gas, and $120k–240k at more typical gas. The identical vault on an L2 works
   exactly as written — a harvest costs cents, monthly compounding is nearly free, and the
   1% genuinely can support a bot. If small-but-alive is the goal, an L2 is the coherent
   home. If mainnet is non-negotiable (a warm-up for bigger AUM), go in per below.
2. **Own the harvest, and make it threshold-based, not scheduled.** Commit publicly to
   something like "harvest when accrued rewards ≥ 10× the current gas cost" — roughly
   monthly at today's gas, roughly quarterly at 5 gwei — so depositors expect share price
   to step, not slope.
3. **Keep harvest permissionless regardless.** It costs nothing and it's your liveness
   guarantee if you stop caring: an integrator or a generous user can always compound.
   Keep the 1% if you like, but call it what it is at this scale — a rounding error that
   becomes a real, self-starting incentive around $30k+ AUM, not the thing that runs the
   vault at $8k.
4. **If the reward source can accrue without a claim** (exchange-rate growth rather than
   pull-based rewards), prefer that: no scheduled transaction exists at all, and harvest
   degrades into an optional escape hatch. The best keeper is no keeper.
5. **Write down your operator powers before shipping.** The brief covers what harvest
   does but not what *you* can do to users: any `Pausable`, `onlyOwner` path touching user
   funds, upgradeable proxy, deposit cap, or blacklist on vault or strategy is a way to
   stop a paying user — and each has a lost-key failure mode. If you shipped none, say
   that; if some, say what happens the day the key is gone. Same split for the stack:
   contracts and onchain state survive you disappearing (anyone can deposit, withdraw,
   and harvest against the verified addresses), while your frontend, API, and any APY
   dashboard do not. Know which half the "4%" story lives in.

## Bottom line

Nothing here is broken; it's inert. The mechanism meant to keep this vault working with
nobody running it — permissionless harvest with a 1% tip — pays $0.27 against $1+ of gas
at your expected AUM, so for the first months the vault runs only when you pay to run it.
Change the economics (chain, or AUM) or change the story (lumpy, team-subsidized
compounding) before depositors form their own read.
