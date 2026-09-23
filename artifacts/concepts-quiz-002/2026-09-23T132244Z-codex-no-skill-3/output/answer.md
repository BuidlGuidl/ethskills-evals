# Operational read: first month of the USDC vault

## Executive view

At the expected launch size, this vault is economically too small for Ethereum
mainnet auto-compounding to matter.

If the vault reaches about $8,000 of USDC deposits during month one and the
strategy earns roughly 4% APY, the gross yield available in the first month is
small:

- If the full $8,000 is deposited for the whole month: about $26.30 of gross
  yield.
- If deposits ramp linearly from $0 to $8,000 over the month: about $13.15 of
  gross yield.
- The 1% harvest reward is therefore only about $0.13 to $0.26 for the month.

That means `harvest()` will not be called often by economically rational third
party keepers unless gas is unusually cheap, the harvest transaction is very
cheap, or someone is calling it for non-economic reasons.

## What likely happens once live

Depositors put USDC into the vault and the strategy begins earning yield. The
yield accumulates slowly: on $8,000 at 4% APY, the vault earns about $0.88 per
day if fully funded from day one.

Because `harvest()` is permissionless, anyone can claim and compound the
strategy rewards. But the caller only keeps 1% of the claimed amount. On the
expected first-month numbers, that incentive is measured in cents. If a harvest
after a full month claims $26.30, the caller receives about $0.26. If the vault
ramps up over the month and claims around $13.15, the caller receives about
$0.13.

On Ethereum mainnet, that is not a robust keeper incentive. Even in periods of
low gas, the caller has to pay transaction costs, monitor the vault, and accept
execution risk. In normal or spiky gas conditions, the caller loses money. The
practical result is that harvests will be irregular. The vault may sit
unharvested for long stretches until either gas is very cheap, rewards have
accumulated enough, or the team manually calls `harvest()`.

Compounding frequency is also not very important at this size. The difference
between daily, weekly, and monthly compounding on a 4% APY strategy with $8,000
of TVL is tiny. The operational problem is not missed compounding alpha; it is
that the vault has a mainnet keeper workflow whose reward is too small to fund
the work.

## What this means for depositors

Depositors should not expect a smooth "auto-compounding" experience in the
first month. The strategy may be earning yield, but the visible vault balance or
share price may only move when harvests happen, depending on how pending rewards
are accounted for.

The expected return is also very small in absolute dollars. A $1,000 depositor
earns roughly $3.30 in a full month at 4% APY before the harvest incentive. The
1% harvest cut reduces strategy yield from 4.00% APY to about 3.96% APY before
other costs, which is not the main issue. The bigger issue is Ethereum mainnet
transaction cost: a depositor's approve, deposit, or withdrawal transaction can
easily consume a meaningful portion of their first-month yield.

There is also a fairness/accounting issue to confirm before launch. If
unharvested rewards are not included in `totalAssets`, then users who deposit
right before a harvest can receive a share of rewards earned before they
arrived, and users who withdraw before a harvest can miss rewards earned while
they were in the vault. With small numbers this is not catastrophic, but it is
exactly the kind of edge case that creates confusing depositor outcomes.

## What should change before launch

The cleanest recommendation is: do not launch this vault on Ethereum mainnet at
an expected $8,000 first-month TVL unless the team is willing to operate
harvesting manually or subsidize it.

Better options:

1. Launch on an L2 or another lower-cost venue instead of Ethereum mainnet.
   At this TVL and yield rate, lower transaction cost matters more than tiny
   differences in compounding cadence.

2. If mainnet launch is required, treat harvesting as an operator responsibility
   for now. Keep `harvest()` permissionless if desired, but do not rely on the
   1% bounty to make it happen. Have the team or a funded keeper call it on a
   schedule, such as monthly or when pending rewards exceed a minimum threshold.

3. Add explicit harvest guards if they do not already exist:
   - a minimum claim amount,
   - a minimum expected net gain,
   - slippage limits for any reward-token swaps,
   - and clear handling of pending rewards in `totalAssets`.

4. Do not simply raise the harvest incentive without modeling the tradeoff.
   At this scale, paying enough to make mainnet keepers consistently profitable
   can take a noticeable bite out of depositor yield. A higher bounty may solve
   keeper liveness while making the product less attractive.

5. Set depositor expectations plainly. The honest launch message is that this
   is a low-yield, small-TVL mainnet vault where harvests may be infrequent and
   transaction costs can dominate small accounts' first-month returns.

## Bottom line

The vault can function mechanically, but the current operating design does not
match the expected economics. With only $8,000 of TVL and 4% APY, month-one
yield is about $13-$26, and the harvest bounty is about $0.13-$0.26. That is
not enough to support reliable permissionless harvesting on Ethereum mainnet.

Before launch, either move the product to a cheaper chain, make harvesting a
team-operated/subsidized process, or wait until expected TVL is large enough
that the keeper incentive is meaningful.
