# Operational Read: USDC Yield Vault, First Month

## TL;DR

**`harvest()` will never be called by a stranger.** The 1% caller reward is
worth about **$0.27/month** at your expected TVL, while a mainnet harvest
transaction costs **$2–$15 in gas**. No rational caller will pay $5 to earn
$0.27. The permissionless-harvest pattern you're copying works for Yearn
because their harvests are millions of dollars. At $8k TVL on mainnet, the
incentive is dead code — the vault will sit unharvested unless *you* call it.

---

## The math

| Item | Value |
|---|---|
| Expected deposits | $8,000 |
| Yield at 4% APY | ~$26.67/month (~$0.88/day) |
| Caller's 1% cut of a monthly harvest | **~$0.27** |
| Caller's 1% cut of a weekly harvest | ~$0.06 |
| Mainnet gas for a harvest tx (~150–400k gas) | **~$2–$15** |
| Claim size needed for 1% to cover a $5 gas cost | $500 |
| Time for this vault to accrue a $500 claim | **~19 months** |

A profit-motivated caller breaks even only when `claim × 1% ≥ gas`. On this
vault, that happens roughly once every year and a half — and even then the
"profit" is near zero, so bots won't bother. MEV/keeper bots are tuned for
opportunities worth dollars, not cents.

## What actually happens once it's live

Smart contracts are state machines: they do nothing between external calls.
There is no cron, no scheduler, no background process. Every state transition
needs someone to (1) pay gas and (2) have a reason to. Your design answers
question 1 ("anyone") but fails question 2 — the incentive is 10–50× too small.

Concretely, in month one:

1. Deposits come in, funds sit in the strategy, rewards accrue.
2. Nobody calls `harvest()`. Not bots (unprofitable), not depositors
   (they'd pay more in gas than their share of the reward), not you
   (you assumed the market would do it).
3. Rewards pile up unclaimed in the strategy.
4. Depending on how the vault accounts for yield, one of two things:
   - **Rewards count toward share price only when harvested** → depositors
     see ~0% APY, not 4%. This is the bad outcome: you'll field "why is my
     balance not growing" support tickets within two weeks.
   - **Base yield accrues anyway and harvest only compounds** → depositors
     get ~4% simple interest but no compounding. Much less bad (see below),
     but the headline "auto-compounding vault" feature is fictional.

## What it means for depositors

- **Best case-ish:** they earn ~4% simple instead of ~4.07% compounded. On
  $8k, the compounding you're failing to deliver is worth **~$6/year total**
  (~$0.50/month across all depositors combined). Financially trivial.
- **Worst case:** if unharvested rewards don't accrue to shares, they earn
  nothing until someone harvests, and the effective APY depends entirely on
  when you manually poke the contract.
- Either way, the *operational* risk is bigger than the financial one: a
  vault whose core mechanism visibly doesn't fire looks abandoned or broken,
  and at $8k TVL you can't afford the trust hit.

## What to change before launch

Pick one (roughly in order of preference for your size):

1. **Deploy to an L2 (Base, Arbitrum) instead of mainnet.** Gas drops to
   ~$0.01–0.10. At that point 1% of a monthly harvest ($0.27) clears the bar
   and the permissionless design actually works as intended. This is the only
   option that keeps the mechanism honest rather than subsidized.

2. **Run your own keeper and treat harvest as an operating cost.** A simple
   script (or Gelato / Chainlink Automation) calling `harvest()` on a
   schedule. Budget honestly: weekly harvests at ~$5 gas = ~$20/month against
   ~$27/month of total yield — you'd be burning most of the yield to compound
   it. Monthly or even quarterly harvests are the rational cadence at this
   TVL. This works, but recognize what it is: you're building a *service*
   with an operator (you), not a self-sustaining protocol. Fine at this
   stage — just don't tell yourself it's the Yearn model.

3. **Piggyback harvest on user interactions.** Trigger the claim inside
   `deposit()`/`withdraw()` so the gas is amortized into transactions that
   are happening anyway. Common pattern, no keeper needed, but compounding
   frequency becomes a function of user activity — at $8k TVL that might
   mean rarely.

4. **Ship without compounding.** Given the compounding benefit is ~$6/year,
   the honest move may be to let yield accrue simply, drop the harvest
   mechanism (or keep it admin/keeper-only), and revisit when TVL is 100×
   larger. Don't ship a permissionless incentive that you already know won't
   clear — dead incentives are worse than no mechanism, because they create
   a false expectation that the system maintains itself.

**Do not** respond by just raising the caller fee. Even a 10% fee needs a
$50 claim (~2 months of yield) to clear $5 gas; even giving the caller 100%
of the claim only barely clears a $5–15 gas cost on a monthly harvest. The
problem is the TVL-to-gas ratio, not the fee parameter.

## The general lesson

For every state transition in the system, ask: who pokes it, why would they,
and is the incentive sufficient *after gas*? Permissionless + incentivized is
the right shape — but the incentive has to clear mainnet gas at *your* scale,
not at the scale of the protocol you copied the pattern from. At $8k TVL on
mainnet, almost no per-call percentage incentive clears. Either move where
gas is cheap, or accept that you're the operator for now.
